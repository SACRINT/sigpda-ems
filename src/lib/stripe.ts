import Stripe from 'stripe';
import https from 'https';

// ─── Lazy Stripe client ──────────────────────────────────────────────────────
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    _stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16' as unknown as Stripe.LatestApiVersion,
      typescript: true,
      httpAgent: new https.Agent({ family: 4 }),
    });
  }
  return _stripe;
}

// ─── Planes y precios ────────────────────────────────────────────────────────
// IMPORTANTE: Estos Price IDs se configuran en el Dashboard de Stripe.
// Hasta que los configures, usa los de entorno o los de prueba.

export const PLANS = [
  {
    id: 'basico',
    name: 'Básico',
    description: '1 materia por mes',
    subjects: 1,
    priceMonthlyMXN: 99,
    stripePriceId: process.env.STRIPE_PRICE_BASICO || 'price_basico_test',
    features: [
      '1 materia completa (UAC)',
      'Planeación Didáctica Semestral',
      'Secuencias Didácticas',
      'Planes de Clase (50 min)',
      'Rúbricas e instrumentos de evaluación',
      'Exportación a DOCX y PDF Editorial',
      'Hasta 4 generaciones de libro de bloque y 15 compilaciones PDF por periodo',
    ],
  },
  {
    id: 'estandar',
    name: 'Estándar',
    description: '3 materias por mes',
    subjects: 3,
    priceMonthlyMXN: 249,
    stripePriceId: process.env.STRIPE_PRICE_ESTANDAR || 'price_estandar_test',
    popular: true,
    features: [
      '3 materias (UACs)',
      'Planeación Didáctica Semestral',
      'Secuencias Didácticas',
      'Planes de Clase (50 min)',
      'Rúbricas e instrumentos de evaluación',
      'Exportación a DOCX y PDF Editorial',
      'Hasta 12 generaciones de libro de bloque y 40 compilaciones PDF por periodo',
      'PAEC / PMC / PIPS incluido',
    ],
  },
  {
    id: 'avanzado',
    name: 'Avanzado',
    description: '5 materias por mes',
    subjects: 5,
    priceMonthlyMXN: 399,
    stripePriceId: process.env.STRIPE_PRICE_AVANZADO || 'price_avanzado_test',
    features: [
      '5 materias (UACs)',
      'Planeación Didáctica Semestral',
      'Secuencias Didácticas',
      'Planes de Clase (50 min)',
      'Rúbricas e instrumentos de evaluación',
      'Exportación a DOCX y PDF Editorial',
      'Hasta 20 generaciones de libro de bloque y 70 compilaciones PDF por periodo',
      'PAEC / PMC / PIPS incluido',
      'Soporte prioritario',
    ],
  },
  {
    id: 'completo',
    name: 'Completo',
    description: '10 materias por mes',
    subjects: 10,
    priceMonthlyMXN: 699,
    stripePriceId: process.env.STRIPE_PRICE_COMPLETO || 'price_completo_test',
    features: [
      '10 materias (UACs)',
      'Planeación Didáctica Semestral',
      'Secuencias Didácticas',
      'Planes de Clase (50 min)',
      'Rúbricas e instrumentos de evaluación',
      'Exportación a DOCX y PDF Editorial',
      'Hasta 40 generaciones de libro de bloque y 120 compilaciones PDF por periodo',
      'PAEC / PMC / PIPS incluido',
      'Soporte prioritario',
      'Acceso anticipado a nuevas funciones',
    ],
  },
] as const;

export type PlanId = typeof PLANS[number]['id'];

// Precio de materia adicional
export const EXTRA_SUBJECT_PRICE_MXN = 79;
export const STRIPE_PRICE_EXTRA_SUBJECT = process.env.STRIPE_PRICE_EXTRA_SUBJECT || 'price_extra_test';

// ─── Helpers de Checkout ──────────────────────────────────────────────────────

export interface CreateCheckoutOptions {
  teacherId: string;
  teacherEmail: string;
  planId: PlanId;
  selectedSubjects: Array<{
    uacName: string;
    semester: number;
    component: string;
  }>;
  successUrl: string;
  cancelUrl: string;
  existingCustomerId?: string;
}

export async function createStripeCheckoutSession(opts: CreateCheckoutOptions) {
  const stripe = getStripe();
  const plan = PLANS.find((p) => p.id === opts.planId);
  if (!plan) throw new Error(`Plan no encontrado: ${opts.planId}`);

  const subjectsMetadata = JSON.stringify(opts.selectedSubjects);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: opts.existingCustomerId,
    customer_email: opts.existingCustomerId ? undefined : opts.teacherEmail,
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    metadata: {
      teacher_id: opts.teacherId,
      plan_id: opts.planId,
      plan_subjects: String(plan.subjects),
      selected_subjects: subjectsMetadata.substring(0, 500), // Stripe limit 500 chars
    },
    subscription_data: {
      metadata: {
        teacher_id: opts.teacherId,
        plan_id: opts.planId,
        plan_subjects: String(plan.subjects),
        selected_subjects: subjectsMetadata.substring(0, 500),
      },
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    locale: 'es',
    allow_promotion_codes: true,
  });

  return session;
}

// ─── Portal de cliente ────────────────────────────────────────────────────────

export async function createStripePortalSession(
  stripeCustomerId: string,
  returnUrl: string
) {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return session;
}
