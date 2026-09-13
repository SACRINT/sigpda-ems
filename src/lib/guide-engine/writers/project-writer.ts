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

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import type { MissionSection, ProjectSection, WorkbookElement } from '@/types/work-textbook';
import { type WriterInput, type WriterOutput, evaluateQuality } from './writer-contract';
import { buildPlanningAlignmentPrompt } from './planning-alignment-prompt';

export async function generateProjectMission(input: WriterInput): Promise<WriterOutput> {
  const projectMission = input.missions.find((m) => m.missionType === 'project') || input.missions[input.missions.length - 2] || input.missions[0];
  const coveredSessions = projectMission
    ? projectMission.sessionNumbers
    : [Math.max(1, input.sessions.length - 3), Math.max(2, input.sessions.length - 2)];
  const missionTitle = projectMission ? projectMission.title : `Misión 3: Construcción del Artefacto Real`;

  const planningAlignmentChunk = buildPlanningAlignmentPrompt(input.planningActivities, 'project');

  const systemInstruction = `Eres un diseñador pedagógico y director de proyectos socioproductivos para Educación Media Superior en Puebla (MCCEMS).
Tu tarea es redactar la misión cumbre del bloque: la construcción de un "Artefacto Tecnológico o Comunitario Real" para la UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
${planningAlignmentChunk}

DIRECTIVAS DEL PROYECTO Y METAS FORMATIVAS:
1. Artefacto Real: Producto auténtico útil para la vida diaria o el empleo (no un mero resumen).
2. Utilidad Comunitaria (1,000-1,500 palabras): Vinculación profunda con la problemática PAEC: "${input.paecContext}", justificando beneficiarios e impacto.
3. Objetivos y Materiales: 3 a 5 learningObjectives de orden superior y lista detallada de requiredMaterials con especificaciones.
4. Fases y Pasos (1,500-2,000 palabras en total): 6 a 8 executionSteps secuenciales y 3 a 5 phases con entregables verificables e instrucciones detalladas.
5. Criterios de Entrega y Aceptación: 4 a 6 deliveryCriteria formales y acceptanceCriteria medibles con normas NOM/ISO.
6. Bitácora de Registro: registrationFormat estructurado con campos de sesión, parámetros, incidencias, firmas y sellos.
7. Rúbrica y Desafío Autónomo: Rúbrica en 4 niveles NEM (Excelente 10-9, Bueno 8-7, Suficiente 6-5, Insuficiente 4-1) y reto autónomo de campo (You Do - 200-350 palabras).
8. Sintaxis JSON: Usa comillas simples ('...') en código/citas. Cero comillas dobles sin escapar dentro de valores JSON.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "artifactName": "Nombre motivador y descriptivo del artefacto...",
  "communityUtility": "Descripción extensa de utilidad comunitaria e impacto...",
  "learningObjectives": [
    "Diseñar la arquitectura técnica del artefacto...",
    "Construir y verificar el prototipo funcional...",
    "Validar el impacto comunitario en el entorno PAEC..."
  ],
  "requiredMaterials": [
    "Material 1 con especificación técnica",
    "Herramienta 2 con versión o tolerancia",
    "Instrumental 3"
  ],
  "executionSteps": [
    "1. Planificación y acopio...",
    "2. Diagramación y diseño...",
    "3. Ensamble o codificación...",
    "4. Calibración y pruebas...",
    "5. Integración comunitaria...",
    "6. Documentación final..."
  ],
  "deliveryCriteria": [
    "Prototipo 100% operativo para demostración",
    "Memoria técnica impresa o digital con esquemas",
    "Bitácora de campo firmada por fase",
    "Presentación ejecutiva ante el grupo"
  ],
  "registrationFormat": "BITÁCORA TÉCNICA DE PROYECTO\\nSemana: [ ] Fecha: [ ] Equipo: [ ]\\nActividad: _________________\\nParámetros: ___________ Error: ______\\nIncidencia: _________________ Solución: _________________\\nFirma Docente: _________ Sello: [ ]",
  "phases": [
    {
      "phaseNum": 1,
      "title": "Fase 1: Diagnóstico técnico y diseño preliminar",
      "allocatedHours": 2,
      "deliverables": ["Lista de insumos", "Boceto"],
      "instructions": "Instrucciones detalladas paso a paso..."
    }
  ],
  "technicalSpecs": ["Especificación técnica 1", "Norma aplicable NOM/ISO"],
  "acceptanceCriteria": [
    "El artefacto ejecuta la función principal en condiciones normales",
    "Cumple con los parámetros de tolerancia dimensionales o de ejecución"
  ],
  "autonomousChallenge": "Instrucción y desafío técnico autónomo (Tú Haces) de 200-350 palabras para validación de campo...",
  "rubricSummary": [
    {
      "criterion": "Funcionalidad y Calidad del Artefacto",
      "excellent": "Opera al 100% cumpliendo todos los criterios de aceptación.",
      "good": "Opera cumpliendo criterios principales con detalles menores.",
      "sufficient": "Opera de forma básica con asistencia docente.",
      "insufficient": "No opera o no cumple especificaciones mínimas."
    }
  ]
}`;

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()}
Misión: ${missionTitle}
Sesiones asignadas: Sesiones ${coveredSessions.join(', ')}
Problemática PAEC: ${input.paecContext}
Meta de palabras para esta misión: mínimo ${input.targetWords.min} palabras (ideal ~${input.targetWords.ideal} palabras).

DISTRIBUCIÓN SUGERIDA DE PALABRAS:
- communityUtility (descripción e impacto): 1,000 a 1,500 palabras
- phases (instrucciones detalladas por fases de construcción): 1,500 a 2,000 palabras
- autonomousChallenge (validación autónoma de campo): 200 a 350 palabras
- rubricSummary (criterios y descriptores analíticos): 500 a 800 palabras

IMPORTANTE: Esta sección debe tener MÍNIMO 2,000 palabras sumando fases y descripción, y más de ${input.targetWords.min} palabras en total.
Incluye explicaciones detalladas, ejemplos múltiples, pasos numerados extensos y espacios para que el estudiante trabaje.

Redacta la Misión del Proyecto y Construcción del Artefacto Real:`;

  try {
    let attempt: 1 | 2 = 1;
    const rawResponse = await generateWithRotation(
      systemInstruction,
      prompt,
      input.planning.teacherId,
      false,
      { jsonMode: true, maxTokens: 8192 }
    );
    let parsed = robustJsonParse(rawResponse);

    // Validación de extensión mínima (MEJORA 1)
    const objCount = Array.isArray(parsed.learningObjectives) ? parsed.learningObjectives.length : 0;
    if (objCount < 3) {
      attempt = 2;
      console.warn(`[ProjectWriter] learningObjectives tiene solo ${objCount} items (< 3). Reintentando con instrucción estricta...`);
      try {
        const retryPrompt = `${prompt}\n\n[REQUISITO CRÍTICO DE PROFUNDIDAD]: Tu respuesta anterior tuvo menos de 3 objetivos en 'learningObjectives'. Genera OBLIGATORIAMENTE al menos 3 a 5 'learningObjectives' exhaustivos, orientados al logro de competencias integrales y vinculados al problema comunitario PAEC.`;
        const retryResponse = await generateWithRotation(
          systemInstruction,
          retryPrompt,
          input.planning.teacherId,
          false,
          { jsonMode: true, maxTokens: 8192 }
        );
        const retryParsed = robustJsonParse(retryResponse);
        if (Array.isArray(retryParsed.learningObjectives) && retryParsed.learningObjectives.length >= objCount) {
          parsed = retryParsed;
        }
      } catch (retryErr) {
        console.warn('[ProjectWriter] Error en reintento, preservando primera respuesta:', retryErr);
      }
    }

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
      learningObjectives: Array.isArray(parsed.learningObjectives) && parsed.learningObjectives.length > 0
        ? parsed.learningObjectives
        : [
            `Diseñar e implementar una solución integral de ${input.uacName} para mitigar ${input.paecContext}.`,
            'Aplicar procedimientos técnicos y normas de calidad en la construcción del artefacto.',
            'Evaluar la efectividad del producto mediante pruebas de campo y bitácora de registro.',
          ],
      requiredMaterials: Array.isArray(parsed.requiredMaterials) && parsed.requiredMaterials.length > 0
        ? parsed.requiredMaterials
        : [
            'Insumos específicos de la disciplina según la fase de planeación.',
            'Instrumental y herramientas de taller con especificaciones de seguridad.',
            'Cuaderno o bitácora de registro técnico para control de avances.',
          ],
      executionSteps: Array.isArray(parsed.executionSteps) && parsed.executionSteps.length > 0
        ? parsed.executionSteps
        : [
            '1. Diagnóstico y definición de alcances con el equipo de trabajo.',
            '2. Diseño de arquitectura y especificación de parámetros operativos.',
            '3. Ensamble, configuración o desarrollo procedimental del artefacto.',
            '4. Pruebas de funcionamiento y calibración de tolerancias.',
            '5. Despliegue situado para evaluación de impacto en el entorno escolar/comunitario.',
            '6. Elaboración de memoria técnica y entrega final ante el grupo.',
          ],
      deliveryCriteria: Array.isArray(parsed.deliveryCriteria) && parsed.deliveryCriteria.length > 0
        ? parsed.deliveryCriteria
        : [
            'Artefacto o prototipo completamente operativo y verificado.',
            'Memoria técnica con memoria de cálculo o diagrama arquitectónico.',
            'Bitácora de registro con seguimiento firmado de cada fase.',
          ],
      registrationFormat: typeof parsed.registrationFormat === 'string' && parsed.registrationFormat.trim().length > 20
        ? parsed.registrationFormat.trim()
        : 'REGISTRO DE BITÁCORA Y CONTROL DE AVANCE DEL PROYECTO\nSesión/Fecha: _______________ | Integrantes del equipo: _________________________________\nAvance realizado: _____________________________________________________________________\nParámetros verificados: ____________________ | Observaciones docentes: ___________________\nFirma de validación: ________________________',
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

    if (attempt === 1) {
      console.log(`[ProjectWriter] ✅ Generado en intento 1 — ${wordCount} palabras`);
    } else {
      console.log(`[ProjectWriter] ⚠️ Reintento necesario — ${wordCount} palabras en intento 2`);
    }

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
