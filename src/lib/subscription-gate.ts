/**
 * subscription-gate.ts
 * Guardián de acceso por suscripción.
 * Determina si un docente puede crear planeaciones según su plan activo.
 */

import { sql } from './db';
import { logger } from './logger';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  subscription: {
    id: string;
    planName: string;
    planSubjects: number;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
  } | null;
  subjects: Array<{
    id: string;
    uacName: string;
    semester: number;
    component: string;
  }>;
  usedSubjectsCount: number;
  availableSlots: number;
  isAdmin: boolean;
}

export interface AccessResult {
  allowed: boolean;
  reason: 'admin' | 'active_subscription' | 'no_subscription' | 'subject_not_in_plan' | 'slots_exhausted';
  message?: string;
}

// ─── Funciones principales ───────────────────────────────────────────────────

/**
 * Obtiene el estado completo de suscripción de un docente.
 * Retorna un objeto detallado con todos los datos necesarios para la UI.
 */
export async function getSubscriptionStatus(
  teacherId: string,
  teacherEmail?: string
): Promise<SubscriptionStatus> {
  // Consultar rol
  let isAdmin = false;
  if (teacherEmail && teacherEmail === ADMIN_EMAIL) {
    isAdmin = true;
  } else {
    try {
      const roleRows = await sql()`SELECT role FROM teachers WHERE id = ${teacherId}::uuid LIMIT 1`;
      if (roleRows.length > 0 && roleRows[0].role === 'administrador') {
        isAdmin = true;
      }
    } catch (err) {
      logger.warn('[subscription-gate] Error consultando rol de docente:', { error: err });
    }
  }

  if (isAdmin) {
    return {
      hasActiveSubscription: true,
      subscription: {
        id: 'admin',
        planName: 'Administrador',
        planSubjects: 9999,
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: null,
      },
      subjects: [],
      usedSubjectsCount: 0,
      availableSlots: 9999,
      isAdmin: true,
    };
  }

  // Consultar suscripción activa
  const subRows = await sql()`
    SELECT id, plan_name, plan_subjects, status,
           current_period_end, cancel_at_period_end, stripe_customer_id
    FROM subscriptions
    WHERE teacher_id = ${teacherId}::uuid
      AND status IN ('active', 'trialing')
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const sub = subRows[0] || null;
  const hasActive = !!sub;

  if (!hasActive) {
    return {
      hasActiveSubscription: false,
      subscription: null,
      subjects: [],
      usedSubjectsCount: 0,
      availableSlots: 0,
      isAdmin: false,
    };
  }

  // Consultar materias registradas en esta suscripción
  const subjRows = await sql()`
    SELECT id, uac_name, semester, component
    FROM subscription_subjects
    WHERE teacher_id = ${teacherId}::uuid
      AND subscription_id = ${sub.id}::uuid
    ORDER BY locked_at ASC
  `;

  const usedCount = subjRows.length;
  const availableSlots = Math.max(0, (sub.plan_subjects as number) - usedCount);

  return {
    hasActiveSubscription: true,
    subscription: {
      id: sub.id as string,
      planName: sub.plan_name as string,
      planSubjects: sub.plan_subjects as number,
      status: sub.status as string,
      currentPeriodEnd: sub.current_period_end as string | null,
      cancelAtPeriodEnd: sub.cancel_at_period_end as boolean,
      stripeCustomerId: sub.stripe_customer_id as string | null,
    },
    subjects: subjRows.map((r) => ({
      id: r.id as string,
      uacName: r.uac_name as string,
      semester: r.semester as number,
      component: r.component as string,
    })),
    usedSubjectsCount: usedCount,
    availableSlots,
    isAdmin: false,
  };
}

/**
 * Verifica si un docente puede crear una planeación para una materia específica.
 * Soporta el modelo de "materia ya registrada" o "slot disponible para nueva".
 */
export async function canCreatePlanningForSubject(
  teacherId: string,
  teacherEmail: string,
  uacName: string,
  semester: number,
  component: string
): Promise<AccessResult> {
  const status = await getSubscriptionStatus(teacherId, teacherEmail);

  if (status.isAdmin) {
    return { allowed: true, reason: 'admin' };
  }

  if (!status.hasActiveSubscription) {
    return {
      allowed: false,
      reason: 'no_subscription',
      message: 'Necesitas una suscripción activa para crear planeaciones.',
    };
  }

  // Verificar si la materia ya está registrada en el plan
  const isRegistered = status.subjects.some(
    (s) =>
      s.uacName.toLowerCase() === uacName.toLowerCase() &&
      s.semester === semester &&
      s.component === component
  );

  if (isRegistered) {
    return { allowed: true, reason: 'active_subscription' };
  }

  // La materia no está registrada aún — verificar si hay slots disponibles
  if (status.availableSlots > 0) {
    return { allowed: true, reason: 'active_subscription' };
  }

  return {
    allowed: false,
    reason: 'slots_exhausted',
    message: `Tu plan ${status.subscription?.planName} ya tiene ${status.subscription?.planSubjects} materia(s) completa(s). Agrega una materia extra por $79 MXN o actualiza tu plan.`,
  };
}

/**
 * Registra una materia en la suscripción activa del docente (al crear primera planeación).
 * Solo se llama si la materia NO está registrada y hay slots disponibles.
 */
export async function lockSubjectInSubscription(
  teacherId: string,
  uacName: string,
  semester: number,
  component: string
): Promise<void> {
  // Obtener suscripción activa
  const subRows = await sql()`
    SELECT id FROM subscriptions
    WHERE teacher_id = ${teacherId}::uuid
      AND status IN ('active', 'trialing')
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (subRows.length === 0) return;
  const subscriptionId = subRows[0].id as string;

  // Verificar que no esté ya registrada
  const existing = await sql()`
    SELECT id FROM subscription_subjects
    WHERE teacher_id = ${teacherId}::uuid
      AND subscription_id = ${subscriptionId}::uuid
      AND uac_name ILIKE ${uacName}
      AND semester = ${semester}
      AND component = ${component}
    LIMIT 1
  `;

  if (existing.length > 0) return; // Ya registrada, no duplicar

  // Registrar la materia
  await sql()`
    INSERT INTO subscription_subjects (teacher_id, subscription_id, uac_name, semester, component)
    VALUES (
      ${teacherId}::uuid,
      ${subscriptionId}::uuid,
      ${uacName},
      ${semester},
      ${component}
    )
  `;
}
