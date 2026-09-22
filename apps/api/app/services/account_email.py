from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from functools import partial
from html import escape

from anyio import to_thread

from app.core.config import Settings

logger = logging.getLogger(__name__)


class VerificationEmailDeliveryError(RuntimeError):
    """Raised when an account verification message cannot be delivered."""


class StaffInvitationEmailDeliveryError(RuntimeError):
    """Raised when a staff invitation message cannot be delivered."""


async def send_account_verification_email(
    *,
    recipient_email: str,
    recipient_name: str,
    code: str,
    expires_in_seconds: int,
    settings: Settings,
) -> None:
    """Deliver an account confirmation code without blocking the event loop."""

    if settings.email_smtp_host is None or settings.email_from_address is None:
        if settings.environment in {"local", "test"}:
            logger.info("Account verification e-mail prepared in local/test mode")
            return
        raise VerificationEmailDeliveryError("Account verification e-mail is not configured")

    message = _verification_message(
        recipient_email=recipient_email,
        recipient_name=recipient_name,
        code=code,
        expires_in_seconds=expires_in_seconds,
        settings=settings,
    )
    try:
        await to_thread.run_sync(partial(_send_message, message=message, settings=settings))
    except (OSError, smtplib.SMTPException) as exc:
        if settings.environment in {"local", "test"}:
            logger.warning(
                "Account verification e-mail delivery skipped in local/test mode"
            )
            return
        logger.warning("Account verification e-mail delivery failed", exc_info=True)
        raise VerificationEmailDeliveryError("Account verification e-mail delivery failed") from exc


async def send_staff_invitation_email(
    *,
    recipient_email: str,
    salon_name: str,
    activation_url: str,
    expires_in_seconds: int,
    settings: Settings,
) -> None:
    """Deliver the one-time staff activation link without blocking the event loop."""

    if settings.email_smtp_host is None or settings.email_from_address is None:
        if settings.environment in {"local", "test"}:
            logger.info("Staff invitation e-mail prepared in local/test mode")
            return
        raise StaffInvitationEmailDeliveryError("Staff invitation e-mail is not configured")

    message = _staff_invitation_message(
        recipient_email=recipient_email,
        salon_name=salon_name,
        activation_url=activation_url,
        expires_in_seconds=expires_in_seconds,
        settings=settings,
    )
    try:
        await to_thread.run_sync(partial(_send_message, message=message, settings=settings))
    except (OSError, smtplib.SMTPException) as exc:
        if settings.environment in {"local", "test"}:
            logger.warning("Staff invitation delivery skipped in local/test mode")
            return
        logger.warning("Staff invitation delivery failed", exc_info=True)
        raise StaffInvitationEmailDeliveryError("Staff invitation delivery failed") from exc


def _verification_message(
    *,
    recipient_email: str,
    recipient_name: str,
    code: str,
    expires_in_seconds: int,
    settings: Settings,
) -> EmailMessage:
    minutes = max(1, expires_in_seconds // 60)
    display_name = recipient_name.strip() or "Klientko"
    safe_name = escape(display_name)
    card_style = (
        "background:#fff;border:1px solid #eadfe1;border-radius:24px;padding:36px;text-align:center"
    )
    brand_style = (
        "margin:0 0 8px;color:#8f5263;font-size:13px;font-weight:700;"
        "letter-spacing:.12em;text-transform:uppercase"
    )
    code_style = (
        "display:inline-block;padding:16px 24px;border-radius:16px;"
        "background:#f5ecee;color:#784454;font-size:32px;font-weight:800;"
        "letter-spacing:.28em"
    )
    message = EmailMessage()
    message["Subject"] = "Potwierdź konto BeautyDocs"
    message["From"] = formataddr((settings.email_from_name, settings.email_from_address or ""))
    message["To"] = recipient_email
    message.set_content(
        "\n".join(
            [
                f"Dzień dobry {display_name},",
                "",
                "Twój kod potwierdzający konto BeautyDocs:",
                code,
                "",
                f"Kod jest ważny przez {minutes} minut.",
                "Jeżeli to nie Ty zakładasz konto, zignoruj tę wiadomość.",
            ]
        )
    )
    message.add_alternative(
        f"""\
<!doctype html>
<html lang="pl">
  <body style="margin:0;background:#fcfaf8;font-family:Arial,sans-serif;color:#241d21">
    <div style="max-width:560px;margin:0 auto;padding:40px 20px">
      <div style="{card_style}">
        <p style="{brand_style}">BeautyDocs</p>
        <h1 style="margin:0 0 18px;font-size:28px">Potwierdź swoje konto</h1>
        <p style="margin:0 0 24px;color:#6f6266;line-height:1.6">
          Dzień dobry {safe_name}. Wpisz poniższy kod na stronie rejestracji.
        </p>
        <div style="{code_style}">{code}</div>
        <p style="margin:24px 0 0;color:#8b7d81;font-size:13px">
          Kod jest ważny przez {minutes} minut.
          Jeżeli to nie Ty zakładasz konto, zignoruj tę wiadomość.
        </p>
      </div>
    </div>
  </body>
</html>
""",
        subtype="html",
    )
    return message


def _staff_invitation_message(
    *,
    recipient_email: str,
    salon_name: str,
    activation_url: str,
    expires_in_seconds: int,
    settings: Settings,
) -> EmailMessage:
    days = max(1, expires_in_seconds // 86_400)
    safe_salon_name = escape(salon_name.strip())
    safe_url = escape(activation_url, quote=True)
    brand_style = (
        "margin:0 0 8px;color:#8f5263;font-size:13px;font-weight:700;"
        "letter-spacing:.12em;text-transform:uppercase"
    )
    button_style = (
        "display:inline-block;border-radius:14px;background:#8f5263;color:#fff;"
        "padding:14px 22px;text-decoration:none;font-weight:700"
    )
    message = EmailMessage()
    message["Subject"] = f"Zaproszenie do zespołu {salon_name.strip()} w BeautyDocs"
    message["From"] = formataddr((settings.email_from_name, settings.email_from_address or ""))
    message["To"] = recipient_email
    message.set_content(
        "\n".join(
            [
                f"Salon {salon_name.strip()} zaprasza Cię do swojego zespołu w BeautyDocs.",
                "",
                "Ustaw imię, nazwisko i hasło, otwierając jednorazowy link:",
                activation_url,
                "",
                f"Link jest ważny przez {days} dni i może zostać użyty tylko raz.",
                "Jeżeli nie oczekujesz tego zaproszenia, zignoruj wiadomość.",
            ]
        )
    )
    message.add_alternative(
        f"""\
<!doctype html>
<html lang="pl">
  <body style="margin:0;background:#fcfaf8;font-family:Arial,sans-serif;color:#241d21">
    <div style="max-width:580px;margin:0 auto;padding:40px 20px">
      <div style="background:#fff;border:1px solid #eadfe1;border-radius:24px;padding:36px">
        <p style="{brand_style}">BeautyDocs</p>
        <h1 style="margin:0 0 18px;font-size:28px">Dołącz do zespołu salonu</h1>
        <p style="margin:0 0 24px;color:#6f6266;line-height:1.6">
          Salon <strong>{safe_salon_name}</strong> zaprasza Cię do swojego panelu.
          Uzupełnisz tylko imię, nazwisko i własne hasło.
        </p>
        <p style="margin:0 0 24px">
          <a href="{safe_url}" style="{button_style}">Aktywuj konto</a>
        </p>
        <p style="margin:0;color:#8b7d81;font-size:13px;line-height:1.6">
          Link jest ważny przez {days} dni i działa tylko raz.<br>
          Jeżeli nie oczekujesz tego zaproszenia, zignoruj wiadomość.
        </p>
      </div>
    </div>
  </body>
</html>
""",
        subtype="html",
    )
    return message


def _send_message(*, message: EmailMessage, settings: Settings) -> None:
    assert settings.email_smtp_host is not None
    password = (
        settings.email_smtp_password.get_secret_value()
        if settings.email_smtp_password is not None
        else None
    )
    if settings.email_smtp_security == "ssl":
        with smtplib.SMTP_SSL(
            host=settings.email_smtp_host,
            port=settings.email_smtp_port,
            timeout=settings.email_smtp_timeout_seconds,
            context=ssl.create_default_context(),
        ) as smtp:
            _authenticate_and_send(
                smtp=smtp,
                message=message,
                username=settings.email_smtp_username,
                password=password,
            )
        return

    with smtplib.SMTP(
        host=settings.email_smtp_host,
        port=settings.email_smtp_port,
        timeout=settings.email_smtp_timeout_seconds,
    ) as smtp:
        if settings.email_smtp_security == "starttls":
            smtp.starttls(context=ssl.create_default_context())
        _authenticate_and_send(
            smtp=smtp,
            message=message,
            username=settings.email_smtp_username,
            password=password,
        )


def _authenticate_and_send(
    *,
    smtp: smtplib.SMTP,
    message: EmailMessage,
    username: str | None,
    password: str | None,
) -> None:
    if username is not None and password is not None:
        smtp.login(username, password)
    smtp.send_message(message)
