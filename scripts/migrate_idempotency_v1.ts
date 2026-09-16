import fs from 'fs';
import path from 'path';

// Cargar variables de entorno
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      let val = m[2] || '';
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  }
}

import { sql } from '../src/lib/db';

async function main() {
  console.log('⏳ Ejecutando migración SQL FASE V1: generation_audit_logs idempotencia...');
  const db = sql();

  // 1. Crear tabla si no existe
  await db`
    CREATE TABLE IF NOT EXISTS generation_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      planning_id UUID REFERENCES plannings(id) ON DELETE CASCADE,
      teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
      bundle_type VARCHAR(50),
      idempotency_key VARCHAR(64) UNIQUE,
      status VARCHAR(20) DEFAULT 'completed',
      bundle_url TEXT,
      result_json JSONB,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log('  ✅ Tabla generation_audit_logs verificada/creada');

  // 2. Asegurar columnas requeridas si la tabla ya existía
  await db`
    ALTER TABLE generation_audit_logs 
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);
  `;
  await db`
    ALTER TABLE generation_audit_logs 
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';
  `;
  await db`
    ALTER TABLE generation_audit_logs 
    ADD COLUMN IF NOT EXISTS result_json JSONB;
  `;
  await db`
    ALTER TABLE generation_audit_logs 
    ADD COLUMN IF NOT EXISTS metadata JSONB;
  `;
  await db`
    ALTER TABLE generation_audit_logs 
    ADD COLUMN IF NOT EXISTS bundle_url TEXT;
  `;

  // 3. Índice único en idempotency_key
  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gen_audit_idempotency_key 
    ON generation_audit_logs(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
  `;
  console.log('  ✅ Índice único idx_gen_audit_idempotency_key listo');

  // 4. Índice de búsqueda rápida por planning y estado
  await db`
    CREATE INDEX IF NOT EXISTS idx_gen_audit_planning_status 
    ON generation_audit_logs(planning_id, status);
  `;
  console.log('  ✅ Índices complementarios listos');

  console.log('\n🎉 Migración FASE V1 completada con éxito.');
}

main().catch((err) => {
  console.error('❌ Error en migración FASE V1:', err);
  process.exit(1);
});
