import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import { isStemSubject, isHumanitiesSubject } from '@/lib/visual-engine/visual-dispatcher';

/**
 * Plan de Clase individual por sesión derivado determinísticamente del Libro de Bloque.
 * Cumple con la interfaz SesionClase de la DBEPA Puebla y MCCEMS 2026.
 */
export interface PlanDeClaseDerivado {
  numeroSesion: number;
  duracionMinutos: number;
  tituloSesion: string;
  propósitoOMeta: string;
  transversalidad: string;
  apertura: {
    actividadDocente: string;
    actividadEstudiante: string;
    saberesPrevios: string;
    tiempoMinutos: number;
  };
  desarrollo: {
    actividadDocente: string;
    actividadEstudiante: string;
    metodologiaActiva: string;
    recursosDidacticos: string;
    tiempoMinutos: number;
  };
  cierre: {
    actividadDocente: string;
    actividadEstudiante: string;
    evaluacionFormativa: string;
    metacognicion: string;
    productoEsperado: string;
    tiempoMinutos: number;
  };
  instrumentoEvaluacion: string;
}

export interface ExtractedBlockMaterials {
  metadata: {
    extractedAt: string;
    blockIndex: number;
    blockName: string;
    totalPlanesClase: number;
    subjectName: string;
    schoolName: string;
    executionTimeMs: number;
  };
  planesDeClase: PlanDeClaseDerivado[];
  guiaDelBloque: string;
  solucionarioDocente: string;
  instrumentosEvaluacion: string;
  rubricaEvaluacion?: string;
  listaCotejo?: string;
  materialDidactico: string;
  quiz: Array<{
    questionNumber: number;
    question: string;
    scenario: string;
    options?: string[];
    answerExplanation: string;
  }>;
}

/**
 * Función pura determinística que extrae los 24 Planes de Clase, la Guía de Trabajo,
 * los Instrumentos de Evaluación y el Material Didáctico del Libro de Bloque (ActiveWorkTextbook).
 *
 * Rendimiento: < 5 ms de ejecución en memoria.
 * Costo: 0 llamadas de red / 0 tokens de IA.
 */
export function extractMaterialsFromWorkbook(workbook: ActiveWorkTextbook): ExtractedBlockMaterials {
  const startTime = performance.now();

  const missions = workbook.missions || [];
  const planesDeClase: PlanDeClaseDerivado[] = [];

  // 1. Extraer o mapear las 24 sesiones de clase a partir de las misiones
  const TARGET_SESSIONS = 24;

  if (missions.length > 0) {
    // Si las misiones tienen coveredSessions explícitas, mapearlas
    for (let mIdx = 0; mIdx < missions.length; mIdx++) {
      const mission = missions[mIdx];
      const sessions = Array.isArray(mission.coveredSessions) && mission.coveredSessions.length > 0
        ? mission.coveredSessions
        : [mIdx * 3 + 1, mIdx * 3 + 2, mIdx * 3 + 3];

      for (const sNum of sessions) {
        if (sNum <= TARGET_SESSIONS) {
          planesDeClase.push(buildPlanDeClase(workbook, mission, sNum));
        }
      }
    }
  }

  // Si no se alcanzaron 24 sesiones (ej. menos de 8 misiones), completar hasta 24 proporcionalmente
  const currentCount = planesDeClase.length;
  if (currentCount < TARGET_SESSIONS) {
    const fallbackMission: MissionSection = missions[0] || {
      missionIndex: 1,
      title: workbook.blockName || 'Bloque Formativo',
      coveredSessions: [1],
      sessionTopic: workbook.coverData?.subjectName || 'Formación Disciplinar',
      sessionFocus: 'Desarrollo de competencias y aprendizajes clave',
      phenomenonHook: {
        story: 'Desafío práctico situado en el entorno regional.',
        detonatingQuestion: '¿Cómo aplicamos los conceptos en la resolución de problemas cotidianos?',
      },
      conceptZero: {
        physicalAnalogy: 'Analogía práctica del contexto escolar.',
        coreExplanation: 'Fundamentación conceptual aplicada.',
      },
      iDoSection: {
        stepByStepDemo: 'Explicación demostrativa y modelado guiado por el docente.',
      },
      weDoSection: {
        guidedPractice: 'Actividad colaborativa en equipos de trabajo.',
        workbookElements: [],
      },
      youDoSection: {
        autonomousChallenge: 'Reto autónomo de consolidación práctica.',
        workbookElements: [],
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question: 'Verificación de aprendizaje esperado.',
        reflectionPrompts: ['¿Qué dificultades enfrentaste?'],
        criteriaChecklist: ['Comprensión', 'Aplicación'],
      },
      wordCount: 500,
    };

    for (let i = currentCount + 1; i <= TARGET_SESSIONS; i++) {
      const parentMission = missions.length > 0
        ? missions[(i - 1) % missions.length]
        : fallbackMission;
      planesDeClase.push(buildPlanDeClase(workbook, parentMission, i));
    }
  }

  // Ordenar sesiones por número correlativo
  planesDeClase.sort((a, b) => a.numeroSesion - b.numeroSesion);

  // 2. Extraer Guía de Trabajo del Estudiante (Markdown operativo sin notas pedagógicas del docente)
  const guiaDelBloque = buildGuiaDelBloqueMarkdown(workbook);

  // 2.1 Extraer Solucionario y Guía de Mediación Docente (STEM determinístico, humanidades referencia)
  const solucionarioDocente = buildSolucionarioDocenteMarkdown(workbook);

  // 3. Extraer Instrumentos de Evaluación (Rúbricas analíticas oficiales de 4 niveles y listas de cotejo)
  const rubricaEvaluacion = buildRubricaEvaluacionMarkdown(workbook);
  const listaCotejo = buildListaCotejoMarkdown(workbook);
  const instrumentosEvaluacion = buildInstrumentosEvaluacionMarkdown(workbook);

  // 4. Extraer Material Didáctico (Insumos, reactivos, herramientas y equipo por sesión)
  const materialDidactico = buildMaterialDidacticoMarkdown(workbook, planesDeClase);

  // 5. Extraer Quiz de Pensamiento Crítico
  const quiz = (workbook.evaluationSection?.criticalThinkingQuiz || []).map((q, idx) => ({
    questionNumber: q.questionNumber || idx + 1,
    question: q.question,
    scenario: q.scenario,
    options: q.options,
    answerExplanation: q.answerExplanation,
  }));

  const endTime = performance.now();
  const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

  return {
    metadata: {
      extractedAt: new Date().toISOString(),
      blockIndex: workbook.blockIndex ?? 1,
      blockName: workbook.blockName || `Bloque ${workbook.blockIndex ?? 1}`,
      totalPlanesClase: planesDeClase.length,
      subjectName: workbook.coverData?.subjectName || '',
      schoolName: workbook.coverData?.schoolName || '',
      executionTimeMs,
    },
    planesDeClase,
    guiaDelBloque,
    solucionarioDocente,
    instrumentosEvaluacion,
    rubricaEvaluacion,
    listaCotejo,
    materialDidactico,
    quiz,
  };
}

// ─── Helpers de Construcción Determinística ──────────────────────────────────

function buildPlanDeClase(
  workbook: ActiveWorkTextbook,
  mission: MissionSection,
  sessionNum: number
): PlanDeClaseDerivado {
  const paecText = workbook.coverData?.paecProjectName
    ? `Vinculación PAEC: ${workbook.coverData.paecProjectName}. Impacto escolar y comunitario.`
    : 'Transversalidad comunitaria y socioemocional alineada al MCCEMS.';

  const aperturaDocente = mission.phenomenonHook?.story
    ? `Presentar el fenómeno contextual: "${mission.phenomenonHook.story.slice(0, 180)}..." y moderar lluvia de ideas.`
    : 'Presentar el desafío de la sesión y activar saberes previos mediante preguntas detonadoras.';

  const aperturaEstudiante = mission.phenomenonHook?.detonatingQuestion
    ? `Analizar la situación problemática y reflexionar sobre la interrogante: "${mission.phenomenonHook.detonatingQuestion}".`
    : 'Participar activamente en la recuperación de saberes previos y registrar reflexiones iniciales.';

  const saberes = mission.conceptZero?.physicalAnalogy
    ? `Analogía cotidiana: ${mission.conceptZero.physicalAnalogy}`
    : 'Conexión con conceptos fundamentales y experiencias previas.';

  const desarrolloDocente = mission.iDoSection?.stepByStepDemo
    ? `Demostración paso a paso (Yo Hago): Modelado explícito del procedimiento. ${mission.iDoSection.stepByStepDemo.slice(0, 220)}...`
    : 'Modelado instruccional y acompañamiento guiado durante la resolución de ejercicios.';

  const desarrolloEstudiante = `Práctica guiada ("Hacemos"): ${mission.weDoSection?.guidedPractice ? mission.weDoSection.guidedPractice.slice(0, 140) + '...' : 'Trabajo colaborativo'}. Reto autónomo ("Tú Haces"): ${mission.youDoSection?.autonomousChallenge ? mission.youDoSection.autonomousChallenge.slice(0, 140) + '...' : 'Resolución individual en cuaderno de trabajo'}.`;

  const cierreDocente = `Monitorear el checkpoint formativo: "${mission.formativeCheckpoint?.question || 'Evaluación de salida'}". Retroalimentar errores comunes detectados.`;

  const cierreEstudiante = `Resolver checkpoint formativo, autoevaluar con lista de cotejo y responder reflexión metacognitiva: ${mission.formativeCheckpoint?.reflectionPrompts?.[0] || '¿Cómo aplico lo aprendido?'}.`;

  const evaluacionFormativa = mission.formativeCheckpoint?.question || 'Checkpoint de comprensión y resolución de problema aplicado';
  const metacognicion = mission.formativeCheckpoint?.reflectionPrompts?.join(' ') || 'Identificación de fortalezas y áreas de mejora en el proceso de aprendizaje.';
  const productoEsperado = `Evidencia práctica documentada de la Misión ${mission.missionIndex} (Sesión ${sessionNum})`;

  return {
    numeroSesion: sessionNum,
    duracionMinutos: 50,
    tituloSesion: `${mission.title || 'Misión de Aprendizaje'} · Sesión ${sessionNum}`,
    propósitoOMeta: mission.sessionFocus || mission.sessionTopic || mission.title,
    transversalidad: paecText,
    apertura: {
      actividadDocente: aperturaDocente,
      actividadEstudiante: aperturaEstudiante,
      saberesPrevios: saberes,
      tiempoMinutos: 10,
    },
    desarrollo: {
      actividadDocente: desarrolloDocente,
      actividadEstudiante: desarrolloEstudiante,
      metodologiaActiva: 'Aprendizaje Basado en Retos y Modelado Cognitivo (I Do - We Do - You Do)',
      recursosDidacticos: 'Cuaderno de Trabajo Activo del estudiante, bitácora de taller/laboratorio, instrumental didáctico.',
      tiempoMinutos: 30,
    },
    cierre: {
      actividadDocente: cierreDocente,
      actividadEstudiante: cierreEstudiante,
      evaluacionFormativa,
      metacognicion,
      productoEsperado,
      tiempoMinutos: 10,
    },
    instrumentoEvaluacion: `Rúbrica de Desempeño y Lista de Cotejo · Misión ${mission.missionIndex}`,
  };
}

function buildGuiaDelBloqueMarkdown(workbook: ActiveWorkTextbook): string {
  const parts: string[] = [];
  const cover = (workbook.coverData || {}) as Record<string, unknown>;

  parts.push(`# GUÍA DE TRABAJO DEL ESTUDIANTE · BLOQUE ${workbook.blockIndex ?? 1}`);
  parts.push(`**Asignatura / UAC:** ${(cover.subjectName as string) || ''}`);
  parts.push(`**Plantel:** ${(cover.schoolName as string) || ''} | **Semestre:** ${(cover.semester as number | string) || 1}°`);
  if (cover.paecProjectName) parts.push(`**Proyecto PAEC:** ${cover.paecProjectName as string}`);
  parts.push('\n---\n');

  parts.push('## INSTRUCCIONES GENERALES');
  parts.push('Esta guía contiene las misiones prácticas, ejercicios escalonados y retos de aplicación que deberás resolver a lo largo del bloque formativo.\n');

  for (const mission of workbook.missions || []) {
    parts.push(`### MISIÓN ${mission.missionIndex}: ${mission.title.toUpperCase()}`);
    parts.push(`*Tópico central:* ${mission.sessionTopic}`);
    parts.push(`\n**1. Situación Detonadora:**\n${mission.phenomenonHook?.story || ''}`);
    parts.push(`\n> **Pregunta Clave:** ${mission.phenomenonHook?.detonatingQuestion || ''}\n`);

    if (mission.conceptZero?.coreExplanation) {
      parts.push(`**2. Fundamento Esencial:**\n${mission.conceptZero.coreExplanation}\n`);
    }

    if (mission.weDoSection?.guidedPractice) {
      parts.push(`**3. Práctica Guiada (En Equipo):**\n${mission.weDoSection.guidedPractice}\n`);
    }

    if (mission.youDoSection?.autonomousChallenge) {
      parts.push(`**4. Reto Autónomo (Individual):**\n${mission.youDoSection.autonomousChallenge}\n`);
    }

    if (mission.troubleshooting && mission.troubleshooting.length > 0) {
      parts.push('**5. Guía de Solución de Errores Comunes:**');
      for (const t of mission.troubleshooting) {
        parts.push(`- **Síntoma:** ${t.symptom}`);
        parts.push(`  - *Causa:* ${t.rootCause || t.cause || ''}`);
        parts.push(`  - *Solución:* ${Array.isArray(t.solutionSteps) ? t.solutionSteps.join('; ') : t.solution || ''}`);
      }
      parts.push('');
    }

    parts.push('---\n');
  }

  // Proyecto Integrador de Bloque
  if (workbook.projectSection) {
    const p = workbook.projectSection;
    parts.push(`## PROYECTO INTEGRADOR: ${p.artifactName.toUpperCase()}`);
    parts.push(`**Utilidad Comunitaria:** ${p.communityUtility}\n`);

    if (p.learningObjectives && p.learningObjectives.length > 0) {
      parts.push('### Objetivos Formativos:');
      for (const obj of p.learningObjectives) {
        parts.push(`- ${obj}`);
      }
      parts.push('');
    }

    if (p.requiredMaterials && p.requiredMaterials.length > 0) {
      parts.push('### Materiales e Insumos:');
      for (const mat of p.requiredMaterials) {
        parts.push(`- [ ] ${mat}`);
      }
      parts.push('');
    }

    if (p.executionSteps && p.executionSteps.length > 0) {
      parts.push('### Secuencia de Construcción:');
      for (const step of p.executionSteps) {
        parts.push(`- ${step}`);
      }
      parts.push('');
    }

    if (p.phases && p.phases.length > 0) {
      parts.push('### Fases de Ejecución:');
      for (const ph of p.phases) {
        parts.push(`- **Fase ${ph.phaseNum}: ${ph.title}** (${ph.allocatedHours} hrs): ${ph.instructions}`);
      }
      parts.push('');
    }

    if (p.deliveryCriteria && p.deliveryCriteria.length > 0) {
      parts.push('### Criterios de Entrega:');
      for (const crit of p.deliveryCriteria) {
        parts.push(`- ${crit}`);
      }
      parts.push('');
    }
  }

  // Evaluación Escalonada por Niveles
  if (workbook.evaluationSection?.tieredExercises && workbook.evaluationSection.tieredExercises.length > 0) {
    parts.push('## EVALUACIÓN FORMATIVA ESCALONADA POR NIVELES\n');
    for (const tier of workbook.evaluationSection.tieredExercises) {
      parts.push(`### ${tier.levelName.toUpperCase()}`);
      if (tier.description) parts.push(`*${tier.description}*\n`);
      for (const ex of tier.exercises) {
        parts.push(`**Ejercicio ${ex.number}:** ${ex.statement}`);
        if (ex.contextOrData) parts.push(`- *Datos/Contexto:* ${ex.contextOrData}`);
        if (ex.hint) parts.push(`- *Pista:* ${ex.hint}`);
        parts.push(`- *Criterio esperado:* ${ex.expectedOutputOrCriteria}\n`);
      }
    }
  }

  return parts.join('\n');
}

function buildSolucionarioDocenteMarkdown(workbook: ActiveWorkTextbook): string {
  const parts: string[] = [];
  const cover = (workbook.coverData || {}) as Record<string, unknown>;
  const subjectName = (cover.subjectName as string) || '';
  const blockNum = (workbook.blockIndex ?? 0) + 1;
  const isStem = isStemSubject(subjectName);
  const isHumanities = isHumanitiesSubject(subjectName);

  parts.push(`# SOLUCIONARIO Y GUÍA DE MEDIACIÓN PEDAGÓGICA (USO EXCLUSIVO DOCENTE) · BLOQUE ${blockNum}`);
  parts.push(`**Asignatura / UAC:** ${subjectName} (${isStem ? 'Área STEM / Ciencias Exactas' : isHumanities ? 'Área Humanidades / Ciencias Sociales' : 'Formación Fundamental'})`);
  parts.push(`**Plantel:** ${(cover.schoolName as string) || ''} | **Semestre:** ${(cover.semester as number | string) || 1}°`);
  if (cover.paecProjectName) parts.push(`**Proyecto Comunitario (PAEC):** ${cover.paecProjectName}`);
  parts.push('\n> **DOCUMENTO CONFIDENCIAL DE USO EXCLUSIVO PARA EL DOCENTE**');
  parts.push('> Contiene resoluciones modelo, claves de respuesta esperadas, criterios de mediación dialéctica y pautas de retroalimentación formativa para la conducción de las 24 sesiones de clase.\n');
  parts.push('---\n');

  parts.push('## 1. RESOLUCIÓN DETALLADA Y GUÍA DE MEDIACIÓN POR MISIÓN\n');

  for (const mission of workbook.missions || []) {
    const sStart = mission.coveredSessions?.[0] ?? (mission.missionIndex * 3 - 2);
    const sEnd = mission.coveredSessions?.[mission.coveredSessions.length - 1] ?? (mission.missionIndex * 3);
    parts.push(`### MISIÓN ${mission.missionIndex}: ${mission.title.toUpperCase()} (Sesiones ${sStart} a ${sEnd})`);
    parts.push(`*Foco instruccional:* ${mission.sessionTopic || mission.title} — ${mission.sessionFocus || 'Desarrollo de competencias situadas'}\n`);

    // A. Activación y preguntas detonadoras
    if (mission.phenomenonHook?.detonatingQuestion) {
      parts.push(`#### A. Mediación de Saberes Previos (Apertura)`);
      parts.push(`- **Pregunta Detonadora:** "${mission.phenomenonHook.detonatingQuestion}"`);
      parts.push(`- **Respuesta / Reflexión Esperada:** El estudiantado debe identificar la problemática real vinculada a su contexto. El docente debe validar hipótesis intuitivas y orientar hacia el concepto clave (${mission.conceptZero?.physicalAnalogy || 'conexión intuitiva'}) sin descalificar respuestas iniciales.`);
      parts.push('');
    }

    // B. Ejemplos resueltos y modelado
    if (mission.conceptZero?.solvedExample) {
      const ex = mission.conceptZero.solvedExample;
      parts.push(`#### B. Clave de Resolución del Ejemplo Modelo (Yo Hago)`);
      parts.push(`- **Planteamiento del Problema:** ${ex.problemStatement}`);
      parts.push(`- **Procedimiento Paso a Paso:**`);
      for (let sIdx = 0; sIdx < ex.solutionSteps.length; sIdx++) {
        parts.push(`  ${sIdx + 1}. ${ex.solutionSteps[sIdx]}`);
      }
      parts.push(`- **Interpretación / Resultado Oficial:** ${ex.interpretation}`);
      parts.push('');
    } else if (mission.iDoSection?.stepByStepDemo) {
      parts.push(`#### B. Pauta de Demostración Docente (Yo Hago)`);
      parts.push(`- **Procedimiento Demostrativo Guiado:** ${mission.iDoSection.stepByStepDemo}`);
      parts.push('');
    }

    // C. Práctica guiada y reto autónomo (STEM vs Humanidades)
    parts.push(`#### C. Criterios de Acreditación y Solución del Reto ("Hacemos" y "Tú Haces")`);
    if (mission.weDoSection?.guidedPractice) {
      parts.push(`- **Práctica Guiada (En Equipo):** ${mission.weDoSection.guidedPractice}`);
    }
    if (mission.youDoSection?.autonomousChallenge) {
      parts.push(`- **Reto Autónomo (Individual):** ${mission.youDoSection.autonomousChallenge}`);
      if (isStem) {
        parts.push(`- **Pauta de Resolución STEM:** Verificar el planteamiento de datos o variables, la aplicación estricta del algoritmo o modelo matemático, el manejo de unidades dimensionales o sintaxis técnica, y la exactitud del resultado final.`);
      } else {
        parts.push(`- **Pauta de Evaluación Argumentativa / Humanística:** Evaluar la postura crítica del estudiante, la solidez de sus premisas dialécticas, la contextualización comunitaria y la coherencia discursiva según los descriptores del MCCEMS.`);
      }
    }
    parts.push('');

    // D. Matriz de Prevención de Errores
    if (mission.conceptZero?.contrastTable && mission.conceptZero.contrastTable.length > 0) {
      parts.push(`#### D. Tabla de Contraste y Corrección de Errores Comunes`);
      parts.push('| Concepto Riguroso | Idea Errónea Frecuente | Intervención Docente Sugerida |');
      parts.push('|---|---|---|');
      for (const ct of mission.conceptZero.contrastTable) {
        parts.push(`| ${ct.correctConcept.replace(/\|/g, '/')} | ${ct.commonMisconception.replace(/\|/g, '/')} | ${ct.reasoning.replace(/\|/g, '/')} |`);
      }
      parts.push('');
    } else if (mission.troubleshooting && mission.troubleshooting.length > 0) {
      parts.push(`#### D. Guía de Intervención ante Errores Operativos (Troubleshooting)`);
      for (const t of mission.troubleshooting) {
        parts.push(`- **Síntoma Detectado:** ${t.symptom}`);
        parts.push(`  - *Causa Raíz:* ${t.rootCause || t.cause || 'Desajuste procedimental'}`);
        parts.push(`  - *Solución Recomendada:* ${Array.isArray(t.solutionSteps) ? t.solutionSteps.join('; ') : t.solution || 'Revisar modelado paso a paso'}`);
      }
      parts.push('');
    }

    // E. Checkpoint formativo de salida
    if (mission.formativeCheckpoint) {
      const fc = mission.formativeCheckpoint;
      parts.push(`#### E. Checkpoint Formativo y Metacognición (Cierre)`);
      parts.push(`- **Pregunta de Verificación Rápida:** "${fc.question}"`);
      if (fc.criteriaChecklist && fc.criteriaChecklist.length > 0) {
        parts.push(`- **Criterios de Aprobación Inmediata:**`);
        for (const c of fc.criteriaChecklist) {
          parts.push(`  - [x] ${c}`);
        }
      }
      if (fc.reflectionPrompts && fc.reflectionPrompts.length > 0) {
        parts.push(`- **Guía de Reflexión Metacognitiva:** Guiar al estudiante con las siguientes interrogantes: ${fc.reflectionPrompts.join('; ')}.`);
      }
      parts.push('');
    }

    parts.push('---\n');
  }

  // 2. Evaluación Escalonada por Niveles
  if (workbook.evaluationSection?.tieredExercises && workbook.evaluationSection.tieredExercises.length > 0) {
    parts.push('## 2. SOLUCIONARIO DE LA EVALUACIÓN ESCALONADA POR NIVELES\n');
    for (const tier of workbook.evaluationSection.tieredExercises) {
      parts.push(`### ${tier.levelName.toUpperCase()}`);
      if (tier.description) parts.push(`*${tier.description}*\n`);
      for (const ex of tier.exercises) {
        parts.push(`**Ejercicio ${ex.number}:** ${ex.statement}`);
        if (ex.contextOrData) parts.push(`- *Datos/Variables:* ${ex.contextOrData}`);
        if (ex.hint) parts.push(`- *Pista Didáctica:* ${ex.hint}`);
        parts.push(`- **Solución y Criterio Esperado:** ${ex.expectedOutputOrCriteria}\n`);
      }
    }
    parts.push('---\n');
  }

  // 3. Reactivos de Pensamiento Crítico / Quiz
  const quizItems = workbook.evaluationSection?.criticalThinkingQuiz || [];
  if (quizItems.length > 0) {
    parts.push('## 3. BANCO DE REACTIVOS TIPO EXANI/PLANEA CON JUSTIFICACIÓN DOCENTE\n');
    for (const q of quizItems) {
      parts.push(`**Reactivo ${q.questionNumber}:** ${q.question}`);
      if (q.scenario) parts.push(`*Contexto:* ${q.scenario}`);
      if (q.options && q.options.length > 0) {
        parts.push('**Opciones:**');
        for (const opt of q.options) {
          parts.push(`- ${opt}`);
        }
      }
      parts.push(`**Clave y Justificación Pedagógica:**\n${q.answerExplanation}\n`);
    }
    parts.push('---\n');
  }

  // 4. Proyecto Integrador de Bloque
  if (workbook.projectSection) {
    const p = workbook.projectSection;
    parts.push(`## 4. PAUTA DE EVALUACIÓN DEL PROYECTO INTEGRADOR: ${p.artifactName.toUpperCase()}`);
    parts.push(`**Finalidad Comunitaria:** ${p.communityUtility}\n`);
    if (p.deliveryCriteria && p.deliveryCriteria.length > 0) {
      parts.push('### Criterios de Acreditación y Validación:');
      for (const crit of p.deliveryCriteria) {
        parts.push(`- [x] ${crit}`);
      }
      parts.push('');
    }
    if (p.phases && p.phases.length > 0) {
      parts.push('### Ponderación por Fases de Ejecución:');
      for (const ph of p.phases) {
        parts.push(`- **Fase ${ph.phaseNum}: ${ph.title}** (${ph.allocatedHours} hrs): Supervisar: "${ph.instructions}"`);
      }
      parts.push('');
    }
  }

  parts.push('*SIGPDA-EMS · Solucionario y Guía Pedagógica Oficial del Docente (MCCEMS 2026-2027)*\n');
  return parts.join('\n');
}

function buildRubricaEvaluacionMarkdown(workbook: ActiveWorkTextbook): string {
  const parts: string[] = [];
  const evalSec = workbook.evaluationSection;
  const blockNum = (workbook.blockIndex ?? 0) + 1;

  parts.push(`# RÚBRICA ANALÍTICA DE EVALUACIÓN · BLOQUE ${blockNum}`);
  parts.push(`**Asignatura:** ${workbook.coverData?.subjectName || ''} | **Plantel:** ${workbook.coverData?.schoolName || ''}\n`);

  if (evalSec?.rubric && evalSec.rubric.length > 0) {
    parts.push('## RÚBRICA ANALÍTICA DE DESEMPEÑO (4 NIVELES NEM)\n');

    // Nombres estándar de niveles con sus puntos en los encabezados de columna
    const standardLevels = [
      { name: 'Sobresaliente / Excelente', defaultPts: 10 },
      { name: 'Notable / Bueno', defaultPts: 8 },
      { name: 'Suficiente / Básico', defaultPts: 6 },
      { name: 'Insuficiente / Requiere Apoyo', defaultPts: 4 },
    ];

    const firstLevels = evalSec.rubric[0]?.levels || [];
    const levelHeaders = standardLevels.map((std, idx) => {
      const pts = firstLevels[idx]?.points ?? std.defaultPts;
      return `${std.name} (${pts} pts)`;
    });

    const headerRow = `| Criterio de Evaluación y Ponderación | ${levelHeaders.join(' | ')} |`;
    const separatorRow = `|---|---|---|---|---|`;
    parts.push(headerRow);
    parts.push(separatorRow);

    for (const crit of evalSec.rubric) {
      const critCell = `**${crit.criterion.replace(/\|/g, '/')}** (${crit.weightPercent}%)`;
      const levelCells = (crit.levels || []).map((lvl) => {
        // Limpiar saltos de línea y pipes para mantener la integridad de la fila Markdown
        const cleanDesc = (lvl.descriptor || '')
          .replace(/[\r\n]+/g, ' ')
          .replace(/\|/g, '/')
          .trim();
        return cleanDesc || '—';
      });

      // Asegurar 4 columnas de descriptores
      while (levelCells.length < 4) levelCells.push('—');
      parts.push(`| ${critCell} | ${levelCells.join(' | ')} |`);
    }
    parts.push('\n');
  }

  return parts.join('\n');
}

function buildListaCotejoMarkdown(workbook: ActiveWorkTextbook): string {
  const parts: string[] = [];
  const evalSec = workbook.evaluationSection;
  const blockNum = (workbook.blockIndex ?? 0) + 1;

  parts.push(`# LISTA DE COTEJO DE PRODUCTO Y DESEMPEÑO · BLOQUE ${blockNum}`);
  parts.push(`**Asignatura:** ${workbook.coverData?.subjectName || ''} | **Plantel:** ${workbook.coverData?.schoolName || ''}\n`);

  if (evalSec?.checklist && evalSec.checklist.length > 0) {
    parts.push('## LISTA DE COTEJO FORMATIVA DE VERIFICACIÓN\n');
    parts.push('| Categoría | Indicador / Criterio de Verificación | Cumple (Sí/No) | Observaciones |');
    parts.push('|---|---|---|---|');
    for (const item of evalSec.checklist) {
      parts.push(`| ${item.category} | ${item.item} | [ ] Sí  [ ] No | |`);
    }
    parts.push('\n');
  }

  return parts.join('\n');
}

function buildInstrumentosEvaluacionMarkdown(workbook: ActiveWorkTextbook): string {
  const parts: string[] = [];
  const evalSec = workbook.evaluationSection;
  const blockNum = (workbook.blockIndex ?? 0) + 1;

  parts.push(`# INSTRUMENTOS DE EVALUACIÓN OFICIALES · BLOQUE ${blockNum}`);
  parts.push(`**Asignatura:** ${workbook.coverData?.subjectName || ''} | **Plantel:** ${workbook.coverData?.schoolName || ''}\n`);

  // 1. Rúbricas Analíticas Unificadas
  if (evalSec?.rubric && evalSec.rubric.length > 0) {
    parts.push('## 1. RÚBRICA ANALÍTICA DE DESEMPEÑO (4 NIVELES NEM)\n');
    const standardLevels = [
      { name: 'Sobresaliente / Excelente', defaultPts: 10 },
      { name: 'Notable / Bueno', defaultPts: 8 },
      { name: 'Suficiente / Básico', defaultPts: 6 },
      { name: 'Insuficiente / Requiere Apoyo', defaultPts: 4 },
    ];
    const firstLevels = evalSec.rubric[0]?.levels || [];
    const levelHeaders = standardLevels.map((std, idx) => {
      const pts = firstLevels[idx]?.points ?? std.defaultPts;
      return `${std.name} (${pts} pts)`;
    });

    parts.push(`| Criterio de Evaluación y Ponderación | ${levelHeaders.join(' | ')} |`);
    parts.push('|---|---|---|---|---|');
    for (const crit of evalSec.rubric) {
      const critCell = `**${crit.criterion.replace(/\|/g, '/')}** (${crit.weightPercent}%)`;
      const levelCells = (crit.levels || []).map((lvl) => {
        const cleanDesc = (lvl.descriptor || '')
          .replace(/[\r\n]+/g, ' ')
          .replace(/\|/g, '/')
          .trim();
        return cleanDesc || '—';
      });
      while (levelCells.length < 4) levelCells.push('—');
      parts.push(`| ${critCell} | ${levelCells.join(' | ')} |`);
    }
    parts.push('\n');
  }

  // 2. Listas de Cotejo
  if (evalSec?.checklist && evalSec.checklist.length > 0) {
    parts.push('## 2. LISTA DE COTEJO DE PRODUCTO Y DESEMPEÑO\n');
    parts.push('| Categoría | Indicador / Criterio de Verificación | Cumple (Sí/No) | Observaciones |');
    parts.push('|---|---|---|---|');
    for (const item of evalSec.checklist) {
      parts.push(`| ${item.category} | ${item.item} | [ ] Sí  [ ] No | |`);
    }
    parts.push('\n');
  }

  return parts.join('\n');
}

function buildMaterialDidacticoMarkdown(
  workbook: ActiveWorkTextbook,
  planes: PlanDeClaseDerivado[]
): string {
  const parts: string[] = [];
  parts.push(`# REQUERIMIENTOS DE MATERIAL DIDÁCTICO E INSUMOS`);
  parts.push(`**Bloque ${workbook.blockIndex ?? 1}** · ${workbook.coverData?.subjectName || ''}\n`);

  parts.push('## INVENTARIO DE MATERIALES Y CONSUMIBLES POR SESIÓN\n');
  parts.push('| Sesión | Misión / Práctica | Materiales e Insumos Didácticos | Espacio Requerido |');
  parts.push('|---|---|---|---|');

  for (const plan of planes) {
    const isLab = plan.desarrollo.actividadEstudiante.toLowerCase().includes('laboratorio') ||
                  plan.desarrollo.actividadEstudiante.toLowerCase().includes('taller') ||
                  plan.tituloSesion.toLowerCase().includes('práctica');
    const espacio = isLab ? 'Laboratorio / Taller Especializado' : 'Aula de Clases';

    parts.push(`| Sesión ${plan.numeroSesion} | ${plan.tituloSesion} | ${plan.desarrollo.recursosDidacticos} | ${espacio} |`);
  }

  return parts.join('\n');
}

/**
 * Extrae un paquete de material específico bajo demanda.
 */
export function extractSpecificMaterial(
  workbook: ActiveWorkTextbook,
  type: 'guia' | 'solucionario' | 'instrumentos' | 'materiales'
): string {
  const extracted = extractMaterialsFromWorkbook(workbook);
  switch (type) {
    case 'guia':
      return extracted.guiaDelBloque;
    case 'solucionario':
      return extracted.solucionarioDocente;
    case 'instrumentos':
      return extracted.instrumentosEvaluacion;
    case 'materiales':
      return extracted.materialDidactico;
    default:
      return extracted.guiaDelBloque;
  }
}

