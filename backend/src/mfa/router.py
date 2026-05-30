"""MFA router — HU-C07 (activación) y HU-C08 (verificación en login)."""
import io
import os
from base64 import b64encode
from datetime import datetime, timezone

import pyotp
import qrcode
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from src.auth.dependencies import get_current_user
from src.auth.service import create_token, decode_token, SECURE_COOKIE
from src.core.audit import log_event
from src.core.db import get_db

router = APIRouter()

FERNET_KEY = os.getenv("MFA_FERNET_KEY", Fernet.generate_key().decode())
fernet = Fernet(FERNET_KEY.encode() if isinstance(FERNET_KEY, str) else FERNET_KEY)

MFA_VERIFY_MAX_ATTEMPTS = 5
MFA_BLOCK_MINUTES = 10

_otp_fail_counts: dict[str, tuple[int, datetime]] = {}


class TOTPVerifyBody(BaseModel):
    code: str


class MFALoginVerify(BaseModel):
    code: str


# ── C07: Activar TOTP ───────────────────────────────────────

@router.post("/mfa/totp/setup")
def setup_totp(request: Request, user: dict = Depends(get_current_user)):
    user_type = user.get("user_type", "ciudadano")
    user_id = user["user_id"]

    if user.get("role") not in ("ROLE_FUNCIONARIO", "ROLE_ADMIN"):
        raise HTTPException(403, "MFA solo disponible para funcionarios y administradores")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT is_active FROM mfa_config WHERE user_type = %s AND user_id = %s",
            (user_type, user_id),
        )
        existing = cur.fetchone()
        if existing and existing[0]:
            raise HTTPException(400, "MFA ya está activo en esta cuenta")

    secret = pyotp.random_base32()
    encrypted_secret = fernet.encrypt(secret.encode()).decode()

    with get_db() as conn:
        cur = conn.cursor()
        if existing:
            cur.execute(
                "UPDATE mfa_config SET totp_secret_enc = %s, method = 'totp', is_active = FALSE WHERE user_type = %s AND user_id = %s",
                (encrypted_secret, user_type, user_id),
            )
        else:
            cur.execute(
                "INSERT INTO mfa_config (user_type, user_id, method, totp_secret_enc) VALUES (%s, %s, 'totp', %s)",
                (user_type, user_id, encrypted_secret),
            )

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.get("nombre", "usuario"), issuer_name="Alcaldía Digital")

    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = b64encode(buf.getvalue()).decode()

    log_event("mfa_setup_iniciado", user_type, user_id, ip=request.client.host)
    return {"qr_base64": qr_b64, "mensaje": "Escanee el QR con su app autenticadora y confirme con el código"}


@router.post("/mfa/totp/confirm")
def confirm_totp(
    body: TOTPVerifyBody,
    request: Request,
    user: dict = Depends(get_current_user),
):
    user_type = user.get("user_type", "ciudadano")
    user_id = user["user_id"]

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT totp_secret_enc, is_active FROM mfa_config WHERE user_type = %s AND user_id = %s",
            (user_type, user_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(400, "Primero debe configurar MFA")
        if row[1]:
            raise HTTPException(400, "MFA ya está activo")

        secret = fernet.decrypt(row[0].encode()).decode()
        totp = pyotp.TOTP(secret)
        if not totp.verify(body.code):
            raise HTTPException(400, "Código inválido")

        cur.execute(
            "UPDATE mfa_config SET is_active = TRUE, activated_at = NOW() WHERE user_type = %s AND user_id = %s",
            (user_type, user_id),
        )

    log_event("mfa_activado", user_type, user_id, ip=request.client.host)
    return {"mensaje": "MFA activado exitosamente"}


# ── C08: Verificar MFA en login (segundo paso) ──────────────

def _check_rate_limit(key: str):
    """Rate limiting en memoria para intentos de MFA."""
    now = datetime.now(timezone.utc)
    if key in _otp_fail_counts:
        count, blocked_until = _otp_fail_counts[key]
        if blocked_until and now < blocked_until:
            raise HTTPException(429, "Demasiados intentos. Intente en 10 minutos.")
        if blocked_until and now >= blocked_until:
            _otp_fail_counts[key] = (0, None)

def _record_fail(key: str, user_type: str | None = None, user_id: int | None = None, ip: str = ""):
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    count = _otp_fail_counts.get(key, (0, None))[0] + 1
    if count >= MFA_VERIFY_MAX_ATTEMPTS:
        _otp_fail_counts[key] = (count, now + timedelta(minutes=MFA_BLOCK_MINUTES))
        # Alerta nivel 10 → visible en Wazuh como posible fuerza bruta en segundo factor
        log_event("mfa_bloqueado", user_type, user_id,
                  f"intentos={count} bloqueado_{MFA_BLOCK_MINUTES}min", ip)
    else:
        _otp_fail_counts[key] = (count, None)


@router.post("/mfa/verify")
def verify_mfa_login(body: MFALoginVerify, request: Request, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(401, "No autorizado")
    try:
        payload = decode_token(authorization)
    except ValueError:
        raise HTTPException(401, "Token inválido o expirado")

    if not payload.get("mfa_pending"):
        raise HTTPException(400, "Este token no requiere verificación MFA")

    user_id = payload["user_id"]
    user_type = payload.get("user_type", "ciudadano")
    rate_key = f"{user_type}:{user_id}"

    _check_rate_limit(rate_key)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT totp_secret_enc FROM mfa_config WHERE user_type = %s AND user_id = %s AND is_active = TRUE",
            (user_type, user_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(400, "MFA no configurado")

        secret = fernet.decrypt(row[0].encode()).decode()
        totp = pyotp.TOTP(secret)

        if not totp.verify(body.code):
            _record_fail(rate_key, user_type, user_id, request.client.host)
            log_event("mfa_verify_fallido", user_type, user_id, ip=request.client.host)
            raise HTTPException(401, "Código MFA inválido")

    if rate_key in _otp_fail_counts:
        del _otp_fail_counts[rate_key]

    full_token = create_token({
        "sub": str(user_id),
        "user_id": user_id,
        "nombre": payload["nombre"],
        "role": payload["role"],
        "user_type": user_type,
    })

    log_event("mfa_verify_ok", user_type, user_id, ip=request.client.host)

    # httpOnly cookie — JWT no expuesto a JavaScript (OWASP A02)
    from fastapi import Response as _Response
    import json as _json
    resp = _Response(
        content=_json.dumps({
            "user": {
                "user_id": user_id,
                "nombre": payload["nombre"],
                "role": payload["role"],
                "user_type": user_type,
            }
        }),
        media_type="application/json",
    )
    resp.set_cookie(
        key="token", value=full_token,
        httponly=True, secure=SECURE_COOKIE, samesite="lax",
        max_age=3600, path="/",
    )
    return resp
