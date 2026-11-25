-- Migración aditiva e idempotente: persistencia del dictamen de auditoría PMC
ALTER TABLE pmc_projects
  ADD COLUMN IF NOT EXISTS quality_audit JSONB;
