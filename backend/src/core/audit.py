"""Registro de auditoría en la tabla audit_log."""
import psycopg2
from src.auth.service import DB_CONFIG


def log_event(
    action: str,
    user_type: str | None = None,
    user_id: int | None = None,
    detail: str = "",
    ip: str = "",
) -> None:
    """Inserta un evento de auditoría. No lanza excepciones para no interrumpir el flujo."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO audit_log (user_type, user_id, action, detail, ip) "
            "VALUES (%s, %s, %s, %s, %s)",
            (user_type, user_id, action, detail, ip),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass
