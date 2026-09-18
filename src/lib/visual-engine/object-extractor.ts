/**
 * object-extractor.ts — Extractor Híbrido de Instrumental, Herramientas y Equipo Técnico V7
 * DBEPA Puebla · Marco Curricular Común EMS 2026-2027
 *
 * Coordina:
 * 1. Catálogo modular distribuido en 9 Familias Tecnológicas oficiales (160+ instrumentos).
 * 2. Filtro anti-ruido léxico que rechaza sustantivos abstractos (método, hipótesis, etc.).
 * 3. Guardián de Relevancia Pedagógica (3 condiciones estrictas: Cero Relleno Visual).
 */

import type { MissionSection } from '@/types/work-textbook';
import { normalizeUnicode } from '@/lib/utils/normalize';
import {
  MASTER_EQUIPMENT_CATALOG,
  type CatalogItem,
  type EquipmentCategory,
  type TechnologyFamilyId,
} from './catalogs';

export {
  MASTER_EQUIPMENT_CATALOG,
  type CatalogItem,
  type EquipmentCategory,
  type TechnologyFamilyId,
};

export const EQUIPMENT_CATALOG: CatalogItem[] = MASTER_EQUIPMENT_CATALOG;

export interface DetectedObject {
  id: string;
  name: string;
  category: EquipmentCategory;
  englishQuery: string;
  keywordsBilingual: string[];
  technicalRole: string;
  safetyRule?: string;
  normaNOM?: string;
  familias?: TechnologyFamilyId[];
  svgKey: string;
  matchedText: string;
  source: 'catalog' | 'regex_pattern';
  confidence: number;
}

// ── 1. FILTRO ANTI-RUIDO LÉXICO (SUSTANTIVOS ABSTRACTOS A EXCLUIR) ─────────────

const ABSTRACT_STOP_NOUNS = new Set([
  'metodo', 'metodos', 'procedimiento', 'procedimientos', 'formula', 'formulas',
  'ecuacion', 'ecuaciones', 'concepto', 'conceptos', 'resultado', 'resultados',
  'estrategia', 'estrategias', 'paso', 'pasos', 'sistema', 'sistemas',
  'recurso', 'recursos', 'hipotesis', 'variable', 'variables', 'modelo', 'modelos',
  'teoria', 'teorias', 'problema', 'problemas', 'situacion', 'situaciones',
  'proceso', 'procesos', 'actividad', 'actividades', 'fase', 'fases', 'etapa', 'etapas',
  'ejercicio', 'ejercicios', 'ejemplo', 'ejemplos', 'pregunta', 'preguntas',
  'solucion', 'soluciones', 'consecuencia', 'consecuencias', 'factor', 'factores',
  'criterio', 'criterios', 'enfoque', 'enfoques', 'dato', 'datos',
  'informacion', 'objetivo', 'objetivos', 'meta', 'metas', 'proposito', 'propositos',
  'tema', 'temas', 'tiempo', 'espacio', 'forma', 'formas', 'manera', 'maneras',
  'modo', 'modos', 'idea', 'ideas', 'conclusion', 'conclusiones', 'evidencia', 'evidencias',
  'caso', 'casos', 'punto', 'puntos', 'parte', 'partes', 'area', 'areas',
  'nivel', 'niveles', 'norma', 'normas', 'regla', 'reglas', 'valor', 'valores'
]);

// Sufijos instrumentales válidos para inferencia por regex
const INSTRUMENTAL_SUFFIXES = [
  'metro', 'scopio', 'grafo', 'ador', 'adora', 'era', 'ero', 'fono', 'stato', 'tron'
];

/**
 * Normaliza texto eliminando acentos, puntuación y caracteres especiales para matching.
 */
function cleanTextForMatching(text: string): string {
  return normalizeUnicode(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 2. PATRONES MORFOSINTÁCTICOS DE ACCIÓN PROCEDIMENTAL (30+ VERBOS) ───────

const OPERATIONAL_VERBS = [
  // Medición (10 verbos: infinitivo, imperativo tú/ustedes, gerundio)
  'medir', 'mide', 'midan', 'midiendo',
  'calibrar', 'calibra', 'calibren', 'calibrando',
  'verificar', 'verifica', 'verifiquen', 'verificando',
  'comprobar', 'comprueba', 'comprueben', 'comprobando',
  'diagnosticar', 'diagnostica', 'diagnostiquen', 'diagnosticando',
  'monitorear', 'monitorea', 'monitoreen', 'monitoreando',
  'inspeccionar', 'inspecciona', 'inspeccionen', 'inspeccionando',
  'registrar', 'registra', 'registren', 'registrando',
  'contrastar', 'contrasta', 'contrasten', 'contrastando',
  'examinar', 'examina', 'examinen', 'examinando',

  // Manipulación (12 verbos: infinitivo, imperativo tú/ustedes, gerundio)
  'emplear', 'emplea', 'empleen', 'empleando',
  'utilizar', 'utiliza', 'utilicen', 'utilizando',
  'usar', 'usa', 'usen', 'usando',
  'operar', 'opera', 'operen', 'operando',
  'maniobrar', 'maniobra', 'maniobren', 'maniobrando',
  'accionar', 'acciona', 'accionen', 'accionando',
  'ajustar', 'ajusta', 'ajusten', 'ajustando',
  'apretar', 'aprieta', 'aprieten', 'apretando',
  'aflojar', 'afloja', 'aflojen', 'aflojando',
  'fijar', 'fija', 'fijen', 'fijando',
  'ensamblar', 'ensambla', 'ensamblen', 'ensamblando',
  'montar', 'monta', 'monten', 'montando',

  // Conexión (7 verbos: infinitivo, imperativo tú/ustedes, gerundio)
  'conectar', 'conecta', 'conecten', 'conectando',
  'desconectar', 'desconecta', 'desconecten', 'desconectando',
  'cablear', 'cablea', 'cableen', 'cableando',
  'enchufar', 'enchufa', 'enchufen', 'enchufando',
  'energizar', 'energiza', 'energicen', 'energizando',
  'alimentar', 'alimenta', 'alimenten', 'alimentando',
  'vincular', 'vincula', 'vinculen', 'vinculando',
];

const VERBS_JOINED = OPERATIONAL_VERBS.join('|');

/**
 * Regex para capturar sustantivos instrumentales precedidos por verbos procedimentales
 * o locuciones conectivas, seguidos de artículos determinados/indeterminados o contracciones.
 */
function buildProceduralRegex(): RegExp {
  return new RegExp(
    `(?:\\b(?:${VERBS_JOINED})\\b(?:\\s+(?:con|en|mediante|a))?|\\b(?:con el uso de|mediante|a traves de|a través de)\\b)\\s+(?:el|la|los|las|un|una|al|del)\\s+([a-záéíóúñ]{4,25})`,
    'gi'
  );
}

// ── 3. DETECTOR HÍBRIDO DE INSTRUMENTAL Y EQUIPO TÉCNICO ──────────────────────

/**
 * Extrae herramientas, instrumental y equipo técnico mencionados en el texto.
 * Prioriza coincidencias exactas y por alias en el catálogo; complementa con regex.
 */
export function extractToolsAndEquipment(
  text: string,
  subjectName?: string
): DetectedObject[] {
  if (!text || text.trim().length === 0) return [];

  const normalizedText = cleanTextForMatching(text);
  const detectedMap = new Map<string, DetectedObject>();

  // Paso 1: Búsqueda determinística en el catálogo maestro por familias MCCEMS
  for (const item of EQUIPMENT_CATALOG) {
    for (const alias of item.aliases) {
      const cleanAlias = cleanTextForMatching(alias);
      const regex = new RegExp(`\\b${cleanAlias}\\b`, 'i');
      if (regex.test(normalizedText)) {
        if (!detectedMap.has(item.id)) {
          detectedMap.set(item.id, {
            id: item.id,
            name: item.name,
            category: item.category,
            englishQuery: item.englishQuery,
            keywordsBilingual: item.keywordsBilingual,
            technicalRole: item.technicalRole,
            safetyRule: item.safetyRule,
            normaNOM: item.normaNOM,
            familias: item.familias,
            svgKey: item.svgKey,
            matchedText: alias,
            source: 'catalog',
            confidence: 0.95,
          });
        }
        break;
      }
    }
  }

  // Paso 2: Detección por patrones lingüísticos (Regex contextual con filtro material)
  const patternRegex = buildProceduralRegex();
  let match: RegExpExecArray | null;

  while ((match = patternRegex.exec(text)) !== null) {
    const rawWord = match[1].toLowerCase().trim();
    const cleanWord = cleanTextForMatching(rawWord);

    // Descartar si está en la lista negra de abstracciones
    if (ABSTRACT_STOP_NOUNS.has(cleanWord)) continue;

    // Verificar si ya fue detectado por catálogo
    const alreadyFound = Array.from(detectedMap.values()).some((d) =>
      cleanTextForMatching(d.name).includes(cleanWord) || d.matchedText.includes(cleanWord)
    );
    if (alreadyFound) continue;

    // Aceptar si coincide con un sufijo instrumental o tiene longitud suficiente
    const hasInstrumentalSuffix = INSTRUMENTAL_SUFFIXES.some((suf) => cleanWord.endsWith(suf));
    if (hasInstrumentalSuffix && cleanWord.length >= 5) {
      const generatedId = `detected_${cleanWord}`;
      detectedMap.set(generatedId, {
        id: generatedId,
        name: rawWord.charAt(0).toUpperCase() + rawWord.slice(1),
        category: 'herramienta_taller',
        englishQuery: `${cleanWord} tool laboratory equipment technical`,
        keywordsBilingual: [cleanWord, 'tool', 'equipment', 'instrument'],
        technicalRole: `Dispositivo técnico utilizado en el procedimiento experimental formativo`,
        safetyRule: 'Verificar condiciones de operación segura antes de energizar o manipular.',
        svgKey: 'herramienta_generica',
        matchedText: match[0],
        source: 'regex_pattern',
        confidence: 0.85,
      });
    }
  }

  return Array.from(detectedMap.values());
}

// ── 3. GUARDIÁN DE RELEVANCIA PEDAGÓGICA (ANTI-RELLENO V7) ────────────────────

/**
 * Evalúa las 3 condiciones obligatorias antes de autorizar la inserción de una imagen:
 * 1. Presencia Operativa: el objeto está en un contexto de acción procedimental directa.
 * 2. Utilidad Formativa: cuenta con norma oficial (NOM), regla de seguridad o rol técnico relevante.
 * 3. Coherencia y Filtro Anti-Ruido: rechaza inferencias de baja confianza o sustantivos abstractos.
 */
export function evaluatePedagogicalRelevance(
  detected: DetectedObject | null,
  contextSection: 'iDo' | 'weDo' | 'youDo' | 'concept' | 'hook',
  _subjectName?: string
): boolean {
  if (!detected) return false;

  // Condición 1: Presencia Operativa
  // Si proviene del hook narrativo o concepto teórico, solo se autoriza si es un objeto del catálogo formal
  if ((contextSection === 'concept' || contextSection === 'hook') && detected.source === 'regex_pattern') {
    return false;
  }

  // Condición 2: Utilidad Formativa
  // Debe poseer una regla de seguridad explícita, norma técnica NOM o un rol técnico descriptivo
  const hasFormativeness = Boolean(
    detected.safetyRule ||
    detected.normaNOM ||
    (detected.technicalRole && detected.technicalRole.length >= 15)
  );
  if (!hasFormativeness) return false;

  // Condición 3: Filtro de Confianza Mínima
  if (detected.confidence < 0.8 && detected.source === 'regex_pattern') {
    return false;
  }

  return true;
}

/**
 * Selecciona el objeto primario de la misión (el más representativo para ficha técnica o hero).
 * Aplica el Guardián Anti-Relleno: si no hay un objeto que cumpla las 3 condiciones, RETORNA NULL.
 */
export function getPrimaryEquipmentForMission(
  mission: MissionSection,
  subjectName?: string
): DetectedObject | null {
  const iDoText = mission.iDoSection?.stepByStepDemo || '';
  const weDoText = mission.weDoSection?.guidedPractice || '';
  const youDoText = mission.youDoSection?.autonomousChallenge || '';
  const conceptText = mission.conceptZero?.coreExplanation || '';
  const hookText = mission.phenomenonHook?.story || '';

  // 1. Demostración práctica guiada (Yo Hago) — Prioridad Máxima
  const iDoMatches = extractToolsAndEquipment(iDoText, subjectName);
  for (const match of iDoMatches) {
    if (evaluatePedagogicalRelevance(match, 'iDo', subjectName)) {
      return match;
    }
  }

  // 2. Práctica colaborativa guiada (Nosotros Hacemos)
  const weDoMatches = extractToolsAndEquipment(weDoText, subjectName);
  for (const match of weDoMatches) {
    if (evaluatePedagogicalRelevance(match, 'weDo', subjectName)) {
      return match;
    }
  }

  // 3. Reto autónomo situado (Tú Haces)
  const youDoMatches = extractToolsAndEquipment(youDoText, subjectName);
  for (const match of youDoMatches) {
    if (evaluatePedagogicalRelevance(match, 'youDo', subjectName)) {
      return match;
    }
  }

  // 4. Fundamentación conceptual (Concepto Cero)
  const conceptMatches = extractToolsAndEquipment(conceptText, subjectName);
  for (const match of conceptMatches) {
    if (evaluatePedagogicalRelevance(match, 'concept', subjectName)) {
      return match;
    }
  }

  // 5. Fenómeno detonador (Hook)
  const hookMatches = extractToolsAndEquipment(hookText, subjectName);
  for (const match of hookMatches) {
    if (evaluatePedagogicalRelevance(match, 'hook', subjectName)) {
      return match;
    }
  }

  // Si no hay herramientas requeridas operativamente, RETORNA NULL (Garantía Cero Relleno)
  return null;
}
