"""Auth service hardened for the security assignment."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from jose import JWTError, jwt

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-env")
JWT_ALG = "HS256"
TOKEN_MINUTES = int(os.getenv("JWT_EXP_MINUTES", "60"))

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "database": os.getenv("DB_NAME", "alcaldia_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_token(data: dict, expires_minutes: int | None = None) -> str:
    minutes = expires_minutes or TOKEN_MINUTES
    now = datetime.now(timezone.utc)
    payload = data.copy()
    payload.update(
        {
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=minutes)).timestamp()),
            "jti": str(uuid.uuid4()),
        }
    )
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token.replace("Bearer ", ""), JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError as e:
        raise ValueError(str(e))
