// src/app/api/pips/[id]/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { calculateGlobalPipsScore, formatPipsAuditReport } from '@/lib/pips-quality-gate';
import type { PipsProject } from '@/types/pips';
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
      FROM pips_projects
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
      LIMIT 1
    `;

    if (!project) {
      return NextResponse.json({ error: 'Proyecto PIPS no encontrado' }, { status: 404 });
    }

    const audit = calculateGlobalPipsScore(project as unknown as PipsProject);
    const reportText = formatPipsAuditReport(audit);

    return NextResponse.json({
      success: true,
      projectId: project.id,
      zonaClave: project.zona_clave,
      currentStep: project.current_step,
      status: project.status,
      audit,
      reportText,
    });
  } catch (error) {
    logger.error('Error al auditar proyecto PIPS:', error);
    return NextResponse.json(
      { error: 'Error interno al evaluar el proyecto PIPS' },
      { status: 500 }
    );
  }
}
