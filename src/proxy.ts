import { auth } from '@/lib/auth';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isEnvAdmin } from '@/lib/admin-env';

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
  '/biblioteca-personal',
  '/horarios',
  '/mi-escuela',
  '/mi-zona',
  '/mi-progreso',
  '/admin',
];

export async function proxy(request: NextRequest) {
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

    // 2. Cuenta bloqueada → no permitir navegación con cookie existente
    if (session.user.is_blocked) {
      return NextResponse.redirect(new URL(`/${locale}/login?error=blocked`, request.url));
    }

    // 3. Admin unificado (env var o claim del JWT) → acceso total sin restricciones
    if (isEnvAdmin(email) || session.user.is_admin) {
      return intlMiddleware(request);
    }

    // Si un usuario no admin intenta acceder a cualquier ruta /admin/*, redirigir a dashboard
    if (pathWithoutLocale.startsWith('/admin')) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }

    if (isProtected) {
      // 4. Perfil no completado → configurar perfil
      if (!session.user.profile_completed) {
        return NextResponse.redirect(new URL(`/${locale}/configurar-perfil`, request.url));
      }

      // 5. Sin suscripción activa: Welcome Tier de 1 planeación de cortesía.
      // El docente puede conocer el dashboard y crear su primera planeación.
      // La segunda planeación y el resto de rutas protegidas exigen suscripción.
      if (!session.user.has_active_subscription) {
        const planningCount = Number(session.user.planning_count ?? 0);
        const isDashboard =
          pathWithoutLocale === '/dashboard' || pathWithoutLocale.startsWith('/dashboard/');
        const isNewPlanning =
          pathWithoutLocale === '/nueva-planeacion' ||
          pathWithoutLocale.startsWith('/nueva-planeacion/');
        const isPlanningDetail =
          pathWithoutLocale === '/planeacion' || pathWithoutLocale.startsWith('/planeacion/');

        if (isDashboard) {
          return intlMiddleware(request);
        }
        if (planningCount === 0 && isNewPlanning) {
          return intlMiddleware(request);
        }
        if (planningCount === 1 && isPlanningDetail) {
          return intlMiddleware(request);
        }

        return NextResponse.redirect(new URL(`/${locale}/suscripcion`, request.url));
      }
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',],
};
