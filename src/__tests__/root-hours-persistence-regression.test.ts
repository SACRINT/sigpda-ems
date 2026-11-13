import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import {
  resolveSemesterWeeks,
  resolveWeeklyHours,
  resolveSessionsPerBlock,
  computeContentBudget,
} from '@/lib/guide-engine/content-budget';
import { resolveCurricularBlocks } from '@/lib/curricular-blocks';
import { validateAnexo12 } from '@/lib/planning/anexo12-validator';
import { evaluateDBEPA } from '@/lib/planning/dbepa-quality-gate';
import { generateSecuenciaPDF } from '@/lib/planning-pdf-renderer';
import { generateSecuenciaDocx } from '@/lib/docx-generator';
import { normalizeMathNotation } from '@/lib/visual-engine/sacrint/math-text';
import { buildConsolidatedBook } from '@/lib/master-workbook-compiler';
import { resolveWorkbookMethodology } from '@/lib/pdf-workbook-renderer';
import type { GeneratedPlanningContent, Planning, SecuenciaBloque, SecuenciaSesion } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

// Mocks encapsulados únicamente para probar el flujo fail-closed de POST /api/plannings/[id]/generate
const mockSendNotification = vi.fn().mockResolvedValue(undefined);
const mockLogActivity = vi.fn().mockResolvedValue(undefined);
const mockValidateAndPersist = vi.fn();

vi.mock('@/lib/notifications', () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

vi.mock('@/lib/planning/planning-persistence', () => ({
  validateAndPersistPlanningContent: (...args: unknown[]) => mockValidateAndPersist(...args),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'docente@seppuebla.edu.mx', name: 'Prof. Prueba' } }),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn().mockResolvedValue({ id: 't-1', email: 'docente@seppuebla.edu.mx', name: 'Prof. Prueba' }),
  getPlanningById: vi.fn().mockResolvedValue({
    id: '11111111-1111-1111-1111-111111111111',
    teacher_id: 't-1',
    uac_name: 'Pensamiento Matemático III',
    semester: 3,
    component: 'fundamental',
    metodologia_activa: 'abp',
    paec_context: 'Contaminación del río local',
    content_json: { sectionI: { cct: '21EBH0001A', schoolName: 'Bachillerato Oficial' } },
    sequence_json: null,
  }),
  getProgramByUacAndSemester: vi.fn().mockResolvedValue({
    uac_name: 'Pensamiento Matemático III',
    semester: 3,
    component: 'fundamental',
    total_hours: 72,
    learning_outcome: 'Modela fenómenos de cambio',
    activities: [],
    evidences: [],
    subsystem: 'Bachillerato General Estatal (BGE)',
  }),
  getFfeContinuity: vi.fn().mockResolvedValue(null),
  getAuditResultByPlanningId: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/ai-provider', () => ({
  resolveUserIsPremium: vi.fn().mockResolvedValue(true),
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
  generateStreamWithRotation: vi.fn().mockImplementation(async function* () {
    yield JSON.stringify({
      sectionI: {
        uacName: 'Pensamiento Matemático III',
        teacherName: 'Prof. Prueba',
        schoolName: 'Bachillerato Oficial',
        semester: '3° Semestre',
        component: 'fundamental',
      },
      sectionII: {
        purpose: 'Desarrollar pensamiento variacional aplicado al entorno comunitario.',
        learningOutcomes: ['Analiza razones de cambio reales.'],
        activities: [
          { name: 'Bloque 1', hours: 24 },
          { name: 'Bloque 2', hours: 24 },
          { name: 'Bloque 3', hours: 24 },
        ],
        retoSituado: {
          verboInfinitivo: 'Modelar',
          contextoLocal: 'en Puebla',
          problematicaReal: 'el consumo hídrico escolar',
          propositoCurricular: 'mediante razones de cambio y funciones',
        },
      },
      sectionIII: { productoIntegrador: 'Informe gráfico comunitario' },
      sectionIV: {
        activities: [1, 2, 3].map((i) => ({
          name: `Progresión ${i}`,
          hours: 24,
          methodology: 'abp',
          saberes: {
            saber: 'Conceptos de variación lineal',
            saberHacer: 'Calcula razones de cambio en tablas y gráficas',
            saberSer: 'Colabora con rigor y honestidad',
          },
          apertura: { activities: 'Diagnóstico inicial con gráfica comunitaria.' },
          ejecucion: { activities: 'Resolución guiada de casos locales con datos.' },
          conclusion: { activities: 'Socialización de conclusiones y reflexión.' },
        })),
      },
      sectionV: {
        evaluations: [
          { type: 'Diagnóstica', moment: 'Inicio', agent: 'Autoevaluación', evidence: 'Cuestionario inicial', instrument: 'Lista de cotejo', percentage: 10 },
          { type: 'Formativa', moment: 'AC1', agent: 'Coevaluación', evidence: 'Cuaderno de modelación', instrument: 'Rúbrica analítica', percentage: 50 },
          { type: 'Sumativa', moment: 'Final', agent: 'Heteroevaluación', evidence: 'Proyecto comunitario', instrument: 'Rúbrica holística', percentage: 40 },
        ],
      },
      sectionVI: { studentMaterials: ['Cuaderno'], teacherMaterials: ['Pizarrón'], spaces: ['Aula'], digital: ['GeoGebra'], references: ['SEP 2024'] },
      sectionVII: {},
    });
  }),
}));

vi.mock('@/lib/context-extractor', () => ({
  getUserLibraryContext: vi.fn().mockResolvedValue(''),
}));

vi.mock('@/lib/institutional-context', () => ({
  getInstitutionalContext: vi.fn().mockResolvedValue({ block: '' }),
}));

vi.mock('@/lib/rag-curricular', () => ({
  searchCurriculum: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/idempotency', () => ({
  extractIdempotencyKey: vi.fn().mockReturnValue(null),
  checkIdempotencyKey: vi.fn().mockResolvedValue(null),
  createIdempotencyKey: vi.fn().mockResolvedValue(undefined),
}));

describe('Regresión integral: horas curriculares, persistencia Anexo 12, secuencia y renderizado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Resolución sistémica de horas semanales y sesiones por bloque (BGE y Tecnológico)', () => {
    it('calcula 4 h/sem (24 sesiones/bloque, 72 totales) para Pensamiento Matemático III y fallback de uac_name', () => {
      expect(resolveSemesterWeeks('Bachillerato General Estatal (BGE)')).toBe(18);
      expect(resolveSemesterWeeks('Bachillerato Tecnológico / DGETI')).toBe(16);

      expect(resolveWeeklyHours({ contentJson: { sectionI: { totalHours: 72 } } })).toBe(4);
      expect(resolveSessionsPerBlock(4)).toBe(24);
      expect(computeContentBudget(4).sessionsPerBlock).toBe(24);

      // Si content_json carece de horas (caso draft fallido), usa extracted_data o catálogo por uac_name
      expect(
        resolveWeeklyHours({
          uac_name: 'Pensamiento Matemático III',
          content_json: { sectionI: {} },
          extracted_data: {},
        })
      ).toBe(4);

      expect(
        resolveWeeklyHours({
          uac_name: 'Materia Nueva',
          content_json: { sectionI: {} },
          extracted_data: { totalHours: 72 },
        })
      ).toBe(4);
    });

    it('soporta Pensamiento Matemático IV–VI (64h -> 4 h/sem) y módulos BT de 16 semanas (80h..224h sin tope en 8)', () => {
      expect(resolveWeeklyHours({ subsystem: 'bge', totalHours: 64 })).toBe(4);
      expect(resolveWeeklyHours({ subsystem: 'laboral', totalHours: 54 })).toBe(3);

      expect(resolveWeeklyHours({ subsystem: 'tecnologico', totalHours: 80 })).toBe(5);
      expect(resolveSessionsPerBlock(5)).toBe(30);
      expect(resolveWeeklyHours({ subsystem: 'tecnologico', totalHours: 96 })).toBe(6);
      expect(resolveSessionsPerBlock(6)).toBe(36);
      expect(resolveWeeklyHours({ subsystem: 'tecnologico', totalHours: 144 })).toBe(9);
      expect(resolveSessionsPerBlock(9)).toBe(54);
      expect(resolveWeeklyHours({ subsystem: 'tecnologico', totalHours: 224 })).toBe(14);
      expect(resolveSessionsPerBlock(14)).toBe(84);

      // Incluso si omiten subsystem en múltiplos exclusivos BT (80, 96, 112, 128, 160)
      expect(resolveWeeklyHours({ totalHours: 96 })).toBe(6);
      expect(resolveWeeklyHours({ totalHours: 128 })).toBe(8);
    });
  });

  describe('2. resolveCurricularBlocks sin duplicar encabezados y con fallback de horas', () => {
    it('no duplica "Bloque X (Corte X): Bloque X (Corte X)" cuando sectionIV está vacía y hereda 24h en PM III', () => {
      const blocks = resolveCurricularBlocks(null, { uac_name: 'Pensamiento Matemático III' });
      expect(blocks).toHaveLength(3);
      for (const b of blocks) {
        expect(b.hours).toBe(24);
        expect(b.title).not.toMatch(/Bloque\s+\d+\s*\(Corte\s*\d+\)\s*:\s*Bloque\s+\d+/i);
      }
      expect(blocks[0].title).toBe('Bloque 1 (Corte 1): Primer Corte de Evaluación Formativa');
    });

    it('limpia prefijo repetido si la actividad ya trae "Bloque 1 (Corte 1): ..."', () => {
      const blocks = resolveCurricularBlocks({
        sectionI: { totalHours: 72 },
        sectionIV: {
          activities: [
            { name: 'Bloque 1 (Corte 1): Razones de cambio', hours: 24 },
            { name: 'Progresión 2', hours: 24 },
            { name: 'Progresión 3', hours: 24 },
          ],
        },
      } as unknown as GeneratedPlanningContent);
      expect(blocks[0].title).toBe('Bloque 1 (Corte 1): Razones de cambio');
    });
  });

  describe('3. Anexo 12 y DBEPA Quality Gate con momentos + tipo y carga BT/PM IV-VI', () => {
    it('aprueba v_momentos y evaluacion_integral cuando type y moment van en campos separados', () => {
      const content = {
        sectionI: {
          uacName: 'Pensamiento Matemático IV',
          teacherName: 'Dra. Elena Ríos',
          schoolName: 'CECyTE Puebla',
          cct: '21ETC0001A',
          schoolZone: 'Zona 01',
          municipality: 'Puebla',
          semester: '4° Semestre',
          component: 'fundamental',
          subsystem: 'BGE',
          groups: '4A',
          totalHours: 64,
          totalHoursWeekly: 4,
          applicationPeriod: 'Feb-Jul 2027',
        },
        sectionII: {
          purpose: 'Analizar fenómenos de optimización continua aplicados al ahorro de agua escolar.',
          learningOutcomes: ['Resuelve problemas de variación.'],
          activities: [{ name: 'A1' }, { name: 'A2' }, { name: 'A3' }],
          retoSituado: {
            verboInfinitivo: 'Optimizar',
            contextoLocal: 'en Puebla',
            problematicaReal: 'desperdicio hídrico en el plantel',
            propositoCurricular: 'mediante modelación algebraica y cálculo',
          },
        },
        sectionIII: { productoIntegrador: 'Maqueta de captación' },
        sectionIV: {
          activities: [22, 21, 21].map((h, i) => ({
            name: `Progresión ${i + 1}`,
            hours: h,
            methodology: 'abp',
            saberes: { saber: 'Conceptos matemáticos', saberHacer: 'Modela funciones', saberSer: 'Trabajo riguroso' },
            apertura: { activities: 'Exploración de consumo real del plantel.' },
            ejecucion: { activities: 'Resolución colaborativa de ecuaciones.' },
            conclusion: { activities: 'Socialización y metacognición grupal.' },
          })),
        },
        sectionV: {
          evaluations: [
            { type: 'Diagnóstica', moment: 'Inicio', agent: 'Autoevaluación', evidence: 'Cuestionario inicial', instrument: 'Lista de cotejo', percentage: 10 },
            { type: 'Formativa', moment: 'AC1', agent: 'Coevaluación', evidence: 'Portafolio de cálculo', instrument: 'Rúbrica analítica', percentage: 50 },
            { type: 'Sumativa', moment: 'Final', agent: 'Heteroevaluación', evidence: 'Proyecto hídrico', instrument: 'Rúbrica holística', percentage: 40 },
          ],
          bitacora502030: {
            criterioProceso50: 'Participación y modelación continua',
            evidenciaColectiva20: 'Cartel técnico de equipo',
            evidenciaIndividual30: 'Problemario resuelto',
            ticketSalidaPregunta: '¿Qué variable controlaste hoy?',
          },
        },
        sectionVI: { studentMaterials: ['Libreta'], teacherMaterials: ['Pintarrón'], spaces: ['Aula'], digital: ['GeoGebra'], references: ['MCCEMS'] },
        sectionVII: {},
      };

      const a12 = validateAnexo12(content);
      expect(a12.checks.find((c) => c.id === 'i_semestre')?.ok).toBe(true);
      expect(a12.checks.find((c) => c.id === 'v_momentos')?.ok).toBe(true);
      expect(a12.criticalFailures).toBe(0);

      const dbepa = evaluateDBEPA(content as unknown as GeneratedPlanningContent, {
        uacName: 'Pensamiento Matemático IV',
        semester: 4,
        subsystem: 'BGE',
      });
      expect(dbepa.criteria.find((c) => c.id === 'carga_horaria')?.status).toBe('cumple');
      expect(dbepa.criteria.find((c) => c.id === 'evaluacion_integral')?.status).toBe('cumple');

      const btContent = {
        ...content,
        sectionI: { ...content.sectionI, subsystem: 'Bachillerato Tecnológico', totalHours: 96, totalHoursWeekly: 6 },
        sectionIV: {
          activities: [32, 32, 32].map((h, i) => ({ ...content.sectionIV.activities[i], hours: h })),
        },
      };
      const btDbepa = evaluateDBEPA(btContent as unknown as GeneratedPlanningContent, {
        uacName: 'Módulo BT',
        semester: 3,
        subsystem: 'tecnologico',
      });
      expect(btDbepa.criteria.find((c) => c.id === 'carga_horaria')?.status).toBe('cumple');
    });
  });

  describe('4. Secuencia Didáctica PDF y DOCX cuando sectionIV.activities está vacío pero sequenceJson existe', () => {
    it('renderiza todos los bloques de sequenceJson en PDF (>1 página) y DOCX con sesiones S1/24..S24/24', async () => {
      const makeSessions = (blockIdx: number): SecuenciaSesion[] =>
        Array.from({ length: 24 }, (_, idx) => ({
          sessionNum: idx + 1,
          totalSessions: 24,
          phase: idx < 3 ? 'Apertura' : idx < 21 ? 'Desarrollo' : 'Cierre',
          title: `Sesión B${blockIdx + 1}-${idx + 1}: Modelación de tasa de cambio`,
          teachingActivity: 'Exposición socrática y acompañamiento.',
          learningActivity: 'Resuelve problema situado con datos reales.',
          evidence: 'Tabla y gráfica validada.',
        }));

      const seqMap: Record<number, SecuenciaBloque> = {
        0: { blockIndex: 0, blockName: 'Bloque 1 (Corte 1): Bloque 1 (Corte 1)', hours: 24, sessions: makeSessions(0) },
        1: { blockIndex: 1, blockName: 'Bloque 2 (Corte 2): Segundo Corte de Evaluación Formativa', hours: 24, sessions: makeSessions(1) },
        2: { blockIndex: 2, blockName: 'Bloque 3 (Corte 3): Tercer Corte de Evaluación Formativa', hours: 24, sessions: makeSessions(2) },
      };

      const planning: Planning = {
        id: 'p-1',
        teacherId: 't-1',
        uacName: 'Pensamiento Matemático III',
        semester: 3,
        component: 'fundamental',
        curriculumName: 'MCCEMS',
        paecContext: 'Uso responsable del agua',
        extractedData: null,
        contentJson: {
          sectionI: {
            uacName: 'Pensamiento Matemático III',
            teacherName: 'Prof. Prueba',
            schoolName: 'Bachillerato Oficial',
            cct: '21EBH0001A',
            municipality: 'Puebla',
            semester: 3,
            groups: '3A',
            schoolYear: '2026-2027',
            applicationPeriod: 'Ago-Dic 2026',
            estimatedSessions: '72',
            component: 'fundamental',
            subsystem: 'Bachillerato General Estatal (BGE)',
            totalHours: 72,
            totalHoursWeekly: 4,
            metodologiaActiva: 'abp',
          },
          sectionII: { purpose: 'Propósito formativo sólido', learningOutcomes: [], activities: [], paecConnection: '' },
          sectionIII: { fundamentalCurriculum: [], expandedCurriculum: [] },
          sectionIV: { note: '', activities: [] },
          sectionV: { evaluations: [] },
          sectionVI: { studentMaterials: [], teacherMaterials: [], spaces: [], digital: [], references: [] },
          sectionVII: {},
        },
        sequenceJson: seqMap,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const pdf = await generateSecuenciaPDF(planning);
      expect(pdf.getNumberOfPages()).toBeGreaterThan(2);

      const docxBuf = await generateSecuenciaDocx(planning.contentJson!, seqMap);
      const zip = await JSZip.loadAsync(docxBuf);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).toContain('A 1/24');
      expect(xml).toContain('C 24/24');
      expect(xml).not.toContain('Bloque 1 (Corte 1): Bloque 1 (Corte 1)');
    });
  });

  describe('5. Normalización de LaTeX en PPTX preservando precios', () => {
    it('convierte fracciones, raíces, griegas y superíndices sin dañar importes monetarios', () => {
      expect(normalizeMathNotation('$\\frac{y}{x}$ y $\\frac{8}{2} = 4$')).toBe('y/x y 8/2 = 4');
      expect(normalizeMathNotation('Recta $f(x) = 4x$ en $(0,0)$')).toBe('Recta f(x) = 4x en (0,0)');
      expect(normalizeMathNotation('$\\sqrt{x^2 + 1}$ con $\\theta = 45^{\\circ}$')).toBe('√(x² + 1) con θ = 45°');
      expect(normalizeMathNotation('Costo de $500 pesos o $1,200.50 anuales')).toBe(
        'Costo de $500 pesos o $1,200.50 anuales'
      );
      expect(normalizeMathNotation('Ahorro: $500 + $200 este mes')).toBe('Ahorro: $500 + $200 este mes');
    });
  });

  describe('6. Propagación de metodología al Libro Semestral y renderer PDF', () => {
    it('conserva methodology y evita "[Metodología: Activa]" cuando planning tiene metodologia_activa', () => {
      const planning = {
        id: 'p-met',
        teacherId: 't-1',
        uacName: 'Pensamiento Matemático III',
        semester: 3,
        component: 'fundamental',
        curriculumName: 'MCCEMS',
        paecContext: 'PAEC',
        extractedData: null,
        contentJson: { sectionI: { uacName: 'Pensamiento Matemático III' } } as unknown as GeneratedPlanningContent,
        metodologiaActiva: 'abp',
        status: 'generated',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Planning;

      const makeBook = (idx: number): ActiveWorkTextbook => ({
        id: `b-${idx}`,
        planningId: 'p-met',
        blockIndex: idx,
        blockName: `Bloque ${idx + 1}`,
        version: 1,
        subsystem: 'bge',
        methodology: 'abp',
        targetPages: 45,
        totalPages: 48,
        totalWords: 20500,
        generatedAt: new Date().toISOString(),
        qualityScore: 95,
        qualityWarning: false,
        coverData: {
          title: 'Libro',
          subtitle: 'Sub',
          subjectName: 'Pensamiento Matemático III',
          semester: 3,
          blockNumber: idx + 1,
          teacherName: 'Docente',
          schoolName: 'Plantel',
          cct: '21EBH0001A',
        },
        tableOfContents: [],
        missions: [],
        projectSection: {
          artifactName: 'Prototipo',
          communityUtility: 'Medición escolar',
          phases: [],
          technicalSpecs: [],
          acceptanceCriteria: [],
        },
        evaluationSection: {
          source: 'generated_fresh',
          rubric: [],
          checklist: [],
          criticalThinkingQuiz: [],
          metacognitiveReflection: { prompts: [] },
        },
      });

      const { consolidatedBook } = buildConsolidatedBook([makeBook(0), makeBook(1), makeBook(2)], planning);
      expect(consolidatedBook.methodology).toBe('abp');
      expect(resolveWorkbookMethodology(consolidatedBook, planning)).toBe('abp');
    });
  });

  describe('7. Fail-Closed en POST /api/plannings/[id]/generate', () => {
    it('emite __ERROR__ y NO envía notificación de éxito cuando validateAndPersistPlanningContent rechaza', async () => {
      mockValidateAndPersist.mockResolvedValueOnce({
        success: false,
        error: 'Fallo crítico Anexo 12',
        criticalFailures: [{ id: 'v_momentos', label: 'Incluye evaluación diagnóstica, formativa y sumativa', ok: false, severity: 'critical' }],
        anexo12Report: { ok: false, score: 70, passed: 20, total: 29, criticalFailures: 1, warningFailures: 0, checks: [], evaluatedAt: '' },
        dbepaReport: { score: 80, semaforo: 'amarillo', passed: 9, total: 12, criteria: [], resumen: '', evaluadoEn: '' },
      });

      const { POST } = await import('@/app/api/plannings/[id]/generate/route');
      const req = new Request('http://localhost/api/plannings/11111111-1111-1111-1111-111111111111/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedData: {
            uacName: 'Pensamiento Matemático III',
            totalHours: 72,
            learningOutcome: 'Modela fenómenos reales de cambio.',
            activities: [
              { name: 'Progresión 1', hours: 24, corte: 1 },
              { name: 'Progresión 2', hours: 24, corte: 2 },
              { name: 'Progresión 3', hours: 24, corte: 3 },
            ],
          },
          context: {
            teacherName: 'Prof. Prueba',
            schoolName: 'Bachillerato Oficial',
            municipality: 'Puebla',
            state: 'Puebla',
            region: 'Centro',
            subsystem: 'Bachillerato General Estatal (BGE)',
            groupInfo: '3A',
            paecProblem: 'Contaminación local',
            studentContext: 'Estudiantes urbanos',
          },
        }),
      });

      const res = await POST(req as never, {
        params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }),
      });
      const body = await res.text();

      expect(body).toContain('__ERROR__:');
      expect(body).toContain('v_momentos');
      expect(mockSendNotification).not.toHaveBeenCalled();
      expect(mockLogActivity).toHaveBeenCalledWith(expect.objectContaining({ success: false }));

      // Verifica además hidratación determinista en el objeto pasado a validateAndPersistPlanningContent
      const persistedArg = mockValidateAndPersist.mock.calls[0][2] as {
        sectionI: Record<string, unknown>;
        sectionII: { retoSituado: { validacion?: { score: number } } };
      };
      expect(persistedArg.sectionI.totalHours).toBe(72);
      expect(persistedArg.sectionI.totalHoursWeekly).toBe(4);
      expect(persistedArg.sectionI.semester).toBe(3);
      expect(persistedArg.sectionII.retoSituado.validacion?.score).toBe(4);
    });
  });
});
