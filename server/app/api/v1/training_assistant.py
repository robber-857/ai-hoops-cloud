from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.assistant_conversation import (
    ConversationArchive, ConversationDetail, ConversationFollowup, ConversationHistory,
    ConversationQuestion, ConversationSummary,
)
from app.schemas.training_assistant import AssistantRequest, AssistantResponse
from app.services.assistant_conversation import AssistantConversationService
from app.services.training_assistant import TrainingAssistant

router = APIRouter(prefix="/me/assistant")


@router.post("", response_model=AssistantResponse)
def ask_training_assistant(
    payload: AssistantRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssistantResponse:
    return TrainingAssistant(db).answer(current_user, payload)


def conversation_service(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssistantConversationService:
    return AssistantConversationService(db, current_user)


@router.get("/conversations", response_model=ConversationHistory)
def list_conversations(
    archived: bool = False,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    service: AssistantConversationService = Depends(conversation_service),
) -> ConversationHistory:
    return service.list(archived=archived, limit=limit, offset=offset)


@router.post("/conversations", response_model=ConversationDetail)
def start_conversation(
    payload: ConversationQuestion,
    service: AssistantConversationService = Depends(conversation_service),
) -> ConversationDetail:
    return service.send(payload)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def read_conversation(
    conversation_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    before_turn: int | None = Query(None, ge=1),
    service: AssistantConversationService = Depends(conversation_service),
) -> ConversationDetail:
    return service.detail(conversation_id, limit=limit, before_turn=before_turn)


@router.post("/conversations/{conversation_id}/messages", response_model=ConversationDetail)
def continue_conversation(
    conversation_id: UUID,
    payload: ConversationFollowup,
    service: AssistantConversationService = Depends(conversation_service),
) -> ConversationDetail:
    return service.send(payload, conversation_id)


@router.patch("/conversations/{conversation_id}", response_model=ConversationSummary)
def archive_conversation(
    conversation_id: UUID,
    payload: ConversationArchive,
    service: AssistantConversationService = Depends(conversation_service),
) -> ConversationSummary:
    return service.set_archived(conversation_id, payload.archived)
