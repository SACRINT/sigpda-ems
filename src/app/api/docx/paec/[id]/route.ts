import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectById } from '@/lib/db';
import { generatePaecDocx } from '@/lib/paec-docx-generator';
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
    if (!teacher) return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

    const { id } = await params;
    const rawProject = await getPaecProjectById(id, teacher.id);
    if (!rawProject) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    // Cast raw database project row to PaecProject
    const project: PaecProject = {
      id: rawProject.id,
      teacherId: rawProject.teacher_id,
      projectName: rawProject.project_name,
      problemStatement: rawProject.problem_statement,
      cycleType: rawProject.cycle_type as any,
      currentStep: rawProject.current_step,
      communityContext: rawProject.community_context as any,
      schoolContext: rawProject.school_context as any,
      fase1Diagnostico: rawProject.fase1_diagnostico as any,
      fase2Justificacion: rawProject.fase2_justificacion as any,
      fase2Mapeo: rawProject.fase2_mapeo as any,
      fase2Cronograma: rawProject.fase2_cronograma as any,
      fase2DetalleCurricular: rawProject.fase2_detalle_curricular as any,
      fase2PlanOperativo: rawProject.fase2_plan_operativo as any,
      fase2Anexos: rawProject.fase2_anexos as any,
      status: rawProject.status as any,
      createdAt: rawProject.created_at,
      updatedAt: rawProject.updated_at,
    };

    if (!project.fase2Anexos) {
      return NextResponse.json(
        { error: 'El proyecto no está completo. Genera todos los pasos antes de descargar.' },
        { status: 400 }
      );
    }

    const docxBuffer = await generatePaecDocx(project, teacher.name);

    const safeProjName = project.projectName
      .substring(0, 30)
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚ\s]/g, '')
      .replace(/\s+/g, '_');
    const filename = `Proyecto_PEC_${safeProjName}_2026-2027.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('PAEC DOCX download error:', error);
    return NextResponse.json({ error: 'Error al generar el archivo Word' }, { status: 500 });
  }
}
