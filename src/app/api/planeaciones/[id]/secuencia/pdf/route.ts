import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { generateSecuenciaPDF } from '@/lib/planning-pdf-renderer';
import { logger } from '@/lib/logger';
import type { Planning } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { SecuenciaBloque } from '@/types/planning';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const planning = await getPlanningById(id);
    if (!planning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    const admin = await isAdmin(session.user.email);
    if (!admin && teacher && planning.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'Acceso denegado a esta planeación' }, { status: 403 });
    }

    const planningObj = {
      id: planning.id,
      teacherId: planning.teacher_id,
      uacName: planning.uac_name,
      semester: planning.semester,
      component: planning.component,
      curriculumName: planning.curriculum_name || '',
      paecContext: planning.paec_context || '',
      extractedData: planning.extracted_data,
      contentJson: planning.content_json,
      metodologiaActiva:
        (planning as unknown as { metodologia_activa?: string }).metodologia_activa || undefined,
      sequenceJson:
        (planning as unknown as { sequence_json?: Record<number, SecuenciaBloque> }).sequence_json ||
        null,
      workbooksJson:
        (planning as unknown as { workbooks_json?: Record<string, { current?: ActiveWorkTextbook }> })
          .workbooks_json || null,
      status: planning.status,
      createdAt: planning.created_at,
      updatedAt: planning.updated_at,
    } as Planning;

    const pdf = await generateSecuenciaPDF(planningObj);
    const buffer = Buffer.from(pdf.output('arraybuffer'));

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="secuencia-${id}.pdf"`,
      },
    });
  } catch (error) {
    logger.error('[GET /api/planeaciones/[id]/secuencia/pdf] Error:', error);
    return NextResponse.json(
      { error: 'Error interno generando PDF de secuencia didáctica' },
      { status: 500 }
    );
  }
}
