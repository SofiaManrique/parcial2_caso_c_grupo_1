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
    temp_password_expires_at TIMESTAMP,
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
        '$2b$12$jIdyzRsMLAUgc/R/amF.wOMKKJUp/lQdFQChRGM0kI0nFjt1Fwerq', 'ROLE_ADMIN', 'activo', FALSE)
ON CONFLICT (cedula) DO NOTHING;

-- Funcionario de prueba (password: Func123!)
INSERT INTO funcionarios (cedula, nombre, apellido, cargo, dependencia_id, email, telefono, password_hash, role, estado, password_temporal)
VALUES ('88888888', 'Maria', 'Gonzalez', 'Analista de Trámites', 1, 'maria.gonzalez@alcaldia.gov.co', '3009876543',
        '$2b$12$.uooJBtfIVXK4CuOfAbRg.n2PGpEmm/VUicZidGlkYgKjK8OfzyKW', 'ROLE_FUNCIONARIO', 'activo', FALSE)
ON CONFLICT (cedula) DO NOTHING;

-- Auditor de prueba (password: Audit123!)
INSERT INTO funcionarios (cedula, nombre, apellido, cargo, dependencia_id, email, telefono, password_hash, role, estado, password_temporal)
VALUES ('77777777', 'Carlos', 'Auditoria', 'Auditor Interno', 5, 'auditor@alcaldia.gov.co', '3007654321',
        '$2b$12$DS5vFzGr/HnYA10yi.0ZcO/uKBsq3T3Xabf913oeU/weOu6wmXZ7C', 'ROLE_AUDITOR', 'activo', FALSE)
ON CONFLICT (cedula) DO NOTHING;

-- ── Contratistas ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contratistas (
    id              SERIAL PRIMARY KEY,
    tipo_documento  VARCHAR(3) NOT NULL DEFAULT 'CC',
    cedula          VARCHAR(20) UNIQUE NOT NULL,
    nombre          VARCHAR(60) NOT NULL,
    apellido        VARCHAR(60) NOT NULL,
    empresa         VARCHAR(120),
    email           VARCHAR(255) UNIQUE NOT NULL,
    telefono        VARCHAR(20),
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(30) DEFAULT 'ROLE_CONTRATISTA',
    estado          VARCHAR(20) DEFAULT 'activo',
    intentos_fallidos INT DEFAULT 0,
    bloqueado_hasta TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contratos (
    id              SERIAL PRIMARY KEY,
    numero_contrato VARCHAR(30) UNIQUE NOT NULL,
    contratista_id  INT NOT NULL REFERENCES contratistas(id),
    objeto          VARCHAR(255) NOT NULL,
    estado          VARCHAR(30) DEFAULT 'Activo',
    valor           NUMERIC(15,2),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documentos_contrato (
    id              SERIAL PRIMARY KEY,
    numero_radicado VARCHAR(25) UNIQUE NOT NULL,
    contrato_id     INT NOT NULL REFERENCES contratos(id),
    contratista_id  INT NOT NULL REFERENCES contratistas(id),
    tipo            VARCHAR(80) NOT NULL,
    descripcion     TEXT,
    estado          VARCHAR(30) DEFAULT 'Radicado',
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS radicado_contrato_seq START 1;

CREATE TABLE IF NOT EXISTS actos_administrativos (
    id              SERIAL PRIMARY KEY,
    tramite_id      INT NOT NULL REFERENCES tramites(id),
    funcionario_id  INT NOT NULL REFERENCES funcionarios(id),
    decision        VARCHAR(20) NOT NULL,
    justificacion   TEXT,
    pdf_content     BYTEA NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Contratista de prueba (password: Cont123!)
INSERT INTO contratistas (cedula, nombre, apellido, empresa, email, telefono, password_hash)
VALUES ('66666666', 'Pedro', 'Ramirez', 'Constructora XYZ S.A.S.', 'pedro@constructora.com', '3005551234',
        '$2b$12$nKhFbw3loclP7gEtfwrJSeabb.RCZxmesRcmhuIjcxoCJDsn7dzL2')
ON CONFLICT (cedula) DO NOTHING;

INSERT INTO contratos (numero_contrato, contratista_id, objeto, estado, valor)
SELECT 'CONT-2026-001', c.id, 'Pavimentación vía principal sector norte', 'Activo', 150000000
FROM contratistas c WHERE c.cedula = '66666666'
ON CONFLICT (numero_contrato) DO NOTHING;

INSERT INTO contratos (numero_contrato, contratista_id, objeto, estado, valor)
SELECT 'CONT-2026-002', c.id, 'Suministro de papelería y útiles de oficina', 'Activo', 25000000
FROM contratistas c WHERE c.cedula = '66666666'
ON CONFLICT (numero_contrato) DO NOTHING;
