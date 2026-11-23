from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.training_assistant import AssistantRequest, AssistantResponse
from app.services.training_assistant import TrainingAssistant

router = APIRouter(prefix="/me/assistant")


@router.post("", response_model=AssistantResponse)
def ask_training_assistant(
    payload: AssistantRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssistantResponse:
    return TrainingAssistant(db).answer(current_user, payload)
