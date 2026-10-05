import json
from hashlib import sha256
from fastapi import HTTPException
from sqlalchemy import select, func
from app.models.energy_draft import EnergyDraft
from app.services.camp_lesson_service import CampLessonService
from app.services.personal_energy_service import lesson_preview


def read(row, lesson):
    return dict(public_id=str(row.public_id),revision=row.revision,created_at=row.created_at,
                status='pending_review',lesson_changed=row.snapshot['lesson_version']!=lesson.version,
                snapshot=row.snapshot)


def history(db,user,class_id,lesson_id,offset=0):
    lesson=CampLessonService(db)._lesson(user,class_id,lesson_id)
    rows=db.scalars(select(EnergyDraft).where(EnergyDraft.lesson_id==lesson.id)
                    .order_by(EnergyDraft.revision.desc()).offset(offset).limit(21)).all()
    latest=(rows[0].revision if rows else 0) if offset==0 else (db.scalar(select(func.max(EnergyDraft.revision)).where(EnergyDraft.lesson_id==lesson.id)) or 0)
    return dict(items=[read(r,lesson) for r in rows[:20]],latest_revision=latest,has_more=len(rows)>20)


def save(db,user,class_id,lesson_id,payload):
    lesson=CampLessonService(db)._lesson(user,class_id,lesson_id,lock=True)
    request_data=payload.model_dump(mode='json')
    # Preserve retry identity for requests saved before individual scenarios existed.
    if not request_data['activity_overrides']:
        request_data.pop('activity_overrides')
    request_hash=sha256(json.dumps(request_data,sort_keys=True).encode()).hexdigest()
    old=db.scalar(select(EnergyDraft).where(EnergyDraft.lesson_id==lesson.id,EnergyDraft.request_id==payload.request_id))
    if old:
        if old.request_hash!=request_hash:
            raise HTTPException(409,'This save request was already used for different inputs.')
        return read(old,lesson)
    latest=db.scalar(select(func.max(EnergyDraft.revision)).where(EnergyDraft.lesson_id==lesson.id)) or 0
    if latest!=payload.expected_revision:
        raise HTTPException(409,'Another draft was saved. Reload draft history before saving again.')
    snapshot=lesson_preview(db,user,class_id,lesson_id,payload)
    if snapshot['preview_token']!=payload.preview_token:
        raise HTTPException(409,'Inputs or calculation rules changed. Preview again before saving.')
    if snapshot['blockers']:
        raise HTTPException(422,'Resolve the lesson participation before saving an energy review.')
    row=EnergyDraft(lesson_id=lesson.id,revision=latest+1,created_by=user.id,
                    request_id=payload.request_id,request_hash=request_hash,snapshot=snapshot)
    try:
        db.add(row);db.commit();db.refresh(row)
    except Exception:
        db.rollback();raise
    return read(row,lesson)
