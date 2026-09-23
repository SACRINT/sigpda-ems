/**
 * Foundation Mission Writer (Concepto Cero)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
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
import { extractWorkbookTags, consolidateWorkbookElements, stripWorkbookTags } from '../workbook-tags';
import type { MissionSection, WorkbookElement } from '@/types/work-textbook';
import { type WriterInput, type WriterOutput, evaluateQuality } from './writer-contract';
import { buildPlanningAlignmentPrompt } from './planning-alignment-prompt';
import { logger } from '@/lib/logger';

export async function generateFoundationMission(input: WriterInput): Promise<WriterOutput> {
  const foundationMission = input.missions.find((m) => m.missionType === 'foundation') || input.missions[0];
  const coveredSessions = foundationMission ? foundationMission.sessionNumbers : [1, 2];
  const missionTitle = foundationMission ? foundationMission.title : `Misión 1: Fundamentación e Intuición`;

  const approach = input.subsystem === 'bt' ? 'estándar industrial y tecnológico' : 'indagación científica y dialógica';
  const planningAlignmentChunk = buildPlanningAlignmentPrompt(input.planningActivities, 'foundation');

  const systemInstruction = `Eres un pedagogo experto en Educación Media Superior en México y en el modelo educativo de Finlandia (Phenomenon-Based Learning).
Tu tarea es redactar la primera misión formativa ("Misión 1: Fundamentación e Intuición - Concepto Cero") para el libro de texto activo de: "${input.uacName}" (${input.subsystem.toUpperCase()}).
Enfoque pedagógico: "${approach}".
${planningAlignmentChunk}

REGLAS DE PROFUNDIDAD Y CUADERNO ACTIVO:
1. Concepto Cero (MÍNIMO 2,000-3,000 palabras en total entre physicalAnalogy y coreExplanation):
   - physicalAnalogy: Analogía cotidiana vívida e intuitiva (80-140 palabras) de la vida real o comunidad, sin tecnicismos previos.
   - coreExplanation: Al menos 2 párrafos explicativos extensos + 1 EJEMPLO RESUELTO PASO A PASO con datos cuantitativos/procedimentales + 1 tabla de contraste <!--workbook:table:cols=Aspecto Cotidiano,Concepto Técnico Formal,Función en el Problema-->.
2. Gancho fenomenológico: Desafío real motivador de Puebla contextualizado en el proyecto PAEC: "${input.paecContext}".
3. Yo Hago (1,500-2,000 palabras): Tutorial maestro modelado paso a paso (código funcional comentado en BT; modelación/experimento en BGE).
4. Hacemos Juntos (1,000-1,500 palabras): Práctica colaborativa en equipo con andamiaje y ejercicios intermedios.
5. Tú Haces (800-1,200 palabras): Desafío individual de aplicación real con espacios de trabajo.
6. Cuaderno activo: Incluye 2-4 etiquetas <!--workbook:...--> (lines:rows=8, table:cols=..., code:lines=15, drawing:height=160).
7. Sintaxis JSON: Usa comillas simples ('...') en código/citas. Cero comillas dobles sin escapar dentro de valores JSON.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "phenomenonStory": "Relato fenomenológico motivador...",
  "detonatingQuestion": "¿Pregunta detonadora de pensamiento crítico?",
  "physicalAnalogy": "Analogía cotidiana física e intuitiva...",
  "coreExplanation": "Explicación conceptual profunda (2 párrafos + ejemplo resuelto paso a paso + tabla comparativa)...",
  "iDoDemo": "Demostración guiada paso a paso ('Yo Hago')...",
  "weDoPractice": "Actividad colaborativa guiada ('Hacemos Juntos')...",
  "youDoChallenge": "Reto autónomo individual ('Tú Haces')...",
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

DISTRIBUCIÓN OBLIGATORIA DE PALABRAS:
- coreExplanation + physicalAnalogy: 2,000 a 3,000 palabras
- iDoDemo: 1,500 a 2,000 palabras
- weDoPractice: 1,000 a 1,500 palabras
- youDoChallenge: 800 a 1,200 palabras

Redacta la Misión de Fundamentación e Intuición completa con máxima profundidad:`;

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
    const coreWords = (parsed.coreExplanation || '').split(/\s+/).filter(Boolean).length;
    if (coreWords < 500) {
      attempt = 2;
      logger.warn(`[FoundationWriter] coreExplanation tiene solo ${coreWords} palabras (< 500). Reintentando con instrucción estricta...`);
      try {
        const retryPrompt = `${prompt}\n\n[REQUISITO CRÍTICO DE PROFUNDIDAD]: Tu respuesta anterior fue insuficiente (${coreWords} palabras en coreExplanation). Redacta OBLIGATORIAMENTE un 'coreExplanation' de MÍNIMO 500 palabras con al menos dos párrafos explicativos extensos, desarrollando paso a paso la fundamentación formal y física del concepto sin resumir.`;
        const retryResponse = await generateWithRotation(
          systemInstruction,
          retryPrompt,
          input.planning.teacherId,
          false,
          { jsonMode: true, maxTokens: 8192 }
        );
        const retryParsed = robustJsonParse(retryResponse);
        const retryWords = (retryParsed.coreExplanation || '').split(/\s+/).filter(Boolean).length;
        if (retryWords > coreWords) {
          parsed = retryParsed;
        }
      } catch (retryErr) {
        logger.warn('[FoundationWriter] Error en reintento, preservando primera respuesta:', { error: String(retryErr) });
      }
    }

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

    // Consolidación de tags lines ANTES del .slice() para correcta distribución entre weDo y youDo
    const consolidatedElements = consolidateWorkbookElements(workbookElements);

    // Limpieza de etiquetas de control <!--workbook:...--> de los textos procedimentales
    const cleanIDoDemo = stripWorkbookTags(parsed.iDoDemo || 'Ejemplo resuelto paso a paso por el docente.');
    const cleanWeDoPractice = stripWorkbookTags(parsed.weDoPractice || 'Actividad colaborativa en clase.');
    const cleanYouDoChallenge = stripWorkbookTags(parsed.youDoChallenge || 'Reto individual en cuaderno.');

    const formativeText = parsed.formativeCheckpoint
      ? `${parsed.formativeCheckpoint.question || ''} ${(parsed.formativeCheckpoint.reflectionPrompts || []).join(' ')} ${(parsed.formativeCheckpoint.criteriaChecklist || []).join(' ')}`
      : '';
    const sectionContent = `${parsed.phenomenonStory || ''} ${parsed.detonatingQuestion || ''} ${parsed.physicalAnalogy || ''} ${parsed.coreExplanation || ''} ${cleanIDoDemo} ${cleanWeDoPractice} ${cleanYouDoChallenge} ${formativeText}`.trim();
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
        stepByStepDemo: cleanIDoDemo,
      },
      weDoSection: {
        guidedPractice: cleanWeDoPractice,
        workbookElements: consolidatedElements.slice(0, Math.ceil(consolidatedElements.length / 2)),
      },
      youDoSection: {
        autonomousChallenge: cleanYouDoChallenge,
        workbookElements: consolidatedElements.slice(Math.ceil(consolidatedElements.length / 2)),
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

    if (attempt === 1) {
      logger.info(`[FoundationWriter] ✅ Generado en intento 1 — ${wordCount} palabras`);
    } else {
      logger.info(`[FoundationWriter] ⚠️ Reintento necesario — ${wordCount} palabras en intento 2`);
    }

    return {
      type: 'foundation',
      section: missionSection,
      wordCount,
      tokensUsed: Math.round(wordCount * 1.3),
      qualityScore: quality.qualityScore,
      warnings: quality.warnings,
    };
  } catch (err: unknown) {
    logger.error('[generateFoundationMission] Error:', err);
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
      warnings: ['Generado con fallback estructurado por timeout o error en modelo: ' + (err instanceof Error ? err.message : String(err))],
    };
  }
}
