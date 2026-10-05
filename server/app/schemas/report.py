from __future__ import annotations

from datetime import datetime
from uuid import UUID
from typing import Literal

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
    is_age_comparison: bool = False


class ReportRead(ReportListItem):
    score_data: dict
    timeline_data: list | None = None
    summary_data: dict | None = None
    template_snapshot: dict | None = None
    can_reanalyze_age: bool = False

    model_config = ConfigDict(from_attributes=True)


class ReanalyzeReportAgeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: UUID
    age_group: Literal["4-7", "7-10", "10-12", "13-15", "16-18"]
    overall_score: float = Field(ge=0, le=100, allow_inf_nan=False)
    grade: Literal["S", "A", "B", "C", "D", "E", "F"]
    score_data: dict


class _ScoreCategories(BaseModel):
    posture: float = Field(ge=0, le=100, allow_inf_nan=False, strict=True)
    execution: float = Field(ge=0, le=100, allow_inf_nan=False, strict=True)
    consistency: float = Field(ge=0, le=100, allow_inf_nan=False, strict=True)


class _ScoreWeights(BaseModel):
    posture: float = Field(ge=0, le=1, allow_inf_nan=False, strict=True)
    execution: float = Field(ge=0, le=1, allow_inf_nan=False, strict=True)
    consistency: float = Field(ge=0, le=1, allow_inf_nan=False, strict=True)


class _ScoreAvailability(BaseModel):
    posture: bool = Field(strict=True)
    execution: bool = Field(strict=True)
    consistency: bool = Field(strict=True)


class _AgeFinding(BaseModel):
    id: str
    title: str
    score: float = Field(ge=0, le=100, allow_inf_nan=False, strict=True)
    isPositive: bool = Field(strict=True)
    isMissing: bool = Field(default=False, strict=True)
    state: Literal["good", "low", "high", "missing"]
    actualValue: str | None
    targetText: str
    hint: str
    category: Literal["posture", "execution", "consistency"]


class ReanalyzedScoreResult(BaseModel):
    """Validate the client score's shape, without independently computing it."""
    overall: float = Field(ge=0, le=100, allow_inf_nan=False, strict=True)
    grade: Literal["S", "A", "B", "C", "D", "E", "F"]
    analysisStatus: Literal["ready"]
    weights: _ScoreWeights
    availability: _ScoreAvailability
    breakdown: _ScoreCategories
    findings: list[_AgeFinding]
