/**
 * src/app/api/excel/metas/[id]/route.ts
 *
 * Endpoint oficial de exportación de Metas Escolares 2026-2027 en formato Excel (.xlsx).
 * Alineado byte a byte con las plantillas de Supervisión Escolar de Educación Media Superior Puebla.
 *
 * Autenticación: Requiere sesión activa del docente propietario del proyecto PMC.
 * Runtime: Node.js (exceljs). Cero feature flags.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generatePmcSupervisorExcel, type PmcSupervisorExcelInput } from '@/lib/pmc/excel-supervisor-generator';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new NextResponse('No autorizado', { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return new NextResponse('Docente no encontrado', { status: 404 });
    }

    const { id } = await params;
    const db = sql();

    const [project] = await db`
      SELECT *
      FROM pmc_projects
      WHERE id = ${id}
        AND teacher_id = ${teacher.id}
    `;

    if (!project) {
      return new NextResponse('Proyecto no encontrado', { status: 404 });
    }

    logger.info(`[PMC Excel Export] Generando Excel oficial de supervisión para proyecto ${id}`);

    const buffer = await generatePmcSupervisorExcel(project as unknown as PmcSupervisorExcelInput);

    const schoolName = (project.school_name as string | undefined) ?? 'Plantel';
    const cct = (project.school_cct as string | undefined) ?? '';
    const ciclo = (project.ciclo_escolar as string | undefined) ?? '2026-2027';
    const cleanPrefix = cct ? `${cct}_` : '';
    const cleanName = schoolName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const filename = `${cleanPrefix}Metas_${ciclo}_${cleanName}.xlsx`;

    const uint8 = new Uint8Array(buffer);
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(uint8.byteLength),
      },
    });
  } catch (error) {
    logger.error('[PMC Excel Export] Error al generar Excel oficial de metas:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new NextResponse(`Error interno al generar Excel: ${message}`, {
      status: 500,
    });
  }
}
