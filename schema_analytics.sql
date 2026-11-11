-- ═══════════════════════════════════════════════════════════════════
--  SIGPDA-EMS — Analytics Schema (Módulo 4)
--  Run via: node scripts/apply-analytics-schema.js
-- ═══════════════════════════════════════════════════════════════════

-- ─── Tabla: generation_feedback ──────────────────────────────────────
-- Almacena la evaluación del usuario sobre cada generación de IA
CREATE TABLE IF NOT EXISTS generation_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL, -- 'planning' | 'paec' | 'pmc' | 'pips'
  entity_id       TEXT NOT NULL, -- UUID del documento evaluado
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,          -- Comentario libre opcional
  dimension       TEXT,          -- 'general' | 'pertinencia' | 'creatividad' | 'claridad'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_teacher_id ON generation_feedback(teacher_id);
CREATE INDEX IF NOT EXISTS idx_feedback_entity ON generation_feedback(entity_type, entity_id);

-- ─── Columna en teachers: custom_preferences (si no existe) ──────────
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS custom_preferences JSONB;

-- ═════════════════════════════════════════════════════════════════════
-- DONE. Tables/columns created or confirmed:
--   · generation_feedback   — ratings 1-5 per AI generation
--   · teachers.custom_preferences — JSONB profile for AI personalization
-- ═════════════════════════════════════════════════════════════════════
