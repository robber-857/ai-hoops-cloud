from decimal import Decimal
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, require_roles
from app.models.enums import UserRole
from app.models.food_catalog import FoodRelease, FoodEntry
from app.schemas.recipe import RecipeCreate, RecipeUpdate, RecipePublish
from app.services.recipe_service import RecipeService

router = APIRouter(dependencies=[Depends(get_current_user)])
admin = require_roles(UserRole.admin)


@router.get("/foods/releases")
def releases(db: Session = Depends(get_db)):
    rows = db.scalars(select(FoodRelease).order_by(FoodRelease.id.desc())).all()
    return {
        "items": [
            {
                "id": r.id,
                "name": r.name,
                "fingerprint": r.fingerprint,
                "attribution": r.manifest["attribution"],
                "licence_url": r.manifest["licence_url"],
            }
            for r in rows
        ]
    }


@router.get("/foods")
def foods(
    release_id: int = Query(gt=0),
    query: str = Query("", max_length=200),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    release = db.get(FoodRelease, release_id)
    if not release:
        raise HTTPException(404, "Food source release not found.")
    stmt = select(FoodEntry).where(FoodEntry.release_id == release_id)
    if query.strip():
        escaped = (
            query.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        stmt = stmt.where(FoodEntry.name.ilike("%" + escaped + "%", escape="\\"))
    rows = db.scalars(
        stmt.order_by(FoodEntry.name, FoodEntry.food_key)
        .offset(offset)
        .limit(limit + 1)
    ).all()
    return {
        "items": [
            {
                "release_id": r.release_id,
                "food_key": r.food_key,
                "name": r.name,
                "details": r.content["details"],
                "nutrients": r.content["nutrients"],
            }
            for r in rows[:limit]
        ],
        "has_more": len(rows) > limit,
        "source": {
            "name": release.name,
            "fingerprint": release.fingerprint,
            "attribution": release.manifest["attribution"],
            "licence_url": release.manifest["licence_url"],
            "source_page": release.manifest["source_page"],
        },
        "data_notice": "Australian food composition estimates vary by sample, season, processing and brand. Australian data may not be appropriate in other countries.",
    }


@router.get("/admin/recipes", dependencies=[Depends(admin)])
def admin_list(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return RecipeService(db).list(limit, offset, admin=True)


@router.post("/admin/recipes", status_code=201)
def create(payload: RecipeCreate, user=Depends(admin), db: Session = Depends(get_db)):
    return RecipeService(db).create(user, payload)


@router.get("/admin/recipes/{recipe_id}", dependencies=[Depends(admin)])
def draft(recipe_id: UUID, db: Session = Depends(get_db)):
    service = RecipeService(db)
    return service.read_draft(service._recipe(recipe_id))


@router.put("/admin/recipes/{recipe_id}")
def update(
    recipe_id: UUID,
    payload: RecipeUpdate,
    user=Depends(admin),
    db: Session = Depends(get_db),
):
    return RecipeService(db).update(user, recipe_id, payload)


@router.post("/admin/recipes/{recipe_id}/publish")
def publish(
    recipe_id: UUID,
    payload: RecipePublish,
    user=Depends(admin),
    db: Session = Depends(get_db),
):
    return RecipeService(db).publish(user, recipe_id, payload.expected_version)


@router.get("/recipes")
def published_list(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return RecipeService(db).list(limit, offset)


@router.get("/recipes/{recipe_id}")
def published(
    recipe_id: UUID,
    version: int | None = Query(None, ge=1),
    servings: Decimal = Query(
        Decimal(1), gt=0, le=1000, max_digits=7, decimal_places=2
    ),
    db: Session = Depends(get_db),
):
    return RecipeService(db).published(recipe_id, version, servings)


@router.get("/recipes/{recipe_id}/versions")
def versions(
    recipe_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return RecipeService(db).versions(recipe_id, limit, offset)
