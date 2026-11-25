import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generatePmcPDF } from '@/lib/pmc-pdf-generator';
import type { PmcProject } from '@/lib/pmc-docx-generator';
import { auditPmcProject, type PmcProjectLike } from '@/lib/qa/paec-pmc-semantic-qa';
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

    // Gate de exportación Q3: HTTP 422 solo en FAIL duro; WARN se registra y permite descarga con aviso
    const semanticQa = auditPmcProject(project as unknown as PmcProjectLike, { strict: false });
    if (!semanticQa.passed) {
      logger.warn(`[PMC PDF Export] Bloqueado por FAIL duro en QA semántico (${id}):`, { fails: semanticQa.fails });
      return NextResponse.json(
        {
          error: 'El PMC presenta errores críticos que bloquean la descarga oficial.',
          code: 'PMC_SEMANTIC_QA_FAILED',
          fails: semanticQa.fails,
          warns: semanticQa.warns,
        },
        { status: 422 }
      );
    }
    if (semanticQa.warns.length > 0) {
      logger.warn(`[PMC PDF Export] Descarga permitida con ${semanticQa.warns.length} advertencia(s) (${id}):`, {
        warns: semanticQa.warns.slice(0, 10),
      });
    }

    const buffer = await generatePmcPDF(project as PmcProject);

    const schoolName = (project.school_name as string | undefined) ?? 'PMC';
    const ciclo = (project.ciclo_escolar as string | undefined) ?? '2026-2027';
    const filename = `PMC_Oficial_${schoolName.replace(/\s+/g, '_')}_${ciclo}.pdf`;

    const uint8 = new Uint8Array(buffer);
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(uint8.byteLength),
        'X-Quality-Warnings-Count': String(semanticQa.warns.length),
      },
    });
  } catch (error: unknown) {
    logger.error('Error generating PMC PDF:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new NextResponse(`Error al generar el documento PDF: ${message}`, { status: 500 });
  }
}
