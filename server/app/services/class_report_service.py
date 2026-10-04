from datetime import date
from decimal import Decimal
from hashlib import sha256
import json
from fastapi import HTTPException
from sqlalchemy import select, func
from app.models.class_report import LessonPublication, ClassReport
from app.models.camp_lesson import CampLesson
from app.models.camp_class import CampClass
from app.models.user import User
from app.models.player_profile_revision import PlayerProfileRevision
from app.models.notification import Notification
from app.schemas.camp_lesson import LessonContent
from app.schemas.player_profile import PlayerProfileRead
from app.services.camp_lesson_service import CampLessonService
from app.services.display_names import staff_display_name
from app.services.class_report_energy import aggregate_exercise_energy

class ClassReportService:
    def __init__(self, db):
        self.db = db

    @staticmethod
    def preview_fingerprint(reports):
        body = json.dumps([snapshot for _, snapshot in reports], sort_keys=True,
                          ensure_ascii=False, separators=(',', ':'))
        return sha256(body.encode('utf-8')).hexdigest()

    def prepare(self, row):
        content = LessonContent(**row.content).model_dump(mode='json')
        klass = self.db.get(CampClass, row.class_id)
        blockers = []
        if any(i['actual_minutes'] is None for i in content['items']):
            blockers.append('Record actual duration for every activity before publishing.')
        if not content['participants']:
            blockers.append('A lesson must have a recorded roster.')
        people = {str(u.public_id): u for u in self.db.scalars(select(User).where(
            User.public_id.in_([p['student_public_id'] for p in content['participants']])))}
        reports = []
        for person in content['participants']:
            student = people.get(person['student_public_id'])
            if student is None:
                blockers.append('A player is unavailable. Resolve the lesson roster before publishing.')
                continue
            name = staff_display_name(student)
            if person['status'] == 'unconfirmed':
                blockers.append(f'Confirm participation for {name} before publishing.')
                continue
            profile = self.db.scalar(select(PlayerProfileRevision).where(
                PlayerProfileRevision.user_id == student.id,
                PlayerProfileRevision.measured_on <= row.held_on,
            ).order_by(PlayerProfileRevision.measured_on.desc(), PlayerProfileRevision.created_at.desc(), PlayerProfileRevision.id.desc()).limit(1))
            minutes = {i['item_id']: i['minutes'] for i in person['items']}
            frozen_profile = PlayerProfileRead.model_validate(profile).model_dump(mode='json') if profile else None
            from app.services.exercise_energy_service import calculate_lesson
            exercise_energy = calculate_lesson(
                [dict(i, minutes=minutes[i['item_id']]) for i in content['items']],
                frozen_profile, row.held_on,
            )
            if person['status'] == 'absent':
                exercise_energy.update(status='not_applicable', total_kcal=None,
                    known_subtotal_kcal=None, unrounded_subtotal_kcal=None,
                    missing_items=0, methods=[], items=[])
            # Each player receives only their own participation and profile, never the class roster.
            snapshot = dict(
                title=content['title'], class_name=klass.name, held_on=content['held_on'],
                timezone='Australia/Sydney', lesson_public_id=str(row.public_id), lesson_version=row.version,
                student_name=name, attendance=person['status'],
                report_kind='attendance_only' if person['status']=='absent' else 'training_record',
                items=[dict(name=i['name'], actual_minutes=i['actual_minutes'], minutes=minutes[i['item_id']], notes=i['notes'], activity_code=i['activity_code'], intensity=i['intensity']) for i in content['items']],
                total_minutes=str(sum((Decimal(v or '0') for v in minutes.values()), Decimal(0))),
                notes=person['notes'], lesson_notes=content['notes'],
                profile=frozen_profile,
                profile_status='recorded' if profile else 'missing_at_lesson_date',
                nutrition=dict(status='not_applicable' if person['status']=='absent' else 'rules_pending', rule_version=None, energy_kcal=None, meals=None),
                exercise_energy=exercise_energy,
                schema_version='class-report-v2',
            )
            reports.append((student, snapshot))
        return blockers, reports

    def preview(self, user, class_id, lesson_id):
        row = CampLessonService(self.db)._lesson(user, class_id, lesson_id)
        existing = self.db.scalar(select(LessonPublication).where(LessonPublication.lesson_id==row.id, LessonPublication.lesson_version==row.version))
        if existing:
            return dict(lesson_version=row.version, blockers=[], already_published=True, reports=self.receipt(existing)['reports'], preview_fingerprint=None)
        blockers, reports = self.prepare(row)
        return dict(lesson_version=row.version, blockers=blockers, already_published=False, reports=[snapshot for _, snapshot in reports], preview_fingerprint=self.preview_fingerprint(reports))

    def energy_preview_source(self, user, class_id, lesson_id):
        """Staff-only identities for matching personal inputs, including old publications."""
        row = CampLessonService(self.db)._lesson(user, class_id, lesson_id)
        existing = self.db.scalar(select(LessonPublication).where(LessonPublication.lesson_id==row.id, LessonPublication.lesson_version==row.version))
        if existing:
            pairs = self.db.execute(select(User.public_id, ClassReport.snapshot).join(User, User.id==ClassReport.student_id)
                                   .where(ClassReport.publication_id==existing.id).order_by(ClassReport.id)).all()
            blockers = []
        else:
            blockers, prepared = self.prepare(row)
            pairs = [(student.public_id, snapshot) for student, snapshot in prepared]
        return dict(lesson_version=row.version, blockers=blockers, already_published=bool(existing),
                    reports=[dict(snapshot, student_public_id=str(identity)) for identity, snapshot in pairs])

    def receipt(self, publication):
        reports = self.db.scalars(select(ClassReport).where(ClassReport.publication_id==publication.id).order_by(ClassReport.id)).all()
        return dict(public_id=str(publication.public_id), lesson_version=publication.lesson_version,
                    published_at=publication.created_at, reports=[self.read(r) for r in reports])

    def publish(self, user, class_id, lesson_id, version, preview_fingerprint=None):
        row = CampLessonService(self.db)._lesson(user, class_id, lesson_id, lock=True)
        previous = self.db.scalar(select(LessonPublication).where(LessonPublication.lesson_id==row.id, LessonPublication.lesson_version==version))
        if previous:
            return self.receipt(previous)
        if row.version != version:
            raise HTTPException(409, 'Lesson changed. Reload and preview the saved lesson again.')
        blockers, reports = self.prepare(row)
        if blockers:
            raise HTTPException(422, ' '.join(blockers))
        if not preview_fingerprint:
            raise HTTPException(409, 'Preview the saved lesson before publishing its class records.')
        if preview_fingerprint != self.preview_fingerprint(reports):
            raise HTTPException(409, 'Profile or calculation inputs changed. Reload and preview the saved lesson again before publishing.')
        publication = LessonPublication(lesson_id=row.id, lesson_version=version, published_by_user_id=user.id,
            snapshot=dict(content=row.content, source_plan=row.source_plan, roster=row.roster, timezone='Australia/Sydney'))
        try:
            self.db.add(publication)
            self.db.flush()
            for student, snapshot in reports:
                report = ClassReport(publication_id=publication.id, student_id=student.id, snapshot=snapshot)
                self.db.add(report)
                self.db.flush()
                self.db.add(Notification(user_id=student.id, type='class_report', title='Your class record is available',
                    content=f"{snapshot['title']} · {snapshot['held_on']} · saved lesson v{version}. View Class reports in your personal center.",
                    business_type='class_report', business_id=report.id))
            # One transaction: no partial batch or notification can escape a failed publication.
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return self.receipt(publication)

    def read(self, report):
        publication = self.db.get(LessonPublication, report.publication_id)
        latest = self.db.scalar(select(func.max(LessonPublication.lesson_version)).where(LessonPublication.lesson_id==publication.lesson_id))
        return dict(public_id=str(report.public_id), published_at=publication.created_at,
                    is_latest=publication.lesson_version==latest, **report.snapshot)

    def mine(self, user, limit=20, offset=0):
        latest = select(LessonPublication.lesson_id, func.max(LessonPublication.lesson_version).label('version')).group_by(LessonPublication.lesson_id).subquery()
        rows = self.db.scalars(select(ClassReport).join(LessonPublication).join(latest,
            (latest.c.lesson_id==LessonPublication.lesson_id)&(latest.c.version==LessonPublication.lesson_version))
            .where(ClassReport.student_id==user.id).order_by(LessonPublication.created_at.desc(),ClassReport.id.desc()).offset(offset).limit(limit+1)).all()
        return dict(items=[self.read(r) for r in rows[:limit]],has_more=len(rows)>limit)

    def own(self, user, report_id):
        report = self.db.scalar(select(ClassReport).where(ClassReport.public_id==report_id,ClassReport.student_id==user.id))
        if not report:
            raise HTTPException(404,'Class report not found.')
        return report

    def daily(self, user, held_on: date):
        # Select the latest publication BEFORE filtering its snapshot date. A
        # correction moving a lesson to another day must remove it from the old day.
        latest = select(
            LessonPublication.lesson_id,
            func.max(LessonPublication.lesson_version).label('version'),
        ).group_by(LessonPublication.lesson_id).subquery()
        rows = self.db.execute(
            select(ClassReport, LessonPublication.created_at)
            .join(LessonPublication)
            .join(latest, (latest.c.lesson_id == LessonPublication.lesson_id)
                  & (latest.c.version == LessonPublication.lesson_version))
            .where(ClassReport.student_id == user.id,
                   ClassReport.snapshot['held_on'].astext == held_on.isoformat())
            .order_by(LessonPublication.created_at, ClassReport.id)
        ).all()
        # One statement gives a consistent set of sources during concurrent publication.
        reports = [dict(**report.snapshot, public_id=str(report.public_id),
                        published_at=published_at, is_latest=True)
                   for report, published_at in rows]
        absent = sum(r['attendance'] == 'absent' for r in reports)
        return dict(
            held_on=held_on.isoformat(), timezone='Australia/Sydney',
            published_lessons=len(reports), attended_lessons=len(reports)-absent,
            absent_lessons=absent,
            total_minutes=str(sum((Decimal(r['total_minutes']) for r in reports), Decimal(0))),
            reports=reports,
            exercise_energy=aggregate_exercise_energy(reports),
        )

    def history(self, user, report_id, limit=20, offset=0):
        report = self.own(user,report_id)
        publication = self.db.get(LessonPublication,report.publication_id)
        rows=self.db.scalars(select(ClassReport).join(LessonPublication).where(
            ClassReport.student_id==user.id,LessonPublication.lesson_id==publication.lesson_id)
            .order_by(LessonPublication.lesson_version.desc()).offset(offset).limit(limit+1)).all()
        return dict(items=[self.read(r) for r in rows[:limit]],has_more=len(rows)>limit)
