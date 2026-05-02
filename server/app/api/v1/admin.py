from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.admin import (
    AdminCampRead,
    AdminCampsResponse,
    AdminClassMemberRead,
    AdminClassMembersResponse,
    AdminClassRead,
    AdminClassesResponse,
    AdminCreateCampRequest,
    AdminCreateClassMemberRequest,
    AdminCreateClassRequest,
    AdminCreateTemplateExampleVideoRequest,
    AdminCreateTrainingTemplateRequest,
    AdminCreateTrainingTemplateVersionRequest,
    AdminTrainingTemplateRead,
    AdminTrainingTemplatesResponse,
    AdminTrainingTemplateVersionRead,
    AdminTrainingTemplateVersionsResponse,
    AdminUpdateClassRequest,
    AdminTemplateExampleVideoRead,
    AdminTemplateExampleVideosResponse,
    AdminUpdateCampRequest,
    AdminUpdateTemplateExampleVideoRequest,
    AdminUpdateTrainingTemplateRequest,
    AdminUpdateTrainingTemplateVersionRequest,
)
from app.services.admin_service import AdminService

router = APIRouter()


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
