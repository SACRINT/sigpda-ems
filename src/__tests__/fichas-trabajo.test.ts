// src/__tests__/fichas-trabajo.test.ts
import { describe, it, expect } from 'vitest';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { SecuenciaBloque } from '@/types/planning';

function makeWorkbook(): ActiveWorkTextbook {
  return {
    blockIndex: 0,
    blockName: 'Bloque 1: Pensamiento Algebraico',
    coverData: {
      title: 'Cuaderno de Trabajo Activo',
      subjectName: 'Pensamiento Matemático III',
      schoolName: 'Preparatoria Federal por Cooperación Héroes de la Patria',
      blockNumber: 1,
    },
    projectSection: {
      artifactName: 'Modelo algebraico comunitario',
      communityUtility: 'Resolver problemas del entorno',
      requiredMaterials: [
        '[[material:balanza-algebraica|Balanza algebraica de dos platos]]',
        'Calculadora científica con funciones trigonométricas',
      ],
      executionSteps: [],
      learningObjectives: [],
      phases: [],
      technicalSpecs: [],
      acceptanceCriteria: [],
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Ecuaciones lineales en contexto',
        coveredSessions: [1, 2],
        sessionTopic: 'Ecuaciones',
        sessionFocus: 'Despeje de la incógnita',
        phenomenonHook: {
          story: 'Una cooperativa necesita repartir costos.',
          detonatingQuestion: '¿Cómo representamos lo desconocido?',
        },
        conceptZero: {
          physicalAnalogy: 'Una balanza en equilibrio.',
          coreExplanation: 'Toda operación se aplica a ambos lados.',
        },
        iDoSection: { stepByStepDemo: 'Despeje guiado.' },
        weDoSection: { guidedPractice: 'Práctica guiada.', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto autónomo.', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué es una incógnita?',
          reflectionPrompts: [],
          criteriaChecklist: [],
        },
        wordCount: 500,
        sessionPlans: [
          {
            sessionNumber: 1,
            objetivo: 'Resolver ecuaciones de primer grado con una incógnita.',
            motivacion: 'Caso de la cooperativa.',
            saberesPrevios: 'Operaciones básicas.',
            contenido: 'Propiedades de la igualdad.',
            ejemploResuelto: 'x + 2 = 5, x = 3.',
            practica: [
              {
                enunciado: 'Resuelve la ecuación 3x + 4 = 19.',
                pista: 'Resta 4 en ambos lados y luego divide entre 3.',
                solucion: ['PASO SECRETO: x = 5'],
              },
              {
                enunciado: 'Resuelve la ecuación 2x - 6 = 10.',
                pista: 'Suma 6 en ambos lados.',
                solucion: ['PASO SECRETO: x = 8'],
              },
            ],
            aplicacion: 'Calcula el costo unitario de un producto.',
            autoevaluacion: ['¿Mostré el procedimiento completo?', '¿Comprobé mi resultado?'],
            recursos: [],
            productoIntegrador: 'Agrega la ecuación resuelta a tu portafolio.',
          },
          {
            sessionNumber: 2,
            objetivo: 'Modelar situaciones cotidianas con ecuaciones.',
            motivacion: 'Caso de la cooperativa.',
            saberesPrevios: 'Ecuaciones de primer grado.',
            contenido: 'Traducción del lenguaje natural al algebraico.',
            ejemploResuelto: 'El doble de un número más 3 es 11.',
            practica: [
              {
                enunciado: 'Escribe y resuelve la ecuación: el triple de un número menos 5 es 16.',
                pista: 'Llama x al número desconocido.',
                solucion: ['PASO SECRETO: 3x - 5 = 16, x = 7'],
              },
            ],
            aplicacion: 'Modela el costo de un servicio comunitario.',
            autoevaluacion: ['¿Traduje correctamente el enunciado?'],
            recursos: [],
            productoIntegrador: 'Registra el modelo en tu bitácora.',
          },
        ],
      },
    ],
  } as unknown as ActiveWorkTextbook;
}

function makeSequence(): SecuenciaBloque {
  return {
    blockIndex: 0,
    blockName: 'Bloque 1',
    hours: 2,
    sessions: [
      {
        sessionNum: 1,
        totalSessions: 2,
        phase: 'Desarrollo',
        title: 'Ecuaciones lineales',
        teachingActivity: 'Modela el despeje.',
        learningActivity: 'Resuelve ejercicios con balanza algebraica.',
        evidence: 'Ejercicios resueltos',
        evaluation: 'Lista de cotejo',
        garantiaDualOffline: '[[material:balanza-algebraica]] y calculadora.',
      },
      {
        sessionNum: 2,
        totalSessions: 2,
        phase: 'Cierre',
        title: 'Modelación',
        teachingActivity: 'Acompaña la modelación.',
        learningActivity: 'Traduce enunciados a ecuaciones.',
        evidence: 'Modelo escrito',
        evaluation: 'Rúbrica',
        garantiaDualOffline: 'Cuaderno y lápiz.',
      },
    ],
  };
}

describe('Fichas de trabajo imprimibles por sesión', () => {
  it('genera una ficha por sesión con ejercicios, pistas y espacio de respuesta', () => {
    const extracted = extractMaterialsFromWorkbook(makeWorkbook(), makeSequence());

    expect(extracted.fichasTrabajo).toContain('# FICHAS DE TRABAJO IMPRIMIBLES · BLOQUE 1');
    expect(extracted.fichasTrabajo).toContain('## FICHA DE TRABAJO · SESIÓN 1: Ecuaciones lineales');
    expect(extracted.fichasTrabajo).toContain('## FICHA DE TRABAJO · SESIÓN 2: Modelación');
    expect(extracted.fichasTrabajo).toContain('**Ejercicio 1.** Resuelve la ecuación 3x + 4 = 19.');
    expect(extracted.fichasTrabajo).toContain('**Pista:** Resta 4 en ambos lados');
    expect(extracted.fichasTrabajo).toContain('Planteamiento:');
    expect(extracted.fichasTrabajo).toContain('Operaciones:');
    expect(extracted.fichasTrabajo).toContain('Respuesta:');
    expect(extracted.fichasTrabajo).toContain('**Producto de la sesión:**');
    expect(extracted.fichasTrabajo).toContain('**Autoevaluación:**');
  });

  it('separa las fichas con marcadores de página y no filtra soluciones del docente', () => {
    const extracted = extractMaterialsFromWorkbook(makeWorkbook(), makeSequence());

    const pageBreaks = extracted.fichasTrabajo.match(/<!-- pagebreak -->/g) ?? [];
    expect(pageBreaks).toHaveLength(23);
    expect(extracted.fichasTrabajo).not.toContain('PASO SECRETO');
    expect(extracted.fichasTrabajo).not.toContain('solucion');
  });

  it('distribuye los materiales tokenizados en la sesión que los declara', () => {
    const extracted = extractMaterialsFromWorkbook(makeWorkbook(), makeSequence());

    expect(extracted.materialDidactico).not.toContain('## INVENTARIO');
    expect(extracted.materialDidactico).toContain('Balanza algebraica de dos platos');
    expect(extracted.materialDidactico).toContain('| Sesión 1 |');
    expect(extracted.materialDidactico).toContain('Según la actividad');
  });
});
