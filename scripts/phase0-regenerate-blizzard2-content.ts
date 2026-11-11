import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { generateWithRotation } from '../src/lib/ai-provider';
import { SYSTEM_PROMPT } from '../src/lib/prompts/system-prompt';
import { buildUserPrompt } from '../src/lib/prompts/build-prompt';
import { parseAIResponse } from '../src/lib/ai-response-parser';
import { PlanningContentSchema } from '../src/lib/ai-schemas';
import { cleanLearningOutcomeText } from '../src/lib/pdf-parser';
import type {
  ExtractedPdfData,
  GeneratedPlanningContent,
  KeyActivity,
  TeacherContext,
} from '../src/types/planning';

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

const TARGETS = [
  '4a3335eb-99f3-47f8-a3d0-c83297fe488b',
  '9fcc6660-fb0f-40ac-8601-c99279f83ed1',
] as const;

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const DELETE_EXTRAS = process.argv.includes('--delete-extras');
const ONLY_INDEX = process.argv.indexOf('--planning');
const ONLY_ID = ONLY_INDEX >= 0 ? process.argv[ONLY_INDEX + 1] : undefined;

interface PlanningRow {
  id: string;
  teacher_id: string;
  uac_name: string;
  semester: number;
  component: string;
  curriculum_name: string | null;
  paec_context: string | null;
  metodologia_activa: string | null;
  extracted_data: Record<string, unknown> | null;
  content_json: Record<string, any> | null;
  teacher_name: string | null;
  teacher_email: string | null;
  teacher_school_name: string | null;
  teacher_municipality: string | null;
  teacher_subsystem: string | null;
  teacher_cct: string | null;
}

interface ProgramRow {
  id: string;
  uac_name: string;
  semester: number;
  component: string;
  curriculum_name: string | null;
  total_hours: number;
  learning_outcome: string;
  activities: Array<{ name?: string; description?: string; hours?: number; order?: number }>;
  evidences: unknown;
  contenidos_formativos: unknown;
  subsystem: string | null;
  model_type: string | null;
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function ensureBackups(): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS plannings_backup_phase0_regen AS
    SELECT * FROM plannings WITH NO DATA
  `);
  await client.query(`
    INSERT INTO plannings_backup_phase0_regen
    SELECT p.*
    FROM plannings p
    WHERE p.id = ANY($1::uuid[])
      AND NOT EXISTS (
        SELECT 1 FROM plannings_backup_phase0_regen b WHERE b.id = p.id
      )
  `, [TARGETS]);

  await client.query(`
    CREATE TABLE IF NOT EXISTS planning_extras_backup_phase0_regen AS
    SELECT * FROM planning_extras WITH NO DATA
  `);
  await client.query(`
    INSERT INTO planning_extras_backup_phase0_regen
    SELECT e.*
    FROM planning_extras e
    WHERE e.planning_id = ANY($1::uuid[])
      AND NOT EXISTS (
        SELECT 1 FROM planning_extras_backup_phase0_regen b WHERE b.id = e.id
      )
  `, [TARGETS]);
}

async function loadPlanning(id: string): Promise<PlanningRow> {
  const result = await client.query<PlanningRow>(`
    SELECT p.id, p.teacher_id, p.uac_name, p.semester, p.component,
           p.curriculum_name, p.paec_context, p.metodologia_activa,
           p.extracted_data, p.content_json,
           t.name AS teacher_name, t.email AS teacher_email,
           t.school_name AS teacher_school_name,
           t.municipality AS teacher_municipality,
           t.subsystem AS teacher_subsystem,
           t.cct AS teacher_cct
    FROM plannings p
    JOIN teachers t ON t.id = p.teacher_id
    WHERE p.id = $1::uuid
    LIMIT 1
  `, [id]);

  if (result.rows.length === 0) {
    throw new Error(`Planeación no encontrada: ${id}`);
  }
  return result.rows[0];
}

async function loadProgram(planning: PlanningRow): Promise<ProgramRow> {
  const result = await client.query<ProgramRow>(`
    SELECT id, uac_name, semester, component, curriculum_name, total_hours,
           learning_outcome, activities, evidences, contenidos_formativos,
           subsystem, model_type
    FROM programs_catalog
    WHERE uac_name = $1
      AND semester = $2
      AND component = $3
    ORDER BY CASE WHEN subsystem = 'bge' THEN 0 ELSE 1 END
    LIMIT 1
  `, [planning.uac_name, planning.semester, planning.component]);

  if (result.rows.length === 0) {
    throw new Error(
      `No hay programa de catálogo para "${planning.uac_name}" ` +
        `(semestre ${planning.semester}, componente ${planning.component})`
    );
  }
  return result.rows[0];
}

function normalizeActivities(program: ProgramRow): KeyActivity[] {
  const raw = Array.isArray(program.activities) ? program.activities : [];
  if (raw.length === 0) {
    throw new Error(`El programa ${program.uac_name} no tiene actividades en catálogo`);
  }

  return raw.map((activity, index) => ({
    name: String(activity.name || activity.description || `Actividad ${index + 1}`).trim(),
    hours: Number(activity.hours) || Math.round(program.total_hours / raw.length),
    order: Number(activity.order) || index + 1,
    corte: `Corte ${index + 1}`,
  }));
}

function buildExtractedData(program: ProgramRow, planning: PlanningRow): ExtractedPdfData {
  const activities = normalizeActivities(program);
  const evidences = Array.isArray(program.evidences)
    ? (program.evidences as unknown[]).filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      )
    : [];

  return {
    uacName: program.uac_name,
    component: planning.component,
    learningOutcome: cleanLearningOutcomeText(program.learning_outcome || ''),
    totalHours: Number(program.total_hours) || 54,
    activities,
    evidences,
    parseConfidence: 'high',
    contenidosFormativos: Array.isArray(program.contenidos_formativos)
      ? (program.contenidos_formativos as ExtractedPdfData['contenidosFormativos'])
      : null,
  };
}

function buildTeacherContext(
  planning: PlanningRow,
  extracted: ExtractedPdfData
): TeacherContext {
  const sectionI = (planning.content_json?.sectionI || {}) as Record<string, any>;

  return {
    teacherName: String(sectionI.teacherName || planning.teacher_name || 'Docente'),
    directorName: typeof sectionI.directorName === 'string' ? sectionI.directorName : undefined,
    supervisorName:
      typeof sectionI.supervisorName === 'string' ? sectionI.supervisorName : undefined,
    schoolName: String(
      sectionI.schoolName || planning.teacher_school_name || 'Plantel educativo'
    ),
    cct: String(sectionI.cct || planning.teacher_cct || ''),
    locality: typeof sectionI.locality === 'string' ? sectionI.locality : undefined,
    municipality: String(
      sectionI.municipality || planning.teacher_municipality || 'Puebla'
    ),
    schoolZone:
      typeof sectionI.schoolZone === 'string' ? sectionI.schoolZone : undefined,
    state: 'Puebla',
    region:
      typeof sectionI.schoolZone === 'string' ? sectionI.schoolZone : 'Puebla',
    subsystem: String(
      sectionI.subsystem || planning.teacher_subsystem || 'Bachillerato General Estatal (BGE)'
    ),
    groupInfo: String(sectionI.groups || 'Grupo A'),
    applicationPeriod: String(
      sectionI.applicationPeriod || 'Agosto 2026 – Enero 2027'
    ),
    fechasCortes:
      sectionI.fechasCortes && typeof sectionI.fechasCortes === 'object'
        ? sectionI.fechasCortes
        : undefined,
    paecProjectName:
      typeof sectionI.paecProjectName === 'string' ? sectionI.paecProjectName : undefined,
    paecObjective:
      typeof sectionI.paecObjective === 'string' ? sectionI.paecObjective : undefined,
    paecProblem: String(planning.paec_context || ''),
    paecOperationalActivity:
      sectionI.paecOperationalActivity &&
      typeof sectionI.paecOperationalActivity === 'object'
        ? sectionI.paecOperationalActivity
        : null,
    usePaecActivity: true,
    schoolResources:
      typeof sectionI.schoolResources === 'string' ? sectionI.schoolResources : undefined,
    studentContext: String(
      sectionI.studentContext ||
        `Estudiantes de bachillerato del municipio de ${
          sectionI.municipality || planning.teacher_municipality || 'Puebla'
        }, con formación laboral en ${planning.curriculum_name || 'el componente laboral'}.`
    ),
    metodologiaActiva: String(
      planning.metodologia_activa || 'practica_laboratorio'
    ),
  };
}

function preserveAdministrativeSections(
  generated: GeneratedPlanningContent,
  existing: Record<string, any> | null,
  planning: PlanningRow,
  program: ProgramRow,
  activities: KeyActivity[]
): GeneratedPlanningContent {
  const existingSectionI = (existing?.sectionI || {}) as Record<string, any>;
  const existingSectionV = (existing?.sectionV || {}) as Record<string, any>;

  const sectionI = {
    ...existingSectionI,
    uacName: planning.uac_name,
    semester: planning.semester,
    component: existingSectionI.component || 'Formación Laboral',
    totalHours: Number(program.total_hours) || 54,
    teacherName: existingSectionI.teacherName || planning.teacher_name || 'Docente',
    schoolName: existingSectionI.schoolName || planning.teacher_school_name || '',
    cct: existingSectionI.cct || planning.teacher_cct || '',
    municipality:
      existingSectionI.municipality || planning.teacher_municipality || '',
  };

  const learningOutcomes = activities.map((activity) => activity.name);

  const sectionII = {
    ...(generated.sectionII || {}),
    purpose: cleanLearningOutcomeText(program.learning_outcome || ''),
    learningOutcomes,
    activities,
  };

  const generatedS4 = Array.isArray(generated.sectionIV?.activities)
    ? generated.sectionIV.activities
    : [];

  if (generatedS4.length !== activities.length) {
    throw new Error(
      `La IA devolvió ${generatedS4.length} bloques de Sección IV; ` +
        `se esperaban ${activities.length} para ${planning.uac_name}`
    );
  }

  const sectionIV = {
    ...(generated.sectionIV || {}),
    activities: activities.map((activity, index) => ({
      ...(generatedS4[index] || {}),
      name: activity.name,
      hours: activity.hours,
      order: activity.order,
      corte: activity.corte,
    })),
  };

  return {
    ...generated,
    sectionI,
    sectionII,
    sectionIV,
    sectionV: existingSectionV.evaluations ? existingSectionV : generated.sectionV,
    sectionVII: {},
  } as GeneratedPlanningContent;
}

async function generateOne(planning: PlanningRow): Promise<void> {
  const program = await loadProgram(planning);
  const extracted = buildExtractedData(program, planning);
  const context = buildTeacherContext(planning, extracted);

  const userPrompt = buildUserPrompt(
    extracted,
    context,
    planning.semester,
    planning.component,
    program,
    null,
    null,
    null
  );

  console.log('='.repeat(78));
  console.log(`REGENERANDO CONTENIDO: ${planning.uac_name}`);
  console.log(`planning=${planning.id}`);
  console.log(`catálogo=${program.id} | horas=${program.total_hours}`);
  console.log(`actividades=${extracted.activities.length}`);
  console.log(`prompt=${userPrompt.length} caracteres`);
  console.log('='.repeat(78));

  if (!APPLY) {
    console.log('[DRY-RUN] No se llamó a la IA ni se modificó la base.');
    return;
  }

  const raw = await generateWithRotation(
    SYSTEM_PROMPT,
    userPrompt,
    planning.teacher_id,
    false,
    {
      jsonMode: true,
      maxTokens: 32768,
      timeoutMs: 270000,
      remainingBudgetMs: 280000,
    }
  );

  const parsed = parseAIResponse<GeneratedPlanningContent>(
    raw,
    PlanningContentSchema as never,
    { contextName: `regen-content-${planning.id}` }
  );

  if (!parsed.success) {
    throw new Error(parsed.error);
  }

  const content = preserveAdministrativeSections(
    parsed.data as unknown as GeneratedPlanningContent,
    planning.content_json,
    planning,
    program,
    extracted.activities
  );

  await client.query(
    `
      UPDATE plannings
      SET extracted_data = $1::jsonb,
          content_json = $2::jsonb,
          sequence_json = NULL,
          workbooks_json = '{}'::jsonb,
          workbook_progress = '{}'::jsonb,
          evaluation_json = NULL,
          updated_at = NOW()
      WHERE id = $3::uuid
    `,
    [JSON.stringify(extracted), JSON.stringify(content), planning.id]
  );

  console.log(`[OK] Contenido regenerado para ${planning.id}`);
}

async function main(): Promise<void> {
  if (!process.env.AI_FAST_FAIL_503_THRESHOLD) {
    process.env.AI_FAST_FAIL_503_THRESHOLD = '10';
  }

  const targetIds = ONLY_ID ? [ONLY_ID] : [...TARGETS];

  if (ONLY_ID && !TARGETS.includes(ONLY_ID as (typeof TARGETS)[number])) {
    throw new Error(`--planning no pertenece a los objetivos: ${ONLY_ID}`);
  }

  await client.connect();

  try {
    await ensureBackups();

    if (DELETE_EXTRAS) {
      const deleted = await client.query(
        `DELETE FROM planning_extras WHERE planning_id = ANY($1::uuid[])`,
        [TARGETS]
      );
      console.log(`Extras obsoletos eliminados: ${deleted.rowCount ?? 0}`);
      return;
    }

    for (const id of targetIds) {
      const planning = await loadPlanning(id);
      await generateOne(planning);
    }

    if (APPLY) {
      console.log('\nContenido regenerado. Siguiente paso: regenerar secuencia/workbook por bloque.');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('\nERROR:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
