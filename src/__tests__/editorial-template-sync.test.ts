/**
 * editorial-template-sync.test.ts — Verificación de Paridad y Sincronía de Plantillas Typst
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fases 2 y 3)
 *
 * Garantiza que la plantilla canónica (`templates/editorial/workbook-template.typ`) y TODOS
 * los componentes modulares (`templates/editorial/components/*.typ`) sean 100 % idénticos
 * bit-a-bit (SHA-256) respecto a `worker-editorial/templates/editorial/`.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

function listTypFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTypFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.typ')) {
      out.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  return out.sort();
}

function hashTypDir(dir: string, files: string[]): string {
  const hash = crypto.createHash('sha256');
  for (const rel of files) {
    hash.update(rel);
    hash.update(fs.readFileSync(path.join(dir, rel)));
  }
  return hash.digest('hex');
}

describe('Paridad y Sincronía de Plantillas Typst (P3-D + Fase 3 Modular)', () => {
  const canonicalDir = path.resolve(process.cwd(), 'templates', 'editorial');
  const workerDir = path.resolve(process.cwd(), 'worker-editorial', 'templates', 'editorial');

  it('la plantilla canónica, sus componentes modulares y la copia del worker deben existir', () => {
    const canonicalFiles = listTypFiles(canonicalDir);
    const workerFiles = listTypFiles(workerDir);

    expect(canonicalFiles).toContain('workbook-template.typ');
    expect(canonicalFiles).toContain('components/active-workbook.typ');
    expect(canonicalFiles).toContain('components/mission-banner.typ');
    expect(canonicalFiles).toContain('components/project-section.typ');
    expect(canonicalFiles).toContain('components/evaluation-section.typ');
    expect(workerFiles).toEqual(canonicalFiles);
  });

  it('todos los archivos .typ del worker deben ser idénticos bit a bit (SHA-256) a la fuente canónica', () => {
    const canonicalFiles = listTypFiles(canonicalDir);
    const workerFiles = listTypFiles(workerDir);
    expect(workerFiles).toEqual(canonicalFiles);

    const canonicalSha = hashTypDir(canonicalDir, canonicalFiles);
    const workerSha = hashTypDir(workerDir, workerFiles);
    expect(workerSha).toBe(canonicalSha);
  });
});
