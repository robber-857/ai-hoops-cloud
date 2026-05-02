from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import AnalysisType, StorageProvider


class TemplateExampleVideoRead(BaseModel):
    public_id: UUID
    template_version: str | None = None
    title: str
    description: str | None = None
    storage_provider: StorageProvider
    bucket_name: str
    object_key: str
    file_name: str
    content_type: str
    duration_seconds: float | None = None
    cover_url: str | None = None
    sort_order: int
    status: str


class TrainingTemplateVersionRead(BaseModel):
    public_id: UUID
    version: str
    scoring_rules: dict
    metric_definitions: dict | None = None
    mediapipe_config: dict | None = None
    summary_template: dict | None = None
    status: str
    is_default: bool
    published_at: datetime | None = None


class TrainingTemplateRead(BaseModel):
    public_id: UUID
    template_code: str
    name: str
    analysis_type: AnalysisType
    description: str | None = None
    difficulty_level: str | None = None
    status: str
    current_version: str | None = None
    published_at: datetime | None = None
    versions: list[TrainingTemplateVersionRead] = []
    example_videos: list[TemplateExampleVideoRead] = []
