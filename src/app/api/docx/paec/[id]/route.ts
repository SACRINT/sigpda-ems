import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectById, mapRawPaecProject } from '@/lib/db';
import { generatePaecDocx } from '@/lib/paec-docx-generator';
import type { PaecProject } from '@/types/paec';
import { SCHOOL_YEAR } from '@/lib/config';
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
    if (!teacher) return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

    const { id } = await params;
    const rawProject = await getPaecProjectById(id, teacher.id);
    if (!rawProject) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    // Cast raw database project row to PaecProject
    const project = mapRawPaecProject(rawProject);
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

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
    const filename = `Proyecto_PEC_${safeProjName}_${SCHOOL_YEAR}.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    logger.error('PAEC DOCX download error:', { error });
    return NextResponse.json({ error: 'Error al generar el archivo Word' }, { status: 500 });
  }
}
