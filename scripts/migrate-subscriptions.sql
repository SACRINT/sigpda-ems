-- ================================================================
-- Migración: Sistema de Suscripciones — SIGPDA-EMS
-- Fecha: 2026-08-03
-- Ejecutar en Neon (Panel SQL o psql)
-- ================================================================

-- 1. Agregar columna de perfil bloqueado a teachers si no existe
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS school_locked BOOLEAN DEFAULT false;

-- 2. Tabla principal de suscripciones
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id              UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT        UNIQUE,
  stripe_subscription_id  TEXT        UNIQUE,
  stripe_price_id         TEXT,
  plan_name               TEXT        NOT NULL DEFAULT 'basico',
  plan_subjects           INTEGER     NOT NULL DEFAULT 1,
  status                  TEXT        NOT NULL DEFAULT 'inactive',
  -- status: active | inactive | canceled | past_due | trialing
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN     DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_teacher_id ON subscriptions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

-- 3. Tabla de materias seleccionadas dentro de la suscripción
CREATE TABLE IF NOT EXISTS subscription_subjects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subscription_id UUID        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  uac_name        TEXT        NOT NULL,
  semester        INTEGER     NOT NULL,
  component       TEXT        NOT NULL,
  locked_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_subjects_teacher ON subscription_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sub_subjects_subscription ON subscription_subjects(subscription_id);

-- 4. Tabla de cambios / pagos adicionales (materia extra, cambio de escuela)
CREATE TABLE IF NOT EXISTS subscription_changes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id          UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  change_type         TEXT        NOT NULL,
  -- change_type: 'school_change' | 'add_subject' | 'plan_upgrade'
  stripe_payment_id   TEXT,
  amount_mxn          NUMERIC(10,2),
  metadata            JSONB       DEFAULT '{}',
  status              TEXT        DEFAULT 'pending',
  -- status: pending | completed | failed
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sub_changes_teacher ON subscription_changes(teacher_id);

-- ================================================================
-- Verificación: Ejecuta esto después para confirmar
-- ================================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN
--   ('subscriptions', 'subscription_subjects', 'subscription_changes');
