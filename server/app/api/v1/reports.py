from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.me import MeReportsResponse
from app.schemas.report import ReportRead, SaveReportRequest
from app.services.report_service import ReportService

router = APIRouter()


@router.post("", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
def save_report(
    payload: SaveReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportRead:
    service = ReportService(db)
    return service.save_report(current_user, payload)


@router.get("/mine", response_model=MeReportsResponse, status_code=status.HTTP_200_OK)
def list_my_reports(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeReportsResponse:
    service = ReportService(db)
    return MeReportsResponse(items=service.list_my_reports(current_user, limit=limit))


@router.get("/{report_public_id}", response_model=ReportRead, status_code=status.HTTP_200_OK)
def get_report_detail(
    report_public_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportRead:
    service = ReportService(db)
    return service.get_report_detail(current_user, report_public_id)
