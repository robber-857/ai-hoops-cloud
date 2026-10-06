import os
import unittest
from uuid import uuid4, UUID
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, select, func
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from app.main import create_app
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.enums import UserRole
from app.models.food_catalog import FoodRelease, FoodEntry
from app.models.recipe import RecipePublication
from app.schemas.recipe import RecipeContent, RecipeCreate, RecipeUpdate
from app.services.recipe_service import RecipeService, calculate
from app.services.afcd_import import CORE


def recipe_data(release_id=1):
    return dict(
        title="Synthetic cooked beans",
        instructions="Test recipe instructions",
        servings="2",
        finished_weight_grams="300",
        ingredients=[
            dict(
                release_id=release_id,
                food_key="F000001",
                edible_grams="150",
                preparation_note="Cooked edible portion",
            )
        ],
        allergens=["Soy"],
        allergens_reviewed=True,
    )


def amounts(fibre="4"):
    return dict(
        energy_with_fibre_kj="418.4",
        protein_g="10",
        fat_g="0",
        carbohydrate_without_sugar_alcohols_g="15",
        fibre_g=fibre,
        sugars_g="2",
        sodium_mg="100",
    )


class RecipeCalculationTests(unittest.TestCase):
    def test_150g_two_servings_finished_weight_and_official_energy(self):
        content = RecipeContent(**recipe_data())
        result = calculate(content, [{"edible_grams": "150", "per_100g": amounts()}])
        energy = result["nutrients"]["energy_kcal"]
        self.assertEqual(energy["total"], "150.00")
        self.assertEqual(energy["per_serving"], "75.00")
        self.assertEqual(energy["per_100g_finished"], "50.00")
        self.assertEqual(result["nutrients"]["protein_g"]["total"], "15.00")
        self.assertEqual(result["nutrients"]["fat_g"]["total"], "0.00")
        self.assertEqual(result["serving_weight_grams"], "150.00")

    def test_missing_is_not_zero_and_absent_yield_not_guessed(self):
        data = recipe_data()
        data["finished_weight_grams"] = None
        result = calculate(
            RecipeContent(**data),
            [
                {"edible_grams": "100", "per_100g": amounts(None)},
                {"edible_grams": "50", "per_100g": amounts()},
            ],
        )
        fibre = result["nutrients"]["fibre_g"]
        self.assertIsNone(fibre["total"])
        self.assertIsNone(fibre["per_serving"])
        self.assertEqual(fibre["known_subtotal"], "2.00")
        self.assertEqual(fibre["missing_ingredient_indexes"], [0])
        self.assertIsNone(result["nutrients"]["protein_g"]["per_100g_finished"])

    def test_bounds_duplicates_and_nonfinite_rejected(self):
        for field in ["servings", "finished_weight_grams"]:
            for value in ["0", "-1", "NaN", "Infinity", "1.001"]:
                with self.subTest(field=field, value=value), self.assertRaises(
                    ValidationError
                ):
                    RecipeContent(**{**recipe_data(), field: value})
        data = recipe_data()
        data["ingredients"] *= 2
        with self.assertRaises(ValidationError):
            RecipeContent(**data)
        for value in ["0", "-1", "NaN", "Infinity", "1.001"]:
            data = recipe_data()
            data["ingredients"][0]["edible_grams"] = value
            with self.assertRaises(ValidationError):
                RecipeContent(**data)


@unittest.skipUnless(
    os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL"), "Dedicated PostgreSQL required"
)
class RecipeDatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = make_url(os.environ["PLAYER_PROFILE_TEST_DATABASE_URL"])
        if (
            url.host not in ("localhost", "127.0.0.1")
            or url.database != "ai_hoops_p2_test"
        ):
            raise RuntimeError("Dedicated test database required")
        cls.engine = create_engine(url)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        self.db = Session(self.engine)
        self.admin = User(
            username=uuid4().hex,
            email=f"{uuid4().hex}@example.com",
            role=UserRole.admin,
            password_hash="unused",
        )
        self.student = User(
            username=uuid4().hex,
            email=f"{uuid4().hex}@example.com",
            role=UserRole.student,
            password_hash="unused",
        )
        self.db.add_all([self.admin, self.student])
        self.release = FoodRelease(
            name="Synthetic " + str(uuid4()),
            fingerprint=uuid4().hex + uuid4().hex,
            manifest={
                "core_mapping": CORE,
                "attribution": "Synthetic fixture",
                "sources": {},
                "source_page": "https://example.com",
                "licence_url": "https://example.com",
            },
        )
        self.db.add(self.release)
        self.db.flush()
        self.food = FoodEntry(
            release_id=self.release.id,
            food_key="F000001",
            name="Synthetic beans, cooked",
            content={
                "details": {"Food Description": "Synthetic cooked edible beans"},
                "nutrients": {CORE[k]: v for k, v in amounts().items()},
            },
        )
        self.db.add(self.food)
        self.db.commit()
        self.service = RecipeService(self.db)
        self.payload = RecipeCreate(request_id=uuid4(), **recipe_data(self.release.id))

    def tearDown(self):
        self.db.close()

    def create(self):
        return self.service.create(self.admin, self.payload)

    def test_publish_revision_and_portions_keep_previous_snapshot(self):
        created = self.create()
        key = UUID(created["public_id"])
        published = self.service.publish(self.admin, key, 1)
        self.assertEqual(
            published["nutrition"]["nutrients"]["protein_g"]["per_serving"], "7.50"
        )
        update = RecipeUpdate(
            expected_version=1,
            **{
                **recipe_data(self.release.id),
                "title": "Second title",
                "servings": "3",
            },
        )
        saved = self.service.update(self.admin, key, update)
        self.assertEqual(saved["version"], 2)
        self.assertEqual(
            self.service.published(key)["content"]["title"], "Synthetic cooked beans"
        )
        second = self.service.publish(self.admin, key, 2)
        self.assertEqual(
            second["nutrition"]["nutrients"]["protein_g"]["per_serving"], "5.00"
        )
        self.assertEqual(self.service.published(key, 1), published)
        preview = self.service.published(key, 1, Decimal("1.5"))["portion_preview"]
        self.assertEqual(preview["nutrients"]["protein_g"]["amount"], "11.25")
        self.assertEqual(preview["weight_grams"], "225.00")
        self.assertEqual(self.service.publish(self.admin, key, 1), published)
        self.assertEqual(
            self.db.scalar(
                select(func.count())
                .select_from(RecipePublication)
                .where(RecipePublication.recipe_id == self.service._recipe(key).id)
            ),
            2,
        )

    def test_source_change_cannot_drift_published_report(self):
        key = UUID(self.create()["public_id"])
        original = self.service.publish(self.admin, key, 1)
        self.food.content = {
            **self.food.content,
            "nutrients": {CORE[k]: "999" for k in amounts()},
        }
        self.db.commit()
        self.assertEqual(self.service.published(key), original)

    def test_idempotent_create_update_and_conflict(self):
        key = UUID(self.create()["public_id"])
        self.assertEqual(self.create()["public_id"], str(key))
        update = RecipeUpdate(
            expected_version=1, **{**recipe_data(self.release.id), "title": "Changed"}
        )
        self.service.update(self.admin, key, update)
        self.assertEqual(self.service.update(self.admin, key, update)["version"], 2)
        with self.assertRaises(HTTPException) as err:
            self.service.update(
                self.admin, key, update.model_copy(update={"title": "Conflict"})
            )
        self.assertEqual(err.exception.status_code, 409)
        self.db.rollback()
        with self.assertRaises(HTTPException):
            self.service.create(
                self.admin, self.payload.model_copy(update={"title": "Reused request"})
            )

    def test_concurrent_publication_returns_one_snapshot(self):
        key = UUID(self.create()["public_id"])
        admin_id = self.admin.id
        self.db.rollback()

        def publish(_):
            with Session(self.engine) as db:
                return RecipeService(db).publish(db.get(User, admin_id), key, 1)[
                    "publication_id"
                ]

        with ThreadPoolExecutor(max_workers=2) as pool:
            ids = list(pool.map(publish, range(2)))
        self.assertEqual(ids[0], ids[1])

    def test_api_auth_search_visibility_and_write_permissions(self):
        app = create_app()
        app.dependency_overrides[get_db] = lambda: self.db
        with TestClient(app) as client:
            self.assertEqual(client.get("/api/v1/recipes").status_code, 401)
            self.assertEqual(client.get("/api/v1/foods").status_code, 401)
            app.dependency_overrides[get_current_user] = lambda: self.student
            self.assertEqual(
                client.post(
                    "/api/v1/admin/recipes", json=self.payload.model_dump(mode="json")
                ).status_code,
                403,
            )
            found = client.get(
                "/api/v1/foods",
                params={"release_id": self.release.id, "query": "cooked"},
            )
            self.assertEqual(found.status_code, 200)
            self.assertEqual(found.json()["items"][0]["name"], self.food.name)
            self.assertEqual(
                client.get(
                    "/api/v1/foods",
                    params={"release_id": self.release.id, "query": "%"},
                ).json()["items"],
                [],
            )
            app.dependency_overrides[get_current_user] = lambda: self.admin
            created = client.post(
                "/api/v1/admin/recipes", json=self.payload.model_dump(mode="json")
            )
            self.assertEqual(created.status_code, 201)
            key = created.json()["public_id"]
            app.dependency_overrides[get_current_user] = lambda: self.student
            self.assertEqual(
                client.get(f"/api/v1/admin/recipes/{key}").status_code, 403
            )
            self.assertEqual(client.get(f"/api/v1/recipes/{key}").status_code, 404)
            app.dependency_overrides[get_current_user] = lambda: self.admin
            self.assertEqual(
                client.post(
                    f"/api/v1/admin/recipes/{key}/publish", json={"expected_version": 1}
                ).status_code,
                200,
            )
            app.dependency_overrides[get_current_user] = lambda: self.student
            self.assertEqual(client.get(f"/api/v1/recipes/{key}").status_code, 200)
            for servings in ["0", "NaN", "Infinity", "-1"]:
                self.assertEqual(
                    client.get(
                        f"/api/v1/recipes/{key}", params={"servings": servings}
                    ).status_code,
                    422,
                )
            listed = client.get("/api/v1/recipes", params={"limit": 100}).json()
            self.assertTrue(any(r["public_id"] == key for r in listed["items"]))

    def test_invalid_food_does_not_create_recipe(self):
        bad = self.payload.model_copy(deep=True)
        bad.ingredients[0].food_key = "F999999"
        with self.assertRaises(HTTPException) as err:
            self.service.create(self.admin, bad)
        self.assertEqual(err.exception.status_code, 422)

        self.assertNotIn("F999999", err.exception.detail)
        self.assertIn("Ingredient 1", err.exception.detail)
        self.assertIn("select a food again", err.exception.detail)

    def test_concurrent_edits_reject_stale_content(self):
        key = UUID(self.create()["public_id"])
        admin_id, release_id = self.admin.id, self.release.id
        self.db.rollback()

        def edit(title):
            with Session(self.engine) as db:
                try:
                    return RecipeService(db).update(
                        db.get(User, admin_id),
                        key,
                        RecipeUpdate(
                            expected_version=1,
                            **{**recipe_data(release_id), "title": title},
                        ),
                    )["version"]
                except HTTPException as exc:
                    return exc.status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(edit, ["Edit one", "Edit two"]))
        self.assertEqual(sorted(results), [2, 409])

    def test_distinct_food_states_and_fresh_session_publication_read(self):
        raw = FoodEntry(
            release_id=self.release.id,
            food_key="F000002",
            name="Synthetic beans, raw",
            content={"details": {}, "nutrients": {CORE[k]: "20" for k in amounts()}},
        )
        self.db.add(raw)
        self.db.commit()
        payload = self.payload.model_copy(deep=True)
        payload.ingredients.append(
            payload.ingredients[0].model_copy(
                update={"food_key": "F000002", "edible_grams": Decimal("100")}
            )
        )
        created = self.service.create(self.admin, payload)
        key = UUID(created["public_id"])
        saved = self.service.publish(self.admin, key, 1)
        self.assertEqual(
            [i["name"] for i in saved["ingredients"]],
            ["Synthetic beans, cooked", "Synthetic beans, raw"],
        )
        self.assertEqual(saved["nutrition"]["nutrients"]["protein_g"]["total"], "35.00")
        with Session(self.engine) as fresh:
            service = RecipeService(fresh)
            self.assertEqual(service.published(key), saved)
            self.assertEqual(service.versions(key, 1, 0)["items"][0]["version"], 1)
            self.assertEqual(service.versions(key, 1, 1)["items"], [])
