/**
 * Piloto E2E REAL (Tarea 3) — SIN fixtures ni mocks de IA.
 * Ejecuta generación real con el modelo primario configurado (3.1-flash-lite) vía generateWithRotation sobre:
 *   1) Lenguaje y Comunicación I (BGE, 3h/sem -> 18 sesiones)
 *   2) Mecánica Dental (BT, 4h/sem -> 24 sesiones, sharding completo)
 *   3) Pensamiento Matemático I (BGE, 3h/sem -> 18 sesiones)
 *
 * REGLA DE AISLAMIENTO:
 *   - Carga .env.local para usar las claves activas del pool.
 *   - NO llama saveBlockWorkbook, saveCanonicalSeed, saveImageAsset ni muta `plannings`.
 *   - Renderiza 06 (PDF), 08 (PPTX) y 09 (Infografía PDF) en `scripts/output/e2e_pilot_real/`
 *     y guarda el resumen JSON verificable en `docs/auditoria/e2e_pilot_summary.json`.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import type { DetailedSession } from '../src/lib/session-progression-engine';
import type { Planning, TeacherContext } from '../src/types/planning';
import type { ActiveWorkTextbook, SessionPlan } from '../src/types/work-textbook';
import type { WriterOutput } from '../src/lib/guide-engine/writers/writer-contract';

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const rawEnv = fs.readFileSync(envPath, 'utf8');
  for (const line of rawEnv.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && m[2] && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

interface ModelNetStats {
  total: number;
  ok: number;
  http429: number;
  http503: number;
  otherErr: number;
}

interface PhaseNetBucket {
  httpCalls: number;
  http2xx: number;
  http429: number;
  http503: number;
  httpOtherErr: number;
  httpFetchThrow: number;
  latenciesMs: number[];
}

interface NetTelemetry extends PhaseNetBucket {
  byModel: Record<string, ModelNetStats>;
  byPhase: {
    initial: PhaseNetBucket;
    repair: PhaseNetBucket;
  };
}

const emptyBucket = (): PhaseNetBucket => ({
  httpCalls: 0,
  http2xx: 0,
  http429: 0,
  http503: 0,
  httpOtherErr: 0,
  httpFetchThrow: 0,
  latenciesMs: [],
});

const currentNet: NetTelemetry = {
  ...emptyBucket(),
  byModel: {},
  byPhase: {
    initial: emptyBucket(),
    repair: emptyBucket(),
  },
};

const phaseAls = new AsyncLocalStorage<'initial' | 'repair'>();
let forcedGeminiModel: string | null = null;

function resetNetTelemetry(): void {
  Object.assign(currentNet, emptyBucket());
  currentNet.byModel = {};
  currentNet.byPhase = {
    initial: emptyBucket(),
    repair: emptyBucket(),
  };
}

const origFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (!url.includes('generativelanguage.googleapis.com')) {
    return origFetch(input, init);
  }
  let effectiveInput: RequestInfo | URL = input;
  if (forcedGeminiModel && /\/models\/[^:?/]+/.test(url)) {
    url = url.replace(/\/models\/[^:?/]+/, `/models/${forcedGeminiModel}`);
    effectiveInput = url;
  }
  const phase = phaseAls.getStore() ?? 'initial';
  const pBucket = currentNet.byPhase[phase];
  const modelMatch = url.match(/\/models\/([^:?/]+)/);
  const modelKey = modelMatch ? modelMatch[1] : 'unknown';
  if (!currentNet.byModel[modelKey]) {
    currentNet.byModel[modelKey] = { total: 0, ok: 0, http429: 0, http503: 0, otherErr: 0 };
  }
  const mStats = currentNet.byModel[modelKey];
  const t0 = Date.now();
  currentNet.httpCalls++;
  pBucket.httpCalls++;
  mStats.total++;
  try {
    const res = await origFetch(effectiveInput, init);
    const dt = Date.now() - t0;
    currentNet.latenciesMs.push(dt);
    pBucket.latenciesMs.push(dt);
    if (res.ok) {
      currentNet.http2xx++;
      pBucket.http2xx++;
      mStats.ok++;
    } else if (res.status === 429) {
      currentNet.http429++;
      pBucket.http429++;
      mStats.http429++;
    } else if (res.status === 503) {
      currentNet.http503++;
      pBucket.http503++;
      mStats.http503++;
    } else {
      currentNet.httpOtherErr++;
      pBucket.httpOtherErr++;
      mStats.otherErr++;
    }
    return res;
  } catch (err) {
    const dt = Date.now() - t0;
    currentNet.latenciesMs.push(dt);
    pBucket.latenciesMs.push(dt);
    currentNet.httpFetchThrow++;
    pBucket.httpFetchThrow++;
    mStats.otherErr++;
    throw err;
  }
}) as typeof globalThis.fetch;

interface PilotUacConfig {
  slug: string;
  uacName: string;
  subsystem: 'bge' | 'bt';
  component: string;
  curriculumName: string;
  careerOrProgramName?: string;
  weeklyHours: number;
  semester: number;
  blockName: string;
  learningOutcome: string;
  topics: string[];
  paecProblem: string;
  paecProjectName: string;
}

const PILOT_UACS: PilotUacConfig[] = [
  {
    slug: 'lenguaje_comunicacion_i',
    uacName: 'Lenguaje y Comunicación I',
    subsystem: 'bge',
    component: 'fundamental',
    curriculumName: 'Leer y escribir para pensarnos juntos',
    weeklyHours: 3,
    semester: 1,
    blockName: 'Bloque 1: Lectura crítica, argumentación y fuentes confiables',
    learningOutcome:
      'Analiza y produce textos argumentativos breves identificando tesis, razones, evidencias y confiabilidad de fuentes en situaciones escolares y comunitarias.',
    topics: [
      'Intención comunicativa y lectura crítica en la comunidad escolar',
      'Identificación de la tesis central y postura del enunciador',
      'Tipos de argumentos, garantías lógicas y conectores causales',
      'Evaluación de fuentes confiables y contraste de datos verificables',
      'Detección de falacias cotidianas y generalizaciones apresuradas',
      'Redacción de reseña crítica y diálogo argumentado en comunidad',
    ],
    paecProblem: 'Desinformación en redes vecinales y baja lectura crítica estudiantil',
    paecProjectName: 'Gaceta Escolar de Lectura Crítica y Verificación Comunitaria',
  },
  {
    slug: 'mecanica_dental',
    uacName: 'Mecánica Dental',
    subsystem: 'bt',
    component: 'laboral',
    curriculumName: 'Técnico en Prótesis Dental / Mecánica Dental',
    careerOrProgramName: 'Mecánica Dental',
    weeklyHours: 4,
    semester: 3,
    blockName: 'Bloque 1: Bioseguridad clínica, anatomía dental e impresiones de yeso y alginato',
    learningOutcome:
      'Ejecuta protocolos de bioseguridad en laboratorio dental, identifica morfología coronaria y obtiene modelos de estudio en alginato y yeso tipo III conforme a estándares NOM.',
    topics: [
      'Bioseguridad, desinfección de impresiones y control de infecciones (NOM-013-SSA2)',
      'Nomenclatura dentaria FDI y morfología anatómica de arcadas superior e inferior',
      'Toma de impresiones preliminares con alginato: relación agua-polvo y tiempo de gelado',
      'Vaciado de impresiones en yeso dental tipo III sin burbujas y zocalado anatómico',
      'Análisis de modelos de estudio, relación céntrica y plano oclusal en articulador',
      'Registro técnico, control dimensional de calidad e higiene de prótesis parciales',
    ],
    paecProblem: 'Salud bucodental preventiva y detección temprana de pérdida dental en adultos mayores',
    paecProjectName: 'Jornada Técnica de Modelos Preventivos y Cuidado Protésico Comunitario',
  },
  {
    slug: 'pensamiento_matem_i',
    uacName: 'Pensamiento Matemático I',
    subsystem: 'bge',
    component: 'fundamental',
    curriculumName: 'Pensamiento Matemático I',
    weeklyHours: 3,
    semester: 1,
    blockName: 'Bloque 1: Pensamiento aritmético, proporcionalidad y variación porcentual',
    learningOutcome:
      'Resuelve situaciones de variación proporcional directa e inversa, porcentajes y tasas mediante representaciones numéricas, tabulares y algebraicas básicas.',
    topics: [
      'Números reales, fracciones equivalentes y jerarquía de operaciones en gastos escolares',
      'Razones y proporciones en mezclas, escalas y presupuestos familiares',
      'Variación proporcional directa e inversa con tablas de datos reales',
      'Porcentajes, descuentos sucesivos, tasas e interés simple cotidiano',
      'Modelación con expresiones algebraicas de primer grado y ecuaciones lineales',
      'Interpretación gráfica de variación lineal y toma de decisiones financieras',
    ],
    paecProblem: 'Uso ineficiente del agua escolar y planeación de presupuestos en huertos comunitarios',
    paecProjectName: 'Calculadora Comunitaria de Consumo Hídrico y Presupuesto Escolar',
  },
];

async function main() {
  loadEnvLocal();

  const outRoot = path.resolve(process.cwd(), 'scripts/output/e2e_pilot_real');
  const summaryPath = path.resolve(process.cwd(), 'docs/auditoria/e2e_pilot_summary.json');
  fs.mkdirSync(outRoot, { recursive: true });
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });

  const {
    __resetPrimary503CircuitForTests,
    getAIProvider,
    getActiveKeyPoolSize,
  } = await import('../src/lib/ai-provider');
  const {
    isTransientJobError,
    resolvePostRedactionRecoveryPlan,
  } = await import('../src/lib/job-worker');
  const { extractCurriculumContext } = await import(
    '../src/lib/guide-engine/curriculum-context-agent'
  );
  const { buildBlockBlueprint } = await import('../src/lib/guide-engine/blueprint-architect-agent');
  const {
    computeContentBudget,
    countSessionPlanWords,
    resolveMissionBudgetsForBlueprint,
    validateSessionCoverage,
  } = await import('../src/lib/guide-engine/content-budget');
  const { createWriterScheduler, resolveWriterConcurrency } = await import(
    '../src/lib/guide-engine/writer-scheduler'
  );
  const { generateFoundationMission } = await import(
    '../src/lib/guide-engine/writers/foundation-writer'
  );
  const { generateLabMission } = await import('../src/lib/guide-engine/writers/lab-writer');
  const { generateProjectMission } = await import(
    '../src/lib/guide-engine/writers/project-writer'
  );
  const { generateEvaluationSection } = await import(
    '../src/lib/guide-engine/writers/evaluation-writer'
  );
  const {
    REPAIR_RESERVE_MS,
    densityThresholdsFor,
    evaluateSessionPlanDensity,
    sessionPlanWordTarget,
  } = await import('../src/lib/guide-engine/writers/session-shard');
  const { expandDeficientSessionPlans } = await import(
    '../src/lib/guide-engine/session-plan-expansion'
  );
  const { finalizeSessionPlans } = await import('../src/lib/guide-engine/session-plan-finalizer');
  const { validateBlockGuideQuality } = await import('../src/lib/guide-engine/quality-validator');
  const { validateBlockCrossContamination } = await import(
    '../src/lib/guide-engine/cross-contamination-guard'
  );
  const { getDisciplinaryAdapter } = await import('../src/lib/prompts/disciplinary-adapters');
  const { renderWorkbookToPdf } = await import('../src/lib/pdf-workbook-renderer');
  const {
    buildSacrintDecksForWorkbook,
    buildSacrintInfographic,
    dedupeInfographicSpecs,
    selectInfographicTargets,
  } = await import('../src/lib/visual-engine/sacrint/spec');
  const { generateCombinedSacrintPptx } = await import(
    '../src/lib/visual-engine/sacrint/sacrint-pptx-generator'
  );
  const { renderCombinedSacrintInfographicsPdf } = await import(
    '../src/lib/visual-engine/sacrint/sacrint-rasterizer'
  );
  const { auditWorkbookVisualQuality, runMaterialsQa, scanEditorialDefects } = await import(
    './qa-sacrint-materials'
  );

  const args = process.argv.slice(2);
  const modelFlag = args.find((a) => a.startsWith('--model='))?.split('=')[1] ?? null;
  const summaryFlag = args.find((a) => a.startsWith('--out='))?.split('=')[1] ?? null;
  const uacFlag = args.find((a) => a.startsWith('--uac='))?.split('=')[1] ?? null;
  if (modelFlag) {
    forcedGeminiModel = modelFlag;
  }
  const effectiveSummaryPath = summaryFlag
    ? path.resolve(process.cwd(), summaryFlag)
    : summaryPath;
  const selectedUacs = uacFlag
    ? PILOT_UACS.filter((cfg) => cfg.slug === uacFlag || cfg.uacName === uacFlag)
    : PILOT_UACS;
  if (selectedUacs.length === 0) {
    throw new Error(`No se encontró una UAC piloto para --uac=${uacFlag}`);
  }

  const activeProvider = await getAIProvider(false);
  const poolSize = await getActiveKeyPoolSize(false);
  const resolvedConcurrency = await resolveWriterConcurrency(() => Promise.resolve(poolSize));
  const writerConcurrency = Math.min(2, resolvedConcurrency);
  const WRITER_BUDGET_MS = 148_000;
  const MAX_JOB_ATTEMPTS = 2;
  console.log(
    '[PILOT CONFIG]',
    JSON.stringify({
      providerId: activeProvider.providerId,
      modelId: forcedGeminiModel ?? activeProvider.modelId,
      forcedGeminiModel,
      poolSize,
      writerConcurrency,
      writerBudgetMs: WRITER_BUDGET_MS,
      repairReserveMs: REPAIR_RESERVE_MS,
      maxJobAttempts: MAX_JOB_ATTEMPTS,
      executedAt: new Date().toISOString(),
    })
  );

  const summaryResults: unknown[] = [];

  for (let i = 0; i < selectedUacs.length; i++) {
    const cfg = selectedUacs[i];
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }

    __resetPrimary503CircuitForTests();
    resetNetTelemetry();
    const uacOutDir = path.join(
      outRoot,
      forcedGeminiModel ? `${cfg.slug}_${forcedGeminiModel.replace(/[^a-z0-9]+/gi, '_')}` : cfg.slug
    );
    fs.mkdirSync(uacOutDir, { recursive: true });
    const startedAt = Date.now();
    const repairedAttemptSessions = new Set<number>();
    const repairSuccessLabels: string[] = [];

    console.log(
      `\n==================== PILOTO E2E REAL: ${cfg.uacName} (${cfg.weeklyHours}h/sem | model=${forcedGeminiModel ?? activeProvider.modelId}) ====================`
    );

    let setupMs = 0;
    let writerMs = 0;
    let repairMs = 0;
    let assemblyMs = 0;
    let renderMs = 0;
    let qaMs = 0;

    try {
      const tSetup0 = Date.now();
      const budget = computeContentBudget(cfg.weeklyHours);
      const totalSessions = budget.sessionsPerBlock;
      const adapter = getDisciplinaryAdapter(cfg.uacName, cfg.component, cfg.curriculumName);

      const planning = {
        id: `sandbox-pilot-${cfg.slug}`,
        teacherId: undefined as unknown as string,
        teacherName: 'Docente Piloto SIGPDA',
        uacName: cfg.uacName,
        semester: cfg.semester,
        component: cfg.component,
        curriculumName: cfg.curriculumName,
        careerOrProgramName: cfg.careerOrProgramName,
        paecContext: `${cfg.paecProjectName}: ${cfg.paecProblem}`,
        contentJson: {
          sectionI: {
            totalHoursWeekly: cfg.weeklyHours,
            schoolName:
              cfg.subsystem === 'bt'
                ? 'CECyTE / CBTis Piloto Puebla'
                : 'Bachillerato General Estatal Piloto Puebla',
            municipality: 'Puebla',
            cct: '21EBH0000P',
          },
        },
        extractedData: null,
        status: 'completed',
      } as unknown as Planning;

      const curriculum = extractCurriculumContext({
        uacName: cfg.uacName,
        semester: cfg.semester,
        subsystem: cfg.subsystem,
        component: cfg.component,
        weeklyHours: cfg.weeklyHours,
        teacherContext: {
          paecProjectName: cfg.paecProjectName,
          paecProblem: cfg.paecProblem,
          studentContext:
            'Estudiantes de Educación Media Superior en Puebla con enfoque autodidacta y contextualizado.',
        } as unknown as TeacherContext,
      });

      const phaseColorMap = {
        Apertura: {
          bg: 'rgba(59, 130, 246, 0.15)',
          text: '#60a5fa',
          border: 'rgba(59, 130, 246, 0.35)',
        },
        Desarrollo: {
          bg: 'rgba(245, 158, 11, 0.15)',
          text: '#fbbf24',
          border: 'rgba(245, 158, 11, 0.35)',
        },
        Cierre: {
          bg: 'rgba(16, 185, 129, 0.15)',
          text: '#34d399',
          border: 'rgba(16, 185, 129, 0.35)',
        },
      };

      const rawSessions: DetailedSession[] = Array.from({ length: totalSessions }, (_, idx) => {
        const n = idx + 1;
        const phase =
          n <= Math.ceil(totalSessions * 0.2)
            ? 'Apertura'
            : n > totalSessions - Math.ceil(totalSessions * 0.2)
              ? 'Cierre'
              : 'Desarrollo';
        const topic =
          cfg.topics[Math.floor((idx * cfg.topics.length) / totalSessions)] || cfg.topics[0]!;
        return {
          sessionNum: n,
          totalSessions,
          activityIndex: Math.floor((idx * 3) / totalSessions),
          activityName: topic,
          phase,
          phaseColor: phaseColorMap[phase],
          title: `Sesión ${n}: ${topic}`,
          description: `${topic} — ${cfg.learningOutcome}`,
          focus: `Evidencia de sesión ${n} sobre ${topic}`,
          teachingActivity: `Encuadre conceptual sobre ${topic}`,
          learningActivity: `Análisis y aplicación autodidacta de ${topic}`,
          evidence: `Producto verificable de ${topic}`,
          evaluation: 'Lista de cotejo / Rúbrica formativa',
        };
      });

      (planning as unknown as Record<string, unknown>).sequenceJson = {
        0: {
          blockIndex: 0,
          blockName: cfg.blockName,
          sessions: rawSessions,
        },
      };

      const blueprint = buildBlockBlueprint({
        blockIndex: 0,
        blockName: cfg.blockName,
        planning,
        curriculum,
      });
      const sessions = blueprint.sessions;
      const missionBudgets = resolveMissionBudgetsForBlueprint(budget, blueprint.missions);
      setupMs = Date.now() - tSetup0;

      let repairBatchesAttempted = 0;
      let activeRepairTasks = 0;
      let repairIntervalStartMs = 0;
      let accumulatedRepairWallMs = 0;

      const summarizePhaseBucket = (b: PhaseNetBucket) => ({
        httpCalls: b.httpCalls,
        http2xx: b.http2xx,
        http429: b.http429,
        http503: b.http503,
        httpOtherErr: b.httpOtherErr,
        httpFetchThrow: b.httpFetchThrow,
        avgHttpLatencyMs:
          b.latenciesMs.length > 0
            ? Math.round(b.latenciesMs.reduce((a, c) => a + c, 0) / b.latenciesMs.length)
            : 0,
        rate429_503:
          b.httpCalls > 0 ? Number(((b.http429 + b.http503) / b.httpCalls).toFixed(4)) : 0,
      });

      type MissionType = 'foundation' | 'lab' | 'project' | 'evaluation';
      const checkpointWriters = new Map<MissionType, WriterOutput>();
      const checkpointPartials: Partial<Record<MissionType, SessionPlan[]>> = {};
      let checkpointExpandOnly = false;
      const attemptHistory: Array<{
        attempt: number;
        durationMs: number;
        outcome: string;
        transient?: boolean;
        keptWriters: MissionType[];
        evictedWriters: MissionType[];
        errors?: Array<Record<string, unknown>>;
      }> = [];
      let firstAttemptTotalMs = 0;
      let lastErrorsSummary: Array<Record<string, unknown>> = [];

      const tWriteAndRepairStart = Date.now();

      for (let attempt = 1; attempt <= MAX_JOB_ATTEMPTS; attempt++) {
        const attemptStart = Date.now();
        const rawScheduler = createWriterScheduler({
          maxConcurrency: writerConcurrency,
          jitterMs: 350,
          minSpacingMs: 500,
          breaker: { threshold: 2, baseCooldownMs: 12_000, maxCooldownMs: 45_000 },
        });

        const scheduler = {
          ...rawScheduler,
          run: async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
            const isRepair = label.includes(':sessions-reparacion');
            if (isRepair) {
              repairBatchesAttempted++;
              const batchMatch = label.match(/:sessions-reparacion(?:-r\d+)?\[([^\]]+)\]/);
              if (batchMatch) {
                for (const n of batchMatch[1].split(/[-,]/).map(Number).filter(Number.isFinite)) {
                  repairedAttemptSessions.add(n);
                }
              }
            }
            const out = await rawScheduler.run(label, async () => {
              if (isRepair) {
                if (activeRepairTasks === 0) repairIntervalStartMs = Date.now();
                activeRepairTasks++;
              }
              try {
                return await phaseAls.run(isRepair ? 'repair' : 'initial', fn);
              } finally {
                if (isRepair) {
                  activeRepairTasks = Math.max(0, activeRepairTasks - 1);
                  if (activeRepairTasks === 0 && repairIntervalStartMs > 0) {
                    accumulatedRepairWallMs += Date.now() - repairIntervalStartMs;
                    repairIntervalStartMs = 0;
                  }
                }
              }
            });
            if (isRepair) repairSuccessLabels.push(label);
            return out;
          },
        };

        const baseBudgetDeadlineMs = Date.now() + WRITER_BUDGET_MS;
        const makeInput = (type: MissionType) => ({
          planning,
          blockIndex: 0,
          blockName: cfg.blockName,
          sessions,
          missions: blueprint.missions,
          paecContext: `${cfg.paecProjectName}: ${cfg.paecProblem}`,
          studentProfile: curriculum.studentProfile.contextDescription,
          subsystem: cfg.subsystem,
          uacName: cfg.uacName,
          component: cfg.component,
          curriculumName: cfg.curriculumName,
          careerOrProgramName: cfg.careerOrProgramName,
          targetWords: missionBudgets[type].targetWords,
          scheduler,
          budgetDeadlineMs: baseBudgetDeadlineMs,
          cachedSessionPlans: checkpointPartials[type],
          onPartialSessionPlans: (plans: SessionPlan[]) => {
            checkpointPartials[type] = [...plans];
          },
        });

        const pendingTasks: Array<{ type: MissionType; run: () => Promise<WriterOutput> }> = [];
        if (!checkpointExpandOnly) {
          if (!checkpointWriters.has('foundation')) {
            pendingTasks.push({
              type: 'foundation',
              run: () => generateFoundationMission(makeInput('foundation')),
            });
          }
          if (!checkpointWriters.has('lab')) {
            pendingTasks.push({ type: 'lab', run: () => generateLabMission(makeInput('lab')) });
          }
          if (!checkpointWriters.has('project')) {
            pendingTasks.push({
              type: 'project',
              run: () => generateProjectMission(makeInput('project')),
            });
          }
          if (!checkpointWriters.has('evaluation')) {
            pendingTasks.push({
              type: 'evaluation',
              run: () => generateEvaluationSection(makeInput('evaluation')),
            });
          }
        }

        const settled = await Promise.allSettled(
          pendingTasks.map(async (t) => {
            const out = await t.run();
            checkpointWriters.set(t.type, out);
            delete checkpointPartials[t.type];
            return out;
          })
        );

        const rejected = settled.filter(
          (r): r is PromiseRejectedResult => r.status === 'rejected'
        );
        const attemptDurationMs = Date.now() - attemptStart;
        if (attempt === 1) {
          firstAttemptTotalMs = Date.now() - startedAt;
        }

        if (rejected.length === 0 && checkpointWriters.size === 4) {
          attemptHistory.push({
            attempt,
            durationMs: attemptDurationMs,
            outcome: 'COMPLETED_WRITERS',
            keptWriters: Array.from(checkpointWriters.keys()),
            evictedWriters: [],
          });
          lastErrorsSummary = [];
          break;
        }

        lastErrorsSummary = rejected.map((r) => {
          const e = r.reason as Record<string, unknown>;
          return {
            name: e?.name ?? 'Error',
            message: e?.message ?? String(r.reason),
            missionType: e?.missionType,
            sessions: e?.sessions,
            deficits: e?.deficits,
            repairedSessions: e?.repairedSessions,
          };
        });

        // Aplicar la misma clasificación transitoria / evicción selectiva que processGenerationJob (job-worker.ts)
        const primaryErr = rejected[0]?.reason;
        const primaryMsg =
          primaryErr instanceof Error ? primaryErr.message : String(primaryErr ?? '');
        const allTransient = rejected.every((r) => isTransientJobError(r.reason));
        const evictedWriters: MissionType[] = [];

        if (!allTransient) {
          for (const r of rejected) {
            if (isTransientJobError(r.reason)) continue;
            const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason ?? '');
            const rec = resolvePostRedactionRecoveryPlan(
              r.reason,
              errMsg,
              Array.from(checkpointWriters.values()),
              checkpointExpandOnly
            );
            if (rec.mode === 'expand_only') {
              checkpointExpandOnly = true;
            } else if (rec.mode === 'evict') {
              for (const ev of rec.evictedTypes) {
                checkpointWriters.delete(ev);
                delete checkpointPartials[ev];
                if (!evictedWriters.includes(ev)) evictedWriters.push(ev);
              }
              checkpointExpandOnly = false;
            }
          }
        }

        attemptHistory.push({
          attempt,
          durationMs: attemptDurationMs,
          outcome: allTransient ? 'TRANSIENT_RETRY' : 'DEFICIENCY_RECOVERY',
          transient: allTransient,
          keptWriters: Array.from(checkpointWriters.keys()),
          evictedWriters,
          errors: lastErrorsSummary,
        });

        if (attempt < MAX_JOB_ATTEMPTS) {
          console.warn(
            `[PILOT JOB-WORKER RECOVERY] ${cfg.uacName} intento ${attempt}/${MAX_JOB_ATTEMPTS} (${allTransient ? 'transitorio' : `evicción=${evictedWriters.join(',') || 'ninguna'}`}): reanudando desde checkpoint con ${checkpointWriters.size} writers completos (${primaryMsg.slice(0, 140)})...`
          );
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      const totalWriteAndRepairElapsed = Date.now() - tWriteAndRepairStart;
      repairMs = Math.min(totalWriteAndRepairElapsed, accumulatedRepairWallMs);
      writerMs = Math.max(0, totalWriteAndRepairElapsed - repairMs);

      if (checkpointWriters.size < 4) {
        const totalMs = Date.now() - startedAt;
        summaryResults.push({
          uac: cfg.uacName,
          subsystem: cfg.subsystem,
          modelUsed: forcedGeminiModel ?? activeProvider.modelId,
          sessionsExpected: totalSessions,
          adapterId: adapter.id,
          status: 'FAILED_WRITER',
          jobAttempts: attemptHistory.length,
          attemptHistory,
          errors: lastErrorsSummary,
          setupMs,
          writerMs,
          repairMs,
          assemblyMs: 0,
          renderMs: 0,
          qaMs: 0,
          totalMs,
          firstAttemptTotalMs,
          latencyMs: totalMs,
          repairedAttemptSessions: Array.from(repairedAttemptSessions).sort((a, b) => a - b),
          repairBatchesAttempted,
          phase1ApiHealth: summarizePhaseBucket(currentNet.byPhase.initial),
          phase2RepairHealth: summarizePhaseBucket(currentNet.byPhase.repair),
          network: {
            httpCalls: currentNet.httpCalls,
            http2xx: currentNet.http2xx,
            http429: currentNet.http429,
            http503: currentNet.http503,
            httpOtherErr: currentNet.httpOtherErr,
            httpFetchThrow: currentNet.httpFetchThrow,
            avgHttpLatencyMs:
              currentNet.latenciesMs.length > 0
                ? Math.round(
                    currentNet.latenciesMs.reduce((a, c) => a + c, 0) /
                      currentNet.latenciesMs.length
                  )
                : 0,
            byModel: currentNet.byModel,
            rate429_503:
              currentNet.httpCalls > 0
                ? Number(
                    ((currentNet.http429 + currentNet.http503) / currentNet.httpCalls).toFixed(4)
                  )
                : 0,
          },
        });
        console.error(`[PILOT FAIL] ${cfg.uacName}:`, JSON.stringify(lastErrorsSummary));
        continue;
      }

      const tAssembly0 = Date.now();
      const writerOutputs = (['foundation', 'lab', 'project', 'evaluation'] as const).map(
        (t) => checkpointWriters.get(t)!
      );

      const preExpansionWords = writerOutputs.reduce((acc, w) => acc + (w.wordCount || 0), 0);
      let expansionResult = { expandedPlans: 0, addedWords: 0 };
      if (preExpansionWords < budget.targetWords.min) {
        expansionResult = await expandDeficientSessionPlans({
          writerOutputs,
          missionBudgets,
          blockTargetWords: budget.targetWords,
          uacName: cfg.uacName,
          blockName: cfg.blockName,
          subsystem: cfg.subsystem,
          remainingBudgetMs: 120_000,
          minRemainingBudgetMs: 30_000,
          failOnDeficit: true,
        });
      }

      const finalization = finalizeSessionPlans({
        writerOutputs,
        missionBudgets,
        subsystem: cfg.subsystem,
        blockTargetMinWords: budget.targetWords.min,
        failOnDeficit: true,
      });

      const quality = validateBlockGuideQuality({
        writerOutputs,
        subsystem: cfg.subsystem,
        targetWords: budget.targetWords,
      });

      const foundationOut = writerOutputs.find((w) => w.type === 'foundation')!;
      const labOut = writerOutputs.find((w) => w.type === 'lab')!;
      const projectOut = writerOutputs.find((w) => w.type === 'project')!;
      const evaluationOut = writerOutputs.find((w) => w.type === 'evaluation')!;

      const missions = [
        foundationOut.section,
        labOut.section,
        projectOut.section,
        evaluationOut.section,
      ];
      const allPlans = missions.flatMap((m) => m.sessionPlans || []);
      const sessionWordCounts = allPlans.map((p) => countSessionPlanWords(p));
      const minW = Math.min(...sessionWordCounts);
      const maxW = Math.max(...sessionWordCounts);
      const avgW = Math.round(
        sessionWordCounts.reduce((a, b) => a + b, 0) / Math.max(1, sessionWordCounts.length)
      );

      const stillDeficientDetails: Array<{
        session: number;
        mission: string;
        deficits: string[];
      }> = [];
      for (const w of writerOutputs) {
        const plans = w.section?.sessionPlans || [];
        const mb = missionBudgets[w.type];
        const planTarget = sessionPlanWordTarget(mb.targetWords.ideal, plans.length);
        const thresholds = densityThresholdsFor(
          planTarget,
          adapter.family === 'cuantitativa_experimental',
          true
        );
        for (const p of plans) {
          const rep = evaluateSessionPlanDensity(p, thresholds);
          if (!rep.ok) {
            stillDeficientDetails.push({
              session: p.sessionNumber,
              mission: w.type,
              deficits: rep.deficits,
            });
          }
        }
      }

      const contamination = validateBlockCrossContamination(
        missions,
        cfg.uacName,
        cfg.component,
        cfg.curriculumName,
        cfg.careerOrProgramName || '',
        adapter.requiresQuantitativeData
      );

      const totalWords = writerOutputs.reduce((acc, w) => acc + (w.wordCount || 0), 0);
      const coverage = validateSessionCoverage({
        sessions: allPlans,
        expectedSessionsCount: totalSessions,
        totalWords,
        budget,
      });

      const workbook: ActiveWorkTextbook = {
        id: `wb-pilot-${cfg.slug}`,
        planningId: planning.id,
        blockIndex: 0,
        blockName: cfg.blockName,
        version: 1,
        subsystem: cfg.subsystem,
        sessionsPerBlock: totalSessions,
        targetPages: budget.targetPages.ideal,
        totalPages: Math.max(12, Math.round(totalWords / 450)),
        targetWords: budget.targetWords.ideal,
        totalWords,
        coverageReport: coverage,
        generatedAt: new Date().toISOString(),
        qualityScore: quality.qualityScore,
        qualityWarning: quality.qualityWarning,
        coverData: {
          title: `Libro de Trabajo — ${cfg.uacName}`,
          subtitle: cfg.blockName,
          subjectName: cfg.uacName,
          semester: cfg.semester,
          blockNumber: 1,
          teacherName: 'Docente Piloto SIGPDA',
          schoolName: cfg.subsystem === 'bt' ? 'CECyTE / CBTis Piloto' : 'BGE Piloto Puebla',
          cct: '21EBH0000P',
          paecProjectName: cfg.paecProjectName,
          municipality: 'Puebla',
        },
        tableOfContents: missions.map((m, idx) => ({
          missionIndex: idx + 1,
          title: m.title,
          sessionsRange:
            m.coveredSessions.length > 0
              ? `Sesiones ${m.coveredSessions[0]}-${m.coveredSessions[m.coveredSessions.length - 1]}`
              : `Misión ${idx + 1}`,
          pageEstimate: 4 + idx * 10,
        })),
        missions,
        projectSection: projectOut.projectSection!,
        evaluationSection: evaluationOut.evaluationSection!,
      };
      assemblyMs = Date.now() - tAssembly0;

      const tRender0 = Date.now();
      const pdf06Buf = await renderWorkbookToPdf(workbook, planning, { forceFallbackCover: true });
      const pdf06Path = path.join(uacOutDir, `06_${cfg.slug}.pdf`);
      fs.writeFileSync(pdf06Path, pdf06Buf);

      const decks = buildSacrintDecksForWorkbook(workbook, { mode: 'lesson-guide' });
      const pptxBuf = await generateCombinedSacrintPptx(decks, {
        title: `Presentaciones SACRINT — ${cfg.uacName}`,
        subjectName: cfg.uacName,
      });
      const pptxPath = path.join(uacOutDir, `08_${cfg.slug}.pptx`);
      fs.writeFileSync(pptxPath, pptxBuf);

      const targets = selectInfographicTargets(workbook);
      const specs = dedupeInfographicSpecs(
        targets.map((t) =>
          buildSacrintInfographic(workbook, 'wide', {
            missionIndex: t.missionIndex,
            sessionIndex: t.sessionIndex,
          })
        )
      );
      const infoBuf = await renderCombinedSacrintInfographicsPdf(specs);
      const infoPath = path.join(uacOutDir, `09_${cfg.slug}.pdf`);
      fs.writeFileSync(infoPath, infoBuf);
      renderMs = Date.now() - tRender0;

      const tQa0 = Date.now();
      const qaSummary = await runMaterialsQa(uacOutDir, { strict: true });
      const visualAudit = auditWorkbookVisualQuality(workbook, decks);

      const rawLatexCounter = async (filePath: string) => {
        const parser = new PDFParse({ data: fs.readFileSync(filePath) });
        const txtRes = await parser.getText();
        await parser.destroy().catch(() => {});
        const txt = txtRes.text || '';
        const latexCmds = (
          txt.match(
            /\\(?:begin|end|frac|sqrt|times|cdot|alpha|beta|gamma|Delta|theta|pi|sum|int)\b/g
          ) || []
        ).length;
        const defects = scanEditorialDefects(txt);
        return {
          latexCmds,
          gluedPaso: defects.glued_paso_inline?.length || 0,
          orphanPaso: defects.orphan_paso_number?.length || 0,
          latexMonomial: defects.latex_monomial_leak?.length || 0,
        };
      };
      const pdf06Scan = await rawLatexCounter(pdf06Path);
      const pdf09Scan = await rawLatexCounter(infoPath);
      qaMs = Date.now() - tQa0;

      const p06 = qaSummary.pdfs.find((p) => p.file.startsWith('06_'));
      const p09 = qaSummary.pdfs.find((p) => p.file.startsWith('09_'));
      const px08 = qaSummary.pptx[0];
      const totalMs = setupMs + writerMs + repairMs + assemblyMs + renderMs + qaMs;

      summaryResults.push({
        uac: cfg.uacName,
        subsystem: cfg.subsystem,
        modelUsed: forcedGeminiModel ?? activeProvider.modelId,
        adapterId: adapter.id,
        status: stillDeficientDetails.length > 0 ? 'DEFICIENCY_DETECTED' : 'COMPLETED',
        jobAttempts: attemptHistory.length,
        attemptHistory,
        sessionsExpected: totalSessions,
        sessionsGenerated: allPlans.length,
        wordsPerSession: {
          min: minW,
          avg: avgW,
          max: maxW,
        },
        totalWords,
        targetWords: budget.targetWords,
        preExpansionWords,
        expansionResult,
        finalizationWithinTarget: finalization.withinTargetMin,
        repairedAttemptSessions: Array.from(repairedAttemptSessions).sort((a, b) => a - b),
        repairBatchesAttempted,
        repairSuccessCount: repairSuccessLabels.length,
        stillDeficientCount: stillDeficientDetails.length,
        stillDeficientDetails,
        crossContamination: {
          clean: contamination.clean,
          issuesCount: contamination.issues.length,
        },
        setupMs,
        writerMs,
        repairMs,
        assemblyMs,
        renderMs,
        qaMs,
        totalMs,
        firstAttemptTotalMs,
        latencyMs: totalMs,
        phase1ApiHealth: summarizePhaseBucket(currentNet.byPhase.initial),
        phase2RepairHealth: summarizePhaseBucket(currentNet.byPhase.repair),
        network: {
          httpCalls: currentNet.httpCalls,
          http2xx: currentNet.http2xx,
          http429: currentNet.http429,
          http503: currentNet.http503,
          httpOtherErr: currentNet.httpOtherErr,
          httpFetchThrow: currentNet.httpFetchThrow,
          avgHttpLatencyMs:
            currentNet.latenciesMs.length > 0
              ? Math.round(
                  currentNet.latenciesMs.reduce((a, b) => a + b, 0) / currentNet.latenciesMs.length
                )
              : 0,
          byModel: currentNet.byModel,
          rate429_503:
            currentNet.httpCalls > 0
              ? Number(
                  ((currentNet.http429 + currentNet.http503) / currentNet.httpCalls).toFixed(4)
                )
              : 0,
        },
        qaStrict: {
          passed: qaSummary.passed,
          failures: qaSummary.failures,
          warnings: qaSummary.warnings,
          pdf06: p06
            ? {
                pages: p06.pages,
                wordCount: p06.wordCount,
                findings: p06.findings,
                extraScan: pdf06Scan,
              }
            : null,
          pdf09: p09
            ? {
                pages: p09.pages,
                wordCount: p09.wordCount,
                findings: p09.findings,
                extraScan: pdf09Scan,
              }
            : null,
          pptx08: px08
            ? {
                slideCount: px08.slideCount,
                slide12Avg: px08.wordStats.slide12Avg,
                slide12Over200: px08.wordStats.slide12Over200,
                slide12Under80: px08.wordStats.slide12Under80,
                collisions: px08.collisions.length,
                wrapNoneShapes: px08.wrapNoneShapes,
                outOfBoundsShapes: px08.outOfBoundsShapes,
                findings: px08.findings,
              }
            : null,
        },
        visualAudit: {
          passed: visualAudit.passed,
          infographicCount: visualAudit.infographicCount,
          presentationFindingsCount: visualAudit.presentationFindings.length,
          presentationFindings: visualAudit.presentationFindings.slice(0, 15),
          infographicFindingsCount: visualAudit.infographicFindings.length,
          infographicFindings: visualAudit.infographicFindings.slice(0, 15),
        },
      });
    } catch (err) {
      const e = err as Record<string, unknown>;
      const totalMs = Date.now() - startedAt;
      summaryResults.push({
        uac: cfg.uacName,
        subsystem: cfg.subsystem,
        modelUsed: forcedGeminiModel ?? activeProvider.modelId,
        status: 'EXCEPTION',
        errorName: e?.name ?? 'Error',
        errorMessage: e?.message ?? String(err),
        setupMs,
        writerMs,
        repairMs,
        assemblyMs,
        renderMs,
        qaMs,
        totalMs,
        latencyMs: totalMs,
        repairedAttemptSessions: Array.from(repairedAttemptSessions).sort((a, b) => a - b),
        network: {
          httpCalls: currentNet.httpCalls,
          http2xx: currentNet.http2xx,
          http429: currentNet.http429,
          http503: currentNet.http503,
          httpOtherErr: currentNet.httpOtherErr,
          httpFetchThrow: currentNet.httpFetchThrow,
          byModel: currentNet.byModel,
          rate429_503:
            currentNet.httpCalls > 0
              ? Number(
                  ((currentNet.http429 + currentNet.http503) / currentNet.httpCalls).toFixed(4)
                )
              : 0,
        },
      });
      console.error(`[PILOT EXCEPTION] ${cfg.uacName}:`, err);
    }
  }

  fs.writeFileSync(effectiveSummaryPath, JSON.stringify(summaryResults, null, 2), 'utf8');
  console.log('\n=== E2E PILOT SUMMARY SAVED ===', effectiveSummaryPath);
  console.log(JSON.stringify(summaryResults, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
