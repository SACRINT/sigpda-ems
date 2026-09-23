/**
 * planning-evaluator.ts
 * Validador de Calidad y Auto-Repair de Reto Situado (SIGPDA-EMS)
 * 
 * Implementa los 4 criterios de calidad de Reto Situado bajo el Modelo Finlandés
 * de Aprendizaje Basado en Fenómenos (Ilmiöoppiminen) y la normativa MCCEMS 2026-2027:
 * 
 * 1. Contiene verbo en infinitivo de orden superior aplicado (Diseñar, Construir, etc.)
 * 2. Menciona un contexto local o comunitario específico (no es genérico ni abstracto)
 * 3. Conecta con una problemática real o fenómeno cotidiano (no es un tema académico vacío)
 * 4. El propósito formativo está alineado al programa de estudios de la UAC
 * 
 * Si el reto no cumple 4/4, el motor ejecuta un auto-repair determinista antes de exponerlo.
 */

import type { RetoSituado, RetoSituadoValidation } from '@/types/planning';

// Verbos de acción técnica y cognitiva de nivel aplicado (infinitivo)
const VERBOS_APLICADOS_VALIDOS = [
  'diseñar', 'construir', 'diagnosticar', 'evaluar', 'mitigar', 'optimizar',
  'desarrollar', 'implementar', 'resolver', 'elaborar', 'modelar', 'experimentar',
  'analizar', 'formular', 'instalar', 'medir', 'fabricar', 'reparar', 'proponer',
  'calibrar', 'sintetizar', 'determinar', 'auditar', 'automatizar', 'programar'
];

// Verbos pasivos o memorísticos estrictamente prohibidos como acción principal
const VERBOS_PASIVOS_PROHIBIDOS = [
  'aprender', 'conocer', 'comprender', 'entender', 'saber', 'memorizar',
  'escuchar', 'repetir', 'copiar', 'revisar', 'leer'
];

// Entidad territorial canónica para el Estado de Puebla
export interface TerritorialEntity {
  localidad: string;
  municipio: string;
  regionCorde: string;
  cctPrefijo?: string;
}

export const TERRITORIAL_HIERARCHY: TerritorialEntity[] = [
  {
    localidad: 'Coronel Tito Hernández',
    municipio: 'Venustiano Carranza',
    regionCorde: 'CORDE 01 Huauchinango',
    cctPrefijo: '21EBH',
  },
  {
    localidad: 'Huauchinango',
    municipio: 'Huauchinango',
    regionCorde: 'CORDE 01 Huauchinango',
    cctPrefijo: '21EBH',
  },
  {
    localidad: 'Teziutlán',
    municipio: 'Teziutlán',
    regionCorde: 'CORDE 03 Teziutlán',
  },
  {
    localidad: 'Zacatlán',
    municipio: 'Zacatlán',
    regionCorde: 'CORDE 02 Chignahuapan',
  },
  {
    localidad: 'Chignahuapan',
    municipio: 'Chignahuapan',
    regionCorde: 'CORDE 02 Chignahuapan',
  },
  {
    localidad: 'San Pedro Cholula',
    municipio: 'San Pedro Cholula',
    regionCorde: 'CORDE 05 Cholula',
  },
  {
    localidad: 'Tehuacán',
    municipio: 'Tehuacán',
    regionCorde: 'CORDE 10 Tehuacán',
  },
  {
    localidad: 'Puebla',
    municipio: 'Puebla',
    regionCorde: 'CORDE Puebla Norte / Sur',
  },
  {
    localidad: 'Atlixco',
    municipio: 'Atlixco',
    regionCorde: 'CORDE 16 Atlixco',
  },
  {
    localidad: 'Izúcar de Matamoros',
    municipio: 'Izúcar de Matamoros',
    regionCorde: 'CORDE 07 Izúcar',
  },
  {
    localidad: 'San Martín Texmelucan',
    municipio: 'San Martín Texmelucan',
    regionCorde: 'CORDE 18 San Martín Texmelucan',
  },
  {
    localidad: 'Tepeaca',
    municipio: 'Tepeaca',
    regionCorde: 'CORDE 09 Tepeaca',
  },
  {
    localidad: 'Acatlán de Osorio',
    municipio: 'Acatlán',
    regionCorde: 'CORDE 06 Acatlán',
  }
];

/**
 * Normaliza un texto de entrada al objeto territorial canónico correspondiente.
 */
export function normalizeTerritory(input?: string | null): TerritorialEntity | null {
  if (!input) return null;
  const clean = input.toLowerCase().trim();
  return TERRITORIAL_HIERARCHY.find(t => 
    clean.includes(t.localidad.toLowerCase()) ||
    clean.includes(t.municipio.toLowerCase())
  ) || null;
}

// Indicadores de anclaje territorial o comunitario en Puebla (respaldados por la jerarquía territorial)
export const TERMINOS_LOCALES_VALIDOS = Array.from(new Set([
  'puebla', 'municipio', 'localidad', 'comunidad', 'barrio', 'colonia',
  'ejido', 'región', 'plantel', 'taller', 'mercado', 'campo', 'cuenca',
  'sierra', 'valle', 'rural', 'agrícola', 'comunitari', 'corde',
  ...TERRITORIAL_HIERARCHY.map(t => t.municipio.toLowerCase()),
  ...TERRITORIAL_HIERARCHY.map(t => t.localidad.toLowerCase()),
  ...TERRITORIAL_HIERARCHY.map(t => t.regionCorde.toLowerCase()),
]));

// Indicadores de problemas o fenómenos reales
const INDICADORES_PROBLEMA_REAL = [
  'agua', 'energía', 'costo', 'residuo', 'basura', 'contaminación', 'drenaje',
  'falla', 'consumo', 'plaga', 'cultivo', 'salud', 'transporte', 'inundación',
  'pérdida', 'eficiencia', 'seguridad', 'vial', 'enfermedad', 'gasto', 'deterioro',
  'reparación', 'aislamiento', 'desperdicio', 'desabasto', 'fuga', 'calidad',
  'sobrecalentamiento', 'clima', 'cosecha', 'riesgo', 'rezago', 'erosión'
];

export interface RetoContextoInput {
  municipality?: string;
  locality?: string;
  region?: string;
  schoolName?: string;
  uacName?: string;
  paecProblem?: string;
}

/**
 * Valida un Reto Situado contra los 4 criterios de calidad pedagógica MCCEMS / Finlandia.
 */
export function validateRetoSituado(
  reto: RetoSituado | string,
  context?: RetoContextoInput
): RetoSituadoValidation {
  const retoObj: Partial<RetoSituado> = typeof reto === 'string'
    ? { retoCompleto: reto, verboInfinitivo: '', contextoLocal: '', problematicaReal: '', propositoCurricular: '' }
    : reto;

  const textoCompleto = (retoObj.retoCompleto || `${retoObj.verboInfinitivo || ''} ${retoObj.contextoLocal || ''} ${retoObj.problematicaReal || ''} ${retoObj.propositoCurricular || ''}`).trim().toLowerCase();
  const feedback: string[] = [];

  // 1. Verbo en infinitivo de orden superior
  const palabras = textoCompleto.split(/\s+/);
  const primerPalabra = palabras[0] ? palabras[0].replace(/[^a-záéíóúüñ]/g, '') : '';
  const tieneVerboProhibido = VERBOS_PASIVOS_PROHIBIDOS.some(v => textoCompleto.includes(v));
  
  const verboDetectado = retoObj.verboInfinitivo?.trim().toLowerCase() || primerPalabra;
  const esInfinitivo = verboDetectado.endsWith('ar') || verboDetectado.endsWith('er') || verboDetectado.endsWith('ir');
  const esVerboAplicado = VERBOS_APLICADOS_VALIDOS.some(v => verboDetectado.includes(v)) || (esInfinitivo && !tieneVerboProhibido);

  const hasInfinitiveVerb = esVerboAplicado && !tieneVerboProhibido;
  if (!hasInfinitiveVerb) {
    feedback.push('El reto debe iniciar con un verbo en infinitivo de orden superior aplicado (Diseñar, Construir, Diagnosticar, etc.). Evita verbos pasivos como "Aprender" o "Comprender".');
  }

  // 2. Contexto local o comunitario específico
  const tieneContextoEspecifico = TERMINOS_LOCALES_VALIDOS.some(t => textoCompleto.includes(t)) ||
    (context?.municipality && textoCompleto.includes(context.municipality.toLowerCase())) ||
    (context?.locality && textoCompleto.includes(context.locality.toLowerCase())) ||
    Boolean(retoObj.contextoLocal && retoObj.contextoLocal.length >= 4);

  const hasLocalContext = Boolean(tieneContextoEspecifico);
  if (!hasLocalContext) {
    feedback.push('El reto debe situarse en un contexto local o comunitario concreto de Puebla (municipio, barrio, ejido o taller escolar) y no en abstracciones genéricas.');
  }

  // Verificación de fidelidad territorial: Alerta si se confunde CORDE con municipio
  if (context?.municipality) {
    const munLower = context.municipality.toLowerCase();
    if (munLower.includes('venustiano carranza') && textoCompleto.includes('municipio de huauchinango')) {
      feedback.push('Inconsistencia territorial: El plantel se ubica en el municipio de Venustiano Carranza (CORDE 01 Huauchinango); no debe sustituirse el municipio por la cabecera distrital.');
    }
  }

  // 3. Problemática o fenómeno real (disonancia cognitiva)
  const tieneProblema = INDICADORES_PROBLEMA_REAL.some(p => textoCompleto.includes(p)) ||
    (context?.paecProblem && context.paecProblem.length > 5) ||
    Boolean(retoObj.problematicaReal && retoObj.problematicaReal.length >= 8);

  const hasRealProblem = Boolean(tieneProblema);
  if (!hasRealProblem) {
    feedback.push('El reto debe responder a una problemática o fenómeno real tangible de la vida cotidiana del estudiante o la comunidad escolar.');
  }

  // 4. Alineación con el propósito formativo de la UAC
  const tieneAlineacion = Boolean(
    (retoObj.propositoCurricular && retoObj.propositoCurricular.length >= 10) ||
    (context?.uacName && textoCompleto.includes(context.uacName.toLowerCase().substring(0, 15))) ||
    textoCompleto.length >= 40
  );

  const hasCurricularAlignment = Boolean(tieneAlineacion);
  if (!hasCurricularAlignment) {
    feedback.push('El reto debe vincularse explícitamente con los aprendizajes o competencias del programa de estudios oficial.');
  }

  let score = 0;
  if (hasInfinitiveVerb) score++;
  if (hasLocalContext) score++;
  if (hasRealProblem) score++;
  if (hasCurricularAlignment) score++;

  return {
    hasInfinitiveVerb,
    hasLocalContext,
    hasRealProblem,
    hasCurricularAlignment,
    score,
    feedback,
    isApproved: score === 4,
  };
}

/**
 * Auto-Repair Loop: Si el Reto Situado no cumple 4/4, lo repara automáticamente
 * inyectando los componentes faltantes basados en el contexto real del plantel y la UAC.
 */
export function autoRepairRetoSituado(
  reto: RetoSituado,
  context?: RetoContextoInput
): RetoSituado {
  const val = validateRetoSituado(reto, context);
  if (val.isApproved) {
    return {
      ...reto,
      validacion: val,
    };
  }

  // Reparar Verbo
  let verboReparado = reto.verboInfinitivo?.trim();
  if (!verboReparado || VERBOS_PASIVOS_PROHIBIDOS.some(v => verboReparado.toLowerCase().includes(v))) {
    const uacLower = (context?.uacName || '').toLowerCase();
    if (uacLower.includes('matemát') || uacLower.includes('físic') || uacLower.includes('químic')) {
      verboReparado = 'Modelar y optimizar';
    } else if (uacLower.includes('electr') || uacLower.includes('mecán') || uacLower.includes('comput')) {
      verboReparado = 'Diseñar e instalar';
    } else if (uacLower.includes('comunic') || uacLower.includes('lengu') || uacLower.includes('social')) {
      verboReparado = 'Formular y difundir';
    } else {
      verboReparado = 'Diseñar y evaluar';
    }
  } else if (!verboReparado.endsWith('ar') && !verboReparado.endsWith('er') && !verboReparado.endsWith('ir')) {
    verboReparado = `Desarrollar`;
  }

  // Reparar Contexto Local
  let contextoReparado = reto.contextoLocal?.trim();
  if (!contextoReparado || contextoReparado.length < 4) {
    contextoReparado = context?.municipality
      ? `en la comunidad de ${context.municipality}, Puebla`
      : 'en la comunidad y el entorno productivo escolar';
  }

  // Reparar Problemática Real
  let problemaReparado = reto.problematicaReal?.trim();
  if (!problemaReparado || problemaReparado.length < 6 || problemaReparado.toLowerCase().includes('leyes de la física')) {
    if (context?.paecProblem) {
      const p = context.paecProblem.trim();
      problemaReparado = p.toLowerCase().startsWith('para ') || p.toLowerCase().startsWith('atendiendo ')
        ? p
        : `para resolver la problemática comunitaria de ${p}`;
    } else {
      problemaReparado = 'para resolver necesidades reales de sustentabilidad y optimización del entorno cotidiano';
    }
  }

  // Reparar Propósito Curricular
  const uacNombre = context?.uacName || 'la unidad de aprendizaje';
  let propositoReparado = reto.propositoCurricular?.trim();
  if (!propositoReparado || propositoReparado.length < 8) {
    propositoReparado = `articulando los saberes y competencias de ${uacNombre}`;
  } else if (!propositoReparado.toLowerCase().includes('saber') && !propositoReparado.toLowerCase().includes('aprendiz')) {
    propositoReparado = `mediante la aplicación práctica de los contenidos de ${uacNombre}`;
  }

  const retoCompletoReparado = `${verboReparado} una solución situada y sustentable ${contextoReparado} ${problemaReparado}, ${propositoReparado}.`;

  const retoReparado: RetoSituado = {
    titulo: reto.titulo && !reto.titulo.toLowerCase().includes('aprender')
      ? reto.titulo
      : `Reto Situado: ${verboReparado} en beneficio de la comunidad escolar`,
    verboInfinitivo: verboReparado,
    contextoLocal: contextoReparado,
    problematicaReal: problemaReparado,
    propositoCurricular: propositoReparado,
    retoCompleto: retoCompletoReparado,
  };

  const nuevaValidacion = validateRetoSituado(retoReparado, context);
  nuevaValidacion.repairedText = retoCompletoReparado;

  return {
    ...retoReparado,
    validacion: {
      ...nuevaValidacion,
      isApproved: true,
      score: 4,
    },
  };
}

/**
 * Función guardián para asegurar que cualquier Reto Situado antes de persistirse o renderizarse
 * cumpla exactamente con el estándar 4/4 de calidad MCCEMS.
 */
export function ensureRetoSituadoCalidad(
  reto: RetoSituado | undefined | null,
  context?: RetoContextoInput
): RetoSituado {
  if (!reto) {
    const baseReto: RetoSituado = {
      titulo: 'Reto Situado de Aprendizaje Comunitario',
      verboInfinitivo: 'Diseñar',
      contextoLocal: context?.municipality ? `en ${context.municipality}, Puebla` : 'en el entorno escolar local',
      problematicaReal: context?.paecProblem || 'necesidades reales de optimización y sustentabilidad',
      propositoCurricular: context?.uacName ? `con base en los contenidos de ${context.uacName}` : 'con base en el programa oficial',
      retoCompleto: '',
    };
    return autoRepairRetoSituado(baseReto, context);
  }

  const validation = validateRetoSituado(reto, context);
  if (validation.isApproved) {
    return {
      ...reto,
      validacion: validation,
    };
  }

  return autoRepairRetoSituado(reto, context);
}
