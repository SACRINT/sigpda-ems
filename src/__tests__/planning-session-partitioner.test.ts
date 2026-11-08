import { describe, it, expect } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { getSessionsForActivity } from '@/lib/planning-session-partitioner';
import { buildPlanningActivityHeading } from '@/lib/planning-activity-labels';
import { generatePlanningPDF, generateSecuenciaPDF } from '@/lib/planning-pdf-renderer';
import { generateDocx, generateSecuenciaDocx } from '@/lib/docx-generator';
import type { KeyActivityPlan, Planning, SecuenciaBloque, SecuenciaSesion } from '@/types/planning';

function makeBlockSequence(blockIndex: number, count: number, prefix: string): SecuenciaBloque {
  const sessions: SecuenciaSesion[] = Array.from({ length: count }, (_, i) => ({
    sessionNum: i + 1,
    totalSessions: count,
    phase: i < 3 ? 'Apertura' : i >= count - 3 ? 'Cierre' : 'Desarrollo',
    title: `Sesión ${i + 1} (${prefix} - S${i + 1})`,
    teachingActivity: `Mediación docente ${prefix} sesión ${i + 1}`,
    learningActivity: `Práctica estudiantil ${prefix} sesión ${i + 1}`,
    evidence: `Evidencia ${prefix} S${i + 1}`,
    evaluation: 'Lista de cotejo',
  }));
  return {
    blockIndex,
    blockName: `Bloque ${blockIndex + 1}`,
    hours: count,
    sessions,
  };
}

describe('Partición Universal de Sesiones por Actividad/Propósito/Progresión (Opción B)', () => {
  it('Caso 3 actividades (54h = 18 + 18 + 18): asigna 18 sesiones exactas a cada actividad', () => {
    const activities: KeyActivityPlan[] = [
      { name: 'Actividad Clave 1', hours: 18, methodology: 'ABP', apertura: { activities: '', processes: '', materials: '' }, ejecucion: { activities: '', processes: '', materials: '' }, conclusion: { activities: '', processes: '', materials: '' } },
      { name: 'Actividad Clave 2', hours: 18, methodology: 'ABP', apertura: { activities: '', processes: '', materials: '' }, ejecucion: { activities: '', processes: '', materials: '' }, conclusion: { activities: '', processes: '', materials: '' } },
      { name: 'Actividad Clave 3', hours: 18, methodology: 'ABP', apertura: { activities: '', processes: '', materials: '' }, ejecucion: { activities: '', processes: '', materials: '' }, conclusion: { activities: '', processes: '', materials: '' } },
    ];
    const sequenceData: Record<number, SecuenciaBloque> = {
      0: makeBlockSequence(0, 18, 'B1'),
      1: makeBlockSequence(1, 18, 'B2'),
      2: makeBlockSequence(2, 18, 'B3'),
    };

    const p0 = getSessionsForActivity(0, activities, sequenceData);
    const p1 = getSessionsForActivity(1, activities, sequenceData);
    const p2 = getSessionsForActivity(2, activities, sequenceData);

    expect(p0.sessions).toHaveLength(18);
    expect(p1.sessions).toHaveLength(18);
    expect(p2.sessions).toHaveLength(18);
    expect(p0.sessions[0].title).toContain('B1 - S1');
    expect(p1.sessions[0].title).toContain('B2 - S1');
    expect(p2.sessions[0].title).toContain('B3 - S1');
  });

  it('Caso Pensamiento Matemático III (6 propósitos de 12h = 72h, 24 sesiones por bloque): reparte 12 sesiones a cada propósito sin duplicar ni omitir', () => {
    const activities: KeyActivityPlan[] = [
      { name: 'Ecuaciones lineales de primer grado y su aplicación contextual', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A1', processes: 'P1', materials: 'M1' }, ejecucion: { activities: 'D1', processes: 'P1', materials: 'M1' }, conclusion: { activities: 'C1', processes: 'P1', materials: 'M1' } },
      { name: 'Ecuaciones lineales con dos incógnitas en situaciones de interés', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A2', processes: 'P2', materials: 'M2' }, ejecucion: { activities: 'D2', processes: 'P2', materials: 'M2' }, conclusion: { activities: 'C2', processes: 'P2', materials: 'M2' } },
      { name: 'Sistemas de ecuaciones lineales por métodos analíticos y gráfico', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A3', processes: 'P3', materials: 'M3' }, ejecucion: { activities: 'D3', processes: 'P3', materials: 'M3' }, conclusion: { activities: 'C3', processes: 'P3', materials: 'M3' } },
      { name: 'Ecuaciones cuadráticas y modelación de fenómenos reales', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A4', processes: 'P4', materials: 'M4' }, ejecucion: { activities: 'D4', processes: 'P4', materials: 'M4' }, conclusion: { activities: 'C4', processes: 'P4', materials: 'M4' } },
      { name: 'Tipos de ecuaciones en finanzas personales, demografía y proyectos', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A5', processes: 'P5', materials: 'M5' }, ejecucion: { activities: 'D5', processes: 'P5', materials: 'M5' }, conclusion: { activities: 'C5', processes: 'P5', materials: 'M5' } },
      { name: 'Geometría euclidiana y teorema del triángulo de Napoleón', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A6', processes: 'P6', materials: 'M6' }, ejecucion: { activities: 'D6', processes: 'P6', materials: 'M6' }, conclusion: { activities: 'C6', processes: 'P6', materials: 'M6' } },
    ];

    const sequenceData: Record<number, SecuenciaBloque> = {
      0: makeBlockSequence(0, 24, 'Corte1'),
      1: makeBlockSequence(1, 24, 'Corte2'),
      2: makeBlockSequence(2, 24, 'Corte3'),
    };

    const results = activities.map((_, idx) => getSessionsForActivity(idx, activities, sequenceData));

    // Cada una de las 6 actividades recibe exactamente 12 sesiones
    results.forEach((res) => {
      expect(res.sessions).toHaveLength(12);
      expect(res.totalBlockSessions).toBe(24);
    });

    // Bloque 1: Act 0 recibe S1..S12 de Corte1; Act 1 recibe S13..S24 de Corte1
    expect(results[0].blockIndex).toBe(0);
    expect(results[0].sessions[0].sessionNum).toBe(1);
    expect(results[0].sessions[11].sessionNum).toBe(12);
    expect(results[0].sessions[0].title).toContain('Corte1');

    expect(results[1].blockIndex).toBe(0);
    expect(results[1].sessions[0].sessionNum).toBe(13);
    expect(results[1].sessions[11].sessionNum).toBe(24);
    expect(results[1].sessions[0].title).toContain('Corte1');

    // Bloque 2: Act 2 recibe S1..S12 de Corte2; Act 3 recibe S13..S24 de Corte2
    expect(results[2].blockIndex).toBe(1);
    expect(results[2].sessions[0].sessionNum).toBe(1);
    expect(results[2].sessions[11].sessionNum).toBe(12);
    expect(results[2].sessions[0].title).toContain('Corte2');

    expect(results[3].blockIndex).toBe(1);
    expect(results[3].sessions[0].sessionNum).toBe(13);
    expect(results[3].sessions[11].sessionNum).toBe(24);
    expect(results[3].sessions[0].title).toContain('Corte2');

    // Bloque 3: Act 4 recibe S1..S12 de Corte3; Act 5 recibe S13..S24 de Corte3
    expect(results[4].blockIndex).toBe(2);
    expect(results[4].sessions[0].sessionNum).toBe(1);
    expect(results[4].sessions[11].sessionNum).toBe(12);
    expect(results[4].sessions[0].title).toContain('Corte3');

    expect(results[5].blockIndex).toBe(2);
    expect(results[5].sessions[0].sessionNum).toBe(13);
    expect(results[5].sessions[11].sessionNum).toBe(24);
    expect(results[5].sessions[0].title).toContain('Corte3');

    // Suma total = 72 sesiones exactas
    const totalRendered = results.reduce((sum, r) => sum + r.sessions.length, 0);
    expect(totalRendered).toBe(72);
  });

  it('Invariante Universal para N = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20 actividades y cargas de 36h, 54h, 72h y 90h', () => {
    const totalHoursOptions = [36, 54, 72, 90];
    const activityCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20];

    for (const totalHours of totalHoursOptions) {
      const hoursPerBlock = totalHours / 3;
      const sequenceData: Record<number, SecuenciaBloque> = {
        0: makeBlockSequence(0, hoursPerBlock, 'B1'),
        1: makeBlockSequence(1, hoursPerBlock, 'B2'),
        2: makeBlockSequence(2, hoursPerBlock, 'B3'),
      };

      for (const n of activityCounts) {
        const defaultHours = Math.max(1, Math.round(totalHours / n));
        const activities: KeyActivityPlan[] = Array.from({ length: n }, (_, idx) => ({
          name: `Propósito / Progresión ${idx + 1}`,
          hours: defaultHours,
          methodology: 'ABP',
          apertura: { activities: 'A', processes: 'P', materials: 'M' },
          ejecucion: { activities: 'D', processes: 'P', materials: 'M' },
          conclusion: { activities: 'C', processes: 'P', materials: 'M' },
        }));

        const slices = activities.map((_, idx) => getSessionsForActivity(idx, activities, sequenceData));

        // 1. La suma de todas las sesiones repartidas es EXACTAMENTE igual a las horas totales del semestre
        const sumSessions = slices.reduce((acc, s) => acc + s.sessions.length, 0);
        expect(sumSessions).toBe(totalHours);

        // 2. Ninguna actividad se queda con 0 sesiones
        slices.forEach((s) => {
          expect(s.sessions.length).toBeGreaterThan(0);
        });

        // 3. Para N >= 3, cada bloque (0, 1, 2) suma exactamente hoursPerBlock sesiones
        if (n >= 3) {
          for (const bIdx of [0, 1, 2]) {
            const blockSum = slices
              .filter((s) => s.blockIndex === bIdx)
              .reduce((acc, s) => acc + s.sessions.length, 0);
            expect(blockSum).toBe(hoursPerBlock);
          }
        }

        // 4. Consistencia 1:1 con los encabezados de buildPlanningActivityHeading (Bloque 1..3)
        activities.forEach((act, idx) => {
          const heading = buildPlanningActivityHeading(act, idx, activities);
          expect(heading).toContain(`Bloque ${slices[idx].blockIndex + 1} / Actividad ${slices[idx].activityNumberInBlock}`);
        });
      }
    }
  });

  it('Integración E2E en PDF y DOCX para Pensamiento Matemático III (6 propósitos, 72h): renderiza las 6 actividades con 12 sesiones c/u sin repetir bloques', async () => {
    const activities: KeyActivityPlan[] = [
      { name: 'Ecuaciones lineales de primer grado y su aplicación contextual', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A1', processes: 'P1', materials: 'M1' }, ejecucion: { activities: 'D1', processes: 'P1', materials: 'M1' }, conclusion: { activities: 'C1', processes: 'P1', materials: 'M1' } },
      { name: 'Ecuaciones lineales con dos incógnitas en situaciones de interés', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A2', processes: 'P2', materials: 'M2' }, ejecucion: { activities: 'D2', processes: 'P2', materials: 'M2' }, conclusion: { activities: 'C2', processes: 'P2', materials: 'M2' } },
      { name: 'Sistemas de ecuaciones lineales por métodos analíticos y gráfico', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A3', processes: 'P3', materials: 'M3' }, ejecucion: { activities: 'D3', processes: 'P3', materials: 'M3' }, conclusion: { activities: 'C3', processes: 'P3', materials: 'M3' } },
      { name: 'Ecuaciones cuadráticas y modelación de fenómenos reales', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A4', processes: 'P4', materials: 'M4' }, ejecucion: { activities: 'D4', processes: 'P4', materials: 'M4' }, conclusion: { activities: 'C4', processes: 'P4', materials: 'M4' } },
      { name: 'Tipos de ecuaciones en finanzas personales, demografía y proyectos', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A5', processes: 'P5', materials: 'M5' }, ejecucion: { activities: 'D5', processes: 'P5', materials: 'M5' }, conclusion: { activities: 'C5', processes: 'P5', materials: 'M5' } },
      { name: 'Geometría euclidiana y teorema del triángulo de Napoleón', hours: 12, methodology: 'Aprendizaje Basado en Problemas (ABProblemas)', apertura: { activities: 'A6', processes: 'P6', materials: 'M6' }, ejecucion: { activities: 'D6', processes: 'P6', materials: 'M6' }, conclusion: { activities: 'C6', processes: 'P6', materials: 'M6' } },
    ];

    const sequenceJson: Record<number, SecuenciaBloque> = {
      0: makeBlockSequence(0, 24, 'Bloque1_Algebra'),
      1: makeBlockSequence(1, 24, 'Bloque2_Sistemas'),
      2: makeBlockSequence(2, 24, 'Bloque3_Napoleon'),
    };

    const mockPlanning = {
      id: 'dfd5e2d6-6a84-4a3d-a4a9-8e128e523fa4',
      uacName: 'Pensamiento Matemático III. Pensamientos algebraico e introducción a geometría plana',
      semester: 3,
      component: 'fundamental',
      contentJson: {
        sectionI: {
          uacName: 'Pensamiento Matemático III. Pensamientos algebraico e introducción a geometría plana',
          semester: 3,
          totalHours: 72,
          weeklyHours: 4,
          component: 'Currículum Fundamental',
          teacherName: 'Docente Prueba',
          schoolName: 'Bachillerato Héroes de la Patria',
          cct: '21EBH0200X',
        },
        sectionII: {
          purpose: 'Aplique el lenguaje algebraico y geométrico.',
          learningOutcomes: activities.map((a) => a.name),
          paecConnection: 'Vinculación comunitaria PAEC',
          activities: activities.map((a, idx) => ({
            name: a.name,
            corte: idx < 2 ? 'Corte 1' : idx < 4 ? 'Corte 2' : 'Corte 3',
            hours: a.hours,
          })),
        },
        sectionIII: {
          fundamentalCurriculum: [{ area: 'Lengua y Comunicación', description: 'Argumentación' }],
          expandedCurriculum: [],
        },
        sectionIV: {
          note: 'Secuencia con ABProblemas',
          activities,
        },
        sectionV: {
          evaluations: [
            { moment: 'Corte 1', type: 'Formativa', agent: 'Heteroevaluación', evidence: 'Problemario', instrument: 'Rúbrica', percentage: 35 },
            { moment: 'Corte 2', type: 'Formativa', agent: 'Coevaluación', evidence: 'Reporte', instrument: 'Lista de cotejo', percentage: 35 },
            { moment: 'Corte 3', type: 'Sumativa', agent: 'Heteroevaluación', evidence: 'Proyecto', instrument: 'Rúbrica', percentage: 30 },
          ],
        },
        sectionVI: {
          materials: ['Calculadora', 'Juego geométrico'],
          digitalResources: ['GeoGebra'],
          studentMaterials: ['Cuaderno', 'Juego geométrico'],
          teacherMaterials: ['Guía didáctica'],
          digital: ['GeoGebra'],
          spaces: ['Aula'],
          references: ['SEP MCCEMS 2025'],
        },
      },
      sequenceJson,
    } as unknown as Planning;

    const docPlan = await generatePlanningPDF(mockPlanning, { gobierno: '', sep: '', supervision: '' });
    const parserPlan = new PDFParse({ data: new Uint8Array(docPlan.output('arraybuffer')) });
    try {
      const { text } = await parserPlan.getText();
      // Debe mostrar los 6 encabezados con 12 sesiones c/u y también las sesiones del Bloque 3
      expect(text).toContain('Bloque 1 / Actividad 1: Ecuaciones lineales de primer grado');
      expect(text).toContain('Bloque 1 / Actividad 2: Ecuaciones lineales con dos incógnitas');
      expect(text).toContain('Bloque 2 / Actividad 1: Sistemas de ecuaciones lineales');
      expect(text).toContain('Bloque 2 / Actividad 2: Ecuaciones cuadráticas');
      expect(text).toContain('Bloque 3 / Actividad 1: Tipos de ecuaciones en finanzas personales');
      expect(text).toContain('Bloque 3 / Actividad 2: Geometría euclidiana y teorema del triángulo de Napoleón');
      expect(text).toContain('Sesiones de 50 minutos — 12 sesiones totales');
      expect(text).not.toContain('Sesiones de 50 minutos — 24 sesiones totales');
      expect(text).toContain('Bloque3_Napoleon - S1');
      expect(text).toContain('Bloque3_Napoleon - S24');
    } finally {
      await parserPlan.destroy();
    }

    const docSec = await generateSecuenciaPDF(mockPlanning, { gobierno: '', sep: '', supervision: '' });
    const parserSec = new PDFParse({ data: new Uint8Array(docSec.output('arraybuffer')) });
    try {
      const { text } = await parserSec.getText();
      expect(text).toContain('Sesiones Programadas (12 sesiones de 50 minutos)');
      expect(text).toContain('Bloque3_Napoleon - S12');
      expect(text).toContain('Bloque3_Napoleon - S24');
    } finally {
      await parserSec.destroy();
    }

    // Verificar generación DOCX sin errores
    const docxPlanBuf = await generateDocx(mockPlanning.contentJson!, sequenceJson);
    expect(docxPlanBuf.byteLength).toBeGreaterThan(5000);

    const docxSecBuf = await generateSecuenciaDocx(mockPlanning.contentJson!, sequenceJson);
    expect(docxSecBuf.byteLength).toBeGreaterThan(5000);
  });
});
