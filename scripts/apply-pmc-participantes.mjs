#!/usr/bin/env node
/**
 * scripts/apply-pmc-participantes.mjs
 * Migración idempotente para agregar columna `participantes` JSONB en pmc_projects.
 * SIGPDA-EMS · Nivel 1 PMC
 */

import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log('[Migration:pmc-participantes] DATABASE_URL no está configurada en el entorno local.');
  process.exit(0);
}

const sql = neon(databaseUrl);

async function main() {
  console.log('[Migration:pmc-participantes] Asegurando columna participantes en pmc_projects...');
  await sql`ALTER TABLE pmc_projects ADD COLUMN IF NOT EXISTS participantes JSONB;`;
  console.log('[Migration:pmc-participantes] Columna participantes verificada exitosamente.');
}

main().catch((err) => {
  console.error('[Migration:pmc-participantes] Error durante migración:', err);
  process.exit(1);
});
