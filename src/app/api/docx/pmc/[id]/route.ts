import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generatePmcDocx, type PmcProject } from '@/lib/pmc-docx-generator';
import {
  generatePmcDocxMaestro,
  resolveMaestroRejection,
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

      // H-116: Resolver el director por project.school_cct para evitar fuga de datos entre escuelas.
      // NUNCA se usa el director de sesión directamente — el CCT del proyecto puede diferir del CCT del usuario.
      let effectiveDirectorId: string | null = null;
      const projectCct = (project.school_cct as string | undefined)?.trim().toUpperCase() ?? '';
      const sessionCct = (teacher.cct as string | undefined)?.trim().toUpperCase() ?? '';

      // Paso 1: buscar director cuyo CCT coincida con el del PROYECTO (no con el de la sesión)
      if (projectCct) {
        try {
          const resolvedDir = await db`
            SELECT id FROM teachers
            WHERE role = 'director'
              AND UPPER(TRIM(cct)) = ${projectCct}
            LIMIT 1
          `;
          if (resolvedDir.length > 0 && resolvedDir[0].id) {
            effectiveDirectorId = resolvedDir[0].id as string;
          }
        } catch (error) {
          logger.warn('[PMC DOCX Maestro] Error resolviendo director por CCT del proyecto:', error);
        }
      }

      // Paso 2: si no encontró por CCT y el usuario de sesión es director del MISMO plantel, usar su id
      if (!effectiveDirectorId && teacher.role === 'director' && projectCct && sessionCct === projectCct) {
        effectiveDirectorId = teacher.id;
      }

      // Consultar personal de escuela_personal SOLO si el director encontrado pertenece al CCT del proyecto
      let personalRows: PmcPersonalItem[] = [];
      if (effectiveDirectorId) {
        try {
          // Verificación de seguridad: el director resuelto debe pertenecer al CCT del proyecto
          const [dirVerify] = await db`
            SELECT id, cct FROM teachers WHERE id = ${effectiveDirectorId}::uuid LIMIT 1
          `;
          const dirCct = (dirVerify?.cct as string | undefined)?.trim().toUpperCase() ?? '';
          const cctMatch = !projectCct || !dirCct || dirCct === projectCct;

          if (cctMatch) {
            const pRows = await db`
              SELECT id, director_id, nombre, apellido_paterno, apellido_materno, email, cargo, horas_base, activo
              FROM escuela_personal
              WHERE director_id = ${effectiveDirectorId}::uuid AND activo = TRUE
              ORDER BY apellido_paterno, nombre
            `;
            personalRows = pRows as unknown as PmcPersonalItem[];
          } else {
            logger.warn(
              `[PMC DOCX Maestro] H-116: CCT de director (${dirCct}) ≠ CCT del proyecto (${projectCct}); omitiendo escuela_personal para evitar fuga de datos.`
            );
          }
        } catch (error) {
          logger.warn('[PMC DOCX Maestro] Error consultando escuela_personal:', error);
          personalRows = [];
        }
      }

      // Fallback: si escuela_personal está vacío, construir desde project.staff_data (los nombres del wizard)
      if (personalRows.length === 0 && project.staff_data) {
        try {
          const staffRaw = typeof project.staff_data === 'string'
            ? (JSON.parse(project.staff_data) as unknown[])
            : (project.staff_data as unknown[]);
          if (Array.isArray(staffRaw)) {
            personalRows = staffRaw
              .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
              .map((s, idx) => ({
                id: String(idx),
                nombre: String(s.nombre ?? 'Docente'),
                apellido_paterno: '',
                apellido_materno: null,
                email: null,
                cargo: String(s.cargo ?? 'Docente frente a grupo'),
                horas_base: null,
                activo: true,
              }));
          }
        } catch {
          personalRows = [];
        }
      }

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
