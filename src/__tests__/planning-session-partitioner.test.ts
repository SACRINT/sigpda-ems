import { describe, it, expect } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { getSessionsForActivity, computeActivityPhaseCounts } from '@/lib/planning-session-partitioner';
import { buildPlanningActivityHeading } from '@/lib/planning-activity-labels';
import { generatePlanningPDF, generateSecuenciaPDF } from '@/lib/planning-pdf-renderer';
import { generateDocx, generateSecuenciaDocx } from '@/lib/docx-generator';
import {
  CATALOGO_INSTRUMENTOS_EVALUACION,
  sugerirInstrumentoParaEvidencia,
  diversificarInstrumentosEvaluacion,
} from '@/lib/catalogo-instrumentos';
import { planeacionesOrchestrator } from '@/lib/planeaciones/orchestrator';
import { buildBlockBlueprint } from '@/lib/guide-engine/blueprint-architect-agent';
import { generateCurricularBlockSessions } from '@/lib/session-progression-engine';
import { resolveCurricularBlocks } from '@/lib/curricular-blocks';
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

  it('Ciclo Didáctico Completo (Apertura, Desarrollo y Cierre) en cada Actividad individual y Cero Contaminación Cruzada de Temas', async () => {
    const activities: KeyActivityPlan[] = [
      {
        name: 'Ecuaciones lineales de primer grado y su aplicación contextual',
        contenidoFormativo: 'Concepto de ecuación y sus partes, ecuaciones lineales de primer grado, procedimiento para encontrar el valor de una incógnita.',
        hours: 12,
        methodology: 'Aprendizaje Basado en Problemas (ABProblemas)',
        saberes: {
          saber: 'Comprende la estructura algebraica de una ecuación lineal de primer grado.',
          saberHacer: 'Despeja incógnitas y resuelve ecuaciones lineales de primer grado aplicadas a costos.',
          saberSer: 'Valora el orden y la perseverancia en la resolución de problemas.',
        },
        apertura: { activities: 'Diagnóstico de costos en la localidad.', processes: 'P1', materials: 'M1' },
        ejecucion: { activities: 'Resolución de ecuaciones de primer grado.', processes: 'P1', materials: 'M1' },
        conclusion: { activities: 'Socialización del problemario resuelto.', processes: 'P1', materials: 'M1' },
      },
      {
        name: 'Ecuaciones lineales con dos incógnitas en situaciones de interés',
        contenidoFormativo: 'Concepto de ecuación lineal con dos variables, representación tabular, pendiente y ordenada al origen.',
        hours: 12,
        methodology: 'Aprendizaje Basado en Problemas (ABProblemas)',
        saberes: {
          saber: 'Identifica la estructura de una ecuación lineal con dos incógnitas y su gráfica.',
          saberHacer: 'Construye tablas de valores y grafica pares ordenados en el plano cartesiano.',
          saberSer: 'Valora la precisión gráfica y el trabajo solidario.',
        },
        apertura: { activities: 'Dilema sobre tiempo de trabajo e ingreso.', processes: 'P2', materials: 'M2' },
        ejecucion: { activities: 'Trazado de gráficas y cálculo de pendiente.', processes: 'P2', materials: 'M2' },
        conclusion: { activities: 'Defensa de gráficas ante el grupo.', processes: 'P2', materials: 'M2' },
      },
      {
        name: 'Sistemas de ecuaciones lineales por métodos analíticos y gráfico',
        contenidoFormativo: 'Método de igualación, método de sustitución, método de reducción, método gráfico y determinantes.',
        hours: 12,
        methodology: 'Aprendizaje Basado en Problemas (ABProblemas)',
        saberes: {
          saber: 'Conoce los métodos analíticos y gráficos para sistemas 2x2.',
          saberHacer: 'Resuelve sistemas de ecuaciones aplicando igualación, sustitución y reducción.',
          saberSer: 'Muestra perseverancia ante problemas complejos.',
        },
        apertura: { activities: 'Punto de equilibrio entre dos productores.', processes: 'P3', materials: 'M3' },
        ejecucion: { activities: 'Resolución comparativa de sistemas 2x2.', processes: 'P3', materials: 'M3' },
        conclusion: { activities: 'Contraste de métodos y coevaluación.', processes: 'P3', materials: 'M3' },
      },
      {
        name: 'Ecuaciones cuadráticas y modelación de fenómenos reales',
        contenidoFormativo: 'Concepto de ecuación cuadrática, forma general, resolución por factorización, completar cuadrados y fórmula general.',
        hours: 12,
        methodology: 'Aprendizaje Basado en Problemas (ABProblemas)',
        saberes: {
          saber: 'Define la estructura de una ecuación cuadrática y el significado de sus raíces.',
          saberHacer: 'Aplica la fórmula general y factorización para optimizar áreas.',
          saberSer: 'Demuestra rigor científico para optimizar recursos.',
        },
        apertura: { activities: 'Reto de área máxima de terreno comunitario.', processes: 'P4', materials: 'M4' },
        ejecucion: { activities: 'Planteamiento del modelo cuadrático y discriminante.', processes: 'P4', materials: 'M4' },
        conclusion: { activities: 'Defensa pública del modelo de optimización.', processes: 'P4', materials: 'M4' },
      },
      {
        name: 'Tipos de ecuaciones en finanzas personales, demografía y proyectos',
        contenidoFormativo: 'Cálculo de intereses simples y compuestos, crecimiento poblacional, propagación de fenómenos y proyectos arquitectónicos.',
        hours: 12,
        methodology: 'Aprendizaje Basado en Problemas (ABProblemas)',
        saberes: {
          saber: 'Conoce los modelos matemáticos de interés financiero y crecimiento exponencial.',
          saberHacer: 'Modela situaciones de ahorro familiar y proyecciones demográficas.',
          saberSer: 'Asume una actitud crítica frente al manejo financiero personal.',
        },
        apertura: { activities: 'Análisis de datos estadísticos del crecimiento poblacional.', processes: 'P5', materials: 'M5' },
        ejecucion: { activities: 'Indagación sobre fórmulas de interés compuesto.', processes: 'P5', materials: 'M5' },
        conclusion: { activities: 'Presentación del reporte de aplicación matemática en finanzas.', processes: 'P5', materials: 'M5' },
      },
      {
        name: 'Geometría euclidiana y teorema del triángulo de Napoleón',
        contenidoFormativo: 'Introducción a la geometría plana, ángulos, tipos, componentes, teorema de Pitágoras, congruencia, semejanza y teorema de Napoleón.',
        hours: 12,
        methodology: 'Aprendizaje Basado en Problemas (ABProblemas)',
        saberes: {
          saber: 'Comprende los axiomas de la geometría euclidiana, propiedades de los triángulos y el teorema del triángulo de Napoleón.',
          saberHacer: 'Utiliza instrumentos de precisión para trazar triángulos, verificar congruencias y aplicar el teorema de Pitágoras en campo.',
          saberSer: 'Valora la precisión en el trazo y la estética geométrica.',
        },
        apertura: { activities: 'Observación de estructuras arquitectónicas locales.', processes: 'P6', materials: 'M6' },
        ejecucion: { activities: 'Demostración práctica del teorema de Pitágoras y construcción del triángulo de Napoleón.', processes: 'P6', materials: 'M6' },
        conclusion: { activities: 'Exhibición del Dossier de resolución técnica y defensa del proyecto integrador.', processes: 'P6', materials: 'M6' },
      },
    ];

    // Simulamos secuencias crudas de 24 sesiones generadas a nivel de Bloque por el Orquestador
    // (donde antes se contaminaban los temas de las 2 actividades del bloque y solo había 1 Apertura al inicio y 1 Cierre al final del bloque)
    const b0 = await planeacionesOrchestrator.buildSequence({
      blockIndex: 0,
      totalHours: 24,
      uacName: 'Pensamiento Matemático III',
      blockName: 'Bloque 1 (Corte 1): Progresiones 1 y 2',
      contenidoFormativo: `${activities[0].contenidoFormativo} · ${activities[1].contenidoFormativo}`,
      methodology: 'Aprendizaje Basado en Problemas (ABProblemas)',
    });
    const b1 = await planeacionesOrchestrator.buildSequence({
      blockIndex: 1,
      totalHours: 24,
      uacName: 'Pensamiento Matemático III',
      blockName: 'Bloque 2 (Corte 2): Progresiones 3 y 4',
      contenidoFormativo: `${activities[2].contenidoFormativo} · ${activities[3].contenidoFormativo}`,
      methodology: 'Aprendizaje Basado en Problemas (ABProblemas)',
    });
    const b2 = await planeacionesOrchestrator.buildSequence({
      blockIndex: 2,
      totalHours: 24,
      uacName: 'Pensamiento Matemático III',
      blockName: 'Bloque 3 (Corte 3): Progresiones 5 y 6',
      contenidoFormativo: `${activities[4].contenidoFormativo} · ${activities[5].contenidoFormativo}`,
      methodology: 'Aprendizaje Basado en Problemas (ABProblemas)',
    });

    const sequenceData: Record<number, SecuenciaBloque> = {
      0: { blockIndex: 0, blockName: 'Bloque 1', hours: 24, sessions: b0.sessions as SecuenciaSesion[] },
      1: { blockIndex: 1, blockName: 'Bloque 2', hours: 24, sessions: b1.sessions as SecuenciaSesion[] },
      2: { blockIndex: 2, blockName: 'Bloque 3', hours: 24, sessions: b2.sessions as SecuenciaSesion[] },
    };

    const slices = activities.map((_, idx) => getSessionsForActivity(idx, activities, sequenceData));

    // 1. CADA una de las 6 actividades tiene su propio Inicio (Apertura), Desarrollo y Cierre (2 + 8 + 2 = 12)
    slices.forEach((slice) => {
      const ap = slice.sessions.filter((s) => s.phase === 'Apertura');
      const des = slice.sessions.filter((s) => s.phase === 'Desarrollo');
      const cie = slice.sessions.filter((s) => s.phase === 'Cierre');
      expect(ap.length).toBe(2);
      expect(des.length).toBe(8);
      expect(cie.length).toBe(2);
      expect(slice.sessions[0].phase).toBe('Apertura');
      expect(slice.sessions[1].phase).toBe('Apertura');
      expect(slice.sessions[10].phase).toBe('Cierre');
      expect(slice.sessions[11].phase).toBe('Cierre');
    });

    // 2. CERO contaminación temática cruzada en el Bloque 3:
    // La Actividad 5 (Finanzas y demografía, S1..S12) NO debe mencionar Pitágoras ni Napoleón
    const act5Text = JSON.stringify(slices[4].sessions);
    expect(act5Text).toContain('intereses simples y compuestos');
    expect(act5Text).not.toContain('Pitágoras');
    expect(act5Text).not.toContain('Napoleón');

    // La Actividad 6 (Geometría y Napoleón, S13..S24) NO debe mencionar intereses simples y compuestos
    const act6Text = JSON.stringify(slices[5].sessions);
    expect(act6Text).toContain('Pitágoras');
    expect(act6Text).toContain('Napoleón');
    expect(act6Text).not.toContain('intereses simples y compuestos');

    // 3. Cero regresión en el Arquitecto de Libros de Trabajo (4 misiones con rangos de sesiones 100% contiguos)
    const blueprintB3 = buildBlockBlueprint({
      blockIndex: 2,
      blockName: 'Bloque 3',
      planning: {
        id: 'test-plan-b3',
        uacName: 'Pensamiento Matemático III',
        semester: 3,
        component: 'fundamental',
        sequenceJson: {
          2: {
            blockIndex: 2,
            blockName: 'Bloque 3',
            hours: 24,
            sessions: [...slices[4].sessions, ...slices[5].sessions],
          },
        },
      } as unknown as Planning,
      curriculum: {
        uacName: 'Pensamiento Matemático III',
        semester: 3,
        component: 'fundamental',
        subsystem: 'bge',
        paecConnection: { projectName: 'Proyecto PAEC Local', problemStatement: 'Problema local' },
      } as never,
    });
    expect(blueprintB3.missions).toHaveLength(4);
    blueprintB3.missions.forEach((mission) => {
      const cov = mission.sessionNumbers;
      expect(cov.length).toBeGreaterThan(0);
      // Verificar que sessionNumbers sea estrictamente contiguo (sin saltos tipo [1, 2, 13, 14])
      for (let k = 1; k < cov.length; k++) {
        expect(cov[k]).toBe(cov[k - 1] + 1);
      }
    });

    // 4. Cero regresión en Planes de Clase (generateCurricularBlockSessions conserva las 2 actividades calibradas)
    const blocks = resolveCurricularBlocks({
      sectionI: { totalHours: 72 },
      sectionII: { learningOutcomes: activities.map((a) => a.name) },
      sectionIV: { activities },
    } as never);
    const detailedB3 = generateCurricularBlockSessions(blocks[2], false, sequenceData[2]);
    expect(detailedB3).toHaveLength(24);
    expect(detailedB3[0].phase).toBe('Apertura');
    expect(detailedB3[11].phase).toBe('Cierre');
    expect(detailedB3[12].phase).toBe('Apertura');
    expect(detailedB3[23].phase).toBe('Cierre');
    expect(detailedB3[0].activityIndex).toBe(4);
    expect(detailedB3[12].activityIndex).toBe(5);
  });

  it('Catálogo Oficial de 14 Instrumentos de Evaluación MCCEMS: sugiere y diversifica instrumentos acorde a actividad, contenido, proyecto o artefacto', () => {
    expect(CATALOGO_INSTRUMENTOS_EVALUACION.length).toBeGreaterThanOrEqual(14);

    // 1. Problemario algebraico -> Rúbrica analítica de modelación matemática y resolución de problemas
    const instMat = sugerirInstrumentoParaEvidencia({
      evidencia: 'Problemario de ecuaciones lineales y cuadráticas con aplicación contextualizada',
      actividadNombre: 'Ecuaciones lineales de primer grado',
      uacName: 'Pensamiento Matemático III',
    });
    expect(instMat.id).toBe('rubrica_analitica_resolucion_problemas');

    // 2. Gráfica en plano cartesiano / trazado geométrico -> Lista de cotejo de verificación técnica, gráfica y procedimental
    const instGraf = sugerirInstrumentoParaEvidencia({
      evidencia: 'Trazado de gráficas en el plano cartesiano y construcción con juego geométrico',
      actividadNombre: 'Geometría plana y pendiente',
      uacName: 'Pensamiento Matemático III',
    });
    expect(instGraf.id).toBe('lista_cotejo_producto_tecnico');

    // 3. Práctica experimental de laboratorio -> Guía de observación estructurada de práctica en aula, laboratorio o taller
    const instLab = sugerirInstrumentoParaEvidencia({
      evidencia: 'Práctica experimental de laboratorio y manejo de instrumental',
      actividadNombre: 'Conservación de la energía',
      uacName: 'Ciencias Naturales, Experimentales y Tecnología I',
    });
    expect(instLab.id).toBe('guia_observacion_laboratorio_taller');

    // 4. Ensayo argumentativo -> Rúbrica analítica de ensayo crítico, disertación y producción textual
    const instEnsayo = sugerirInstrumentoParaEvidencia({
      evidencia: 'Ensayo argumentativo y reseña crítica sobre problemas filosóficos',
      actividadNombre: 'Disertación filosófica',
      uacName: 'Humanidades I',
    });
    expect(instEnsayo.id).toBe('rubrica_analitica_argumentacion_ensayo');

    // 5. Prototipo / código -> Protocolo y matriz de validación funcional de prototipo, modelo o código
    const instProto = sugerirInstrumentoParaEvidencia({
      evidencia: 'Prototipo funcional programado en Python con pruebas de ejecución',
      actividadNombre: 'Desarrollo de software',
      uacName: 'Cultura Digital II',
    });
    expect(instProto.id).toBe('matriz_validacion_prototipo_steam');

    // 6. Debate / defensa oral -> Rúbrica holística de defensa pública, debate socrático y expresión oral
    const instOral = sugerirInstrumentoParaEvidencia({
      evidencia: 'Debate socrático y defensa oral en plenaria',
      actividadNombre: 'Deliberación comunitaria',
      uacName: 'Ciencias Sociales I',
    });
    expect(instOral.id).toBe('rubrica_holistica_defensa_oral');

    // 7. Diversificación automática de una tabla de evaluación repetitiva ("Rúbrica" / "Lista de cotejo")
    const repetitiveEvals = [
      { type: 'Diagnóstica', agent: 'Autoevaluación', moment: 'Inicio', evidence: 'Cuestionario diagnóstico de saberes previos', instrument: 'Lista de cotejo', percentage: 5 },
      { type: 'Formativa', agent: 'Heteroevaluación', moment: 'Corte 1', evidence: 'Problemario de ecuaciones lineales y cuadráticas', instrument: 'Rúbrica', percentage: 20 },
      { type: 'Formativa', agent: 'Coevaluación', moment: 'Corte 2', evidence: 'Trazado de gráficas en el plano cartesiano y tabulación', instrument: 'Lista de cotejo', percentage: 20 },
      { type: 'Formativa', agent: 'Coevaluación', moment: 'Corte 2', evidence: 'Trabajo colaborativo en equipo y corresponsabilidad', instrument: 'Rúbrica', percentage: 15 },
      { type: 'Sumativa', agent: 'Heteroevaluación', moment: 'Corte 3', evidence: 'Proyecto integrador PAEC y dossier técnico final', instrument: 'Rúbrica', percentage: 40 },
    ];

    const diversified = diversificarInstrumentosEvaluacion(repetitiveEvals, {
      uacName: 'Pensamiento Matemático III',
      componente: 'fundamental',
    });

    const uniqueInstruments = new Set(diversified.map((d) => d.instrument));
    // Las 5 filas ahora tienen instrumentos específicos distintos entre sí
    expect(uniqueInstruments.size).toBe(5);
    expect(diversified[0].instrument.toLowerCase()).toContain('diagnóstica');
    expect(diversified[1].instrument.toLowerCase()).toContain('modelación matemática');
    expect(diversified[2].instrument.toLowerCase()).toContain('lista de cotejo');
    expect(diversified[4].instrument.toLowerCase()).toContain('proyecto integrador');
  });

  it('Garantiza que computeActivityPhaseCounts asigne Apertura, Desarrollo y Cierre para cualquier actividad con >= 3 sesiones', () => {
    for (let total = 3; total <= 30; total++) {
      const { aperturaCount, desarrolloCount, cierreCount } = computeActivityPhaseCounts(total);
      expect(aperturaCount).toBeGreaterThanOrEqual(1);
      expect(desarrolloCount).toBeGreaterThanOrEqual(1);
      expect(cierreCount).toBeGreaterThanOrEqual(1);
      expect(aperturaCount + desarrolloCount + cierreCount).toBe(total);
    }
  });
});
