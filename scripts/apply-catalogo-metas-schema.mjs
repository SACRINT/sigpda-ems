// scripts/apply-catalogo-metas-schema.mjs
// Run with: node --env-file=.env.local scripts/apply-catalogo-metas-schema.mjs

import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ Falta DATABASE_URL en el entorno.');
  process.exit(1);
}

const sql = neon(databaseUrl);

export async function applyCatalogoMetasSchemaAndSeed(seedItems = null) {
  console.log('🔧 Aplicando migración de tabla pmc_catalogo_metas en Neon DB...');

  // 1. Crear tabla con alcance mínimo
  await sql`
    CREATE TABLE IF NOT EXISTS pmc_catalogo_metas (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL,
      subcategoria TEXT NOT NULL,
      articulos TEXT[] NOT NULL DEFAULT '{}',
      vigencia BOOLEAN NOT NULL DEFAULT TRUE,
      aplicabilidad_nivel TEXT NOT NULL CHECK (aplicabilidad_nivel IN ('obligatoria', 'recomendada', 'contextual')),
      aplicabilidad_justificacion TEXT NOT NULL,
      fase TEXT DEFAULT 'FASE 1',
      estado TEXT DEFAULT 'pendiente',
      evidencia TEXT,
      orden_display INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_pmc_cat_metas_categoria ON pmc_catalogo_metas(categoria)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pmc_cat_metas_subcategoria ON pmc_catalogo_metas(subcategoria)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pmc_cat_metas_vigencia ON pmc_catalogo_metas(vigencia)`;

  console.log('  ✅ Tabla pmc_catalogo_metas e índices creados o verificados.');

  // 2. Sembrado de datos iniciales si se proveen
  if (Array.isArray(seedItems) && seedItems.length > 0) {
    console.log(`🌱 Sembrando ${seedItems.length} metas canónicas de forma idempotente...`);
    for (const item of seedItems) {
      await sql`
        INSERT INTO pmc_catalogo_metas (
          id, nombre, categoria, subcategoria, articulos, vigencia,
          aplicabilidad_nivel, aplicabilidad_justificacion, fase, estado, evidencia, orden_display, updated_at
        ) VALUES (
          ${item.id},
          ${item.nombre},
          ${item.categoria},
          ${item.subcategoria},
          ${item.articulos || []},
          ${item.vigencia !== false},
          ${item.aplicabilidad_pmc?.nivel || 'recomendada'},
          ${item.aplicabilidad_pmc?.justificacion || ''},
          ${item.fase || 'FASE 1'},
          ${item.estado || 'pendiente'},
          ${item.evidencia || ''},
          ${item.orden_display || 0},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          categoria = EXCLUDED.categoria,
          subcategoria = EXCLUDED.subcategoria,
          articulos = EXCLUDED.articulos,
          vigencia = EXCLUDED.vigencia,
          aplicabilidad_nivel = EXCLUDED.aplicabilidad_nivel,
          aplicabilidad_justificacion = EXCLUDED.aplicabilidad_justificacion,
          fase = EXCLUDED.fase,
          estado = EXCLUDED.estado,
          evidencia = EXCLUDED.evidencia,
          orden_display = EXCLUDED.orden_display,
          updated_at = NOW()
      `;
    }
    console.log('  ✅ Sembrado completado exitosamente sin duplicados.');
  }

  const [countRow] = await sql`SELECT COUNT(*)::int as count FROM pmc_catalogo_metas`;
  console.log(`📊 Total de metas en pmc_catalogo_metas: ${countRow.count}`);
  return countRow.count;
}

// Ejecución directa si se invoca desde CLI
if (process.argv[1]?.endsWith('apply-catalogo-metas-schema.mjs')) {
  // Cargar datos canónicos si se corre directamente
  import('../src/lib/catalogo-metas-pmc.ts')
    .then(async (mod) => {
      await applyCatalogoMetasSchemaAndSeed(mod.CATALOGO_METAS_CANONICO);
      console.log('🏁 Proceso finalizado.');
      process.exit(0);
    })
    .catch(async () => {
      // Fallback sin tsx
      await applyCatalogoMetasSchemaAndSeed();
      process.exit(0);
    });
}
