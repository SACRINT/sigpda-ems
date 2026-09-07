import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningExtraById } from '@/lib/db';
import { generateExtraPDF } from '@/lib/pdf-extra-generator';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ extraId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('No autorizado', { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return new Response('Docente no encontrado', { status: 404 });
    }

    const { extraId } = await params;
    const extra = await getPlanningExtraById(extraId, teacher.id);
    if (!extra) {
      return new Response('Recurso no encontrado', { status: 404 });
    }

    // Generate PDF using jsPDF (server-side, Node canvas not required)
    const doc = generateExtraPDF({
      id:           extra.id,
      title:        extra.title || 'Recurso Extra',
      type:         extra.type,
      content_text: extra.content_text,
    });

    // Get buffer from jsPDF
    const buffer = Buffer.from(doc.output('arraybuffer'));

    // Safe filename
    const safeFilename = (extra.title || 'recurso_extra')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // strip accents
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}.pdf"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[pdf/extra] Error:', msg);
    return new Response(`Error generando PDF: ${msg}`, { status: 500 });
  }
}
