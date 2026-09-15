from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from uuid import UUID
from types import SimpleNamespace

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

async def get_current_user(token: str | None = Depends(oauth2_scheme)):
    """Stub authentication dependency.
    In production this would verify the JWT and fetch the user from DB.
    Here we return a dummy user with a fixed UUID for ownership checks.
    """
    # If token is missing, still return a dummy user for testing
    if not token:
        return SimpleNamespace(id=UUID("123e4567-e89b-12d3-a456-426614174000"))
    # Dummy user; replace with real lookup as needed.
    return SimpleNamespace(id=UUID("123e4567-e89b-12d3-a456-426614174000"))
