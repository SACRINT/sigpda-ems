import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectById, mapRawPaecProject } from '@/lib/db';
import { calculateGlobalPaecScore, formatAuditReport } from '@/lib/paec-quality-gate';
import type { PaecProject } from '@/types/paec';

import { logger } from '@/lib/logger';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
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
    const rawProject = await getPaecProjectById(id, teacher.id);
    if (!rawProject) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const project = mapRawPaecProject(rawProject);
    if (!project) {
      return NextResponse.json({ error: 'Error al procesar el proyecto' }, { status: 500 });
    }

    const audit = calculateGlobalPaecScore(project);
    const reportText = formatAuditReport(audit);

    return NextResponse.json({
      success: true,
      projectId: project.id,
      projectName: project.projectName,
      currentStep: project.currentStep,
      status: project.status,
      audit,
      reportText,
    });
  } catch (error) {
    logger.error('Error al auditar proyecto PAEC:', error);
    return NextResponse.json(
      { error: 'Error interno al evaluar el proyecto PAEC' },
      { status: 500 }
    );
  }
}
