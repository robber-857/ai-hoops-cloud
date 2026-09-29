"""Run from server: python -m app.import_afcd --source-dir ../tmp/afcd-release-3."""

import argparse
import json
import os
from pathlib import Path
from app.services.afcd_import import parse_release, preview


def main():
    parser = argparse.ArgumentParser(
        description="Validate AFCD Release 3. Default is preview only; no database connection."
    )
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Import using explicit AFCD_IMPORT_DATABASE_URL; never uses application DATABASE_URL",
    )
    parser.add_argument(
        "--expect-fingerprint",
        help="Required with --commit; copy from reviewed preview",
    )
    args = parser.parse_args()
    try:
        payload = parse_release(args.source_dir)
        result = preview(payload)
        if args.commit:
            if args.expect_fingerprint != payload["fingerprint"]:
                parser.error(
                    "--commit requires the exact --expect-fingerprint from the preview"
                )
            url = os.environ.get("AFCD_IMPORT_DATABASE_URL")
            if not url:
                parser.error("Set AFCD_IMPORT_DATABASE_URL explicitly")
            from sqlalchemy import create_engine
            from sqlalchemy.orm import Session
            from app.services.food_catalog_service import import_release

            engine = create_engine(url)
            try:
                with Session(engine) as db:
                    result["database"] = import_release(db, payload)
            finally:
                engine.dispose()
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, OSError) as exc:
        parser.exit(1, f"AFCD import failed: {exc}\n")


if __name__ == "__main__":
    main()
