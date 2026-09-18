import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { getZoneContextForSchool } from '@/lib/zone-sync-service';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const cct = searchParams.get('cct')?.trim().toUpperCase() || teacher.school_cct?.trim().toUpperCase() || '';

    if (!cct) {
      return NextResponse.json(
        { error: 'CCT escolar no proporcionado ni registrado en el perfil docente.' },
        { status: 400 }
      );
    }

    const zoneContext = await getZoneContextForSchool(cct);

    if (!zoneContext.found) {
      return NextResponse.json({
        found: false,
        message: `No se encontró Cartografía de Zona activa para el CCT ${cct}.`,
      });
    }

    return NextResponse.json(zoneContext, { status: 200 });
  } catch (error) {
    logger.error('[API-PAEC-ZonaContext] Error consultando contexto de zona para PAEC:', error);
    const message = error instanceof Error ? error.message : 'Error interno al consultar contexto de zona';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
