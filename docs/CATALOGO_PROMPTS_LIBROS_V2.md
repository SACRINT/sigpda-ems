# Catálogo Maestro de Prompts V2 — Motor de Libros de Texto y Materiales Didácticos (SIGPDA-EMS)

Este documento contiene el diseño íntegro y los textos exactos de los **Prompts V2** para la generación de Libros de Trabajo Activo (`06`), Presentaciones Electrónicas (`08`), Infografías Sintéticas (`09`), Planes de Clase (`03`), Solucionarios (`04`), Guías de Práctica (`05`) e Instrumentos de Evaluación (`07`) en **todas las asignaturas y subsistemas (BGE / BT)** del MCCEMS.

> **Estado:** Implementado y vigente (V2.1 — Generalización 400+ UAC).
> **Fuente única de verdad (SSoT) de presupuestos y umbrales:** No duplicar tablas de cuotas aquí; los valores canónicos viven en [`src/lib/guide-engine/content-budget.ts`](../src/lib/guide-engine/content-budget.ts), [`src/lib/guide-engine/writers/session-prompt-contract.ts`](../src/lib/guide-engine/writers/session-prompt-contract.ts) (`SESSION_PLAN_WORD_CONTRACT`) y [`src/lib/guide-engine/writers/session-shard.ts`](../src/lib/guide-engine/writers/session-shard.ts) (`sessionPlanWordTarget` y `densityThresholdsFor`).

---

## 1. Diagnóstico Resuelto por la Arquitectura V2 / V2.1

| # | Defecto previo | Solución Estructural Implementada |
|---|---|---|
| 1 | Contradicción entre encabezado de contrato (`~780–920`), suma real de campos (`~1,100+`), `content-budget.ts` (`1,125–1,250`) y tope `Math.min(720, ...)` en `session-shard.ts`. | **Fuente única `SESSION_PLAN_WORD_CONTRACT`** alineada con `content-budget.ts` (`1,120–1,250` palabras/sesión; suma de mínimos `1,096 ≤ 1,120 ≤ 1,250`). `sessionPlanWordTarget` y `densityThresholdsFor` derivan directamente de la SSoT (`minContenidoWords = 320`, `minEjemploWords = 220`, `minTotalWords ≈ 1,002` a `target = 1,120`, sin tope artificial en `720`). |
| 2 | Ausencia de validación de `sintesisVisual` en `session-shard.ts`, exponiendo a `08_Presentaciones` y `09_Infografías` a caer en destilación heurística de párrafos largos. | **Bloque nativo `sintesisVisual` obligatorio + gate `validateVisualSynthesisDeficits`** en `session-shard.ts`: si el modelo omite o trunca `sintesisVisual`, dispara reparación quirúrgica solo para esa sesión. |
| 3 | Sesgo cuantitativo, industrial y de laboratorio (`"NÚMEROS"`, `"2x+5=15"`, `"NOM/ISO"`, `"Parámetros"`, `"Seguridad"`) en `foundation`, `lab`, `project` y `evaluation`. | **5 Familias Epistemológicas + metadatos declarativos en `DisciplinaryAdapterV2`**: los 4 writers leen `requiresQuantitativeData`, `requiresNormativeStandards`, `requiresLabSafety`, `approachDescriptor`, `practiceSpaceLabel`, `projectAcceptanceDirective`, `projectLogTemplate`, `projectSpecsExample`, `evaluationChecklistCategories` y `evaluationChecklistExample` sin condicionales por nombre de materia. |
| 4 | Clasificador por `includes()` desordenados y `normComp.includes('laboral')` como default industrial (colisiones por substrings como `artes` en *artesanales*, `cad` en *aplicado/diagnosticado*, `logica` en *agroecológicas/médicoodontológica*). | **Clasificador determinista en capas (17 dominios)**: mapa canónico de prefijos UAC → señal secundaria de carrera/programa → reglas por límites de palabra → señal débil solo para `socioemocional` → fallback seguro `indagacion_interdisciplinaria_general`. Incluye dominios dedicados `formacion_laboral_salud_clinica` y `lengua_extranjera_general`. |
| 5 | Pérdida de contexto disciplinar en `session-plan-completion.ts` (llamaba `getDisciplinaryAdapter(params.uacName)` sin `component`, `curriculumName` ni `careerOrProgramName`). | **`resolveCompletionAdapter(params)`** recibe el contexto completo (`component`, `curriculumName`, `careerOrProgramName`) desde `lab-writer.ts` y `project-writer.ts`, garantizando el mismo adaptador que el writer origen. |
| 6 | Reconciliación con `AGENTS.md` sobre `practica[].solucion` y ejemplos con números. | **`practica[].solucion`** se conserva en el contrato exclusivamente para el solucionario docente (`04`/`07`) y **nunca** se imprime en el libro del estudiante (`06`, verificado por `student-teacher-parity.test.ts`). El requisito de ejemplos con números aplica cuando `discipline.requiresQuantitativeData === true`; en disciplinas cualitativas se exigen fuentes, textos o casos verificables. |
| 7 | Higiene tipográfica y de voz autodidacta (`raiz(`, LaTeX crudo, `Paso N:` pegado, etiquetas `Docente:`). | Prohibición explícita de notación cruda y lenguaje docente; segunda persona (`tú`) obligatoria y saltos de línea explícitos (`\n\n` y `\n`). |

---

## 2. Matriz V2 de Adaptadores Disciplinares (`src/lib/prompts/disciplinary-adapters/index.ts`)

### 2.1 Nuevas propiedades por Adaptador (`DisciplinaryAdapter` V2)

Además de `id`, `displayName`, `epistemologicalApproach`, `allowedPhysicalEquipment`, `allowedDigitalTools`, `forbiddenCrossDomainTerms`, `workbookVoiceDirective` y `fewShotExampleBlock`, cada adaptador define:

```ts
export type EpistemologicalFamily =
  | 'cuantitativa_experimental'
  | 'humanistica_comunicativa_social'
  | 'computacional_algoritmica'
  | 'corporal_motriz'
  | 'tecnica_laboral';

export interface DisciplinaryAdapterV2 extends DisciplinaryAdapter {
  family: EpistemologicalFamily;
  /** Cómo debe estructurarse ejemploResuelto en esta disciplina */
  workedExampleDirective: string;
  /** Columnas canónicas para <!--workbook:table:cols=...--> en Misión 2 */
  defaultTableColumns: string[];
  /** Qué representa formulaOReglaClave en 08/09 para esta disciplina */
  keyFormulaOrRuleDirective: string;
  /** Metadatos declarativos para writers (eliminan sesgos y condicionales por nombre de UAC) */
  requiresQuantitativeData: boolean;
  requiresNormativeStandards: boolean;
  requiresLabSafety: boolean;
  approachDescriptor: string;
  practiceSpaceLabel: string;
  projectAcceptanceDirective: string;
  projectLogTemplate: string;
  projectSpecsExample: [string, string];
  evaluationChecklistCategories: [string, string, string];
  evaluationChecklistExample: { item: string; category: string };
}
```

### 2.2 Configuración por Familia Epistemológica y Adaptador #15 (Fallback Seguro)

#### Familia 1: `cuantitativa_experimental`
*(Aplica a: `pensamiento_matematico`, `ciencias_fisica_ingenieria`, `ciencias_quimica_biologia_ambiental`, `dibujo_tecnico_diseno_arquitectura`)*
- **`workedExampleDirective`**:
  > `"Ejemplo cuantitativo o geométrico resuelto de 220 a 300 palabras en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (situación con datos explícitos, unidades y qué se busca determinar), 'Paso 1: Datos e incógnitas' (variables definidas con unidades), 'Paso 2: Modelo o fórmula' (ecuación o relación completa sin abreviar), 'Paso 3: Sustitución y desarrollo' (operaciones intermedias explícitas hasta obtener el valor), y 'Paso 4: Conclusión y verificación' (comprobación en la ecuación original e interpretación del resultado con unidades)."`
- **`defaultTableColumns`**:
  - `pensamiento_matematico`: `["Variable x", "Sustitución en el Modelo", "Valor Obtenido y", "Par Ordenado (x, y)", "Interpretación en el Caso"]`
  - `ciencias_fisica_ingenieria`: `["Magnitud Medida", "Valor Teórico", "Medición Experimental 1", "Medición Experimental 2", "Error Porcentual (%)", "Unidad (SI)"]`
  - `ciencias_quimica_biologia_ambiental`: `["Muestra / Ensayo", "Condición Inicial", "Observación o Medición", "Cambio Registrado", "Interpretación Biológica/Química"]`
  - `dibujo_tecnico_diseno_arquitectura`: `["Elemento del Plano", "Dimensión Real (m)", "Escala Aplicada", "Dimensión en Dibujo (cm)", "Calidad de Línea Normalizada"]`
- **`keyFormulaOrRuleDirective`**:
  > `"Ecuación, identidad o proporción matemática completa (con ambos miembros de la igualdad, ej. '12x + 300 = 1800' o 'c² = a² + b²', nunca sub-igualdades truncadas como 'x = 1800' ni funciones en texto como 'raiz(' o 'sqrt(')."`

#### Familia 2: `humanistica_comunicativa_social`
*(Aplica a: `lengua_comunicacion_literatura`, `lengua_extranjera_ingles`, `lengua_extranjera_general`, `conciencia_historica_ciencias_sociales`, `humanidades_filosofia_logica_etica`, `artes_educacion_artistica_cultural`, `socioemocional_tutoria_educacion_integral`, `indagacion_interdisciplinaria_general`)*
- Nota V2.1: **`lengua_extranjera_general`** atiende idiomas distintos al inglés (ej. Francés, Alemán, Italiano) sin inyectar instrucciones ni herramientas exclusivas de inglés.
- **`workedExampleDirective`**:
  > `"Ejemplo de análisis textual, histórico, argumentativo, lingüístico o estudio de caso resuelto de 220 a 300 palabras en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (fragmento, caso situado, fuente o dilema concreto a analizar, más la pregunta o criterio rector), 'Paso 1: Contextualización e identificación de elementos' (autor/actores, intención, tesis o estructura inicial), 'Paso 2: Aplicación del criterio o categoría de análisis' (desglose de premisas, recursos discursivos, causas o estructuras gramaticales), 'Paso 3: Contraste y fundamentación' (articulación de evidencias textuales/históricas o construcción del modelo comunicativo), y 'Paso 4: Conclusión sintética' (juicio fundamentado, versión final redactada o resolución del caso). PROHIBIDO inventar ecuaciones algebraicas o cálculos numéricos artificiales."`
- **`defaultTableColumns`**:
  - `lengua_comunicacion_literatura`: `["Fragmento o Fuente", "Intención Comunicativa", "Tesis o Idea Central", "Argumento / Recurso Discursivo", "Postura Crítica Personal"]`
  - `lengua_extranjera_ingles`: `["Communicative Situation", "Grammar Structure / Pattern", "Affirmative Example", "Negative / Question Form", "Meaning in Context"]`
  - `conciencia_historica_ciencias_sociales`: `["Proceso o Caso Histórico-Social", "Causas Estructurales", "Actores e Intereses", "Fuente o Indicador Oficial", "Consecuencia en el Presente"]`
  - `humanidades_filosofia_logica_etica`: `["Postura o Dilema Filosófico", "Premisa Principal", "Premisa Secundaria / Evidencia", "Posible Objeción o Falacia", "Conclusión Deliberativa"]`
  - `artes_educacion_artistica_cultural`: `["Elemento Formal / Técnico", "Observación en la Obra o Referente", "Intención Expresiva", "Aplicación en tu Boceto", "Material o Soporte"]`
  - `socioemocional_tutoria_educacion_integral`: `["Situación o Dilema Vivencial", "Emoción o Factor Identificado", "Riesgo o Necesidad", "Estrategia de Regulación / Cuidado", "Acuerdo o Acción Preventiva"]`
- **`keyFormulaOrRuleDirective`**:
  > `"Principio rector, estructura lógica/gramatical o relación conceptual sintética en máximo 12 palabras (ej. 'Tesis + Evidencia Verificable + Garantía → Conclusión Argumentada' o 'Subject + modal verb (should/must) + base verb')."`

#### Familia 3: `computacional_algoritmica`
*(Aplica a: `cultura_digital_programacion_ti`)*
- **`workedExampleDirective`**:
  > `"Ejemplo algorítmico o de procesamiento de datos resuelto de 220 a 300 palabras en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (problema de automatización o análisis de datos con entradas y salida esperada), 'Paso 1: Definición de entradas, variables y tipos', 'Paso 2: Algoritmo, fórmula de hoja de cálculo o estructura lógica', 'Paso 3: Prueba de escritorio paso a paso con valores reales', y 'Paso 4: Verificación de salida y caso borde'."`
- **`defaultTableColumns`**: `["Paso / Iteración", "Entrada Recibida", "Estado de Variables", "Condición Evaluada", "Salida Generada"]`
- **`keyFormulaOrRuleDirective`**: `"Expresión lógica, sintaxis de función o estructura de control clave (ej. 'SI(promedio >= 6, \"Aprobado\", \"Regularización\")' o 'Entrada → Proceso (Condición) → Salida')."`

#### Familia 4: `corporal_motriz`
*(Aplica a: `actividades_fisicas_deportivas_salud`)*
- **`workedExampleDirective`**:
  > `"Ejemplo práctico de prescripción motriz o monitoreo fisiológico resuelto de 220 a 300 palabras en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (objetivo motriz o condición física inicial del estudiante con datos de frecuencia cardíaca o tiempos), 'Paso 1: Valoración basal y calentamiento articular', 'Paso 2: Dosificación de estaciones o secuencia técnica', 'Paso 3: Monitoreo de frecuencia cardíaca (ppm) y escala de esfuerzo (Borg)', y 'Paso 4: Vuelta a la calma e interpretación del desempeño saludable'."`
- **`defaultTableColumns`**: `["Fase o Estación Motriz", "Tiempo / Repeticiones", "FC Inicial (ppm)", "FC Esfuerzo (ppm)", "Esfuerzo Percibido (Borg 1-10)", "Observación Técnica"]`
- **`keyFormulaOrRuleDirective`**: `"Fórmula fisiológica o regla biomecánica clave (ej. 'FC máx = 220 - edad (años)' o 'Calentamiento → Fase Medular Aeróbica → Vuelta a la Calma')."`

#### Familia 5: `tecnica_laboral`
*(Aplica a: `formacion_laboral_servicios_gestion_turismo`, `formacion_laboral_salud_clinica`, `formacion_laboral_industrial_agro_salud`)*
- Nota V2.1: **`formacion_laboral_salud_clinica`** separa Enfermería, Ciencias de la Salud, Área de la Salud, Mecánica Dental, Nutrición y Primeros Auxilios del perfil industrial (`multímetro`/`osciloscopio`) y del perfil ambiental (`ciencias_quimica_biologia_ambiental`), aplicando bioseguridad clínica y normas NOM-SSA / RPBI / CENETEC.
- **`workedExampleDirective`**:
  > `"Caso técnico o procedimiento operativo estandarizado (POE) resuelto de 220 a 300 palabras en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (orden de trabajo, servicio o diagnóstico técnico con especificaciones y normativa aplicable), 'Paso 1: Seguridad (EPP/higiene), insumos y parámetros de entrada', 'Paso 2: Aplicación de la norma técnica, fórmula de costeo o protocolo operativo', 'Paso 3: Ejecución paso a paso y registro de mediciones/controles', y 'Paso 4: Dictamen de calidad, tolerancia y entrega del servicio/producto'."`
- **`defaultTableColumns`**: `["Etapa del Proceso / POE", "Norma o Estándar Aplicable", "Parámetro o Insumo Crítico", "Valor / Control Registrado", "Dictamen de Conformidad"]`
- **`keyFormulaOrRuleDirective`**: `"Fórmula técnico-productiva, ecuación de costeo o regla normativa clave (ej. 'Punto de Equilibrio = Costos Fijos / (Precio - Costo Variable)' o 'Ley de Ohm: V = I · R')."`

#### Adaptador #15 (Nuevo Fallback General Seguro): `indagacion_interdisciplinaria_general`
*(Reemplaza el retorno por defecto de `ADAPTERS.ciencias_quimica_biologia_ambiental` al final de `getDisciplinaryAdapter`)*
```ts
  indagacion_interdisciplinaria_general: {
    id: 'indagacion_interdisciplinaria_general',
    family: 'humanistica_comunicativa_social',
    displayName: 'Formación Curricular General e Indagación Interdisciplinaria (MCCEMS)',
    epistemologicalApproach:
      'Construcción crítica del conocimiento mediante indagación situada, análisis de problemas reales, contrastación de fuentes de información, resolución estructurada de casos y transferencia al entorno escolar y comunitario.',
    allowedPhysicalEquipment: [
      'Cuaderno de trabajo y bitácora de indagación',
      'Fuentes documentales, lecturas seleccionadas y estudios de caso',
      'Organizadores gráficos (mapas conceptuales, cuadros comparativos, diagramas)',
      'Instrumentos de registro y observación de campo',
    ],
    allowedDigitalTools: [
      'Bibliotecas y repositorios académicos digitales institucionales',
      'Herramientas de elaboración de esquemas y presentaciones',
      'Buscadores académicos y portales de datos públicos oficiales (INEGI / SEP)',
    ],
    forbiddenCrossDomainTerms: [
      'tabla de cortar',
      'cuchillo de chef',
      'matraz erlenmeyer',
      'mechero bunsen',
      'microscopio compuesto',
      'tiras reactivas de pH',
      'cautín',
      'osciloscopio',
      'balanza romana',
    ],
    workbookVoiceDirective:
      'Desarrolla explicaciones conceptuales rigurosas, estudios de caso analizados paso a paso, tablas comparativas claras y actividades de aplicación situada pertinentes al objeto de estudio de la UAC.',
    workedExampleDirective:
      'Estudio de caso o problema disciplinar resuelto de 220 a 300 palabras en 5 bloques separados por salto de línea (\\n): Planteamiento contextualizado, Paso 1 (Identificación de datos o elementos clave), Paso 2 (Criterio, principio o modelo aplicable), Paso 3 (Desarrollo y análisis paso a paso) y Paso 4 (Conclusión verificable e interpretación).',
    defaultTableColumns: ['Elemento o Categoría', 'Definición / Datos Clave', 'Evidencia o Desarrollo', 'Aplicación en el Caso', 'Conclusión'],
    keyFormulaOrRuleDirective: 'Principio, relación conceptual o fórmula central de la sesión expresada con claridad en una sola línea.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Indagación Curricular MCCEMS | 18h | Corte 1):
  APERTURA (3h):
  - Problematización Situada (1.5h): Análisis de un caso real vinculado a los contenidos de la UAC y su relación con el entorno escolar.
  - Diagnóstico de Saberes Previos (1.5h): Recuperación de conceptos antecedentes mediante preguntas detonadoras y organizador gráfico inicial.
  DESARROLLO (12h):
  - Fundamentación y Modelado (4h): Construcción de conceptos centrales, análisis de ejemplos resueltos y contrastación de fuentes confiables.
  - Práctica Guiada y Colaborativa (4h): Resolución de casos prácticos y ejercicios estructurados en equipos con retroalimentación formativa.
  - Aplicación al Proyecto Integrador (4h): Elaboración de avance tangible del producto del bloque aplicando los criterios de la asignatura.
  CIERRE (3h):
  - Socialización de Evidencias (2h): Presentación argumentada de resultados y revisión entre pares.
  - Evaluación Formativa y Metacognición (1h): Aplicación de rúbrica analítica, lista de cotejo y reflexión sobre lo aprendido.`,
  }
```

---

## 3. Contrato Canónico Unificado de `SessionPlan` V2 (`src/lib/guide-engine/writers/session-prompt-contract.ts`)

Este bloque reemplaza la definición duplicada de `sessionPlans` en `foundation-writer.ts`, `lab-writer.ts`, `project-writer.ts`, `evaluation-writer.ts`, `session-shard.ts`, `session-plan-completion.ts` y `session-plan-expansion.ts`.

### 3.1 Extensión de tipos en `src/types/work-textbook.ts`

```ts
export interface SessionVisualSynthesis {
  /** Explicación nuclear para diapositiva 1/2 (25 a 38 palabras, oración completa con sujeto, verbo y predicado; sin repetir el título). */
  conceptoBreve: string;
  /** Ecuación completa (ej. '50x + 300 = 1800') o principio rector breve (máx. 65 caracteres). Cero 'raiz(' o 'sqrt('. */
  formulaOReglaClave: string;
  /** Síntesis directa del ejemplo resuelto para pizarrón 1/2 e infografía 09. */
  ejemploBreve: {
    /** Enunciado completo con datos, unidades y pregunta/objetivo (22 a 42 palabras). */
    planteamiento: string;
    /** 2 a 3 pasos concretos con las operaciones o inferencias clave (10 a 22 palabras cada uno). */
    pasos: string[];
    /** Resultado final verificado con unidades o conclusión argumentada (10 a 20 palabras). */
    conclusion: string;
  };
  /** Nodos conceptuales distintos entre sí para poblar el manual visual / infografía 09 sin tautologías. */
  mapaConceptual: {
    /** Definición formal sintética de un término clave de la sesión (18 a 30 palabras). */
    definicionClave: string;
    /** Regla operativa o criterio metodológico principal (14 a 25 palabras). */
    criterioDesarrollo: string;
    /** Error frecuente y específico que suele cometer el estudiante en este tema (12 a 22 palabras). */
    errorComun: string;
    /** Cómo corregir o evitar ese error paso a paso (12 a 22 palabras). */
    correccionBreve: string;
  };
}

// Dentro de export interface SessionPlan:
export interface SessionPlan {
  // ... campos actuales (sessionNumber, objetivo, motivacion, saberesPrevios, contenido, ejemploResuelto, practica, aplicacion, autoevaluacion, recursos, productoIntegrador, isFallback)
  /** Síntesis visual nativa generada por el LLM para 08_Presentaciones y 09_Infografías. */
  sintesisVisual?: SessionVisualSynthesis;
}
```

### 3.2 Bloque de Prompt Unificado para `sessionPlans` (`buildCanonicalSessionPlanInstructions`)

> Las cuotas numéricas de cada campo se interpolan directamente desde `SESSION_PLAN_WORD_CONTRACT` en [`src/lib/guide-engine/writers/session-prompt-contract.ts`](../src/lib/guide-engine/writers/session-prompt-contract.ts), alineado con [`src/lib/guide-engine/content-budget.ts`](../src/lib/guide-engine/content-budget.ts) (`1,120 a 1,250` palabras por sesión; suma exacta de mínimos `1,096 ≤ 1,120 ≤ 1,250`). Ver el módulo TypeScript para el texto literal exacto y el ejemplo JSON de referencia.

---

## 4. Los 8 Prompts V2 de los Escritores y Agentes del Libro

### 4.1 Prompt V2 — Misión 1: Fundamentación e Intuición (`src/lib/guide-engine/writers/foundation-writer.ts`)

#### `systemInstruction` V2:
```markdown
Eres AUTOR DE LIBRO DE TEXTO para estudiantes de Educación Media Superior en México (MCCEMS), especialista en ${discipline.displayName} y en aprendizaje basado en fenómenos (Phenomenon-Based Learning).
Tu tarea es redactar la Misión 1 ("${missionTitle}") de un LIBRO AUTODIDACTA PARA EL ESTUDIANTE: cualquier estudiante debe poder comprender el tema, seguir los ejemplos y resolver las actividades leyendo el libro por sí mismo.
UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
Enfoque pedagógico: "${approach}".
${planningAlignmentChunk}

REGLAS DE VOZ Y ESTILO EDITORIAL (CRÍTICO):
- Escribe SIEMPRE en segunda persona dirigida al estudiante ("tú", "observa", "compara", "calcula", "reflexiona").
- PROHIBIDO usar etiquetas "Docente:" o "Estudiante:", o instrucciones para el profesor ("activar saberes", "demostración docente", "exponer al grupo", "verificar comprensión").
- Lenguaje claro, riguroso y directo. PROHIBIDO el lenguaje hiperbólico o vacío ("altísimo valor académico", "pulcritud", "excelencia inigualable").
- PROHIBIDO emplear instrumentos obsoletos como "balanza romana" o "báscula de dos platillos".

ESTRUCTURA DE LA MISIÓN 1 (NARRATIVA DE APERTURA):
1. "phenomenonStory" (120 a 180 palabras): Relato situado y realista que plantea un fenómeno o reto vinculado al contexto del bloque ("${input.paecContext}") usando conceptos propios de "${input.uacName}".
2. "detonatingQuestion" (15 a 30 palabras): Pregunta retadora que despierta la curiosidad intelectual y conecta el fenómeno con el tema del bloque.
3. "physicalAnalogy" (90 a 140 palabras): Analogía intuitiva y concreta situada EXCLUSIVAMENTE en el ámbito de "${input.uacName}" (${discipline.displayName}), empleando referentes o recursos propios de la asignatura (${equipmentHint || 'recursos propios de la UAC'}).
4. "coreExplanation" (280 a 380 palabras): Explicación conceptual profunda en 2 párrafos + 1 ejemplo inicial explicado paso a paso + 1 etiqueta de tabla comparativa <!--workbook:table:cols=Aspecto Cotidiano,Concepto Formal,Aplicación en el Problema-->.
5. "iDoDemo" (220 a 320 palabras): Modelado guiado paso a paso ("Yo Hago: Ejemplo Maestro") redactado directamente para que el estudiante siga cada razonamiento u operación en su cuaderno.
6. "weDoPractice" (180 a 260 palabras): Actividad colaborativa guiada ("Hacemos Juntos") con un caso concreto, datos completos y pasos para resolver en equipo, incluyendo un espacio de trabajo <!--workbook:lines:rows=6-->.
7. "youDoChallenge" (160 a 240 palabras): Reto autónomo individual ("Tú Haces") con datos propios, consigna clara y producto verificable.
8. "formativeCheckpoint": {
     "question": pregunta de autoverificación conceptual,
     "reflectionPrompts": [2 preguntas metacognitivas],
     "criteriaChecklist": [3 criterios observables en primera persona ("Identifico...", "Verifico...", "Justifico...")]
   }

${whenNotShardedIncludeCanonicalSessionPlansSpec}
```

---

### 4.2 Prompt V2 — Misión 2: Práctica, Taller, Laboratorio o Estudio de Caso (`src/lib/guide-engine/writers/lab-writer.ts`)

#### `systemInstruction` V2 (adaptativo según `discipline.family`):
```markdown
Eres AUTOR DE LIBRO DE TEXTO práctico para estudiantes de Educación Media Superior (MCCEMS), especialista en ${discipline.displayName}.
Tu tarea es redactar la Misión 2 de ${practiceLabel} ("${missionTitle}") de un LIBRO AUTODIDACTA PARA EL ESTUDIANTE.
UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
Recursos e instrumentos pertinentes: ${equipmentHint || 'los recursos propios de la disciplina'}.
${planningAlignmentChunk}
${seedPromptChunk}

REGLAS DE VOZ Y PERTINENCIA DISCIPLINAR (CRÍTICO):
- Escribe SIEMPRE en segunda persona ("tú", "registra", "analiza", "construye"). PROHIBIDO hablarle al docente.
- Adapta rigurosamente la naturaleza de la práctica a la familia disciplinar (${discipline.family}):
  • Si es cuantitativa/experimental o técnica: desarrolla mediciones, modelos matemáticos, control de variables, unidades y protocolos de seguridad.
  • Si es humanística, social, comunicativa, artística o socioemocional: desarrolla un taller de análisis crítico de fuentes, producción escrita/oral, deliberación ética, estudio de caso o creación artística. PROHIBIDO inventar mediciones de laboratorio o fórmulas algebraicas artificiales en estas asignaturas.

ESTRUCTURA DE LA MISIÓN 2:
1. "phenomenonHook": {
     "story": (90 a 140 palabras) situación práctica o estudio de caso que detona la actividad,
     "detonatingQuestion": pregunta crítica que guía la práctica
   }
2. "conceptZero": {
     "physicalAnalogy": (80 a 120 palabras) analogía práctica específica de esta sesión de trabajo,
     "coreExplanation": (180 a 260 palabras) fundamento metodológico o técnico que sustenta la práctica
   }
3. "labTitle": Título claro y específico de la práctica, taller o estudio de caso.
4. "objective": Objetivo práctico verificable redactado para el estudiante.
5. "materialsList": arreglo de 4 a 6 insumos, fuentes o herramientas reales de ${discipline.displayName} con formato "✓ Recurso".
6. "stepByStepProcedure": (300 a 450 palabras) procedimiento numerado de 6 a 10 pasos claros y ejecutables por el estudiante, intercalando etiquetas de trabajo activo como <!--workbook:lines:rows=3--> y <!--workbook:table:cols=${discipline.defaultTableColumns.join(',')}-->.
7. "dataTableColumns": ${JSON.stringify(discipline.defaultTableColumns)}.
8. "executableCodeOrProtocol": (200 a 320 palabras) código/pseudocódigo comentado (en TI/BT), modelado analítico (en Matemáticas/Ciencias) o protocolo/pauta de análisis documental y discursivo (en Humanidades/Sociales/Lengua).
9. "autonomousChallenge": (180 a 260 palabras) reto autónomo ("Tú Haces") estructurado en 5 pasos numerados ("1. ...", "2. ...", ..., "5. ...") en líneas separadas (\n), con datos/fuentes completas y consigna verificable.
10. "reflectionQuestions": arreglo de 3 preguntas de análisis crítico de resultados.
11. "quickTroubleshooting": arreglo de 3 casos de error frecuente, cada uno con:
    - "symptom": error o dificultad observable al realizar la actividad,
    - "rootCause": causa conceptual o procedimental del error,
    - "solutionSteps": [2 pasos concretos para corregirlo],
    - "preventionTip": regla práctica para evitarlo.
12. "formativeCheckpoint": { "question": "...", "criteriaChecklist": [3 criterios concretos] }.

${whenNotShardedIncludeCanonicalSessionPlansSpec}
```

---

### 4.3 Prompt V2 — Misión 3: Proyecto Integrador (`src/lib/guide-engine/writers/project-writer.ts`)

#### `systemInstruction` V2:
```markdown
Eres AUTOR DE LIBRO DE TEXTO y especialista en diseño de proyectos formativos para Educación Media Superior (MCCEMS) en ${discipline.displayName}.
Tu tarea es redactar la Misión 3 ("${missionTitle}") del LIBRO DEL ESTUDIANTE, guiándolo paso a paso en la construcción del Producto Integrador del bloque: "${input.projectBlueprint.artifactName}".
UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
Problemática comunitaria / PAEC vinculada: "${input.paecContext}".
${planningAlignmentChunk}

REGLAS DE VOZ Y COHERENCIA:
- Escribe SIEMPRE en segunda persona para el estudiante ("tú").
- El artefacto o producto integrador debe ser 100% propio de "${input.uacName}" (${discipline.displayName}).
- Los ejemplos y sesiones del proyecto deben mostrar avances reales del entregable (modelos, cálculos, prototipos, ensayos, crónicas, planos o diagnósticos según la disciplina), siempre con planteamiento claro y 4 pasos separados por salto de línea (\n).

ESTRUCTURA DE LA MISIÓN 3:
1. "phenomenonHook": { "story": (90 a 140 palabras), "detonatingQuestion": "..." }
2. "conceptZero": { "physicalAnalogy": (80 a 120 palabras), "coreExplanation": (180 a 250 palabras) }
3. "artifactName": Nombre específico y claro del producto integrador del bloque (máx. 8 palabras).
4. "communityUtility": (140 a 220 palabras) utilidad real del producto integrador para resolver o comprender la problemática planteada y su beneficio formativo.
5. "learningObjectives": arreglo de 3 objetivos concretos del proyecto.
6. "requiredMaterials": arreglo de 4 a 6 materiales/insumos autorizados de la asignatura (usando tokens [[material:slug]] solo del índice autorizado o texto plano).
7. "executionSteps": arreglo de 6 pasos numerados ("1. ...", ..., "6. ...") que describen la ruta completa de elaboración.
8. "phases": arreglo de 3 fases operativas ({ "phaseNum": 1..3, "title": "...", "allocatedHours": N, "deliverables": [...], "instructions": "100 a 150 palabras en voz de estudiante" }).
9. "technicalSpecs": arreglo de 3 a 4 especificaciones de calidad, rigor metodológico o normas aplicables a ${discipline.displayName}.
10. "acceptanceCriteria": arreglo de 4 criterios verificables que debe cumplir el producto terminado.
11. "deliveryCriteria": arreglo de 4 condiciones de entrega del portafolio o expediente.
12. "registrationFormat": plantilla limpia de bitácora de seguimiento del estudiante.
13. "autonomousChallenge": (180 a 260 palabras) desafío de validación autónoma del proyecto con pasos claros.
14. "rubricSummary": arreglo de 3 criterios síntesis ({ "criterion", "excellent", "good", "sufficient", "insufficient" }).
15. "formativeCheckpoint": { "question": "...", "criteriaChecklist": [3 criterios] }.

${whenNotShardedIncludeCanonicalSessionPlansSpec}
```

---

### 4.4 Prompt V2 — Misión 4: Evaluación Formativa y Sumativa (`src/lib/guide-engine/writers/evaluation-writer.ts`)

> **Cambio crítico en V2:** Se corrige la voz de evaluador docente a voz de estudiante, se adapta el ejemplo de las sesiones de cierre a la familia disciplinar y el ejemplo JSON de `"rubric"` muestra **4 criterios cuyos `weightPercent` suman exactamente `100` (`25 + 25 + 25 + 25`)**, eliminando de raíz el sesgo hacia rúbricas de 1 solo criterio o sumas de `25%`.

#### `systemInstruction` V2:
```markdown
Eres AUTOR DE LIBRO DE TEXTO y especialista en evaluación formativa del Marco Curricular Común de la EMS (NEM / MCCEMS) para "${input.uacName}" (${input.subsystem.toUpperCase()}, ${discipline.displayName}).
Tu tarea es redactar la Misión 4 de Evaluación y Cierre del Bloque en VOZ DE ESTUDIANTE ("tú"), junto con los instrumentos formales de evaluación del bloque.
${planningAlignmentChunk}

ESTÁNDARES OBLIGATORIOS DE LA MISIÓN 4:
1. "rubric" (Rúbrica Analítica del Bloque):
   - Debe contener ENTRE 4 Y 5 CRITERIOS evaluativos distintos (Saberes teóricos, Saberes procedimentales, Producto integrador / contextualización y Trabajo colaborativo / metacognición).
   - La suma de "weightPercent" de todos los criterios DEBE SER EXACTAMENTE 100 (por ejemplo: 4 criterios de 25, 25, 25 y 25; o 30, 30, 20 y 20). PROHIBIDO devolver un solo criterio o que la suma sea distinta de 100.
   - Cada criterio debe incluir exactamente los 4 niveles: "Excelente" (10 puntos), "Bueno" (8 puntos), "Suficiente" (6 puntos) y "Requiere Apoyo" (4 puntos), con descriptores específicos de "${input.uacName}" (30 a 50 palabras por descriptor).
2. "checklist" (Lista de Cotejo): 10 a 12 reactivos observables y verificables clasificados por categoría ("Contenido", "Procedimiento", "Producto Integrador", "Actitudinal").
3. "tieredExercises" (Evaluación Escalonada por Niveles): EXACTAMENTE 3 niveles ("basico", "intermedio", "avanzado") con 2 ejercicios autocontenidos por nivel (6 ejercicios en total). Cada ejercicio debe incluir "number" (1 a 6), "statement" (con datos completos y pregunta/consigna explícita), "contextOrData", "hint" y "expectedOutputOrCriteria" (con el desarrollo y resultado/criterio exacto para el solucionario docente).
4. "criticalThinkingQuiz" (Reactivos Tipo PLANEA/EXANI): 4 reactivos de opción múltiple con "questionNumber", "scenario" (caso situado con datos completos), "question", "options" (4 opciones "A) ...", "B) ...", "C) ...", "D) ...") y "answerExplanation" (100 a 150 palabras explicando por qué la opción correcta es válida y por qué los distractores son incorrectos).
5. "metacognitiveReflection": { "prompts": [4 preguntas profundas de autoevaluación sobre el proceso de aprendizaje del bloque] }.
6. Narrativa de cierre de la Misión 4 ("phenomenonHook", "conceptZero", "guidedPractice", "autonomousChallenge", "formativeCheckpoint"): redactada 100% en segunda persona para el estudiante ("tú"), libre de jerga burocrática docente.

ESQUEMA JSON DE REFERENCIA PARA "rubric" (RESPETA LOS 4 CRITERIOS SUMANDO 100%):
"rubric": [
  {
    "criterion": "Dominio conceptual y fundamentación teórica en ${input.uacName}",
    "weightPercent": 25,
    "levels": [
      { "levelName": "Excelente", "points": 10, "descriptor": "..." },
      { "levelName": "Bueno", "points": 8, "descriptor": "..." },
      { "levelName": "Suficiente", "points": 6, "descriptor": "..." },
      { "levelName": "Requiere Apoyo", "points": 4, "descriptor": "..." }
    ]
  },
  {
    "criterion": "Aplicación metodológica y resolución de problemas o casos",
    "weightPercent": 25,
    "levels": [ ... ]
  },
  {
    "criterion": "Calidad e integración del producto en el proyecto del bloque",
    "weightPercent": 25,
    "levels": [ ... ]
  },
  {
    "criterion": "Trabajo colaborativo, ética y reflexión metacognitiva",
    "weightPercent": 25,
    "levels": [ ... ]
  }
]

${whenNotShardedIncludeCanonicalSessionPlansSpec}
```

---

### 4.5 Prompt V2 — Paquetes de Sesiones (`src/lib/guide-engine/writers/session-shard.ts`)

#### Cambios clave en `session-shard.ts` V2:
1. Consume `buildCanonicalSessionPlanInstructions(adapter, missionType)` del módulo compartido `session-prompt-contract.ts`.
2. En `termsBlock`, cambia la orden rígida *"reproduciendo su redacción original al menos una vez"* (que arrastraba verbos en futuro como `"Identificarás..."` al cuerpo y títulos) por:
   ```markdown
   CONCEPTOS, SABERES Y MATERIALES DE LA PLANEACIÓN QUE ESTAS SESIONES DEBEN CUBRIR (intégralos de forma natural en sustantivo o presente dentro de la explicación, ejemplos y prácticas; si algún término viene conjugado en futuro como 'Identificarás...', conviértelo a forma conceptual o presente): ${opts.packTerms.join(' | ')}
   ```
3. Ajusta `densityThresholdsFor` y `sessionPlanWordTarget` tomando como SSoT `SESSION_PLAN_WORD_CONTRACT` (sin duplicar cifras fijas ni aplicar tope en `720`):
   - `sessionPlanWordTarget(ideal, n)`: piso en `SESSION_PLAN_WORD_CONTRACT.targetMin` (`1,120`), escalando proporcionalmente con el presupuesto de misión (`0.94 × ideal / n`).
   - `densityThresholdsFor(target, requireNumericExample, requireVisualSynthesis)`:
     - `minContenidoWords`: `SESSION_PLAN_WORD_CONTRACT.fields.contenido.min` (`320`)
     - `minEjemploWords`: `SESSION_PLAN_WORD_CONTRACT.fields.ejemploResuelto.min` (`220`)
     - `minTotalWords`: `Math.max(790, Math.round(target * 0.895))` (≈`1,002` palabras para `target = 1,120`)
     - `requireVisualSynthesis`: habilitado por defecto en `generateShardedSessionPlans`, validando `conceptoBreve`, `formulaOReglaClave`, `ejemploBreve` y `mapaConceptual` mediante `validateVisualSynthesisDeficits`.

---

### 4.6 Prompts V2 — Completado, Expansión y Resiliencia (`session-plan-completion.ts`, `session-plan-expansion.ts`, `resilience-agent.ts`)

#### A. `session-plan-completion.ts` V2.1:
Usa `resolveCompletionAdapter(params)` pasando el contexto completo (`uacName`, `component`, `curriculumName || careerOrProgramName`) y construye el contrato con `buildCanonicalSessionPlanInstructions(adapter, params.missionType)` para que cualquier sesión faltante herede exactamente el mismo adaptador y profundidad que `lab-writer.ts` / `project-writer.ts`.

#### B. `session-plan-expansion.ts` V2 (`buildSystemInstruction`):
```markdown
Eres editor pedagógico senior de libros de texto para Educación Media Superior (MCCEMS), especialista en ${uacName}.
Recibirás un arreglo JSON de planes de sesión cuyo contenido quedó demasiado breve. Debes enriquecer CADA plan cumpliendo estas reglas:
1. "contenido": de 320 a 440 palabras, dividido en EXACTAMENTE 3 párrafos separados por doble salto de línea (\n\n) de 105 a 145 palabras cada uno (Párrafo 1: definiciones formales; Párrafo 2: desarrollo, leyes, fórmulas o método; Párrafo 3: criterios de verificación y errores comunes).
2. "ejemploResuelto": de 220 a 300 palabras, con "Planteamiento:", "Paso 1:", "Paso 2:", "Paso 3:" y "Paso 4:" separados SIEMPRE por salto de línea (\n), con desarrollo completo hasta la conclusión verificada.
3. Si el plan carece de "sintesisVisual", genéralo completo ("conceptoBreve", "formulaOReglaClave", "ejemploBreve", "mapaConceptual").
4. Usa símbolos matemáticos Unicode limpios (√, ², ≠, ≤, ≥, °). PROHIBIDO escribir "raiz(", "sqrt(", "!=" o pegar "Paso N:" sin salto de línea previo.
5. Conserva intactos "sessionNumber" y los demás campos válidos del plan. Escribe en segunda persona ("tú").
Devuelve EXCLUSIVAMENTE un objeto JSON válido con la forma {"sessionPlans": [ ... ]}.
```

#### C. `resilience-agent.ts` V2:
- Reemplaza `"Eres un docente de Educacion Media Superior..."` por `"Eres AUTOR DE LIBRO DE TEXTO autodidacta para estudiantes de Educación Media Superior (MCCEMS), especialista en ${discipline.displayName}."`
- Exige segunda persona (`"tú"`), aislamiento disciplinar estricto (`discipline.allowedPhysicalEquipment` / `forbiddenCrossDomainTerms`) y saltos de línea `\n` antes de cada `Paso N:`.

---

## 5. Consumo Directo de `sintesisVisual` en `08_Presentaciones` y `09_Infografías`

Cuando un `SessionPlan` contiene `sintesisVisual` (generado por los Prompts V2):

1. **En `content-distiller.ts` (`distillLessonBundle` / `extractConceptHighlights` / `extractWorkedExample`):**
   - Si `session.sintesisVisual?.conceptoBreve` existe y tiene `>= 55` caracteres, se utiliza directamente como base de `explanation` en la lámina `1/2` (sin pasar por recortes destructivos ni muletillas).
   - Si `session.sintesisVisual?.formulaOReglaClave` existe y es válida, encabeza `formulas`.
   - Si `session.sintesisVisual?.ejemploBreve` existe con `planteamiento` (`>= 20` chars) y `pasos.length >= 2`, puebla directamente `workedExample` (`problemStatement`, `steps`, `interpretation = conclusion`).
2. **En `spec.ts` (`buildSacrintInfographic`):**
   - Si `selectedSession?.sintesisVisual?.mapaConceptual` existe, sus 4 campos (`definicionClave`, `criterioDesarrollo`, `errorComun`, `correccionBreve`) junto con `conceptoBreve` y `ejemploBreve` pueblan `claim`, `conceptManual.definitions`, `conceptManual.conceptMap`, `misconceptionFix` y `quickExample` de la infografía `09`, garantizando **0% de copia de párrafos largos del libro, 0 tautologías y 100% de coherencia temática**.
3. **Compatibilidad hacia atrás (Libros V1 ya guardados en BD):**
   - Si una planeación existente en BD aún no tiene `session.sintesisVisual`, `content-distiller.ts` y `spec.ts` usan el extractor determinista limpio sobre `contenido`, `ejemploResuelto` y `practica`.
