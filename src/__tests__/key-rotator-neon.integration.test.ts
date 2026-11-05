/**
 * key-rotator-neon.integration.test.ts
 *
 * Prueba de integración REAL contra PostgreSQL en Neon Serverless.
 * Opt-in exclusivo: solo se ejecuta con RUN_DB_INTEGRATION=1 y DATABASE_URL real.
 *
 * Aislamiento total:
 * - Inserta 6 claves efímeras bajo el proveedor aislado 'test_integration_neon'.
 * - Limpia (DELETE) todas las claves de prueba en afterAll.
 * - CERO alteración de claves o registros reales de producción.
 *
 * Demuestra empíricamente:
 * 1. Ejecución real de `FOR UPDATE SKIP LOCKED` con 6 claims paralelos obteniendo 6 claves distintas (sin colisión).
 * 2. Sintaxis real y exclusión efectiva en DB mediante `ANY(${array}::uuid[])` comprobando source === 'pool'.
 * 3. Ejecución real de `reactivateCooledKeys` con parametrización de intervalos sin error de sintaxis SQL.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  if (process.env.DATABASE_URL && process.env.ADMIN_ENCRYPTION_KEY) return;
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    }
  }
}

loadEnvLocal();

const isOptInIntegration = process.env.RUN_DB_INTEGRATION === '1';

import { claimApiKey, reactivateCooledKeys, encryptKey } from '@/lib/ai-provider/key-rotator';
import { sql } from '@/lib/db/client';

const TEST_PROVIDER = 'test_integration_neon';

describe.runIf(isOptInIntegration)('Neon DB Real Integration: Concurrencia Atómica y Exclusión SQL', () => {
  const testKeyIds: string[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !process.env.ADMIN_ENCRYPTION_KEY) {
      throw new Error('DATABASE_URL y ADMIN_ENCRYPTION_KEY son obligatorias para el test de integración');
    }
    const db = sql();
    // Limpieza previa defensiva
    await db`DELETE FROM api_keys WHERE provider = ${TEST_PROVIDER}`;

    // Crear 6 claves de prueba con last_used_at escalonado
    for (let i = 0; i < 6; i++) {
      const id = crypto.randomUUID();
      testKeyIds.push(id);
      const encrypted = encryptKey(`dummy-integration-key-${i}`);
      await db`
        INSERT INTO api_keys (
          id, label, provider, key_encrypted, key_preview, is_active,
          last_used_at, last_error_at, usage_count, priority
        ) VALUES (
          ${id}::uuid,
          ${`Test Key ${i + 1}`},
          ${TEST_PROVIDER},
          ${encrypted},
          ${`...test${i}`},
          true,
          NOW() - (${(i + 1) * 30} * INTERVAL '1 second'),
          NULL,
          0,
          ${i + 1}
        )
      `;
    }
  });

  afterAll(async () => {
    const db = sql();
    await db`DELETE FROM api_keys WHERE provider = ${TEST_PROVIDER}`;
  });

  it('1. Ejecuta 6 claims paralelos contra Neon DB con FOR UPDATE SKIP LOCKED sin colisión (6 llaves distintas)', async () => {
    // Lanzar 6 claims concurrentes exactos contra Neon DB
    const claimPromises = Array.from({ length: 6 }, () =>
      claimApiKey(TEST_PROVIDER, { requirePool: true })
    );
    const results = await Promise.all(claimPromises);

    expect(results.length).toBe(6);
    for (const res of results) {
      expect(res).not.toBeNull();
      expect(res?.apiKey).toBeDefined();
      expect(res?.keyId).toBeDefined();
      // Verificación estricta: debe provenir del pool de Neon DB, nunca de fallback .env
      expect(res?.source).toBe('pool');
    }

    // Demostración matemática irrefutable: los 6 claims paralelos reclaman 6 llaves distintas
    const claimedIds = results.map((r) => r?.keyId);
    const uniqueIds = new Set(claimedIds);
    expect(uniqueIds.size).toBe(6);
    expect(claimedIds.sort()).toEqual([...testKeyIds].sort());
  });

  it('2. Excluye llaves de forma estricta en Neon DB mediante ANY(${array}::uuid[]) con source === "pool"', async () => {
    const toExclude = new Set([testKeyIds[0], testKeyIds[1]]);

    // Reclamar con exclusión estricta exigiendo pool (sin fallback a env)
    const claimed = await claimApiKey(TEST_PROVIDER, {
      excludeKeyIds: toExclude,
      requirePool: true,
    });

    expect(claimed).not.toBeNull();
    // Confirma que Neon DB ejecutó la cláusula ANY y devolvió del pool
    expect(claimed?.source).toBe('pool');
    expect(claimed?.keyId).toBeDefined();
    // La clave reclamada NUNCA debe ser una de las excluidas
    expect(toExclude.has(claimed!.keyId!)).toBe(false);
    expect([testKeyIds[2], testKeyIds[3], testKeyIds[4], testKeyIds[5]]).toContain(claimed!.keyId!);

    // Probar también con conjunto vacío para certificar que ANY con array vacío no lanza en PostgreSQL
    const claimedEmpty = await claimApiKey(TEST_PROVIDER, {
      excludeKeyIds: new Set(),
      requirePool: true,
    });
    expect(claimedEmpty?.source).toBe('pool');
    expect(claimedEmpty?.keyId).toBeDefined();
  });

  it('3. Ejecuta reactivateCooledKeys en Neon DB reactivando claves con parametrización SQL segura', async () => {
    const db = sql();
    const targetKeyId = testKeyIds[0];

    // Desactivar temporalmente la llave 0 simulando un cooldown cumplido (> 60 minutos)
    await db`
      UPDATE api_keys
      SET is_active = false,
          error_count = 5,
          last_error_at = NOW() - INTERVAL '90 minutes'
      WHERE id = ${targetKeyId}::uuid
    `;

    // Ejecutar reactivación real
    const reactivatedCount = await reactivateCooledKeys(TEST_PROVIDER);
    expect(reactivatedCount).toBeGreaterThanOrEqual(1);

    // Verificar en la base de datos que el registro fue reactivado y error_count reseteado
    const rows = await db`SELECT is_active, error_count FROM api_keys WHERE id = ${targetKeyId}::uuid`;
    expect(rows[0]?.is_active).toBe(true);
    expect(rows[0]?.error_count).toBe(0);
  });
});
