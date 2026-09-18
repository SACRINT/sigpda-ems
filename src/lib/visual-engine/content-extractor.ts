/**
 * content-extractor.ts — Extractor de Contenido Determinista para Infografías y Esquemas SVG
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Módulo de la Fase V3:
 * Procesa el texto didáctico de la misión (coreExplanation + story + demo + guidedPractice + etc.)
 * y extrae datos reales estructurados para alimentar los generadores de esquemas e infografías SVG:
 * 1. extractYears: Detecta fechas históricas de 4 dígitos -> TimelineEvent[] para generateTimeline
 * 2. extractTermDefs: Detecta pares término: definición -> ConceptNode[] + ConceptEdge[] para generateConceptMap
 * 3. extractPercentStats: Detecta cifras con % y su concepto -> SocialStatItem[] para generateSocialStatsChart
 * 4. extractEnumSteps: Detecta pasos numerados (Paso 1, 1., 2.) -> TechnicalStep[] / GanttTask[] / HistoricalStep[]
 * 5. extractSafetyChecks: Detecta normas NOM y medidas de seguridad -> SafetyCheck[]
 *
 * REGLA ESTRICTA:
 * Funciones puras, 100% deterministas, 0 llamadas externas, 0 tokens de LLM.
 * Si no detecta suficientes datos reales (mínimo 2), retorna arreglo vacío [] para
 * permitir al generador usar su plantilla base sin romper el renderizado.
 */

import type {
  TimelineEvent,
  ConceptNode,
  ConceptEdge,
  HistoricalStep,
  SocialStatItem,
} from './generators/humanities-generator';
import type {
  TechnicalStep,
  GanttTask,
  SafetyCheck,
  SystemBlock,
} from './generators/laboral-generator';
import type { ImageAsset } from '@/types/planning';

const STAT_COLORS = ['#2563eb', '#d97706', '#059669', '#7c3aed', '#dc2626', '#0284c7'];
const GANTT_COLORS = ['#2563eb', '#0284c7', '#059669', '#d97706', '#7c3aed'];

/**
 * Elimina cualquier marca Markdown (negritas **, cursivas *, títulos #, viñetas *, código `, etc.)
 * garantizando que ningún asterisco o carácter de formato crudo llegue a los renderizadores o PDFs.
 */
export function stripMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  return text
    // Encabezados Markdown (# Título)
    .replace(/^#{1,6}\s+/gm, '')
    // Negrita y cursiva combinada ***texto*** o ___texto___
    .replace(/(\*{3}|_{3})(.*?)\1/g, '$2')
    // Negritas **texto** o __texto__
    .replace(/(\*{2}|_{2})(.*?)\1/g, '$2')
    // Cursivas *texto* o _texto_
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Código en línea `código`
    .replace(/`([^`]+)`/g, '$1')
    // Tachado ~~texto~~
    .replace(/~~(.*?)~~/g, '$1')
    // Viñetas iniciales con asterisco (* item -> • item)
    .replace(/^\s*\*\s+/gm, '• ')
    // Cualquier asterisco remanente suelto
    .replace(/\*/g, '')
    .trim();
}

/**
 * Limpia y normaliza texto eliminando marcas de markdown y dobles espacios.
 */
function cleanText(text: string): string {
  return stripMarkdown(text)
    .replace(/_{1,2}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae eventos cronológicos basados en años de 4 dígitos (1500 - 2099).
 *
 * @param text Texto de la misión (historia, contexto, explicación)
 * @returns TimelineEvent[] ordenado cronológicamente (mínimo 2, máximo 5), o []
 */
export function extractYears(text: string): TimelineEvent[] {
  if (!text || typeof text !== 'string') return [];

  const sentences = text.split(/(?<=[.?!;])\s+|\n+/);
  const foundEvents: Map<string, { title: string; description: string }> = new Map();

  const yearRegex = /\b(1[5-9]\d{2}|20[0-2]\d)\b/g;

  for (const sentence of sentences) {
    const clean = cleanText(sentence);
    if (!clean || clean.length < 12) continue;

    const matches = clean.match(yearRegex);
    if (!matches) continue;

    for (const year of matches) {
      if (foundEvents.has(year)) continue;

      // Extraer un resumen contextual de la oración
      // Eliminar el año y palabras conectivas iniciales para el título
      let remainder = clean.replace(new RegExp(`\\b${year}\\b`, 'g'), '').trim();
      remainder = remainder.replace(/^(en|hacia|durante|el año|año|de|con|para|desde|hasta)\s+/i, '');

      const words = remainder.split(/\s+/);
      const title = words.slice(0, 4).join(' ').replace(/[,;:]$/, '');
      const description = words.slice(4, 14).join(' ').replace(/[,;:]$/, '') || remainder.slice(0, 55);

      if (title.length >= 3) {
        foundEvents.set(year, {
          title: title.charAt(0).toUpperCase() + title.slice(1),
          description: description ? description.charAt(0).toUpperCase() + description.slice(1) : `Acontecimiento relevante en ${year}`,
        });
      }
    }
  }

  // Ordenar cronológicamente
  const sortedYears = Array.from(foundEvents.keys()).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  if (sortedYears.length < 2) {
    return [];
  }

  // Tomar hasta 4 o 5 eventos para no saturar la línea de tiempo
  return sortedYears.slice(0, 5).map((yr) => {
    const data = foundEvents.get(yr)!;
    return {
      year: yr,
      title: data.title.slice(0, 24),
      description: data.description.slice(0, 52),
    };
  });
}

/**
 * Extrae pares término-definición para estructurar un mapa conceptual jerárquico.
 *
 * @param text Texto de la misión
 * @param rootConcept Título o tema central para el nodo raíz (nivel 0)
 * @returns { nodes: ConceptNode[], edges: ConceptEdge[] } o { nodes: [], edges: [] }
 */
export function extractTermDefs(
  text: string,
  rootConcept = 'Núcleo Conceptual'
): { nodes: ConceptNode[]; edges: ConceptEdge[] } {
  if (!text || typeof text !== 'string') return { nodes: [], edges: [] };

  const lines = text.split(/\n+/);
  const termDefs: { term: string; def: string }[] = [];

  for (const line of lines) {
    const clean = cleanText(line);
    // Coincidir con "Término: Definición" o "1. Término: Definición" o "- Término: Definición"
    const m = clean.match(/^(?:[-*•\d.]+\s*)?([A-ZÁÉÍÓÚa-záéíóú0-9\s()]{3,35})\s*:\s*(.{8,120})$/);
    if (m) {
      const term = m[1].trim();
      const def = m[2].trim();
      // Filtrar falsos positivos como notas o etiquetas meta
      if (!term.toLowerCase().startsWith('paso') && !term.toLowerCase().startsWith('nota') && !term.toLowerCase().startsWith('ejemplo')) {
        termDefs.push({ term, def });
      }
    }
  }

  // Si no encontró por líneas con dos puntos, buscar patrones "X se define como Y" o "X consiste en Y"
  if (termDefs.length < 2) {
    const sentences = text.split(/(?<=[.?!;])\s+/);
    for (const sent of sentences) {
      const clean = cleanText(sent);
      const mDef = clean.match(/^([A-ZÁÉÍÓÚa-záéíóú\s]{3,30})\s+(?:es|representa|se define como|consiste en)\s+(.{10,90})$/i);
      if (mDef) {
        termDefs.push({ term: mDef[1].trim(), def: mDef[2].trim() });
      }
    }
  }

  if (termDefs.length < 2) {
    return { nodes: [], edges: [] };
  }

  const nodes: ConceptNode[] = [
    { label: rootConcept.slice(0, 26), level: 0 },
  ];
  const edges: ConceptEdge[] = [];

  const maxCategories = Math.min(4, termDefs.length);
  for (let i = 0; i < maxCategories; i++) {
    const item = termDefs[i];
    const catIndex = nodes.length;
    nodes.push({ label: item.term.slice(0, 22), level: 1 });
    edges.push({ from: 0, to: catIndex, label: 'integra' });

    // Si la definición tiene contenido descriptivo, añadir un subnodo nivel 2
    if (item.def && item.def.length >= 8) {
      const subIndex = nodes.length;
      const subwords = item.def.split(/\s+/).slice(0, 4).join(' ');
      nodes.push({ label: subwords.slice(0, 24), level: 2 });
      edges.push({ from: catIndex, to: subIndex, label: 'define' });
    }
  }

  return { nodes, edges };
}

/**
 * Extrae estadísticas porcentuales y sus categorías asociadas.
 *
 * @param text Texto con datos numéricos y %
 * @returns SocialStatItem[] con valores reales (mínimo 2), o []
 */
export function extractPercentStats(text: string): SocialStatItem[] {
  if (!text || typeof text !== 'string') return [];

  const results: SocialStatItem[] = [];
  const clean = cleanText(text);

  const stopWords = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'por', 'con', 'para']);
  const usedValues = new Set<number>();

  // Patrón 1: "más del 42% de los cultivos" o "42% de los cultivos"
  const pattern1 = /(?:más del\s+|casi el\s+|el\s+|un\s+)?(\d{1,3}(?:\.\d+)?)\s*%\s+(?:de\s+|del\s+|en\s+|para\s+)?([A-ZÁÉÍÓÚa-záéíóú0-9\s]{3,35})/g;
  let match: RegExpExecArray | null;

  while ((match = pattern1.exec(clean)) !== null) {
    const val = parseFloat(match[1]);
    const labelRaw = match[2].trim().split(/[,.;:]/)[0];
    const words = labelRaw.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()));
    const labelWords = words.slice(0, 4).join(' ');
    if (val > 0 && val <= 100 && labelWords.length >= 4 && !usedValues.has(val)) {
      usedValues.add(val);
      results.push({
        label: labelWords.charAt(0).toUpperCase() + labelWords.slice(1),
        value: val,
      });
    }
  }

  // Patrón 2: "costo variable: 38%" o "Población rural (21.2%)" (solo si aún no tenemos 5 y el valor no se ha usado)
  const pattern2 = /([A-ZÁÉÍÓÚa-záéíóú\s]{3,30})\s*(?::|\()\s*(\d{1,3}(?:\.\d+)?)\s*%/g;
  while ((match = pattern2.exec(clean)) !== null) {
    const labelRaw = match[1].trim();
    const val = parseFloat(match[2]);
    const words = labelRaw.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()));
    const labelWords = words.slice(0, 4).join(' ');
    if (val > 0 && val <= 100 && labelWords.length >= 4 && !usedValues.has(val)) {
      usedValues.add(val);
      results.push({
        label: labelWords.charAt(0).toUpperCase() + labelWords.slice(1),
        value: val,
      });
    }
  }

  if (results.length < 2) {
    return [];
  }

  // Asignar colores institucionales y acotar a máximo 5
  return results.slice(0, 5).map((item, idx) => ({
    label: item.label.slice(0, 26),
    value: item.value,
    color: STAT_COLORS[idx % STAT_COLORS.length],
  }));
}

/**
 * Extrae secuencias enumeradas de pasos operativos o procedimentales.
 *
 * @param text Texto con instrucciones paso a paso
 * @returns Objeto con pasos técnicos, tareas de Gantt y fases históricas
 */
export function extractEnumSteps(text: string): {
  technicalSteps: TechnicalStep[];
  ganttTasks: GanttTask[];
  historicalSteps: HistoricalStep[];
} {
  const empty = { technicalSteps: [], ganttTasks: [], historicalSteps: [] };
  if (!text || typeof text !== 'string') return empty;

  const lines = text.split(/\n+/);
  const rawSteps: string[] = [];

  for (const line of lines) {
    const clean = cleanText(line);
    // Detecta: "Paso 1: ...", "1. ...", "1) ...", "Fase 1: ..."
    const m = clean.match(/^(?:paso\s*\d+|fase\s*\d+|\d+[.)])\s*:?\s*(.{6,140})$/i);
    if (m) {
      rawSteps.push(m[1].trim());
    }
  }

  if (rawSteps.length < 2) {
    return empty;
  }

  const limitedSteps = rawSteps.slice(0, 4);

  // 1. TechnicalSteps
  const technicalSteps: TechnicalStep[] = limitedSteps.map((s, idx) => {
    const words = s.split(/\s+/);
    const instruction = words.slice(0, 7).join(' ');
    const checkText = words.length > 7 ? `Check: ${words.slice(7, 12).join(' ')}` : 'Check: Verificado';
    return {
      step: `Paso ${idx + 1}`,
      instruction: instruction.slice(0, 40),
      qualityCheck: checkText.slice(0, 26),
    };
  });

  // 2. GanttTasks
  const ganttTasks: GanttTask[] = limitedSteps.map((s, idx) => {
    return {
      name: `Fase ${idx + 1}: ${s.slice(0, 22)}`,
      startWeek: idx + 1,
      durationWeeks: idx === limitedSteps.length - 1 ? 2 : 1,
      color: GANTT_COLORS[idx % GANTT_COLORS.length],
      responsible: 'Equipo / Estudiante',
    };
  });

  // 3. HistoricalSteps (Causal)
  const phases = ['Antecedentes', 'Detonante', 'Desarrollo', 'Consecuencia'];
  const historicalSteps: HistoricalStep[] = limitedSteps.map((s, idx) => {
    return {
      phase: phases[idx] || `Etapa ${idx + 1}`,
      title: s.slice(0, 24),
      detail: s.length > 24 ? s.slice(24, 65) : 'Impacto en el proceso social',
    };
  });

  return { technicalSteps, ganttTasks, historicalSteps };
}

/**
 * Extrae requerimientos de seguridad, normas y equipo de protección.
 *
 * @param text Texto con posibles normas y medidas de seguridad
 * @returns SafetyCheck[] (mínimo 2) o []
 */
export function extractSafetyChecks(text: string): SafetyCheck[] {
  if (!text || typeof text !== 'string') return [];

  const checks: SafetyCheck[] = [];
  const lines = text.split(/(?<=[.?!;\n])\s+/);

  const keywords = [
    { kw: 'epp', cat: 'Equipo de Protección (EPP)', std: 'NOM-017-STPS', lvl: 'critico' as const },
    { kw: 'seguridad', cat: 'Protocolo de Seguridad', std: 'NOM-001-STPS', lvl: 'precaucion' as const },
    { kw: 'nom-', cat: 'Normativa Oficial Mexicana', std: 'NOM Oficial', lvl: 'critico' as const },
    { kw: 'riesgo', cat: 'Prevención de Riesgos', std: 'Seguridad Integral', lvl: 'precaucion' as const },
    { kw: 'aislamiento', cat: 'Protección Técnica', std: 'NOM-029-STPS', lvl: 'critico' as const },
    { kw: 'limpieza', cat: 'Orden y Limpieza', std: '5S / Buenas Prácticas', lvl: 'informativo' as const },
  ];

  for (const line of lines) {
    const clean = cleanText(line);
    const lower = clean.toLowerCase();

    for (const item of keywords) {
      if (lower.includes(item.kw) && !checks.some((c) => c.category === item.cat)) {
        checks.push({
          category: item.cat,
          requirement: clean.slice(0, 60),
          standard: item.std,
          level: item.lvl,
        });
        break;
      }
    }
  }

  return checks.length >= 2 ? checks.slice(0, 4) : [];
}

/**
 * Extrae bloques funcionales o módulos de un sistema técnico (Entrada -> Proceso -> Salida / Retroalimentación).
 *
 * @param text Texto con descripciones de componentes o arquitectura
 * @returns SystemBlock[] (mínimo 3) o []
 */
export function extractSystemBlocks(text: string): SystemBlock[] {
  if (!text || typeof text !== 'string') return [];

  const clean = cleanText(text);
  const blocks: SystemBlock[] = [];

  // Buscar menciones de Entrada / Captura / Sensores
  const inputMatch = clean.match(/(?:entrada|sensores|captura|input|fuente)\s*(?::|de|con)?\s*([A-ZÁÉÍÓÚa-záéíóú0-9\s]{4,35})/i);
  if (inputMatch) {
    blocks.push({
      title: 'Entrada / Sensores',
      subtitle: inputMatch[1].trim().slice(0, 32),
      role: 'input',
    });
  }

  // Buscar menciones de Proceso / Control / Algoritmo
  const processMatch = clean.match(/(?:proceso|controlador|procesador|unidad central|microcontrolador|algoritmo|lógica|control)\s*(?::|de|con)?\s*([A-ZÁÉÍÓÚa-záéíóú0-9\s]{4,35})/i);
  if (processMatch) {
    blocks.push({
      title: 'Núcleo de Control',
      subtitle: processMatch[1].trim().slice(0, 32),
      role: 'process',
    });
  }

  // Buscar menciones de Salida / Actuadores / Display
  const outputMatch = clean.match(/(?:salida|actuador|display|pantalla|indicador|output|ejecución)\s*(?::|de|con)?\s*([A-ZÁÉÍÓÚa-záéíóú0-9\s]{4,35})/i);
  if (outputMatch) {
    blocks.push({
      title: 'Salida / Actuadores',
      subtitle: outputMatch[1].trim().slice(0, 32),
      role: 'output',
    });
  }

  // Buscar Retroalimentación / Monitoreo
  const feedbackMatch = clean.match(/(?:retroalimentación|feedback|monitoreo|verificación|ajuste)\s*(?::|de|con)?\s*([A-ZÁÉÍÓÚa-záéíóú0-9\s]{4,35})/i);
  if (feedbackMatch && blocks.length >= 2) {
    blocks.push({
      title: 'Retroalimentación',
      subtitle: feedbackMatch[1].trim().slice(0, 32),
      role: 'control',
    });
  }

  return blocks.length >= 3 ? blocks : [];
}

export interface GlossaryItem {
  term: string;
  definition: string;
}

/**
 * Extrae 3 a 5 términos clave de la explicación conceptual de la misión
 * (palabras en negrita Markdown **término** o mayúsculas sostenidas / etiquetas con dos puntos)
 * junto con su oración de contexto recortada a un máximo de 120 caracteres.
 *
 * Regla de Oro V4:
 * Si no hay suficientes términos detectables (menos de 2), retorna null (no inventa relleno).
 *
 * @param text Texto del coreExplanation o concepto cero
 * @returns GlossaryItem[] o null
 */
export function extractGlossaryTerms(text: string): GlossaryItem[] | null {
  if (!text || typeof text !== 'string') return null;

  const results: GlossaryItem[] = [];
  const seenTerms = new Set<string>();

  const ignoreWords = new Set([
    'nota', 'paso', 'fase', 'ejemplo', 'tip', 'actividad', 'instrucción', 'instrucciones',
    'importante', 'atención', 'advertencia', 'desafío', 'pregunta', 'objetivo', 'eje',
    'propósito', 'misión', 'sesión', 'bloque', 'uac', 'mccems', 'rúbrica', 'taller',
    'introducción', 'conclusión', 'resumen', 'recordatorio'
  ]);

  const sentences = text.split(/(?<=[.?!;\n])\s+/);

  for (const sentence of sentences) {
    const rawSentence = sentence.trim();
    if (!rawSentence) continue;

    // Caso 1.1: **Término**: Definición en la misma oración
    const boldColonMatch = rawSentence.match(/\*\*([^*]{3,40})\*\*\s*:\s*(.{8,200})/);
    if (boldColonMatch) {
      const termCandidate = boldColonMatch[1].trim();
      const defCandidate = boldColonMatch[2].trim();
      const normTerm = termCandidate.toLowerCase();

      if (!ignoreWords.has(normTerm) && !seenTerms.has(normTerm) && termCandidate.length >= 3) {
        seenTerms.add(normTerm);
        const cleanDef = cleanText(defCandidate);
        const truncatedDef = cleanDef.length > 120
          ? cleanDef.slice(0, 117).replace(/\s+\S*$/, '') + '...'
          : cleanDef;

        results.push({
          term: cleanText(termCandidate),
          definition: truncatedDef,
        });
        continue;
      }
    }

    // Caso 1.2: **Término** inmerso en la oración
    const boldMatches = Array.from(rawSentence.matchAll(/\*\*([^*]{3,40})\*\*/g));
    for (const bm of boldMatches) {
      const termCandidate = bm[1].trim();
      const normTerm = termCandidate.toLowerCase();
      if (!ignoreWords.has(normTerm) && !seenTerms.has(normTerm) && termCandidate.length >= 3) {
        seenTerms.add(normTerm);
        const cleanSent = cleanText(rawSentence);
        const truncatedDef = cleanSent.length > 120
          ? cleanSent.slice(0, 117).replace(/\s+\S*$/, '') + '...'
          : cleanSent;

        results.push({
          term: cleanText(termCandidate),
          definition: truncatedDef,
        });
        break;
      }
    }
  }

  // Estrategia 2: Mayúsculas sostenidas tipo TÉRMINO: Definición
  if (results.length < 5) {
    const lines = text.split(/\n+/);
    for (const line of lines) {
      const cleanLine = line.trim();
      const capsColonMatch = cleanLine.match(/^(?:[-*•\d.]+\s*)?([A-ZÁÉÍÓÚÑ]{3,28})\s*:\s*(.{10,180})$/);
      if (capsColonMatch) {
        const termCandidate = capsColonMatch[1].trim();
        const defCandidate = capsColonMatch[2].trim();
        const normTerm = termCandidate.toLowerCase();

        if (!ignoreWords.has(normTerm) && !seenTerms.has(normTerm)) {
          seenTerms.add(normTerm);
          const cleanDef = cleanText(defCandidate);
          const truncatedDef = cleanDef.length > 120
            ? cleanDef.slice(0, 117).replace(/\s+\S*$/, '') + '...'
            : cleanDef;

          results.push({
            term: cleanText(termCandidate),
            definition: truncatedDef,
          });
        }
      }
    }
  }

  // Estrategia 3: Término en formato Title Case: Definición
  if (results.length < 3) {
    const lines = text.split(/\n+/);
    for (const line of lines) {
      const cleanLine = line.trim();
      const titleColonMatch = cleanLine.match(/^(?:[-*•\d.]+\s*)?([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñ\s]{2,28})\s*:\s*(.{12,180})$/);
      if (titleColonMatch) {
        const termCandidate = titleColonMatch[1].trim();
        const defCandidate = titleColonMatch[2].trim();
        const normTerm = termCandidate.toLowerCase();

        if (!ignoreWords.has(normTerm) && !seenTerms.has(normTerm) && !termCandidate.toLowerCase().startsWith('paso')) {
          seenTerms.add(normTerm);
          const cleanDef = cleanText(defCandidate);
          const truncatedDef = cleanDef.length > 120
            ? cleanDef.slice(0, 117).replace(/\s+\S*$/, '') + '...'
            : cleanDef;

          results.push({
            term: cleanText(termCandidate),
            definition: truncatedDef,
          });
        }
      }
    }
  }

  // Si no hay al menos 2 términos reales detectados, retorna null
  if (results.length < 2) {
    return null;
  }

  return results.slice(0, 5);
}

/**
 * Deduplica un conjunto de activos multimedia Openverse por externalId o imageUrl.
 * Garantiza que cada fotografía única se atribuya una sola vez en la página de créditos.
 */
export function deduplicateMediaAssets(assets: ImageAsset[]): ImageAsset[] {
  const seen = new Set<string>();
  const unique: ImageAsset[] = [];
  for (const asset of assets) {
    const key = (asset.externalId && asset.externalId.trim()) || (asset.imageUrl && asset.imageUrl.trim()) || asset.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(asset);
  }
  return unique;
}

// ── Extractores V6: Pedagogía de Vida Diaria ────────────────────────────────
// REGLA: 0 tokens LLM, 100% deterministas, retornan null si no detectan suficientes datos reales.

/**
 * Extrae una conexión real con la vida diaria del estudiante desde el texto de la misión.
 * Detecta actividades concretas del hogar, taller, comunidad o escuela.
 * Retorna null si el texto no tiene suficiente contenido real (< 80 chars de contexto).
 */
export function extractRealLifeConnection(
  missionText: string,
  uacName: string
): { context: string; householdApplication: string; communityImpact: string } | null {
  if (!missionText || missionText.trim().length < 80) return null;

  const clean = cleanText(missionText);

  // Patrones de aplicaciones cotidianas concretas (verbos de acción con objetos reales)
  const householdKeywords = [
    /(?:en\s+(?:tu|el|la|su)\s+)?(?:casa|hogar|cocina|baño|taller|cuarto|jardín|patio|colonia|comunidad|municipio|escuela|plantel|trabajo)/gi,
    /(?:mide|calcula|registra|identifica|entrevista|observa|diagnostica|elabora|construye|diseña|aplica)\s+\w+/gi,
    /(?:consumo|gasto|temperatura|voltaje|presión|caudal|velocidad|peso|distancia|tiempo)\s+\w+/gi,
  ];

  // Detectar frases con palabras de aplicación cotidiana
  const sentences = clean.split(/[.!?;]/g).filter(s => s.trim().length > 20);
  const contextSentences: string[] = [];
  const appSentences: string[] = [];

  for (const sent of sentences) {
    const isHousehold = householdKeywords.some(rx => rx.test(sent));
    if (isHousehold) {
      if (appSentences.length === 0) appSentences.push(sent.trim());
      else contextSentences.push(sent.trim());
    }
  }

  // Si no detecta aplicaciones concretas, generar desde el contexto de la UAC
  const uacClean = uacName.replace(/\s+(I|II|III|IV|V|VI)$/i, '').trim();
  const contextStr = contextSentences[0] ||
    clean.slice(0, 120).replace(/\s+\S*$/, '') + '...';

  const appStr = appSentences[0] || null;
  if (!appStr || appStr.length < 15) return null;

  // Construir impacto comunitario
  const communityImpact = `Aplica los conceptos de ${uacClean} para identificar, diagnosticar o mejorar una situación real en tu colonia, escuela o comunidad local.`;

  return {
    context: contextStr.slice(0, 180),
    householdApplication: appStr.slice(0, 200),
    communityImpact: communityImpact.slice(0, 200),
  };
}

/**
 * Sintetiza 3 preguntas de diagnóstico de saberes previos desde el texto de la misión.
 * Las preguntas son situadas en la experiencia cotidiana del alumno.
 * Retorna null si no hay suficiente texto para generar preguntas válidas (< 100 chars).
 */
export function extractDiagnosticQuestions(
  missionText: string,
  uacName: string
): { context: string; questions: string[] } | null {
  if (!missionText || missionText.trim().length < 100) return null;

  const clean = cleanText(missionText);
  const uacClean = uacName.replace(/\s+(I|II|III|IV|V|VI)$/i, '').trim();

  // Extraer los primeros términos clave del texto (negritas, mayúsculas, o con ":")
  const boldTerms: string[] = [];
  const boldMatches = missionText.matchAll(/\*\*([^*]{3,35})\*\*/g);
  for (const m of boldMatches) {
    if (boldTerms.length < 3) boldTerms.push(m[1].trim());
  }

  const capsMatches = clean.matchAll(/\b([A-ZÁÉÍÓÚÑ]{4,20})\b/g);
  for (const m of capsMatches) {
    const term = m[1];
    if (!boldTerms.includes(term) && boldTerms.length < 4) {
      boldTerms.push(term.charAt(0) + term.slice(1).toLowerCase());
    }
  }

  // No hay términos detectables
  if (boldTerms.length === 0) return null;

  const firstTerm = boldTerms[0] || uacClean;
  const secondTerm = boldTerms[1] || 'este tema';
  const thirdTerm = boldTerms[2] || 'estas ideas';

  const contextStr = `Antes de comenzar esta misión, reflexiona brevemente sobre lo que ya sabes de "${firstTerm}" y su presencia en tu vida cotidiana.`;

  const questions: string[] = [
    `¿Has observado o experimentado algo relacionado con "${firstTerm}" en tu casa, comunidad o entorno escolar? Describe brevemente qué has visto o vivido.`,
    `¿Qué crees que significa "${secondTerm}" y para qué crees que sirve en la vida real o en el trabajo?`,
    `Si tuvieras que explicarle "${thirdTerm}" a un familiar o amigo con palabras sencillas, ¿qué le dirías?`,
  ];

  return { context: contextStr, questions };
}

/**
 * Extrae un tip técnico o de seguridad operativa de alta prioridad desde el texto de la misión.
 * Prioriza advertencias de normas NOM, seguridad eléctrica, química, o claves de rigor metodológico.
 * Retorna null si no detecta un tip real con suficiente contenido.
 */
export function extractSafetyOrCriticalTip(
  missionText: string,
  subsystem: string = 'bge'
): string | null {
  if (!missionText || missionText.trim().length < 50) return null;

  const clean = cleanText(missionText);
  const sentences = clean.split(/[.!?;]/g).filter(s => s.trim().length > 20);

  // Patrones de seguridad y rigor técnico de alta prioridad
  const safetyPatterns = [
    /\b(?:NOM|ISO|OSHA|IEC|IEEE)\b/i,
    /\b(?:seguridad|precaución|advertencia|peligro|riesgo|ESD|electroestát|descargas?)\b/i,
    /\b(?:nunca|siempre|obligatorio|imprescindible|critical|evit[ae])\b/i,
    /\b(?:norma|estándar|protocolo|procedimiento)\s+\w+/i,
    /\b(?:verificar|comprobar|confirmar|revisar)\s+(?:antes|siempre|primero)\b/i,
  ];

  for (const sent of sentences) {
    const hasSafety = safetyPatterns.some(p => p.test(sent));
    if (hasSafety && sent.trim().length >= 30) {
      return sent.trim().slice(0, 200);
    }
  }

  // Para subsistema BT (técnico), generar tip de seguridad contextualizado
  if (subsystem?.toLowerCase() === 'bt') {
    const hasEquipment = /\b(?:equipo|herramienta|instrumento|dispositivo|circuito|cable|fusible|voltaje|corriente)\b/i.test(clean);
    if (hasEquipment) {
      return 'Antes de manipular cualquier equipo o circuito: desconecta la alimentación, verifica con multímetro que no hay tensión residual, y usa equipo de protección personal (EPP) apropiado.';
    }
  }

  return null;
}

/**
 * Construye los descriptores del Semáforo de Aprendizaje Metacognitivo para una misión.
 * Los tres descriptores son situados en la vida diaria del estudiante.
 * Nunca retorna null — siempre genera semáforo genérico válido.
 */
export function buildMetacognitiveTrafficLight(
  missionTitle: string,
  uacName: string
): { green: string; yellow: string; red: string } {
  const titleClean = missionTitle.replace(/^misi[oó]n\s*\d+\s*:\s*/i, '').trim().slice(0, 50);
  const uacClean = uacName.replace(/\s+(I|II|III|IV|V|VI)$/i, '').trim().slice(0, 40);

  return {
    green: `Comprendo ${titleClean} con claridad. Puedo explicarlo y aplicarlo en situaciones reales de mi comunidad o trabajo sin ayuda.`,
    yellow: `Entiendo los conceptos principales de ${uacClean}, pero necesito más práctica o un ejemplo adicional para aplicarlos con confianza.`,
    red: `Tengo dudas sobre ${titleClean}. Requiero asesoría del docente, revisar el Concepto Cero o practicar con un compañero antes de continuar.`,
  };
}




