import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import { stripWorkbookTags } from '@/lib/guide-engine/workbook-tags';
import { resolveSacrintPack, type SacrintPack } from './discipline-packs';
import { normalizeMathNotation } from './math-text';
import { resolveSacrintStyle, type SacrintVisualStyle } from './visual-styles';
import {
  buildDiagramVariables,
  buildSacrintDiagram,
  diagramFormula,
  diagramSubtitle,
  stepLabelsForPack,
  type SacrintDiagramSpec,
  type SacrintVariable,
} from './diagrams';

export type {
  ArgumentDiagramSpec,
  BlockDiagramSpec,
  ClinicalFlowDiagramSpec,
  ConceptDiagramSpec,
  CreativeCycleDiagramSpec,
  LanguageDiagramSpec,
  LinearDiagramSpec,
  ReactionDiagramSpec,
  RegulationFlowDiagramSpec,
  SacrintDiagramNode,
  SacrintDiagramSpec,
  SacrintVariable,
  SopFlowDiagramSpec,
  SystemMapDiagramSpec,
  TimelineDiagramSpec,
  TrainingCycleDiagramSpec,
} from './diagrams';

export type SacrintSlideKind =
  | 'cover'
  | 'hook'
  | 'concept'
  | 'demo'
  | 'practice'
  | 'challenge'
  | 'evidence'
  | 'closing';

export const SACRINT_SLIDE_COUNT = 8;

export type SacrintInfographicFormat = 'wide' | 'letter';

export interface SacrintFact {
  label: string;
  value: string;
}

export interface SacrintTrafficLight {
  green: string;
  yellow: string;
  red: string;
}

export interface SacrintMissionMeta {
  subjectName: string;
  blockName: string;
  blockNumber: number;
  semester: number;
  missionNumber: number;
  missionTitle: string;
  sessions: string;
  teacherName: string;
  schoolName: string;
  cct?: string;
  paecProjectName?: string;
}

interface SacrintSlideBase {
  kind: SacrintSlideKind;
  eyebrow: string;
  title: string;
  subtitle?: string;
  missionIndex: number;
}

export interface SacrintCoverSlide extends SacrintSlideBase {
  kind: 'cover';
  metaLine: string;
  facts: SacrintFact[];
  footerNote: string;
}

export interface SacrintHookSlide extends SacrintSlideBase {
  kind: 'hook';
  story: string;
  question: string;
  nodes: Array<{ label: string; detail: string }>;
  facts: SacrintFact[];
}

export interface SacrintConceptSlide extends SacrintSlideBase {
  kind: 'concept';
  analogy: string;
  explanation: string;
  misconception: string;
  formula: string;
  variables: SacrintVariable[];
  diagram: SacrintDiagramSpec;
  facts: SacrintFact[];
}

export interface SacrintDemoSlide extends SacrintSlideBase {
  kind: 'demo';
  demoText: string;
  steps: string[];
  problemStatement?: string;
  interpretation?: string;
  facts: SacrintFact[];
}

export interface SacrintPracticeSlide extends SacrintSlideBase {
  kind: 'practice';
  practiceText: string;
  checkpoints: string[];
  hint?: string;
  facts: SacrintFact[];
}

export interface SacrintChallengeSlide extends SacrintSlideBase {
  kind: 'challenge';
  challengeText: string;
  artifactName: string;
  communityUtility: string;
  phases: Array<{ title: string; hours: number }>;
  facts: SacrintFact[];
}

export interface SacrintEvidenceSlide extends SacrintSlideBase {
  kind: 'evidence';
  checkpoint: string;
  rubric: SacrintRubricItem[];
  checklist: string[];
  reflection: string;
  facts: SacrintFact[];
}

export interface SacrintClosingSlide extends SacrintSlideBase {
  kind: 'closing';
  checkpoint: string;
  criteria: string[];
  trafficLight: SacrintTrafficLight;
  reflection: string;
  facts: SacrintFact[];
}

export type SacrintSlide =
  | SacrintCoverSlide
  | SacrintHookSlide
  | SacrintConceptSlide
  | SacrintDemoSlide
  | SacrintPracticeSlide
  | SacrintChallengeSlide
  | SacrintEvidenceSlide
  | SacrintClosingSlide;

export interface SacrintDeckSpec {
  meta: SacrintMissionMeta;
  pack: SacrintPack;
  style: SacrintVisualStyle;
  slides: SacrintSlide[];
}

export interface SacrintInfographicStep {
  number: number;
  title: string;
  body: string;
}

export interface SacrintRubricItem {
  label: string;
  weight?: number;
}

export interface SacrintInfographicSpec {
  format: SacrintInfographicFormat;
  meta: SacrintMissionMeta;
  pack: SacrintPack;
  style: SacrintVisualStyle;
  title: string;
  subtitle: string;
  claim: string;
  formula: string;
  variables: SacrintVariable[];
  diagram: SacrintDiagramSpec;
  steps: SacrintInfographicStep[];
  misconception: string;
  criteria: string[];
  rubric: SacrintRubricItem[];
  project: {
    artifactName: string;
    communityUtility: string;
  };
  facts: SacrintFact[];
}

export interface SacrintBuildOptions {
  missionIndex?: number;
  xLabel?: string;
  yLabel?: string;
}

function clean(value: string | null | undefined): string {
  return normalizeMathNotation(stripWorkbookTags(value ?? '')).replace(/\s+/g, ' ').trim();
}

function clip(value: string, max: number): string {
  const text = clean(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function splitLabeledItems(value: string | null | undefined, label: 'PASO' | 'Instrucción', max: number): string[] {
  const text = clean(value);
  if (!text) return [];
  const marker = new RegExp(`\\b${label}\\s*\\d+\\s*[:.-]`, 'i');
  const firstMarker = text.search(marker);
  if (firstMarker < 0) return [];
  return text
    .slice(firstMarker)
    .split(new RegExp(`\\s*(?=\\b${label}\\s*\\d+\\s*[:.-])`, 'i'))
    .map((part) => clean(part.replace(new RegExp(`^${label}\\s*\\d+\\s*[:.-]\\s*`, 'i'), '')))
    .filter(Boolean)
    .map((part) => clip(part, 220))
    .slice(0, max);
}

function firstSentence(value: string | null | undefined): string {
  const text = clean(value);
  const end = text.search(/[.!?](?:\s|$)/);
  return end === -1 ? text : text.slice(0, end + 1).trim();
}

function stripMissionPrefix(title: string | null | undefined): string {
  return clean(title).replace(/^misi[oó]n\s*\d+\s*:\s*/i, '').trim();
}

function sessionsLabel(mission: MissionSection): string {
  const covered = mission.coveredSessions ?? [];
  if (covered.length === 0) return '—';
  if (covered.length === 1) return String(covered[0]).padStart(2, '0');
  return `${String(covered[0]).padStart(2, '0')}–${String(covered[covered.length - 1]).padStart(2, '0')}`;
}

function missionMeta(workbook: ActiveWorkTextbook, mission: MissionSection, pack: SacrintPack): SacrintMissionMeta {
  const cover = workbook.coverData;
  return {
    subjectName: clean(cover?.subjectName || pack.label),
    blockName: clean(workbook.blockName || `Bloque ${(workbook.blockIndex ?? 0) + 1}`),
    blockNumber: cover?.blockNumber ?? (workbook.blockIndex ?? 0) + 1,
    semester: cover?.semester ?? 1,
    missionNumber: mission.missionIndex || 1,
    missionTitle: stripMissionPrefix(mission.title) || clean(mission.sessionTopic) || `Misión ${mission.missionIndex || 1}`,
    sessions: sessionsLabel(mission),
    teacherName: clean(cover?.teacherName || 'Docente'),
    schoolName: clean(cover?.schoolName || 'Plantel EMS'),
    cct: clean(cover?.cct || ''),
    paecProjectName: clean(cover?.paecProjectName || ''),
  };
}

function baseFacts(meta: SacrintMissionMeta, mission: MissionSection): SacrintFact[] {
  return [
    { label: 'MISIÓN', value: String(meta.missionNumber).padStart(2, '0') },
    { label: 'SESIONES', value: meta.sessions },
    { label: 'BLOQUE', value: String(meta.blockNumber).padStart(2, '0') },
    { label: 'CRITERIOS', value: String(mission.formativeCheckpoint?.criteriaChecklist?.length || 0).padStart(2, '0') },
  ];
}

function selectMission(workbook: ActiveWorkTextbook, options: SacrintBuildOptions): MissionSection {
  const missions = workbook.missions ?? [];
  const index = Math.max(0, Math.min(options.missionIndex ?? 0, missions.length - 1));
  return missions[index] ?? missions[0];
}

export function buildSacrintDeck(workbook: ActiveWorkTextbook, options: SacrintBuildOptions = {}): SacrintDeckSpec {
  const mission = selectMission(workbook, options);
  const pack = resolveSacrintPack(workbook.coverData?.subjectName ?? '', workbook.subsystem);
  const meta = missionMeta(workbook, mission, pack);
  const facts = baseFacts(meta, mission);
  const diagram = buildSacrintDiagram(mission, pack, options);
  const variables = buildDiagramVariables(diagram);
  const formula = diagramFormula(diagram);
  const misconception = mission.conceptZero?.contrastTable?.[0]
    ? `${mission.conceptZero.contrastTable[0].commonMisconception}`
    : '';

  const cover: SacrintCoverSlide = {
    kind: 'cover',
    eyebrow: `MISIÓN ${String(meta.missionNumber).padStart(2, '0')} // ${pack.label.toLocaleUpperCase('es-MX')}`,
    title: meta.missionTitle,
    subtitle: clip(mission.sessionTopic, 120),
    missionIndex: meta.missionNumber,
    metaLine: `${meta.subjectName} · SEMESTRE ${meta.semester} · BLOQUE ${meta.blockNumber}`,
    facts,
    footerNote: meta.paecProjectName ? `PAEC: ${meta.paecProjectName}` : meta.schoolName,
  };

  const hook: SacrintHookSlide = {
    kind: 'hook',
    eyebrow: 'FENÓMENO SITUADO // PUNTO DE PARTIDA',
    title: clip(mission.sessionTopic || meta.missionTitle, 90),
    subtitle: 'Situación de partida',
    missionIndex: meta.missionNumber,
    story: clean(mission.phenomenonHook?.story) || 'Sin situación registrada.',
    question: clean(mission.phenomenonHook?.detonatingQuestion) || '¿Qué decisión permite transformar el problema?',
    facts,
    nodes: [
      { label: 'CONTEXTO', detail: firstSentence(mission.phenomenonHook?.story) },
      { label: 'PREGUNTA', detail: clean(mission.phenomenonHook?.detonatingQuestion) },
      { label: 'FOCO', detail: clean(mission.sessionFocus) },
    ],
  };

  const concept: SacrintConceptSlide = {
    kind: 'concept',
    eyebrow: 'NÚCLEO TÉCNICO // CONCEPTO CERO',
    title: clip(mission.sessionTopic || 'Concepto clave', 90),
    subtitle: diagramSubtitle(diagram),
    missionIndex: meta.missionNumber,
    analogy: clean(mission.conceptZero?.physicalAnalogy) || 'Sin analogía registrada.',
    explanation: clean(mission.conceptZero?.coreExplanation) || 'Sin explicación registrada.',
    misconception: misconception || 'Sin error común registrado.',
    formula,
    variables,
    diagram,
    facts,
  };

  const solved = mission.conceptZero?.solvedExample;
  const demoSteps = (solved?.solutionSteps ?? []).map(clean).filter(Boolean).slice(0, 6);
  const derivedDemoSteps = demoSteps.length > 0
    ? demoSteps
    : splitLabeledItems(mission.iDoSection?.stepByStepDemo, 'PASO', 6);
  const demo: SacrintDemoSlide = {
    kind: 'demo',
    eyebrow: 'YO HAGO // DEMOSTRACIÓN GUIADA',
    title: clip(mission.sessionTopic || 'Demostración', 90),
    subtitle: 'Paso a paso con el autor',
    missionIndex: meta.missionNumber,
    demoText: clean(mission.iDoSection?.stepByStepDemo) || 'Sin demostración registrada.',
    steps: derivedDemoSteps.length > 0 ? derivedDemoSteps : ['Sin pasos resueltos registrados.'],
    problemStatement: clean(solved?.problemStatement) || undefined,
    interpretation: clean(solved?.interpretation) || undefined,
    facts,
  };

  const weDoElements = (mission.weDoSection?.workbookElements ?? [])
    .map((element) => clean([element.title, element.instruction].filter(Boolean).join(': ')))
    .filter(Boolean)
    .slice(0, 4);
  const derivedCheckpoints = weDoElements.length > 0
    ? weDoElements
    : splitLabeledItems(mission.weDoSection?.guidedPractice, 'Instrucción', 4);
  const practice: SacrintPracticeSlide = {
    kind: 'practice',
    eyebrow: 'HACEMOS // PRÁCTICA GUIADA',
    title: clip(mission.sessionTopic || 'Práctica', 90),
    subtitle: 'Resolvemos juntos con andamiaje',
    missionIndex: meta.missionNumber,
    practiceText: clean(mission.weDoSection?.guidedPractice) || 'Sin práctica guiada registrada.',
    checkpoints: derivedCheckpoints.length > 0 ? derivedCheckpoints : ['Registrar evidencia de la práctica en el cuaderno.'],
    hint: clean(mission.troubleshooting?.[0]?.preventionTip || mission.troubleshooting?.[0]?.prevention) || undefined,
    facts,
  };

  const projectPhases = (workbook.projectSection?.phases ?? [])
    .slice(0, 3)
    .map((phase) => ({
      title: clean(phase.title).replace(/^fase\s*\d+\s*[:.-]\s*/i, '') || `Fase ${phase.phaseNum}`,
      hours: phase.allocatedHours ?? 0,
    }));
  const challenge: SacrintChallengeSlide = {
    kind: 'challenge',
    eyebrow: 'TÚ HACES // RETO Y PROYECTO',
    title: clip(mission.sessionTopic || 'Reto autónomo', 90),
    subtitle: 'Aplicación independiente e integración al proyecto',
    missionIndex: meta.missionNumber,
    challengeText: clean(mission.youDoSection?.autonomousChallenge) || 'Sin reto autónomo registrado.',
    artifactName: clean(workbook.projectSection?.artifactName) || 'Producto integrador',
    communityUtility: clean(workbook.projectSection?.communityUtility) || 'Utilidad comunitaria por definir.',
    phases: projectPhases,
    facts,
  };

  const evalChecklist = (workbook.evaluationSection?.checklist ?? [])
    .map((item) => clean(item.item))
    .filter(Boolean)
    .slice(0, 5);
  const checklist = evalChecklist.length > 0
    ? evalChecklist
    : (mission.formativeCheckpoint?.criteriaChecklist ?? []).map(clean).filter(Boolean).slice(0, 5);
  const evidence: SacrintEvidenceSlide = {
    kind: 'evidence',
    eyebrow: 'EVIDENCIA // RÚBRICA Y CRITERIOS',
    title: '¿Cómo se evalúa?',
    subtitle: clean(mission.formativeCheckpoint?.question) || 'Criterios de verificación',
    missionIndex: meta.missionNumber,
    checkpoint: clean(mission.formativeCheckpoint?.question) || '¿Qué evidencia entrego?',
    rubric: buildRubric(workbook),
    checklist: checklist.length > 0 ? checklist : ['Sin checklist de evaluación registrado.'],
    reflection: clean(mission.formativeCheckpoint?.reflectionPrompts?.[0]) || '¿Qué evidencia tengo de mi aprendizaje?',
    facts,
  };

  const criteria = (mission.formativeCheckpoint?.criteriaChecklist ?? []).map(clean).filter(Boolean);
  const closing: SacrintClosingSlide = {
    kind: 'closing',
    eyebrow: 'CIERRE FORMATIVO // METACOGNICIÓN',
    title: 'Verifico lo aprendido',
    subtitle: clean(mission.formativeCheckpoint?.question) || 'Ticket de salida',
    missionIndex: meta.missionNumber,
    checkpoint: clean(mission.formativeCheckpoint?.question) || '¿Qué puedo demostrar con el modelo?',
    criteria: criteria.length > 0 ? criteria : ['Sin criterios registrados.'],
    trafficLight: {
      green: clean(mission.metacognitiveTrafficLight?.green) || 'Domino el concepto y puedo aplicarlo.',
      yellow: clean(mission.metacognitiveTrafficLight?.yellow) || 'Lo entiendo, necesito práctica.',
      red: clean(mission.metacognitiveTrafficLight?.red) || 'Requiero asesoría.',
    },
    reflection: clean(mission.formativeCheckpoint?.reflectionPrompts?.[0]) || '¿Qué evidencia tengo de mi aprendizaje?',
    facts,
  };

  return { meta, pack, style: resolveSacrintStyle(pack.id), slides: [cover, hook, concept, demo, practice, challenge, evidence, closing] };
}

function buildSteps(mission: MissionSection, pack: SacrintPack): SacrintInfographicStep[] {
  const solved = (mission.conceptZero?.solvedExample?.solutionSteps ?? []).map(clean).filter(Boolean);
  const fallback = [
    clean(mission.phenomenonHook?.story),
    clean(mission.iDoSection?.stepByStepDemo),
    clean(mission.weDoSection?.guidedPractice),
    clean(mission.youDoSection?.autonomousChallenge),
  ];
  const source = solved.length >= 4
    ? solved.slice(0, 4)
    : [...solved, ...fallback.slice(solved.length)]
        .filter((item, index, items) => Boolean(item) && items.indexOf(item) === index)
        .slice(0, 4);
  const labels = stepLabelsForPack(pack);
  return source.map((body, index) => ({
    number: index + 1,
    title: labels[index] ?? `PASO ${index + 1}`,
    body: clip(body, 240),
  }));
}

function buildRubric(workbook: ActiveWorkTextbook): SacrintRubricItem[] {
  const rubric = workbook.evaluationSection?.rubric ?? [];
  if (rubric.length > 0) {
    return rubric.slice(0, 4).map((item) => ({
      label: clean(item.criterion),
      weight: item.weightPercent,
    }));
  }
  const checklist = workbook.evaluationSection?.checklist ?? [];
  return checklist.slice(0, 4).map((item) => ({ label: clean(item.item) }));
}

export function buildSacrintInfographic(
  workbook: ActiveWorkTextbook,
  format: SacrintInfographicFormat = 'wide',
  options: SacrintBuildOptions = {}
): SacrintInfographicSpec {
  const mission = selectMission(workbook, options);
  const pack = resolveSacrintPack(workbook.coverData?.subjectName ?? '', workbook.subsystem);
  const meta = missionMeta(workbook, mission, pack);
  const facts = baseFacts(meta, mission);
  const diagram = buildSacrintDiagram(mission, pack, options);
  const formula = diagramFormula(diagram);
  const misconception = mission.conceptZero?.contrastTable?.[0]?.commonMisconception;
  const correct = mission.conceptZero?.contrastTable?.[0]?.correctConcept;
  const criteria = (mission.formativeCheckpoint?.criteriaChecklist ?? []).map(clean).filter(Boolean);
  const project = workbook.projectSection;

  return {
    format,
    meta,
    pack,
    style: resolveSacrintStyle(pack.id),
    title: meta.missionTitle,
    subtitle: `${meta.subjectName} · MISIÓN ${String(meta.missionNumber).padStart(2, '0')} · BLOQUE ${meta.blockNumber}`,
    claim: clip(mission.sessionFocus || mission.sessionTopic, 170),
    formula,
    variables: buildDiagramVariables(diagram),
    diagram,
    steps: buildSteps(mission, pack),
    misconception: misconception && correct ? `${misconception} → ${correct}` : 'Sin error común registrado.',
    criteria,
    rubric: buildRubric(workbook),
    project: {
      artifactName: clean(project?.artifactName) || 'Producto integrador',
      communityUtility: clean(project?.communityUtility) || 'Utilidad comunitaria por definir.',
    },
    facts,
  };
}