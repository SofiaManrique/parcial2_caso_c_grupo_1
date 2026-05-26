"""Dependencias reutilizables de autenticación y autorización."""
from fastapi import Header, HTTPException, Request
from src.auth.service import decode_token


def get_current_user(authorization: str = Header(None)) -> dict:
    """Extrae y valida el payload JWT del header Authorization."""
    if not authorization:
        raise HTTPException(401, "No autorizado")
    try:
        payload = decode_token(authorization)
    except ValueError:
        raise HTTPException(401, "Token inválido o expirado")
    if payload.get("mfa_pending"):
        raise HTTPException(403, "Debe completar la verificación MFA")
    return payload


def require_role(*allowed_roles: str):
    """Retorna una dependencia que valida que el usuario tenga uno de los roles permitidos."""
    def checker(authorization: str = Header(None)) -> dict:
        payload = get_current_user(authorization)
        if payload.get("role") not in allowed_roles:
            raise HTTPException(403, "No tiene permisos para esta acción")
        return payload
    return checker
