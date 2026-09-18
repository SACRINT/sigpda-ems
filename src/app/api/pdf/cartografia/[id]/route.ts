import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generateCartografiaPDF } from '@/lib/cartografia-pdf-generator';
import { auditCartografiaProject } from '@/lib/cartografia-quality-gate';
import {
  buildCartografiaBaseContext,
  getCartografiaMomentos,
} from '@/lib/cartografia-context-builder';
import type { CartografiaZonaProject } from '@/types/cartografia';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
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
    const db = sql();
    const [row] = await db`
      SELECT * FROM pips_projects
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
    `;

    if (!row) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Mapeo defensivo a CartografiaZonaProject (Momentos 1 y 2 e Identificación)
    const {
      identificacion,
      planteles,
      momento1: momento1Conocer,
      momento2: momento2Organizar,
    } = buildCartografiaBaseContext(row, teacher);

    const {
      momento3Ubicar,
      momento4Analizar,
      momento5Decidir,
      memoriaPedagogica,
    } = getCartografiaMomentos(row, planteles.length);

    const cartografiaProject: CartografiaZonaProject = {
      id,
      zonaNumero: identificacion.zonaNumero,
      zonaClave: identificacion.zonaClave,
      supervisorName: identificacion.supervisorName,
      municipioSede: identificacion.municipioSede,
      municipiosAtiende: identificacion.municipiosAtiende,
      subsistema: identificacion.subsistema,
      cicloEscolar: identificacion.cicloEscolar,
      atps: identificacion.atps,
      momento1Conocer,
      momento2Organizar,
      momento3Ubicar,
      momento4Analizar,
      momento5Decidir,
      memoriaPedagogica,
      status: (row.status === 'completed' ? 'completed' : 'draft') as 'draft' | 'completed',
    };

    const audit = auditCartografiaProject(cartografiaProject);
    logger.info(`[Cartografia PDF Export] Quality Gate: ${audit.percentage}% (${audit.status}) para proyecto ${id}`);

    const buffer = await generateCartografiaPDF(cartografiaProject);

    const zonaSanitized = (cartografiaProject.zonaNumero || '004').replace(/\s+/g, '_');
    const cicloSanitized = (cartografiaProject.cicloEscolar || '2026-2027').replace(/\s+/g, '_');
    const filename = `Cartografia_Zona_${zonaSanitized}_${cicloSanitized}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'X-Quality-Score': String(audit.percentage),
        'X-Quality-Status': audit.status,
      },
    });
  } catch (error: unknown) {
    logger.error('[API-Cartografia-PDF] Error generando PDF de Cartografía:', error);
    const message = error instanceof Error ? error.message : 'Error al generar el documento PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
