import unittest
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Event
from unittest.mock import patch
from uuid import UUID, uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.main import create_app
from app.models.player_profile_revision import PlayerProfileRevision
from app.models.user import User
from app.schemas.player_profile import PlayerProfileCreate
from app.services.class_report_energy import aggregate_exercise_energy
from app.services.class_report_service import ClassReportService
from app.services.player_profile_service import PlayerProfileService
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

    def test_published_zero_minute_course_daily_api_is_known_zero(self):
        lesson = self.confirmed()
        data = self.update_payload(lesson)
        for item in data.items:
            item.actual_minutes = Decimal('0')
        for person in data.participants:
            person.status = 'present'
            for item in person.items:
                item.minutes = Decimal('0')
        lesson = self.service.update(self.coach, self.klass.public_id, lesson.public_id, data)
        self.publish(lesson)
        own = ClassReportService(self.db).mine(self.student)['items'][0]
        self.assertIsNone(own['profile'])
        self.assertEqual(own['exercise_energy']['status'], 'not_applicable')
        self.assertEqual(own['exercise_energy']['total_kcal'], 0)
        self.assertEqual(Decimal(own['exercise_energy']['unrounded_subtotal_kcal']), 0)
        daily = self._daily_api(lesson.held_on)
        self.assertEqual((daily['published_lessons'], daily['attended_lessons'], daily['absent_lessons']), (1, 1, 0))
        self.assertEqual(Decimal(daily['total_minutes']), 0)
        self.assertEqual(daily['exercise_energy']['status'], 'complete')
        self.assertEqual(daily['exercise_energy']['total_kcal'], 0)
        self.assertEqual(daily['exercise_energy']['known_subtotal_kcal'], 0)
        self.assertEqual((daily['exercise_energy']['missing_items'], daily['exercise_energy']['missing_reports']), (0, 0))

    def test_multiple_published_courses_daily_api_rounds_raw_sum_once(self):
        PlayerProfileService(self.db).create(self.student, self._measurement('40', '2026-09-01'))
        lessons = []
        for _ in range(2):
            lesson = self.confirmed()
            data = self.update_payload(lesson)
            for item, minutes in zip(data.items, (Decimal('0.25'), Decimal('0'))):
                item.activity_code = 'bodyweight_squats'
                item.intensity = 'moderate'
                item.actual_minutes = minutes
            for person in data.participants:
                person.status = 'present'
                for item, activity in zip(person.items, data.items):
                    item.minutes = activity.actual_minutes
            lesson = self.service.update(self.coach, self.klass.public_id, lesson.public_id, data)
            self.publish(lesson)
            lessons.append(lesson)
        daily = self._daily_api(lessons[0].held_on)
        self.assertEqual(daily['published_lessons'], 2)
        self.assertEqual({r['lesson_public_id'] for r in daily['reports']}, {str(r.public_id) for r in lessons})
        self.assertEqual(Decimal(daily['total_minutes']), Decimal('0.50'))
        # 3 MET * 3.5 * 40 kg / 200 * 0.25 min = 0.525 kcal per course.
        self.assertEqual([r['exercise_energy']['total_kcal'] for r in daily['reports']], [1, 1])
        self.assertEqual([Decimal(r['exercise_energy']['unrounded_subtotal_kcal']) for r in daily['reports']], [Decimal('0.525')] * 2)
        self.assertEqual(daily['exercise_energy']['status'], 'complete')
        self.assertEqual(Decimal(daily['exercise_energy']['unrounded_subtotal_kcal']), Decimal('1.05'))
        self.assertEqual(daily['exercise_energy']['total_kcal'], 1)
        self.assertNotEqual(daily['exercise_energy']['total_kcal'], sum(r['exercise_energy']['total_kcal'] for r in daily['reports']))

    def test_measurement_committed_before_publication_review_rejects_old_fingerprint(self):
        lesson, preview, updated, outcome = self._publication_measurement_race(read_before_update=False)
        self.assertEqual(outcome['status'], 409)
        service = ClassReportService(self.db)
        self.assertEqual(service.mine(self.student)['items'], [])
        fresh = service.preview(self.coach, self.klass.public_id, lesson.public_id)
        self.assertNotEqual(fresh['preview_fingerprint'], preview['preview_fingerprint'])
        service.publish(self.coach, self.klass.public_id, lesson.public_id, lesson.version, fresh['preview_fingerprint'])
        own = service.mine(self.student)['items'][0]
        self.assertEqual(own['profile']['public_id'], str(updated.public_id))
        self.assertEqual(own['profile']['weight_kg'], '50.00')

    def test_measurement_committed_after_publication_review_keeps_reviewed_snapshot(self):
        lesson, preview, updated, outcome = self._publication_measurement_race(read_before_update=True)
        self.assertEqual(outcome['status'], 200)
        service = ClassReportService(self.db)
        own = service.mine(self.student)['items'][0]
        reviewed = next(report for report in preview['reports'] if report['profile'])
        self.assertEqual(own['profile'], reviewed['profile'])
        self.assertEqual(own['exercise_energy'], reviewed['exercise_energy'])
        self.assertEqual(own['profile']['weight_kg'], '40.00')
        current = PlayerProfileService(self.db).history(self.student).items
        self.assertEqual([p.weight_kg for p in current], [Decimal('50.00'), Decimal('40.00')])
        self.assertEqual(current[0].public_id, updated.public_id)
        with patch('app.services.exercise_energy_service.calculate_lesson', side_effect=AssertionError('History must remain frozen')):
            self.assertEqual(service.publish(self.coach, self.klass.public_id, lesson.public_id, lesson.version), outcome['receipt'])
            self.assertEqual(service.read(service.own(self.student, UUID(own['public_id']))), own)
            daily = self._daily_api(lesson.held_on)
            self.assertEqual(daily['exercise_energy']['total_kcal'], reviewed['exercise_energy']['total_kcal'])
            self.assertEqual(daily['reports'][0]['profile'], reviewed['profile'])

    def _daily_api(self, held_on):
        app = create_app()
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.student
        try:
            with TestClient(app) as client:
                result = client.get('/api/v1/me/class-reports/daily', params={'held_on': held_on.isoformat()})
                self.assertEqual(result.status_code, 200)
                return result.json()
        finally:
            app.dependency_overrides.clear()

    @staticmethod
    def _measurement(weight, measured_on):
        return PlayerProfileCreate(request_id=uuid4(), date_of_birth='2014-01-01',
            measured_on=measured_on, height_cm='150', weight_kg=weight, sex='male')

    def _publication_measurement_race(self, *, read_before_update):
        lesson = self.confirmed()
        data = self.update_payload(lesson)
        for item in data.items:
            item.activity_code = 'shooting'
            item.intensity = 'moderate'
        lesson = self.service.update(self.coach, self.klass.public_id, lesson.public_id, data)
        PlayerProfileService(self.db).create(self.student, self._measurement('40', '2026-09-01'))
        preview = ClassReportService(self.db).preview(self.coach, self.klass.public_id, lesson.public_id)
        class_id, coach_id, student_id = self.klass.public_id, self.coach.id, self.student.id
        self.db.rollback()
        review_boundary, measurement_committed = Event(), Event()

        def wait_for(event, name):
            if not event.wait(timeout=10):
                raise AssertionError(f'Timed out waiting for {name}')

        def bounded_transaction(db):
            db.execute(text("SET LOCAL statement_timeout = '5s'"))
            db.execute(text("SET LOCAL lock_timeout = '5s'"))

        def publish():
            with Session(self.engine) as db:
                bounded_transaction(db)
                coach = db.get(User, coach_id)
                service = ClassReportService(db)
                original_prepare = service.prepare

                def prepare_at_boundary(row):
                    reviewed = original_prepare(row) if read_before_update else None
                    review_boundary.set()
                    wait_for(measurement_committed, 'measurement commit')
                    return reviewed if read_before_update else original_prepare(row)

                with patch.object(service, 'prepare', side_effect=prepare_at_boundary):
                    try:
                        receipt = service.publish(coach, class_id, lesson.public_id, lesson.version, preview['preview_fingerprint'])
                        return dict(status=200, receipt=receipt)
                    except HTTPException as error:
                        return dict(status=error.status_code)

        def update_measurement():
            wait_for(review_boundary, 'publication review boundary')
            try:
                with Session(self.engine) as db:
                    bounded_transaction(db)
                    return PlayerProfileService(db).create(db.get(User, student_id), self._measurement('50', '2026-09-20'))
            finally:
                # A failing writer must also release the peer so CI cannot hang.
                measurement_committed.set()

        with ThreadPoolExecutor(max_workers=2) as pool:
            publication_future = pool.submit(publish)
            measurement_future = pool.submit(update_measurement)
            updated = measurement_future.result(timeout=20)
            outcome = publication_future.result(timeout=20)
        self.db.expire_all()
        return lesson, preview, updated, outcome
