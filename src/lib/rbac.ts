import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';

export const DIRECTIVO_ROLES = ['director', 'administrador', 'admin'] as const;
export const SUPERVISION_ROLES = ['supervisor', 'administrador', 'admin'] as const;
export const HORARIOS_READ_ROLES = ['director', 'supervisor', 'administrador', 'admin'] as const;

export interface AuthzContext {
  email: string;
  teacher: NonNullable<Awaited<ReturnType<typeof getTeacherByEmail>>>;
  role: string;
  isAdmin: boolean;
}

export class AuthzError extends Error {
  readonly status: 401 | 403 | 404;
  readonly code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND';

  constructor(code: AuthzError['code'], message: string) {
    super(message);
    this.name = 'AuthzError';
    this.code = code;
    this.status = code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : 403;
  }
}

export async function assertRole(allowed: readonly string[]): Promise<AuthzContext> {
  const session = await auth();
  if (!session?.user?.email) {
    throw new AuthzError('UNAUTHORIZED', 'No autorizado');
  }

  const teacher = await getTeacherByEmail(session.user.email);
  if (!teacher) {
    throw new AuthzError('NOT_FOUND', 'Docente no encontrado');
  }

  const role = typeof teacher.role === 'string' && teacher.role ? teacher.role : 'docente';
  const normalizedAllowed = allowed.map((item) => item.toLowerCase());

  if (normalizedAllowed.includes(role.toLowerCase())) {
    return {
      email: session.user.email,
      teacher,
      role,
      isAdmin: role === 'administrador' || role === 'admin',
    };
  }

  const adminOk = await isAdmin(session.user.email, role);
  if (adminOk) {
    return {
      email: session.user.email,
      teacher,
      role: 'administrador',
      isAdmin: true,
    };
  }

  throw new AuthzError('FORBIDDEN', 'No tienes permisos para realizar esta acción');
}

export async function guardRole(allowed: readonly string[]) {
  try {
    return { ok: true as const, context: await assertRole(allowed) };
  } catch (error) {
    if (error instanceof AuthzError) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        ),
      };
    }
    throw error;
  }
}
