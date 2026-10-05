import os
from datetime import date
import unittest
from uuid import uuid4, UUID
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from sqlalchemy import select, func, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from fastapi import HTTPException
from fastapi.testclient import TestClient
import test_camp_lessons as fixtures
from app.main import create_app
from app.api.deps import get_db,get_current_user
from app.models.class_report import ClassReport,LessonPublication
from app.models.player_profile_revision import PlayerProfileRevision
from app.models.notification import Notification
from app.models.user import User
from app.services.class_report_service import ClassReportService
from app.services.camp_lesson_service import CampLessonService

@unittest.skipUnless(os.environ.get('PLAYER_PROFILE_TEST_DATABASE_URL'),'Dedicated PostgreSQL required')
class ClassReportTests(unittest.TestCase):
    setUpClass=classmethod(fixtures.CampLessonTests.setUpClass.__func__)
    tearDownClass=classmethod(fixtures.CampLessonTests.tearDownClass.__func__)
    setUp=fixtures.CampLessonTests.setUp
    tearDown=fixtures.CampLessonTests.tearDown
    user=fixtures.CampLessonTests.user
    make_plan=fixtures.CampLessonTests.make_plan
    create=fixtures.CampLessonTests.create
    update_payload=fixtures.CampLessonTests.update_payload

    def confirmed(self):
        row=self.create()
        p=self.update_payload(row)
        for i,minutes in zip(p.items,[10,20]): i.actual_minutes=Decimal(minutes)
        for person in p.participants:
            person.status='present'
            for item,activity in zip(person.items,p.items): item.minutes=activity.actual_minutes
        return self.service.update(self.coach,self.klass.public_id,row.public_id,p)

    def publish(self,row):
        service = ClassReportService(self.db)
        preview = service.preview(self.coach,self.klass.public_id,row.public_id)
        return service.publish(self.coach,self.klass.public_id,row.public_id,row.version,preview['preview_fingerprint'])

    def test_unconfirmed_blocks_entire_batch(self):
        row=self.create()
        service=ClassReportService(self.db)
        self.assertTrue(service.preview(self.coach,self.klass.public_id,row.public_id)['blockers'])
        with self.assertRaises(HTTPException) as error: self.publish(row)
        self.assertEqual(error.exception.status_code,422)
        self.assertEqual(service.mine(self.student)['items'],[])

    def test_snapshot_privacy_and_idempotent_notifications(self):
        row=self.confirmed()
        self.db.add(PlayerProfileRevision(user_id=self.student.id,date_of_birth='2014-01-01',measured_on='2026-09-01',height_cm=150,weight_kg=40))
        self.db.commit()
        result=self.publish(row)
        service=ClassReportService(self.db)
        own=service.mine(self.student)['items'][0]
        self.assertEqual(own['profile']['weight_kg'],'40.00')
        self.assertEqual(own['nutrition']['energy_kcal'],None)
        self.assertNotIn('participants',own)
        self.assertNotIn('roster',own)
        self.db.add(PlayerProfileRevision(user_id=self.student.id,date_of_birth='2014-01-01',measured_on='2026-09-15',height_cm=155,weight_kg=43))
        self.db.commit()
        self.assertEqual(self.publish(row),result)
        self.assertEqual(service.preview(self.coach,self.klass.public_id,row.public_id)['reports'],result['reports'])
        self.assertEqual(service.mine(self.student)['items'][0],own)
        count=self.db.scalar(select(func.count(Notification.id)).where(Notification.user_id==self.student.id,Notification.business_type=='class_report'))
        self.assertEqual(count,1)
        with self.assertRaises(HTTPException) as error: service.own(self.peer,UUID(own['public_id']))
        self.assertEqual(error.exception.status_code,404)

    def test_revision_absence_replaces_latest_but_keeps_history(self):
        row=self.confirmed();self.publish(row)
        p=self.update_payload(row)
        p.held_on=p.held_on.replace(day=7)
        for person in p.participants:
            if person.student_public_id==self.student.public_id:
                person.status='absent'
                for item in person.items:item.minutes=Decimal(0)
        revised=self.service.update(self.coach,self.klass.public_id,row.public_id,p)
        self.publish(revised)
        service=ClassReportService(self.db)
        latest=service.mine(self.student)['items']
        self.assertEqual(len(latest),1)
        self.assertEqual(latest[0]['attendance'],'absent')
        self.assertEqual(latest[0]['nutrition']['status'],'not_applicable')
        self.assertEqual(latest[0]['held_on'],'2026-10-07')
        history=service.history(self.student,UUID(latest[0]['public_id']))['items']
        self.assertEqual([r['is_latest'] for r in history],[True,False])
        self.assertEqual(history[1]['total_minutes'],'30')
        self.assertEqual(history[1]['held_on'],'2026-10-06')

    def test_concurrent_publish_creates_one_batch(self):
        row=self.confirmed();class_id=self.klass.public_id;coach_id=self.coach.id
        self.db.rollback()
        def publish(_):
            with Session(self.engine) as db:
                service = ClassReportService(db)
                coach = db.get(User,coach_id)
                preview = service.preview(coach,class_id,row.public_id)
                return service.publish(coach,class_id,row.public_id,row.version,preview['preview_fingerprint'])['public_id']
        with ThreadPoolExecutor(max_workers=2) as pool: ids=list(pool.map(publish,range(2)))
        self.assertEqual(ids[0],ids[1])
        self.assertEqual(len(ClassReportService(self.db).mine(self.student)['items']),1)
        self.assertEqual(self.db.scalar(select(func.count(Notification.id)).where(Notification.user_id==self.student.id,Notification.business_type=='class_report')),1)

    def test_failure_rolls_back_batch_and_retry_succeeds(self):
        row=self.confirmed()
        with patch('app.services.class_report_service.Notification',side_effect=RuntimeError('synthetic write failure')):
            with self.assertRaises(RuntimeError):self.publish(row)
        self.assertEqual(ClassReportService(self.db).mine(self.student)['items'],[])
        self.assertEqual(len(self.publish(row)['reports']),2)

    def test_permissions_stale_version_and_future_measurement(self):
        row=self.confirmed()
        self.db.add(PlayerProfileRevision(user_id=self.student.id,date_of_birth='2014-01-01',measured_on='2026-10-07',height_cm=150,weight_kg=40))
        self.db.commit()
        service=ClassReportService(self.db)
        for user in [self.student,self.outsider]:
            with self.assertRaises(HTTPException): service.publish(user,self.klass.public_id,row.public_id,row.version)
        with self.assertRaises(HTTPException) as error: service.publish(self.coach,self.klass.public_id,row.public_id,1)
        self.assertEqual(error.exception.status_code,409)
        self.publish(row)
        self.assertIsNone(service.mine(self.student)['items'][0]['profile'])

    def test_api_owner_and_coach_permissions(self):
        row=self.confirmed();self.publish(row)
        app=create_app();app.dependency_overrides[get_db]=lambda:self.db
        report=ClassReportService(self.db).mine(self.student)['items'][0]
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/v1/me/class-reports').status_code,401)
            app.dependency_overrides[get_current_user]=lambda:self.student
            self.assertEqual(client.get('/api/v1/me/class-reports').status_code,200)
            self.assertEqual(client.post(f'/api/v1/coach/classes/{self.klass.public_id}/lessons/{row.public_id}/publish-reports',json={'expected_version':row.version}).status_code,403)
            app.dependency_overrides[get_current_user]=lambda:self.peer
            self.assertEqual(client.get('/api/v1/me/class-reports/'+report['public_id']).status_code,404)
            self.assertEqual(client.get('/api/v1/me/class-reports/'+report['public_id']+'/history').status_code,404)
        app.dependency_overrides.clear()

    def test_daily_aggregates_personal_minutes_and_ignores_drafts(self):
        first=self.confirmed();self.publish(first)
        second=self.confirmed()
        p=self.update_payload(second)
        for person in p.participants:
            if person.student_public_id==self.student.public_id:
                person.status='partial'
                person.items[0].minutes=Decimal('0')
                person.items[1].minutes=Decimal('12.25')
        second=self.service.update(self.coach,self.klass.public_id,second.public_id,p)
        self.publish(second);self.publish(second)
        self.confirmed()  # Saved but unpublished: must not enter the summary.
        service=ClassReportService(self.db)
        summary=service.daily(self.student,date(2026,10,6))
        self.assertEqual(summary['published_lessons'],2)
        self.assertEqual(summary['attended_lessons'],2)
        self.assertEqual(summary['total_minutes'],'42.25')
        self.assertEqual(len({r['lesson_public_id'] for r in summary['reports']}),2)
        self.assertEqual(service.daily(self.peer,date(2026,10,6))['total_minutes'],'60')
        self.assertEqual(service.daily(self.outsider,date(2026,10,6))['reports'],[])

    def test_daily_revision_moves_date_only_after_publish_and_retains_history(self):
        row=self.confirmed();self.publish(row)
        service=ClassReportService(self.db)
        original=service.daily(self.student,date(2026,10,6))['reports'][0]
        p=self.update_payload(row);p.held_on=date(2026,10,7)
        for person in p.participants:
            person.status='absent'
            for item in person.items:item.minutes=Decimal(0)
        revised=self.service.update(self.coach,self.klass.public_id,row.public_id,p)
        self.assertEqual(service.daily(self.student,date(2026,10,6))['total_minutes'],'30')
        self.assertEqual(service.daily(self.student,date(2026,10,7))['published_lessons'],0)
        self.publish(revised)
        self.assertEqual(service.daily(self.student,date(2026,10,6))['reports'],[])
        new=service.daily(self.student,date(2026,10,7))
        self.assertEqual((new['published_lessons'],new['attended_lessons'],new['absent_lessons']),(1,0,1))
        self.assertEqual(Decimal(new['total_minutes']),0)
        old=service.read(service.own(self.student,UUID(original['public_id'])))
        self.assertEqual(old['held_on'],'2026-10-06')
        self.assertEqual(old['total_minutes'],'30')
        self.assertFalse(old['is_latest'])

    def test_daily_api_authentication_date_validation_and_empty_state(self):
        row=self.confirmed();self.publish(row)
        app=create_app();app.dependency_overrides[get_db]=lambda:self.db
        try:
            with TestClient(app) as client:
                path='/api/v1/me/class-reports/daily'
                self.assertEqual(client.get(path+'?held_on=2026-10-06').status_code,401)
                app.dependency_overrides[get_current_user]=lambda:self.student
                self.assertEqual(client.get(path+'?held_on=not-a-date').status_code,422)
                response=client.get(path+'?held_on=2026-10-06')
                self.assertEqual(response.status_code,200)
                self.assertEqual(response.json()['published_lessons'],1)
                self.assertEqual(client.get(path+'?held_on=2026-10-08').json()['reports'],[])
        finally:
            app.dependency_overrides.clear()

    def test_database_protects_publications(self):
        row=self.confirmed();self.publish(row)
        own=ClassReportService(self.db).mine(self.student)['items'][0]
        for statement in ["UPDATE class_reports SET snapshot='{}'::jsonb WHERE public_id=:id", "DELETE FROM class_reports WHERE public_id=:id"]:
            with self.assertRaises(DBAPIError):
                self.db.execute(text(statement),{'id':own['public_id']})
                self.db.commit()
            self.db.rollback()
        self.assertEqual(ClassReportService(self.db).mine(self.student)['items'][0]['total_minutes'],'30')
