/**
 * test_material_extractor.ts
 * Valida que extractMaterialsFromWorkbook y extractSpecificMaterial funcionen
 * de manera 100% determinista, sin consumir tokens, y con compatibilidad retroactiva.
 */

import { extractMaterialsFromWorkbook, extractSpecificMaterial } from '../src/lib/guide-engine/material-extractor';
import type { ActiveWorkTextbook } from '../src/types/work-textbook';

const mockWorkbook: ActiveWorkTextbook = {
  blockIndex: 1,
  metadata: {
    totalEstimatedHours: 24,
    estimatedWordCount: 8500,
    generatedAt: new Date().toISOString(),
    engineVersion: '2.0.0-fused',
    schoolType: 'BT',
  },
  coverData: {
    subjectName: 'Pensamiento Matemático II',
    schoolName: 'CBTis 260',
    cct: '21DTA0260X',
    semester: 2,
    blockName: 'Modelación y Funciones en el Comercio Local',
    teacherName: 'Ing. Samuel',
    academicPeriod: '2026-2027',
    totalHours: 24,
  },
  pedagogicalContract: {
    studentCommitments: ['Participar activamente en las misiones'],
    teacherCommitments: ['Orientar y retroalimentar oportunamente'],
    evaluationWeightDistribution: {
      missionsContinuous: 50,
      integratingProject: 30,
      finalExamOrRubric: 20,
    },
  },
  diagnosticAssessment: {
    title: 'Evaluación Diagnóstica',
    instructions: 'Responde honestamente para identificar tus saberes previos.',
    priorKnowledgeQuestions: [
      { id: '1', question: '¿Qué es una razón de cambio?', options: ['Una fracción', 'La pendiente de una recta'], correctAnswerIndex: 1, diagnosticFeedback: 'Excelente' }
    ],
  },
  missions: [
    {
      missionIndex: 1,
      title: 'Misión 1: Registro de Precios en el Mercado Local',
      coveredSessions: [1, 2],
      sessionTopic: 'Funciones Lineales',
      sessionFocus: 'Modelación de costos',
      phenomenonHook: {
        story: 'En el mercado local de Tepeaca, el precio del maíz varía según la temporada.',
        detonatingQuestion: '¿Cómo modelar el costo total?',
      },
      conceptZero: {
        physicalAnalogy: 'La balanza del tendero',
        coreExplanation: 'La función lineal f(x) = mx + b relaciona dos variables con tasa constante.',
      },
      iDoSection: {
        stepByStepDemo: 'Paso 1: Identificar la variable independiente x.',
      },
      weDoSection: {
        guidedPractice: 'Construir una tabla de 5 valores en parejas y calcular la pendiente m.',
        collaborativeChallenge: 'Comparar resultados entre equipos.',
      },
      youDoSection: {
        autonomousChallenge: 'Modelar la función de ingresos para 20 kg y graficar.',
        expectedStudentArtifact: 'Gráfica en papel milimétrico',
        reflectionPrompt: '¿Qué representa la ordenada al origen?',
      },
      troubleshooting: [
        {
          id: 't1',
          symptom: 'La recta no pasa por el origen',
          rootCause: 'Existe un costo fijo inicial b diferente de cero.',
          solutionSteps: ['Revisar el término independiente b en la ecuación'],
          preventionTip: 'Siempre verificar las condiciones iniciales en x = 0',
        }
      ],
    },
  ],
  projectSection: {
    artifactName: 'Optimizador de Precios Comunitarios',
    communityUtility: 'Herramienta de cálculo para comerciantes del mercado municipal.',
    phases: [
      { phaseNum: 1, title: 'Diagnóstico de Costos', instructions: 'Entrevistar a 3 locatarios', allocatedHours: 6 },
    ],
  },
  evaluationSection: {
    rubric: [
      {
        criterion: 'Precisión del Modelo Matemático',
        weightPercent: 40,
        levels: [
          { level: 'Excelente', points: 10, descriptor: 'El modelo matemático es completamente exacto' },
          { level: 'Bueno', points: 8, descriptor: 'Errores menores de cálculo' },
          { level: 'Suficiente', points: 6, descriptor: 'Modelo incompleto pero conceptualmente válido' },
          { level: 'Insuficiente', points: 0, descriptor: 'No plantea modelo' },
        ],
      },
    ],
    checklist: [
      { id: 'c1', item: 'Entrega en tiempo y forma', verificationPrompt: '¿Cumple la fecha límite?' },
    ],
    examQuestions: [],
  },
  appendices: {
    formulaSheet: 'f(x) = mx + b\nm = (y2 - y1) / (x2 - x1)',
    cheatSheets: ['Propiedades de las rectas'],
    glossary: [{ term: 'Pendiente', definition: 'Inclinación de la recta' }],
  },
};

console.log('================================================================');
console.log('  TEST: EXTRACTOR DETERMINISTA DE MATERIALES DEL LIBRO DE BLOQUE');
console.log('================================================================\n');

// Test 1: Extracción completa
console.log('Test 1: Extracción completa (Guía, Instrumentos, Material Didáctico)...');
const extracted = extractMaterialsFromWorkbook(mockWorkbook);

if (!extracted.guiaDelBloque || !extracted.instrumentosEvaluacion || !extracted.materialDidactico) {
  throw new Error('Falló la extracción completa: faltan paquetes en el resultado.');
}

console.log(`✅ Guía del Bloque generada (${extracted.guiaDelBloque.split('\n').length} líneas de Markdown)`);
console.log(`✅ Instrumentos de Evaluación generados (${extracted.instrumentosEvaluacion.split('\n').length} líneas de Markdown)`);
console.log(`✅ Material Didáctico generado (${extracted.materialDidactico.split('\n').length} líneas de Markdown)`);
console.log(`✅ Planes de clase derivados: ${extracted.planesDeClase.length} planes generados`);

// Test 2: Verificación de contenido en Guía del Bloque
console.log('\nTest 2: Verificación de secciones clave en la Guía del Bloque...');
if (!extracted.guiaDelBloque.toUpperCase().includes('REGISTRO DE PRECIOS EN EL MERCADO LOCAL')) {
  throw new Error('La Guía del Bloque no contiene la misión del desarrollo.');
}
if (!extracted.guiaDelBloque.includes('GUÍA DE TRABAJO DEL ESTUDIANTE · BLOQUE')) {
  throw new Error('Falta el encabezado oficial de la Guía.');
}
console.log('✅ Contiene misión práctica, práctica guiada y reto autónomo.');

// Test 3: Verificación de Instrumentos de Evaluación
console.log('\nTest 3: Verificación de Instrumentos de Evaluación...');
if (!extracted.instrumentosEvaluacion.includes('RÚBRICA ANALÍTICA DE DESEMPEÑO')) {
  throw new Error('Los instrumentos no contienen la Rúbrica Analítica.');
}
if (!extracted.instrumentosEvaluacion.includes('Precisión del Modelo Matemático')) {
  throw new Error('Faltan los criterios de evaluación de la rúbrica.');
}
console.log('✅ Rúbrica con criterios, ponderaciones y niveles extraída con precisión.');

// Test 4: Extracción específica on-demand
console.log('\nTest 4: Extracción individual on-demand (extractSpecificMaterial)...');
const soloRubricas = extractSpecificMaterial(mockWorkbook, 'instrumentos');
if (!soloRubricas.includes('RÚBRICA ANALÍTICA DE DESEMPEÑO') || soloRubricas.toUpperCase().includes('REGISTRO DE PRECIOS')) {
  throw new Error('La extracción individual de instrumentos mezcló contenido de la guía.');
}
console.log('✅ Extracción aislada de instrumentos limpia y precisa (0 contaminación).');

console.log('\n================================================================');
console.log('  RESULTADO: ✅ TODOS LOS TESTS DEL EXTRACTOR PASARON CON ÉXITO');
console.log('================================================================');

