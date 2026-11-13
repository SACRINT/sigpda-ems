import { describe, it, expect } from 'vitest';
import {
  isVolumeOnlyBlockIntegrity,
  resolvePostRedactionEvictionTarget,
} from '@/lib/job-worker';
import type { WriterOutput } from '@/lib/guide-engine/writers/writer-contract';

function writer(
  type: WriterOutput['type'],
  coveredSessions: number[]
): WriterOutput {
  return {
    type,
    section: { coveredSessions },
  } as unknown as WriterOutput;
}

describe('JobWorker - Descarte selectivo de redactor en errores post-redacción', () => {
  const all4 = [
    writer('foundation', [1, 2, 3]),
    writer('lab', [7, 8, 9]),
    writer('project', [10, 11, 12, 13, 14, 15]),
    writer('evaluation', [16, 17, 18, 19, 20, 21, 22, 23, 24]),
  ];

  it('descarta "lab" cuando la sesión afectada 9 pertenece a su rango real', () => {
    const errorMsg = '[CrossContamination] ... Sesiones afectadas: 9.';
    const evicted = resolvePostRedactionEvictionTarget(errorMsg.toLowerCase(), all4);
    expect(evicted).toBe('lab');
  });

  it('descarta "foundation" cuando la sesión afectada 2 pertenece a su rango real', () => {
    const evicted = resolvePostRedactionEvictionTarget('Error en sesión 2: desalineación', all4);
    expect(evicted).toBe('foundation');
  });

  it('descarta "project" cuando la sesión afectada 13 pertenece a su rango real', () => {
    const evicted = resolvePostRedactionEvictionTarget('Contaminación detectada en sesiones: 13', all4);
    expect(evicted).toBe('project');
  });

  it('mapea sesión 22 a evaluación en un bloque de 24 sesiones (sin rangos hardcodeados)', () => {
    const evicted = resolvePostRedactionEvictionTarget('Sesiones afectadas: 22', all4);
    expect(evicted).toBe('evaluation');
  });

  it('mapea sesión 14 a proyecto en un bloque de 24 sesiones', () => {
    const evicted = resolvePostRedactionEvictionTarget('Sesiones afectadas: 14', all4);
    expect(evicted).toBe('project');
  });

  it('descarta "evaluation" cuando el error menciona rúbrica sin sesión', () => {
    const evicted = resolvePostRedactionEvictionTarget(
      'Inconsistencia estructural en rúbrica de evaluación formativa',
      all4
    );
    expect(evicted).toBe('evaluation');
  });

  it('no evicta arbitrariamente si el error no tiene propietario identificable', () => {
    const evicted = resolvePostRedactionEvictionTarget('fallo interno sin sesión asociada', all4);
    expect(evicted).toBeNull();
  });

  it('reconoce un déficit de volumen puro como recuperable por expansión', () => {
    const errorMsg =
      '[BlockIntegrity] El bloque 0 de "PM3" no cumple el gate editorial: ' +
      'palabras_ai=25881/27000-30000 (fuera de rango permitido con tolerancia editorial [24300-33000]) | ' +
      'qualityScore=93 (no aceptado: Extensión insuficiente (25881/27000 palabras)). No se persiste; reintente el bloque.';
    expect(isVolumeOnlyBlockIntegrity(errorMsg)).toBe(true);
  });

  it('NO trata como volumen puro un fallo con placeholders o sesiones incompletas', () => {
    expect(
      isVolumeOnlyBlockIntegrity(
        '[BlockIntegrity] ... palabras_ai=25881/27000 ... | qualityScore=93 (no aceptado: Se reintentarán los redactores con placeholders: lab). No se persiste.'
      )
    ).toBe(false);
    expect(
      isVolumeOnlyBlockIntegrity(
        '[BlockIntegrity] ... sesiones=20/24 (deben estar completas) | palabras_ai=25881/27000 ... No se persiste.'
      )
    ).toBe(false);
  });
});
