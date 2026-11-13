import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';

type TeacherRecord = NonNullable<Awaited<ReturnType<typeof getTeacherByEmail>>>;

type ActiveTeacherResult =
  | { teacher: TeacherRecord; session: Session; error: null }
  | { teacher: null; session: null; error: NextResponse };

/**
 * Autorización server-side para rutas API: exige sesión y consulta el estado
 * real de bloqueo en DB (el claim del JWT puede tener hasta 15 min de antigüedad).
 */
export async function requireActiveTeacher(): Promise<ActiveTeacherResult> {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      teacher: null,
      session: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  const teacher = await getTeacherByEmail(session.user.email);
  if (!teacher) {
    return {
      teacher: null,
      session: null,
      error: NextResponse.json({ error: 'Docente no encontrado' }, { status: 401 }),
    };
  }

  if (teacher.is_blocked || session.user.is_blocked) {
    return {
      teacher: null,
      session: null,
      error: NextResponse.json({ error: 'Cuenta bloqueada' }, { status: 403 }),
    };
  }

  return { teacher, session, error: null };
}
