import { loadEnvLocal } from './lib/load-env';
loadEnvLocal();

import { sql } from '../src/lib/db/client';

async function main() {
  console.log('[migrate-planning-versions] Ejecutando migración DDL...');

  const db = sql();

  await db`
    CREATE TABLE IF NOT EXISTS planning_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
      teacher_id UUID NOT NULL REFERENCES teachers(id),
      version_number INTEGER NOT NULL,
      snapshot_json JSONB NOT NULL,
      sha256_hash TEXT NOT NULL,
      anexo12_score INTEGER,
      dbepa_score INTEGER,
      change_summary TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_planning_version UNIQUE (planning_id, version_number)
    );
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_planning_versions_lookup 
    ON planning_versions(planning_id, version_number);
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_planning_versions_teacher 
    ON planning_versions(teacher_id);
  `;

  console.log('[migrate-planning-versions] Tabla planning_versions e índices creados con éxito.');
}

main().catch((err) => {
  console.error('[migrate-planning-versions] Error en migración:', err);
  process.exit(1);
});
