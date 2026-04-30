from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_session_token
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import (
    EmailCodeLoginRequest,
    EmailSendCodeRequest,
    LoginPasswordRequest,
    LoginResponse,
    PasswordResetRequest,
    PhonePasswordLoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    SendResetCodeRequest,
    TokenRefreshResponse,
)
from app.schemas.user import UserRead
from app.services.auth_service import AuthService

router = APIRouter()


def _set_session_cookie(response: Response, session_token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_token,
        max_age=settings.session_cookie_max_age,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        domain=settings.session_cookie_domain,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        domain=settings.session_cookie_domain,
        path="/",
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )


@router.post("/register/email/send-code", status_code=status.HTTP_200_OK)
def send_register_email_code(
    payload: EmailSendCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    service = AuthService(db)
    return service.send_register_email_code(payload.email, request)


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
) -> UserRead:
    service = AuthService(db)
    return service.register_user(payload)


@router.post("/login/password", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login_with_password(
    payload: LoginPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    result = service.login_with_password(payload, request)
    _set_session_cookie(response, result.session_token)
    return result.response


@router.post("/login/password-code", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login_with_password_code_alias(
    payload: LoginPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    result = service.login_with_password(payload, request)
    _set_session_cookie(response, result.session_token)
    return result.response


@router.post("/login/email/send-code", status_code=status.HTTP_200_OK)
def send_email_login_code(
    payload: EmailSendCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    service = AuthService(db)
    return service.send_login_email_code(payload.email, request)


@router.post("/login/phone", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login_with_phone_password(
    payload: PhonePasswordLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    result = service.login_with_phone_password(payload, request)
    _set_session_cookie(response, result.session_token)
    return result.response


@router.post("/login/email", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login_with_email_code(
    payload: EmailCodeLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    result = service.login_with_email_code(payload, request)
    _set_session_cookie(response, result.session_token)
    return result.response


@router.post("/password/send-reset-code", status_code=status.HTTP_200_OK)
def send_reset_code(
    payload: SendResetCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    service = AuthService(db)
    return service.send_reset_code(
        target=payload.target,
        target_type=payload.target_type,
        request=request,
    )


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
    return service.refresh_access_token(payload)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def logout(
    response: Response,
    session_token: str | None = Depends(get_session_token),
    db: Session = Depends(get_db),
) -> Response:
    if session_token:
        service = AuthService(db)
        service.revoke_session(session_token)
    _clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserRead, status_code=status.HTTP_200_OK)
def get_current_user_profile(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
