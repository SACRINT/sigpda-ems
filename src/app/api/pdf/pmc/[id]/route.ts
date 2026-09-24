import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generatePmcPDF } from '@/lib/pmc-pdf-generator';
import type { PmcProject } from '@/lib/pmc-docx-generator';
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
      },
    });
  } catch (error: unknown) {
    logger.error('Error generating PMC PDF:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new NextResponse(`Error al generar el documento PDF: ${message}`, { status: 500 });
  }
}
