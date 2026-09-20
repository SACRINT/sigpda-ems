-- scripts/migrate-roles.sql
-- Migración oficial de Roles y Personal por Plantel / Supervisión de Zona (DBEPA Puebla 2026-2027)
-- Ejecutar de forma administrativa y externa contra la base de datos PostgreSQL en Neon.

-- 1. Asegurar columna role y city en teachers
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'docente';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS city TEXT;

-- 2. Crear tabla escuela_personal (personal del plantel del Director)
CREATE TABLE IF NOT EXISTS escuela_personal (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id      UUID NOT NULL,
  nombre           TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL DEFAULT '',
  apellido_materno TEXT NOT NULL DEFAULT '',
  email            TEXT,
  cargo            TEXT NOT NULL DEFAULT 'DOCENTE',
  horas_base       INTEGER NOT NULL DEFAULT 20,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índice único en escuela_personal
CREATE UNIQUE INDEX IF NOT EXISTS idx_escuela_personal_director_nombre
  ON escuela_personal(director_id, nombre, apellido_paterno);

-- 4. Crear tabla supervisor_escuelas (escuelas de la zona del Supervisor)
CREATE TABLE IF NOT EXISTS supervisor_escuelas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id    UUID NOT NULL,
  nombre           TEXT NOT NULL,
  cct              TEXT,
  municipio        TEXT,
  subsistema       TEXT NOT NULL DEFAULT 'BGE',
  director_nombre  TEXT,
  director_email   TEXT,
  pmc_data         JSONB,
  paec_data        JSONB,
  activa           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Índice único en supervisor_escuelas
CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisor_escuelas_sup_cct
  ON supervisor_escuelas(supervisor_id, cct);
