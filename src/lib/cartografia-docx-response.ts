// src/lib/cartografia-docx-response.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { auditCartografiaProject } from '@/lib/cartografia-quality-gate';
import {
  buildCartografiaBaseContext,
  getCartografiaMomentos,
} from '@/lib/cartografia-context-builder';
import type { CartografiaZonaProject } from '@/types/cartografia';
import { logger } from '@/lib/logger';

export type CartografiaDocxBuilder = (
  project: CartografiaZonaProject
) => Promise<Buffer>;

/**
 * Helper compartido para servir descargas DOCX de proyectos de Cartografía Zonal
 * Unifica autenticación, autorización de docente, lectura SQL, mapeo de momentos,
 * quality gate y cabeceras RFC 5987 seguras (F-R12-02, F-R12-05).
 */
export async function handleCartografiaDocxRequest(
  projectId: string,
  builder: CartografiaDocxBuilder,
  filenamePrefix: string
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const db = sql();
    const [row] = await db`
      SELECT * FROM pips_projects
      WHERE id = ${projectId}::uuid AND teacher_id = ${teacher.id}::uuid
    `;

    if (!row) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

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
      id: projectId,
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
    logger.info(`[Cartografia DOCX Export - ${filenamePrefix}] Quality Gate: ${audit.percentage}% (${audit.status}) para proyecto ${projectId}`);

    const buffer = await builder(cartografiaProject);

    const zonaSanitized = (cartografiaProject.zonaNumero || '004')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const cicloSanitized = (cartografiaProject.cicloEscolar || '2026-2027')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const filename = `${filenamePrefix}_Zona_${zonaSanitized}_${cicloSanitized}.docx`;
    const encodedFilename = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        'X-Quality-Score': String(audit.percentage),
        'X-Quality-Status': audit.status,
      },
    });
  } catch (error: unknown) {
    logger.error(`[API-Cartografia-DOCX-${filenamePrefix}] Error generando Word:`, error);
    const message = error instanceof Error ? error.message : 'Error al generar el documento Word';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
