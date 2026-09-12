import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectById } from '@/lib/db';
import { auditPaecProject } from '@/lib/paec-validator';
import type { PaecProject } from '@/types/paec';

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

    // Mapear el registro de base de datos a PaecProject
    const project: PaecProject = {
      id: rawProject.id,
      teacherId: rawProject.teacher_id,
      projectName: rawProject.project_name,
      problemStatement: rawProject.problem_statement,
      cycleType: rawProject.cycle_type,
      currentStep: rawProject.current_step,
      communityContext: rawProject.community_context || {},
      schoolContext: rawProject.school_context || {},
      fase1Diagnostico: rawProject.fase1_diagnostico || null,
      fase2Justificacion: rawProject.fase2_justificacion || null,
      fase2Mapeo: rawProject.fase2_mapeo || null,
      fase2Cronograma: rawProject.fase2_cronograma || null,
      fase2DetalleCurricular: rawProject.fase2_detalle_curricular || null,
      fase2PlanOperativo: rawProject.fase2_plan_operativo || null,
      fase2Anexos: rawProject.fase2_anexos || null,
      status: rawProject.status,
      createdAt: rawProject.created_at,
      updatedAt: rawProject.updated_at,
    };

    const audit = auditPaecProject(project);

    return NextResponse.json({
      success: true,
      projectId: project.id,
      projectName: project.projectName,
      currentStep: project.currentStep,
      status: project.status,
      audit,
    });
  } catch (error) {
    console.error('Error al auditar proyecto PAEC:', error);
    return NextResponse.json(
      { error: 'Error interno al evaluar el proyecto PAEC' },
      { status: 500 }
    );
  }
}
