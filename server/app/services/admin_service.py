from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.enums import UserRole
from app.models.template_example_video import TemplateExampleVideo
from app.models.training_camp import TrainingCamp
from app.models.training_template import TrainingTemplate
from app.models.training_template_version import TrainingTemplateVersion
from app.models.user import User
from app.schemas.admin import (
    AdminCampRead,
    AdminClassMemberRead,
    AdminClassRead,
    AdminCreateCampRequest,
    AdminCreateClassMemberRequest,
    AdminCreateClassRequest,
    AdminCreateTemplateExampleVideoRequest,
    AdminCreateTrainingTemplateRequest,
    AdminCreateTrainingTemplateVersionRequest,
    AdminTrainingTemplateRead,
    AdminTrainingTemplateVersionRead,
    AdminUpdateClassRequest,
    AdminTemplateExampleVideoRead,
    AdminUpdateCampRequest,
    AdminUpdateTemplateExampleVideoRequest,
    AdminUpdateTrainingTemplateRequest,
    AdminUpdateTrainingTemplateVersionRequest,
)


def _ensure_admin_access(current_user: User) -> None:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )


def _camp_read(camp: TrainingCamp, class_count: int) -> AdminCampRead:
    return AdminCampRead(
        public_id=camp.public_id,
        name=camp.name,
        code=camp.code,
        description=camp.description,
        season_name=camp.season_name,
        status=camp.status,
        start_date=camp.start_date,
        end_date=camp.end_date,
        class_count=class_count,
        created_at=camp.created_at,
    )


def _class_read(
    class_row: CampClass,
    coach_count: int = 0,
    student_count: int = 0,
) -> AdminClassRead:
    return AdminClassRead(
        public_id=class_row.public_id,
        camp_public_id=class_row.camp.public_id,
        camp_name=class_row.camp.name,
        name=class_row.name,
        code=class_row.code,
        description=class_row.description,
        status=class_row.status,
        age_group=class_row.age_group,
        max_students=class_row.max_students,
        start_date=class_row.start_date,
        end_date=class_row.end_date,
        coach_count=coach_count,
        student_count=student_count,
        created_at=class_row.created_at,
    )


def _member_read(member: ClassMember) -> AdminClassMemberRead:
    return AdminClassMemberRead(
        public_id=member.public_id,
        class_public_id=member.camp_class.public_id,
        user_public_id=member.user.public_id,
        username=member.user.username,
        nickname=member.user.nickname,
        email=member.user.email,
        phone_number=member.user.phone_number,
        user_role=member.user.role.value,
        member_role=member.member_role,
        status=member.status,
        joined_at=member.joined_at,
        left_at=member.left_at,
        remarks=member.remarks,
        created_at=member.created_at,
    )


def _template_read(template: TrainingTemplate, version_count: int) -> AdminTrainingTemplateRead:
    return AdminTrainingTemplateRead(
        public_id=template.public_id,
        template_code=template.template_code,
        name=template.name,
        analysis_type=template.analysis_type,
        description=template.description,
        difficulty_level=template.difficulty_level,
        status=template.status,
        current_version=template.current_version,
        version_count=version_count,
        published_at=template.published_at,
        created_at=template.created_at,
    )


def _template_version_read(version: TrainingTemplateVersion) -> AdminTrainingTemplateVersionRead:
    return AdminTrainingTemplateVersionRead(
        public_id=version.public_id,
        version=version.version,
        scoring_rules=version.scoring_rules,
        metric_definitions=version.metric_definitions,
        mediapipe_config=version.mediapipe_config,
        summary_template=version.summary_template,
        status=version.status,
        is_default=version.is_default,
        published_at=version.published_at,
        created_at=version.created_at,
    )


def _example_video_read(video: TemplateExampleVideo) -> AdminTemplateExampleVideoRead:
    return AdminTemplateExampleVideoRead(
        public_id=video.public_id,
        template_public_id=video.template.public_id,
        template_version=video.template_version,
        title=video.title,
        description=video.description,
        storage_provider=video.storage_provider,
        bucket_name=video.bucket_name,
        object_key=video.object_key,
        file_name=video.file_name,
        content_type=video.content_type,
        duration_seconds=_numeric_to_float(video.duration_seconds),
        cover_url=video.cover_url,
        sort_order=video.sort_order,
        status=video.status,
        created_at=video.created_at,
    )


def _numeric_to_float(value) -> float | None:
    if value is None:
        return None
    return float(value)


class AdminService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_camps(self, current_user: User) -> list[AdminCampRead]:
        _ensure_admin_access(current_user)
        camps = self.db.scalars(
            select(TrainingCamp).order_by(TrainingCamp.created_at.desc())
        ).all()
        class_counts = self._class_counts_by_camp([camp.id for camp in camps])
        return [_camp_read(camp, class_counts.get(camp.id, 0)) for camp in camps]

    def create_camp(self, current_user: User, payload: AdminCreateCampRequest) -> AdminCampRead:
        _ensure_admin_access(current_user)
        self._ensure_unique_camp_code(payload.code)

        camp = TrainingCamp(
            name=payload.name,
            code=payload.code,
            description=payload.description,
            season_name=payload.season_name,
            status=payload.status,
            start_date=payload.start_date,
            end_date=payload.end_date,
            created_by_user_id=current_user.id,
            updated_by_user_id=current_user.id,
        )
        self.db.add(camp)
        self.db.commit()
        self.db.refresh(camp)
        return _camp_read(camp, 0)

    def update_camp(
        self,
        current_user: User,
        camp_public_id: UUID,
        payload: AdminUpdateCampRequest,
    ) -> AdminCampRead:
        _ensure_admin_access(current_user)
        camp = self._get_camp_by_public_id(camp_public_id)
        fields_set = payload.model_fields_set

        if "code" in fields_set and payload.code is not None and payload.code != camp.code:
            self._ensure_unique_camp_code(payload.code)
            camp.code = payload.code
        if "name" in fields_set and payload.name is not None:
            camp.name = payload.name
        if "description" in fields_set:
            camp.description = payload.description
        if "season_name" in fields_set:
            camp.season_name = payload.season_name
        if "status" in fields_set and payload.status is not None:
            camp.status = payload.status
        if "start_date" in fields_set:
            camp.start_date = payload.start_date
        if "end_date" in fields_set:
            camp.end_date = payload.end_date
        camp.updated_by_user_id = current_user.id

        self.db.add(camp)
        self.db.commit()
        self.db.refresh(camp)
        class_count = self._class_counts_by_camp([camp.id]).get(camp.id, 0)
        return _camp_read(camp, class_count)

    def list_classes(
        self,
        current_user: User,
        camp_public_id: UUID | None = None,
    ) -> list[AdminClassRead]:
        _ensure_admin_access(current_user)
        stmt = (
            select(CampClass)
            .options(selectinload(CampClass.camp))
            .order_by(CampClass.created_at.desc())
        )
        if camp_public_id:
            camp = self._get_camp_by_public_id(camp_public_id)
            stmt = stmt.where(CampClass.camp_id == camp.id)

        classes = self.db.scalars(stmt).all()
        counts = self._member_counts_by_class([class_row.id for class_row in classes])
        return [
            _class_read(
                class_row,
                coach_count=counts.get(class_row.id, {}).get("coach", 0),
                student_count=counts.get(class_row.id, {}).get("student", 0),
            )
            for class_row in classes
        ]

    def create_class(self, current_user: User, payload: AdminCreateClassRequest) -> AdminClassRead:
        _ensure_admin_access(current_user)
        camp = self._get_camp_by_public_id(payload.camp_public_id)
        self._ensure_unique_class_code(camp.id, payload.code)

        class_row = CampClass(
            camp_id=camp.id,
            name=payload.name,
            code=payload.code,
            description=payload.description,
            status=payload.status,
            age_group=payload.age_group,
            max_students=payload.max_students,
            start_date=payload.start_date,
            end_date=payload.end_date,
            created_by_user_id=current_user.id,
            updated_by_user_id=current_user.id,
        )
        self.db.add(class_row)
        self.db.commit()
        self.db.refresh(class_row)
        class_row.camp = camp
        return _class_read(class_row)

    def update_class(
        self,
        current_user: User,
        class_public_id: UUID,
        payload: AdminUpdateClassRequest,
    ) -> AdminClassRead:
        _ensure_admin_access(current_user)
        class_row = self._get_class_by_public_id(class_public_id)
        fields_set = payload.model_fields_set

        if "code" in fields_set and payload.code is not None and payload.code != class_row.code:
            self._ensure_unique_class_code(class_row.camp_id, payload.code)
            class_row.code = payload.code
        if "name" in fields_set and payload.name is not None:
            class_row.name = payload.name
        if "description" in fields_set:
            class_row.description = payload.description
        if "status" in fields_set and payload.status is not None:
            class_row.status = payload.status
        if "age_group" in fields_set:
            class_row.age_group = payload.age_group
        if "max_students" in fields_set:
            class_row.max_students = payload.max_students
        if "start_date" in fields_set:
            class_row.start_date = payload.start_date
        if "end_date" in fields_set:
            class_row.end_date = payload.end_date
        class_row.updated_by_user_id = current_user.id

        self.db.add(class_row)
        self.db.commit()
        self.db.refresh(class_row)
        counts = self._member_counts_by_class([class_row.id]).get(class_row.id, {})
        return _class_read(
            class_row,
            coach_count=counts.get("coach", 0),
            student_count=counts.get("student", 0),
        )

    def list_class_members(
        self,
        current_user: User,
        class_public_id: UUID,
    ) -> list[AdminClassMemberRead]:
        _ensure_admin_access(current_user)
        class_row = self._get_class_by_public_id(class_public_id)
        members = self.db.scalars(
            select(ClassMember)
            .options(
                selectinload(ClassMember.user),
                selectinload(ClassMember.camp_class),
            )
            .where(ClassMember.class_id == class_row.id)
            .order_by(ClassMember.status.asc(), ClassMember.member_role.asc(), ClassMember.created_at.desc())
        ).all()
        return [_member_read(member) for member in members]

    def add_class_member(
        self,
        current_user: User,
        class_public_id: UUID,
        payload: AdminCreateClassMemberRequest,
    ) -> AdminClassMemberRead:
        _ensure_admin_access(current_user)
        class_row = self._get_class_by_public_id(class_public_id)
        user = self._get_user_by_public_id(payload.user_public_id)
        now = datetime.now(timezone.utc)

        member = self.db.scalar(
            select(ClassMember).where(
                ClassMember.class_id == class_row.id,
                ClassMember.user_id == user.id,
                ClassMember.member_role == payload.member_role,
            )
        )

        if member:
            member.status = payload.status
            member.joined_at = payload.joined_at or member.joined_at or now
            member.left_at = None if payload.status == "active" else member.left_at
            member.remarks = payload.remarks
        else:
            member = ClassMember(
                class_id=class_row.id,
                user_id=user.id,
                member_role=payload.member_role,
                status=payload.status,
                joined_at=payload.joined_at or now,
                remarks=payload.remarks,
            )
            self.db.add(member)

        self.db.commit()
        self.db.refresh(member)
        member.camp_class = class_row
        member.user = user
        return _member_read(member)

    def remove_class_member(
        self,
        current_user: User,
        class_public_id: UUID,
        member_public_id: UUID,
    ) -> None:
        _ensure_admin_access(current_user)
        class_row = self._get_class_by_public_id(class_public_id)
        member = self.db.scalar(
            select(ClassMember).where(
                ClassMember.class_id == class_row.id,
                ClassMember.public_id == member_public_id,
            )
        )
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class member not found.")

        member.status = "removed"
        member.left_at = datetime.now(timezone.utc)
        self.db.add(member)
        self.db.commit()

    def list_training_templates(self, current_user: User) -> list[AdminTrainingTemplateRead]:
        _ensure_admin_access(current_user)
        templates = self.db.scalars(
            select(TrainingTemplate).order_by(TrainingTemplate.created_at.desc())
        ).all()
        version_counts = self._version_counts_by_template([template.id for template in templates])
        return [_template_read(template, version_counts.get(template.id, 0)) for template in templates]

    def create_training_template(
        self,
        current_user: User,
        payload: AdminCreateTrainingTemplateRequest,
    ) -> AdminTrainingTemplateRead:
        _ensure_admin_access(current_user)
        self._ensure_unique_template_code(payload.template_code)
        now = datetime.now(timezone.utc)

        template = TrainingTemplate(
            template_code=payload.template_code,
            name=payload.name,
            analysis_type=payload.analysis_type,
            description=payload.description,
            difficulty_level=payload.difficulty_level,
            status=payload.status,
            current_version=payload.current_version,
            created_by_user_id=current_user.id,
            updated_by_user_id=current_user.id,
            published_at=now if payload.status == "active" else None,
        )
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return _template_read(template, 0)

    def update_training_template(
        self,
        current_user: User,
        template_public_id: UUID,
        payload: AdminUpdateTrainingTemplateRequest,
    ) -> AdminTrainingTemplateRead:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        fields_set = payload.model_fields_set
        now = datetime.now(timezone.utc)

        if (
            "template_code" in fields_set
            and payload.template_code is not None
            and payload.template_code != template.template_code
        ):
            self._ensure_unique_template_code(payload.template_code)
            template.template_code = payload.template_code
        if "name" in fields_set and payload.name is not None:
            template.name = payload.name
        if "analysis_type" in fields_set and payload.analysis_type is not None:
            template.analysis_type = payload.analysis_type
        if "description" in fields_set:
            template.description = payload.description
        if "difficulty_level" in fields_set:
            template.difficulty_level = payload.difficulty_level
        if "status" in fields_set and payload.status is not None:
            template.status = payload.status
            if payload.status == "active" and not template.published_at:
                template.published_at = now
        if "current_version" in fields_set:
            template.current_version = payload.current_version
        template.updated_by_user_id = current_user.id

        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        version_count = self._version_counts_by_template([template.id]).get(template.id, 0)
        return _template_read(template, version_count)

    def create_training_template_version(
        self,
        current_user: User,
        template_public_id: UUID,
        payload: AdminCreateTrainingTemplateVersionRequest,
    ) -> AdminTrainingTemplateVersionRead:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        self._ensure_unique_template_version(template.id, payload.version)
        now = datetime.now(timezone.utc)

        if payload.is_default:
            existing_versions = self.db.scalars(
                select(TrainingTemplateVersion).where(TrainingTemplateVersion.template_id == template.id)
            ).all()
            for version in existing_versions:
                version.is_default = False

            template.current_version = payload.version
            template.updated_by_user_id = current_user.id
            if payload.status == "active" and not template.published_at:
                template.published_at = now

        version = TrainingTemplateVersion(
            template_id=template.id,
            version=payload.version,
            scoring_rules=payload.scoring_rules,
            metric_definitions=payload.metric_definitions,
            mediapipe_config=payload.mediapipe_config,
            summary_template=payload.summary_template,
            status=payload.status,
            is_default=payload.is_default,
            created_by_user_id=current_user.id,
            published_at=now if payload.status == "active" else None,
        )
        self.db.add(version)
        self.db.add(template)
        self.db.commit()
        self.db.refresh(version)
        return _template_version_read(version)

    def list_training_template_versions(
        self,
        current_user: User,
        template_public_id: UUID,
    ) -> list[AdminTrainingTemplateVersionRead]:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        versions = self.db.scalars(
            select(TrainingTemplateVersion)
            .where(TrainingTemplateVersion.template_id == template.id)
            .order_by(TrainingTemplateVersion.created_at.desc())
        ).all()
        return [_template_version_read(version) for version in versions]

    def update_training_template_version(
        self,
        current_user: User,
        template_public_id: UUID,
        version_public_id: UUID,
        payload: AdminUpdateTrainingTemplateVersionRequest,
    ) -> AdminTrainingTemplateVersionRead:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        version = self._get_template_version_by_public_id(template.id, version_public_id)
        fields_set = payload.model_fields_set
        now = datetime.now(timezone.utc)

        if "version" in fields_set and payload.version is not None and payload.version != version.version:
            self._ensure_unique_template_version(template.id, payload.version)
            version.version = payload.version
        if "scoring_rules" in fields_set and payload.scoring_rules is not None:
            version.scoring_rules = payload.scoring_rules
        if "metric_definitions" in fields_set:
            version.metric_definitions = payload.metric_definitions
        if "mediapipe_config" in fields_set:
            version.mediapipe_config = payload.mediapipe_config
        if "summary_template" in fields_set:
            version.summary_template = payload.summary_template
        if "status" in fields_set and payload.status is not None:
            version.status = payload.status
            if payload.status == "active" and not version.published_at:
                version.published_at = now
        if "is_default" in fields_set and payload.is_default is not None:
            version.is_default = payload.is_default
            if payload.is_default:
                existing_versions = self.db.scalars(
                    select(TrainingTemplateVersion)
                    .where(
                        TrainingTemplateVersion.template_id == template.id,
                        TrainingTemplateVersion.id != version.id,
                    )
                ).all()
                for existing_version in existing_versions:
                    existing_version.is_default = False
                    self.db.add(existing_version)
                template.current_version = version.version
                template.updated_by_user_id = current_user.id
                self.db.add(template)

        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)
        return _template_version_read(version)

    def list_template_example_videos(
        self,
        current_user: User,
        template_public_id: UUID,
    ) -> list[AdminTemplateExampleVideoRead]:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        videos = self.db.scalars(
            select(TemplateExampleVideo)
            .options(selectinload(TemplateExampleVideo.template))
            .where(TemplateExampleVideo.template_id == template.id)
            .order_by(TemplateExampleVideo.sort_order.asc(), TemplateExampleVideo.created_at.desc())
        ).all()
        return [_example_video_read(video) for video in videos]

    def create_template_example_video(
        self,
        current_user: User,
        template_public_id: UUID,
        payload: AdminCreateTemplateExampleVideoRequest,
    ) -> AdminTemplateExampleVideoRead:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)

        video = TemplateExampleVideo(
            template_id=template.id,
            template_version=payload.template_version,
            title=payload.title,
            description=payload.description,
            storage_provider=payload.storage_provider,
            bucket_name=payload.bucket_name,
            object_key=payload.object_key,
            file_name=payload.file_name,
            content_type=payload.content_type,
            duration_seconds=payload.duration_seconds,
            cover_url=payload.cover_url,
            sort_order=payload.sort_order,
            status=payload.status,
            created_by_user_id=current_user.id,
        )
        self.db.add(video)
        self.db.commit()
        self.db.refresh(video)
        video.template = template
        return _example_video_read(video)

    def update_template_example_video(
        self,
        current_user: User,
        template_public_id: UUID,
        video_public_id: UUID,
        payload: AdminUpdateTemplateExampleVideoRequest,
    ) -> AdminTemplateExampleVideoRead:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        video = self._get_example_video_by_public_id(template.id, video_public_id)
        fields_set = payload.model_fields_set

        if "template_version" in fields_set:
            video.template_version = payload.template_version
        if "title" in fields_set and payload.title is not None:
            video.title = payload.title
        if "description" in fields_set:
            video.description = payload.description
        if "storage_provider" in fields_set and payload.storage_provider is not None:
            video.storage_provider = payload.storage_provider
        if "bucket_name" in fields_set and payload.bucket_name is not None:
            video.bucket_name = payload.bucket_name
        if "object_key" in fields_set and payload.object_key is not None:
            video.object_key = payload.object_key
        if "file_name" in fields_set and payload.file_name is not None:
            video.file_name = payload.file_name
        if "content_type" in fields_set and payload.content_type is not None:
            video.content_type = payload.content_type
        if "duration_seconds" in fields_set:
            video.duration_seconds = payload.duration_seconds
        if "cover_url" in fields_set:
            video.cover_url = payload.cover_url
        if "sort_order" in fields_set and payload.sort_order is not None:
            video.sort_order = payload.sort_order
        if "status" in fields_set and payload.status is not None:
            video.status = payload.status

        self.db.add(video)
        self.db.commit()
        self.db.refresh(video)
        video.template = template
        return _example_video_read(video)

    def delete_template_example_video(
        self,
        current_user: User,
        template_public_id: UUID,
        video_public_id: UUID,
    ) -> None:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        video = self._get_example_video_by_public_id(template.id, video_public_id)
        self.db.delete(video)
        self.db.commit()

    def _get_camp_by_public_id(self, camp_public_id: UUID) -> TrainingCamp:
        camp = self.db.scalar(select(TrainingCamp).where(TrainingCamp.public_id == camp_public_id))
        if not camp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training camp not found.")
        return camp

    def _get_class_by_public_id(self, class_public_id: UUID) -> CampClass:
        class_row = self.db.scalar(
            select(CampClass)
            .options(selectinload(CampClass.camp))
            .where(CampClass.public_id == class_public_id)
        )
        if not class_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
        return class_row

    def _get_user_by_public_id(self, user_public_id: UUID) -> User:
        user = self.db.scalar(select(User).where(User.public_id == user_public_id))
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return user

    def _get_template_by_public_id(self, template_public_id: UUID) -> TrainingTemplate:
        template = self.db.scalar(
            select(TrainingTemplate).where(TrainingTemplate.public_id == template_public_id)
        )
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training template not found.")
        return template

    def _get_template_version_by_public_id(
        self,
        template_id: int,
        version_public_id: UUID,
    ) -> TrainingTemplateVersion:
        version = self.db.scalar(
            select(TrainingTemplateVersion).where(
                TrainingTemplateVersion.template_id == template_id,
                TrainingTemplateVersion.public_id == version_public_id,
            )
        )
        if not version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training template version not found.")
        return version

    def _get_example_video_by_public_id(
        self,
        template_id: int,
        video_public_id: UUID,
    ) -> TemplateExampleVideo:
        video = self.db.scalar(
            select(TemplateExampleVideo)
            .options(selectinload(TemplateExampleVideo.template))
            .where(
                TemplateExampleVideo.template_id == template_id,
                TemplateExampleVideo.public_id == video_public_id,
            )
        )
        if not video:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template example video not found.")
        return video

    def _ensure_unique_camp_code(self, code: str) -> None:
        if self.db.scalar(select(TrainingCamp.id).where(TrainingCamp.code == code)):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Training camp code already exists.")

    def _ensure_unique_class_code(self, camp_id: int, code: str) -> None:
        if self.db.scalar(
            select(CampClass.id).where(
                CampClass.camp_id == camp_id,
                CampClass.code == code,
            )
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Class code already exists in camp.")

    def _ensure_unique_template_code(self, template_code: str) -> None:
        if self.db.scalar(select(TrainingTemplate.id).where(TrainingTemplate.template_code == template_code)):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Training template code already exists.")

    def _ensure_unique_template_version(self, template_id: int, version: str) -> None:
        if self.db.scalar(
            select(TrainingTemplateVersion.id).where(
                TrainingTemplateVersion.template_id == template_id,
                TrainingTemplateVersion.version == version,
            )
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Training template version already exists.")

    def _class_counts_by_camp(self, camp_ids: list[int]) -> dict[int, int]:
        if not camp_ids:
            return {}

        rows = self.db.execute(
            select(CampClass.camp_id, func.count(CampClass.id))
            .where(CampClass.camp_id.in_(camp_ids))
            .group_by(CampClass.camp_id)
        ).all()
        return {camp_id: int(count) for camp_id, count in rows}

    def _member_counts_by_class(self, class_ids: list[int]) -> dict[int, dict[str, int]]:
        if not class_ids:
            return {}

        rows = self.db.execute(
            select(ClassMember.class_id, ClassMember.member_role, func.count(ClassMember.id))
            .where(
                ClassMember.class_id.in_(class_ids),
                ClassMember.status == "active",
            )
            .group_by(ClassMember.class_id, ClassMember.member_role)
        ).all()
        counts: dict[int, dict[str, int]] = {}
        for class_id, member_role, count in rows:
            counts.setdefault(class_id, {})[member_role] = int(count)
        return counts

    def _version_counts_by_template(self, template_ids: list[int]) -> dict[int, int]:
        if not template_ids:
            return {}

        rows = self.db.execute(
            select(TrainingTemplateVersion.template_id, func.count(TrainingTemplateVersion.id))
            .where(TrainingTemplateVersion.template_id.in_(template_ids))
            .group_by(TrainingTemplateVersion.template_id)
        ).all()
        return {template_id: int(count) for template_id, count in rows}
