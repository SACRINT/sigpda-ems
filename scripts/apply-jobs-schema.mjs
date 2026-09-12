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
  console.log('✓ Indexes on generation_jobs created / verified');
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
