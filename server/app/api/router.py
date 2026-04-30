from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.coach import router as coach_router
from app.api.v1.me import router as me_router
from app.api.v1.reports import router as reports_router
from app.api.v1.training_templates import router as templates_router
from app.api.v1.uploads import router as uploads_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(uploads_router, prefix="/uploads", tags=["uploads"])
api_router.include_router(reports_router, prefix="/reports", tags=["reports"])
api_router.include_router(me_router, prefix="/me", tags=["me"])
api_router.include_router(templates_router, prefix="/training-templates", tags=["training-templates"])
api_router.include_router(coach_router, prefix="/coach", tags=["coach"])
