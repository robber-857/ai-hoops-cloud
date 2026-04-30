from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.coach import (
    CoachAnnouncementRead,
    CoachClassesResponse,
    CoachClassReportsResponse,
    CoachCreateAnnouncementRequest,
    CoachCreateTaskRequest,
    CoachStudentsResponse,
    CoachTaskRead,
)
from app.services.coach_service import CoachService

router = APIRouter()


@router.get("/classes", response_model=CoachClassesResponse, status_code=status.HTTP_200_OK)
def list_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachClassesResponse:
    service = CoachService(db)
    return CoachClassesResponse(items=service.list_classes(current_user))


@router.get(
    "/classes/{class_public_id}/students",
    response_model=CoachStudentsResponse,
    status_code=status.HTTP_200_OK,
)
def list_class_students(
    class_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachStudentsResponse:
    service = CoachService(db)
    return CoachStudentsResponse(items=service.list_class_students(current_user, class_public_id))


@router.get(
    "/classes/{class_public_id}/reports",
    response_model=CoachClassReportsResponse,
    status_code=status.HTTP_200_OK,
)
def list_class_reports(
    class_public_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachClassReportsResponse:
    service = CoachService(db)
    return CoachClassReportsResponse(
        items=service.list_class_reports(current_user, class_public_id, limit=limit)
    )


@router.post(
    "/classes/{class_public_id}/tasks",
    response_model=CoachTaskRead,
    status_code=status.HTTP_201_CREATED,
)
def create_class_task(
    class_public_id: UUID,
    payload: CoachCreateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachTaskRead:
    service = CoachService(db)
    return service.create_class_task(current_user, class_public_id, payload)


@router.post(
    "/classes/{class_public_id}/announcements",
    response_model=CoachAnnouncementRead,
    status_code=status.HTTP_201_CREATED,
)
def create_class_announcement(
    class_public_id: UUID,
    payload: CoachCreateAnnouncementRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachAnnouncementRead:
    service = CoachService(db)
    return service.create_class_announcement(current_user, class_public_id, payload)
