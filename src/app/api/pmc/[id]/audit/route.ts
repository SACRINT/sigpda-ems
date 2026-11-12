// src/app/api/pmc/[id]/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { DIRECTIVO_ROLES, guardRole } from '@/lib/rbac';
import { calculateGlobalPmcScore, formatPmcAuditReport } from '@/lib/pmc-quality-gate';
import type { PmcProject } from '@/types/pmc';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardRole(DIRECTIVO_ROLES);
    if (!guard.ok) return guard.response;
    const { teacher } = guard.context;

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

    return NextResponse.json({
      success: true,
      projectId: project.id,
      schoolName: project.school_name,
      currentStep: project.current_step,
      status: project.status,
      audit,
      reportText,
    });
  } catch (error) {
    logger.error('Error al auditar proyecto PMC:', error);
    return NextResponse.json(
      { error: 'Error interno al evaluar el proyecto PMC' },
      { status: 500 }
    );
  }
}
