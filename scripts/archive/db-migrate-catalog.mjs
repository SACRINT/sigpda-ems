import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env.local manually (no dependencies)
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const envText = fs.readFileSync(envLocalPath, 'utf-8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL is not defined in env.local');
  process.exit(1);
}

const sql = neon(DB_URL);

async function run() {
  try {
    console.log('Conectando a la base de datos...');
    await sql`
      CREATE TABLE IF NOT EXISTS programs_catalog (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        uac_name         TEXT NOT NULL UNIQUE,
        semester         INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6),
        component        TEXT NOT NULL,
        curriculum_name  TEXT,
        year             INTEGER NOT NULL DEFAULT 2025,
        total_hours      INTEGER NOT NULL,
        learning_outcome TEXT NOT NULL,
        activities       JSONB NOT NULL,
        evidences        JSONB NOT NULL,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      ALTER TABLE programs_catalog ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT 2025
    `;
    console.log('✅ Tabla programs_catalog y columna year verificadas.');
  } catch (e) {
    console.error('❌ Error creando tabla programs_catalog:', e.message || e);
    process.exit(1);
  }
}

run();
