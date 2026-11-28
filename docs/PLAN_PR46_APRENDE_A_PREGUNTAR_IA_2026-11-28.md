# Plan de Implementación PR 4.6 — «Aprende a Preguntar con IA» (Cápsulas de Indagación Guiada)

- **Fecha:** 2026-11-28
- **Estado:** Planificado (piloto separado bajo feature flag `GUIDED_AI_INQUIRY_PILOT=false`; se activa solo tras cerrar PR 4.3.4, validar burn-in de PR 4.4 y pasar evaluación A/B en 1 UAC / 1 bloque).
- **Origen pedagógico:** Propuesta del director/docente de SIGPDA-EMS: *"Si la tarea más importante de un maestro es enseñar al alumno a preguntar —porque quien pregunta es porque le interesa el tema—, el libro también debe enseñarle a formular buenas preguntas a la IA para profundizar sus dudas, sin perder rigor ni equidad"*.
- **Alineación normativa:** Marco Curricular Común de la Educación Media Superior (**MCCEMS**) y Nueva Escuela Mexicana (**NEM**) — pensamiento crítico, autonomía intelectual, alfabetización informacional y ética digital.

---

## 1. Diagnóstico Honesto y Regla Pedagógica Fundamental (dos problemas distintos)

Antes de construir la cápsula *"Aprende a Preguntar"*, conviene separar con rigor dos necesidades distintas que aparecieron en la revisión del libro real (*Cultura Digital I*, sesión sobre *"Analizas la arquitectura de sistemas operativos para identificar cómo gestionan los recursos de hardware"*):

1. **Regla 1 — La cápsula de IA NUNCA puede tapar un vacío del libro de texto:**
   - Si el objetivo de la sesión dice *"Analizas la arquitectura de sistemas operativos para identificar cómo gestionan los recursos de hardware"*, la sección `Aprende` del libro **debe explicar primero** los componentes esenciales (núcleo/kernel, planificador de CPU, administración de memoria RAM, controladores de E/S y sistema de archivos) con claridad autosuficiente.
   - **Acción previa obligatoria (Fase 4.6.0 · Alineación Objetivo↔Explicación):** agregar en el validador determinista de calidad de sesión una verificación de cobertura léxica entre `objetivo` y `contenido` (detectar conceptos clave del objetivo ausentes en `contenido` durante la generación del workbook, antes de depender de enlaces externos o IA).
2. **Regla 2 — La cápsula *"Aprende a Preguntar con IA"* profundiza y entrena el pensamiento crítico:**
   - No es un atajo para que la IA haga la tarea ni sustituye la investigación documental ni el acompañamiento del docente.
   - Su propósito formativo es **enseñar al estudiante a preguntar bien** (contexto + objetivo + nivel + petición de ejemplo/analogía + exigencia de verificación), entrenar la **duda metódica** frente a alucinaciones de los modelos y ofrecer siempre una **ruta offline/sin cuenta** para garantizar equidad escolar.

---

## 2. Anatomía Obligatoria de la Cápsula (3 Partes Inseparables)

Toda cápsula *"Aprende a Preguntar"* que genere SIGPDA-EMS deberá incluir estrictamente las **3 piezas** en un bloque compacto (máximo 8–10 líneas visuales en el libro para no inflar paginación ni desplazar ejercicios):

| Parte | Etiqueta visible en el material | Qué contiene | Ejemplo concreto (CD1 · Sistemas Operativos) |
|---|---|---|---|
| **1. Pregunta guiada** | **Pregunta sugerida para tu tutor IA** | Un *prompt* modelo listo para copiar/adaptar que fija **rol socrático**, **tema específico de la sesión**, **nivel bachillerato** y pide **explicación paso a paso + analogía + pregunta de comprobación** (prohibido pedir "resuelve mi tarea"). | *"Actúa como tutor de bachillerato. Explica con una analogía cotidiana cómo el núcleo (kernel) de un sistema operativo reparte CPU y memoria RAM entre 3 aplicaciones abiertas al mismo tiempo, y hazme 2 preguntas cortas para comprobar si lo entendí."* |
| **2. Verificación crítica** | **Contrasta la respuesta (no confíes a ciegas)** | 2–3 pasos concretos para auditar a la IA contra el propio libro, apuntes de clase o fuentes verificables, detectando errores o generalidades y redactando una síntesis propia. | *"1) Compara la explicación con el diagrama y la sección «Aprende» de esta sesión. 2) Pide 2 fuentes técnicas verificables (documentación GNU/Linux o manual académico) y anota en 3 líneas qué te aclaró y qué corregiste con tus propias palabras."* |
| **3. Ruta sin IA / offline** | **¿Sin internet o sin cuenta? Hazlo así** | Alternativa equivalente realizable en cuaderno, en pares, con biblioteca escolar o con observación directa en el equipo del plantel (sin celular ni registro en cuentas de terceros). | *"En parejas, abran el Administrador de Tareas o Monitor del Sistema (o revisen la tabla de procesos de esta sesión), identifiquen los 3 procesos con mayor consumo de RAM/CPU y expliquen oralmente qué pasaría si el sistema operativo dejara de asignarles turnos."* |

> **Salvaguardas éticas y de privacidad (menores de edad en EMS):**
> - Incluir una línea breve de higiene digital al pie del primer recuadro de cada bloque: *"Usa la IA sin ingresar tu nombre completo, CURP, escuela ni datos personales; la IA puede equivocarse, verifica siempre con tu docente y tus fuentes"*.
> - **Agnóstico de marca:** nunca exigir una plataforma comercial específica ni cuentas de pago; hablar de *"tu asistente de IA de confianza"* o la herramienta autorizada por el plantel.
> - **Cero envío de respuestas resueltas:** ningún *prompt* sugerido pedirá redactar entregas, ensayos ni resolver los ejercicios de la sección `Practica`.

---

## 3. Matriz de Ubicación por Material (dónde SÍ y dónde NO)

Siguiendo la naturaleza normativa y pedagógica de cada uno de los 9 artefactos del paquete SIGPDA-EMS:

| Artefacto | ¿Incluye cápsula? | Cómo y dónde aparece | Restricción estricta |
|---|---|---|---|
| **01 · Planeación Didáctica Semestral** | **NO** | Nunca. Documento rector normativo ante supervisión/DGB. | 0 menciones operativas de prompts. |
| **02 · Secuencia Didáctica** | **NO** | Nunca. Instrumento de dosificación curricular oficial. | 0 menciones operativas de prompts. |
| **06 · Libro Semestral / por Bloque (`PDF` y `DOCX`)** | **SÍ (principal)** | **1 cápsula compacta por sesión clave** (o 1 por misión en el piloto inicial, ~12–18 por libro) ubicada al cierre de `Aprende` o junto a `Para saber más`. | Máx. 1 caja compacta (~12 % de página); nunca sustituye la explicación base. |
| **05 · Guías de Práctica** | **SÍ (selectivo)** | Al final de la ficha como **«Extensión crítica opcional»** cuando la práctica involucra análisis, modelado o depuración. | Siempre acompañada de verificación y ruta sin IA. |
| **03 · Planes de Clase (Docente)** | **SÍ (guía de mediación)** | Nota breve en **Mediación Docente (2–3 min)**: qué errores frecuentes comete la IA en ese tema y cómo moderar la puesta en común en aula. | Orientado al docente, no copiado literal del estudiante. |
| **04 · Solucionario (Docente)** | **SÍ (criterio de revisión)** | 1 criterio en la guía de retroalimentación: **«Evidencia de comprensión propia vs. copia literal de IA»** (qué preguntar oralmente para validar autoría). | Solo visible para el docente. |
| **08 · Presentaciones (`.pptx`)** | **SÍ (muy sobrio)** | Exclusivamente en las **Notas del Orador** o en una línea breve en el **slide de cierre / reto de profundización** de la misión. | Nunca saturar slides con párrafos largos de prompts. |
| **09 · Infografías** | **OPCIONAL (solo pie)** | A lo sumo 1 micro-pregunta de 1 línea en la franja inferior (sin invadir la zona visual ni la síntesis). | Nunca degradar jerarquía visual ni añadir texto denso. |
| **07 · Instrumentos de Evaluación** | **SÍ (solo 1 indicador)** | Cuando el docente habilite el piloto, sumar 1 criterio en la lista de cotejo/rúbrica: *"Contrasta respuestas digitales con fuentes confiables y redacta con voz propia"*. | Opcional; no altera ponderaciones oficiales por defecto. |

---

## 4. Arquitectura Técnica y Costo (\$0 Tokens Extra por Defecto)

### 4.1 Contrato de datos (`src/lib/editorial/student-content-model.ts`)
Agregar un campo opcional y retrocompatible en `StudentSession` (y en el modelo de misión):

```ts
export interface GuidedAiInquiry {
  /** Pregunta/prompt socrático listo para que el alumno formule a una IA */
  guidedPrompt: string;
  /** Lista breve (2 pasos) para verificar y contrastar la respuesta contra el libro/fuentes */
  criticalVerification: string[];
  /** Alternativa equivalente 100 % offline / sin cuenta de IA */
  offlineAlternative: string;
  /** Nota breve de mediación para 03 Planes de Clase / 04 Solucionario (solo docente) */
  teacherMediationTip?: string;
}
```

### 4.2 Estrategia de generación en 2 niveles (control total de costos)
1. **Nivel 0 — Motor determinista contextualizado (`$0.00 USD`, 0 tokens Gemini):**
   - Nuevo módulo `src/lib/editorial/guided-ai-inquiry-builder.ts` que construye la cápsula a partir del **adaptador disciplinar** (`getDisciplinaryAdapter(uacName)`), el **objetivo específico de la sesión**, los **términos clave reales** extraídos del `contenido` (`extractGlossaryTerms` / `extractMissionTopicPhrases`) y el contexto escolar.
   - Plantillas diferenciadas por familia epistemológica (no un prompt genérico repetido):
     - *Computacional / Cultura Digital*: pide analogía de funcionamiento interno, caso de depuración y 2 preguntas diagnósticas.
     - *STEM / Matemáticas*: pide explicar *el porqué* de un paso sin dar el resultado del ejercicio del alumno, y proponer un contraejemplo.
     - *Ciencias Experimentales*: pide variables controladas/independientes, hipótesis falsable y precaución de laboratorio.
     - *Humanidades / Ciencias Sociales*: pide contrastar 2 posturas históricas/sociales con fuentes primarias y detectar sesgos.
     - *Formación Laboral*: pide protocolo seguro NOM-STPS, diagnóstico de fallas paso a paso y criterio de control de calidad.
   - Ventaja inmediata: funciona **retroactivamente** sobre planeaciones ya generadas en Neon sin gastar 1 solo token de IA ni obligar al docente a regenerar su libro.
2. **Nivel 1 — Enriquecimiento opcional en generación nueva de libro (futuro, solo si el piloto valida valor):**
   - Incorporar 1 campo opcional breve dentro del mismo JSON que ya genera `sessionPlans` (0 llamadas extra a Gemini, < 70 tokens marginales por sesión) validado con Zod + fallback automático al Nivel 0 determinista.

### 4.3 Bandera de despliegue y control por docente (`Feature Flag`)
- Variable de entorno: `GUIDED_AI_INQUIRY_PILOT=false` por defecto (cero impacto en producción actual ni en pruebas golden).
- Preferencia opt-in futura en el modal de exportación / configuración de planeación: checkbox *"Incluir cápsulas «Aprende a Preguntar con IA» (piloto)"* para que cada plantel o docente decida según el acceso tecnológico de sus estudiantes.

### 4.4 Renderizado unificado (Typst PDF + Motor Editorial V2 DOCX)
- **Typst (`workbook-template.typ` + `worker-editorial/templates/editorial/workbook-template.typ`):** componente `#guided_ai_inquiry_card(inquiry)` con acento visual suave distinto a `Aprende` y `Practica`, icono tipográfico limpio, 3 sub-bloques compactos (`Pregunta sugerida`, `Verifica antes de creer`, `Ruta sin IA`) y `breakable: false` (nunca se corta a la mitad entre páginas).
- **DOCX V2 (`unified-editorial-docx-renderer.ts`):** tabla fija `10320 DXA` (`TableLayoutType.FIXED`, `cantSplit`) con borde izquierdo de acento disciplinar, paridad 1:1 con Typst PDF.

---

## 5. Fases del Piloto y Criterios Objetivos de Aceptación (Go / No-Go)

| Fase | Entregable | Criterio de salida (Gate) |
|---|---|---|
| **PR 4.6.0 · Alineación Objetivo↔Contenido** | Auditor determinista que alerta/corrige cuando los conceptos clave del `objetivo` de una sesión no aparecen desarrollados en `contenido` (ej. *arquitectura de sistemas operativos / gestión de recursos de hardware*). | 0 sesiones en el piloto con conceptos del objetivo huérfanos en `Aprende`. |
| **PR 4.6.1 · Motor Determinista + Piloto en `06` (1 UAC / 1 bloque)** | `guided-ai-inquiry-builder.ts` + schema + render Typst y DOCX V2 detrás de `GUIDED_AI_INQUIRY_PILOT=true` en *Cultura Digital I* Bloque 1 (solo 1 cápsula por misión = 4 cápsulas). | +≤ 2 páginas totales en Bloque 1; 0 prompts que pidan resolver tareas; 100 % con las 3 partes obligatorias; auditoría humana (docente) + auditoría OpenCode `PASS`. |
| **PR 4.6.2 · Prueba A/B en aula real** | Comparar 1 grupo/bloque **con** cápsula vs. **sin** cápsula evaluando: (a) calidad de preguntas formuladas por estudiantes, (b) comprensión demostrada en evaluación oral/escrita, (c) ausencia de copia literal de IA y (d) utilidad de la ruta offline. | **Go** solo si el docente confirma mejora real en participación/comprensión y 0 degradación visual; **No-Go / rollback instantáneo** vía flag si añade ruido. |
| **PR 4.6.3 · Extensión selectiva (`05`, `03`, `04`, `08`, `07`)** | Activar notas de mediación docente en `03`/`04`, extensión opcional en `05`, nota de orador en `08` y criterio opcional en `07`. Mantener `01` y `02` 100 % excluidos. | Gate completo en verde (`tsc`, `eslint`, goldens `0` diffs, Vitest, `next build`) + opt-in activable por docente. |

---

## 6. Riesgos y Mitigaciones Explícitas

| Riesgo | Mitigación en diseño |
|---|---|
| **Dependencia o copia acrítica de la IA** | Prompt redactado en modo tutor socrático + obligación de contrastar contra `Aprende` y resumir en voz propia + guía de preguntas orales en `04 Solucionario`. |
| **Brecha digital (alumnos sin celular, datos o cuenta)** | Bloque obligatorio **«Ruta sin IA / offline»** con igual valor formativo en cada cápsula. |
| **Inflación de páginas en el libro `06`** | Límite inicial de 1 cápsula compacta por misión (~12 por libro semestral, ≤ 3–4 páginas netas totales) antes de evaluar formato por sesión. |
| **Datos personales de menores en chats externos** | Aviso visible de privacidad al inicio de cada bloque + diseño agnóstico de plataforma sin requerir cuentas obligatorias. |
| **Sustituir explicaciones faltantes del libro con prompts** | Compuerta previa **PR 4.6.0** garantiza que el libro sea 100 % autosuficiente aunque nadie abra una IA. |
