import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import {
  hasDanglingEnding,
  isPublishablePedagogicalText,
  isTruncatedAgainstSource,
} from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import { extractDisciplinaryConceptPhrase } from '@/lib/editorial/topic-title-resolver';
import type {
  SacrintConceptSlide,
  SacrintDiagramSpec,
  SacrintPracticeSlide,
  SacrintSlide,
} from '../types';
import { normalizeLearningObjective } from '../text/objective-and-activity-guards';
import { distillStepPreservingMath } from '../distiller/formula-and-steps';
import {
  compactActivityPreservingTaskAndData,
  compactConceptNarrative,
  compactEvaluationCriterion,
  compactProblemPreamble,
  countSlideWords,
  hasActivityTask,
  hasIncompleteConditionalEnding,
  isHeadlessAnaphoricStart,
  isValidEvaluationCriterionItem,
} from './slide-budget';

export function finalCompact(slide: SacrintSlide, maxWords = 180): SacrintSlide {
  if (countSlideWords(slide) <= maxWords) return slide;

  const fitPreserving = (
    value: string | undefined,
    maxChars: number,
    maxWordsValue: number,
    role: 'concept' | 'problem' | 'step' | 'conclusion' | 'activity' | 'application' | 'hint' | 'general',
    minChars = 24
  ): string | undefined => {
    if (!value) return value;
    const original = value.trim();
    if (!original) return value;
    const fitted = fitPedagogicalText(value, { maxChars, maxWords: maxWordsValue, role });
    if (!fitted) return value;
    const safeMin = Math.min(minChars, original.length);
    const pubRole = role === 'general' ? 'concept' : role;
    if (
      fitted.trim().length < safeMin ||
      hasDanglingEnding(fitted) ||
      !isPublishablePedagogicalText(fitted, pubRole, original)
    ) {
      return value;
    }
    if (role === 'concept') {
      if (isHeadlessAnaphoricStart(fitted) && !isHeadlessAnaphoricStart(original)) return value;
      if (/=/.test(original) && !/=/.test(fitted)) return value;
    }
    const mathTokens = (text: string): string[] =>
      (text.match(/\$?\d[\d.,]*|=/g) ?? []).map((t) => t.replace(/[$,]/g, ''));
    if (role === 'step') {
      const fittedTokens = new Set(mathTokens(fitted));
      if (mathTokens(original).some((token) => !fittedTokens.has(token))) return value;
      if (/=[^.;]*\/\s*[\d(a-zA-Z]/.test(original) && !/=[^.;]*\/\s*[\d(a-zA-Z]/.test(fitted)) return value;
    } else if (role === 'hint' || role === 'conclusion') {
      if (/=/.test(original) && !/=/.test(fitted)) return value;
      if (/=[^.;]*\/\s*[\d(a-zA-Z]/.test(original) && !/=[^.;]*\/\s*[\d(a-zA-Z]/.test(fitted)) return value;
      if ((original.match(/=/g)?.length ?? 0) >= 2 && (fitted.match(/=/g)?.length ?? 0) < 2) return value;
      if (role === 'hint' && /\d+\s*,\s*\d+/.test(original)) {
        const fittedTokens = new Set(mathTokens(fitted));
        if (mathTokens(original).some((token) => !fittedTokens.has(token))) return value;
      }
    } else if (role === 'problem' || role === 'activity') {
      if (hasIncompleteConditionalEnding(fitted)) return value;
      if (/=/.test(original) && !/=/.test(fitted)) return value;
      const origTokens = [...new Set(mathTokens(original))];
      if (origTokens.length > 0) {
        const fittedTokens = new Set(mathTokens(fitted));
        if (origTokens.some((token) => !fittedTokens.has(token))) return value;
      }
    } else if (role === 'application') {
      if (hasIncompleteConditionalEnding(fitted)) return value;
      if (original.length >= 48 && fitted.trim().length < 44) return value;
      const origTokens = [...new Set(mathTokens(original))];
      if (origTokens.length > 0) {
        const fittedTokens = new Set(mathTokens(fitted));
        const requiredCount = origTokens.length <= 2 ? origTokens.length : 2;
        if (fittedTokens.size < Math.min(requiredCount, origTokens.length)) return value;
      }
    }
    return fitted;
  };
  const isSolutionStep = (step: string): boolean =>
    /=/.test(step) ||
    /^(?:respuesta|resultado|conclusi[oó]n|por tanto|as[ií]|en consecuencia|comprobaci[oó]n)/i.test(step.trim());
  const stepTokens = (value: string): Set<string> =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 1)
    );
  const nearDuplicateSteps = (a: string, b: string): boolean => {
    const left = stepTokens(a);
    const right = stepTokens(b);
    if (left.size < 8 || right.size < 8) return false;
    let shared = 0;
    for (const token of left) if (right.has(token)) shared += 1;
    const union = left.size + right.size - shared;
    return union > 0 && shared / union >= 0.8;
  };
  const fitOrDistillStep = (source: string, maxChars: number, maxWordsValue: number): string => {
    const fitted = fitPreserving(source, maxChars, maxWordsValue, 'step', 16);
    if (fitted && fitted !== source) return fitted;
    if (source.length > maxChars) {
      const distilled = distillStepPreservingMath(source, maxChars, maxWordsValue);
      if (distilled && distilled.trim().length >= 14 && !hasDanglingEnding(distilled)) {
        return distilled;
      }
    }
    return fitted || source;
  };
  const compactSteps = (steps: string[], maxChars: number, maxWordsValue: number, maxSteps: number): string[] => {
    if (steps.length === 0) return [];
    const dedupedSteps = steps.filter(
      (step, index) => !steps.slice(0, index).some((previous) => nearDuplicateSteps(previous, step))
    );
    const rawSolution = [...dedupedSteps].reverse().find(isSolutionStep) ?? [...steps].reverse().find(isSolutionStep);
    const solutionSource = rawSolution ? compactConceptNarrative(rawSolution) : undefined;
    const solution = solutionSource
      ? fitOrDistillStep(solutionSource, maxChars, maxWordsValue)
      : undefined;
    const kept: string[] = [];
    for (const step of dedupedSteps.slice(0, maxSteps)) {
      const source = compactConceptNarrative(step);
      const fitted = fitOrDistillStep(source, maxChars, maxWordsValue);
      if (!kept.includes(fitted)) kept.push(fitted);
    }
    if (solution && !kept.some((step) => step.includes(solution) || solution.includes(step))) {
      if (kept.length >= maxSteps && maxSteps > 0) kept[maxSteps - 1] = solution;
      else kept.push(solution);
    }
    return kept;
  };
  const dedupe = (values: string[] | undefined): string[] =>
    [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];

  if (slide.kind === 'concept') {
    const conceptSlide = slide as SacrintConceptSlide;
    const first = {
      ...conceptSlide,
      explanation: compactConceptNarrative(conceptSlide.explanation),
      activationNote: conceptSlide.activationNote
        ? fitPreserving(
            compactConceptNarrative(conceptSlide.activationNote),
            78,
            11,
            'concept',
            18
          ) || conceptSlide.activationNote
        : conceptSlide.activationNote,
      workedExample: conceptSlide.workedExample
        ? {
            ...conceptSlide.workedExample,
            problemStatement: compactProblemPreamble(conceptSlide.workedExample.problemStatement),
            steps: conceptSlide.workedExample.steps.map((step) => compactConceptNarrative(step)),
            interpretation: compactConceptNarrative(conceptSlide.workedExample.interpretation),
          }
        : conceptSlide.workedExample,
      analogy: undefined,
      keyTakeaways: [],
      facts: [],
      variables: [],
    } as unknown as SacrintConceptSlide;
    if (countSlideWords(first) <= maxWords) return first;

    const second = {
      ...first,
      activationNote:
        fitPreserving(first.activationNote, 110, 17, 'hint', 20) || first.activationNote,
      explanation:
        fitPreserving(compactConceptNarrative(first.explanation), 165, 25, 'concept', 55) ||
        first.explanation,
      misconception:
        first.misconception && first.misconception.length > 104
          ? fitPreserving(first.misconception, 104, 16, 'concept', 38) || first.misconception
          : first.misconception,
      workedExample: first.workedExample
        ? {
            problemStatement:
              fitPreserving(
                compactProblemPreamble(first.workedExample.problemStatement),
                185,
                28,
                'problem',
                45
              ) || first.workedExample.problemStatement,
            steps: compactSteps(first.workedExample.steps, 78, 12, 3),
            interpretation:
              fitPreserving(first.workedExample.interpretation, 112, 17, 'conclusion', 20) ||
              first.workedExample.interpretation,
          }
        : first.workedExample,
    } as SacrintConceptSlide;
    if (countSlideWords(second) <= maxWords) return second;

    const third = {
      ...second,
      activationNote:
        fitPreserving(second.activationNote, 86, 13, 'hint', 18) || second.activationNote,
      explanation:
        fitPreserving(compactConceptNarrative(second.explanation), 140, 21, 'concept', 55) ||
        second.explanation,
      misconception: second.misconception,
      workedExample: second.workedExample
        ? {
            ...second.workedExample,
            problemStatement:
              fitPreserving(second.workedExample.problemStatement, 155, 23, 'problem', 38) ||
              second.workedExample.problemStatement,
            steps: compactSteps(second.workedExample.steps, 70, 11, 3),
            interpretation:
              fitPreserving(second.workedExample.interpretation, 96, 15, 'conclusion', 18) ||
              second.workedExample.interpretation,
          }
        : second.workedExample,
    } as SacrintConceptSlide;
    if (countSlideWords(third) <= maxWords) return third;

    const compactProblemFallback = (raw: string, maxChars: number, maxWordsValue: number): string => {
      const pre = compactProblemPreamble(raw);
      const fitted = fitPreserving(pre, maxChars, maxWordsValue, 'problem', 42);
      if (fitted && !isTruncatedAgainstSource(fitted, raw) && !hasDanglingEnding(fitted)) return fitted;
      return pre;
    };

    const fourth = {
      ...third,
      activationNote:
        fitPreserving(third.activationNote, 68, 10, 'hint', 18) || third.activationNote,
      explanation:
        fitPreserving(compactConceptNarrative(third.explanation), 125, 19, 'concept', 55) ||
        third.explanation,
      misconception: third.misconception,
      workedExample: third.workedExample
        ? {
            ...third.workedExample,
            problemStatement: compactProblemFallback(third.workedExample.problemStatement, 135, 20),
            steps: compactSteps(third.workedExample.steps, 64, 10, 3),
            interpretation:
              fitPreserving(third.workedExample.interpretation, 86, 13, 'conclusion', 22) ||
              third.workedExample.interpretation,
          }
        : third.workedExample,
    } as SacrintConceptSlide;
    if (countSlideWords(fourth) <= maxWords) return fourth;

    const fifth = {
      ...fourth,
      title:
        fitPreserving(fourth.title, 68, 10, 'concept', 20)?.replace(/\.$/, '') || fourth.title,
      explanation:
        fitPreserving(compactConceptNarrative(fourth.explanation), 115, 18, 'concept', 55) ||
        fourth.explanation,
      misconception:
        fourth.misconception && fourth.misconception.length > 92
          ? fitPreserving(fourth.misconception, 92, 14, 'concept', 38) || fourth.misconception
          : fourth.misconception,
      workedExample: fourth.workedExample
        ? {
            ...fourth.workedExample,
            interpretation:
              fitPreserving(fourth.workedExample.interpretation, 78, 12, 'conclusion', 20) ||
              fourth.workedExample.interpretation,
          }
        : fourth.workedExample,
    } as SacrintConceptSlide;
    if (countSlideWords(fifth) <= maxWords) return fifth;

    const trimVerboseMathStep = (step: string): string => {
      if (step.split(/\s+/).length <= 16) return step;
      const deVerbosed = step
        .replace(/^(?:Sustituci[oó]n y desarrollo|Datos e inc[oó]gnitas|Modelo o f[oó]rmula|Presentaci[oó]n del modelo algebraico)(?:\s+para\s+[^:]{3,35})?\s*:\s*/i, '')
        .replace(/,\s*lo\s+cual\s+corresponde(?:\s+exactamente)?\s+al\s+par\s+ordenado\s*(\([^)]+\))[^.]*/i, ' ⇒ par $1')
        .replace(/,\s*calculas\s+el\s+costo\s+sustituyendo\s+el\s+valor\s+en\s+la\s+ecuaci[oó]n,\s*obteniendo\s+/i, ': ')
        .replace(/\bsi\s+el\s+comit[eé]\s+reporta\s+una\s+asistencia\s+de\s+/i, 'Para ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const baseStep =
        deVerbosed.length >= 16 &&
        !hasDanglingEnding(deVerbosed) &&
        deVerbosed.split(/\s+/).length < step.split(/\s+/).length
          ? `${deVerbosed.charAt(0).toUpperCase()}${deVerbosed.slice(1).replace(/[.]+$/, '')}.`
          : step;
      if (baseStep.split(/\s+/).length <= 18) return baseStep;
      const distilled = fitOrDistillStep(compactConceptNarrative(baseStep), 92, 15);
      if (distilled && distilled.length >= 16 && !hasDanglingEnding(distilled) && distilled.split(/\s+/).length < baseStep.split(/\s+/).length) {
        return distilled;
      }
      // Si sigue muy largo (>22 palabras) con varias oraciones o ";", conservar la cláusula con ecuación/número clave.
      const clauses = baseStep
        .split(/(?<=[.;])\s+/)
        .map((c) => c.trim())
        .filter(Boolean);
      if (clauses.length >= 2) {
        const keyClause = clauses.find((c) => /=/.test(c)) || clauses.find((c) => /\d/.test(c)) || clauses[0]!;
        const cleanClause = keyClause.replace(/;$/, '.');
        if (cleanClause.length >= 16 && !hasDanglingEnding(cleanClause)) {
          return cleanClause;
        }
      }
      return baseStep;
    };

    const sixthConcept = {
      ...fifth,
      explanation:
        fitPreserving(compactConceptNarrative(fifth.explanation), 106, 16, 'concept', 55) ||
        fifth.explanation,
      workedExample: fifth.workedExample
        ? {
            ...fifth.workedExample,
            problemStatement:
              fitPreserving(fifth.workedExample.problemStatement, 145, 22, 'problem', 40) ||
              fifth.workedExample.problemStatement,
            steps: fifth.workedExample.steps.map(trimVerboseMathStep),
            interpretation:
              fitPreserving(fifth.workedExample.interpretation, 72, 11, 'conclusion', 18) ||
              fifth.workedExample.interpretation,
          }
        : fifth.workedExample,
    } as SacrintConceptSlide;
    if (countSlideWords(sixthConcept) <= maxWords) return sixthConcept;
    const seventhConcept = {
      ...sixthConcept,
      explanation:
        fitPedagogicalText(sixthConcept.explanation, {
          maxChars: 105,
          maxWords: 16,
          role: 'concept',
        }) || sixthConcept.explanation,
      workedExample: sixthConcept.workedExample
        ? {
            ...sixthConcept.workedExample,
            problemStatement:
              fitPedagogicalText(sixthConcept.workedExample.problemStatement, {
                maxChars: 120,
                maxWords: 18,
                role: 'problem',
              }) || sixthConcept.workedExample.problemStatement,
            steps: sixthConcept.workedExample.steps.map((step) => {
              const stripped = step.replace(
                /^(?:Datos e inc[oó]gnitas|Modelo o f[oó]rmula|Sustituci[oó]n y desarrollo|Presentaci[oó]n del modelo algebraico)\s*:\s*/i,
                ''
              );
              if (stripped.split(/\s+/).length <= 12) return stripped;
              const trimmed = trimVerboseMathStep(stripped);
              if (trimmed.split(/\s+/).length <= 12) return trimmed;
              return (
                fitPedagogicalText(trimmed, {
                  maxChars: 75,
                  maxWords: 11,
                  role: 'step',
                }) || trimmed
              );
            }),
            interpretation:
              fitPedagogicalText(sixthConcept.workedExample.interpretation, {
                maxChars: 72,
                maxWords: 11,
                role: 'conclusion',
              }) || sixthConcept.workedExample.interpretation,
          }
        : sixthConcept.workedExample,
    } as SacrintConceptSlide;
    if (countSlideWords(seventhConcept) <= 130) return seventhConcept;

    // Etapa 8 arquitectónica (solo 08): reducir densidad por BLOQUES/ORACIONES COMPLETAS,
    // jamás amputando una oración a la mitad ni vaciando la conclusión del ejemplo resuelto.
    const trimGerundTail = (text: string | undefined, minChars = 30, preserveMath = false): string | undefined => {
      if (!text) return text;
      const m = text.match(/^(.{26,}?),\s+(?:permitiendo|posibilitando|garantizando|asegurando|facilitando|logrando|evitando|optimizando|incluyendo|incorporando|validando|confirmando|promoviendo|fomentando|contribuyendo|consolidando|fortaleciendo|destacando|demostrando|documentando|identificando|analizando|sistematizando|calculando|verificando|comprendiendo|retir[aá]ndol[oa]s?|anotando|limpiando|revisando|comprobando|observando|midiendo|registrando|evaluando|comparando|aplicando|integrando|determinando|empleando|utilizando|provocando|causando|generando|manifest[aá]ndose|cumpliendo|ajustando|colocando|siguiendo|posiblemente|el\s+cual|la\s+cual|los\s+cuales|las\s+cuales|lo\s+cual|por\s+lo\s+cual|en\s+tanto\s+que|mientras\s+que|mediante\s+el\s+uso\s+de|para\s+(?:asegurar|garantizar|validar|corroborar))\b/i);
      if (m && m[1]) {
        const candidate = `${m[1].replace(/[.,;:\s]+$/, '').trim()}.`;
        if (preserveMath && (/[=\d]/.test(text.slice(m[1].length)) && !/[=\d]/.test(candidate))) {
          return text;
        }
        if (candidate.length >= minChars && !hasDanglingEnding(candidate)) return candidate;
      }
      return text;
    };

    const firstCompleteSentence = (text: string | undefined, minChars = 22): string | undefined => {
      if (!text) return text;
      const sents = splitSpanishSentences(text);
      const first = sents[0]?.trim();
      if (first && first.length >= minChars && !hasDanglingEnding(first)) return first;
      return text;
    };

    const compactDetailSafe = (text: string | undefined, minChars = 20, maxWords?: number): string => {
      if (!text) return '';
      const s1 = firstCompleteSentence(text, minChars) || text;
      let res = trimGerundTail(s1, minChars) || s1;
      if (!maxWords) return res;
      const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
      if (wc(res) <= maxWords) return res;
      const clauseCut = res
        .replace(/,\s*(?:especialmente|particularmente|incluyendo|dejando|normalizando|lo\s+que|como\s+la\s+falta|donde\s+los|sin\s+considerar|bajo\s+criterios)\b[^.?!]*([.?!]?)$/i, '.')
        .replace(/\s+(?:que\s+(?:fortalece|promueve|limita|afecta|facilita|vincula|garantiza|impide|refleja))\b[^.?!]*([.?!]?)$/i, '.')
        .replace(/\.\.+$/, '.')
        .trim();
      if (clauseCut.length >= minChars && !hasDanglingEnding(clauseCut) && wc(clauseCut) < wc(res)) {
        res = clauseCut;
      }
      if (wc(res) <= maxWords) return res;
      const fitted = fitPedagogicalText(res, {
        maxChars: Math.round(maxWords * 6.8),
        maxWords,
        role: 'concept',
        ensurePeriod: true,
      });
      if (fitted && fitted.length >= minChars && !hasDanglingEnding(fitted) && wc(fitted) < wc(res)) {
        return fitted;
      }
      return res;
    };

    const compactCenterDetail = (detail: string | undefined, fallbackTitle: string): string => {
      if (!detail) return fallbackTitle;
      let clean = extractDisciplinaryConceptPhrase(detail) || detail;
      clean = clean
        .replace(
          /,\s*(?:comprendiendo|identificando|analizando|sistematizando|calculando|empleando|utilizando|evaluando|validando|comprobando|verificando|organizando|permitiendo|garantizando|asegurando|aplicando|construyendo|estableciendo|determinando|reconociendo|desarrollando|promoviendo|fomentando|integrando|documentando|registrando|comparando|aprendes\s+a|comprendes|identificas|aplicas|analizas|calculas|cuantificas)\b.*$/i,
          ''
        )
        .replace(/[.,;:\s]+$/, '')
        .trim();
      const wc = clean.split(/\s+/).filter(Boolean).length;
      if (wc > 12 || clean.length < 10 || hasDanglingEnding(clean)) {
        return fallbackTitle;
      }
      return clean;
    };

    const tokenOverlapRatio = (a: string | undefined, b: string | undefined): number => {
      if (!a || !b) return 0;
      const ta = new Set(a.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2));
      const tb = new Set(b.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2));
      if (ta.size < 4 || tb.size < 4) return 0;
      let shared = 0;
      for (const w of ta) if (tb.has(w)) shared++;
      return shared / Math.min(ta.size, tb.size);
    };

    const compactStepSentence = (step: string): string => {
      let clean = step
        .replace(
          /^(?:Algoritmo,\s*f[oó]rmula\s+de\s+hoja\s+de\s+c[aá]lculo\s+o\s+estructura\s+l[oó]gica|Definici[oó]n\s+de\s+entradas,\s*variables\s+y\s+tipos|Pruebas?\s+de\s+escritorio\s+y\s+validaci[oó]n|Interpretaci[oó]n\s+y\s+comunicaci[oó]n\s+de\s+resultados|Ejecuci[oó]n\s+con\s+orden\s+y\s+registro\s+de\s+mediciones\/controles|Seguridad\s*\(EPP\/higiene\),\s*insumos\s+y\s+par[aá]metros\s+de\s+entrada|Planteamiento\s+del\s+problema|Desarrollo\s+del\s+procedimiento)\s*[:.]?\s+(?=.{20,})/i,
          ''
        )
        .trim();
      if (/^[a-záéíóúñ]/.test(clean)) clean = clean.charAt(0).toUpperCase() + clean.slice(1);
      // Separar oraciones pegadas tras cierre de paréntesis como "(7) Asegura..." cuando el paso excede 18 palabras
      if (clean.split(/\s+/).length > 18 && /\)\s+[A-ZÁÉÍÓÚÑ]/.test(clean)) {
        const beforeGlued = clean.split(/(?<=\))\s+(?=[A-ZÁÉÍÓÚÑ])/)[0]?.trim();
        if (beforeGlued && beforeGlued.length >= 24 && !hasDanglingEnding(beforeGlued)) {
          clean = `${beforeGlued.replace(/\.+$/, '')}.`;
        }
      }
      const sents = splitSpanishSentences(clean);
      if (sents.length >= 2 && clean.split(/\s+/).length > 16) {
        const key = sents.find((s) => /=/.test(s)) || sents.find((s) => /\d/.test(s)) || sents[0]!;
        if (key.length >= 20 && !hasDanglingEnding(key)) clean = key;
      }
      const trimmed = trimGerundTail(clean, 22, true) || clean;
      return trimmed.length >= 16 && !hasDanglingEnding(trimmed) ? trimmed : step;
    };

    const pruneConceptualDiagram = (
      diagram: SacrintDiagramSpec,
      maxNodes: number,
      slideTitle: string,
      problemRef?: string,
      explanationRef?: string,
      stepsRef?: string[]
    ): SacrintDiagramSpec => {
      if (!diagram.available) return diagram;
      const isRedundant = (detail: string | undefined): boolean =>
        tokenOverlapRatio(detail, problemRef) >= 0.5 ||
        tokenOverlapRatio(detail, explanationRef) >= 0.68 ||
        (stepsRef ?? []).some((st) => tokenOverlapRatio(detail, st) >= 0.6);
      switch (diagram.kind) {
        case 'concept': {
          const filtered = diagram.nodes
            .filter((n) => !isRedundant(n.detail))
            .slice(0, maxNodes)
            .map((n) => ({ ...n, detail: compactDetailSafe(n.detail, 18) }));
          return {
            ...diagram,
            center: { ...diagram.center, detail: compactCenterDetail(diagram.center.detail, slideTitle) },
            nodes:
              filtered.length > 0
                ? filtered
                : diagram.nodes.slice(0, 1).map((n) => ({ ...n, detail: '' })),
          };
        }
        case 'system-map': {
          const filtered = diagram.components
            .filter((c) => !isRedundant(c.detail))
            .slice(0, maxNodes)
            .map((c) => ({ ...c, detail: compactDetailSafe(c.detail, 18) }));
          return {
            ...diagram,
            center: { ...diagram.center, detail: compactCenterDetail(diagram.center.detail, slideTitle) },
            components:
              filtered.length > 0
                ? filtered
                : diagram.components.slice(0, 1).map((c) => ({ ...c, detail: '' })),
            environment:
              maxNodes <= 3
                ? { ...diagram.environment, detail: '' }
                : { ...diagram.environment, detail: compactDetailSafe(diagram.environment.detail, 18) },
          };
        }
        case 'block-diagram': {
          const inpDet = isRedundant(diagram.input.detail) ? '' : compactDetailSafe(diagram.input.detail, 18);
          const procDet = isRedundant(diagram.process.detail) ? '' : compactDetailSafe(diagram.process.detail, 18);
          const outDet =
            maxNodes <= 2 || isRedundant(diagram.output.detail) ? '' : compactDetailSafe(diagram.output.detail, 18);
          const fbDet = maxNodes <= 3 ? '' : compactDetailSafe(diagram.feedback.detail, 18);
          return {
            ...diagram,
            input: { ...diagram.input, detail: maxNodes <= 1 ? '' : inpDet },
            process: { ...diagram.process, detail: procDet },
            output: { ...diagram.output, detail: outDet },
            feedback: { ...diagram.feedback, detail: fbDet },
          };
        }
        case 'timeline':
          return {
            ...diagram,
            events: diagram.events
              .filter((e) => !isRedundant(e.detail))
              .slice(0, maxNodes)
              .map((e) => ({ ...e, detail: compactDetailSafe(e.detail, 18) })),
          };
        case 'language':
          return {
            ...diagram,
            input: {
              ...diagram.input,
              detail: maxNodes <= 1 || isRedundant(diagram.input.detail) ? '' : compactDetailSafe(diagram.input.detail, 18),
            },
            rule: { ...diagram.rule, detail: compactDetailSafe(diagram.rule.detail, 18) },
            output: {
              ...diagram.output,
              detail: maxNodes <= 2 || isRedundant(diagram.output.detail) ? '' : compactDetailSafe(diagram.output.detail, 18),
            },
            context: { ...diagram.context, detail: maxNodes <= 3 ? '' : compactDetailSafe(diagram.context.detail, 18) },
          };
        case 'argument': {
          const maxW = maxNodes <= 1 ? 10 : maxNodes === 2 ? 12 : 14;
          const nonRedundantPremises = diagram.premises
            .filter((pr) => Boolean(pr.detail?.trim()) && !isRedundant(pr.detail))
            .slice(0, maxNodes >= 3 ? 2 : 1)
            .map((pr) => ({ ...pr, detail: compactDetailSafe(pr.detail, 18, maxW) }));
          const keptPremises =
            nonRedundantPremises.length > 0
              ? nonRedundantPremises
              : diagram.premises
                  .filter((pr) => Boolean(pr.detail?.trim()))
                  .slice(0, 1)
                  .map((pr) => ({ ...pr, detail: compactDetailSafe(pr.detail, 18, maxW) }));
          return {
            ...diagram,
            thesis: { ...diagram.thesis, detail: compactCenterDetail(diagram.thesis.detail, slideTitle) },
            premises: keptPremises,
            objection: {
              ...diagram.objection,
              detail: maxNodes <= 1 ? '' : compactDetailSafe(diagram.objection.detail, 18, maxW),
            },
            conclusion: {
              ...diagram.conclusion,
              detail: compactDetailSafe(diagram.conclusion.detail, 18, maxW),
            },
          };
        }
        case 'sop-flow':
          return {
            ...diagram,
            steps: diagram.steps
              .filter((st) => !isRedundant(st.detail))
              .slice(0, maxNodes)
              .map((st) => ({ ...st, detail: compactDetailSafe(st.detail, 18, 14) })),
            standard: maxNodes <= 3 ? '' : diagram.standard,
          };
        case 'creative-cycle': {
          const maxW = maxNodes <= 1 ? 10 : maxNodes === 2 ? 11 : 12;
          const filtered = diagram.phases
            .filter((ph) => Boolean(ph.detail?.trim()) && !isRedundant(ph.detail))
            .slice(0, Math.min(4, Math.max(2, maxNodes)))
            .map((ph) => ({ ...ph, detail: compactDetailSafe(ph.detail, 18, maxW) }));
          const kept =
            filtered.length >= 2
              ? filtered
              : diagram.phases
                  .filter((ph) => Boolean(ph.detail?.trim()))
                  .slice(0, Math.min(3, Math.max(2, maxNodes)))
                  .map((ph) => ({ ...ph, detail: compactDetailSafe(ph.detail, 18, maxW) }));
          return {
            ...diagram,
            phases: kept,
            statement: maxNodes <= 3 || isRedundant(diagram.statement) ? '' : compactDetailSafe(diagram.statement, 18, 10),
          };
        }
        case 'training-cycle': {
          const maxW = maxNodes <= 1 ? 8 : maxNodes === 2 ? 9 : 10;
          const filtered = diagram.phases
            .filter((ph) => Boolean(ph.detail?.trim()) && !isRedundant(ph.detail))
            .slice(0, Math.min(4, Math.max(2, maxNodes)))
            .map((ph) => ({ ...ph, detail: compactDetailSafe(ph.detail, 18, maxW) }));
          const kept =
            filtered.length >= 2
              ? filtered
              : diagram.phases
                  .filter((ph) => Boolean(ph.detail?.trim()))
                  .slice(0, Math.min(3, Math.max(2, maxNodes)))
                  .map((ph) => ({ ...ph, detail: compactDetailSafe(ph.detail, 18, maxW) }));
          return {
            ...diagram,
            phases: kept,
            principle: maxNodes <= 3 || isRedundant(diagram.principle) ? '' : compactDetailSafe(diagram.principle, 18, 10),
          };
        }
        case 'regulation-flow': {
          const maxW = maxNodes <= 1 ? 8 : maxNodes === 2 ? 9 : 10;
          const filtered = diagram.stages
            .filter((st) => Boolean(st.detail?.trim()) && !isRedundant(st.detail))
            .slice(0, Math.min(4, Math.max(2, maxNodes)))
            .map((st) => ({ ...st, detail: compactDetailSafe(st.detail, 18, maxW) }));
          const kept =
            filtered.length >= 2
              ? filtered
              : diagram.stages
                  .filter((st) => Boolean(st.detail?.trim()))
                  .slice(0, Math.min(3, Math.max(2, maxNodes)))
                  .map((st) => ({ ...st, detail: compactDetailSafe(st.detail, 18, maxW) }));
          return {
            ...diagram,
            stages: kept,
            anchor: maxNodes <= 3 || isRedundant(diagram.anchor) ? '' : compactDetailSafe(diagram.anchor, 18, 10),
          };
        }
        case 'clinical-flow': {
          const maxW = maxNodes <= 1 ? 10 : maxNodes === 2 ? 12 : 13;
          const filtered = diagram.stages
            .filter((st) => Boolean(st.detail?.trim()) && !isRedundant(st.detail))
            .slice(0, Math.min(4, Math.max(2, maxNodes)))
            .map((st) => ({ ...st, detail: compactDetailSafe(st.detail, 18, maxW) }));
          const kept =
            filtered.length >= 2
              ? filtered
              : diagram.stages
                  .filter((st) => Boolean(st.detail?.trim()))
                  .slice(0, Math.min(3, Math.max(2, maxNodes)))
                  .map((st) => ({ ...st, detail: compactDetailSafe(st.detail, 18, maxW) }));
          return {
            ...diagram,
            stages: kept,
            note: maxNodes <= 3 || isRedundant(diagram.note) ? '' : compactDetailSafe(diagram.note, 18, 10),
          };
        }
        default:
          return diagram;
      }
    };

    const problemRef = seventhConcept.workedExample?.problemStatement;
    const stepsRef = seventhConcept.workedExample?.steps ?? [];
    const explanationRef =
      trimGerundTail(firstCompleteSentence(seventhConcept.explanation, 40), 40) ||
      firstCompleteSentence(seventhConcept.explanation, 40) ||
      seventhConcept.explanation;
    let eighthConcept: SacrintConceptSlide = {
      ...seventhConcept,
      activationNote: undefined,
      keyTakeaways: [],
      explanation: explanationRef,
      diagram: pruneConceptualDiagram(seventhConcept.diagram, 3, seventhConcept.title, problemRef, explanationRef, stepsRef),
      workedExample: seventhConcept.workedExample
        ? {
            ...seventhConcept.workedExample,
            steps: seventhConcept.workedExample.steps.map(compactStepSentence),
            interpretation:
              trimGerundTail(firstCompleteSentence(seventhConcept.workedExample.interpretation, 16), 16) ||
              firstCompleteSentence(seventhConcept.workedExample.interpretation, 16) ||
              seventhConcept.workedExample.interpretation,
          }
        : seventhConcept.workedExample,
    };
    if (countSlideWords(eighthConcept) <= 152) return eighthConcept;

    eighthConcept = {
      ...eighthConcept,
      diagram: pruneConceptualDiagram(eighthConcept.diagram, 2, eighthConcept.title, problemRef, explanationRef, stepsRef),
      workedExample: eighthConcept.workedExample
        ? {
            ...eighthConcept.workedExample,
            problemStatement:
              trimGerundTail(firstCompleteSentence(eighthConcept.workedExample.problemStatement, 30), 30) ||
              firstCompleteSentence(eighthConcept.workedExample.problemStatement, 30) ||
              eighthConcept.workedExample.problemStatement,
            steps: eighthConcept.workedExample.steps.slice(0, 2).map(compactStepSentence),
          }
        : eighthConcept.workedExample,
    };
    if (countSlideWords(eighthConcept) <= 164) return eighthConcept;

    const trimmedExp =
      eighthConcept.explanation.split(/\s+/).length > 20
        ? (() => {
            const m = eighthConcept.explanation.match(
              /^(.{40,}?)(?:\s+(?:para\s+(?:verificar|comprobar|determinar|identificar|analizar|evaluar|garantizar|asegurar|corroborar|fortalecer|generar|promover|fomentar)|por\s+medio\s+de\s+la\s+aplicaci[oó]n|al\s+posibilitar\s+que)\b|,\s+(?:diferenci[aá]ndose|fortaleciendo|promoviendo|fomentando|generando|contribuyendo)\b)/i
            );
            if (m && m[1]) {
              const cand = `${m[1].replace(/[.,;:\s]+$/, '').trim()}.`;
              if (cand.length >= 44 && !hasDanglingEnding(cand)) return cand;
            }
            return eighthConcept.explanation;
          })()
        : eighthConcept.explanation;

    const trimSubordinateStep = (step: string): string => {
      if (step.split(/\s+/).length <= 16) return step;
      const m = step.match(/^(.{24,}?)\s+que\s+(?:desv[ií]a|impide|afecta|limita|altera|provoca|genera|permite)\b/i);
      if (m && m[1]) {
        const cand = `${m[1].replace(/[.,;:\s]+$/, '').trim()}.`;
        if (cand.length >= 24 && !hasDanglingEnding(cand)) return cand;
      }
      return step;
    };

    const trimmedMisconception = (() => {
      const base =
        trimGerundTail(firstCompleteSentence(eighthConcept.misconception, 24), 24) ||
        eighthConcept.misconception;
      if (!base) return base;
      const stripped = base.replace(/^El\s+error\s+m[aá]s\s+(?:frecuente|com[uú]n)\s+es\s+/i, '').trim();
      return stripped.length >= 24
        ? `${stripped.charAt(0).toUpperCase()}${stripped.slice(1)}`
        : base;
    })();

    return {
      ...eighthConcept,
      explanation: trimmedExp,
      diagram: pruneConceptualDiagram(eighthConcept.diagram, 1, eighthConcept.title, problemRef, trimmedExp, stepsRef),
      misconception: trimmedMisconception,
      workedExample: eighthConcept.workedExample
        ? {
            ...eighthConcept.workedExample,
            steps: eighthConcept.workedExample.steps.map(trimSubordinateStep),
            interpretation:
              trimGerundTail(firstCompleteSentence(eighthConcept.workedExample.interpretation, 16), 16) ||
              eighthConcept.workedExample.interpretation,
          }
        : eighthConcept.workedExample,
    };
  }

  if (slide.kind === 'practice') {
    const first = {
      ...(slide as SacrintPracticeSlide),
      objectiveBullets: (slide.objectiveBullets ?? []).slice(0, 1),
      exitChecks: [],
      facts: [],
      checkpoints: [],
    } as SacrintPracticeSlide;
    if (countSlideWords(first) <= maxWords) return first;

    const sanitizeCriteriaList = (items: string[] | undefined, maxChars: number, maxWordsValue: number, limit: number): string[] => {
      const candidates = dedupe(
        (items ?? [])
          .slice(0, limit)
          .map((item) => {
            const baseItem = compactEvaluationCriterion(item);
            const fitted = fitPreserving(baseItem, maxChars, maxWordsValue, 'general', 24);
            if (fitted && isValidEvaluationCriterionItem(fitted)) return fitted;
            return isValidEvaluationCriterionItem(baseItem) && baseItem.length <= maxChars + 24 ? baseItem : '';
          })
          .filter(isValidEvaluationCriterionItem)
      );
      return candidates.length > 0
        ? candidates
        : ['Procedimiento ordenado y conclusión coherente con el planteamiento.'];
    };

    const second = {
      ...first,
      activities: (first.activities ?? []).slice(0, 2).map((activity) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 215, 35, false),
        hint: fitPreserving(activity.hint, 96, 16, 'hint', 22) || activity.hint,
      })),
      applicationText:
        fitPreserving(first.applicationText, 110, 18, 'application', 44) || first.applicationText,
      practiceText: '',
      objectiveBullets: (first.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => normalizeLearningObjective(item, { title: first.title, maxWords: 14, strict: false }) || item)
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria: sanitizeCriteriaList(first.evaluationCriteria, 106, 17, 2),
      artifactStep:
        fitPreserving(first.artifactStep, 100, 16, 'application', 34) || first.artifactStep,
    } as SacrintPracticeSlide;
    if (countSlideWords(second) <= maxWords) return second;

    const third = {
      ...second,
      activities: (second.activities ?? []).slice(0, 2).map((activity, idx) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 185, 30, false, (first.activities ?? [])[idx]?.statement ?? activity.statement),
        hint: fitPreserving(activity.hint, 88, 14, 'hint', 22) || activity.hint,
      })),
      applicationText:
        fitPreserving(second.applicationText, 96, 15, 'application', 44) || second.applicationText,
      objectiveBullets: (second.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => normalizeLearningObjective(item, { title: second.title, maxWords: 13, strict: false }) || item)
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria: sanitizeCriteriaList(second.evaluationCriteria, 104, 17, 1),
      artifactStep:
        fitPreserving(second.artifactStep, 90, 14, 'application', 34) || second.artifactStep,
    } as SacrintPracticeSlide;
    if (countSlideWords(third) <= maxWords) return third;

    const fourth = {
      ...third,
      activities: (third.activities ?? []).slice(0, 2).map((activity, idx) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 165, 27, false, (first.activities ?? [])[idx]?.statement ?? activity.statement),
        hint: fitPreserving(activity.hint, 78, 13, 'hint', 22) || activity.hint,
      })),
      applicationText:
        fitPreserving(third.applicationText, 84, 14, 'application', 44) || third.applicationText,
      objectiveBullets: (third.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => normalizeLearningObjective(item, { title: third.title, maxWords: 12, strict: false }) || item)
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria: sanitizeCriteriaList(third.evaluationCriteria, 100, 16, 1),
      artifactStep:
        fitPreserving(third.artifactStep, 80, 12, 'application', 32) || third.artifactStep,
    } as SacrintPracticeSlide;
    if (countSlideWords(fourth) <= 136) return fourth;

    const fifth = {
      ...fourth,
      activities: (fourth.activities ?? []).slice(0, 2).map((activity, idx) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 155, 26, false, (first.activities ?? [])[idx]?.statement ?? activity.statement),
        hint: fitPreserving(activity.hint, 68, 11, 'hint', 20) || activity.hint,
      })),
      applicationText:
        fitPreserving(fourth.applicationText, 72, 12, 'application', 44) || fourth.applicationText,
      objectiveBullets: (fourth.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => normalizeLearningObjective(item, { title: fourth.title, maxWords: 11, strict: false }) || item)
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria: sanitizeCriteriaList(fourth.evaluationCriteria, 96, 16, 1),
      artifactStep:
        fitPreserving(fourth.artifactStep, 70, 11, 'application', 30) || fourth.artifactStep,
    } as SacrintPracticeSlide;
    if (countSlideWords(fifth) <= 138) return fifth;

    // Etapa 6 segura: si aún excede 138 palabras de cuerpo (~174 en PPTX),
    // compactar frases narrativas secundarias en actividades (permitiendo condensación de enumeraciones largas)
    // y acortar pistas largas sin tocar nunca ecuaciones, datos clave ni la pregunta central.
    const sixth = {
      ...fifth,
      activities: (fifth.activities ?? []).slice(0, 2).map((activity, idx) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 145, 24, true, (first.activities ?? [])[idx]?.statement ?? activity.statement),
        hint: fitPreserving(activity.hint, 62, 10, 'hint', 20) || activity.hint,
      })),
      applicationText:
        fitPreserving(fifth.applicationText, 64, 10, 'application', 44) || fifth.applicationText,
      artifactStep:
        fitPreserving(fifth.artifactStep, 64, 10, 'application', 30) || fifth.artifactStep,
    } as SacrintPracticeSlide;
    if (countSlideWords(sixth) <= 140) return sixth;

    // Respaldo final determinista: si las 2 actividades juntas todavía superan 186w,
    // condensar cláusulas explicativas largas dentro de cada enunciado sin borrar datos ni consigna.
    const condenseNarrativeClauses = (statement: string): string => {
      const condensed = statement
        .replace(/\bElabora en tu (?:cuaderno|libreta) una argumentaci[oó]n de tres puntos donde expliques el significado de la pendiente,\s*la interpretaci[oó]n de los interceptos en los ejes coordenados y la validez de una soluci[oó]n espec[ií]fica para\b/gi, 'Argumenta la pendiente, los interceptos y la solución para')
        .replace(/\bRedacta los argumentos que dar[aá]s al grupo para justificar el impacto de\b/gi, 'Justifica el impacto de')
        .replace(/\bSi (?:el n[uú]mero|la cantidad) de ([^,]{4,40}) debe ser (?:exactamente )?el triple (?:del n[uú]mero|de la cantidad) de ([^,]{4,40}),\s*/gi, 'Si hay el triple de $1 que de $2, ')
        .replace(/\bSi (?:por|para) cada ([^,]{3,30}) se deben comprar dos ([^,]{3,30}) debido al dise[ñn]o de la instalaci[oó]n,\s*es decir,\s*/gi, 'Si se cumple ')
        .replace(/\b(?:mediante|por medio de)\s+el despeje algebraico cu[aá]ntas unidades de cada componente se adquirir[aá]n\b/gi, 'cuántas unidades de cada componente se comprarán')
        .replace(/\bpor medio del despeje algebraico cu[aá]ntas unidades de cada componente se adquirir[aá]n\b/gi, 'cuántas unidades de cada componente se comprarán')
        .replace(/\b(?:plantea|formula) la ecuaci[oó]n lineal,\s*(?:realiza|efect[uú]a) el despeje y (?:calcula|halla) cu[aá]ntas unidades de cada art[ií]culo se comprar[aá]n\b/gi, 'formula la ecuación y halla cuántas unidades de cada artículo se comprarán')
        .replace(/\b(?:Integra|Incorpora) en tu libreta el an[aá]lisis de una situaci[oó]n donde\b/gi, 'Analiza este caso:')
        .replace(/\bdonde el per[ií]metro y las proporciones exigen que el largo sea igual al ancho incrementado en\b/gi, 'donde el largo excede al ancho en')
        .replace(/\bresu[eé]lvela completando el trinomio cuadrado perfecto y (?:redacta|escribe) las dimensiones finales del espacio deportivo\b/gi, 'resuélvela completando el cuadrado y determina las dimensiones')
        .replace(/\b(?:construye|elabora) una (?:tabla de valores|tabulaci[oó]n)(?: rigurosa)? para\b/gi, 'tabula para')
        .replace(/\bdepura la tabulaci[oó]n para\b/gi, 'tabula para')
        .replace(/\b(?:dibuja|traza) la gr[aá]fica en tu (?:cuaderno|libreta) y responde:\s*/gi, 'grafica y responde: ')
        .replace(/\b(?:requerido|necesario) para equipar una zona deportiva recreativa por medio de la ecuaci[oó]n\b/gi, 'con la ecuación')
        .replace(/\bde organizar talleres juveniles de prevenci[oó]n por medio de la ecuaci[oó]n\b/gi, 'de talleres con la ecuación')
        .replace(/\b(?:considerando|sabiendo) que dispone de\b/gi, 'con')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return condensed.length >= 55 && hasActivityTask(condensed) && !hasDanglingEnding(condensed) ? condensed : statement;
    };
    const seventh = {
      ...sixth,
      activities: (sixth.activities ?? []).slice(0, 2).map((activity, idx) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(
          condenseNarrativeClauses(activity.statement),
          145,
          24,
          true,
          (first.activities ?? [])[idx]?.statement ?? activity.statement
        ),
      })),
    } as SacrintPracticeSlide;
    if (countSlideWords(seventh) <= 130) return seventh;

    // Etapa 8 arquitectónica (práctica): compactar por ORACIÓN COMPLETA / CLÁUSULA SUBORDINADA AUTÓNOMA / BLOQUE OPCIONAL,
    // sin amputar nunca una consigna ni sus datos numéricos, y SIN usar nunca el título como objetivo.
    const compactObjectiveBullet = (bullet: string, slideTitle: string): string => {
      const normalized = normalizeLearningObjective(bullet, {
        title: slideTitle,
        maxWords: 12,
        strict: false,
      });
      if (normalized) return normalized;
      const wider = normalizeLearningObjective(bullet, {
        title: slideTitle,
        maxWords: 16,
        strict: false,
      });
      return wider || bullet;
    };

    const firstSentenceSafe = (text: string | undefined, minChars: number, trimRelative = false): string | undefined => {
      if (!text) return text;
      const sents = splitSpanishSentences(text);
      const firstSent = sents[0]?.trim();
      let base = firstSent && firstSent.length >= minChars && !hasDanglingEnding(firstSent) ? firstSent : text;
      const gerundCut = base.match(
        /^(.{24,}?),\s+(?:incluyendo|incorporando|validando|garantizando|asegurando|permitiendo|posibilitando|facilitando|mostrando|detallando|explicando|considerando|evaluando|demostrando|documentando|registrando|analizando|identificando|sistematizando|calculando|verificando|comparando|aplicando|integrando|que\s+(?:incorpora|incluye|contiene|detalla)|con\s+el\s+fin\s+de|para\s+(?:su\s+posterior|construir\s+un|asegurar|garantizar|validar|corroborar))\b/i
      );
      if (gerundCut && gerundCut[1]) {
        const cleanBase = `${gerundCut[1].replace(/[.,;:\s]+$/, '').trim()}.`;
        if (cleanBase.length >= minChars && !hasDanglingEnding(cleanBase)) base = cleanBase;
      }
      if (trimRelative && base.split(/\s+/).length > 15) {
        const relCut = base.match(
          /^(.{28,}?)(?:,\s+(?:con\s+las\s+firmas|el\s+c[aá]lculo|la\s+tabla|los\s+c[aá]lculos|como\s+(?:el|la|los|las|un|una)|empleando|resaltando|discutiendo|seleccionando)\b|\s+(?:que\s+(?:incluya|contenga|detalle|incorpore|explique|muestre|integre|presente|permita)|donde\s+(?:compares|registres|expliques|identifiques|documentes|incluyas|detalles|analices|integres|se[ñn]ales|muestres|resumas)|completad[oa]\s+con\b|requerid[oa]s?\s+para\s+un\b|necesari[oa]s?\s+para\s+un\b|con\s+los\s+valores\b|antes\s+y\s+tras\b|y\s+la\s+resoluci[oó]n\b|y\s+el\s+c[aá]lculo\b|con\s+la\s+identificaci[oó]n\s+clara\s+de|(?:analizando|documentando|realizando|demostrando|identificando|registrando|verificando|evaluando|comparando|aplicando|integrando|sistematizando|seleccionando|discutiendo|organizando|al\s+diagnosticar)\s+(?:c[oó]mo|el|la|los|las|un|una|cada|en)|para\s+(?:ofrecer|modelar|determinar|encontrar|validar|garantizar|asegurar|corroborar|evaluar|analizar|estimar|revisar|definir|ajustar|comparar|discutir))\b)/i
        );
        if (relCut && relCut[1]) {
          const cleanRel = `${relCut[1].replace(/[.,;:\s]+$/, '').trim()}.`;
          if (cleanRel.length >= minChars && !hasDanglingEnding(cleanRel)) base = cleanRel;
        }
        if (base.split(/\s+/).length > 18) {
          const tailCut = base.match(/^(.{36,}?)(?:\s+(?:requerid[oa]s?|necesari[oa]s?)\s+para\s+un\b|,\s+como\s+(?:un|una|el|la)\b)/i);
          if (tailCut && tailCut[1]) {
            const cleanTail = `${tailCut[1].replace(/[.,;:\s]+$/, '').trim()}.`;
            if (cleanTail.length >= minChars && !hasDanglingEnding(cleanTail)) base = cleanTail;
          }
        }
      }
      return base;
    };

    const trimActivityByCompleteSentences = (statement: string, original: string): string => {
      const sents = splitSpanishSentences(statement);
      if (sents.length <= 1) return statement;
      const mathToks = (t: string) => t.match(/\d+(?:[.,]\d+)?|=/g) ?? [];
      const hasAnaphora = (t: string) =>
        /\b(?:este\s+t[eé]rmino|est[ea]s?\s+[a-záéíóúñ]+|dich[oa]s?|lo\s+anterior|amb[oa]s)\b/i.test(t);
      const isScenarioLead = (t: string) => /^(?:Simula|Imagina|Sup[oó]n)\b/i.test(t.trim());

      // Conservar siempre oraciones con datos numéricos/ecuaciones NUEVOS o citas + la oración principal de consigna
      // (Evitar retener oraciones finales redundantes que solo repiten números ya dados cuando lo previo ya tiene tarea completa)
      const dataIdxs = new Set<number>();
      const seenNums = new Set<string>();
      sents.forEach((s, i) => {
        const toks = mathToks(s);
        const hasNewToken = toks.some((t) => !seenNums.has(t));
        const hasQuote = /['"«][^'"»]{6,}['"»]/.test(s);
        if ((toks.length > 0 && (i === 0 || hasNewToken)) || hasQuote) {
          dataIdxs.add(i);
          for (const t of toks) seenNums.add(t);
        }
      });
      // Encontrar primera oración con consigna válida (regla C) y primera pregunta
      const qIdx = sents.findIndex((s) => /\?/.test(s));
      const firstTaskIdx = sents.findIndex((s) => hasActivityTask(s));
      const keepIdxs = new Set<number>(dataIdxs);
      if (qIdx >= 0) keepIdxs.add(qIdx);
      if (firstTaskIdx === 0) keepIdxs.add(0);
      if (firstTaskIdx >= 0 && [...keepIdxs].every((i) => !hasActivityTask(sents[i]!))) {
        keepIdxs.add(firstTaskIdx);
      }
      if (keepIdxs.size === 0) keepIdxs.add(0);
      const sorted = [...keepIdxs].sort((a, b) => a - b);
      if (sorted[0]! > 0 && (hasAnaphora(sents[sorted[0]!]!) || sorted.map((i) => sents[i]!).join(' ').length < 60)) {
        sorted.unshift(0);
      }
      if (sorted.length === 1 && sorted[0] === 0 && sents.length >= 2 && isScenarioLead(sents[0]!)) {
        sorted.push(1);
      }
      const joined = sorted.map((i) => sents[i]!).join(' ').trim();
      if (
        joined.length < statement.length &&
        joined.length >= 55 &&
        hasActivityTask(joined) &&
        !hasDanglingEnding(joined) &&
        isPublishablePedagogicalText(joined, 'activity', original) &&
        !isTruncatedAgainstSource(joined, original)
      ) {
        return joined;
      }
      // Fallback: descartar solo la última oración si sus números ya están presentes en lo previo (o no aporta números nuevos) y lo previo ya tiene tarea completa
      const withoutLast = sents.slice(0, -1).join(' ').trim();
      const lastMathToks = mathToks(sents[sents.length - 1]!);
      const lastOnlyRepeatsNums =
        lastMathToks.length === 0 ||
        (lastMathToks.every((t) => t !== '=' && withoutLast.includes(t)) && !/=/.test(sents[sents.length - 1]!));
      if (
        sents.length >= 2 &&
        !(sents.length === 2 && isScenarioLead(sents[0]!)) &&
        lastOnlyRepeatsNums &&
        withoutLast.length >= 55 &&
        hasActivityTask(withoutLast) &&
        !hasDanglingEnding(withoutLast) &&
        isPublishablePedagogicalText(withoutLast, 'activity', original) &&
        !isTruncatedAgainstSource(withoutLast, original)
      ) {
        return withoutLast;
      }
      return statement;
    };

    const practiceOverlap = (a: string | undefined, b: string | undefined): number => {
      if (!a || !b) return 0;
      const ta = new Set(a.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2));
      const tb = new Set(b.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2));
      if (ta.size < 4 || tb.size < 4) return 0;
      let shared = 0;
      for (const w of ta) if (tb.has(w)) shared++;
      return shared / Math.min(ta.size, tb.size);
    };

    const cleanArtName = (seventh.artifactName || '').trim().replace(/\.+$/, '');
    const compactedApp = firstSentenceSafe(seventh.applicationText, 36, true) || seventh.applicationText;
    const rawCompactedArtifact = firstSentenceSafe(seventh.artifactStep, 24, true) || seventh.artifactStep;
    const compactedArtifact =
      practiceOverlap(compactedApp, rawCompactedArtifact) >= 0.72
        ? 'Registra este avance en tu evidencia.'
        : rawCompactedArtifact;

    const compactedObjective = (seventh.objectiveBullets ?? [])
      .slice(0, 1)
      .map((item) => compactObjectiveBullet(item, seventh.title));

    let eighth: SacrintPracticeSlide = {
      ...seventh,
      objectiveBullets: compactedObjective,
      applicationText: compactedApp,
      artifactStep: compactedArtifact,
      evaluationCriteria: (seventh.evaluationCriteria ?? []).slice(0, 1),
      activities: (seventh.activities ?? []).slice(0, 2).map((activity, idx) => ({
        ...activity,
        hint: idx === 1 ? '' : firstSentenceSafe(activity.hint, 18) || '',
      })),
    };
    if (countSlideWords(eighth) <= 146) return eighth;

    // Si aún supera 186 palabras (visible + 64 chrome ≈ 156 palabras en PPTX),
    // omitir pista opcional en Act 1, evitar repetir el nombre largo del producto integrador en artifactStep,
    // y compactar actividades por oración completa sin amputar datos ni consignas.
    const tightArtifactStep =
      (eighth.artifactStep || '').split(/\s+/).length > 14
        ? 'Registra este avance en tu evidencia.'
        : eighth.artifactStep;
    eighth = {
      ...eighth,
      artifactStep: tightArtifactStep,
      activities: (eighth.activities ?? []).slice(0, 2).map((activity, idx) => ({
        ...activity,
        statement: trimActivityByCompleteSentences(
          activity.statement,
          (first.activities ?? [])[idx]?.statement ?? activity.statement
        ),
        hint: '',
      })),
    };
    if (countSlideWords(eighth) <= 148) return eighth;

    const trimRedundantBlockTail = (text: string | undefined, minChars: number): string | undefined => {
      if (!text) return text;
      const trimmed = text
        .replace(/\s+(?:de\s+tu\s+proyecto\s+del\s+bloque|en\s+este\s+bloque|para\s+revisar\s+los\s+avances\s+del\s+proyecto)\s*([.?]?)$/i, '$1')
        .trim();
      return trimmed.length >= minChars && !hasDanglingEnding(trimmed) ? trimmed : text;
    };

    const tightObjective = (eighth.objectiveBullets ?? [])
      .slice(0, 1)
      .map(
        (item) =>
          normalizeLearningObjective(item, { title: eighth.title, maxWords: 9, strict: false }) ||
          compactObjectiveBullet(item, eighth.title)
      );
    const tightApp =
      fitPreserving(trimRedundantBlockTail(eighth.applicationText, 36), 80, 12, 'application', 36) ||
      trimRedundantBlockTail(eighth.applicationText, 36) ||
      eighth.applicationText;
    const tightCriteria = (eighth.evaluationCriteria ?? [])
      .slice(0, 1)
      .map(
        (c) =>
          fitPreserving(trimRedundantBlockTail(c, 22), 74, 11, 'general', 22) ||
          trimRedundantBlockTail(c, 22) ||
          c
      );

    let compactArtName = (extractDisciplinaryConceptPhrase(cleanArtName) || cleanArtName)
      .split(/[:—–]/)[0]!
      .replace(/^['"«]+|['"»]+$/g, '')
      .replace(/\s*\([A-Z]{3,8}\)\s*$/, '')
      .replace(/\s+(?:para\s+el\s+bienestar|en\s+espacios|de\s+calidad|comunitari[oa]s?)\b.*$/i, '')
      .replace(/\.+$/, '')
      .trim();
    if (compactArtName.split(/\s+/).length > 5 && /\s+y\s+/i.test(compactArtName)) {
      const beforeY = compactArtName.split(/\s+y\s+/i)[0]!.trim();
      if (beforeY.length >= 12 && !hasDanglingEnding(beforeY)) {
        compactArtName = beforeY;
      }
    }

    const ninth: SacrintPracticeSlide = {
      ...eighth,
      objectiveBullets: tightObjective,
      applicationText: tightApp,
      evaluationCriteria: tightCriteria,
      artifactStep: 'Registra este avance en tu evidencia.',
      artifactName: compactArtName.length >= 10 ? compactArtName : cleanArtName.replace(/\.+$/, ''),
    };
    if (countSlideWords(ninth) <= 144) return ninth;

    // Si aún supera 144 palabras (visible + 64 chrome), compactar exclusivamente cláusulas accesorias
    // en aplicación real y en el objetivo (manteniendo siempre infinitivo + objeto y actividades íntegras).
    const compactAppClause = (text: string | undefined): string | undefined => {
      if (!text) return text;
      const cut = text
        .replace(/,\s*(?:afectando|garantizando|asegurando|permitiendo|integrando|validando|considerando|relacionando|bas[aá]ndose|vinculando|reflejando|fomentando|promoviendo|mostrando)\b.*$/i, '.')
        .replace(/\s+(?:que\s+ayude\s+a\s+|por\s+medio\s+de\s+una?\s+|mediante\s+una?\s+|y\s+las\s+validaciones\s+f[ií]sicas|dise[ñn]ad[oa]s?\s+para\s+tu\s+localidad|en\s+papel\s+bond)\b.*$/i, '.')
        .replace(/\.\.+$/, '.')
        .trim();
      return cut.length >= 36 && !hasDanglingEnding(cut) ? cut : text;
    };

    const compactLongObjective = (item: string): string => {
      const normalized = normalizeLearningObjective(item, { title: ninth.title, maxWords: 8, strict: false }) || item;
      if (normalized.split(/\s+/).filter(Boolean).length <= 12) return normalized;
      const trimmed = normalized
        .replace(/\s+(?:aplicando|analizando|utilizando|considerando|evaluando|mediante)\b.*$/i, '')
        .replace(/[.,;:\s]+$/, '')
        .trim();
      return trimmed.length >= 24 && !hasDanglingEnding(trimmed) ? trimmed : normalized;
    };

    const tenth: SacrintPracticeSlide = {
      ...ninth,
      artifactStep: 'Registra el avance.',
      applicationText:
        compactAppClause(
          fitPreserving(ninth.applicationText, 62, 9, 'application', 36) || ninth.applicationText
        ) || ninth.applicationText,
      evaluationCriteria: (ninth.evaluationCriteria ?? [])
        .slice(0, 1)
        .map((c) => fitPreserving(c, 58, 9, 'general', 22) || c),
      objectiveBullets: (ninth.objectiveBullets ?? [])
        .slice(0, 1)
        .map(compactLongObjective),
    };
    // countSlideWords incluye +64 chrome (PPTX real añade ~44 chrome): > 202 equivale a > ~182 palabras reales en PPTX.
    if (countSlideWords(tenth) <= 202) return tenth;

    // Etapa 10 (solo si la diapositiva 2/2 aún excede el presupuesto duro de ~195 palabras en PPTX):
    // compactar enunciados de actividades muy extensas preservando siempre la ecuación (=), verbo de tarea y ≥ 60 caracteres.
    const compactVerboseActivity = (
      statement: string,
      original: string,
      maxWords: number
    ): string => {
      const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
      if (wordCount(statement) <= maxWords) return statement;
      const mustKeepEq = /=/.test(original);
      const isValidCandidate = (cand: string): boolean => {
        const cleanCand = cand.replace(/\s+/g, ' ').trim();
        if (cleanCand.length < 60 || cleanCand.length >= statement.length) return false;
        if (mustKeepEq && !/=/.test(cleanCand)) return false;
        if (hasDanglingEnding(cleanCand)) return false;
        return hasActivityTask(cleanCand) && isPublishablePedagogicalText(cleanCand, 'activity', original);
      };

      // 1) Descartar oraciones secundarias finales (reflexión/formato/caso alterno) mientras lo previo mantenga tarea y ecuación.
      const sents = statement
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (let end = sents.length - 1; end >= 1; end -= 1) {
        const prefix = sents.slice(0, end).join(' ').trim();
        if (isValidCandidate(prefix) && wordCount(prefix) <= maxWords + 4) {
          return prefix;
        }
      }
      if (sents.length >= 2) {
        const withoutLast = sents.slice(0, -1).join(' ').trim();
        if (isValidCandidate(withoutLast)) {
          statement = withoutLast;
          if (wordCount(statement) <= maxWords) return statement;
        }
      }

      // 2) Quitar preámbulos narrativos extensos, incisos parentéticos o cláusulas accesorias finales preservando todos los datos y la consigna.
      const stripPreamble = (s: string): string => {
        const stripped = s
          .replace(
            /^(?:A\s+lo\s+largo\s+de|Durante\s+el\s+desarrollo\s+de|En\s+el\s+marco\s+de|Como\s+parte\s+de)\s+[^,]{15,95},\s+(?:(?:un|una)\s+estudiante\s+(?:mide|observa|registra)\s+que\s+)?/i,
            ''
          )
          .trim();
        return stripped ? `${stripped.charAt(0).toUpperCase()}${stripped.slice(1)}` : s;
      };
      const stripFillers = (s: string): string =>
        s
          .replace(/\s+(?:empleado\s+en\s+el\s+aula\s+experimental|por\s+medio\s+de\s+un\s+mecanismo\s+de\s+poleas|para\s+completar\s+la\s+elevaci[oó]n|a\s+lo\s+largo\s+del\s+recorrido|de\s+la\s+aplicaci[oó]n\s+tecnol[oó]gica|en\s+el\s+sistema|a\s+lo\s+largo\s+del\s+transcurso\s+del\s+d[ií]a\s+en\s+tu\s+entorno|desde\s+una\s+fuente\s+externa\s+hacia\s+el\s+sistema\s+del\s+recipiente)\b/gi, '')
          .replace(/\s+,/g, ',')
          .replace(/\s{2,}/g, ' ')
          .trim();

      const clauseTrims = [
        stripPreamble(statement),
        stripFillers(stripPreamble(statement)),
        statement.replace(/\s*\([^)]{18,}\)/g, '').replace(/\s{2,}/g, ' ').trim(),
        statement
          .replace(/;\s*(?:posteriormente|despu[eé]s|luego|finalmente|adem[aá]s|asimismo)\b[^.?!]*([.?!]?)$/i, '$1')
          .replace(/,\s*(?:explicando|justificando|argumentando|considerando|indicando|asegurando|verificando|detallando|integrando|comparando)\b[^.?!]*([.?!]?)$/i, '$1')
          .trim(),
        statement
          .replace(/\s+y\s+(?:escribe|redacta|detalla|explica|justifica|argumenta|describe|compara|reflexiona)\s+(?:brevemente|un\s+argumento|por\s+qu[eé]|c[oó]mo|en\s+un\s+p[aá]rrafo|en\s+tu\s+cuaderno)[^.?!]*([.?!]?)$/i, '$1')
          .trim(),
      ];
      for (const rawCand of clauseTrims) {
        const cand = /[.?!]$/.test(rawCand) ? rawCand : `${rawCand}.`;
        if (isValidCandidate(cand)) {
          statement = cand;
          if (wordCount(statement) <= maxWords) return statement;
        }
      }
      return statement;
    };

    let compactedPractice: SacrintPracticeSlide = tenth;
    for (const targetActWords of [48, 40, 34]) {
      if (countSlideWords(compactedPractice) <= 202) break;
      compactedPractice = {
        ...compactedPractice,
        activities: (compactedPractice.activities ?? []).map((activity, idx) => ({
          ...activity,
          statement: compactVerboseActivity(
            activity.statement,
            (first.activities ?? [])[idx]?.statement ?? activity.statement,
            targetActWords
          ),
        })),
      };
    }
    return compactedPractice;
  }

  return slide;
}
