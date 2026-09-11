import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log('--- Applying Phase 1 Database Migration for Workbooks & Seeds ---');

  await sql`
    CREATE TABLE IF NOT EXISTS educational_canonical_seeds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      uac_id TEXT NOT NULL,
      subsystem TEXT NOT NULL,
      topic TEXT NOT NULL,
      practice_type TEXT NOT NULL,
      content JSONB NOT NULL,
      source TEXT NOT NULL,
      quality_score INTEGER NOT NULL,
      times_used INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_canonical_seed UNIQUE (uac_id, topic, subsystem)
    );
  `;
  console.log('✓ Table educational_canonical_seeds created / verified');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_canonical_seeds_lookup 
    ON educational_canonical_seeds(uac_id, topic, subsystem);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_canonical_seeds_quality 
    ON educational_canonical_seeds(quality_score);
  `;
  console.log('✓ Indexes on educational_canonical_seeds created / verified');

  await sql`
    ALTER TABLE plannings 
    ADD COLUMN IF NOT EXISTS workbooks_json JSONB DEFAULT '{}'::jsonb;
  `;
  await sql`
    ALTER TABLE plannings 
    ADD COLUMN IF NOT EXISTS workbook_progress JSONB DEFAULT '{}'::jsonb;
  `;
  console.log('✓ Columns workbooks_json & workbook_progress added to plannings');
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
