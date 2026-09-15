// src/app/api/pmc/[id]/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { calculateGlobalPmcScore, formatPmcAuditReport } from '@/lib/pmc-quality-gate';
import type { PmcProject } from '@/types/pmc';
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
