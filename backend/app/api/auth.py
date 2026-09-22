"""
UrbanPulse Authentication Router
Exposes:
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/guest
"""
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from app.db.database import get_db
from app.schemas.auth_schema import (
    SignUpRequest,
    SignInRequest,
    UserResponse,
    AuthResponse,
    GuestAuthResponse,
    SessionMeResponse,
)
from app.security.auth import (
    create_session_token,
    create_guest_session_token,
    set_session_cookie,
    clear_session_cookie,
    get_current_session_info,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    req: SignUpRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user with Argon2id hash, issue session token, and set secure HTTP-only cookie."""
    user = await AuthService.signup_user(db, req)
    token = create_session_token(user_id=user.id, email=user.email)
    set_session_cookie(response, token)
    return AuthResponse(
        message="Account created successfully.",
        authenticated=True,
        mode="user",
        user=UserResponse.model_validate(user),
    )

@router.post("/login", response_model=AuthResponse)
async def login(
    req: SignInRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user with email and password, setting secure HTTP-only cookie."""
    user = await AuthService.authenticate_user(db, req)
    token = create_session_token(user_id=user.id, email=user.email)
    set_session_cookie(response, token)
    return AuthResponse(
        message="Signed in successfully.",
        authenticated=True,
        mode="user",
        user=UserResponse.model_validate(user),
    )

@router.post("/logout")
async def logout(response: Response):
    """Clear session cookie to log out the user."""
    clear_session_cookie(response)
    return {"message": "Signed out successfully."}

@router.get("/me", response_model=SessionMeResponse)
async def get_me(session_info: Dict[str, Any] = Depends(get_current_session_info)):
    """Retrieve details of current session (authenticated user, guest, or unauthenticated)."""
    if session_info["authenticated"] and session_info["user"]:
        return SessionMeResponse(
            authenticated=True,
            mode="user",
            user=UserResponse.model_validate(session_info["user"]),
        )
    elif session_info.get("mode") == "guest":
        return SessionMeResponse(
            authenticated=False,
            mode="guest",
            user=None,
        )
    return SessionMeResponse(
        authenticated=False,
        mode="unauthenticated",
        user=None,
    )

@router.post("/guest", response_model=GuestAuthResponse)
async def continue_as_guest(response: Response):
    """Initialize a real guest session with HTTP-only cookie without persisting to user database."""
    guest_token = create_guest_session_token()
    set_session_cookie(response, guest_token)
    return GuestAuthResponse(
        message="Guest session initialized.",
        authenticated=False,
        mode="guest",
        user=None,
    )
