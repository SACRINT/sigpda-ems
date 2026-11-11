-- Nombre oficial de la plataforma (fuente única de verdad).
-- Editable desde Admin > Configuración o directamente en platform_config.
CREATE TABLE IF NOT EXISTS public.platform_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.platform_config (key, value, updated_at)
VALUES ('platform_name', 'SIGPDA-EMS', NOW())
ON CONFLICT (key) DO NOTHING;
