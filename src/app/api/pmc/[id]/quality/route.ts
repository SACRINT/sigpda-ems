// src/app/api/pmc/[id]/quality/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { calculateGlobalPmcScore, formatPmcAuditReport } from '@/lib/pmc-quality-gate';
import { computeCoverage } from '@/lib/coverage-core';
import type { PmcProject, PmcPlanAccion, PmcStaffMember } from '@/types/pmc';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;
    const db = sql();

    const [project] = await db`
      SELECT *
      FROM pmc_projects
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
      LIMIT 1
    `;

    if (!project) {
      return NextResponse.json({ error: 'Proyecto PMC no encontrado' }, { status: 404 });
    }

    const audit = calculateGlobalPmcScore(project as unknown as PmcProject);
    const reportText = formatPmcAuditReport(audit);

    // Calcular cobertura canónica de metas individuales
    const staff = (Array.isArray(project.staff_data) ? project.staff_data : []) as PmcStaffMember[];
    const plan = (project.plan_accion || {}) as PmcPlanAccion;
    const metasPers = Array.isArray(plan.metas_personales) ? plan.metas_personales : [];
    const coverage = computeCoverage(metasPers, project.total_staff, staff);

    return NextResponse.json({
      success: true,
      projectId: project.id,
      schoolName: project.school_name,
      currentStep: project.current_step,
      status: project.status,
      audit,
      reportText,
      cobertura: {
        totalStaff: coverage.realStaffCount,
        metasPersonalesCount: coverage.metasCount,
        coveragePercent: coverage.coveragePercent,
        isLowCoverage: coverage.isLowCoverage,
      },
    });
  } catch (error) {
    logger.error('Error al evaluar calidad del proyecto PMC:', error);
    return NextResponse.json(
      { error: 'Error interno al evaluar calidad del proyecto PMC' },
      { status: 500 }
    );
  }
}
