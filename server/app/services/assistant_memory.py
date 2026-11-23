from uuid import UUID

from sqlalchemy import func, select, true
from sqlalchemy.orm import Session

from app.models.assistant_conversation import AssistantConversation, AssistantConversationTurn
from app.schemas.assistant_priority import TrainingPriority


def other_training_priorities(db: Session, player_id: int, current_conversation: UUID) -> list[dict[str, str]]:
    """Select the three most recently expressed distinct priorities, across active chats."""
    conversation = AssistantConversation
    turn = AssistantConversationTurn
    tags = func.jsonb_array_elements(turn.training_priorities).table_valued("value").lateral()
    query = (
        select(tags.c.value)
        .select_from(conversation)
        .join(turn, conversation.public_id == turn.conversation_id)
        .join(tags, true())
        .where(
            conversation.player_id == player_id,
            conversation.archived.is_(False),
            conversation.public_id != current_conversation,
            turn.training_priorities.is_not(None),
        )
        .group_by(tags.c.value)
        .order_by(func.max(turn.answered_at).desc(), tags.c.value)
        .limit(3)
    )
    return [
        {"source": "other_active_conversation", **TrainingPriority.model_validate(tag).model_dump()}
        for tag in db.scalars(query)
    ]
