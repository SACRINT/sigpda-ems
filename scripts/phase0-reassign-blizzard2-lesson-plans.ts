import { readFileSync } from 'fs';
import { Client } from 'pg';
import { extractMaterialsFromWorkbook } from '../src/lib/guide-engine/material-extractor';
import {
  buildPlanEvaluationSummary,
  formatPlanDeClaseMarkdown,
} from '../src/lib/guide-engine/cascade-block-materials';
import { cleanSessionTitle } from '../src/lib/guide-engine/material-persistence-plan';
import type { ActiveWorkTextbook } from '../src/types/work-textbook';
import type { SecuenciaBloque } from '../src/types/planning';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
if (!match) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const client = new Client({
  connectionString: match[1],
  ssl: { rejectUnauthorized: false },
});

const PLANNING_IDS = [
  '4a3335eb-99f3-47f8-a3d0-c83297fe488b',
  '9fcc6660-fb0f-40ac-8601-c99279f83ed1',
] as const;

const BACKUP_TABLE = 'planning_extras_backup_phase0_blizzard2';
const ROLLBACK = process.argv.includes('--rollback');
const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY && !ROLLBACK;

type PlanningRow = {
  id: string;
  uac_name: string;
  content_json: Record<string, any> | null;
  sequence_json: Record<string, SecuenciaBloque> | null;
  extracted_data: Record<string, any> | null;
  workbooks_json: Record<string, { current?: ActiveWorkTextbook }> | null;
};

async function ensureBackupTable(): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${BACKUP_TABLE} (
      id uuid PRIMARY KEY,
      planning_id uuid NOT NULL,
      type text NOT NULL,
      title text NOT NULL,
      key_index integer,
      content_text text NOT NULL,
      created_at timestamptz NOT NULL
    )
  `);
}

async function backupExtras(): Promise<number> {
  const result = await client.query(
    `
      INSERT INTO ${BACKUP_TABLE} (id, planning_id, type, title, key_index, content_text, created_at)
      SELECT id, planning_id, type, title, key_index, content_text, created_at
      FROM planning_extras
      WHERE planning_id = ANY($1::uuid[])
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `,
    [PLANNING_IDS]
  );
  return result.rowCount ?? 0;
}

function getBlockSequence(
  sequenceJson: Record<string, SecuenciaBloque> | null,
  blockIndex: number
): SecuenciaBloque | null {
  if (!sequenceJson) return null;
  return sequenceJson[String(blockIndex)] ?? sequenceJson[blockIndex] ?? null;
}

function buildCurricularAnchor(row: PlanningRow, blockIndex: number) {
  const content = row.content_json ?? {};
  const extractedData = row.extracted_data ?? {};
  const learningOutcomes = Array.isArray(content.sectionII?.learningOutcomes)
    ? content.sectionII.learningOutcomes
    : [];

  return {
    metaEducativa: String(
      extractedData.learningOutcome || content.sectionII?.purpose || ''
    ).trim(),
    propositoFormativo: String(
      learningOutcomes[blockIndex] || content.sectionII?.purpose || ''
    ).trim(),
    contenidoFormativo: '',
  };
}

function buildEvaluationSummary(row: PlanningRow) {
  const rawEvaluations = row.content_json?.sectionV?.evaluations;
  if (!Array.isArray(rawEvaluations)) return null;
  const normalized = rawEvaluations.map((evaluation) => ({
    ...evaluation,
    percentage: evaluation?.percentage ?? evaluation?.weighting,
  }));
  return buildPlanEvaluationSummary(normalized);
}

async function replaceBlockLessonPlans(
  row: PlanningRow,
  blockIndex: number
): Promise<number> {
  const blockKey = `block_${blockIndex}`;
  const workbook = row.workbooks_json?.[blockKey]?.current;
  if (!workbook) {
    throw new Error(`[${row.id}] Falta workbooks_json.${blockKey}.current`);
  }

  const blockSequence = getBlockSequence(row.sequence_json, blockIndex);
  const curricularAnchor = buildCurricularAnchor(row, blockIndex);
  const evaluationSummary = buildEvaluationSummary(row);
  const extracted = extractMaterialsFromWorkbook(
    workbook,
    blockSequence,
    curricularAnchor
  );
  const plans = extracted.planesDeClase ?? [];

  console.log(
    `  [${row.uac_name}] bloque ${blockIndex + 1}: ${plans.length} planes, ` +
      `workbook="${workbook.blockName ?? 'sin nombre'}"`
  );

  if (DRY_RUN) return plans.length;

  await client.query(
    `
      DELETE FROM planning_extras
      WHERE planning_id = $1
        AND type = 'lesson_plan'
        AND key_index = $2
    `,
    [row.id, blockIndex]
  );

  for (const plan of plans) {
    const sessionTitle = cleanSessionTitle(plan.tituloSesion, plan.numeroSesion);
    const title = sessionTitle
      ? `Plan de Clase: Sesión ${plan.numeroSesion} · ${sessionTitle}`
      : `Plan de Clase: Sesión ${plan.numeroSesion}`;
    const markdown = formatPlanDeClaseMarkdown(plan, workbook, evaluationSummary);

    await client.query(
      `
        INSERT INTO planning_extras (planning_id, type, title, key_index, content_text)
        VALUES ($1, 'lesson_plan', $2, $3, $4)
      `,
      [row.id, title, blockIndex, markdown]
    );
  }

  return plans.length;
}

async function rollbackLessonPlans(): Promise<void> {
  const deleted = await client.query(
    `
      DELETE FROM planning_extras
      WHERE planning_id = ANY($1::uuid[])
        AND type = 'lesson_plan'
    `,
    [PLANNING_IDS]
  );
  const restored = await client.query(
    `
      INSERT INTO planning_extras (id, planning_id, type, title, key_index, content_text, created_at)
      SELECT id, planning_id, type, title, key_index, content_text, created_at
      FROM ${BACKUP_TABLE}
      WHERE planning_id = ANY($1::uuid[])
        AND type = 'lesson_plan'
    `,
    [PLANNING_IDS]
  );
  console.log(
    `Rollback lesson_plan: ${deleted.rowCount ?? 0} eliminados, ` +
      `${restored.rowCount ?? 0} restaurados desde ${BACKUP_TABLE}`
  );
}

async function main(): Promise<void> {
  console.log(
    `=== FASE 0: REASIGNACIÓN DE LESSON_PLANS BLIZZARD2 ===\n` +
      `Modo: ${
        ROLLBACK
          ? 'ROLLBACK (restaurar backup)'
          : DRY_RUN
            ? 'DRY-RUN (rollback al final)'
            : 'APLICAR (commit)'
      }\n`
  );

  await client.connect();

  try {
    await client.query('BEGIN');

    if (ROLLBACK) {
      await rollbackLessonPlans();
      await client.query('COMMIT');
      console.log('Rollback confirmado.');
      return;
    }

    await ensureBackupTable();

    const backedUp = await backupExtras();
    console.log(`Backup ${BACKUP_TABLE}: ${backedUp} filas nuevas\n`);

    const rowsResult = await client.query<PlanningRow>(
      `
        SELECT id, uac_name, content_json, sequence_json, extracted_data, workbooks_json
        FROM plannings
        WHERE id = ANY($1::uuid[])
        ORDER BY uac_name
      `,
      [PLANNING_IDS]
    );

    if (rowsResult.rows.length !== PLANNING_IDS.length) {
      throw new Error(
        `Se esperaban ${PLANNING_IDS.length} planeaciones, se encontraron ${rowsResult.rows.length}`
      );
    }

    let totalPlans = 0;
    for (const row of rowsResult.rows) {
      console.log(`Procesando ${row.id} — ${row.uac_name}`);
      for (let blockIndex = 0; blockIndex < 3; blockIndex++) {
        totalPlans += await replaceBlockLessonPlans(row, blockIndex);
      }
      console.log('');
    }

    console.log(`Total de planes derivados: ${totalPlans}`);

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('DRY-RUN completado: transacción revertida, sin cambios.');
    } else {
      await client.query('COMMIT');
      console.log('FASE 0 aplicada: cambios confirmados.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('FASE 0 falló; transacción revertida:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
