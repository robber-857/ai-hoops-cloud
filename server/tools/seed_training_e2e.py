"""Append random synthetic UI fixtures to the isolated E2E database only.

Run from server with APP_ENV=test and explicit DATABASE_URL:
  python -m tools.seed_training_e2e --output ../tmp/training-e2e-fixture.json

Requires an already migrated ai_hoops_e2e_test database and verified official
AFCD files. Never creates lessons, body measurements or training start dates;
the browser performs those actions. No fixed passwords, deletes or production
connections. Fixture credentials stay in a new local tmp file.
"""

import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import secrets
import sys
from uuid import uuid4
from zoneinfo import ZoneInfo

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.fetch_training_food_sources import SOURCE_DIR, verified_release
from tools.training_test_support import (
    E2E_DATABASE, local_tmp_path, require_database_identity,
    require_migrated_schema, test_database_url, test_service_url,
)


def seed(url, payload: dict, base_url: str, api_url: str):
    url = test_database_url(url, os.environ.get("APP_ENV"), {E2E_DATABASE})
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.core.security import hash_password
    from app.models import CampClass, ClassMember, TrainingCamp, User
    from app.models.enums import UserRole, UserStatus
    from app.schemas.camp_plan import PlanCreate
    from app.services.camp_plan_service import CampPlanService
    from app.services.food_catalog_service import import_release
    from app.services.training_food_service import TrainingFoodService

    engine = create_engine(url)
    namespace = secrets.token_hex(8)
    accounts = {}
    try:
        with engine.connect() as connection:
            require_database_identity(connection, E2E_DATABASE)
            require_migrated_schema(connection)
        with Session(engine) as db:
            imported = import_release(db, payload)
            catalog = TrainingFoodService(db).list(limit=100)
            if catalog["data_status"] != "ready" or len(catalog["items"]) != 28:
                raise ValueError("E2E requires all 28 pinned official food entries.")
        with Session(engine) as db:
            users = {}
            for label, role in (("coach", UserRole.coach), ("parent", UserRole.student), ("peer", UserRole.student)):
                username = f"e2e_{namespace}_{label}"
                password = secrets.token_urlsafe(24)
                display_name = f"E2E {label.title()} {namespace}"
                user = User(
                    username=username, password_hash=hash_password(password),
                    email=f"{username}@example.com", nickname=display_name,
                    role=role, status=UserStatus.active, is_email_verified=True,
                )
                db.add(user)
                db.flush()
                users[label] = user
                accounts[label] = {
                    "username": username, "password": password,
                    "public_id": str(user.public_id), "display_name": display_name,
                }
            camp = TrainingCamp(name=f"E2E Camp {namespace}", code=f"e2e_{namespace}")
            db.add(camp)
            db.flush()
            klass = CampClass(camp_id=camp.id, name=f"E2E Class {namespace}", code=f"e2e_{namespace}")
            db.add(klass)
            db.flush()
            for label, member_role in (("coach", "coach"), ("parent", "student"), ("peer", "student")):
                db.add(ClassMember(class_id=klass.id, user_id=users[label].id, member_role=member_role))
            db.commit()
            today = datetime.now(ZoneInfo("Australia/Sydney")).date()
            service = CampPlanService(db)
            plan = service.create(users["coach"], klass.public_id, PlanCreate(
                request_id=uuid4(), title=f"E2E Training Plan {namespace}",
                planned_on=today, focus="basketball",
                items=[
                    {"name": "Warm up", "duration_minutes": 10},
                    {"name": "Basketball game", "duration_minutes": 20},
                ],
            ))
            published = service.publish(users["coach"], klass.public_id, plan.public_id, plan.version)
            return {
                "namespace": namespace, "base_url": base_url, "api_url": api_url,
                "accounts": accounts,
                "class": {"public_id": str(klass.public_id), "name": klass.name},
                "plan": {
                    "public_id": str(published.public_id), "title": published.title,
                    "planned_on": published.planned_on.isoformat(),
                    "items": [item.model_dump(mode="json") for item in published.items],
                },
                "baseline": {"date_of_birth": None, "body_measurements": [], "training_started_on": None},
                "suggested_inputs": {"date_of_birth": "2014-01-01"},
                "food_source": {
                    "name": payload["release"], "fingerprint": payload["fingerprint"],
                    "foods": imported["foods"], "selected_foods": len(catalog["items"]),
                },
            }
    finally:
        engine.dispose()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIR)
    parser.add_argument("--base-url", default="http://127.0.0.1:3123")
    parser.add_argument("--api-url", default="http://127.0.0.1:8123/api/v1")
    args = parser.parse_args(argv)
    url = test_database_url(os.environ.get("DATABASE_URL"), os.environ.get("APP_ENV"), {E2E_DATABASE})
    output = local_tmp_path(args.output)
    if output.suffix != ".json" or output.exists():
        raise ValueError("Choose a new .json fixture path inside tmp; existing files are never overwritten.")
    base_url = test_service_url(args.base_url)
    api_url = test_service_url(args.api_url, api=True)
    payload = verified_release(args.source_dir)
    output.parent.mkdir(parents=True, exist_ok=True)
    # Reserve the output before database writes. The fixture has no Git/CI artifact
    # destination and POSIX permissions are restricted where supported.
    descriptor = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as fixture_file:
            fixture = seed(url, payload, base_url, api_url)
            json.dump(fixture, fixture_file, ensure_ascii=False, indent=2)
            fixture_file.write("\n")
    except Exception:
        output.unlink(missing_ok=True)
        raise
    print(json.dumps({"fixture": str(output), "namespace": fixture["namespace"]}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as exc:
        print(f"E2E seed refused: {exc}", file=sys.stderr)
        raise SystemExit(1)
