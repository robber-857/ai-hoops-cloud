from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.camp_plan import (
    PlanCreate,
    PlanUpdate,
    PlanPublish,
    PlanRead,
    PlansRead,
)
from app.services.camp_plan_service import CampPlanService

router = APIRouter()


@router.get("/coach/classes/{class_id}/plans", response_model=PlansRead)
def coach_list(
    class_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampPlanService(db).coach_list(user, class_id, limit, offset)


@router.post(
    "/coach/classes/{class_id}/plans", response_model=PlanRead, status_code=201
)
def create(
    class_id: UUID,
    payload: PlanCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampPlanService(db).create(user, class_id, payload)


@router.put("/coach/classes/{class_id}/plans/{plan_id}", response_model=PlanRead)
def update(
    class_id: UUID,
    plan_id: UUID,
    payload: PlanUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampPlanService(db).update(user, class_id, plan_id, payload)


@router.get("/coach/classes/{class_id}/plans/{plan_id}", response_model=PlanRead)
def get_plan(
    class_id: UUID,
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampPlanService(db).get(user, class_id, plan_id)


@router.post(
    "/coach/classes/{class_id}/plans/{plan_id}/publish", response_model=PlanRead
)
def publish(
    class_id: UUID,
    plan_id: UUID,
    payload: PlanPublish,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampPlanService(db).publish(
        user, class_id, plan_id, payload.expected_version
    )


@router.get("/me/plans", response_model=PlansRead)
def student_list(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampPlanService(db).student_list(user, limit, offset)
