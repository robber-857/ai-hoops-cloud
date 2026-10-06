"""Create a repeatable class/lesson fixture only in the isolated local demo DB."""
from uuid import UUID
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from app.main import create_app
from app.models.user import User
from app.models.enums import UserRole
from app.core.security import hash_password
from app.models.training_camp import TrainingCamp
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.camp_plan import CampPlan
from app.models.camp_lesson import CampLesson
from app.services.camp_plan_service import CampPlanService
from app.services.camp_lesson_service import CampLessonService
from app.schemas.camp_plan import PlanCreate
from app.schemas.camp_lesson import LessonCreate,LessonUpdate,LessonContent
url=make_url(settings.database_url)
assert url.host=='127.0.0.1' and url.port==55439 and url.database=='ai_hoops_recipe_demo'
with Session(create_engine(url)) as db:
    coach=db.scalar(select(User).where(User.username=='p3_coach'))
    student=db.scalar(select(User).where(User.username=='p3_student'))
    peer=db.scalar(select(User).where(User.username=='p6_demo_peer'))
    if peer is None:
        peer=User(username='p6_demo_peer',email='p6_demo_peer@example.com',nickname='Jamie (local demo)',password_hash=hash_password('P3-fixture-only-2026'),role=UserRole.student)
        db.add(peer);db.flush()
    camp=db.scalar(select(TrainingCamp).where(TrainingCamp.code=='local_p6_demo'))
    if camp is None:
        camp=TrainingCamp(name='Local demo camp',code='local_p6_demo');db.add(camp);db.flush()
    klass=db.scalar(select(CampClass).where(CampClass.code=='local_p6_demo'))
    if klass is None:
        klass=CampClass(camp_id=camp.id,name='Basketball class (local demo)',code='local_p6_demo');db.add(klass);db.flush()
        for person,role in [(coach,'coach'),(student,'student'),(peer,'student')]:
            db.add(ClassMember(class_id=klass.id,user_id=person.id,member_role=role,status='active'))
    db.commit()
    plans=CampPlanService(db);lessons=CampLessonService(db)
    plan_id=UUID('a10c0000-0000-4000-9000-000000000101')
    plan=db.scalar(select(CampPlan).where(CampPlan.public_id==plan_id))
    if plan is None:
        plan=plans.create(coach,klass.public_id,PlanCreate(request_id=plan_id,title='Basketball practice (local demo)',planned_on='2026-09-30',items=[dict(name='Warm-up',duration_minutes=10),dict(name='Ball handling',duration_minutes=20)]))
        plans.publish(coach,klass.public_id,plan.public_id,plan.version)
    lesson_id=UUID('a10c0000-0000-4000-9000-000000000201')
    lesson=db.scalar(select(CampLesson).where(CampLesson.public_id==lesson_id))
    if lesson is None:
        lesson=lessons.create(coach,klass.public_id,LessonCreate(request_id=lesson_id,plan_public_id=plan_id,held_on='2026-09-30'))
        payload=LessonUpdate(**{k:v for k,v in lesson.model_dump(mode='json').items() if k in LessonContent.model_fields},request_id=UUID('a10c0000-0000-4000-9000-000000000202'),expected_version=lesson.version)
        for item,minutes in zip(payload.items,[10,20]): item.actual_minutes=Decimal(minutes)
        for person in payload.participants:
            person.status='absent' if person.student_public_id==peer.public_id else 'present'
            for entry,item in zip(person.items,payload.items): entry.minutes=Decimal(0) if person.status=='absent' else item.actual_minutes
        lessons.update(coach,klass.public_id,lesson_id,payload)
    print('Local demo class:',klass.public_id,'lesson:',lesson_id)
