import { describe, it, expect } from 'vitest';

describe('JobWorker - Descarte selectivo de redactor en errores post-redacción', () => {
  function computeWritersToKeep(
    writers: Array<{ type: 'foundation' | 'lab' | 'project' | 'evaluation' }>,
    errorMsg: string
  ) {
    let writersToKeep = [...writers];
    if (writersToKeep.length >= 4) {
      let evictedType: 'foundation' | 'lab' | 'project' | 'evaluation' = 'lab';
      const errorMsgLower = errorMsg.toLowerCase();
      const isQuotaOrNetwork =
        errorMsgLower.includes('cooldown') ||
        errorMsgLower.includes('enfriamiento') ||
        errorMsgLower.includes('503') ||
        errorMsgLower.includes('serviceunavailable');

      if (!isQuotaOrNetwork) {
        const match = errorMsgLower.match(/sesi[oó]n(?:es)?(?:\s+afectadas?)?[:\s]+(\d+)/i);
        if (match) {
          const sNum = parseInt(match[1], 10);
          if (sNum <= 3) evictedType = 'foundation';
          else if (sNum <= 9) evictedType = 'lab';
          else if (sNum <= 15) evictedType = 'project';
          else evictedType = 'evaluation';
        } else if (errorMsgLower.includes('evaluation') || errorMsgLower.includes('rúbrica') || errorMsgLower.includes('rubric')) {
          evictedType = 'evaluation';
        } else if (errorMsgLower.includes('project') || errorMsgLower.includes('proyecto')) {
          evictedType = 'project';
        }
        writersToKeep = writersToKeep.filter((w) => w.type !== evictedType);
      }
    }
    return writersToKeep;
  }

  const all4 = [
    { type: 'foundation' as const },
    { type: 'lab' as const },
    { type: 'project' as const },
    { type: 'evaluation' as const },
  ];

  it('descarta redactor "lab" cuando la sesión afectada es la 9 (evita bucle infinito en Taller de Pensamiento Variacional I)', () => {
    const errorMsg = '[CrossContamination] El bloque 0 de "Taller de Pensamiento Variacional I" contiene contenido de otra disciplina. ALERTA. Contaminacion cruzada detectada en 1 puntos. Sesiones afectadas: 9.';
    const kept = computeWritersToKeep(all4, errorMsg);
    expect(kept).toHaveLength(3);
    expect(kept.map((w) => w.type)).toEqual(['foundation', 'project', 'evaluation']);
    expect(kept.some((w) => w.type === 'lab')).toBe(false);
  });

  it('descarta redactor "foundation" cuando la sesión afectada es la 2', () => {
    const errorMsg = 'Error en sesión 2: desalineación de fundamentos';
    const kept = computeWritersToKeep(all4, errorMsg);
    expect(kept).toHaveLength(3);
    expect(kept.map((w) => w.type)).toEqual(['lab', 'project', 'evaluation']);
  });

  it('descarta redactor "project" cuando la sesión afectada es la 13', () => {
    const errorMsg = 'Contaminación detectada en sesiones: 13';
    const kept = computeWritersToKeep(all4, errorMsg);
    expect(kept).toHaveLength(3);
    expect(kept.map((w) => w.type)).toEqual(['foundation', 'lab', 'evaluation']);
  });

  it('descarta redactor "evaluation" cuando el error menciona rúbrica', () => {
    const errorMsg = 'Inconsistencia estructural en rúbrica de evaluación formativa';
    const kept = computeWritersToKeep(all4, errorMsg);
    expect(kept).toHaveLength(3);
    expect(kept.map((w) => w.type)).toEqual(['foundation', 'lab', 'project']);
  });

  it('NO descarta redactores cuando el fallo es transitorio por cuota o 503', () => {
    const errorMsg = 'AiCooldownExhaustedError: Todas las claves de "gemini" están en enfriamiento por cuota (restan 22s). Cortando por deadline.';
    const kept = computeWritersToKeep(all4, errorMsg);
    expect(kept).toHaveLength(4);
    expect(kept.map((w) => w.type)).toEqual(['foundation', 'lab', 'project', 'evaluation']);
  });
});
