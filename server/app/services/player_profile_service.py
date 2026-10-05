from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.player_profile_revision import PlayerProfileRevision
from app.models.user import User
from app.schemas.player_profile import PlayerProfileCreate, PlayerProfileHistory, PlayerProfileRead


class PlayerProfileService:
    def __init__(self, db: Session):
        self.db = db

    def history(self, user: User, *, limit: int = 20, offset: int = 0) -> PlayerProfileHistory:
        rows = list(self.db.scalars(select(PlayerProfileRevision).where(
            PlayerProfileRevision.user_id == user.id,
        ).order_by(PlayerProfileRevision.measured_on.desc(), PlayerProfileRevision.created_at.desc(),
                   PlayerProfileRevision.id.desc()).offset(offset).limit(limit + 1)))
        return PlayerProfileHistory(items=[PlayerProfileRead.model_validate(row) for row in rows[:limit]], has_more=len(rows) > limit)

    def create(self, user: User, payload: PlayerProfileCreate) -> PlayerProfileRead:
        values = payload.model_dump(exclude={"request_id"})

        def existing_result():
            existing = self.db.scalar(select(PlayerProfileRevision).where(PlayerProfileRevision.public_id == payload.request_id))
            if existing is None:
                return None
            if existing.user_id != user.id or any(getattr(existing, key) != value for key, value in values.items()):
                raise HTTPException(409, "This save request was already used. Refresh and try again.")
            return PlayerProfileRead.model_validate(existing)

        previous = existing_result()
        if previous:
            return previous

        # Serialize date-of-birth changes with ProfileService.update without
        # changing the result of a retry for an already saved measurement.
        current = self.db.scalar(
            select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True)
        )
        if current is None:
            raise HTTPException(404, "Profile not found.")
        previous = existing_result()
        if previous:
            return previous
        if current.training_started_on is not None and payload.date_of_birth > current.training_started_on:
            raise HTTPException(422, "Date of birth cannot be after the recorded training start date. Update your profile first.")

        row = PlayerProfileRevision(user_id=user.id, public_id=payload.request_id, **values)
        self.db.add(row)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            previous = existing_result()
            if previous:
                return previous
            raise
        self.db.refresh(row)
        return PlayerProfileRead.model_validate(row)
