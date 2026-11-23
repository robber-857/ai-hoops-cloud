"""Evaluate AI Coach with synthetic basketball questions. Run from server/ as a module."""

import argparse
from contextlib import ExitStack
from dataclasses import dataclass
import io
import json
import re
from time import perf_counter
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from app.schemas.training_assistant import AssistantRecommendation, AssistantRequest, AssistantResponse
from app.services import training_assistant as coach


MODEL = "gpt-6-luna"
LOW_CROSSOVER = AssistantRecommendation(
    title="Low Crossover", kind="exercise", href="/pose-2d/dribbling?templateCode=low-crossover",
)
OTHER_EXERCISE = AssistantRecommendation(
    title="Box Out", kind="exercise", href="/pose-2d/training?templateCode=box-out",
)
FOCUS = {"kind": "difficulty", "skill": "finishing", "hand": "left", "position": "unspecified"}
FOCUS_QUOTE = "I struggle to finish with my left hand"


@dataclass(frozen=True)
class Case:
    name: str
    question: str
    fixture_answer: str
    intent: str
    expected_text: str
    review: str


CASES = (
    Case("zh-tactics", "打挡拆时防守换防了，我作为持球人先观察什么？请用中文解释。",
         "先观察换防后防守人的站位。若两人都扑向你，寻找顺下队友的传球路线。", "discussion",
         r"[\u3400-\u9fff]", "Names a defensive cue and explains how it changes the ball handler's decision."),
    Case("en-drill", "Teach me the Low Crossover from my exercise menu and link that drill.",
         "For the Low Crossover, bend your knees and bounce the ball below knee height.", "guided_practice",
         r"(?i)\bcrossover\b", "Offers a usable cue and a way for a beginner to check their form."),
    Case("report", "What was my latest overall score? Start with the score in digits, then explain it in one sentence.",
         "73/100. That was the overall result of your most recent dribbling report.", "discussion",
         r"^73(?=$|\s|/|[.,:;!?](?:\s|$))", "Explains the recorded overall score without inventing a cause or a component score."),
    Case("stated-focus", FOCUS_QUOTE + ". Give me one tip for my next practice.",
         "Practise a left-hand layup from one step away, taking off from your right foot.", "guided_practice",
         r"(?i)\bleft\b", "Addresses the stated left-hand finishing difficulty without linking unrelated drills."),
    Case("recall", "Which hand did I previously say was difficult for finishing? Just name the hand.",
         "Your left hand.", "discussion",
         r"(?i)\bleft\b", "Uses the previous chat's training focus without claiming to have seen a video."),
)


def synthetic_context():
    links = {"exercise-1": LOW_CROSSOVER, "exercise-2": OTHER_EXERCISE}
    return {
        "language_preference": "en",
        "assigned_tasks": [],
        "available_exercises": [
            {"id": "exercise-1", "title": LOW_CROSSOVER.title, "type": "dribbling"},
            {"id": "exercise-2", "title": OTHER_EXERCISE.title, "type": "training"},
        ],
        "recent_report_summaries": [
            {"type": "dribbling", "exercise": LOW_CROSSOVER.title, "score": 73, "grade": "B", "date": "2026-09-02"},
            {"type": "training", "exercise": OTHER_EXERCISE.title, "score": 61, "grade": "C", "date": "2026-09-01"},
        ],
    }, links


def offline_transport(case: Case, earlier: list[dict]):
    """Inspect the actual outbound request, then replay a fixture at the HTTP boundary."""
    def respond(request, *, timeout):
        body = json.loads(request.data)
        checks = [
            request.full_url == "https://api.openai.com/v1/responses",
            request.get_method() == "POST",
            body["model"] == MODEL,
            body["store"] is False,
            body["reasoning"]["effort"] == "none",
            body["max_output_tokens"] > 0,
            body["text"]["format"]["strict"] is True,
            body["input"][-1] == {"role": "user", "content": case.question},
            json.loads(body["input"][0]["content"])["practice_context"].get("earlier_training_context", []) == earlier,
        ]
        if not all(checks):
            raise AssertionError(f"{case.name}: unexpected outgoing request")
        output = {
            "answer": case.fixture_answer, "intent": case.intent, "request_quote": "",
            "recommendations": [{"id": "exercise-1", "answer_quote": "Low Crossover"}] if case.name == "en-drill" else [],
            "training_priorities": [{**FOCUS, "evidence": FOCUS_QUOTE}] if case.name == "stated-focus" else [],
        }
        envelope = {"status": "completed", "output": [{"type": "message", "content": [
            {"type": "output_text", "text": json.dumps(output)},
        ]}]}
        return io.BytesIO(json.dumps(envelope).encode("utf-8"))
    return respond


def check_reply(case: Case, reply: AssistantResponse) -> list[str]:
    failures = []
    if not re.search(case.expected_text, reply.answer):
        failures.append("missing requested language, exercise, score or hand")
    if reply.recommendations != ([LOW_CROSSOVER] if case.name == "en-drill" else []):
        failures.append("unexpected recommendation cards")
    expected = [FOCUS] if case.name == "stated-focus" else []
    if reply._training_priorities != expected:
        failures.append("incorrect new training memory")
    if re.search(r"https?://|\b(?:exercise|task)-\d+\b", reply.answer, re.I):
        failures.append("answer contains a raw link or internal item ID")
    return failures


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, epilog="Default: offline fixture replay. No student account or database is used.")
    parser.add_argument("--live", action="store_true",
                        help=f"send up to {len(CASES)} billable synthetic requests to {MODEL} and show answers for human review")
    live = parser.parse_args(argv).live
    if coach.settings.training_assistant_model != MODEL:
        print(f"Select TRAINING_ASSISTANT_MODEL={MODEL} for this evaluation.")
        return 2
    if live and not (coach.settings.training_assistant_api_key or "").strip():
        print("Live evaluation requires the backend TRAINING_ASSISTANT_OPENAI_API_KEY.")
        return 2

    print(f"{MODEL} | " + ("live provider, synthetic data" if live else "offline request and response fixtures"))
    service = coach.TrainingAssistant(Mock(spec_set=Session))
    player = SimpleNamespace(id=-1, role=UserRole.student)
    earlier = []
    passed = 0
    for case in CASES:
        history = earlier if case.name == "recall" else []
        with ExitStack() as stack:
            stack.enter_context(patch.object(service, "_context", return_value=synthetic_context()))
            if not live:
                stack.enter_context(patch.object(coach.settings, "training_assistant_api_key", "synthetic-fixture"))
                stack.enter_context(patch.object(coach, "urlopen", offline_transport(case, history)))
            request = AssistantRequest(messages=[{"role": "user", "content": case.question}])
            try:
                started = perf_counter()
                reply = service.answer(player, request, earlier_context=history)
            except HTTPException as exc:
                print(f"FAIL {case.name}: service returned HTTP {exc.status_code}. Stopped after this request.")
                return 1
        failures = check_reply(case, reply)
        if case.name == "stated-focus":
            earlier = [{"source": "other_active_conversation", **tag} for tag in reply._training_priorities]
        print(f"{'FAIL' if failures else 'PASS'} {case.name}" + (f" — {', '.join(failures)}" if failures else ""))
        if live:
            print(f"  {perf_counter() - started:.2f}s | {reply.answer}\n  Review: {case.review}")
        passed += not failures
    print(f"{passed}/{len(CASES)} automated checks passed.")
    return int(passed != len(CASES))


if __name__ == "__main__":
    raise SystemExit(main())
