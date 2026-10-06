import unittest
from types import SimpleNamespace
from app.services.display_names import staff_display_name


class StaffNameTests(unittest.TestCase):
    def test_nickname_then_registered_username(self):
        for nickname, expected in [
            ("  林小明  ", "林小明"),
            (None, "elton"),
            ("", "elton"),
            (" ", "elton"),
        ]:
            self.assertEqual(
                staff_display_name(
                    SimpleNamespace(
                        nickname=nickname,
                        username="elton",
                    )
                ),
                expected,
            )

    def test_placeholder_when_both_names_are_missing(self):
        self.assertEqual(
            staff_display_name(SimpleNamespace(nickname=None, username=" ")),
            "Name not added",
        )
