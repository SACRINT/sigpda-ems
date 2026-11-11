import { describe, expect, it } from 'vitest';
import {
  getPromptCatalogEntry,
  isPromptCatalogEnabled,
  listPromptCatalogEntries,
  resolvePlanningPromptType,
} from '@/lib/prompts/prompt-catalog';

describe('prompt-catalog · catálogo versionado de planeación', () => {
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

  it('la bandera está apagada por defecto (no altera prompts legacy)', () => {
    expect(isPromptCatalogEnabled()).toBe(false);
  });
});
