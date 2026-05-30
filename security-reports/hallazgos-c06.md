# Hallazgos de Seguridad — HU-C06: Gestión de Estado de Trámites

**Fecha de identificación:** 2026-05-29  
**Componente afectado:** `PATCH /api/intranet/tramites/{radicado}/estado`  
**Archivo:** `backend/src/tramites/router.py`  
**Estado:** ✅ Corregidos

---

## Hallazgo 1 — Escalada de privilegios horizontal (OWASP A01)

### Descripción
El endpoint de actualización de estado no validaba que el trámite perteneciera
a la dependencia del funcionario autenticado. Un funcionario de la dependencia
"Secretaría de Hacienda" podía modificar el estado de trámites asignados a
"Secretaría de Planeación" o cualquier otra dependencia, sin restricción alguna.

### Clasificación
- **OWASP Top 10:** A01:2021 — Broken Access Control
- **CWE:** CWE-639 — Authorization Bypass Through User-Controlled Key
- **Severidad:** Alta

### Prueba de concepto (antes del fix)
```http
PATCH /api/intranet/tramites/ALC-2026-000042/estado
Authorization: Bearer <token_funcionario_dependencia_1>

{ "estado": "Aprobado", "observaciones": "Aprobado sin autoridad" }
```
Con el código vulnerable, la solicitud anterior tenía éxito aunque el trámite
`ALC-2026-000042` perteneciera a la dependencia 3, diferente a la del funcionario
autenticado (dependencia 1).

### Código vulnerable (antes)
```python
# Sin validación de dependencia — cualquier funcionario podía actualizar cualquier trámite
cur.execute("SELECT id, estado FROM tramites WHERE numero_radicado = %s", (radicado,))
```

### Corrección aplicada
```python
# Obtener dependencia del funcionario autenticado
cur.execute("SELECT dependencia_id FROM funcionarios WHERE id = %s", (func_id,))
func_dep = cur.fetchone()

# Obtener dependencia del trámite
cur.execute("SELECT id, estado, dependencia_id FROM tramites WHERE numero_radicado = %s", (radicado,))
tramite = cur.fetchone()

# Bloquear si el trámite ya está asignado a otra dependencia
if tramite[2] is not None and tramite[2] != func_dep[0]:
    raise HTTPException(403, "No puede gestionar trámites de otra dependencia")
```

### Impacto mitigado
- Un funcionario de una dependencia **no puede** modificar trámites de otra dependencia.
- Los trámites sin dependencia asignada (`NULL`) pueden ser tomados por cualquier
  funcionario (comportamiento intencional — primer en reclamar).

---

## Hallazgo 2 — Inyección de estados arbitrarios y Stored XSS (OWASP A01 + A03)

### Descripción
**Parte A — Estados arbitrarios (OWASP A01):** El backend aceptaba cualquier
cadena como valor del campo `estado`, sin validar que perteneciera al conjunto
de estados definidos por el sistema. Esto permitía:
- Romper la lógica de negocio (estados como `"Pendiente"`, `"HACKED"`, `"null"`)
- Corromper los reportes de auditoría al incluir estados no esperados

**Parte B — Stored XSS en observaciones (OWASP A03):** El campo `observaciones`
de texto libre no era sanitizado antes de persistirse. Si un funcionario ingresaba
código HTML/JavaScript, este quedaba almacenado en la base de datos y podía
renderizarse en el portal del ciudadano o en los PDFs generados.

### Clasificación
- **OWASP Top 10:** A01 (estados) + A03:2021 — Injection / Stored XSS (observaciones)
- **CWE:** CWE-20 (Improper Input Validation) + CWE-79 (Cross-site Scripting)
- **Severidad:** Alta (XSS) / Media (estados arbitrarios)

### Prueba de concepto — Estados arbitrarios (antes del fix)
```http
PATCH /api/intranet/tramites/ALC-2026-000001/estado
Authorization: Bearer <token_funcionario>

{ "estado": "ESTADO_INVALIDO" }
```
El sistema aceptaba y persistía el estado `"ESTADO_INVALIDO"` en la base de datos.

### Prueba de concepto — Stored XSS (antes del fix)
```http
PATCH /api/intranet/tramites/ALC-2026-000001/estado
Authorization: Bearer <token_funcionario>

{
  "estado": "En revisión",
  "observaciones": "<script>document.cookie</script> Requiere más documentos"
}
```
El payload XSS se almacenaba y se renderizaba cuando el ciudadano consultaba
sus trámites o cuando se generaba un certificado PDF.

### Código vulnerable (antes)
```python
# Sin validación de estado
cur.execute("UPDATE tramites SET estado = %s, observaciones = %s ...",
            (body.estado, body.observaciones))  # observaciones sin sanitizar
```

### Corrección aplicada — Validación de estados
```python
ESTADOS_VALIDOS = {"Radicado", "En revisión", "Requerimiento de información",
                   "Aprobado", "Negado", "Archivado"}

if body.estado not in ESTADOS_VALIDOS:
    raise HTTPException(400, f"Estado no válido. Permitidos: {', '.join(sorted(ESTADOS_VALIDOS))}")
```

### Corrección aplicada — Sanitización XSS con bleach
```python
# backend/src/core/sanitize.py
import bleach

def sanitize_text(value: str | None) -> str:
    """Elimina todo HTML del texto. Para campos como observaciones y descripciones."""
    if not value:
        return ""
    return bleach.clean(value, tags=[], attributes={}, strip=True).strip()

# Uso en el router:
obs_clean = sanitize_text(body.observaciones)
cur.execute("UPDATE tramites SET observaciones = %s ...", (obs_clean,))
```

### Impacto mitigado
- Solo se aceptan los 6 estados definidos por el sistema de negocio.
- Cualquier HTML/JavaScript en las observaciones es eliminado antes de
  persistirse, previniendo Stored XSS tanto en el portal web como en PDFs.

---

## Resumen de controles implementados

| Control | Mecanismo | OWASP cubierto |
|---|---|---|
| Validación de estados | Whitelist `ESTADOS_VALIDOS` | A01 |
| Control de dependencia | Comparación `func_dep[0] == tramite[2]` | A01 |
| Sanitización observaciones | `bleach.clean(tags=[], strip=True)` | A03 |
| Autenticación requerida | `require_role("ROLE_FUNCIONARIO", "ROLE_ADMIN")` | A01 |
| Log de auditoría | `log_event(...)` con estado anterior/nuevo, IP | A09 |