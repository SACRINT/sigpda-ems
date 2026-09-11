import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getBlockWorkbook, getTeacherByEmail } from '@/lib/db';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { Planning } from '@/types/planning';

export const runtime = 'nodejs';
export const maxDuration = 90;

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
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 401 });
    }

    const { id } = await params;
    const url = new URL(request.url);
    const blockIndexParam = url.searchParams.get('blockIndex');

    if (blockIndexParam === null) {
      return NextResponse.json({ error: 'blockIndex query param es requerido' }, { status: 400 });
    }

    const blockIndex = parseInt(blockIndexParam, 10);
    const rawPlanning = await getPlanningById(id);

    if (!rawPlanning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }
    if (rawPlanning.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'No tienes permiso para acceder a esta planeación' }, { status: 403 });
    }

    const workbook = await getBlockWorkbook(id, blockIndex);
    if (!workbook) {
      return NextResponse.json(
        { error: 'El libro de trabajo para este bloque aún no ha sido generado' },
        { status: 404 }
      );
    }

    const planning: Planning = {
      id: rawPlanning.id,
      teacherId: rawPlanning.teacher_id,
      uacName: rawPlanning.uac_name,
      semester: rawPlanning.semester,
      component: rawPlanning.component,
      curriculumName: rawPlanning.curriculum_name || '',
      paecContext: rawPlanning.paec_context || '',
      extractedData: rawPlanning.extracted_data,
      contentJson: rawPlanning.content_json,
      status: rawPlanning.status,
      createdAt: rawPlanning.created_at,
      updatedAt: rawPlanning.updated_at,
    };

    const docxBuffer = await renderWorkbookToDocx(workbook, planning);
    const cleanUac = (planning.uacName || 'UAC').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_ -]/g, '').trim();
    const filename = `Libro_Trabajo_Activo_B${blockIndex + 1}_${cleanUac}.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('[GET /api/docx/libro-bloque/[id]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al descargar el libro DOCX' },
      { status: 500 }
    );
  }
}
