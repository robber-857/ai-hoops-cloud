from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.template import TrainingTemplateRead
from app.services.template_service import TemplateService

router = APIRouter()


@router.get("", response_model=list[TrainingTemplateRead], status_code=status.HTTP_200_OK)
def list_templates(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[TrainingTemplateRead]:
    service = TemplateService(db)
    return service.list_templates(include_inactive=include_inactive)


@router.get("/{template_code}", response_model=TrainingTemplateRead, status_code=status.HTTP_200_OK)
def get_template(
    template_code: str,
    db: Session = Depends(get_db),
) -> TrainingTemplateRead:
    service = TemplateService(db)
    return service.get_template_by_code(template_code)
