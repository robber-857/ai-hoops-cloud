import unittest
from decimal import Decimal
from types import SimpleNamespace
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.api.deps import get_current_user, get_db
from app.main import create_app
from app.models.enums import UserRole
from app.schemas.energy_reference import EnergyReferenceRequest
from app.services.energy_reference_service import preview


class EnergyReferenceTests(unittest.TestCase):
    def payload(self, **changes):
        return EnergyReferenceRequest(**dict(dict(age_years=12, sex='male', pal='1.8'), **changes))

    def test_published_table_examples_and_conversion(self):
        # Independent examples read from NRV Table 2, including both age endpoints.
        for age, sex, pal, mj, kg, cm, kcal in [
            (4,'male','1.8','6.6','16.2','102.00',1580),
            (12,'male','1.8','10.5','40.5','149.00',2510),
            (18,'female','2.2','13.3','56.2','163.00',3180),
            (18,'male','1.2','9.4','67.2','176.00',2250),
        ]:
            r=preview(self.payload(age_years=age,sex=sex,pal=pal))
            self.assertEqual((r['energy_mj'],r['reference_weight_kg'],r['reference_height_cm'],r['energy_kcal']),(mj,kg,cm,kcal))
            self.assertIsNone(r['meals'])
            self.assertIsNone(r['exercise_energy_kcal'])
            self.assertIsNone(r['macronutrients'])
            self.assertEqual(r['status'],'reference_only')

    def test_all_age_sex_pal_combinations_and_rounding_conservation(self):
        for age in range(4,19):
            for sex in ['male','female']:
                previous=0
                for pal in ['1.2','1.4','1.6','1.8','2.0','2.2']:
                    r=preview(self.payload(age_years=age,sex=sex,pal=pal,meal_shares=dict(breakfast='33.33',lunch='33.33',dinner='33.34')))
                    self.assertGreater(r['energy_kcal'],previous)
                    previous=r['energy_kcal']
                    self.assertEqual(sum(m['energy_kcal'] for m in r['meals']),r['energy_kcal'])
                    for meal in r['meals']:
                        exact=Decimal(r['energy_kcal'])*Decimal(meal['percent'])/100
                        self.assertLess(abs(Decimal(meal['energy_kcal'])-exact),10)
                    self.assertEqual(r['meal_rule_status'],'user_entered_scenario')

    def test_split_is_repeatable_and_not_an_official_default(self):
        request=self.payload(meal_shares=dict(breakfast='30',lunch='40',dinner='30'))
        r=preview(request)
        self.assertEqual([m['energy_kcal'] for m in r['meals']],[750,1010,750])
        self.assertEqual(preview(request),r)
        self.assertIsNone(preview(self.payload())['meals'])

    def test_rejects_unsupported_and_implicit_inputs(self):
        for changes in [dict(age_years=3),dict(age_years=19),dict(age_years=4.5),dict(age_years=True),dict(pal='1.75'),dict(sex=''),dict(weight_kg=40),dict(exercise_energy_kcal=100)]:
            with self.subTest(changes=changes),self.assertRaises(ValidationError):self.payload(**changes)
        for shares in [dict(breakfast=30,lunch=30,dinner=30),dict(breakfast=0,lunch=50,dinner=50),dict(breakfast='NaN',lunch=40,dinner=30),dict(breakfast=30,lunch=70),dict(breakfast='33.333',lunch='33.333',dinner='33.334')]:
            with self.subTest(shares=shares),self.assertRaises(ValidationError):self.payload(meal_shares=shares)
        with self.assertRaises(ValidationError):EnergyReferenceRequest(age_years=12,sex='male')

    def test_api_access_and_validation_without_database_writes(self):
        app=create_app()
        # No DB is provided: these read-only reference endpoints must not query it.
        app.dependency_overrides[get_db]=lambda:None
        try:
            with TestClient(app) as client:
                base='/api/v1/admin/energy-reference'
                self.assertEqual(client.get(base).status_code,401)
                self.assertEqual(client.post(base+'/preview',json=self.payload().model_dump(mode='json')).status_code,401)
                for role in [UserRole.student,UserRole.coach]:
                    app.dependency_overrides[get_current_user]=lambda role=role:SimpleNamespace(role=role)
                    self.assertEqual(client.get(base).status_code,403)
                    self.assertEqual(client.post(base+'/preview',json=self.payload().model_dump(mode='json')).status_code,403)
                app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(role=UserRole.admin)
                self.assertEqual(client.get(base).status_code,200)
                response=client.post(base+'/preview',json=self.payload().model_dump(mode='json'))
                self.assertEqual(response.status_code,200)
                self.assertEqual(response.json()['energy_kcal'],2510)
                self.assertEqual(client.post(base+'/preview',json={'age_years':19,'sex':'male','pal':'1.8'}).status_code,422)
        finally:
            app.dependency_overrides.clear()
