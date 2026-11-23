import io
import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException

from app.core.config import Settings
from app.models.enums import UserRole
from app.schemas.training_assistant import AssistantRecommendation, AssistantRequest
from app.services import training_assistant as coach


class TrainingAssistantCoachingTests(unittest.TestCase):
    def setUp(self):
        self.db = Mock()
        self.service = coach.TrainingAssistant(self.db)
        self.player = SimpleNamespace(id=12, role=UserRole.student)
        self.links = {
            "task-1": AssistantRecommendation(title="Left hand work", kind="task", href="/me/tasks#task-one"),
            **{
                f"exercise-{i}": AssistantRecommendation(title=title, kind="exercise", href=f"/pose-2d/dribbling?templateCode={i}")
                for i, title in enumerate(("Low dribble", "Crossover", "V dribble", "Hip-high dribble"), 1)
            },
        }
        self.enterContext(patch.object(coach.settings, "training_assistant_api_key", "synthetic-test-key"))
        self.enterContext(patch.object(coach, "_reserve_request"))
        self.enterContext(patch.object(self.service, "_context", return_value=({}, self.links)))
        self.provider = self.enterContext(patch.object(coach, "urlopen"))

    def reply(self, question, answer, intent, pairs, request_quote="", *, priorities=(), **kwargs):
        provider_text = json.dumps({
            "answer": answer,
            "intent": intent,
            "request_quote": request_quote,
            "recommendations": [{"id": key, "answer_quote": quote} for key, quote in pairs],
            "training_priorities": priorities,
        }, ensure_ascii=False)
        self.provider.return_value = io.BytesIO(json.dumps({
            "status": "completed",
            "output": [{"type": "message", "content": [{"type": "output_text", "text": provider_text}]}],
        }).encode())
        request = AssistantRequest(messages=[{"role": "user", "content": question}])
        return self.service.answer(self.player, request, **kwargs)

    def test_default_luna_request_reserves_the_output_budget_for_the_structured_reply(self):
        with patch.dict("os.environ", {}, clear=True):
            model = Settings(_env_file=None).training_assistant_model
        self.assertEqual(model, "gpt-6-luna")
        with patch.object(coach.settings, "training_assistant_model", model):
            self.reply("What is a screen?", "A screen creates room.", "discussion", [])
        sent = json.loads(self.provider.call_args.args[0].data)
        self.assertEqual(sent["model"], model)
        self.assertEqual(sent["reasoning"], {"effort": "none"})
        self.assertEqual(sent["max_output_tokens"], 850)
        self.assertTrue(sent["text"]["format"]["strict"])
        self.assertFalse(sent["store"])

    def test_model_override_preserves_compatibility_with_non_reasoning_models(self):
        with patch.dict("os.environ", {"TRAINING_ASSISTANT_MODEL": "gpt-4.1-mini"}):
            model = Settings(_env_file=None).training_assistant_model
        with patch.object(coach.settings, "training_assistant_model", model):
            self.reply("What is a screen?", "A screen creates room.", "discussion", [])
        sent = json.loads(self.provider.call_args.args[0].data)
        self.assertEqual(sent["model"], "gpt-4.1-mini")
        self.assertNotIn("reasoning", sent)

    def test_tactics_discussion_stays_text_only_even_when_a_drill_is_mentioned(self):
        answer = "In drop coverage the defender can stay below the screen. Watch the guard’s pull-up space."
        result = self.reply("Why would an NBA team drill drop coverage?", answer, "discussion",
                            [("exercise-1", "drop coverage")])
        self.assertEqual(result.answer, answer)
        self.assertEqual(result.recommendations, [])

    def test_chinese_skill_coaching_selects_one_personal_task_with_evidence_in_the_reply(self):
        answer = "先按教练的左手任务练习。屈膝后让球在膝盖附近反弹，再试一次变向。"
        result = self.reply("左手运球怎么练？", answer, "guided_practice", [
            ("not-this-players-task", "屈膝"), ("exercise-1", "文中没有的动作"),
            ("task-1", "按教练的左手任务练习"), ("exercise-2", "再试一次变向"),
        ])
        self.assertEqual(result.recommendations, [self.links["task-1"]])

    def test_explicit_drill_list_only_links_distinct_answer_passages_and_resolves_at_most_three(self):
        answer = "Stay low for low dribbles. Change direction with a crossover. Bring a V dribble back. Finish at hip height."
        result = self.reply("Show me four ball-handling drills.", answer, "requested_drill_list", [
            ("exercise-1", "Stay low for low dribbles"), ("exercise-1", "low dribbles"),
            ("exercise-2", "Stay low for low dribbles"), ("exercise-2", "Change direction with a crossover"),
            ("exercise-3", "Bring a V dribble back"), ("exercise-4", "Finish at hip height"),
        ], request_quote="four ball-handling drills")
        self.assertEqual(result.recommendations, [self.links[f"exercise-{i}"] for i in (1, 2, 3)])

    def test_invented_request_for_multiple_drills_cannot_attach_cards(self):
        result = self.reply("能解释一下上面第三步吗？", "第三步是变向。", "requested_drill_list",
                            [("exercise-2", "变向")], request_quote="请给我三个练习")
        self.assertEqual(result.recommendations, [])

    def test_earlier_discussion_is_supplied_as_context_separate_from_current_user_message(self):
        earlier = [{"source": "this_conversation", "question": "What should I focus on?", "answer": "Keep your eyes up."}]
        self.reply("Remind me what we discussed.", "You were working on keeping your eyes up.", "discussion", [],
                   earlier_context=earlier)
        sent = json.loads(self.provider.call_args.args[0].data)
        self.assertEqual(sent["input"][-1], {"role": "user", "content": "Remind me what we discussed."})
        self.assertEqual(json.loads(sent["input"][0]["content"])["practice_context"]["earlier_training_context"], earlier)
        self.assertTrue(sent["text"]["format"]["strict"])
        self.assertFalse(sent["store"])
        self.db.rollback.assert_called_once()

    def test_malformed_intent_is_rejected_without_rendering_untrusted_recommendations(self):
        with self.assertRaises(HTTPException) as result:
            self.reply("What is a screen?", "A screen creates room.", "advertisement", [])
        self.assertEqual(result.exception.status_code, 502)

    def test_only_two_distinct_grounded_priorities_leave_the_provider_as_private_enum_tags(self):
        question = "En mi escuela Orión juego de base y quiero leer mejor las ayudas. Me cuesta finalizar con la izquierda."
        answer = "Observa los pies del defensor de ayuda antes de arrancar."
        reading = {"kind": "goal", "skill": "game_reading", "position": "point_guard", "hand": "unspecified"}
        finishing = {"kind": "difficulty", "skill": "finishing", "position": "unspecified", "hand": "left"}
        reading_quote = "juego de base y quiero leer mejor las ayudas"
        finishing_quote = "Me cuesta finalizar con la izquierda"
        result = self.reply(question, answer, "guided_practice", [], priorities=[
            {**reading, "skill": "Orión", "evidence": reading_quote},
            {**reading, "evidence": "from an earlier question"},
            {**reading, "evidence": reading_quote},
            {**reading, "evidence": reading_quote},
            {**finishing, "evidence": finishing_quote},
            {**finishing, "kind": "goal", "evidence": finishing_quote},
        ])
        self.assertEqual(result._training_priorities, [reading, finishing])
        self.assertEqual(result.model_dump(), {"answer": answer, "recommendations": []})
        self.provider.assert_called_once()
        sent = json.loads(self.provider.call_args.args[0].data)
        schema = sent["text"]["format"]["schema"]["properties"]["training_priorities"]["items"]
        self.assertFalse(schema["additionalProperties"])
        self.assertIn("point_guard", schema["properties"]["position"]["enum"])

    def test_other_turns_and_empty_quotes_cannot_create_an_implicit_player_goal(self):
        old = "我想提高罚球命中率。"
        old_goal = {"kind": "goal", "skill": "free_throws", "hand": "unspecified", "position": "unspecified"}
        result = self.reply("NBA 加时赛打几分钟？", "加时赛为五分钟。", "discussion", [],
                            priorities=[{**old_goal, "evidence": old}, {**old_goal, "evidence": ""}],
                            earlier_context=[{"source": "this_conversation", "question": old, "answer": "先稳住节奏。"}])
        self.assertEqual(result._training_priorities, [])
        self.assertEqual(result.recommendations, [])
