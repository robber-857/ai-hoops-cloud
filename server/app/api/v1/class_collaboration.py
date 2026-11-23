from tempfile import SpooledTemporaryFile
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.class_collaboration import (
    ClassInvitationIssued,
    ClassInvitationPreview,
    ClassInvitationStatus,
    ClassInvitationToken,
    ClassJoinRequestDecision,
    ClassJoinRequestRead,
    ClassJoinStatus,
    ClassVideoPlayback,
    ClassVideoRead,
    ClassVideosPage,
)
from app.services.class_collaboration_service import ClassCollaborationService
from app.services.class_video_storage import (
    CLASS_VIDEO_CONTENT_TYPES,
    MAX_CLASS_VIDEO_BYTES,
    ClassVideoStorage,
)

router = APIRouter()
class_base = "/coach/classes/{class_public_id}"


@router.post("/class-invitations/preview", response_model=ClassInvitationPreview)
def preview_invitation(payload: ClassInvitationToken, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return ClassCollaborationService(db).preview_invitation(payload.token)


@router.post("/class-invitations/apply", response_model=ClassJoinStatus)
def apply_to_class(
    payload: ClassInvitationToken, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return ClassCollaborationService(db).apply(user, payload.token)


@router.get(f"{class_base}/invitation", response_model=ClassInvitationStatus)
def invitation_status(
    class_public_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return ClassCollaborationService(db).invitation_status(user, class_public_id)


@router.post(f"{class_base}/invitation", response_model=ClassInvitationIssued, status_code=201)
def issue_invitation(
    class_public_id: UUID, response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    return ClassCollaborationService(db).issue_invitation(user, class_public_id)


@router.delete(f"{class_base}/invitation", status_code=204)
def revoke_invitation(
    class_public_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    ClassCollaborationService(db).revoke_invitation(user, class_public_id)


@router.get(f"{class_base}/join-requests", response_model=list[ClassJoinRequestRead])
def list_join_requests(
    class_public_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return ClassCollaborationService(db).list_requests(user, class_public_id)


@router.patch(f"{class_base}/join-requests/{{request_public_id}}", response_model=ClassJoinRequestRead)
def review_join_request(
    class_public_id: UUID, request_public_id: UUID, payload: ClassJoinRequestDecision,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return ClassCollaborationService(db).review_request(user, class_public_id, request_public_id, payload.decision)


@router.get("/me/class-videos", response_model=ClassVideosPage)
def my_class_videos(
    offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return ClassCollaborationService(db).list_videos(user, offset, limit)


@router.get(f"{class_base}/videos", response_model=ClassVideosPage)
def class_videos(
    class_public_id: UUID, offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return ClassCollaborationService(db).list_videos(user, offset, limit, class_public_id)


def _video_header_matches(header: bytes, content_type: str) -> bool:
    if content_type == "video/mp4":
        return header[4:8] == b"ftyp"
    return header.startswith(b"\x1a\x45\xdf\xa3")


@router.post(f"{class_base}/videos", response_model=ClassVideoRead, status_code=201)
async def upload_class_video(
    class_public_id: UUID, request: Request, title: str = Query(..., min_length=1, max_length=140),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    service = ClassCollaborationService(db)
    await run_in_threadpool(service.class_for_upload, user, class_public_id)
    await run_in_threadpool(db.rollback)
    content_type = request.headers.get("Content-Type", "").partition(";")[0].strip().lower()
    extension = CLASS_VIDEO_CONTENT_TYPES.get(content_type)
    if not extension:
        raise HTTPException(415, "Choose an MP4 or WebM video.")
    title = title.strip()
    if not title:
        raise HTTPException(422, "Enter a video title.")
    storage = ClassVideoStorage()
    object_key = f"{class_public_id}/{uuid4()}.{extension}"

    with SpooledTemporaryFile(max_size=2 * 1024 * 1024, mode="w+b") as file:
        size = 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_CLASS_VIDEO_BYTES:
                raise HTTPException(413, "Video must be 50 MB or smaller.")
            await run_in_threadpool(file.write, chunk)
        await run_in_threadpool(file.seek, 0)
        header = await run_in_threadpool(file.read, 12)
        if not _video_header_matches(header, content_type):
            raise HTTPException(415, "The selected file is not a recognised MP4 or WebM video.")
        await run_in_threadpool(file.seek, 0)

        try:
            await run_in_threadpool(storage.upload, object_key, file, content_type, size)
            return await run_in_threadpool(
                service.publish_video, user, class_public_id, title=title, object_key=object_key,
                content_type=content_type, size_bytes=size,
            )
        except Exception:
            await run_in_threadpool(db.rollback)
            await run_in_threadpool(storage.remove_unpublished, object_key)
            raise


@router.get("/class-videos/{video_public_id}/playback", response_model=ClassVideoPlayback)
def class_video_playback(
    video_public_id: UUID, response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    object_key = ClassCollaborationService(db).get_video_object_key(user, video_public_id)
    response.headers["Cache-Control"] = "private, no-store"
    return ClassVideoPlayback(url=ClassVideoStorage().playback_url(object_key))


@router.delete(f"{class_base}/videos/{{video_public_id}}", status_code=204)
def archive_class_video(
    class_public_id: UUID, video_public_id: UUID,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    ClassCollaborationService(db).archive_video(user, class_public_id, video_public_id)
