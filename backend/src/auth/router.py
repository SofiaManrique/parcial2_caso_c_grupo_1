"""Auth router — HU-C01, C02, C03."""
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, field_validator

from src.auth.dependencies import require_role
from src.auth.service import hash_password, verify_password, create_token, DB_CONFIG
from src.core.audit import log_event
from src.core.db import get_db
from src.core.sanitize import sanitize_text

router = APIRouter()

PASSWORD_REGEX = re.compile(
    r"^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/`~])[A-Za-z\d!@#$%^&*()_+\-=\[\]{}|;:',.<>?/`~]{8,}$"
)
BLOQUEO_MINUTOS = 15
MAX_INTENTOS = 5


# ── Schemas ──────────────────────────────────────────────────

class RegisterCiudadano(BaseModel):
    tipo_documento: str = "CC"
    cedula: str
    nombre: str
    apellido: str
    fecha_nacimiento: str | None = None
    municipio: str | None = None
    email: EmailStr
    telefono: str
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not PASSWORD_REGEX.match(v):
            raise ValueError(
                "Mínimo 8 caracteres, una mayúscula, un número y un carácter especial"
            )
        return v


class LoginBody(BaseModel):
    cedula: str
    password: str


class RegisterFuncionario(BaseModel):
    tipo_documento: str = "CC"
    cedula: str
    nombre: str
    apellido: str
    cargo: str
    dependencia_id: int
    email: EmailStr
    telefono: str


# ── C01: Registro ciudadano ──────────────────────────────────

@router.post("/register")
def register(body: RegisterCiudadano, request: Request):
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute(
            "SELECT 1 FROM ciudadanos WHERE cedula = %s OR email = %s",
            (body.cedula, body.email),
        )
        if cur.fetchone():
            raise HTTPException(400, "No se pudo completar el registro")

        pwd = hash_password(body.password)
        cur.execute(
            """INSERT INTO ciudadanos
               (tipo_documento, cedula, nombre, apellido, fecha_nacimiento,
                municipio, email, telefono, password_hash, estado)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'pendiente')
               RETURNING id""",
            (
                sanitize_text(body.tipo_documento),
                body.cedula,
                sanitize_text(body.nombre),
                sanitize_text(body.apellido),
                body.fecha_nacimiento,
                sanitize_text(body.municipio),
                body.email,
                body.telefono,
                pwd,
            ),
        )
        user_id = cur.fetchone()[0]

        token_val = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(hours=24)
        cur.execute(
            "INSERT INTO verification_tokens (user_id, token, expires_at) VALUES (%s,%s,%s)",
            (user_id, token_val, expires),
        )

    log_event("registro_ciudadano", "ciudadano", user_id, ip=request.client.host)
    return {"mensaje": "Registro exitoso. Revise su correo para activar la cuenta."}


# ── Verificación de correo ───────────────────────────────────

@router.get("/verify/{token}")
def verify_email(token: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, user_id, expires_at, used FROM verification_tokens WHERE token = %s",
            (token,),
        )
        row = cur.fetchone()
        if not row or row[3]:
            raise HTTPException(400, "Token inválido")
        if datetime.now(timezone.utc) > row[2].replace(tzinfo=timezone.utc):
            raise HTTPException(400, "Token expirado")

        cur.execute("UPDATE ciudadanos SET estado = 'activo' WHERE id = %s", (row[1],))
        cur.execute("UPDATE verification_tokens SET used = TRUE WHERE id = %s", (row[0],))
    return {"mensaje": "Cuenta activada exitosamente"}


# ── C03: Login (tabla unificada: ciudadanos + funcionarios) ──

def _find_user(cur, cedula: str):
    """Busca en ciudadanos y funcionarios. Retorna (id, nombre, role, estado, hash, tabla, intentos, bloqueado_hasta)."""
    cur.execute(
        "SELECT id, nombre, role, estado, password_hash, intentos_fallidos, bloqueado_hasta "
        "FROM ciudadanos WHERE cedula = %s",
        (cedula,),
    )
    row = cur.fetchone()
    if row:
        return (*row, "ciudadanos")

    cur.execute(
        "SELECT id, nombre, role, estado, password_hash, intentos_fallidos, bloqueado_hasta "
        "FROM funcionarios WHERE cedula = %s",
        (cedula,),
    )
    row = cur.fetchone()
    if row:
        return (*row, "funcionarios")
    return None


TABLAS_PERMITIDAS = {"ciudadanos", "funcionarios"}


def _update_login_fails(cur, tabla: str, fails: int, user_id: int, blocked_until=None):
    """Actualiza intentos fallidos sin interpolar el nombre de tabla en el SQL."""
    if tabla not in TABLAS_PERMITIDAS:
        return
    if tabla == "ciudadanos":
        if blocked_until:
            cur.execute(
                "UPDATE ciudadanos SET intentos_fallidos = %s, bloqueado_hasta = %s WHERE id = %s",
                (fails, blocked_until, user_id),
            )
        else:
            cur.execute(
                "UPDATE ciudadanos SET intentos_fallidos = %s WHERE id = %s",
                (fails, user_id),
            )
    else:
        if blocked_until:
            cur.execute(
                "UPDATE funcionarios SET intentos_fallidos = %s, bloqueado_hasta = %s WHERE id = %s",
                (fails, blocked_until, user_id),
            )
        else:
            cur.execute(
                "UPDATE funcionarios SET intentos_fallidos = %s WHERE id = %s",
                (fails, user_id),
            )


def _reset_login_fails(cur, tabla: str, user_id: int):
    """Resetea intentos fallidos después de login exitoso."""
    if tabla not in TABLAS_PERMITIDAS:
        return
    if tabla == "ciudadanos":
        cur.execute(
            "UPDATE ciudadanos SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = %s",
            (user_id,),
        )
    else:
        cur.execute(
            "UPDATE funcionarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = %s",
            (user_id,),
        )


@router.post("/login")
def login(body: LoginBody, request: Request):
    ip = request.client.host

    with get_db() as conn:
        cur = conn.cursor()
        user = _find_user(cur, body.cedula)

        dummy_hash = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.6mJ6E5fIYx3X3ENcy9XUG6uHgnIY7fG"
        stored_hash = user[4] if user else dummy_hash
        password_ok = verify_password(body.password, stored_hash)

        if not user or not password_ok:
            if user:
                tabla = user[7]
                new_fails = user[5] + 1
                if new_fails >= MAX_INTENTOS:
                    until = datetime.now(timezone.utc) + timedelta(minutes=BLOQUEO_MINUTOS)
                    _update_login_fails(cur, tabla, new_fails, user[0], until)
                    log_event("cuenta_bloqueada", tabla[:-1], user[0], f"intentos={new_fails}", ip)
                else:
                    _update_login_fails(cur, tabla, new_fails, user[0])
            log_event("login_fallido", detail=f"cedula=***{body.cedula[-4:]}", ip=ip)
            raise HTTPException(401, "Credenciales inválidas")

        tabla = user[7]

        if user[6] and datetime.now(timezone.utc) < user[6].replace(tzinfo=timezone.utc):
            raise HTTPException(403, "Cuenta temporalmente bloqueada. Intente más tarde.")

        if user[3] != "activo":
            raise HTTPException(403, "Cuenta no activa. Verifique su correo.")

        _reset_login_fails(cur, tabla, user[0])

        # Verificar si tiene MFA activo
        user_type = "funcionario" if tabla == "funcionarios" else "ciudadano"
        cur.execute(
            "SELECT is_active FROM mfa_config WHERE user_type = %s AND user_id = %s AND is_active = TRUE",
            (user_type, user[0]),
        )
        has_mfa = cur.fetchone()

    cedula_masked = f"***{body.cedula[-4:]}"

    if has_mfa:
        partial_token = create_token({
            "sub": str(user[0]),
            "user_id": user[0],
            "nombre": user[1],
            "role": user[2],
            "user_type": user_type,
            "mfa_pending": True,
        }, expires_minutes=5)
        log_event("login_paso1_ok", user_type, user[0], ip=ip)
        return {"mfa_required": True, "partial_token": partial_token}

    token = create_token({
        "sub": str(user[0]),
        "user_id": user[0],
        "nombre": user[1],
        "cedula_masked": cedula_masked,
        "role": user[2],
        "user_type": user_type,
    })
    log_event("login_ok", user_type, user[0], ip=ip)
    return {"token": token}


# ── C02: Admin crea funcionario ──────────────────────────────

@router.post("/admin/funcionarios")
def crear_funcionario(
    body: RegisterFuncionario,
    request: Request,
    admin: dict = Depends(require_role("ROLE_ADMIN")),
):
    temp_password = secrets.token_urlsafe(12)
    pwd_hash = hash_password(temp_password)

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM dependencias WHERE id = %s", (body.dependencia_id,))
        if not cur.fetchone():
            raise HTTPException(400, "Dependencia no válida")

        cur.execute(
            "SELECT 1 FROM funcionarios WHERE cedula = %s OR email = %s",
            (body.cedula, body.email),
        )
        if cur.fetchone():
            raise HTTPException(400, "No se pudo completar el registro")

        cur.execute(
            """INSERT INTO funcionarios
               (tipo_documento, cedula, nombre, apellido, cargo,
                dependencia_id, email, telefono, password_hash)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
               RETURNING id""",
            (
                sanitize_text(body.tipo_documento),
                body.cedula,
                sanitize_text(body.nombre),
                sanitize_text(body.apellido),
                sanitize_text(body.cargo),
                body.dependencia_id,
                body.email,
                body.telefono,
                pwd_hash,
            ),
        )
        func_id = cur.fetchone()[0]

    log_event(
        "crear_funcionario",
        "funcionario", func_id,
        f"admin_id={admin['user_id']}",
        request.client.host,
    )
    return {
        "mensaje": "Funcionario creado",
        "funcionario_id": func_id,
        "password_temporal": temp_password,
    }
