import { NextRequest, NextResponse } from 'next/server';
import { DIRECTIVO_ROLES, guardRole } from '@/lib/rbac';
import { getZoneContextForSchool } from '@/lib/zone-sync-service';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const guard = await guardRole(DIRECTIVO_ROLES);
    if (!guard.ok) return guard.response;
    const { teacher } = guard.context;

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
    logger.error('[API-PMC-ZonaContext] Error consultando contexto de zona:', error);
    const message = error instanceof Error ? error.message : 'Error interno al consultar contexto de zona';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
