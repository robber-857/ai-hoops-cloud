from hashlib import sha256
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.models.food_catalog import FoodRelease, FoodEntry
from app.services.afcd_import import canonical_bytes, ImportValidationError


def import_release(db: Session, payload: dict):
    """One transaction; concurrent/repeated imports cannot overwrite a release."""
    fingerprint = payload["fingerprint"]
    body = {k: v for k, v in payload.items() if k != "fingerprint"}
    if sha256(canonical_bytes(body)).hexdigest() != fingerprint:
        raise ImportValidationError("Payload fingerprint mismatch")
    with db.begin():
        db.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:name, 0))"),
            {"name": payload["release"]},
        )
        existing = db.scalar(
            select(FoodRelease).where(FoodRelease.name == payload["release"])
        )
        if existing:
            if existing.fingerprint != fingerprint:
                raise ImportValidationError(
                    "Release already exists with different source/content. Existing foods were not changed."
                )
            rows = db.scalars(
                select(FoodEntry)
                .where(FoodEntry.release_id == existing.id)
                .order_by(FoodEntry.food_key)
            ).all()
            actual = {**existing.manifest, "foods": [r.content for r in rows]}
            if sha256(canonical_bytes(actual)).hexdigest() != fingerprint:
                raise ImportValidationError("Stored release integrity check failed")
            result = {
                "status": "unchanged",
                "release_id": existing.id,
                "foods": len(rows),
            }
        else:
            release = FoodRelease(
                name=payload["release"],
                fingerprint=fingerprint,
                manifest={k: v for k, v in body.items() if k != "foods"},
            )
            db.add(release)
            db.flush()
            db.add_all(
                [
                    FoodEntry(
                        release_id=release.id,
                        food_key=f["food_key"],
                        name=f["name"],
                        content=f,
                    )
                    for f in payload["foods"]
                ]
            )
            result = {
                "status": "imported",
                "release_id": release.id,
                "foods": len(payload["foods"]),
            }
    return result
