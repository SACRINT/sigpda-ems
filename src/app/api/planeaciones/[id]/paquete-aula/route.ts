import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById, getPlanningExtras, markPlanningDownloaded } from '@/lib/db';
import { buildAulaPackageZip } from '@/lib/aula-package';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const planning = await getPlanningById(id, teacher.id);
    if (!planning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }
    if (!planning.content_json) {
      return NextResponse.json(
        { error: 'La planeación aún no tiene contenido generado para empaquetar.' },
        { status: 400 }
      );
    }

    const extras = await getPlanningExtras(id, teacher.id);
    const result = await buildAulaPackageZip(planning, extras);

    try {
      await markPlanningDownloaded(id, teacher.id);
    } catch (error) {
      logger.warn('[AulaPackage] No se pudo marcar la planeación como descargada:', { error });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    };
    if (result.warnings.length > 0) {
      headers['X-Aula-Package-Warnings'] = String(result.warnings.length);
    }

    return new Response(new Uint8Array(result.buffer), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al generar el paquete de aula';
    logger.error('[AulaPackage] Error generando paquete integral:', { error });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
