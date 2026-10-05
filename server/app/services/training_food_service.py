"""Read-only, named selection from a pinned official AFCD release.

Display names are a translation layer. Nutrient values always come directly
from FoodEntry and the release's core_mapping, never from recipe calculations.
"""

from decimal import Decimal, InvalidOperation
from functools import lru_cache
import json
from pathlib import Path
from typing import NoReturn

from fastapi import HTTPException
from sqlalchemy import select

from app.models.food_catalog import FoodEntry, FoodRelease
from app.services.afcd_import import CORE

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "training_foods.json"
MACROS = {
    "carbohydrate_g": "carbohydrate_without_sugar_alcohols_g",
    "protein_g": "protein_g",
    "fat_g": "fat_g",
}
DATA_NOTICE = (
    "Food composition data represents samples at particular times; nutrient "
    "content can vary between batches and brands, seasons, processing practices, "
    "ingredient sources and methods of calculation. Based on Australian data, "
    "which may not be appropriate for use in other countries."
)


@lru_cache(maxsize=1)
def food_config():
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def _unavailable_source() -> NoReturn:
    raise HTTPException(503, "所选 AFCD 食材来源校验未通过，请联系管理员核查数据。")


def validate_release(release, pinned):
    manifest = release.manifest
    if (
        release.name != pinned["name"]
        or release.fingerprint != pinned["fingerprint"]
        or not isinstance(manifest, dict)
        or manifest.get("release") != pinned["name"]
        or manifest.get("basis") != "per_100g_edible_portion"
        or manifest.get("sources") != pinned["sources"]
        or manifest.get("source_page") != pinned["source_page"]
        or manifest.get("licence_url") != pinned["licence_url"]
        or manifest.get("attribution") != pinned["attribution"]
    ):
        _unavailable_source()
    mapping = manifest.get("core_mapping", {})
    definitions = manifest.get("nutrients")
    if (
        not isinstance(mapping, dict)
        or not isinstance(definitions, list)
        or any(not isinstance(n, dict) or not isinstance(n.get("key"), str) for n in definitions)
    ):
        _unavailable_source()
    nutrients = {n["key"]: n for n in definitions}
    for key in MACROS.values():
        definition = nutrients.get(mapping.get(key), {})
        if (
            mapping.get(key) != CORE[key]
            or definition.get("unit") != "g"
            or definition.get("basis") != "per_100g_edible_portion"
        ):
            _unavailable_source()


def nutrient_value(values, field):
    """Retain source decimal precision and the distinction between null and 0."""
    value = values.get(field)
    if value is None:
        return None
    if isinstance(value, bool):
        _unavailable_source()
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        _unavailable_source()
    if not number.is_finite() or number < 0:
        _unavailable_source()
    return format(number, "f")


class TrainingFoodService:
    def __init__(self, db):
        self.db = db

    def list(self, category=None, query="", limit=20, offset=0):
        config = food_config()
        pinned = config["release"]
        release = self.db.scalar(
            select(FoodRelease).where(
                FoodRelease.name == pinned["name"],
                FoodRelease.fingerprint == pinned["fingerprint"],
            )
        )
        base = {
            "items": [],
            "has_more": False,
            "total": 0,
            "categories": config["categories"],
            "catalog_version": config["version"],
            "data_notice": DATA_NOTICE,
            "expected_release": pinned["name"],
            "basis": "per_100g_edible_portion",
            "source": None,
        }
        if release is None:
            return {**base, "data_status": "source_unavailable", "missing_food_count": 0}
        validate_release(release, pinned)
        base["source"] = {
            "release_id": release.id,
            "name": release.name,
            "fingerprint": release.fingerprint,
            "source_page": pinned["source_page"],
            "attribution": pinned["attribution"],
            "licence_url": pinned["licence_url"],
            "sources": pinned["sources"],
            "translation_notice": "Food display names and preparation labels translated from English to Chinese; nutrient values unchanged.",
        }
        selected = config["foods"]
        rows = self.db.scalars(
            select(FoodEntry).where(
                FoodEntry.release_id == release.id,
                FoodEntry.food_key.in_([f["food_key"] for f in selected]),
            )
        ).all()
        entries = {r.food_key: r for r in rows}
        items = []
        missing = 0
        normalized_query = query.strip().casefold()
        for item in selected:
            food = entries.get(item["food_key"])
            if food is None:
                missing += 1
                continue
            if (
                food.release_id != release.id
                or food.name != item["source_name"]
                or not isinstance(food.content, dict)
                or food.content.get("name") != item["source_name"]
                or food.content.get("food_key") != item["food_key"]
            ):
                _unavailable_source()
            if category and item["category"] != category:
                continue
            searchable = " ".join(
                [item["name"], item["source_name"], item["preparation"]]
            ).casefold()
            if normalized_query and normalized_query not in searchable:
                continue
            values = food.content.get("nutrients", {})
            if not isinstance(values, dict):
                _unavailable_source()
            items.append(
                {
                    "release_id": release.id,
                    "food_key": food.food_key,
                    "name": item["name"],
                    "source_name": food.name,
                    "category": item["category"],
                    "preparation": item["preparation"],
                    **{
                        public_key: nutrient_value(values, release.manifest["core_mapping"][source_key])
                        for public_key, source_key in MACROS.items()
                    },
                }
            )
        return {
            **base,
            "items": items[offset : offset + limit],
            "has_more": len(items) > offset + limit,
            "total": len(items),
            "data_status": "partial_catalog" if missing else "ready",
            "missing_food_count": missing,
        }
