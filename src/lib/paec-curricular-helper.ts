/**
 * ============================================================================
 * PAEC CURRICULAR HELPER (H-308)
 * ============================================================================
 * 
 * Formateador e inyector determinista de contenidos curriculares oficiales
 * desde la tabla `programs_catalog` de Neon DB hacia los prompts de generación PAEC.
 * 
 * Invariantes de Calidad Curricular (Regla B-001):
 * 1. 1.º a 4.º Semestre Fundamental: Emplea "PROPÓSITOS FORMATIVOS Y CONTENIDOS".
 * 2. 5.º y 6.º Semestre Fundamental: Emplea "PROGRESIONES DE APRENDIZAJE".
 * 3. 2.º a 6.º Formación Laboral: Emplea "ACTIVIDADES CLAVE Y SABERES".
 * 4. Asignaturas sin contenido en BD: Emite guardia técnica
 *    `[DATO CURRICULAR PENDIENTE DE VALIDACIÓN — CITAR TEMAS GENERALES DEL PROGRAMA VIGENTE]`.
 *    Cero alucinación ni invención de progresiones.
 */

import type { PaecCatalogItem } from '@/lib/db/programs-catalog';

/**
 * Normaliza nombres de UAC para comparación insensible a mayúsculas y acentos.
 */
export function normalizeUacName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Formatea los contenidos curriculares oficiales de una UAC individual.
 */
export function formatUacCurricularContent(uac: PaecCatalogItem): string {
  const isLaboral = uac.component === 'laboral' || uac.model_type === 'competencias_laborales';
  const isProgresiones = !isLaboral && uac.semester >= 5;

  const cf = uac.contenidos_formativos;

  if (!cf || !Array.isArray(cf) || cf.length === 0) {
    return `- ${uac.uac_name} (Semestre ${uac.semester}, ${uac.component}): [DATO CURRICULAR PENDIENTE DE VALIDACIÓN — CITAR TEMAS GENERALES DEL PROGRAMA VIGENTE]`;
  }

  const lines: string[] = [];

  if (isLaboral) {
    lines.push(`- ${uac.uac_name} (Semestre ${uac.semester}, Formación Laboral — Actividades Clave):`);
    for (const item of cf) {
      const act = item.actividad || item.proposito || item.progresion || 'Actividad no especificada';
      const saberes = item.saberes && item.saberes.length > 0 ? ` (Saberes: ${item.saberes.join('; ')})` : '';
      lines.push(`  * Actividad Clave ${item.numero}: ${act}${saberes}`);
    }
  } else if (isProgresiones) {
    lines.push(`- ${uac.uac_name} (Semestre ${uac.semester}, Progresiones de Aprendizaje):`);
    for (const item of cf) {
      const prog = item.progresion || item.proposito || 'Progresión no especificada';
      lines.push(`  * Progresión ${item.numero}: ${prog}`);
    }
  } else {
    lines.push(`- ${uac.uac_name} (Semestre ${uac.semester}, Propósitos Formativos):`);
    for (const item of cf) {
      const prop = item.proposito || item.progresion || 'Propósito no especificado';
      const cont = item.contenidos && item.contenidos.length > 0 ? ` [Contenidos: ${item.contenidos.join(', ')}]` : '';
      lines.push(`  * Propósito ${item.numero}: ${prop}${cont}`);
    }
  }

  return lines.join('\n');
}

/**
 * Busca una UAC en el catálogo oficial por coincidencia exacta o normalizada.
 */
export function matchCurricularContent(
  uacName: string,
  semester: number,
  catalog: PaecCatalogItem[]
): PaecCatalogItem | undefined {
  const normTarget = normalizeUacName(uacName);

  // 1. Coincidencia exacta de nombre y semestre
  const exact = catalog.find(
    (c) => c.semester === semester && normalizeUacName(c.uac_name) === normTarget
  );
  if (exact) return exact;

  // 2. Coincidencia por inclusión de subcadena en el mismo semestre
  const partial = catalog.find(
    (c) =>
      c.semester === semester &&
      (normalizeUacName(c.uac_name).includes(normTarget) ||
        normTarget.includes(normalizeUacName(c.uac_name)))
  );
  if (partial) return partial;

  // 3. Coincidencia por nombre sin restricción estricta de semestre (ej. laboral multianual)
  return catalog.find((c) => normalizeUacName(c.uac_name) === normTarget);
}

/**
 * Genera el bloque textual de catálogo curricular verificado para inyectar en el prompt de la IA.
 */
export function formatCurricularCatalogForPrompt(uacs: PaecCatalogItem[]): string {
  if (!uacs || uacs.length === 0) return '';

  const header = `### CATÁLOGO CURRICULAR OFICIAL VERIFICADO (NEON DB):
Utiliza OBLIGATORIAMENTE los siguientes propósitos formativos, progresiones o actividades clave REALES para cada asignatura. Queda ESTRICTAMENTE PROHIBIDO inventar descripciones curriculares ajenas a esta lista:`;

  const body = uacs.map(formatUacCurricularContent).join('\n\n');

  return `${header}\n\n${body}`;
}
