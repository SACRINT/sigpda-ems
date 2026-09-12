-- ═══════════════════════════════════════════════════════════════════
--  Stripe Subscriptions Schema
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id          UUID NOT NULL UNIQUE REFERENCES teachers(id) ON DELETE CASCADE,
  stripe_customer_id  TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id     TEXT,
  plan_name           TEXT NOT NULL DEFAULT 'free', -- 'free' | 'basico' | 'estandar' | 'avanzado' | 'completo'
  plan_subjects       INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'inactive', -- 'active' | 'past_due' | 'canceled' | 'inactive'
  current_period_end  TIMESTAMPTZ,
  mock                BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla para guardar las materias seleccionadas (para planes con límite de materias)
CREATE TABLE IF NOT EXISTS subscription_subjects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id          UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subscription_id     UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  uac_name            TEXT NOT NULL,
  semester            INTEGER NOT NULL,
  component           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(teacher_id, subscription_id, uac_name, semester)
);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
