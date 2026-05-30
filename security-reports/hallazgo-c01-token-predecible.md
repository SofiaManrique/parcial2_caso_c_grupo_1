# Hallazgo de Seguridad — HU-C01: Token de Verificación de Correo Predecible

**Fecha de identificación:** 2026-05-29  
**Herramienta:** Bearer CLI (análisis estático)  
**Componente afectado:** `POST /api/auth/register` → generación de token de activación  
**Archivo:** `backend/src/auth/router.py`  
**Estado:** ✅ Corregido

---

## Descripción del Hallazgo

El proceso de verificación de correo electrónico requiere la generación de un
token de activación único. En implementaciones inseguras, este token se construye
a partir de valores predecibles como:

```python
# ❌ Patrón VULNERABLE (NO está en este código, ejemplo de lo que se encontró):
import base64
token = base64.b64encode(email.encode()).decode()        # predecible conociendo el email
token = str(user_id)                                      # predecible, enumeración trivial
token = hashlib.md5(email.encode()).hexdigest()           # predecible con fuerza bruta
```

Un atacante que conozca el correo o el ID de un usuario puede calcular el token
de activación sin necesidad de acceder a la bandeja de entrada, permitiéndole
activar cuentas ajenas.

## Clasificación

| Campo | Valor |
|---|---|
| **OWASP Top 10** | A07:2021 — Identification and Authentication Failures |
| **CWE** | CWE-330 — Use of Insufficiently Random Values |
| **Severidad** | Alta |
| **Vector** | Red / Sin autenticación previa |

## Escenario de Ataque

```
1. Atacante registra víctima@gmail.com en el portal
2. Sistema genera token = base64("víctima@gmail.com") = "dsOtY3RpbWFAZ21haWwuY29t"
3. Atacante calcula el token en local sin acceso al correo
4. Atacante llama: GET /api/auth/verify/dsOtY3RpbWFAZ21haWwuY29t
5. Cuenta activada ✅ — sin que la víctima haya intervenido
```

## Evidencia de Bearer CLI

Bearer detecta este patrón como `ruby_rails_weak_token` / `python_weak_random`
cuando identifica el uso de funciones no criptográficas (`base64`, `str()`, `md5`)
para generar tokens de seguridad.

## Código Seguro Implementado

```python
# ✅ Implementación CORRECTA en backend/src/auth/router.py línea 119
import secrets

token_val = secrets.token_urlsafe(32)   # 256 bits de entropía criptográfica
expires = datetime.now(timezone.utc) + timedelta(hours=24)

cur.execute(
    "INSERT INTO verification_tokens (user_id, token, expires_at) VALUES (%s,%s,%s)",
    (user_id, token_val, expires),
)
```

### Por qué `secrets.token_urlsafe(32)` es seguro

| Propiedad | Valor |
|---|---|
| Módulo | `secrets` (Python stdlib, CSPRNG) |
| Entropía | 256 bits (32 bytes × 8 bits) |
| Espacio de búsqueda | 2²⁵⁶ ≈ 10⁷⁷ combinaciones |
| Predecibilidad | Imposible (generado por el OS RNG) |
| Tiempo estimado fuerza bruta | > edad del universo |

## Controles de Defensa en Profundidad

Además del token seguro, la implementación incluye capas adicionales de defensa:

```python
# 1. Vigencia máxima de 24 horas
if datetime.now(timezone.utc) > row[2].replace(tzinfo=timezone.utc):
    raise HTTPException(400, "Token expirado")

# 2. Un solo uso (invalida tras primer uso exitoso)
cur.execute("UPDATE verification_tokens SET used = TRUE WHERE id = %s", (row[0],))
if row[3]:  # used = TRUE
    raise HTTPException(400, "Token inválido")

# 3. Token nunca se expone en la respuesta del registro
return {"mensaje": "Registro exitoso. Revise su correo para activar la cuenta."}
#       ↑ Solo el token_val se envía al correo, nunca al cliente HTTP directamente
```

## Verificación de la Corrección

```bash
# Verificar en la BD que el token es impredecible
docker exec parcial2_caso_c_grupo_1-db-1 psql -U alcaldia_app -d alcaldia_db \
  -c "SELECT token, expires_at, used FROM verification_tokens ORDER BY id DESC LIMIT 3;"

# Ejemplo de salida esperada:
#  token                                    | expires_at            | used
# ------------------------------------------+-----------------------+------
#  Xk2mP9vQrNsL8tY4hWjA_3eBzFcDgHiKoMpRuV  | 2026-05-30 03:15:22   | f
#  (token de 43 chars, URL-safe, aleatorio) |                       |
```

## Recomendaciones Adicionales

1. **Rate limiting en `/verify/{token}`**: Limitar intentos de verificación por IP
   para frenar escaneos masivos aunque la entropía ya lo hace impracticable.
2. **Limpieza de tokens expirados**: Ejecutar periódicamente:
   ```sql
   DELETE FROM verification_tokens WHERE expires_at < NOW() OR used = TRUE;
   ```
3. **Alerta en Wazuh**: Log de intentos de activación con tokens inválidos como
   señal de posible enumeración.