// ═══════════════════════════════════════════════════════════════════
//  DidácticaIA — Prompts for Planning Extras
//  DBEPA Puebla 2026-2027 · USICAMM & ANEXO 12 Compliant
// ═══════════════════════════════════════════════════════════════════
//
// TIPOS SOPORTADOS:
//   rubric          → Rúbrica analítica (4 niveles, 4 criterios)
//   checklist       → Lista de cotejo (Sí/No)
//   material        → Material didáctico impreso (docente)
//   lesson_plan     → Plan de clase 50 minutos (11 puntos USICAMM)
//   practice_guide  → Guía de Práctica para el Estudiante (MCCEMS)
// ═══════════════════════════════════════════════════════════════════

export const SYSTEM_PROMPT_EXTRAS = `
Eres un asesor pedagógico de la Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA) de la SEP Puebla, experto en la Nueva Escuela Mexicana (NEM) y el Marco Curricular Común de la Educación Media Superior (MCCEMS).
Tu tarea es generar materiales complementarios de alta calidad para docentes de Bachillerato Estatal (BGE, Bachillerato Digital, EMSAD).

REGLAS GENERALES:
- Todo el contenido debe redactarse en español formal e institucional.
- Genera el recurso solicitado en formato Markdown limpio, sin bloques de código con triple comilla (fenced code blocks) y directo al grano.
- Asegúrate de incluir referencias al contexto comunitario y de Puebla en los ejemplos o ejercicios propuestos.
- La terminología técnica debe coincidir plenamente con la planeación de origen.

═══════════════════════════════════════════════════════════════════
EJEMPLOS DE REFERENCIA (NIVEL EXCELENCIA) — FEW-SHOT
Úsalos como parámetro de calidad y estructura. NO los copies literalmente.
═══════════════════════════════════════════════════════════════════

EJEMPLO 1 — RÚBRICA ANALÍTICA DE EXCELENCIA
(Asignatura: Electricidad y Electrónica Industrial | Actividad: Instalación de circuito monofásico)

| Criterio de Evaluación | Excelente (4) | Satisfactorio (3) | Suficiente (2) | Insuficiente (1) | Pond. |
|---|---|---|---|---|---|
| **Diseño del circuito** | Diagrama unifilar completo, simbología NOM-001-SEDE-2012, sin errores de notación | Diagrama completo con 1-2 errores de simbología menores | Diagrama incompleto pero funcional; faltan etiquetas | Diagrama ilegible o sin cumplir la norma | 30% |
| **Ejecución técnica** | Conexiones seguras, calibre correcto, canalización ordenada, sin riesgo eléctrico | Conexiones correctas con 1 descuido menor de canalización | Funciona pero presenta 2-3 deficiencias de seguridad | Instalación peligrosa o no funcional | 35% |
| **Pruebas y verificación** | Registra mediciones con multímetro (V, I, R), interpreta resultados y los compara con valores teóricos | Realiza mediciones correctas, interpretación básica | Mide solo voltaje; sin registro formal | No realiza pruebas de verificación | 20% |
| **Reporte técnico** | Reporte con esquema, tabla de datos, análisis de Ley de Ohm, conclusiones y propuesta de mejora | Reporte completo sin propuesta de mejora | Reporte con datos pero sin análisis | Solo entrega esquema sin reporte | 15% |

**Puntaje total:** _____ / 100 pts | **Calificación:** _____
**Retroalimentación del docente:** _______________________________________________

---

EJEMPLO 2 — PLAN DE CLASE 50 MIN (ABR — Aprendizaje Basado en Retos) — NIVEL EXCELENCIA
(Asignatura: Programación | Contenido: Condicionales y bucles en Python | 3° Semestre BGE)

**1. DATOS GENERALES**
- Docente: | Fecha: | Grupo: | Duración: 50 min
- Aprendizaje esperado: El alumno diseña y depura algoritmos con estructuras de control para resolver un problema real de su comunidad.
- Metodología: ABR — Aprendizaje Basado en Retos

**2. PROPÓSITO DE LA SESIÓN**
Que el estudiante identifique un problema cotidiano de su comunidad (ej: control de agua, gestión de horarios), lo modele con pseudocódigo y lo implemente en Python usando condicionales (if/elif/else) y bucles (for/while), validando su solución con al menos 3 casos de prueba.

**3. SECUENCIA DIDÁCTICA**

| Fase ABR | Actividad | Tiempo | Recursos |
|---|---|---|---|
| **Involucrar** (Gran Idea + Pregunta Esencial) | El docente presenta una noticia: "Cortes de agua en municipios de Puebla. ¿Cómo optimizamos la distribución?" Pregunta: ¿Cómo puede un programa decidir cuándo activar o apagar una bomba de agua? | 8 min | Proyector, noticia impresa |
| **Involucrar** (Reto) | Equipos de 3 definen su Reto: "Diseña un programa que controle automáticamente el llenado de un tinaco basándose en el nivel del agua." Registran en hoja de trabajo. | 5 min | Hoja de trabajo ABR |
| **Investigar** (Recursos y actividades de aprendizaje) | Mini-lección: if/elif/else y while con ejemplos del mundo real. Estudiantes leen 2 fragmentos de código comentados y responden preguntas de comprensión (Bloom: Analizar). | 12 min | Pizarrón, editor de código (Thonny/Colab) |
| **Actuar** (Solución prototipo) | Equipos codifican su solución en Python: definen variables (nivel_actual, nivel_maximo), implementan la lógica condicional y el bucle. El docente circula y hace preguntas socrática: "¿Qué pasa si nivel_actual == nivel_maximo?" | 18 min | Laptops / tablets, Thonny |
| **Actuar** (Evaluación del reto) | Cada equipo presenta su código a otro equipo que lo prueba con 3 casos: nivel bajo, nivel medio y nivel lleno. Registran resultados en la hoja de cotejo de pares. | 5 min | Hoja de cotejo de pares |
| **Cierre** (Reflexión + Metacognición) | Ronda rápida: cada equipo comparte 1 aprendizaje clave y 1 dificultad. Docente conecta la actividad con el PAEC: "¿Cómo este conocimiento mejora la vida en tu comunidad?" | 2 min | Pizarrón (nube de palabras) |

**4. EVALUACIÓN**
- Formativa: Lista de cotejo de pares (ejecución del código, 3 casos de prueba)
- Producto: Archivo .py con comentarios + captura de pantalla de la ejecución
- Indicador PAEC: Propuesta de aplicación comunitaria del algoritmo

**5. COMPETENCIAS GENÉRICAS:** CG4 (Escucha, interpreta y emite mensajes), CG5 (Desarrolla innovaciones), CG8 (Participa con sentido de comunidad)
`;

// ─── Helper: bloque de metodología (se reutiliza en todos los templates) ──────
function buildMetodologiaLine(metodologiaActiva?: string): string {
  if (!metodologiaActiva) return '';
  return `\nMETODOLOGÍA ACTIVA DE ESTA PLANEACIÓN: ${metodologiaActiva}
El recurso debe ser coherente con esta metodología y sus fases características.
Cuando sea pertinente, nombra explícitamente la fase de la metodología a la que corresponde cada actividad o criterio.\n`;
}

/**
 * Prompt templates for generating Rubrics and Checklists (Instrumentos)
 */
export const RUBRIC_PROMPT_TEMPLATE = (
  uacName: string,
  activityName: string,
  evidence: string,
  instrumentType: string,
  metodologiaActiva?: string
) => `
Genera un instrumento de evaluación de tipo: "${instrumentType}" para la siguiente evidencia de logro:
UAC/Asignatura: ${uacName}
Actividad/Contenido: ${activityName}
Evidencia a Evaluar: ${evidence}
${buildMetodologiaLine(metodologiaActiva)}
REQUISITOS DEL INSTRUMENTO:
1. Si el tipo es "Rúbrica analítica", debe presentarse en formato de tabla Markdown con columnas: "Criterio de Evaluación", "Excelente (4)", "Satisfactorio (3)", "Suficiente (2)" e "Insuficiente (1)". Incluye una ponderación para cada criterio (ej: 25% c/u) y una sección de registro de puntaje y firma del docente.
2. Si el tipo es "Lista de cotejo", debe presentarse en formato de tabla Markdown con columnas: "Criterio de Desempeño", "Cumple (Sí)", "No cumple (No)" y "Observaciones". Organiza los criterios en dimensiones (ej: Contenido Técnico, Presentación, Actitud).
3. Adapta los criterios de calidad al área técnica de la asignatura (ej: si es electricidad, exige precisión en calibres, aislamiento, herramientas, normatividad NOM-001-SEDE-2012, etc.).
4. Añade una sección de retroalimentación cualitativa al final para que el docente escriba recomendaciones de mejora continua al estudiante.
`;

/**
 * Prompt templates for generating Classroom Materials
 */
export const MATERIAL_PROMPT_TEMPLATE = (
  uacName: string,
  materialName: string,
  paecProblem: string,
  uacContext: string,
  metodologiaActiva?: string
) => `
Genera el contenido detallado y completo del siguiente material didáctico impreso para clase:
Nombre del Material: ${materialName}
UAC/Asignatura: ${uacName}
Problemática PAEC asociada: ${paecProblem}
Contexto General de la Planeación:
${uacContext}
${buildMetodologiaLine(metodologiaActiva)}
REQUISITOS DEL MATERIAL:
1. NO uses marcadores de posición (placeholders) como "[escribir aquí]", "etc.". Escribe el texto real completo, listo para imprimir y fotocopiar.
2. Si es una "Ficha Técnica" o "Tabla", incluye datos técnicos reales, calibres, normas oficiales mexicanas aplicables (ej: NOM-001-SEDE-2012) y descripciones detalladas de uso.
3. Si es un "Cuestionario Diagnóstico", redacta las preguntas reales (mínimo 5), con opciones y una clave de respuestas comentada con notas pedagógicas para el docente al final.
4. Si son "Tarjetas de Casos Prácticos", redacta al menos 3 casos ficticios realistas situados en comunidades rurales o urbanas del Estado de Puebla, planteando un problema cotidiano de la comunidad y la solución técnica esperada.
5. Estructura el documento usando títulos (# y ##), tablas y listas en Markdown para que sea fácil de leer y exportar.
`;

/**
 * Prompt templates for generating Lesson Plans (Planes de Clase)
 * Aligned 100% with the 11 points of "03 Lista de cotejo Plan de Clase 1-2_SEM.pdf"
 */
export const LESSON_PLAN_PROMPT_TEMPLATE = (
  uacName: string,
  activityName: string,
  sessionNum: number,
  totalSessions: number,
  paecProblem: string,
  studentContext: string,
  learningOutcome: string,
  metodologiaActiva?: string,
  sessionTopic?: string,
  sessionFocus?: string
) => `
Genera un "Plan de Clase" (Lesson Plan) detallado para una sesión de clase de 50 minutos:
UAC/Asignatura: ${uacName}
Actividad Clave / Contenido de origen: ${activityName}
Número de Sesión: Sesión ${sessionNum} de ${totalSessions}
${sessionTopic ? `Tema Específico de la Sesión: ${sessionTopic}` : ''}
${sessionFocus ? `Foco y Enfoque Pedagógico de la Sesión: ${sessionFocus}` : ''}
Resultado de Aprendizaje (Programa): ${learningOutcome}
Problemática PAEC: ${paecProblem}
Caracterización de los estudiantes: ${studentContext}
${buildMetodologiaLine(metodologiaActiva)}
REQUISITOS DEL PLAN DE CLASE (100% Alineado a la Lista de Cotejo oficial del supervisor):
El documento debe incluir de forma explícita las siguientes secciones etiquetadas en Markdown:

1. **Datos de Identificación del Plan de Clase**:
   - Nombre de la UAC, Semestre, Grupo, Número de Sesión y Horas.
   - Meta Educativa / Meta de Aprendizaje.
   - Contenidos Conceptuales, Procedimentales y Actitudinales involucrados.
   - Transversalidad: Conexión coherente con otras disciplinas del mismo semestre.

2. **Metodología Socio-Crítica / Estrategias Activas**:
   - Declarar la estrategia activa principal (${metodologiaActiva ? `la metodología seleccionada es: ${metodologiaActiva}` : 'ej: Aprendizaje Basado en Proyectos, Práctica Guiada de Taller, etc.'}) y cómo se aplica en esta sesión.

3. **Secuencia de Aprendizaje de la Sesión (50 minutos desglosados)**:
   Presentar en una tabla Markdown con columnas: "Fase/Momento", "Tiempo", "Actividad del Docente", "Actividad del Estudiante" y "Proceso de Pensamiento / Habilidad":
   - **Apertura (10 min) - Exploración de conocimientos**: Actividad concreta para indagar ideas y saberes previos en torno al contenido de la sesión.
   - **Desarrollo (30 min) - Aprendizaje Pertinente (Nivel 2 de Complejidad)**: Actividades eslabonadas donde el estudiante aplique, diseñe, procese o construya conocimientos. Debe fomentar la reflexión, el diálogo y la discusión activa del estudiantado. Contextualizado a la problemática del PAEC de Puebla.
   - **Cierre (10 min) - Consolidación**: Actividades que promuevan la metacognición (que el alumno reflexione qué aprendió y para qué le sirve) y la autoevaluación o coevaluación de la sesión.

4. **Evaluación Formativa de la Sesión**:
   - Especificar el producto esperado o evidencia del día.
   - Indicar el momento y tipo de evaluación (autoevaluación, coevaluación o heteroevaluación).
   - Definir el Instrumento de evaluación sugerido para valorar el logro de la meta del día.

5. **Recursos y Fuentes de Información**:
   - Materiales requeridos por el estudiante y el docente para esta clase específica.
   - Bibliografía y recursos digitales de consulta (NOMs, manuales o ligas).
`;

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3: Guía de Práctica para el Estudiante (MCCEMS Formativo)
// Optimizada para Metodologías Activas (ABR, Práctica de Taller, STEAM, ABP)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera una Guía de Práctica completa para el ESTUDIANTE.
 * Diseñada bajo los lineamientos pedagógicos del Marco Curricular Común (MCCEMS).
 * El estudiante la recibe impresa o digital para guiar su aprendizaje autónomo.
 */
export const PRACTICE_GUIDE_PROMPT_TEMPLATE = (
  uacName: string,
  activityName: string,
  practiceNumber: number,
  practiceTitle: string,
  paecProblem: string,
  learningOutcome: string,
  studentContext: string,
  metodologiaActiva?: string,
  metodologiaFases?: string[]
) => `
Genera una **Guía de Práctica para el Estudiante** completa, lista para imprimir o compartir en PDF/digital. Esta guía está destinada directamente al estudiante de bachillerato, NO al docente.

Datos de la guía:
- UAC/Asignatura: ${uacName}
- Práctica No.: ${practiceNumber}
- Título de la Práctica: ${practiceTitle}
- Actividad Clave origen: ${activityName}
- Resultado de Aprendizaje a lograr: ${learningOutcome}
- Problemática PAEC (contexto real): ${paecProblem}
- Perfil del estudiante: ${studentContext}
${metodologiaActiva ? `- Metodología Activa aplicada: **${metodologiaActiva}**` : ''}
${metodologiaFases && metodologiaFases.length > 0 ? `- Fases de la metodología:\n${metodologiaFases.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}` : ''}

══════════════════════════════════════════════════════════
ESTRUCTURA OBLIGATORIA DE LA GUÍA (formato Markdown limpio):
══════════════════════════════════════════════════════════

## 📋 GUÍA DE PRÁCTICA No. ${practiceNumber}
### ${practiceTitle}
**UAC:** ${uacName} | **Ciclo Escolar:** 2026-2027 | **Semestre:** ___ | **Grupo:** ___
**Nombre del estudiante:** _____________________________ | **Fecha:** _____________

---

### 🎯 1. PROPÓSITO DE LA PRÁCTICA
Redacta en 2-3 oraciones, dirigidas al estudiante, qué aprenderá y para qué le servirá esta práctica en su vida real y en su comunidad. Menciona explícitamente la conexión con la problemática: "${paecProblem}".

---

### 🧠 2. COMPETENCIAS QUE DESARROLLARÁS
Presenta en formato de tabla:
| # | Competencia | Disciplinar / Genérica |
|---|-------------|----------------------|
| 1 | ... | ... |
| 2 | ... | ... |
| 3 | ... | ... |
Mínimo 3 competencias específicas y transferibles al contexto de Puebla.

---

### 📦 3. MATERIALES Y RECURSOS
**3.1 Materiales físicos (que debes traer o solicitar):**
Presenta en lista de verificación (checklist) con casillas [  ]:
- [  ] Material 1 (cantidad, especificación técnica si aplica)
- [  ] Material 2...
Incluye materiales reales, accesibles en localidades del Estado de Puebla.

**3.2 Recursos digitales o de consulta:**
- Liga o referencia real (norma NOM, manual técnico, libro, plataforma educativa)
- Mínimo 2 referencias verificables.

---

> **IMPORTANTE — Diagrama de flujo del procedimiento:**
> ANTES del texto del procedimiento, incluye SIEMPRE un bloque Mermaid que muestre el flujo visual de las fases principales.
> El bloque debe ser exactamente de este formato (ajusta los nodos al contenido real):
> \`\`\`mermaid
> flowchart TD
>     A[🔬 Inicio] --> B[Fase 1: Nombre]
>     B --> C[Fase 2: Nombre]
>     C --> D[Fase 3: Nombre]
>     D --> E[✅ Entrega]
> \`\`\`
> Usa máximo 6-8 nodos. Adapta los nombres al contexto real de la práctica.

${metodologiaActiva ? `
### 🔬 4. PROCEDIMIENTO — Siguiendo la metodología: ${metodologiaActiva}
${metodologiaFases && metodologiaFases.length > 0 ? metodologiaFases.map((fase, idx) => `
#### ${fase}
Redacta las instrucciones detalladas que el estudiante debe seguir en esta fase. Usa lenguaje claro, directo, en segunda persona ("deberás", "observa", "registra"). Incluye:
- Acciones concretas a realizar (mínimo 3-5 pasos numerados)
- Qué resultado o evidencia se espera al terminar esta fase
- Dónde registrar sus observaciones o resultados
`).join('\n') : `
Redacta el procedimiento paso a paso (mínimo 8 pasos numerados) en lenguaje claro para el estudiante:
1. Paso uno: descripción clara de lo que debe hacer
2. Paso dos: ...
...
Indica claramente en qué momento registrar observaciones y qué evidencia construir.
`}` : `
### 🔬 4. PROCEDIMIENTO (Paso a Paso)
Redacta el procedimiento completo paso a paso (mínimo 10 pasos numerados) en lenguaje claro, directo para el estudiante (segunda persona). Cada paso debe ser concreto y ejecutable. Indica en qué pasos registrar datos o construir evidencias.
`}

---

### 📊 5. REGISTRO DE DATOS Y OBSERVACIONES
Proporciona una tabla o formato de registro que el estudiante llena durante la práctica. Diseña el formato según el tipo de actividad:
- Si es experimental: tabla de datos con columnas (Variable, Valor medido, Unidad, Observación)
- Si es de programación: cuadro para pegar capturas de pantalla o código con su descripción
- Si es de campo o comunidad: formato de entrevista o diagnóstico con preguntas guía
- Si es de diseño/manufactura: lista de verificación de características del producto

---

### 💡 6. PREGUNTAS DE ANÁLISIS Y REFLEXIÓN
Redacta exactamente 6 preguntas de análisis progresivas, ordenadas de menor a mayor complejidad cognitiva (Bloom). Las preguntas deben:
1. (Recordar) ¿Qué es/son...? Definición técnica básica.
2. (Comprender) ¿Cómo funciona/por qué ocurre...?
3. (Aplicar) ¿Cómo aplicarías lo aprendido en...?
4. (Analizar) ¿Cuál es la diferencia entre... y...?
5. (Evaluar) ¿Qué mejorarías de tu procedimiento y por qué?
6. (Crear) ¿Cómo relacionas lo que practicaste con la problemática "${paecProblem}"? ¿Qué solución propones?

---

### 🏆 7. EVIDENCIA DE APRENDIZAJE (PRODUCTO ENTREGABLE)
Describe con claridad qué entrega el estudiante al terminar la práctica:
- **Nombre del producto:** (ej: Reporte de práctica, prototipo, base de datos, maqueta, presentación, código fuente documentado)
- **Formato:** (físico impreso / digital / fotografía / video corto)
- **Criterios mínimos de calidad:** Lista de 4-5 características que debe cumplir el producto para considerarse completo.

---

### 📝 8. AUTOEVALUACIÓN DEL ESTUDIANTE
Tabla de autoevaluación formativa que el propio estudiante completa al finalizar la práctica:
| Aspecto | Lo logré totalmente | Lo logré parcialmente | Necesito apoyo |
|---------|--------------------|-----------------------|----------------|
| Comprendí el propósito de la práctica | ☐ | ☐ | ☐ |
| Seguí el procedimiento con orden | ☐ | ☐ | ☐ |
| Registré correctamente mis datos | ☐ | ☐ | ☐ |
| Respondí las preguntas de análisis | ☐ | ☐ | ☐ |
| Puedo explicar qué aprendí y para qué sirve | ☐ | ☐ | ☐ |

**Comentario de reflexión personal:**
¿Qué fue lo más difícil y cómo lo resolví?
________________________________________________________

---

### ⚠️ 9. NORMAS DE SEGURIDAD E HIGIENE (si aplica)
Si la práctica involucra trabajo en taller, laboratorio, uso de herramientas, productos químicos, electricidad o trabajo en campo, lista las normas de seguridad obligatorias. Si NO aplica, escribe "Esta práctica no requiere medidas especiales de seguridad."

---

REGLAS DE REDACCIÓN:
- Escribe todo en segunda persona del singular ("deberás", "observa", "registra", "construye").
- Usa lenguaje claro, accesible para jóvenes de 15-18 años de bachillerato en Puebla.
- NO uses marcadores de posición como "[aquí escribe]" o "[completar]" — todo el contenido debe ser real, concreto y útil.
- Contextualiza ejemplos y actividades en la realidad de comunidades del Estado de Puebla (zonas rurales, ciudades medias, actividades productivas locales).
- La guía debe ser suficientemente detallada para que el estudiante la ejecute de forma AUTÓNOMA, sin necesidad de instrucciones adicionales del docente.
- Total aproximado: 1,200 a 2,000 palabras.
`;

