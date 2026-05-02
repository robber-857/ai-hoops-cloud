from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.coach import (
    CoachAnnouncementsResponse,
    CoachAnnouncementRead,
    CoachBulkUpdateAnnouncementsRequest,
    CoachBulkUpdateTasksRequest,
    CoachClassesResponse,
    CoachClassReportsResponse,
    CoachCreateAnnouncementRequest,
    CoachCreateTaskRequest,
    CoachDashboardResponse,
    CoachStudentProfileRead,
    CoachStudentReportsResponse,
    CoachStudentsResponse,
    CoachTaskDetailRead,
    CoachTaskRead,
    CoachTasksResponse,
    CoachUpdateAnnouncementRequest,
    CoachUpdateTaskRequest,
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


@router.get("/dashboard", response_model=CoachDashboardResponse, status_code=status.HTTP_200_OK)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachDashboardResponse:
    service = CoachService(db)
    return service.get_dashboard(current_user)


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


@router.get(
    "/classes/{class_public_id}/tasks",
    response_model=CoachTasksResponse,
    status_code=status.HTTP_200_OK,
)
def list_class_tasks(
    class_public_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    analysis_type: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    from_date: datetime | None = Query(default=None),
    to_date: datetime | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachTasksResponse:
    service = CoachService(db)
    return CoachTasksResponse(
        items=service.list_class_tasks(
            current_user,
            class_public_id,
            limit=limit,
            task_status=status_filter,
            analysis_type=analysis_type,
            keyword=keyword,
            from_date=from_date,
            to_date=to_date,
        )
    )


@router.post(
    "/classes/{class_public_id}/tasks/bulk-update",
    response_model=CoachTasksResponse,
    status_code=status.HTTP_200_OK,
)
def bulk_update_class_tasks(
    class_public_id: UUID,
    payload: CoachBulkUpdateTasksRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachTasksResponse:
    service = CoachService(db)
    return CoachTasksResponse(
        items=service.bulk_update_class_tasks(current_user, class_public_id, payload)
    )


@router.get(
    "/classes/{class_public_id}/tasks/{task_public_id}",
    response_model=CoachTaskDetailRead,
    status_code=status.HTTP_200_OK,
)
def get_class_task(
    class_public_id: UUID,
    task_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachTaskDetailRead:
    service = CoachService(db)
    return service.get_class_task(current_user, class_public_id, task_public_id)


@router.patch(
    "/classes/{class_public_id}/tasks/{task_public_id}",
    response_model=CoachTaskDetailRead,
    status_code=status.HTTP_200_OK,
)
def update_class_task(
    class_public_id: UUID,
    task_public_id: UUID,
    payload: CoachUpdateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachTaskDetailRead:
    service = CoachService(db)
    return service.update_class_task(current_user, class_public_id, task_public_id, payload)


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


@router.get(
    "/classes/{class_public_id}/announcements",
    response_model=CoachAnnouncementsResponse,
    status_code=status.HTTP_200_OK,
)
def list_class_announcements(
    class_public_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    is_pinned: bool | None = Query(default=None),
    keyword: str | None = Query(default=None),
    from_date: datetime | None = Query(default=None),
    to_date: datetime | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachAnnouncementsResponse:
    service = CoachService(db)
    return CoachAnnouncementsResponse(
        items=service.list_class_announcements(
            current_user,
            class_public_id,
            limit=limit,
            announcement_status=status_filter,
            is_pinned=is_pinned,
            keyword=keyword,
            from_date=from_date,
            to_date=to_date,
        )
    )


@router.post(
    "/classes/{class_public_id}/announcements/bulk-update",
    response_model=CoachAnnouncementsResponse,
    status_code=status.HTTP_200_OK,
)
def bulk_update_class_announcements(
    class_public_id: UUID,
    payload: CoachBulkUpdateAnnouncementsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachAnnouncementsResponse:
    service = CoachService(db)
    return CoachAnnouncementsResponse(
        items=service.bulk_update_class_announcements(current_user, class_public_id, payload)
    )


@router.patch(
    "/classes/{class_public_id}/announcements/{announcement_public_id}",
    response_model=CoachAnnouncementRead,
    status_code=status.HTTP_200_OK,
)
def update_class_announcement(
    class_public_id: UUID,
    announcement_public_id: UUID,
    payload: CoachUpdateAnnouncementRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachAnnouncementRead:
    service = CoachService(db)
    return service.update_class_announcement(
        current_user,
        class_public_id,
        announcement_public_id,
        payload,
    )


@router.get(
    "/students/{student_public_id}/profile",
    response_model=CoachStudentProfileRead,
    status_code=status.HTTP_200_OK,
)
def get_student_profile(
    student_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachStudentProfileRead:
    service = CoachService(db)
    return service.get_student_profile(current_user, student_public_id)


@router.get(
    "/students/{student_public_id}/reports",
    response_model=CoachStudentReportsResponse,
    status_code=status.HTTP_200_OK,
)
def list_student_reports(
    student_public_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoachStudentReportsResponse:
    service = CoachService(db)
    return CoachStudentReportsResponse(
        items=service.list_student_reports(current_user, student_public_id, limit=limit)
    )
