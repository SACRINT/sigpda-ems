import { loadEnvLocal } from './lib/load-env';
loadEnvLocal();

import { sql } from '../src/lib/db/client';

async function main() {
  console.log('[immutability-trigger] Aplicando trigger de inmutabilidad estricta a planning_versions...');
  const db = sql();

  await db`
    CREATE OR REPLACE FUNCTION prevent_planning_version_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'planning_versions rows are immutable (ISO 21001:2018 Document Control Policy). Operation % is strictly prohibited.', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
  `;

  await db`
    DROP TRIGGER IF EXISTS trg_prevent_planning_version_mutation ON planning_versions;
  `;

  await db`
    CREATE TRIGGER trg_prevent_planning_version_mutation
    BEFORE UPDATE OR DELETE ON planning_versions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_planning_version_mutation();
  `;

  console.log('[immutability-trigger] Trigger trg_prevent_planning_version_mutation instalado con éxito.');

  // Prueba de verificación del trigger: intentar actualizar debe fallar
  try {
    await db`UPDATE planning_versions SET change_summary = 'Prueba no permitida' WHERE id = (SELECT id FROM planning_versions LIMIT 1)`;
    console.error('[ERROR] La actualización no fue bloqueada!');
    process.exit(1);
  } catch (err: any) {
    if (err.message?.includes('strictly prohibited') || err.message?.includes('immutable')) {
      console.log('✓ Verificación de inmutabilidad superada: UPDATE fue bloqueado con excepción de PostgreSQL.');
    } else {
      throw err;
    }
  }
}

main().catch(console.error);
