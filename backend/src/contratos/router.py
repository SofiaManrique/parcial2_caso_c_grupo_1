"""Contratos router — rol contratista."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.auth.dependencies import require_role
from src.core.audit import log_event
from src.core.db import get_db
from src.core.sanitize import sanitize_text

router = APIRouter()

TIPOS_DOCUMENTO_CONTRATO = {
    "Informe de avance", "Factura", "Acta de inicio",
    "Acta parcial", "Acta de liquidación", "Otro",
}


class RadicarDocumento(BaseModel):
    tipo: str
    descripcion: str | None = None


# ── Consultar mis contratos ───────────────────────────────────

@router.get("/contratos/mis-contratos")
def mis_contratos(user: dict = Depends(require_role("ROLE_CONTRATISTA"))):
    uid = user["user_id"]
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT c.id, c.numero_contrato, c.objeto, c.estado, c.valor,
                      COUNT(d.id) AS documentos_radicados
               FROM contratos c
               LEFT JOIN documentos_contrato d ON d.contrato_id = c.id
               WHERE c.contratista_id = %s
               GROUP BY c.id, c.numero_contrato, c.objeto, c.estado, c.valor
               ORDER BY c.created_at DESC""",
            (uid,),
        )
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    return {"contratos": rows}


# ── Ver documentos de un contrato ────────────────────────────

@router.get("/contratos/{contrato_id}/documentos")
def documentos_contrato(
    contrato_id: int,
    user: dict = Depends(require_role("ROLE_CONTRATISTA")),
):
    uid = user["user_id"]
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM contratos WHERE id = %s AND contratista_id = %s",
            (contrato_id, uid),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Contrato no encontrado o no le pertenece")

        cur.execute(
            """SELECT numero_radicado, tipo, descripcion, estado, created_at
               FROM documentos_contrato
               WHERE contrato_id = %s
               ORDER BY created_at DESC""",
            (contrato_id,),
        )
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    return {"documentos": rows}


# ── Radicar documento en un contrato ─────────────────────────

@router.post("/contratos/{contrato_id}/radicar")
def radicar_documento(
    contrato_id: int,
    body: RadicarDocumento,
    request: Request,
    user: dict = Depends(require_role("ROLE_CONTRATISTA")),
):
    uid = user["user_id"]

    if body.tipo not in TIPOS_DOCUMENTO_CONTRATO:
        raise HTTPException(
            400, f"Tipo inválido. Permitidos: {', '.join(sorted(TIPOS_DOCUMENTO_CONTRATO))}"
        )

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM contratos WHERE id = %s AND contratista_id = %s AND estado = 'Activo'",
            (contrato_id, uid),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Contrato no encontrado, no activo o no le pertenece")

        cur.execute("SELECT nextval('radicado_contrato_seq')")
        seq = cur.fetchone()[0]
        year = datetime.now(timezone.utc).year
        numero_radicado = f"DOC-{year}-{seq:06d}"

        cur.execute(
            """INSERT INTO documentos_contrato
               (numero_radicado, contrato_id, contratista_id, tipo, descripcion)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id""",
            (numero_radicado, contrato_id, uid,
             sanitize_text(body.tipo), sanitize_text(body.descripcion)),
        )

    log_event("radicar_documento_contrato", "contratista", uid,
              f"radicado={numero_radicado}", request.client.host)
    return {"numero_radicado": numero_radicado, "mensaje": "Documento radicado exitosamente"}
