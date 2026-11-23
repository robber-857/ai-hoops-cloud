"""Backend-only storage for class videos."""

import json
import logging
from typing import BinaryIO
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import HTTPException

from app.core.config import settings

MAX_CLASS_VIDEO_BYTES = 50_000_000
CLASS_VIDEO_CONTENT_TYPES = {"video/mp4": "mp4", "video/webm": "webm"}
PLAYBACK_LIFETIME_SECONDS = 600

logger = logging.getLogger(__name__)


class ClassVideoStorage:
    def __init__(self):
        root = settings.class_video_supabase_url
        key = settings.class_video_supabase_key
        if not root or not key:
            raise HTTPException(503, "Class video storage has not been configured.")

        self.base_url = f"{root.rstrip('/')}/storage/v1"
        self.bucket = quote(settings.class_video_bucket, safe="")
        self.headers = {"apikey": key}
        if not key.startswith("sb_secret_"):
            self.headers["Authorization"] = f"Bearer {key}"

    def _request(self, method: str, path: str, *, data=None, headers=None):
        request = Request(
            f"{self.base_url}{path}", data=data, headers={**self.headers, **(headers or {})}, method=method,
        )
        try:
            with urlopen(request, timeout=90) as result:
                body = result.read()
            return json.loads(body) if body else None
        except HTTPError as error:
            logger.warning("Class video storage returned HTTP %s for %s", error.code, method)
            raise HTTPException(502, "Class video storage is temporarily unavailable.") from error
        except (URLError, TimeoutError, OSError, ValueError) as error:
            logger.warning("Class video storage request failed for %s", method)
            raise HTTPException(502, "Class video storage is temporarily unavailable.") from error

    def _ensure_private_bucket(self):
        bucket = self._request("GET", f"/bucket/{self.bucket}")
        if not isinstance(bucket, dict) or bucket.get("public") is not False:
            raise HTTPException(503, "Class videos require a private storage bucket.")

    def upload(self, object_key: str, file: BinaryIO, content_type: str, size: int) -> None:
        self._ensure_private_bucket()
        self._request("POST", f"/object/{self.bucket}/{quote(object_key)}", data=file, headers={
            "Content-Type": content_type, "Content-Length": str(size), "x-upsert": "false",
            "Cache-Control": "max-age=0",
        })

    def remove_unpublished(self, object_key: str) -> None:
        try:
            self._request("DELETE", f"/object/{self.bucket}/{quote(object_key)}")
        except HTTPException:
            logger.warning("Unable to remove unpublished class video object %s", object_key)

    def playback_url(self, object_key: str) -> str:
        self._ensure_private_bucket()
        path = f"/object/sign/{self.bucket}/{quote(object_key)}"
        result = self._request(
            "POST", path,
            data=json.dumps({"expiresIn": PLAYBACK_LIFETIME_SECONDS}).encode(),
            headers={"Content-Type": "application/json"},
        )
        signed = result.get("signedURL") if isinstance(result, dict) else None
        if not isinstance(signed, str) or not signed.startswith(f"{path}?"):
            raise HTTPException(502, "Class video playback is temporarily unavailable.")
        return f"{self.base_url}{signed}"
