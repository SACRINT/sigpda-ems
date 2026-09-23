/**
 * src/lib/analytics/events.ts
 * Event Bus y Registro de Eventos de Dominio para Analítica Pedagógica
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 */

import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { DomainEvent } from '@/types/analytics';

let schemaInitialized = false;

export async function ensureDomainEventsTable(): Promise<void> {
  if (schemaInitialized) return;
  try {
    const db = sql();
    await db`
      CREATE TABLE IF NOT EXISTS domain_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(100) NOT NULL,
        aggregate_id VARCHAR(100) NOT NULL,
        aggregate_type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);
      CREATE INDEX IF NOT EXISTS idx_domain_events_type ON domain_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_domain_events_created ON domain_events(created_at DESC);
    `;
    schemaInitialized = true;
  } catch (error) {
    logger.warn('[DomainEvents] No se pudo inicializar la tabla domain_events (modo fallback):', error);
  }
}

/**
 * Emite y persiste un evento de dominio determinista en la base de datos.
 */
export async function emitDomainEvent(event: DomainEvent): Promise<DomainEvent | null> {
  try {
    await ensureDomainEventsTable();
    const db = sql();
    const payloadJson = JSON.stringify(event.payload || {});

    const rows = await db`
      INSERT INTO domain_events (
        event_type, aggregate_id, aggregate_type, payload
      ) VALUES (
        ${event.eventType},
        ${event.aggregateId},
        ${event.aggregateType},
        ${payloadJson}::jsonb
      )
      RETURNING id, event_type, aggregate_id, aggregate_type, payload, created_at
    `;

    if (rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id as string,
        eventType: r.event_type as DomainEvent['eventType'],
        aggregateId: r.aggregate_id as string,
        aggregateType: r.aggregate_type as DomainEvent['aggregateType'],
        payload: (r.payload || {}) as Record<string, unknown>,
        createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
      };
    }
    return null;
  } catch (error) {
    logger.warn(`[DomainEvents] Error emitiendo evento ${event.eventType}:`, error);
    return null;
  }
}

/**
 * Consulta eventos recientes por tipo o agregado para observabilidad.
 */
export async function getRecentDomainEvents(options: {
  eventType?: string;
  aggregateType?: string;
  aggregateId?: string;
  limit?: number;
} = {}): Promise<DomainEvent[]> {
  try {
    await ensureDomainEventsTable();
    const db = sql();
    const limit = options.limit || 50;

    const rows = await db`
      SELECT id, event_type, aggregate_id, aggregate_type, payload, created_at
      FROM domain_events
      WHERE (${options.eventType || null}::varchar IS NULL OR event_type = ${options.eventType})
        AND (${options.aggregateType || null}::varchar IS NULL OR aggregate_type = ${options.aggregateType})
        AND (${options.aggregateId || null}::varchar IS NULL OR aggregate_id = ${options.aggregateId})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      eventType: r.event_type as DomainEvent['eventType'],
      aggregateId: r.aggregate_id as string,
      aggregateType: r.aggregate_type as DomainEvent['aggregateType'],
      payload: (r.payload || {}) as Record<string, unknown>,
      createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : undefined,
    }));
  } catch (error) {
    logger.warn('[DomainEvents] Error consultando eventos recientes:', error);
    return [];
  }
}
