import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generatePipsPDF } from '@/lib/pips-pdf-generator';
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

    const buffer = await generatePipsPDF(row as any);

    const zona = ((row.zona_nombre as string) || 'Zona').replace(/\s+/g, '_');
    const ciclo = (row.ciclo_escolar as string) || '2026-2027';
    const filename = `PIPS_Oficial_${zona}_${ciclo}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error: any) {
    logger.error('Error generating PIPS PDF:', error);
    return NextResponse.json({ error: 'Error al generar el documento PDF' }, { status: 500 });
  }
}
