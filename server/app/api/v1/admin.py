from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.admin import (
    AdminAnnouncementRead,
    AdminAnnouncementsResponse,
    AdminCampRead,
    AdminCampsResponse,
    AdminClassMemberRead,
    AdminClassMembersResponse,
    AdminClassRead,
    AdminClassesResponse,
    AdminCreateAnnouncementRequest,
    AdminCreateCampRequest,
    AdminCreateClassMemberRequest,
    AdminCreateClassRequest,
    AdminCreateTemplateExampleVideoRequest,
    AdminCreateTrainingTemplateRequest,
    AdminCreateTrainingTemplateVersionRequest,
    AdminCreateUserRequest,
    AdminNotificationRead,
    AdminNotificationsResponse,
    AdminLocalTemplateSyncResponse,
    AdminTaskDetailRead,
    AdminTasksResponse,
    AdminTrainingTemplateRead,
    AdminTrainingTemplatesResponse,
    AdminTrainingTemplateVersionRead,
    AdminTrainingTemplateVersionsResponse,
    AdminUpdateAnnouncementRequest,
    AdminUpdateUserRequest,
    AdminUpdateClassRequest,
    AdminTemplateExampleVideoRead,
    AdminTemplateExampleVideosResponse,
    AdminUpdateCampRequest,
    AdminUpdateTaskRequest,
    AdminUpdateTemplateExampleVideoRequest,
    AdminUpdateTrainingTemplateRequest,
    AdminUpdateTrainingTemplateVersionRequest,
    AdminUserDetailRead,
    AdminUsersResponse,
)
from app.services.admin_service import AdminService
from app.models.enums import AnalysisType, UserRole, UserStatus

router = APIRouter()


@router.get("/users", response_model=AdminUsersResponse, status_code=status.HTTP_200_OK)
def list_users(
    role: UserRole | None = Query(default=None),
    user_status: UserStatus | None = Query(default=None, alias="status"),
    keyword: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminUsersResponse:
    service = AdminService(db)
    items, total = service.list_users(
        current_user,
        role=role,
        user_status=user_status,
        keyword=keyword,
        page=page,
        page_size=page_size,
    )
    return AdminUsersResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/users", response_model=AdminUserDetailRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminCreateUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminUserDetailRead:
    service = AdminService(db)
    return service.create_user(current_user, payload)


@router.get(
    "/users/{user_public_id}",
    response_model=AdminUserDetailRead,
    status_code=status.HTTP_200_OK,
)
def get_user_detail(
    user_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminUserDetailRead:
    service = AdminService(db)
    return service.get_user_detail(current_user, user_public_id)


@router.patch(
    "/users/{user_public_id}",
    response_model=AdminUserDetailRead,
    status_code=status.HTTP_200_OK,
)
def update_user(
    user_public_id: UUID,
    payload: AdminUpdateUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminUserDetailRead:
    service = AdminService(db)
    return service.update_user(current_user, user_public_id, payload)


@router.delete("/users/{user_public_id}", status_code=status.HTTP_204_NO_CONTENT)
def disable_user(
    user_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    service = AdminService(db)
    service.disable_user(current_user, user_public_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/announcements",
    response_model=AdminAnnouncementsResponse,
    status_code=status.HTTP_200_OK,
)
def list_announcements(
    scope_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    target_role: UserRole | None = Query(default=None),
    camp_public_id: UUID | None = Query(default=None),
    class_public_id: UUID | None = Query(default=None),
    keyword: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminAnnouncementsResponse:
    service = AdminService(db)
    return AdminAnnouncementsResponse(
        items=service.list_announcements(
            current_user,
            scope_type=scope_type,
            announcement_status=status_filter,
            target_role=target_role,
            camp_public_id=camp_public_id,
            class_public_id=class_public_id,
            keyword=keyword,
            limit=limit,
        )
    )


@router.post(
    "/announcements",
    response_model=AdminAnnouncementRead,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    payload: AdminCreateAnnouncementRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminAnnouncementRead:
    service = AdminService(db)
    return service.create_announcement(current_user, payload)


@router.patch(
    "/announcements/{announcement_public_id}",
    response_model=AdminAnnouncementRead,
    status_code=status.HTTP_200_OK,
)
def update_announcement(
    announcement_public_id: UUID,
    payload: AdminUpdateAnnouncementRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminAnnouncementRead:
    service = AdminService(db)
    return service.update_announcement(current_user, announcement_public_id, payload)


@router.delete("/announcements/{announcement_public_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_announcement(
    announcement_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    service = AdminService(db)
    service.archive_announcement(current_user, announcement_public_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/tasks", response_model=AdminTasksResponse, status_code=status.HTTP_200_OK)
def list_tasks(
    coach_public_id: UUID | None = Query(default=None),
    camp_public_id: UUID | None = Query(default=None),
    class_public_id: UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    analysis_type: AnalysisType | None = Query(default=None),
    keyword: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTasksResponse:
    service = AdminService(db)
    return AdminTasksResponse(
        items=service.list_tasks(
            current_user,
            coach_public_id=coach_public_id,
            camp_public_id=camp_public_id,
            class_public_id=class_public_id,
            task_status=status_filter,
            analysis_type=analysis_type,
            keyword=keyword,
            limit=limit,
        )
    )


@router.get(
    "/tasks/{task_public_id}",
    response_model=AdminTaskDetailRead,
    status_code=status.HTTP_200_OK,
)
def get_task_detail(
    task_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTaskDetailRead:
    service = AdminService(db)
    return service.get_task_detail(current_user, task_public_id)


@router.patch(
    "/tasks/{task_public_id}",
    response_model=AdminTaskDetailRead,
    status_code=status.HTTP_200_OK,
)
def update_task(
    task_public_id: UUID,
    payload: AdminUpdateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTaskDetailRead:
    service = AdminService(db)
    return service.update_task(current_user, task_public_id, payload)


@router.get(
    "/notifications",
    response_model=AdminNotificationsResponse,
    status_code=status.HTTP_200_OK,
)
def list_notifications(
    notification_type: str | None = Query(default=None, alias="type"),
    business_type: str | None = Query(default=None),
    user_public_id: UUID | None = Query(default=None),
    user_role: UserRole | None = Query(default=None),
    is_read: bool | None = Query(default=None),
    keyword: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminNotificationsResponse:
    service = AdminService(db)
    return AdminNotificationsResponse(
        items=service.list_notifications(
            current_user,
            notification_type=notification_type,
            business_type=business_type,
            user_public_id=user_public_id,
            user_role=user_role,
            is_read=is_read,
            keyword=keyword,
            limit=limit,
        )
    )


@router.get(
    "/notifications/{notification_public_id}",
    response_model=AdminNotificationRead,
    status_code=status.HTTP_200_OK,
)
def get_notification_detail(
    notification_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminNotificationRead:
    service = AdminService(db)
    return service.get_notification_detail(current_user, notification_public_id)


@router.get("/camps", response_model=AdminCampsResponse, status_code=status.HTTP_200_OK)
def list_camps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminCampsResponse:
    service = AdminService(db)
    return AdminCampsResponse(items=service.list_camps(current_user))


@router.post("/camps", response_model=AdminCampRead, status_code=status.HTTP_201_CREATED)
def create_camp(
    payload: AdminCreateCampRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminCampRead:
    service = AdminService(db)
    return service.create_camp(current_user, payload)


@router.patch(
    "/camps/{camp_public_id}",
    response_model=AdminCampRead,
    status_code=status.HTTP_200_OK,
)
def update_camp(
    camp_public_id: UUID,
    payload: AdminUpdateCampRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminCampRead:
    service = AdminService(db)
    return service.update_camp(current_user, camp_public_id, payload)


@router.get("/classes", response_model=AdminClassesResponse, status_code=status.HTTP_200_OK)
def list_classes(
    camp_public_id: UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminClassesResponse:
    service = AdminService(db)
    return AdminClassesResponse(items=service.list_classes(current_user, camp_public_id))


@router.post("/classes", response_model=AdminClassRead, status_code=status.HTTP_201_CREATED)
def create_class(
    payload: AdminCreateClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminClassRead:
    service = AdminService(db)
    return service.create_class(current_user, payload)


@router.patch(
    "/classes/{class_public_id}",
    response_model=AdminClassRead,
    status_code=status.HTTP_200_OK,
)
def update_class(
    class_public_id: UUID,
    payload: AdminUpdateClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminClassRead:
    service = AdminService(db)
    return service.update_class(current_user, class_public_id, payload)


@router.get(
    "/classes/{class_public_id}/members",
    response_model=AdminClassMembersResponse,
    status_code=status.HTTP_200_OK,
)
def list_class_members(
    class_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminClassMembersResponse:
    service = AdminService(db)
    return AdminClassMembersResponse(items=service.list_class_members(current_user, class_public_id))


@router.post(
    "/classes/{class_public_id}/members",
    response_model=AdminClassMemberRead,
    status_code=status.HTTP_201_CREATED,
)
def add_class_member(
    class_public_id: UUID,
    payload: AdminCreateClassMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminClassMemberRead:
    service = AdminService(db)
    return service.add_class_member(current_user, class_public_id, payload)


@router.delete(
    "/classes/{class_public_id}/members/{member_public_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_class_member(
    class_public_id: UUID,
    member_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    service = AdminService(db)
    service.remove_class_member(current_user, class_public_id, member_public_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/training-templates",
    response_model=AdminTrainingTemplatesResponse,
    status_code=status.HTTP_200_OK,
)
def list_training_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTrainingTemplatesResponse:
    service = AdminService(db)
    return AdminTrainingTemplatesResponse(items=service.list_training_templates(current_user))


@router.post(
    "/training-templates/sync-local",
    response_model=AdminLocalTemplateSyncResponse,
    status_code=status.HTTP_200_OK,
)
def sync_local_training_templates(
    dry_run: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminLocalTemplateSyncResponse:
    service = AdminService(db)
    return service.sync_local_training_templates(current_user, dry_run=dry_run)


@router.post(
    "/training-templates",
    response_model=AdminTrainingTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
def create_training_template(
    payload: AdminCreateTrainingTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTrainingTemplateRead:
    service = AdminService(db)
    return service.create_training_template(current_user, payload)


@router.patch(
    "/training-templates/{template_public_id}",
    response_model=AdminTrainingTemplateRead,
    status_code=status.HTTP_200_OK,
)
def update_training_template(
    template_public_id: UUID,
    payload: AdminUpdateTrainingTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTrainingTemplateRead:
    service = AdminService(db)
    return service.update_training_template(current_user, template_public_id, payload)


@router.get(
    "/training-templates/{template_public_id}/versions",
    response_model=AdminTrainingTemplateVersionsResponse,
    status_code=status.HTTP_200_OK,
)
def list_training_template_versions(
    template_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTrainingTemplateVersionsResponse:
    service = AdminService(db)
    return AdminTrainingTemplateVersionsResponse(
        items=service.list_training_template_versions(current_user, template_public_id)
    )


@router.post(
    "/training-templates/{template_public_id}/versions",
    response_model=AdminTrainingTemplateVersionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_training_template_version(
    template_public_id: UUID,
    payload: AdminCreateTrainingTemplateVersionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTrainingTemplateVersionRead:
    service = AdminService(db)
    return service.create_training_template_version(current_user, template_public_id, payload)


@router.patch(
    "/training-templates/{template_public_id}/versions/{version_public_id}",
    response_model=AdminTrainingTemplateVersionRead,
    status_code=status.HTTP_200_OK,
)
def update_training_template_version(
    template_public_id: UUID,
    version_public_id: UUID,
    payload: AdminUpdateTrainingTemplateVersionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTrainingTemplateVersionRead:
    service = AdminService(db)
    return service.update_training_template_version(
        current_user,
        template_public_id,
        version_public_id,
        payload,
    )


@router.get(
    "/training-templates/{template_public_id}/example-videos",
    response_model=AdminTemplateExampleVideosResponse,
    status_code=status.HTTP_200_OK,
)
def list_template_example_videos(
    template_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTemplateExampleVideosResponse:
    service = AdminService(db)
    return AdminTemplateExampleVideosResponse(
        items=service.list_template_example_videos(current_user, template_public_id)
    )


@router.post(
    "/training-templates/{template_public_id}/example-videos",
    response_model=AdminTemplateExampleVideoRead,
    status_code=status.HTTP_201_CREATED,
)
def create_template_example_video(
    template_public_id: UUID,
    payload: AdminCreateTemplateExampleVideoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTemplateExampleVideoRead:
    service = AdminService(db)
    return service.create_template_example_video(current_user, template_public_id, payload)


@router.patch(
    "/training-templates/{template_public_id}/example-videos/{video_public_id}",
    response_model=AdminTemplateExampleVideoRead,
    status_code=status.HTTP_200_OK,
)
def update_template_example_video(
    template_public_id: UUID,
    video_public_id: UUID,
    payload: AdminUpdateTemplateExampleVideoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminTemplateExampleVideoRead:
    service = AdminService(db)
    return service.update_template_example_video(
        current_user,
        template_public_id,
        video_public_id,
        payload,
    )


@router.delete(
    "/training-templates/{template_public_id}/example-videos/{video_public_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_template_example_video(
    template_public_id: UUID,
    video_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    service = AdminService(db)
    service.delete_template_example_video(current_user, template_public_id, video_public_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
