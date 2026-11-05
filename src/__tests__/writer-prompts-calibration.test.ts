/**
 * writer-prompts-calibration.test.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Pruebas unitarias de la calibración dinámica de prompts en los 4 writers (Fase P3.1):
 * - foundation-writer.ts
 * - lab-writer.ts
 * - project-writer.ts
 * - evaluation-writer.ts
 *
 * Verifica que los prompts no contengan números de palabras fijos / hardcodeados,
 * sino que escalen dinámicamente según input.targetWords y coveredSessions.length.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFoundationMission } from '@/lib/guide-engine/writers/foundation-writer';
import { generateLabMission } from '@/lib/guide-engine/writers/lab-writer';
import { generateProjectMission } from '@/lib/guide-engine/writers/project-writer';
import { generateEvaluationSection } from '@/lib/guide-engine/writers/evaluation-writer';
import { generateWithRotation } from '@/lib/ai-provider';
import type { WriterInput } from '@/lib/guide-engine/writers/writer-contract';

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
}));

describe('P3.1 — Calibración dinámica de prompts de los 4 Writers', () => {
  let capturedPrompts: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    capturedPrompts = [];

    vi.mocked(generateWithRotation).mockImplementation(async (_sys, prompt) => {
      capturedPrompts.push(prompt);
      // Retornar un JSON mínimo válido para evitar reintentos en el test
      return JSON.stringify({
        coreExplanation: 'Explicación formal extensa '.repeat(30),
        physicalAnalogy: 'Analogía física clara',
        iDoDemo: 'Modelado docente paso a paso',
        weDoPractice: 'Práctica guiada en equipo',
        youDoChallenge: 'Paso 1: Medir. Paso 2: Calcular. Paso 3: Probar. Paso 4: Ajustar. Paso 5: Concluir.',
        stepByStepProcedure: 'Procedimiento técnico',
        executableCodeOrProtocol: 'Protocolo de laboratorio',
        autonomousChallenge: 'Paso 1: Medir. Paso 2: Calcular. Paso 3: Probar. Paso 4: Ajustar. Paso 5: Concluir.',
        reflectionQuestions: 'Preguntas de reflexión',
        communityUtility: 'Utilidad comunitaria PAEC',
        phases: [{ phaseNumber: 1, title: 'Fase 1' }],
        rubricSummary: 'Rúbrica analítica',
        learningObjectives: ['Obj 1', 'Obj 2', 'Obj 3'],
        rubric: [],
        checklist: [],
        tieredExercises: [
          { level: 'basico', exercises: [{ prompt: 'E1', hint: 'H1' }, { prompt: 'E2', hint: 'H2' }] },
          { level: 'intermedio', exercises: [{ prompt: 'E3', hint: 'H3' }, { prompt: 'E4', hint: 'H4' }] },
          { level: 'avanzado', exercises: [{ prompt: 'E5', hint: 'H5' }, { prompt: 'E6', hint: 'H6' }] },
        ],
        criticalThinkingQuiz: [],
        metacognitiveReflection: { prompts: [] },
        sessionPlans: [
          { sessionNumber: 1, objetivo: 'Obj 1', contenido: 'Contenido 1' },
          { sessionNumber: 2, objetivo: 'Obj 2', contenido: 'Contenido 2' },
          { sessionNumber: 3, objetivo: 'Obj 3', contenido: 'Contenido 3' },
        ],
      });
    });
  });

  const makeWriterInput = (params: {
    missionType: 'foundation' | 'lab' | 'project' | 'evaluation';
    coveredSessions: number[];
    minWords: number;
    idealWords: number;
    maxWords: number;
  }): WriterInput => {
    const mission = {
      missionIndex: params.missionType === 'foundation' ? 1 : params.missionType === 'lab' ? 2 : params.missionType === 'project' ? 3 : 4,
      title: `Misión ${params.missionType}`,
      sessionNumbers: params.coveredSessions,
      sessionTopic: 'Variables y Razones de Cambio',
      focus: 'Modelación',
      missionType: params.missionType,
      targetPages: Math.round(params.idealWords / 450),
      targetWords: params.idealWords,
    };

    return {
      blockIndex: 0,
      blockName: 'Bloque 1: Fenómenos y Modelos',
      planning: {
        id: 'plan-1',
        teacherId: 'teacher-1',
        uacName: 'Pensamiento Matemático I',
        semester: 1,
        component: 'fundamental',
      } as any,
      sessions: params.coveredSessions.map((s) => ({
        sessionNum: s,
        title: `Sesión ${s}`,
        phase: 'Desarrollo',
        activity: 'Actividad',
      } as any)),
      missions: [mission],
      targetWords: {
        min: params.minWords,
        ideal: params.idealWords,
        max: params.maxWords,
      },
      uacName: 'Pensamiento Matemático I',
      subsystem: 'bge',
      paecContext: 'Sostenibilidad hídrica en la comunidad',
      studentProfile: 'Estudiantes de primer semestre',
    };
  };

  it('foundation-writer escala el prompt según sesiones (3 sesiones: ~2550 palabras de planes y resto narrativo)', async () => {
    // 3 sesiones de 3h: ideal 3,563 palabras
    const input3h = makeWriterInput({
      missionType: 'foundation',
      coveredSessions: [1, 2, 3],
      minWords: 3375,
      idealWords: 3563,
      maxWords: 3750,
    });

    await generateFoundationMission(input3h);

    const prompt = capturedPrompts[0];
    expect(prompt).toBeDefined();

    // No debe contener los números hardcodeados viejos (2,000 a 3,000 palabras en coreExplanation)
    expect(prompt).not.toContain('2,000 a 3,000 palabras');
    expect(prompt).not.toContain('1,500 a 2,000 palabras');

    // Debe contener el cálculo dinámico proporcional
    expect(prompt).toContain('sessionPlans (3 sesiones)');
    expect(prompt).toContain('total planes: ~2550 palabras');
    expect(prompt).toContain('Presupuesto total para esta misión: mínimo 3375 palabras (ideal ~3563 palabras)');
    expect(prompt).toContain('Sesiones cubiertas: Sesiones 1, 2, 3 (3 sesiones)');
  });

  it('lab-writer escala el prompt según sesiones (6 sesiones: ~5100 palabras de planes y resto práctico)', async () => {
    // 6 sesiones de lab: ideal 7,125 palabras
    const input6h = makeWriterInput({
      missionType: 'lab',
      coveredSessions: [4, 5, 6, 7, 8, 9],
      minWords: 6750,
      idealWords: 7125,
      maxWords: 7500,
    });

    await generateLabMission(input6h);

    const prompt = capturedPrompts[0];
    expect(prompt).toBeDefined();

    // No debe contener los rangos fijos viejos
    expect(prompt).not.toContain('1,500 a 2,500 palabras (desarrolla cada paso');

    // Debe contener cálculo dinámico para 6 sesiones
    expect(prompt).toContain('sessionPlans (6 sesiones)');
    expect(prompt).toContain('total planes: ~5100 palabras');
    expect(prompt).toContain('Presupuesto total para esta misión: mínimo 6750 palabras (ideal ~7125 palabras)');
  });

  it('project-writer escala el prompt según sesiones sin exigir un mínimo hardcodeado de 2,000 palabras', async () => {
    const inputProject = makeWriterInput({
      missionType: 'project',
      coveredSessions: [10, 11, 12, 13, 14, 15],
      minWords: 6750,
      idealWords: 7125,
      maxWords: 7500,
    });

    await generateProjectMission(inputProject);

    const prompt = capturedPrompts[0];
    expect(prompt).toBeDefined();

    // No debe contener el requisito rígido antiguo
    expect(prompt).not.toContain('IMPORTANTE: Esta sección debe tener MÍNIMO 2,000 palabras sumando fases');

    // Debe reflejar las 6 sesiones asignadas
    expect(prompt).toContain('sessionPlans (6 sesiones)');
    expect(prompt).toContain('total planes: ~5100 palabras');
    expect(prompt).toContain('Presupuesto total para esta misión: mínimo 6750 palabras (ideal ~7125 palabras)');
  });

  it('evaluation-writer escala el prompt según sesiones sin rangos fijos de 800-1200 palabras', async () => {
    const inputEval = makeWriterInput({
      missionType: 'evaluation',
      coveredSessions: [16, 17, 18],
      minWords: 3375,
      idealWords: 3563,
      maxWords: 3750,
    });

    await generateEvaluationSection(inputEval);

    const prompt = capturedPrompts[0];
    expect(prompt).toBeDefined();

    // No debe contener los rangos fijos antiguos
    expect(prompt).not.toContain('rubric: 800 a 1,200 palabras');
    expect(prompt).not.toContain('criticalThinkingQuiz: 800 a 1,200 palabras');

    // Debe reflejar las 3 sesiones asignadas
    expect(prompt).toContain('sessionPlans (3 sesiones)');
    expect(prompt).toContain('total planes: ~2550 palabras');
    expect(prompt).toContain('Presupuesto total para esta misión: mínimo 3375 palabras (ideal ~3563 palabras)');
  });
});
