from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.services.training_food_service import TrainingFoodService

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/training-foods")
def training_foods(
    category: Literal["meat", "eggs", "dairy", "vegetables"] | None = None,
    query: str = Query("", max_length=200),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return TrainingFoodService(db).list(category, query, limit, offset)
