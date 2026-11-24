import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { auditSacrintDependencies } from '../../scripts/audit-sacrint-deps.mjs';

function makeTempProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sacrint-deps-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  return root;
}

describe('Auditor de dependencias SACRINT (scripts/audit-sacrint-deps.mjs)', () => {
  it('aprueba un grafo DAG válido respetando Capas 0 → 5 sin ciclos ni barrels internos', () => {
    const root = makeTempProject({
      'src/lib/visual-engine/sacrint/types.ts': 'export type X = string;\n',
      'src/lib/visual-engine/sacrint/text/grammar-normalization.ts': "import type { X } from '../types';\nexport const norm = (s: X) => s;\n",
      'src/lib/visual-engine/sacrint/distiller/lesson-bundle.ts': "import { norm } from '../text/grammar-normalization';\nexport const bundle = () => norm('ok');\n",
      'src/lib/visual-engine/sacrint/spec.ts': "export { bundle } from './distiller/lesson-bundle';\n",
    });
    try {
      const report = auditSacrintDependencies(root);
      expect(report.passed).toBe(true);
      expect(report.cycles).toHaveLength(0);
      expect(report.layerViolations).toHaveLength(0);
      expect(report.barrelViolations).toHaveLength(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('detecta dependencias circulares entre módulos', () => {
    const root = makeTempProject({
      'src/lib/visual-engine/sacrint/text/a.ts': "import { b } from './b';\nexport const a = () => b();\n",
      'src/lib/visual-engine/sacrint/text/b.ts': "import { a } from './a';\nexport const b = () => a();\n",
    });
    try {
      const report = auditSacrintDependencies(root);
      expect(report.passed).toBe(false);
      expect(report.cycles.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('detecta violaciones de dirección de capas (Capa 1 importando Capa 3)', () => {
    const root = makeTempProject({
      'src/lib/visual-engine/sacrint/diagrams/shared.ts': 'export const helper = () => 1;\n',
      'src/lib/visual-engine/sacrint/text/bad.ts': "import { helper } from '../diagrams/shared';\nexport const bad = () => helper();\n",
    });
    try {
      const report = auditSacrintDependencies(root);
      expect(report.passed).toBe(false);
      expect(report.layerViolations).toHaveLength(1);
      expect(report.layerViolations[0].fromLayer).toBe('text');
      expect(report.layerViolations[0].toLayer).toBe('diagrams');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('prohíbe que un módulo extraído importe desde una fachada/barrel', () => {
    const root = makeTempProject({
      'src/lib/visual-engine/sacrint/spec.ts': 'export const legacy = 1;\n',
      'src/lib/visual-engine/sacrint/builders/deck-builder.ts': "import { legacy } from '../spec';\nexport const run = () => legacy;\n",
    });
    try {
      const report = auditSacrintDependencies(root);
      expect(report.passed).toBe(false);
      expect(report.barrelViolations).toHaveLength(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('verifica que el repositorio real actual tiene 0 ciclos, 0 violaciones de capa y 0 barrels internos', () => {
    const report = auditSacrintDependencies(process.cwd());
    expect(report.cycles).toEqual([]);
    expect(report.layerViolations).toEqual([]);
    expect(report.barrelViolations).toEqual([]);
    expect(report.passed).toBe(true);
  });
});
