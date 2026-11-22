import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import JSZip from 'jszip';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import { buildSacrintDeck, LessonGuideNoSessionsError } from '@/lib/visual-engine/sacrint/spec';
import { findLinguisticCorruption, reviewBlockMaterials } from '@/lib/guide-engine/material-review';
import type { ActiveWorkTextbook, SessionPlan } from '@/types/work-textbook';

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockIsAdmin = vi.fn();
vi.mock('@/lib/admin-unified', () => ({ isAdmin: (email: string) => mockIsAdmin(email) }));

let mockPlanRows: Array<{
  id: string;
  teacher_id: string;
  uac_name: string;
  component: string | null;
  curriculum_name?: string | null;
}> = [];
const mockSql = vi.fn(() => Promise.resolve(mockPlanRows));
const mockGetTeacherByEmail = vi.fn();
const mockGetAllBlockWorkbooks = vi.fn();

vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
  getTeacherByEmail: (email: string) => mockGetTeacherByEmail(email),
  getAllBlockWorkbooks: (id: string) => mockGetAllBlockWorkbooks(id),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET as GET_COMBINED_PPTX } from '@/app/api/planeaciones/[id]/presentacion/combinada/route';
import { buildAulaPackageZip } from '@/lib/aula-package';

const planningId = '22222222-2222-2222-2222-222222222222';
const teacherId = 'teacher-review-1';

function buildWorkbookWithSession(sessionNumber = 1): ActiveWorkTextbook {
  const wb = structuredClone(MATH_DEMO_WORKBOOK);
  const session: SessionPlan = {
    sessionNumber,
    objetivo: 'Modelar ingresos y gastos lineales con ecuaciones de primer grado.',
    motivacion: 'Un taller comunitario cobra $150 de inscripción y $80 por sesión.',
    saberesPrevios: 'Despeje básico de ecuaciones de la forma ax + b = c.',
    contenido: 'Una ecuación lineal representa una tasa de cambio constante respecto a una variable.',
    ejemploResuelto: 'Con 80x + 150 = 550, resta 150 para obtener 80x = 400 y divide entre 80: x = 5.',
    practica: [
      {
        enunciado: 'Resuelve 40x + 120 = 320 para hallar el número de semanas.',
        pista: 'Resta 120 en ambos lados primero.',
        solucion: ['x = 5'],
      },
    ],
    aplicacion: 'Sirve para calcular presupuestos semanales sin déficit.',
    autoevaluacion: ['Identifico pendiente y ordenada al origen en problemas cotidianos.'],
    recursos: [],
    productoIntegrador: 'Tabla de costos semanales del proyecto.',
  };
  wb.missions![0]!.coveredSessions = [sessionNumber];
  wb.missions![0]!.sessionPlans = [session];
  return wb;
}

describe('SACRINT Part 2 — S6 Review Gate on Combined Decks & Aula Package', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 'docente@ems.mx' } });
    mockIsAdmin.mockResolvedValue(false);
    mockPlanRows = [{ id: planningId, teacher_id: teacherId, uac_name: 'Pensamiento Matemático III', component: 'Fundamental' }];
    mockGetTeacherByEmail.mockResolvedValue({ id: teacherId, role: 'docente' });
  });

  it('reports 3–160 range in S6_INVALID_SLIDE_COUNT message when slide count is invalid', () => {
    const wb = buildWorkbookWithSession(1);
    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide' });
    deck.slides = deck.slides.slice(0, 2); // 2 slides is invalid in all modes

    const report = reviewBlockMaterials({ workbook: wb, deck, checkFullBlockPersistence: false });
    const issue = report.byMaterial.deck.issues.find((i) => i.code === 'S6_INVALID_SLIDE_COUNT');
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('3 a 160 en modo guía por clase');
  });

  it('throws LessonGuideNoSessionsError and returns HTTP 422 on combined route when sessionPlans is empty', async () => {
    const emptySessionsWb = structuredClone(MATH_DEMO_WORKBOOK);
    expect(() => buildSacrintDeck(emptySessionsWb, { mode: 'lesson-guide' })).toThrow(LessonGuideNoSessionsError);

    mockGetAllBlockWorkbooks.mockResolvedValue({
      block_0: { current: emptySessionsWb, version: 1 },
    });

    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/presentacion/combinada`);
    const res = await GET_COMBINED_PPTX(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe('LESSON_GUIDE_NO_SESSIONS');
  });

  it('blocks GET /api/planeaciones/[id]/presentacion/combinada with HTTP 422 when a combined deck has an S6 error', async () => {
    const corruptWb = buildWorkbookWithSession(1);
    corruptWb.missions![0]!.title = 'Misión con placeholder ${corruptToken} no interpolado';

    mockGetAllBlockWorkbooks.mockResolvedValue({
      block_0: { current: corruptWb, version: 1 },
    });

    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/presentacion/combinada`);
    const res = await GET_COMBINED_PPTX(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.issues.some((i: { code: string }) => i.code === 'S6_PLACEHOLDER_IN_DECK')).toBe(true);
  });

  it('excludes only corrupt S6 decks in buildAulaPackageZip without falling back to generic PPTX', async () => {
    const corruptWb = buildWorkbookWithSession(1);
    corruptWb.missions![0]!.title = 'Misión con placeholder ${corruptToken} no interpolado';

    mockGetAllBlockWorkbooks.mockResolvedValue({
      block_0: { current: corruptWb, version: 1 },
    });

    const fakePlanning = {
      id: planningId,
      teacher_id: teacherId,
      uac_name: 'Pensamiento Matemático III',
      semester: 3,
      subsystem: 'BGE',
      content_json: {
        sectionI: { uacName: 'Pensamiento Matemático III', semester: 3 },
      },
      extracted_data: { schoolName: 'Plantel 1', cct: '21EBH0001X' },
    } as unknown as Parameters<typeof buildAulaPackageZip>[0];

    const result = await buildAulaPackageZip(fakePlanning, []);
    expect(result.buffer.byteLength).toBeGreaterThan(1000);
    expect(result.warnings.some((w) => w.includes('S6_PLACEHOLDER_IN_DECK') && w.includes('Bloque 1') && w.includes('Misión 1'))).toBe(true);

    const zip = await JSZip.loadAsync(result.buffer);
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.startsWith('01_'))).toBe(true);
    expect(names.some((n) => n.startsWith('09_'))).toBe(true);
    expect(names.some((n) => n.startsWith('08_Presentacion_SACRINT_'))).toBe(false);
    expect(names.some((n) => n.startsWith('08_Presentacion_de_Clase_'))).toBe(false);
    const readme = await zip.file('LEEME_PAQUETE_AULA.txt')!.async('string');
    expect(readme).toContain('S6_PLACEHOLDER_IN_DECK');
  });

  it('keeps valid decks in 08_Presentacion_SACRINT while excluding only a corrupt mission deck', async () => {
    const mixedWb = buildWorkbookWithSession(1);
    const secondMission = structuredClone(mixedWb.missions![0]!);
    secondMission.missionIndex = 2;
    secondMission.title = 'Misión 2 con error ${corruptToken}';
    secondMission.coveredSessions = [2];
    secondMission.sessionPlans = [{ ...secondMission.sessionPlans![0]!, sessionNumber: 2 }];
    mixedWb.missions!.push(secondMission);

    mockGetAllBlockWorkbooks.mockResolvedValue({
      block_0: { current: mixedWb, version: 1 },
    });

    const fakePlanning = {
      id: planningId,
      teacher_id: teacherId,
      uac_name: 'Pensamiento Matemático III',
      semester: 3,
      subsystem: 'BGE',
      content_json: {
        sectionI: { uacName: 'Pensamiento Matemático III', semester: 3 },
      },
      extracted_data: { schoolName: 'Plantel 1', cct: '21EBH0001X' },
    } as unknown as Parameters<typeof buildAulaPackageZip>[0];

    const result = await buildAulaPackageZip(fakePlanning, []);
    const zip = await JSZip.loadAsync(result.buffer);
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.startsWith('08_Presentacion_'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('Misión 2') && w.includes('S6_PLACEHOLDER_IN_DECK'))).toBe(true);
  });

  it('forwards curriculum_name on GET /presentacion/combinada so Instalaciones Residenciales mezclas pass S8 without false HTTP 422', async () => {
    mockPlanRows = [
      {
        id: planningId,
        teacher_id: teacherId,
        uac_name:
          'Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas bajo la supervisión del experto',
        component: 'laboral',
        curriculum_name: 'Instalaciones Residenciales',
      },
    ];

    const constructionWb = buildWorkbookWithSession(1);
    constructionWb.coverData = {
      ...constructionWb.coverData,
      subjectName:
        'Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas bajo la supervisión del experto',
    };
    constructionWb.missions![0]!.title = 'Dosificación de mortero y mezcla de cemento';
    constructionWb.missions![0]!.sessionTopic = 'Dosificación de mortero y mezcla de cemento';
    constructionWb.missions![0]!.sessionFocus = 'Proporciones de cemento, arena, grava y agua en obra';
    constructionWb.missions![0]!.phenomenonHook = {
      story: 'En una obra residencial se requiere preparar mezcla de concreto homogénea.',
      detonatingQuestion: '¿Cómo garantizar la proporción exacta de cemento, arena y grava?',
    };
    constructionWb.missions![0]!.conceptZero = {
      physicalAnalogy: 'Preparar mezcla de cemento es dosificar ingredientes exactos por volumen.',
      coreExplanation: 'La dosificación correcta asegura resistencia estructural en elementos de vivienda.',
    };
    constructionWb.missions![0]!.iDoSection = {
      stepByStepDemo: 'Paso 1: Mide 1 bulto de cemento. Paso 2: Agrega 2 botes de arena y 3 de grava.',
    };
    constructionWb.missions![0]!.weDoSection = {
      guidedPractice: 'Calcula los botes de arena y grava para 3 bultos de cemento.',
      workbookElements: [],
    };
    constructionWb.missions![0]!.youDoSection = {
      autonomousChallenge: 'Diseña una tabla de dosificación para colar una cadena de 6 m.',
      workbookElements: [],
    };
    constructionWb.missions![0]!.sessionPlans = [
      {
        sessionNumber: 1,
        objetivo: 'Dosificar cemento, arena y agua para preparar una mezcla de concreto estructural.',
        motivacion: 'En obra residencial una mala dosificación de mezcla de cemento compromete la cimentación.',
        saberesPrevios: 'Proporciones volumétricas 1:2:3 y uso de botes de 19 litros en albañilería.',
        contenido:
          'La mezcla de concreto combina cemento Portland, arena limpia, grava y agua en proporciones exactas para alcanzar la resistencia requerida en zapatas y cadenas.',
        ejemploResuelto:
          'Planteamiento: Preparar mezcla de cemento 1:2:3 con 2 bultos de cemento. Paso 1: Mide 4 botes de arena limpia y 6 botes de grava. Paso 2: Incorpora el cemento en seco hasta homogeneizar. Paso 3: Hidrata gradualmente con agua limpia hasta lograr consistencia trabajable. Conclusión: Se obtienen 10 botes de agregados bien hidratados para colado.',
        practica: [
          {
            enunciado:
              'Calcula los botes de arena y grava necesarios para preparar mezcla de cemento proporción 1:2:3 con 3 bultos.',
            pista: 'Multiplica cada proporción por el número de bultos.',
            solucion: ['6 botes de arena y 9 botes de grava'],
          },
        ],
        aplicacion: 'Se aplica directamente en colados de castillos, dalas y firmes de vivienda.',
        autoevaluacion: ['Verifico la proporción de cemento, arena, grava y agua antes del mezclado.'],
        recursos: [],
        productoIntegrador: 'Bitácora de dosificación de mezclas en obra residencial.',
      },
    ];

    mockGetAllBlockWorkbooks.mockResolvedValue({
      block_0: { current: constructionWb, version: 1 },
    });

    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/presentacion/combinada`);
    const res = await GET_COMBINED_PPTX(req, { params: Promise.resolve({ id: planningId }) });

    if (res.status !== 200) {
      const errBody = await res.json();
      throw new Error(`Expected 200 but got ${res.status}: ${JSON.stringify(errBody)}`);
    }
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('presentationml');
  });

  it('blocks decks with mechanical linguistic corruption via S6_LINGUISTIC_CORRUPTION', () => {
    expect(findLinguisticCorruption('Recibe $2000 hacia comprar kits.')).toContain('hacia+infinitivo');
    expect(findLinguisticCorruption('Se define tal tal como adjetivo.')).toContain('tal_tal');
    expect(findLinguisticCorruption('El altavoz interno dicha funcionando.')).toContain('dicha+gerundio');
    expect(findLinguisticCorruption('Dispersión de luz en la expone.')).toContain('en_la_expone');
    expect(findLinguisticCorruption('Mide siempre a partir.')).toContain('a_partir_truncado');
    expect(findLinguisticCorruption('Aplicar escala (dibujo = (Dimensi).')).toContain('paren_ecuacion_trunca');
    expect(findLinguisticCorruption('El estudiante mide una muestra de suelo para hallar la densidad.')).toBeNull();

    const wb = buildWorkbookWithSession(1);
    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide' });
    deck.slides[0]!.subtitle = 'Recibe $2000 hacia comprar kits escolares.';
    const report = reviewBlockMaterials({ workbook: wb, deck, checkFullBlockPersistence: false });
    expect(report.byMaterial.deck.issues.some((i) => i.code === 'S6_LINGUISTIC_CORRUPTION' && i.severity === 'error')).toBe(true);
  });
});
