import { auth } from '@/lib/auth';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';

const intlMiddleware = createMiddleware(routing);

// Rutas que solo requieren autenticación (sin subscription check)
const authOnlyPaths = ['/configurar-perfil', '/suscripcion'];

// Rutas que requieren autenticación + perfil completo + suscripción activa
const protectedPaths = [
  '/dashboard',
  '/nueva-planeacion',
  '/planeacion',
  '/paec',
  '/pmc',
  '/pips',
  '/mis-documentos',
  '/mis-escuelas',
];

function isEnvAdmin(email: string): boolean {
  const cleanEmail = email.toLowerCase().trim();
  const envAdmins = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
  return envAdmins.includes(cleanEmail);
}

async function getTeacherStatus(email: string) {
  try {
    const db = neon(process.env.DATABASE_URL!);
    const rows = await db`
      SELECT t.id, t.profile_completed, t.school_locked, t.role,
             s.status as sub_status
      FROM teachers t
      LEFT JOIN subscriptions s ON s.teacher_id = t.id
        AND s.status IN ('active', 'trialing')
      WHERE t.email = ${email}
      LIMIT 1
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = pathname.split('/')[1] || 'es';
  const pathWithoutLocale = pathname.replace(/^\/(?:es|en)/, '') || '/';

  const isProtected = protectedPaths.some((p) => pathWithoutLocale.startsWith(p));
  const isAuthOnly = authOnlyPaths.some((p) => pathWithoutLocale.startsWith(p));

  if (isProtected || isAuthOnly) {
    const session = await auth();

    // 1. No autenticado → login
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }

    const email = session.user.email;

    // 2. Admin por variable de entorno → acceso total sin restricciones
    if (isEnvAdmin(email)) {
      return intlMiddleware(request);
    }

    if (isProtected) {
      const teacher = await getTeacherStatus(email);

      // 2.5 Admin por rol
      if (teacher?.role === 'administrador') {
        return intlMiddleware(request);
      }

      // 3. Perfil no completado → configurar perfil
      if (!teacher || !teacher.profile_completed) {
        return NextResponse.redirect(new URL(`/${locale}/configurar-perfil`, request.url));
      }

      // 4. Sin suscripción activa → página de suscripción
      if (!teacher.sub_status) {
        return NextResponse.redirect(new URL(`/${locale}/suscripcion`, request.url));
      }
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',],
};
