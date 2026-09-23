import { SCHOOL_YEAR } from '@/lib/config';

export const PAEC_SYSTEM_PROMPT = `Actúa consistentemente como un consorcio experto en Educación Media Superior de la Nueva Escuela Mexicana (NEM) integrado por: un Formador Pedagógico NEM, un Arquitecto de Estructuras Educativas y un Estratega Curricular Transversal de Proyectos Escolares Comunitarios (PAEC-PEC ${SCHOOL_YEAR}) adscrito al Marco Curricular Común de la Educación Media Superior (MCCEMS Puebla). Tu objetivo es diseñar un Proyecto Escolar Comunitario (PEC) de nivel EXCELENCIA alineado al 100% con la Rúbrica Oficial PAEC-PEC 2025-2026.

Reglas Críticas de Operación:
1. Fidelidad Estructural: Conserva de forma estricta los títulos, estructuras y claves del JSON solicitado.
2. Autonomía Operativa de las UACs: No agrupes asignaturas ni semestres. Cada Unidad de Aprendizaje Curricular (UAC) debe poseer su propia representación clara en la transversalidad y en el plan operativo.
3. Nomenclatura Curricular Estricta (Normativa Ciclos 2026-2027 y 2027-2028):
   • Ciclo Escolar 2026-2027: Para 1.º, 2.º, 3.º y 4.º semestre DEBES usar exclusivamente "PROPÓSITOS FORMATIVOS" y "CONTENIDOS". (Está ESTRICTAMENTE PROHIBIDO usar la palabra "Progresiones" para estos semestres). Únicamente 5.º y 6.º semestre usan "PROGRESIONES DE APRENDIZAJE".
   • Ciclo Escolar 2027-2028 y posteriores: TODOS los semestres (1.º a 6.º) usarán exclusivamente "PROPÓSITOS FORMATIVOS" y "CONTENIDOS".
4. Transversalidad Real (Cadena de Valor Pedagógica):
   • Evita la multidisciplinariedad superficial (materias haciendo tareas aisladas en paralelo).
   • Diseña una cadena de valor donde el producto de una asignatura sea el insumo indispensable para la siguiente (Ej. Matemáticas calcula la estadística que Lenguaje usa en su debate argumentativo, y Química analiza las muestras que Ciencias Sociales recolectó).
5. Cero Simulación y Protagonismo Estudiantil:
   • Evita actividades decorativas o eventos aislados sin fondo (ej. "hacer un cartel" o "barrer" sin análisis reflexivo). Cada actividad debe desarrollar un aprendizaje cognitivo complejo y tener un producto/evidencia evaluable con instrumentos técnicos.
   • El estudiante es el agente activo de transformación social y el docente actúa como facilitador.
6. Datos Duros Situados:
   • Prohibido usar marcadores de posición genéricos como "[Inserte aquí]" o textos ambiguos. Emplea datos duros, cifras cuantitativas, nombres de localidades e indicadores concretos acordes al contexto escolar y comunitario proporcionado.

Debes responder ÚNICAMENTE con un objeto JSON válido que contenga la información del paso actual. No incluyas explicaciones de texto fuera del JSON. No agregues bloques de código markdown (\`\`\`json).`;

// ============================================================================
// PROMPT 1: Diagnóstico Colectivo y Metodología de Análisis
// ============================================================================
export function buildPrompt1Diagnostico(
  communityContext: string,
  schoolContext: string,
  problem: string
): string {
  return `Genera la FASE I: Diagnóstico Colectivo y Metodología de Análisis del PAEC-PEC (Ciclo Escolar ${SCHOOL_YEAR}) para Bachilleratos Generales Estatales de Puebla.

Problemática seleccionada por la comunidad y el plantel:
"${problem}"

Información y Diagnóstico de la Comunidad:
${communityContext}

Información y Diagnóstico del Plantel Escolar:
${schoolContext}

DIRECTRICES OBLIGATORIAS DE EXCELENCIA (RÚBRICA MCCEMS):
1. DATOS DUROS OBLIGATORIOS: Emplea nombres reales de la localidad, cifras demográficas precisas (número de habitantes, porcentajes de población ocupada, niveles de escolaridad), indicadores educativos (matrícula exacta, porcentaje de reprobación, deserción escolar, estilos de aprendizaje predominantes) y servicios disponibles. Prohibido redactar generalidades abstractas.
2. ESTRATEGIA MAESTRA DE CRUCE ADAPTATIVO EN FODA: En la Tabla 3, el análisis de cada cuadrante debe formular cruces estratégicos directos:
   - Fortalezas (F): Cruce de fortalezas internas de la escuela con oportunidades del entorno para impulsar el PEC.
   - Oportunidades (O): Aprovechamiento de programas gubernamentales, actores comunitarios y recursos del entorno.
   - Debilidades (D): Identificación de carencias internas (infraestructura, rezago) y la estrategia adaptativa del proyecto para mitigarlas.
   - Amenazas (A): Riesgos contextuales (inseguridad, desinterés, clima) y medidas preventivas institucionales.
3. TABLA 4 CON 3 ETAPAS METODOLÓGICAS METICULOSAS:
   - Etapa 1: "Recuperación de información" (Técnicas e instrumentos de levantamiento participativo: encuestas a hogares, asambleas de diagnóstico, mapeo de actores).
   - Etapa 2: "Sistematización y análisis" (Tratamiento estadístico, categorización de problemas según matriz de frecuencias y severidad).
   - Etapa 3: "Selección del problema para el PEC" (Criterios de priorización: pertinencia pedagógica, impacto social a corto y mediano plazo, viabilidad técnica con recursos disponibles).

Debes retornar un objeto JSON con la siguiente estructura exacta:
{
  "tabla1": [
    { "col1": "Ubicación geográfica", "col2": "Localización exacta, límites territoriales, características del terreno y entorno ecológico..." },
    { "col1": "Situación demográfica", "col2": "Población total, distribución por grupos de edad, género y dinámicas migratorias..." },
    { "col1": "Situación socioeconómica", "col2": "Actividades económicas primarias/secundarias, nivel de ingresos promedio y fuentes de empleo..." },
    { "col1": "Situación sociocultural", "col2": "Tradiciones comunitarias, festividades, lengua materna, capital cultural e identidad colectiva..." },
    { "col1": "Seguridad y convivencia", "col2": "Diagnóstico de seguridad, factores de riesgo psicosocial, cohesión comunitaria y espacios públicos..." },
    { "col1": "Participación comunitaria", "col2": "Comités locales existentes, asambleas ejidales/vecinales, liderazgos y redes de apoyo..." },
    { "col1": "Recursos y servicios", "col2": "Cobertura de agua potable, electricidad, drenaje, recolección de basura, conectividad a internet y centros de salud..." },
    { "col1": "Situación medioambiental", "col2": "Problemas ecológicos específicos (manejo de residuos sólidos, contaminación hídrica, deforestación)..." }
  ],
  "tabla2": [
    { "col1": "Cobertura educativa", "col2": "Matrícula total del plantel, demanda de nuevo ingreso y cobertura en la microrregión..." },
    { "col1": "Contexto familiar", "col2": "Estructura de las familias, nivel promedio de escolaridad de padres/tutores e involucramiento en actividades académicas..." },
    { "col1": "Características del estudiantado", "col2": "Intereses de los jóvenes, estilos de aprendizaje, barreras para el aprendizaje (BAP) y aspiraciones vocacionales..." },
    { "col1": "Características del plantel", "col2": "Infraestructura instalada, aulas, laboratorios, áreas deportivas, equipamiento tecnológico y plantilla docente..." },
    { "col1": "Indicadores educativos", "col2": "Porcentajes exactos de aprobación, reprobación por áreas críticas, tasa de abandono y eficiencia terminal..." },
    { "col1": "Programas vigentes", "col2": "Proyectos previos, programas estatales y vinculación con el Programa de Mejora Continua (PMC)..." }
  ],
  "tabla3": [
    { "aspect": "Fortalezas (F)", "analysis": "Estrategia Maestra de Cruce FO: Capital docente capacitado y estudiantado organizado que se vincula con las autoridades auxiliares para intervenir el polígono seleccionado..." },
    { "aspect": "Oportunidades (O)", "analysis": "Estrategia de Aprovechamiento DO: Existencia de programas locales y saberes comunitarios que compensan las limitaciones presupuestales del plantel..." },
    { "aspect": "Debilidades (D)", "analysis": "Estrategia Mitigadora: Rezago formativo en habilidades técnicas que se subsana mediante talleres situados integrados a las UACs laborales y científicas..." },
    { "aspect": "Amenazas (A)", "analysis": "Estrategia Defensiva FA: Mecanismos institucionales y alianzas vecinales para salvaguardar la integridad de las brigadas ante riesgos del entorno..." }
  ],
  "tabla4": [
    { "col1": "Recuperación de información", "col2": "Diseño y aplicación de cuestionarios diagnósticos a 120 familias, realización de 2 asambleas participativas y observación directa de campo en las inmediaciones del plantel..." },
    { "col1": "Sistematización y análisis", "col2": "Procesamiento de datos en hojas de cálculo por el colegiado docente, clasificando 5 problemáticas centrales según recurrencia, afectación ambiental y viabilidad..." },
    { "col1": "Selección del problema para el PEC", "col2": "Consenso en asamblea escolar-comunitaria donde la problemática elegida obtuvo la mayor puntuación de factibilidad de transformación a 1 ciclo escolar..." }
  ]
}`;
}

// ============================================================================
// PROMPT 2: Definición, Justificación y Diseño General
// ============================================================================
export function buildPrompt2Justificacion(
  diagnosticoSummary: string,
  projectName: string,
  problem: string
): string {
  return `Redacta la FASE II: Definición, Justificación y Diseño General del PEC conforme al Criterio 7 de la Rúbrica Oficial PAEC-PEC (Ciclo Escolar ${SCHOOL_YEAR}).

Nombre del Proyecto: "${projectName}"
Problemática Asignada: "${problem}"

Síntesis de la Fase I (Diagnóstico Comunitario y Escolar):
${diagnosticoSummary}

DIRECTRICES OBLIGATORIAS:
1. JUSTIFICACIÓN TÉCNICA CON LOS 4 CRITERIOS OBLIGATORIOS DEL MCCEMS:
   La propiedad "introduction" debe redactar una justificación rigurosa organizada en 4 apartados claramente identificables:
   a) MAGNITUD: Dimensión física, territorial y humana del problema; porcentaje y número estimado de habitantes/familias afectadas.
   b) INTERÉS: Razones por las cuales el problema moviliza genuinamente la vocación de estudiantes, docentes y padres de familia.
   c) FACTIBILIDAD: Viabilidad técnica, operativa y financiera para resolver o mitigar la problemática con las capacidades del bachillerato.
   d) OPORTUNIDAD: Razones estratégicas por las cuales el ciclo escolar ${SCHOOL_YEAR} es el momento exacto para actuar.
2. CINCO PILARES ESTRATÉGICOS: Lista detallada de al menos 5 pilares metodológicos e institucionales que sostienen el proyecto.
3. PROPÓSITO TRIDIMENSIONAL (QUÉ Y PARA QUÉ):
   - Educativo: Competencias cognitivas, disciplinares y socioemocionales específicas que desarrollarán los estudiantes.
   - Social: Transformación concreta verificable en la comunidad escolar o local.
   - Funcional: El producto material, prototipo físico, servicio o solución técnica final.
4. CINCO METAS NUMÉRICAS CUANTITATIVAS: En "alcance.metas", define 5 metas numéricas con porcentajes y cifras alcanzables verificables.

Debes retornar un objeto JSON con la siguiente estructura exacta:
{
  "projectName": "${projectName}",
  "introduction": "1. MAGNITUD: La problemática impacta a más de ... habitantes y genera un rezago del ...% en ... 2. INTERÉS: Los estudiantes y la comunidad manifiestan un alto compromiso debido a ... 3. FACTIBILIDAD: El plantel cuenta con talleres, asesoría docente y vinculación comunitaria que garantizan su ejecución sin costos onerosos ... 4. OPORTUNIDAD: La coyuntura del ciclo ${SCHOOL_YEAR} y la alineación a la NEM brindan el marco regulatorio idóneo ...",
  "pilares": [
    "Conexión Directa con Necesidades del Plantel y la Comunidad: Diagnóstico vivo y territorializado",
    "Desarrollo de Competencias Transversales: Pensamiento crítico, resolución colaborativa y compromiso ético ciudadano",
    "Innovación Técnica y Emprendimiento Social Sostenible: Solución práctica de bajo costo y alto impacto",
    "Sinergia Comunitaria Activa: Corresponsabilidad entre escuela, familias y autoridades auxiliares",
    "Alineación Curricular Estratégica MCCEMS: Articulación interdisciplinar sin duplicidad de cargas académicas"
  ],
  "proposito": {
    "educativo": "Desarrollar en el 100% de los estudiantes competencias de indagación científica, comunicación asertiva y aplicación práctica de las UACs mediante proyectos situados.",
    "social": "Mitigar en un 40% la problemática comunitaria en el polígono escolar, beneficiando directamente a más de 250 familias mediante soluciones sostenibles.",
    "funcional": "Diseñar, construir e instalar un sistema/prototipo funcional y un manual técnico operativo de uso comunitario transferible."
  },
  "alcance": {
    "metas": [
      "Meta 1 (Cobertura): Involucrar al 100% de los estudiantes del plantel matriculados en los semestres activos del ciclo.",
      "Meta 2 (Impacto Territorial): Implementar 1 solución técnica comunitaria funcional verificada antes de la semana 16 de cada semestre.",
      "Meta 3 (Vinculación): Formalizar convenios y actas de colaboración con al menos 3 autoridades o aliados comunitarios estratégicos.",
      "Meta 4 (Aprobación Curricular): Lograr que el 90% del estudiantado acredite sus aprendizajes esperados a través de las evidencias del PEC.",
      "Meta 5 (Sostenibilidad): Elaborar y entregar 1 Manual Técnico de Transferencia Comunitaria para garantizar la continuidad intergeneracional."
    ],
    "participantes": [
      "Estudiantes: Investigadores de campo, diseñadores técnicos, brigadistas operativos y divulgadores",
      "Docentes: Diseñadores curriculares, tutores metodológicos y evaluadores formativos",
      "Directivos y Supervisión: Gestores institucionales, facilitadores de alianzas y garantes de la gobernanza",
      "Familias y Comunidad: Co-evaluadores, proveedores de saberes locales y beneficiarios directos"
    ],
    "recursos": [
      "Recursos Físicos: Laboratorios escolares, aulas temáticas, herramientas de taller y predios comunitarios autorizados",
      "Recursos Tecnológicos: Computadoras del plantel, internet, software de diseño/cálculo y plataformas digitales",
      "Recursos Financieros y Materiales: Insumos locales reciclados o aportados de forma solidaria por la comunidad y donaciones en especie"
    ]
  }
}`;
}

// ============================================================================
// PROMPT 3: Matriz de Mapeo Curricular y Transversalidad (100% UACs)
// ============================================================================
export function buildPrompt3Mapeo(
  justificacionText: string,
  uacs: { uac_name: string; semester: number }[]
): string {
  const listText = uacs
    .map((u) => `- Semestre ${u.semester}: ${u.uac_name}`)
    .join('\n');

  return `Realiza la Matriz de Mapeo Curricular y Transversalidad del PEC para TODAS las asignaturas activas en el Ciclo Escolar ${SCHOOL_YEAR} (MCCEMS Puebla).

Contexto y Fundamentación del Proyecto:
${justificacionText}

Asignaturas a Mapear OBLIGATORIAMENTE (Catálogo del Plantel):
${listText}

REGLAS DE ORO CURRICULARES (NOM-MCCEMS):
1. COBERTURA DEL 100% DE ASIGNATURAS: Debes generar exactamente UNA fila para CADA UNA de las ${uacs.length} asignaturas listadas. Está estrictamente prohibido omitir materias o agruparlas en un solo registro.
2. NOMENCLATURA NORMATIVA OFICIAL:
   - Para Semestres 1, 2, 3 y 4: Cita obligatoriamente "Propósito Formativo [N]: [descripción concreta]" y "Contenidos: [temas]". (PROHIBIDO usar la palabra "Progresión" en semestres 1 al 4).
   - Para Semestres 5 y 6: Cita obligatoriamente "Progresión de Aprendizaje [N]: [descripción concreta]".
3. CADENA DE VALOR Y VINCULACIÓN ESPECÍFICA: En la propiedad "linking", explica el aporte sustantivo de la materia a la cadena de valor (cómo su insumo alimenta a otra materia y de qué forma concreta impacta la problemática comunitaria). Evita frases genéricas.

Debes retornar un arreglo JSON de objetos con la siguiente estructura exacta:
[
  {
    "semester": 1,
    "uacName": "Nombre Oficial de la UAC",
    "topic": "Tema o contenido situado curricular que abordará el estudiante",
    "linking": "Vinculación curricular situada: Cita el Propósito Formativo (1°-4°) o Progresión (5°-6°) y explica su integración precisa en la cadena de valor del PEC."
  }
]`;
}

// ============================================================================
// PROMPT 4: Cronograma General de Implementación (6 Fases / 5 Columnas)
// ============================================================================
export function buildPrompt4Cronograma(
  mapeoSummary: string,
  cycleType: string
): string {
  let relevosText = '';
  if (cycleType === 'A') {
    relevosText = `Semestre A (Septiembre a Enero): Operado principalmente por 1.°, 3.° y 5.° semestre con transferencia en Fase 3.`;
  } else if (cycleType === 'B') {
    relevosText = `Semestre B (Febrero a Junio): Operado principalmente por 2.°, 4.° y 6.° semestre con despliegue y cierre en Fase 6.`;
  } else {
    relevosText = `Ciclo Anual Completo (Fases 1 a 6 de Septiembre a Junio integrando 1.° a 6.° semestre de manera continua).`;
  }

  return `Diseña la tabla oficial de "Diseño General: Fases de Implementación del PEC" en 6 Fases Bimestrales para el Ciclo Escolar ${SCHOOL_YEAR} bajo el estándar estricto de 5 COLUMNAS de la Rúbrica Oficial MCCEMS / COSFAC.

Mapeo Curricular de Referencia:
${mapeoSummary}

Modalidad de Ciclo:
${relevosText}

Flujo Metodológico de las 6 Fases Bimestrales:
- Fase 1 (Bimestre 1, Septiembre - Octubre): Indagación, Diagnóstico Científico y Acuerdos Comunitarios.
- Fase 2 (Bimestre 2, Noviembre - Diciembre): Ideación, Diseño Técnico, Prototipado e Ingeniería del Proyecto.
- Fase 3 (Bimestre 3, Enero): Preparación de Insumos, Creación de Manuales Técnicos y Transferencia Intersemestral.
- Fase 4 (Bimestre 4, Febrero - Marzo): Despliegue Operativo, Producción a Escala y Lanzamiento Territorial.
- Fase 5 (Bimestre 5, Abril - Mayo): Aplicación Territorial, Instalación en Campo y Acompañamiento Comunitario.
- Fase 6 (Bimestre 6, Junio): Evaluación de Impacto (Pre vs. Post), Sistematización Metacognitiva y Socialización Comunitaria Abierta.

REQUISITO OBLIGATORIO PARA LA COLUMNA "responsibleSubjects":
Para CADA una de las 6 fases debes citar las asignaturas VIGA MAESTRA correspondientes y justificar explícitamente qué competencia, concepto disciplinar o habilidad técnica movilizan para cumplir el objetivo de esa fase.

Debes retornar un arreglo JSON de 6 objetos con la siguiente estructura exacta de 5 COLUMNAS:
[
  {
    "phase": "Fase 1: Indagación, Diagnóstico Científico y Acuerdos Comunitarios (Septiembre - Octubre)",
    "objective": "Objetivo bimestral claro, técnico y medible que responde a las necesidades iniciales del proyecto",
    "macroActivities": "Macro-actividades situadas de investigación y concertación comunitaria con protagonismo estudiantil",
    "responsibleSubjects": "Asignaturas Viga Maestra y Justificación de Competencias: [Cita materias específicas y su función en la fase]",
    "semesterInvolved": "Semestres involucrados (ej. 1.er, 3.er y 5.º Semestre)"
  }
]`;
}

// ============================================================================
// PROMPT 5: Matriz de Detalle Curricular y Articulación por Semestre
// ============================================================================
export function buildPrompt5DetalleCurricular(
  mapeoSummary: string,
  cronogramaSummary: string,
  cycleType: string
): string {
  return `Diseña la "Matriz de Detalle Curricular por Semestre" del PEC para el Ciclo Escolar ${SCHOOL_YEAR} conforme al Manual de Arquitectura de Sistema MCCEMS / COSFAC.

Mapeo Curricular Aprobado:
${mapeoSummary}

Cronograma Macro de 6 Fases:
${cronogramaSummary}

Filtro de Semestres Activos:
${cycleType === 'A' ? 'Semestre A: 1.°, 3.° y 5.° Semestre' : cycleType === 'B' ? 'Semestre B: 2.°, 4.° y 6.° Semestre' : 'Ciclo Anual: 1.° al 6.° Semestre'}

REGLAS CURRICULARES INQUEBRANTABLES:
1. COBERTURA TOTAL: Genera una fila para CADA UAC del mapeo previo, sin omitir ninguna asignatura.
2. NOMENCLATURA NORMATIVA ESTRICTA (NOM-MCCEMS):
   - Para Semestres 1.º a 4.º: Cita exclusivamente "Propósito Formativo [N]: [descripción del propósito]" y "Contenidos clave: [temas]". (PROHIBIDO usar la palabra "Progresiones" en 1° a 4°).
   - Para Semestres 5.º y 6.º: Cita "Progresión de Aprendizaje [N]: [descripción de la progresión]".
3. FASES DEL PROYECTO: Señala con exactitud en cuáles de las 6 fases interviene la UAC (ej. "Fase 1 y Fase 2").
4. JUSTIFICACIÓN CURRICULAR: Explica el mecanismo pedagógico mediante el cual los aprendizajes de la UAC resuelven una necesidad técnica o social del PEC.

Debes retornar un arreglo JSON de objetos DetalleCurricularRow con la siguiente estructura exacta:
[
  {
    "semester": 1,
    "uacName": "Nombre oficial de la UAC",
    "progressionsOrPurposes": "Propósito Formativo 1, 3: [Descripción del propósito y contenidos clave]",
    "projectPhases": "Fase 1 y Fase 2",
    "curricularJustification": "Los estudiantes aplican técnicas de muestreo para recolectar datos del polígono, alimentando la base de datos de diagnóstico del PEC."
  }
]`;
}

// ============================================================================
// PROMPT 6: Plan Operativo Semestre A (16 Semanas / 8 Columnas)
// ============================================================================
export function buildPrompt6PlanOperativoSemestreA(
  cronogramaSummary: string,
  detalleCurricularSummary: string,
  uacBlock: { uacName: string; semester: number }[],
  param4?: number | string,
  param5?: number,
  param6?: number
): string {
  let blockIndex = 1;
  let totalBlocks = 1;
  if (typeof param4 === 'number') {
    blockIndex = param4;
    totalBlocks = param5 ?? 1;
  } else if (typeof param4 === 'string') {
    blockIndex = typeof param5 === 'number' ? param5 : 1;
    totalBlocks = typeof param6 === 'number' ? param6 : 1;
  }

  const uacListText = uacBlock
    .map((u) => `- ${u.uacName} (${u.semester}.° Semestre)`)
    .join('\n');

  return `Diseña la programación operativa de 16 SEMANAS para el SEMESTRE A (Fases 1, 2 y 3: Septiembre a Enero) del PEC (Ciclo Escolar ${SCHOOL_YEAR}) para el siguiente bloque de asignaturas (Bloque ${blockIndex} de ${totalBlocks}).

Asignaturas a Programar en este Bloque (Semestres Impares: 1.°, 3.°, 5.°):
${uacListText}

Cronograma Macro de Fases:
${cronogramaSummary}

Detalle Curricular de Referencia:
${detalleCurricularSummary}

DIRECTRICES OPERATIVAS DE EXCELENCIA (RÚBRICA MCCEMS CRITERIO 15):
1. ESTRUCTURA OFICIAL DE 8 COLUMNAS:
   - phase: Fase 1, Fase 2 o Fase 3.
   - activity: Actividad práctica, situada y formativa con metodologías activas (ABP, ApS, STEAM, Design Thinking).
   - uac: Nombre EXACTO de la UAC según la lista autorizada.
   - progression: Cita formal de "Propósito Formativo [N]" (1°-4°) o "Progresión [N]" (5°-6°).
   - strategy: Metodología activa empleada (ej. Aprendizaje Basado en Proyectos, Aprendizaje-Servicio, Estudio de Caso).
   - week: Semana de ejecución programada ("Semana 1", "Semana 2", ..., "Semana 16").
   - responsibles: Estudiantes del semestre y Docente Titular de la UAC.
   - evaluationInstrument: Instrumento técnico formativo obligatorio (Rúbrica analítica, Lista de cotejo, Guía de observación, Portafolio de evidencias, Escala estimativa).
2. REGLA OBLIGATORIA DE CIERRE Y TRANSFERENCIA TÉCNICA (SEMANA 16):
   Las actividades de la Semana 16 del Semestre A deben concentrarse en la evaluación sumativa de fase, rendición preliminar de cuentas y la entrega del "Manual Técnico de Transferencia" para el relevo operativo con el Semestre B.
3. COBERTURA TOTAL: Cada UAC del bloque debe tener actividades distribuidas a lo largo de las semanas que le correspondan.

Debes retornar un arreglo JSON de objetos PlanOperativoRow con la siguiente estructura exacta:
[
  {
    "phase": "Fase 1",
    "activity": "Aplicación de encuestas de diagnóstico de campo en hogares seleccionados",
    "uac": "${uacBlock[0]?.uacName || 'Asignatura'}",
    "progression": "${uacBlock[0]?.semester && uacBlock[0]?.semester > 4 ? 'Progresión 1: ...' : 'Propósito Formativo 1: ...'}",
    "strategy": "Aprendizaje-Servicio (ApS)",
    "week": "Semana 2",
    "responsibles": "Estudiantes de ${uacBlock[0]?.semester || 1}.° Semestre y Docente Titular",
    "evaluationInstrument": "Rúbrica analítica de desempeño en campo"
  }
]`;
}

// Alias para compatibilidad
export const buildPrompt6PlanOperativoPorBloque = buildPrompt6PlanOperativoSemestreA;

// ============================================================================
// PROMPT 7: Plan Operativo Semestre B (16 Semanas / 8 Columnas)
// ============================================================================
export function buildPrompt7PlanOperativoSemestreB(
  cronogramaSummary: string,
  detalleCurricularSummary: string,
  uacBlock: { uacName: string; semester: number }[],
  param4?: number | string,
  param5?: number,
  param6?: number
): string {
  let blockIndex = 1;
  let totalBlocks = 1;
  if (typeof param4 === 'number') {
    blockIndex = param4;
    totalBlocks = param5 ?? 1;
  } else if (typeof param4 === 'string') {
    blockIndex = typeof param5 === 'number' ? param5 : 1;
    totalBlocks = typeof param6 === 'number' ? param6 : 1;
  }

  const uacListText = uacBlock
    .map((u) => `- ${u.uacName} (${u.semester}.° Semestre)`)
    .join('\n');

  return `Diseña la programación operativa de 16 SEMANAS para el SEMESTRE B (Fases 4, 5 y 6: Febrero a Junio) del PEC (Ciclo Escolar ${SCHOOL_YEAR}) para el siguiente bloque de asignaturas (Bloque ${blockIndex} de ${totalBlocks}).

Asignaturas a Programar en este Bloque (Semestres Pares: 2.°, 4.°, 6.°):
${uacListText}

Cronograma Macro de Fases:
${cronogramaSummary}

Detalle Curricular de Referencia:
${detalleCurricularSummary}

DIRECTRICES OPERATIVAS DE EXCELENCIA (RÚBRICA MCCEMS CRITERIO 15):
1. ESTRUCTURA OFICIAL DE 8 COLUMNAS:
   - phase: Fase 4, Fase 5 o Fase 6.
   - activity: Despliegue territorial, instalación en la comunidad, pruebas de funcionamiento, campañas de concientización y evaluación de impacto.
   - uac: Nombre EXACTO de la UAC según la lista autorizada.
   - progression: Cita formal de "Propósito Formativo [N]" (1°-4°) o "Progresión [N]" (5°-6°).
   - strategy: Metodología activa empleada (ABP, ApS, STEAM, Design Thinking).
   - week: Semana de ejecución programada ("Semana 1", "Semana 2", ..., "Semana 16").
   - responsibles: Estudiantes del semestre y Docente Titular de la UAC.
   - evaluationInstrument: Instrumento técnico formativo obligatorio (Rúbrica analítica, Lista de cotejo, Guía de observación, Portafolio de evidencias, Escala estimativa).
2. REGLA OBLIGATORIA DE FERIA COMUNITARIA Y CIERRE SOCIAL (SEMANA 16):
   Las actividades de la Semana 16 del Semestre B deben consagrarse a la gran Feria Escolar Comunitaria, socialización pública de resultados, aplicación del cuestionario POST a las familias y entrega formal del proyecto a las autoridades locales.
3. COBERTURA TOTAL: Cada UAC del bloque debe aparecer al menos una vez en su fase operativa.

Debes retornar un arreglo JSON de objetos PlanOperativoRow con la siguiente estructura exacta:
[
  {
    "phase": "Fase 4",
    "activity": "Instalación de estaciones piloto en el polígono comunitario en colaboración con vecinos",
    "uac": "${uacBlock[0]?.uacName || 'Asignatura'}",
    "progression": "${uacBlock[0]?.semester && uacBlock[0]?.semester > 4 ? 'Progresión 2: ...' : 'Propósito Formativo 2: ...'}",
    "strategy": "Aprendizaje Basado en Proyectos (ABP)",
    "week": "Semana 4",
    "responsibles": "Estudiantes de ${uacBlock[0]?.semester || 2}.° Semestre y Docente Titular",
    "evaluationInstrument": "Lista de cotejo de montaje e instalación"
  }
]`;
}

// ============================================================================
// PROMPT 8: Implementación Territorial, Oficios y Portafolio de Anexos
// ============================================================================
export function buildPrompt8ImplementacionYAnexos(
  projectSummary: string,
  planASummary: string,
  planBSummary: string
): string {
  return `Genera el SISTEMA INTEGRAL DE IMPLEMENTACIÓN TERRITORIAL, OFICIOS Y PORTAFOLIO DE 6 ANEXOS TÉCNICOS del PEC (Ciclo Escolar ${SCHOOL_YEAR}) conforme a los Criterios 18 a 23 de la Rúbrica Oficial MCCEMS / COSFAC.

Datos y Fundamentación del Proyecto:
${projectSummary}

Síntesis de Operación Semestre A:
${planASummary}

Síntesis de Operación Semestre B:
${planBSummary}

REGLAS DE GENERACIÓN OBLIGATORIAS:
1. CONTENIDO COMPLETO Y REAL: Genera los textos institucionales formales completos para oficios, minutas y cartas. Cero textos genéricos.
2. ESTRUCTURA DEL OBJETO JSON REQUERIDA:
   - "cartaInvitacion": Carta formal de convocatoria dirigida a los padres de familia y vecinos para la asamblea de instalación del PEC.
   - "minutaArranque": Acta formal de asamblea de instalación con acuerdos numerados y firmas de los comités.
   - "oficiosAliados": Al menos 3 oficios formales de vinculación dirigidos a:
     1. Autoridad Municipal o Auxiliar (Presidente Municipal o Presidente Auxiliar)
     2. Centro de Salud Local o Jurisdicción Sanitaria
     3. Comisariado Ejidal o Empresa / Comercio Aliado Local
   - "anexos": Los 6 anexos técnicos oficiales con estructura tabular completa:
     - anexo1Minuta: Minuta de asamblea con acuerdos y firmas.
     - anexo2Seguimiento: Tabla de seguimiento de 16 semanas con semáforos ('verde', 'amarillo', 'rojo').
     - anexo3ReporteMensual: Reporte periódico de la coordinación del PEC con logros, dificultades y ajustes.
     - anexo4ImpactoComunidad: Cuestionario Likert de impacto comunitario con aplicación PRE y POST (al menos 6 reactivos).
     - anexo5AutoevaluacionEstudiantes: Rúbrica de autoevaluación estudiantil de habilidades blandas y competencias NEM.
     - anexo6EvaluacionColegiado: Cuestionario para la evaluación del colegiado docente y transversalidad.

Debes responder ÚNICAMENTE con un objeto JSON con la siguiente estructura exacta:
{
  "cartaInvitacion": {
    "asunto": "Convocatoria a Asamblea General para la Instalación del Proyecto Escolar Comunitario (PEC)",
    "fecha": "Septiembre de 2026",
    "destinatarios": "Padres de Familia, Tutores y Miembros Distinguidos de la Comunidad",
    "cuerpo": "Por medio de la presente, la Dirección del Plantel y el Colectivo Docente convocan a usted a la Asamblea de Socialización e Instalación del Proyecto Escolar Comunitario...",
    "fechaReunion": "Viernes de la Semana 2",
    "hora": "10:00 hrs",
    "lugar": "Plaza Cívica del Plantel",
    "objetivos": [
      "Presentar el diagnóstico integral y la problemática priorizada por la escuela",
      "Conformar las brigadas mixtas de apoyo escuela-comunidad",
      "Establecer los compromisos y acuerdos de colaboración mutua"
    ],
    "firmante": "Director del Plantel",
    "cargo": "Dirección Escolar"
  },
  "minutaArranque": {
    "cct": "21EBH0000X",
    "fecha": "Septiembre de 2026",
    "tipoReunion": "Asamblea de Instalación del Comité Escolar Comunitario del PEC",
    "acuerdos": [
      { "no": 1, "acuerdo": "Aprobación unánime del proyecto y delimitación de las zonas de intervención comunitaria", "responsable": "Dirección y Colegiado Docente", "fechaLimite": "Semana 2", "estatus": "Cumplido" },
      { "no": 2, "acuerdo": "Constitución formal de las 4 brigadas estudiantiles de campo y salud ambiental", "responsable": "Coordinación del PAEC", "fechaLimite": "Semana 3", "estatus": "Cumplido" },
      { "no": 3, "acuerdo": "Firma de oficios y entrega de solicitudes a las autoridades de la Junta Auxiliar", "responsable": "Comité de Vinculación", "fechaLimite": "Semana 4", "estatus": "En proceso" },
      { "no": 4, "acuerdo": "Establecimiento del calendario bimestral de supervisión y rendición de cuentas formativas", "responsable": "Consejo Técnico Escolar", "fechaLimite": "Semana 6", "estatus": "Programado" }
    ],
    "firmas": [
      { "cargo": "Director del Plantel", "nombre": "Responsable de Dirección Escolar" },
      { "cargo": "Docente Coordinador PAEC", "nombre": "Docente Titular del PEC" },
      { "cargo": "Presidente del Comité Comunitario", "nombre": "Representante de Padres de Familia" },
      { "cargo": "Representante Estudiantil", "nombre": "Líder de Asamblea Estudiantil" }
    ]
  },
  "oficiosAliados": [
    {
      "destinatario": "C. Presidente Auxiliar Municipal",
      "cargo": "Presidente de la Junta Auxiliar",
      "institucion": "H. Presidencia Auxiliar",
      "asunto": "Solicitud de Colaboración Institucional y Respaldo Operativo para el Proyecto PAEC-PEC ${SCHOOL_YEAR}",
      "propuestaColaboracion": "Se solicita apoyo para facilitar el acceso a espacios públicos comunitarios, asesoría en gestión de residuos y respaldo en seguridad preventiva para las brigadas estudiantiles durante las visitas situadas."
    },
    {
      "destinatario": "Dr. Director del Centro de Salud Rural",
      "cargo": "Director de Unidad Médica",
      "institucion": "Servicios de Salud del Estado de Puebla",
      "asunto": "Vinculación Interinstitucional para Asesoría Técnica en Salud y Diagnóstico Comunitario",
      "propuestaColaboracion": "Se solicita la impartición de 2 talleres formativos para estudiantes sobre medicina preventiva y la validación de los indicadores de salud comunitaria del PEC."
    },
    {
      "destinatario": "C. Presidente del Comisariado Ejidal",
      "cargo": "Presidente Ejidal",
      "institucion": "Comisariado Ejidal de la Localidad",
      "asunto": "Solicitud de Permiso y Colaboración en Terrenos Comunitarios de Demostración",
      "propuestaColaboracion": "Se propone el establecimiento de un módulo piloto demostrativo de tecnologías sostenibles en un predio de uso colectivo para beneficio directo de los productores de la región."
    }
  ],
  "sesionLanzamiento": {
    "fecha": "Septiembre 2026",
    "dinamica": "Taller Vivencial y Plenaria de Compromiso Cívico Estudiantil",
    "participantes": "Comunidad estudiantil completa de 1.° a 6.° semestre y colectivo docente",
    "acuerdosEstudiantiles": [
      "Asumir con responsabilidad ética y entusiasmo la ejecución de las actividades de campo",
      "Cuidar los materiales, equipos e insumos comunitarios facilitados para el proyecto",
      "Mantener un trato empático, solidario y respetuoso con todos los habitantes de la localidad"
    ]
  },
  "anexos": {
    "anexo1Minuta": {
      "cct": "21EBH0000X",
      "fecha": "Septiembre 2026",
      "tipoReunion": "Asamblea de Instalación del Comité Escolar Comunitario del PAEC",
      "acuerdos": [
        { "no": 1, "acuerdo": "Formalización del polígono de intervención y cronograma de visitas", "responsable": "Dirección y Comité", "fechaLimite": "Semana 2", "estatus": "Cumplido" },
        { "no": 2, "acuerdo": "Asignación de roles de investigación y levantamiento por UAC", "responsable": "Colegiado Docente", "fechaLimite": "Semana 3", "estatus": "En proceso" }
      ],
      "firmas": [
        { "cargo": "Director del Plantel", "nombre": "Dirección Escolar" },
        { "cargo": "Coordinador del PEC", "nombre": "Docente Enlace" }
      ]
    },
    "anexo2Seguimiento": [
      { "semana": "Semana 1", "fase": "Fase 1", "uac": "UAC Propedéutica", "metaOperativa": "Conformación de brigadas y encuadre", "evidencia": "Listas de brigadas", "avancePorcentaje": 100, "semaforo": "verde" },
      { "semana": "Semana 2", "fase": "Fase 1", "uac": "UAC Diagnóstica", "metaOperativa": "Levantamiento de datos de campo", "evidencia": "Cuestionarios completos", "avancePorcentaje": 95, "semaforo": "verde" },
      { "semana": "Semana 4", "fase": "Fase 1", "uac": "UAC Síntesis", "metaOperativa": "Validación con asamblea vecinal", "evidencia": "Minuta de validación", "avancePorcentaje": 100, "semaforo": "verde" },
      { "semana": "Semana 8", "fase": "Fase 2", "uac": "UAC Tecnológica", "metaOperativa": "Construcción del prototipo piloto", "evidencia": "Prototipo funcional", "avancePorcentaje": 90, "semaforo": "verde" },
      { "semana": "Semana 12", "fase": "Fase 3", "uac": "UAC Transversal", "metaOperativa": "Elaboración del Manual Técnico de Transferencia", "evidencia": "Manual técnico borrador", "avancePorcentaje": 85, "semaforo": "verde" },
      { "semana": "Semana 16", "fase": "Fase 3", "uac": "UAC Evaluación", "metaOperativa": "Cierre Semestre A y entrega de manual", "evidencia": "Acta de transferencia firmada", "avancePorcentaje": 100, "semaforo": "verde" }
    ],
    "anexo3ReporteMensual": {
      "periodo": "Reporte Bimestral de Seguimiento y Coordinación del PEC",
      "resumenEjecutivo": "El desarrollo del proyecto registra un avance cuantitativo del 92% respecto a lo programado, habiéndose integrado la totalidad de los grupos escolares...",
      "logros": [
        "Instalación formal del Comité Comunitario con participación activa de autoridades",
        "Cobertura del 100% de los instrumentos diagnósticos aplicados en el polígono",
        "Construcción exitosa del primer modelo prototipo validado por los docentes"
      ],
      "dificultades": [
        "Ajuste en tiempos de traslado para brigadas de comunidades alejadas",
        "Abastecimiento oportuno de materiales especializados para el prototipo"
      ],
      "accionesAjuste": [
        "Coordinación de transporte escolar solidario para las visitas de campo",
        "Sustitución de insumos por materiales sustentables de origen local"
      ]
    },
    "anexo4ImpactoComunidad": {
      "titulo": "Cuestionario de Medición de Impacto y Transformación Comunitaria (Aplicación PRE y POST)",
      "tipoAplicacion": "PRE/POST",
      "reactivos": [
        { "reactivo": "La problemática abordada por los estudiantes representa una necesidad urgente en mi entorno vecinal.", "dimension": "Pertinencia Social" },
        { "reactivo": "Existe un diálogo constante, respetuoso y constructivo entre la escuela y la comunidad.", "dimension": "Vinculación Comunitaria" },
        { "reactivo": "Las actividades y soluciones técnicas implementadas por los jóvenes son viables y útiles para las familias.", "dimension": "Efectividad Técnica" },
        { "reactivo": "He asistido a las reuniones y actividades públicas convocadas por el bachillerato para el proyecto.", "dimension": "Participación Ciudadana" },
        { "reactivo": "Se observan mejoras reales y tangibles en las condiciones de vida o ambientales de la comunidad.", "dimension": "Transformación Social" },
        { "reactivo": "Considero indispensable que la escuela continúe desarrollando proyectos como el PEC en próximos ciclos.", "dimension": "Sostenibilidad" }
      ],
      "escala": {
        "1": "Totalmente en desacuerdo",
        "2": "En desacuerdo",
        "3": "Neutral",
        "4": "De acuerdo",
        "5": "Totalmente de acuerdo"
      }
    },
    "anexo5AutoevaluacionEstudiantes": {
      "titulo": "Rúbrica de Autoevaluación y Coevaluación de Competencias y Autonomía Estudiantil",
      "tipoAplicacion": "FINAL",
      "reactivos": [
        { "reactivo": "Contribuí activamente y con responsabilidad al trabajo en equipo dentro de mi brigada escolar.", "dimension": "Colaboración y Liderazgo" },
        { "reactivo": "Apliqué los conceptos y saberes de mis asignaturas para dar respuesta a la problemática comunitaria.", "dimension": "Pensamiento Crítico y Transferencia" },
        { "reactivo": "Mantuve una actitud ética, empática y de servicio con los vecinos y familias beneficiarias.", "dimension": "Ética y Ciudadanía" },
        { "reactivo": "Propuse soluciones creativas y adaptativas cuando surgieron dificultades imprevistas.", "dimension": "Innovación y Resiliencia" },
        { "reactivo": "Reflexioné sobre mi propio aprendizaje y el impacto social positivo que generaron mis acciones.", "dimension": "Metacognición y Sentido de Pertenencia" },
        { "reactivo": "Gestioné mi tiempo y recursos con autonomía para entregar mis evidencias en las fechas acordadas.", "dimension": "Autorregulación y Autonomía" }
      ],
      "escala": {
        "1": "Nivel Inicial",
        "2": "Nivel Básico",
        "3": "Nivel Satisfactorio",
        "4": "Nivel Avanzado",
        "5": "Nivel Sobresaliente"
      }
    },
    "anexo6EvaluacionColegiado": {
      "titulo": "Cuestionario de Evaluación para Docentes y Trabajo Colegiado del PAEC",
      "tipoAplicacion": "FINAL",
      "reactivos": [
        { "reactivo": "La articulación transversal logró generar una cadena de valor pedagógica sólida entre las UACs participantes.", "dimension": "Transversalidad Curricular" },
        { "reactivo": "El proyecto facilitó el cumplimiento de los propósitos formativos y progresiones curriculares del semestre.", "dimension": "Logro Académico" },
        { "reactivo": "Las sesiones de trabajo colegiado permitieron dar seguimiento oportuno a las evidencias y ajustar estrategias.", "dimension": "Coordinación Colegiada" },
        { "reactivo": "Los instrumentos de evaluación formativa transversal midieron de forma objetiva los saberes de los alumnos.", "dimension": "Evaluación Formativa" },
        { "reactivo": "El PEC incrementó el interés, la motivación y la retención escolar de los estudiantes en riesgo de abandono.", "dimension": "Impacto Estudiantil" },
        { "reactivo": "El equipo directivo garantizó las condiciones institucionales, tiempos y permisos para el trabajo de campo.", "dimension": "Liderazgo y Gestión" }
      ],
      "escala": {
        "1": "Totalmente en desacuerdo",
        "2": "En desacuerdo",
        "3": "Neutral",
        "4": "De acuerdo",
        "5": "Totalmente de acuerdo"
      }
    }
  }
}`;
}

// Alias para compatibilidad con código existente
export const buildPrompt7Anexos = (projectSummary: string) => buildPrompt8ImplementacionYAnexos(projectSummary, '', '');

// ============================================================================
// PROMPT 9: Gobernanza Escolar e Informe Final de Rendición de Cuentas (Supervisión 004)
// ============================================================================
export function buildPrompt9GobernanzaEInformeSupervision(
  projectSummary: string,
  planASummary: string,
  planBSummary: string,
  implementacionSummary: string
): string {
  return `Genera la FASE IV: GOBERNANZA ESCOLAR E INFORME FINAL DE RENDICIÓN DE CUENTAS del PEC (Ciclo Escolar ${SCHOOL_YEAR}) para la Supervisión Escolar 004 y la Dirección de Educación Media Superior (SEMS Puebla).

Datos del Proyecto:
${projectSummary}

Operación Semestre A:
${planASummary}

Operación Semestre B:
${planBSummary}

Implementación Territorial y Alianzas:
${implementacionSummary}

DIRECTRICES OBLIGATORIAS DE EXCELENCIA:
1. GOBERNANZA ESCOLAR EN 4 NIVELES INSTITUCIONALES:
   - Nivel 1: Comité de Salud y Medio Ambiente del PEC (reuniones quincenales/mensuales de brigadas).
   - Nivel 2: Consejo Técnico Escolar (sesiones ordinarias de CTE para seguimiento curricular).
   - Nivel 3: Asamblea Comunitaria (asambleas de apertura, seguimiento intersemestral y cierre con familias).
   - Nivel 4: Supervisión Escolar 004 (visitas de acompañamiento técnico-pedagógico y entrega de informes).
2. METODOLOGÍA DE EVALUACIÓN FORMATIVA NEM (TABLA 6 OFICIAL):
   - Ambitos de evaluación: Formativo, Comunitario e Institucional.
   - Preguntas Guía NEM:
     • ¿Dónde estamos?: Estado real del avance respecto al diagnóstico inicial.
     • ¿Hacia dónde vamos?: Metas bimestrales consolidadas y productos esperados.
     • ¿Cómo superamos las brechas?: Estrategias colegiadas de nivelación y ajustes curriculares.
3. INFORME FINAL PARA LA SUPERVISIÓN ESCOLAR:
   - Resumen Ejecutivo: Balance global del proyecto, participación comunitaria y cumplimiento de metas.
   - Tabla Metas vs Logros: Al menos 5 metas cuantificables comparando lo programado vs lo alcanzado, porcentaje de cumplimiento y estatus.
   - Análisis de Impacto Pre/Post: Comparativa concreta de participación, alcance, incremento de conocimientos y desarrollo de competencias.
   - Evidencias Documentales: Listado de actas, fotografías, portafolios, manuales y notas de campo disponibles en el expediente.
   - Obstáculos y Soluciones: Dificultades operativas reales y cómo se resolvieron con el colegiado.
   - Plan de Sostenibilidad: Mecanismo de relevo y continuidad del proyecto para el siguiente ciclo escolar.
   - Firmas: Responsable del informe y Director del Plantel.

Debes responder ÚNICAMENTE con un objeto JSON con la siguiente estructura exacta:
{
  "gobernanza": {
    "calendario": [
      {
        "tipo": "Comité de Salud y Medio Ambiente del PEC",
        "frecuencia": "Quincenal / Mensual",
        "participantes": "Docente Coordinador, docentes enlaces y brigadistas estudiantiles",
        "objetivo": "Revisión técnica de bitácoras, insumos de campo y asignación operativa de tareas inmediatas",
        "evidencia": "Bitácoras de trabajo y listas de cotejo de brigadas"
      },
      {
        "tipo": "Consejo Técnico Escolar (CTE)",
        "frecuencia": "Mensual (Último viernes del mes)",
        "participantes": "Directivo escolar y plantilla docente completa",
        "objetivo": "Evaluación de la cadena de valor transversal, retroalimentación curricular y análisis de rezago",
        "evidencia": "Acta de sesión de CTE y concentrado de avance programático"
      },
      {
        "tipo": "Asamblea Comunitaria y de Familias",
        "frecuencia": "Trimestral / Semestral (3 sesiones al ciclo)",
        "participantes": "Comunidad escolar, comités de padres y autoridades auxiliares",
        "objetivo": "Rendición de cuentas formativas, presentación de prototipos y acuerdos de sostenibilidad",
        "evidencia": "Minutas de asamblea con firmas y memoria fotográfica"
      },
      {
        "tipo": "Supervisión Escolar 004",
        "frecuencia": "Bimestral / Semestral",
        "participantes": "Equipo de Supervisión de Zona, Directivo y Coordinador PAEC",
        "objetivo": "Acompañamiento técnico, validación contra la Rúbrica Oficial y entrega de informes de avance",
        "evidencia": "Cédulas de acompañamiento y oficios de recepción de informe"
      }
    ],
    "metodologiaEvaluacion": {
      "ambitos": [
        "Ámbito 1: Desarrollo de Aprendizajes y Competencias en los Estudiantes",
        "Ámbito 2: Impacto, Transformación y Vinculación Comunitaria",
        "Ámbito 3: Desempeño y Coordinación del Trabajo Colegiado Docente",
        "Ámbito 4: Gestión Directiva y Sostenibilidad Institucional"
      ],
      "preguntasGuiaNem": {
        "dondeEstamos": "Diagnóstico permanente de evidencias formativas: El 94% de las brigadas completó sus tareas de campo y el prototipo opera conforme a los estándares técnicos.",
        "haciaDondeVamos": "Consolidación de la transferencia territorial: Lograr que el 100% de los beneficiarios domine el manual operativo y formalizar el comité vecinal de continuidad.",
        "comoSuperamos": "Planes de nivelación personalizada para estudiantes con rezago, asesoría de pares y reuniones extraordinarias de ajuste con las autoridades locales."
      }
    }
  },
  "informeSupervision": {
    "resumenEjecutivo": "El Proyecto Escolar Comunitario (PEC) desarrollado durante el Ciclo Escolar ${SCHOOL_YEAR} alcanzó un nivel de consolidación sobresaliente, integrando al 100% de la matrícula en los semestres activos e incidiendo de manera verificable en el polígono comunitario seleccionado...",
    "metasVsLogros": [
      {
        "meta": "Involucrar al 100% de la matrícula de semestres activos en brigadas del PEC",
        "indicador": "Porcentaje de alumnos registrados y evaluados en el proyecto",
        "programado": "100%",
        "alcanzado": "98.5%",
        "porcentaje": 98.5,
        "estatus": "Cumplida con excelencia"
      },
      {
        "meta": "Diseñar, construir e instalar 1 solución técnica comunitaria funcional",
        "indicador": "Sistema instalado y operando en el polígono comunitario",
        "programado": "1 prototipo",
        "alcanzado": "1 sistema completo + 1 módulo de réplica",
        "porcentaje": 120,
        "estatus": "Superada"
      },
      {
        "meta": "Establecer convenios de colaboración con autoridades locales",
        "indicador": "Actas y oficios firmados con autoridades comunitarias",
        "programado": "3 alianzas",
        "alcanzado": "4 alianzas formalizadas",
        "porcentaje": 100,
        "estatus": "Cumplida"
      },
      {
        "meta": "Aprobación curricular en aprendizajes vinculados al PEC",
        "indicador": "Tasa de acreditación de UACs vinculadas",
        "programado": "90%",
        "alcanzado": "93.2%",
        "porcentaje": 93.2,
        "estatus": "Cumplida"
      },
      {
        "meta": "Elaboración y entrega del Manual Técnico de Transferencia",
        "indicador": "Manual impreso y digital entregado a las autoridades comunitarias",
        "programado": "1 manual técnico",
        "alcanzado": "1 manual técnico editado y validado",
        "porcentaje": 100,
        "estatus": "Cumplida"
      }
    ],
    "analisisPrePost": {
      "participacionTotal": "Incremento del 65% en la asistencia a asambleas comunitarias en comparación con el ciclo anterior.",
      "alcanceComunitario": "Cobertura directa de más de 280 familias del entorno inmediato al plantel escolar.",
      "cambioConocimientos": "Incremento promedio de 3.8 puntos en la escala de conocimientos sobre la problemática comunitaria evaluada mediante el cuestionario PRE/POST.",
      "desarrolloCompetencias": "El 92% de los estudiantes demostró autonomía funcional en el manejo de instrumentos y trabajo colaborativo según las rúbricas formativas."
    },
    "evidencias": [
      "Expediente de Minutas de Asamblea y Actas de Instalación firmadas",
      "Matriz Bimestral de Seguimiento Semanal con 100% de semáforos verdes",
      "Manual Técnico de Transferencia Comunitaria e Intersemestral",
      "Memoria fotográfica y audiovisual del despliegue en campo y Feria Comunitaria",
      "Base de datos de cuestionarios Likert PRE y POST analizados estadísticamente",
      "Portafolios de evidencias de aprendizaje por UAC con rúbricas de evaluación"
    ],
    "obstaculos": [
      {
        "dificultad": "Inclemencias climatológicas durante el periodo de siembra/instalación en campo",
        "solucion": "Reorganización del calendario y construcción de cubiertas provisionales en talleres escolares"
      },
      {
        "dificultad": "Resistencia inicial de algunos vecinos a participar en el diagnóstico",
        "solucion": "Visitas domiciliarias acompañadas por autoridades comunitarias reconocidas y líderes de manzana"
      }
    ],
    "sostenibilidad": [
      "Entrega del Manual Técnico de Transferencia a la Junta Auxiliar y representantes comunitarios",
      "Conformación de un Comité Vecinal de Mantenimiento con capacitación técnica impartida por estudiantes",
      "Integración del proyecto en el Programa de Mejora Continua (PMC) para su seguimiento en el siguiente ciclo escolar",
      "Almacenamiento de insumos y bitácoras en la biblioteca digital del plantel para consulta intergeneracional"
    ],
    "firmas": {
      "responsableInforme": "Docente Coordinador del Proyecto PAEC",
      "autoridadEscolar": "Director del Bachillerato General Estatal"
    }
  }
}`;
}
