/**
 * planning-persistence.ts — Helper unificado de persistencia y validación pedagógica.
 * SIGPDA-EMS · Gate Pedagógico Dual (Anexo 12 USICAMM + DBEPA Quality Gate)
 *
 * SSoT para la persistencia de planeaciones didácticas.
 * Ejecuta deterministamente tanto el validador del Anexo 12 USICAMM como el Quality Gate
 * DBEPA, incrustando ambos reportes estructurados en `content_json` para consulta directa
 * desde UI, exportaciones y SQL administrativo.
 *
 * Comportamiento de Gate:
 *   - En modo estricto / nueva planeación (isNewOrStrictMode = true):
 *       Si existen fallas críticas de horas o ponderación en Anexo 12, aborta sin persistir.
 *   - En modo permisivo (DUA, ediciones menores, backfill histórico):
 *       Persiste los reportes y emite advertencia sin bloquear al docente.
 */

import type { GeneratedPlanningContent } from '@/types/planning';
import { updatePlanningContent } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  validateAnexo12,
  type Anexo12Check,
  type Anexo12Context,
  type Anexo12Report,
} from '@/lib/planning/anexo12-validator';
import {
  evaluateDBEPA,
  type DBEPAAudit,
} from '@/lib/planning/dbepa-quality-gate';

export interface PersistPlanningOptions {
  /**
   * true = fail-closed: aborta la persistencia si criticalFailures > 0.
   * false (default en DUA y backfill) = persiste con warning.
   */
  isNewOrStrictMode?: boolean;
  context?: Anexo12Context;
}

export interface PersistPlanningResult {
  success: boolean;
  planning?: unknown;
  anexo12Report: Anexo12Report;
  dbepaReport: DBEPAAudit;
  error?: string;
  criticalFailures?: Anexo12Check[];
}

export async function validateAndPersistPlanningContent(
  planningId: string,
  teacherId: string,
  contentJson: GeneratedPlanningContent | Record<string, unknown>,
  options: PersistPlanningOptions = {}
): Promise<PersistPlanningResult> {
  const content = (contentJson || {}) as Record<string, unknown>;
  const secI = (content.sectionI || {}) as Record<string, unknown>;

  const resolvedUacName =
    options.context?.uacName ||
    (typeof secI.subjectName === 'string' ? secI.subjectName : undefined);
  const resolvedSemester =
    options.context?.semester ||
    (typeof secI.semester === 'number' ? secI.semester : Number(secI.semester) || undefined);

  const validationContext: Anexo12Context = {
    ...options.context,
    uacName: resolvedUacName,
    semester: resolvedSemester,
  };

  // 1. Evaluación Anexo 12 USICAMM (40 criterios normativos)
  const anexo12Report = validateAnexo12(content, validationContext);

  // 2. Evaluación DBEPA Puebla (12 criterios de calidad didáctica)
  const dbepaReport = evaluateDBEPA(content as unknown as GeneratedPlanningContent, {
    uacName: resolvedUacName,
    semester: resolvedSemester,
  });

  // 3. Control Fail-Closed ante Fallas Críticas
  if (options.isNewOrStrictMode && anexo12Report.criticalFailures > 0) {
    const criticals = anexo12Report.checks.filter((c) => !c.ok && c.severity === 'critical');
    logger.warn(
      `[validateAndPersistPlanningContent] Persistencia bloqueada (Fail-Closed) para planeación ${planningId}: ${anexo12Report.criticalFailures} fallas críticas en Anexo 12.`
    );
    return {
      success: false,
      anexo12Report,
      dbepaReport,
      error: `La planeación presenta ${anexo12Report.criticalFailures} inconsistencias críticas de conformidad con el Anexo 12 USICAMM.`,
      criticalFailures: criticals,
    };
  }

  // 4. Incrustar reportes de auditoría estructurados dentro del JSON
  content.anexo12Audit = anexo12Report;
  content.dbepaAudit = dbepaReport;

  // 5. Persistencia atómica en Neon PostgreSQL
  try {
    const updated = await updatePlanningContent(planningId, teacherId, content);
    return {
      success: true,
      planning: updated,
      anexo12Report,
      dbepaReport,
    };
  } catch (err) {
    logger.error('[validateAndPersistPlanningContent] Error al actualizar planeación en BD:', err);
    return {
      success: false,
      anexo12Report,
      dbepaReport,
      error: err instanceof Error ? err.message : 'Error interno de base de datos al guardar planeación.',
    };
  }
}
