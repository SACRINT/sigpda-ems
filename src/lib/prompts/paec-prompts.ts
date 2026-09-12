export const PAEC_SYSTEM_PROMPT = `Actúa consistentemente como un consorcio experto en Educación Media Superior de la Nueva Escuela Mexicana (NEM) integrado por: un Formador Pedagógico NEM, un Arquitecto de Estructuras Educativas y un Estratega Curricular Transversal de Proyectos Escolares Comunitarios (PAEC-PEC 2026-2027). Tu objetivo es diseñar un Proyecto Escolar Comunitario (PEC) de nivel EXCELENCIA alineado al 100% con la Rúbrica PAEC 2026-2027.

Reglas Críticas de Operación:
1. Fidelidad Estructural: Conserva de forma estricta los títulos, estructuras y claves del JSON solicitado.
2. Autonomía Operativa de las UACs: No agrupes asignaturas ni semestres. Cada Unidad de Aprendizaje Curricular (UAC) debe poseer su propia representación clara en la transversalidad.
3. Nomenclatura Curricular Estricta (Normativa Ciclos 2026-2027 y 2027-2028):
   • Ciclo Escolar 2026-2027: Para 1.º, 2.º, 3.º y 4.º semestre DEBES usar exclusivamente "PROPÓSITOS FORMATIVOS" y "CONTENIDOS". (Está ESTRICTAMENTE PROHIBIDO usar la palabra "Progresiones" para estos semestres). Únicamente 5.º y 6.º semestre usan "PROGRESIONES DE APRENDIZAJE".
   • Ciclo Escolar 2027-2028 y posteriores: TODOS los semestres (1.º a 6.º) usarán exclusivamente "PROPÓSITOS FORMATIVOS" y "CONTENIDOS", quedando completamente eliminado el uso de progresiones.
4. Transversalidad Real (Cadena de Valor Pedagógica):
   • Evita la multidisciplinariedad superficial (materias haciendo tareas aisladas en paralelo).
   • Diseña una cadena de valor donde el producto de una asignatura sea el insumo indispensable para la siguiente (Ej. Matemáticas calcula la estadística que Lenguaje usa en su debate argumentativo, y Química analiza las muestras que Ciencias Sociales recolectó).
5. Cero Simulación y Protagonismo Estudiantil:
   • Evita actividades decorativas o eventos aislados sin fondo (ej. "hacer un cartel" o "barrer" sin análisis reflexivo). Cada actividad debe desarrollar un aprendizaje cognitivo complejo y tener un producto/evidencia evaluable con instrumentos técnicos.
   • El estudiante es el agente activo de transformación social y el docente actúa como facilitador.

Debes responder ÚNICAMENTE con un objeto JSON válido que contenga la información del paso actual. No incluyas explicaciones de texto fuera del JSON. No agregues bloques de código markdown (\`\`\`json).`;

export function buildPrompt1Diagnostico(
  communityContext: string,
  schoolContext: string,
  problem: string
): string {
  return `Genera la FASE I: Diagnóstico Colectivo y Metodología de Análisis del PAEC-PEC (Ciclo Escolar 2026-2027).

Problemática seleccionada por el plantel:
"${problem}"

Información de la Comunidad:
${communityContext}

Información del Plantel:
${schoolContext}

Debes retornar un objeto JSON con la siguiente estructura exacta:
{
  "tabla1": [
    { "col1": "Ubicación geográfica", "col2": "Coordenadas, entorno y características del terreno..." },
    { "col1": "Situación demográfica", "col2": "Población total, distribución por edad y género..." },
    { "col1": "Situación socioeconómica", "col2": "Principales actividades económicas, nivel de ingresos y empleo..." },
    { "col1": "Situación sociocultural", "col2": "Tradiciones, lengua, costumbres y capital cultural..." },
    { "col1": "Seguridad y convivencia", "col2": "Nivel de seguridad, factores de riesgo y cohesión social..." },
    { "col1": "Participación comunitaria", "col2": "Organizaciones locales, comités y redes de apoyo..." },
    { "col1": "Recursos y servicios", "col2": "Acceso a agua, luz, drenaje, internet y servicios de salud..." },
    { "col1": "Situación medioambiental", "col2": "Problemáticas ecológicas, manejo de residuos y recursos naturales..." }
  ],
  "tabla2": [
    { "col1": "Cobertura educativa", "col2": "Matrícula total y nivel de cobertura en la localidad..." },
    { "col1": "Contexto familiar", "col2": "Estructura familiar, nivel educativo de los padres y apoyo..." },
    { "col1": "Características del estudiantado", "col2": "Intereses, estilos de aprendizaje y necesidades..." },
    { "col1": "Características del plantel", "col2": "Infraestructura, aulas, equipamiento y personal docente..." },
    { "col1": "Indicadores educativos", "col2": "Tasas de aprobación, reprobación, abandono y eficiencia terminal..." },
    { "col1": "Programas vigentes", "col2": "Programas institucionales o proyectos comunitarios previos..." }
  ],
  "tabla3": [
    { "aspect": "Fortalezas (F)", "analysis": "Cruza las fortalezas internas del plantel con las oportunidades externas para el proyecto..." },
    { "aspect": "Oportunidades (O)", "analysis": "Analiza las oportunidades del entorno comunitario para potenciar los aprendizajes..." },
    { "aspect": "Debilidades (D)", "analysis": "Identifica áreas de oportunidad internas y cómo el proyecto las mitiga..." },
    { "aspect": "Amenazas (A)", "analysis": "Identifica riesgos externos y plantea la estrategia preventiva del proyecto..." }
  ],
  "tabla4": [
    { "col1": "Recuperación de información", "col2": "Describir el proceso técnico y metodológico de levantamiento de datos comunitarios y escolares..." },
    { "col1": "Sistematización y análisis", "col2": "Explicar cómo se procesó la información para identificar la problemática central..." },
    { "col1": "Selección del problema para el PEC", "col2": "Justificar la pertinencia de la problemática elegida como objeto de transformación situacional..." }
  ]
}`;
}

export function buildPrompt2Justificacion(
  diagnosticoSummary: string,
  projectName: string,
  problem: string
): string {
  return `Redacta la FASE II: Definición, Justificación y Diseño General del PEC conforme al Criterio 7 de la Rúbrica PAEC (Ciclo 2026-2027).

Nombre del proyecto: "${projectName}"
Problemática asociada: "${problem}"

Diagnóstico de la Fase I:
${diagnosticoSummary}

Genera un objeto JSON con la siguiente estructura exacta:
{
  "projectName": "${projectName}",
  "introduction": "Redacta la Justificación Técnica obligatoria con los 4 sub-apartados del Criterio 7: 1. MAGNITUD (dimensión del problema y población afectada), 2. INTERÉS (por qué apasiona a alumnos y comunidad), 3. FACTIBILIDAD (viabilidad con recursos actuales), 4. OPORTUNIDAD (por qué es el momento adecuado).",
  "pilares": [
    "Conexión Directa con Necesidades del Plantel: Viabilidad e infraestructura escolar",
    "Desarrollo de Competencias Transversales: Habilidades sociocognitivas y socioemocionales de la NEM",
    "Oportunidad de Innovación y Emprendimiento Social: Solución tangible y sostenible",
    "Sinergia Comunitaria: Vinculación activa de familias y actores locales",
    "Alineación Curricular Estratégica: Integración de los recursos del MCCEMS"
  ],
  "proposito": {
    "educativo": "Propósito educativo: Qué aprendizajes y competencias desarrollarán los estudiantes.",
    "social": "Propósito social/comunitario: Qué impacto positivo real se generará en el entorno.",
    "funcional": "Propósito funcional: Cuál es el producto material, prototipo o servicio concreto resultado del PEC."
  },
  "alcance": {
    "metas": [
      "Meta 1 (Gestión/Alcance): Porcentaje cuantitativo de cobertura o beneficiarios.",
      "Meta 2 (Producción/Solución): Meta física medible del producto o servicio generado.",
      "Meta 3 (Participación Comunitaria): Meta cuantitativa de involucramiento de familias o aliados.",
      "Meta 4 (Desarrollo Curricular): Nivel de logro en los propósitos formativos o progresiones."
    ],
    "participantes": [
      "Estudiantes: Rol activo, reflexivo y de liderazgo colaborativo",
      "Docentes: Rol de facilitación y articulación curricular transversal",
      "Familias: Rol de apoyo, acompañamiento y co-evaluación",
      "Autoridades y Comunidad: Rol de gestión, asesoría y vinculación externa"
    ],
    "recursos": [
      "Recursos Materiales e Infraestructura escolar...",
      "Recursos Tecnológicos y de Información...",
      "Recursos Financieros o insumos comunitarios acordados..."
    ]
  }
}`;
}

export function buildPrompt3Mapeo(
  justificacionText: string,
  uacs: { uac_name: string; semester: number }[]
): string {
  const listText = uacs
    .map((u) => `- Semestre ${u.semester}: ${u.uac_name}`)
    .join('\n');

  return `Realiza la Matriz de Mapeo Curricular y Transversalidad del PEC para las siguientes asignaturas activas en el Ciclo Escolar 2026-2027.

Información del Proyecto:
${justificacionText}

Asignaturas a mapear (Genera una fila exclusiva para cada una):
${listText}

REGLA DE NOMENCLATURA NORMATIVA (Ciclo Escolar 2026-2027):
- Para Semestres 1, 2, 3 y 4: Utiliza EXCLUSIVAMENTE el término "PROPÓSITO FORMATIVO" y "CONTENIDOS" (Está PROHIBIDO usar "Progresiones" para 1°, 2°, 3° y 4° semestre).
- Para Semestres 5 y 6: Utiliza el término "PROGRESIÓN DE APRENDIZAJE".

Debes retornar un arreglo JSON de objetos con la siguiente estructura exacta:
[
  {
    "semester": 1,
    "uacName": "Nombre de la Asignatura",
    "topic": "Tema o contenido específico y situado que abordará el estudiante",
    "linking": "Vinculación curricular detallada: Cita el Propósito Formativo (1°-4°) o la Progresión (5°-6°) correspondiente y explica cómo aporta a la cadena de valor del proyecto."
  }
]`;
}

export function buildPrompt4Cronograma(
  mapeoSummary: string,
  cycleType: string
): string {
  let relevosText = '';
  if (cycleType === 'A') {
    relevosText = `Semestre A (Septiembre a Enero): asignado a semestres 1°, 3° y 5°. Fases 1 a 3 del proyecto.`;
  } else if (cycleType === 'B') {
    relevosText = `Semestre B (Febrero a Junio): asignado a semestres 2°, 4° y 6°. Fases 4 a 6 del proyecto.`;
  } else {
    relevosText = `Proyecto Anual (Fases 1 a 6 a lo largo de todo el ciclo escolar, 1° a 6° semestre).`;
  }

  return `Diseña la tabla de "Diseño General: Fases de Implementación del PEC" en 6 Fases Bimestrales para el Ciclo Escolar 2026-2027 bajo el estándar oficial de 5 COLUMNAS de la Rúbrica DBEPA / COSFAC.

Vinculación Curricular del Mapeo Previo:
${mapeoSummary}

Directriz Temporal del Ciclo:
${relevosText}

Flujo lógico de las 6 Fases:
- Fase 1: Indagación, Diagnóstico Científico y Acuerdos Comunitarios (Septiembre-Octubre).
- Fase 2: Ideación, Diseño Técnico, Prototipado e Ingeniería del Proyecto (Noviembre-Diciembre).
- Fase 3: Preparación, Creación de Manuales Técnicos y Transferencia Semestral (Enero).
- Fase 4: Despliegue Operativo, Producción a Escala y Lanzamiento Comunitario (Febrero-Marzo).
- Fase 5: Aplicación Territorial, Instalación y Transferencia Comunitaria Directa (Abril-Mayo).
- Fase 6: Reflexión Metacognitiva, Evaluación de Impacto (Pre vs. Post) y Socialización Abierta (Junio).

REGLA OBLIGATORIA PARA LA COLUMNA "responsibleSubjects":
Para CADA FASE debes indicar explícitamente qué asignaturas son la viga maestra de esa fase y la JUSTIFICACIÓN PEDAGÓGICA de por qué intervienen en ese momento y qué competencia o saber movilizan.

Debes retornar un arreglo JSON de objetos con la siguiente estructura exacta de 5 COLUMNAS:
[
  {
    "phase": "Fase 1: Indagación, Diagnóstico Científico y Acuerdos Comunitarios (Septiembre-Octubre)",
    "objective": "Objetivo bimestral claro y medible que responde a la necesidad comunitaria",
    "macroActivities": "Macro-actividades situadas clave con aprendizaje activo y protagónico",
    "responsibleSubjects": "Asignaturas viga maestra y justificación pedagógica de su intervención (ej. Ciencias Sociales I levanta encuestas de campo; Lengua y Comunicación I diseña instrumentos de diálogo comunitario; Cultura Digital I procesa base de datos diagnóstica)",
    "semesterInvolved": "Semestres involucrados (ej. 1.er y 3.er Semestre)"
  }
]`;
}

export function buildPrompt5DetalleCurricular(
  mapeoSummary: string,
  cronogramaSummary: string,
  cycleType: string
): string {
  return `Diseña la "Matriz de Detalle Curricular por Semestre" del PEC para el Ciclo Escolar 2026-2027 conforme al Prompt 5 del Manual de Arquitectura DBEPA / COSFAC.

Esta matriz fundamenta curricularmente la intervención de CADA UNA de las Unidades de Aprendizaje Curricular (UACs) activas antes de pasar a la programación operativa semanal.

Mapeo Curricular Aprobado:
${mapeoSummary}

Cronograma Macro de 6 Fases:
${cronogramaSummary}

Filtro de Semestres Activos:
${cycleType === 'A' ? 'Semestre A: 1°, 3° y 5° Semestre' : cycleType === 'B' ? 'Semestre B: 2°, 4° y 6° Semestre' : 'Ciclo Completo: 1° al 6° Semestre'}

REGLAS CURRICULARES INQUEBRANTABLES (NOM-MCCEMS):
1. COBERTURA TOTAL DEL MAPEO: Debes incluir TODAS las UACs listadas en el mapeo previo, sin omitir ni agrupar ninguna.
2. NOMENCLATURA NORMATIVA ESTRICTA:
   - Para Semestres 1.º, 2.º, 3.º y 4.º: Usa EXCLUSIVAMENTE "Propósito Formativo [N]: [descripción del propósito]" y "Contenidos: [temas]". Está ESTRICTAMENTE PROHIBIDO usar el término "Progresiones" en 1° a 4° semestre.
   - Para Semestres 5.º y 6.º: Usa "Progresión de Aprendizaje [N]: [descripción de la progresión]".
3. FASES DEL PROYECTO: Indica con precisión en qué fase o fases bimestrales (Fase 1 a Fase 6) interviene la UAC.
4. JUSTIFICACIÓN CURRICULAR: Explica el mecanismo pedagógico concreto mediante el cual los aprendizajes de la UAC resuelven una necesidad real del proyecto comunitario.

Debes retornar un arreglo JSON de objetos DetalleCurricularRow con la siguiente estructura exacta:
[
  {
    "semester": 1,
    "uacName": "Nombre oficial de la UAC (Asignatura)",
    "progressionsOrPurposes": "Propósito Formativo 1, 3: [Descripción del propósito y contenidos clave]",
    "projectPhases": "Fase 1 y Fase 2",
    "curricularJustification": "Los estudiantes aplican técnicas de indagación para recolectar datos de campo, generando el informe preliminar que alimentará a las demás asignaturas."
  }
]`;
}

export function buildPrompt6PlanOperativoPorBloque(
  cronogramaSummary: string,
  detalleCurricularSummary: string,
  uacBlock: { uacName: string; semester: number }[],
  cycleType: string,
  blockIndex: number = 1,
  totalBlocks: number = 1
): string {
  const uacListText = uacBlock
    .map((u) => `- ${u.uacName} (${u.semester}.° Semestre)`)
    .join('\n');

  let extraTransferRule = '';
  if (cycleType === 'A' || cycleType === 'annual') {
    extraTransferRule = `\nREGLA DE TRANSFERENCIA TÉCNICA (Semanas 12-14): En alguna de las actividades de estas semanas, incluye la redacción o ensamble del Manual Técnico de Transferencia para garantizar el relevo semestral.`;
  }

  return `Diseña la programación del PLAN OPERATIVO DETALLADO (Semanas 1 a 16) para el siguiente BLOQUE ESPECÍFICO de asignaturas (Bloque ${blockIndex} de ${totalBlocks}) en el Ciclo Escolar 2026-2027.

CLÁUSULA ANTI-ALUCINACIÓN ESTRICTA:
Usa EXCLUSIVAMENTE las siguientes asignaturas de este bloque. ESTÁ ESTRICTAMENTE PROHIBIDO inventar, renombrar, sustituir o agregar asignaturas que no figuren en esta lista:
${uacListText}

Contexto del Cronograma Macro:
${cronogramaSummary}

Detalle Curricular de Referencia:
${detalleCurricularSummary}
${extraTransferRule}

REGLAS DE ORO DE GENERACIÓN:
1. COBERTURA OBLIGATORIA DEL BLOQUE: Cada una de las ${uacBlock.length} asignaturas del bloque DEBE aparecer al menos 1 vez en el rango de las 16 semanas.
2. ESTRUCTURA DE 8 COLUMNAS OFICIALES (Rúbrica Criterio 15):
   - phase: Fase bimestral correspondiente (Fase 1 a 6).
   - activity: Actividad situada, práctica y verificable con metodologías activas (ABP, ApS, STEAM, Design Thinking).
   - uac: Nombre EXACTO de la UAC según la lista autorizada.
   - progression: Cita formal de "Propósito Formativo [N]" (1°-4°) o "Progresión [N]" (5°-6°).
   - strategy: Metodología activa empleada.
   - week: Semana de ejecución (formato: "Semana 1", "Semana 2", ..., "Semana 16").
   - responsibles: Estudiantes participantes y docente titular de la UAC.
   - evaluationInstrument: Instrumento técnico de evaluación formativa transversal. Debe ser uno de: "Rúbrica", "Lista de cotejo", "Guía de observación", "Portafolio de evidencias", "Escala estimativa", "Producto terminado con rúbrica".
3. CADENA DE VALOR: El producto de cada actividad debe integrarse orgánicamente al desarrollo del PEC.

Debes retornar un arreglo JSON de objetos PlanOperativoRow con la siguiente estructura exacta:
[
  {
    "phase": "Fase 1",
    "activity": "Aplicación de instrumentos de diagnóstico comunitario en hogares de la localidad",
    "uac": "${uacBlock[0]?.uacName || 'Asignatura'}",
    "progression": "${uacBlock[0]?.semester && uacBlock[0]?.semester > 4 ? 'Progresión 1: ...' : 'Propósito Formativo 1: ...'}",
    "strategy": "Aprendizaje-Servicio (ApS)",
    "week": "Semana 2",
    "responsibles": "Estudiantes de ${uacBlock[0]?.semester || 1}.° Semestre y Docente Titular",
    "evaluationInstrument": "Rúbrica analítica de desempeño en campo"
  }
]`;
}

export function buildPrompt7Anexos(projectSummary: string): string {
  return `Genera el SISTEMA INTEGRAL DE ANEXOS TÉCNICOS, HERRAMIENTAS ACTIVAS Y EVALUACIÓN del PEC para el Ciclo Escolar 2026-2027 (Criterios 18 a 23 de la Rúbrica Oficial DBEPA / COSFAC).

Información del Proyecto:
${projectSummary}

Debes responder ÚNICAMENTE con un objeto JSON estructurado con esquemas tabulares completos para los 6 anexos oficiales (NO uses strings de Markdown plano):

{
  "anexo1Minuta": {
    "cct": "21EBH0000X",
    "fecha": "Septiembre 2026",
    "tipoReunion": "Asamblea de Instalación del Comité PAEC y Formalización de Acuerdos",
    "acuerdos": [
      { "no": 1, "acuerdo": "Aprobación formal del diagnóstico y delimitación del polígono comunitario de intervención", "responsable": "Dirección y Comité Coordinador", "fechaLimite": "Semana 2", "estatus": "Cumplido" },
      { "no": 2, "acuerdo": "Organización de brigadas estudiantiles interdisciplinarias para el levantamiento de datos", "responsable": "Colegiado Docente", "fechaLimite": "Semana 3", "estatus": "En proceso" },
      { "no": 3, "acuerdo": "Establecimiento de alianzas estratégicas con autoridades locales y centros comunitarios", "responsable": "Comité de Vinculación", "fechaLimite": "Semana 5", "estatus": "Programado" },
      { "no": 4, "acuerdo": "Instalación del sistema bimestral de seguimiento y control de evidencias formativas", "responsable": "Coordinación Académica", "fechaLimite": "Semana 8", "estatus": "Programado" }
    ],
    "firmas": [
      { "cargo": "Director del Plantel", "nombre": "Responsable de Dirección Escolar" },
      { "cargo": "Docente Coordinador PAEC", "nombre": "Docente Enlace Académico" },
      { "cargo": "Representante Comunitario / Padres de Familia", "nombre": "Presidente del Comité de Participación" },
      { "cargo": "Representante del Estudiantado", "nombre": "Líder de Asamblea Estudiantil" }
    ]
  },
  "anexo2Seguimiento": [
    {
      "semana": "Semana 1",
      "fase": "Fase 1",
      "uac": "UAC Clave de Inicio",
      "metaOperativa": "Conformación de brigadas y socialización del plan de trabajo",
      "evidencia": "Acta de asamblea y listas de brigadas registradas",
      "avancePorcentaje": 100,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 2",
      "fase": "Fase 1",
      "uac": "UAC Diagnóstica",
      "metaOperativa": "Aplicación de instrumentos de recolección de datos de campo",
      "evidencia": "Cuestionarios completados y base de datos preliminar",
      "avancePorcentaje": 90,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 3",
      "fase": "Fase 1",
      "uac": "UAC Metodológica",
      "metaOperativa": "Sistematización y análisis de problemáticas detectadas",
      "evidencia": "Reporte estadístico de hallazgos comunitarios",
      "avancePorcentaje": 85,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 4",
      "fase": "Fase 1",
      "uac": "UAC de Cierre de Fase",
      "metaOperativa": "Validación de la problemática priorizada con la comunidad",
      "evidencia": "Minuta de validación comunitaria firmada",
      "avancePorcentaje": 100,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 5",
      "fase": "Fase 2",
      "uac": "UAC de Diseño Técnico",
      "metaOperativa": "Diseño de bocetos, planos o diagramas de la solución comunitaria",
      "evidencia": "Carpeta técnica de diseño del proyecto",
      "avancePorcentaje": 75,
      "semaforo": "amarillo"
    },
    {
      "semana": "Semana 6",
      "fase": "Fase 2",
      "uac": "UAC Experimental / Social",
      "metaOperativa": "Pruebas de laboratorio, simulación o entrevistas a profundidad",
      "evidencia": "Bitácoras de prueba y registro de variables",
      "avancePorcentaje": 80,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 7",
      "fase": "Fase 2",
      "uac": "UAC de Comunicación",
      "metaOperativa": "Campaña de concientización y difusión comunitaria inicial",
      "evidencia": "Materiales informativos y carteles comunitarios",
      "avancePorcentaje": 95,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 8",
      "fase": "Fase 2",
      "uac": "UAC de Prototipado",
      "metaOperativa": "Construcción del prototipo funcional o modelo piloto",
      "evidencia": "Prototipo físico o modelo piloto operativo",
      "avancePorcentaje": 85,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 9",
      "fase": "Fase 3",
      "uac": "UAC de Sistematización",
      "metaOperativa": "Acopio de insumos y preparación de materiales de réplica",
      "evidencia": "Inventario de insumos verificados por el comité",
      "avancePorcentaje": 90,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 10",
      "fase": "Fase 3",
      "uac": "UAC Técnica / Laboral",
      "metaOperativa": "Capacitación práctica a beneficiarios y familias participantes",
      "evidencia": "Listas de asistencia y fotografías de talleres prácticos",
      "avancePorcentaje": 85,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 11",
      "fase": "Fase 3",
      "uac": "UAC de Validación",
      "metaOperativa": "Revisión técnica de estándares de calidad y seguridad",
      "evidencia": "Checklist de control de calidad aprobado",
      "avancePorcentaje": 95,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 12",
      "fase": "Fase 3",
      "uac": "UAC Transversal",
      "metaOperativa": "Redacción del Manual Técnico de Transferencia Intersemestral",
      "evidencia": "Documento del manual de transferencia en borrador",
      "avancePorcentaje": 80,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 13",
      "fase": "Fase 3",
      "uac": "UAC de Transferencia",
      "metaOperativa": "Revisión colegiada del paquete técnico entre semestres",
      "evidencia": "Acta de sesión de revisión del colegiado docente",
      "avancePorcentaje": 90,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 14",
      "fase": "Fase 3",
      "uac": "UAC de Enlace",
      "metaOperativa": "Aprobación definitiva del paquete de relevo operativo",
      "evidencia": "Paquete técnico firmado por docentes de ambos semestres",
      "avancePorcentaje": 100,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 15",
      "fase": "Fase 3",
      "uac": "UAC de Evaluación",
      "metaOperativa": "Consolidación de portafolios de evidencias de los estudiantes",
      "evidencia": "Rúbricas sumativas y portafolios evaluados al 100%",
      "avancePorcentaje": 95,
      "semaforo": "verde"
    },
    {
      "semana": "Semana 16",
      "fase": "Fase 3",
      "uac": "UAC de Socialización",
      "metaOperativa": "Asamblea interna de rendición de cuentas y cierre del ciclo",
      "evidencia": "Minuta de asamblea de cierre y reporte de impacto entregado",
      "avancePorcentaje": 100,
      "semaforo": "verde"
    }
  ],
  "anexo3ReporteMensual": {
    "periodo": "Reporte Bimestral de Seguimiento y Avances de la Coordinación",
    "resumenEjecutivo": "El proyecto avanza conforme al calendario programado, habiendo concluido la fase de indagación y acuerdos iniciales con una tasa de participación comunitaria superior al 85%...",
    "logros": [
      "Instalación y formalización del Comité PAEC con participación comunitaria activa",
      "Cobertura del 100% de las UACs asignadas en el cronograma bimestral",
      "Diseño y validación de los instrumentos formativos de campo"
    ],
    "dificultades": [
      "Coordinación de tiempos en horario extendido para visitas de campo",
      "Logística de acopio de insumos específicos en la comunidad"
    ],
    "accionesAjuste": [
      "Reorganización de brigadas estudiantiles en turnos escalonados",
      "Establecimiento de centro de acopio seguro dentro de las instalaciones escolares"
    ]
  },
  "anexo4ImpactoComunidad": {
    "titulo": "Cuestionario de Medición de Impacto y Transformación Comunitaria (Aplicación PRE y POST)",
    "tipoAplicacion": "PRE/POST",
    "reactivos": [
      { "reactivo": "La problemática abordada por el proyecto escolar afecta directamente a mi familia y entorno vecinal.", "dimension": "Pertinencia Situacional" },
      { "reactivo": "Existe una colaboración cercana y respetuosa entre los estudiantes del bachillerato y los miembros de la comunidad.", "dimension": "Vinculación Comunitaria" },
      { "reactivo": "Las actividades y soluciones propuestas por los jóvenes son viables, útiles y aportan valor real a la localidad.", "dimension": "Efectividad de la Propuesta" },
      { "reactivo": "He participado activamente en reuniones, talleres o consultas convocadas por la escuela para este proyecto.", "dimension": "Participación Ciudadana" },
      { "reactivo": "Considero que la intervención del bachillerato ha mejorado las condiciones de convivencia o del entorno físico.", "dimension": "Transformación Social" },
      { "reactivo": "Recomiendo firmemente que el plantel escolar continúe desarrollando proyectos de esta naturaleza.", "dimension": "Sostenibilidad Comunitaria" }
    ],
    "escala": {
      "1": "Totalmente en desacuerdo",
      "2": "En desacuerdo",
      "3": "Neutral / Indiferente",
      "4": "De acuerdo",
      "5": "Totalmente de acuerdo"
    }
  },
  "anexo5AutoevaluacionEstudiantes": {
    "titulo": "Rúbrica de Autoevaluación y Coevaluación de Autonomía y Habilidades Blandas Estudiantiles",
    "tipoAplicacion": "FINAL",
    "reactivos": [
      { "reactivo": "Participé activamente y con responsabilidad en las brigadas de trabajo colaborativo asignadas.", "dimension": "Colaboración y Trabajo en Equipo" },
      { "reactivo": "Apliqué conceptos y aprendizajes de mis asignaturas para resolver problemas concretos de mi comunidad.", "dimension": "Pensamiento Crítico y Transferencia" },
      { "reactivo": "Mantuve una comunicación empática, respetuosa y asertiva con vecinos y compañeros durante las actividades.", "dimension": "Comunicación Asertiva" },
      { "reactivo": "Propuse alternativas creativas e innovadoras ante los imprevistos que surgieron durante la ejecución.", "dimension": "Creatividad y Resiliencia" },
      { "reactivo": "Reflexioné sobre mi propio proceso de aprendizaje y el impacto ético de mis acciones en mi entorno.", "dimension": "Metacognición y Ética Ciudadana" },
      { "reactivo": "Organicé mi tiempo de forma autónoma para cumplir en tiempo y forma con los productos y evidencias.", "dimension": "Autonomía y Autorregulación" }
    ],
    "escala": {
      "1": "Nivel Inicial (Requiere apoyo permanente)",
      "2": "Nivel Básico (Cumplimiento parcial con supervisión)",
      "3": "Nivel Satisfactorio (Autonomía funcional)",
      "4": "Nivel Avanzado (Desempeño destacado y colaborativo)",
      "5": "Nivel Sobresaliente (Liderazgo transformador y proactivo)"
    }
  },
  "anexo6EvaluacionColegiado": {
    "titulo": "Cuestionario de Evaluación para Docentes y Trabajo Colegiado del PAEC",
    "tipoAplicacion": "FINAL",
    "reactivos": [
      { "reactivo": "La transversalidad propuesta logró articular una cadena de valor efectiva entre las UACs participantes.", "dimension": "Interdisciplinariedad y Cadena de Valor" },
      { "reactivo": "El tiempo dedicado a las actividades del PAEC se integró armónicamente sin sacrificar el avance curricular normativo.", "dimension": "Gestión Curricular y Carga Horaria" },
      { "reactivo": "Las sesiones de trabajo colegiado facilitaron el seguimiento oportuno de evidencias y la resolución de contingencias.", "dimension": "Coordinación y Trabajo Colegiado" },
      { "reactivo": "Los instrumentos de evaluación formativa transversal permitieron registrar fielmente el aprendizaje de los alumnos.", "dimension": "Evaluación Formativa Transversal" },
      { "reactivo": "El proyecto contribuyó a incrementar la motivación, el sentido de pertenencia y la retención escolar del alumnado.", "dimension": "Impacto en el Estudiantado" },
      { "reactivo": "El equipo directivo facilitó los recursos, permisos y condiciones institucionales para el trabajo situado.", "dimension": "Liderazgo Directivo y Respaldo Institucional" }
    ],
    "escala": {
      "1": "Totalmente en desacuerdo",
      "2": "En desacuerdo",
      "3": "Neutral",
      "4": "De acuerdo",
      "5": "Totalmente de acuerdo"
    }
  }
}`;
}

