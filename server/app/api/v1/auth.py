from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.auth import (
    EmailCodeLoginRequest,
    EmailSendCodeRequest,
    LoginPasswordCodeRequest,
    LoginResponse,
    PasswordResetRequest,
    PhoneCodeLoginRequest,
    PhoneSendCodeRequest,
    RefreshTokenRequest,
    RegisterRequest,
    SendCodeRequest,
    SendResetCodeRequest,
    TokenRefreshResponse,
)
from app.schemas.user import UserRead
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register/send-code", status_code=status.HTTP_200_OK)
def send_register_code(payload: SendCodeRequest) -> dict:
    return {
        "message": "Register verification code accepted for processing.",
        "data": {"expire_seconds": 300, "target": payload.phone_number},
    }


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
) -> UserRead:
    service = AuthService(db)
    return service.register_user(payload)


@router.post(
    "/login/password-code",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
)
def login_with_password_code(
    payload: LoginPasswordCodeRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    return service.login_with_password_code(payload)


@router.post("/login/phone/send-code", status_code=status.HTTP_200_OK)
def send_phone_login_code(payload: PhoneSendCodeRequest) -> dict:
    return {
        "message": "Phone login verification code accepted for processing.",
        "data": {"expire_seconds": 300, "target": payload.phone_number},
    }


@router.post("/login/email/send-code", status_code=status.HTTP_200_OK)
def send_email_login_code(payload: EmailSendCodeRequest) -> dict:
    return {
        "message": "Email login verification code accepted for processing.",
        "data": {"expire_seconds": 300, "target": payload.email},
    }


@router.post("/login/phone", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login_with_phone_code(
    payload: PhoneCodeLoginRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    return service.login_with_phone_code(payload)


@router.post("/login/email", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login_with_email_code(
    payload: EmailCodeLoginRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    return service.login_with_email_code(payload)


@router.post("/password/send-reset-code", status_code=status.HTTP_200_OK)
def send_reset_code(payload: SendResetCodeRequest) -> dict:
    return {
        "message": "Password reset verification code accepted for processing.",
        "data": {"expire_seconds": 300, "target": payload.target},
    }


@router.post("/password/reset", status_code=status.HTTP_200_OK)
def reset_password(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> dict:
    service = AuthService(db)
    service.reset_password(payload)
    return {"message": "Password reset successful."}


@router.post(
    "/refresh",
    response_model=TokenRefreshResponse,
    status_code=status.HTTP_200_OK,
)
def refresh_token(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> TokenRefreshResponse:
    service = AuthService(db)
    return service.refresh_access_token(payload.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def logout() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserRead, status_code=status.HTTP_200_OK)
def get_current_user_placeholder() -> UserRead:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Authentication dependency not wired yet.",
    )
