# Hallazgos de Seguridad — HU-C03: Autenticación y Manejo de Sesión

**Fecha de identificación:** 2026-05-29  
**Herramientas:** Bearer CLI · OWASP ZAP · Revisión manual  
**Estado:** ✅ Ambos corregidos

---

## Hallazgo 1 — JWT en localStorage (XSS — OWASP A02)

### Descripción
El token JWT de sesión se almacenaba en `localStorage` del navegador.
`localStorage` es accesible por cualquier script JavaScript que se ejecute
en el mismo origen, lo que lo convierte en objetivo directo de ataques XSS.
Un atacante que logre inyectar JavaScript (por una dependencia comprometida,
un campo sin sanitizar, etc.) puede robar el token y suplantar al usuario
indefinidamente, incluso después de que cierre el navegador.

### Clasificación

| Campo | Valor |
|---|---|
| **OWASP Top 10** | A02:2021 — Cryptographic Failures / Session Management |
| **CWE** | CWE-922 — Insecure Storage of Sensitive Information |
| **Severidad** | Alta |

### Prueba de Concepto (antes del fix)

```javascript
// Desde la consola del navegador o mediante XSS:
console.log(localStorage.getItem('token'));
// → eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozL...

// Decodificar el token (no requiere la clave secreta):
JSON.parse(atob(localStorage.getItem('token').split('.')[1]));
// → { user_id: 3, nombre: "Jesus Mateo", role: "ROLE_FUNCIONARIO", ... }

// Token copiado → puede ser usado desde cualquier máquina:
fetch('https://alcaldia.gov/api/tramites/ALC-2026-000001', {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});
```

### Código Vulnerable (antes)

```typescript
// frontend/src/app/shared/services/auth.service.ts
private token = localStorage.getItem('token');   // ❌ accesible por XSS

saveToken(t: string) {
  this.token = t;
  localStorage.setItem('token', t);              // ❌ persiste entre sesiones
}

logout() {
  localStorage.removeItem('token');              // ❌ no invalida en servidor
  this.router.navigate(['/login']);
}
```

### Corrección Aplicada — httpOnly Cookie

```python
# backend/src/auth/router.py — respuesta del login
response = Response(content=json.dumps({
    "user": { "user_id": ..., "nombre": ..., "role": ..., "user_type": ... }
}), media_type="application/json")

response.set_cookie(
    key="token",
    value=token,
    httponly=True,    # ← JavaScript NO puede leer esta cookie
    secure=True,      # ← solo HTTPS (producción)
    samesite="lax",   # ← protección CSRF básica
    max_age=3600,     # ← expiración 1 hora
    path="/",
)
```

```typescript
// frontend/src/app/shared/services/auth.service.ts
// El JWT NUNCA se almacena en JS — vive únicamente en la cookie httpOnly
private userMeta: UserMeta | null = null;  // solo metadatos no sensibles

saveUserMeta(meta: UserMeta) {
  this.userMeta = meta;  // en memoria — desaparece al cerrar pestaña
  // sessionStorage guarda SOLO role/nombre, NUNCA el JWT
  sessionStorage.setItem('user_meta', JSON.stringify(meta));
}
```

```typescript
// frontend/src/app/shared/interceptors/auth.interceptor.ts
const authReq = req.clone({
  withCredentials: true,  // ← el navegador adjunta la httpOnly cookie automáticamente
  // NO se agrega Authorization header — la cookie va automáticamente
});
```

### Por qué httpOnly cookie es superior

| Almacenamiento | XSS puede robarlo | Persiste al cerrar | Viaje automático |
|---|---|---|---|
| `localStorage` | ✅ Sí | ✅ Sí | ❌ No |
| `sessionStorage` | ✅ Sí | ❌ No | ❌ No |
| `httpOnly` cookie | ❌ **No** | Configurable | ✅ **Sí** |

---

## Hallazgo 2 — Enumeración de cédulas (OWASP A07 + Ley 1581 de 2012)

### Descripción
El endpoint `POST /api/auth/login` retornaba mensajes de error diferentes
según el estado de la cuenta:

| Escenario | HTTP | Mensaje anterior | ¿Revela existencia? |
|---|---|---|---|
| Cédula incorrecta / contraseña mala | 401 | "Credenciales inválidas" | ❌ No |
| Cédula correcta + cuenta bloqueada | **403** | **"Cuenta temporalmente bloqueada"** | ✅ **Sí** |
| Cédula correcta + cuenta inactiva | **403** | **"Cuenta no activa. Verifique su correo."** | ✅ **Sí** |

Esto permite a un atacante confirmar si una cédula específica está registrada
en el sistema simplemente observando el código de respuesta y el mensaje:
- `401` → cuenta no existe (o contraseña equivocada)
- `403 bloqueada` → **la cuenta EXISTE** y fue objeto de ataques recientes
- `403 inactiva` → **la cuenta EXISTE** pero no está verificada

### Impacto Normativo — Ley 1581 de 2012

En Colombia, la **Ley 1581 de 2012** (Protección de Datos Personales) establece
que el número de cédula es un **dato personal** de carácter identificable.
Confirmar que una cédula específica está registrada en un portal de la Alcaldía
constituye un tratamiento no autorizado de datos personales, dado que:

1. **Artículo 4 — Principio de confidencialidad:** Las entidades deben garantizar
   la reserva de la información de los titulares.
2. **Artículo 17(f):** Las entidades que tratan datos personales deben implementar
   medidas de seguridad para evitar la divulgación no autorizada.
3. **Circular Externa 002 de 2015 (SIC):** Exige controles técnicos para prevenir
   la enumeración de registros en sistemas que tratan datos de ciudadanos.

La enumeración de cédulas registradas en un portal gubernamental también podría
ser usada para:
- Ataques de phishing dirigidos ("sabemos que usted usa el portal de la Alcaldía")
- Correlación con otras bases de datos filtradas
- Determinación de qué ciudadanos han realizado trámites con la entidad

### Prueba de Concepto (antes del fix)

```bash
# Cédula NO registrada → 401
curl -X POST /api/auth/login -d '{"cedula":"00000000","password":"cualquier"}'
# → HTTP 401: {"detail":"Credenciales inválidas"}

# Cédula registrada + cuenta bloqueada → 403 (¡confirma existencia!)
curl -X POST /api/auth/login -d '{"cedula":"12345678","password":"cualquier"}'
# → HTTP 403: {"detail":"Cuenta temporalmente bloqueada. Intente más tarde."}
# CONCLUSIÓN: la cédula 12345678 SÍ ESTÁ registrada en el sistema ✅ (vector de ataque)
```

### Corrección Aplicada — Respuesta Uniforme

```python
# backend/src/auth/router.py
# ANTES — mensajes distintos revelaban existencia:
if user[6] and ...:
    raise HTTPException(403, "Cuenta temporalmente bloqueada.")  # ❌
if user[3] != "activo":
    raise HTTPException(403, "Cuenta no activa.")               # ❌

# DESPUÉS — respuesta idéntica para todos los casos de fallo:
if user[6] and ...:
    log_event("login_bloqueado_silencioso", ...)   # ← el log interno SÍ tiene el detalle
    raise HTTPException(401, "Credenciales inválidas")   # ✅ genérico
if user[3] != "activo":
    raise HTTPException(401, "Credenciales inválidas")   # ✅ genérico
```

### Verificación Post-Fix

```bash
# Ahora TODOS los fallos retornan el mismo 401 y mensaje genérico:

# Cédula incorrecta:
# → HTTP 401: {"detail":"Credenciales inválidas"}

# Cédula correcta, cuenta bloqueada:
# → HTTP 401: {"detail":"Credenciales inválidas"}  ← mismo mensaje

# Cédula correcta, cuenta inactiva:
# → HTTP 401: {"detail":"Credenciales inválidas"}  ← mismo mensaje

# El log interno (audit_log) sí registra el motivo real para el administrador.
```

---

## Resumen de Controles Implementados

| Hallazgo | Control | Estándar |
|---|---|---|
| JWT en localStorage | httpOnly cookie; `withCredentials: true` | OWASP A02 |
| Enumeración por mensajes de error | HTTP 401 genérico para todos los fallos | OWASP A07 / Ley 1581 |
| Logout incompleto | `DELETE cookie` en backend + limpiar memoria | OWASP A02 |
| CSRF en cookie | `SameSite=Lax` | OWASP A01 |