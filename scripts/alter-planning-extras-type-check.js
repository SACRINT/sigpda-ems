/**
 * alter-planning-extras-type-check.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Migración permanente: extiende el CHECK planning_extras_type_check de la tabla
 * planning_extras (Neon) para aceptar los tipos 'teacher_guide' y 'visual' que ya
 * soportan el código y la UI (types/planning.ts, PlanningTabMateriales.tsx) pero
 * que rechaza el constraint de BD, rompiendo en silencio la cascada
 * cascade-block-materials.ts (catch que traga el error → paso 8 nunca se inserta).
 *
 * Tipos resultantes: ['rubric','checklist','material','lesson_plan',
 *                     'practice_guide','teacher_guide','visual']
 *
 * EJECUTAR UNA SOLA VEZ en producción:
 *   cmd /c "node --env-file=.env.local scripts/alter-planning-extras-type-check.js"
 *
 * Idempotente: si el constraint ya incluye teacher_guide y visual, no hace nada.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL no encontrada en .env.local');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const CONSTRAINT_NAME = 'planning_extras_type_check';
const EXPECTED_TYPES = [
  'rubric',
  'checklist',
  'material',
  'lesson_plan',
  'practice_guide',
  'teacher_guide',
  'visual',
];

async function getConstraintDef() {
  const rows = await sql`
    SELECT conrelid::regclass::text AS table_name,
           pg_get_constraintdef(oid) AS constraint_def
    FROM pg_constraint
    WHERE conname = ${CONSTRAINT_NAME}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function run() {
  console.log('🔄  Verificando constraint planning_extras_type_check...\n');

  try {
    const current = await getConstraintDef();

    if (!current) {
      console.error(`❌  No existe el constraint ${CONSTRAINT_NAME}. Abortando (no se modifica nada).`);
      process.exit(1);
    }

    console.log(`   Tabla:      ${current.table_name}`);
    console.log(`   Constraint: ${current.constraint_def}\n`);

    if (
      current.constraint_def.includes("'teacher_guide'") &&
      current.constraint_def.includes("'visual'")
    ) {
      console.log('✅  El constraint ya incluye teacher_guide y visual. Nada que hacer (idempotente).');
      process.exit(0);
    }

    const inList = EXPECTED_TYPES.map((t) => `'${t}'`).join(', ');

    // Nota: sql.unsafe() del driver neon HTTP es un fragmento para interpolación
    // dentro de template tags (await sql.unsafe(...) NO ejecuta nada). Para DDL
    // standalone se usa sql.query(cadena).
    await sql.query(
      `ALTER TABLE ${current.table_name} DROP CONSTRAINT IF EXISTS ${CONSTRAINT_NAME}`,
    );
    console.log(`✅  DROP ${CONSTRAINT_NAME}: OK`);

    await sql.query(
      `ALTER TABLE ${current.table_name} ADD CONSTRAINT ${CONSTRAINT_NAME} CHECK (type IN (${inList}))`,
    );
    console.log(`✅  ADD  ${CONSTRAINT_NAME} CHECK (type IN (${inList})): OK`);

    const updated = await getConstraintDef();
    console.log(`\n   Constraint resultante: ${updated ? updated.constraint_def : '⚠️ NO ENCONTRADO'}`);

    if (!updated || !updated.constraint_def.includes("'teacher_guide'") || !updated.constraint_def.includes("'visual'")) {
      console.error('❌  Verificación post-migración falló.');
      process.exit(1);
    }

    console.log('\n🎉  Migración del constraint completada exitosamente.');
    console.log('👉  Siguiente paso: backfill de materiales vía UI (Sincronizar Suite) o POST /api/planeaciones/[id]/materiales-bloque por bloque.');
  } catch (err) {
    console.error('\n❌  Error durante la migración:', err.message);
    process.exit(1);
  }
}

run();
