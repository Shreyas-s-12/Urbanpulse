from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional
from datetime import datetime
import re

class SignUpRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name of user")
    email: str = Field(..., description="Email address")
    password: str = Field(..., min_length=8, description="Password (min 8 chars)")
    confirm_password: str = Field(..., min_length=8, description="Confirmation password")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", clean):
            raise ValueError("Please provide a valid email address.")
        return clean

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        password = info.data.get("password")
        if password and v != password:
            raise ValueError("Passwords do not match.")
        return v

class SignInRequest(BaseModel):
    email: str = Field(..., description="Email address")
    password: str = Field(..., min_length=1, description="Password")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    oauth_provider: Optional[str] = None
    created_at: Optional[datetime] = None

class AuthResponse(BaseModel):
    message: str
    authenticated: bool = True
    mode: str = "user"
    user: UserResponse

class GuestAuthResponse(BaseModel):
    message: str = "Guest session initialized."
    authenticated: bool = False
    mode: str = "guest"
    user: Optional[UserResponse] = None

class SessionMeResponse(BaseModel):
    authenticated: bool
    mode: str
    user: Optional[UserResponse] = None
