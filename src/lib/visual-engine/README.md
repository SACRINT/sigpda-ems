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
  - Integración nativa con el catálogo institucional de 244 slugs de materiales (100% presentes físicamente en `public/images/materiales/`: 53 P1 validados + 191 P2; inventario exhaustivo documentado en `docs/inventario-calidad-materiales.md`).
  - Extractor determinista `extractConceptCardsFromMission` a partir de `conceptZero` o fenomenología.

#### 3.4 Process Flow Banner
- **Propósito**: Visualización horizontal del flujo de trabajo, fases de proyectos PAEC/integradores y etapas formativas.
- **Capacidades**:
  - Píldoras horizontales con badges numéricos circulares y flechas vectoriales de conexión (vástago `doc.line` + punta `doc.triangle`).
  - Extractor determinista `extractProcessFlowSteps` que soporta `ProjectPhase[]`, listas de ejecución y objetos mixtos.
  - Paridad DOCX mediante tabla de fila única con celdas de nodos alternadas con flechas `➔`.

#### 3.5 Iconografía Vectorial Offline (Fase 6B)
- **Propósito**: Conjunto canónico de 10 iconos vectoriales offline (`check`, `bombilla`, `engranaje`, `herramienta`, `warning`, `libro`, `lupa`, `gota`, `chip`, `flecha-doble`).
- **Capacidades**:
  - **100% WinAnsi-safe**: Cero llamadas a `doc.text()` (construidos puramente con `circle`, `line`, `rect`, `roundedRect`, `triangle`).
  - **Browser-Safe**: Cero imports de Node.js (`fs`, `path`, `Buffer`, `crypto`).
  - **Preservación de Estado Gráfico**: Restaura automáticamente `setLineWidth(0.2)`, `setDrawColor` y `setFillColor` del documento compartido para prevenir fugas de color (F-37).
  - **Degradación D9**: Si un icono no existe o los parámetros son inválidos, retorna `false` determinísticamente para activar el fallback a texto clásico sanitizado.

#### 3.6 Tipografía Editorial Oficial en Planeaciones (Fase 6A)
- **Propósito**: Integración de tipografía de imprenta oficial (Lato y Montserrat) en `planning-pdf-renderer.ts`.
- **Capacidades**:
  - Carga en memoria virtual VFS vía `loadEditorialFonts(doc)`.
  - Reemplazo de Helvetica cruda en encabezados, cuerpos y tablas con Lato / Montserrat.
  - Intercepción transparente en `autoTable` respetando fuentes monoespaciadas (`courier`).
  - Fallback D9 limpio: si las fuentes fallan al registrarse, degrada a Helvetica sin romper la generación del documento.

#### 3.7 Inventario y Auditoría de Calidad de Materiales (Fase 6C)
- **Documento Maestro**: `docs/inventario-calidad-materiales.md`.
- **Cobertura**: 244 de 244 materiales verificados en disco a resolución $512 \times 512\text{ px}$.
- **Diagnóstico**: 93.4% de usabilidad inmediata (42 alta + 133 media en P2, más 53 P1). 16 materiales esquemáticos de baja densidad con 3 opciones arquitectónicas para decisión del usuario.

---

### 4. Sistema de Tokens Centralizado
Todos los colores residen inmutables en `src/lib/visual-engine/design-tokens.ts`:
- **`CODE_IDE`**: Paleta RGB para fondo de código, gutter, strings, keywords, comentarios.
- **`STEP_CARDS`** / **`STEP_CARDS_DOCX`**: Paleta dual para chasis de tarjetas procedimentales, badges y textos.
- **`CONCEPT_CARDS`** / **`CONCEPT_CARDS_DOCX`**: Paleta dual para tarjetas conceptuales, badges semánticos y ejemplos.
- **`PROCESS_FLOW`** / **`PROCESS_FLOW_DOCX`**: Paleta dual para píldoras de proceso, números, flechas y chasis.
- **`ICON_SET`**: Paleta RGB canónica para los 10 iconos vectoriales del sistema.

---

### 5. Marco de Pruebas y Detección de Regresiones (Anti-F11)
La suite garantiza la estabilidad a través de:
1. **Espías dedicados (Spies)** en ambos renderizadores (`pdf-workbook-renderer.ts`, `docx-workbook-renderer.ts`, `planning-pdf-renderer.ts` e `icon-renderer.ts`).
2. **Pruebas de Falsación por Mutación**: Si un consumer desconecta un widget o una tipografía, Vitest falla de manera determinista con `AssertionError`.
3. **Aislamiento de Mocks**: Limpieza de estado (`mockClear()` / `mockRestore()`) para garantizar independencia entre pipelines.

