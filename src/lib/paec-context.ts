/**
 * paec-context.ts
 * Helper ligero para la interconexión automática PAEC ↔ Planeación (SIGPDA-EMS)
 * 
 * Permite que al seleccionar o cargar el CCT escolar en la planeación didáctica,
 * el sistema extraiga de la base de datos la problemática comunitaria priorizada,
 * el nombre del proyecto PAEC-PEC del plantel, y la vinculación curricular exacta
 * que el Paso 3 / Plan Operativo del PAEC asignó a esa UAC.
 *
 * H-322: el emparejamiento por UAC es ahora estricto y compatible con el esquema real
 * persistido por el generador PAEC (PlanOperativoRow: uac/activity/strategy/progression/week/phase)
 * y con el esquema legado (asignatura/actividad/estrategiaDidactica/...).
 */

import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';
import { normalizeUnicode } from '@/lib/utils/normalize';
import { isActivityAnotherSubjectName } from '@/lib/paec-subject-matching';
import { mapActivityIndexToBlockIndex } from '@/lib/curricular-blocks';

export interface PaecLinkedActivity {
  asignatura: string;
  actividad: string;
  semana?: string;
  fase?: string;
  corte?: 1 | 2 | 3;
  estrategiaDidactica?: string;
  propositoFormativo?: string;
  progresion?: string;
  isPrescheduled: boolean;
}

export interface PaecLinkedContext {
  found: boolean;
  projectId?: string;
  projectName?: string;
  objective?: string;
  problemStatement?: string;
  studentContext?: string;
  cycleType?: string;
  schoolName?: string;
  municipality?: string;
  cct?: string;
  uacTopic?: string;
  uacLinking?: string;
  operationalActivity?: PaecLinkedActivity | null;
  /** Trayectoria completa de actividades PAEC asignadas a esta UAC, ordenadas por semana y mapeadas a Corte 1/2/3 */
  operationalActivities?: PaecLinkedActivity[];
}

type JsonRecord = Record<string, unknown>;

function asRecord(v: unknown): JsonRecord {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonRecord) : {};
}

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function firstStr(rec: JsonRecord, keys: string[]): string {
  for (const k of keys) {
    const s = str(rec[k]);
    if (s) return s;
  }
  return '';
}

function cleanUacToken(s: string): string {
  return normalizeUnicode(s)
    .toLowerCase()
    .replace(/⟦[^⟧]*⟧/g, '')
    .replace(/[.,:;()\[\]{}'"`]/g, ' ')
    .replace(/\b(de|del|la|el|los|las|y|en)\b/g, ' ')
    .replace(/\bvi\b/g, '6')
    .replace(/\bv\b/g, '5')
    .replace(/\biv\b/g, '4')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNormalizedLevelNumber(s: string): string | null {
  const clean = normalizeUnicode(s).toLowerCase().replace(/⟦[^⟧]*⟧/g, '');
  const m = clean.match(/\b(vi|iv|v|iii|ii|i|[1-6])\b(?:\s*[:.\-–].*)?$/i);
  if (!m) return null;
  const map: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6' };
  return map[m[1]] ?? m[1];
}

/**
 * Coincidencia robusta de UAC: ambos lados no vacíos.
 * Tolera diferencias en stopwords ("de", "del"), acentos, mayúsculas,
 * puntuación y numerales romanos vs arábigos (ej: "Taller Pensamiento Variacional I" vs
 * "Taller de Pensamiento Variacional I"), pero impide colisiones entre niveles distintos
 * (ej. "Conciencia Histórica II" NUNCA coincide con "Conciencia Histórica I").
 * Nunca coincide con vacío.
 */
export function uacMatches(a: string, b: string): boolean {
  const x = normalizeUnicode(a).toLowerCase().replace(/\s+/g, ' ').trim();
  const y = normalizeUnicode(b).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!x || !y) return false;

  // Guard de nivel romano/arábigo: si ambos especifican nivel, deben coincidir exactamente
  const lvlA = extractNormalizedLevelNumber(a);
  const lvlB = extractNormalizedLevelNumber(b);
  if (lvlA && lvlB && lvlA !== lvlB) return false;

  if (x === y || x.includes(y) || y.includes(x)) return true;

  const cleanX = cleanUacToken(a);
  const cleanY = cleanUacToken(b);
  if (!cleanX || !cleanY) return false;
  return cleanX === cleanY || cleanX.includes(cleanY) || cleanY.includes(cleanX);
}

/**
 * Aplana plan operativo en cualquiera de sus formas persistidas:
 * arreglo de filas, o { semestreA, semestreB }.
 */
export function flattenPlanOperativo(raw: unknown): JsonRecord[] {
  if (Array.isArray(raw)) return raw.map(asRecord);
  const rec = asRecord(raw);
  const a = Array.isArray(rec.semestreA) ? rec.semestreA : [];
  const b = Array.isArray(rec.semestreB) ? rec.semestreB : [];
  return [...a, ...b].map(asRecord);
}

function formatWeek(week: string): string | undefined {
  if (!week) return undefined;
  return /^\d/.test(week) ? `Semana ${week}` : week;
}

function extractWeekNumber(week?: string): number {
  const m = String(week ?? '').match(/\d+/);
  return m ? Number(m[0]) : 99;
}

/**
 * Deriva el Corte oficial (1, 2 o 3) de una actividad PAEC usando el SSoT `mapActivityIndexToBlockIndex`
 * de `curricular-blocks.ts` a partir del número de Propósito/Progresión/Actividad Clave citado
 * (sin rangos hardcodeados de semana), con respaldo por Fase del PEC (Fase 1/4 -> Corte 1,
 * Fase 2/5 -> Corte 2, Fase 3/6 -> Corte 3).
 */
export function resolvePaecActivityCorte(
  activity: { progresion?: string; propositoFormativo?: string; fase?: string },
  totalCurricularActivities = 8
): 1 | 2 | 3 | undefined {
  const progText = activity.propositoFormativo || activity.progresion || '';
  const numMatch = progText.match(/(?:Prop[oó]sito\s+Formativo|Progresi[oó]n(?:\s+de\s+Aprendizaje)?|Actividad\s+Clave)\s*(\d+)/i);
  if (numMatch?.[1]) {
    const idx0 = Math.max(0, Number(numMatch[1]) - 1);
    const total = Math.max(totalCurricularActivities, idx0 + 1);
    return (mapActivityIndexToBlockIndex(idx0, total) + 1) as 1 | 2 | 3;
  }
  const faseMatch = String(activity.fase ?? '').match(/fase\s*(\d+)/i);
  if (faseMatch?.[1]) {
    const f = Number(faseMatch[1]);
    if (f === 1 || f === 4) return 1;
    if (f === 2 || f === 5) return 2;
    if (f === 3 || f === 6) return 3;
  }
  return undefined;
}

/**
 * Devuelve TODAS las actividades del plan operativo asignadas a la UAC dada,
 * deduplicadas, ordenadas por semana y mapeadas a Corte 1/2/3 vía `curricular-blocks.ts`.
 */
export function matchOperationalActivities(
  planRows: JsonRecord[],
  targetUac: string,
  options?: { totalCurricularActivities?: number }
): PaecLinkedActivity[] {
  if (!normalizeUnicode(targetUac).trim()) return [];

  const subjectNames = planRows
    .map((row) => firstStr(row, ['uac', 'asignatura', 'uacName']))
    .filter(Boolean);

  const seen = new Set<string>();
  const matched: PaecLinkedActivity[] = [];

  for (const row of planRows) {
    const asignatura = firstStr(row, ['uac', 'asignatura', 'uacName']);
    const actividad = firstStr(row, ['activity', 'actividad', 'macroActivities']);
    if (!actividad || !asignatura) continue;
    const normAsig = normalizeUnicode(asignatura).toLowerCase().trim();
    const normAct = normalizeUnicode(actividad).toLowerCase().trim();
    if (normAct === normAsig || uacMatches(actividad, asignatura) || !uacMatches(asignatura, targetUac)) continue;
    if (isActivityAnotherSubjectName(actividad, subjectNames)) continue;

    const semana = formatWeek(firstStr(row, ['week', 'semana', 'periodo']));
    const dedupeKey = `${normAct}::${semana ?? ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const fase = firstStr(row, ['phase', 'fase']) || undefined;
    const propositoFormativo = firstStr(row, ['propositoFormativo']) || undefined;
    const progresion = firstStr(row, ['progression', 'progresion']) || undefined;

    matched.push({
      asignatura,
      actividad,
      semana,
      fase,
      corte: resolvePaecActivityCorte(
        { progresion, propositoFormativo, fase },
        options?.totalCurricularActivities
      ),
      estrategiaDidactica: firstStr(row, ['strategy', 'estrategiaDidactica']) || undefined,
      propositoFormativo,
      progresion,
      isPrescheduled: true,
    });
  }

  return matched.sort((a, b) => extractWeekNumber(a.semana) - extractWeekNumber(b.semana));
}

/**
 * Busca en las filas del plan operativo la primera actividad de la UAC dada (retrocompatible).
 * Solo devuelve filas con actividad no vacía (no fabrica vínculos).
 */
export function matchOperationalActivity(
  planRows: JsonRecord[],
  targetUac: string
): PaecLinkedActivity | null {
  return matchOperationalActivities(planRows, targetUac)[0] ?? null;
}

/**
 * Busca en el mapeo curricular (Paso 3, DetalleCurricularRow) la fila de la UAC/semestre.
 */
export function matchCurricularMapping(
  mapeo: unknown,
  targetUac: string,
  targetSemester?: number
): { uacTopic?: string; uacLinking?: string } {
  const rows = (Array.isArray(mapeo) ? mapeo : []).map(asRecord);
  if (!normalizeUnicode(targetUac).trim() && !targetSemester) return {};
  const row = rows.find((item) => {
    const itemUac = firstStr(item, ['uacName', 'asignatura', 'uac']);
    const itemSem = Number(item.semester ?? item.semestre);
    const uacOk = targetUac ? uacMatches(itemUac, targetUac) : true;
    const semOk = targetSemester ? itemSem === targetSemester : true;
    return uacOk && semOk;
  });
  if (!row) return {};
  return {
    uacTopic: firstStr(row, ['progressionsOrPurposes', 'topic', 'contenido', 'tema']) || undefined,
    uacLinking: firstStr(row, ['curricularJustification', 'linking', 'vinculacion']) || undefined,
  };
}

export async function loadPaecContext(
  cct: string,
  options?: {
    semester?: number;
    uacName?: string;
    teacherId?: string;
    totalCurricularActivities?: number;
  }
): Promise<PaecLinkedContext> {
  const cleanCct = (cct || '').trim().toUpperCase();
  if (!cleanCct && !options?.teacherId) {
    return { found: false };
  }

  try {
    let rows: JsonRecord[] = [];

    if (cleanCct) {
      // Buscar proyectos que coincidan con el CCT en school_context o community_context
      rows = (await sql()`
        SELECT id, project_name, problem_statement, cycle_type, school_context, community_context,
               fase1_diagnostico, fase2_justificacion,
               fase2_mapeo, fase2_plan_operativo, fase3_plan_operativo_a, fase3_plan_operativo_b
        FROM paec_projects
        WHERE school_context->>'cct' ILIKE ${cleanCct}
           OR community_context->>'cct' ILIKE ${cleanCct}
           OR school_context::text ILIKE ${'%' + cleanCct + '%'}
        ORDER BY updated_at DESC
        LIMIT 1
      `) as JsonRecord[];
    }

    // Fallback: Si no se encuentra por CCT pero hay teacherId, buscar por docente
    if (rows.length === 0 && options?.teacherId) {
      rows = (await sql()`
        SELECT id, project_name, problem_statement, cycle_type, school_context, community_context,
               fase1_diagnostico, fase2_justificacion,
               fase2_mapeo, fase2_plan_operativo, fase3_plan_operativo_a, fase3_plan_operativo_b
        FROM paec_projects
        WHERE teacher_id = ${options.teacherId}::uuid
        ORDER BY updated_at DESC
        LIMIT 1
      `) as JsonRecord[];
    }

    if (rows.length === 0) {
      return { found: false };
    }

    const p = rows[0];
    const schoolCtx = asRecord(p.school_context);
    const commCtx = asRecord(p.community_context);
    const justif = asRecord(p.fase2_justificacion);
    const diag = asRecord(p.fase1_diagnostico);

    const schoolName = firstStr(schoolCtx, ['nombre_escuela', 'schoolName']) || firstStr(commCtx, ['schoolName']);
    const municipality = firstStr(schoolCtx, ['municipio', 'municipality']) || firstStr(commCtx, ['municipality']);
    const foundCct = firstStr(schoolCtx, ['cct']) || firstStr(commCtx, ['cct']) || cleanCct;
    const objective =
      firstStr(justif, ['objetivo_general', 'generalObjective', 'objective', 'objetivoGeneral']) ||
      firstStr(schoolCtx, ['objective', 'paecObjective']);
    const studentContext =
      firstStr(commCtx, ['studentContext', 'demographics', 'caracterizacion_estudiantes']) ||
      firstStr(schoolCtx, ['studentContext', 'caracterizacion_estudiantes']) ||
      (Array.isArray(diag.tabla2)
        ? diag.tabla2
            .map((r: unknown) => str(asRecord(r).col2))
            .filter(Boolean)
            .slice(0, 2)
            .join(' ')
        : '');

    const targetUac = (options?.uacName || '').trim();

    // 1. Mapeo curricular (Paso 3 del PAEC)
    const { uacTopic, uacLinking } = matchCurricularMapping(p.fase2_mapeo, targetUac, options?.semester);

    // 2. Plan operativo (Pasos 6 y 7 del PAEC; también formato legado fase2)
    // Prioriza el semestre correspondiente a la paridad solicitada (1/3/5 -> Sem A, 2/4/6 -> Sem B)
    // y cae a respaldo en los demás bloques solo si no hay coincidencia en la paridad primaria.
    const rowsA = flattenPlanOperativo(p.fase3_plan_operativo_a);
    const rowsB = flattenPlanOperativo(p.fase3_plan_operativo_b);
    const rowsLegacy = flattenPlanOperativo(p.fase2_plan_operativo);

    let operationalActivities: PaecLinkedActivity[] = [];
    const matchOpts = options?.totalCurricularActivities
      ? { totalCurricularActivities: options.totalCurricularActivities }
      : undefined;
    if (typeof options?.semester === 'number' && options.semester >= 1 && options.semester <= 6) {
      const primaryRows = options.semester % 2 === 1 ? rowsA : rowsB;
      operationalActivities = matchOperationalActivities(primaryRows, targetUac, matchOpts);
    }
    if (operationalActivities.length === 0) {
      operationalActivities = matchOperationalActivities([...rowsLegacy, ...rowsA, ...rowsB], targetUac, matchOpts);
    }
    const operationalActivity = operationalActivities[0] ?? null;

    return {
      found: true,
      projectId: str(p.id),
      projectName: str(p.project_name),
      objective: objective || undefined,
      problemStatement: str(p.problem_statement),
      studentContext: studentContext || undefined,
      cycleType: str(p.cycle_type),
      schoolName,
      municipality,
      cct: foundCct,
      uacTopic,
      uacLinking,
      operationalActivity,
      operationalActivities,
    };
  } catch (error) {
    logger.warn('Error al cargar contexto PAEC desde base de datos:', error);
    return { found: false };
  }
}
