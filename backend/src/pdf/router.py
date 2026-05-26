"""PDF router — HU-C09, C10, C11."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import Response
from pydantic import BaseModel

from src.auth.dependencies import require_role
from src.core.audit import log_event
from src.core.db import get_db
from src.core.sanitize import sanitize_text
from src.pdf.service import (
    generar_certificado_tramite,
    generar_acto_administrativo,
    generar_reporte_auditoria,
)

router = APIRouter()

MAX_RANGO_DIAS = 180


# ── Schemas ──────────────────────────────────────────────────

class ActoBody(BaseModel):
    radicado: str
    decision: str
    justificacion: str


# ── C09: Certificado de trámite (ciudadano) ──────────────────

@router.get("/pdf/certificado/{radicado}")
def pdf_certificado(
    radicado: str,
    request: Request,
    user: dict = Depends(require_role("ROLE_CIUDADANO")),
):
    uid = user["user_id"]

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """SELECT t.numero_radicado, ct.nombre AS tipo, t.estado, t.created_at,
                      c.nombre, c.apellido, c.tipo_documento, c.cedula, t.ciudadano_id
               FROM tramites t
               JOIN catalogo_tramites ct ON ct.id = t.catalogo_id
               JOIN ciudadanos c ON c.id = t.ciudadano_id
               WHERE t.numero_radicado = %s""",
            (radicado,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Trámite no encontrado")
    if row[8] != uid:
        raise HTTPException(403, "No tiene permiso para este certificado")

    tramite = {"numero_radicado": row[0], "tipo": row[1], "estado": row[2], "created_at": str(row[3])}
    ciudadano = {"nombre": f"{row[4]} {row[5]}", "tipo_documento": row[6], "cedula": row[7]}

    pdf_bytes = generar_certificado_tramite(tramite, ciudadano)
    log_event("pdf_certificado", "ciudadano", uid, f"radicado={radicado}", request.client.host)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=certificado_tramite.pdf"},
    )


# ── C10: Acto administrativo (funcionario) ───────────────────

@router.post("/pdf/acto-administrativo")
def pdf_acto(
    body: ActoBody,
    request: Request,
    user: dict = Depends(require_role("ROLE_FUNCIONARIO", "ROLE_ADMIN")),
):
    func_id = user["user_id"]

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT dependencia_id FROM funcionarios WHERE id = %s", (func_id,))
        func_row = cur.fetchone()
        if not func_row:
            raise HTTPException(404, "Funcionario no encontrado")

        cur.execute(
            """SELECT t.id, t.numero_radicado, ct.nombre AS tipo, t.estado, t.dependencia_id,
                      c.nombre, c.apellido, c.tipo_documento, c.cedula
               FROM tramites t
               JOIN catalogo_tramites ct ON ct.id = t.catalogo_id
               JOIN ciudadanos c ON c.id = t.ciudadano_id
               WHERE t.numero_radicado = %s""",
            (body.radicado,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Trámite no encontrado")
    if row[4] is not None and row[4] != func_row[0]:
        raise HTTPException(403, "No puede generar actos de otra dependencia")

    tramite = {"numero_radicado": row[1], "tipo": row[2], "estado": row[3]}
    ciudadano = {"nombre": f"{row[5]} {row[6]}", "tipo_documento": row[7], "cedula": row[8]}

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT nombre, apellido, cargo FROM funcionarios WHERE id = %s", (func_id,))
        f = cur.fetchone()
    funcionario = {"nombre": f"{f[0]} {f[1]}", "cargo": f[2]}

    pdf_bytes = generar_acto_administrativo(
        tramite, ciudadano, funcionario,
        sanitize_text(body.decision), sanitize_text(body.justificacion),
    )
    log_event("pdf_acto", "funcionario", func_id, f"radicado={body.radicado}", request.client.host)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=acto_administrativo.pdf"},
    )


# ── C11: Reporte de auditoría (admin / auditor) ─────────────

@router.get("/pdf/reporte-auditoria")
def pdf_auditoria(
    fecha_inicio: str = Query(..., description="YYYY-MM-DD"),
    fecha_fin: str = Query(..., description="YYYY-MM-DD"),
    request: Request = None,
    user: dict = Depends(require_role("ROLE_ADMIN", "ROLE_AUDITOR")),
):
    try:
        f_ini = datetime.strptime(fecha_inicio, "%Y-%m-%d").date()
        f_fin = datetime.strptime(fecha_fin, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Formato de fecha inválido. Use YYYY-MM-DD")

    if f_fin < f_ini:
        raise HTTPException(400, "fecha_fin debe ser posterior a fecha_inicio")
    if (f_fin - f_ini).days > MAX_RANGO_DIAS:
        raise HTTPException(400, f"Rango máximo permitido: {MAX_RANGO_DIAS} días")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT t.numero_radicado, ct.nombre AS tipo, t.estado,
                      t.created_at, d.nombre AS dependencia,
                      COALESCE(f.nombre || ' ' || f.apellido, 'Sin asignar') AS funcionario
               FROM tramites t
               JOIN catalogo_tramites ct ON ct.id = t.catalogo_id
               LEFT JOIN dependencias d ON d.id = t.dependencia_id
               LEFT JOIN funcionarios f ON f.id = t.funcionario_id
               WHERE t.created_at::date BETWEEN %s AND %s
               ORDER BY t.created_at DESC""",
            (f_ini, f_fin),
        )
        columns = [desc[0] for desc in cur.description]
        registros = [dict(zip(columns, row)) for row in cur.fetchall()]

    mapped = [
        {
            "radicado": r["numero_radicado"],
            "tipo": r["tipo"],
            "estado": r["estado"],
            "fecha": str(r["created_at"]),
            "dependencia": r["dependencia"] or "",
            "funcionario": r["funcionario"],
        }
        for r in registros
    ]

    pdf_bytes = generar_reporte_auditoria(mapped, fecha_inicio, fecha_fin, user.get("nombre", ""))
    log_event("pdf_auditoria", user.get("user_type"), user["user_id"], f"{fecha_inicio} a {fecha_fin}", request.client.host if request else "")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=reporte_auditoria.pdf"},
    )
