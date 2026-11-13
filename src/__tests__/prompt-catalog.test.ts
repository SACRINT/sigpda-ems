import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  getPromptCatalogEntry,
  isPromptCatalogEnabled,
  listPromptCatalogEntries,
  resolvePlanningPromptType,
} from '@/lib/prompts/prompt-catalog';
import { featureFlags } from '@/lib/platform/feature-flags';

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('prompt-catalog · catálogo versionado de planeación (F6 apagado)', () => {
  it('expone exactamente los tres tipos aprobados', () => {
    const entries = listPromptCatalogEntries();
    expect(entries.map((entry) => entry.tipo).sort()).toEqual([
      'extendido',
      'fundamental',
      'laboral',
    ]);
  });

  it('cada fragmento tiene versión, descripción y contenido sustantivo', () => {
    for (const entry of listPromptCatalogEntries()) {
      expect(entry.version).toMatch(/^v\d+$/);
      expect(entry.descripcion.length).toBeGreaterThan(20);
      expect(entry.contenido.length).toBeGreaterThan(500);
      expect(entry.contenido).toContain('#');
    }
  });

  it('el fragmento laboral conserva la regla de 3 Actividades Clave de 18 h', () => {
    const laboral = getPromptCatalogEntry('laboral');
    expect(laboral.contenido).toContain('3 Actividades Clave');
    expect(laboral.contenido).toContain('18 horas');
  });

  it('resuelve el tipo desde el componente curricular', () => {
    expect(resolvePlanningPromptType('laboral')).toBe('laboral');
    expect(resolvePlanningPromptType('fundamental')).toBe('fundamental');
    expect(resolvePlanningPromptType('ffe_optativa')).toBe('extendido');
    expect(resolvePlanningPromptType('ext_obligatorio')).toBe('extendido');
    expect(resolvePlanningPromptType('optativa')).toBe('extendido');
    expect(resolvePlanningPromptType('')).toBe('fundamental');
    expect(resolvePlanningPromptType('desconocido')).toBe('fundamental');
  });

  it('la bandera PROMPT_CATALOG_ENABLED está apagada por defecto (no altera prompts legacy)', () => {
    expect(isPromptCatalogEnabled()).toBe(false);
    expect(featureFlags.isEnabled('PROMPT_CATALOG_ENABLED')).toBe(false);
  });

  it('ningún generador o ruta activa de src/lib o src/app importa el catálogo F6 por accidente', () => {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const files = [
      ...collectSourceFiles(path.join(srcRoot, 'lib')),
      ...collectSourceFiles(path.join(srcRoot, 'app')),
    ];

    const forbiddenImports = [
      'prompt-catalog',
      'getPromptCatalogEntry',
      'listPromptCatalogEntries',
      'isPromptCatalogEnabled',
      'PROMPT_CATALOG_ENABLED',
    ];

    const offenders: string[] = [];
    for (const filePath of files) {
      const normalized = filePath.replace(/\\/g, '/');
      if (
        normalized.endsWith('/src/lib/prompts/prompt-catalog.ts') ||
        normalized.endsWith('/src/lib/prompts/generated/prompt-catalog.generated.ts') ||
        normalized.endsWith('/src/lib/platform/feature-flags.ts')
      ) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      if (forbiddenImports.some((token) => content.includes(token))) {
        offenders.push(normalized);
      }
    }

    expect(offenders).toEqual([]);
  });
});
