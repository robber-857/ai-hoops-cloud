import os
import unittest
from copy import deepcopy
from datetime import date
from decimal import Decimal
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select,func
import test_class_reports as fixtures
from app.main import create_app
from app.api.deps import get_db,get_current_user
from app.models.player_profile_revision import PlayerProfileRevision
from app.models.class_report import ClassReport
from app.models.notification import Notification
from app.schemas.personal_energy import PersonalEnergyPreviewRequest
from app.services.personal_energy_service import calculate,age_at,lesson_preview
from app.services.class_report_service import ClassReportService
from app.schemas.energy_reference import MealShares


def report(**profile_changes):
    return dict(student_name='Alex',attendance='present',held_on='2026-10-06',profile=dict(
        dict(date_of_birth='2014-10-06',measured_on='2026-09-01',sex='male',height_cm='150',weight_kg='40'),**profile_changes))


class PersonalEnergyCalculationTests(unittest.TestCase):
    def test_personal_meals_conserve_total_and_skip_missing_or_absent(self):
        shares=MealShares(breakfast='33.33',lunch='33.33',dinner='33.34')
        for sex in ['male','female']:
            r=calculate(report(sex=sex),'active',shares)
            self.assertEqual(sum(m['energy_kcal'] for m in r['meals']),r['energy_kcal'])
        r=report();r['profile']=None
        self.assertIsNone(calculate(r,'active',shares)['meals'])
        r=report();r['attendance']='absent'
        self.assertIsNone(calculate(r,'active',shares)['meals'])
        self.assertIsNone(calculate(report(),'active')['meals'])

    def test_fixed_input_examples(self):
        # Hand calculation from published coefficient equations, not reference-weight tables.
        for sex,activity,expected in [('male','active',2400),('female','active',2070),('male','inactive',2100),('male','low_active',2190),('male','very_active',2630),('female','inactive',1770),('female','low_active',1970),('female','very_active',2360)]:
            r=calculate(report(sex=sex),activity)
            self.assertEqual(r['energy_kcal'],expected)
            self.assertEqual(r['inputs']['age_years'],'12.0000')
            self.assertEqual(r['inputs']['measurement_age_days'],35)
        self.assertEqual(calculate(report(),'inactive')['energy_kcal'],2100)

    def test_age_boundaries_and_growth(self):
        for age,growth in [(4,15),(8,15),(9,25),(13,25),(14,20),(18,20)]:
            r=calculate(report(date_of_birth=f'{2026-age}-10-06'),'active')
            self.assertEqual(r['growth_kcal'],growth)
        self.assertEqual(calculate(report(date_of_birth='2017-10-06',sex='female'),'active')['growth_kcal'],30)
        for birth in ['2023-10-06','2007-10-06']:
            self.assertEqual(calculate(report(date_of_birth=birth),'active')['status'],'unsupported_age')
        self.assertEqual(age_at(date(2012,2,29),date(2026,2,28))[0],14)
        self.assertEqual(age_at(date(2012,2,29),date(2026,2,27))[0],13)

    def test_missing_absent_invalid_and_no_mutation(self):
        r=report();original=deepcopy(r)
        calculate(r,'active');self.assertEqual(r,original)
        r['profile']=None
        self.assertEqual(calculate(r,'active')['status'],'missing_profile')
        r['attendance']='absent'
        self.assertEqual(calculate(r,'active')['status'],'not_applicable')
        for changes,status in [(dict(sex=None),'missing_sex'),(dict(weight_kg='NaN'),'invalid_profile'),(dict(measured_on='2026-10-07'),'invalid_profile'),(dict(height_cm='0'),'invalid_profile')]:
            result=calculate(report(**changes),'active')
            self.assertEqual(result['status'],status)
            self.assertIsNone(result['energy_kcal'])


@unittest.skipUnless(os.environ.get('PLAYER_PROFILE_TEST_DATABASE_URL'),'Dedicated PostgreSQL required')
class PersonalEnergyIntegrationTests(unittest.TestCase):
    setUpClass=classmethod(fixtures.ClassReportTests.setUpClass.__func__)
    tearDownClass=classmethod(fixtures.ClassReportTests.tearDownClass.__func__)
    setUp=fixtures.ClassReportTests.setUp
    tearDown=fixtures.ClassReportTests.tearDown
    user=fixtures.ClassReportTests.user
    make_plan=fixtures.ClassReportTests.make_plan
    create=fixtures.ClassReportTests.create
    update_payload=fixtures.ClassReportTests.update_payload
    confirmed=fixtures.ClassReportTests.confirmed
    publish=fixtures.ClassReportTests.publish

    def request(self,row):
        return PersonalEnergyPreviewRequest(expected_version=row.version,activity_category='active')

    def add_profile(self,weight=40):
        self.db.add(PlayerProfileRevision(user_id=self.student.id,date_of_birth=date(2014,10,6),measured_on=date(2026,9,1),sex='male',height_cm=150,weight_kg=weight))
        self.db.commit()

    def test_published_measurements_are_frozen_and_preview_writes_nothing(self):
        row=self.confirmed();self.add_profile();self.publish(row)
        before_reports=self.db.scalar(select(func.count(ClassReport.id)))
        before_notifications=self.db.scalar(select(func.count(Notification.id)))
        first=lesson_preview(self.db,self.coach,self.klass.public_id,row.public_id,self.request(row))
        self.add_profile(60)
        second=lesson_preview(self.db,self.coach,self.klass.public_id,row.public_id,self.request(row))
        self.assertEqual(first,second)
        self.assertEqual(first['input_basis'],'published_snapshot')
        self.assertEqual([p['energy_kcal'] for p in first['players'] if p['status']=='candidate'],[2400])
        self.assertEqual(self.db.scalar(select(func.count(ClassReport.id))),before_reports)
        self.assertEqual(self.db.scalar(select(func.count(Notification.id))),before_notifications)

    def test_unpublished_inputs_stale_versions_and_access(self):
        row=self.confirmed();self.add_profile()
        preview=lesson_preview(self.db,self.coach,self.klass.public_id,row.public_id,self.request(row))
        self.assertEqual(preview['input_basis'],'saved_lesson')
        self.assertEqual({p['status'] for p in preview['players']},{'candidate','missing_profile'})
        for user in [self.student,self.outsider]:
            with self.assertRaises(HTTPException):lesson_preview(self.db,user,self.klass.public_id,row.public_id,self.request(row))
        with self.assertRaises(HTTPException) as error:
            lesson_preview(self.db,self.coach,self.klass.public_id,row.public_id,PersonalEnergyPreviewRequest(expected_version=1,activity_category='active'))
        self.assertEqual(error.exception.status_code,409)
        unconfirmed=self.create()
        result=lesson_preview(self.db,self.coach,self.klass.public_id,unconfirmed.public_id,self.request(unconfirmed))
        self.assertTrue(result['blockers']);self.assertEqual(result['players'],[])

    def test_api_requires_authorized_class_and_explicit_activity(self):
        row=self.confirmed();self.add_profile()
        app=create_app();app.dependency_overrides[get_db]=lambda:self.db
        url=f'/api/v1/coach/classes/{self.klass.public_id}/lessons/{row.public_id}/energy-preview'
        try:
            with TestClient(app) as client:
                data=self.request(row).model_dump()
                self.assertEqual(client.post(url,json=data).status_code,401)
                app.dependency_overrides[get_current_user]=lambda:self.student
                self.assertEqual(client.post(url,json=data).status_code,403)
                app.dependency_overrides[get_current_user]=lambda:self.outsider
                self.assertEqual(client.post(url,json=data).status_code,404)
                app.dependency_overrides[get_current_user]=lambda:self.coach
                self.assertEqual(client.post(url,json=data).status_code,200)
                data['meal_shares']={'breakfast':'30','lunch':'40','dinner':'30'}
                response=client.post(url,json=data)
                self.assertEqual(response.status_code,200)
                calculated=next(p for p in response.json()['players'] if p['status']=='candidate')
                self.assertEqual([m['energy_kcal'] for m in calculated['meals']],[720,960,720])
                data['meal_shares']['lunch']='30'
                self.assertEqual(client.post(url,json=data).status_code,422)
                self.assertEqual(client.post(url,json={'expected_version':row.version}).status_code,422)
        finally:app.dependency_overrides.clear()

    def test_individual_scenario_uses_identity_and_frozen_published_profile(self):
        row=self.confirmed();self.add_profile();self.publish(row)
        self.add_profile(60)
        request=PersonalEnergyPreviewRequest(expected_version=row.version,activity_category='active',
            activity_overrides={self.student.public_id:'inactive'},meal_shares=MealShares(breakfast='30',lunch='40',dinner='30'))
        result=lesson_preview(self.db,self.coach,self.klass.public_id,row.public_id,request)
        person=next(p for p in result['players'] if p['student_public_id']==str(self.student.public_id))
        self.assertEqual(person['energy_kcal'],2100)
        self.assertEqual(person['inputs']['weight_kg'],'40.00')
        self.assertEqual(person['activity_basis'],'individual_review')
        self.assertEqual(sum(m['energy_kcal'] for m in person['meals']),2100)
        other=next(p for p in result['players'] if p['student_public_id']!=str(self.student.public_id))
        self.assertEqual(other['activity_category'],'active')
        self.assertEqual(other['status'],'missing_profile')
        self.assertNotIn('student_public_id',ClassReportService(self.db).mine(self.student)['items'][0])

    def test_unknown_and_absent_individual_selections_are_rejected(self):
        row=self.confirmed()
        for identity in [self.outsider.public_id]:
            request=PersonalEnergyPreviewRequest(expected_version=row.version,activity_category='active',activity_overrides={identity:'inactive'})
            with self.assertRaises(HTTPException) as error:lesson_preview(self.db,self.coach,self.klass.public_id,row.public_id,request)
            self.assertEqual(error.exception.status_code,422)
        p=self.update_payload(row)
        for person in p.participants:
            if person.student_public_id==self.student.public_id:
                person.status='absent'
                for item in person.items:item.minutes=Decimal(0)
        row=self.service.update(self.coach,self.klass.public_id,row.public_id,p)
        request=PersonalEnergyPreviewRequest(expected_version=row.version,activity_category='active',activity_overrides={self.student.public_id:'inactive'})
        with self.assertRaises(HTTPException) as error:lesson_preview(self.db,self.coach,self.klass.public_id,row.public_id,request)
        self.assertEqual(error.exception.status_code,422)
