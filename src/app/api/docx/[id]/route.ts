import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById, markPlanningDownloaded } from '@/lib/db';
import { generateDocx } from '@/lib/docx-generator';
import type { GeneratedPlanningContent } from '@/types/planning';

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
    if (!teacher) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const { id } = await params;
    const planning = await getPlanningById(id, teacher.id);
    if (!planning) return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    if (!planning.content_json) {
      return NextResponse.json({ error: 'La planeación aún no ha sido generada' }, { status: 400 });
    }

    const content = planning.content_json as GeneratedPlanningContent;
    const sequenceJson = (planning as any).sequence_json || null;
    const docxBuffer = await generateDocx(content, sequenceJson);

    await markPlanningDownloaded(id, teacher.id);

    const filename = `Planeacion_${content.sectionI.uacName.substring(0, 40).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚ\s]/g, '').replace(/\s+/g, '_')}_${content.sectionI.semester}Semestre_2026-2027.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    logger.error('DOCX generation error:', error);
    return NextResponse.json({ error: 'Error al generar el documento' }, { status: 500 });
  }
}
