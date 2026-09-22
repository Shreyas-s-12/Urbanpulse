from fastapi import Request, Depends, HTTPException, status
from uuid import UUID
from types import SimpleNamespace
from typing import Optional

from app.security.auth import get_current_user_optional
from app.models.user import User

async def get_current_user(
    request: Request,
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Unified authentication dependency.
    If authenticated via session cookie or Authorization header, returns the real User.
    In testing/dev without session, falls back to a development user UUID.
    """
    if user:
        return user
    # Fallback for dev / unauthenticated monitoring calls
    return SimpleNamespace(id=UUID("123e4567-e89b-12d3-a456-426614174000"), name="UrbanPulse Explorer", email="guest@urbanpulse.ai")

