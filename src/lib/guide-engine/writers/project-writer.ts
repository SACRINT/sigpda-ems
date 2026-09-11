/**
 * Real Project / Artifact Mission Writer
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Redacta la misión de construcción del Artefacto Real / Proyecto Comunitario:
 * - Nombre motivador y situado del proyecto.
 * - Descripción del artefacto útil para la vida diaria o empleo.
 * - Fases de construcción sesión por sesión con entregables verificables.
 * - Criterios de aceptación técnica y calidad.
 * - Espacios de trabajo para diagramación, bitácora y portafolio de evidencias.
 */

import { callGeminiPool } from '@/lib/gemini';
import { robustJsonParse } from '../json-repair';
import type { MissionSection, ProjectSection, WorkbookElement } from '@/types/work-textbook';
import { type WriterInput, type WriterOutput, evaluateQuality } from './writer-contract';

export async function generateProjectMission(input: WriterInput): Promise<WriterOutput> {
  const projectMission = input.missions.find((m) => m.missionType === 'project') || input.missions[input.missions.length - 2] || input.missions[0];
  const coveredSessions = projectMission
    ? projectMission.sessionNumbers
    : [Math.max(1, input.sessions.length - 3), Math.max(2, input.sessions.length - 2)];
  const missionTitle = projectMission ? projectMission.title : `Misión 3: Construcción del Artefacto Real`;

  // ── Construir contexto de alineación con la planeación ──
  let planningAlignmentChunk = '';
  if (input.planningActivities) {
    const pa = input.planningActivities;
    planningAlignmentChunk = `
ALINEACIÓN OBLIGATORIA CON LA PLANEACIÓN DIDÁCTICA:
La actividad planificada por el docente para este bloque tiene las siguientes fases. DEBES generar un proyecto que las implemente fielmente:

DESARROLLO PLANIFICADO (ejecución - la construcción del artefacto DEBE implementar esto): ${pa.ejecucion.description || 'No especificado'}
PROCESOS DE DESARROLLO: ${pa.ejecucion.processes || 'No especificados'}
MATERIALES DE DESARROLLO: ${pa.ejecucion.materials || 'No especificados'}

APERTURA PLANIFICADA (contexto del proyecto): ${pa.apertura.description || 'No especificada'}
CIERRE PLANIFICADO (evaluación del proyecto): ${pa.conclusion.description || 'No especificado'}
${pa.saberes ? `SABERES QUE EL PROYECTO DEBE DEMOSTRAR:
- Saber (teórico): ${pa.saberes.saber}
- Saber Hacer (procedimental): ${pa.saberes.saberHacer}
- Saber Ser (actitudinal): ${pa.saberes.saberSer}` : ''}
${pa.contenidoFormativo ? `CONTENIDO FORMATIVO ESPECÍFICO: ${pa.contenidoFormativo}` : ''}
${pa.methodology ? `METODOLOGÍA SELECCIONADA: ${pa.methodology}` : ''}

REGLA DE ALINEACIÓN: Las fases del proyecto DEBEN implementar las actividades de desarrollo/ejecución planificadas. Los criterios de aceptación DEBEN evaluar los saberes planificados. El artefacto DEBE ser una respuesta directa a lo planteado en la planeación. NO generes un proyecto que no esté contemplado en la planeación.
`;
  }

  const systemInstruction = `Eres un diseñador pedagógico y director de proyectos socioproductivos para Educación Media Superior en Puebla (MCCEMS).
Tu tarea es redactar la misión cumbre del bloque: la construcción de un "Artefacto Tecnológico o Comunitario Real" para la UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
${planningAlignmentChunk}

REGLAS DE RELEVANCIA, PROFUNDIDAD Y TRANSFERENCIA:
1. El artefacto NO es un resumen ni una maqueta escolar inútil: es un producto auténtico (un sistema de automatización, software ejecutable, prototipo funcional, filtro ecológico, guía técnica comunitaria, dispositivo de medición) útil para la vida diaria o el empleo.
2. Descripción y Utilidad Comunitaria (1,000 a 1,500 palabras): Vinculación explícita, profunda y detallada con la problemática comunitaria PAEC: "${input.paecContext}", justificando beneficiarios directos, impacto socioeconómico y pertinencia técnica.
3. Estructura por fases de construcción progresivas (1,500 a 2,000 palabras en total entre 3 a 5 fases): Cada fase debe incluir desglose exhaustivo de actividades, horas dedicadas, roles de equipo, entregables verificables y directrices paso a paso con advertencias técnicas.
4. Criterios de aceptación objetivos y especificaciones técnicas: Lista verificable de condiciones exactas, tolerancias, métricas y normas aplicables NOM/ISO que demuestran que el artefacto funciona.
5. Rúbrica de evaluación formativa del proyecto (500 a 800 palabras): Criterios de evaluación multidimensionales desglosados en los 4 niveles oficiales NEM: Excelente (10-9), Bueno (8-7), Suficiente (6-5) e Insuficiente (4-1).
6. Espacio para portafolio de evidencias: etiquetas de cuaderno activo para diagrama de arquitectura (<!--workbook:drawing:height=160-->), lista de verificación de criterios de aceptación y bitácora de campo (<!--workbook:lines:rows=8-->).
7. Desafío autónomo situado (You Do - 200 a 350 palabras): Directrices y retos de validación de campo donde el estudiante de forma autónoma ensambla, calibra, prueba o audita el artefacto en su entorno escolar o comunitario.
8. REGLA ESTRICTA DE SINTAXIS JSON:
   Para cadenas de texto, citas o especificaciones, usa EXCLUSIVAMENTE comillas simples ('...'). NUNCA coloques comillas dobles sin escapar dentro de un valor de texto JSON.

IMPORTANTE: Esta misión debe tener MÍNIMO ${input.targetWords.min} palabras en total. No la acortes. Incluye explicaciones detalladas, especificaciones minuciosas, pasos de construcción estructurados y espacios amplios para el trabajo de campo del estudiante.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "artifactName": "Nombre motivador y descriptivo del artefacto...",
  "communityUtility": "Descripción extensa y exhaustiva (1,000-1,500 palabras) de qué construye el estudiante, para quién sirve, impacto y por qué es relevante...",
  "phases": [
    {
      "phaseNum": 1,
      "title": "Fase 1: Diagnóstico técnico y diseño preliminar",
      "allocatedHours": 2,
      "deliverables": ["Lista de insumos y especificaciones", "Boceto arquitectónico"],
      "instructions": "Instrucciones detalladas y extensas para ejecutar esta fase con rigor paso a paso..."
    }
  ],
  "technicalSpecs": ["Especificación técnica 1", "Especificación 2", "Norma aplicable NOM/ISO"],
  "acceptanceCriteria": [
    "Criterio 1: El artefacto ejecuta la función principal en condiciones normales",
    "Criterio 2: Cumple con los parámetros de tolerancia dimensionales o de ejecución",
    "Criterio 3: Incluye manual de uso o bitácora de mantenimiento"
  ],
  "autonomousChallenge": "Instrucción y desafío técnico autónomo (Tú Haces) de 200-350 palabras para la verificación, pruebas de campo y memoria técnica del artefacto...",
  "rubricSummary": [
    {
      "criterion": "Funcionalidad y Calidad del Artefacto",
      "excellent": "El artefacto opera al 100% cumpliendo todos los criterios de aceptación con maestría técnica.",
      "good": "El artefacto opera cumpliendo los criterios principales con detalles menores.",
      "sufficient": "El artefacto opera de forma básica con asistencia docente.",
      "insufficient": "El artefacto no opera o no cumple especificaciones mínimas."
    },
    {
      "criterion": "Impacto y Vinculación Comunitaria (PAEC)",
      "excellent": "Resuelve directamente la necesidad comunitaria demostrando utilidad real medible.",
      "good": "Aporta una solución clara y viable a la problemática comunitaria.",
      "sufficient": "Se vincula débilmente con la problemática planteada.",
      "insufficient": "No demuestra relación con la problemática comunitaria."
    }
  ]
}`;

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()}
Misión: ${missionTitle}
Sesiones asignadas: Sesiones ${coveredSessions.join(', ')}
Contexto PAEC escolar: ${input.paecContext}
Meta de palabras para esta misión: mínimo ${input.targetWords.min} palabras (ideal ${input.targetWords.ideal} palabras).

DISTRIBUCIÓN OBLIGATORIA DE PALABRAS:
- communityUtility (descripción y pertinencia): 1,000 a 1,500 palabras
- phases (instrucciones detalladas por fases de construcción): 1,500 a 2,000 palabras
- autonomousChallenge (validación autónoma de campo): 200 a 350 palabras
- rubricSummary (criterios y descriptores analíticos): 500 a 800 palabras

IMPORTANTE: Esta sección debe tener MÍNIMO 2,000 palabras sumando fases y descripción, y más de ${input.targetWords.min} palabras en total. No la acortes.
Incluye explicaciones detalladas, ejemplos múltiples, pasos numerados extensos,
y espacios amplios para que el estudiante trabaje.

Redacta la Misión del Proyecto y Construcción del Artefacto Real:`;

  try {
    const rawResponse = await callGeminiPool(systemInstruction, prompt, input.planning.teacherId);
    const parsed = robustJsonParse(rawResponse);

    const phases = (parsed.phases || []).map((p: any, i: number) => ({
      phaseNum: p.phaseNum || i + 1,
      title: p.title || `Fase ${i + 1}`,
      allocatedHours: p.allocatedHours || 2,
      deliverables: Array.isArray(p.deliverables) ? p.deliverables : ['Entregable de fase'],
      instructions: p.instructions || 'Desarrollar las actividades asignadas para esta fase.',
    }));

    const projectSection: ProjectSection = {
      artifactName: parsed.artifactName || `Solución Aplicada para ${input.uacName}`,
      communityUtility: parsed.communityUtility || `Mejora técnica orientada a ${input.paecContext}`,
      phases,
      technicalSpecs: parsed.technicalSpecs || ['Estándares de calidad y funcionalidad técnica'],
      acceptanceCriteria: parsed.acceptanceCriteria || ['El producto final opera de forma verificable'],
    };

    const autonomousChallenge = typeof parsed.autonomousChallenge === 'string' && parsed.autonomousChallenge.trim().length > 30
      ? parsed.autonomousChallenge.trim()
      : `Desafío autónomo individual (Tú Haces): Realiza de manera independiente la validación operativa y de calidad de tu artefacto aplicando la lista de verificación y la bitácora de campo. Contrasta los resultados obtenidos con los criterios de aceptación y documenta cualquier ajuste técnico necesario para maximizar su impacto en ${input.paecContext}.`;

    const workbookElements: WorkbookElement[] = [
      {
        id: 'wb-project-diagram',
        type: 'drawing_box',
        title: 'Diagrama de Arquitectura y Esquema de Conexión del Artefacto',
        instruction: 'Dibuja el diagrama de bloques, esquema funcional o circuito de tu solución:',
        config: { heightPx: 160 },
      },
      {
        id: 'wb-project-checklist',
        type: 'checkbox_list',
        title: 'Lista de verificación de criterios de aceptación',
        instruction: 'Verifica junto con tu docente el cumplimiento de cada criterio antes de la entrega:',
        config: {
          checkboxes: projectSection.acceptanceCriteria.length > 0
            ? projectSection.acceptanceCriteria
            : ['Cumple con las especificaciones técnicas', 'Resuelve el problema planteado', 'Documentado en la bitácora'],
        },
      },
      {
        id: 'wb-project-notes',
        type: 'lines',
        title: 'Bitácora de campo y lecciones aprendidas',
        instruction: 'Anota los principales retos técnicos enfrentados y cómo los resolvieron en equipo:',
        config: { rows: 6 },
      },
    ];

    const phasesText = phases.map((p: any) => `${p.title}: ${p.instructions}`).join('\n\n');
    const rubricText = Array.isArray(parsed.rubricSummary)
      ? parsed.rubricSummary.map((r: any) => `${r.criterion || ''}: ${r.excellent || ''} ${r.good || ''} ${r.sufficient || ''} ${r.insufficient || ''}`).join(' ')
      : '';
    const specsText = Array.isArray(projectSection.technicalSpecs) ? projectSection.technicalSpecs.join(' ') : '';
    const criteriaText = Array.isArray(projectSection.acceptanceCriteria) ? projectSection.acceptanceCriteria.join(' ') : '';
    const fullText = `${projectSection.artifactName}\n${projectSection.communityUtility}\n${phasesText}\n${autonomousChallenge}\n${specsText}\n${criteriaText}\n${rubricText}`;
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;

    const missionSection: MissionSection = {
      missionIndex: projectMission?.missionIndex || 3,
      title: missionTitle,
      coveredSessions,
      sessionTopic: projectSection.artifactName,
      sessionFocus: 'Construcción del artefacto e integración socioproductiva',
      phenomenonHook: {
        story: `Llegamos a la fase de transferencia y aplicación: aquí transformamos el conocimiento de ${input.uacName} en un artefacto real que atiende la problemática de ${input.paecContext}.`,
        detonatingQuestion: '¿De qué manera una solución técnica bien diseñada puede mejorar la calidad de vida en nuestro entorno escolar y comunitario?',
      },
      conceptZero: {
        physicalAnalogy: 'Un proyecto es como construir un puente: no basta con que los cálculos sean elegantes en papel, debe soportar el peso de las personas que lo cruzan.',
        coreExplanation: projectSection.communityUtility,
      },
      iDoSection: {
        stepByStepDemo: `Fases del Proyecto Formativo:\n${phasesText}`,
      },
      weDoSection: {
        guidedPractice: 'Desarrollo colaborativo en equipos de trabajo con seguimiento docente en el aula y taller.',
        workbookElements: [workbookElements[0]],
      },
      youDoSection: {
        autonomousChallenge,
        workbookElements: workbookElements.slice(1),
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question: '¿Qué impacto esperado tiene tu artefacto en la comunidad o en tu perfil profesional?',
        reflectionPrompts: ['Evalúa la viabilidad y durabilidad de tu propuesta.'],
        criteriaChecklist: ['El artefacto cumple los criterios de aceptación acordados.'],
      },
      wordCount,
    };

    const quality = evaluateQuality({
      wordCount,
      targetWords: input.targetWords,
      content: fullText,
      subsystem: input.subsystem,
      workbookElementsCount: workbookElements.length,
    });

    return {
      type: 'project',
      section: missionSection,
      projectSection,
      wordCount,
      tokensUsed: Math.round(wordCount * 1.3),
      qualityScore: quality.qualityScore,
      warnings: quality.warnings,
    };
  } catch (err: any) {
    console.error('[generateProjectMission] Error:', err);
    // Fallback estructurado de proyecto
    const fallbackProject: ProjectSection = {
      artifactName: `Artefacto Integrador: Solución para ${input.uacName}`,
      communityUtility: `Propuesta de intervención técnica vinculada a ${input.paecContext}.`,
      phases: [
        { phaseNum: 1, title: 'Fase 1: Definición y Diseño', allocatedHours: 2, deliverables: ['Boceto'], instructions: 'Definir el alcance y materiales.' },
        { phaseNum: 2, title: 'Fase 2: Construcción y Ensamble', allocatedHours: 4, deliverables: ['Prototipo'], instructions: 'Ejecutar el montaje o programación.' },
        { phaseNum: 3, title: 'Fase 3: Pruebas y Entrega', allocatedHours: 2, deliverables: ['Bitácora'], instructions: 'Verificar funcionamiento con rúbrica.' },
      ],
      technicalSpecs: ['Normas básicas de calidad y presentación formal'],
      acceptanceCriteria: ['El producto opera de acuerdo con su propósito formativo'],
    };

    const fallbackSection: MissionSection = {
      missionIndex: projectMission?.missionIndex || 3,
      title: missionTitle,
      coveredSessions,
      sessionTopic: fallbackProject.artifactName,
      sessionFocus: 'Integración del proyecto formativo',
      phenomenonHook: {
        story: `Culminamos el bloque aplicando lo aprendido para el proyecto PAEC: ${input.paecContext}.`,
        detonatingQuestion: '¿Cómo validamos que nuestra solución es técnicamente viable?',
      },
      conceptZero: {
        physicalAnalogy: 'El conocimiento cobra verdadero sentido cuando se materializa en una solución tangible.',
        coreExplanation: fallbackProject.communityUtility,
      },
      iDoSection: {
        stepByStepDemo: 'El docente presenta la guía de entrega y los parámetros de evaluación del proyecto.',
      },
      weDoSection: {
        guidedPractice: 'Trabajo en equipo en el desarrollo de las fases del artefacto.',
        workbookElements: [
          {
            id: 'fb-proj-draw',
            type: 'drawing_box',
            title: 'Boceto de la solución',
            config: { heightPx: 140 },
          },
        ],
      },
      youDoSection: {
        autonomousChallenge: 'Pruebas finales, verificación de especificaciones de diseño y autoevaluación del desempeño.',
        workbookElements: [
          {
            id: 'fb-proj-check',
            type: 'checkbox_list',
            title: 'Verificación de entrega',
            config: { checkboxes: ['Entrega en tiempo', 'Funcionalidad comprobada', 'Bitácora firmada'] },
          },
        ],
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question: '¿Qué aprendiste al construir este proyecto que no venía en los libros teóricos?',
        reflectionPrompts: ['Reflexiona sobre el valor del trabajo en equipo.'],
        criteriaChecklist: ['Cumplí con todos los entregables de la misión.'],
      },
      wordCount: 500,
    };

    return {
      type: 'project',
      section: fallbackSection,
      projectSection: fallbackProject,
      wordCount: 500,
      tokensUsed: 0,
      qualityScore: 70,
      warnings: ['Generado con fallback estructurado de proyecto: ' + String(err?.message || err)],
    };
  }
}
