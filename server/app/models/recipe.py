from sqlalchemy import BigInteger, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class Recipe(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "recipes"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[dict] = mapped_column(JSONB)
    creation_payload: Mapped[dict] = mapped_column(JSONB)


class RecipePublication(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "recipe_publications"
    __table_args__ = (
        UniqueConstraint("recipe_id", "version", name="uq_recipe_publication_version"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"))
    version: Mapped[int] = mapped_column(Integer)
    published_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    snapshot: Mapped[dict] = mapped_column(JSONB)
