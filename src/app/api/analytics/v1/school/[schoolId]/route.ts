/**
 * src/app/api/analytics/v1/school/[schoolId]/route.ts
 * Endpoint REST v1 para detalle y drill-down analítico de un Plantel Escolar (Fase 5)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const isUserAdmin = await isAdmin(session.user.email, teacher.role);
    const isAuthorized = isUserAdmin || teacher.role === 'supervisor' || teacher.role === 'director';

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Acceso no autorizado al detalle institucional' },
        { status: 403 }
      );
    }

    const { schoolId } = await params;
    const cleanCct = decodeURIComponent(schoolId).trim().toUpperCase();
    const db = sql();

    // 1. Obtener planeaciones y desglose de calidad por docente para este CCT
    const plannings = await db`
      SELECT 
        p.id,
        p.uac_name,
        p.semester,
        p.component,
        p.quality_score,
        p.quality_status,
        p.quality_checks,
        p.created_at,
        p.updated_at,
        t.id as teacher_id,
        t.name as teacher_name,
        t.email as teacher_email
      FROM plannings p
      JOIN teachers t ON p.teacher_id = t.id
      WHERE UPPER(COALESCE(t.cct, '')) = ${cleanCct}
      ORDER BY p.updated_at DESC
      LIMIT 100
    `;

    // 2. Obtener estado de PMC y PAEC
    const [pmcRow] = await db`
      SELECT id, status, current_step, updated_at
      FROM pmc_projects
      WHERE UPPER(school_cct) = ${cleanCct}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const [paecRow] = await db`
      SELECT id, status, current_step, project_name, updated_at
      FROM paec_projects
      WHERE UPPER(COALESCE(school_context->>'cct', community_context->>'cct', '')) = ${cleanCct}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    return NextResponse.json({
      cct: cleanCct,
      pmc: pmcRow || null,
      paec: paecRow || null,
      planningsCount: plannings.length,
      plannings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[API-Analytics-School] Error consultando detalle de escuela:', error);
    const message = error instanceof Error ? error.message : 'Error interno al consultar plantel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
