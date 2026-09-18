-- scripts/migrate-cartografia-schema.sql
-- Migración oficial para Cartografía de Zona Escolar en pips_projects
-- SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027

ALTER TABLE pips_projects ADD COLUMN IF NOT EXISTS momento3_ubicar jsonb;
ALTER TABLE pips_projects ADD COLUMN IF NOT EXISTS momento4_analizar jsonb;
ALTER TABLE pips_projects ADD COLUMN IF NOT EXISTS momento5_decidir jsonb;
ALTER TABLE pips_projects ADD COLUMN IF NOT EXISTS memoria_pedagogica jsonb;
