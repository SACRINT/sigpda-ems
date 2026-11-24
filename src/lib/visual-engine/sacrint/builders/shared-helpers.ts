import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import { hasDanglingEnding, repairDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import {
  extractDisciplinaryConceptPhrase,
  isPaecProjectOrArtifactTitle,
  sanitizeWorkbookTocTitle,
} from '@/lib/editorial/topic-title-resolver';
import { classifyTopic } from '@/lib/visual-engine/topic-classifier';
import type { SacrintPack } from '../discipline-packs';
import type {
  DistilledLessonBundle,
  SacrintBuildOptions,
  SacrintFact,
  SacrintMissionMeta,
} from '../types';
import {
  cleanSacrintText,
  isRubricOrBoilerplateLeak,
  sanitizePedagogicalMetaPhrases,
} from '../text/grammar-normalization';
import {
  distillConciseText,
  extractCleanTopicTitle,
} from '../text/objective-and-activity-guards';

export function splitLabeledItems(value: string | null | undefined, label: 'PASO' | 'Instrucción', max: number): string[] {
  const text = cleanSacrintText(value);
  if (!text || isRubricOrBoilerplateLeak(text)) return [];
  const marker = new RegExp(`\\b${label}\\s*\\d+\\s*[:.-]`, 'i');
  const firstMarker = text.search(marker);
  if (firstMarker < 0) return [];
  return text
    .slice(firstMarker)
    .split(new RegExp(`\\s*(?=\\b${label}\\s*\\d+\\s*[:.-])`, 'i'))
    .map((part) => cleanSacrintText(part.replace(new RegExp(`^${label}\\s*\\d+\\s*[:.-]\\s*`, 'i'), '')))
    .filter((part) => Boolean(part) && !isRubricOrBoilerplateLeak(part))
    .map((part) => distillConciseText(part, 210, 34))
    .filter(Boolean)
    .slice(0, max);
}

export function firstSentence(value: string | null | undefined): string {
  const text = cleanSacrintText(value);
  if (!text) return '';
  const end = text.search(/[.!?](?:\s|$)/);
  return end === -1 ? text : text.slice(0, end + 1).trim();
}

export function stripMissionPrefix(title: string | null | undefined): string {
  const stripped = cleanSacrintText(title).replace(/^misi[oó]n\s*\d+\s*:\s*/i, '').trim();
  const sessionSplit = stripped.split(/\s*—\s*sesi[oó]n\s*\d+/i);
  if (sessionSplit.length > 1 && sessionSplit[0].length >= 8) {
    return sessionSplit[0].trim();
  }
  return stripped;
}

export function cleanSlideTitle(value: string | null | undefined): string {
  const text = stripMissionPrefix(value)
    .replace(/\s*—\s*Categor[ií]as?:.*$/i, '')
    .replace(/\s*\|\s*Categor[ií]as?:.*$/i, '')
    .replace(/\s*—\s*Subcategor[ií]as?:.*$/i, '')
    .replace(/\s*\|\s*Subcategor[ií]as?:.*$/i, '')
    .trim();
  return extractCleanTopicTitle(text, text);
}

export function sessionsLabel(mission: MissionSection): string {
  const covered = mission.coveredSessions ?? [];
  if (covered.length === 0) return '—';
  if (covered.length === 1) return String(covered[0]).padStart(2, '0');
  return `${String(covered[0]).padStart(2, '0')}–${String(covered[covered.length - 1]).padStart(2, '0')}`;
}

export function missionMeta(workbook: ActiveWorkTextbook, mission: MissionSection, pack: SacrintPack): SacrintMissionMeta {
  const cover = workbook.coverData;
  const dedupedBlockName = (workbook.blockName || `Bloque ${(workbook.blockIndex ?? 0) + 1}`)
    .replace(/^(Bloque\s+\d+\s*\(Corte\s*\d+\))\s*:\s*\1$/i, '$1');
  const rawMissionTitle = sanitizePedagogicalMetaPhrases(
    sanitizeWorkbookTocTitle(mission.title, mission.sessionTopic)
  );
  const cleanedTopic = sanitizePedagogicalMetaPhrases(
    extractCleanTopicTitle(rawMissionTitle, mission.sessionTopic)
  );
  return {
    subjectName: cleanSacrintText(cover?.subjectName || pack.label),
    blockName: cleanSacrintText(dedupedBlockName),
    blockNumber: cover?.blockNumber ?? (workbook.blockIndex ?? 0) + 1,
    semester: cover?.semester ?? 1,
    missionNumber: mission.missionIndex || 1,
    missionTitle: fitPedagogicalText(rawMissionTitle || cleanedTopic || `Misión ${mission.missionIndex || 1}`, {
      maxChars: 74,
      maxWords: 11,
      role: 'concept',
      ensurePeriod: false,
    }),
    sessions: sessionsLabel(mission),
    teacherName: cleanSacrintText(cover?.teacherName || 'Docente'),
    schoolName: cleanSacrintText(cover?.schoolName || 'Plantel EMS'),
    cct: cleanSacrintText(cover?.cct || ''),
    paecProjectName: cleanSacrintText(cover?.paecProjectName || ''),
  };
}

export function baseFacts(meta: SacrintMissionMeta, mission: MissionSection, sessionNumber?: number | null): SacrintFact[] {
  return [
    { label: 'MISIÓN', value: String(meta.missionNumber).padStart(2, '0') },
    {
      label: sessionNumber ? 'SESIÓN' : 'SESIONES',
      value: sessionNumber ? String(sessionNumber).padStart(2, '0') : meta.sessions,
    },
    { label: 'BLOQUE', value: String(meta.blockNumber).padStart(2, '0') },
    { label: 'CRITERIOS', value: String(mission.formativeCheckpoint?.criteriaChecklist?.length || 0).padStart(2, '0') },
  ];
}

export function selectMission(workbook: ActiveWorkTextbook, options: SacrintBuildOptions): MissionSection {
  const missions = workbook.missions ?? [];
  const index = Math.max(0, Math.min(options.missionIndex ?? 0, missions.length - 1));
  return missions[index] ?? missions[0] ?? ({
    missionIndex: 1,
    title: workbook.blockName || workbook.coverData?.title || 'Misión 1',
    coveredSessions: [1],
    sessionTopic: workbook.blockName || workbook.coverData?.subjectName || 'Sesión situada',
    sessionFocus: workbook.coverData?.subtitle || 'Desarrollo situado del bloque',
    phenomenonHook: {
      story: 'Situación contextualizada del entorno escolar y comunitario.',
      detonatingQuestion: '¿Cómo aplicar los saberes del bloque en nuestro contexto?',
    },
    conceptZero: {
      physicalAnalogy: 'Modelo conceptual de referencia.',
      coreExplanation: 'Fundamentación disciplinar del bloque.',
      contrastTable: [],
      solvedExample: { problemStatement: '', solutionSteps: [], interpretation: '' },
    },
    iDoSection: { stepByStepDemo: 'Demostración guiada del docente.' },
    weDoSection: { guidedPractice: 'Práctica colaborativa en aula.', workbookElements: [] },
    youDoSection: { autonomousChallenge: 'Reto autónomo de aplicación.', projectConnection: '' },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Qué aprendimos hoy?',
      criteriaChecklist: ['Cumple con los criterios del bloque.'],
      reflectionPrompts: ['¿Cómo lo aplico en mi comunidad?'],
    },
    metacognitiveTrafficLight: {
      green: 'Domino el contenido.',
      yellow: 'Requiero práctica adicional.',
      red: 'Necesito apoyo docente.',
    },
  } as unknown as MissionSection);
}

export function resolveSessionPlans(mission: MissionSection): SessionPlan[] {
  const plans = mission.sessionPlans ?? [];
  return [...plans].sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0));
}

export function stripLeadingSessionTag(value: string): string {
  let out = cleanSacrintText(value);
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/^(?:sesi[oó]n\s*\d+\s*[:.\-–—]*\s*)/i, '').trim();
  }
  return out;
}

const INVALID_CONCEPT_ANCHOR_RE =
  /^(?:vas\s+a|vamos\s+a|aprender|evaluar|integrar|optimizar|depurar|validar|construir|realizar|socializar|defender|explorar|aplicar|resolver)\b/i;

export function extractShortConceptAnchor(topicTitle?: string, fallback?: string): string {
  const candidates = [topicTitle, fallback]
    .map((raw) => extractDisciplinaryConceptPhrase(stripLeadingSessionTag(raw || '')))
    .map((cleaned) =>
      cleaned
        .replace(/^(?:taller\s+de\s+|introducci[oó]n\s+a(?:l|\s+la)?\s+|fundamentos\s+de\s+)/i, '')
        .trim()
    )
    .filter((cleaned) => cleaned.length >= 6 && !INVALID_CONCEPT_ANCHOR_RE.test(cleaned) && !isPaecProjectOrArtifactTitle(cleaned));

  const cleaned = candidates[0] || '';
  if (!cleaned) return '';
  const headClause = cleaned.includes(':') ? cleaned.split(':')[0]!.trim() : cleaned;
  const source = headClause.length >= 10 ? headClause : cleaned;
  const rawWords = source
    .replace(/[¿?¡!.:;,]+$/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  while (
    rawWords.length > 2 &&
    /^(?:de|del|la|el|los|las|un|una|en|con|por|para|sobre|entre|dentro|y|e|o|a|al|su|sus)$/i.test(
      rawWords[rawWords.length - 1]!
    )
  ) {
    rawWords.pop();
  }
  let candidate = rawWords.join(' ').trim();
  if (candidate.length > 32) {
    candidate = candidate.slice(0, 32).replace(/\s+\S*$/, '').trim();
  }
  const repaired = repairDanglingEnding(candidate, false).replace(/[¿?¡!.:;,]+$/g, '').trim();
  return INVALID_CONCEPT_ANCHOR_RE.test(repaired) ? '' : repaired;
}

export function resolveMissionMisconceptionParts(
  mission: MissionSection,
  bundle?: DistilledLessonBundle,
  options: { session?: SessionPlan; allowMissionFallback?: boolean } = {}
): { error: string; correction: string } {
  const visualMap = options.session?.sintesisVisual?.mapaConceptual;
  const visualError = sanitizePedagogicalMetaPhrases(cleanSacrintText(visualMap?.errorComun));
  if (visualError && !isRubricOrBoilerplateLeak(visualError)) {
    const visualCorrection = sanitizePedagogicalMetaPhrases(cleanSacrintText(visualMap?.correccionBreve));
    return {
      error: visualError,
      correction:
        visualCorrection && !isRubricOrBoilerplateLeak(visualCorrection)
          ? visualCorrection
          : 'Contrastar cada afirmación con evidencia y criterios explícitos de la sesión.',
    };
  }
  const allowMission = options.allowMissionFallback ?? true;
  if (allowMission) {
    const firstRow = mission.conceptZero?.contrastTable?.[0];
    if (firstRow?.commonMisconception && !isRubricOrBoilerplateLeak(firstRow.commonMisconception)) {
      return {
        error: distillConciseText(cleanSacrintText(firstRow.commonMisconception), 140, 22),
        correction:
          distillConciseText(cleanSacrintText(firstRow.correctConcept), 120, 18) ||
          'Validar cada paso con la información relevante y el criterio de la clase.',
      };
    }
  }

  const classifierInput = allowMission
    ? {
        title: mission.title,
        topic: mission.sessionTopic,
        objective: bundle?.objective,
        concepts: mission.conceptZero?.coreExplanation,
        example: mission.iDoSection?.stepByStepDemo,
        bodyText: bundle?.topicTitle,
      }
    : {
        title: bundle?.topicTitle,
        topic: bundle?.objective,
        objective: options.session?.objetivo,
        concepts: options.session?.contenido,
        example: options.session?.ejemploResuelto,
      };
  const contextText = Object.values(classifierInput).filter(Boolean).join(' ').trim();
  const classification = classifyTopic(classifierInput);
  const sessionIdx = Math.max(0, (options.session?.sessionNumber ?? 1) - 1);
  const rawAnchor = extractShortConceptAnchor(bundle?.topicTitle, options.session?.objetivo)
    .replace(/[¿?¡!.:;,]+$/g, '')
    .trim();
  const anchor = rawAnchor;

  const primaryContextText = [
    bundle?.topicTitle,
    options.session?.objetivo,
    options.session?.contenido,
    allowMission ? mission.sessionTopic : undefined,
    allowMission ? mission.title : undefined,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const withAnchor = (chosen: { error: string; correction: string }): { error: string; correction: string } => {
    if (allowMission || !anchor || INVALID_CONCEPT_ANCHOR_RE.test(anchor)) return chosen;
    // Anclas vacías, explícitamente genéricas o colgadas no son un tema real.
    // NOTA: No usar isGenericMisconception() directamente porque su umbral length<25
    // rechaza anclas cortas pero conceptualmente específicas (ej. "margen de error").
    // En su lugar comprobamos: ancla trivialmente corta (<8 chars) O frases genéricas
    // por regex O patrones de colgado.
    const anchorIsVagueGeneric =
      anchor.length < 8 ||
      /^(?:definir|analizar|resolver|explorar|comprender|aplicar|identificar|reconocer|explicar|calcular|determinar|modelar|interpretar|evaluar|comparar|justificar|construir|elaborar|realizar|profundizar|estudiar|describir)\b/i.test(
        anchor
      ) ||
      /^(?:resultados?\s+obtenidos|error\s+com[uú]n|revisar|analizar|evaluar|comprobar|verificar)\b/i.test(anchor);
    if (
      anchorIsVagueGeneric ||
      /^(?:resultados?|procedimiento|proceso)\b/i.test(anchor) ||
      /\b(?:al|para|de|por)\s+[a-záéíóúñ]+(?:ar|er|ir)$/i.test(anchor) ||
      hasDanglingEnding(anchor)
    ) {
      return chosen;
    }
    const base = chosen.error.replace(/\.+$/, '').trim();
    if (base.toLowerCase().includes(anchor.toLowerCase())) {
      return { error: `${base}.`, correction: chosen.correction };
    }
    const lowerFirst = base.charAt(0).toLowerCase() + base.slice(1);
    return {
      error: `${anchor}: ${lowerFirst}.`,
      correction: chosen.correction,
    };
  };

  const pickByKeywordAndSession = (
    subRules: Array<{ pattern: RegExp; error: string; correction: string }>,
    variants: Array<{ error: string; correction: string }>
  ): { error: string; correction: string } => {
    const countMatches = (pattern: RegExp, text: string): number => {
      if (!text) return 0;
      const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
      return text.match(new RegExp(pattern.source, flags))?.length ?? 0;
    };
    const primaryMatched = subRules.filter((rule) => rule.pattern.test(primaryContextText));
    const matched =
      primaryMatched.length > 0
        ? primaryMatched
        : subRules.filter((rule) => rule.pattern.test(contextText));
    const scored = matched
      .map((rule, index) => ({
        rule,
        index,
        score:
          countMatches(rule.pattern, primaryContextText) * 5 +
          countMatches(rule.pattern, contextText) * 2 +
          (rule.pattern.source.match(/\|/g)?.length ?? 0),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    // Mantener variedad entre sesiones sin perder relevancia: rota entre las
    // mejores reglas aplicables en lugar de repetir siempre la misma.
    const pool = scored.slice(0, Math.min(4, scored.length));
    const chosen = pool[sessionIdx % pool.length]?.rule ?? variants[sessionIdx % variants.length]!;
    return withAnchor(chosen);
  };

  if (classification.kind === 'exponential') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /poblaci[oó]n|crecimiento|bacteri|duplic/i,
          error: 'Sumar un incremento fijo en lugar de factor exponencial.',
          correction: 'Aplicar P(t) = P₀(1 + r)ᵗ sobre el total vigente de cada periodo.',
        },
        {
          pattern: /depreciaci[oó]n|descuento|p[eé]rdida|decaimiento/i,
          error: 'Usar (1 + r)ᵗ en lugar del factor de reducción (1 - r)ᵗ.',
          correction: 'Verificar si la magnitud crece o decrece antes de fijar el signo de la tasa.',
        },
      ],
      [
        {
          error: 'Multiplicar tasa por periodos como si fuera lineal.',
          correction: 'Aplicar la potencia (1 + r)ᵗ sobre el capital acumulado en cada periodo.',
        },
        {
          error: 'Usar tasa anual sin ajustar al periodo de capitalización.',
          correction: 'Homologar la unidad temporal de la tasa r y del exponente t antes de calcular.',
        },
        {
          error: 'Sustituir porcentaje entero sin convertir a decimal.',
          correction: 'Convertir r% a decimal (r/100) antes de elevar el binomio (1 + r)ᵗ.',
        },
        {
          error: 'Confundir valor final compuesto con ganancia neta.',
          correction: 'Restar el capital inicial C₀ al monto M cuando se pida solo el interés ganado.',
        },
      ]
    );
  }
  if (classification.kind === 'statistics') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /margen de error|intervalo de confianza/i,
          error: 'Usar el margen de error porcentual sin pasarlo a decimal.',
          correction: 'Expresar el margen como decimal (ej. 5% = 0.05) y verificar el tamaño muestral.',
        },
        {
          pattern: /muestra|encuesta|poblaci[oó]n/i,
          error: 'Generalizar desde una muestra sesgada o insuficiente.',
          correction: 'Definir tamaño muestral representativo y criterios homogéneos de recolección.',
        },
        {
          pattern: /frecuencia|tabula|tabla/i,
          error: 'Contar frecuencias aisladas sin verificar el total n.',
          correction: 'Sumar las frecuencias absolutas y comprobar que coincidan con el tamaño n.',
        },
        {
          pattern: /promedio|media|mediana|moda|desviaci[oó]n/i,
          error: 'Calcular mediana sin ordenar previamente los datos.',
          correction: 'Ordenar el conjunto, revisar valores atípicos y elegir la medida representativa.',
        },
      ],
      [
        {
          error: 'Leer frecuencias aisladas sin compararlas al total.',
          correction: 'Calcular proporciones relativas y verificar que las frecuencias sumen el total.',
        },
        {
          error: 'Inferir causalidad directa desde una correlación simple.',
          correction: 'Distinguir asociación estadística de relación causa-efecto con evidencia contextual.',
        },
        {
          error: 'Omitir valores atípicos al interpretar el promedio.',
          correction: 'Contrastar media, mediana y rango para describir la dispersión real.',
        },
        {
          error: 'Comparar categorías con tamaños muestrales distintos sin proporción.',
          correction: 'Normalizar mediante porcentajes o frecuencias relativas sobre cada grupo.',
        },
      ]
    );
  }
  if (classification.kind === 'quadratic') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /discriminante|b\^?2\s*-\s*4ac|f[oó]rmula general/i,
          error: 'Omitir el signo de b al evaluar b² - 4ac.',
          correction: 'Encerrar cada coeficiente con su signo entre paréntesis al evaluar el discriminante.',
        },
        {
          pattern: /v[eé]rtice|m[aá]ximo|m[ií]nimo|altura|par[aá]bola/i,
          error: 'Omitir el signo negativo en xᵥ = -b/(2a).',
          correction: 'Calcular primero xᵥ = -b/(2a) y evaluar f(xᵥ) para obtener el extremo exacto.',
        },
        {
          pattern: /factoriz|producto|ra[ií]ces|terreno|[aá]rea/i,
          error: 'Factorizar o despejar sin igualar antes a cero.',
          correction: 'Llevar la ecuación a ax² + bx + c = 0 antes de factorizar o aplicar raíces.',
        },
      ],
      [
        {
          error: 'Omitir el signo del coeficiente cuadrático principal.',
          correction: 'Conservar el signo de a en la forma estándar y validar cada raíz en el enunciado.',
        },
        {
          error: 'Aceptar raíces fuera del dominio físico del problema.',
          correction: 'Descartar soluciones negativas o fuera de dominio que no tengan sentido real.',
        },
        {
          error: 'Invertir los signos de las raíces al factorizar binomios.',
          correction: 'Igualar cada factor (x - r) = 0 por separado y comprobar sustituyendo.',
        },
        {
          error: 'Confundir el término cuadrático con variación lineal.',
          correction: 'Verificar si aparece x² o producto de dos variables antes de elegir modelo.',
        },
      ]
    );
  }
  if (classification.kind === 'system-2x2') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /sustituci[oó]n/i,
          error: 'Sustituir el despeje en la misma ecuación origen.',
          correction: 'Reemplazar la variable en la ecuación contraria para evitar identidades triviales.',
        },
        {
          pattern: /reducci[oó]n|eliminaci[oó]n|suma y resta/i,
          error: 'Multiplicar solo un término al igualar coeficientes.',
          correction: 'Multiplicar toda la fila (izquierda y derecha) para conservar la equivalencia.',
        },
        {
          pattern: /gr[aá]fic|intersecci[oó]n|plano/i,
          error: 'Graficar ejes con distinta escala y leer mal el cruce.',
          correction: 'Usar escala uniforme y verificar el punto (x, y) por sustitución algebraica.',
        },
        {
          pattern: /gr[aá]fic|intersecci[oó]n|rectas/i,
          error: 'Leer el cruce invertido como (y, x) en vez de (x, y).',
          correction: 'Ubicar primero la abscisa x horizontal y después la ordenada y vertical.',
        },
        {
          pattern: /determinante|cramer/i,
          error: 'Invertir signos al restar la diagonal secundaria en Δ.',
          correction: 'Aplicar Δ = a₁b₂ - a₂b₁ respetando paréntesis y signos de cada coeficiente.',
        },
      ],
      [
        {
          error: 'Plantear una ecuación cuando hay dos restricciones.',
          correction: 'Definir claramente cada incógnita y verificar que el par (x, y) cumpla ambas ecuaciones.',
        },
        {
          error: 'Invertir signos al despejar una incógnita inicial.',
          correction: 'Comprobar cada transformación sustituyendo un par de prueba en la ecuación original.',
        },
        {
          error: 'Hallar x sin sustituir para obtener la segunda variable y.',
          correction: 'Completar el par (x, y) y validar ambas igualdades antes de concluir.',
        },
        {
          error: 'Suponer solución única sin revisar si las rectas son paralelas.',
          correction: 'Comparar pendientes o determinante Δ antes de interpretar el sistema.',
        },
      ]
    );
  }
  if (classification.kind === 'geometry') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /suplementar|complementar|opuestos\s+(?:por\s+el\s+|al\s+)v[eé]rtice|par\s+lineal|tipos\s+de\s+[aá]ngulos/i,
          error: 'Sumar ángulos suplementarios como si sumaran 90° o igualarlos sin verificar el tipo.',
          correction: 'Comprobar primero si el par es complementario (90°), suplementario (180°) u opuesto por el vértice (iguales).',
        },
        {
          pattern: /congruen|semejan|napole[oó]n|\blal\b|\bala\b|\blll\b/i,
          error: 'Asumir congruencia sin comprobar criterio ni orden angular.',
          correction: 'Justificar el criterio (LLL, LAL o ALA) con correspondencia explícita de vértices.',
        },
        {
          pattern: /pit[aá]goras|hipotenusa|cateto/i,
          error: 'Confundir un cateto con la hipotenusa del triángulo.',
          correction: 'Identificar el ángulo recto primero para aislar la hipotenusa c² = a² + b².',
        },
        {
          pattern: /per[ií]metro|[aá]rea|superficie|volumen/i,
          error: 'Mezclar unidades lineales y cuadráticas o usar lado inclinado.',
          correction: 'Confirmar dimensiones perpendiculares y expresar áreas en unidades cuadradas.',
        },
      ],
      [
        {
          error: 'Aplicar fórmula geométrica sin identificar datos de la figura.',
          correction: 'Trazar el esquema con medidas etiquetadas y verificar qué relación geométrica aplica.',
        },
        {
          error: 'Operar medidas en distintas unidades sin homogeneizar.',
          correction: 'Expresar todas las medidas en la misma unidad antes de operar.',
        },
        {
          error: 'Sumar ángulos suplementarios como si sumaran 90°.',
          correction: 'Distinguir complementarios (90°) de suplementarios (180°) antes de despejar.',
        },
        {
          error: 'Calcular el perímetro completo omitiendo un tramo del contorno.',
          correction: 'Recorrer todos los lados de la figura verificando cierres y longitudes parciales.',
        },
      ]
    );
  }
  if (classification.kind === 'proportion') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /inversa|obrero|velocidad|tiempo/i,
          error: 'Usar regla directa cuando la relación es inversa.',
          correction: 'Comprobar si k = x·y es constante (inversa) o y/x es constante (directa).',
        },
        {
          pattern: /porcentaje|descuento|iva|aumento/i,
          error: 'Sumar porcentajes sucesivos sin aplicar al nuevo valor.',
          correction: 'Calcular cada variación porcentual en cadena usando factores decimales.',
        },
      ],
      [
        {
          error: 'Acomodar magnitudes en orden cruzado al despejar.',
          correction: 'Alinear cada columna con la misma unidad antes de multiplicar en cruz.',
        },
        {
          error: 'Confundir razón unitaria con cambio absoluto total.',
          correction: 'Dividir siempre la magnitud dependiente entre la unidad de referencia.',
        },
        {
          error: 'Aplicar proporcionalidad cuando existe costo fijo inicial.',
          correction: 'Revisar si la recta pasa por (0, 0) antes de aplicar regla de tres.',
        },
        {
          error: 'Omitir la unidad de comparación entre dos razones.',
          correction: 'Expresar ambas razones sobre la misma base antes de concluir.',
        },
      ]
    );
  }
  if (classification.kind === 'linear' || /ecuaci[oó]n|algebraic|inc[oó]gnita|balanza|lineal|pendiente|recta/i.test(contextText)) {
    return pickByKeywordAndSession(
      [
        {
          pattern: /pendiente|raz[oó]n de cambio|m\s*=|tasa/i,
          error: 'Invertir cociente vertical y horizontal al calcular pendiente.',
          correction: 'Mantener el mismo orden (y₂ - y₁)/(x₂ - x₁) en numerador y denominador.',
        },
        {
          pattern: /par[eé]ntesis|distributiv|signo/i,
          error: 'Distribuir factor o signo solo al primer término.',
          correction: 'Distribuir factor y signo sobre cada término interior antes de agrupar semejantes.',
        },
        {
          pattern: /fracci[oó]n|denominador/i,
          error: 'Quitar un denominador sin multiplicar toda la ecuación.',
          correction: 'Multiplicar toda la ecuación por el mínimo común múltiplo para conservar el equilibrio.',
        },
        {
          pattern: /dos\s+(?:variables|inc[oó]gnitas)|tabular|intercepto/i,
          error: 'Intercambiar las coordenadas (0, b) y (a, 0) al tabular.',
          correction: 'Evaluar x = 0 para hallar el corte vertical y = b y y = 0 para el horizontal.',
        },
        {
          pattern: /dos\s+(?:variables|inc[oó]gnitas)|recta|gr[aá]fic/i,
          error: 'Cometer error de signo al despejar y en ax + by = c.',
          correction: 'Trasponer ax con signo contrario y dividir cada término entre b.',
        },
        {
          pattern: /balanza|equilibrio/i,
          error: 'Mover términos sin aplicar operación inversa bilateral.',
          correction: 'Aplicar la misma operación inversa en ambos miembros y comprobar sustituyendo.',
        },
        {
          pattern: /despej|primer\s+grado|lineal/i,
          error: 'Sumar constantes sueltas con coeficientes algebraicos.',
          correction: 'Agrupar únicamente términos semejantes antes de despejar la incógnita.',
        },
        {
          pattern: /inc[oó]gnita|ecuaci[oó]n|model/i,
          error: 'Elegir una incógnita distinta a la magnitud preguntada.',
          correction: 'Definir qué representa x y sus unidades antes de plantear la igualdad.',
        },
      ],
      [
        {
          error: 'Confundir término fijo b con tasa de cambio m.',
          correction: 'Separar la tasa por unidad m del valor inicial fijo b en y = mx + b.',
        },
        {
          error: 'Sumar constantes sueltas con coeficientes algebraicos.',
          correction: 'Agrupar únicamente términos con igual literal y exponente antes de despejar.',
        },
        {
          error: 'Concluir el valor de x sin verificar la igualdad original.',
          correction: 'Sustituir la solución en la ecuación inicial para validar ambos miembros.',
        },
        {
          error: 'Elegir incógnita distinta a la magnitud preguntada.',
          correction: 'Definir explícitamente qué representa x y sus unidades antes de plantear.',
        },
      ]
    );
  }

  // Dominios no matemáticos (Historia, Lengua, Ciencias Experimentales, Humanidades)
  if (/historia|proceso|siglo|revoluci[oó]n|independencia|guerra|cronolog|fuente/i.test(contextText)) {
    return pickByKeywordAndSession([], [
      {
        error: 'Memorizar fechas aisladas sin explicar causas ni actores.',
        correction: 'Relacionar contexto previo, detonante y transformación social o política del periodo.',
      },
      {
        error: 'Tomar una opinión posterior como fuente primaria histórica.',
        correction: 'Identificar autoría, época y propósito de cada fuente histórica antes de concluir.',
      },
      {
        error: 'Juzgar hechos históricos sin situar el contexto de la época.',
        correction: 'Explicar las condiciones sociales, económicas y políticas vigentes en ese periodo.',
      },
      {
        error: 'Omitir consecuencias de mediano plazo al describir un suceso.',
        correction: 'Conectar el evento detonante con sus cambios institucionales y cotidianos.',
      },
      {
        error: 'Mezclar causas estructurales con detonantes inmediatos.',
        correction: 'Distinguir condiciones acumuladas de hechos puntuales que desataron el proceso.',
      },
    ]);
  }
  if (/texto|ensayo|argument|tesis|lectura|p[aá]rrafo|discurso|lengua|gram[aá]tica|oral|comunica|escrito|mensaje|redacci[oó]n|cr[oó]nica|peri[oó]dico|noticia|reportaje|entrevista|rese[ñn]a|literat|narrat|lead|titular|editorial|debate|di[aá]log|falacia/i.test(contextText)) {
    return pickByKeywordAndSession([], [
      {
        error: 'Emitir opiniones sin respaldar la tesis con evidencia textual.',
        correction: 'Articular postura clara, evidencia verificable y conectores lógicos entre párrafos.',
      },
      {
        error: 'Copiar oraciones sueltas sin jerarquizar la idea principal.',
        correction: 'Jerarquizar tesis central, evidencias de apoyo y conclusión con palabras propias.',
      },
      {
        error: 'Confundir la intención comunicativa con un simple resumen.',
        correction: 'Identificar propósito del emisor, destinatario y tono antes de interpretar el texto.',
      },
      {
        error: 'Encadenar ideas sin conectores ni progresión temática.',
        correction: 'Enlazar cada párrafo con un marcador lógico que sostenga la tesis central.',
      },
      {
        error: 'Interpretar el vocabulario fuera de su contexto comunicativo.',
        correction: 'Contrastar el sentido literal y contextual según la situación del intercambio.',
      },
    ]);
  }
  if (/c[eé]lula|ecosistema|energ[ií]a|materia|experimento|hip[oó]tesis|variable|reacci[oó]n|qu[ií]m|f[ií]sica|biolog/i.test(contextText)) {
    return pickByKeywordAndSession([], [
      {
        error: 'Concluir sin aislar variables ni respaldar con mediciones.',
        correction: 'Contrastarla directamente contra la hipótesis inicial y los registros observados.',
      },
      {
        error: 'Confundir el efecto observado con su mecanismo científico.',
        correction: 'Vincular evidencia empírica, variables de control y principio científico del tema.',
      },
      {
        error: 'Plantear una hipótesis sin forma comprobable ni evidencia.',
        correction: 'Formular una predicción medible que conecte causa observable y resultado.',
      },
      {
        error: 'Ignorar unidades o condiciones de control durante el registro.',
        correction: 'Estandarizar unidades y registrar variables constantes en cada ensayo.',
      },
    ]);
  }

  if (allowMission) {
    const firstCriterion = cleanSacrintText(mission.formativeCheckpoint?.criteriaChecklist?.[0]);
    if (firstCriterion && !isRubricOrBoilerplateLeak(firstCriterion)) {
      return {
        error: `Omitir la verificación de: ${distillConciseText(firstCriterion, 110, 17)}`,
        correction: 'Validar paso a paso con evidencia e instrumentos de la sesión.',
      };
    }
  }

  const genericPool = [
    {
      error: 'Ejecutar pasos mecánicamente sin validar los datos iniciales.',
      correction: 'Contrastar el resultado con las condiciones iniciales y los criterios de la sesión.',
    },
    {
      error: 'Responder de forma general sin justificar el criterio clave.',
      correction: 'Explicar explícitamente la regla o evidencia que sostiene la respuesta final.',
    },
    {
      error: 'Omitir la revisión al pasar del análisis a la conclusión.',
      correction: 'Validar coherencia entre datos de partida, desarrollo y conclusión final.',
    },
    {
      error: 'Confundir un ejemplo particular con la regla general.',
      correction: 'Comprobar que el criterio se cumpla en toda la situación planteada.',
    },
    {
      error: 'Dejar el resultado aislado sin interpretarlo en contexto.',
      correction: 'Explicar qué significa la conclusión frente a la pregunta detonadora.',
    },
  ];
  return withAnchor(genericPool[sessionIdx % genericPool.length]!);
}

export function resolveMissionMisconception(
  mission: MissionSection,
  withCorrection = false,
  bundle?: DistilledLessonBundle,
  options: { session?: SessionPlan; allowMissionFallback?: boolean } = {}
): string {
  const { error, correction } = resolveMissionMisconceptionParts(mission, bundle, options);
  return withCorrection ? `${error} → ${correction}` : error;
}

export function sanitizeField(value: string | null | undefined, fallback: string, maxChars = 420, maxWords = 72): string {
  const cleaned = cleanSacrintText(value);
  if (!cleaned || isRubricOrBoilerplateLeak(cleaned)) return fallback;
  if (cleaned.length <= maxChars) return cleaned;
  return distillConciseText(cleaned, maxChars, maxWords) || fallback;
}

function pushTheoryStrings(out: string[], value: unknown): void {
  if (typeof value === 'string') {
    if (value.trim()) out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) pushTheoryStrings(out, item);
  } else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) pushTheoryStrings(out, nested);
  }
}

const workbookTheorySourcesCache = new WeakMap<ActiveWorkTextbook, string[]>();

export function collectWorkbookTheorySources(workbook: ActiveWorkTextbook): string[] {
  const cached = workbookTheorySourcesCache.get(workbook);
  if (cached) return cached;

  const sources: string[] = [];
  if (workbook.coverData?.paecProjectName) sources.push(workbook.coverData.paecProjectName);
  for (const m of workbook.missions ?? []) {
    if (m.conceptZero) pushTheoryStrings(sources, m.conceptZero);
    if (m.phenomenonHook?.story) sources.push(m.phenomenonHook.story);
    for (const s of m.sessionPlans ?? []) {
      if (s.objetivo) sources.push(s.objetivo);
      if (s.motivacion) sources.push(s.motivacion);
      if (s.saberesPrevios) sources.push(s.saberesPrevios);
      if (s.contenido) sources.push(s.contenido);
      if (s.ejemploResuelto) sources.push(s.ejemploResuelto);
      if (s.aplicacion) sources.push(s.aplicacion);
      if (s.productoIntegrador) sources.push(s.productoIntegrador);
      for (const check of s.autoevaluacion ?? []) {
        if (check) sources.push(check);
      }
      for (const practice of s.practica ?? []) {
        if (practice.enunciado) sources.push(practice.enunciado);
        if (practice.pista) sources.push(practice.pista);
      }
    }
  }
  workbookTheorySourcesCache.set(workbook, sources);
  return sources;
}
