/**
 * paec-context.ts
 * Helper ligero para la interconexión automática PAEC ↔ Planeación (SIGPDA-EMS)
 * 
 * Permite que al seleccionar o cargar el CCT escolar en la planeación didáctica,
 * el sistema extraiga de la base de datos la problemática comunitaria priorizada,
 * el nombre del proyecto PAEC-PEC del plantel, y la vinculación curricular exacta
 * que el Paso 3 / Plan Operativo del PAEC asignó a esa UAC.
 */

import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface PaecLinkedActivity {
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
    let rows: any[] = [];

    if (cleanCct) {
      // Buscar proyectos que coincidan con el CCT en school_context o community_context
      rows = await sql()`
        SELECT id, project_name, problem_statement, cycle_type, school_context, community_context,
               fase2_mapeo, fase2_plan_operativo, fase3_plan_operativo_a, fase3_plan_operativo_b
        FROM paec_projects
        WHERE school_context->>'cct' ILIKE ${cleanCct}
           OR community_context->>'cct' ILIKE ${cleanCct}
           OR school_context::text ILIKE ${'%' + cleanCct + '%'}
        ORDER BY updated_at DESC
        LIMIT 1
      `;
    }

    // Fallback: Si no se encuentra por CCT pero hay teacherId, buscar por docente
    if (rows.length === 0 && options?.teacherId) {
      rows = await sql()`
        SELECT id, project_name, problem_statement, cycle_type, school_context, community_context,
               fase2_mapeo, fase2_plan_operativo, fase3_plan_operativo_a, fase3_plan_operativo_b
        FROM paec_projects
        WHERE teacher_id = ${options.teacherId}::uuid
        ORDER BY updated_at DESC
        LIMIT 1
      `;
    }

    if (rows.length === 0) {
      return { found: false };
    }

    const p = rows[0];
    const schoolCtx = p.school_context || {};
    const commCtx = p.community_context || {};

    const schoolName = schoolCtx.nombre_escuela || schoolCtx.schoolName || commCtx.schoolName || '';
    const municipality = schoolCtx.municipio || schoolCtx.municipality || commCtx.municipality || '';
    const foundCct = schoolCtx.cct || commCtx.cct || cleanCct;

    let uacTopic: string | undefined;
    let uacLinking: string | undefined;
    let operationalActivity: PaecLinkedActivity | null = null;

    const targetUac = (options?.uacName || '').toLowerCase().trim();
    const targetSemester = options?.semester;

    // 1. Buscar en fase2_mapeo (Paso 3 del PAEC)
    const mapeo = Array.isArray(p.fase2_mapeo) ? p.fase2_mapeo : [];
    if (targetUac || targetSemester) {
      const matchMapeo = mapeo.find((item: any) => {
        const itemUac = (item.uacName || item.asignatura || '').toLowerCase();
        const itemSem = Number(item.semester || item.semestre);
        const uacMatches = targetUac ? (itemUac.includes(targetUac) || targetUac.includes(itemUac)) : true;
        const semMatches = targetSemester ? itemSem === targetSemester : true;
        return uacMatches && semMatches;
      });

      if (matchMapeo) {
        uacTopic = matchMapeo.topic || matchMapeo.contenido || matchMapeo.tema;
        uacLinking = matchMapeo.linking || matchMapeo.vinculacion;
      }
    }

    // 2. Buscar en plan operativo (Paso 6 o 7 del PAEC)
    const planRows: any[] = [
      ...(Array.isArray(p.fase2_plan_operativo) ? p.fase2_plan_operativo : []),
      ...(Array.isArray(p.fase3_plan_operativo_a) ? p.fase3_plan_operativo_a : []),
      ...(Array.isArray(p.fase3_plan_operativo_b) ? p.fase3_plan_operativo_b : []),
    ];

    if (planRows.length > 0 && targetUac) {
      const matchPlan = planRows.find((item: any) => {
        const itemAsig = (item.asignatura || item.uacName || '').toLowerCase();
        return itemAsig.includes(targetUac) || targetUac.includes(itemAsig);
      });

      if (matchPlan) {
        operationalActivity = {
          actividad: matchPlan.actividad || matchPlan.macroActivities || '',
          semana: matchPlan.semana ? `Semana ${matchPlan.semana}` : matchPlan.periodo || undefined,
          fase: matchPlan.fase || undefined,
          estrategiaDidactica: matchPlan.estrategiaDidactica || undefined,
          propositoFormativo: matchPlan.propositoFormativo || undefined,
          progresion: matchPlan.progresion || undefined,
          isPrescheduled: true,
        };
      }
    }

    return {
      found: true,
      projectId: p.id,
      projectName: p.project_name,
      problemStatement: p.problem_statement,
      cycleType: p.cycle_type,
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
