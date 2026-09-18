-- scripts/migrate-zone-keys.sql
-- Fase 9: Normalización de llaves de zona escolar en pmc_projects y supervisor_escuelas

-- 1. Agregar columna de zona normalizada a pmc_projects si no existe
ALTER TABLE pmc_projects ADD COLUMN IF NOT EXISTS zona_clave_std TEXT;

-- 2. Normalizar valores existentes en pmc_projects (ej. "Zona 004" -> "004", "Zona Escolar 4" -> "004")
UPDATE pmc_projects
SET zona_clave_std = LPAD(regexp_replace(COALESCE(school_zone, ''), '[^0-9]', '', 'g'), 3, '0')
WHERE school_zone IS NOT NULL AND (zona_clave_std IS NULL OR zona_clave_std = '');

-- 3. Crear tabla supervisor_escuelas si no existe
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
  zona_clave_std   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Agregar columna zona_clave_std a supervisor_escuelas si ya existía sin ella
ALTER TABLE supervisor_escuelas ADD COLUMN IF NOT EXISTS zona_clave_std TEXT;

-- 5. Crear índices para acelerar búsquedas y JOINs por CCT y zona normalizada
CREATE INDEX IF NOT EXISTS idx_pmc_projects_school_cct_upper ON pmc_projects((UPPER(school_cct)));
CREATE INDEX IF NOT EXISTS idx_pmc_projects_zona_clave_std ON pmc_projects(zona_clave_std);
CREATE INDEX IF NOT EXISTS idx_supervisor_escuelas_cct_upper ON supervisor_escuelas((UPPER(cct)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisor_escuelas_sup_cct ON supervisor_escuelas(supervisor_id, cct);
