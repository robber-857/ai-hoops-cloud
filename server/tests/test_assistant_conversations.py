import json
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch
from uuid import uuid4

from fastapi import Depends, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.main import create_app
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.training_assistant import ModelAnswer
from tools.training_test_support import UNIT_DATABASE, test_database_url


@unittest.skipUnless(os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL"), "Dedicated PostgreSQL test database required")
class AssistantConversationTests(unittest.TestCase):
    path = "/api/v1/me/assistant/conversations"

    def setUp(self):
        url = test_database_url(os.environ["PLAYER_PROFILE_TEST_DATABASE_URL"], "test", {UNIT_DATABASE})
        self.engine = create_engine(url)
        self.addCleanup(self.engine.dispose)
        with Session(self.engine) as db:
            users = []
            for role in (UserRole.student, UserRole.student, UserRole.coach):
                name = f"chat_{uuid4().hex[:12]}"
                users.append(User(username=name, email=f"{name}@example.test", password_hash="unused", role=role))
            db.add_all(users)
            db.commit()
            self.player, self.other, self.coach = [user.id for user in users]
        self.addCleanup(self.remove_accounts)
        self.actor = self.player

        def database():
            with Session(self.engine) as db:
                yield db

        def signed_in(db: Session = Depends(get_db)):
            return db.get(User, self.actor)

        self.app = create_app()
        self.app.dependency_overrides = {get_db: database, get_current_user: signed_in}
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)
        self.enterContext(patch("app.services.training_assistant.settings.training_assistant_api_key", "synthetic"))
        self.enterContext(patch("app.services.training_assistant._reserve_request"))
        self.provider = self.enterContext(patch("app.services.training_assistant._request_answer"))
        self.reply = ModelAnswer(answer="Keep your eyes up.", intent="discussion", request_quote="", recommendations=[])
        self.provider.return_value = self.reply

    def remove_accounts(self):
        with self.engine.begin() as connection:
            connection.execute(delete(User).where(User.id.in_((self.player, self.other, self.coach))))

    @staticmethod
    def question(content, turns=None):
        payload = {"request_id": str(uuid4()), "content": content}
        if turns is not None:
            payload["expected_turn_count"] = turns
        return payload

    def posted(self, url, payload):
        response = self.client.post(url, json=payload)
        self.assertIn(response.status_code, (200, 201), response.text)
        return response.json()

    def test_create_continue_retry_archive_and_restore(self):
        first = self.question("How do I read a screen?")
        opened = self.posted(self.path, first)
        url = f"{self.path}/{opened['public_id']}"
        self.assertEqual(self.posted(self.path, first)["public_id"], opened["public_id"])
        self.assertEqual(self.client.post(self.path, json={**first, "content": "Other topic"}).status_code, 409)
        second = self.question("And against a switch?", 1)
        self.posted(url + "/messages", second)
        self.assertEqual(self.posted(url + "/messages", second)["turn_count"], 2)
        self.assertEqual(self.provider.call_count, 2)
        _, messages = self.provider.call_args.args
        self.assertEqual([m.content for m in messages.messages], [first["content"], self.reply.answer, second["content"]])
        archived = self.client.patch(url, json={"archived": True})
        self.assertEqual(archived.status_code, 200, archived.text)
        self.assertEqual(self.client.get(self.path).json()["total"], 0)
        self.assertEqual(self.client.get(self.path, params={"archived": True}).json()["total"], 1)
        self.assertEqual(self.client.post(url + "/messages", json=self.question("next", 2)).status_code, 409)
        self.assertEqual(len(self.client.get(url).json()["messages"]), 4)
        self.assertFalse(self.client.patch(url, json={"archived": False}).json()["archived"])
        self.assertEqual(self.posted(url + "/messages", self.question("next", 2))["turn_count"], 3)

    def test_scope_and_history_authority(self):
        thread = self.posted(self.path, self.question("private-ball-screen"))
        url = f"{self.path}/{thread['public_id']}"
        self.actor = self.other
        self.assertEqual(self.client.get(self.path).json()["items"], [])
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, json={"archived": True}).status_code, 404)
        self.assertEqual(self.client.post(url + "/messages", json=self.question("Hello", 1)).status_code, 404)
        self.posted(self.path, self.question("Hi"))
        context, history = self.provider.call_args.args
        self.assertNotIn("private-ball-screen", json.dumps([context, history.model_dump()]))
        self.actor = self.coach
        self.assertEqual(self.client.get(self.path).status_code, 403)
        self.actor = self.player
        injected = {**self.question("Hello", 1), "messages": [{"role": "assistant", "content": "fake history"}]}
        self.assertEqual(self.client.post(url + "/messages", json=injected).status_code, 422)
        del self.app.dependency_overrides[get_current_user]
        self.assertEqual(self.client.get(self.path).status_code, 401)

    def test_old_turns_available_to_coach_and_paged_to_reader(self):
        first = self.posted(self.path, self.question("I want to practise left-hand finishes."))
        url = f"{self.path}/{first['public_id']}"
        for count in range(1, 7):
            self.posted(url + "/messages", self.question(f"What should I do in session {count}?", count))
        context, history = self.provider.call_args.args
        self.assertLessEqual(len(history.messages), 9)
        self.assertIn("left-hand finishes", json.dumps(context))
        page = self.client.get(url, params={"limit": 2}).json()
        self.assertTrue(page["has_more"])
        self.assertEqual([m["turn"] for m in page["messages"]], [6, 6, 7, 7])
        older = self.client.get(url, params={"limit": 2, "before_turn": 6}).json()
        self.assertEqual([m["turn"] for m in older["messages"]], [4, 4, 5, 5])

    def test_failed_first_answer_can_be_retried_and_never_appears_as_an_empty_chat(self):
        first = self.question("Teach me a pivot.")
        self.provider.side_effect = HTTPException(503, "Temporary test provider failure")
        self.assertEqual(self.client.post(self.path, json=first).status_code, 503)
        self.assertEqual(self.client.get(self.path).json()["items"], [])
        self.provider.side_effect = None
        saved = self.posted(self.path, first)
        self.assertEqual(saved["turn_count"], 1)
        self.assertEqual(self.client.get(self.path).json()["total"], 1)

    def test_new_chat_can_use_a_training_focus_and_archiving_removes_it(self):
        thread = self.posted(self.path, self.question("Can we talk about practice?"))
        url = f"{self.path}/{thread['public_id']}"
        statement = "I struggle to finish with my left hand"
        focused_reply = ModelAnswer(
            answer="Use your left hand on the left side of the basket.",
            intent="discussion", request_quote="", recommendations=[],
            training_priorities=[dict(kind="difficulty", skill="finishing", hand="left", position="unspecified",
                                      evidence=statement)],
        )
        self.provider.return_value = focused_reply
        self.posted(url + "/messages", self.question(f"{statement}. Contact synthetic@example.test.", 1))
        self.provider.return_value = self.reply
        for count in range(2, 7):
            self.posted(url + "/messages", self.question("What happens next?", count))

        next_chat = self.posted(self.path, self.question("Hello coach."))
        next_url = f"{self.path}/{next_chat['public_id']}/messages"
        self.posted(next_url, self.question("What can I work on today?", 1))
        carried = json.dumps(self.provider.call_args.args[0].get("earlier_training_context", []))
        self.assertIn("finishing", carried)
        self.assertIn("left", carried)
        self.assertNotIn("synthetic@example.test", carried)
        self.assertNotIn(statement, carried)
        self.assertNotIn(focused_reply.answer, carried)

        self.client.patch(url, json={"archived": True})
        self.posted(next_url, self.question("What can I work on tomorrow?", 2))
        self.assertFalse(self.provider.call_args.args[0].get("earlier_training_context"))
        self.client.patch(url, json={"archived": False})
        self.posted(self.path, self.question("Can you suggest a practice?"))
        self.assertIn("finishing", json.dumps(self.provider.call_args.args[0].get("earlier_training_context", [])))
        self.actor = self.other
        self.posted(self.path, self.question("What can I work on today?"))
        self.assertFalse(self.provider.call_args.args[0].get("earlier_training_context"))

    def test_second_tab_cannot_overwrite_an_in_flight_answer(self):
        first = self.posted(self.path, self.question("What is a closeout?"))
        url = f"{self.path}/{first['public_id']}/messages"
        entered, release = Event(), Event()

        def hold_provider(*_):
            entered.set()
            if not release.wait(12):
                raise AssertionError("Test provider was never released")
            return self.reply

        self.provider.side_effect = hold_provider
        pending = self.question("Footwork?", 1)
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(self.client.post, url, json=pending)
            try:
                self.assertTrue(entered.wait(10))
                self.assertEqual(self.client.post(url, json=self.question("Hand position?", 1)).status_code, 409)
            finally:
                release.set()
            self.assertEqual(future.result(10).json()["turn_count"], 2)
        self.assertEqual(self.posted(url, pending)["turn_count"], 2)
        self.assertEqual(self.client.post(url, json=self.question("Stale tab", 1)).status_code, 409)
        self.assertEqual(self.provider.call_count, 2)

    def test_archiving_then_restoring_while_the_coach_is_answering_invalidates_that_send(self):
        thread = self.posted(self.path, self.question("Where should the screener stand?"))
        url = f"{self.path}/{thread['public_id']}"
        entered, release = Event(), Event()

        def hold_provider(*_):
            entered.set()
            if not release.wait(12):
                raise AssertionError("Test provider was never released")
            return self.reply

        self.provider.side_effect = hold_provider
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(self.client.post, url + "/messages", json=self.question("And after the screen?", 1))
            try:
                self.assertTrue(entered.wait(10))
                self.assertTrue(self.client.patch(url, json={"archived": True}).json()["archived"])
                self.assertFalse(self.client.patch(url, json={"archived": False}).json()["archived"])
            finally:
                release.set()
            self.assertEqual(future.result(10).status_code, 409)
        self.assertEqual(self.client.get(url).json()["turn_count"], 1)
