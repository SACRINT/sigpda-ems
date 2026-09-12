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

export async function generateLabMission(input: WriterInput): Promise<WriterOutput> {
  const labMission = input.missions.find((m) => m.missionType === 'lab') || input.missions[1] || input.missions[0];
  const coveredSessions = labMission ? labMission.sessionNumbers : [3, 4, 5];
  const missionTitle = labMission ? labMission.title : `Misión 2: Laboratorio y Taller Experimental`;

  // Construir contexto de semilla canónica si existe
  let seedPromptChunk = 'ESTADO DE SEMILLA CANÓNICA: No existe semilla previa para este tema. Genera el contenido técnico desde cero con máximo rigor.';
  if (input.canonicalSeed) {
    seedPromptChunk = `
BASE DE CONOCIMIENTO REUTILIZADA (SEMILLA CANÓNICA PRE-VALIDADA):
- Título base: ${input.canonicalSeed.content.title}
- Procedimientos estándar: ${input.canonicalSeed.content.procedures.join('; ')}
- Materiales: ${input.canonicalSeed.content.materials.join(', ')}
- Normativa aplicable: ${input.canonicalSeed.content.nomNorms?.join(', ') || 'Buenas prácticas NOM/ISO'}
- Errores comunes previos: ${input.canonicalSeed.content.commonErrors?.map((e) => e.symptom).join('; ') || 'Ninguno registrado'}
Reutiliza e integra esta base técnica adaptándola a la comunidad PAEC y al nivel de los estudiantes.`;
  }

  // ── Construir contexto de alineación con la planeación ──
  let planningAlignmentChunk = '';
  if (input.planningActivities) {
    const pa = input.planningActivities;
    planningAlignmentChunk = `
ALINEACIÓN OBLIGATORIA CON LA PLANEACIÓN DIDÁCTICA:
La actividad planificada por el docente para este bloque tiene las siguientes fases. DEBES generar contenido que las implemente fielmente:

DESARROLLO PLANIFICADO (ejecución - esta es la fase principal de esta misión): ${pa.ejecucion.description || 'No especificado'}
PROCESOS DE DESARROLLO: ${pa.ejecucion.processes || 'No especificados'}
MATERIALES DE DESARROLLO: ${pa.ejecucion.materials || 'No especificados'}

APERTURA PLANIFICADA (para contextualizar la práctica): ${pa.apertura.description || 'No especificada'}
CIERRE PLANIFICADO (para vincular con la reflexión): ${pa.conclusion.description || 'No especificado'}
${pa.saberes ? `SABERES A DESARROLLAR EN ESTA PRÁCTICA:
- Saber (teórico): ${pa.saberes.saber}
- Saber Hacer (procedimental - PRINCIPAL): ${pa.saberes.saberHacer}
- Saber Ser (actitudinal): ${pa.saberes.saberSer}` : ''}
${pa.contenidoFormativo ? `CONTENIDO FORMATIVO ESPECÍFICO: ${pa.contenidoFormativo}` : ''}
${pa.methodology ? `METODOLOGÍA SELECCIONADA: ${pa.methodology}` : ''}

REGLA DE ALINEACIÓN: El procedimiento del laboratorio DEBE implementar las actividades de desarrollo/ejecución planificadas. El objetivo DEBE estar vinculado con los saberes planificados. Los materiales DEBEN corresponder a los materiales de la planeación. NO generes una práctica que no esté contemplada en la planeación.
`;
  }

  const systemInstruction = `Eres un instructor técnico y científico de alto nivel para Bachillerato en Puebla (DBEPA / MCCEMS).
Tu tarea es redactar la misión práctica de laboratorio o taller ("${missionTitle}") para la UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
${planningAlignmentChunk}

REGLAS DE RIGOR TÉCNICO, PROFUNDIDAD Y CUADERNO ACTIVO:
1. Objetivo de la práctica: Una formulación técnica rigurosa y contundente contextualizada en la realidad productiva o comunitaria.
2. Materiales necesarios: Lista formal exhaustiva con especificaciones técnicas, normas de seguridad y casilla de verificación [✓] para cada insumo, equipo o software.
3. Procedimiento paso a paso numerado (2,000 a 3,000 palabras, 12-20 pasos detallados): Cada paso debe incluir explicación técnica profunda del "por qué" y del "cómo", precauciones operativas y espacios orientados <!--workbook:lines:rows=3--> o tablas para que el estudiante registre sus mediciones y observaciones empíricas.
4. Tabla de datos vacía: Genera encabezados descriptivos completos y filas con la etiqueta <!--workbook:table:cols=Parámetro,Teórico,Medición 1,Medición 2,Error,Unidad--> para que el alumno la llene en clase.
5. Código ejecutable o protocolo experimental (1,000 a 2,000 palabras): En BT: bloques de código reales, funcionales, completos y comentados línea a línea, acompañados de cajas de código sombreadas <!--workbook:code:lines=15--> para pruebas y variantes. En BGE: protocolo experimental minucioso de toma de datos y modelado.
6. Desafío autónomo situado (You Do - 200 a 350 palabras): Una consigna rigurosa y desafiante donde el estudiante, de manera autónoma, debe modificar parámetros, resolver una falla inducida o adaptar el procedimiento a una variante de su comunidad PAEC.
7. Preguntas de reflexión y análisis (500 a 800 palabras): 4 a 6 preguntas de desarrollo amplio que conecten directamente los datos experimentales con la teoría formal y con el entorno PAEC.
8. Depuración rápida (Common errors): Al menos 3 casos de estudio de Síntoma → Causa Raíz → Solución detallada paso a paso → Medida preventiva.
9. REGLA ESTRICTA DE SINTAXIS JSON PARA CÓDIGO Y DIÁLOGOS:
   Para fragmentos de código o cadenas (ejemplo: print('Hola'), input('Ingresa dato: ')), usa EXCLUSIVAMENTE comillas simples ('...'). NUNCA coloques comillas dobles sin escapar dentro de un valor de texto JSON.
${seedPromptChunk}

IMPORTANTE: Esta misión debe tener MÍNIMO ${input.targetWords.min} palabras en total. No la acortes. Incluye explicaciones detalladas, ejemplos múltiples, pasos numerados extensos y espacios amplios para que el estudiante trabaje.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "labTitle": "Título oficial de la práctica...",
  "objective": "Objetivo de la práctica claro y contundente...",
  "materialsList": ["✓ Insumo / Herramienta 1", "✓ Software / Equipo 2", "✓ Instrumento de medición 3"],
  "stepByStepProcedure": "1. Paso uno detallado con explicación técnica amplia...\\n<!--workbook:lines:rows=3-->\\n2. Paso dos...",
  "dataTableColumns": ["Variable / Muestra", "Valor Calculado", "Lectura 1", "Lectura 2", "Unidad"],
  "executableCodeOrProtocol": "En BT: código ejecutable completo y comentado (1,000-2,000 palabras). En BGE: protocolo experimental exhaustivo...",
  "autonomousChallenge": "Instrucción y desafío técnico autónomo (Tú Haces) de 200-350 palabras donde el alumno resuelve individualmente una variante o problema nuevo...",
  "reflectionQuestions": [
    "¿Qué relación observaste entre la variable manipulada y la respuesta del sistema? (Desarrollo amplio de análisis)",
    "¿Cómo influyó el margen de tolerancia del instrumental en los resultados?",
    "¿De qué manera este procedimiento técnico previene accidentes o fallas operativas?",
    "¿Cómo aplicarías este mismo procedimiento para resolver un problema en tu comunidad?"
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
Meta de palabras para esta misión: mínimo ${input.targetWords.min} palabras (ideal ${input.targetWords.ideal} palabras).

DISTRIBUCIÓN OBLIGATORIA DE PALABRAS:
- stepByStepProcedure: 2,000 a 3,000 palabras (desarrolla cada paso con extrema profundidad técnica)
- executableCodeOrProtocol: 1,000 a 2,000 palabras (código fuente funcional y exhaustivo o protocolo riguroso)
- autonomousChallenge: 200 a 350 palabras (desafío técnico autónomo situado para el estudiante)
- reflectionQuestions: 500 a 800 palabras (análisis técnico y transferencia al entorno)

IMPORTANTE: Esta sección debe tener MÍNIMO 2,000 palabras en su procedimiento y más de ${input.targetWords.min} palabras en total. No la acortes.
Incluye explicaciones detalladas, ejemplos múltiples, pasos numerados extensos,
y espacios amplios para que el estudiante trabaje.

Redacta la Misión Práctica de Laboratorio/Taller completa:`;

  try {
    const rawResponse = await generateWithRotation(systemInstruction, prompt, input.planning.teacherId);
    const parsed = robustJsonParse(rawResponse);

    // Extraer o generar tags de cuaderno activo
    const materialsText = Array.isArray(parsed.materialsList) ? parsed.materialsList.join(' ') : (parsed.materialsList || '');
    const reflectionsText = Array.isArray(parsed.reflectionQuestions) ? parsed.reflectionQuestions.join(' ') : (parsed.reflectionQuestions || '');
    const troublesText = Array.isArray(parsed.quickTroubleshooting)
      ? parsed.quickTroubleshooting.map((t: any) => `${t.symptom || ''} ${t.rootCause || ''} ${Array.isArray(t.solutionSteps) ? t.solutionSteps.join(' ') : (t.solutionSteps || '')} ${t.preventionTip || ''}`).join(' ')
      : '';
    const autonomousChallenge = typeof parsed.autonomousChallenge === 'string' && parsed.autonomousChallenge.trim().length > 30
      ? parsed.autonomousChallenge.trim()
      : `Desafío autónomo individual (Tú Haces): Aplica de manera independiente el procedimiento aprendido alterando una variable crítica de la práctica. Registra las variaciones obtenidas, analiza el margen de error y documenta cómo este ajuste optimiza la solución planteada para la problemática comunitaria de ${input.paecContext}.`;

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

    return {
      type: 'lab',
      section: missionSection,
      wordCount,
      tokensUsed: Math.round(wordCount * 1.3),
      qualityScore: quality.qualityScore,
      warnings: quality.warnings,
    };
  } catch (err: any) {
    console.error('[generateLabMission] Error:', err);
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
