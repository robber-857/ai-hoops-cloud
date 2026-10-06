"""Isolated, repeatable local examples; never publish candidate nutrition."""
from uuid import UUID
from decimal import Decimal
from sqlalchemy import create_engine, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from app.main import create_app
from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User
from app.models.enums import UserRole
from app.models.training_camp import TrainingCamp
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.player_profile_revision import PlayerProfileRevision
from app.models.camp_plan import CampPlan
from app.models.camp_lesson import CampLesson
from app.schemas.camp_plan import PlanCreate
from app.schemas.camp_lesson import LessonCreate, LessonUpdate, LessonContent
from app.services.camp_plan_service import CampPlanService
from app.services.camp_lesson_service import CampLessonService

url=make_url(settings.database_url)
if not (url.host=='127.0.0.1' and url.port==55439 and url.database=='ai_hoops_recipe_demo'):
    raise RuntimeError('Only the dedicated local demo database is allowed.')
with Session(create_engine(url)) as db:
    coach=db.scalar(select(User).where(User.username=='p3_coach'))
    absent=db.scalar(select(User).where(User.username=='p6_demo_peer'))
    camp=db.scalar(select(TrainingCamp).where(TrainingCamp.code=='local_p6_demo'))
    assert coach and absent and camp, 'Run seed_class_report_demo first.'
    players=[]
    for username,name in [('p6_energy_player','Alex (energy demo)'),('p6_energy_missing','Sam (energy demo)')]:
        player=db.scalar(select(User).where(User.username==username))
        if player is None:
            player=User(username=username,email=username+'@example.com',nickname=name,role=UserRole.student,password_hash=hash_password('P3-fixture-only-2026'))
            db.add(player);db.flush()
        players.append(player)
    profile_id=UUID('a10c0000-0000-4000-9000-000000000301')
    if db.scalar(select(PlayerProfileRevision).where(PlayerProfileRevision.public_id==profile_id)) is None:
        db.add(PlayerProfileRevision(public_id=profile_id,user_id=players[0].id,date_of_birth='2014-10-01',measured_on='2026-09-01',sex='male',height_cm=150,weight_kg=40))
    klass=db.scalar(select(CampClass).where(CampClass.code=='local_p6_energy_demo'))
    if klass is None:
        klass=CampClass(camp_id=camp.id,name='Energy review class (local demo)',code='local_p6_energy_demo');db.add(klass);db.flush()
        for person in [coach,*players,absent]:
            db.add(ClassMember(class_id=klass.id,user_id=person.id,member_role='coach' if person.id==coach.id else 'student',status='active'))
    db.commit()
    plan_id=UUID('a10c0000-0000-4000-9000-000000000302')
    plan=db.scalar(select(CampPlan).where(CampPlan.public_id==plan_id))
    if plan is None:
        service=CampPlanService(db)
        plan=service.create(coach,klass.public_id,PlanCreate(request_id=plan_id,title='Energy review practice (local demo)',planned_on='2026-10-01',items=[dict(name='Warm-up',duration_minutes=10),dict(name='Ball handling',duration_minutes=20)]))
        service.publish(coach,klass.public_id,plan_id,plan.version)
    lesson_id=UUID('a10c0000-0000-4000-9000-000000000303')
    if db.scalar(select(CampLesson).where(CampLesson.public_id==lesson_id)) is None:
        service=CampLessonService(db)
        row=service.create(coach,klass.public_id,LessonCreate(request_id=lesson_id,plan_public_id=plan_id,held_on='2026-10-01'))
        payload=LessonUpdate(**{k:v for k,v in row.model_dump(mode='json').items() if k in LessonContent.model_fields},request_id=UUID('a10c0000-0000-4000-9000-000000000304'),expected_version=row.version)
        for item,minutes in zip(payload.items,[10,20]):item.actual_minutes=Decimal(minutes)
        for person in payload.participants:
            person.status='absent' if person.student_public_id==absent.public_id else 'present'
            for entry,item in zip(person.items,payload.items):entry.minutes=Decimal(0) if person.status=='absent' else item.actual_minutes
        service.update(coach,klass.public_id,lesson_id,payload)
    print('Personal energy demo ready; class:',klass.public_id,'lesson:',lesson_id)
