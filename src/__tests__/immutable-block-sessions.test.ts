import { describe, it, expect } from 'vitest';
import {
  resolveCurricularBlocks,
  enforceCanonicalCortesOnActivities,
} from '@/lib/curricular-blocks';
import { generateCurricularBlockSessions } from '@/lib/session-progression-engine';
import { buildBlockBlueprint } from '@/lib/guide-engine/blueprint-architect-agent';
import { buildUserPrompt } from '@/lib/prompts/build-prompt';
import { enforceMinimumSecuenciaActivities } from '@/lib/planning/progresiones-enforcer';
import { validateAnexo12 } from '@/lib/planning/anexo12-validator';
import type { GeneratedPlanningContent, Planning } from '@/types/planning';

describe('Regla inmortal de sesiones por bloque según horas semanales (6/12/18/24/30)', () => {
  it('impone 6, 12, 18, 24 y 30 sesiones en TODOS los bloques para 1h, 2h, 3h, 4h y 5h semanales aun con N=5 actividades desiguales', () => {
    const cases: Array<[number, number]> = [
      [1, 6],
      [2, 12],
      [3, 18],
      [4, 24],
      [5, 30],
    ];

    for (const [weeklyHours, expectedSessions] of cases) {
      const content = {
        sectionI: {
          uacName: 'Asignatura de Prueba',
          totalHoursWeekly: weeklyHours,
          totalHours: weeklyHours * 18,
          subsystem: 'BGE',
          component: 'fundamental',
        },
        sectionIV: {
          // 5 propósitos mal repartidos a propósito (simula 15, 15, 14, 14, 14 -> 30/28/14)
          activities: [
            { name: 'Propósito 1', hours: 15 },
            { name: 'Propósito 2', hours: 15 },
            { name: 'Propósito 3', hours: 14 },
            { name: 'Propósito 4', hours: 14 },
            { name: 'Propósito 5', hours: 14 },
          ],
        },
      } as unknown as GeneratedPlanningContent;

      const blocks = resolveCurricularBlocks(content);
      expect(blocks).toHaveLength(3);
      for (const block of blocks) {
        expect(block.hours).toBe(expectedSessions);
        const actsSum = block.activities.reduce((acc, a) => acc + (a.hours || 0), 0);
        expect(actsSum).toBe(expectedSessions);
        const sessions = generateCurricularBlockSessions(block, false, null);
        expect(sessions).toHaveLength(expectedSessions);
      }
    }
  });

  it('corrige Pensamiento Filosófico y Humanidades I (72h, 4h/sem, 5 propósitos) de [15,15,14,14,14] a 24/24/24', () => {
    const rawActivities = [
      { order: 1, name: 'Pensamiento Filosófico y Humanidades', hours: 15 },
      { order: 2, name: 'Preguntas significativas sobre la vida', hours: 15 },
      { order: 3, name: 'Análisis de la cotidianidad', hours: 14 },
      { order: 4, name: 'Conocimiento, Ciencia y Verdad', hours: 14 },
      { order: 5, name: 'Comunidades de diálogo', hours: 14 },
    ];

    const normalized = enforceCanonicalCortesOnActivities(rawActivities, 4);
    expect(normalized.map((a) => [a.corte, a.hours])).toEqual([
      ['Corte 1', 12],
      ['Corte 1', 12],
      ['Corte 2', 12],
      ['Corte 2', 12],
      ['Corte 3', 24],
    ]);

    const prompt = buildUserPrompt(
      {
        uacName: 'Pensamiento Filosófico y Humanidades I. El ejercicio de filosofar y la perspectiva',
        totalHours: 72,
        learningOutcome: 'Ejercita el pensamiento filosófico.',
        activities: rawActivities,
        evidences: ['Diálogo filosófico'],
        parseConfidence: 'high',
      },
      {
        teacherName: 'Docente Prueba',
        schoolName: 'Bachillerato General Estatal',
        municipality: 'Puebla',
        state: 'Puebla',
        region: 'Puebla',
        groupInfo: '1° A',
        studentContext: 'Estudiantes de primer semestre',
        subsystem: 'bge',
        paecProblem: 'Convivencia escolar',
      },
      1,
      'fundamental'
    );

    expect(prompt).toContain('Comunidades de diálogo (24 horas) [Asignado al Corte 3]');
    expect(prompt).toContain('Corte 1: 24h, Corte 2: 24h, Corte 3: 24h');
  });

  it('buildBlockBlueprint descarta sequence_json desbalanceada (14 sesiones en Bloque 3) y construye 24 sesiones canónicas', () => {
    const stalePlanning = {
      id: 'a0e4a86e-998e-4c9d-a35f-de7311e29e84',
      uacName: 'Pensamiento Filosófico y Humanidades I',
      semester: 1,
      component: 'fundamental',
      contentJson: {
        sectionI: { totalHours: 72, totalHoursWeekly: 4, subsystem: 'BGE' },
        sectionIV: {
          activities: [
            { name: 'P1', hours: 15 },
            { name: 'P2', hours: 15 },
            { name: 'P3', hours: 14 },
            { name: 'P4', hours: 14 },
            { name: 'P5', hours: 14 },
          ],
        },
      },
      sequenceJson: {
        2: {
          blockIndex: 2,
          blockName: 'Bloque 3',
          hours: 14,
          sessions: Array.from({ length: 14 }, (_, idx) => ({
            sessionNum: idx + 1,
            totalSessions: 14,
            phase: idx < 2 ? 'Apertura' : idx >= 12 ? 'Cierre' : 'Desarrollo',
            title: `Sesión vieja ${idx + 1}`,
            teachingActivity: 'Actividad docente',
            learningActivity: 'Actividad estudiante',
            evidence: 'Evidencia',
          })),
        },
      },
    } as unknown as Planning;

    const blueprint = buildBlockBlueprint({
      blockIndex: 2,
      blockName: 'Bloque 3 (Corte 3): Comunidades de diálogo',
      planning: stalePlanning,
      curriculum: {
        uacName: 'Pensamiento Filosófico y Humanidades I',
        semester: 1,
        subsystem: 'bge',
        component: 'fundamental',
        targetPages: { min: 60, max: 67 },
        targetWords: { min: 27000, max: 30000 },
        sessionsPerBlock: 24,
        budget: {
          weeklyHours: 4,
          sessionsPerBlock: 24,
          targetPages: { min: 60, ideal: 63, max: 67 },
          targetWords: { min: 27000, ideal: 28500, max: 30000 },
          pagesPerSession: { min: 2.5, ideal: 2.64, max: 2.78 },
          wordsPerSession: { min: 1125, ideal: 1188, max: 1250 },
          missionBudgets: {
            foundation: { targetWords: { min: 4500, ideal: 4750, max: 5000 }, targetPages: { min: 10, ideal: 11, max: 11 }, sessionsCount: 4 },
            lab: { targetWords: { min: 9000, ideal: 9500, max: 10000 }, targetPages: { min: 20, ideal: 21, max: 22 }, sessionsCount: 8 },
            project: { targetWords: { min: 9000, ideal: 9500, max: 10000 }, targetPages: { min: 20, ideal: 21, max: 22 }, sessionsCount: 8 },
            evaluation: { targetWords: { min: 4500, ideal: 4750, max: 5000 }, targetPages: { min: 10, ideal: 11, max: 11 }, sessionsCount: 4 },
          },
        },
        disciplineArea: 'Humanidades',
        pedagogicalOrientation: 'Diálogo filosófico',
        applicableNorms: [],
        safetyRules: [],
        paecConnection: { projectName: 'PAEC', communityProblem: 'Convivencia', suggestedHooks: [] },
        studentProfile: { contextDescription: 'BGE', scaffoldingAdvice: '' },
      },
    });

    expect(blueprint.totalSessions).toBe(24);
    expect(blueprint.sessions).toHaveLength(24);
  });

  it('enforceMinimumSecuenciaActivities rescata un colapso de 1 actividad del LLM en 1.º-4.º semestre y aprueba iv_secuencia / iv_fases / iv_tres_saberes en Anexo 12', () => {
    const collapsedContent: Record<string, unknown> = {
      sectionI: {
        uacName: 'Pensamiento Filosófico y Humanidades I',
        subjectName: 'Pensamiento Filosófico y Humanidades I',
        teacherName: 'Prof. Samuel',
        schoolName: 'Bachillerato General Estatal',
        cct: '21EBH0123A',
        schoolZone: 'Zona 004',
        municipality: 'Venustiano Carranza',
        semester: 1,
        component: 'fundamental',
        subsystem: 'BGE',
        groups: '1° A',
        totalHours: 72,
        totalHoursWeekly: 4,
        applicationPeriod: 'Ciclo escolar 2026-2027',
      },
      sectionII: {
        purpose: 'Desarrollar el ejercicio de filosofar y el diálogo argumentado en la comunidad.',
        learningOutcomes: ['Formula preguntas filosóficas situadas.'],
        retoSituado: {
          verboInfinitivo: 'Construir',
          contextoLocal: 'en Venustiano Carranza, Puebla',
          problematicaReal: 'deterioro del diálogo comunitario juvenil',
          propositoCurricular: 'mediante comunidades de indagación filosófica',
        },
      },
      sectionIII: { productoIntegrador: 'Foro comunitario de diálogo filosófico' },
      sectionIV: {
        // Simula el fallo real donde Gemini devolvió solo 1 bloque colapsado en vez de >= 3
        activities: [
          {
            name: 'Pensamiento Filosófico Integral',
            hours: 72,
            methodology: 'estudio_casos',
            apertura: { activities: 'Exploración de saberes previos mediante preguntas detonadoras.' },
            ejecucion: { activities: 'Análisis colaborativo de dilemas éticos cotidianos.' },
            conclusion: { activities: 'Comunidad de diálogo y reflexión metacognitiva grupal.' },
            saberes: {
              saber: 'Conceptos filosóficos fundamentales',
              saberHacer: 'Argumentación racional estructurada',
              saberSer: 'Escucha activa y respeto dialógico',
            },
          },
        ],
      },
      sectionV: {
        evaluations: [
          { type: 'Diagnóstica', moment: 'Inicio', agent: 'Autoevaluación', evidence: 'Cuestionario diagnóstico', instrument: 'Lista de cotejo', percentage: 10 },
          { type: 'Formativa', moment: 'Desarrollo', agent: 'Coevaluación', evidence: 'Bitácora de argumentos', instrument: 'Rúbrica analítica', percentage: 50 },
          { type: 'Sumativa', moment: 'Cierre', agent: 'Heteroevaluación', evidence: 'Foro filosófico', instrument: 'Rúbrica integradora', percentage: 40 },
        ],
        bitacora502030: {
          criterioProceso50: 'Participación dialógica y problematización continua (50%)',
          evidenciaColectiva20: 'Comunidad de diálogo escolar (20%)',
          evidenciaIndividual30: 'Ensayo filosófico situado (30%)',
          ticketSalidaPregunta: '¿Qué supuesto cuestionaste hoy?',
        },
      },
      sectionVI: { studentMaterials: ['Cuaderno'], teacherMaterials: ['Guía didáctica'], references: ['SEP MCCEMS'] },
    };

    enforceMinimumSecuenciaActivities(
      collapsedContent,
      null,
      {
        uacName: 'Pensamiento Filosófico y Humanidades I',
        totalHours: 72,
        learningOutcome: 'Ejercita el filosofar.',
        activities: [
          { order: 1, name: 'Pensamiento Filosófico y Humanidades', hours: 15 },
          { order: 2, name: 'Preguntas significativas sobre la vida', hours: 15 },
          { order: 3, name: 'Análisis de la cotidianidad', hours: 14 },
          { order: 4, name: 'Conocimiento, Ciencia y Verdad', hours: 14 },
          { order: 5, name: 'Comunidades de diálogo', hours: 14 },
        ],
        evidences: ['Foro'],
        parseConfidence: 'high',
      },
      {
        uacName: 'Pensamiento Filosófico y Humanidades I',
        semester: 1,
        component: 'fundamental',
        totalHours: 72,
      }
    );

    const s4 = collapsedContent.sectionIV as { activities: Array<{ hours?: number; corte?: string }> };
    s4.activities = enforceCanonicalCortesOnActivities(s4.activities, 4);

    expect(s4.activities).toHaveLength(5);
    const report = validateAnexo12(collapsedContent, { weeklyHours: 4, totalHours: 72 });
    expect(report.criticalFailures).toBe(0);
    expect(report.checks.find((c) => c.id === 'iv_secuencia')?.ok).toBe(true);
    expect(report.checks.find((c) => c.id === 'iv_fases')?.ok).toBe(true);
    expect(report.checks.find((c) => c.id === 'iv_tres_saberes')?.ok).toBe(true);
  });
});
