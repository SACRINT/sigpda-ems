import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitizeWorkbookResourceUrls } from '@/lib/resources/workbook-sanitizer';
import { enforceEditorialSoftMinimums } from '@/lib/editorial/session-plan-minimums';
import { validateAndPersistPlanningContent } from '@/lib/planning/planning-persistence';
import type { ActiveWorkTextbook, SessionPlan } from '@/types/work-textbook';

vi.mock('@/lib/db', () => ({
  updatePlanningContent: vi.fn(),
}));

vi.mock('@/lib/planning/planning-versions', () => ({
  recordPlanningVersion: vi.fn().mockResolvedValue({
    id: 'mock-version-1',
    version_number: 1,
    sha256_hash: 'mockhash123',
  }),
}));

import { updatePlanningContent } from '@/lib/db';

const PLANNING_ID = '11111111-2222-3333-4444-555555555555';
const TEACHER_ID = '66666666-7777-8888-9999-000000000000';

function dirtyWorkbook(): ActiveWorkTextbook {
  return {
    id: 'wb-runtime-dirty',
    planningId: PLANNING_ID,
    blockIndex: 0,
    blockName: 'Bloque I. Lengua y Comunicación',
    version: 1,
    subsystem: 'bge',
    targetPages: 18,
    totalPages: 18,
    totalWords: 6000,
    generatedAt: '2026-11-12T00:00:00Z',
    qualityScore: 70,
    qualityWarning: true,
    coverData: {
      title: 'Libro de trabajo',
      subtitle: 'Lengua y Comunicación I',
      subjectName: 'Lengua y Comunicación I',
      semester: 1,
      blockNumber: 1,
      teacherName: 'Docente',
      schoolName: 'Plantel',
    },
    tableOfContents: [],
    missions: [
      {
        missionIndex: 1,
        title: 'Misión 1: Lectura crítica',
        coveredSessions: [1],
        sessionTopic: 'Lectura crítica',
        sessionFocus: 'Argumentación',
        phenomenonHook: { story: 'Caso local', detonatingQuestion: '¿Qué argumento es válido?' },
        conceptZero: { physicalAnalogy: 'Analogía', coreExplanation: 'Explicación' },
        iDoSection: { stepByStepDemo: 'Demostración' },
        weDoSection: { guidedPractice: 'Práctica guiada', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: { question: '¿Qué aprendiste?', reflectionPrompts: [], criteriaChecklist: [] },
        wordCount: 1200,
        sessionPlans: [
          {
            sessionNumber: 1,
            objetivo: 'Analizar argumentos',
            motivacion: 'Problema local',
            saberesPrevios: 'Lectura',
            contenido: 'Tesis y argumentos',
            ejemploResuelto: 'Análisis de un texto',
            practica: [],
            aplicacion: 'Comunidad',
            autoevaluacion: [],
            productoIntegrador: 'Ensayo breve',
            recursos: [
              {
                titulo: 'Búsqueda genérica en YouTube',
                url: 'https://www.youtube.com/results?search_query=argumentacion',
                tipo: 'video',
              },
              {
                titulo: 'Búsqueda genérica en Google',
                url: 'https://www.google.com/search?q=argumentacion+texto',
                tipo: 'lectura',
              },
              {
                titulo: 'Recurso curado',
                url: 'https://www.khanacademy.org/',
                tipo: 'web',
              },
            ],
          },
        ],
      },
    ],
  } as unknown as ActiveWorkTextbook;
}

function dirtyPlanningContent(): Record<string, unknown> {
  return {
    sectionI: {
      subjectName: 'Lengua y Comunicación I',
      semester: 1,
      component: 'fundamental',
      totalHours: 54,
    },
    sectionII: {
      purpose: 'TODO [completar] propósito formativo de la planeación.',
      activities: [{ name: 'Actividad 1' }, { name: 'Actividad 2' }, { name: 'Actividad 3' }],
    },
    sectionIV: {
      activities: [
        {
          name: 'Actividad 1',
          hours: 18,
          apertura: { activities: 'Apertura con problema real' },
          ejecucion: { activities: 'Desarrollo con evidencia' },
          conclusion: { activities: 'Cierre con reflexión' },
          saberes: { saber: 'Concepto', saberHacer: 'Procedimiento', saberSer: 'Actitud' },
        },
      ],
    },
    sectionVI: {
      bibliography: ['https://www.google.com/search?q=fuente+generica'],
    },
  };
}

describe('Runtime anti-genérico: sanitizer + persistencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('erradica URLs de búsqueda del workbook antes de cualquier persistencia', () => {
    const { sanitized, replacedCount } = sanitizeWorkbookResourceUrls(dirtyWorkbook());
    const serialized = JSON.stringify(sanitized);

    expect(replacedCount).toBe(2);
    expect(serialized).not.toContain('youtube.com/results');
    expect(serialized).not.toContain('google.com/search');
    expect(serialized).toContain('https://www.khanacademy.org/');
  });

  it('bloquea fail-closed placeholders y URLs genéricas antes de escribir en BD', async () => {
    const result = await validateAndPersistPlanningContent(
      PLANNING_ID,
      TEACHER_ID,
      dirtyPlanningContent(),
      { isNewOrStrictMode: true }
    );

    expect(result.success).toBe(false);
    expect(result.criticalFailures?.map((check) => check.id)).toEqual(
      expect.arrayContaining(['x_placeholders', 'x_recursos_curados'])
    );
    expect(result.error).toMatch(/inconsistencias críticas/i);
    expect(updatePlanningContent).not.toHaveBeenCalled();
  });

  it('enforceEditorialSoftMinimums expulsa URLs de búsqueda abierta antes de componer el PDF editorial', () => {
    const planWithSearch: SessionPlan = {
      sessionNumber: 1,
      objetivo: 'Modelar ecuaciones lineales con datos de consumo eléctrico.',
      motivacion: 'Factura del plantel escolar.',
      saberesPrevios: 'Despejes básicos.',
      contenido: 'Una ecuación lineal modela razón de cambio constante en el tiempo.',
      ejemploResuelto: 'Costo = 2.5x + 40.',
      practica: [{ enunciado: 'Calcula el gasto para 20 kWh.', pista: 'Sustituye x = 20.' }],
      aplicacion: 'Estima el ahorro en tu hogar.',
      autoevaluacion: ['¿Qué representa la pendiente?', '¿Cuál es el cargo fijo?'],
      recursos: [
        {
          titulo: 'Búsqueda en YouTube',
          url: 'https://www.youtube.com/results?search_query=ecuaciones+lineales',
          tipo: 'video',
        },
      ],
      productoIntegrador: 'Tabla comparativa de consumo.',
    };

    const enforced = enforceEditorialSoftMinimums(planWithSearch);
    const serialized = JSON.stringify(enforced);

    expect(serialized).not.toContain('youtube.com/results');
    expect(enforced.recursos.length).toBeGreaterThanOrEqual(1);
    expect(enforced.recursos[0].url).toMatch(/^https:\/\//);
  });
});
