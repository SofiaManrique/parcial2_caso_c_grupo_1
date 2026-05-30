"""Registro de auditoría: tabla audit_log + stdout JSON para Wazuh."""
import json
import logging
import sys
from datetime import datetime, timezone

import psycopg2
from src.auth.service import DB_CONFIG

# Logger estructurado — Wazuh lee stdout del contenedor Docker
_logger = logging.getLogger("alcaldia.audit")
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter("%(message)s"))
_logger.addHandler(_handler)
_logger.setLevel(logging.INFO)
_logger.propagate = False

# Niveles de severidad Wazuh (0-15). >= 10 genera alerta en Wazuh.
_LEVEL_MAP = {
    "login_ok":                   3,
    "login_fallido":              6,
    "cuenta_bloqueada":          10,   # alerta fuerza bruta
    "login_bloqueado_silencioso": 8,   # cuenta bloqueada intentando acceder
    "login_paso1_ok":       3,
    "mfa_verify_ok":        3,
    "mfa_verify_fallido":   7,
    "mfa_bloqueado":       10,   # alerta: posible fuerza bruta en segundo factor
    "registro_ciudadano":   3,
    "registro_contratista": 3,
    "crear_funcionario":    4,
    "cambio_password":      4,
    "radicar_tramite":      3,
    "actualizar_tramite":   3,
    "pdf_certificado":      3,
    "pdf_acto":             3,
    "pdf_auditoria":        4,
    "mfa_setup_iniciado":   4,
    "mfa_activado":         4,
}


def log_event(
    action: str,
    user_type: str | None = None,
    user_id: int | None = None,
    detail: str = "",
    ip: str = "",
) -> None:
    """Persiste el evento en audit_log y lo emite como JSON a stdout para Wazuh."""
    now = datetime.now(timezone.utc)
    level = _LEVEL_MAP.get(action, 5)

    # ── Persistencia en BD ────────────────────────────────────
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

    # ── Salida JSON estructurada para Wazuh ───────────────────
    entry = {
        "timestamp": now.isoformat(),
        "source": "alcaldia_digital",
        "level": level,
        "action": action,
        "user_type": user_type or "",
        "user_id": user_id,
        "detail": detail or "",
        "ip": ip or "",
    }
    _logger.info(json.dumps(entry, ensure_ascii=False))
