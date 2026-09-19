import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningExtraById } from '@/lib/db';
import { buildExtraDocx } from '@/lib/docx-helpers';
import { sanitizeDocFilename } from '@/lib/document-branding';
import { logger } from '@/lib/logger';

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

    const buffer = await buildExtraDocx(extra);
    const safeFilename = sanitizeDocFilename(extra.title, 60);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}.docx"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Export docx extra error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
