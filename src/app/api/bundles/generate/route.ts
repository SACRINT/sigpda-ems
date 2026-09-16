import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById, sql } from '@/lib/db';
import { generateBundle, generateFullBundle } from '@/lib/bundle-generator';
import type { GeneratedPlanningContent } from '@/types/planning';
import { extractIdempotencyKey, createIdempotencyKey } from '@/lib/idempotency';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  let insertedAuditId: string | null = null;
  let effectiveIdempotencyKey: string | null = null;

  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { planningId, type = 'guia' } = body;

    if (!planningId) {
      return NextResponse.json({ error: 'planningId requerido' }, { status: 400 });
    }

    // ── 1. Determinar clave de idempotencia (Header o Hash SHA-256 de 5 min) ─
    const headerKey = extractIdempotencyKey(request) ||
      request.headers.get('idempotency-key') ||
      request.headers.get('Idempotency-Key') ||
      request.headers.get('x-idempotency-key') ||
      null;

    if (headerKey && headerKey.trim().length > 0) {
      effectiveIdempotencyKey = headerKey.trim().slice(0, 64);
    } else {
      const fiveMinWindow = Math.floor(Date.now() / (5 * 60 * 1000));
      effectiveIdempotencyKey = crypto
        .createHash('sha256')
        .update(`bundle:${planningId}:${type}:${fiveMinWindow}`)
        .digest('hex')
        .slice(0, 64);
    }

    // ── 2. Verificación de Idempotencia en generation_audit_logs ──────────────
    if (effectiveIdempotencyKey) {
      try {
        const db = sql();
        const existingRows = await db`
          SELECT id, status, result_json, bundle_url, metadata
          FROM generation_audit_logs
          WHERE idempotency_key = ${effectiveIdempotencyKey}
          LIMIT 1;
        `;

        if (existingRows && existingRows.length > 0) {
          const logRecord = existingRows[0];
          if (logRecord.status === 'completed') {
            logger.info('[bundles/generate] Cache hit idempotente completado', {
              idempotencyKey: effectiveIdempotencyKey,
              planningId,
            });
            const cachedPayload = logRecord.result_json || {
              bundle_url: logRecord.bundle_url,
              cached: true,
              type,
            };
            return NextResponse.json(cachedPayload, {
              headers: {
                'X-Idempotency-Hit': 'true',
                'X-Idempotency-Key': effectiveIdempotencyKey,
              },
            });
          }

          if (logRecord.status === 'processing') {
            logger.warn('[bundles/generate] Conflicto de generación concurrente en proceso', {
              idempotencyKey: effectiveIdempotencyKey,
              planningId,
            });
            return NextResponse.json(
              {
                error: 'Generación de materiales en proceso. Por favor espere unos momentos.',
                retryAfter: 5,
              },
              {
                status: 409,
                headers: {
                  'Retry-After': '5',
                  'X-Idempotency-Key': effectiveIdempotencyKey,
                },
              }
            );
          }
        }

        // Registrar inicio de procesamiento atómico
        const insertRows = await db`
          INSERT INTO generation_audit_logs (
            planning_id,
            teacher_id,
            bundle_type,
            idempotency_key,
            status,
            created_at,
            updated_at
          ) VALUES (
            ${planningId}::uuid,
            ${teacher.id}::uuid,
            ${type},
            ${effectiveIdempotencyKey},
            'processing',
            NOW(),
            NOW()
          )
          ON CONFLICT (idempotency_key) DO UPDATE
          SET updated_at = NOW()
          RETURNING id;
        `;
        if (insertRows && insertRows.length > 0) {
          insertedAuditId = insertRows[0].id;
        }
      } catch (auditErr) {
        // Fallback graceful: degradación suave sin interrumpir la generación docente
        logger.warn('[bundles/generate] Fallback graceful en verificación de idempotencia:', auditErr);
      }
    }

    // ── 3. Validación de la planeación y contenido ───────────────────────────
    const planning = await getPlanningById(planningId, teacher.id);
    if (!planning) return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });

    if (!planning.contentJson) {
      return NextResponse.json({ error: 'La planeación no tiene contenido generado' }, { status: 400 });
    }

    const content = planning.contentJson as GeneratedPlanningContent;

    // ── 4. Ejecución del generador de materiales ─────────────────────────────
    let responseData: any = {};
    if (type === 'full') {
      const bundle = await generateFullBundle(content);
      responseData = { bundle };
    } else {
      const result = await generateBundle(content, type as 'guia' | 'instrumento' | 'diapositivas' | 'quiz');
      responseData = { result, type };
    }

    // ── 5. Actualizar estado a 'completed' en generation_audit_logs ───────────
    if (insertedAuditId || effectiveIdempotencyKey) {
      try {
        const db = sql();
        await db`
          UPDATE generation_audit_logs
          SET status = 'completed',
              result_json = ${JSON.stringify(responseData)}::jsonb,
              metadata = ${JSON.stringify({
                completedAt: new Date().toISOString(),
                type,
                uacName: planning.uacName,
              })}::jsonb,
              updated_at = NOW()
          WHERE ${insertedAuditId ? db`id = ${insertedAuditId}::uuid` : db`idempotency_key = ${effectiveIdempotencyKey}`};
        `;
      } catch (updateErr) {
        logger.warn('[bundles/generate] Error actualizando status completed en audit log:', updateErr);
      }
    }

    // Guardar también en tabla legacy de idempotencia si se envió clave UUID
    const legacyKey = extractIdempotencyKey(request);
    if (legacyKey) {
      await createIdempotencyKey(
        legacyKey,
        teacher.id,
        '/api/bundles/generate',
        responseData
      ).catch((e) => logger.warn('[bundles/generate] No se pudo guardar clave legacy:', e));
    }

    // ── 6. Notificación In-App (Phase 8A.1) ──────────────────────────────────
    try {
      const { sendNotification } = await import('@/lib/notifications');
      await sendNotification({
        userId: teacher.id,
        type: 'bundle_generated',
        title: 'Bundle Didáctico Generado',
        message: `Se ha generado el paquete de materiales (${type === 'full' ? 'Suite Completa' : type}) para ${planning.uacName}.`,
        link: `/planeacion/${planningId}`,
        severity: 'success',
        channels: ['in_app'],
        metadata: { planningId, bundleType: type, uacName: planning.uacName },
      });
    } catch (notifErr) {
      logger.warn('Could not dispatch bundle_generated notification:', notifErr);
    }

    return NextResponse.json(responseData, {
      headers: effectiveIdempotencyKey ? { 'X-Idempotency-Key': effectiveIdempotencyKey } : {},
    });
  } catch (error) {
    logger.error('Bundle generation error:', error);

    // Si falló, marcar como 'failed' en generation_audit_logs
    if (insertedAuditId || effectiveIdempotencyKey) {
      try {
        const db = sql();
        await db`
          UPDATE generation_audit_logs
          SET status = 'failed',
              metadata = ${JSON.stringify({
                failedAt: new Date().toISOString(),
                errorMessage: error instanceof Error ? error.message : String(error),
              })}::jsonb,
              updated_at = NOW()
          WHERE ${insertedAuditId ? db`id = ${insertedAuditId}::uuid` : db`idempotency_key = ${effectiveIdempotencyKey}`};
        `;
      } catch (logFailedErr) {
        logger.warn('[bundles/generate] Error registrando fallo en audit log:', logFailedErr);
      }
    }

    return NextResponse.json({ error: 'Error al generar bundle' }, { status: 500 });
  }
}
