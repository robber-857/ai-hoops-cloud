from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.schemas.class_report import LessonPublish
from app.services.class_report_service import ClassReportService
from app.schemas.personal_energy import PersonalEnergyPreviewRequest
from app.schemas.personal_energy import EnergyDraftSave
from app.services import energy_draft_service
from app.services.personal_energy_service import lesson_preview
router=APIRouter()

@router.get('/exercise-activities')
def exercise_activities(user=Depends(get_current_user)):
    from app.services.exercise_energy_service import metadata
    return metadata()

@router.get('/coach/classes/{class_id}/lessons/{lesson_id}/energy-drafts')
def energy_drafts(class_id:UUID,lesson_id:UUID,offset:int=Query(0,ge=0),user=Depends(get_current_user),db:Session=Depends(get_db)):
    return energy_draft_service.history(db,user,class_id,lesson_id,offset)

@router.post('/coach/classes/{class_id}/lessons/{lesson_id}/energy-drafts')
def save_energy_draft(class_id:UUID,lesson_id:UUID,payload:EnergyDraftSave,user=Depends(get_current_user),db:Session=Depends(get_db)):
    return energy_draft_service.save(db,user,class_id,lesson_id,payload)

@router.post('/coach/classes/{class_id}/lessons/{lesson_id}/energy-preview')
def energy_preview(class_id:UUID,lesson_id:UUID,payload:PersonalEnergyPreviewRequest,user=Depends(get_current_user),db:Session=Depends(get_db)):
    return lesson_preview(db,user,class_id,lesson_id,payload)

@router.get('/coach/classes/{class_id}/lessons/{lesson_id}/report-preview')
def preview(class_id:UUID,lesson_id:UUID,user=Depends(get_current_user),db:Session=Depends(get_db)):
    return ClassReportService(db).preview(user,class_id,lesson_id)

@router.post('/coach/classes/{class_id}/lessons/{lesson_id}/publish-reports')
def publish(class_id:UUID,lesson_id:UUID,payload:LessonPublish,user=Depends(get_current_user),db:Session=Depends(get_db)):
    return ClassReportService(db).publish(user,class_id,lesson_id,payload.expected_version,payload.expected_preview_fingerprint)

@router.get('/me/class-reports')
def mine(limit:int=Query(20,ge=1,le=100),offset:int=Query(0,ge=0),user=Depends(get_current_user),db:Session=Depends(get_db)):
    return ClassReportService(db).mine(user,limit,offset)

@router.get('/me/class-reports/daily')
def daily(held_on:date,user=Depends(get_current_user),db:Session=Depends(get_db)):
    return ClassReportService(db).daily(user,held_on)

@router.get('/me/class-reports/{report_id}')
def detail(report_id:UUID,user=Depends(get_current_user),db:Session=Depends(get_db)):
    service=ClassReportService(db)
    return service.read(service.own(user,report_id))

@router.get('/me/class-reports/{report_id}/history')
def history(report_id:UUID,limit:int=Query(20,ge=1,le=100),offset:int=Query(0,ge=0),user=Depends(get_current_user),db:Session=Depends(get_db)):
    return ClassReportService(db).history(user,report_id,limit,offset)
