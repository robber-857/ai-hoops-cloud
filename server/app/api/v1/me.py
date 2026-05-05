from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.enums import AnalysisType
from app.models.user import User
from app.schemas.me import (
    MeAchievementsResponse,
    MeAnnouncementsResponse,
    MeDashboardResponse,
    MeReportsResponse,
    MeSessionsResponse,
    MeTasksResponse,
    MeTrendsResponse,
    MeNotificationsResponse,
    AnnouncementSummaryRead,
    NotificationSummaryRead,
)
from app.services.me_service import MeService

router = APIRouter()


@router.get("/dashboard", response_model=MeDashboardResponse, status_code=status.HTTP_200_OK)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeDashboardResponse:
    service = MeService(db)
    return service.get_dashboard(current_user)


@router.get("/reports", response_model=MeReportsResponse, status_code=status.HTTP_200_OK)
def get_reports(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeReportsResponse:
    service = MeService(db)
    return service.get_reports(current_user, limit=limit)


@router.get("/training-sessions", response_model=MeSessionsResponse, status_code=status.HTTP_200_OK)
def get_training_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeSessionsResponse:
    service = MeService(db)
    return service.get_sessions(current_user, limit=limit)


@router.get("/tasks", response_model=MeTasksResponse, status_code=status.HTTP_200_OK)
def get_tasks(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeTasksResponse:
    service = MeService(db)
    return service.get_tasks(current_user, limit=limit)


@router.get("/achievements", response_model=MeAchievementsResponse, status_code=status.HTTP_200_OK)
def get_achievements(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeAchievementsResponse:
    service = MeService(db)
    return service.get_achievements(current_user, limit=limit)


@router.get("/announcements", response_model=MeAnnouncementsResponse, status_code=status.HTTP_200_OK)
def get_announcements(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeAnnouncementsResponse:
    service = MeService(db)
    return service.get_announcements(current_user, limit=limit)


@router.post(
    "/announcements/{announcement_public_id}/read",
    response_model=AnnouncementSummaryRead,
    status_code=status.HTTP_200_OK,
)
def mark_announcement_read(
    announcement_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnnouncementSummaryRead:
    service = MeService(db)
    return service.mark_announcement_read(current_user, announcement_public_id)


@router.get("/notifications", response_model=MeNotificationsResponse, status_code=status.HTTP_200_OK)
def get_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeNotificationsResponse:
    service = MeService(db)
    return service.get_notifications(current_user, limit=limit)


@router.post(
    "/notifications/{notification_public_id}/read",
    response_model=NotificationSummaryRead,
    status_code=status.HTTP_200_OK,
)
def mark_notification_read(
    notification_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationSummaryRead:
    service = MeService(db)
    return service.mark_notification_read(current_user, notification_public_id)


@router.get("/trends", response_model=MeTrendsResponse, status_code=status.HTTP_200_OK)
def get_trends(
    range: str = Query(default="30d"),
    analysis_type: AnalysisType | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeTrendsResponse:
    service = MeService(db)
    return service.get_trends(current_user, range, analysis_type)
