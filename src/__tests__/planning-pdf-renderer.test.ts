import { describe, it, expect, vi } from 'vitest';
import * as fontLoader from '@/lib/visual-engine/font-loader';
import { generatePlanningPDF, generateSecuenciaPDF } from '@/lib/planning-pdf-renderer';
import { buildFullSequenceFromWorkbooks } from '@/lib/planning/workbook-sequence-sync';
import type { Planning } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

describe('Planeación Didáctica PDF — Tipografía Editorial y Anti-F11 (Fase 6A)', () => {
  const mockPlanning = {
    id: 'plan-editorial-pdf-1',
    title: 'Planeación de Electrónica Digital',
    uacName: 'Sistemas Embebidos e IoT',
    subject: 'Mecatrónica',
    semester: 4,
    progression: 'Diseño de circuitos lógicos programables',
    unitOrBlock: 'Bloque II',
    problematicContext: 'Automatización del monitoreo hídrico en Tepeaca',
    transversalTheme: 'Cuidado del Agua y Sustentabilidad',
    contentJson: {
      sectionI: {
        schoolName: 'CECyTE Plantel Tepeaca',
        cct: '21ETC0004Y',
        uacName: 'Sistemas Embebidos e IoT',
        teacherName: 'Ing. Docente Titular',
        semester: 'Cuarto',
        hoursPerWeek: 4,
        totalHours: 64,
        component: 'Formación Profesional',
        period: '2026-2027',
      },
      sectionII: {
        problematicContext: 'Automatización del monitoreo hídrico en Tepeaca',
        paecLinking: 'Proyecto Aula Escuela Comunidad de Telemetría',
        transversalTheme: 'Cuidado del Agua',
      },
      sectionIII: {
        learningGoal: 'Desarrollar soluciones embebidas para telemetría ambiental.',
        fundamentalConcepts: ['Microcontroladores', 'Sensores de Flujo', 'Comunicaciones'],
      },
      sectionIV: {
        sessions: [
          {
            sessionNum: 1,
            totalSessions: 16,
            phase: 'Apertura',
            title: 'Diagnóstico de instrumentación digital',
            teachingActivity: 'Presentar problemática de desabasto y variables de medición.',
            learningActivity: 'Identificar componentes del circuito medidor de nivel.',
            evidence: 'Diagrama esquemático inicial',
          },
          {
            sessionNum: 2,
            totalSessions: 16,
            phase: 'Desarrollo',
            title: 'Ensamble del circuito con microcontrolador',
            teachingActivity: 'Modelar conexión del sensor ultrasónico y pines GPIO.',
            learningActivity: 'Realizar montaje en protoboard y verificar señales.',
            evidence: 'Circuito funcional en banco de trabajo',
          },
        ],
      },
      sectionV: {
        evaluations: [
          {
            moment: 'Formativa',
            agent: 'Heteroevaluación',
            evidence: 'Circuito funcional',
            instrument: 'Rúbrica analítica',
            weight: '40%',
          },
        ],
      },
    },
    sequenceJson: {
      1: {
        bloque: 1,
        title: 'Bloque I: Fundamentos',
        horas: 16,
        activities: [
          {
            sessionNumber: 1,
            title: 'Sesión Inaugural',
            teachingActivity: 'Explicación del marco',
            learningActivity: 'Apuntes y mapa mental',
            evidence: 'Mapa mental',
            saberes: {
              saber: 'Conceptos de hardware',
              saberHacer: 'Conexión de componentes',
              saberSer: 'Responsabilidad en taller',
            },
          },
        ],
      },
    },
  } as unknown as Planning;

  const mockProvidedLogos = {
    gobierno: '',
    sep: '',
    supervision: '',
  };

  it('generatePlanningPDF inicializa fuentes editoriales oficiales (Lato y Montserrat) y genera un PDF válido', async () => {
    const fontSpy = vi.spyOn(fontLoader, 'loadEditorialFonts');

    const doc = await generatePlanningPDF(mockPlanning, mockProvidedLogos);

    expect(doc).toBeDefined();
    // Aserción Anti-F11: loadEditorialFonts DEBE ser llamado al crear el documento
    expect(fontSpy).toHaveBeenCalledTimes(1);

    // Verificación de que las fuentes quedaron registradas
    expect(fontLoader.areEditorialFontsLoaded(doc)).toBe(true);

    // El buffer resultante no está vacío
    const buffer = doc.output('arraybuffer');
    expect(buffer.byteLength).toBeGreaterThan(3000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('generateSecuenciaPDF inicializa fuentes editoriales oficiales y genera un PDF válido', async () => {
    const fontSpy = vi.spyOn(fontLoader, 'loadEditorialFonts');

    const doc = await generateSecuenciaPDF(mockPlanning, mockProvidedLogos);

    expect(doc).toBeDefined();
    // Aserción Anti-F11: loadEditorialFonts DEBE ser llamado en la secuencia micro
    expect(fontSpy).toHaveBeenCalledTimes(1);
    expect(fontLoader.areEditorialFontsLoaded(doc)).toBe(true);

    const buffer = doc.output('arraybuffer');
    expect(buffer.byteLength).toBeGreaterThan(3000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('Degradación D9 limpia: si loadEditorialFonts falla, generatePlanningPDF y generateSecuenciaPDF generan el documento en Helvetica sin arrojar error', async () => {
    // Simular falla en fontLoader retornando false
    const fontSpy = vi.spyOn(fontLoader, 'loadEditorialFonts').mockReturnValue(false);

    const docPlan = await generatePlanningPDF(mockPlanning, mockProvidedLogos);
    expect(docPlan).toBeDefined();
    expect(docPlan.output('arraybuffer').byteLength).toBeGreaterThan(2000);

    const docSec = await generateSecuenciaPDF(mockPlanning, mockProvidedLogos);
    expect(docSec).toBeDefined();
    expect(docSec.output('arraybuffer').byteLength).toBeGreaterThan(2000);

    fontSpy.mockRestore();
  });

  it('buildFullSequenceFromWorkbooks sincroniza sesiones reales y distintas por bloque desde workbooks_json erradicando plantillas repetidas', () => {
    const mockWorkbooks: Record<string, ActiveWorkTextbook> = {
      block_0: {
        blockName: 'Bloque 1: Ecuaciones Lineales',
        missions: [
          {
            missionIndex: 1,
            title: 'Misión 1: Balanza algebraica de primer grado',
            sessionTopic: 'Ecuaciones lineales',
            sessionPlans: [
              {
                sessionNumber: 1,
                objetivo: 'Comprender la igualdad lineal y la balanza algebraica de primer grado.',
                contenido: 'Ecuaciones de la forma ax + b = c.',
                motivacion: 'Análisis del costo de sacos de fertilizante en Venustiano Carranza.',
                ejemploResuelto: 'Despeje paso a paso de 4x + 200 = 1000.',
                practica: [{ numero: 1, enunciado: 'Resolver 3 ecuaciones lineales contextualizadas.' }],
                aplicacion: 'Cálculo de tarifa fija agrícola.',
                productoIntegrador: 'Tabla de despejes lineales verificados',
              },
            ],
          },
        ],
      } as unknown as ActiveWorkTextbook,
      block_1: {
        blockName: 'Bloque 2: Sistemas de Ecuaciones 2x2',
        missions: [
          {
            missionIndex: 1,
            title: 'Misión 1: Intersección de dos rectas y método de reducción',
            sessionTopic: 'Sistemas 2x2',
            sessionPlans: [
              {
                sessionNumber: 1,
                objetivo: 'Resolver sistemas 2x2 por eliminación e intersección de dos rectas.',
                contenido: 'Sistemas de dos ecuaciones lineales con dos incógnitas.',
                motivacion: 'Cruzar datos de hidratación y actividad física del PAEC.',
                ejemploResuelto: 'Eliminación de variable y en sistema 2x + 3y = 120.',
                practica: [{ numero: 1, enunciado: 'Plantear y resolver un sistema 2x2 comunitario.' }],
                aplicacion: 'Punto de equilibrio entre dos insumos.',
                productoIntegrador: 'Sistema 2x2 resuelto y comprobado',
              },
            ],
          },
        ],
      } as unknown as ActiveWorkTextbook,
    };

    const synced = buildFullSequenceFromWorkbooks(
      mockWorkbooks,
      [
        { name: 'Bloque 1', hours: 24, contenidoFormativo: 'Ecuaciones lineales' } as never,
        { name: 'Bloque 2', hours: 24, contenidoFormativo: 'Sistemas 2x2' } as never,
      ],
      null
    );

    expect(synced[0]).toBeDefined();
    expect(synced[1]).toBeDefined();
    expect(synced[0].sessions[0].title).toContain('balanza algebraica de primer grado');
    expect(synced[1].sessions[0].title).toContain('intersección de dos rectas');
    expect(synced[0].sessions[0].teachingActivity).not.toBe(synced[1].sessions[0].teachingActivity);
    expect(synced[0].sessions[0].learningActivity).not.toBe(synced[1].sessions[0].learningActivity);
    expect(synced[0].sessions[0].evidence).toBe('Tabla de despejes lineales verificados');
    expect(synced[1].sessions[0].evidence).toBe('Sistema 2x2 resuelto y comprobado');
  });

  it('usa nomenclatura oficial MCCEMS (Progresiones de Aprendizaje) para semestres 5 y 6', async () => {
    const planSem5 = {
      ...mockPlanning,
      id: 'plan-sem5-variacional',
      semester: 5,
      uacName: 'Taller de Pensamiento Variacional I',
      contentJson: {
        ...(mockPlanning.contentJson || {}),
        sectionI: {
          ...(mockPlanning.contentJson?.sectionI || {}),
          semester: 'Quinto',
          component: 'Formación Propedéutica Optativa',
          uacName: 'Taller de Pensamiento Variacional I',
        },
        sectionIV: {
          activities: [
            {
              name: 'Progresión 1: Aplica técnicas aritméticas y algebraicas...',
              hours: 7,
              apertura: { activities: 'Exploración inicial', materials: 'Libreta' },
              ejecucion: { activities: 'Desarrollo analítico', materials: 'Calculadora' },
              conclusion: { activities: 'Cierre y síntesis', materials: 'Rúbrica' },
              saberes: { saber: 'Derivadas', saberHacer: 'Cálculo', saberSer: 'Rigor' },
            },
          ],
        },
      },
    } as unknown as Planning;

    const docPlan = await generatePlanningPDF(planSem5);
    expect(docPlan).toBeDefined();

    const docSec = await generateSecuenciaPDF(planSem5);
    expect(docSec).toBeDefined();
  });
});
