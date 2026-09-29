"""Source releases and foods are append-only through the import service."""

from sqlalchemy import BigInteger, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base
from app.models.mixins import TimestampMixin


class FoodRelease(TimestampMixin, Base):
    __tablename__ = "food_releases"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True)
    manifest: Mapped[dict] = mapped_column(JSONB)


class FoodEntry(Base):
    __tablename__ = "food_entries"
    __table_args__ = (
        UniqueConstraint("release_id", "food_key", name="uq_food_release_key"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey("food_releases.id"))
    food_key: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(500))
    content: Mapped[dict] = mapped_column(JSONB)
