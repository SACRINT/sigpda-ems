import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  // Try loading from .env.local if available
  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    }
  }
}

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log('--- Applying Database Migration for Generation Jobs Queue ---');

  await sql`
    CREATE TABLE IF NOT EXISTS generation_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
      teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      block_index INT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INT DEFAULT 0,
      current_phase TEXT,
      current_step TEXT,
      result JSONB,
      error TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log('✓ Table generation_jobs created / verified');

  // Agregar columnas de lease, fencing y heartbeat para P2
  await sql`
    ALTER TABLE generation_jobs
      ADD COLUMN IF NOT EXISTS lease_id UUID,
      ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;
  `;
  console.log('✓ Columns lease_id, heartbeat_at, lease_until verified on generation_jobs');

  // Saneamiento de duplicados activos antes de crear el índice único parcial
  const sanitized = await sql`
    WITH ranked_active_jobs AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY planning_id, block_index
               ORDER BY 
                 CASE WHEN status = 'running' THEN 1 ELSE 2 END,
                 created_at DESC
             ) as rank
      FROM generation_jobs
      WHERE status IN ('pending', 'running')
    )
    UPDATE generation_jobs
    SET status = 'failed',
        error = 'Cancelado por saneamiento de duplicados activos previo a índice único',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id IN (
      SELECT id FROM ranked_active_jobs WHERE rank > 1
    )
    RETURNING id;
  `;
  console.log(`✓ Saneamiento completado: ${sanitized.length} jobs duplicados activos cancelados`);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_generation_jobs_planning_block 
    ON generation_jobs(planning_id, block_index);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_generation_jobs_status 
    ON generation_jobs(status);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_generation_jobs_created 
    ON generation_jobs(created_at);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_generation_jobs_lease_until 
    ON generation_jobs(lease_until);
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_active_generation_job 
    ON generation_jobs(planning_id, block_index) 
    WHERE status IN ('pending', 'running');
  `;
  console.log('✓ Partial unique index idx_active_generation_job and lease indexes verified');
}

runMigration()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
