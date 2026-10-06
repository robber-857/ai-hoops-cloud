"""Run the entire backend unittest suite and fail on every skipped test."""

import os
from pathlib import Path
import sys
import unittest

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.training_test_support import SERVER_ROOT, UNIT_DATABASE, test_database_url

MINIMUM_TESTS = 198  # Baseline 190 + eight persisted language/validation regressions.


def successful_without_skips(result) -> bool:
    return result.wasSuccessful() and not result.skipped and result.testsRun >= MINIMUM_TESTS


def main() -> int:
    configured = os.environ.get("DATABASE_URL")
    test_database_url(configured, os.environ.get("APP_ENV"), {UNIT_DATABASE})
    if os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL") != configured:
        raise ValueError("Both backend database environment variables must point to the same dedicated test DB.")
    suite = unittest.defaultTestLoader.discover(str(SERVER_ROOT / "tests"), pattern="test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(f"Strict CI result: tests={result.testsRun}, skipped={len(result.skipped)}, "
          f"failures={len(result.failures)}, errors={len(result.errors)}")
    if not successful_without_skips(result):
        print(f"CI requires the complete backend suite (at least {MINIMUM_TESTS} tests) with zero skips.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as exc:
        print(f"Backend CI refused: {exc}", file=sys.stderr)
        raise SystemExit(1)
