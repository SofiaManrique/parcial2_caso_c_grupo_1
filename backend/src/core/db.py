"""Helper para obtener conexiones a la BD de forma limpia."""
import psycopg2
from contextlib import contextmanager
from src.auth.service import DB_CONFIG


@contextmanager
def get_db():
    """Context manager que abre conexión, hace commit si no hay error, y siempre cierra."""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
