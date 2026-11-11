/**
 * regenerate-canonical-planning.ts
 * Regenera secuencia y workbook de una planeacion canonica ya reseteada.
 *
 * Uso:
 *   npx tsx scripts/regenerate-canonical-planning.ts --planning <uuid> --block 0
 *   npx tsx scripts/regenerate-canonical-planning.ts --planning <uuid> --block 0 --skip-sequence
 *   npx tsx scripts/regenerate-canonical-planning.ts --planning <uuid> --block 0 --sequence-only
 *
 * La secuencia se construye con el orquestador determinista de planeaciones.
 * El workbook usa el pipeline fail-closed del orquestador editorial.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (value && !process.env[key]) process.env[key] = value;
  }
}

loadEnv();

import { sql } from '../src/lib/db/client';
import { generateBlockWorkTextbook } from '../src/lib/guide-engine/block-guide-orchestrator';
import { resolveSessionsPerBlock, resolveWeeklyHours } from '../src/lib/guide-engine/content-budget';
import { resolveCurricularBlocks } from '../src/lib/curricular-blocks';
import { planeacionesOrchestrator } from '../src/lib/planeaciones/orchestrator';
import { ensureRetoSituadoCalidad } from '../src/lib/planning-evaluator';
import type { GeneratedPlanningContent, SecuenciaBloque, SecuenciaSesion } from '../src/types/planning';

interface RawPlanningRow {
  id: string;
  uac_name: string;
  semester: number;
  component: string;
  paec_context: string | null;
  content_json: GeneratedPlanningContent | null;
  sequence_json: Record<number, SecuenciaBloque> | null;
  metodologia_activa: string | null;
  teacher_id: string;
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadPlanning(id: string): Promise<RawPlanningRow> {
  const client = sql();
  const rows = (await client`
    SELECT id, uac_name, semester, component, paec_context, content_json, sequence_json, metodologia_activa, teacher_id
    FROM plannings
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as unknown as RawPlanningRow[];
  if (rows.length === 0) throw new Error(`Planeacion no encontrada: ${id}`);
  return rows[0];
}

async function regenerateSequence(
  planning: RawPlanningRow,
  blockIndex: number,
  sessionsPerBlock: number
): Promise<number> {
  const content = planning.content_json || ({} as GeneratedPlanningContent);
  const blocks = resolveCurricularBlocks(content);
  const block = blocks[blockIndex];
  if (!block) throw new Error(`Bloque ${blockIndex} no encontrado en la planeacion ${planning.id}`);

  const sequenceResult = await planeacionesOrchestrator.buildSequence({
    blockIndex,
    totalHours: sessionsPerBlock,
    planningId: planning.id,
    uacName: planning.uac_name,
    blockName: block.title,
    contenidoFormativo: block.contenidoFormativo,
    saberes: block.saberes || block.activities[0]?.saberes || null,
    learningOutcome: block.learningOutcome || content.sectionII?.learningOutcomes?.[blockIndex] || '',
    methodology: block.methodology || planning.metodologia_activa || 'Aprendizaje Basado en Proyectos (ABP)',
    paecContext: planning.paec_context || '',
  });

  const sessions = (sequenceResult.sessions as SecuenciaSesion[] | undefined) || [];
  if (sessions.length !== sessionsPerBlock) {
    throw new Error(
      `Secuencia incompleta para bloque ${blockIndex}: ${sessions.length}/${sessionsPerBlock} sesiones.`
    );
  }

  const ensuredReto = ensureRetoSituadoCalidad(content.sectionII?.retoSituado, {
    municipality: content.sectionI?.schoolMunicipality || content.sectionI?.municipality,
    schoolName: content.sectionI?.schoolName,
    uacName: planning.uac_name,
    paecProblem: planning.paec_context || content.sectionII?.paecConnection,
  });
  const updatedContent: GeneratedPlanningContent = {
    ...content,
    sectionII: {
      ...(content.sectionII || {}),
      retoSituado: ensuredReto,
    },
  };

  const updatedSequence: Record<number, SecuenciaBloque> = {
    ...(planning.sequence_json || {}),
    [blockIndex]: {
      blockIndex,
      blockName: block.title,
      hours: sessionsPerBlock,
      sessions,
      updatedAt: new Date().toISOString(),
    },
  };

  const client = sql();
  await client`
    UPDATE plannings
    SET sequence_json = ${JSON.stringify(updatedSequence)}::jsonb,
        content_json = ${JSON.stringify(updatedContent)}::jsonb,
        updated_at = NOW()
    WHERE id = ${planning.id}::uuid
  `;
  return sessions.length;
}

async function main(): Promise<void> {
  const planningId = getArg('--planning');
  const blockArg = getArg('--block');
  const budgetArg = getArg('--budget-ms');
  const retriesArg = getArg('--retries');
  const skipSequence = process.argv.includes('--skip-sequence');
  const sequenceOnly = process.argv.includes('--sequence-only');

  if (!planningId) throw new Error('Falta --planning <uuid>.');
  const blockIndex = blockArg === undefined ? 0 : Number(blockArg);
  if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex > 2) {
    throw new Error('--block debe ser 0, 1 o 2.');
  }
  const maxBudgetMs = budgetArg === undefined ? undefined : Number(budgetArg);
  if (maxBudgetMs !== undefined && (!Number.isFinite(maxBudgetMs) || maxBudgetMs <= 0)) {
    throw new Error('--budget-ms debe ser un numero positivo.');
  }
  const maxRetriesPerWriter = retriesArg === undefined ? 0 : Number(retriesArg);
  if (!Number.isInteger(maxRetriesPerWriter) || maxRetriesPerWriter < 0 || maxRetriesPerWriter > 4) {
    throw new Error('--retries debe ser un entero entre 0 y 4.');
  }

  if (!process.env.AI_FAST_FAIL_503_THRESHOLD) {
    process.env.AI_FAST_FAIL_503_THRESHOLD = '10';
  }

  const planning = await loadPlanning(planningId);
  const weeklyHours = resolveWeeklyHours(planning);
  const sessionsPerBlock = resolveSessionsPerBlock(weeklyHours);

  console.log('='.repeat(78));
  console.log(`REGENERANDO ${planning.uac_name}`);
  console.log(`planning=${planning.id} | bloque=${blockIndex} | horas/semana=${weeklyHours} | sesiones=${sessionsPerBlock}`);
  console.log('='.repeat(78));

  if (!skipSequence) {
    const sessionCount = await regenerateSequence(planning, blockIndex, sessionsPerBlock);
    console.log(`[SECUENCIA] OK — ${sessionCount} sesiones persistidas.`);
  } else {
    console.log('[SECUENCIA] Omitida por --skip-sequence.');
  }

  if (sequenceOnly) {
    console.log('[WORKBOOK] Omitido por --sequence-only.');
    return;
  }

  const workbook = await generateBlockWorkTextbook(planning.id, blockIndex, {
    maxRetriesPerWriter,
    persistWorkbook: true,
    maxBudgetMs,
    expandDeficientSessions: true,
  });

  console.log('[WORKBOOK] OK');
  console.log(`  sesiones: ${workbook.coverageReport?.sessionsCovered ?? '?'}/${workbook.coverageReport?.sessionsExpected ?? sessionsPerBlock}`);
  console.log(`  palabras: ${workbook.totalWords ?? '?'} | paginas: ${workbook.totalPages ?? '?'}`);
  console.log(`  qualityWarning: ${workbook.qualityWarning}`);
  console.log(`  alineacion: ${workbook.planningAlignment?.pass ? 'PASS' : 'FAIL'} (${workbook.planningAlignment?.score ?? '?'})`);

  console.log('[CASCADE] Generando materiales derivados (planes de clase, rúbrica, lista, guías)...');
  const { cascadeBlockMaterials } = await import('../src/lib/guide-engine/cascade-block-materials');
  const cascadeRes = await cascadeBlockMaterials(
    planning.id,
    blockIndex,
    workbook,
    planning.teacher_id,
    {
      uacName: planning.uac_name,
      component: planning.component,
      failOnAnyError: true,
    }
  );

  if (!cascadeRes.success) {
    throw new Error(
      `[CASCADE] Falló la generación de materiales derivados del bloque ${blockIndex}: ${
        cascadeRes.error || 'sin detalle'
      }. Omitidos: ${(cascadeRes.omitted || []).join(', ') || 'ninguno'}.`
    );
  }
  if ((cascadeRes.omitted || []).length > 0) {
    throw new Error(
      `[CASCADE] El bloque ${blockIndex} quedó incompleto: omitidos [${(cascadeRes.omitted || []).join(', ')}]. ` +
        'No se considera una regeneración exitosa.'
    );
  }

  console.log(
    `[CASCADE] OK — success: ${cascadeRes.success}, extras: ${cascadeRes.extrasInserted}, planes: ${cascadeRes.planesCount}`
  );
}

main().catch((error) => {
  console.error('\nERROR:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
