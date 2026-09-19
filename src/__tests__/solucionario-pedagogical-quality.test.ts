// src/__tests__/solucionario-pedagogical-quality.test.ts
/**
 * Evaluación de Calidad e Impacto Pedagógico del Solucionario Docente (Fase 26)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Evalúa la calidad, profundidad técnica y ausencia de texto genérico vacío
 * en el solucionario docente generado por el motor para diferentes UACs reales:
 * 1. UACs STEM (Pensamiento Matemático, Física, Química):
 *    - Procedimientos paso a paso con variables y justificación analítica.
 *    - Pauta de resolución STEM con verificación de modelo y unidades.
 *    - Matriz de prevención de errores de cálculo y conceptos erróneos.
 * 2. UACs Humanidades y Comunicación (Lengua y Comunicación, Humanidades):
 *    - Criterios de mediación dialéctica, debate y argumentación situada.
 *    - Evaluación de postura crítica y transferencia comunitaria PAEC.
 * 3. Integración de reactivos tipo EXANI/PLANEA con justificación pedagógica oficial.
 */

import { describe, it, expect } from 'vitest';
import { extractMaterialsFromWorkbook, extractSpecificMaterial } from '@/lib/guide-engine/material-extractor';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

function makeStemWorkbook(uac: string): ActiveWorkTextbook {
  const mission = {
    missionIndex: 1,
    title: 'Optimización de mezclas en alfarería tradicional',
    coveredSessions: [1, 2, 3],
    sessionTopic: 'Sistemas de ecuaciones lineales 2x2',
    sessionFocus: 'Determinación de proporciones de arcilla y fundente',
    phenomenonHook: {
      story: 'El alfarero Don Pedro en Amozoc necesita mezclar barro negro y barro rojo para conseguir una resistencia de 150 kg/cm2.',
      detonatingQuestion: '¿Cuál es la proporción de cada mineral para alcanzar la resistencia requerida minimizando el costo?',
    },
    conceptZero: {
      physicalAnalogy: 'Una balanza de torsión donde el equilibrio se alcanza únicamente con la combinación de masas exacta.',
      coreExplanation: 'Las ecuaciones simultáneas determinan el punto de intersección en el plano afín R2.',
      narrativeExplanation: 'El balance estequiométrico garantiza que la mezcla no se fracture durante el horneado.',
      solvedExample: {
        problemStatement: 'Hallar x (arcilla roja) y y (arcilla negra) si x + y = 100 kg y 4x + 6y = 480 pesos.',
        solutionSteps: [
          'Paso 1: Despejar x = 100 - y de la primera relación de masa.',
          'Paso 2: Sustituir en la restricción presupuestal: 4(100 - y) + 6y = 480 -> 400 + 2y = 480 -> y = 40 kg.',
          'Paso 3: Calcular x = 100 - 40 = 60 kg.',
          'Paso 4: Comprobación: 4(60) + 6(40) = 240 + 240 = 480 pesos.',
        ],
        interpretation: 'La mezcla óptima requiere 60 kg de arcilla roja y 40 kg de arcilla negra.',
      },
      contrastTable: [
        {
          correctConcept: 'El sistema lineal 2x2 tiene solución única si el determinante de la matriz es no nulo.',
          commonMisconception: 'Creer que cualquier par (x, y) que sume 100 satisface el presupuesto.',
          reasoning: 'Ambas restricciones deben interceptarse algebraicamente en un punto común.',
        },
      ],
    },
    iDoSection: {
      stepByStepDemo: 'Modelado gráfico en GeoGebra demostrando el método analítico de determinantes (Regla de Cramer).',
    },
    weDoSection: {
      guidedPractice: 'En parejas, calculen la masa de fundente para un lote de 250 cazuelas vidriadas.',
    },
    youDoSection: {
      autonomousChallenge: 'Reto autónomo: Determina el punto de equilibrio para una cooperativa con costos fijos de $1,200.',
    },
    troubleshooting: [
      {
        id: 'tb-stem-1',
        symptom: 'El determinante del sistema resulta en cero.',
        rootCause: 'Las ecuaciones son dependientes o linealmente proporcionales.',
        solutionSteps: ['Verificar si una ecuación es múltiplo escalar de la otra.'],
        preventionTip: 'Revisar la independencia lineal de los datos empíricos.',
      },
    ],
  };

  const projectSection = {
    artifactName: 'Manual de Dosificación y Costos para la Cooperativa Alfarera',
    communityUtility: 'Guía técnica para estandarizar la preparación de barros y evitar pérdidas por merma.',
    phases: [
      {
        phaseNum: 1,
        title: 'Diagnóstico de pérdidas',
        allocatedHours: 6,
        deliverables: ['Registro de mermas'],
        instructions: 'Medir porcentaje de piezas rotas en la última quema.',
      },
    ],
    deliveryCriteria: ['Exactitud en el cálculo matricial', 'Impacto en el costo por pieza'],
  };

  const evaluationSection = {
    summaryMatrix: [
      {
        missionTitle: 'Misión 1: Optimización de Mezclas',
        keyCompetency: 'Modelación matemática aplicada a la producción comunitaria',
        suggestedScore: '60% Reto / 40% Portafolio',
      },
    ],
  };

  return {
    uacName: uac,
    blockName: 'Bloque I: Modelación y Optimización Lineal',
    blockNumber: 1,
    coverData: {
      schoolName: 'BACHILLERATO ESTATAL EMILIANO ZAPATA',
      subjectName: uac,
      semester: 2,
      paecProjectName: 'Cooperativa Artesanal de Amozoc',
    },
    missions: [mission],
    projectSection,
    evaluationSection,
  } as unknown as ActiveWorkTextbook;
}

function makeHumanitiesWorkbook(uac: string): ActiveWorkTextbook {
  const mission = {
    missionIndex: 1,
    title: 'Discurso argumentativo y memoria histórica comunitaria',
    coveredSessions: [1, 2, 3],
    sessionTopic: 'La estructura dialéctica de la argumentación',
    sessionFocus: 'Construcción de ensayos breves sobre la identidad y las tradiciones locales',
    phenomenonHook: {
      story: 'En la junta auxiliar de San Felipe Hueyotlipan, los jóvenes debaten sobre la preservación de los lavaderos públicos tradicionales frente a la urbanización moderna.',
      detonatingQuestion: '¿Cómo podemos formular un argumento convincente para sustentar el valor patrimonial del espacio comunitario?',
    },
    conceptZero: {
      physicalAnalogy: 'Un puente colgante donde cada tensor representa una premisa que sostiene la conclusión central.',
      coreExplanation: 'El argumento dialéctico articula premisas fácticas y valorativas orientadas al consenso reflexivo.',
      narrativeExplanation: 'La retórica humanista privilegia la escucha activa y la solidez ética de las fuentes.',
      solvedExample: {
        problemStatement: 'Analizar la falacia "Siempre se ha hecho así, por lo tanto es correcto".',
        solutionSteps: [
          'Paso 1: Identificar la conclusión y la premisa subyacente.',
          'Paso 2: Detectar el sesgo de apelación a la tradición (ad antiquitatem).',
          'Paso 3: Reformular la tesis con evidencia documental histórica y beneficio colectivo actual.',
        ],
        interpretation: 'La tradición adquiere legitimidad cuando responde a necesidades vigentes de cohesión social.',
      },
      contrastTable: [
        {
          correctConcept: 'Un argumento sólido se sustenta en premisas comprobables y lógica proposicional.',
          commonMisconception: 'Confundir una opinión vehemente o visceral con un argumento válido.',
          reasoning: 'La validez discursiva exige coherencia lógica y pertinencia contextual.',
        },
      ],
    },
    iDoSection: {
      stepByStepDemo: 'El facilitador analiza un artículo de opinión desglosando tesis, argumentos y contraargumentos.',
    },
    weDoSection: {
      guidedPractice: 'En equipos, elaboren una matriz de debate con argumentos a favor y en contra de la preservación.',
    },
    youDoSection: {
      autonomousChallenge: 'Reto autónomo: Redacta un texto de 300 palabras defendiendo una causa ecológica o social de tu colonia.',
    },
  };

  return {
    uacName: uac,
    blockName: 'Bloque I: La Palabra como Herramienta de Transformación Social',
    blockNumber: 1,
    coverData: {
      schoolName: 'BACHILLERATO GENERAL MIGUEL HIDALGO',
      subjectName: uac,
      semester: 1,
      paecProjectName: 'Crónicas de Nuestra Comunidad',
    },
    missions: [mission],
  } as unknown as ActiveWorkTextbook;
}

describe('Fase 26 — Evaluación de Calidad e Impacto del Solucionario Docente STEM y Humanidades', () => {
  it('genera pautas algorítmicas, pasos de cálculo y contrastes de error en UACs STEM', () => {
    const stemUacs = [
      'PENSAMIENTO MATEMÁTICO II',
      'LA MATERIA Y SUS INTERACCIONES (FÍSICA)',
      'QUÍMICA I',
    ];

    for (const uac of stemUacs) {
      const workbook = makeStemWorkbook(uac);
      const materials = extractMaterialsFromWorkbook(workbook);
      const solucionario = materials.solucionarioDocente;

      // 1. Identificación y clasificación correcta
      expect(solucionario).toContain('Área STEM / Ciencias Exactas');

      // 2. Procedimiento paso a paso real y no genérico
      expect(solucionario).toContain('Paso 1: Despejar x = 100 - y');
      expect(solucionario).toContain('Paso 2: Sustituir en la restricción presupuestal');
      expect(solucionario).toContain('Paso 3: Calcular x = 100 - 40 = 60 kg');
      expect(solucionario).toContain('Comprobación: 4(60) + 6(40) = 240 + 240 = 480 pesos');

      // 3. Pauta de mediación STEM situada
      expect(solucionario).toContain('**Pauta de Resolución STEM:** Verificar');

      // 4. Matriz de contraste y prevención de errores matemáticos
      expect(solucionario).toContain('El sistema lineal 2x2 tiene solución única');
      expect(solucionario).toContain('Creer que cualquier par (x, y) que sume 100 satisface el presupuesto');

      // 5. Longitud y densidad técnica sustancial (>1500 caracteres)
      expect(solucionario.length).toBeGreaterThan(1500);

      // 6. Extracción específica bajo demanda
      const specificSol = extractSpecificMaterial(workbook, 'solucionario');
      expect(specificSol).toBe(solucionario);
    }
  });

  it('genera pautas argumentativas, dialécticas y de juicio crítico en UACs Humanidades', () => {
    const humanitiesUacs = [
      'LENGUA Y COMUNICACIÓN I',
      'HUMANIDADES I',
      'CIENCIAS SOCIALES I',
    ];

    for (const uac of humanitiesUacs) {
      const workbook = makeHumanitiesWorkbook(uac);
      const materials = extractMaterialsFromWorkbook(workbook);
      const solucionario = materials.solucionarioDocente;

      // 1. Identificación y clasificación correcta
      expect(solucionario).toContain('Área Humanidades / Ciencias Sociales');

      // 2. Pauta de evaluación argumentativa y humanística
      expect(solucionario).toContain('Pauta de Evaluación Argumentativa / Humanística');
      expect(solucionario).toContain('Evaluar la postura crítica del estudiante');

      // 3. Análisis dialéctico del ejemplo
      expect(solucionario).toContain('Detectar el sesgo de apelación a la tradición');
      expect(solucionario).toContain('Confundir una opinión vehemente o visceral con un argumento válido');

      // 4. Densidad y estructura
      expect(solucionario.length).toBeGreaterThan(1200);
    }
  });
});
