from __future__ import annotations

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    EmailCodeLoginRequest,
    LoginPasswordCodeRequest,
    LoginResponse,
    PasswordResetRequest,
    PhoneCodeLoginRequest,
    RegisterRequest,
    TokenRefreshResponse,
)
from app.schemas.user import UserRead


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def register_user(self, payload: RegisterRequest) -> UserRead:
        self._ensure_user_uniqueness(payload.username, payload.phone_number, payload.email)

        user = User(
            username=payload.username,
            password_hash=hash_password(payload.password),
            phone_number=payload.phone_number,
            email=payload.email,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return UserRead.model_validate(user)

    def login_with_password_code(self, payload: LoginPasswordCodeRequest) -> LoginResponse:
        user = self.db.scalar(select(User).where(User.username == payload.username))
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password.",
            )

        return LoginResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
            user=UserRead.model_validate(user),
        )

    def login_with_phone_code(self, payload: PhoneCodeLoginRequest) -> LoginResponse:
        user = self.db.scalar(select(User).where(User.phone_number == payload.phone_number))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid phone number or verification code.",
            )

        return LoginResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
            user=UserRead.model_validate(user),
        )

    def login_with_email_code(self, payload: EmailCodeLoginRequest) -> LoginResponse:
        user = self.db.scalar(select(User).where(User.email == payload.email))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or verification code.",
            )

        return LoginResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
            user=UserRead.model_validate(user),
        )

    def reset_password(self, payload: PasswordResetRequest) -> None:
        statement = select(User).where(
            User.phone_number == payload.target
            if payload.target_type.value == "phone"
            else User.email == payload.target
        )
        user = self.db.scalar(statement)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        user.password_hash = hash_password(payload.new_password)
        self.db.add(user)
        self.db.commit()

    def refresh_access_token(self, refresh_token: str) -> TokenRefreshResponse:
        try:
            payload = jwt.decode(
                refresh_token,
                settings.jwt_refresh_secret_key,
                algorithms=[settings.jwt_algorithm],
            )
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token.",
            ) from exc

        subject = payload.get("sub")
        token_type = payload.get("type")
        if not subject or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token payload.",
            )

        return TokenRefreshResponse(access_token=create_access_token(subject))

    def _ensure_user_uniqueness(
        self,
        username: str,
        phone_number: str,
        email: str | None,
    ) -> None:
        conflicts = [
            self.db.scalar(select(User).where(User.username == username)),
            self.db.scalar(select(User).where(User.phone_number == phone_number)),
        ]
        if email:
            conflicts.append(self.db.scalar(select(User).where(User.email == email)))

        if any(conflicts):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username, phone number, or email already exists.",
            )
