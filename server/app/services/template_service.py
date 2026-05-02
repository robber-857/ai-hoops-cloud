from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.training_template import TrainingTemplate
from app.schemas.template import (
    TemplateExampleVideoRead,
    TrainingTemplateRead,
    TrainingTemplateVersionRead,
)


def _template_read(template: TrainingTemplate) -> TrainingTemplateRead:
    active_example_videos = [
        video for video in template.example_videos if video.status == "active"
    ]

    return TrainingTemplateRead(
        public_id=template.public_id,
        template_code=template.template_code,
        name=template.name,
        analysis_type=template.analysis_type,
        description=template.description,
        difficulty_level=template.difficulty_level,
        status=template.status,
        current_version=template.current_version,
        published_at=template.published_at,
        versions=[
            TrainingTemplateVersionRead(
                public_id=version.public_id,
                version=version.version,
                scoring_rules=version.scoring_rules,
                metric_definitions=version.metric_definitions,
                mediapipe_config=version.mediapipe_config,
                summary_template=version.summary_template,
                status=version.status,
                is_default=version.is_default,
                published_at=version.published_at,
            )
            for version in template.versions
        ],
        example_videos=[
            TemplateExampleVideoRead(
                public_id=video.public_id,
                template_version=video.template_version,
                title=video.title,
                description=video.description,
                storage_provider=video.storage_provider,
                bucket_name=video.bucket_name,
                object_key=video.object_key,
                file_name=video.file_name,
                content_type=video.content_type,
                duration_seconds=float(video.duration_seconds) if video.duration_seconds is not None else None,
                cover_url=video.cover_url,
                sort_order=video.sort_order,
                status=video.status,
            )
            for video in sorted(active_example_videos, key=lambda item: item.sort_order)
        ],
    )


class TemplateService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_templates(self, include_inactive: bool = False) -> list[TrainingTemplateRead]:
        stmt = (
            select(TrainingTemplate)
            .options(
                selectinload(TrainingTemplate.versions),
                selectinload(TrainingTemplate.example_videos),
            )
            .order_by(TrainingTemplate.created_at.desc())
        )
        if not include_inactive:
            stmt = stmt.where(TrainingTemplate.status == "active")

        templates = self.db.scalars(stmt).all()
        return [_template_read(template) for template in templates]

    def get_template_by_code(self, template_code: str) -> TrainingTemplateRead:
        template = self.db.scalar(
            select(TrainingTemplate)
            .options(
                selectinload(TrainingTemplate.versions),
                selectinload(TrainingTemplate.example_videos),
            )
            .where(TrainingTemplate.template_code == template_code)
        )
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training template not found.")
        return _template_read(template)
