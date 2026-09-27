import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generatePmcDocx, type PmcProject } from '@/lib/pmc-docx-generator';
import {
  generatePmcDocxMaestro,
  resolveMaestroRejection,
  resolvePersonalForMaestro,
  type PmcProjectMasterData,
  type PmcCatalogoMetaItem,
} from '@/lib/pmc-docx-maestro-builder';
import { calculateGlobalPmcScore } from '@/lib/pmc-quality-gate';
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

    const isMaestro = _request.nextUrl.searchParams.get('maestro') === 'true';

    if (isMaestro) {
      logger.info(`[PMC DOCX Maestro] Iniciando generación de documento maestro para proyecto ${id}`);

      // Contrato C2: si !diagnostico_generado || !plan_accion -> 422 PROYECTO_INCOMPLETO_BORRADOR
      const rejection = resolveMaestroRejection(project);
      if (rejection.rejected) {
        logger.warn(`[PMC DOCX Maestro] Export rejected: proyecto incompleto borrador para ${id}`);
        return NextResponse.json(rejection.body, { status: rejection.status });
      }

      // C3: Consultar metas de la base de datos para Capítulo 2
      let catalogoMetasRows: PmcCatalogoMetaItem[] = [];
      try {
        const rows = await db`
          SELECT id, nombre, categoria, subcategoria, articulos, vigencia, aplicabilidad_nivel, aplicabilidad_justificacion, evidencia, orden_display
          FROM pmc_catalogo_metas
          WHERE vigencia = TRUE
          ORDER BY orden_display ASC
        `;
        catalogoMetasRows = rows as unknown as PmcCatalogoMetaItem[];
      } catch (error) {
        logger.warn('[PMC DOCX Maestro] Error consultando catalogo de metas:', error);
        catalogoMetasRows = [];
      }

      // H-116: Resolver el personal para el documento maestro garantizando aislamiento de CCT
      const personalRows = await resolvePersonalForMaestro(db, project, teacher);

      const buffer = await generatePmcDocxMaestro(project as unknown as PmcProjectMasterData, {
        catalogoMetas: catalogoMetasRows,
        personal: personalRows,
      });

      logger.info(
        `[PMC DOCX Maestro] Documento maestro generado exitosamente para ${id} (${buffer.byteLength} bytes)`
      );

      const schoolName = (project.school_name as string | undefined) ?? 'PMC';
      const ciclo = (project.ciclo_escolar as string | undefined) ?? '2025-2026';
      const filename = `PMC_Maestro_${schoolName.replace(/\s+/g, '_')}_${ciclo}.docx`;

      const uint8 = new Uint8Array(buffer);
      return new NextResponse(uint8, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Content-Length': String(uint8.byteLength),
          'X-Document-Type': 'PMC_MAESTRO_OFICIAL_5_2',
        },
      });
    }

    const audit = calculateGlobalPmcScore(project as unknown as PmcProject);
    logger.info(`[PMC DOCX Export] Quality Gate: ${audit.percentage}% (${audit.overallStatus}) for project ${id}`);

    const buffer = await generatePmcDocx(project as PmcProject);

    const schoolName = (project.school_name as string | undefined) ?? 'PMC';
    const ciclo = (project.ciclo_escolar as string | undefined) ?? '2025-2026';
    const filename = `PMC_${schoolName.replace(/\s+/g, '_')}_${ciclo}.docx`;

    const uint8 = new Uint8Array(buffer);
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(uint8.byteLength),
        'X-Quality-Score': String(audit.percentage),
        'X-Quality-Status': audit.overallStatus,
      },
    });
  } catch (error) {
    logger.error('Error generating PMC DOCX:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new NextResponse(`Error al generar el documento: ${message}`, { status: 500 });
  }
}


