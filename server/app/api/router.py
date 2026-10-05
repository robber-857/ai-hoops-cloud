from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.recipes import router as recipes_router
from app.api.v1.foods import router as foods_router
from app.api.v1.energy_reference import router as energy_reference_router
from app.api.v1.auth import router as auth_router
from app.api.v1.coach import router as coach_router
from app.api.v1.camp_plans import router as camp_plans_router
from app.api.v1.camp_lessons import router as camp_lessons_router
from app.api.v1.me import router as me_router
from app.api.v1.reports import router as reports_router
from app.api.v1.training_templates import router as templates_router
from app.api.v1.uploads import router as uploads_router

api_router = APIRouter()
api_router.include_router(foods_router, tags=['training-foods'])
api_router.include_router(energy_reference_router, tags=['energy-reference'])
api_router.include_router(recipes_router, tags=["food-recipes"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(uploads_router, prefix="/uploads", tags=["uploads"])
api_router.include_router(reports_router, prefix="/reports", tags=["reports"])
api_router.include_router(me_router, prefix="/me", tags=["me"])
api_router.include_router(templates_router, prefix="/training-templates", tags=["training-templates"])
api_router.include_router(coach_router, prefix="/coach", tags=["coach"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])

api_router.include_router(camp_plans_router, tags=['camp-plans'])
api_router.include_router(camp_lessons_router, tags=['camp-lessons'])

from app.api.v1.class_reports import router as class_reports_router
api_router.include_router(class_reports_router, tags=['class-reports'])
