import type { ExtractedPdfData, TeacherContext } from '@/types/planning';
import type { ProgramCatalogItem } from '@/lib/db';
import type { RagContext } from '@/lib/rag-curricular';
import { buildRagContextBlock } from '@/lib/rag-curricular';
import { CATALOGO_METODOLOGIAS_ACTIVAS } from '@/lib/catalogo-metodologias';

export interface AuditFeedbackContext {
  overall_score: number;
  compliance_level: string;
  findings?: {
    cobertura_horas?: string;
    desalineaciones?: string[];
    omisiones_detectadas?: string[];
  } | null;
  recommendations?: {
    pedagogicas?: string[];
    didacticas?: string[];
    normativas?: string[];
  } | null;
}

export interface FfeContinuityContext {
  semester_5_uac?: string;
  semester_6_uac?: string;
  area?: string;
}

export function buildUserPrompt(
  extractedData: ExtractedPdfData,
  context: TeacherContext,
  semester: number,
  component: string,
  officialProgram?: ProgramCatalogItem | null,
  auditFeedback?: AuditFeedbackContext | null,
  continuityInfo?: FfeContinuityContext | null,
  ragContext?: RagContext | null
): string {
  // ── Hour distribution math ─────────────────────────────────────────────────
  // The semester has 3 evaluation periods (cortes), each with 6 weeks.
  // Weekly load = totalHours / 18  (rounded to nearest integer)
  // Hours per corte = weeklyLoad × 6
  // Expected values:
  //   3 h/week → 18 h/corte (54 h total)
  //   4 h/week → 24 h/corte (72 h total)
  const totalHours = officialProgram?.total_hours || extractedData.totalHours || 54;
  const weeklyLoad = Math.max(1, Math.round(totalHours / 18));
  const hoursPerCorte = weeklyLoad * 6;
  const hoursPerCorteVerified = Math.round(totalHours / 3);
  const hpc = Number.isInteger(totalHours / 3) ? hoursPerCorteVerified : hoursPerCorte;

  const isLaboral = component === 'laboral';
  const isTransitionSemester = semester >= 5; // 5to y 6to semestre aún usan progresiones en 2026-2027

  // ── Prepare Activities & Official Content ───────────────────────────────────
  let activitiesList: { name: string; hours: number; topics?: string[]; purpose?: string }[] = [];

  if (isLaboral) {
    // Formación Laboral: Estrictamente 3 Actividades Clave (18h c/u = 54h totales)
    if (officialProgram?.activities && Array.isArray(officialProgram.activities) && officialProgram.activities.length === 3) {
      activitiesList = officialProgram.activities.map((a: any, idx: number) => ({
        name: a.name || `Actividad Clave ${idx + 1}`,
        hours: a.hours || 18,
      }));
    } else if (extractedData.activities && extractedData.activities.length === 3) {
      activitiesList = extractedData.activities.map((a, idx) => ({
        name: a.name || `Actividad Clave ${idx + 1}`,
        hours: a.hours || 18,
      }));
    } else {
      // Fallback a 3 Actividades Clave canónicas si vienen 4 o datos erróneos
      activitiesList = [
        { name: `Actividad Clave 1: Diagnóstico, fundamentación y preparación técnica de ${extractedData.uacName}`, hours: 18 },
        { name: `Actividad Clave 2: Ejecución, procesamiento y desarrollo operativo de ${extractedData.uacName}`, hours: 18 },
        { name: `Actividad Clave 3: Simulación profesional, control de calidad y entrega de evidencias técnicas`, hours: 18 },
      ];
    }
  } else {
    // Componentes Fundamentales, Ampliados o FFE (Propósitos o Progresiones)
    const sourceActivities = (officialProgram?.activities && Array.isArray(officialProgram.activities) && officialProgram.activities.length > 0)
      ? officialProgram.activities
      : extractedData.activities;

    activitiesList = sourceActivities.map((a: any, idx: number) => ({
      name: a.name || `${isTransitionSemester ? 'Progresión' : 'Propósito Formativo'} ${idx + 1}`,
      hours: a.hours || Math.round(totalHours / Math.max(1, sourceActivities.length)),
    }));
  }

  // Asociar contenidos formativos oficiales enriquecidos si existen
  const contenidosSource = officialProgram?.contenidos_formativos || extractedData.contenidosFormativos;
  if (contenidosSource && Array.isArray(contenidosSource)) {
    activitiesList.forEach((act, i) => {
      // Intentar coincidir por nombre o índice
      const match = contenidosSource.find((cf: any) => 
        cf.proposito === act.name || 
        cf.actividad_clave === act.name ||
        (cf.proposito && cf.proposito.substring(0, 45) === act.name.substring(0, 45))
      ) || contenidosSource[i];

      if (match) {
        if (Array.isArray(match.contenidos) && match.contenidos.length > 0) {
          act.topics = match.contenidos;
        } else if (Array.isArray(match.temas) && match.temas.length > 0) {
          act.topics = match.temas;
        }
      }
    });
  }

  const activitiesText = activitiesList
    .map((a, i) => {
      let text = `  ${i + 1}. ${a.name} (${a.hours} horas) [Asignado al Corte ${Math.min(3, i + 1)}]`;
      if (a.topics && a.topics.length > 0) {
        text += `\n     [Contenidos Temáticos Oficiales obligatorios para esta unidad]:\n` + 
                a.topics.map(t => `       • ${t}`).join('\n');
      }
      return text;
    })
    .join('\n\n');

  // ── Evidencias oficiales o inferidas ─────────────────────────────────────────
  const evidencesSource = (officialProgram?.evidences && Array.isArray(officialProgram.evidences) && officialProgram.evidences.length > 0)
    ? officialProgram.evidences
    : extractedData.evidences;

  const evidencesText = evidencesSource && evidencesSource.length > 0
    ? evidencesSource.map(e => `  - ${e}`).join('\n')
    : '  - Evidencia de producto técnico\n  - Reporte de desempeño de simulación\n  - Instrumento de evaluación formativa';

  // ── Subsistema y Componente Labels ──────────────────────────────────────────
  const subsystemLabels: Record<string, string> = {
    bge: 'Bachillerato General Estatal (BGE)',
    digital: 'Bachillerato Digital',
    emsad: 'EMSAD',
    cecyte: 'CECyTE',
    cbtis: 'CBTIS',
    cbta: 'CBTA',
    conalep: 'CONALEP',
    dgb: 'Preparatoria Federal / DGB',
    telebachillerato: 'Telebachillerato',
  };

  const componentLabels: Record<string, string> = {
    laboral: 'Formación Laboral (3 Actividades Clave)',
    fundamental: 'Currículum Fundamental',
    ampliado: 'Currículum Ampliado',
    ext_optativo: 'Formación Fundamental Extendida (Optativa)',
    ext_obligatorio: 'Formación Fundamental Extendida (Obligatoria)',
  };

  const location = [context.municipality, context.state].filter(Boolean).join(', ');
  const subsystemKey = (officialProgram?.subsystem || context.subsystem || 'bge').toLowerCase();
  const subsystemLabel = subsystemLabels[subsystemKey] || context.subsystem;

  const learningOutcome = officialProgram?.learning_outcome || extractedData.learningOutcome || 
    `Desarrollar competencias integrales y saberes formativos en ${extractedData.uacName} aplicados al contexto comunitario de los estudiantes.`;

  // ── Continuidad FFE ─────────────────────────────────────────────────────────
  let ffeContinuityBlock = '';
  if (continuityInfo) {
    ffeContinuityBlock = `\n═══════════ TRAYECTORIA Y CONTINUIDAD FFE (OFICIAL SEP) ═══════════
• Asignatura de 5.° Semestre: ${continuityInfo.semester_5_uac || 'N/A'}
• Asignatura de 6.° Semestre (Continuación directa): ${continuityInfo.semester_6_uac || 'N/A'}
• Campo de Formación: ${continuityInfo.area || 'Formación Fundamental Extendida'}
*IMPORTANTE*: La planeación debe articularse de forma progresiva respetando los saberes previos o la proyección de esta secuencia curricular oficial.
`;
  }

  // ── Auditoría Previa Feedback ───────────────────────────────────────────────
  let auditRemediationBlock = '';
  if (auditFeedback) {
    const findingsList: string[] = [];
    if (auditFeedback.findings?.desalineaciones?.length) {
      findingsList.push(...auditFeedback.findings.desalineaciones.map(d => `  ⚠️ Desalineación detectada: ${d}`));
    }
    if (auditFeedback.findings?.omisiones_detectadas?.length) {
      findingsList.push(...auditFeedback.findings.omisiones_detectadas.map(o => `  ⚠️ Omisión en versión previa: ${o}`));
    }

    const recsList: string[] = [];
    if (auditFeedback.recommendations?.pedagogicas?.length) {
      recsList.push(...auditFeedback.recommendations.pedagogicas.map(r => `  ✅ Pedagógica: ${r}`));
    }
    if (auditFeedback.recommendations?.didacticas?.length) {
      recsList.push(...auditFeedback.recommendations.didacticas.map(r => `  ✅ Didáctica: ${r}`));
    }
    if (auditFeedback.recommendations?.normativas?.length) {
      recsList.push(...auditFeedback.recommendations.normativas.map(r => `  ✅ Normativa: ${r}`));
    }

    auditRemediationBlock = `\n═══════════ RETROALIMENTACIÓN DE AUDITORÍA PEDAGÓGICA PREVIA ═══════════
⚠️ ESTA PLANEACIÓN FUE AUDITADA PREVIAMENTE CON UNA CALIFICACIÓN DE ${auditFeedback.overall_score}/100 (${auditFeedback.compliance_level.toUpperCase()}).
Para alcanzar una calificación de EXCELENCIA (100/100), el motor de IA DEBE CORREGIR obligatoriamente las siguientes observaciones:

OBSERVACIONES CRÍTICAS A SUBSANAR:
${findingsList.length > 0 ? findingsList.join('\n') : '  - Mejorar la vinculación situacional y el desglose de evidencias evaluativas.'}

ACCIONES CORRECTIVAS EXIGIDAS:
${recsList.length > 0 ? recsList.join('\n') : '  - Integrar metodologías activas y asegurar la exactitud horaria en cada corte de evaluación.'}
`;
  }

  // ── RAG Context Block ───────────────────────────────────────────────────────
  const ragBlock = ragContext ? buildRagContextBlock(ragContext) : '';

  // ── Bloque de Metodología Activa ─────────────────────────────────────────
  // Se inyecta solo si el docente seleccionó una metodología en el wizard.
  // Si no hay selección, el bloque se omite y la planeación usa el default del system prompt.
  let metodologiaBlock = '';
  if (context.metodologiaActiva) {
    const met = CATALOGO_METODOLOGIAS_ACTIVAS.find(m => m.id === context.metodologiaActiva);
    if (met) {
      const fasesText = met.fases
        .map((f, i) => `  ${i + 1}. ${f}`)
        .join('\n');
      metodologiaBlock = `
═══════════ METODOLOGÍA ACTIVA SELECCIONADA POR EL DOCENTE ═══════════
Metodología: ${met.nombre}
Definición: ${met.definicion}
Tipo de evidencia esperada: ${met.tipoEvidenciaSugerida}

El estudiante DEBE vivir estas fases EN ORDEN durante la secuencia didáctica:
${fasesText}

OBLIGATORIO: Cada Actividad Clave o Propósito Formativo en la Sección IV debe
estructurarse usando estas fases. Queda PROHIBIDO saltar fases, fusionarlas
o convertirlas en explicación expositiva pasiva.
`;
    }
  }

  // ── Prompt Completo ────────────────────────────────────────────────────────
  return `Genera una Planeación Didáctica completa y de nivel EXCELENCIA en formato oficial DBEPA 2026-2027 para:
${ragBlock}
═══════════ DATOS DE LA UAC (PROGRAMA OFICIAL AUTÉNTICO) ═══════════
UAC: ${extractedData.uacName}
Semestre: ${semester}° Semestre
Componente Curricular: ${componentLabels[component] || component}
Carga Horaria Semestral TOTAL: ${totalHours} horas oficiales
Carga Horaria Semanal: ${weeklyLoad} horas por semana
Modelo Pedagógico Vigente: ${isLaboral ? '3 Actividades Clave (Formación Laboral)' : isTransitionSemester ? 'Progresiones de Aprendizaje (5° y 6° Semestre)' : 'Propósitos Formativos y Contenidos Temáticos (1° a 4° Semestre)'}

Resultado de Aprendizaje / Propósito General Oficial:
${learningOutcome}

${isLaboral ? 'ACTIVIDADES CLAVE OFICIALES DEL PROGRAMA (EXACTAMENTE 3, 18 HORAS CADA UNA):' : isTransitionSemester ? 'PROGRESIONES DE APRENDIZAJE OFICIALES DEL PROGRAMA:' : 'PROPÓSITOS FORMATIVOS Y CONTENIDOS TEMÁTICOS OFICIALES:'}
${activitiesText}

Evidencias e Instrumentos Sugeridos por el Programa Oficial:
${evidencesText}
${ffeContinuityBlock}${auditRemediationBlock}
═══════════ DISTRIBUCIÓN HORARIA OBLIGATORIA POR CORTE ═══════════
REGLA MATEMÁTICA ESTRICTA — NO MODIFICAR:
  • El semestre se divide en 3 Cortes de evaluación (Corte 1, Corte 2, Corte 3).
  • Cada Corte tiene exactamente 6 semanas lectivas.
  • Carga semanal de esta UAC: ${weeklyLoad} horas/semana.
  • HORAS POR CORTE: ${weeklyLoad} h/semana × 6 semanas = ${hpc} horas exactas por Corte.
  • TOTAL: ${hpc} h × 3 Cortes = ${hpc * 3} horas (debe cuadrar exactamente con la carga total de ${totalHours} h).

DOSIFICACIÓN OBLIGATORIA:
  - La suma de horas de las actividades asignadas al Corte 1 debe ser EXACTAMENTE ${hpc} horas.
  - La suma de horas de las actividades asignadas al Corte 2 debe ser EXACTAMENTE ${hpc} horas.
  - La suma de horas de las actividades asignadas al Corte 3 debe ser EXACTAMENTE ${hpc} horas.
  - Si es Formación Laboral: Asigna la Actividad Clave 1 al Corte 1 (18h), la Actividad Clave 2 al Corte 2 (18h) y la Actividad Clave 3 al Corte 3 (18h).
  - En la Sección IV, la suma de horas de las secuencias de cada Corte debe sumar exactamente ${hpc} horas.

═══════════ DATOS DEL DOCENTE Y PLANTEL ═══════════
Docente: ${context.teacherName}
Plantel: ${context.schoolName}
Municipio / Estado: ${location}
${context.region ? `Región: ${context.region}` : ''}
Subsistema: ${subsystemLabel}
Grupos: ${context.groupInfo || 'Grupo A'}
Período de aplicación: ${context.applicationPeriod || 'Ciclo escolar 2026-2027'}
Recursos disponibles: ${context.schoolResources || 'Recursos básicos de aula y tecnología accesible'}

═══════════ PROYECTO PAEC/PEC (VINCULACIÓN COMUNITARIA OBLIGATORIA) ═══════════
Nombre del proyecto PAEC: ${context.paecProjectName || 'Transformación e Innovación Comunitaria'}
Objetivo del PAEC: ${context.paecObjective || 'Resolver problemáticas reales del contexto mediante el aprendizaje situado.'}

Problemática Comunitaria Central detectada en el PAEC:
${context.paecProblem}

Caracterización y Perfil de los Estudiantes:
${context.studentContext || 'Estudiantes de bachillerato con interés en proyectos prácticos y resolución de problemas comunitarios.'}

${metodologiaBlock}
═══════════ EJEMPLO DE REFERENCIA — SECCIÓN IV DE NIVEL EXCELENCIA (FEW-SHOT) ═══════════
El siguiente es UN EJEMPLO de la calidad y estructura requerida para la Sección IV.
Adapta el contenido a la UAC, semestre y contexto PAEC indicados arriba. NO copies este ejemplo.

SECUENCIA DIDÁCTICA EJEMPLO (Propósito Formativo: Analizar circuitos eléctricos en C.A. | 18h | Corte 1):

  APERTURA (3h):
  - Actividad motivadora (1h): El docente presenta el caso real: "Apagones en la colonia Loma Bella de Tehuacán — ¿por qué ocurren?". Estudiantes en equipos discuten causas posibles y registran hipótesis en una tabla de anticipación.
  - Exploración de saberes previos (1h): Cuestionario diagnóstico de 8 preguntas sobre corriente, voltaje y resistencia. El docente identifica concepciones erróneas comunes.
  - Planteamiento de la situación problema PAEC (1h): "¿Cómo diseñaríamos un circuito de iluminación de emergencia para el centro comunitario de nuestra localidad?". Equipos establecen el reto a resolver durante el Corte 1.

  DESARROLLO (13h):
  - Construcción conceptual (3h): Miniclases de 20 min sobre Ley de Ohm, potencia y factor de potencia, intercaladas con ejercicios de aplicación inmediata (Taxonomía Bloom: Comprender → Aplicar).
  - Investigación guiada (3h): Equipos consultan hojas de datos técnicos de dispositivos eléctricos reales, calculan cargas de un circuito de 10 luminarias LED y verifican con multímetro en el laboratorio.
  - Fase ABR — Prototipado (4h): Cada equipo construye el circuito en tablero de madera: diagrama unifilar, conexión física, prueba de continuidad. Docente hace rondas de retroalimentación formativa con lista de cotejo de proceso.
  - Análisis de resultados (3h): Equipos comparan resultados experimentales con valores teóricos, identifican fuentes de error y proponen mejoras al diseño (vinculación con el proyecto PAEC).

  CIERRE (2h):
  - Socialización (1h): Presentación de 5 min por equipo: muestran el circuito funcional, explican decisiones de diseño y proponen cómo se aplicaría en el centro comunitario.
  - Reflexión metacognitiva (0.5h): Cada estudiante completa una ficha "¿Qué aprendí? — ¿Qué me costó trabajo? — ¿Cómo puedo mejorarlo?".
  - Evaluación formativa (0.5h): Rúbrica analítica (4 criterios: diseño, ejecución, medición, reporte). Ponderación Corte 1: Proceso 40%, Producto 40%, Actitudinal 20%.

TOTAL HORAS CORTE 1: 3h + 13h + 2h = 18 horas ✓ (Coincide con la distribución obligatoria)
═══════════ FIN DEL EJEMPLO ═══════════

═══════════ INSTRUCCIONES DE CALIDAD PEDAGÓGICA EXIGIDAS ═══════════
1. VINCULACIÓN SITUADA: Conecta explícitamente las secuencias de aprendizaje con la problemática del PAEC: "${context.paecProjectName || context.paecProblem.substring(0, 70)}".
2. METODOLOGÍAS ACTIVAS: ${context.metodologiaActiva ? `Aplica EXCLUSIVAMENTE la metodología ${CATALOGO_METODOLOGIAS_ACTIVAS.find(m => m.id === context.metodologiaActiva)?.nombre ?? context.metodologiaActiva} respetando sus fases en el orden indicado arriba.` : 'Aplica estrictamente metodologías activas (Aprendizaje Basado en Proyectos, Estudio de Casos, Simulación y Prácticas de Campo). Prohibidas clases expositivas pasivas.'}
3. SECCIÓN IV (DISEÑO DIDÁCTICO): Genera exactamente ${activitiesList.length} secuencias didácticas completas (Apertura, Desarrollo/Ejecución, Cierre/Conclusión).
   - Para asignaturas no laborales: Especifica obligatoriamente el "contenidoFormativo" oficial exacto desarrollado en la secuencia.
   - Para Formación Laboral: Exige que el Desarrollo alcance Nivel 2 de complejidad técnica y el Cierre sea una simulación práctica evaluable con lista de cotejo/rúbrica.
4. SECCIÓN V (EVALUACIÓN): Incluye el Acuerdo de Acreditación formal firmado y asegura que las ponderaciones sumen exactamente 100%.
5. SECCIÓN VI (MATERIALES): En "teacherMaterials" incluye ÚNICAMENTE materiales diseñados por el docente (guías, manuales, hojas de trabajo). NUNCA infraestructura física escolar (proyector, internet, pizarrones).
6. SECCIÓN I: Asigna el período de aplicación: ${context.applicationPeriod || 'Ciclo escolar 2026-2027'}.

Responde ÚNICAMENTE con el objeto JSON válido que cumpla la estructura exacta solicitada en el system prompt.`;
}
