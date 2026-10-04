from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.player_profile_revision import PlayerProfileRevision
from app.models.user import User
from app.schemas.profile import ProfileRead, ProfileUpdate


class ProfileService:
    def __init__(self, db: Session):
        self.db = db

    def _user(self, user: User, *, lock: bool = False) -> User:
        statement = select(User).where(User.id == user.id).execution_options(populate_existing=True)
        if lock:
            statement = statement.with_for_update()
        row = self.db.scalar(statement)
        if row is None:
            raise HTTPException(404, "Profile not found.")
        return row

    def read(self, user: User) -> ProfileRead:
        return ProfileRead.model_validate(self._user(user))

    def update(self, user: User, payload: ProfileUpdate) -> ProfileRead:
        # Measurement creation locks this same row before checking the training date.
        row = self._user(user, lock=True)
        if payload.expected_updated_at is not None and payload.expected_updated_at != row.updated_at:
            raise HTTPException(409, "Profile changed. Reload your profile before saving again.")

        changes = payload.model_dump(exclude_unset=True, exclude={"expected_updated_at"})
        training_date = changes.get("training_started_on")
        if training_date is not None:
            birth = self.db.scalar(
                select(PlayerProfileRevision.date_of_birth)
                .where(PlayerProfileRevision.user_id == row.id)
                .order_by(
                    PlayerProfileRevision.measured_on.desc(),
                    PlayerProfileRevision.created_at.desc(),
                    PlayerProfileRevision.id.desc(),
                )
                .limit(1)
            )
            if birth is not None and training_date < birth:
                raise HTTPException(422, "Training start date cannot be before the recorded date of birth.")

        changed = {key: value for key, value in changes.items() if getattr(row, key) != value}
        if not changed:
            return ProfileRead.model_validate(row)

        for key, value in changed.items():
            setattr(row, key, value)
        row.updated_at = datetime.now(timezone.utc)
        try:
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        self.db.refresh(row)
        return ProfileRead.model_validate(row)
