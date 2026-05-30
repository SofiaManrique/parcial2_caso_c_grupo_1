"""Envío de correos transaccionales."""
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@alcaldia.gov.co")
APP_URL = os.getenv("APP_URL", "http://localhost:4200")


def _send(to_email: str, subject: str, text: str, html: str) -> bool:
    """Envía un email. Retorna False si SMTP no está configurado o falla."""
    if not SMTP_HOST or not SMTP_USER:
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))
    try:
        # STARTTLS explícito con contexto SSL — compatible con Mailtrap y proveedores reales
        ctx = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls(context=ctx)   # cifrado TLS con certificado verificado
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
        return True
    except Exception:
        return False


def send_verification_email(to_email: str, token: str) -> bool:
    """Correo de activación de cuenta ciudadano (enlace 24h, un solo uso)."""
    link = f"{APP_URL}/verify-email/{token}"
    text = (
        f"Active su cuenta haciendo clic en el siguiente enlace:\n\n{link}\n\n"
        f"El enlace es válido por 24 horas y es de un solo uso.\n"
        f"Si no realizó este registro, ignore este mensaje."
    )
    html = f"""
    <html>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <h2 style="color:#1a237e">Activación de cuenta — Alcaldía Digital</h2>
      <p>Para activar su cuenta haga clic en el siguiente botón:</p>
      <p style="text-align:center;margin:30px 0">
        <a href="{link}"
           style="background:#1a237e;color:#fff;padding:12px 24px;
                  text-decoration:none;border-radius:4px;font-weight:bold">
          Activar mi cuenta
        </a>
      </p>
      <p style="color:#555;font-size:13px">O copie este enlace:<br><a href="{link}">{link}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
      <p style="color:#999;font-size:12px">
        Válido por <strong>24 horas</strong>, de <strong>un solo uso</strong>.<br>
        Si no realizó este registro, ignore este mensaje.
      </p>
    </body></html>
    """
    return _send(to_email, "Activación de cuenta — Alcaldía Digital", text, html)


def send_temp_password_email(to_email: str, nombre: str, cedula: str, password: str) -> bool:
    """Credenciales temporales para nuevo funcionario (vigencia 48h, cambio obligatorio)."""
    text = (
        f"Estimado/a {nombre},\n\n"
        f"Su cuenta de funcionario ha sido creada en la Alcaldía Digital.\n\n"
        f"Cédula:              {cedula}\n"
        f"Contraseña temporal: {password}\n\n"
        f"Esta contraseña es válida por 48 horas.\n"
        f"Al iniciar sesión deberá cambiarla obligatoriamente.\n\n"
        f"Acceda en: {APP_URL}/login\n\n"
        f"Si tiene dudas, contacte al administrador."
    )
    html = f"""
    <html>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <h2 style="color:#1a237e">Bienvenido/a — Alcaldía Digital</h2>
      <p>Estimado/a <strong>{nombre}</strong>, su cuenta de funcionario ha sido creada.</p>
      <table style="background:#f5f5f5;padding:16px;border-radius:4px;width:100%;margin:20px 0">
        <tr><td style="color:#555;padding:4px 8px">Cédula</td>
            <td style="font-weight:bold;padding:4px 8px">{cedula}</td></tr>
        <tr><td style="color:#555;padding:4px 8px">Contraseña temporal</td>
            <td style="font-family:monospace;font-size:16px;padding:4px 8px;color:#c62828">
              {password}
            </td></tr>
      </table>
      <p style="text-align:center">
        <a href="{APP_URL}/login"
           style="background:#1a237e;color:#fff;padding:12px 24px;
                  text-decoration:none;border-radius:4px;font-weight:bold">
          Iniciar sesión
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
      <p style="color:#c62828;font-size:13px">
        ⚠️ Esta contraseña es válida por <strong>48 horas</strong>.<br>
        Al ingresar deberá cambiarla obligatoriamente.
      </p>
    </body></html>
    """
    return _send(to_email, "Credenciales de acceso — Alcaldía Digital", text, html)
