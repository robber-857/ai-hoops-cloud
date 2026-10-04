"""Shared guards for disposable training CI databases and local test files."""

from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy.engine import make_url

REPO_ROOT = Path(__file__).resolve().parents[2]
SERVER_ROOT = REPO_ROOT / "server"
TMP_ROOT = REPO_ROOT / "tmp"
UNIT_DATABASE = "ai_hoops_p2_test"
E2E_DATABASE = "ai_hoops_e2e_test"
EXPECTED_REVISION = "20261003_0012"


def test_database_url(database_url: str | None, app_env: str | None, allowed_names):
    """Validate explicit configuration before opening any connection.

    This intentionally does not load dotenv files or fall back to application
    defaults. Query options can change libpq's actual host/database and are
    therefore forbidden here, even when the URL's visible host looks safe.
    """
    if app_env != "test" or not database_url:
        raise ValueError("Set APP_ENV=test and an explicit DATABASE_URL.")
    url = make_url(database_url)
    if (
        url.drivername != "postgresql+psycopg"
        or url.host not in ("localhost", "127.0.0.1")
        or url.database not in allowed_names
        or url.query
    ):
        raise ValueError("Only an allowlisted loopback PostgreSQL test database is permitted.")
    return url


def local_tmp_path(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_relative_to(TMP_ROOT.resolve()) or resolved == TMP_ROOT.resolve():
        raise ValueError("Test files must be inside this checkout's tmp directory.")
    return resolved


def test_service_url(value: str, *, api: bool = False) -> str:
    parsed = urlsplit(value)
    expected_port = 8123 if api else 3123
    if (
        parsed.scheme != "http"
        or parsed.hostname not in ("127.0.0.1", "localhost")
        or parsed.port != expected_port
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.path.rstrip("/") != ("/api/v1" if api else "")
    ):
        raise ValueError(f"Use the isolated loopback test service on port {expected_port}.")
    return value.rstrip("/")


def require_database_identity(connection, expected_name: str) -> None:
    from sqlalchemy import text

    if connection.scalar(text("SELECT current_database()")) != expected_name:
        raise ValueError("The connected database does not match the test allowlist.")


def require_migrated_schema(connection) -> None:
    from alembic.migration import MigrationContext
    from sqlalchemy import inspect

    if MigrationContext.configure(connection).get_current_heads() != (EXPECTED_REVISION,):
        raise ValueError(f"Test database must be migrated to {EXPECTED_REVISION}.")
    schema = inspect(connection)
    required_tables = {
        "users", "training_camps", "camp_classes", "class_members",
        "camp_plans", "camp_lessons", "camp_lesson_revisions",
        "player_profile_revisions", "food_releases", "food_entries",
    }
    if not required_tables.issubset(schema.get_table_names(schema="public")):
        raise ValueError("The migrated training/food schema is incomplete.")
    columns = {column["name"]: column for column in schema.get_columns("users", schema="public")}
    training_start = columns.get("training_started_on")
    if training_start is None or not training_start["nullable"]:
        raise ValueError("The nullable training start date migration is missing.")
