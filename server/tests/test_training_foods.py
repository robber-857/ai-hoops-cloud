import copy
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.deps import get_current_user, get_db
from app.api.v1.foods import router
from app.services.afcd_import import CORE, parse_release
from app.services.training_food_service import (
    TrainingFoodService,
    food_config,
    validate_release,
)


def fixtures():
    """In-memory test doubles, never imported into a real food release."""
    config = food_config()
    pinned = copy.deepcopy(config["release"])
    manifest = {**pinned, "release": pinned["name"], "core_mapping": CORE}
    manifest["nutrients"] = [
        {"key": CORE[key], "unit": "g", "basis": "per_100g_edible_portion"}
        for key in ["carbohydrate_without_sugar_alcohols_g", "protein_g", "fat_g"]
    ]
    release = SimpleNamespace(id=17, name=pinned["name"], fingerprint=pinned["fingerprint"], manifest=manifest)
    rows = [
        SimpleNamespace(
            release_id=17,
            food_key=item["food_key"],
            name=item["source_name"],
            content={
                "food_key": item["food_key"],
                "name": item["source_name"],
                "nutrients": {CORE[key]: "0" for key in ["carbohydrate_without_sugar_alcohols_g", "protein_g", "fat_g"]},
            },
        )
        for item in config["foods"]
    ]
    return release, rows


class FakeDb:
    def __init__(self, release, rows):
        self.release = release
        self.rows = rows
        self.statements = []

    def scalar(self, statement):
        self.statements.append(statement)
        return self.release

    def scalars(self, statement):
        self.statements.append(statement)
        return SimpleNamespace(all=lambda: self.rows)


class TrainingFoodTests(unittest.TestCase):
    def setUp(self):
        release, rows = fixtures()
        self.db = FakeDb(release, rows)
        self.service = TrainingFoodService(self.db)

    def test_pinned_source_and_chinese_english_search_do_not_select_latest(self):
        result = self.service.list(query="鸡胸肉")
        self.assertEqual([r["food_key"] for r in result["items"]], ["F002594", "F002593"])
        self.assertEqual(result["source"]["fingerprint"], food_config()["release"]["fingerprint"])
        self.assertEqual(result["source"]["release_id"], 17)
        self.assertIn("translated", result["source"]["translation_notice"])
        statement = self.db.statements[0].compile()
        self.assertIn("AFCD Release 3", statement.params.values())
        self.assertIn(food_config()["release"]["fingerprint"], statement.params.values())
        self.assertNotIn("ORDER BY", str(statement))
        english = self.service.list(query="  MILK, COW, FLUID  ")
        self.assertEqual(len(english["items"]), 3)
        self.assertEqual(len(self.service.list(query="water")["items"]), 0)
        # Literal percent signs only match the four fat-percentage labels.
        self.assertEqual(len(self.service.list(query="%")["items"]), 4)
        self.assertEqual(len(self.service.list(query="_")["items"]), 0)

    def test_categories_pagination_and_food_states(self):
        first = self.service.list(limit=20)
        second = self.service.list(limit=20, offset=20)
        self.assertTrue(first["has_more"])
        self.assertFalse(second["has_more"])
        self.assertEqual((len(first["items"]), len(second["items"]), first["total"]), (20, 8, 28))
        self.assertFalse(set(r["food_key"] for r in first["items"]) & set(r["food_key"] for r in second["items"]))
        self.assertEqual(len(self.service.list(category="eggs")["items"]), 4)
        states = self.service.list(query="鸡胸肉")["items"]
        self.assertEqual(states[0]["preparation"], "生")
        self.assertIn("无额外加油", states[1]["preparation"])
        self.assertIn("raw", states[0]["source_name"])
        self.assertIn("grilled", states[1]["source_name"])

    def test_core_mapping_preserves_null_zero_and_source_precision(self):
        values = self.db.rows[0].content["nutrients"]
        values[CORE["carbohydrate_without_sugar_alcohols_g"]] = None
        values[CORE["protein_g"]] = "22.50"
        values["Total carbohydrate (g)"] = "999"
        result = self.service.list(query="鸡胸肉")["items"][0]
        self.assertIsNone(result["carbohydrate_g"])
        self.assertEqual(result["protein_g"], "22.50")
        self.assertEqual(result["fat_g"], "0")
        del values[CORE["fat_g"]]
        self.assertIsNone(self.service.list(query="鸡胸肉")["items"][0]["fat_g"])

    def test_unavailable_official_source_has_explicit_empty_status(self):
        self.db.release = None
        result = self.service.list()
        self.assertEqual(result["data_status"], "source_unavailable")
        self.assertEqual(result["items"], [])
        self.assertIsNone(result["source"])
        self.assertEqual(len(self.db.statements), 1)

    def test_missing_entry_keeps_available_foods_and_marks_partial_catalog(self):
        self.db.rows.pop()
        result = self.service.list(limit=100)
        self.assertEqual(result["data_status"], "partial_catalog")
        self.assertEqual(result["missing_food_count"], 1)
        self.assertEqual(result["total"], 27)

    def test_invalid_source_mapping_state_and_nutrient_value_fail_closed(self):
        for field, value in [
            ("basis", "per_100ml"), ("sources", {}),
            ("source_page", "https://example.com/synthetic"),
            ("core_mapping", {**CORE, "protein_g": "Synthetic protein (g)"}),
            ("core_mapping", None), ("nutrients", None), ("nutrients", [None]),
        ]:
            release, _ = fixtures()
            release.manifest[field] = value
            with self.subTest(field=field), self.assertRaises(HTTPException) as error:
                validate_release(release, food_config()["release"])
            self.assertEqual(error.exception.status_code, 503)
        self.db.rows[0].name = "Synthetic chicken, cooked"
        with self.assertRaises(HTTPException):
            self.service.list()
        for content in [None, [], {"food_key": "F002594", "name": "Chicken, breast, lean flesh, raw", "nutrients": []}]:
            release, rows = fixtures()
            rows[0].content = content
            with self.subTest(content=content), self.assertRaises(HTTPException) as error:
                TrainingFoodService(FakeDb(release, rows)).list()
            self.assertEqual(error.exception.status_code, 503)
        for value in [True, "NaN", "Infinity", "-1", "trace"]:
            release, rows = fixtures()
            rows[0].content["nutrients"][CORE["protein_g"]] = value
            with self.subTest(value=value), self.assertRaises(HTTPException):
                TrainingFoodService(FakeDb(release, rows)).list()

    def test_api_requires_login_is_read_only_and_validates_filters(self):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        with TestClient(app) as client:
            self.assertEqual(client.get("/training-foods").status_code, 401)
            app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
            self.assertEqual(client.get("/training-foods?category=dairy").status_code, 200)
            for query in ["category=recipes", "limit=0", "limit=101", "offset=-1", "query=" + "a" * 201]:
                with self.subTest(query=query):
                    self.assertEqual(client.get("/training-foods?" + query).status_code, 422)
            for method in ["post", "put", "delete"]:
                self.assertEqual(getattr(client, method)("/training-foods").status_code, 405)


SOURCE_FOLDER = Path(__file__).resolve().parents[2] / "tmp" / "afcd-release-3"


@unittest.skipUnless(
    (SOURCE_FOLDER / "nutrient-profiles.xlsx").exists() and importlib.util.find_spec("openpyxl"),
    "Offline official AFCD Release 3 workbooks and openpyxl required",
)
class OfficialTrainingFoodSourceTests(unittest.TestCase):
    def test_all_selected_identities_and_four_category_samples_match_official_workbooks(self):
        payload = parse_release(SOURCE_FOLDER)
        config = food_config()
        self.assertEqual(payload["fingerprint"], config["release"]["fingerprint"])
        self.assertEqual(payload["sources"], config["release"]["sources"])
        by_key = {f["food_key"]: f for f in payload["foods"]}
        for selected in config["foods"]:
            self.assertEqual(by_key[selected["food_key"]]["name"], selected["source_name"])
        # Independently read from the official per-100g (not per-100mL) sheet.
        expected = {
            "F002594": ("0", "22.5", "0.8"),  # Raw lean chicken breast
            "F002593": ("0", "29.8", "2.5"),  # Grilled lean chicken breast
            "F003721": ("0.7", "12.4", "9.4"),  # Hard-boiled whole egg
            "F005634": ("5.4", "3.3", "3.4"),  # Fluid whole milk, per 100g
            "F001900": ("1.2", "2.9", "0.3"),  # Boiled/drained broccoli
        }
        for key, values in expected.items():
            with self.subTest(food_key=key):
                self.assertEqual(tuple(by_key[key]["nutrients"][CORE[n]] for n in ["carbohydrate_without_sugar_alcohols_g", "protein_g", "fat_g"]), values)
