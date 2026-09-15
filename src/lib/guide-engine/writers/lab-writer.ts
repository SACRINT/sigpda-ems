/**
 * Hands-on Lab & Workshop Mission Writer
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Redacta la misión de práctica y taller del bloque:
 * - Inyección de semillas canónicas si existen para 0 tokens técnicos redundantes.
 * - Procedimiento paso a paso detallado y ejecutable.
 * - Tablas vacías de medición y registro experimental.
 * - Código fuente 100% completo y funcional en BT (cero truncados).
 * - Preguntas de reflexión y conexión con la teoría.
 */

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import { extractWorkbookTags } from '../workbook-tags';
import type { MissionSection, WorkbookElement, TroubleshootItem } from '@/types/work-textbook';
import { type WriterInput, type WriterOutput, evaluateQuality } from './writer-contract';
import { buildPlanningAlignmentPrompt } from './planning-alignment-prompt';
import { logger } from '@/lib/logger';

export async function generateLabMission(input: WriterInput): Promise<WriterOutput> {
  const labMission = input.missions.find((m) => m.missionType === 'lab') || input.missions[1] || input.missions[0];
  const coveredSessions = labMission ? labMission.sessionNumbers : [3, 4, 5];
  const missionTitle = labMission ? labMission.title : `Misión 2: Laboratorio y Taller Experimental`;

  // Construir contexto de semilla canónica si existe
  let seedPromptChunk = '';
  if (input.canonicalSeed) {
    seedPromptChunk = `
BASE DE CONOCIMIENTO (SEMILLA CANÓNICA PRE-VALIDADA):
- Título: ${input.canonicalSeed.content.title}
- Procedimientos: ${input.canonicalSeed.content.procedures.join('; ')}
- Materiales: ${input.canonicalSeed.content.materials.join(', ')}
- Normativa: ${input.canonicalSeed.content.nomNorms?.join(', ') || 'NOM/ISO'}
- Errores comunes: ${input.canonicalSeed.content.commonErrors?.map((e) => e.symptom).join('; ') || 'Ninguno'}`;
  }

  const planningAlignmentChunk = buildPlanningAlignmentPrompt(input.planningActivities, 'lab');

  const systemInstruction = `Eres un instructor técnico y científico de alto nivel para Bachillerato en Puebla (DBEPA / MCCEMS).
Tu tarea es redactar la misión práctica de laboratorio o taller ("${missionTitle}") para la UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
${planningAlignmentChunk}
${seedPromptChunk}

DIRECTIVAS TÉCNICAS Y METAS DE EXTENSIÓN:
1. Objetivo y Materiales: Formulación técnica rigurosa y lista de insumos con casilla de verificación [✓].
2. Procedimiento paso a paso (1,500 a 2,500 palabras, 10-16 pasos): Explicación técnica de cada paso con espacios <!--workbook:lines:rows=3--> o tablas.
3. Tabla de datos vacía: Encabezados descriptivos con <!--workbook:table:cols=Parámetro,Teórico,Medición 1,Medición 2,Error,Unidad-->.
4. Código o protocolo experimental (800 a 1,500 palabras): Bloques de código reales y comentados en BT; protocolo experimental exhaustivo en BGE.
5. Reto autónomo ("Tú Haces" - 350 a 600 palabras): EXACTAMENTE 5 a 7 PASOS NUMERADOS con variables cuantitativas y vinculación PAEC: "${input.paecContext}".
6. Preguntas y Casos de Error: 4-6 preguntas analíticas amplias y al menos 3 casos de fallo (Síntoma → Causa → Solución → Prevención).
7. Sintaxis JSON: Usa comillas simples ('...') en código/citas. Cero comillas dobles sin escapar dentro de valores JSON.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "labTitle": "Título oficial de la práctica...",
  "objective": "Objetivo claro y contundente...",
  "materialsList": ["✓ Insumo / Herramienta 1", "✓ Software / Equipo 2"],
  "stepByStepProcedure": "1. Paso uno con explicación técnica...\\n<!--workbook:lines:rows=3-->\\n2. Paso dos...",
  "dataTableColumns": ["Parámetro", "Valor Teórico", "Medición 1", "Medición 2", "Unidad"],
  "executableCodeOrProtocol": "Código ejecutable completo comentado o protocolo experimental...",
  "autonomousChallenge": "1. Paso uno con instrucción cuantitativa...\\n2. Paso dos...\\n3. Paso tres...\\n4. Paso cuatro...\\n5. Paso cinco...",
  "reflectionQuestions": [
    "¿Qué relación observaste entre la variable manipulada y la respuesta del sistema?",
    "¿Cómo aplicarías este procedimiento para resolver un problema en tu comunidad?"
  ],
  "quickTroubleshooting": [
    {
      "symptom": "Síntoma visible de error...",
      "rootCause": "Causa técnica...",
      "solutionSteps": ["Solución directa paso a paso."],
      "preventionTip": "Acción preventiva para evitarlo."
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
- stepByStepProcedure: 1,500 a 2,500 palabras (desarrolla cada paso con claridad y rigor técnico)
- executableCodeOrProtocol: 800 a 1,500 palabras (código fuente funcional o protocolo experimental)
- autonomousChallenge: 350 a 600 palabras (OBLIGATORIAMENTE de 5 a 7 pasos numerados correlativos con instrucciones técnicas precisas)
- reflectionQuestions: 350 a 500 palabras (análisis técnico y transferencia)

Redacta la Misión Práctica de Laboratorio/Taller completa:`;

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
    const challengeText = typeof parsed.autonomousChallenge === 'string' ? parsed.autonomousChallenge : '';
    const stepMatches = challengeText.match(/(?:Paso\s*\d+|\b\d+[\.\)])/gi) || [];
    const stepCount = stepMatches.length;

    if (stepCount < 5) {
      attempt = 2;
      logger.warn(`[LabWriter] autonomousChallenge tiene solo ${stepCount} pasos (< 5). Reintentando con instrucción estricta...`);
      try {
        const retryPrompt = `${prompt}\n\n[REQUISITO CRÍTICO DE PROFUNDIDAD]: Tu respuesta anterior tuvo menos de 5 pasos en 'autonomousChallenge'. Redacta OBLIGATORIAMENTE el 'autonomousChallenge' en EXACTAMENTE 5 a 7 PASOS NUMERADOS (Paso 1 al Paso 5, 6 o 7), cada uno con una instrucción cuantitativa clara, variables precisas y acción técnica concreta del estudiante.`;
        const retryResponse = await generateWithRotation(
          systemInstruction,
          retryPrompt,
          input.planning.teacherId,
          false,
          { jsonMode: true, maxTokens: 8192 }
        );
        const retryParsed = robustJsonParse(retryResponse);
        const retryText = typeof retryParsed.autonomousChallenge === 'string' ? retryParsed.autonomousChallenge : '';
        const retryMatches = retryText.match(/(?:Paso\s*\d+|\b\d+[\.\)])/gi) || [];
        if (retryMatches.length >= stepCount) {
          parsed = retryParsed;
        }
      } catch (retryErr) {
        logger.warn('[LabWriter] Error en reintento, preservando primera respuesta:', { error: String(retryErr) });
      }
    }

    // Extraer o generar tags de cuaderno activo
    const materialsText = Array.isArray(parsed.materialsList) ? parsed.materialsList.join(' ') : (parsed.materialsList || '');
    const reflectionsText = Array.isArray(parsed.reflectionQuestions) ? parsed.reflectionQuestions.join(' ') : (parsed.reflectionQuestions || '');
    const troublesText = Array.isArray(parsed.quickTroubleshooting)
      ? parsed.quickTroubleshooting.map((t: any) => `${t.symptom || ''} ${t.rootCause || ''} ${Array.isArray(t.solutionSteps) ? t.solutionSteps.join(' ') : (t.solutionSteps || '')} ${t.preventionTip || ''}`).join(' ')
      : '';
    const autonomousChallenge = typeof parsed.autonomousChallenge === 'string' && parsed.autonomousChallenge.trim().length > 30
      ? parsed.autonomousChallenge.trim()
      : `Desafío autónomo individual (Tú Haces):\n1. Configura el escenario experimental o entorno de trabajo verificando las condiciones iniciales.\n2. Modifica una variable operativa o parámetro crítico (-20% o +20%) respecto a la prueba base.\n3. Ejecuta la medición u operación por duplicado anotando lecturas en tu libreta técnica.\n4. Calcula la desviación o porcentaje de variación obtenido respecto al valor esperado.\n5. Evalúa el impacto de dicha variación en la solución del reto comunitario PAEC (${input.paecContext}).\n6. Documenta tus conclusiones y presenta la evidencia validada a tu docente.`;

    const fullText = [
      parsed.objective,
      materialsText,
      parsed.stepByStepProcedure,
      parsed.executableCodeOrProtocol,
      autonomousChallenge,
      reflectionsText,
      troublesText,
    ].filter(Boolean).join(' ');

    let workbookElements: WorkbookElement[] = extractWorkbookTags(`${parsed.stepByStepProcedure || ''}\n${parsed.executableCodeOrProtocol || ''}`).map((t) => t.element);

    // Si no hay tags en el texto, generar los elementos oficiales de laboratorio
    if (workbookElements.length === 0) {
      const cols = parsed.dataTableColumns && parsed.dataTableColumns.length > 0
        ? parsed.dataTableColumns
        : ['Parámetro', 'Valor Esperado', 'Medición 1', 'Medición 2', 'Unidad'];

      workbookElements = [
        {
          id: 'wb-table-data',
          type: 'data_recording',
          title: 'Hoja de Registro Experimental y Mediciones',
          instruction: 'Registra los datos cuantitativos obtenidos durante el desarrollo de la práctica:',
          config: {
            cols,
            sampleRows: 6,
          },
        },
        {
          id: 'wb-check-safety',
          type: 'checkbox_list',
          title: 'Lista de verificación de seguridad y calidad técnica',
          instruction: 'Marca cada casilla conforme verifiques el cumplimiento del protocolo:',
          config: {
            checkboxes: [
              'Instrumental revisado y calibrado antes de iniciar.',
              'Protocolo de seguridad cumplido (equipo de protección y orden en mesa).',
              'Mediciones registradas por duplicado para control de dispersión.',
              'Espacio de trabajo limpio y respaldos de información guardados.',
            ],
          },
        },
      ];

      if (input.subsystem === 'bt') {
        workbookElements.push({
          id: 'wb-code-exec',
          type: 'code_box',
          title: 'Bloque de código y depuración de terminal',
          instruction: 'Escribe el bloque principal de ejecución o comandos de prueba utilizados:',
          config: { rows: 10 },
        });
      }

      workbookElements.push({
        id: 'wb-lab-analysis',
        type: 'lines',
        title: 'Análisis Crítico de Resultados y Conclusiones Técnicas',
        instruction: 'Anota tus deducciones individuales, balance de errores y cómo este conocimiento beneficia a la comunidad:',
        config: { rows: 6 },
      });
    }

    const troubles: TroubleshootItem[] = (parsed.quickTroubleshooting || []).map((t: any, i: number) => ({
      id: `tb-lab-${i + 1}`,
      symptom: t.symptom || 'Falla en lectura o ejecución',
      rootCause: t.rootCause || 'Parámetros incorrectos o desconexión',
      solutionSteps: Array.isArray(t.solutionSteps) ? t.solutionSteps : ['Verificar conexiones y reintentar'],
      preventionTip: t.preventionTip || 'Revisar manual antes de energizar',
    }));

    const wordCount = fullText.split(/\s+/).filter(Boolean).length;

    const missionSection: MissionSection = {
      missionIndex: labMission?.missionIndex || 2,
      title: missionTitle,
      coveredSessions,
      sessionTopic: labMission?.sessionTopic || 'Práctica de Laboratorio',
      sessionFocus: labMission?.focus || 'Destrezas prácticas y procedimentales',
      phenomenonHook: {
        story: `Durante esta práctica en el aula o taller, abordaremos directamente cómo manipular variables operativas de ${input.uacName} para resolver retos vinculados a ${input.paecContext}.`,
        detonatingQuestion: '¿De qué forma la precisión en la recolección de datos y la ejecución determina la confiabilidad del producto final?',
      },
      conceptZero: {
        physicalAnalogy: 'Cada medición experimental es como un mapa de navegación: un error de un milímetro en el punto de partida te lleva a kilómetros del destino.',
        coreExplanation: parsed.objective || 'Desarrollar habilidades operativas y analíticas con rigor procedimental.',
      },
      iDoSection: {
        stepByStepDemo: `Protocolo Técnico:\n${parsed.stepByStepProcedure || 'Demostración del docente.'}`,
      },
      weDoSection: {
        guidedPractice: `Desarrollo guiado en equipo:\n${parsed.executableCodeOrProtocol || 'Ejecución experimental coordinada.'}`,
        workbookElements: [workbookElements[0], workbookElements[1]].filter(Boolean),
      },
      youDoSection: {
        autonomousChallenge,
        workbookElements: workbookElements.slice(2).length > 0 ? workbookElements.slice(2) : [
          {
            id: 'wb-lab-analysis-fallback',
            type: 'lines',
            title: 'Análisis Crítico de Resultados y Transferencia',
            instruction: 'Redacta tus observaciones y conclusiones autónomas:',
            config: { rows: 6 },
          },
        ],
      },
      troubleshooting: troubles,
      formativeCheckpoint: {
        question: '¿Los valores experimentales coincidieron con los calculados teóricamente? Justifica tu respuesta.',
        reflectionPrompts: parsed.reflectionQuestions || ['Analiza las causas de dispersión de tus datos.'],
        criteriaChecklist: ['Registré todas las lecturas con sus unidades de medida correspondientes.'],
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
      logger.info(`[LabWriter] ✅ Generado en intento 1 — ${wordCount} palabras`);
    } else {
      logger.info(`[LabWriter] ⚠️ Reintento necesario — ${wordCount} palabras en intento 2`);
    }

    return {
      type: 'lab',
      section: missionSection,
      wordCount,
      tokensUsed: Math.round(wordCount * 1.3),
      qualityScore: quality.qualityScore,
      warnings: quality.warnings,
    };
  } catch (err: any) {
    logger.error('[generateLabMission] Error:', err);
    // Fallback estructurado de laboratorio
    const fallbackSection: MissionSection = {
      missionIndex: labMission?.missionIndex || 2,
      title: missionTitle,
      coveredSessions,
      sessionTopic: 'Práctica Experimental y de Taller',
      sessionFocus: 'Ejecución procedimental guiada',
      phenomenonHook: {
        story: `En esta sesión aplicamos los conocimientos de ${input.uacName} en el taller o laboratorio escolar.`,
        detonatingQuestion: '¿Cómo garantizamos la calidad y exactitud en los resultados?',
      },
      conceptZero: {
        physicalAnalogy: 'El rigor en el procedimiento es la garantía del éxito técnico.',
        coreExplanation: 'La práctica permite contrastar la teoría con datos empíricos tangibles.',
      },
      iDoSection: {
        stepByStepDemo: 'El docente presenta el instrumental y demuestra las normas de seguridad del taller.',
      },
      weDoSection: {
        guidedPractice: 'Los equipos de trabajo montan el dispositivo o configuran el software según las especificaciones.',
        workbookElements: [
          {
            id: 'fb-lab-table',
            type: 'empty_table',
            title: 'Tabla de mediciones',
            config: { cols: ['Muestra', 'Parámetro Teórico', 'Lectura Real', 'Unidad'], sampleRows: 5 },
          },
        ],
      },
      youDoSection: {
        autonomousChallenge: 'Analiza los datos registrados y redacta tus conclusiones.',
        workbookElements: [
          {
            id: 'fb-lab-lines',
            type: 'lines',
            title: 'Conclusión técnica',
            config: { rows: 4 },
          },
        ],
      },
      troubleshooting: [
        {
          id: 'tb-fb-1',
          symptom: 'Discrepancia en las lecturas de medición',
          rootCause: 'Falta de calibración o contacto deficiente',
          solutionSteps: ['Verificar conexiones y repetir la medición'],
          preventionTip: 'Inspeccionar el equipo antes de comenzar',
        },
      ],
      formativeCheckpoint: {
        question: '¿Qué mejoras harías al procedimiento para optimizar el tiempo de ejecución?',
        reflectionPrompts: ['Evalúa el impacto de la precisión técnica.'],
        criteriaChecklist: ['Completé la tabla de datos y las observaciones del taller.'],
      },
      wordCount: 600,
    };

    return {
      type: 'lab',
      section: fallbackSection,
      wordCount: 600,
      tokensUsed: 0,
      qualityScore: 70,
      warnings: ['Generado con fallback estructurado de laboratorio: ' + String(err?.message || err)],
    };
  }
}
