import type { MissionSection, SessionPlan } from '@/types/work-textbook';
import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import { hasDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import type {
  CreativeCycleDiagramSpec,
  DiagramBuildOptions,
  RegulationFlowDiagramSpec,
  SacrintDiagramNode,
  TrainingCycleDiagramSpec,
} from '../types';
import { sanitizePedagogicalMetaPhrases } from '../text/grammar-normalization';
import {
  buildDistinctSessionCycleSources,
  detail,
  normalizedDiagramOverlap,
  stripSessionLead,
} from './shared';

const CREATIVE_PHASE_LABELS = ['DETONANTE', 'EXPLORACIÓN', 'OBRA', 'DIFUSIÓN'];

export function buildCreativeCycleDiagram(
  mission: MissionSection,
  options: DiagramBuildOptions = {}
): CreativeCycleDiagramSpec {
  const { sources, isLessonGuide } = buildDistinctSessionCycleSources(mission, options);
  const phases = sources.map((text, index) => ({
    label: CREATIVE_PHASE_LABELS[index] ?? `FASE ${index + 1}`,
    detail: text || '',
  }));

  return {
    kind: 'creative-cycle',
    available: phases.filter((phase) => Boolean(phase.detail)).length >= 2,
    phases,
    // En pizarrón docente (lesson-guide) omitir la franja inferior redundante para no duplicar conclusión/DIFUSIÓN ni inflar palabras.
    statement: isLessonGuide
      ? ''
      : detail(
          mission.conceptZero?.solvedExample?.interpretation || mission.conceptZero?.contrastTable?.[0]?.correctConcept,
          140,
          ''
        ),
  };
}

const TRAINING_PHASE_LABELS = ['CALENTAMIENTO', 'ACTIVACIÓN', 'ESFUERZO', 'RECUPERACIÓN'];
const TRAINING_DIDACTIC_LABELS = ['DIAGNÓSTICO', 'CRITERIO', 'APLICACIÓN', 'MEJORA'];
const REGULATION_STAGE_LABELS = ['EMOCIÓN', 'INTERPRETACIÓN', 'RESPUESTA', 'REGULACIÓN'];
const REGULATION_DIDACTIC_LABELS = ['SITUACIÓN', 'ANÁLISIS', 'ACCIÓN', 'BIENESTAR'];

type DomainStageRule = {
  label: string;
  match: RegExp;
  reject?: RegExp;
};

const TRAINING_PROTOCOL_RULES: DomainStageRule[] = [
  {
    label: 'CALENTAMIENTO',
    match: /\b(?:calentamiento|movilidad\s+articular|entrada\s+en\s+calor|estiramiento\s+din[aá]mico|preparaci[oó]n\s+articular)\b/i,
  },
  {
    label: 'ACTIVACIÓN',
    match: /\b(?:activaci[oó]n\s+(?:f[ií]sica|cardiovascular|muscular)|frecuencia\s+(?:card[ií]aca\s+)?basal|ppm\s+basal|pulso\s+basal|trote\s+suave)\b/i,
  },
  {
    label: 'ESFUERZO',
    match: /\b(?:circuito\s+motor|esfuerzo\s+(?:f[ií]sico|percibido)|intensidad|escala\s+de\s+borg|carga\s+f[ií]sica|series|repeticiones|ppm\s+finales)\b/i,
    reject: /^(?:entrega|elabora|redacta|tu\s+producto)\b.*\b(?:reporte|matriz|bit[aá]cora|cuestionario)\b/i,
  },
  {
    label: 'RECUPERACIÓN',
    match: /\b(?:vuelta\s+a\s+la\s+calma|recuperaci[oó]n|estiramiento(?:s)?|hidrataci[oó]n|respiraci[oó]n\s+profunda|normalizaci[oó]n|enfriamiento)\b/i,
  },
];

const REGULATION_PROTOCOL_RULES: DomainStageRule[] = [
  {
    label: 'EMOCIÓN',
    match: /\b(?:emoci[oó]n|emociones|sentimient|estr[eé]s|ansiedad|enojo|ira|frustraci[oó]n|miedo|tristeza|alegr[ií]a|estado\s+de\s+[aá]nimo)\b/i,
  },
  {
    label: 'INTERPRETACIÓN',
    match: /\b(?:interpretaci[oó]n|interpreta|pensamient|creencia|valoraci[oó]n|percib|evaluaci[oó]n\s+cognitiva|juicio)\b/i,
  },
  {
    label: 'RESPUESTA',
    match: /\b(?:respuesta|reacci[oó]n|conducta|comunicaci[oó]n\s+asertiva|comportamiento|actuar\s+con)\b/i,
    reject: /^(?:entrega|elabora|redacta|tu\s+producto)\b.*\b(?:reporte|matriz|bit[aá]cora|cuestionario|cartel)\b/i,
  },
  {
    label: 'REGULACIÓN',
    match: /\b(?:regulaci[oó]n|autocontrol|calma|respiraci[oó]n|equilibrio\s+emocional|bienestar\s+emocional|afrontamiento|manejo\s+emocional|pausa\s+activa)\b/i,
  },
];

function tryExtractDomainAlignedNodes(
  session: SessionPlan,
  rules: DomainStageRule[]
): SacrintDiagramNode[] | null {
  const cleanField = (val?: string | null) =>
    sanitizePedagogicalMetaPhrases(stripSessionLead(val || ''));
  const vMap = session.sintesisVisual?.mapaConceptual;
  const leftRefs = [
    cleanField(session.sintesisVisual?.conceptoBreve),
    cleanField(session.sintesisVisual?.ejemploBreve?.planteamiento),
    cleanField(session.sintesisVisual?.ejemploBreve?.conclusion),
    ...(session.sintesisVisual?.ejemploBreve?.pasos ?? []).map(cleanField),
  ].filter(Boolean);

  const rawPool = [
    cleanField(session.contenido),
    cleanField(session.aplicacion),
    cleanField(vMap?.criterioDesarrollo),
    cleanField(vMap?.correccionBreve),
    cleanField(session.saberesPrevios),
    cleanField(session.motivacion),
  ]
    .filter(Boolean)
    .flatMap((block) => splitSpanishSentences(block))
    .map((sent) => sent.trim())
    .filter((sent) => sent.length >= 18 && !/^¿/.test(sent));

  const compactMatch = (sent: string): string => {
    const base = detail(sent, 96, '') || sent;
    const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
    if (wc(base) <= 14 && !hasDanglingEnding(base)) return base;
    const trimmed = base
      .replace(/\s+(?:para\s+(?:preparar|favorecer|garantizar|asegurar|mejorar|evitar)|entre\s+niveles|antes\s+de\s+comenzar)\b[^.?!]*([.?!]?)$/i, '.')
      .replace(/\.\.+$/, '.')
      .trim();
    if (trimmed.length >= 20 && !hasDanglingEnding(trimmed) && wc(trimmed) <= 15) {
      return trimmed;
    }
    const fitted = fitPedagogicalText(base, {
      maxChars: 96,
      maxWords: 15,
      role: 'concept',
      ensurePeriod: true,
    });
    if (fitted && fitted.length >= 18 && !hasDanglingEnding(fitted) && wc(fitted) <= 16) {
      return fitted;
    }
    return wc(base) <= 22 ? base : '';
  };

  const used: string[] = [];
  const matched: SacrintDiagramNode[] = [];
  for (const rule of rules) {
    let picked = '';
    for (const rawSent of rawPool) {
      if (!rule.match.test(rawSent)) continue;
      if (rule.reject && rule.reject.test(rawSent)) continue;
      const cand = compactMatch(rawSent);
      if (!cand || cand.length < 16) continue;
      // Revalidar que tras compactar el texto conserve la señal semántica de la etiqueta
      if (!rule.match.test(cand)) continue;
      if (rule.reject && rule.reject.test(cand)) continue;
      if (used.some((u) => normalizedDiagramOverlap(cand, u) >= 0.6)) continue;
      if (leftRefs.some((r) => normalizedDiagramOverlap(cand, r) >= 0.72)) continue;
      picked = cand;
      break;
    }
    if (picked) {
      used.push(picked);
      matched.push({ label: rule.label, detail: picked });
    }
  }
  return matched.length >= 3 ? matched : null;
}

export function buildTrainingCycleDiagram(
  mission: MissionSection,
  options: DiagramBuildOptions = {}
): TrainingCycleDiagramSpec {
  const isLessonGuide = options.allowMissionFallback === false && Boolean(options.session);
  if (isLessonGuide && options.session) {
    const aligned = tryExtractDomainAlignedNodes(options.session, TRAINING_PROTOCOL_RULES);
    if (aligned) {
      return {
        kind: 'training-cycle',
        available: true,
        phases: aligned,
        principle: '',
      };
    }
    const { sources } = buildDistinctSessionCycleSources(mission, options);
    const phases = sources
      .map((text, index) => ({
        label: TRAINING_DIDACTIC_LABELS[index] ?? `FASE ${index + 1}`,
        detail: text || '',
      }))
      .filter((phase) => Boolean(phase.detail));
    return {
      kind: 'training-cycle',
      available: phases.length >= 2,
      phases,
      principle: '',
    };
  }

  const { sources } = buildDistinctSessionCycleSources(mission, options);
  const phases = sources.map((text, index) => ({
    label: TRAINING_PHASE_LABELS[index] ?? `FASE ${index + 1}`,
    detail: text || '',
  }));

  return {
    kind: 'training-cycle',
    available: phases.filter((phase) => Boolean(phase.detail)).length >= 2,
    phases,
    principle: detail(
      mission.conceptZero?.contrastTable?.[0]?.correctConcept || mission.conceptZero?.solvedExample?.interpretation,
      140,
      ''
    ),
  };
}

export function buildRegulationFlowDiagram(
  mission: MissionSection,
  options: DiagramBuildOptions = {}
): RegulationFlowDiagramSpec {
  const isLessonGuide = options.allowMissionFallback === false && Boolean(options.session);
  if (isLessonGuide && options.session) {
    const aligned = tryExtractDomainAlignedNodes(options.session, REGULATION_PROTOCOL_RULES);
    if (aligned) {
      return {
        kind: 'regulation-flow',
        available: true,
        stages: aligned,
        anchor: '',
      };
    }
    const { sources } = buildDistinctSessionCycleSources(mission, options);
    const stages = sources
      .map((text, index) => ({
        label: REGULATION_DIDACTIC_LABELS[index] ?? `ETAPA ${index + 1}`,
        detail: text || '',
      }))
      .filter((stage) => Boolean(stage.detail));
    return {
      kind: 'regulation-flow',
      available: stages.length >= 2,
      stages,
      anchor: '',
    };
  }

  const { sources } = buildDistinctSessionCycleSources(mission, options);
  const stages = sources.map((text, index) => ({
    label: REGULATION_STAGE_LABELS[index] ?? `ETAPA ${index + 1}`,
    detail: text || '',
  }));

  return {
    kind: 'regulation-flow',
    available: stages.filter((stage) => Boolean(stage.detail)).length >= 2,
    stages,
    anchor: detail(
      mission.conceptZero?.solvedExample?.interpretation || mission.metacognitiveTrafficLight?.green,
      140,
      ''
    ),
  };
}
