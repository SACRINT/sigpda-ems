import { sql } from './client';

// ─── Notifications Queries (Phase 4) ─────────────────────────────────────────

export interface NotificationItem {
  id?: string;
  user_id: string;
  type: 'planeacion_ready' | 'audit_result' | 'deadline_reminder' | 'ffe_continuity' | 'bundle_generated' | 'document_signed' | string;
  title: string;
  message: string;
  link?: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  channels?: string[];
  metadata?: Record<string, unknown>;
  read?: boolean;
  created_at?: string;
}

export async function getNotifications(userId: string, unreadOnly: boolean = false) {
  const client = sql();
  return client`
    SELECT *
    FROM notifications
    WHERE user_id = ${userId}::uuid
      AND (${unreadOnly}::boolean = FALSE OR read = FALSE)
    ORDER BY created_at DESC
    LIMIT 50
  `;
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const client = sql();
  const rows = await client`
    SELECT COUNT(*)::int as total
    FROM notifications
    WHERE user_id = ${userId}::uuid AND read = FALSE
  `;
  return rows[0]?.total || 0;
}

export async function createNotification(data: NotificationItem) {
  const client = sql();
  const channelsJson = JSON.stringify(data.channels || ['in_app']);
  const metadataJson = JSON.stringify(data.metadata || {});

  const rows = await client`
    INSERT INTO notifications (
      user_id, type, title, message, link, severity, channels, metadata, read
    ) VALUES (
      ${data.user_id}::uuid,
      ${data.type},
      ${data.title},
      ${data.message},
      ${data.link || null},
      ${data.severity || 'info'},
      ${channelsJson}::jsonb,
      ${metadataJson}::jsonb,
      ${data.read || false}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function getAutomationRules(activeOnly: boolean = true) {
  const client = sql();
  return client`
    SELECT *
    FROM automation_rules
    WHERE (${activeOnly}::boolean = FALSE OR active = TRUE)
    ORDER BY created_at ASC
  `;
}

export async function markNotificationAsRead(id: string, userId: string) {
  const client = sql();
  const rows = await client`
    UPDATE notifications
    SET read = TRUE
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
    RETURNING *
  `;
  return rows[0] || null;
}

export async function markAllNotificationsAsRead(userId: string) {
  const client = sql();
  await client`
    UPDATE notifications
    SET read = TRUE
    WHERE user_id = ${userId}::uuid AND read = FALSE
  `;
  return true;
}

export async function deleteNotification(id: string, userId: string) {
  const client = sql();
  const rows = await client`
    DELETE FROM notifications
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
    RETURNING id
  `;
  return rows[0] || null;
}
