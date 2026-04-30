from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
import psycopg2
from src.auth.service import hash_password, verify_password, create_token, DB_CONFIG

router = APIRouter()

class RegisterBody(BaseModel):
    cedula: str
    nombre: str
    email: EmailStr
    telefono: str
    password: str

class LoginBody(BaseModel):
    cedula: str
    password: str

@router.post("/register")
def register(body: RegisterBody):
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM ciudadanos WHERE cedula = %s OR email = %s", (body.cedula, body.email))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(400, "No se pudo completar el registro")

    pwd = hash_password(body.password)
    cursor.execute(
        """
        INSERT INTO ciudadanos (cedula, nombre, email, telefono, password_hash)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (body.cedula, body.nombre, body.email, body.telefono, pwd),
    )
    conn.commit()
    conn.close()
    return {"cedula": body.cedula, "mensaje": "Registro exitoso"}

@router.post("/login")
def login(body: LoginBody, request: Request):
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, nombre, role, estado, password_hash
        FROM ciudadanos
        WHERE cedula = %s
        """,
        (body.cedula,),
    )
    usuario = cursor.fetchone()

    stored_hash = usuario[4] if usuario else "$2b$12$C6UzMDM.H6dfI/f/IKcEe.6mJ6E5fIYx3X3ENcy9XUG6uHgnIY7fG"
    password_ok = verify_password(body.password, stored_hash)

    if (not usuario) or (not password_ok):
        conn.close()
        raise HTTPException(401, "Credenciales invalidas")

    if usuario[3] == "bloqueado":
        conn.close()
        raise HTTPException(403, "Cuenta temporalmente bloqueada")

    cedula_masked = f"***{body.cedula[-4:]}" if len(body.cedula) >= 4 else "***"
    conn.close()
    token = create_token(
        {
            "sub": str(usuario[0]),
            "user_id": usuario[0],
            "nombre": usuario[1],
            "cedula_masked": cedula_masked,
            "role": usuario[2],
        }
    )
    print(f"[LOGIN] cedula={cedula_masked} ip={request.client.host}")
    return {"token": token}
