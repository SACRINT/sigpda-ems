import type { MissionSection, SessionPlan } from '@/types/work-textbook';
import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import {
  hasDanglingEnding,
  isPublishablePedagogicalText,
  isTruncatedAgainstSource,
} from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import { extractDisciplinaryConceptPhrase } from '@/lib/editorial/topic-title-resolver';
import type { DiagramBuildOptions, SacrintDiagramNode, SacrintDiagramSpec } from '../types';
import { cleanSacrintText, sanitizePedagogicalMetaPhrases } from '../text/grammar-normalization';
import { paraphraseSixGramOverlap } from '../text/six-gram-overlap';

/**
 * Valida que una fórmula o expresión no contenga variables de plantilla sin instanciar (c1, a2, b2, a1*x + b1*y, etc.).
 */
export function isValidRenderableFormula(formula: string | null | undefined): boolean {
  if (!formula) return false;
  const trimmed = formula.trim();
  if (trimmed.length < 3) return false;
  if (/\b(?:a1|b1|c1|a2|b2|c2)\b/i.test(trimmed)) return false;
  if (/\by\s*=\s*c[₁1]\b/i.test(trimmed)) return false;
  if (/\ba[₁₂12]\s*\*\s*x\b|\bb[₁₂12]\s*\*\s*y\b/i.test(trimmed)) return false;
  if (/\bundefined\b|\bNaN\b|\$\{/i.test(trimmed)) return false;
  return true;
}

export function clean(value: string | null | undefined): string {
  return cleanSacrintText(value);
}

export function completeDetail(
  value: string | null | undefined,
  max = 220,
  fallback = ''
): string {
  const text = clean(value);
  if (!text) return fallback;

  const sentences = splitSpanishSentences(text);
  const first = sentences[0] || text;

  const fitted = fitPedagogicalText(first, {
    maxChars: max,
    maxWords: Math.max(8, Math.floor(max / 5.5)),
    role: 'concept',
    ensurePeriod: false,
  });

  if (
    fitted &&
    isPublishablePedagogicalText(fitted, 'infographic', text) &&
    !isTruncatedAgainstSource(fitted, text)
  ) {
    return fitted;
  }

  if (
    first.length <= Math.round(max * 1.8) &&
    isPublishablePedagogicalText(first, 'infographic', text) &&
    !isTruncatedAgainstSource(first, text)
  ) {
    return first;
  }

  throw new Error(`[SACRINT_NODE_TRUNCATED] Nodo incompleto: ${first}`);
}

export function safeCompleteDetail(
  value: string | null | undefined,
  max = 220,
  fallback = ''
): string {
  const text = clean(value);
  if (!text) return fallback;
  const sentences = splitSpanishSentences(text);
  const first = sentences[0] || text;
  const fitted = fitPedagogicalText(first, {
    maxChars: max,
    maxWords: Math.max(8, Math.floor(max / 5.5)),
    role: 'concept',
    ensurePeriod: false,
  });
  if (
    fitted &&
    isPublishablePedagogicalText(fitted, 'infographic', text) &&
    !isTruncatedAgainstSource(fitted, text)
  ) {
    return fitted;
  }
  if (isPublishablePedagogicalText(first, 'infographic', text) && !isTruncatedAgainstSource(first, text)) {
    return first;
  }
  if (isPublishablePedagogicalText(text, 'infographic')) {
    return text;
  }
  if (fallback && isPublishablePedagogicalText(fallback, 'infographic')) {
    return fallback;
  }
  return '';
}

export function clip(value: string, max: number): string {
  const cleaned = clean(value);
  if (!cleaned) return '';
  if (cleaned.length <= max && !hasDanglingEnding(cleaned)) return cleaned;
  return safeCompleteDetail(cleaned, max, cleaned);
}

export function firstSentence(value: string | null | undefined, max = 220): string {
  return safeCompleteDetail(value, max, '');
}

export function detail(value: string | null | undefined, max = 220, fallback = ''): string {
  const text = safeCompleteDetail(value, max, '');
  return text || fallback;
}

/** Calcula un tamaño de paso limpio ("1, 2, 5 × 10ⁿ") para ~5 marcas de eje sin amontonamiento. */
export function niceTickStep(span: number, targetTicks = 5): number {
  const safeSpan = Math.max(1e-6, Math.abs(span));
  const rough = safeSpan / Math.max(2, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const rel = rough / mag;
  if (rel <= 1) return mag;
  if (rel <= 2) return 2 * mag;
  if (rel <= 2.5) return 2.5 * mag;
  if (rel <= 5) return 5 * mag;
  return 10 * mag;
}

export function normalizedDiagramOverlap(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const tok = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
  const ta = tok(a);
  const tb = tok(b);
  if (ta.size < 3 || tb.size < 3) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared += 1;
  return shared / Math.min(ta.size, tb.size);
}

export function buildDistinctSessionCycleSources(
  mission: MissionSection,
  options: DiagramBuildOptions = {}
): { sources: string[]; isLessonGuide: boolean } {
  const session = options.session;
  const isLessonGuide = options.allowMissionFallback === false && Boolean(session);
  if (!isLessonGuide || !session) {
    return {
      isLessonGuide: false,
      sources: [
        firstSentence(mission.phenomenonHook?.story, 110),
        detail(mission.conceptZero?.coreExplanation, 110, ''),
        detail(mission.iDoSection?.stepByStepDemo || mission.weDoSection?.guidedPractice, 110, ''),
        detail(mission.youDoSection?.autonomousChallenge, 110, ''),
      ],
    };
  }

  const cleanField = (val?: string | null) =>
    sanitizePedagogicalMetaPhrases(stripSessionLead(val || ''));
  const vMap = session.sintesisVisual?.mapaConceptual;
  const vCrit = cleanField(vMap?.criterioDesarrollo);
  const vCorr = cleanField(vMap?.correccionBreve);
  const vDef = cleanField(vMap?.definicionClave);
  const vPlantea = cleanField(session.sintesisVisual?.ejemploBreve?.planteamiento);
  const vConcl = cleanField(session.sintesisVisual?.ejemploBreve?.conclusion);
  const rawMot = cleanField(session.motivacion);
  const nonQuestionMot = /^¿/.test(rawMot) ? '' : rawMot;
  const rawSaberes = cleanField(session.saberesPrevios);
  const nonQuestionSaberes = /^¿/.test(rawSaberes) ? '' : rawSaberes;
  const cleanProducto = cleanField(session.productoIntegrador);
  const cleanPractica0 = cleanField(session.practica?.[0]?.enunciado);
  const cleanAplicacion = cleanField(session.aplicacion);
  const leftRefs = [
    cleanField(session.sintesisVisual?.conceptoBreve),
    vPlantea,
    vConcl,
  ].filter(Boolean);

  const compactCycleNode = (raw: string | undefined): string => {
    const cleaned = clean(raw);
    if (!cleaned) return '';
    // Tomar SIEMPRE solo la primera oración para impedir que párrafos de motivación de 60–80 palabras entren en una tarjeta.
    const firstSent = splitSpanishSentences(cleaned)[0] || cleaned;
    const base = detail(firstSent, 74, '') || firstSent;
    const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
    if (wc(base) <= 10 && !hasDanglingEnding(base)) return base;
    const trimmedClause = base
      .replace(/,\s*(?:especialmente|particularmente|incluyendo|permitiendo|garantizando|asegurando|dejando|evitando|promoviendo|fomentando|normalizando|lo\s+que|lo\s+cual|como\s+la\s+falta|pero\s+t[uú]\s+tienes|pero\s+cada\s+uno)\b[^.?!]*([.?!]?)$/i, '.')
      .replace(/\s+(?:que\s+(?:afectan|limitan|reflejan|facilitan|promueven|vinculen|garantizan)|y\s+(?:documenta|ejec[uú]talo|eval[uú]a|verifica)\s+(?:el\s+proceso|a\s+lo\s+largo|la\s+inclusi[oó]n))\b[^.?!]*([.?!]?)$/i, '.')
      .replace(/\s+(?:a\s+lo\s+largo\s+de\s+una\s+semana|a\s+lo\s+largo\s+de\s+seis\s+minutos|en\s+la\s+bit[aá]cora\s+de\s+trabajo)\b/gi, '')
      .replace(/\.\.+$/, '.')
      .trim();
    const withPeriod = trimmedClause && !/[.?!]$/.test(trimmedClause) ? `${trimmedClause}.` : trimmedClause;
    if (withPeriod.length >= 20 && !hasDanglingEnding(withPeriod) && wc(withPeriod) <= 12) {
      return withPeriod;
    }
    const fitted = fitPedagogicalText(base, {
      maxChars: 72,
      maxWords: 10,
      role: 'concept',
      ensurePeriod: true,
    });
    if (fitted && fitted.length >= 18 && !hasDanglingEnding(fitted) && wc(fitted) <= 12) {
      return fitted;
    }
    return wc(base) <= 16 ? base : '';
  };

  const pickDistinct = (candidates: Array<string | undefined>, used: string[]): string => {
    for (const raw of candidates) {
      const cand = compactCycleNode(raw);
      if (!cand || cand.length < 14) continue;
      if (used.some((u) => normalizedDiagramOverlap(cand, u) >= 0.6)) continue;
      if (leftRefs.some((r) => normalizedDiagramOverlap(cand, r) >= 0.72)) continue;
      return cand;
    }
    for (const raw of candidates) {
      const cand = compactCycleNode(raw);
      if (cand && cand.length >= 14 && !used.some((u) => normalizedDiagramOverlap(cand, u) >= 0.7)) {
        return cand;
      }
    }
    return '';
  };

  const used: string[] = [];
  const p1 = pickDistinct([nonQuestionMot, nonQuestionSaberes, firstSentence(session.contenido, 82)], used);
  if (p1) used.push(p1);
  const p2 = pickDistinct([vCrit, vDef, firstSentence(session.contenido, 82)], used);
  if (p2) used.push(p2);
  const p3 = pickDistinct([cleanProducto, cleanPractica0, cleanAplicacion], used);
  if (p3) used.push(p3);
  const p4 = pickDistinct([vCorr, cleanAplicacion, cleanProducto], used);
  if (p4) used.push(p4);

  return { isLessonGuide: true, sources: [p1, p2, p3, p4] };
}

export function toSessionScopedMission(
  mission: MissionSection,
  session: SessionPlan,
  allowMissionFallback: boolean
): MissionSection {
  const practiceText = (session.practica ?? [])
    .map((p) => p.enunciado)
    .filter(Boolean)
    .join(' ');
  const sessionSteps = (session.ejemploResuelto ?? '')
    .split(/\r?\n|(?=[ \t]+[1-9]\d?[.)][ \t]+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ(¿¡])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!allowMissionFallback) {
    const cleanField = (val?: string | null) =>
      sanitizePedagogicalMetaPhrases(stripSessionLead(val || ''));
    const cleanSaberes = cleanField(session.saberesPrevios);
    const cleanContenido = cleanField(session.contenido);
    const cleanObjetivo = cleanField(session.objetivo);
    const cleanEjemplo = cleanField(session.ejemploResuelto);
    const cleanAplicacion = cleanField(session.aplicacion);
    const vMap = session.sintesisVisual?.mapaConceptual;
    const vEx = session.sintesisVisual?.ejemploBreve;
    const vConcept = cleanField(session.sintesisVisual?.conceptoBreve);
    const vDef = cleanField(vMap?.definicionClave);
    const vCrit = cleanField(vMap?.criterioDesarrollo);
    const vErr = cleanField(vMap?.errorComun);
    const vCorr = cleanField(vMap?.correccionBreve);
    const vPlantea = cleanField(vEx?.planteamiento);
    const vSteps = (vEx?.pasos ?? []).map(cleanField).filter(Boolean);
    const vStep1 = vSteps[0] || '';
    const vConcl = cleanField(vEx?.conclusion);
    const nonQuestionMotivacion = /^¿/i.test(cleanField(session.motivacion))
      ? ''
      : cleanField(session.motivacion);
    const conceptTopic =
      extractDisciplinaryConceptPhrase(cleanObjetivo) ||
      extractDisciplinaryConceptPhrase(vDef || vConcept) ||
      vDef ||
      vConcept ||
      cleanObjetivo;
    return {
      ...mission,
      title: cleanObjetivo || `Sesión ${session.sessionNumber}`,
      sessionTopic: conceptTopic,
      sessionFocus: vPlantea || conceptTopic || vDef,
      phenomenonHook: {
        story: vPlantea || vDef || nonQuestionMotivacion || cleanSaberes,
        detonatingQuestion: '',
      },
      conceptZero: {
        physicalAnalogy: vDef || cleanSaberes,
        coreExplanation: vDef || vConcept || cleanContenido,
        contrastTable:
          vErr || vCorr || vCrit
            ? [
                {
                  commonMisconception: vErr,
                  correctConcept: vCorr || vConcl || cleanAplicacion,
                  reasoning: vCrit || vDef,
                },
              ]
            : [],
        solvedExample: {
          problemStatement: cleanEjemplo,
          solutionSteps: vSteps.length >= 2 ? vSteps : sessionSteps,
          interpretation: vConcl || cleanAplicacion,
        },
      },
      iDoSection: {
        stepByStepDemo: vStep1 || cleanEjemplo,
        visualOrDiagram: '',
      },
      weDoSection: {
        guidedPractice: vCrit || vStep1 || practiceText,
        workbookElements: [],
      },
      youDoSection: {
        autonomousChallenge: vConcl || vCorr || cleanAplicacion || cleanField(session.productoIntegrador),
        workbookElements: [],
      },
      troubleshooting: [],
      formativeCheckpoint: {
        // Priorizar criterio/corrección conceptual en lugar de preguntas de autoevaluación ("¿Logré mantener...?", "¿Puedo detallar...?")
        question: vCorr || vCrit || vConcl || cleanAplicacion || '',
        criteriaChecklist: session.autoevaluacion ?? [],
        reflectionPrompts: [],
      },
    };
  }

  const fallbackTopic =
    extractDisciplinaryConceptPhrase(session.objetivo || mission.sessionTopic || '') ||
    mission.sessionTopic ||
    session.objetivo;
  return {
    ...mission,
    sessionTopic: fallbackTopic,
    sessionFocus: session.objetivo || mission.sessionFocus,
    phenomenonHook: {
      story: session.motivacion || session.saberesPrevios || mission.phenomenonHook?.story || '',
      detonatingQuestion: mission.phenomenonHook?.detonatingQuestion || '',
    },
    conceptZero: {
      ...mission.conceptZero,
      coreExplanation: session.contenido || mission.conceptZero?.coreExplanation || '',
      solvedExample: {
        problemStatement: session.ejemploResuelto || mission.conceptZero?.solvedExample?.problemStatement || '',
        solutionSteps:
          sessionSteps.length > 0 ? sessionSteps : (mission.conceptZero?.solvedExample?.solutionSteps ?? []),
        interpretation: session.aplicacion || mission.conceptZero?.solvedExample?.interpretation || '',
      },
    },
    iDoSection: {
      ...mission.iDoSection,
      stepByStepDemo: session.ejemploResuelto || mission.iDoSection?.stepByStepDemo || '',
    },
    weDoSection: {
      ...mission.weDoSection,
      guidedPractice: practiceText || mission.weDoSection?.guidedPractice || '',
    },
    youDoSection: {
      ...mission.youDoSection,
      autonomousChallenge: session.aplicacion || mission.youDoSection?.autonomousChallenge || '',
    },
  };
}

export function stripSessionLead(text: string): string {
  let out = cleanSacrintText(text);
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/^(?:sesi[oó]n\s*\d{1,2}\s*[:.\-–—]\s*)/i, '').trim();
  }
  return out;
}

function compactDiagramDetail(
  raw: string,
  maxChars = 48,
  maxWords = 7,
  theorySources?: string[]
): string {
  const cleanedBase = sanitizePedagogicalMetaPhrases(stripSessionLead(raw));
  if (!cleanedBase) return '';

  // Evitar volcar preguntas retóricas, autoevaluaciones cortadas o párrafos narrativos dentro de un nodo de diagrama.
  let cleaned = cleanedBase
    .replace(
      /^(?:¿?\s*Alguna\s+vez\s+te\s+has\s+preguntado\s+(?:c[oó]mo|por\s+qu[eé]|qu[eé])?\s*|¿?\s*(?:Por\s+qu[eé]\s+)?ocurre\s+esto\s+y\s+c[oó]mo\s+|Adem[aá]s,\s*comprueba\s+que\s+|¿\s*(?:Logr[eé]|Puedo|He\s+integrado|S[eé])\s+(?:mantener|detallar|distinguir|explicar|aplicar|identificar|trazar|evaluar|integrar|comprender|ordenar|emplear)\s+)/i,
      ''
    )
    .replace(/^¿\s*(?:Qu[eé]|C[oó]mo|Cu[aá]l(?:es)?|Por\s+qu[eé]|D[oó]nde|Cu[aá]ndo)\s+/i, '')
    .replace(/\?$/, '')
    .trim();
  if (!cleaned) cleaned = cleanedBase.replace(/[¿?]/g, '').trim();
  if (/^[a-záéíóúñ]/.test(cleaned)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (cleaned.length > maxChars + 12) {
    const strippedLead = cleaned
      .replace(/^(?:Imagina\s+que\s+[^,]{3,60},\s*|En\s+el\s+(?:laboratorio|taller|aula),?\s*(?:a\s+menudo\s+)?|Al\s+[a-záéíóúñ]+(?:lo|la|los|las)?,\s*notas\s+que\s+)/i, '')
      .trim();
    if (strippedLead.length >= 16) {
      cleaned = strippedLead.charAt(0).toUpperCase() + strippedLead.slice(1);
    }
    if (cleaned.includes('?') && cleaned.length > maxChars + 14) {
      const qMatch = cleaned.match(/¿[^?]{8,72}\?/);
      if (qMatch && qMatch[0].split(/\s+/).length <= maxWords + 3) {
        cleaned = qMatch[0].trim();
      } else {
        const beforeQ = cleaned.split('¿')[0]?.replace(/[,;:\s]+$/, '').trim() || '';
        const firstClause = beforeQ.replace(/[.?!]+$/, '').trim();
        if (
          firstClause.length >= 14 &&
          !/^Si\s+/i.test(firstClause) &&
          isPublishablePedagogicalText(firstClause, 'infographic')
        ) {
          cleaned = firstClause;
        }
      }
    }
  }

  const paraphrased =
    theorySources && theorySources.length > 0
      ? paraphraseSixGramOverlap(cleaned, theorySources)
      : cleaned;

  const sanitizeNodeResult = (candidate: string): string => {
    let out = candidate.replace(/[,;:]+$/, '').trim();
    if (out.includes('¿') && !out.includes('?')) {
      const idxQ = out.indexOf('¿');
      if (idxQ > 0) {
        const before = out.slice(0, idxQ).replace(/[,;:\s]+$/, '').trim();
        if (before.length >= 14 && isPublishablePedagogicalText(before, 'infographic')) {
          return before;
        }
      }
      const afterOpen = out
        .replace(/^¿\s*(?:Qu[eé]|C[oó]mo|Cu[aá]l(?:es)?|Por\s+qu[eé]|D[oó]nde|Cu[aá]ndo|Alguna\s+vez|Logr[eé]|Puedo|He\s+integrado)\s+/i, '')
        .trim();
      out = afterOpen.length >= 10
        ? afterOpen.charAt(0).toUpperCase() + afterOpen.slice(1)
        : out.replace(/¿/g, '').trim();
    }
    return out;
  };

  const hasBalancedQuotes = (text: string): boolean => {
    const doubleCount = (text.match(/"/g) || []).length;
    if (doubleCount % 2 !== 0) return false;
    // Ignorar apóstrofos internos de palabras ("don't", "L'Hôpital") al contar comillas simples de cita.
    const quoteMarks = text.match(/(?:^|[\s:(])'|'(?:[\s.,;:!?)]|$)/g) || [];
    return quoteMarks.length % 2 === 0;
  };

  const isPublishableNode = (candidate: string): boolean =>
    Boolean(candidate) &&
    hasBalancedQuotes(candidate) &&
    isPublishablePedagogicalText(candidate, 'infographic', paraphrased) &&
    !isTruncatedAgainstSource(candidate, paraphrased);

  // Conservar siempre la primera oración completa íntegra (jamás amputar a media cláusula por límite de caracteres).
  const sentences = splitSpanishSentences(paraphrased);
  const firstSent = sanitizeNodeResult(sentences[0] || paraphrased);
  if (firstSent && isPublishableNode(firstSent)) {
    return firstSent;
  }

  const cleanFull = sanitizeNodeResult(paraphrased);
  if (cleanFull && isPublishableNode(cleanFull)) {
    return cleanFull;
  }

  const fitted = fitPedagogicalText(paraphrased, {
    maxChars: Math.max(maxChars, 110),
    maxWords: Math.max(maxWords, 18),
    role: 'concept',
    ensurePeriod: false,
  });
  if (fitted && isPublishableNode(fitted)) {
    return sanitizeNodeResult(fitted);
  }

  return sanitizeNodeResult(firstSent || cleanFull || fitted || cleanedBase);
}

function compactNode(node: SacrintDiagramNode, theorySources?: string[]): SacrintDiagramNode {
  return { ...node, detail: compactDiagramDetail(node.detail, 110, 18, theorySources) };
}

export function compactNonQuantitativeDiagram(
  diagram: SacrintDiagramSpec,
  theorySources?: string[]
): SacrintDiagramSpec {
  const cn = (node: SacrintDiagramNode) => compactNode(node, theorySources);
  const cd = (text: string, maxChars: number, maxWords: number) =>
    compactDiagramDetail(text, maxChars, maxWords, theorySources);

  switch (diagram.kind) {
    case 'argument': {
      const thesis = cn(diagram.thesis);
      const thesisNorm = thesis.detail.toLowerCase();
      const premises = diagram.premises
        .map(cn)
        .filter((p) => p.detail && p.detail.toLowerCase() !== thesisNorm)
        .map((p, index) => ({ ...p, label: `PREMISA ${index + 1}` }));
      return {
        ...diagram,
        thesis,
        premises,
        objection: cn(diagram.objection),
        conclusion: cn(diagram.conclusion),
      };
    }
    case 'language':
      return {
        ...diagram,
        input: cn(diagram.input),
        rule: cn(diagram.rule),
        output: cn(diagram.output),
        context: cn(diagram.context),
      };
    case 'concept':
      return {
        ...diagram,
        center: cn(diagram.center),
        nodes: diagram.nodes.map(cn),
      };
    case 'timeline':
      return {
        ...diagram,
        span: cd(diagram.span, 56, 8),
        events: diagram.events.map(cn),
      };
    case 'system-map':
      return {
        ...diagram,
        center: cn(diagram.center),
        components: diagram.components.map(cn),
        environment: cn(diagram.environment),
      };
    case 'clinical-flow':
      return {
        ...diagram,
        stages: diagram.stages.map(cn),
        note: cd(diagram.note, 64, 10),
      };
    case 'block-diagram':
      return {
        ...diagram,
        input: cn(diagram.input),
        process: cn(diagram.process),
        output: cn(diagram.output),
        feedback: cn(diagram.feedback),
      };
    case 'sop-flow':
      return {
        ...diagram,
        steps: diagram.steps.map(cn),
        standard: cd(diagram.standard, 64, 10),
      };
    case 'creative-cycle':
      return {
        ...diagram,
        phases: diagram.phases.map(cn),
        statement: cd(diagram.statement, 64, 10),
      };
    case 'training-cycle':
      return {
        ...diagram,
        phases: diagram.phases.map(cn),
        principle: cd(diagram.principle, 64, 10),
      };
    case 'regulation-flow':
      return {
        ...diagram,
        stages: diagram.stages.map(cn),
        anchor: cd(diagram.anchor, 64, 10),
      };
    default:
      return diagram;
  }
}
