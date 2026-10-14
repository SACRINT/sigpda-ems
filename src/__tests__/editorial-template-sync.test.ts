/**
 * editorial-template-sync.test.ts — Verificación de Paridad y Sincronía de Plantillas Typst
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 2)
 *
 * Garantiza que la plantilla canónica del repositorio central (`templates/editorial/workbook-template.typ`)
 * y la plantilla embebida en el contexto de build del worker container (`worker-editorial/templates/editorial/workbook-template.typ`)
 * permanezcan 100% idénticas bit a bit (SHA-256).
 *
 * Previene divergencias silenciosas entre el compilador local y el microservicio de producción en Fly Machines.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('Paridad y Sincronía de Plantillas Typst (P3-D)', () => {
  const canonicalPath = path.resolve(process.cwd(), 'templates', 'editorial', 'workbook-template.typ');
  const workerEmbeddedPath = path.resolve(
    process.cwd(),
    'worker-editorial',
    'templates',
    'editorial',
    'workbook-template.typ',
  );

  it('la plantilla canónica y la plantilla embebida en worker-editorial deben existir', () => {
    expect(fs.existsSync(canonicalPath)).toBe(true);
    expect(fs.existsSync(workerEmbeddedPath)).toBe(true);
  });

  it('la plantilla embebida del worker debe ser idéntica bit a bit (SHA-256) a la plantilla canónica', () => {
    const canonicalBuffer = fs.readFileSync(canonicalPath);
    const workerBuffer = fs.readFileSync(workerEmbeddedPath);

    expect(canonicalBuffer.length).toBeGreaterThan(1000);
    expect(workerBuffer.length).toBeGreaterThan(1000);

    const canonicalSha256 = crypto.createHash('sha256').update(canonicalBuffer).digest('hex');
    const workerSha256 = crypto.createHash('sha256').update(workerBuffer).digest('hex');

    expect(workerSha256).toBe(canonicalSha256);
  });
});
