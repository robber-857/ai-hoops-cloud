import io
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

from app.schemas.training_assistant import AssistantResponse
from tools import eval_training_assistant as evaluation


class CoachEvaluationTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(evaluation.coach.settings, "training_assistant_model", evaluation.MODEL))
        self.output = self.enterContext(redirect_stdout(io.StringIO()))

    def test_default_exercises_all_cases_without_network_or_database(self):
        with patch("urllib.request.OpenerDirector.open", side_effect=AssertionError("unexpected network")), \
             patch("sqlalchemy.engine.Engine.connect", side_effect=AssertionError("unexpected database connection")):
            self.assertEqual(evaluation.main([]), 0)
        self.assertIn("offline request and response fixtures", self.output.getvalue())
        self.assertIn("5/5 automated checks passed", self.output.getvalue())

    def test_live_requires_the_assistant_key_and_the_expected_model(self):
        with patch.object(evaluation.coach, "urlopen") as provider:
            with patch.object(evaluation.coach.settings, "training_assistant_api_key", None):
                self.assertEqual(evaluation.main(["--live"]), 2)
            with patch.object(evaluation.coach.settings, "training_assistant_model", "other-model"):
                self.assertEqual(evaluation.main(["--live"]), 2)
            provider.assert_not_called()

    def test_a_stale_report_score_fails_the_business_check(self):
        case = next(case for case in evaluation.CASES if case.name == "report")
        reply = AssistantResponse(answer="Your latest score was 61.", recommendations=[])
        self.assertTrue(evaluation.check_reply(case, reply))
