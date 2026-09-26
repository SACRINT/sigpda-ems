import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generatePmcDocx, type PmcProject } from '@/lib/pmc-docx-generator';
import {
  generatePmcDocxMaestro,
  type PmcProjectMasterData,
  type PmcCatalogoMetaItem,
  type PmcPersonalItem,
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
      // Contrato C2: si !diagnostico_generado || !plan_accion -> 422 PROYECTO_INCOMPLETO_BORRADOR
      const hasDiagnostico = Boolean(project.diagnostico_generado);
      const hasPlanAccion = Boolean(project.plan_accion);

      if (!hasDiagnostico || !hasPlanAccion) {
        return NextResponse.json(
          {
            error: 'PROYECTO_INCOMPLETO_BORRADOR',
            mensaje:
              'El proyecto PMC se encuentra en estado de borrador incompleto. Debe generar y guardar el Diagnóstico Integral (Paso 1) y el Plan de Acción (Paso 2) antes de exportar el Documento Maestro.',
            faltantes: {
              diagnostico: !hasDiagnostico,
              plan_accion: !hasPlanAccion,
            },
          },
          { status: 422 }
        );
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
      } catch {
        catalogoMetasRows = [];
      }

      // Consultar personal de escuela_personal para Capítulo 7
      let personalRows: PmcPersonalItem[] = [];
      try {
        const pRows = await db`
          SELECT id, director_id, nombre, apellido_paterno, apellido_materno, email, cargo, horas_base, activo
          FROM escuela_personal
          WHERE director_id = ${teacher.id}::uuid AND activo = TRUE
          ORDER BY apellido_paterno, nombre
        `;
        personalRows = pRows as unknown as PmcPersonalItem[];
      } catch {
        personalRows = [];
      }

      const buffer = await generatePmcDocxMaestro(project as unknown as PmcProjectMasterData, {
        catalogoMetas: catalogoMetasRows,
        personal: personalRows,
      });

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
