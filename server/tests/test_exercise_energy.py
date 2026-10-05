import unittest
from copy import deepcopy
from decimal import Decimal

from app.services.exercise_energy_service import calculate_item, calculate_lesson, metadata


def profile(**changes):
    values = dict(
        public_id="measure-fixture", date_of_birth="2014-10-03", measured_on="2026-09-01",
        sex="male", height_cm="150", weight_kg="40",
    )
    values.update(changes)
    return values


class ExerciseEnergyTests(unittest.TestCase):
    def item(self, activity="shooting", intensity="moderate", minutes="20", **profile_changes):
        return calculate_item(activity, intensity, minutes, profile(**profile_changes), "2026-10-03", item_id="shot-1")

    def test_fixed_youth_examples_and_source_identity(self):
        # Published shooting METy 6.2 at 10–12; male BMR (17.686×40+658.2)/1440.
        result = self.item()
        self.assertEqual(result["status"], "estimated")
        self.assertEqual(result["method"], "youth_mety")
        self.assertEqual(result["gross_kcal"], 118)
        self.assertAlmostEqual(Decimal(result["unrounded_kcal"]), Decimal("117.5967777777777777777777777778"), places=20)
        self.assertEqual(result["source"]["activity_code"], "651203")
        self.assertEqual(result["source"]["age_group"], "10-12")
        self.assertEqual(result["inputs"]["met_type"], "METy")
        self.assertIsNone(result["inputs"]["intensity_factor"])
        # 14-year-old girl, 40 kg: BMR 0.85275 kcal/min; shooting METy 6.4 × 20 min.
        female = self.item(sex="female", date_of_birth="2012-10-03")
        self.assertEqual(Decimal(female["unrounded_kcal"]), Decimal("109.152"))
        self.assertEqual(female["gross_kcal"], 109)
        self.assertEqual(female["basis"], "gross")

    def test_age_groups_and_tenth_birthday_use_upper_bmr_branch(self):
        before = calculate_item("shooting", "moderate", "20", profile(date_of_birth="2016-10-04"), "2026-10-03")
        birthday = calculate_item("shooting", "moderate", "20", profile(date_of_birth="2016-10-03"), "2026-10-03")
        self.assertEqual(before["inputs"]["age_years"], 9)
        self.assertEqual(before["source"]["age_group"], "6-9")
        self.assertAlmostEqual(Decimal(before["inputs"]["bmr_kcal_per_min"]), Decimal("0.9809305555555555555555555556"))
        self.assertEqual(birthday["source"]["age_group"], "10-12")
        self.assertEqual(birthday["inputs"]["age_years"], 10)
        self.assertAlmostEqual(Decimal(birthday["inputs"]["bmr_kcal_per_min"]), Decimal("0.9483611111111111111111111111"))
        for age, group in ((6, "6-9"), (12, "10-12"), (13, "13-15"), (15, "13-15"), (16, "16-18"), (18, "16-18")):
            with self.subTest(age=age):
                result = self.item(date_of_birth=f"{2026-age}-10-03")
                self.assertEqual(result["source"]["age_group"], group)
        self.assertEqual(self.item(date_of_birth="2007-10-04")["status"], "estimated")
        self.assertEqual(self.item(date_of_birth="2007-10-03")["status"], "invalid_input")

    def test_leap_day_birth_matches_profile_full_birthday_age(self):
        person = profile(date_of_birth="2016-02-29", measured_on="2026-02-01")
        before = calculate_item("shooting", "moderate", "20", person, "2026-02-28")
        after = calculate_item("shooting", "moderate", "20", person, "2026-03-01")
        self.assertEqual((before["inputs"]["age_years"], before["source"]["age_group"]), (9, "6-9"))
        self.assertEqual((after["inputs"]["age_years"], after["source"]["age_group"]), (10, "10-12"))

    def test_personal_minutes_scale_without_double_intensity_factor(self):
        full = self.item(minutes="20")
        half = self.item(minutes="10")
        self.assertAlmostEqual(Decimal(half["unrounded_kcal"]) * 2, Decimal(full["unrounded_kcal"]), places=20)
        self.assertEqual(self.item(intensity="low")["unrounded_kcal"], self.item(intensity="high")["unrounded_kcal"])
        moderate, high = self.item("dribbling", "moderate"), self.item("dribbling", "high")
        self.assertEqual((moderate["method"], high["method"]), ("youth_analogy", "youth_analogy"))
        self.assertEqual((moderate["inputs"]["met_value"], high["inputs"]["met_value"]), ("6.2", "6.3"))
        self.assertEqual(high["source"]["activity_code"], "101203")
        self.assertIsNone(high["inputs"]["intensity_factor"])

    def test_low_age_and_unmapped_youth_presets_use_marked_generic_baseline(self):
        for age in (4, 5):
            with self.subTest(age=age):
                result = self.item(date_of_birth=f"{2026-age}-10-03", sex=None)
                self.assertEqual(result["method"], "generic_met_approximation")
                self.assertEqual(result["inputs"]["met_type"], "MET")
                self.assertIsNone(result["inputs"]["bmr_kcal_per_min"])
                self.assertEqual(result["gross_kcal"], 70)
                self.assertEqual(result["source"]["reference_scope"], "adult_source_used_as_generic_approximation")
        # Published mild-stretching baseline 2.3; 40 kg × 20 min = 32.2 kcal before product factor.
        low = self.item("stretching", "low")
        high = self.item("stretching", "high")
        self.assertEqual(Decimal(low["unrounded_kcal"]), Decimal("25.76"))
        self.assertEqual(Decimal(high["unrounded_kcal"]), Decimal("37.03"))
        self.assertEqual(high["inputs"]["intensity_factor"], "1.15")
        self.assertEqual(high["source"]["activity_code"], "02101")

    def test_missing_youth_sex_or_age_cannot_trigger_generic_fallback(self):
        missing_sex = self.item(sex=None)
        self.assertEqual(missing_sex["status"], "missing_input")
        self.assertIsNone(missing_sex["method"])
        self.assertIsNone(missing_sex["gross_kcal"])
        self.assertIn("do not trigger", missing_sex["reason"])
        no_birth = self.item("stretching", date_of_birth=None)
        self.assertEqual(no_birth["status"], "missing_input")
        self.assertIsNone(no_birth["gross_kcal"])
        self.assertEqual(calculate_item("shooting", "moderate", "20", None, "2026-10-03")["status"], "missing_profile")

    def test_unknown_activity_and_bad_minutes_or_measurements_are_not_zero(self):
        self.assertEqual(self.item("Basketball - Game")["status"], "unmapped_activity")
        self.assertEqual(self.item(intensity=None)["status"], "missing_input")
        self.assertEqual(self.item(intensity="medium")["status"], "invalid_input")
        for minutes, status in ((None, "missing_input"), ("-1", "invalid_input"), ("NaN", "invalid_input"), (True, "invalid_input"), ("1441", "invalid_input")):
            with self.subTest(minutes=minutes):
                result = self.item(minutes=minutes)
                self.assertEqual(result["status"], status)
                self.assertIsNone(result["gross_kcal"])
                self.assertIsNone(result["unrounded_kcal"])
        for changes in ({"weight_kg": None}, {"weight_kg": "0"}, {"weight_kg": "Infinity"}, {"measured_on": "2026-10-04"}, {"measured_on": None}):
            self.assertIsNone(self.item(**changes)["gross_kcal"])

    def test_known_zero_and_absence_of_items_remain_distinct_from_missing_input(self):
        zero = calculate_item(None, None, "0", None, None)
        self.assertEqual((zero["status"], zero["gross_kcal"], zero["unrounded_kcal"]), ("not_applicable", 0, "0"))
        lesson = calculate_lesson([dict(item_id="zero", minutes="0")], None, "2026-10-03")
        self.assertEqual((lesson["status"], lesson["total_kcal"]), ("not_applicable", 0))
        empty = calculate_lesson([], None, "2026-10-03")
        self.assertEqual(empty["status"], "unavailable")
        self.assertIsNone(empty["total_kcal"])
        self.assertIsNone(empty["known_subtotal_kcal"])

    def test_half_up_and_lesson_sums_unrounded_values(self):
        half = self.item("bodyweight_squats", minutes="15")
        self.assertEqual((Decimal(half["unrounded_kcal"]), half["gross_kcal"]), (Decimal("31.5"), 32))
        lesson = calculate_lesson([
            dict(item_id="a", activity_code="bodyweight_squats", intensity="moderate", minutes="0.25"),
            dict(item_id="b", activity_code="bodyweight_squats", intensity="moderate", minutes="0.25"),
        ], profile(), "2026-10-03")
        self.assertEqual([entry["gross_kcal"] for entry in lesson["items"]], [1, 1])
        self.assertEqual(lesson["total_kcal"], 1)
        self.assertEqual(Decimal(lesson["unrounded_subtotal_kcal"]), Decimal("1.05"))
        self.assertEqual(lesson["status"], "complete")

    def test_partial_and_mixed_methods_keep_known_subtotal_and_input_unchanged(self):
        rows = [
            dict(item_id="y", activity_code="shooting", intensity="moderate", minutes="20"),
            dict(item_id="g", activity_code="stretching", intensity="moderate", minutes="20"),
            dict(item_id="unknown", activity_code=None, intensity=None, minutes="10"),
        ]
        person = profile()
        original = deepcopy((rows, person))
        result = calculate_lesson(rows, person, "2026-10-03")
        self.assertEqual(result["status"], "partial")
        self.assertIsNone(result["total_kcal"])
        self.assertEqual(result["known_subtotal_kcal"], 150)
        self.assertEqual(result["missing_items"], 1)
        self.assertEqual(result["methods"], ["generic_met_approximation", "youth_mety"])
        self.assertEqual([entry["item_id"] for entry in result["items"]], ["y", "g", "unknown"])
        self.assertEqual((rows, person), original)
        result["items"][0]["source"]["title"] = "tampered"
        self.assertIn("NCCOR", self.item()["source"]["title"])

    def test_metadata_presets_are_explicit_and_results_freeze_versions(self):
        catalog = metadata()
        self.assertEqual(len(catalog["items"]), 9)
        self.assertTrue(all(entry["intensities"] == ["low", "moderate", "high"] for entry in catalog["items"]))
        result = self.item()
        self.assertEqual(result["mapping_version"], catalog["mapping_version"])
        self.assertEqual(result["inputs"]["profile_public_id"], "measure-fixture")
        self.assertEqual(result["inputs"]["measured_on"], "2026-09-01")
        self.assertEqual(result["inputs"]["measurement_age_days"], 32)
        self.assertIsNotNone(result["rule_version"])
        self.assertIsNotNone(result["rounding_version"])


if __name__ == "__main__":
    unittest.main()
