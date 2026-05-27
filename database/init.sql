-- Tablas para alcaldia_db (sin CREATE DATABASE ni \c)

CREATE TABLE IF NOT EXISTS ciudadanos (
    id              SERIAL PRIMARY KEY,
    tipo_documento  VARCHAR(3) NOT NULL DEFAULT 'CC',
    cedula          VARCHAR(20) UNIQUE NOT NULL,
    nombre          VARCHAR(60) NOT NULL,
    apellido        VARCHAR(60) NOT NULL,
    fecha_nacimiento DATE,
    municipio       VARCHAR(80),
    email           VARCHAR(255) UNIQUE NOT NULL,
    telefono        VARCHAR(20),
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(30) DEFAULT 'ROLE_CIUDADANO',
    estado          VARCHAR(20) DEFAULT 'pendiente',
    intentos_fallidos INT DEFAULT 0,
    bloqueado_hasta TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES ciudadanos(id) ON DELETE CASCADE,
    token       VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dependencias (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(120) UNIQUE NOT NULL
);

INSERT INTO dependencias (nombre) VALUES
    ('Secretaría de Gobierno'),
    ('Secretaría de Hacienda'),
    ('Secretaría de Planeación'),
    ('Oficina de Atención al Ciudadano'),
    ('Control Interno')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS funcionarios (
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

CREATE TABLE IF NOT EXISTS mfa_config (
    id              SERIAL PRIMARY KEY,
    user_type       VARCHAR(15) NOT NULL,
    user_id         INT NOT NULL,
    method          VARCHAR(10) NOT NULL,
    totp_secret_enc VARCHAR(255),
    oauth_provider  VARCHAR(20),
    oauth_sub       VARCHAR(255),
    is_active       BOOLEAN DEFAULT FALSE,
    activated_at    TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_type, user_id)
);

CREATE TABLE IF NOT EXISTS catalogo_tramites (
    id     SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(120) NOT NULL
);

INSERT INTO catalogo_tramites (codigo, nombre) VALUES
    ('LIC_CONST',  'Licencia de construcción'),
    ('CERT_ESTRAT','Certificado de estratificación'),
    ('PAZ_SALVO',  'Paz y salvo municipal'),
    ('PQRS',       'Petición, queja, reclamo o sugerencia'),
    ('IMP_PREDIAL','Liquidación de impuesto predial')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS tramites (
    id              SERIAL PRIMARY KEY,
    numero_radicado VARCHAR(20) UNIQUE NOT NULL,
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

CREATE SEQUENCE IF NOT EXISTS radicado_seq START 1;

CREATE TABLE IF NOT EXISTS tramite_historial (
    id             SERIAL PRIMARY KEY,
    tramite_id     INT NOT NULL REFERENCES tramites(id),
    estado_anterior VARCHAR(30),
    estado_nuevo   VARCHAR(30) NOT NULL,
    observaciones  TEXT,
    funcionario_id INT REFERENCES funcionarios(id),
    ip_origen      VARCHAR(45),
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          SERIAL PRIMARY KEY,
    user_type   VARCHAR(15),
    user_id     INT,
    action      VARCHAR(60) NOT NULL,
    detail      TEXT,
    ip          VARCHAR(45),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Admin de prueba (password: Admin123!)
INSERT INTO funcionarios (cedula, nombre, apellido, cargo, dependencia_id, email, telefono, password_hash, role, estado, password_temporal)
VALUES ('99999999', 'Admin', 'Sistema', 'Administrador General', 1, 'admin@alcaldia.gov.co', '3001234567',
        '$2b$12$LJ3m4ys2Kl0oGxlKN0VQkuE6VtR5F9c0WxPjY3YqKpN5UVdZ5D0gy', 'ROLE_ADMIN', 'activo', FALSE)
ON CONFLICT (cedula) DO NOTHING;

-- Funcionario de prueba (password: Func123!)
INSERT INTO funcionarios (cedula, nombre, apellido, cargo, dependencia_id, email, telefono, password_hash, role, estado, password_temporal)
VALUES ('88888888', 'Maria', 'Gonzalez', 'Analista de Trámites', 1, 'maria.gonzalez@alcaldia.gov.co', '3009876543',
        '$2b$12$LJ3m4ys2Kl0oGxlKN0VQkuE6VtR5F9c0WxPjY3YqKpN5UVdZ5D0gy', 'ROLE_FUNCIONARIO', 'activo', FALSE)
ON CONFLICT (cedula) DO NOTHING;
