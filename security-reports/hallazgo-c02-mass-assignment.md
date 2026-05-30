# Hallazgo de Seguridad — HU-C02: Mass Assignment / Inyección de Rol

**Fecha de identificación:** 2026-05-29  
**Herramientas:** Bearer CLI · SonarQube  
**Componente afectado:** `POST /api/auth/register`, `POST /api/auth/register/contratista`,
`POST /api/auth/admin/funcionarios`  
**Archivo:** `backend/src/auth/router.py`  
**Estado:** ✅ Corregido

---

## Descripción del Hallazgo

Los endpoints de registro de usuarios aceptaban campos no declarados en el schema
sin rechazarlos explícitamente. Aunque Pydantic v2 en su configuración por defecto
**ignora** campos extra (`extra='ignore'`), esta configuración silenciosa es
insuficiente desde el punto de vista de seguridad defensiva:

- No informa al cliente que envió datos no esperados.
- Si en el futuro se refactoriza el endpoint para incluir más lógica de asignación
  dinámica, los campos extra podrían ser procesados accidentalmente.
- Herramientas como Bearer CLI y SonarQube marcan la ausencia de `extra='forbid'`
  como un posible patrón de Mass Assignment.

En un escenario de implementación más insegura (ej. `**body.dict()` o ORMs que
mapean automáticamente), enviar `"role":"admin_alcaldia"` en el body elevaría los
privilegios del usuario desde el momento del registro.

## Clasificación

| Campo | Valor |
|---|---|
| **OWASP Top 10** | A01:2021 — Broken Access Control (Mass Assignment) |
| **CWE** | CWE-915 — Improperly Controlled Modification of Object Attributes |
| **Severidad** | Alta (escenario completo) / Media (con las defensas SQL actuales) |

## Prueba de Concepto

### Antes de la corrección (extra='ignore' — silencioso)

```http
POST /api/auth/register
Content-Type: application/json

{
  "cedula": "77665544",
  "nombre": "Hacker",
  "apellido": "Test",
  "email": "hacker@test.com",
  "telefono": "3009990000",
  "password": "Test123!",
  "role": "ROLE_ADMIN",
  "estado": "activo"
}
```

**Respuesta anterior (vulnerable):**
```json
{ "mensaje": "Registro exitoso. Revise su correo para activar la cuenta." }
```
Los campos `role` y `estado` eran silenciosamente ignorados por Pydantic, pero
el comportamiento no era explícito ni auditable.

### Después de la corrección (extra='forbid' — rechazo explícito)

```http
POST /api/auth/register
Content-Type: application/json

{
  "cedula": "77665544",
  "nombre": "Hacker",
  ...
  "role": "ROLE_ADMIN",
  "estado": "activo"
}
```

**Respuesta actual (corregida) — HTTP 422:**
```json
{
  "detail": [
    {
      "type": "extra_forbidden",
      "loc": ["body", "role"],
      "msg": "Extra inputs are not permitted",
      "input": "ROLE_ADMIN"
    },
    {
      "type": "extra_forbidden",
      "loc": ["body", "estado"],
      "msg": "Extra inputs are not permitted",
      "input": "activo"
    }
  ]
}
```

## Código Vulnerable (antes)

```python
# ❌ Sin ConfigDict — Pydantic ignora campos extra silenciosamente
class RegisterCiudadano(BaseModel):
    cedula: str
    nombre: str
    # ... campos declarados ...
    # Si alguien envía "role": "ROLE_ADMIN" → ignorado sin aviso
```

## Corrección Aplicada — Schema de Entrada Estricto

```python
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

# ✅ extra="forbid" — rechaza ACTIVAMENTE cualquier campo no declarado
class RegisterCiudadano(BaseModel):
    model_config = ConfigDict(extra="forbid")   # rechaza role, estado, etc.

    tipo_documento: str = "CC"
    cedula: str
    nombre: str
    apellido: str
    fecha_nacimiento: str | None = None
    municipio: str | None = None
    email: EmailStr
    telefono: str
    password: str                               # validado por field_validator

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not PASSWORD_REGEX.match(v):
            raise ValueError("Mínimo 8 caracteres, una mayúscula, un número y un carácter especial")
        return v
```

La misma configuración se aplicó a `RegisterContratista` y `RegisterFuncionario`.

## Defensa en Profundidad (múltiples capas)

Aunque `extra='forbid'` es la corrección principal, el sistema tiene capas adicionales
que habrían mitigado el impacto incluso sin ella:

| Capa | Mecanismo | Efecto |
|---|---|---|
| Schema Pydantic | `extra='forbid'` | Rechaza campos no declarados — HTTP 422 |
| SQL INSERT explícito | Columnas listadas manualmente | `role` nunca se pasa al INSERT |
| Default BD | `role DEFAULT 'ROLE_CIUDADANO'` | Incluso sin schema, el role es siempre el correcto |
| `estado` hardcodeado | `'pendiente'` en el INSERT | El estado inicial siempre es pendiente |

## Verificación Post-Fix

```bash
# Verificar que el usuario creado tiene role correcto
docker exec parcial2_caso_c_grupo_1-db-1 psql -U alcaldia_app -d alcaldia_db \
  -c "SELECT cedula, role, estado FROM ciudadanos ORDER BY created_at DESC LIMIT 1;"

# Resultado esperado:
#  cedula   |      role      | estado
# ----------+----------------+---------
#  77665545 | ROLE_CIUDADANO | pendiente
```