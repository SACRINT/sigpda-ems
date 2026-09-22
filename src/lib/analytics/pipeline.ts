/**
 * src/lib/analytics/pipeline.ts
 * Pipeline de Ingestión y Normalización de Métricas de Calidad Pedagógica (Fase 5)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 */

import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';
import { evaluatePlanningQuality, type PlanningQualityReport } from '@/lib/planning/quality-pipeline';
import { emitDomainEvent } from './events';
import type { Planning } from '@/types/planning';
import type { QualityMetric } from '@/types/analytics';

let qualitySchemaEnsured = false;

export async function ensurePlanningQualityColumns(): Promise<void> {
  if (qualitySchemaEnsured) return;
  try {
    const db = sql();
    await db`
      ALTER TABLE plannings 
        ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS quality_status VARCHAR(50) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS quality_checks JSONB DEFAULT NULL;

      CREATE INDEX IF NOT EXISTS idx_plannings_quality_score 
        ON plannings(quality_score) WHERE quality_score IS NOT NULL;
    `;
    qualitySchemaEnsured = true;
  } catch (error) {
    logger.warn('[AnalyticsPipeline] No se pudieron verificar columnas de calidad en plannings:', error);
  }
}

/**
 * Evalúa y persiste atómicamente la calidad pedagógica de una planeación existente.
 */
export async function ingestPlanningQuality(
  planningId: string,
  planningData?: Partial<Planning>
): Promise<QualityMetric | null> {
  try {
    await ensurePlanningQualityColumns();
    const db = sql();

    let planning = planningData;
    if (!planning || !planning.contentJson) {
      const rows = await db`
        SELECT * FROM plannings WHERE id = ${planningId}::uuid LIMIT 1
      `;
      if (rows.length === 0) return null;
      const r = rows[0];
      planning = {
        id: r.id as string,
        teacherId: r.teacher_id as string,
        uacName: r.uac_name as string,
        semester: Number(r.semester) || 1,
        component: r.component as string,
        curriculumName: r.curriculum_name as string,
        metodologiaActiva: (r.metodologia_activa || undefined) as string | undefined,
        contentJson: r.content_json,
        sequenceJson: r.sequence_json,
      } as unknown as Partial<Planning>;
    }

    // 1. Ejecutar el validador oficial determinista DBEPA
    const report: PlanningQualityReport = evaluatePlanningQuality(planning);

    // 2. Persistir en columnas optimizadas para consulta agregada
    const checksJson = JSON.stringify(report.checks);
    await db`
      UPDATE plannings
      SET 
        quality_score = ${report.score},
        quality_status = ${report.status},
        quality_checks = ${checksJson}::jsonb,
        updated_at = NOW()
      WHERE id = ${planningId}::uuid
    `;

    // 3. Emitir eventos de dominio analíticos
    await emitDomainEvent({
      eventType: 'quality_score_calculated',
      aggregateId: planningId,
      aggregateType: 'planning',
      payload: {
        score: report.score,
        status: report.status,
        uacName: planning.uacName,
        teacherId: planning.teacherId,
        checks: report.checks,
      },
    });

    const metric: QualityMetric = {
      score: report.score,
      status: report.status as QualityMetric['status'],
      retoSituadoOk: report.checks.retoSituado.score === 4,
      tresSaberesOk: report.checks.tresSaberes.coverageScore === 3,
      coherenciaOk: report.checks.coherenciaMetodologica.isValid,
      horasOk: report.checks.horasPorCorte.isValid,
      evaluatedAt: report.evaluatedAt,
    };

    return metric;
  } catch (error) {
    logger.error(`[AnalyticsPipeline] Error procesando calidad para planeación ${planningId}:`, error);
    return null;
  }
}
