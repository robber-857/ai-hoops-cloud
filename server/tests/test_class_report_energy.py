import unittest
from decimal import Decimal
from unittest.mock import patch
from uuid import UUID

from app.models.player_profile_revision import PlayerProfileRevision
from app.services.class_report_energy import aggregate_exercise_energy
from app.services.class_report_service import ClassReportService
import test_class_reports as fixtures


class DailyEnergyAggregationTests(unittest.TestCase):
    def report(self, raw='0.49', status='complete', missing=0):
        return dict(attendance='present', exercise_energy=dict(status=status,
            unrounded_subtotal_kcal=raw, missing_items=missing, methods=['youth_mety']))

    def test_sum_unrounded_before_rounding_once(self):
        result = aggregate_exercise_energy([self.report(), self.report()])
        self.assertEqual(result['total_kcal'], 1)
        self.assertEqual(result['unrounded_subtotal_kcal'], '0.98')

    def test_partial_legacy_and_absence_do_not_become_zero_total(self):
        legacy = dict(attendance='present', items=[dict(minutes='10')])
        result = aggregate_exercise_energy([self.report('100.5'), legacy, dict(attendance='absent')])
        self.assertEqual(result['status'], 'partial')
        self.assertIsNone(result['total_kcal'])
        self.assertEqual(result['known_subtotal_kcal'], 101)
        self.assertEqual(result['missing_reports'], 1)
        self.assertEqual(result['missing_items'], 1)
        self.assertEqual(aggregate_exercise_energy([legacy])['status'], 'unavailable')
        self.assertEqual(aggregate_exercise_energy([dict(attendance='absent')])['status'], 'not_applicable')
        self.assertIsNone(aggregate_exercise_energy([])['total_kcal'])

    def test_partial_new_report_preserves_missing_items(self):
        result = aggregate_exercise_energy([self.report('10.1', 'partial', 2)])
        self.assertEqual((result['status'], result['missing_reports'], result['missing_items']), ('partial', 1, 2))


@unittest.skipUnless(fixtures.os.environ.get('PLAYER_PROFILE_TEST_DATABASE_URL'), 'Dedicated PostgreSQL required')
class PublishedEnergyTests(unittest.TestCase):
    setUpClass = classmethod(fixtures.ClassReportTests.setUpClass.__func__)
    tearDownClass = classmethod(fixtures.ClassReportTests.tearDownClass.__func__)
    setUp = fixtures.ClassReportTests.setUp
    tearDown = fixtures.ClassReportTests.tearDown
    user = fixtures.ClassReportTests.user
    make_plan = fixtures.ClassReportTests.make_plan
    create = fixtures.ClassReportTests.create
    update_payload = fixtures.ClassReportTests.update_payload
    confirmed = fixtures.ClassReportTests.confirmed
    publish = fixtures.ClassReportTests.publish

    def test_frozen_estimates_personal_minutes_and_retry(self):
        lesson = self.confirmed()
        data = self.update_payload(lesson)
        data.items[0].activity_code = 'warmup'
        data.items[0].intensity = 'low'
        data.items[1].activity_code = 'basketball_game'
        data.items[1].intensity = 'high'
        for person in data.participants:
            if person.student_public_id == self.student.public_id:
                person.status = 'partial'
                person.items[1].minutes = Decimal('5')
        lesson = self.service.update(self.coach, self.klass.public_id, lesson.public_id, data)
        self.db.add(PlayerProfileRevision(user_id=self.student.id, date_of_birth='2014-01-01',
            measured_on='2026-09-01', height_cm=150, weight_kg=40, sex='male'))
        self.db.commit()
        receipt = self.publish(lesson)
        service = ClassReportService(self.db)
        own = service.mine(self.student)['items'][0]
        energy = own['exercise_energy']
        self.assertEqual(own['schema_version'], 'class-report-v2')
        self.assertEqual(energy['status'], 'complete')
        self.assertEqual(energy['basis'], 'gross')
        self.assertEqual(energy['items'][1]['inputs']['minutes'], '5')
        self.assertEqual(energy['items'][1]['inputs']['weight_kg'], '40.00')
        self.assertEqual(service.daily(self.student, lesson.held_on)['exercise_energy']['total_kcal'], energy['total_kcal'])
        peer = service.mine(self.peer)['items'][0]
        self.assertEqual(peer['exercise_energy']['status'], 'unavailable')
        self.db.add(PlayerProfileRevision(user_id=self.student.id, date_of_birth='2014-01-01',
            measured_on='2026-09-20', height_cm=155, weight_kg=50, sex='male'))
        self.db.commit()
        with patch('app.services.exercise_energy_service.calculate_lesson', side_effect=AssertionError('No historical recomputation')):
            self.assertEqual(self.publish(lesson), receipt)
            self.assertEqual(service.preview(self.coach, self.klass.public_id, lesson.public_id)['reports'], receipt['reports'])
            self.assertEqual(service.read(service.own(self.student, UUID(own['public_id']))), own)

    def test_absence_has_no_energy_estimate(self):
        lesson = self.confirmed()
        data = self.update_payload(lesson)
        for person in data.participants:
            person.status = 'absent'
            for item in person.items:
                item.minutes = Decimal(0)
        lesson = self.service.update(self.coach, self.klass.public_id, lesson.public_id, data)
        self.publish(lesson)
        service = ClassReportService(self.db)
        own = service.mine(self.student)['items'][0]['exercise_energy']
        self.assertEqual(own['status'], 'not_applicable')
        self.assertIsNone(own['total_kcal'])
        self.assertEqual(own['items'], [])

    def test_profile_changed_after_preview_requires_new_preview(self):
        lesson = self.confirmed()
        service = ClassReportService(self.db)
        old_preview = service.preview(self.coach, self.klass.public_id, lesson.public_id)
        self.db.add(PlayerProfileRevision(user_id=self.student.id, date_of_birth='2014-01-01',
            measured_on='2026-09-20', height_cm=155, weight_kg=50, sex='male'))
        self.db.commit()
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as error:
            service.publish(self.coach, self.klass.public_id, lesson.public_id, lesson.version, old_preview['preview_fingerprint'])
        self.assertEqual(error.exception.status_code, 409)
        fresh = service.preview(self.coach, self.klass.public_id, lesson.public_id)
        self.assertNotEqual(fresh['preview_fingerprint'], old_preview['preview_fingerprint'])
        receipt = service.publish(self.coach, self.klass.public_id, lesson.public_id, lesson.version, fresh['preview_fingerprint'])
        self.assertEqual(len(receipt['reports']), 2)

    def test_first_publish_cannot_omit_preview_but_retry_can(self):
        lesson = self.confirmed()
        service = ClassReportService(self.db)
        from fastapi import HTTPException
        for token in (None, ''):
            with self.assertRaises(HTTPException) as error:
                service.publish(self.coach, self.klass.public_id, lesson.public_id, lesson.version, token)
            self.assertEqual(error.exception.status_code, 409)
        preview = service.preview(self.coach, self.klass.public_id, lesson.public_id)
        receipt = service.publish(self.coach, self.klass.public_id, lesson.public_id, lesson.version, preview['preview_fingerprint'])
        self.assertEqual(service.publish(self.coach, self.klass.public_id, lesson.public_id, lesson.version), receipt)
