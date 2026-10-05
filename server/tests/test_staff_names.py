import unittest
from types import SimpleNamespace
from app.services.display_names import staff_display_name


class StaffNameTests(unittest.TestCase):
    def test_recorded_names_and_no_identifier_fallback(self):
        for nickname, expected in [
            ("  林小明  ", "林小明"),
            (None, "Name not added"),
            (" ", "Name not added"),
        ]:
            self.assertEqual(
                staff_display_name(
                    SimpleNamespace(
                        nickname=nickname,
                        username="86d83f3a-77a3-4711-934a-057bbfe99001",
                    )
                ),
                expected,
            )
