from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_numeric_code,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.enums import SessionStatus, VerificationCodeStatus, VerificationScene, VerificationTargetType
from app.models.user import User
from app.models.user_session import UserSession
from app.models.verification_code import VerificationCode
from app.schemas.auth import (
    EmailCodeLoginRequest,
    LoginPasswordRequest,
    LoginResponse,
    PasswordResetRequest,
    PhoneCodeLoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenRefreshResponse,
)
from app.schemas.user import UserRead
from app.services.delivery_service import DeliveryService


@dataclass
class LoginSessionResult:
    response: LoginResponse
    session_token: str


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.delivery_service = DeliveryService()

    def send_register_phone_code(self, phone_number: str, request: Request) -> dict:
        normalized_phone = self._normalize_phone_number(phone_number)
        if self.db.scalar(select(User).where(User.phone_number == normalized_phone)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number already exists.",
            )

        code = self._issue_verification_code(
            target=normalized_phone,
            target_type=VerificationTargetType.phone,
            scene=VerificationScene.register,
            request=request,
        )
        return self._build_send_code_response(
            message="Register phone verification code accepted for processing.",
            target=normalized_phone,
            target_type=VerificationTargetType.phone,
            code=code,
        )

    def send_register_email_code(self, email: str, request: Request) -> dict:
        normalized_email = self._normalize_email(email)
        if self.db.scalar(select(User).where(User.email == normalized_email)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists.",
            )

        code = self._issue_verification_code(
            target=normalized_email,
            target_type=VerificationTargetType.email,
            scene=VerificationScene.register,
            request=request,
        )
        return self._build_send_code_response(
            message="Register email verification code accepted for processing.",
            target=normalized_email,
            target_type=VerificationTargetType.email,
            code=code,
        )

    def send_login_phone_code(self, phone_number: str, request: Request) -> dict:
        normalized_phone = self._normalize_phone_number(phone_number)
        user = self.db.scalar(select(User).where(User.phone_number == normalized_phone))
        code: str | None = None

        if user:
            code = self._issue_verification_code(
                target=normalized_phone,
                target_type=VerificationTargetType.phone,
                scene=VerificationScene.login,
                request=request,
                user_id=user.id,
            )

        return self._build_send_code_response(
            message="Phone login verification code accepted for processing.",
            target=normalized_phone,
            target_type=VerificationTargetType.phone,
            code=code,
        )

    def send_login_email_code(self, email: str, request: Request) -> dict:
        normalized_email = self._normalize_email(email)
        user = self.db.scalar(select(User).where(User.email == normalized_email))
        code: str | None = None

        if user:
            code = self._issue_verification_code(
                target=normalized_email,
                target_type=VerificationTargetType.email,
                scene=VerificationScene.login,
                request=request,
                user_id=user.id,
            )

        return self._build_send_code_response(
            message="Email login verification code accepted for processing.",
            target=normalized_email,
            target_type=VerificationTargetType.email,
            code=code,
        )

    def send_reset_code(
        self,
        *,
        target: str,
        target_type: VerificationTargetType,
        request: Request,
    ) -> dict:
        normalized_target = (
            self._normalize_phone_number(target)
            if target_type == VerificationTargetType.phone
            else self._normalize_email(target)
        )
        user = self._find_user_by_target(normalized_target, target_type)
        code: str | None = None

        if user:
            code = self._issue_verification_code(
                target=normalized_target,
                target_type=target_type,
                scene=VerificationScene.reset_password,
                request=request,
                user_id=user.id,
            )

        return self._build_send_code_response(
            message="Password reset verification code accepted for processing.",
            target=normalized_target,
            target_type=target_type,
            code=code,
        )

    def register_user(self, payload: RegisterRequest) -> UserRead:
        normalized_phone = self._normalize_phone_number(payload.phone_number)
        normalized_email = self._normalize_optional_email(payload.email)

        self._ensure_user_uniqueness(payload.username, normalized_phone, normalized_email)
        self._verify_code_or_raise(
            target=normalized_phone,
            target_type=VerificationTargetType.phone,
            scene=VerificationScene.register,
            code=payload.phone_code,
        )

        email_verified = False
        if normalized_email:
            if not payload.email_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email verification code is required when email is provided.",
                )

            self._verify_code_or_raise(
                target=normalized_email,
                target_type=VerificationTargetType.email,
                scene=VerificationScene.register,
                code=payload.email_code,
            )
            email_verified = True

        user = User(
            username=payload.username,
            password_hash=hash_password(payload.password),
            phone_number=normalized_phone,
            email=normalized_email,
            is_phone_verified=True,
            is_email_verified=email_verified,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return UserRead.model_validate(user)

    def login_with_password(
        self,
        payload: LoginPasswordRequest,
        request: Request,
    ) -> LoginSessionResult:
        user = self.db.scalar(select(User).where(User.username == payload.username))
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password.",
            )

        self._ensure_user_can_authenticate(user)
        return self._build_login_session(user=user, request=request)

    def login_with_phone_code(
        self,
        payload: PhoneCodeLoginRequest,
        request: Request,
    ) -> LoginSessionResult:
        normalized_phone = self._normalize_phone_number(payload.phone_number)
        self._verify_code_or_raise(
            target=normalized_phone,
            target_type=VerificationTargetType.phone,
            scene=VerificationScene.login,
            code=payload.code,
        )

        user = self.db.scalar(select(User).where(User.phone_number == normalized_phone))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid phone number or verification code.",
            )

        self._ensure_user_can_authenticate(user)
        return self._build_login_session(user=user, request=request)

    def login_with_email_code(
        self,
        payload: EmailCodeLoginRequest,
        request: Request,
    ) -> LoginSessionResult:
        normalized_email = self._normalize_email(payload.email)
        self._verify_code_or_raise(
            target=normalized_email,
            target_type=VerificationTargetType.email,
            scene=VerificationScene.login,
            code=payload.code,
        )

        user = self.db.scalar(select(User).where(User.email == normalized_email))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or verification code.",
            )

        self._ensure_user_can_authenticate(user)
        return self._build_login_session(user=user, request=request)

    def reset_password(self, payload: PasswordResetRequest) -> None:
        normalized_target = (
            self._normalize_phone_number(payload.target)
            if payload.target_type == VerificationTargetType.phone
            else self._normalize_email(payload.target)
        )
        self._verify_code_or_raise(
            target=normalized_target,
            target_type=payload.target_type,
            scene=VerificationScene.reset_password,
            code=payload.code,
        )

        user = self._find_user_by_target(normalized_target, payload.target_type)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        user.password_hash = hash_password(payload.new_password)
        self.db.add(user)
        self.db.commit()

    def refresh_access_token(self, payload: RefreshTokenRequest) -> TokenRefreshResponse:
        session = self._get_active_session(payload.refresh_token)

        try:
            token_payload = jwt.decode(
                payload.refresh_token,
                settings.jwt_refresh_secret_key,
                algorithms=[settings.jwt_algorithm],
            )
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token.",
            ) from exc

        subject = token_payload.get("sub")
        token_type = token_payload.get("type")
        if not subject or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token payload.",
            )

        if str(session.user_id) != str(subject):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session does not match refresh token.",
            )

        session.last_active_at = datetime.now(timezone.utc)
        self.db.add(session)
        self.db.commit()
        return TokenRefreshResponse(access_token=create_access_token(subject))

    def get_current_user_from_session_token(self, session_token: str) -> User | None:
        session = self._get_active_session(session_token, raise_on_missing=False)
        if not session:
            return None

        user = session.user
        if not user or not user.is_active:
            return None

        session.last_active_at = datetime.now(timezone.utc)
        self.db.add(session)
        self.db.commit()
        return user

    def get_user_from_access_token(self, access_token: str) -> User | None:
        try:
            payload = jwt.decode(
                access_token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
            )
        except JWTError:
            return None

        if payload.get("type") != "access":
            return None

        subject = payload.get("sub")
        if not subject:
            return None

        try:
            user_id = int(subject)
        except (TypeError, ValueError):
            return None

        user = self.db.get(User, user_id)
        if not user or not user.is_active:
            return None
        return user

    def revoke_session(self, session_token: str) -> None:
        session = self._get_active_session(session_token, raise_on_missing=False)
        if not session:
            return

        session.status = SessionStatus.revoked
        session.revoked_at = datetime.now(timezone.utc)
        self.db.add(session)
        self.db.commit()

    def _build_login_session(self, *, user: User, request: Request) -> LoginSessionResult:
        now = datetime.now(timezone.utc)
        refresh_token = create_refresh_token(str(user.id))
        session = UserSession(
            user_id=user.id,
            refresh_token_hash=hash_token(refresh_token),
            device_type="browser",
            user_agent=request.headers.get("user-agent"),
            ip_address=self._get_request_ip(request),
            status=SessionStatus.active,
            expire_at=now + timedelta(days=settings.refresh_token_expire_days),
            last_active_at=now,
        )
        user.last_login_at = now

        self.db.add(session)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return LoginSessionResult(
            response=LoginResponse(
                access_token=create_access_token(str(user.id)),
                refresh_token=refresh_token,
                user=UserRead.model_validate(user),
            ),
            session_token=refresh_token,
        )

    def _issue_verification_code(
        self,
        *,
        target: str,
        target_type: VerificationTargetType,
        scene: VerificationScene,
        request: Request,
        user_id: int | None = None,
    ) -> str:
        self._enforce_verification_send_cooldown(
            target=target,
            target_type=target_type,
            scene=scene,
        )
        self._invalidate_pending_codes(
            target=target,
            target_type=target_type,
            scene=scene,
        )

        code = generate_numeric_code()
        now = datetime.now(timezone.utc)
        record = VerificationCode(
            target=target,
            target_type=target_type,
            scene=scene,
            code=code,
            status=VerificationCodeStatus.pending,
            user_id=user_id,
            expire_at=now + timedelta(seconds=settings.verification_code_expire_seconds),
            sent_at=now,
            attempt_count=0,
            max_attempts=settings.verification_code_max_attempts,
            request_ip=self._get_request_ip(request),
            request_device=request.headers.get("user-agent"),
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)

        try:
            self.delivery_service.send_verification_code(
                target=target,
                target_type=target_type,
                scene=scene,
                code=code,
            )
        except RuntimeError as exc:
            self.db.delete(record)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc

        return code

    def _verify_code_or_raise(
        self,
        *,
        target: str,
        target_type: VerificationTargetType,
        scene: VerificationScene,
        code: str,
    ) -> VerificationCode:
        record = self.db.scalar(
            select(VerificationCode)
            .where(
                VerificationCode.target == target,
                VerificationCode.target_type == target_type,
                VerificationCode.scene == scene,
                VerificationCode.status == VerificationCodeStatus.pending,
            )
            .order_by(VerificationCode.created_at.desc())
        )

        if not record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code.",
            )

        now = datetime.now(timezone.utc)
        if record.expire_at <= now:
            record.status = VerificationCodeStatus.expired
            self.db.add(record)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired.",
            )

        if record.attempt_count >= record.max_attempts:
            record.status = VerificationCodeStatus.invalidated
            self.db.add(record)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has been locked. Please request a new one.",
            )

        if record.code != code:
            record.attempt_count += 1
            if record.attempt_count >= record.max_attempts:
                record.status = VerificationCodeStatus.invalidated
            self.db.add(record)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code.",
            )

        record.status = VerificationCodeStatus.used
        record.used_at = now
        self.db.add(record)
        self.db.commit()
        return record

    def _build_send_code_response(
        self,
        *,
        message: str,
        target: str,
        target_type: VerificationTargetType,
        code: str | None,
    ) -> dict:
        data = {
            "expire_seconds": settings.verification_code_expire_seconds,
            "target": self._mask_target(target, target_type),
        }
        if code and not settings.is_production:
            data["debug_code"] = code

        return {
            "message": message,
            "data": data,
        }

    def _get_active_session(
        self,
        session_token: str,
        *,
        raise_on_missing: bool = True,
    ) -> UserSession | None:
        token_hash = hash_token(session_token)
        session = self.db.scalar(
            select(UserSession)
            .where(UserSession.refresh_token_hash == token_hash)
            .order_by(UserSession.created_at.desc())
        )
        if not session:
            if raise_on_missing:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid session.",
                )
            return None

        now = datetime.now(timezone.utc)
        if session.status != SessionStatus.active:
            if raise_on_missing:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session is no longer active.",
                )
            return None

        if session.expire_at <= now:
            session.status = SessionStatus.expired
            self.db.add(session)
            self.db.commit()
            if raise_on_missing:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session has expired.",
                )
            return None

        return session

    def _invalidate_pending_codes(
        self,
        *,
        target: str,
        target_type: VerificationTargetType,
        scene: VerificationScene,
    ) -> None:
        pending_codes = self.db.scalars(
            select(VerificationCode).where(
                VerificationCode.target == target,
                VerificationCode.target_type == target_type,
                VerificationCode.scene == scene,
                VerificationCode.status == VerificationCodeStatus.pending,
            )
        ).all()

        for pending_code in pending_codes:
            pending_code.status = VerificationCodeStatus.invalidated
            self.db.add(pending_code)

    def _enforce_verification_send_cooldown(
        self,
        *,
        target: str,
        target_type: VerificationTargetType,
        scene: VerificationScene,
    ) -> None:
        latest_code = self.db.scalar(
            select(VerificationCode)
            .where(
                VerificationCode.target == target,
                VerificationCode.target_type == target_type,
                VerificationCode.scene == scene,
            )
            .order_by(VerificationCode.created_at.desc())
        )
        if not latest_code:
            return

        latest_created_at = latest_code.created_at
        if latest_created_at.tzinfo is None:
            latest_created_at = latest_created_at.replace(tzinfo=timezone.utc)

        elapsed_seconds = int(
            (datetime.now(timezone.utc) - latest_created_at.astimezone(timezone.utc)).total_seconds()
        )
        remaining_seconds = settings.verification_code_resend_cooldown_seconds - elapsed_seconds
        if remaining_seconds > 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining_seconds}s before requesting another code.",
            )

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

    def _ensure_user_can_authenticate(self, user: User) -> None:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is not active.",
            )

    def _find_user_by_target(
        self,
        target: str,
        target_type: VerificationTargetType,
    ) -> User | None:
        statement = (
            select(User).where(User.phone_number == target)
            if target_type == VerificationTargetType.phone
            else select(User).where(User.email == target)
        )
        return self.db.scalar(statement)

    def _normalize_phone_number(self, phone_number: str) -> str:
        phone_number = phone_number.strip()
        normalized = "".join(
            character for character in phone_number if character.isdigit() or character == "+"
        )
        return normalized or phone_number

    def _normalize_email(self, email: str) -> str:
        return email.strip().lower()

    def _normalize_optional_email(self, email: str | None) -> str | None:
        if not email:
            return None
        return self._normalize_email(email)

    def _mask_target(
        self,
        target: str,
        target_type: VerificationTargetType,
    ) -> str:
        if target_type == VerificationTargetType.phone:
            suffix = target[-4:] if len(target) >= 4 else target
            return f"***{suffix}"

        local, _, domain = target.partition("@")
        if not domain:
            return target
        visible_local = local[:2] if len(local) > 2 else local[:1]
        return f"{visible_local}***@{domain}"

    def _get_request_ip(self, request: Request) -> str | None:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        if request.client:
            return request.client.host
        return None
