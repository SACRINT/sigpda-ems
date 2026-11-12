/**
 * planning-versions.ts — Control Documental Inmutable y Trazabilidad de Planeaciones.
 * Habilitador Tecnológico para Sistemas de Gestión de Calidad (SGC) ISO 21001:2018.
 *
 * Registra instantáneas inmutables de planeaciones didácticas validadas con:
 * - Numeración secuencial por planeación (version_number: 1, 2, 3...)
 * - Hash canónico criptográfico SHA-256 (orden determinista de claves JSON)
 * - Calificaciones normativas y pedagógicas (Anexo 12 USICAMM + DBEPA)
 * - Trazabilidad de autoría (teacher_id) y sumario de cambios
 */

import { createHash } from 'crypto';
import { sql } from '@/lib/db/client';
import { logger } from '@/lib/logger';

export interface PlanningVersionRecord {
  id: string;
  planning_id: string;
  teacher_id: string;
  version_number: number;
  snapshot_json: Record<string, unknown>;
  sha256_hash: string;
  anexo12_score: number | null;
  dbepa_score: number | null;
  change_summary: string | null;
  created_at: string;
}

export interface RecordVersionOptions {
  planningId: string;
  teacherId: string;
  contentJson: Record<string, unknown>;
  anexo12Score?: number | null;
  dbepaScore?: number | null;
  changeSummary?: string | null;
}

/**
 * Serializa un objeto JSON a string de forma canónica determinista:
 * Las claves de los objetos se ordenan alfabéticamente de forma recursiva.
 * Garantiza que dos objetos semánticamente idénticos produzcan exactamente la misma cadena.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalJsonStringify(item)).join(',') + ']';
  }
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const pairs = keys.map((key) => {
    return JSON.stringify(key) + ':' + canonicalJsonStringify(record[key]);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * Genera el hash SHA-256 hexadecimal canónico de un contenido de planeación.
 */
export function computeCanonicalSha256(content: unknown): string {
  const canonical = canonicalJsonStringify(content);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Registra una nueva versión inmutable de una planeación en Neon DB.
 */
export async function recordPlanningVersion(
  options: RecordVersionOptions
): Promise<PlanningVersionRecord | null> {
  const {
    planningId,
    teacherId,
    contentJson,
    anexo12Score = null,
    dbepaScore = null,
    changeSummary = null,
  } = options;

  if (!planningId || !teacherId || !contentJson) {
    throw new Error('planningId, teacherId y contentJson son obligatorios para crear una versión');
  }

  const sha256Hash = computeCanonicalSha256(contentJson);
  const db = sql();

  try {
    // 1. Determinar el siguiente número de versión atómicamente
    const versionQuery = await db`
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
      FROM planning_versions
      WHERE planning_id = ${planningId}
    `;

    const nextVersion = Number(versionQuery[0]?.next_version || 1);

    // 2. Insertar snapshot inmutable
    const rows = await db`
      INSERT INTO planning_versions (
        planning_id,
        teacher_id,
        version_number,
        snapshot_json,
        sha256_hash,
        anexo12_score,
        dbepa_score,
        change_summary
      ) VALUES (
        ${planningId},
        ${teacherId},
        ${nextVersion},
        ${JSON.stringify(contentJson)},
        ${sha256Hash},
        ${anexo12Score},
        ${dbepaScore},
        ${changeSummary}
      )
      RETURNING *
    `;

    logger.info(
      `[recordPlanningVersion] Versión v${nextVersion} registrada para planeación ${planningId} (SHA: ${sha256Hash.substring(0, 12)}...)`
    );

    return (rows[0] as unknown as PlanningVersionRecord) || null;
  } catch (error) {
    logger.error(`[recordPlanningVersion] Error al registrar versión para ${planningId}:`, error);
    throw error;
  }
}

/**
 * Consulta el historial cronológico inverso de versiones para una planeación.
 */
export async function getPlanningVersions(planningId: string): Promise<PlanningVersionRecord[]> {
  const db = sql();
  const rows = await db`
    SELECT id, planning_id, teacher_id, version_number, snapshot_json, sha256_hash,
           anexo12_score, dbepa_score, change_summary, created_at
    FROM planning_versions
    WHERE planning_id = ${planningId}
    ORDER BY version_number DESC
  `;
  return rows as unknown as PlanningVersionRecord[];
}

/**
 * Obtiene una versión específica de una planeación por su número de versión.
 */
export async function getPlanningVersionByNumber(
  planningId: string,
  versionNumber: number
): Promise<PlanningVersionRecord | null> {
  const db = sql();
  const rows = await db`
    SELECT id, planning_id, teacher_id, version_number, snapshot_json, sha256_hash,
           anexo12_score, dbepa_score, change_summary, created_at
    FROM planning_versions
    WHERE planning_id = ${planningId} AND version_number = ${versionNumber}
    LIMIT 1
  `;
  return (rows[0] as unknown as PlanningVersionRecord) || null;
}
