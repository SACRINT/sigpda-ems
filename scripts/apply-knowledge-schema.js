// scripts/apply-knowledge-schema.js
// Run with: node --env-file=.env.local scripts/apply-knowledge-schema.js
//
// Fase 1 — Andamiaje de la Capa de Conocimiento SEP (AIC-SEP).
// Crea el espejo en Postgres de las síntesis markdown versionadas en Git.
// La fuente de verdad es src/knowledge/wiki/**/*.md; estas tablas son una
// vista materializada de solo lectura para runtime (ver src/knowledge/SCHEMA.md).

const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definido. Usa: node --env-file=.env.local scripts/apply-knowledge-schema.js');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('🔧 Creando esquema de Capa de Conocimiento SEP...\n');

  // ── Tabla: knowledge_sources ────────────────────────────────────────────────
  // Trazabilidad de fuentes crudas. NO almacena binarios: solo ruta externa + hash.
  await sql`
    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id            SERIAL PRIMARY KEY,
      ruta_raw      TEXT NOT NULL UNIQUE,
      sha256        TEXT,
      tipo          TEXT NOT NULL CHECK (tipo IN ('pdf', 'docx', 'pptx', 'xlsx', 'md', 'txt', 'db')),
      titulo        TEXT NOT NULL,
      ingerido_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      vigente       BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;
  console.log('  ✅ Tabla knowledge_sources creada o ya existente.');

  // Migraciones idempotentes para instalaciones previas (F1 → F2).
  await sql`ALTER TABLE knowledge_sources ALTER COLUMN sha256 DROP NOT NULL`;
  await sql`ALTER TABLE knowledge_sources DROP CONSTRAINT IF EXISTS knowledge_sources_tipo_check`;
  await sql`
    ALTER TABLE knowledge_sources
      ADD CONSTRAINT knowledge_sources_tipo_check
      CHECK (tipo IN ('pdf', 'docx', 'pptx', 'xlsx', 'md', 'txt', 'db'))
  `;

  // ── Tabla: knowledge_pages ──────────────────────────────────────────────────
  // Espejo de las síntesis .md. publicado=false hasta revisión humana.
  await sql`
    CREATE TABLE IF NOT EXISTS knowledge_pages (
      id             SERIAL PRIMARY KEY,
      slug           TEXT NOT NULL UNIQUE,
      dominio        TEXT NOT NULL CHECK (dominio IN ('normativo', 'metodologico', 'curricular')),
      titulo         TEXT NOT NULL,
      contenido      TEXT NOT NULL,
      applicable_a   TEXT[] NOT NULL DEFAULT '{}',
      source_ids     INTEGER[] NOT NULL DEFAULT '{}',
      sha256         TEXT NOT NULL,
      token_count    INTEGER NOT NULL,
      publicado      BOOLEAN NOT NULL DEFAULT FALSE,
      compilado_con  TEXT,
      prompt_version TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  ✅ Tabla knowledge_pages creada o ya existente.');

  // ── Tabla: knowledge_sync_log ───────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS knowledge_sync_log (
      id            SERIAL PRIMARY KEY,
      ejecutado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archivo       TEXT NOT NULL,
      slug          TEXT,
      accion        TEXT NOT NULL CHECK (accion IN ('created', 'updated', 'unchanged', 'rejected')),
      sha256        TEXT,
      detalle       JSONB
    )
  `;
  console.log('  ✅ Tabla knowledge_sync_log creada o ya existente.');

  // ── Índices ─────────────────────────────────────────────────────────────────
  await sql`
    CREATE INDEX IF NOT EXISTS idx_knowledge_pages_applicable
      ON knowledge_pages USING GIN (applicable_a)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_knowledge_pages_dominio
      ON knowledge_pages (dominio)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_knowledge_pages_publicado
      ON knowledge_pages (publicado)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_knowledge_sync_log_slug
      ON knowledge_sync_log (slug)
  `;
  console.log('  ✅ Índices creados.');

  // ── Verificación ────────────────────────────────────────────────────────────
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('knowledge_sources', 'knowledge_pages', 'knowledge_sync_log')
    ORDER BY table_name
  `;
  console.log('\n📋 Tablas verificadas:');
  tables.forEach((t) => console.log(`   - ${t.table_name}`));

  console.log('\n✅ Migración de Capa de Conocimiento completada exitosamente.');
}

main().catch((err) => {
  console.error('❌ Error en migración:', err.message);
  process.exit(1);
});
