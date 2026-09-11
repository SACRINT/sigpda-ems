import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getTeacherByEmail } from '@/lib/db';
import { compileSemestralWorkbook } from '@/lib/master-workbook-compiler';
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
    const rawPlanning = await getPlanningById(id);

    if (!rawPlanning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }
    if (rawPlanning.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'No tienes permiso para acceder a esta planeación' }, { status: 403 });
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

    const { pdf } = await compileSemestralWorkbook(id, planning, { format: 'pdf' });
    if (!pdf) {
      throw new Error('No se pudo generar el archivo PDF semestral');
    }
    const cleanUac = (planning.uacName || 'UAC').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_ -]/g, '').trim();
    const filename = `Libro_Maestro_Semestral_${cleanUac}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('[GET /api/pdf/libro-semestral/[id]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al compilar el libro semestral PDF' },
      { status: 500 }
    );
  }
}
