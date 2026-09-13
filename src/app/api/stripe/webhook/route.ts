import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Webhook de Stripe ────────────────────────────────────────────────────────
// En App Router req.text() funciona correctamente para obtener el body raw sin config especial.

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    logger.error('[Webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    logger.error('[Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  logger.info('[Webhook] Event received:', { type: event.type });

  try {
    switch (event.type) {
      // ── Pago de suscripción nuevo (primera vez) ──────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;
        await handleCheckoutCompleted(session);
        break;
      }

      // ── Suscripción actualizada (renovación, cambio de plan) ─────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        break;
      }

      // ── Suscripción cancelada ────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }

      // ── Pago fallido ─────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        logger.info('[Webhook] Unhandled event type:', { type: event.type });
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error('[Webhook] Handler error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const teacherId = session.metadata?.teacher_id;
  const planId = session.metadata?.plan_id;
  const planSubjects = parseInt(session.metadata?.plan_subjects || '1', 10);
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;
  const stripePriceId = session.metadata?.stripe_price_id || null;

  if (!teacherId || !planId) {
    console.error('[Webhook] Missing metadata in checkout session:', session.id);
    return;
  }

  // Upsert suscripción
  const existing = await sql()`
    SELECT id FROM subscriptions WHERE teacher_id = ${teacherId}::uuid LIMIT 1
  `;

  if (existing.length > 0) {
    await sql()`
      UPDATE subscriptions
      SET
        stripe_customer_id      = ${stripeCustomerId},
        stripe_subscription_id  = ${stripeSubscriptionId},
        stripe_price_id         = ${stripePriceId},
        plan_name               = ${planId},
        plan_subjects           = ${planSubjects},
        status                  = 'active',
        updated_at              = NOW()
      WHERE teacher_id = ${teacherId}::uuid
    `;
  } else {
    await sql()`
      INSERT INTO subscriptions
        (teacher_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_name, plan_subjects, status)
      VALUES
        (${teacherId}::uuid, ${stripeCustomerId}, ${stripeSubscriptionId}, ${stripePriceId}, ${planId}, ${planSubjects}, 'active')
    `;
  }

  // Guardar materias seleccionadas si vienen en el metadata
  const selectedSubjectsRaw = session.metadata?.selected_subjects;
  if (selectedSubjectsRaw) {
    try {
      const subjects = JSON.parse(selectedSubjectsRaw) as Array<{
        uacName: string;
        semester: number;
        component: string;
      }>;

      // Obtener subscription_id recién creada
      const subRows = await sql()`
        SELECT id FROM subscriptions WHERE teacher_id = ${teacherId}::uuid
        ORDER BY created_at DESC LIMIT 1
      `;
      const subscriptionId = subRows[0]?.id as string;

      for (const subj of subjects) {
        const exists = await sql()`
          SELECT id FROM subscription_subjects
          WHERE teacher_id = ${teacherId}::uuid
            AND subscription_id = ${subscriptionId}::uuid
            AND uac_name ILIKE ${subj.uacName}
            AND semester = ${subj.semester}
          LIMIT 1
        `;
        if (exists.length === 0) {
          await sql()`
            INSERT INTO subscription_subjects (teacher_id, subscription_id, uac_name, semester, component)
            VALUES (${teacherId}::uuid, ${subscriptionId}::uuid, ${subj.uacName}, ${subj.semester}, ${subj.component})
          `;
        }
      }
    } catch {
      // Subjects parsing failed, will be selected during first planning creation
    }
  }

  logger.info(`[Webhook] Subscription activated for teacher ${teacherId}, plan: ${planId}`);
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const stripeSubscriptionId = sub.id;
  const status = sub.status; // active | past_due | canceled | trialing | etc.
  const currentPeriodEnd = new Date((sub as any).current_period_end * 1000).toISOString();
  const currentPeriodStart = new Date((sub as any).current_period_start * 1000).toISOString();
  const cancelAtPeriodEnd = (sub as any).cancel_at_period_end;

  await sql()`
    UPDATE subscriptions
    SET
      status                = ${status},
      current_period_start  = ${currentPeriodStart},
      current_period_end    = ${currentPeriodEnd},
      cancel_at_period_end  = ${cancelAtPeriodEnd},
      updated_at            = NOW()
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;

  logger.info(`[Webhook] Subscription ${stripeSubscriptionId} updated: ${status}`);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const stripeSubscriptionId = sub.id;

  await sql()`
    UPDATE subscriptions
    SET status = 'canceled', updated_at = NOW()
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;

  logger.info(`[Webhook] Subscription ${stripeSubscriptionId} canceled`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const stripeCustomerId = invoice.customer as string;

  await sql()`
    UPDATE subscriptions
    SET status = 'past_due', updated_at = NOW()
    WHERE stripe_customer_id = ${stripeCustomerId}
  `;

  logger.info(`[Webhook] Payment failed for customer ${stripeCustomerId}`);
}
