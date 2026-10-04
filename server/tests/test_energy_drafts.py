import os
import unittest
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import select,func,text
from sqlalchemy.orm import Session
from sqlalchemy.exc import DBAPIError
from fastapi import HTTPException
from fastapi.testclient import TestClient
import test_personal_energy as fixtures
from app.main import create_app
from app.api.deps import get_current_user,get_db
from app.models.user import User
from app.models.notification import Notification
from app.models.energy_draft import EnergyDraft
from app.schemas.personal_energy import EnergyDraftSave
from app.services.personal_energy_service import lesson_preview
from app.services.energy_draft_service import save,history


@unittest.skipUnless(os.environ.get('PLAYER_PROFILE_TEST_DATABASE_URL'),'Dedicated PostgreSQL required')
class EnergyDraftTests(unittest.TestCase):
    setUpClass=classmethod(fixtures.PersonalEnergyIntegrationTests.setUpClass.__func__)
    tearDownClass=classmethod(fixtures.PersonalEnergyIntegrationTests.tearDownClass.__func__)
    setUp=fixtures.PersonalEnergyIntegrationTests.setUp
    tearDown=fixtures.PersonalEnergyIntegrationTests.tearDown
    user=fixtures.PersonalEnergyIntegrationTests.user
    make_plan=fixtures.PersonalEnergyIntegrationTests.make_plan
    create=fixtures.PersonalEnergyIntegrationTests.create
    update_payload=fixtures.PersonalEnergyIntegrationTests.update_payload
    confirmed=fixtures.PersonalEnergyIntegrationTests.confirmed
    add_profile=fixtures.PersonalEnergyIntegrationTests.add_profile
    request=fixtures.PersonalEnergyIntegrationTests.request

    def payload(self,row,revision=0):
        preview=lesson_preview(self.db,self.coach,self.klass.public_id,row.public_id,self.request(row))
        return EnergyDraftSave(**self.request(row).model_dump(),request_id=uuid4(),expected_revision=revision,preview_token=preview['preview_token'])

    def test_save_retry_history_no_notification_and_no_updates(self):
        row=self.confirmed();self.add_profile();p=self.payload(row)
        before=self.db.scalar(select(func.count(Notification.id)))
        first=save(self.db,self.coach,self.klass.public_id,row.public_id,p)
        self.assertEqual(save(self.db,self.coach,self.klass.public_id,row.public_id,p),first)
        self.assertEqual(history(self.db,self.coach,self.klass.public_id,row.public_id)['latest_revision'],1)
        self.add_profile(60)
        second=save(self.db,self.coach,self.klass.public_id,row.public_id,self.payload(row,1))
        self.assertEqual(second['revision'],2)
        self.assertEqual(history(self.db,self.coach,self.klass.public_id,row.public_id)['items'][1]['snapshot'],first['snapshot'])
        self.assertEqual(self.db.scalar(select(func.count(Notification.id))),before)
        with self.assertRaises(DBAPIError):self.db.execute(text('UPDATE energy_review_drafts SET revision=revision WHERE public_id=:id'),{'id':first['public_id']})
        self.db.rollback()

    def test_stale_preview_revision_and_reused_key_are_rejected(self):
        row=self.confirmed();self.add_profile();p=self.payload(row)
        self.add_profile(60)
        with self.assertRaises(HTTPException) as error:save(self.db,self.coach,self.klass.public_id,row.public_id,p)
        self.assertEqual(error.exception.status_code,409)
        p=self.payload(row);save(self.db,self.coach,self.klass.public_id,row.public_id,p)
        with self.assertRaises(HTTPException):save(self.db,self.coach,self.klass.public_id,row.public_id,self.payload(row))
        with self.assertRaises(HTTPException):save(self.db,self.coach,self.klass.public_id,row.public_id,p.model_copy(update={'activity_category':'inactive'}))
        self.assertEqual(history(self.db,self.coach,self.klass.public_id,row.public_id)['latest_revision'],1)

    def test_concurrent_same_request_is_one_revision(self):
        row=self.confirmed();self.add_profile();p=self.payload(row)
        coach_id=self.coach.id;class_id=self.klass.public_id;lesson_id=row.public_id
        self.db.rollback()
        def run(_):
            with Session(self.engine) as db:return save(db,db.get(User,coach_id),class_id,lesson_id,p)['public_id']
        with ThreadPoolExecutor(max_workers=2) as pool:ids=list(pool.map(run,range(2)))
        self.assertEqual(ids[0],ids[1])

    def test_individual_selections_survive_save_retry_and_history(self):
        row=self.confirmed();self.add_profile()
        request=self.request(row).model_copy(update={'activity_overrides':{self.student.public_id:'inactive'}})
        preview=lesson_preview(self.db,self.coach,self.klass.public_id,row.public_id,request)
        payload=EnergyDraftSave(**request.model_dump(),request_id=uuid4(),expected_revision=0,preview_token=preview['preview_token'])
        saved=save(self.db,self.coach,self.klass.public_id,row.public_id,payload)
        self.assertEqual(saved['snapshot']['activity_overrides'],{str(self.student.public_id):'inactive'})
        self.assertEqual(save(self.db,self.coach,self.klass.public_id,row.public_id,payload),saved)
        save(self.db,self.coach,self.klass.public_id,row.public_id,self.payload(row,1))
        self.assertEqual(history(self.db,self.coach,self.klass.public_id,row.public_id)['items'][1]['snapshot'],saved['snapshot'])

    def test_api_permissions_and_changed_lesson(self):
        row=self.confirmed();p=self.payload(row);save(self.db,self.coach,self.klass.public_id,row.public_id,p)
        changed=self.service.update(self.coach,self.klass.public_id,row.public_id,self.update_payload(row))
        self.assertTrue(history(self.db,self.coach,self.klass.public_id,row.public_id)['items'][0]['lesson_changed'])
        app=create_app();app.dependency_overrides[get_db]=lambda:self.db
        path=f'/api/v1/coach/classes/{self.klass.public_id}/lessons/{row.public_id}/energy-drafts'
        try:
            with TestClient(app) as client:
                self.assertEqual(client.get(path).status_code,401)
                for user in [self.student,self.outsider]:
                    app.dependency_overrides[get_current_user]=lambda:user
                    self.assertIn(client.get(path).status_code,[403,404])
                    self.assertIn(client.post(path,json=p.model_dump(mode='json')).status_code,[403,404])
                app.dependency_overrides[get_current_user]=lambda:self.coach
                self.assertEqual(client.get(path).status_code,200)
                self.assertEqual(client.post(path,json=self.payload(changed,1).model_dump(mode='json')).status_code,200)
        finally:app.dependency_overrides.clear()
