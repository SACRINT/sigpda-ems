/**
 * Deterministic Block Material Reviewer (R1)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Motor determinista puro en memoria (<15 ms, 0 tokens, sin red ni base de datos)
 * que audita los materiales derivados de un bloque formativo contra el
 * ActiveWorkTextbook (Fuente Única de Verdad).
 *
 * Invariantes:
 * - S1: Cobertura y origen real de sesiones (anti-fallback sintético).
 * - S2: Balance temporal (Apertura + Desarrollo + Cierre === duracionMinutos) e instrumento de evaluación.
 * - S3: Completitud de campos y ausencia de placeholders ('undefined', '[completar]', '[...]', '${').
 * - S4: Matemática de rúbrica (pesos > 0, suma 100 ± 0.5, 4 niveles con descriptor) y lista de cotejo.
 * - S5: Paridad 1:1 del solucionario docente con ejercicios prácticos, quiz y ejercicios escalonados.
 * - S6: Integridad de presentaciones SACRINT (deck), infografías e insumos visuales JSON.
 * - S7: Integridad de filas persistidas en planning_extras frente a la extracción fresca (anti-truncación).
 * - S8: Guardia determinista de contaminación cruzada disciplinar.
 * - W0: Advertencias no bloqueantes (densidad moderada, advertencias de coherencia H-324, etc.).
 */

import type { ActiveWorkTextbook, SessionPlan } from '@/types/work-textbook';
import type { SecuenciaBloque } from '@/types/planning';
import type { SacrintDeckSpec, SacrintInfographicSpec } from '@/lib/visual-engine/sacrint/spec';
import { isStructuredVisualPayload } from '@/lib/materials/material-tokens';
import { normalizeUnicode } from '@/lib/utils/normalize';
import {
  extractMaterialsFromWorkbook,
  resolveBlockSessionRange,
  type BlockCurricularAnchor,
  type ExtractedBlockMaterials,
  type PlanDeClaseDerivado,
} from './material-extractor';
import { detectFallbackWords } from './writers/writer-contract';
import { validateBlockCrossContamination } from './cross-contamination-guard';

export type MaterialType =
  | 'lesson_plan'
  | 'student_guide'
  | 'rubric'
  | 'checklist'
  | 'answer_key'
  | 'didactic_material'
  | 'recovery_cards'
  | 'deck'
  | 'infographic'
  | 'visual_asset';

export const ALL_MATERIAL_TYPES: readonly MaterialType[] = [
  'lesson_plan',
  'student_guide',
  'rubric',
  'checklist',
  'answer_key',
  'didactic_material',
  'recovery_cards',
  'deck',
  'infographic',
  'visual_asset',
] as const;

export interface ReviewIssue {
  code: string;
  material: MaterialType;
  session?: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface MaterialReviewReport {
  ok: boolean;
  score: number;
  issues: ReviewIssue[];
  errors: ReviewIssue[];
  warnings: ReviewIssue[];
  byMaterial: Record<MaterialType, { ok: boolean; issues: ReviewIssue[] }>;
}

export interface PersistedExtraInput {
  id?: string;
  type: string;
  title?: string;
  key_index?: number | null;
  content_text: string;
}

export interface ReviewBlockMaterialsInput {
  workbook: ActiveWorkTextbook;
  blockSequence?: SecuenciaBloque | null;
  curricularAnchor?: BlockCurricularAnchor | null;
  extracted?: ExtractedBlockMaterials;
  persistedExtras?: PersistedExtraInput[];
  /** Alias opcional de persistedExtras por compatibilidad */
  extras?: PersistedExtraInput[];
  /**
   * Cuando es true (default cuando se pasan múltiples extras de un bloque),
   * S7 valida que el conteo total de lesson_plan coincida con las sesiones declaradas
   * y que existan todos los materiales singleton obligatorios.
   * Cuando se audita un único extra aislado ([extraId]), pasar false para validar
   * únicamente truncación y completitud de las filas suministradas.
   */
  checkFullBlockPersistence?: boolean;
  /**
   * Permite validar el conteo completo de lesson_plan frente a las sesiones declaradas
   * sin exigir que los demás materiales singleton estén en persistedExtras (ej. descarga combinada de lesson_plan).
   */
  checkLessonPlanCount?: boolean;
  deck?: SacrintDeckSpec;
  infographic?: SacrintInfographicSpec;
  uacName?: string;
  component?: string;
  curriculumName?: string;
  careerOrProgramName?: string;
}

const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /\bundefined\b/i,
  /\[completar[^\]]*\]/i,
  /\[\.\.\.\]/,
  /\$\{[^}]*\}/,
];

const MIN_CHARS_BY_MATERIAL: Record<MaterialType, { errorFloor: number; warningFloor: number }> = {
  lesson_plan: { errorFloor: 300, warningFloor: 520 },
  student_guide: { errorFloor: 200, warningFloor: 450 },
  rubric: { errorFloor: 150, warningFloor: 260 },
  checklist: { errorFloor: 150, warningFloor: 240 },
  answer_key: { errorFloor: 800, warningFloor: 1100 },
  didactic_material: { errorFloor: 200, warningFloor: 320 },
  recovery_cards: { errorFloor: 200, warningFloor: 350 },
  deck: { errorFloor: 100, warningFloor: 200 },
  infographic: { errorFloor: 100, warningFloor: 200 },
  visual_asset: { errorFloor: 40, warningFloor: 80 },
};

/**
 * Mapea el campo `planning_extras.type` (y su `content_text` opcional) al `MaterialType` canónico de R1.
 */
export function mapExtraTypeToMaterialType(
  extraType: string,
  contentText?: string,
  title?: string
): MaterialType {
  const cleanType = (extraType || '').trim().toLowerCase();
  if (
    cleanType === 'visual' ||
    (cleanType === 'material' && contentText && isStructuredVisualPayload(contentText)) ||
    (title && title.trim().startsWith('[Visual]'))
  ) {
    return 'visual_asset';
  }
  switch (cleanType) {
    case 'lesson_plan':
      return 'lesson_plan';
    case 'rubric':
      return 'rubric';
    case 'checklist':
      return 'checklist';
    case 'teacher_guide':
      return 'answer_key';
    case 'practice_guide':
      return 'recovery_cards';
    case 'study_guide':
    case 'student_guide':
      return 'student_guide';
    case 'evaluation':
    case 'material':
    default:
      return 'didactic_material';
  }
}

function normalizeForMatch(value: string | null | undefined): string {
  if (!value) return '';
  return normalizeUnicode(value)
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPlaceholderToken(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function serializePlanContent(plan: PlanDeClaseDerivado): string {
  return [
    plan.tituloSesion,
    plan.propósitoOMeta,
    plan.transversalidad,
    plan.apertura?.actividadDocente,
    plan.apertura?.actividadEstudiante,
    plan.apertura?.saberesPrevios,
    plan.desarrollo?.actividadDocente,
    plan.desarrollo?.actividadEstudiante,
    plan.desarrollo?.metodologiaActiva,
    plan.desarrollo?.recursosDidacticos,
    plan.cierre?.actividadDocente,
    plan.cierre?.actividadEstudiante,
    plan.cierre?.evaluacionFormativa,
    plan.cierre?.metacognicion,
    plan.cierre?.productoEsperado,
    plan.instrumentoEvaluacion,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Mide la cobertura de campos pedagógicos del plan fresco dentro del texto
 * persistido. Es independiente del serializador (Markdown institucional vs
 * serialización canónica) y detecta truncamientos moderados que una simple
 * comparación de longitudes entre serializadores distintos no vería.
 */
function computeLessonPlanFieldCoverage(
  persistedText: string,
  freshPlan: PlanDeClaseDerivado
): { coverage: number; missing: string[] } {
  const normalizedCorpus = normalizeForMatch(persistedText);
  const fields: Array<{ label: string; value: string | undefined }> = [
    { label: 'tituloSesion', value: freshPlan.tituloSesion },
    { label: 'proposito', value: freshPlan.propositoFormativo || freshPlan.propósitoOMeta },
    { label: 'transversalidad', value: freshPlan.transversalidad },
    { label: 'aperturaDocente', value: freshPlan.apertura?.actividadDocente },
    { label: 'aperturaEstudiante', value: freshPlan.apertura?.actividadEstudiante },
    { label: 'saberesPrevios', value: freshPlan.apertura?.saberesPrevios },
    { label: 'desarrolloDocente', value: freshPlan.desarrollo?.actividadDocente },
    { label: 'desarrolloEstudiante', value: freshPlan.desarrollo?.actividadEstudiante },
    { label: 'metodologiaActiva', value: freshPlan.desarrollo?.metodologiaActiva },
    { label: 'recursosDidacticos', value: freshPlan.desarrollo?.recursosDidacticos },
    { label: 'cierreDocente', value: freshPlan.cierre?.actividadDocente },
    { label: 'cierreEstudiante', value: freshPlan.cierre?.actividadEstudiante },
    { label: 'productoEsperado', value: freshPlan.cierre?.productoEsperado },
    { label: 'metacognicion', value: freshPlan.cierre?.metacognicion },
  ];

  const relevant = fields.filter((field) => (field.value || '').trim().length >= 12);
  if (relevant.length === 0) return { coverage: 1, missing: [] };

  const missing = relevant
    .filter((field) => !corpusContainsStatement(normalizedCorpus, field.value || ''))
    .map((field) => field.label);

  return { coverage: (relevant.length - missing.length) / relevant.length, missing };
}

function hasRequiredPlanFields(plan: PlanDeClaseDerivado): boolean {
  return Boolean(
    plan.tituloSesion?.trim() &&
      plan.propósitoOMeta?.trim() &&
      plan.apertura?.actividadDocente?.trim() &&
      plan.apertura?.actividadEstudiante?.trim() &&
      plan.desarrollo?.actividadDocente?.trim() &&
      plan.desarrollo?.actividadEstudiante?.trim() &&
      plan.cierre?.actividadDocente?.trim() &&
      plan.cierre?.actividadEstudiante?.trim() &&
      plan.cierre?.productoEsperado?.trim()
  );
}

/**
 *Verifica si un texto base normalizado aparece en el corpus normalizado,
 * usando tanto el texto íntegro como un prefijo representativo (>= 32 chars)
 * o coincidencia de tokens significativos (>= 70%).
 */
function corpusContainsStatement(normalizedCorpus: string, rawStatement: string): boolean {
  const normStmt = normalizeForMatch(rawStatement);
  if (!normStmt) return false;
  if (normalizedCorpus.includes(normStmt)) return true;

  const prefix = normStmt.slice(0, Math.min(48, normStmt.length)).trim();
  if (prefix.length >= 20 && normalizedCorpus.includes(prefix)) {
    return true;
  }

  const tokens = normStmt.split(' ').filter((w) => w.length >= 4);
  if (tokens.length >= 3) {
    const matched = tokens.filter((t) => normalizedCorpus.includes(t));
    if (matched.length / tokens.length >= 0.75) {
      return true;
    }
  }
  return false;
}

/**
 * Ejecuta la revisión determinista R1 sobre el bloque y sus materiales derivados.
 */
export function reviewBlockMaterials(input: ReviewBlockMaterialsInput): MaterialReviewReport {
  const {
    workbook,
    blockSequence,
    curricularAnchor,
    deck,
    infographic,
    uacName,
    component = '',
    curriculumName = '',
    careerOrProgramName = '',
  } = input;

  const persistedExtras = input.persistedExtras ?? input.extras;
  const extracted =
    input.extracted ?? extractMaterialsFromWorkbook(workbook, blockSequence, curricularAnchor);

  const issues: ReviewIssue[] = [];
  const pushIssue = (issue: ReviewIssue) => {
    issues.push(issue);
  };

  const resolvedUacName =
    uacName ||
    workbook.coverData?.subjectName ||
    ((workbook as unknown as Record<string, unknown>).uacName as string | undefined) ||
    '';

  // ── S1: Cobertura y origen real de sesiones (anti-fallback sintético) ──────
  const { targetSessions, startSession, endSession } = resolveBlockSessionRange(
    workbook,
    blockSequence
  );
  const missions = Array.isArray(workbook.missions) ? workbook.missions : [];

  const hasExplicitCurricularHours = Boolean(
    (Array.isArray(blockSequence?.sessions) && blockSequence.sessions.length >= 6) ||
      (typeof blockSequence?.hours === 'number' && blockSequence.hours >= 6) ||
      (typeof workbook.sessionsPerBlock === 'number' && workbook.sessionsPerBlock >= 6)
  );

  if (!hasExplicitCurricularHours) {
    pushIssue({
      code: 'W0_INFERRED_SESSION_BUDGET',
      material: 'lesson_plan',
      severity: 'warning',
      message: `Presupuesto de sesiones inferido (${targetSessions} sesiones) al no existir hours explícitas en la secuencia ni sessionsPerBlock.`,
    });
  }

  const rawDeclared = missions.flatMap((m) =>
    Array.isArray(m.coveredSessions) ? m.coveredSessions : []
  );
  const declaredSet = new Set<number>(
    rawDeclared.filter((s) => Number.isInteger(s) && s >= startSession && s <= endSession)
  );
  const declared = Array.from(declaredSet).sort((a, b) => a - b);

  // 1.1 Verificar que declared cubra [startSession..endSession] sin huecos
  const missingDeclared: number[] = [];
  for (let s = startSession; s <= endSession; s++) {
    if (!declaredSet.has(s)) {
      missingDeclared.push(s);
    }
  }
  if (missingDeclared.length > 0) {
    pushIssue({
      code: 'S1_MISSING_DECLARED_SESSIONS',
      material: 'lesson_plan',
      session: missingDeclared[0],
      severity: 'error',
      message: `El libro declara ${declared.length} de ${targetSessions} sesiones requeridas; faltan las sesiones: ${missingDeclared.join(', ')}.`,
    });
  }

  // 1.2 Verificar que cada misión tenga sessionPlans reales para sus coveredSessions y sin isFallback
  const allSessionPlans: SessionPlan[] = [];
  const realBookSessionSet = new Set<number>();

  for (const mission of missions) {
    const mCovered = Array.isArray(mission.coveredSessions) ? mission.coveredSessions : [];
    const mPlans = Array.isArray(mission.sessionPlans) ? mission.sessionPlans : [];
    const mPlanMap = new Map<number, SessionPlan>();

    for (const sp of mPlans) {
      allSessionPlans.push(sp);
      mPlanMap.set(sp.sessionNumber, sp);
      if (sp.isFallback === true) {
        pushIssue({
          code: 'S1_FALLBACK_SESSION_IN_BOOK',
          material: 'lesson_plan',
          session: sp.sessionNumber,
          severity: 'error',
          message: `La sesión ${sp.sessionNumber} (Misión ${mission.missionIndex}) proviene de un plan de contingencia (isFallback=true).`,
        });
      } else {
        realBookSessionSet.add(sp.sessionNumber);
      }
    }

    for (const sNum of mCovered) {
      if (sNum >= startSession && sNum <= endSession && !mPlanMap.has(sNum)) {
        pushIssue({
          code: 'S1_MISSING_SESSION_PLANS',
          material: 'lesson_plan',
          session: sNum,
          severity: 'error',
          message: `La Misión ${mission.missionIndex} declara la sesión ${sNum} en coveredSessions pero carece de su SessionPlan en el libro.`,
        });
      }
    }
  }

  // 1.3 Verificar detectFallbackWords sobre todos los sessionPlans (S8 ejecuta la guardia disciplinar en una sola pasada)
  if (allSessionPlans.length > 0) {
    const fbWords = detectFallbackWords(allSessionPlans);
    if (fbWords > 0) {
      pushIssue({
        code: 'S1_FALLBACK_TEXT_DETECTED',
        material: 'lesson_plan',
        severity: 'error',
        message: `Se detectaron ${fbWords} palabras de relleno sintético o plantilla de contingencia en los planes de sesión del libro.`,
      });
    }
  }

  // 1.4 Verificar que ningún plan derivado en extracted.planesDeClase sea relleno sintético del extractor
  const derivedPlans = Array.isArray(extracted.planesDeClase) ? extracted.planesDeClase : [];
  const seenPlanSessions = new Set<number>();
  for (let idx = 0; idx < derivedPlans.length; idx++) {
    const plan = derivedPlans[idx];
    const sNum = plan.numeroSesion;
    const isDuplicate = seenPlanSessions.has(sNum);
    seenPlanSessions.add(sNum);

    if (isDuplicate || !declaredSet.has(sNum) || !realBookSessionSet.has(sNum)) {
      pushIssue({
        code: 'S1_SYNTHETIC_FALLBACK_DETECTED',
        material: 'lesson_plan',
        session: sNum,
        severity: 'error',
        message: `El Plan de Clase de la sesión ${sNum} fue autocompletado sintéticamente sin trazabilidad 1:1 a una sesión declarada y real del libro.`,
      });
    }
  }

  // ── S2: Balance temporal e instrumento de evaluación por sesión ────────────
  for (const plan of derivedPlans) {
    const tAp = Number(plan.apertura?.tiempoMinutos ?? 0);
    const tDes = Number(plan.desarrollo?.tiempoMinutos ?? 0);
    const tCie = Number(plan.cierre?.tiempoMinutos ?? 0);
    const tTotal = tAp + tDes + tCie;
    const expectedDur = Number(plan.duracionMinutos ?? 50);

    if (expectedDur <= 0 || tAp <= 0 || tDes <= 0 || tCie <= 0 || tTotal !== expectedDur) {
      pushIssue({
        code: 'S2_INVALID_TIME_BALANCE',
        material: 'lesson_plan',
        session: plan.numeroSesion,
        severity: 'error',
        message: `Desbalance de tiempos en sesión ${plan.numeroSesion}: Apertura (${tAp}) + Desarrollo (${tDes}) + Cierre (${tCie}) = ${tTotal} min (esperado: ${expectedDur} min).`,
      });
    }

    if (!plan.instrumentoEvaluacion || !plan.instrumentoEvaluacion.trim()) {
      pushIssue({
        code: 'S2_MISSING_EVALUATION_INSTRUMENT',
        material: 'lesson_plan',
        session: plan.numeroSesion,
        severity: 'error',
        message: `La sesión ${plan.numeroSesion} carece de instrumentoEvaluacion explícito.`,
      });
    }
  }

  // ── S3: Completitud de campos y umbrales mínimos conservadores ─────────────
  for (const plan of derivedPlans) {
    const serialized = serializePlanContent(plan);
    const placeholder = findPlaceholderToken(serialized);
    if (placeholder) {
      pushIssue({
        code: 'S3_PLACEHOLDER_DETECTED',
        material: 'lesson_plan',
        session: plan.numeroSesion,
        severity: 'error',
        message: `El Plan de Clase de la sesión ${plan.numeroSesion} contiene un marcador no interpolado o inválido (${placeholder}).`,
      });
    }

    const len = serialized.trim().length;
    const floors = MIN_CHARS_BY_MATERIAL.lesson_plan;
    if (!hasRequiredPlanFields(plan) || len < floors.errorFloor) {
      pushIssue({
        code: 'S3_INCOMPLETE_CONTENT',
        material: 'lesson_plan',
        session: plan.numeroSesion,
        severity: 'error',
        message: `El Plan de Clase de la sesión ${plan.numeroSesion} tiene campos obligatorios vacíos o longitud insuficiente (${len} < ${floors.errorFloor} caracteres).`,
      });
    } else if (len < floors.warningFloor) {
      pushIssue({
        code: 'W0_LOW_DENSITY',
        material: 'lesson_plan',
        session: plan.numeroSesion,
        severity: 'warning',
        message: `El Plan de Clase de la sesión ${plan.numeroSesion} presenta densidad moderada (${len} caracteres).`,
      });
    }
  }

  const checkMarkdownMaterial = (
    material: MaterialType,
    content: string | undefined | null,
    label: string
  ) => {
    const text = (content ?? '').trim();
    const placeholder = findPlaceholderToken(text);
    if (placeholder) {
      pushIssue({
        code: 'S3_PLACEHOLDER_DETECTED',
        material,
        severity: 'error',
        message: `${label} contiene un marcador no interpolado o inválido (${placeholder}).`,
      });
    }
    const floors = MIN_CHARS_BY_MATERIAL[material];
    if (text.length < floors.errorFloor) {
      pushIssue({
        code: 'S3_INCOMPLETE_CONTENT',
        material,
        severity: 'error',
        message: `${label} está vacío o por debajo del umbral estructural mínimo (${text.length} < ${floors.errorFloor} caracteres).`,
      });
    } else if (text.length < floors.warningFloor) {
      pushIssue({
        code: 'W0_LOW_DENSITY',
        material,
        severity: 'warning',
        message: `${label} presenta una densidad de texto baja (${text.length} caracteres).`,
      });
    }
  };

  checkMarkdownMaterial('student_guide', extracted.guiaDelBloque, 'La Guía del Estudiante');
  checkMarkdownMaterial(
    'rubric',
    extracted.rubricaEvaluacion || extracted.instrumentosEvaluacion,
    'La Rúbrica Analítica'
  );
  checkMarkdownMaterial('checklist', extracted.listaCotejo, 'La Lista de Cotejo');
  checkMarkdownMaterial('answer_key', extracted.solucionarioDocente, 'El Solucionario Docente');
  checkMarkdownMaterial('didactic_material', extracted.materialDidactico, 'El Material Didáctico');
  checkMarkdownMaterial('recovery_cards', extracted.fichasTrabajo, 'Las Fichas de Trabajo');

  // Advertencia W0 si ninguna misión tiene matriz de resolución de fallas (troubleshooting)
  const totalTroubleshooting = missions.reduce(
    (acc, m) => acc + (Array.isArray(m.troubleshooting) ? m.troubleshooting.length : 0),
    0
  );
  if (totalTroubleshooting === 0 && missions.length > 0) {
    pushIssue({
      code: 'W0_NO_TROUBLESHOOTING_ITEMS',
      material: 'recovery_cards',
      severity: 'warning',
      message: 'El bloque no incluye tarjetas de contingencia (troubleshooting) en sus misiones.',
    });
  }

  // ── S4: Matemática de rúbrica y estructura de lista de cotejo ──────────────
  const rubricCriteria = workbook.evaluationSection?.rubric ?? [];
  if (!Array.isArray(rubricCriteria) || rubricCriteria.length === 0) {
    pushIssue({
      code: 'S4_EMPTY_RUBRIC',
      material: 'rubric',
      severity: 'error',
      message: 'La sección de evaluación del libro no contiene criterios de rúbrica.',
    });
  } else {
    let weightSum = 0;
    for (let i = 0; i < rubricCriteria.length; i++) {
      const crit = rubricCriteria[i];
      const w = Number(crit.weightPercent);
      if (!Number.isFinite(w) || w <= 0) {
        pushIssue({
          code: 'S4_INVALID_CRITERION_WEIGHT',
          material: 'rubric',
          severity: 'error',
          message: `El criterio de rúbrica #${i + 1} ("${crit.criterion || 'Sin título'}") tiene ponderación inválida (${crit.weightPercent}%).`,
        });
      } else {
        weightSum += w;
      }

      const levels = Array.isArray(crit.levels) ? crit.levels : [];
      const hasFourValidLevels =
        levels.length === 4 &&
        levels.every((lvl) => typeof lvl?.descriptor === 'string' && lvl.descriptor.trim().length > 0);
      if (!hasFourValidLevels) {
        pushIssue({
          code: 'S4_INCOMPLETE_RUBRIC_LEVELS',
          material: 'rubric',
          severity: 'error',
          message: `El criterio de rúbrica "${crit.criterion || `#${i + 1}`}" debe tener exactamente 4 niveles con descriptor no vacío (encontrados: ${levels.length}).`,
        });
      }
    }

    if (Math.abs(weightSum - 100) > 0.5) {
      pushIssue({
        code: 'S4_RUBRIC_WEIGHT_SUM_MISMATCH',
        material: 'rubric',
        severity: 'error',
        message: `La suma de ponderaciones de la rúbrica es ${weightSum.toFixed(1)}%, pero debe ser 100% (±0.5%).`,
      });
    }
  }

  const checklistItems = workbook.evaluationSection?.checklist ?? [];
  if (
    !Array.isArray(checklistItems) ||
    checklistItems.length === 0 ||
    checklistItems.some((c) => !c?.item || !c.item.trim())
  ) {
    pushIssue({
      code: 'S4_EMPTY_CHECKLIST',
      material: 'checklist',
      severity: 'error',
      message: 'La sección de evaluación del libro carece de indicadores válidos en la lista de cotejo.',
    });
  }

  // ── S5: Paridad 1:1 del solucionario con ejercicios reales del libro ───────
  const normalizedAnswerKey = normalizeForMatch(extracted.solucionarioDocente);

  for (const sp of allSessionPlans) {
    const practices = Array.isArray(sp.practica) ? sp.practica : [];
    for (let pIdx = 0; pIdx < practices.length; pIdx++) {
      const pr = practices[pIdx];
      const enunciado = (pr?.enunciado ?? '').trim();
      if (!enunciado || !corpusContainsStatement(normalizedAnswerKey, enunciado)) {
        pushIssue({
          code: 'S5_EXERCISE_NOT_IN_ANSWER_KEY',
          material: 'answer_key',
          session: sp.sessionNumber,
          severity: 'error',
          message: `El ejercicio práctico #${pIdx + 1} de la sesión ${sp.sessionNumber} no aparece trazado en el Solucionario Docente.`,
        });
      }

      const solSteps = Array.isArray(pr?.solucion)
        ? pr.solucion.filter((step) => typeof step === 'string' && step.trim().length > 0)
        : [];
      if (solSteps.length === 0) {
        pushIssue({
          code: 'S5_MISSING_MODEL_SOLUTION',
          material: 'answer_key',
          session: sp.sessionNumber,
          severity: 'warning',
          message: `El ejercicio práctico #${pIdx + 1} de la sesión ${sp.sessionNumber} no incluye pasos de solución del modelo; el solucionario usa guía de mediación.`,
        });
      }
    }
  }

  const quizItems = workbook.evaluationSection?.criticalThinkingQuiz ?? [];
  for (let qIdx = 0; qIdx < quizItems.length; qIdx++) {
    const q = quizItems[qIdx];
    const qNum = q.questionNumber || qIdx + 1;
    if (!q.answerExplanation || !q.answerExplanation.trim()) {
      pushIssue({
        code: 'S5_QUIZ_MISSING_EXPLANATION',
        material: 'answer_key',
        severity: 'error',
        message: `El reactivo #${qNum} del Quiz de Pensamiento Crítico carece de explicación de respuesta (answerExplanation).`,
      });
    } else if (!q.question || !corpusContainsStatement(normalizedAnswerKey, q.question)) {
      pushIssue({
        code: 'S5_QUIZ_NOT_IN_ANSWER_KEY',
        material: 'answer_key',
        severity: 'error',
        message: `El reactivo #${qNum} del Quiz de Pensamiento Crítico no aparece en el Solucionario Docente.`,
      });
    }
  }

  const tieredLevels = workbook.evaluationSection?.tieredExercises ?? [];
  for (const tier of tieredLevels) {
    const exercises = Array.isArray(tier.exercises) ? tier.exercises : [];
    for (let eIdx = 0; eIdx < exercises.length; eIdx++) {
      const ex = exercises[eIdx];
      if (!ex.expectedOutputOrCriteria || !ex.expectedOutputOrCriteria.trim()) {
        pushIssue({
          code: 'S5_TIERED_MISSING_CRITERIA',
          material: 'answer_key',
          severity: 'error',
          message: `El reto escalonado #${ex.number || eIdx + 1} (${tier.levelName || tier.level}) carece de criterio o salida esperada (expectedOutputOrCriteria).`,
        });
      }
    }
  }

  // ── S6: Presentaciones (deck), infografías y recursos gráficos ─────────────
  if (deck) {
    const slides = Array.isArray(deck.slides) ? deck.slides : [];
    if (slides.length !== 8 && slides.length !== 4) {
      pushIssue({
        code: 'S6_INVALID_SLIDE_COUNT',
        material: 'deck',
        severity: 'error',
        message: `El mazo de diapositivas contiene ${slides.length} láminas (se esperaban 8 en modo completo o 4 en modo aula).`,
      });
    }
    const serializedDeck = JSON.stringify(deck);
    const deckPlaceholder = findPlaceholderToken(serializedDeck);
    if (deckPlaceholder) {
      pushIssue({
        code: 'S6_PLACEHOLDER_IN_DECK',
        material: 'deck',
        severity: 'error',
        message: `La presentación contiene un marcador inválido o no interpolado (${deckPlaceholder}).`,
      });
    }
    for (let sIdx = 0; sIdx < slides.length; sIdx++) {
      const slide = slides[sIdx];
      const title = (slide?.title ?? '').trim();
      const eyebrow = (slide?.eyebrow ?? '').trim();
      if (!title || !eyebrow) {
        pushIssue({
          code: 'S6_EMPTY_SLIDE_CONTENT',
          material: 'deck',
          severity: 'error',
          message: `La diapositiva #${sIdx + 1} (${slide?.kind || 'desconocida'}) carece de título o encabezado obligatorio.`,
        });
      } else if (title.length > 180) {
        pushIssue({
          code: 'S6_SLIDE_TITLE_TOO_LONG',
          material: 'deck',
          severity: 'warning',
          message: `El título de la diapositiva #${sIdx + 1} excede el límite visual recomendado (${title.length} > 180 caracteres).`,
        });
      }
    }
  }

  if (infographic) {
    const serializedInfo = JSON.stringify(infographic);
    const infoPlaceholder = findPlaceholderToken(serializedInfo);
    if (infoPlaceholder) {
      pushIssue({
        code: 'S6_PLACEHOLDER_IN_INFOGRAPHIC',
        material: 'infographic',
        severity: 'error',
        message: `La infografía contiene un marcador inválido o no interpolado (${infoPlaceholder}).`,
      });
    }
    const hasRequiredInfoFields = Boolean(
      infographic.title?.trim() &&
        infographic.claim?.trim() &&
        Array.isArray(infographic.steps) &&
        infographic.steps.length > 0 &&
        infographic.diagram &&
        infographic.project?.artifactName?.trim()
    );
    if (!hasRequiredInfoFields) {
      pushIssue({
        code: 'S6_INCOMPLETE_INFOGRAPHIC',
        material: 'infographic',
        severity: 'error',
        message: 'La infografía carece de campos estructurales obligatorios (título, tesis, pasos, diagrama o entregable).',
      });
    }
  }

  // ── S7 (y S6 para visual_asset): Integridad de planning_extras persistidos ─
  if (Array.isArray(persistedExtras) && persistedExtras.length > 0) {
    const freshByMaterial: Partial<Record<MaterialType, string>> = {
      rubric: extracted.rubricaEvaluacion || extracted.instrumentosEvaluacion || '',
      checklist: extracted.listaCotejo || '',
      answer_key: extracted.solucionarioDocente || '',
      didactic_material: extracted.materialDidactico || '',
      recovery_cards: extracted.fichasTrabajo || '',
      student_guide: extracted.guiaDelBloque || '',
    };

    const freshLessonPlanBySession = new Map<number, PlanDeClaseDerivado>(
      (extracted.planesDeClase || []).map((p) => [p.numeroSesion, p])
    );

    const countByMaterial = new Map<MaterialType, number>();

    for (const extra of persistedExtras) {
      const mType = mapExtraTypeToMaterialType(extra.type, extra.content_text, extra.title);
      countByMaterial.set(mType, (countByMaterial.get(mType) ?? 0) + 1);

      const rawText = extra.content_text ?? '';
      if (mType === 'visual_asset') {
        try {
          const parsed = JSON.parse(rawText) as Record<string, unknown>;
          const hasType = typeof parsed?.type === 'string' && parsed.type.trim().length > 0;
          const hasSvg = typeof parsed?.svg === 'string' && parsed.svg.trim().length > 0;
          const mediaAsset = parsed?.mediaAsset as Record<string, unknown> | undefined;
          const hasMediaUrl =
            (typeof mediaAsset?.imageUrl === 'string' && mediaAsset.imageUrl.trim().length > 0) ||
            (typeof mediaAsset?.url === 'string' && mediaAsset.url.trim().length > 0);
          const hasMaterialPng =
            (typeof parsed?.slug === 'string' && parsed.slug.trim().length > 0) ||
            (typeof parsed?.materialPngPath === 'string' && parsed.materialPngPath.trim().length > 0);
          const placeholder = findPlaceholderToken(rawText);

          if (!hasType || (!hasSvg && !hasMediaUrl && !hasMaterialPng) || placeholder) {
            pushIssue({
              code: 'S6_CORRUPT_VISUAL_ASSET',
              material: 'visual_asset',
              severity: 'error',
              message: `El recurso gráfico "${extra.title || 'Visual'}" está incompleto o contiene marcadores inválidos.`,
            });
          }
        } catch {
          pushIssue({
            code: 'S6_INVALID_VISUAL_JSON',
            material: 'visual_asset',
            severity: 'error',
            message: `El recurso gráfico "${extra.title || 'Visual'}" contiene JSON inválido.`,
          });
        }
        continue;
      }

      // Verificar placeholder o longitud mínima en el registro persistido
      const placeholder = findPlaceholderToken(rawText);
      if (placeholder) {
        pushIssue({
          code: 'S7_PERSISTED_PLACEHOLDER',
          material: mType,
          severity: 'error',
          message: `El documento persistido "${extra.title || mType}" contiene un marcador inválido (${placeholder}).`,
        });
      }

      const minFloor = MIN_CHARS_BY_MATERIAL[mType].errorFloor;
      if (rawText.trim().length < minFloor) {
        pushIssue({
          code: 'S7_TRUNCATED_MATERIAL',
          material: mType,
          severity: 'error',
          message: `El documento persistido "${extra.title || mType}" está truncado o por debajo del mínimo (${rawText.trim().length} < ${minFloor} caracteres).`,
        });
        continue;
      }

      if (mType === 'lesson_plan') {
        const sessionMatch =
          (extra.title || '').match(/Sesi[oó]n\s+(\d+)/i) ||
          rawText.slice(0, 240).match(/Sesi[oó]n\s+(\d+)/i);
        const sessionNum = sessionMatch ? parseInt(sessionMatch[1], 10) : NaN;
        if (Number.isInteger(sessionNum) && freshLessonPlanBySession.has(sessionNum)) {
          const freshPlan = freshLessonPlanBySession.get(sessionNum)!;
          const normPersisted = normalizeForMatch(rawText);
          const normFresh = normalizeForMatch(serializePlanContent(freshPlan));
          const { coverage, missing } = computeLessonPlanFieldCoverage(rawText, freshPlan);

          const phasePatterns = {
            apertura: /fase de apertura|\bapertura\b|activaci[oó]n|\binicio\b/i,
            desarrollo: /fase de desarrollo|\bdesarrollo\b|construcci[oó]n|modelado|conquista/i,
            cierre: /fase de cierre|\bcierre\b|consolidaci[oó]n|s[ií]ntesis/i,
            evaluacion: /evaluaci[oó]n|producto esperado|evidencia|instrumento/i,
          };
          const hasEssentialPhases = Object.values(phasePatterns).every((rx) => rx.test(rawText));

          const severelyShort =
            normPersisted.length > 0 &&
            normFresh.length > 0 &&
            normPersisted.length < normFresh.length * 0.6;

          const isTruncated = !hasEssentialPhases || severelyShort || coverage < 0.5;

          if (isTruncated) {
            pushIssue({
              code: 'S7_TRUNCATED_MATERIAL',
              material: 'lesson_plan',
              session: sessionNum,
              severity: 'error',
              message: `El Plan de Clase persistido de la sesión ${sessionNum} ("${extra.title || 'Plan de Clase'}") está truncado respecto a la extracción canónica del libro (cobertura de campos ${(coverage * 100).toFixed(0)}%${missing.length > 0 ? `; faltan: ${missing.join(', ')}` : ''}; fases pedagógicas completas: ${hasEssentialPhases ? 'sí' : 'no'}).`,
            });
          } else if (coverage < 0.8) {
            pushIssue({
              code: 'W0_LESSON_PLAN_FIELD_DIVERGENCE',
              material: 'lesson_plan',
              session: sessionNum,
              severity: 'warning',
              message: `El Plan de Clase persistido de la sesión ${sessionNum} ("${extra.title || 'Plan de Clase'}") presenta divergencia de redacción respecto a la extracción fresca (cobertura ${(coverage * 100).toFixed(0)}%${missing.length > 0 ? `; campos con redacción alternativa: ${missing.join(', ')}` : ''}), pero conserva estructura y extensión completa.`,
            });
          }
        } else {
          pushIssue({
            code: 'W0_UNRESOLVED_LESSON_PLAN_SESSION',
            material: 'lesson_plan',
            severity: 'warning',
            message: `No se pudo resolver el número de sesión de "${extra.title || 'lesson_plan'}" para comparación fresca S7; se aplicó únicamente el piso mínimo de caracteres.`,
          });
        }
        continue;
      }

      // Los instrumentos especializados del catálogo son independientes de la extracción singleton
      if (extra.type === 'evaluation') {
        continue;
      }

      // Comparar contra versión fresca si es un material singleton
      const freshRef = freshByMaterial[mType];
      if (freshRef && freshRef.trim().length >= minFloor) {
        const normPersisted = normalizeForMatch(rawText);
        const normFresh = normalizeForMatch(freshRef);
        if (
          normPersisted.length > 0 &&
          normFresh.length > 0 &&
          normPersisted.length < normFresh.length * 0.9
        ) {
          pushIssue({
            code: 'S7_TRUNCATED_MATERIAL',
            material: mType,
            severity: 'error',
            message: `El documento persistido "${extra.title || mType}" está truncado respecto a la extracción canónica del libro (${normPersisted.length} vs ${normFresh.length} caracteres normalizados).`,
          });
        }
      }
    }

    const shouldCheckFullBlock =
      input.checkFullBlockPersistence ?? persistedExtras.length > 1;
    const shouldCheckLessonPlanCount =
      input.checkLessonPlanCount ?? shouldCheckFullBlock;

    if (shouldCheckLessonPlanCount) {
      const persistedLessonPlans = countByMaterial.get('lesson_plan') ?? 0;
      if (declared.length > 0 && persistedLessonPlans !== declared.length) {
        pushIssue({
          code: 'S7_LESSON_PLAN_COUNT_MISMATCH',
          material: 'lesson_plan',
          severity: 'error',
          message: `Existen ${persistedLessonPlans} planes de clase persistidos en base de datos, pero el libro declara ${declared.length} sesiones reales.`,
        });
      }
    }

    if (shouldCheckFullBlock) {
      const requiredSingletons: MaterialType[] = [
        'rubric',
        'checklist',
        'answer_key',
        'didactic_material',
      ];
      for (const reqType of requiredSingletons) {
        if ((countByMaterial.get(reqType) ?? 0) === 0) {
          pushIssue({
            code: 'S7_MISSING_PERSISTED_MATERIAL',
            material: reqType,
            severity: 'error',
            message: `No se encontró el material obligatorio "${reqType}" persistido en planning_extras para este bloque.`,
          });
        }
      }
    }
  }

  // ── S8: Guardia de contaminación cruzada disciplinar ──────────────────────
  if (missions.length > 0 && resolvedUacName) {
    const contamination = validateBlockCrossContamination(
      missions,
      resolvedUacName,
      component,
      curriculumName,
      careerOrProgramName
    );
    if (!contamination.clean) {
      for (const cIssue of contamination.issues) {
        pushIssue({
          code: 'S8_CROSS_CONTAMINATION',
          material: 'lesson_plan',
          session: cIssue.sessionNumber > 0 ? cIssue.sessionNumber : undefined,
          severity: 'error',
          message: `Contaminación cruzada en sesión ${cIssue.sessionNumber} (${cIssue.field}): término ajeno "${cIssue.forbiddenTerm}" (${cIssue.actualDiscipline} en ${cIssue.expectedDiscipline}).`,
        });
      }
      if (deck) {
        pushIssue({
          code: 'S8_CROSS_CONTAMINATION',
          material: 'deck',
          severity: 'error',
          message: contamination.summary,
        });
      }
      if (infographic) {
        pushIssue({
          code: 'S8_CROSS_CONTAMINATION',
          material: 'infographic',
          severity: 'error',
          message: contamination.summary,
        });
      }
    }
  }

  // ── W0: Advertencias de coherencia cruzada (H-324) ────────────────────────
  const coherenceWarnings = extracted.coherencia?.warnings ?? [];
  for (const w of coherenceWarnings) {
    const text =
      typeof w === 'string'
        ? w
        : String((w as { message?: string })?.message ?? '');
    if (!text) continue;
    pushIssue({
      code: 'W0_COHERENCE_WARNING',
      material: 'lesson_plan',
      severity: 'warning',
      message: text,
    });
  }

  // ── Ensamblaje del reporte por material y cálculo de score ─────────────────
  const byMaterial = {} as Record<MaterialType, { ok: boolean; issues: ReviewIssue[] }>;
  for (const mType of ALL_MATERIAL_TYPES) {
    const mIssues = issues.filter((i) => i.material === mType);
    const hasError = mIssues.some((i) => i.severity === 'error');
    byMaterial[mType] = {
      ok: !hasError,
      issues: mIssues,
    };
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const ok = errors.length === 0;

  // Score determinista 0..100: cada error estructural resta 15 pts; las advertencias no bloqueantes
  // restan 1 pt con tope máximo de 10 pts para que un bloque íntegro (0 errores) conserve score >= 90.
  const warningPenalty = Math.min(10, warnings.length);
  const rawScore = 100 - errors.length * 15 - warningPenalty;
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    ok,
    score,
    issues,
    errors,
    warnings,
    byMaterial,
  };
}
