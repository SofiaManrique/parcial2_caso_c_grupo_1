from fastapi import APIRouter, Header, HTTPException, Query
import psycopg2
from src.auth.service import decode_token, DB_CONFIG

router = APIRouter()

@router.get("/tramites/mis-tramites")
def ver_mis_tramites(authorization: str = Header(None),
                     ciudadano_id: int = Query(default=None)):  # ← VULNERABLE: IDOR
    if not authorization: raise HTTPException(401, "No autorizado")
    payload = decode_token(authorization)
    if not payload:
        raise HTTPException(401, "No autorizado")
    uid = payload.get("user_id")
    if uid is None:
        raise HTTPException(401, "Token invalido")
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tramites WHERE ciudadano_id = %s", (uid,))
    rows = cursor.fetchall()
    conn.close()
    return {"tramites": rows}

@router.get("/intranet/funcionarios")
def listar_funcionarios(authorization: str = Header(None), buscar: str = Query("")):
    if not authorization: raise HTTPException(401, "No autorizado")
    payload = decode_token(authorization)
    if not payload:
        raise HTTPException(401, "No autorizado")
    if payload.get("role") not in {"ROLE_ADMIN", "ROLE_FUNCIONARIO"}:
        raise HTTPException(403, "No tienes permiso para esta accion")
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    buscar_like = f"%{buscar}%"
    cursor.execute(
        "SELECT id, nombre, cargo, email FROM funcionarios WHERE nombre ILIKE %s",
        (buscar_like,),
    )
    rows = cursor.fetchall(); conn.close()
    return {"funcionarios": rows}
