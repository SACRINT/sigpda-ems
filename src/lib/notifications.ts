import { createNotification, NotificationItem } from '@/lib/db';
import { evaluateAutomationRules } from '@/lib/automation-engine';
import { logger } from '@/lib/logger';

export interface SendNotificationOptions {
  userId: string;
  type: 'planeacion_ready' | 'audit_result' | 'deadline_reminder' | 'ffe_continuity' | 'bundle_generated' | 'document_signed' | string;
  title: string;
  message: string;
  link?: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  channels?: ('in_app' | 'email')[];
  metadata?: Record<string, any>;
  triggerAutomation?: boolean;
}

/**
 * Dispatch an in-app and optional email notification
 */
export async function sendNotification(options: SendNotificationOptions) {
  try {
    const channels = options.channels || ['in_app'];

    // 1. Store in-app notification in Neon DB
    const saved = await createNotification({
      user_id: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      link: options.link,
      severity: options.severity || 'info',
      channels,
      metadata: options.metadata || {},
    });

    // 2. Optional Email Dispatch
    if (channels.includes('email')) {
      await sendEmailNotification({
        to: options.metadata?.email,
        subject: options.title,
        body: options.message,
        link: options.link,
      });
    }

    // 3. Trigger Automation Engine if requested
    if (options.triggerAutomation !== false) {
      try {
        await evaluateAutomationRules(options.type, {
          userId: options.userId,
          title: options.title,
          metadata: options.metadata,
        }, options.userId);
      } catch (autoErr) {
        logger.warn('Automation engine warning:', autoErr);
      }
    }

    return { success: true, notification: saved };
  } catch (error: any) {
    logger.error('Error in sendNotification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper to simulate or send email without heavy dependencies
 */
async function sendEmailNotification(data: { to?: string; subject: string; body: string; link?: string }) {
  if (!data.to) return;
  // If RESEND_API_KEY or SMTP is configured, send email via standard fetch
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'SIGPDA-EMS <notificaciones@sigpda-ems.sep.gob.mx>',
          to: data.to,
          subject: data.subject,
          html: `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2>${data.subject}</h2>
            <p>${data.body}</p>
            ${data.link ? `<p><a href="${data.link}" style="background: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none;">Ver en la Plataforma</a></p>` : ''}
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 20px;" />
            <p style="font-size: 11px; color: #64748b;">Sistema Integral de Gestión Pedagógica y Docente (SIGPDA-EMS) · SEP Puebla</p>
          </div>`,
        }),
      });
    } catch (e) {
      logger.warn('Resend email delivery skipped:', e);
    }
  }
}
