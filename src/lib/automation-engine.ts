import { getAutomationRules, createNotification } from '@/lib/db';

export interface AutomationPayload {
  userId: string;
  score?: number;
  semester?: number;
  component?: string;
  uacName?: string;
  planningId?: string;
  title?: string;
  metadata?: Record<string, any>;
}

/**
 * Lightweight Rule Evaluation Engine (Phase 8D)
 * Runs zero-dependency rule evaluations after system events.
 */
export async function evaluateAutomationRules(
  trigger: string,
  payload: AutomationPayload,
  userId: string
) {
  try {
    const rules = await getAutomationRules(true);
    const matchingRules = rules.filter((r: any) => r.trigger === trigger);

    for (const rule of matchingRules) {
      const conditions = rule.conditions || {};
      let passes = true;

      // Condition: maxScore (e.g. audit < 70)
      if (conditions.maxScore !== undefined && payload.score !== undefined) {
        if (payload.score >= conditions.maxScore) {
          passes = false;
        }
      }

      // Condition: minScore
      if (conditions.minScore !== undefined && payload.score !== undefined) {
        if (payload.score < conditions.minScore) {
          passes = false;
        }
      }

      // Condition: semester match
      if (conditions.semester !== undefined && payload.semester !== undefined) {
        if (payload.semester !== conditions.semester) {
          passes = false;
        }
      }

      // Condition: component match
      if (conditions.component !== undefined && payload.component !== undefined) {
        if (payload.component.toLowerCase() !== conditions.component.toLowerCase()) {
          passes = false;
        }
      }

      if (passes) {
        const actions = rule.actions || {};
        let messageText = actions.template || `Evento automatizado ejecutado: ${rule.nombre}`;
        messageText = messageText
          .replace('{score}', String(payload.score || 0))
          .replace('{uac}', payload.uacName || 'Asignatura')
          .replace('{semester}', String(payload.semester || 1));

        if (actions.type === 'notification' || actions.type === 'email') {
          await createNotification({
            user_id: userId,
            type: trigger,
            title: `⚡ Automatización: ${rule.nombre}`,
            message: messageText,
            link: payload.planningId ? `/planeacion/${payload.planningId}` : undefined,
            severity: payload.score !== undefined && payload.score < 70 ? 'warning' : 'info',
            channels: actions.channels || ['in_app'],
            metadata: {
              ruleId: rule.id,
              triggeredAt: new Date().toISOString(),
              ...payload.metadata,
            },
          });
        }
      }
    }
  } catch (err) {
    console.error('Error evaluating automation rules:', err);
  }
}
