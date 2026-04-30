from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AnalysisType


class SaveReportRequest(BaseModel):
    session_public_id: UUID
    template_code: str = Field(min_length=1, max_length=100)
    template_version: str | None = Field(default=None, max_length=50)
    overall_score: float | None = Field(default=None, ge=0, le=100)
    grade: str | None = Field(default=None, max_length=10)
    score_data: dict
    timeline_data: list | None = None
    summary_data: dict | None = None
    analysis_started_at: datetime | None = None
    analysis_finished_at: datetime | None = None


class ReportListItem(BaseModel):
    public_id: UUID
    session_public_id: UUID
    video_public_id: UUID
    analysis_type: AnalysisType
    template_code: str
    template_version: str | None = None
    overall_score: float | None = None
    grade: str | None = None
    status: str
    video_url: str | None = None
    created_at: datetime
    analysis_finished_at: datetime | None = None


class ReportRead(ReportListItem):
    score_data: dict
    timeline_data: list | None = None
    summary_data: dict | None = None

    model_config = ConfigDict(from_attributes=True)
