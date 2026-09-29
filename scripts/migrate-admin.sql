-- =========================================================
-- Didáctica-IA — Admin Panel Migration
-- Run with: npx tsx scripts/run-migration.ts
-- =========================================================

-- 1. Admins (emails with access to admin panel)
CREATE TABLE IF NOT EXISTS admins (
  email      TEXT PRIMARY KEY,
  name       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Platform configuration (key-value store)
CREATE TABLE IF NOT EXISTS platform_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_config (key, value) VALUES
  ('active_provider',      'gemini'),
  ('active_model',         'gemini-2.5-flash'),
  ('school_year',          '2026-2027'),
  ('maintenance_mode',     'false'),
  ('maintenance_message',  'La plataforma está en mantenimiento. Por favor regresa más tarde.'),
  ('max_daily_plannings',  '10'),
  ('welcome_message',      '')
ON CONFLICT (key) DO NOTHING;

-- 3. API Keys (AES-256 encrypted)
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label         TEXT NOT NULL,
  provider      TEXT NOT NULL,
  model_default TEXT,
  key_encrypted TEXT NOT NULL,
  key_preview   TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  priority      INT DEFAULT 1,
  usage_count   INT DEFAULT 0,
  error_count   INT DEFAULT 0,
  last_used_at  TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider, is_active, priority);

-- 4. AI Prompts (editable from admin panel)
CREATE TABLE IF NOT EXISTS ai_prompts (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  TEXT
);

-- 5. Teacher Schools (multi-school support)
CREATE TABLE IF NOT EXISTS teacher_schools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email TEXT NOT NULL,
  school_name   TEXT NOT NULL,
  school_cct    TEXT,
  municipality  TEXT,
  subsystem     TEXT DEFAULT 'BGE',
  is_primary    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_email, school_name)
);

CREATE INDEX IF NOT EXISTS idx_teacher_schools_email ON teacher_schools(teacher_email);

-- 6. User Documents (cached PDF extractions)
CREATE TABLE IF NOT EXISTS user_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email  TEXT NOT NULL,
  school_id      UUID REFERENCES teacher_schools(id) ON DELETE SET NULL,
  doc_type       TEXT NOT NULL,
  label          TEXT NOT NULL,
  uac_name       TEXT,
  semester       INT,
  extracted_json JSONB NOT NULL,
  file_name      TEXT,
  file_hash      TEXT,
  used_count     INT DEFAULT 0,
  last_used_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_docs_email  ON user_documents(teacher_email);
CREATE INDEX IF NOT EXISTS idx_user_docs_type   ON user_documents(teacher_email, doc_type);
CREATE INDEX IF NOT EXISTS idx_user_docs_uac    ON user_documents(teacher_email, uac_name, semester);

-- 7. Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email TEXT NOT NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  provider_used TEXT,
  model_used    TEXT,
  tokens_approx INT,
  success       BOOLEAN DEFAULT TRUE,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_email ON activity_log(teacher_email);
CREATE INDEX IF NOT EXISTS idx_activity_date  ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type  ON activity_log(action);

-- ============================================================================
-- DOCUMENT INGESTION CACHE (M5-CP3-B)
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_ingest_cache (
  hash TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingest_cache_created ON document_ingest_cache(created_at);
