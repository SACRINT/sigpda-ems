-- ═══════════════════════════════════════════════════════════════════
--  DidácticaIA — Database Schema
--  Neon PostgreSQL · SEMS Puebla 2026-2027
--  Run this script once in your Neon SQL editor to initialize the DB.
-- ═══════════════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Teachers ────────────────────────────────────────────────────────
-- One row per Google account (upserted on every login)
CREATE TABLE IF NOT EXISTS teachers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  school_name   TEXT,
  cct           TEXT,
  municipality  TEXT,
  city          TEXT,
  subsystem     TEXT,   -- 'bge' | 'digital' | 'emsad'
  custom_api_key TEXT,
  custom_api_provider TEXT,
  role          TEXT NOT NULL DEFAULT 'docente', -- 'administrador' | 'supervisor' | 'atp' | 'director' | 'docente'
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  school_locked BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),             -- Updated by heartbeat every ~3 min
  custom_preferences JSONB,                            -- User AI preference profile (feedback loop)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Plannings ───────────────────────────────────────────────────────
-- Strictly private per teacher_id (enforced at API + RLS levels)
CREATE TABLE IF NOT EXISTS plannings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  uac_name        TEXT NOT NULL,
  semester        INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6),
  component       TEXT NOT NULL,     -- 'laboral' | 'fundamental' | 'ampliado'
  curriculum_name TEXT,
  paec_context    TEXT,
  extracted_data  JSONB,             -- ExtractedPdfData
  content_json    JSONB,             -- GeneratedPlanningContent (7 sections)
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'generated', 'downloaded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast teacher queries
CREATE INDEX IF NOT EXISTS idx_plannings_teacher_id
  ON plannings (teacher_id, created_at DESC);

-- ─── Programs Catalog ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs_catalog (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uac_name         TEXT NOT NULL UNIQUE,
  semester         INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6),
  component        TEXT NOT NULL,     -- 'laboral' | 'fundamental' | 'ampliado'
  curriculum_name  TEXT,              -- e.g. 'Área de la Salud', 'Turismo'
  year             INTEGER NOT NULL DEFAULT 2025,
  total_hours      INTEGER NOT NULL,
  learning_outcome TEXT NOT NULL,
  activities       JSONB NOT NULL,    -- Array of KeyActivity
  evidences        JSONB NOT NULL,    -- Array of strings
  contenidos_formativos JSONB,        -- Array of objects containing propósito + temas/contenidos
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Uploaded PDFs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uploaded_pdfs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  planning_id   UUID REFERENCES plannings(id) ON DELETE SET NULL,
  filename      TEXT NOT NULL,
  blob_url      TEXT NOT NULL,
  parsed_ok     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security (defense-in-depth) ───────────────────────────
-- The API already validates teacher_id on every query.
-- RLS adds a second layer at the database level.

ALTER TABLE plannings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plannings_isolation ON plannings;
CREATE POLICY plannings_isolation ON plannings
  USING (
    teacher_id = (
      SELECT id FROM teachers WHERE email = current_setting('app.current_user_email', true)
      LIMIT 1
    )
  );

ALTER TABLE uploaded_pdfs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdfs_isolation ON uploaded_pdfs;
CREATE POLICY pdfs_isolation ON uploaded_pdfs
  USING (
    teacher_id = (
      SELECT id FROM teachers WHERE email = current_setting('app.current_user_email', true)
      LIMIT 1
    )
  );

-- ─── Auto-update updated_at ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plannings_updated_at ON plannings;
CREATE TRIGGER plannings_updated_at
  BEFORE UPDATE ON plannings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Biblioteca Documental Personal (Módulo 3) ───────────────────────
CREATE TABLE IF NOT EXISTS user_library_docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_type     TEXT NOT NULL,
  file_size     INTEGER NOT NULL,
  extracted_text TEXT,
  embedding     vector(1536), -- Si en el futuro usan pgvector para búsqueda semántica, opcional. Lo dejaremos como TEXT para full-text por ahora.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS user_library_docs_updated_at ON user_library_docs;
CREATE TRIGGER user_library_docs_updated_at
  BEFORE UPDATE ON user_library_docs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════
--  DONE. Tables created:
--    · teachers          — one row per Google account
--                          last_seen_at: heartbeat timestamp (online status)
--                          custom_preferences: user AI preference profile (feedback loop)
--    · plannings         — planeaciones, private by teacher_id
--    · uploaded_pdfs     — PDF blob references
--    · subscriptions     — Stripe subscriptions (see schema_stripe.sql)
--    · user_library_docs — personal document library
--    · generation_feedback — user feedback on AI generations (see schema_analytics.sql)
-- ════════════════════════════════════════════════════════════════════
