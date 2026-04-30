from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AnalysisType, StorageProvider


class VideoRead(BaseModel):
    public_id: UUID
    storage_provider: StorageProvider
    bucket_name: str
    object_key: str
    file_name: str
    original_file_name: str | None = None
    content_type: str
    file_size: int
    url: str | None = None
    cdn_url: str | None = None
    upload_status: str
    duration_seconds: float | None = None
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UploadInitRequest(BaseModel):
    analysis_type: AnalysisType
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)
    file_size: int = Field(gt=0)
    template_code: str | None = Field(default=None, max_length=100)
    template_version: str | None = Field(default=None, max_length=50)
    class_public_id: UUID | None = None
    task_assignment_public_id: UUID | None = None
    source_type: str = Field(default="free_practice", max_length=20)


class UploadInitResponse(BaseModel):
    session_public_id: UUID
    upload_task_public_id: UUID
    storage_provider: StorageProvider
    bucket_name: str
    object_key: str
    upload_strategy: str
    upload_expires_at: datetime | None = None


class UploadCompleteRequest(BaseModel):
    upload_task_public_id: UUID
    original_file_name: str | None = Field(default=None, max_length=255)
    url: str | None = Field(default=None, max_length=1000)
    cdn_url: str | None = Field(default=None, max_length=1000)
    checksum_md5: str | None = Field(default=None, max_length=64)
    etag: str | None = Field(default=None, max_length=255)
    duration_seconds: float | None = Field(default=None, ge=0)
    width: int | None = Field(default=None, ge=0)
    height: int | None = Field(default=None, ge=0)
    fps: float | None = Field(default=None, ge=0)


class UploadCompleteResponse(BaseModel):
    session_public_id: UUID
    upload_task_public_id: UUID
    video: VideoRead


class TrainingSessionRead(BaseModel):
    public_id: UUID
    student_public_id: UUID
    class_public_id: UUID | None = None
    task_assignment_public_id: UUID | None = None
    analysis_type: AnalysisType
    template_code: str | None = None
    template_version: str | None = None
    source_type: str
    status: str
    started_at: datetime | None = None
    uploaded_at: datetime | None = None
    analysis_started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    video: VideoRead | None = None

