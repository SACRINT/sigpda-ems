// src/app/api/pedagogical-analytics/route.ts
// GET — Devuelve el resumen de progreso pedagógico del docente autenticado
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { getTeacherProgressSummary } from '@/lib/pedagogical-analytics';

import { logger } from '@/lib/logger';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const summary = await getTeacherProgressSummary(teacher.id, teacher.email);
    return NextResponse.json(summary);
  } catch (error) {
    logger.error('Pedagogical analytics GET error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
