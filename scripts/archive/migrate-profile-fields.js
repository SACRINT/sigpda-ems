import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env.local');
  }
  
  console.log('Connecting to database...');
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('Adding new columns to teachers table...');
    await sql`
      ALTER TABLE teachers 
      ADD COLUMN IF NOT EXISTS cct TEXT,
      ADD COLUMN IF NOT EXISTS city TEXT,
      ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS school_locked BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `;
    console.log('Added columns.');

    console.log('Adding trigger for teachers updated_at...');
    await sql`
      DROP TRIGGER IF EXISTS teachers_updated_at ON teachers;
    `;
    await sql`
      CREATE TRIGGER teachers_updated_at
        BEFORE UPDATE ON teachers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `;
    console.log('Added trigger.');

    console.log('Creating subscriptions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id          UUID NOT NULL UNIQUE REFERENCES teachers(id) ON DELETE CASCADE,
        stripe_customer_id  TEXT UNIQUE,
        stripe_subscription_id TEXT UNIQUE,
        plan_tier           TEXT NOT NULL DEFAULT 'free',
        status              TEXT NOT NULL DEFAULT 'inactive',
        current_period_end  TIMESTAMPTZ,
        materia_limit       INTEGER NOT NULL DEFAULT 0,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    await sql`
      DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
    `;
    await sql`
      CREATE TRIGGER subscriptions_updated_at
        BEFORE UPDATE ON subscriptions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `;
    console.log('Created subscriptions table and trigger.');

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

main().catch(console.error);
