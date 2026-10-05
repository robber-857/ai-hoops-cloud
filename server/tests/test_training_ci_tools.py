"""Safety contracts for test preparation, without opening a database."""

from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace
import unittest

from tools.fetch_training_food_sources import pinned_config, verify_source
from tools.run_ci_tests import MINIMUM_TESTS, successful_without_skips
from tools.training_test_support import (
    E2E_DATABASE, REPO_ROOT, TMP_ROOT, UNIT_DATABASE,
    local_tmp_path, require_database_identity, test_database_url, test_service_url,
)


class TrainingTestToolGuards(unittest.TestCase):
    def test_only_explicit_test_environment_is_accepted(self):
        url = "postgresql+psycopg://test:synthetic@127.0.0.1:55439/ai_hoops_e2e_test"
        for environment in (None, "development", "production", "staging", "TEST"):
            with self.subTest(environment=environment), self.assertRaises(ValueError):
                test_database_url(url, environment, {E2E_DATABASE})
        with self.assertRaises(ValueError):
            test_database_url(None, "test", {E2E_DATABASE})
        self.assertEqual(test_database_url(url, "test", {E2E_DATABASE}).database, E2E_DATABASE)

    def test_remote_production_and_query_host_overrides_are_rejected(self):
        for url in (
            "postgresql+psycopg://test:synthetic@db.example.com/ai_hoops_e2e_test",
            "postgresql+psycopg://test:synthetic@127.0.0.1/ai_hoops",
            "postgresql+psycopg://test:synthetic@127.0.0.1/ai_hoops_e2e_test?host=db.example.com",
            "postgresql+psycopg://test:synthetic@127.0.0.1/ai_hoops_e2e_test?dbname=production",
            "postgresql://test:synthetic@127.0.0.1/ai_hoops_e2e_test",
            "sqlite:///ai_hoops_e2e_test",
        ):
            with self.subTest(url=url), self.assertRaises(ValueError):
                test_database_url(url, "test", {E2E_DATABASE})

    def test_unit_and_browser_databases_are_separate(self):
        unit = "postgresql+psycopg://test:synthetic@localhost/ai_hoops_p2_test"
        self.assertEqual(test_database_url(unit, "test", {UNIT_DATABASE}).database, UNIT_DATABASE)
        with self.assertRaises(ValueError):
            test_database_url(unit, "test", {E2E_DATABASE})

    def test_connected_database_identity_is_checked(self):
        connection = SimpleNamespace(scalar=lambda statement: "ai_hoops")
        with self.assertRaises(ValueError):
            require_database_identity(connection, E2E_DATABASE)
        connection.scalar = lambda statement: E2E_DATABASE
        require_database_identity(connection, E2E_DATABASE)

    def test_files_cannot_escape_checkout_tmp(self):
        self.assertEqual(local_tmp_path(TMP_ROOT / "fixture.json"), (TMP_ROOT / "fixture.json").resolve())
        for path in (REPO_ROOT / "fixture.json", TMP_ROOT, TMP_ROOT / ".." / ".env"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                local_tmp_path(path)

    def test_reserved_user_services_and_remote_urls_are_rejected(self):
        self.assertEqual(test_service_url("http://localhost:3123/"), "http://localhost:3123")
        self.assertEqual(test_service_url("http://127.0.0.1:8123/api/v1", api=True), "http://127.0.0.1:8123/api/v1")
        for url in ("http://localhost:3000", "https://localhost:3123", "http://example.com:3123", "http://localhost:3123?x=1"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                test_service_url(url)
        with self.assertRaises(ValueError):
            test_service_url("http://localhost:8000/api/v1", api=True)

    def test_official_sources_have_exact_file_hashes_and_sizes(self):
        release = pinned_config()["release"]
        self.assertEqual(release["name"], "AFCD Release 3")
        self.assertEqual(set(release["sources"]), {"food-details", "nutrient-profiles", "nutrient-details"})
        self.assertEqual(release["sources"]["food-details"]["sha256"], "69aa096c45cb0699db60a9c544442312e9ff09af587b99c42dc78bc26f689629")
        self.assertEqual(release["sources"]["nutrient-profiles"]["bytes"], 2107021)
        raw = b"synthetic byte-verification fixture"
        source = {"bytes": len(raw), "sha256": sha256(raw).hexdigest()}
        verify_source(raw, source, "synthetic")
        for modified in (raw[:-1], b"x" * len(raw)):
            with self.assertRaises(ValueError):
                verify_source(modified, source, "synthetic")

    def test_ci_rejects_skipped_empty_incomplete_or_failed_suites(self):
        def result(tests=MINIMUM_TESTS, skipped=(), passed=True):
            return SimpleNamespace(testsRun=tests, skipped=skipped, wasSuccessful=lambda: passed)

        self.assertTrue(successful_without_skips(result()))
        self.assertFalse(successful_without_skips(result(skipped=[("case", "missing database")])))
        self.assertFalse(successful_without_skips(result(tests=0)))
        self.assertFalse(successful_without_skips(result(tests=MINIMUM_TESTS - 1)))
        self.assertFalse(successful_without_skips(result(passed=False)))


if __name__ == "__main__":
    unittest.main()
