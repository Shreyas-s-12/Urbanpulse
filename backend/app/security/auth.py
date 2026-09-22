"""
UrbanPulse Security & Authentication Engine
- Argon2id password hashing and constant-time verification
- Secure JWT sessions with HTTP-only cookie management
- Independence from frontend storage (no tokens stored in localStorage)
"""
import uuid
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from fastapi import Request, Response, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User

_hasher = PasswordHasher()

def hash_password(password: str) -> str:
    """Hash plaintext password with Argon2id."""
    return _hasher.hash(password)

def verify_password(hashed_password: str, plain_password: str) -> bool:
    """Verify password against Argon2id hash."""
    if not hashed_password or not plain_password:
        return False
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False

def create_session_token(user_id: str, email: str) -> str:
    """Generate signed JWT session token for authenticated user."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "mode": "user",
        "iat": now,
        "exp": now + timedelta(seconds=settings.SESSION_MAX_AGE_SECONDS),
        "iss": "UrbanPulse Auth",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

def create_guest_session_token() -> str:
    """Generate signed JWT guest session token."""
    now = datetime.now(timezone.utc)
    guest_id = f"guest_{uuid.uuid4().hex[:12]}"
    payload = {
        "sub": guest_id,
        "mode": "guest",
        "iat": now,
        "exp": now + timedelta(seconds=settings.SESSION_MAX_AGE_SECONDS),
        "iss": "UrbanPulse Auth",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

def decode_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT session token."""
    if not token:
        return None
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except (jwt.PyJWTError, Exception):
        return None

def set_session_cookie(response: Response, token: str) -> None:
    """Attach secure HTTP-only session cookie to response."""
    is_prod = settings.ENVIRONMENT.lower() == "production"
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        path="/",
    )

def clear_session_cookie(response: Response) -> None:
    """Erase session cookie."""
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
    )

async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Retrieve authenticated User from session cookie if present, else None."""
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        # Also check Authorization: Bearer token for API clients / testing
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            
    if not token:
        return None
        
    payload = decode_session_token(token)
    if not payload or not payload.get("sub") or payload.get("mode") == "guest":
        return None
        
    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    return user

async def get_current_user_required(
    user: Optional[User] = Depends(get_current_user_optional)
) -> User:
    """Enforce authentication requirement; raise 401 if unauthenticated."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access this resource.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def get_current_session_info(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieve full session state (authenticated user, guest, or unauthenticated)."""
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        return {"authenticated": False, "mode": "unauthenticated", "user": None}

    payload = decode_session_token(token)
    if not payload:
        return {"authenticated": False, "mode": "unauthenticated", "user": None}

    if payload.get("mode") == "guest":
        return {"authenticated": False, "mode": "guest", "user": None}

    user_id = payload.get("sub")
    if not user_id:
        return {"authenticated": False, "mode": "unauthenticated", "user": None}

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user:
        return {"authenticated": True, "mode": "user", "user": user}
    return {"authenticated": False, "mode": "unauthenticated", "user": None}
