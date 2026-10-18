/**
 * editorial-worker-real.test.ts — Test de Integración End-to-End con el Worker Container Real
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 2)
 *
 * Ejercita directamente el microservicio HTTP de server.js:
 * - Levanta el servidor en puerto efímero (listen 0).
 * - Configura EDITORIAL_WORKER_URL y EDITORIAL_WORKER_SECRET.
 * - Despacha el fixture canónico a través del cliente oficial (dispatchToEditorialWorker).
 * - Verifica que source === 'remote_worker' (cero fallback local).
 * - Verifica contenido real del PDF: pageCount >= 30, pdfBuffer > 50KB.
 * - Verifica que renderedSessionCount y renderedProductoIntegradorCount provengan
 *   de consultas reales con `typst query` dentro del worker.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import rawFixture from './fixtures/editorial/student-workbook-chapter.fixture.json';
import { dispatchToEditorialWorker } from '@/lib/editorial/worker-client';
import { StudentChapter } from '@/lib/editorial/student-content-model';

// Importar el handler real del worker
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleRequest } = require('../../worker-editorial/server.js');

describe('Worker Container Typst — Integración Real sobre HTTP (P1-2)', () => {
  let testServer: http.Server;
  let workerBaseUrl: string;
  const TEST_SECRET = 'sigpda-adversarial-secret-2026';
  const originalEnvUrl = process.env.EDITORIAL_WORKER_URL;
  const originalEnvSecret = process.env.EDITORIAL_WORKER_SECRET;

  beforeAll(async () => {
    await new Promise<void>((resolve, reject) => {
      testServer = http.createServer(handleRequest);
      testServer.listen(0, '127.0.0.1', () => {
        const addr = testServer.address();
        if (!addr || typeof addr === 'string') {
          return reject(new Error('No se pudo obtener dirección del servidor'));
        }
        workerBaseUrl = `http://127.0.0.1:${addr.port}`;
        process.env.EDITORIAL_WORKER_URL = workerBaseUrl;
        process.env.EDITORIAL_WORKER_SECRET = TEST_SECRET;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (originalEnvUrl !== undefined) {
      process.env.EDITORIAL_WORKER_URL = originalEnvUrl;
    } else {
      delete process.env.EDITORIAL_WORKER_URL;
    }

    if (originalEnvSecret !== undefined) {
      process.env.EDITORIAL_WORKER_SECRET = originalEnvSecret;
    } else {
      delete process.env.EDITORIAL_WORKER_SECRET;
    }

    await new Promise<void>((resolve, reject) => {
      testServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('debe responder al health check del worker en /health con 200 y versión de Typst', async () => {
    const res = await fetch(`${workerBaseUrl}/health`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('sigpda-editorial-worker');
    expect(data.typstVersion).toContain('typst');
  });

  it('debe responder al health check con método HEAD con 200 sin cuerpo', async () => {
    const res = await fetch(`${workerBaseUrl}/health`, { method: 'HEAD' });
    expect(res.status).toBe(200);
  });

  it('debe rechazar solicitudes con 401 si no se provee el secret de autenticación', async () => {
    const res = await fetch(`${workerBaseUrl}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter: rawFixture }),
    });
    expect(res.status).toBe(401);
  });

  it('debe compilar el fixture canónico a través del worker real sobre HTTP sin caer en fallback local', async () => {
    const result = await dispatchToEditorialWorker(rawFixture as unknown as StudentChapter, {
      sourceDateEpoch: 0,
      timeoutMs: 30000,
    });

    // 1. Verificación crucial: el origen DEBE ser el worker remoto
    expect(result.source).toBe('remote_worker');
    expect(result.success).toBe(true);

    // 2. Integridad del buffer PDF generado por el worker
    expect(result.pdfBuffer).toBeDefined();
    expect(Buffer.isBuffer(result.pdfBuffer)).toBe(true);
    expect(result.pdfBuffer.length).toBeGreaterThan(50000);

    // 3. Paginación real y determinista (el PDF NO está vacío)
    expect(result.pageCount).toBeGreaterThanOrEqual(30);
    expect(result.pageCount).toBeLessThanOrEqual(40);

    // 4. Conteo de sesiones renderizadas reales (no tautológico, obtenido vía typst query en worker)
    expect(result.renderedSessionCount).toBe(14);

    // 5. Conteo de productos integradores renderizados reales (vía typst query en worker)
    expect(result.renderedProductoIntegradorCount).toBe(3);

    // 6. Hash SHA-256 válido
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);

    // 7. Métrica de latencia positiva
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.binaryVersion).toContain('typst');
  }, 25000);

  it('debe rechazar con 400 si el payload del capítulo es inválido', async () => {
    const res = await fetch(`${workerBaseUrl}/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_SECRET}`,
      },
      body: JSON.stringify({ chapter: { titulo: 'Sin sesiones' } }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('sesiones[]');
  });

  it('debe rechazar con 500 (fail-closed) en NODE_ENV=production si no hay secret configurado (P2-B)', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSecret = process.env.EDITORIAL_WORKER_SECRET;
    const envMutable = process.env as Record<string, string | undefined>;
    try {
      envMutable['NODE_ENV'] = 'production';
      delete process.env.EDITORIAL_WORKER_SECRET;

      const res = await fetch(`${workerBaseUrl}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter: rawFixture }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('EDITORIAL_WORKER_SECRET es obligatorio');
    } finally {
      envMutable['NODE_ENV'] = prevNodeEnv;
      process.env.EDITORIAL_WORKER_SECRET = prevSecret;
    }
  });

  it('debe compilar exitosamente cuando PUBLIC_DIR apunta a un directorio con la imagen requerida por materialSpot', async () => {
    const testPublicDir = path.join(os.tmpdir(), `sigpda_test_public_${Date.now()}`);
    const materialesDir = path.join(testPublicDir, 'images', 'materiales');
    await fs.promises.mkdir(materialesDir, { recursive: true });

    const sourceMateriales = path.resolve(process.cwd(), 'public', 'images', 'materiales');
    await fs.promises.cp(sourceMateriales, materialesDir, { recursive: true });

    const prevPublicDir = process.env.PUBLIC_DIR;
    process.env.PUBLIC_DIR = testPublicDir;

    try {
      const res = await fetch(`${workerBaseUrl}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_SECRET}`,
        },
        body: JSON.stringify({ chapter: rawFixture }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.pageCount).toBeGreaterThanOrEqual(30);
    } finally {
      if (prevPublicDir !== undefined) {
        process.env.PUBLIC_DIR = prevPublicDir;
      } else {
        delete process.env.PUBLIC_DIR;
      }
      await fs.promises.rm(testPublicDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 25000);

  it('debe fallar con 500 controlado cuando la imagen de materialSpot no existe en PUBLIC_DIR', async () => {
    const emptyPublicDir = path.join(os.tmpdir(), `sigpda_test_empty_public_${Date.now()}`);
    await fs.promises.mkdir(emptyPublicDir, { recursive: true });

    const prevPublicDir = process.env.PUBLIC_DIR;
    process.env.PUBLIC_DIR = emptyPublicDir;

    try {
      const res = await fetch(`${workerBaseUrl}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_SECRET}`,
        },
        body: JSON.stringify({ chapter: rawFixture }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('file not found');
    } finally {
      if (prevPublicDir !== undefined) {
        process.env.PUBLIC_DIR = prevPublicDir;
      } else {
        delete process.env.PUBLIC_DIR;
      }
      await fs.promises.rm(emptyPublicDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 25000);
});
