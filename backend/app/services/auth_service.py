"""
UrbanPulse Authentication Service
Handles:
- User signup with Argon2id password hashing
- Email & password authentication
- Google OAuth standard authorization code exchange
- Graceful degradation when Google credentials are unconfigured
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.auth_schema import SignUpRequest, SignInRequest
from app.security.auth import hash_password, verify_password

class AuthService:

    @staticmethod
    async def signup_user(db: AsyncSession, req: SignUpRequest) -> User:
        """Register a new user with Argon2id hashed password."""
        email_clean = req.email.strip().lower()
        result = await db.execute(select(User).where(User.email == email_clean))
        existing_user = result.scalars().first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists. Please sign in.",
            )

        hashed = hash_password(req.password)
        new_user = User(
            name=req.name.strip(),
            email=email_clean,
            hashed_password=hashed,
            oauth_provider="local",
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user

    @staticmethod
    async def authenticate_user(db: AsyncSession, req: SignInRequest) -> User:
        """Authenticate user with email and password using Argon2id."""
        email_clean = req.email.strip().lower()
        result = await db.execute(select(User).where(User.email == email_clean))
        user = result.scalars().first()

        if not user or not user.hashed_password:
            # Perform dummy verification to mitigate timing attacks
            verify_password("$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash", req.password)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        if not verify_password(user.hashed_password, req.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        return user

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
        """Fetch user by primary key ID."""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalars().first()
