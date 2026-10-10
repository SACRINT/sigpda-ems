# Motor Visual SIGPDA-EMS (Visual Engine)
## Suite Canónica de 4 Widgets Visuales Offline (Fases 0–5)

### 1. Filosofía Arquitectónica y Garantía Offline
El motor visual de SIGPDA-EMS implementa una **Garantía Dual Offline**:
- **0% dependencia de servicios externos**: Ningún widget visual en el camino crítico de renderizado realiza llamadas HTTP, peticiones a APIs de Inteligencia Artificial ni consultas remotas (Kroki, Mermaid, QuickChart, etc.).
- **Geometría Vectorial Nativa**: Todos los gráficos se construyen con primitivas vectoriales de jsPDF (`roundedRect`, `circle`, `line`, `triangle`) y tablas estructuradas de `docx`.
- **Invariante WinAnsi Estricto**: Todo texto impreso con `doc.text` es procesado previamente por `sanitizePdfText`, garantizando que ningún emoji sin mapear o caracter especial corrompa los streams PDF.
- **Paginación Atómica**: Todo widget calcula previamente la altura del bloque indivisible (`ensureVerticalSpace`) para evitar roturas de página intermedias o fragmentación visual.
- **Degradación Canónica D9**: Si los datos de entrada están incompletos o por debajo de los umbrales mínimos, el widget retorna silenciosamente sin alterar la coordenada vertical `y`, permitiendo que el documento conserve su flujo y texto histórico sin errores de ejecución.

---

### 2. Catálogo de los 4 Widgets Visuales

| Widget | Archivo Renderer | Función PDF | Función DOCX | Extractor Determinista | Tokens | Umbral D9 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Dark IDE Code Block** | `code-highlighter.ts` | `drawDarkIdeCodeBlock` | N/A (tabla IDE nativa) | `highlightCodeBlock` | `CODE_IDE` | Prosa sin código $\to$ párrafos normales |
| **2. Step-Cards Grid** | `step-card-renderer.ts` | `drawStepCardGrid` | `buildDocxStepCardGrid` | `parseLabStepsFromProse` | `STEP_CARDS` / `STEP_CARDS_DOCX` | $< 3$ pasos $\to$ bloque de práctica con líneas punteadas (`drawPracticeTasksWithDottedLines`) |
| **3. Concept-Cards Grid** | `concept-card-renderer.ts` | `drawConceptCardsGrid` | `buildDocxConceptCardsGrid` | `extractConceptCardsFromMission` | `CONCEPT_CARDS` / `CONCEPT_CARDS_DOCX` | $< 2$ conceptos $\to$ párrafos de fundamentación |
| **4. Process Flow Banner** | `process-flow-renderer.ts` | `drawProcessFlowBanner` | `buildDocxProcessFlowBanner` | `extractProcessFlowSteps` | `PROCESS_FLOW` / `PROCESS_FLOW_DOCX` | $< 2$ fases $\to$ omite banner, mantiene tabla |

---

### 3. Detalle de Implementación por Widget

#### 3.1 Dark IDE Code Block
- **Propósito**: Renderizado de fragmentos de código y terminal con estética de editor moderno en modo oscuro.
- **Capacidades**:
  - Gutter numérico secuencial (líneas 1..N) con ancho dinámico.
  - Tokenizador de máquina de estados para keywords (`def`, `import`, `function`, etc.), strings, números y comentarios.
  - Soporte de estado carry-over multilínea para docstrings y bloques de comentarios.
  - Chasis exterior con botones de control estilo ventana (rojo, amarillo, verde) y badge de lenguaje.

#### 3.2 Step-Cards Grid
- **Propósito**: Guía procedimental y pasos de laboratorio organizados en tarjetas modulares de 2 columnas.
- **Capacidades**:
  - Paginación atómica por fila de tarjetas (las 2 tarjetas de una fila saltan juntas si no caben).
  - Badges semánticos para acción (`[PASO N]`), salida esperada (`[OK]`) e ideas/tips clave (`[IDEA]`).
  - Extractor determinista `parseLabStepsFromProse` que detecta pasos desde bloques de texto libre.

#### 3.3 Concept-Cards Grid
- **Propósito**: Desglose visual de conceptos clave, analogías físicas y aplicaciones prácticas del MCCEMS.
- **Capacidades**:
  - Cuadrícula de 2 o 3 tarjetas por fila con sombras suaves y bordes de alta fidelidad.
  - Integración nativa con el catálogo institucional de 244 slugs de materiales (53 ejecutados con imagen PNG y 191 pendientes de renderizado, escaladas a $18 \times 18\text{ mm}$).
  - Extractor determinista `extractConceptCardsFromMission` a partir de `conceptZero` o fenomenología.

#### 3.4 Process Flow Banner
- **Propósito**: Visualización horizontal del flujo de trabajo, fases de proyectos PAEC/integradores y etapas formativas.
- **Capacidades**:
  - Píldoras horizontales con badges numéricos circulares y flechas vectoriales de conexión (vástago `doc.line` + punta `doc.triangle`).
  - Extractor determinista `extractProcessFlowSteps` que soporta `ProjectPhase[]`, listas de ejecución y objetos mixtos.
  - Paridad DOCX mediante tabla de fila única con celdas de nodos alternadas con flechas `➔`.

---

### 4. Sistema de Tokens Centralizado
Todos los colores residen inmutables en `src/lib/visual-engine/design-tokens.ts`:
- **`CODE_IDE`**: Paleta RGB para fondo de código, gutter, strings, keywords, comentarios.
- **`STEP_CARDS`** / **`STEP_CARDS_DOCX`**: Paleta dual para chasis de tarjetas procedimentales, badges y textos.
- **`CONCEPT_CARDS`** / **`CONCEPT_CARDS_DOCX`**: Paleta dual para tarjetas conceptuales, badges semánticos y ejemplos.
- **`PROCESS_FLOW`** / **`PROCESS_FLOW_DOCX`**: Paleta dual para píldoras de proceso, números, flechas y chasis.

---

### 5. Marco de Pruebas y Detección de Regresiones (Anti-F11)
La suite garantiza la estabilidad a través de:
1. **Espías dedicados (Spies)** en ambos renderizadores (`pdf-workbook-renderer.ts` y `docx-workbook-renderer.ts`).
2. **Pruebas de Falsación por Mutación**: Si un consumer desconecta un widget, Vitest falla de manera determinista con `AssertionError`.
3. **Aislamiento de Mocks**: Limpieza de estado (`mockClear()`) para garantizar independencia entre el pipeline PDF y DOCX.
