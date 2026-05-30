"""Trámites router — HU-C04, C05, C06."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.auth.dependencies import get_current_user, require_role
from src.core.audit import log_event
from src.core.db import get_db
from src.core.sanitize import sanitize_text

router = APIRouter()

ESTADOS_VALIDOS = {"Radicado", "En revisión", "Requerimiento de información", "Aprobado", "Negado", "Archivado"}

# Orden lógico de estados para detectar retrocesos
_ORDEN_ESTADO = {
    "Radicado": 1,
    "En revisión": 2,
    "Requerimiento de información": 3,
    "Aprobado": 4,
    "Negado": 4,
    "Archivado": 5,
}


# ── Schemas ──────────────────────────────────────────────────

class RadicarTramite(BaseModel):
    catalogo_id: int
    descripcion: str | None = None


class ActualizarEstado(BaseModel):
    estado: str
    observaciones: str | None = None


# ── C04: Radicar trámite ─────────────────────────────────────

@router.post("/tramites/radicar")
def radicar_tramite(
    body: RadicarTramite,
    request: Request,
    user: dict = Depends(require_role("ROLE_CIUDADANO")),
):
    uid = user["user_id"]

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT id, nombre FROM catalogo_tramites WHERE id = %s", (body.catalogo_id,))
        cat_row = cur.fetchone()
        if not cat_row:
            raise HTTPException(400, "Tipo de trámite no válido")
        tipo_nombre = cat_row[1]

        cur.execute("SELECT nextval('radicado_seq')")
        seq = cur.fetchone()[0]
        year = datetime.now(timezone.utc).year
        radicado = f"ALC-{year}-{seq:06d}"

        cur.execute(
            """INSERT INTO tramites
               (numero_radicado, ciudadano_id, catalogo_id, estado, descripcion, created_at)
               VALUES (%s, %s, %s, 'Radicado', %s, NOW())
               RETURNING id""",
            (radicado, uid, body.catalogo_id, sanitize_text(body.descripcion)),
        )
        tramite_id = cur.fetchone()[0]

        cur.execute(
            "INSERT INTO tramite_historial (tramite_id, estado_nuevo, ip_origen) VALUES (%s, 'Radicado', %s)",
            (tramite_id, request.client.host),
        )

    log_event("radicar_tramite", "ciudadano", uid,
              f"radicado={radicado} tipo={tipo_nombre} ciudadano_id={uid}",
              request.client.host)
    return {"numero_radicado": radicado, "mensaje": "Trámite radicado exitosamente"}


# ── Catálogo de trámites (público) ───────────────────────────

@router.get("/tramites/catalogo")
def catalogo():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, codigo, nombre FROM catalogo_tramites ORDER BY nombre")
        rows = [{"id": r[0], "codigo": r[1], "nombre": r[2]} for r in cur.fetchall()]
    return {"tipos": rows}


# ── C05: Consultar mis trámites ──────────────────────────────

@router.get("/tramites/mis-tramites")
def ver_mis_tramites(user: dict = Depends(require_role("ROLE_CIUDADANO"))):
    uid = user["user_id"]

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT t.numero_radicado, ct.nombre AS tipo, t.estado,
                      t.descripcion, t.observaciones,
                      COALESCE(f.nombre || ' ' || f.apellido, NULL) AS funcionario,
                      t.created_at
               FROM tramites t
               JOIN catalogo_tramites ct ON ct.id = t.catalogo_id
               LEFT JOIN funcionarios f ON f.id = t.funcionario_id
               WHERE t.ciudadano_id = %s
               ORDER BY t.created_at DESC""",
            (uid,),
        )
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]

    return {"tramites": rows}


@router.get("/tramites/{radicado}")
def ver_tramite(radicado: str, user: dict = Depends(require_role("ROLE_CIUDADANO"))):
    uid = user["user_id"]

    with get_db() as conn:
        cur = conn.cursor()
        # Filtra por radicado Y ciudadano_id en una sola query.
        # Si no existe o pertenece a otro → siempre 403, sin revelar si el radicado existe.
        cur.execute(
            """SELECT t.numero_radicado, ct.nombre AS tipo, t.estado,
                      t.descripcion, t.observaciones,
                      COALESCE(f.nombre || ' ' || f.apellido, NULL) AS funcionario,
                      t.created_at
               FROM tramites t
               JOIN catalogo_tramites ct ON ct.id = t.catalogo_id
               LEFT JOIN funcionarios f ON f.id = t.funcionario_id
               WHERE t.numero_radicado = %s AND t.ciudadano_id = %s""",
            (radicado, uid),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(403, "No autorizado")
        columns = [desc[0] for desc in cur.description]

    return dict(zip(columns, row))


# ── C06: Funcionario actualiza estado ────────────────────────

@router.patch("/intranet/tramites/{radicado}/estado")
def actualizar_estado(
    radicado: str,
    body: ActualizarEstado,
    request: Request,
    user: dict = Depends(require_role("ROLE_FUNCIONARIO", "ROLE_ADMIN")),
):
    if body.estado not in ESTADOS_VALIDOS:
        raise HTTPException(400, f"Estado no válido. Permitidos: {', '.join(sorted(ESTADOS_VALIDOS))}")

    func_id = user["user_id"]
    ip = request.client.host

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT dependencia_id FROM funcionarios WHERE id = %s", (func_id,))
        func_dep = cur.fetchone()
        if not func_dep:
            raise HTTPException(404, "Funcionario no encontrado")

        cur.execute(
            "SELECT id, estado, dependencia_id FROM tramites WHERE numero_radicado = %s",
            (radicado,),
        )
        tramite = cur.fetchone()
        if not tramite:
            raise HTTPException(404, "Trámite no encontrado")

        if tramite[2] is not None and tramite[2] != func_dep[0]:
            raise HTTPException(403, "No puede gestionar trámites de otra dependencia")

        estado_anterior = tramite[1]

        # Retroceso de estado requiere justificación obligatoria
        nivel_anterior = _ORDEN_ESTADO.get(estado_anterior, 0)
        nivel_nuevo = _ORDEN_ESTADO.get(body.estado, 0)
        if nivel_nuevo < nivel_anterior and not (body.observaciones and body.observaciones.strip()):
            raise HTTPException(
                400,
                f"Retroceder el estado de '{estado_anterior}' a '{body.estado}' "
                f"requiere justificación en el campo observaciones."
            )

        obs_clean = sanitize_text(body.observaciones)

        cur.execute(
            """UPDATE tramites
               SET estado = %s, observaciones = %s, funcionario_id = %s,
                   dependencia_id = COALESCE(dependencia_id, %s), updated_at = NOW()
               WHERE id = %s""",
            (body.estado, obs_clean, func_id, func_dep[0], tramite[0]),
        )

        cur.execute(
            """INSERT INTO tramite_historial
               (tramite_id, estado_anterior, estado_nuevo, observaciones, funcionario_id, ip_origen)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (tramite[0], estado_anterior, body.estado, obs_clean, func_id, ip),
        )

    log_event("actualizar_tramite", "funcionario", func_id, f"radicado={radicado} {estado_anterior}->{body.estado}", ip)
    return {"mensaje": "Estado actualizado", "radicado": radicado, "nuevo_estado": body.estado}


# ── Ver tramite individual (intranet funcionario) ────────────

@router.get("/intranet/tramites/{radicado}")
def ver_tramite_intranet(
    radicado: str,
    user: dict = Depends(require_role("ROLE_FUNCIONARIO", "ROLE_ADMIN")),
):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT t.numero_radicado, ct.nombre AS tipo, t.estado,
                      t.descripcion, t.observaciones,
                      f.nombre AS funcionario, t.created_at
               FROM tramites t
               JOIN catalogo_tramites ct ON ct.id = t.catalogo_id
               LEFT JOIN funcionarios f ON f.id = t.funcionario_id
               WHERE t.numero_radicado = %s""",
            (radicado,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Trámite no encontrado")
        columns = [desc[0] for desc in cur.description]
    return dict(zip(columns, row))


# ── Panel de seguridad: audit log (admin / auditor) ──────────

@router.get("/intranet/audit-log")
def get_audit_log(
    limit: int = 100,
    nivel_min: int = 0,
    user: dict = Depends(require_role("ROLE_ADMIN", "ROLE_AUDITOR")),
):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, action, user_type, user_id, detail, ip, created_at
               FROM audit_log
               ORDER BY created_at DESC
               LIMIT %s""",
            (min(limit, 500),),
        )
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, r)) for r in cur.fetchall()]

    level_map = {
        "login_ok": 3, "login_fallido": 6, "cuenta_bloqueada": 10,
        "login_paso1_ok": 3, "mfa_verify_ok": 3, "mfa_verify_fallido": 7,
        "mfa_bloqueado": 10, "registro_ciudadano": 3, "registro_contratista": 3,
        "crear_funcionario": 4, "cambio_password": 4, "radicar_tramite": 3,
        "actualizar_tramite": 3, "pdf_certificado": 3, "pdf_acto": 3,
        "pdf_auditoria": 4, "mfa_setup_iniciado": 4, "mfa_activado": 4,
    }

    for r in rows:
        r["level"] = level_map.get(r["action"], 5)
        r["created_at"] = str(r["created_at"])

    if nivel_min > 0:
        rows = [r for r in rows if r["level"] >= nivel_min]

    return {"eventos": rows, "total": len(rows)}


# ── Listar funcionarios (intranet) ───────────────────────────

@router.get("/intranet/funcionarios")
def listar_funcionarios(user: dict = Depends(require_role("ROLE_FUNCIONARIO", "ROLE_ADMIN"))):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, nombre, apellido, cargo FROM funcionarios WHERE estado = 'activo'")
        rows = [{"id": r[0], "nombre": f"{r[1]} {r[2]}", "cargo": r[3]} for r in cur.fetchall()]
    return {"funcionarios": rows}


# ── Dependencias (intranet) ──────────────────────────────────

@router.get("/intranet/dependencias")
def listar_dependencias(user: dict = Depends(require_role("ROLE_FUNCIONARIO", "ROLE_ADMIN"))):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, nombre FROM dependencias ORDER BY nombre")
        rows = [{"id": r[0], "nombre": r[1]} for r in cur.fetchall()]
    return {"dependencias": rows}
