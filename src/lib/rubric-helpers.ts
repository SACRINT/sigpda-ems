/**
 * rubric-helpers.ts — Helpers puros para descriptores de rúbricas formativas NEM / DBEPA.
 *
 * Módulo compartido entre generadores de documentos (PDF, DOCX) y validadores pedagógicos,
 * eliminando el acoplamiento cruzado DOCX -> PDF.
 */

export type RubricLevel = 'sobresaliente' | 'notable' | 'suficiente' | 'insuficiente';

/**
 * Fallback pedagógico oficial de la Nueva Escuela Mexicana (NEM - DBEPA Puebla).
 */
export function getOfficialNemFallback(level: RubricLevel): string {
  switch (level) {
    case 'sobresaliente':
      return 'Demuestra dominio integral y autónomo de los aprendizajes, aplicando los saberes en contextos reales con rigor y creatividad.';
    case 'notable':
      return 'Cumple satisfactoriamente con los criterios formativos esenciales, demostrando comprensión sólida con mínimas áreas de oportunidad.';
    case 'suficiente':
      return 'Alcanza el nivel básico de desempeño requerido para el aprendizaje; requiere guía puntual para consolidar la aplicación práctica.';
    case 'insuficiente':
      return 'Demuestra dificultades significativas en la comprensión o ejecución del criterio; requiere acompañamiento y retroalimentación formativa inmediata.';
  }
}

/**
 * Obtiene el descriptor en español oficial NEM para un nivel de rúbrica.
 * Normaliza nombres en inglés ('needs support', etc.) y provee descripción pedagógica completa.
 */
export function getRubricLevelDescriptor(
  levels: unknown,
  targetLevel: RubricLevel
): string {
  if (!levels) {
    return getOfficialNemFallback(targetLevel);
  }

  // 1. Si levels es un objeto tipo { sobresaliente: "...", notable: "..." }
  if (typeof levels === 'object' && !Array.isArray(levels)) {
    const lvlObj = levels as Record<string, unknown>;
    const directVal = lvlObj[targetLevel];
    if (typeof directVal === 'string' && directVal.trim().length > 3) {
      return directVal.trim();
    }
    const aliases: Record<string, string[]> = {
      sobresaliente: ['sobresaliente', 'excelente', 'avanzado', '10-9', 'expert', 'excellent', 'outstanding', 'advanced'],
      notable: ['notable', 'bueno', 'competente', '8-7', 'proficient', 'good', 'satisfactory'],
      suficiente: ['suficiente', 'básico', 'en desarrollo', '6-5', 'basic', 'sufficient', 'developing'],
      insuficiente: ['insuficiente', 'requiere apoyo', 'inicial', '4-1', 'needs support', 'needs improvement', 'unsatisfactory', 'inadequate'],
    };
    const targets = aliases[targetLevel] || [];
    for (const [k, v] of Object.entries(lvlObj)) {
      const kLower = k.toLowerCase().trim();
      if (targets.some((t) => kLower.includes(t)) && typeof v === 'string' && v.trim().length > 3) {
        return v.trim();
      }
    }
  }

  // 2. Si levels es un array tipo [ { levelName: '...', descriptor: '...' } ]
  if (Array.isArray(levels) && levels.length > 0) {
    const lvlArr = levels as Array<{ levelName?: string; descriptor?: string } | null | undefined>;
    const aliases: Record<string, string[]> = {
      sobresaliente: ['sobresaliente', 'excelente', 'avanzado', '10-9', 'expert', 'excellent', 'outstanding'],
      notable: ['notable', 'bueno', 'competente', '8-7', 'proficient', 'good', 'satisfactory'],
      suficiente: ['suficiente', 'básico', 'en desarrollo', '6-5', 'basic', 'sufficient', 'developing'],
      insuficiente: ['insuficiente', 'requiere apoyo', 'inicial', '4-1', 'needs support', 'needs improvement', 'unsatisfactory', 'inadequate'],
    };

    const targets = aliases[targetLevel] || [];
    for (const l of lvlArr) {
      if (!l) continue;
      const nameLower = (l.levelName || '').toLowerCase().trim();
      if (targets.some((t) => nameLower.includes(t)) && l.descriptor && l.descriptor.trim().length > 3) {
        return l.descriptor.trim();
      }
    }

    const indexMap: Record<RubricLevel, number> = { sobresaliente: 0, notable: 1, suficiente: 2, insuficiente: 3 };
    const idx = indexMap[targetLevel];
    const candidate = lvlArr[idx];
    if (candidate && candidate.descriptor && candidate.descriptor.trim().length > 5) {
      return candidate.descriptor.trim();
    }
  }

  return getOfficialNemFallback(targetLevel);
}
