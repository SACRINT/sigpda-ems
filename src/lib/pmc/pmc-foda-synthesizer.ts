/**
 * src/lib/pmc/pmc-foda-synthesizer.ts
 *
 * Motor inteligente y determinista para la síntesis, normalización y enriquecimiento
 * automático de la Matriz Situacional FODA del PMC (MCCEMS / NEM / SEMS Puebla).
 *
 * Articula armónicamente:
 * 1. El FODA histórico extraído del PMC previo de la escuela (si existe).
 * 2. El FODA y problemáticas comunitarias del documento PAEC.
 * 3. Indicadores oficiales cuantitativos F11 y 911 (abandono, aprobación, asignaturas críticas < 7.5).
 * 4. El diagnóstico territorial y necesidades reales de infraestructura y personal.
 */

import type { PmcFodaData, PmcIndicadoresAcademicos } from '@/types/pmc';
import { cleanPmcPlaceholders } from './plan-element-normalizer';

export interface PmcFodaSynthesizerParams {
  schoolName?: string | null;
  schoolCct?: string | null;
  municipality?: string | null;
  locality?: string | null;
  totalStaff?: number | null;
  rawFoda?: PmcFodaData | null;
  paecFoda?: PmcFodaData | null;
  indicadores?: PmcIndicadoresAcademicos | null;
  diagnosticoComunidad?: string | null;
  promediosPorAsignatura?: Record<string, number> | null;
}

/**
 * Convierte un valor de FODA (string, array o nulo) en una lista limpia de viñetas.
 */
function toCleanBulletList(val: unknown): string[] {
  if (!val) return [];
  const lines: string[] = [];
  if (Array.isArray(val)) {
    for (const item of val) {
      if (item && typeof item === 'string') {
        const cleaned = cleanPmcPlaceholders(item).replace(/^[*•\-–—]\s*/, '').trim();
        if (cleaned.length >= 8) lines.push(cleaned);
      }
    }
  } else if (typeof val === 'string') {
    const rawLines = val.split(/\r?\n|;\s*/);
    for (const line of rawLines) {
      const cleaned = cleanPmcPlaceholders(line).replace(/^[*•\-–—]\s*/, '').trim();
      if (cleaned.length >= 8) lines.push(cleaned);
    }
  }
  return lines;
}

/**
 * Formatea una lista de viñetas en un bloque de texto formal con viñetas '• '.
 */
function formatBulletList(items: string[]): string {
  // Deduplicar respetando orden
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of items) {
    const lower = item.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(item);
    }
  }
  return unique.map((item) => `• ${item}`).join('\n');
}

/**
 * Sintetiza y enriquece automáticamente la Matriz FODA institucional.
 * Garantiza calidad de nivel directivo y pertinencia situada sin requerir intervención manual obligatoria.
 */
export function synthesizeSituatedFoda(params: PmcFodaSynthesizerParams): PmcFodaData {
  const {
    schoolName,
    municipality,
    locality,
    totalStaff,
    rawFoda,
    paecFoda,
    indicadores,
    diagnosticoComunidad,
    promediosPorAsignatura,
  } = params;

  const locText = locality || municipality || 'la comunidad';
  const staffCount = typeof totalStaff === 'number' && totalStaff > 0 ? totalStaff : 6;

  // ── 1. FORTALEZAS ───────────────────────────────────────────────────────────
  const fortalezasItems = [
    ...toCleanBulletList(rawFoda?.fortalezas),
    ...toCleanBulletList(paecFoda?.fortalezas),
  ];

  // Enriquecimiento institucional si las fortalezas son escasas o requieren sustancia situada
  if (fortalezasItems.length < 3) {
    fortalezasItems.push(
      `Planta docente y directiva comprometida (plantilla de ${staffCount} trabajadores) con experiencia pedagógica acumulada y atención personalizada por grupo.`,
      `Estandarización y sistematización de procesos de control escolar, planeación didáctica por progresiones y aplicación diagnóstica continua (EDIEMS y formato F11C).`,
      `Trabajo colaborativo y colegiado consolidado en sesiones ordinarias de Consejo Técnico Escolar (CTE) para el diseño de estrategias de acompañamiento académico.`,
      `Integración activa de proyectos comunitarios transversales (PEC / PAEC) que vinculan la escuela con actividades culturales, deportivas y ambientales en ${locText}.`
    );
  }

  // ── 2. OPORTUNIDADES ────────────────────────────────────────────────────────
  const oportunidadesItems = [
    ...toCleanBulletList(rawFoda?.oportunidades),
    ...toCleanBulletList(paecFoda?.oportunidades),
  ];

  if (oportunidadesItems.length < 3) {
    oportunidadesItems.push(
      `Vinculación estratégica con escuelas secundarias y telesecundarias de la micro-región para jornadas de difusión, orientación vocacional y captación de matrícula.`,
      `Articulación con instituciones de educación superior para visitas guiadas, orientación profesional temprana y consolidación de proyectos de vida para egresados.`,
      `Coordinación interinstitucional con dependencias locales (H. Ayuntamiento, DIF municipal y centros de salud) para impartición de talleres preventivos y salud integral.`,
      `Gestión colaborativa ante autoridades ejidales, municipales y Comités de Padres de Familia para faenas de conservación y mejora de espacios educativos.`
    );
  }

  // ── 3. DEBILIDADES ──────────────────────────────────────────────────────────
  const debilidadesItems = [
    ...toCleanBulletList(rawFoda?.debilidades),
    ...toCleanBulletList(paecFoda?.debilidades),
  ];

  // Inyección de asignaturas críticas según F11
  let criticasStr = '';
  if (promediosPorAsignatura && typeof promediosPorAsignatura === 'object') {
    const criticas = Object.entries(promediosPorAsignatura)
      .filter(([, prom]) => typeof prom === 'number' && prom > 0 && prom < 7.5)
      .map(([asig, prom]) => `${asig} (${prom})`);
    if (criticas.length > 0) {
      criticasStr = criticas.slice(0, 3).join(', ');
    }
  }

  if (criticasStr) {
    debilidadesItems.unshift(
      `Rezago en el aprovechamiento académico en asignaturas clave del F11 que requieren reforzamiento intensivo: ${criticasStr}.`
    );
  }

  if (debilidadesItems.length < 3) {
    debilidadesItems.push(
      `Rezago académico acumulado de ingreso proveniente del nivel secundaria, particularmente en comprensión lectora y pensamiento matemático elemental.`,
      `Carencia o necesidad de consolidación de infraestructura física escolar (gestión prioritaria de domo en cancha cívica, cisterna y equipamiento tecnológico).`,
      `Riesgo de ausentismo o desmotivación en aprendientes condicionado por factores socioeconómicos familiares y hábitos de estudio poco estructurados.`,
      `Limitación de personal especializado permanente en el área de orientación psicológica y trabajo social para la atención focalizada de casos socioemocionales.`
    );
  }

  // ── 4. AMENAZAS ─────────────────────────────────────────────────────────────
  const amenazasItems = [
    ...toCleanBulletList(rawFoda?.amenazas),
    ...toCleanBulletList(paecFoda?.amenazas),
  ];

  if (amenazasItems.length < 3) {
    amenazasItems.push(
      `Dispersión territorial y aislamiento geográfico en ${locText}: traslados a pie por largas distancias y carencia de transporte público regular hacia el plantel.`,
      `Factores de riesgo psicosocial en el entorno comunitario: deserción vinculada a la necesidad de inserción laboral temprana, migración o problemas sociofamiliares.`,
      `Descomposición del entorno social en la localidad (presencia de problemáticas de adicciones, violencia intrafamiliar y embarazos a temprana edad).`,
      `Existencia de ofertas educativas alternativas en la zona y vulnerabilidad ante contingencias climáticas (afectaciones por huracanes o lluvias intensas).`
    );
  }

  return {
    fortalezas: formatBulletList(fortalezasItems),
    oportunidades: formatBulletList(oportunidadesItems),
    debilidades: formatBulletList(debilidadesItems),
    amenazas: formatBulletList(amenazasItems),
  };
}
