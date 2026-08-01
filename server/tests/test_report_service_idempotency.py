from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.report_service import ReportService, _template_snapshot_from_version


class _ScalarResult:
    def __init__(self, items: list[SimpleNamespace]) -> None:
        self._items = items

    def all(self) -> list[SimpleNamespace]:
        return self._items


class _FakeSession:
    def __init__(self, reports: list[SimpleNamespace]) -> None:
        self.reports = reports
        self.added: list[object] = []

    def scalars(self, _statement) -> _ScalarResult:
        return _ScalarResult(self.reports)

    def add(self, item: object) -> None:
        self.added.append(item)


class ReportServiceIdempotencyTests(unittest.TestCase):
    def test_template_snapshot_uses_the_locked_version_rules(self) -> None:
        raw_template = {
            "templateId": "deep_squat_reps_side",
            "mode": "training",
            "camera": "side",
            "displayName": "Historical Squat",
            "metrics": [{"metricId": "E_rep_rhythm"}],
        }
        version = SimpleNamespace(
            scoring_rules={
                "content_hash": "historical-hash",
                "template": raw_template,
            }
        )

        snapshot = _template_snapshot_from_version(
            version,  # type: ignore[arg-type]
            template_code="deep_squat_reps_side",
            template_version="v1",
        )

        self.assertIsNotNone(snapshot)
        assert snapshot is not None
        self.assertEqual(snapshot["version"], "v1")
        self.assertEqual(snapshot["contentHash"], "historical-hash")
        self.assertEqual(snapshot["metrics"], [{"metricId": "E_rep_rhythm"}])
        snapshot["metrics"].append({"metricId": "new"})
        self.assertEqual(raw_template["metrics"], [{"metricId": "E_rep_rhythm"}])

    def test_task_assignment_progress_counts_each_training_session_once(self) -> None:
        first_report_at = datetime(2026, 4, 29, 10, tzinfo=timezone.utc)
        latest_report_at = datetime(2026, 4, 30, 10, tzinfo=timezone.utc)
        reports = [
            SimpleNamespace(
                id=1,
                session_id=100,
                overall_score=70,
                analysis_finished_at=first_report_at,
                created_at=first_report_at,
            ),
            SimpleNamespace(
                id=2,
                session_id=100,
                overall_score=88,
                analysis_finished_at=latest_report_at,
                created_at=latest_report_at,
            ),
            SimpleNamespace(
                id=3,
                session_id=101,
                overall_score=76,
                analysis_finished_at=first_report_at,
                created_at=first_report_at,
            ),
        ]
        assignment = SimpleNamespace(
            id=10,
            task=SimpleNamespace(target_config={"target_sessions": 2, "target_score": 85}),
            completed_sessions=99,
            last_submission_at=None,
            latest_report_id=None,
            best_score=None,
            progress_percent=None,
            status="pending",
            completed_at=None,
        )

        db = _FakeSession(reports)
        service = ReportService(db)  # type: ignore[arg-type]

        service._update_task_assignment(assignment)  # noqa: SLF001

        self.assertEqual(assignment.completed_sessions, 2)
        self.assertEqual(assignment.latest_report_id, 2)
        self.assertEqual(assignment.last_submission_at, latest_report_at)
        self.assertEqual(assignment.best_score, 88)
        self.assertEqual(assignment.progress_percent, 100)
        self.assertEqual(assignment.status, "completed")
        self.assertEqual(assignment.completed_at, latest_report_at)
        self.assertEqual(db.added, [assignment])


if __name__ == "__main__":
    unittest.main()
