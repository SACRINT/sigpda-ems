import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectById, mapRawPaecProject } from '@/lib/db';
import { generatePaecPDF } from '@/lib/paec-pdf-generator';
import type { PaecProject } from '@/types/paec';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
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

    const pdfBuffer = await generatePaecPDF(project, teacher.name);

    const safeProjName = project.projectName
      .substring(0, 30)
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚ\s]/g, '')
      .replace(/\s+/g, '_');
    const filename = `Proyecto_PEC_${safeProjName}_${SCHOOL_YEAR}.pdf`;

    const uint8 = new Uint8Array(pdfBuffer);
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(uint8.byteLength),
      },
    });
  } catch (error: any) {
    logger.error('PAEC PDF generation error:', { error: error?.message || String(error) });
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al generar el documento PDF del PAEC: ${message}` },
      { status: 500 }
    );
  }
}
