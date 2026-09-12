import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getTeacherByEmail, sql } from '@/lib/db';
import https from 'https';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16' as any,
      httpAgent: new https.Agent({ family: 4 }),
    })
  : null;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { planId, planName, price } = await req.json();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    let limit = 1;
    if (planId === 'basico' || planId === 'basic') limit = 1;
    else if (planId === 'estandar' || planId === 'standard') limit = 3;
    else if (planId === 'avanzado' || planId === 'advanced') limit = 5;
    else if (planId === 'completo' || planId === 'complete') limit = 10;
    else if (planId === 'director_pro' || planId === 'supervisor_pro' || planId === 'escuela_completa') limit = 999;
    else limit = 1;

    if (!process.env.STRIPE_SECRET_KEY || !stripe) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Pasarela de pagos Stripe no configurada en producción' }, { status: 503 });
      }

      console.warn('No STRIPE_SECRET_KEY found. Mocking successful checkout (development only).');
      
      try {
        await sql()`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS mock BOOLEAN DEFAULT false`;
        await sql()`
          DELETE FROM subscriptions WHERE teacher_id = ${teacher.id}::uuid
        `;
        await sql()`
          INSERT INTO subscriptions (
            teacher_id, plan_name, plan_subjects, status, 
            stripe_customer_id, stripe_subscription_id, current_period_end, mock
          ) VALUES (
            ${teacher.id}::uuid, ${planName}, ${limit}, 'active', 
            'mock_cus_123', 'mock_sub_123', NOW() + INTERVAL '30 days', true
          )
        `;
      } catch (e) {
        console.error('Error inserting mock subscription:', e);
      }
      
      // Si no hay key de stripe, simulamos el éxito para desarrollo
      return NextResponse.json({ url: `${appUrl}/es/suscripcion/exito` });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: session.user.email,
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: `Suscripción DidácticaIA - Plan ${planName}`,
            },
            unit_amount: price * 100, // Stripe expects cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        teacher_id: teacher.id,
        teacher_email: session.user.email,
        plan_id: planId,
        plan_subjects: limit.toString(),
      },
      success_url: `${appUrl}/es/suscripcion/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/es/suscripcion`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
