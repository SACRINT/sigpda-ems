const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

// Read DATABASE_URL from .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf-8');
const dbUrlLine = envFile.split('\n').find(l => l.startsWith('DATABASE_URL='));
const dbUrl = dbUrlLine ? dbUrlLine.replace('DATABASE_URL=', '').trim() : process.env.DATABASE_URL;
if (!dbUrl) { console.error('No DATABASE_URL found'); process.exit(1); }



async function migrate() {
  const sql = neon(dbUrl);

  await sql`
    CREATE TABLE IF NOT EXISTS pmc_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      school_name TEXT,
      school_cct TEXT,
      municipality TEXT,
      locality TEXT,
      school_zone TEXT,
      director_name TEXT,
      supervisor_name TEXT,
      ciclo_escolar TEXT DEFAULT '2025-2026',
      subsystem TEXT DEFAULT 'BGE',
      total_staff INTEGER DEFAULT 0,
      staff_data JSONB DEFAULT '[]'::jsonb,
      indicadores_academicos JSONB DEFAULT '{}'::jsonb,
      foda JSONB DEFAULT '{}'::jsonb,
      categorias_priorizadas JSONB DEFAULT '[]'::jsonb,
      diagnostico_comunidad TEXT,
      normativa JSONB,
      diagnostico_generado JSONB,
      plan_accion JSONB,
      current_step INTEGER DEFAULT 1,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('Tabla pmc_projects creada OK');
}

migrate().catch(e => { console.error('Error:', e.message); process.exit(1); });
