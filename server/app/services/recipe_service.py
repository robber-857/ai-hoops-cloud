from decimal import Decimal, ROUND_HALF_UP, localcontext
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import select, func, text
from app.models.enums import UserRole
from app.models.food_catalog import FoodRelease, FoodEntry
from app.models.recipe import Recipe, RecipePublication
from app.schemas.recipe import RecipeContent

UNITS = {
    "energy_with_fibre_kj": "kJ",
    "energy_kcal": "kcal",
    "protein_g": "g",
    "fat_g": "g",
    "carbohydrate_without_sugar_alcohols_g": "g",
    "fibre_g": "g",
    "sugars_g": "g",
    "sodium_mg": "mg",
}


def rounded(value):
    return (
        format(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f")
        if value is not None
        else None
    )


def calculate(content, ingredients):
    """Compute only absolute core nutrients, never %T or mg/gN. Round output once."""
    with localcontext() as ctx:
        ctx.prec = 40
        contributions = []
        for item in ingredients:
            grams = Decimal(item["edible_grams"])
            amounts = {
                key: Decimal(value) * grams / 100 if value is not None else None
                for key, value in item["per_100g"].items()
            }
            energy = amounts["energy_with_fibre_kj"]
            amounts["energy_kcal"] = (
                energy / Decimal("4.184") if energy is not None else None
            )
            contributions.append(amounts)
        totals = {}
        for key, unit in UNITS.items():
            missing = [
                i for i, amount in enumerate(contributions) if amount[key] is None
            ]
            known = sum(
                (a[key] for a in contributions if a[key] is not None), Decimal(0)
            )
            value = None if missing else known
            weight = content.finished_weight_grams
            totals[key] = {
                "unit": unit,
                "total": rounded(value),
                "per_serving": (
                    rounded(value / content.servings) if value is not None else None
                ),
                "per_100g_finished": (
                    rounded(value / weight * 100)
                    if value is not None and weight is not None
                    else None
                ),
                "known_subtotal": rounded(known),
                "missing_ingredient_indexes": missing,
            }
        return {
            "nutrients": totals,
            "ingredient_contributions": [
                {k: rounded(v) for k, v in amount.items()} for amount in contributions
            ],
            "serving_weight_grams": (
                rounded(content.finished_weight_grams / content.servings)
                if content.finished_weight_grams
                else None
            ),
            "method": "Matched-state edible grams / 100; no cooking retention, water loss or oil absorption inferred. AFCD-based estimate, not an AFCD-certified recipe.",
            "calculation_version": "recipe-composition-v1",
            "rounding": "Decimal, half-up to 2 places at output; totals computed before rounding.",
        }


class RecipeService:
    def __init__(self, db):
        self.db = db

    def admin(self, user):
        if user.role != UserRole.admin:
            raise HTTPException(403, "Only administrators can maintain recipes.")

    def _recipe(self, recipe_id, lock=False):
        query = select(Recipe).where(Recipe.public_id == recipe_id)
        if lock:
            query = query.with_for_update().execution_options(populate_existing=True)
        row = self.db.scalar(query)
        if row is None:
            raise HTTPException(404, "Recipe not found.")
        return row

    def snapshot(self, content):
        ingredients = []
        for item in content.ingredients:
            food = self.db.scalar(
                select(FoodEntry).where(
                    FoodEntry.release_id == item.release_id,
                    FoodEntry.food_key == item.food_key,
                )
            )
            if not food:
                raise HTTPException(
                    422,
                    f"Selected food {item.food_key} is not available in that release.",
                )
            release = self.db.get(FoodRelease, item.release_id)
            manifest = release.manifest
            values = {
                key: food.content["nutrients"].get(manifest["core_mapping"][key])
                for key in UNITS
                if key != "energy_kcal"
            }
            ingredients.append(
                {
                    **item.model_dump(mode="json"),
                    "name": food.name,
                    "details": food.content["details"],
                    "profile_identity": food.content.get("profile_identity"),
                    "per_100g": values,
                    "source": {
                        "release": release.name,
                        "fingerprint": release.fingerprint,
                        "sources": manifest["sources"],
                        "attribution": manifest["attribution"],
                        "licence_url": manifest["licence_url"],
                        "source_page": manifest["source_page"],
                    },
                }
            )
        return {
            "content": content.model_dump(mode="json"),
            "ingredients": ingredients,
            "nutrition": calculate(content, ingredients),
        }

    def read_draft(self, row):
        return {
            "public_id": str(row.public_id),
            "version": row.version,
            "updated_at": row.updated_at,
            **self.snapshot(RecipeContent(**row.content)),
        }

    def create(self, user, payload):
        self.admin(user)
        original = payload.model_dump(mode="json")
        self.db.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": "recipe:" + str(payload.request_id)},
        )
        row = self.db.scalar(
            select(Recipe).where(Recipe.public_id == payload.request_id)
        )
        if row:
            if row.creation_payload != original or row.created_by_user_id != user.id:
                raise HTTPException(409, "Create request has already been used.")
            return self.read_draft(row)
        content = RecipeContent(
            **{k: v for k, v in original.items() if k != "request_id"}
        )
        self.snapshot(content)
        row = Recipe(
            public_id=payload.request_id,
            created_by_user_id=user.id,
            content=content.model_dump(mode="json"),
            creation_payload=original,
        )
        self.db.add(row)
        self.db.commit()
        return self.read_draft(row)

    def update(self, user, recipe_id, payload):
        self.admin(user)
        row = self._recipe(recipe_id, True)
        content = RecipeContent(**payload.model_dump(exclude={"expected_version"}))
        data = content.model_dump(mode="json")
        if row.version != payload.expected_version:
            if row.version == payload.expected_version + 1 and row.content == data:
                return self.read_draft(row)
            raise HTTPException(409, "Recipe changed. Reload before saving.")
        self.snapshot(content)
        row.content = data
        row.version += 1
        self.db.commit()
        return self.read_draft(row)

    def publish(self, user, recipe_id, expected_version):
        self.admin(user)
        row = self._recipe(recipe_id, True)
        # A retry of an older published version returns that immutable snapshot.
        saved = self.db.scalar(
            select(RecipePublication).where(
                RecipePublication.recipe_id == row.id,
                RecipePublication.version == expected_version,
            )
        )
        if saved:
            return self.read_publication(saved, row.public_id)
        if row.version != expected_version:
            raise HTTPException(409, "Recipe changed. Reload before publishing.")
        content = RecipeContent(**row.content)
        snapshot = self.snapshot(content)
        saved = RecipePublication(
            recipe_id=row.id,
            version=row.version,
            published_by_user_id=user.id,
            snapshot=snapshot,
        )
        self.db.add(saved)
        self.db.commit()
        return self.read_publication(saved, row.public_id)

    def read_publication(self, saved, recipe_id, portions=Decimal(1)):
        result = {
            "public_id": str(recipe_id),
            "publication_id": str(saved.public_id),
            "version": saved.version,
            "published_at": saved.created_at,
            **saved.snapshot,
        }
        content = RecipeContent(**saved.snapshot["content"])
        with localcontext() as ctx:
            ctx.prec = 40
            scaled = content.model_copy(
                update={"servings": content.servings / portions}
            )
            calculated = calculate(scaled, saved.snapshot["ingredients"])
        result["portion_preview"] = {
            "servings_requested": str(portions),
            "weight_grams": calculated["serving_weight_grams"],
            "nutrients": {
                key: {
                    "unit": value["unit"],
                    "amount": value["per_serving"],
                    "missing_ingredient_indexes": value["missing_ingredient_indexes"],
                }
                for key, value in calculated["nutrients"].items()
            },
        }
        return result

    def versions(self, recipe_id, limit, offset):
        row = self._recipe(recipe_id)
        records = self.db.scalars(
            select(RecipePublication)
            .where(RecipePublication.recipe_id == row.id)
            .order_by(RecipePublication.version.desc())
            .offset(offset)
            .limit(limit + 1)
        ).all()
        if not records and offset == 0:
            raise HTTPException(404, "Published recipe not found.")
        return {
            "items": [
                {
                    "version": r.version,
                    "published_at": r.created_at,
                    "title": r.snapshot["content"]["title"],
                }
                for r in records[:limit]
            ],
            "has_more": len(records) > limit,
        }

    def published(self, recipe_id, version=None, portions=Decimal(1)):
        row = self._recipe(recipe_id)
        query = select(RecipePublication).where(RecipePublication.recipe_id == row.id)
        if version is not None:
            query = query.where(RecipePublication.version == version)
        saved = self.db.scalar(
            query.order_by(RecipePublication.version.desc()).limit(1)
        )
        if not saved:
            raise HTTPException(404, "Published recipe not found.")
        return self.read_publication(saved, row.public_id, portions)

    def list(self, limit, offset, admin=False):
        if admin:
            rows = self.db.scalars(
                select(Recipe)
                .order_by(Recipe.updated_at.desc(), Recipe.id.desc())
                .offset(offset)
                .limit(limit + 1)
            ).all()
            items = [
                {
                    "public_id": str(r.public_id),
                    "title": r.content["title"],
                    "version": r.version,
                }
                for r in rows[:limit]
            ]
        else:
            latest = (
                select(
                    RecipePublication.recipe_id,
                    func.max(RecipePublication.version).label("version"),
                )
                .group_by(RecipePublication.recipe_id)
                .subquery()
            )
            rows = self.db.execute(
                select(RecipePublication, Recipe.public_id)
                .join(
                    latest,
                    (RecipePublication.recipe_id == latest.c.recipe_id)
                    & (RecipePublication.version == latest.c.version),
                )
                .join(Recipe, Recipe.id == RecipePublication.recipe_id)
                .order_by(
                    RecipePublication.created_at.desc(), RecipePublication.id.desc()
                )
                .offset(offset)
                .limit(limit + 1)
            ).all()
            items = [
                {
                    "public_id": str(key),
                    "title": p.snapshot["content"]["title"],
                    "version": p.version,
                    "image_url": p.snapshot["content"]["image_url"],
                }
                for p, key in rows[:limit]
            ]
        return {"items": items, "has_more": len(rows) > limit}
