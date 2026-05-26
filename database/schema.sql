-- ============================================================
-- Alcaldía Digital de Municipio X — Schema Final (Caso C)
-- ============================================================

CREATE DATABASE alcaldia_db;
\c alcaldia_db;

-- ---------- USUARIOS ----------

CREATE TABLE ciudadanos (
    id              SERIAL PRIMARY KEY,
    tipo_documento  VARCHAR(3) NOT NULL DEFAULT 'CC',  -- CC, CE
    cedula          VARCHAR(20) UNIQUE NOT NULL,
    nombre          VARCHAR(60) NOT NULL,
    apellido        VARCHAR(60) NOT NULL,
    fecha_nacimiento DATE,
    municipio       VARCHAR(80),
    email           VARCHAR(255) UNIQUE NOT NULL,
    telefono        VARCHAR(20),
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(30) DEFAULT 'ROLE_CIUDADANO',
    estado          VARCHAR(20) DEFAULT 'pendiente',   -- pendiente, activo, bloqueado
    intentos_fallidos INT DEFAULT 0,
    bloqueado_hasta TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE verification_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES ciudadanos(id) ON DELETE CASCADE,
    token       VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dependencias (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(120) UNIQUE NOT NULL
);

INSERT INTO dependencias (nombre) VALUES
    ('Secretaría de Gobierno'),
    ('Secretaría de Hacienda'),
    ('Secretaría de Planeación'),
    ('Oficina de Atención al Ciudadano'),
    ('Control Interno');

CREATE TABLE funcionarios (
    id              SERIAL PRIMARY KEY,
    tipo_documento  VARCHAR(3) NOT NULL DEFAULT 'CC',
    cedula          VARCHAR(20) UNIQUE NOT NULL,
    nombre          VARCHAR(60) NOT NULL,
    apellido        VARCHAR(60) NOT NULL,
    cargo           VARCHAR(100),
    dependencia_id  INT REFERENCES dependencias(id),
    email           VARCHAR(255) UNIQUE NOT NULL,
    telefono        VARCHAR(20),
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(30) DEFAULT 'ROLE_FUNCIONARIO',
    estado          VARCHAR(20) DEFAULT 'activo',
    intentos_fallidos INT DEFAULT 0,
    bloqueado_hasta TIMESTAMP,
    password_temporal BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ---------- MFA ----------

CREATE TABLE mfa_config (
    id              SERIAL PRIMARY KEY,
    user_type       VARCHAR(15) NOT NULL,  -- 'funcionario' o 'ciudadano'
    user_id         INT NOT NULL,
    method          VARCHAR(10) NOT NULL,  -- 'totp' o 'oauth2'
    totp_secret_enc VARCHAR(255),          -- cifrado, NUNCA texto plano
    oauth_provider  VARCHAR(20),           -- 'google' o 'microsoft'
    oauth_sub       VARCHAR(255),
    is_active       BOOLEAN DEFAULT FALSE,
    activated_at    TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_type, user_id)
);

-- ---------- TRÁMITES ----------

CREATE TABLE catalogo_tramites (
    id     SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(120) NOT NULL
);

INSERT INTO catalogo_tramites (codigo, nombre) VALUES
    ('LIC_CONST',  'Licencia de construcción'),
    ('CERT_ESTRAT','Certificado de estratificación'),
    ('PAZ_SALVO',  'Paz y salvo municipal'),
    ('PQRS',       'Petición, queja, reclamo o sugerencia'),
    ('IMP_PREDIAL','Liquidación de impuesto predial');

CREATE TABLE tramites (
    id              SERIAL PRIMARY KEY,
    numero_radicado VARCHAR(20) UNIQUE NOT NULL,  -- ALC-2026-000001
    ciudadano_id    INT NOT NULL REFERENCES ciudadanos(id),
    catalogo_id     INT NOT NULL REFERENCES catalogo_tramites(id),
    dependencia_id  INT REFERENCES dependencias(id),
    funcionario_id  INT REFERENCES funcionarios(id),
    estado          VARCHAR(30) DEFAULT 'Radicado',
    descripcion     TEXT,
    observaciones   TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Secuencia para el número de radicado
CREATE SEQUENCE radicado_seq START 1;

CREATE TABLE tramite_historial (
    id             SERIAL PRIMARY KEY,
    tramite_id     INT NOT NULL REFERENCES tramites(id),
    estado_anterior VARCHAR(30),
    estado_nuevo   VARCHAR(30) NOT NULL,
    observaciones  TEXT,
    funcionario_id INT REFERENCES funcionarios(id),
    ip_origen      VARCHAR(45),
    created_at     TIMESTAMP DEFAULT NOW()
);

-- ---------- AUDITORÍA ----------

CREATE TABLE audit_log (
    id          SERIAL PRIMARY KEY,
    user_type   VARCHAR(15),       -- 'ciudadano', 'funcionario'
    user_id     INT,
    action      VARCHAR(60) NOT NULL,
    detail      TEXT,
    ip          VARCHAR(45),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ---------- PERMISOS ----------

CREATE USER alcaldia_app WITH PASSWORD 'CHANGE_ME';
GRANT CONNECT ON DATABASE alcaldia_db TO alcaldia_app;
GRANT USAGE ON SCHEMA public TO alcaldia_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO alcaldia_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO alcaldia_app;
