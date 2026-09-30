import { neon } from '@neondatabase/serverless';

const DB_URL = 'postgresql://neondb_owner:npg_Tec5LgY7KIfC@ep-divine-grass-atatmg66-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DB_URL);

async function run() {
  try {
    console.log('Conectando a Neon...');
    const check = await sql`SELECT 1 as ok`;
    console.log('✅ Conexión exitosa:', JSON.stringify(check));

    console.log('\nCreando extensión pgcrypto...');
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
    console.log('  ✓ pgcrypto');

    console.log('\nCreando tabla teachers...');
    await sql`
      CREATE TABLE IF NOT EXISTS teachers (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          TEXT NOT NULL,
        email         TEXT UNIQUE NOT NULL,
        school_name   TEXT,
        municipality  TEXT,
        subsystem     TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✓ teachers');

    console.log('\nCreando tabla plannings...');
    await sql`
      CREATE TABLE IF NOT EXISTS plannings (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        uac_name        TEXT NOT NULL,
        semester        INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6),
        component       TEXT NOT NULL,
        curriculum_name TEXT,
        paec_context    TEXT,
        extracted_data  JSONB,
        content_json    JSONB,
        status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'downloaded')),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✓ plannings');

    console.log('\nCreando índice...');
    await sql`CREATE INDEX IF NOT EXISTS idx_plannings_teacher_id ON plannings (teacher_id, created_at DESC)`;
    console.log('  ✓ idx_plannings_teacher_id');

    console.log('\nCreando tabla uploaded_pdfs...');
    await sql`
      CREATE TABLE IF NOT EXISTS uploaded_pdfs (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id    UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        planning_id   UUID REFERENCES plannings(id) ON DELETE CASCADE,
        filename      TEXT NOT NULL,
        blob_url      TEXT NOT NULL,
        parsed_ok     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✓ uploaded_pdfs');

    console.log('\nCreando función update_updated_at...');
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log('  ✓ update_updated_at()');

    console.log('\nCreando trigger...');
    await sql`DROP TRIGGER IF EXISTS plannings_updated_at ON plannings`;
    await sql`
      CREATE TRIGGER plannings_updated_at
        BEFORE UPDATE ON plannings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `;
    console.log('  ✓ trigger plannings_updated_at');

    // Verify
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    console.log('\n✅ Tablas verificadas en la base de datos:');
    tables.forEach(t => console.log('  📋', t.table_name));
    console.log('\n🎉 ¡Schema inicializado correctamente!');
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

run();
