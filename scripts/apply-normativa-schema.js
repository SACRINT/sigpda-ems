// scripts/apply-normativa-schema.js
// Run with: cmd /c "node --env-file=.env.local scripts/apply-normativa-schema.js"

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('🔧 Creando tablas de Normativa SEP...\n');

  // ── Tabla: normativa_documentos ─────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS normativa_documentos (
      id            SERIAL PRIMARY KEY,
      titulo        TEXT NOT NULL,
      tipo          TEXT NOT NULL CHECK (tipo IN (
                      'constitucion', 'ley_general', 'ley_federal',
                      'ley_local', 'lineamiento', 'acuerdo',
                      'reglamento', 'circular', 'decreto', 'tratado', 'otro'
                    )),
      fuente        TEXT,          -- "DOF 2019-09-30", "SEMS 2025", etc.
      vigente       BOOLEAN NOT NULL DEFAULT TRUE,
      orden_display INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  ✅ Tabla normativa_documentos creada o ya existente.');

  // ── Tabla: normativa_articulos ──────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS normativa_articulos (
      id             SERIAL PRIMARY KEY,
      documento_id   INTEGER NOT NULL REFERENCES normativa_documentos(id) ON DELETE CASCADE,
      numero         TEXT NOT NULL,          -- "Artículo 3°", "Cláusula 8", "Lineamiento 4"
      texto          TEXT NOT NULL,          -- Texto completo del artículo/fracción
      aplicable_a    TEXT[] NOT NULL DEFAULT '{}',  -- {'pmc','paec','pips','planeacion'}
      orden_en_doc   INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  ✅ Tabla normativa_articulos creada o ya existente.');

  // ── Índices ──────────────────────────────────────────────────────────────────
  await sql`
    CREATE INDEX IF NOT EXISTS idx_normativa_articulos_documento
      ON normativa_articulos(documento_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_normativa_articulos_aplicable
      ON normativa_articulos USING GIN(aplicable_a)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_normativa_documentos_vigente
      ON normativa_documentos(vigente)
  `;
  console.log('  ✅ Índices creados.');

  // ── Verificación ─────────────────────────────────────────────────────────────
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('normativa_documentos', 'normativa_articulos')
    ORDER BY table_name
  `;
  console.log('\n📋 Tablas verificadas:');
  tables.forEach(t => console.log(`   - ${t.table_name}`));

  console.log('\n✅ Migración normativa completada exitosamente.');
}

main().catch(err => {
  console.error('❌ Error en migración:', err.message);
  process.exit(1);
});
