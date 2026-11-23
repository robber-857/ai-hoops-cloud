import re
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import case, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.assistant_conversation import AssistantConversation, AssistantConversationTurn
from app.models.user import User
from app.schemas.assistant_conversation import (
    ConversationDetail,
    ConversationFollowup,
    ConversationHistory,
    ConversationMessage,
    ConversationQuestion,
    ConversationSummary,
)
from app.schemas.training_assistant import AssistantMessage, AssistantRequest
from app.services.assistant_memory import other_training_priorities
from app.services.report_service import STUDENT_ROLES
from app.services.training_assistant import TrainingAssistant


RECENT_TURNS = 4  # AssistantRequest takes four complete exchanges plus the current question.
GENERATION_LEASE = timedelta(minutes=2)


def _search_terms(question: str) -> list[str]:
    words = re.findall(r"[a-z0-9]{3,}|[\u3400-\u9fff]+", question.lower())
    terms = []
    for word in words:
        if word[0].isascii():
            if word not in {"the", "and", "can", "for", "what", "with", "should", "about", "how", "you", "that"}:
                terms.append(word[:48])
        else:
            terms.extend(word[i:i + 2] for i in range(max(1, len(word) - 1)))
    return list(dict.fromkeys(terms))[:12]


def _earlier_context(db: Session, conversation_id: UUID, last_older_turn: int, question: str) -> list[dict[str, str]]:
    if last_older_turn < 1:
        return []
    turns = select(AssistantConversationTurn).where(
        AssistantConversationTurn.conversation_id == conversation_id,
        AssistantConversationTurn.number <= last_older_turn,
    )
    # Keep the opening training goal. Prefer older turns that mention the current
    # topic, then the most recent other discussion. Only small excerpts leave the server.
    matches = [
        or_(
            AssistantConversationTurn.question.icontains(term, autoescape=True),
            AssistantConversationTurn.answer.icontains(term, autoescape=True),
        )
        for term in _search_terms(question)
    ]
    order = [case((AssistantConversationTurn.number == 1, 1), else_=0).desc()]
    if matches:
        order.append(sum(case((match, 1), else_=0) for match in matches).desc())
    order.append(AssistantConversationTurn.training_priorities.is_not(None).desc())
    rows = db.scalars(turns.order_by(*order, AssistantConversationTurn.number.desc()).limit(4))
    return [
        {"source": "this_conversation", "question": row.question[:450], "answer": row.answer[:450]}
        for row in sorted(rows, key=lambda row: row.number)
    ]


class AssistantConversationService:
    def __init__(self, db: Session, player: User):
        if player.role not in STUDENT_ROLES:
            raise HTTPException(403, "AI Coach is available in the player workspace.")
        self.db = db
        self.player = player
        self.player_id = player.id

    def _get(self, public_id: UUID, *, lock: bool = False, include_empty: bool = False) -> AssistantConversation:
        query = select(AssistantConversation).where(
            AssistantConversation.public_id == public_id,
            AssistantConversation.player_id == self.player_id,
        )
        if not include_empty:
            query = query.where(AssistantConversation.turn_count > 0)
        if lock:
            query = query.with_for_update()
        row = self.db.scalar(query.execution_options(populate_existing=True))
        if row is None:
            raise HTTPException(404, "Conversation not found.")
        return row

    def list(self, archived: bool = False, limit: int = 20, offset: int = 0) -> ConversationHistory:
        conditions = (
            AssistantConversation.player_id == self.player_id,
            AssistantConversation.archived == archived,
            AssistantConversation.turn_count > 0,
        )
        count = self.db.scalar(select(func.count()).select_from(AssistantConversation).where(*conditions))
        query = (
            select(AssistantConversation)
            .where(*conditions)
            .order_by(AssistantConversation.updated_at.desc(), AssistantConversation.public_id.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = self.db.scalars(query)
        return ConversationHistory(items=[ConversationSummary.model_validate(row) for row in rows], total=count)

    def detail(self, public_id: UUID, limit: int = 20, before_turn: int | None = None) -> ConversationDetail:
        row = self._get(public_id)
        last_turn = min(row.turn_count, before_turn - 1) if before_turn is not None else row.turn_count
        query = (
            select(AssistantConversationTurn)
            .where(AssistantConversationTurn.conversation_id == public_id, AssistantConversationTurn.number <= last_turn)
            .order_by(AssistantConversationTurn.number.desc())
            .limit(limit)
        )
        turns = self.db.scalars(query).all()
        messages = []
        for turn in reversed(turns):
            messages.append(ConversationMessage(
                turn=turn.number, role="user", content=turn.question, created_at=turn.asked_at,
            ))
            messages.append(ConversationMessage(
                turn=turn.number, role="assistant", content=turn.answer,
                recommendations=turn.recommendations, created_at=turn.answered_at,
            ))
        return ConversationDetail(
            **ConversationSummary.model_validate(row).model_dump(),
            messages=messages,
            has_more=bool(turns and turns[-1].number > 1),
        )

    def set_archived(self, public_id: UUID, archived: bool) -> ConversationSummary:
        row = self._get(public_id, lock=True)
        if row.archived != archived:
            row.archived = archived
            row.updated_at = datetime.now(timezone.utc)
            # Invalidate any in-flight generation even if the chat is later restored.
            row.pending_token = None
            row.pending_until = None
        summary = ConversationSummary.model_validate(row)
        self.db.commit()
        return summary

    def _opening_conversation(self, payload: ConversationQuestion) -> AssistantConversation:
        statement = insert(AssistantConversation).values(
            player_id=self.player_id,
            creation_request_id=payload.request_id,
            title=" ".join(payload.content.split())[:80],
        )
        # The upsert obtains the same row lock for simultaneous first sends, including
        # a retry racing cleanup of a failed first response.
        upsert = statement.on_conflict_do_update(
            constraint="uq_assistant_conversation_creation",
            set_={"creation_request_id": statement.excluded.creation_request_id},
        ).returning(AssistantConversation)
        return self.db.scalars(upsert, execution_options={"populate_existing": True}).one()

    def _model_request(self, public_id: UUID, question: str) -> AssistantRequest:
        query = (
            select(AssistantConversationTurn)
            .where(AssistantConversationTurn.conversation_id == public_id)
            .order_by(AssistantConversationTurn.number.desc())
            .limit(RECENT_TURNS)
        )
        recent = self.db.scalars(query).all()
        history = []
        for turn in reversed(recent):
            history.append(AssistantMessage(role="user", content=turn.question))
            history.append(AssistantMessage(role="assistant", content=turn.answer))
        history.append(AssistantMessage(role="user", content=question))
        return AssistantRequest(messages=history)

    def send(self, payload: ConversationQuestion, conversation_id: UUID | None = None) -> ConversationDetail:
        if conversation_id is None:
            row = self._opening_conversation(payload)
            expected = 0
        else:
            if not isinstance(payload, ConversationFollowup):
                raise ValueError("A follow-up requires the last known turn count.")
            row = self._get(conversation_id, lock=True)
            expected = payload.expected_turn_count

        public_id = row.public_id
        saved = self.db.scalar(select(AssistantConversationTurn).where(
            AssistantConversationTurn.conversation_id == public_id,
            AssistantConversationTurn.request_id == payload.request_id,
        ))
        if saved is not None:
            if saved.question != payload.content or saved.number != expected + 1:
                raise HTTPException(409, "This request ID was already used for another message.")
            self.db.commit()
            return self.detail(public_id)
        if row.archived:
            raise HTTPException(409, "Restore this conversation before sending a message.")
        if row.turn_count != expected:
            raise HTTPException(409, "This conversation has new messages. Refresh it before continuing.")
        now = datetime.now(timezone.utc)
        if row.pending_until and row.pending_until > now:
            raise HTTPException(
                409,
                detail={
                    "code": "assistant_reply_in_progress",
                    "message": "A reply is already in progress. Please try again shortly.",
                },
                headers={"Retry-After": "2"},
            )

        request = self._model_request(public_id, payload.content)
        earlier = _earlier_context(self.db, public_id, expected - RECENT_TURNS, payload.content)
        earlier.extend(other_training_priorities(self.db, self.player_id, public_id))
        if not expected:
            # A worker may have stopped before storing a first turn. If its lease
            # expired, ensure the eventual saved title agrees with the saved question.
            row.title = " ".join(payload.content.split())[:80]

        token = uuid4()
        row.pending_token = token
        row.pending_until = now + GENERATION_LEASE
        self.db.commit()
        try:
            assistant = TrainingAssistant(self.db)
            if earlier:
                reply = assistant.answer(self.player, request, earlier_context=earlier)
            else:
                reply = assistant.answer(self.player, request)
            row = self._get(public_id, lock=True, include_empty=True)
            if row.pending_token != token:
                raise HTTPException(409, "The conversation changed before the reply was saved. Refresh it to continue.")
            completed_at = datetime.now(timezone.utc)
            self.db.add(AssistantConversationTurn(
                conversation_id=public_id, number=expected + 1, request_id=payload.request_id,
                question=payload.content, answer=reply.answer,
                recommendations=[link.model_dump() for link in reply.recommendations],
                training_priorities=reply._training_priorities or None,
                asked_at=now, answered_at=completed_at,
            ))
            row.turn_count = expected + 1
            row.updated_at = completed_at
            row.pending_token = None
            row.pending_until = None
            self.db.commit()
        except Exception:
            self._release_failed_send(public_id, token)
            raise
        return self.detail(public_id)

    def _release_failed_send(self, public_id: UUID, token: UUID) -> None:
        self.db.rollback()
        query = select(AssistantConversation).where(
            AssistantConversation.public_id == public_id,
            AssistantConversation.player_id == self.player_id,
            AssistantConversation.pending_token == token,
        ).with_for_update().execution_options(populate_existing=True)
        row = self.db.scalar(query)
        if row is not None:
            if row.turn_count == 0:
                self.db.delete(row)
            else:
                row.pending_token = None
                row.pending_until = None
        self.db.commit()
