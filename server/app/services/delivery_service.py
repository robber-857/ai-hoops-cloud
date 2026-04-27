from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.models.enums import VerificationScene, VerificationTargetType

logger = logging.getLogger(__name__)


class DeliveryService:
    def send_verification_code(
        self,
        *,
        target: str,
        target_type: VerificationTargetType,
        scene: VerificationScene,
        code: str,
    ) -> None:
        if target_type == VerificationTargetType.email:
            self._send_email_code(target=target, scene=scene, code=code)
            return

        self._send_phone_code(target=target, scene=scene, code=code)

    def _send_email_code(self, *, target: str, scene: VerificationScene, code: str) -> None:
        if not settings.smtp_password:
            if settings.is_production:
                raise RuntimeError("SMTP credentials are not configured.")

            logger.warning(
                "SMTP credentials missing. Verification code for %s (%s): %s",
                target,
                scene.value,
                code,
            )
            return

        message = EmailMessage()
        message["Subject"] = f"AI Hoops verification code: {code}"
        message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        message["To"] = target
        message.set_content(
            "\n".join(
                [
                    "Your AI Hoops verification code is below:",
                    "",
                    code,
                    "",
                    f"This code is for the {scene.value} flow and expires in "
                    f"{settings.verification_code_expire_seconds // 60} minutes.",
                    "",
                    "If you did not request this code, you can ignore this email.",
                ]
            )
        )

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_starttls:
                smtp.starttls()
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)

    def _send_phone_code(self, *, target: str, scene: VerificationScene, code: str) -> None:
        if settings.is_production:
            raise RuntimeError("SMS delivery provider is not configured yet.")

        logger.warning(
            "SMS provider missing. Verification code for %s (%s): %s",
            target,
            scene.value,
            code,
        )
