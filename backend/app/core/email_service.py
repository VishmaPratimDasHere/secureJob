"""Email service — send OTP via SMTP."""

import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger("securejob.email")


def send_otp_email(to_email: str, otp: str) -> bool:
    """Send an OTP code via SMTP email."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — printing OTP to console instead.")
        print(f"=== EMAIL OTP for {to_email}: {otp} ===")
        return True

    subject = "SecureAJob — Your Verification Code"
    html = f"""
    <div style="font-family: sans-serif; max-width: 400px; margin: auto; border: 2px solid #000; border-radius: 5px; padding: 24px;">
        <h2 style="margin-top: 0;">SecureAJob</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; 
                    background: hsl(205, 100%, 88%); border: 2px solid #000; border-radius: 5px; 
                    padding: 16px; margin: 16px 0;">{otp}</div>
        <p style="color: #666; font-size: 13px;">This code expires in {settings.OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.</p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], to_email, msg.as_string())
        logger.info(f"OTP email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")
        raise
