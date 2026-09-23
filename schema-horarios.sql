-- ═══════════════════════════════════════════════════════════════════
--  DidácticaIA — Módulo Horarios: Tablas complementarias
--  Neon PostgreSQL · SEMS Puebla 2026-2027
--  Ejecutar este script en el panel SQL de Neon (una sola vez).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS horario_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  dias_lectivos   INTEGER NOT NULL DEFAULT 5,
  horas_por_dia   INTEGER NOT NULL DEFAULT 6,
  hora_inicio     TEXT    NOT NULL DEFAULT '08:00',
  periodo_activo  TEXT    NOT NULL DEFAULT 'A',
  g1              INTEGER NOT NULL DEFAULT 1,
  g2              INTEGER NOT NULL DEFAULT 1,
  g3              INTEGER NOT NULL DEFAULT 1,
  mapa_curricular_completado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(teacher_id)
);

CREATE TABLE IF NOT EXISTS horario_grupos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id            UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  nombre                TEXT NOT NULL,
  semestre              INTEGER NOT NULL,
  capacitacion_nombre   TEXT,
  ffeo_socioemocional   TEXT,
  ffe_optativas         JSONB,
  carrera_tecnica_id    TEXT,
  version_programa      TEXT,
  materia_propedutica_5to TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(teacher_id, nombre)
);

-- Nuevas columnas para Bachillerato Tecnológico y Personalización de UACs (las existentes se mantienen para BGE)
ALTER TABLE horario_grupos ADD COLUMN IF NOT EXISTS carrera_tecnica_id TEXT;
ALTER TABLE horario_grupos ADD COLUMN IF NOT EXISTS version_programa TEXT;
ALTER TABLE horario_grupos ADD COLUMN IF NOT EXISTS materia_propedutica_5to TEXT;
ALTER TABLE horario_grupos ADD COLUMN IF NOT EXISTS custom_uacs JSONB;
ALTER TABLE horario_grupos ADD COLUMN IF NOT EXISTS horas_por_dia INTEGER;

CREATE TABLE IF NOT EXISTS horario_cargas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id          UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  grupo_nombre        TEXT NOT NULL,
  uac_name            TEXT NOT NULL,
  personal_id         TEXT NOT NULL,
  horas_semanales     INTEGER NOT NULL DEFAULT 3,
  requiere_aula_esp   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(teacher_id, grupo_nombre, uac_name)
);

CREATE OR REPLACE FUNCTION update_horario_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS horario_config_updated_at ON horario_config;
CREATE TRIGGER horario_config_updated_at
  BEFORE UPDATE ON horario_config
  FOR EACH ROW EXECUTE FUNCTION update_horario_config_updated_at();

CREATE INDEX IF NOT EXISTS idx_horario_grupos_teacher ON horario_grupos(teacher_id);
CREATE INDEX IF NOT EXISTS idx_horario_cargas_teacher ON horario_cargas(teacher_id);
