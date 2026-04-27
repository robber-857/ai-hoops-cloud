from collections.abc import Generator

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User
from app.services.auth_service import AuthService


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session_token(request: Request) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


def get_bearer_token(authorization: str | None = Header(default=None)) -> str | None:
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def get_current_user(
    session_token: str | None = Depends(get_session_token),
    bearer_token: str | None = Depends(get_bearer_token),
    db: Session = Depends(get_db),
) -> User:
    service = AuthService(db)
    user: User | None = None

    if session_token:
        user = service.get_current_user_from_session_token(session_token)

    if not user and bearer_token:
        user = service.get_user_from_access_token(bearer_token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    return user
