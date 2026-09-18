import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { loadPaecContext } from '@/lib/paec-context';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    const { searchParams } = new URL(request.url);
    const cct = searchParams.get('cct') || teacher?.cct || '';
    const semester = searchParams.get('semester') ? Number(searchParams.get('semester')) : undefined;
    const uacName = searchParams.get('uac') || undefined;

    const context = await loadPaecContext(cct, {
      semester,
      uacName,
      teacherId: teacher?.id,
    });

    return NextResponse.json(context);
  } catch (error) {
    logger.error('Error fetching PAEC context:', error);
    return NextResponse.json({ error: 'Error interno al consultar PAEC' }, { status: 500 });
  }
}
