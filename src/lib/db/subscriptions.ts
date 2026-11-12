import { sql } from './client';
import { WELCOME_PLAN_NAME, WELCOME_PLAN_SUBJECTS } from '@/lib/subscription-plans';

export interface WelcomeSubscription {
  id: string;
  planName: string;
  status: string;
}

export interface WelcomeSubscriptionResult {
  created: boolean;
  subscription: WelcomeSubscription | null;
}

function mapSubscription(row: Record<string, unknown>): WelcomeSubscription {
  return {
    id: row.id as string,
    planName: row.plan_name as string,
    status: row.status as string,
  };
}

export async function ensureWelcomeSubscription(teacherId: string): Promise<WelcomeSubscriptionResult> {
  const existing = await sql()`
    SELECT id, plan_name, status
    FROM subscriptions
    WHERE teacher_id = ${teacherId}::uuid
    LIMIT 1
  `;

  if (existing.length > 0) {
    return { created: false, subscription: mapSubscription(existing[0]) };
  }

  const inserted = await sql()`
    INSERT INTO subscriptions (teacher_id, plan_name, plan_subjects, status)
    VALUES (${teacherId}::uuid, ${WELCOME_PLAN_NAME}, ${WELCOME_PLAN_SUBJECTS}, 'active')
    ON CONFLICT (teacher_id) DO NOTHING
    RETURNING id, plan_name, status
  `;

  if (inserted.length > 0) {
    return { created: true, subscription: mapSubscription(inserted[0]) };
  }

  const retry = await sql()`
    SELECT id, plan_name, status
    FROM subscriptions
    WHERE teacher_id = ${teacherId}::uuid
    LIMIT 1
  `;

  return {
    created: false,
    subscription: retry.length > 0 ? mapSubscription(retry[0]) : null,
  };
}
