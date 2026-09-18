// scripts/apply-zone-keys-migration.mjs
// Aplica la normalización de llaves de zona escolar en pmc_projects y supervisor_escuelas (Fase 9)
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

if (!process.env.DATABASE_URL) {
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

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no encontrada en las variables de entorno ni en .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('--- Aplicando migración de llaves de zona normalizadas (Fase 9) ---');
  try {
    await sql`ALTER TABLE pmc_projects ADD COLUMN IF NOT EXISTS zona_clave_std TEXT;`;
    console.log('  ✓ Columna zona_clave_std en pmc_projects agregada/verificada');

    await sql`
      UPDATE pmc_projects
      SET zona_clave_std = LPAD(regexp_replace(COALESCE(school_zone, ''), '[^0-9]', '', 'g'), 3, '0')
      WHERE school_zone IS NOT NULL AND (zona_clave_std IS NULL OR zona_clave_std = '');
    `;
    console.log('  ✓ Normalización de zona_clave_std en pmc_projects ejecutada');

    await sql`
      CREATE TABLE IF NOT EXISTS supervisor_escuelas (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        supervisor_id    UUID NOT NULL,
        nombre           TEXT NOT NULL,
        cct              TEXT,
        municipio        TEXT,
        subsistema       TEXT NOT NULL DEFAULT 'BGE',
        director_nombre  TEXT,
        director_email   TEXT,
        pmc_data         JSONB,
        paec_data        JSONB,
        activa           BOOLEAN NOT NULL DEFAULT TRUE,
        zona_clave_std   TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabla supervisor_escuelas creada/verificada');

    await sql`ALTER TABLE supervisor_escuelas ADD COLUMN IF NOT EXISTS zona_clave_std TEXT;`;
    console.log('  ✓ Columna zona_clave_std en supervisor_escuelas verificada');

    await sql`CREATE INDEX IF NOT EXISTS idx_pmc_projects_school_cct_upper ON pmc_projects((UPPER(school_cct)));`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pmc_projects_zona_clave_std ON pmc_projects(zona_clave_std);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supervisor_escuelas_cct_upper ON supervisor_escuelas((UPPER(cct)));`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisor_escuelas_sup_cct ON supervisor_escuelas(supervisor_id, cct);`;
    console.log('  ✓ Índices de aceleración para CCT y zona_clave_std creados');

    console.log('✅ Migración de llaves de zona completada exitosamente.');
  } catch (err) {
    console.error('❌ Error ejecutando migración de esquema:', err);
    process.exit(1);
  }
}

run();
