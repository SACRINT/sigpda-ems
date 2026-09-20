import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById, markPlanningDownloaded } from '@/lib/db';
import { generateSecuenciaDocx } from '@/lib/docx-generator';
import type { GeneratedPlanningContent } from '@/types/planning';
import { sanitizeDocFilename } from '@/lib/document-branding';
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
    if (!teacher) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const { id } = await params;
    const planning = await getPlanningById(id, teacher.id);
    if (!planning) return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    if (!planning.content_json) {
      return NextResponse.json({ error: 'La planeación aún no ha sido generada' }, { status: 400 });
    }

    const raw = planning as unknown as {
      content_json: GeneratedPlanningContent | null;
      metodologia_activa?: string | null;
      sequence_json?: Record<number, { blockIndex: number; blockName: string; hours: number; sessions: { sessionNum: number; totalSessions: number; phase: string; title: string; teachingActivity: string; learningActivity: string; evidence: string; evaluation?: string }[] }> | null;
    };

    const content = raw.content_json as GeneratedPlanningContent;
    if (raw.metodologia_activa && !content.sectionI.metodologiaActiva) {
      content.sectionI.metodologiaActiva = raw.metodologia_activa;
    }
    const sequenceJson = raw.sequence_json || null;
    const docxBuffer = await generateSecuenciaDocx(content, sequenceJson);

    await markPlanningDownloaded(id, teacher.id);

    const filename = `${sanitizeDocFilename(`Secuencia_Didactica_${content.sectionI.uacName}_${content.sectionI.semester}Semestre_${SCHOOL_YEAR}`, 80)}.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    logger.error('DOCX secuencia generation error:', error);
    return NextResponse.json({ error: 'Error al generar el documento de secuencia' }, { status: 500 });
  }
}
