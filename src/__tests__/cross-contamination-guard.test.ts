/**
 * cross-contamination-guard.test.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Pruebas unitarias para el Guardián Anti-Contaminación Cruzada (P3.1.2):
 * - Aislamiento estricto de Pensamiento Matemático vs otras disciplinas
 * - Detección exhaustiva de patrones foráneos en todos los campos de SessionPlan
 * - Detección de contradicción semántica entre Título de Sesión y Cuerpo
 * - Cero falsos positivos con vocabulario técnico interdisciplinar válido
 * - Planes de contingencia contextuales fail-closed y marcados como isFallback: true
 */

import { describe, it, expect } from 'vitest';
import {
  isMathUAC,
  validateSessionPlanContamination,
  validateSessionTitleCoherence,
  validateBlockCrossContamination,
} from '@/lib/guide-engine/cross-contamination-guard';
import {
  buildContextualFallbackPlan,
  completeSessionPlans,
  detectFallbackWords,
} from '@/lib/guide-engine/writers/writer-contract';
import type { SessionPlan, MissionSection } from '@/types/work-textbook';

function createMockPlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    sessionNumber: 1,
    objetivo: 'Objetivo técnico estándar de la disciplina.',
    motivacion: 'Motivación contextual para el estudiantado.',
    saberesPrevios: 'Saberes previos requeridos para la sesión.',
    contenido: 'Contenido técnico procedimental y conceptual desarrollado.',
    ejemploResuelto: 'Ejemplo guiado paso a paso.',
    practica: [],
    aplicacion: 'Aplicación en el contexto escolar o comunitario.',
    autoevaluacion: [],
    recursos: [],
    productoIntegrador: 'Evidencia técnica de aprendizaje.',
    isFallback: false,
    ...overrides,
  };
}

describe('Cross-Contamination Guard (P3.1.2)', () => {
  describe('1. Clasificación de UACs (isMathUAC)', () => {
    it('identifica correctamente UACs matemáticas', () => {
      expect(isMathUAC('Pensamiento Matemático I')).toBe(true);
      expect(isMathUAC('Pensamiento Matemático III')).toBe(true);
      expect(isMathUAC('Álgebra Lineal Aplicada')).toBe(true);
      expect(isMathUAC('Geometría y Trigonometría')).toBe(true);
      expect(isMathUAC('Cálculo Diferencial e Integral')).toBe(true);
      expect(isMathUAC('Probabilidad y Estadística I')).toBe(true);
      expect(isMathUAC('Taller de Pensamiento Variacional')).toBe(true);
    });

    it('identifica correctamente UACs no matemáticas (construcción, humanidades, ciencias, etc.)', () => {
      expect(isMathUAC('Coloca elementos constructivos básicos de una vivienda')).toBe(false);
      expect(isMathUAC('Instalaciones Hidráulicas y Sanitarias Residenciales')).toBe(false);
      expect(isMathUAC('Conservación de la Energía y sus Interacciones')).toBe(false);
      expect(isMathUAC('La Materia y sus Interacciones')).toBe(false);
      expect(isMathUAC('Lengua y Comunicación I')).toBe(false);
      expect(isMathUAC('Humanidades II')).toBe(false);
      expect(isMathUAC('Ciencias Sociales III')).toBe(false);
    });
  });

  describe('2. Detección de Contaminación Cruzada en SessionPlan', () => {
    const nonMathUAC = 'Coloca elementos constructivos básicos de una vivienda';

    it('detecta patrones matemáticos prohibidos en objetivo y contenido', () => {
      const contaminatedPlan: SessionPlan = createMockPlan({
        sessionNumber: 10,
        objetivo: 'Al término de la sesión 10, serás capaz de modelar e interpretar los fenómenos de variación y cambio cuantitativo.',
        motivacion: 'En una comunidad de Puebla analizamos cómo cambia una magnitud respecto al tiempo.',
        saberesPrevios: '¿Qué diferencia una razón de cambio constante de una variable?',
        contenido: 'En esta sesión 10, profundizaremos en el análisis sistemático de la variación y delta y entre delta x.',
        ejemploResuelto: 'Planteamiento: cálculo de tasa de variación media con cociente incremental.',
        practica: [
          {
            enunciado: 'Un comité escolar registra el ahorro acumulado para la compra de filtros de agua.',
            pista: 'Usa la forma punto-pendiente.',
            solucion: ['m = (4250 - 1850) / 4 = 600'],
          },
        ],
        aplicacion: 'Calcula la variación en una magnitud variable.',
        autoevaluacion: ['¿Puedo explicar el significado de una tasa de variación?'],
        recursos: [
          {
            titulo: 'Simulación PhET',
            url: 'https://phet.colorado.edu/es/simulations/graphing-lines',
            tipo: 'web',
          },
        ],
        productoIntegrador: 'Integra el modelo algebraico validado y la gráfica de variación.',
        isFallback: false,
      });

      const issues = validateSessionPlanContamination(contaminatedPlan, nonMathUAC);
      expect(issues.length).toBeGreaterThanOrEqual(5);

      const fieldsWithIssues = issues.map((i) => i.field);
      expect(fieldsWithIssues).toContain('objetivo');
      expect(fieldsWithIssues).toContain('contenido');
      expect(fieldsWithIssues).toContain('ejemploResuelto');
      expect(fieldsWithIssues).toContain('practica[0]');
      expect(fieldsWithIssues).toContain('recursos[0]');
      expect(fieldsWithIssues).toContain('productoIntegrador');
    });

    it('permite vocabulario técnico interdisciplinar legítimo sin falsos positivos', () => {
      const cleanEngineeringPlan: SessionPlan = createMockPlan({
        sessionNumber: 12,
        objetivo: 'Aprenderás a calcular el caudal hidráulico y seleccionar tuberías de CPVC con pendiente mínima de 2%.',
        motivacion: 'La problemática derivada de la escasez de agua exige redes eficientes y bien dimensionadas.',
        saberesPrevios: 'Recuerda los principios de estanqueidad y diferencia de presiones manométricas.',
        contenido: 'El caudal volumétrico depende del diámetro nominal de la tubería y de la rugosidad absoluta del material. Al conectar tramos de cobre con acero galvanizado, es imperativo interponer un dieléctrico para prevenir la corrosión galvánica.',
        ejemploResuelto: 'Cálculo de pérdidas por fricción en un circuito cerrado con velocidad de flujo de 1.2 m/s.',
        practica: [
          {
            enunciado: 'Calcula el tiempo de llenado de un tinaco de 1,100 litros con un caudal constante de 25 L/min.',
            pista: 'Divide el volumen total entre el flujo unitario.',
            solucion: ['t = 1100 / 25 = 44 minutos.'],
          },
        ],
        aplicacion: 'Inspecciona las redes de desagüe del taller escolar.',
        autoevaluacion: ['¿Puedo identificar el diámetro adecuado para evitar caídas de presión excesivas?'],
        recursos: [
          {
            titulo: 'Norma Oficial Mexicana NOM-002-SECRE para instalaciones de aprovechamiento',
            url: 'https://www.gob.mx/normatividad-gas',
            tipo: 'web',
          },
        ],
        productoIntegrador: 'Ficha técnica del isométrico hidráulico con balance de gastos.',
        isFallback: false,
      });

      const issues = validateSessionPlanContamination(cleanEngineeringPlan, nonMathUAC);
      expect(issues).toEqual([]);
    });

    it('permite términos matemáticos cuando la UAC es explícitamente matemática', () => {
      const mathPlan: SessionPlan = createMockPlan({
        sessionNumber: 4,
        objetivo: 'Al término de la sesión 4, serás capaz de modelar e interpretar los fenómenos de variación y cambio cuantitativo.',
        motivacion: 'Analizamos cómo cambia una variable en función de otra.',
        saberesPrevios: 'Repasa el concepto de razón de cambio.',
        contenido: 'Estudiaremos el análisis sistemático de la variación lineal y cuadrática.',
        ejemploResuelto: 'Desarrollo de la forma punto-pendiente.',
        practica: [],
        aplicacion: 'Aplica el modelo algebraico en una situación comunitaria.',
        autoevaluacion: [],
        recursos: [],
        productoIntegrador: 'Modelo algebraico graficado.',
        isFallback: false,
      });

      const issues = validateSessionPlanContamination(mathPlan, 'Pensamiento Matemático III');
      expect(issues).toEqual([]);
    });
  });

  describe('3. Coherencia Título vs Cuerpo (validateSessionTitleCoherence)', () => {
    it('detecta contradicción flagrante cuando un título de construcción tiene cuerpo de variación matemática', () => {
      const discordantPlan: SessionPlan = createMockPlan({
        sessionNumber: 11,
        objetivo: 'Al término de la sesión 11, serás capaz de modelar e interpretar los fenómenos de variación.',
        contenido: 'En esta sesión profundizaremos en el análisis sistemático de la variación.',
        isFallback: false,
      });

      const issues = validateSessionTitleCoherence(
        discordantPlan,
        'Clasificación técnica y dimensionamiento de tuberías de plomería y gas',
        'Coloca elementos constructivos básicos de una vivienda'
      );

      expect(issues.length).toBe(1);
      expect(issues[0].forbiddenTerm).toContain('Contradicción Título Construcción vs Cuerpo Matemático');
    });

    it('aprueba cuando título y cuerpo son coherentes en construcción', () => {
      const coherentPlan: SessionPlan = createMockPlan({
        sessionNumber: 11,
        objetivo: 'Clasificarás las tuberías de cobre, CPVC y PPR según su diámetro y presión de trabajo.',
        contenido: 'En esta sesión analizamos los catálogos técnicos de tuberías y conexiones hidráulicas.',
        isFallback: false,
      });

      const issues = validateSessionTitleCoherence(
        coherentPlan,
        'Clasificación técnica de tuberías para instalaciones residenciales',
        'Coloca elementos constructivos básicos de una vivienda'
      );

      expect(issues).toEqual([]);
    });
  });

  describe('4. Fallback Contextual Fail-Closed (buildContextualFallbackPlan)', () => {
    it('genera un plan de contingencia neutral, contextual y con isFallback: true', () => {
      const plan = buildContextualFallbackPlan(10, {
        uacName: 'Coloca elementos constructivos básicos de una vivienda',
        blockName: 'Bloque 2: Instalaciones Hidrosanitarias y de Gas',
        sessionTopic: 'Redes de distribución y conexiones seguras',
        paecContext: 'Agua limpia y saneamiento digno',
        subsystem: 'bt',
      });

      expect(plan.sessionNumber).toBe(10);
      expect(plan.isFallback).toBe(true);
      expect(plan.objetivo).toContain('Coloca elementos constructivos básicos de una vivienda');
      expect(plan.contenido).toContain('Redes de distribución y conexiones seguras');

      // Cero términos de variación matemática
      const issues = validateSessionPlanContamination(
        plan,
        'Coloca elementos constructivos básicos de una vivienda'
      );
      expect(issues).toEqual([]);
    });

    it('completeSessionPlans rechaza sesiones faltantes sin relleno sintético', () => {
      const covered = [10, 11, 12];
      expect(() =>
        completeSessionPlans([], covered, {
          uacName: 'Coloca elementos constructivos básicos de una vivienda',
          blockName: 'Bloque 2: Instalaciones de Plomería',
          sessionTopic: 'Técnicas de unión y corte de tuberías',
        })
      ).toThrow(/sessionPlans incompletos/);

      expect(detectFallbackWords([], 'Coloca elementos constructivos básicos de una vivienda')).toBe(0);
    });
  });

  describe('5. Validación Completa de Bloque (validateBlockCrossContamination)', () => {
    it('aprueba un bloque completamente limpio de construcción', () => {
      const mockMission: MissionSection = {
        missionIndex: 1,
        title: 'Misión 1: Fundamentación Técnica de Instalaciones',
        coveredSessions: [1, 2],
        sessionTopic: 'Instalaciones Hidráulicas',
        sessionFocus: 'Fundamentos de tuberías y conexiones',
        phenomenonHook: { story: 'En la obra comunitaria...', detonatingQuestion: '¿Cómo garantizar el suministro?' },
        conceptZero: { physicalAnalogy: 'Las tuberías son las arterias de la casa.', coreExplanation: 'Principios de presión y flujo.' },
        iDoSection: { stepByStepDemo: 'Demostración de corte de tubo de cobre.' },
        weDoSection: { guidedPractice: 'Práctica de termofusión en parejas.', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto de armado de ramal individual.', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: { question: '¿Qué verificaste en la unión?', reflectionPrompts: [], criteriaChecklist: [] },
        sessionPlans: [
          createMockPlan({
            sessionNumber: 1,
            objetivo: 'Identificarás los diámetros y cédulas normativas de tuberías.',
            contenido: 'Las tuberías de cobre tipo M y L se utilizan en interiores de viviendas.',
            isFallback: false,
          }),
          createMockPlan({
            sessionNumber: 2,
            objetivo: 'Aplicarás técnicas de corte y desbarbado en CPVC.',
            contenido: 'El corte debe ser perfectamente perpendicular al eje longitudinal del tubo.',
            isFallback: false,
          }),
        ],
        wordCount: 1800,
      };

      const report = validateBlockCrossContamination(
        [mockMission],
        'Coloca elementos constructivos básicos de una vivienda'
      );

      expect(report.clean).toBe(true);
      expect(report.issues).toHaveLength(0);
    });

    it('rechaza y reporta exactamente las sesiones contaminadas con matemáticas', () => {
      const contaminatedMission: MissionSection = {
        missionIndex: 3,
        title: 'Misión 3: Redes Hidráulicas Residenciales',
        coveredSessions: [10],
        sessionTopic: 'Plomería y Redes Sanitarias',
        sessionFocus: 'Montaje de redes',
        phenomenonHook: { story: 'Comunidad', detonatingQuestion: '¿Cómo?' },
        conceptZero: { physicalAnalogy: 'Analogía', coreExplanation: 'Explicación' },
        iDoSection: { stepByStepDemo: 'Demo' },
        weDoSection: { guidedPractice: 'Práctica', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: { question: 'Pregunta', reflectionPrompts: [], criteriaChecklist: [] },
        sessionPlans: [
          createMockPlan({
            sessionNumber: 10,
            objetivo: 'Al término de la sesión 10, serás capaz de modelar e interpretar los fenómenos de variación.',
            contenido: 'En esta sesión profundizaremos en el análisis sistemático de la variación.',
            ejemploResuelto: 'Cálculo de tasa de variación media.',
            isFallback: false,
          }),
        ],
        wordCount: 1500,
      };

      const report = validateBlockCrossContamination(
        [contaminatedMission],
        'Coloca elementos constructivos básicos de una vivienda'
      );

      expect(report.clean).toBe(false);
      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.issues[0].sessionNumber).toBe(10);
      expect(report.issues[0].actualDiscipline).toBe('Pensamiento Matemático');
    });
  });

  describe('6. Contaminación inversa y cobertura por adaptador', () => {
    it('detecta construcción dentro de una UAC matemática', () => {
      const mathPlan = createMockPlan({
        sessionNumber: 5,
        objetivo: 'Fase 3: Ensamblaje físico del prototipo de riego para la comunidad.',
        contenido: 'En esta sesión se realiza la prueba de estanqueidad y la conexión de tuberías de CPVC.',
        isFallback: false,
      });

      const issues = validateSessionPlanContamination(mathPlan, 'Pensamiento Matemático I');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.actualDiscipline === 'Construccion e Instalaciones')).toBe(true);
    });

    it('detecta matemáticas dentro de una UAC de humanidades', () => {
      const humanitiesPlan = createMockPlan({
        sessionNumber: 8,
        objetivo: 'Analizar el texto argumentativo desde la ética.',
        contenido: 'Calcula la tasa de variación media y representa el modelo algebraico en el plano.',
        isFallback: false,
      });

      const issues = validateSessionPlanContamination(humanitiesPlan, 'Humanidades II');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].actualDiscipline).toBe('Pensamiento Matemático');
    });

    it('detecta simulaciones de ciencias ajenas en una UAC de construcción', () => {
      const constructionPlan = createMockPlan({
        sessionNumber: 11,
        objetivo: 'Instalar una red hidráulica residencial.',
        recursos: [
          {
            titulo: 'Simulador de presión en fluidos (PhET)',
            url: 'https://phet.colorado.edu/es/simulations/under-pressure',
            tipo: 'web',
          },
        ],
        isFallback: false,
      });

      const issues = validateSessionPlanContamination(
        constructionPlan,
        'Coloca elementos constructivos básicos de una vivienda'
      );
      expect(issues.some((i) => i.field === 'recursos[0]')).toBe(true);
      expect(issues.some((i) => i.actualDiscipline === 'Ciencias Naturales')).toBe(true);
    });

    it('revisa también el texto de la misión, no solo los planes de sesión', () => {
      const mission: MissionSection = {
        missionIndex: 1,
        title: 'Misión 1: Fundamentación',
        coveredSessions: [1],
        sessionTopic: 'Introducción',
        sessionFocus: 'Conceptos base',
        phenomenonHook: {
          story: 'Fase 3: Ensamblaje físico del prototipo de riego.',
          detonatingQuestion: '¿Cómo iniciar?',
        },
        conceptZero: { physicalAnalogy: 'Analogía', coreExplanation: 'Explicación' },
        iDoSection: { stepByStepDemo: 'Demo' },
        weDoSection: { guidedPractice: 'Práctica', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: { question: 'Pregunta', reflectionPrompts: [], criteriaChecklist: [] },
        sessionPlans: [createMockPlan({ sessionNumber: 1 })],
        wordCount: 800,
      };

      const report = validateBlockCrossContamination([mission], 'Pensamiento Matemático III');
      expect(report.clean).toBe(false);
      expect(report.issues.some((i) => i.field.includes('phenomenonHook.story'))).toBe(true);
    });

    it('el fallback matemático es neutral y no inyecta construcción', () => {
      const plan = buildContextualFallbackPlan(3, {
        uacName: 'Pensamiento Matemático I',
        blockName: 'Bloque 1: Variación y cambio',
        sessionTopic: 'Razón de cambio',
        paecContext: 'Cuidado del agua',
        subsystem: 'bge',
      });

      const issues = validateSessionPlanContamination(plan, 'Pensamiento Matemático I');
      expect(issues).toEqual([]);
      expect(plan.contenido).not.toMatch(/tuber[ií]a|estanqueidad|ensamblaje f[ií]sico/i);
    });
  });
});
