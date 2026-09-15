import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generatePipsDocx } from '@/lib/pips-docx-generator';
import { calculateGlobalPipsScore } from '@/lib/pips-quality-gate';
import type { PipsProject } from '@/types/pips';
import { logger } from '@/lib/logger';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher)
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

    const { id } = await params;
    const db = sql();
    const [row] = await db`
      SELECT * FROM pips_projects
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
    `;
    if (!row)
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    const audit = calculateGlobalPipsScore(row as unknown as PipsProject);
    logger.info(`[PIPS DOCX Export] Quality Gate: ${audit.percentage}% (${audit.overallStatus}) for project ${id}`);

    const buffer = await generatePipsDocx(row as any);

    const filename = `PIPS_${(row.zona_nombre as string).replace(/\s+/g, '_')}_${row.ciclo_escolar}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Quality-Score': String(audit.percentage),
        'X-Quality-Status': audit.overallStatus,
      },
    });
  } catch (error) {
    logger.error('Error generating PIPS docx:', error);
    return NextResponse.json({ error: 'Error al generar el documento' }, { status: 500 });
  }
}
