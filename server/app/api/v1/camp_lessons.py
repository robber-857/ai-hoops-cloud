from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.camp_lesson import (
    LessonCreate,
    LessonUpdate,
    LessonRead,
    LessonsRead,
    LessonHistory,
)
from app.services.camp_lesson_service import CampLessonService

router = APIRouter(prefix="/coach/classes/{class_id}/lessons")


@router.post("", response_model=LessonRead, status_code=201)
def create(
    class_id: UUID,
    payload: LessonCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampLessonService(db).create(user, class_id, payload)


@router.get("", response_model=LessonsRead)
def list_lessons(
    class_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampLessonService(db).list(user, class_id, limit, offset)


@router.get("/{lesson_id}", response_model=LessonRead)
def get_lesson(
    class_id: UUID,
    lesson_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampLessonService(db).get(user, class_id, lesson_id)


@router.put("/{lesson_id}", response_model=LessonRead)
def update(
    class_id: UUID,
    lesson_id: UUID,
    payload: LessonUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampLessonService(db).update(user, class_id, lesson_id, payload)


@router.get("/{lesson_id}/history", response_model=LessonHistory)
def history(
    class_id: UUID,
    lesson_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampLessonService(db).history(user, class_id, lesson_id, limit, offset)


@router.get("/{lesson_id}/history/{version}", response_model=LessonRead)
def revision(
    class_id: UUID,
    lesson_id: UUID,
    version: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampLessonService(db).revision(user, class_id, lesson_id, version)
