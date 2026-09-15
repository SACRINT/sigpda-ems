import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { createStripePortalSession } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    // Obtener stripe_customer_id del docente
    const subRows = await sql()`
      SELECT stripe_customer_id FROM subscriptions
      WHERE teacher_id = ${teacher.id}::uuid
        AND stripe_customer_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (subRows.length === 0 || !subRows[0].stripe_customer_id) {
      return NextResponse.json(
        { error: 'No tienes una suscripción activa con Stripe' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const portalSession = await createStripePortalSession(
      subRows[0].stripe_customer_id as string,
      `${appUrl}/es/dashboard`
    );

    return NextResponse.redirect(portalSession.url, 303);
  } catch (error: any) {
    logger.error('[Stripe Portal] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
