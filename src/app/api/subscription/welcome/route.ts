import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ensureWelcomeSubscription, getTeacherByEmail } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const result = await ensureWelcomeSubscription(teacher.id as string);
    if (!result.subscription) {
      return NextResponse.json({ error: 'No se pudo activar la cortesía de bienvenida' }, { status: 500 });
    }

    if (result.subscription.status !== 'active' && result.subscription.status !== 'trialing') {
      return NextResponse.json(
        { error: 'Tu cuenta ya tiene un historial de suscripción. Elige un plan para continuar.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      created: result.created,
      planName: result.subscription.planName,
    });
  } catch (error) {
    logger.error('POST /api/subscription/welcome error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
