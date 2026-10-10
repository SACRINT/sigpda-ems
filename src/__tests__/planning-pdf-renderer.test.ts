import { describe, it, expect, vi } from 'vitest';
import * as fontLoader from '@/lib/visual-engine/font-loader';
import { generatePlanningPDF, generateSecuenciaPDF } from '@/lib/planning-pdf-renderer';
import type { Planning } from '@/types/planning';

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
});
