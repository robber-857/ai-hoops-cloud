"""Verify a fresh migration to the expected head on a disposable database only.

Refuses populated schemas, dotenv defaults, production environments and remote
hosts. Does not create/drop databases, downgrade migrations, or delete data.
Run from server: python -m tools.migrate_training_test_db
"""

import os
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.training_test_support import (
    E2E_DATABASE, EXPECTED_REVISION, SERVER_ROOT, UNIT_DATABASE,
    require_database_identity, require_migrated_schema, test_database_url,
)


def main() -> int:
    from alembic import command
    from alembic.config import Config
    from alembic.migration import MigrationContext
    from alembic.script import ScriptDirectory
    from sqlalchemy import create_engine, inspect

    url = test_database_url(
        os.environ.get("DATABASE_URL"), os.environ.get("APP_ENV"),
        {UNIT_DATABASE, E2E_DATABASE},
    )
    config = Config(str(SERVER_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(SERVER_ROOT / "alembic"))
    if ScriptDirectory.from_config(config).get_heads() != [EXPECTED_REVISION]:
        raise ValueError("Update the migration test contract for the new schema head.")
    engine = create_engine(url)
    try:
        with engine.connect() as connection:
            require_database_identity(connection, url.database)
            heads = MigrationContext.configure(connection).get_current_heads()
            tables = set(inspect(connection).get_table_names(schema="public"))
            if heads or tables - {"alembic_version"}:
                raise ValueError("Base migration validation requires an empty dedicated test schema.")
        command.upgrade(config, EXPECTED_REVISION)
        with engine.connect() as connection:
            require_database_identity(connection, url.database)
            require_migrated_schema(connection)
        print(f"Verified base -> {EXPECTED_REVISION} on {url.database}.")
        return 0
    finally:
        engine.dispose()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as exc:
        print(f"Test migration refused: {exc}", file=sys.stderr)
        raise SystemExit(1)
