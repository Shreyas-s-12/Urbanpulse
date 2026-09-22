import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.db.database import Base
from app.models.user import User
from app.schemas.auth_schema import SignUpRequest, SignInRequest
from app.services.auth_service import AuthService
from app.security.auth import (
    hash_password,
    verify_password,
    create_session_token,
    decode_session_token,
)
from fastapi import HTTPException

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def async_db():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

def test_argon2id_hashing():
    pw = "P@ssword123!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert hashed.startswith("$argon2id$")
    assert verify_password(hashed, pw) is True
    assert verify_password(hashed, "WrongPassword") is False

def test_jwt_session_token():
    user_id = "test-user-uuid-1234"
    email = "researcher@urbanpulse.ai"
    token = create_session_token(user_id, email)
    assert isinstance(token, str)
    decoded = decode_session_token(token)
    assert decoded is not None
    assert decoded["sub"] == user_id
    assert decoded["email"] == email

@pytest.mark.asyncio
async def test_signup_and_signin_flow(async_db: AsyncSession):
    # 1. Sign up normal user
    signup_req = SignUpRequest(
        name="Alex Rivera",
        email="alex.rivera@gmail.com",  # verify standard email including gmail
        password="SecurePassword999",
        confirm_password="SecurePassword999",
    )
    user = await AuthService.signup_user(async_db, signup_req)
    assert user.id is not None
    assert user.name == "Alex Rivera"
    assert user.email == "alex.rivera@gmail.com"
    assert user.hashed_password.startswith("$argon2id$")

    # 2. Duplicate signup fails with 400
    with pytest.raises(HTTPException) as exc_info:
        await AuthService.signup_user(async_db, signup_req)
    assert exc_info.value.status_code == 400

    # 3. Sign in successfully
    signin_req = SignInRequest(
        email="alex.rivera@gmail.com",
        password="SecurePassword999",
    )
    auth_user = await AuthService.authenticate_user(async_db, signin_req)
    assert auth_user.id == user.id

    # 4. Sign in with invalid password fails with 401
    bad_signin = SignInRequest(
        email="alex.rivera@gmail.com",
        password="WrongPassword123",
    )
    with pytest.raises(HTTPException) as exc_info2:
        await AuthService.authenticate_user(async_db, bad_signin)
    assert exc_info2.value.status_code == 401

def test_guest_session_token():
    from app.security.auth import create_guest_session_token
    token = create_guest_session_token()
    assert isinstance(token, str)
    decoded = decode_session_token(token)
    assert decoded is not None
    assert decoded["mode"] == "guest"
    assert decoded["sub"].startswith("guest_")

@pytest.mark.asyncio
async def test_auth_router_endpoints(async_db: AsyncSession):
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.db.database import get_db

    async def override_get_db():
        yield async_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Check me when unauthenticated
        res_me = await ac.get("/api/auth/me")
        assert res_me.status_code == 200
        data_me = res_me.json()
        assert data_me["authenticated"] is False
        assert data_me["mode"] == "unauthenticated"

        # 2. Guest session initiation
        res_guest = await ac.post("/api/auth/guest")
        assert res_guest.status_code == 200
        data_guest = res_guest.json()
        assert data_guest["authenticated"] is False
        assert data_guest["mode"] == "guest"
        assert "urbanpulse_session" in res_guest.cookies

        # 3. Check me with guest cookie
        res_me_guest = await ac.get("/api/auth/me", cookies=res_guest.cookies)
        assert res_me_guest.status_code == 200
        assert res_me_guest.json()["mode"] == "guest"
        assert res_me_guest.json()["authenticated"] is False

        # 4. Sign up
        res_signup = await ac.post("/api/auth/signup", json={
            "name": "Maria Garcia",
            "email": "maria.garcia@gmail.com",
            "password": "Password1234!",
            "confirm_password": "Password1234!"
        })
        assert res_signup.status_code == 201
        assert res_signup.json()["authenticated"] is True
        assert res_signup.json()["mode"] == "user"
        user_cookies = res_signup.cookies

        # 5. Check me with authenticated user cookie
        res_me_user = await ac.get("/api/auth/me", cookies=user_cookies)
        assert res_me_user.status_code == 200
        assert res_me_user.json()["authenticated"] is True
        assert res_me_user.json()["mode"] == "user"
        assert res_me_user.json()["user"]["email"] == "maria.garcia@gmail.com"

        # 6. Logout
        res_logout = await ac.post("/api/auth/logout")
        assert res_logout.status_code == 200

    app.dependency_overrides.clear()
