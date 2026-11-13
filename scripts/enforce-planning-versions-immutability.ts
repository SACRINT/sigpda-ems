import { loadEnvLocal } from './lib/load-env';

loadEnvLocal();

import { Pool } from '@neondatabase/serverless';
import { sql } from '../src/lib/db/client';

async function main() {
  console.log('Applying ISO 21001:2018 planning_versions immutability trigger...');

  await sql`
    CREATE OR REPLACE FUNCTION prevent_planning_version_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Permitir borrado en cascada exclusivamente cuando la planeación padre
      -- ya fue eliminada en la misma transacción; cualquier UPDATE o DELETE
      -- directo sobre planning_versions mientras el padre exista sigue bloqueado.
      IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM plannings WHERE id = OLD.planning_id
      ) THEN
        RETURN OLD;
      END IF;
      RAISE EXCEPTION 'planning_versions rows are immutable (ISO 21001:2018 Document Control Policy). Operation % is strictly prohibited.', TG_OP;
    END;
    $$ LANGUAGE plpgsql
  `;

  await sql`
    DROP TRIGGER IF EXISTS trg_prevent_planning_version_mutation ON planning_versions
  `;

  await sql`
    CREATE TRIGGER trg_prevent_planning_version_mutation
    BEFORE UPDATE OR DELETE ON planning_versions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_planning_version_mutation()
  `;

  console.log('Trigger trg_prevent_planning_version_mutation updated.');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to verify transactional behavior.');
  }

  const samples = await sql`
    SELECT id::text AS version_id, planning_id::text AS planning_id
    FROM planning_versions
    LIMIT 1
  `;

  if (samples.length === 0) {
    console.log('No rows in planning_versions; skipping live mutation verification.');
    return;
  }

  const { version_id: sampleVersionId, planning_id: samplePlanningId } = samples[0] as {
    version_id: string;
    planning_id: string;
  };

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Direct UPDATE on planning_versions must be blocked
    await client.query('SAVEPOINT sp_update');
    let updateBlocked = false;
    try {
      await client.query(
        'UPDATE planning_versions SET version_number = version_number WHERE id = $1::uuid',
        [sampleVersionId]
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('strictly prohibited')) {
        updateBlocked = true;
      } else {
        throw err;
      }
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT sp_update');
    }
    if (!updateBlocked) {
      throw new Error('SECURITY VIOLATION: Direct UPDATE on planning_versions was NOT blocked!');
    }
    console.log('[OK] Direct UPDATE on planning_versions blocked as expected.');

    // 2. Direct DELETE on planning_versions while parent exists must be blocked
    await client.query('SAVEPOINT sp_direct_delete');
    let deleteBlocked = false;
    try {
      await client.query(
        'DELETE FROM planning_versions WHERE id = $1::uuid',
        [sampleVersionId]
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('strictly prohibited')) {
        deleteBlocked = true;
      } else {
        throw err;
      }
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT sp_direct_delete');
    }
    if (!deleteBlocked) {
      throw new Error('SECURITY VIOLATION: Direct DELETE on planning_versions was NOT blocked!');
    }
    console.log('[OK] Direct DELETE on planning_versions blocked as expected.');

    // 3. Parent DELETE on plannings must cascade cleanly and then roll back
    await client.query('SAVEPOINT sp_parent_cascade');
    const deletedParent = await client.query(
      'DELETE FROM plannings WHERE id = $1::uuid RETURNING id',
      [samplePlanningId]
    );
    const remainingVersions = await client.query(
      'SELECT count(*)::int AS cnt FROM planning_versions WHERE planning_id = $1::uuid',
      [samplePlanningId]
    );
    await client.query('ROLLBACK TO SAVEPOINT sp_parent_cascade');

    if (deletedParent.rowCount !== 1 || remainingVersions.rows[0]?.cnt !== 0) {
      throw new Error('Cascade delete verification did not delete parent and child versions cleanly.');
    }
    console.log('[OK] Parent DELETE FROM plannings cascaded cleanly (verified inside rolled-back transaction).');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed to enforce planning_versions immutability:', err);
  process.exit(1);
});
