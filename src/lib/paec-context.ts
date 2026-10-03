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

export interface PaecLinkedActivity {
  asignatura: string;
  actividad: string;
  semana?: string;
  fase?: string;
  estrategiaDidactica?: string;
  propositoFormativo?: string;
  progresion?: string;
  isPrescheduled: boolean;
}

export interface PaecLinkedContext {
  found: boolean;
  projectId?: string;
  projectName?: string;
  problemStatement?: string;
  cycleType?: string;
  schoolName?: string;
  municipality?: string;
  cct?: string;
  uacTopic?: string;
  uacLinking?: string;
  operationalActivity?: PaecLinkedActivity | null;
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

/**
 * Coincidencia estricta de UAC: ambos lados no vacíos, igualdad o contención
 * sobre texto normalizado (sin acentos, minúsculas). Nunca coincide con vacío.
 */
export function uacMatches(a: string, b: string): boolean {
  const x = normalizeUnicode(a).replace(/\s+/g, ' ').trim();
  const y = normalizeUnicode(b).replace(/\s+/g, ' ').trim();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
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

/**
 * Busca en las filas del plan operativo la actividad de la UAC dada.
 * Solo devuelve filas con actividad no vacía (no fabrica vínculos).
 */
export function matchOperationalActivity(
  planRows: JsonRecord[],
  targetUac: string
): PaecLinkedActivity | null {
  if (!normalizeUnicode(targetUac).trim()) return null;
  for (const row of planRows) {
    const asignatura = firstStr(row, ['uac', 'asignatura', 'uacName']);
    const actividad = firstStr(row, ['activity', 'actividad', 'macroActivities']);
    if (!actividad || !uacMatches(asignatura, targetUac)) continue;
    return {
      asignatura,
      actividad,
      semana: formatWeek(firstStr(row, ['week', 'semana', 'periodo'])),
      fase: firstStr(row, ['phase', 'fase']) || undefined,
      estrategiaDidactica: firstStr(row, ['strategy', 'estrategiaDidactica']) || undefined,
      propositoFormativo: firstStr(row, ['propositoFormativo']) || undefined,
      progresion: firstStr(row, ['progression', 'progresion']) || undefined,
      isPrescheduled: true,
    };
  }
  return null;
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

    const schoolName = firstStr(schoolCtx, ['nombre_escuela', 'schoolName']) || firstStr(commCtx, ['schoolName']);
    const municipality = firstStr(schoolCtx, ['municipio', 'municipality']) || firstStr(commCtx, ['municipality']);
    const foundCct = firstStr(schoolCtx, ['cct']) || firstStr(commCtx, ['cct']) || cleanCct;

    const targetUac = (options?.uacName || '').trim();

    // 1. Mapeo curricular (Paso 3 del PAEC)
    const { uacTopic, uacLinking } = matchCurricularMapping(p.fase2_mapeo, targetUac, options?.semester);

    // 2. Plan operativo (Pasos 6 y 7 del PAEC; también formato legado fase2)
    const planRows = [
      ...flattenPlanOperativo(p.fase2_plan_operativo),
      ...flattenPlanOperativo(p.fase3_plan_operativo_a),
      ...flattenPlanOperativo(p.fase3_plan_operativo_b),
    ];
    const operationalActivity = matchOperationalActivity(planRows, targetUac);

    return {
      found: true,
      projectId: str(p.id),
      projectName: str(p.project_name),
      problemStatement: str(p.problem_statement),
      cycleType: str(p.cycle_type),
      schoolName,
      municipality,
      cct: foundCct,
      uacTopic,
      uacLinking,
      operationalActivity,
    };
  } catch (error) {
    logger.warn('Error al cargar contexto PAEC desde base de datos:', error);
    return { found: false };
  }
}
