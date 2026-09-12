/**
 * Foundation Mission Writer (Concepto Cero)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Redacta la primera misión del bloque introduciendo el tema desde cero:
 * - Gancho fenomenológico situado en Puebla (PAEC).
 * - Concepto Cero: analogía física intuitiva sin tecnicismos previos.
 * - Yo Hago: demostración resuelta paso a paso.
 * - Hacemos Juntos: práctica colaborativa con espacios de trabajo.
 * - Tú Haces: reto autónomo del estudiante.
 */

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import { extractWorkbookTags } from '../workbook-tags';
import type { MissionSection, WorkbookElement } from '@/types/work-textbook';
import { type WriterInput, type WriterOutput, evaluateQuality } from './writer-contract';

export async function generateFoundationMission(input: WriterInput): Promise<WriterOutput> {
  const foundationMission = input.missions.find((m) => m.missionType === 'foundation') || input.missions[0];
  const coveredSessions = foundationMission ? foundationMission.sessionNumbers : [1, 2];
  const missionTitle = foundationMission ? foundationMission.title : `Misión 1: Fundamentación e Intuición`;

  const approach = input.subsystem === 'bt' ? 'estándar industrial y tecnológico' : 'indagación científica y dialógica';

  // ── Construir contexto de alineación con la planeación ──
  let planningAlignmentChunk = '';
  if (input.planningActivities) {
    const pa = input.planningActivities;
    planningAlignmentChunk = `
ALINEACIÓN OBLIGATORIA CON LA PLANEACIÓN DIDÁCTICA:
La actividad planificada por el docente para este bloque tiene las siguientes fases. DEBES generar contenido que las implemente fielmente:

APERTURA PLANIFICADA (actividades): ${pa.apertura.description || 'No especificada'}
PROCESOS DE APERTURA: ${pa.apertura.processes || 'No especificados'}
MATERIALES DE APERTURA: ${pa.apertura.materials || 'No especificados'}

DESARROLLO PLANIFICADO (ejecución): ${pa.ejecucion.description || 'No especificado'}
PROCESOS DE DESARROLLO: ${pa.ejecucion.processes || 'No especificados'}
MATERIALES DE DESARROLLO: ${pa.ejecucion.materials || 'No especificados'}

CIERRE PLANIFICADO (conclusión): ${pa.conclusion.description || 'No especificado'}
PROCESOS DE CIERRE: ${pa.conclusion.processes || 'No especificados'}
MATERIALES DE CIERRE: ${pa.conclusion.materials || 'No especificados'}
${pa.saberes ? `SABERES A DESARROLLAR:
- Saber (teórico): ${pa.saberes.saber}
- Saber Hacer (procedimental): ${pa.saberes.saberHacer}
- Saber Ser (actitudinal): ${pa.saberes.saberSer}` : ''}
${pa.contenidoFormativo ? `CONTENIDO FORMATIVO ESPECÍFICO: ${pa.contenidoFormativo}` : ''}
${pa.methodology ? `METODOLOGÍA SELECCIONADA: ${pa.methodology}` : ''}

REGLA DE ALINEACIÓN: El Concepto Cero DEBE conectar con la apertura planificada. El "Yo Hago" DEBE implementar las actividades de desarrollo planificadas. El "Tú Haces" DEBE evaluar los saberes planificados. NO generes actividades que no estén contempladas en la planeación.
`;
  }

  const systemInstruction = `Eres un pedagogo experto en Educación Media Superior en México y en el modelo educativo de Finlandia (Phenomenon-Based Learning).
Tu tarea es redactar la primera misión formativa del estudiante ("Misión 1: Fundamentación e Intuición - Concepto Cero") para el libro de texto activo de la UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
Enfoque pedagógico obligatorio: "${approach}".
${planningAlignmentChunk}

REGLAS PEDAGÓGICAS Y EXTENSIÓN ESTRICTA:
1. "Concepto Cero" y Explicación Central (2,000-3,000 palabras en total entre physicalAnalogy y coreExplanation): NUNCA introduzcas una fórmula, código o teoría sin antes explicarla con una ANALOGÍA FÍSICA COTIDIANA profunda (ejemplo: "una variable es como una caja rotulada con un nombre y un valor dentro"). Sin jerga previa, solo intuición pura, desglosando cada aspecto minuciosamente con múltiples ejemplos cotidianos y comparativas.
2. Gancho fenomenológico situado en Puebla: Un relato amplio y contextualizado de un desafío real de Puebla que enganche de inmediato al estudiante con el proyecto PAEC: "${input.paecContext}".
3. "Yo Hago" (Demostración guiada, 1,500-2,000 palabras): Un tutorial y ejemplo maestro resuelto paso a paso donde el docente modela y demuestra con exhaustividad. En BT: incluye código fuente ejecutable completo, explicación línea por línea y diagrama de flujo o arquitectura textual. En BGE: experimento guiado, modelación matemática o análisis de caso exhaustivo.
4. "Hacemos Juntos" (Práctica colaborativa, 1,000-1,500 palabras): Una actividad guiada donde los estudiantes resuelven en equipo un caso similar con acompañamiento, múltiples ejercicios intermedios y andamiaje.
5. "Tú Haces" (Reto autónomo, 800-1,200 palabras): Un desafío individual integral de aplicación real para que el alumno demuestre dominio autónomo y registre sus resultados.
6. Cuaderno activo: Incluye al menos 2 a 4 etiquetas <!--workbook:...--> por sección:
   - <!--workbook:lines:rows=8--> para renglones donde el alumno redacta hipótesis o justificaciones amplias.
   - <!--workbook:table:cols=Elemento,Analogía,Concepto Técnico,Aplicación--> para tablas de análisis.
   - <!--workbook:code:lines=15--> para cajas de código o terminal en BT.
   - <!--workbook:drawing:height=160--> para bocetos o esquemas conceptuales.
7. CERO placeholders genéricos como [escribe aquí] o "...". Todo el contenido debe ser riguroso, completo y en español formal mexicano (SEP).
8. REGLA ESTRICTA DE SINTAXIS JSON PARA CÓDIGO Y DIÁLOGOS:
   Para cadenas de texto o fragmentos de código (ej: print('Hola'), input('Ingresa dato: ')), usa EXCLUSIVAMENTE comillas simples ('...'). NUNCA coloques comillas dobles sin escapar dentro de un valor de texto JSON.

IMPORTANTE: Cada sección debe ser sumamente extensa y completa. No la acortes. Incluye explicaciones detalladas, ejemplos múltiples, pasos numerados extensos y espacios amplios para que el estudiante trabaje.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "phenomenonStory": "Relato fenomenológico motivador situado en Puebla...",
  "detonatingQuestion": "¿Pregunta detonadora de pensamiento crítico?",
  "physicalAnalogy": "Analogía cotidiana física intuitiva...",
  "coreExplanation": "Explicación conceptual profunda de 2,000-3,000 palabras formalizando la idea sin tecnicismos innecesarios...",
  "iDoDemo": "Demostración guiada paso a paso ('Yo Hago') de 1,500-2,000 palabras con ejemplo resuelto (en BT código ejecutable completo comentado, en BGE cálculo o experimento)...",
  "weDoPractice": "Actividad colaborativa guiada ('Hacemos Juntos') de 1,000-1,500 palabras con instrucciones claras y etiquetas <!--workbook:...-->...",
  "youDoChallenge": "Reto autónomo individual ('Tú Haces') de 800-1,200 palabras con etiquetas <!--workbook:...-->...",
  "formativeCheckpoint": {
    "question": "Pregunta de reflexión metacognitiva...",
    "reflectionPrompts": ["Pregunta de reflexión 1", "Pregunta de reflexión 2"],
    "criteriaChecklist": ["Criterio de auto-verificación 1", "Criterio 2"]
  }
}`;

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()} (Enfoque: ${approach})
Semestre: ${input.planning.semester}
Bloque: ${input.blockName} (Índice ${input.blockIndex})
Misión a redactar: ${missionTitle}
Sesiones cubiertas: Sesiones ${coveredSessions.join(', ')}
Perfil de estudiantes: ${input.studentProfile}
Meta de palabras para esta misión: mínimo ${input.targetWords.min} palabras (ideal ${input.targetWords.ideal} palabras).

DISTRIBUCIÓN OBLIGATORIA DE PALABRAS POR CAMPO:
- coreExplanation + physicalAnalogy: 2,000 a 3,000 palabras
- iDoDemo: 1,500 a 2,000 palabras
- weDoPractice: 1,000 a 1,500 palabras
- youDoChallenge: 800 a 1,200 palabras

IMPORTANTE: Esta sección debe tener MÍNIMO ${input.targetWords.min} palabras. No la acortes.
Incluye explicaciones detalladas, ejemplos múltiples, pasos numerados extensos,
y espacios amplios para que el estudiante trabaje.

Redacta la Misión de Fundamentación e Intuición completa con máxima profundidad:`;

  try {
    const rawResponse = await generateWithRotation(systemInstruction, prompt, input.planning.teacherId);
    const parsed = robustJsonParse(rawResponse);

    // Extraer tags de cuaderno presentes en la respuesta
    const fullTextForTags = `${parsed.iDoDemo || ''}\n${parsed.weDoPractice || ''}\n${parsed.youDoChallenge || ''}`;
    const parsedTags = extractWorkbookTags(fullTextForTags);
    const workbookElements: WorkbookElement[] = parsedTags.map((t) => t.element);

    // Asegurar que al menos tengamos 2 elementos de cuaderno por defecto si la IA no colocó tags
    if (workbookElements.length === 0) {
      workbookElements.push(
        {
          id: 'wb-lines-1',
          type: 'lines',
          title: 'Registro de hipótesis inicial',
          instruction: 'Escribe con tus propias palabras qué fenómeno observas y cuál es tu predicción:',
          config: { rows: 5 },
        },
        {
          id: 'wb-table-1',
          type: 'empty_table',
          title: 'Tabla de contraste conceptual',
          instruction: 'Completa la tabla comparando la analogía física con el concepto formal:',
          config: {
            cols: ['Elemento Cotidiano', 'Concepto Técnico', 'Función en el Problema'],
            sampleRows: 4,
          },
        }
      );
    }

    const formativeText = parsed.formativeCheckpoint
      ? `${parsed.formativeCheckpoint.question || ''} ${(parsed.formativeCheckpoint.reflectionPrompts || []).join(' ')} ${(parsed.formativeCheckpoint.criteriaChecklist || []).join(' ')}`
      : '';
    const sectionContent = `${parsed.phenomenonStory || ''} ${parsed.detonatingQuestion || ''} ${parsed.physicalAnalogy || ''} ${parsed.coreExplanation || ''} ${parsed.iDoDemo || ''} ${parsed.weDoPractice || ''} ${parsed.youDoChallenge || ''} ${formativeText}`.trim();
    const wordCount = sectionContent.split(/\s+/).filter(Boolean).length;

    const missionSection: MissionSection = {
      missionIndex: foundationMission?.missionIndex || 1,
      title: missionTitle,
      coveredSessions,
      sessionTopic: foundationMission?.sessionTopic || 'Fundamentos',
      sessionFocus: foundationMission?.focus || 'Concepto Cero y Andamiaje',
      phenomenonHook: {
        story: parsed.phenomenonStory || 'Desafío del entorno escolar poblano.',
        detonatingQuestion: parsed.detonatingQuestion || '¿Cómo podemos explicar y modelar esta situación?',
      },
      conceptZero: {
        physicalAnalogy: parsed.physicalAnalogy || 'Analogía intuitiva cotidiana.',
        coreExplanation: parsed.coreExplanation || 'Fundamento conceptual inicial.',
      },
      iDoSection: {
        stepByStepDemo: parsed.iDoDemo || 'Ejemplo resuelto paso a paso por el docente.',
      },
      weDoSection: {
        guidedPractice: parsed.weDoPractice || 'Actividad colaborativa en clase.',
        workbookElements: workbookElements.slice(0, Math.ceil(workbookElements.length / 2)),
      },
      youDoSection: {
        autonomousChallenge: parsed.youDoChallenge || 'Reto individual en cuaderno.',
        workbookElements: workbookElements.slice(Math.ceil(workbookElements.length / 2)),
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question: parsed.formativeCheckpoint?.question || '¿Qué aprendiste hoy y cómo se conecta con tu comunidad?',
        reflectionPrompts: parsed.formativeCheckpoint?.reflectionPrompts || ['Identifica un ejemplo similar en tu entorno.'],
        criteriaChecklist: parsed.formativeCheckpoint?.criteriaChecklist || ['Explico el concepto sin memorizar fórmulas.'],
      },
      wordCount,
    };

    const quality = evaluateQuality({
      wordCount,
      targetWords: input.targetWords,
      content: sectionContent,
      subsystem: input.subsystem,
      workbookElementsCount: workbookElements.length,
    });

    return {
      type: 'foundation',
      section: missionSection,
      wordCount,
      tokensUsed: Math.round(wordCount * 1.3),
      qualityScore: quality.qualityScore,
      warnings: quality.warnings,
    };
  } catch (err: any) {
    console.error('[generateFoundationMission] Error:', err);
    // Fallback de resiliencia estructurado
    const fallbackSection: MissionSection = {
      missionIndex: foundationMission?.missionIndex || 1,
      title: missionTitle,
      coveredSessions,
      sessionTopic: 'Fundamentación e Intuición',
      sessionFocus: 'Concepto Cero y saberes previos',
      phenomenonHook: {
        story: `En la comunidad de la escuela, nos enfrentamos cotidianamente a situaciones vinculadas a ${input.uacName}. Reflexionar sobre cómo funciona nuestro entorno nos permite plantear soluciones concretas para el proyecto PAEC: ${input.paecContext}.`,
        detonatingQuestion: '¿De qué manera los principios que estudiaremos hoy transforman las decisiones técnicas en la vida real?',
      },
      conceptZero: {
        physicalAnalogy: 'Imaginemos este concepto como un sistema interconectado donde cada componente cumple un rol indispensable.',
        coreExplanation: `El estudio de ${input.uacName} permite comprender los principios operativos y formales que rigen la disciplina.`,
      },
      iDoSection: {
        stepByStepDemo: 'El docente modela el análisis inicial en el pizarrón demostrando el procedimiento estándar.',
      },
      weDoSection: {
        guidedPractice: 'En parejas, analicen el siguiente caso aplicando los principios revisados.',
        workbookElements: [
          {
            id: 'fb-lines-1',
            type: 'lines',
            title: 'Hipótesis de trabajo',
            instruction: 'Anota en tres renglones tu propuesta inicial:',
            config: { rows: 4 },
          },
        ],
      },
      youDoSection: {
        autonomousChallenge: 'Resuelve el ejercicio de aplicación de forma individual en tu cuaderno.',
        workbookElements: [
          {
            id: 'fb-table-1',
            type: 'empty_table',
            title: 'Tabla de registro individual',
            config: { cols: ['Etapa', 'Observación', 'Conclusión'], sampleRows: 4 },
          },
        ],
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question: '¿Qué dificultades encontraste al abordar este concepto por primera vez?',
        reflectionPrompts: ['Revisa los pasos que seguiste y contrástalos con tu compañero.'],
        criteriaChecklist: ['Identifico el propósito central de la misión.'],
      },
      wordCount: 500,
    };

    return {
      type: 'foundation',
      section: fallbackSection,
      wordCount: 500,
      tokensUsed: 0,
      qualityScore: 70,
      warnings: ['Generado con fallback estructurado por timeout o error en modelo: ' + String(err?.message || err)],
    };
  }
}
