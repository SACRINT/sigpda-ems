import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerate = vi.fn();
vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: (...args: unknown[]) => mockGenerate(...args),
  getActiveKeyPoolSize: vi.fn().mockResolvedValue(4),
}));

import {
  extractRequiredCurricularTerms,
  partitionRequiredTerms,
  formatRequiredTermsDirective,
  assignTermsToSessions,
} from '@/lib/guide-engine/planning-content-alignment';
import { applySurgicalSessionRepair, type SessionShardContext } from '@/lib/guide-engine/writers/session-shard';
import { createWriterScheduler } from '@/lib/guide-engine/writer-scheduler';
import { generateLabMission } from '@/lib/guide-engine/writers/lab-writer';
import type { WriterInput, WriterOutput, PlanningActivities } from '@/lib/guide-engine/writers/writer-contract';

const words = (n: number, w = 'palabra') => Array.from({ length: n }, () => w).join(' ');
const para = (n: number) => `${words(n)}.`;

function makeDensePlan(n: number, extraText = '') {
  return {
    sessionNumber: n,
    objetivo: `Lo que vas a aprender en la sesión ${n} ${extraText}`,
    motivacion: words(90),
    saberesPrevios: words(60),
    contenido: [para(160), para(160), `${words(160)} ${extraText}.`].join('\n\n'),
    ejemploResuelto: `Planteamiento: ${words(60)}\nPaso 1: ${words(70)}\nPaso 2: ${words(70)}\nPaso 3: ${words(70)}\nPaso 4: ${words(70)}`,
    practica: [
      { enunciado: words(70), pista: words(35), solucion: ['Paso 1: x', 'Paso 2: y', 'Respuesta final: z'] },
      { enunciado: words(70), pista: words(35), solucion: ['Paso 1: x', 'Respuesta final: z'] },
    ],
    aplicacion: words(90),
    autoevaluacion: ['¿Puedo explicar el concepto central?', '¿Logré la práctica sin mirar?'],
    recursos: [{ titulo: 'Video educativo', url: 'https://www.youtube.com/results?search_query=x', tipo: 'video' }],
    productoIntegrador: words(70),
  };
}

describe('Fase 3 y 4 — Alineación preventiva, Sharding en Writers y Reparación Quirúrgica', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it('extractRequiredCurricularTerms y partitionRequiredTerms extraen y reparten términos por misión sin hardcoding', () => {
    const activities: PlanningActivities = {
      apertura: {
        description: 'Diagnóstico situacional sobre el equilibrio térmico en invernaderos comunitarios',
        processes: 'Indagación dialógica en equipos',
        materials: 'termómetro infrarrojo, bitácora de campo',
      },
      ejecucion: {
        description: 'Modelación experimental de transferencia de calor por conducción y convección',
        processes: 'Registro sistemático de gradientes térmicos',
        materials: 'calorímetro escolar, sensor digital',
      },
      conclusion: {
        description: 'Evaluación sumativa de propuestas de aislamiento sustentable',
        processes: 'Defensa ante el grupo con rúbrica analítica',
        materials: 'lista de cotejo',
      },
      contenidoFormativo: 'Leyes de la termodinámica y transferencia de energía térmica',
      saberes: {
        saber: 'Identifica los mecanismos de conducción, convección y radiación térmica',
        saberHacer: 'Calcula flujos de calor aplicando la ley de Fourier en paredes compuestas',
        saberSer: 'Valora el ahorro energético comunitario con responsabilidad socioambiental',
      },
    };

    const terms = extractRequiredCurricularTerms(activities);
    expect(terms.contenido.length).toBeGreaterThanOrEqual(1);
    expect(terms.saberes.length).toBeGreaterThanOrEqual(3);
    expect(terms.materiales).toContain('termómetro infrarrojo');
    expect(terms.materiales).toContain('calorímetro escolar');

    const partition = partitionRequiredTerms(terms);
    expect(partition.foundation.length).toBeGreaterThan(0);
    expect(partition.lab.length).toBeGreaterThan(0);
    expect(partition.project.length).toBeGreaterThan(0);
    expect(partition.evaluation.length).toBeGreaterThan(0);

    const directive = formatRequiredTermsDirective(partition.foundation);
    expect(directive).toContain('CONCEPTOS, SABERES Y MATERIALES');
  });

  it('assignTermsToSessions asigna términos a las sesiones de la misión en round-robin determinista', () => {
    const assigned = assignTermsToSessions(
      ['termómetro infrarrojo', 'calorímetro escolar', 'ley de Fourier'],
      [4, 5]
    );
    expect(assigned.get(4)).toEqual(['termómetro infrarrojo', 'ley de Fourier']);
    expect(assigned.get(5)).toEqual(['calorímetro escolar']);
  });

  it('generateLabMission con scheduler ejecuta 1 llamada narrativa + 3 paquetes de sesiones en paralelo (8 sesiones → 3+3+2)', async () => {
    const sessions = [4, 5, 6, 7, 8, 9, 10, 11];
    mockGenerate.mockImplementation(async (_sys: string, user: string) => {
      const m = /exactamente \d+: ([\d, ]+)\)/.exec(user);
      if (m) {
        const nums = m[1].split(',').map((s) => parseInt(s.trim(), 10));
        return JSON.stringify({ sessionPlans: nums.map((n) => makeDensePlan(n)) });
      }
      return JSON.stringify({
        labTitle: 'Práctica de Laboratorio',
        objective: 'Objetivo experimental riguroso',
        materialsList: ['✓ Sensor'],
        stepByStepProcedure: words(120),
        dataTableColumns: ['A', 'B'],
        executableCodeOrProtocol: words(100),
        autonomousChallenge: 'Paso 1: a. Paso 2: b. Paso 3: c. Paso 4: d. Paso 5: e.',
        reflectionQuestions: ['¿Pregunta 1?'],
        quickTroubleshooting: [],
      });
    });

    const scheduler = createWriterScheduler({ maxConcurrency: 3, jitterMs: 0 });
    const input: WriterInput = {
      planning: { id: 'p1', teacherId: 't1', uacName: 'Física II', semester: 4, component: 'fundamental' } as never,
      blockIndex: 0,
      blockName: 'Bloque 1',
      sessions: sessions.map((n) => ({ sessionNum: n, phase: 'Desarrollo', title: `Tema ${n}`, focus: `Foco ${n}` }) as never),
      missions: [
        {
          missionIndex: 2,
          title: 'Misión 2: Laboratorio',
          sessionNumbers: sessions,
          sessionTopic: 'Termodinámica',
          focus: 'Experimentación',
          missionType: 'lab',
          targetPages: 12,
          targetWords: 8000,
        },
      ],
      paecContext: 'Invernadero escolar',
      studentProfile: 'Estudiantes BGE',
      subsystem: 'bge',
      uacName: 'Física II',
      targetWords: { min: 7000, ideal: 8000, max: 9000 },
      requiredTerms: ['calorímetro escolar', 'termómetro infrarrojo'],
      scheduler,
    };

    const out = await generateLabMission(input);
    expect(out.section.sessionPlans?.map((p) => p.sessionNumber)).toEqual(sessions);
    // 1 llamada narrativa + 3 llamadas de paquetes (3+3+2) = 4 llamadas pequeñas en lugar de 1 mega-llamada
    expect(mockGenerate).toHaveBeenCalledTimes(4);
    expect(scheduler.stats.maxObservedConcurrency).toBeLessThanOrEqual(3);
  });

  it('applySurgicalSessionRepair regenera SOLO la sesión indicada y conserva intactas las demás', async () => {
    const existingPlans = [makeDensePlan(4), makeDensePlan(5), makeDensePlan(6)];
    const previousOutput: WriterOutput = {
      type: 'lab',
      section: {
        missionIndex: 2,
        title: 'Misión 2',
        coveredSessions: [4, 5, 6],
        sessionTopic: 'Tema',
        sessionFocus: 'Foco',
        phenomenonHook: { story: 'Historia intacta', detonatingQuestion: '¿P?' },
        conceptZero: { physicalAnalogy: 'Analogía intacta', coreExplanation: 'Explicación intacta' },
        iDoSection: { stepByStepDemo: 'Demo intacta' },
        weDoSection: { guidedPractice: 'Guiada intacta', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto intacto', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: { question: 'Q', reflectionPrompts: [], criteriaChecklist: [] },
        sessionPlans: existingPlans as never,
        wordCount: 3600,
      },
      wordCount: 3600,
      tokensUsed: 4680,
      qualityScore: 88,
      warnings: [],
    };

    mockGenerate.mockImplementation(async (_sys: string, user: string) => {
      expect(user).toContain('exactamente 1: 5');
      return JSON.stringify({
        sessionPlans: [makeDensePlan(5, 'calorímetro escolar integrado quirúrgicamente')],
      });
    });

    const ctx: SessionShardContext = {
      input: {
        planning: { teacherId: 't1', semester: 4 },
        blockIndex: 0,
        blockName: 'Bloque 1',
        sessions: [4, 5, 6].map((n) => ({ sessionNum: n, phase: 'Desarrollo', title: `T${n}`, focus: `F${n}` })),
        missions: [],
        paecContext: 'PAEC',
        studentProfile: 'Perfil',
        subsystem: 'bge',
        uacName: 'Física II',
        targetWords: { min: 3000, ideal: 3600, max: 4200 },
        scheduler: createWriterScheduler({ maxConcurrency: 2, jitterMs: 0 }),
      } as never,
      missionType: 'lab',
      missionTitle: 'Misión 2',
      coveredSessions: [4, 5, 6],
      disciplineName: 'Ciencias Naturales',
      fallbackContext: { uacName: 'Física II' },
      targetWordsPerPlan: 900,
    };

    const repaired = await applySurgicalSessionRepair(
      ctx,
      previousOutput,
      new Map([[5, ['calorímetro escolar']]])
    );

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(repaired.section.phenomenonHook.story).toBe('Historia intacta');
    expect(repaired.section.sessionPlans?.[0].objetivo).toBe(existingPlans[0].objetivo);
    expect(repaired.section.sessionPlans?.[2].objetivo).toBe(existingPlans[2].objetivo);
    expect(repaired.section.sessionPlans?.[1].contenido).toContain('calorímetro escolar integrado quirúrgicamente');
  });
});
