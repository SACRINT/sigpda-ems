const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('Migrating teachers table...');
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS city TEXT;`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS cct TEXT;`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE;`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS school_locked BOOLEAN NOT NULL DEFAULT FALSE;`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
    
    // Create trigger for teachers
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await sql`DROP TRIGGER IF EXISTS teachers_updated_at ON teachers;`;
    await sql`
      CREATE TRIGGER teachers_updated_at
        BEFORE UPDATE ON teachers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `;
    
    // Also create schema_stripe.sql tables if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        max_subjects INTEGER NOT NULL DEFAULT 1,
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

main();
