from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.training import (
    UploadCompleteRequest,
    UploadCompleteResponse,
    UploadInitRequest,
    UploadInitResponse,
)
from app.services.training_service import TrainingService

router = APIRouter()


@router.post("/init", response_model=UploadInitResponse, status_code=status.HTTP_201_CREATED)
def init_upload(
    payload: UploadInitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadInitResponse:
    service = TrainingService(db)
    return service.init_upload(current_user, payload)


@router.post("/complete", response_model=UploadCompleteResponse, status_code=status.HTTP_200_OK)
def complete_upload(
    payload: UploadCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadCompleteResponse:
    service = TrainingService(db)
    return service.complete_upload(current_user, payload)
