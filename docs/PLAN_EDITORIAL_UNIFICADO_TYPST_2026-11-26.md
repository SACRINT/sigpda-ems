# Plan de Implementación Editorial Unificado (Typst + DOCX + Escenas Arquetipo)

- **Fecha:** 2026-11-26
- **Estado:** Propuesta consolidada (convergencia técnica verificada entre Antigravity y OpenCode sobre el código real de `SIGPDA_EMS`).
- **Objetivo estratégico:** Eliminar la duplicidad actual entre dos libros de estudiante con calidades opuestas (jsPDF de 3 bloques rico en pedagogía vs. Typst editorial hoy recortado y sin imágenes), convergiendo en **un solo Libro-Cuaderno de Texto de calidad editorial comercial en PDF (Typst)** + **versión editable sincronizada en Word (DOCX)** + **sistema visual compartido con `08 Presentaciones` y `09 Infografías`**.

---

## 0. Principios Arquitectónicos Convergidos (verificados en código)

1. **Un solo perfil de libro (Estudiante):** tanto `src/lib/pdf-workbook-renderer.ts` (4,084 LOC) como `src/lib/docx-workbook-renderer.ts` (5,964 LOC) ya son el **Libro-Cuaderno Activo del Estudiante** (voz en 2.ª persona `"tú"`, renglones, tablas vacías, retos). Los materiales docentes ya son entregables independientes (`03 Planes de Clase`, `04 Solucionario Docente`, `05 Guías de Práctica`). No se inventa un perfil docente de libro.
2. **`ActiveWorkTextbook` es la fuente canónica (SIN IR genérico nuevo):** `src/types/work-textbook.ts:162-231` ya modela con riqueza pedagógica misiones, sesiones, `sintesisVisual.mapaConceptual`, `projectSection` y `evaluationSection`. No se construye un AST genérico de 16 bloques; se usa un **adaptador de vista delgado** hacia Typst.
3. **NO se reescribe `docx-workbook-renderer.ts`:** sus 5,964 LOC ya funcionan en producción y Word tiene un techo de maquetación inferior a Typst. Se conserva íntegro y solo se sincronizan paletas disciplinares y escenas contextuales.
4. **Infraestructura Typst y gate duro `.webp`:** `Dockerfile:26-49` ya instala `fonts-liberation`, `fonts-inter` en `/app/fonts` y copia `public/images`. Sin embargo, estaba fijado en `TYPST_VERSION=0.13.0` (que no soporta `.webp` nativo; soporte añadido en **Typst 0.15.1**), mientras el entorno local usa `typst 0.15.1` (`GATE_WEBP: PASS`). En **Fase 1** se actualizó `Dockerfile` a `TYPST_VERSION=0.15.1` (gate de test `>= 0.15.1`), se definió `editorial:deploy` (`flyctl deploy --config worker-editorial/fly.toml --dockerfile Dockerfile .`) en `package.json` y se exponen las fuentes cargadas en `/health`.
5. **Taxonomía visual basada en `DisciplinaryDomainId` (17 dominios verificados):** `src/lib/prompts/disciplinary-adapters/index.ts:16-33` define exactamente 17 dominios; `docs/CATALOGO_MAESTRO_ESCENAS_ARQUETIPO_NANOBANANA.md` cubre `17 × 4 = 68` escenas arquetipo.
6. **Deduplicación por rol/bloque (alineada con 4 arquetipos/dominio):** dado que un bloque tiene portada + 4 misiones + apoyos `08`/`09` (≥ 5 slots) y un semestral tiene 72 sesiones, el criterio exacto es **0 repeticiones en el mismo rol dentro del bloque y 0 portadas repetidas entre Bloques 1, 2 y 3** (rotando `01-portada` → `02-concepto` → `04-comunidad`, con encuadre/crop distinto entre roles diferentes y prioridad a `public/images/escenas/overrides/`).
7. **Rigurosidad en impresión CMYK:** Typst exporta **RGB** (soporta PDF/A y PDF/UA, sangrado/bleed 3 mm y marcas de corte, **no CMYK nativo**). La salida CMYK / PDF/X-1a para imprenta offset se modela como **post-proceso opcional separado** con Ghostscript + perfil ICC (`FOGRA39` / `USWebCoatedSWOP`), nunca como un flag de Typst.
8. **Cronograma realista:** **8–11 semanas totales** para paridad 100 %, desacoplo de helpers de `pdf-workbook-renderer.ts` y retiro seguro de jsPDF, con **salto visual inmediato en producción desde la Semana 1–2 (Fase 1)**.

### Decisión de producto APROBADA por el usuario: **Opción A con Guardarraíles**
- **Modelo de acceso aprobado:** El **Libro de Texto Unificado en Typst (por bloque)** será el libro estándar para **todos los usuarios**; el nivel **Premium / Institucional** desbloquea **Compendio Semestral Consolidado, portada/lomo/contraportada personalizada con escudo y CCT, sangrado 3 mm + marcas de corte (y post-proceso CMYK opcional) y descarga masiva**.
- **Guardarraíles obligatorios antes de abrir a todos los usuarios (transición en Fase 3–4):**
  1. Caché estricto por `content_hash` (evita recompilaciones redundantes),
  2. Cola asíncrona y límite de concurrencia en el worker,
  3. Scale-to-zero activo en Fly Machines (`min_machines_running = 0`),
  4. Alerta de presupuesto mensual en Fly.io,
  5. **Beta de 2 semanas** con telemetría de costo/compilación y **fallback reversible a Opción B** (volver a gating por suscripción) si el costo supera el umbral,
  6. Actualización explícita de la semántica de `EDITORIAL_PUBLISHER_ENGINE` y la tabla `editorial_books` (moviendo el gate del motor base a las features de imprenta/semestral).

---

## 1. Fase 1 · Rescate Inmediato del Libro Editorial (1–2 semanas)

> **Propósito:** Corregir los 4 defectos visibles del Libro Editorial actual **sin depender todavía de las 68 imágenes nuevas** (puede ejecutarse hoy mismo en paralelo mientras produces el Lote 1 en Nano Banana).

### Tareas técnicas exactas
1. **Plantilla Typst agnóstica de disciplina y con paleta dinámica**
   - Archivos: `templates/editorial/workbook-template.typ` (líneas 309, 384, 577–578) y `src/lib/editorial/student-content-model.ts`.
   - Acción: eliminar los textos matemáticos hardcodeados (`"Conceptos Fundamentales y Modelado Matemático"`, `"Ejemplo Resuelto con Números: Paso a Paso"`, `"Procedimientos numéricos explícitos... fórmulas"`).
   - Inyectar en `StudentChapter` un objeto `disciplinaUi` derivado de `getDisciplinaryAdapter(uacName)` + `resolveSacrintPack(uacName)`:
     - `domainId: DisciplinaryDomainId`,
     - `palette: { primary, secondary, tint }` (versión editorial clara sobre papel cálido `#F7F4EE`),
     - `labels: { conceptTitle, exampleTitle, exampleSubtitle, practiceTitle, formulaOrRuleTitle }`.
   - Resultado: Literatura muestra *"Fundamentos Textuales y Análisis Literario"* / *"Ejemplo Comentado Paso a Paso"*; Salud muestra *"Fundamentos Clínicos y Protocolo"*; Matemáticas conserva *"Modelado Matemático"* y *"Ejemplo Resuelto con Números"*.

2. **Poblar `materialSpot` (schema real) y `sidenote` (0 tokens adicionales de IA)**
   - Archivo: `src/lib/editorial/student-content-model.ts` (`adaptSessionPlanToStudentSession`, líneas 435–467) y `src/lib/editorial/compose-student-sessions.ts`.
   - Acción:
     - **Antes** de invocar `stripMaterialTokensDeep(plan)`, extraer tokens `[[material:slug]]` válidos con `parseMaterialTokens` y, en su ausencia, resolver con `parseMaterialTokensWithFallback(text, { uacName })` (con escudo disciplinar contra contaminación).
     - Poblar **`materialSpot` usando el schema real existente** (`SpotMaterialSchema`, líneas 118–123): `{ nombre, archivo: "<slug>.png", pie?, anchoCm? }` (NO un shape paralelo), verificando existencia real del PNG en `public/images/materiales/` para que `workbook-template.typ:364` resuelva `assetsRoot + "/images/materiales/" + s.materialSpot.archivo` sin error.
     - Poblar `sidenote` desde `sessionPlan.sintesisVisual?.mapaConceptual?.definicionClave` (con fallback determinista a `conceptoBreve` / primer bloque `definicion` / `saberesPrevios`, ≤ 220 caracteres).

3. **Fuente única de verdad (SSoT) para la plantilla Typst**
   - Archivos: `templates/editorial/workbook-template.typ`, `worker-editorial/templates/editorial/workbook-template.typ`, `scripts/sync-editorial-template.mjs`, `package.json`.
   - Acción: crear `scripts/sync-editorial-template.mjs` y registrarlo como `npm run editorial:sync-template` (respaldado por el test ya existente `src/__tests__/editorial-template-sync.test.ts` que valida SHA-256 idéntico).

4. **Verificación del deploy del worker Fly.io y gate duro `.webp` (`TYPST_VERSION=0.15.1`)**
   - Archivos: `Dockerfile`, `worker-editorial/fly.toml`, `worker-editorial/server.js`, `package.json`.
   - Acción:
     - Actualizar `Dockerfile:19` de `TYPST_VERSION=0.13.0` a `TYPST_VERSION=0.15.1` (alineado 1:1 con local y habilitando soporte nativo `.webp` como gate duro previo al Lote 1).
     - Definir el script oficial en `package.json`: `"editorial:deploy": "fly deploy --config worker-editorial/fly.toml --dockerfile Dockerfile"` ejecutado desde la raíz del repositorio (donde `COPY worker-editorial/` y `COPY public/images` resuelven correctamente).
     - Enriquecer `GET /health` en `worker-editorial/server.js` con `{ fontsDir, fontsCount, fontsLoaded: [...] }`.
     - Agregar suite automatizada `src/__tests__/editorial-phase1-rescue.test.ts` verificando: (a) 0 textos matemáticos en PDFs reales compilados con Typst para Literatura, Inglés, Filosofía y Salud, (b) `materialSpot` con schema `{ nombre, archivo, pie, anchoCm }` + `sidenote`, (c) `/health` con fuentes cargadas, y (d) gate `.webp` en Typst.

### Criterios de aceptación de Fase 1
- [ ] Test automatizado demuestra que Literatura, Inglés, Filosofía y Educación para la Salud **no** renderizan `"Modelado Matemático"`, `"con Números"` ni `"Procedimientos numéricos explícitos"` en el PDF compilado.
- [ ] `adaptSessionPlanToStudentSession` puebla `materialSpot` con el schema real `{ nombre, archivo, pie?, anchoCm? }` (PNG verificado en disco) antes de `stripMaterialTokensDeep`, y puebla `sidenote` desde `sintesisVisual.mapaConceptual.definicionClave` (o fallback determinista).
- [ ] `editorial-template-sync.test.ts` verde (SHA-256 idéntico entre `templates/editorial/` y `worker-editorial/templates/editorial/`).
- [ ] `Dockerfile` en `TYPST_VERSION=0.15.1`, test de gate `.webp` en Typst en verde, `editorial:deploy` definido en `package.json` y `GET /health` reportando `typstVersion`, `templateVersion` y fuentes cargadas.

---

## 2. Fase 2 · Motor de Escenas Contextuales y Soporte WebP (2 semanas)

> **Propósito:** Integrar las 68 escenas arquetipo de `docs/CATALOGO_MAESTRO_ESCENAS_ARQUETIPO_NANOBANANA.md` con deduplicación por bloque para **Libros (Typst + DOCX) + `08 Presentaciones` + `09 Infografías`**.

### Tareas técnicas exactas
1. **Habilitar `.webp` de extremo a extremo**
   - `src/lib/editorial/student-content-model.ts`: actualizar `SpotMaterialSchema` (`\.(png|webp)$`) y añadir `EditorialSceneSchema` (`id`, `domainId`, `archetype`, `path`, `aspectRatio`, `alt`).
   - `src/lib/visual-engine/visual-asset-manager.ts`: añadir capa de resolución de escenas en `public/images/escenas/<domainId>/` y *overrides* en `public/images/escenas/overrides/`.
   - Compilación `.webp` nativa garantizada en Typst `0.15.1` en el contenedor Linux del worker (y en `08 PPTX` convertir vía `sharp` a PNG embebido si PowerPoint requiere raster PNG).

2. **Registro tipado y asignador determinista con dedupe por rol/bloque**
   - Nuevo `src/lib/visual-engine/editorial-scenes-catalog.ts`: tipado estrictamente con `Record<DisciplinaryDomainId, DomainSceneSet>` (si algún día se añade un dominio 18, TypeScript avisa en compilación).
   - Nuevo `src/lib/visual-engine/scene-allocator.ts`:
     - Recibe `{ domainId, blockNumber, role, uacName, target: 'book' | 'slides' | 'infographic' }`.
     - Implementa la matriz exacta de roles definida en el Catálogo Maestro: **0 repeticiones en el mismo rol dentro del bloque** (las 4 misiones usan los 4 arquetipos con crop diferenciado) y **0 repeticiones de portada entre Bloques 1, 2 y 3** (`01-portada` → `02-concepto` → `04-comunidad`), priorizando `public/images/escenas/overrides/` (versionado y optimizado `< 500 KB`) y cayendo a `indagacion_interdisciplinaria_general` si un lote aún no está en disco.

3. **Integración 3-en-1**
   - Portadas de capítulo/bloque en `workbook-template.typ`.
   - Escenas hero y actividad en `08 Presentaciones` y `09 Infografías` (`src/lib/visual-engine/sacrint/`).

### Criterios de aceptación de Fase 2
- [ ] `tsc` valida cobertura 100 % de los 17 miembros de `DisciplinaryDomainId`.
- [ ] 0 escenas repetidas en el mismo rol dentro de un bloque; 0 portadas de bloque repetidas entre Bloques 1, 2 y 3 del semestral.
- [ ] Si falta una imagen de Lote 2/3 en disco, cae limpiamente a su dominio hermano o `indagacion_interdisciplinaria_general` sin romper la compilación Typst ni dejar huecos rotos.

---

## 3. Fase 3 · Paridad Funcional Total: `ActiveWorkTextbook` → Typst (3–4 semanas)

> **Propósito:** Lograr que el PDF generado por Typst contenga **el 100 % del valor pedagógico** de los libros actuales de 3 bloques (para poder retirar jsPDF sin perder nada). Esto implica **extender el contrato de composición**, no solo la plantilla `.typ`.

### Tareas técnicas exactas
1. **Extensión del contrato de composición (`student-content-model.ts` + `compose-student-sessions.ts`)**
   - Ampliar `StudentChapterSchema` (retrocompatible con capítulos previos):
     - `missions[]`: metadatos de las 4 misiones (*Concepto Cero, Yo Hago, Nosotros Hacemos, Tú Haces*) con propósito, reto detonador y escena asignada.
     - `projectSection` (al **cierre de cada bloque**): título, vinculación PAEC, fases paso a paso, especificaciones adaptadas a `DisciplinaryAdapterV2` y bitácora del estudiante.
     - `evaluationSection` (al **cierre de cada bloque**): rúbrica analítica 4 niveles, lista de cotejo con categorías disciplinares y semáforo metacognitivo.
     - `activeSpaces[]` por sesión: definición estructurada de renglones de escritura, tablas vacías de registro y cajas de código/procedimiento.
     - `embeddedDiagrams[]` y `digitalToolQrs[]`.
   - Actualizar `compose-student-sessions.ts` **y** el `StudentChapterSchema.parse(...)` de `src/app/api/pdf/libro-editorial/[id]/route.ts` para proyectar y validar todo `workbooks[key].current` (`missions`, `projectSection`, `evaluationSection`), con pruebas unitarias e integración explícitas de contrato extremo a extremo hasta la plantilla Typst.

2. **Diagramas SVG STEM y Códigos QR deterministas en Typst**
   - Reutilizar `visual-dispatcher.ts` para generar SVG puros y pasarlos al bundle temporal del worker como assets relativos (Typst los embebe vectorialmente con nitidez infinita).
   - Generar códigos QR de `digital-tools-registry.ts` de forma determinista a SVG local (sin llamadas HTTP externas en tiempo de compilación) e incrustarlos en fichas laterales de sesión.

3. **Componentes Typst de Cuaderno Activo y Evaluación NEM**
   - Modularizar la plantilla en `templates/editorial/components/` (`cover.typ`, `mission-banner.typ`, `session.typ`, `active-workbook.typ`, `project-section.typ`, `evaluation-rubric.typ`) importados desde `workbook-template.typ`.
   - Implementar primitivas reutilizables: `#writing-lines(count)`, `#empty-data-table(headers, rows)`, `#code-workspace(lang, starter)`, `#rubric-4-levels(...)`, `#metacognition-traffic-light(...)`.

4. **Endurecimiento del gate 422 y feature flag `PUBLISHING_ENGINE_V2`**
   - Revisar `plan-completeness.ts` y `findGenericContent` para que las **72/72 sesiones** de una UAC completa pasen sin falsos rechazos 422 ni auto-sanación bloqueante.
   - Proteger el nuevo pipeline detrás de `PUBLISHING_ENGINE_V2` para probar lado a lado contra los PDFs actuales antes del corte definitivo.

### Criterios de aceptación de Fase 3
- [ ] Paridad estructural 100 % respecto al libro de 3 bloques en 5 UACs de distintas familias epistemológicas (Matemáticas, Química/Biología, Literatura/Humanidades, Cultura Digital y Formación Laboral).
- [ ] Paridad 72/72 sesiones sin error HTTP 422 en la UAC semestral de prueba.
- [ ] Diagramas SVG y códigos QR renderizados vectorialmente sin dependencias externas en el worker.
- [ ] Tiempo de compilación ≤ 3 s por bloque individual y ≤ 12 s para compendio semestral de 3 bloques en Fly Machines (`1024 MB`).

---

## 4. Fase 4 · Desacoplo de Helpers, Unificación Bloque + Semestral, Sincronía DOCX, Retiro de jsPDF y Capa de Imprenta (2–3 semanas)

> **Propósito:** Cerrar de forma segura la deuda técnica de 4,084 LOC de jsPDF (`pdf-workbook-renderer.ts` es importado hoy por `master-workbook-compiler.ts`, `/api/pdf/libro-bloque` y ~28 archivos de prueba, y exporta helpers compartidos), entregar un solo libro coherente bajo **Opción A con guardarraíles** y habilitar la capa opcional de imprenta profesional.

### Sub-fase 4A · Desacoplo de helpers compartidos y migración de consumidores (1–1.5 semanas)
1. **Extraer helpers compartidos de `pdf-workbook-renderer.ts` a módulo neutral (`src/lib/workbook-shared-helpers.ts`):**
   - Mover sin cambios de comportamiento: `sanitizeEducationalResourceUrl`, `printParagraph`, `getRubricLevelDescriptor`, `resolveWorkbookMethodology`, `separatePasoInline`, `sanitizePdfText`, y el tipo `RealTocEntry`.
   - Re-exportar temporalmente durante la transición y actualizar imports en `src/lib/` y pruebas unitarias.
2. **Unificación de rutas de descarga PDF y `master-workbook-compiler.ts`:**
   - `/api/pdf/libro-bloque/[id]` compila el bloque en Fly.io (descarga directa en ~1–3 s, con caché por `content_hash`).
   - Migrar `src/lib/master-workbook-compiler.ts` (rama PDF semestral; la rama DOCX conserva `docx-workbook-renderer.ts`) a Typst con índice consolidado, portadillas de bloque con escenas rotadas y persistencia en Vercel Blob.
   - Aplicar los guardarraíles de **Opción A**: mover el gate de `EDITORIAL_PUBLISHER_ENGINE` / `editorial_books` del libro base a las features Premium (semestral, portada/lomo/CCT, bleed/marcas, descarga masiva), configurar límite de concurrencia y alerta de presupuesto en Fly.io, y correr la **beta controlada de 2 semanas** con switch de fallback a Opción B.
   - Retirar el botón duplicado en la UI: el usuario ve **un solo Libro de Texto** con dos formatos claros: **PDF Editorial** (Typst) y **Word Editable** (DOCX).
3. **Sincronía visual en `docx-workbook-renderer.ts` (SIN reescribir):**
   - Inyectar únicamente la paleta disciplinar (`discipline-packs.ts` versión clara) y las escenas arquetipo de apertura de bloque desde `scene-allocator.ts`, preservando intacta la lógica existente de sus 5,964 LOC y sus pruebas golden.

### Sub-fase 4B · Migración/retiro de tests legacy, borrado de jsPDF y Capa de Imprenta (1–1.5 semanas)
4. **Actualizar/retirar los ~28 archivos de prueba acoplados a `renderWorkbookToPdf`:**
   - Los tests de invariantes semánticos/helpers pasan a importar de `workbook-shared-helpers.ts` o del compilador Typst; solo los tests exclusivos de coordenadas jsPDF se retiran al confirmar paridad en Typst.
5. **Retiro controlado de `pdf-workbook-renderer.ts` (4,084 LOC):**
   - Solo tras aprobar el baseline visual golden de 5 familias epistemológicas en Typst, cerrar la beta de 2 semanas sin sobresaltos de costo y verificar `tsc` + `eslint --max-warnings=0` + `vitest` 100 % en verde.
6. **Capa de Edición de Imprenta (Premium):**
   - En Typst: modo `printEdition` con sangrado (`bleed: 3mm`), marcas de corte y portada/lomo/contraportada con escudo, CCT y folio del plantel.
   - **Conversión CMYK / PDF/X-1a (solo si se requiere imprenta offset comercial):** micro-etapa opcional de post-proceso con **Ghostscript (`gs -dPDFX -sColorConversionStrategy=CMYK`) + perfil ICC (`FOGRA39` / `USWebCoatedSWOP`)**, separada de la compilación estándar RGB para no añadir latencia ni peso a descargas cotidianas.

### Criterios de aceptación de Fase 4
- [ ] Helpers compartidos desacoplados en `workbook-shared-helpers.ts` y `master-workbook-compiler.ts` migrado a Typst (DOCX intacto).
- [ ] Beta de 2 semanas de Opción A con telemetría de costos dentro de presupuesto (fallback a Opción B verificado).
- [ ] Golden visual aprobado en 5 familias epistemológicas (PDF Typst) + Golden DOCX sin regresiones.
- [ ] Un solo flujo de descarga de libro en UI (PDF Editorial + DOCX Editable).
- [ ] `pdf-workbook-renderer.ts` retirado y `tsc` + `eslint --max-warnings=0` + `vitest` 100 % en verde.

---

## 5. Resumen de Cronograma Convergido (8–11 semanas totales)

| Fase | Duración realista | Entregable visible para el usuario |
|---|---:|---|
| **Fase 1 · Rescate Editorial** | 1–2 semanas | Libro Editorial actual sin bugs matemáticos, con `materialSpot` (schema real) + `sidenote`, plantilla SSoT, `Dockerfile` en Typst `0.15.1` (gate `.webp`), `editorial:deploy` y `/health` con fuentes. *(En paralelo al Lote 1 de imágenes.)* |
| **Fase 2 · Escenas Arquetipo (68)** | 2 semanas | Escenas editoriales en Libros, `08` y `09`, soporte `.webp` y dedupe por rol/bloque. |
| **Fase 3 · Paridad `ActiveWorkTextbook` → Typst** | 3–4 semanas | Typst renderiza 4 Misiones, Proyecto Integrador, Evaluación NEM, SVG STEM, QR y Cuaderno Activo completo (72/72 sesiones, contrato validado en `StudentChapterSchema`). |
| **Fase 4 · Desacoplo, Unificación, DOCX y Retiro jsPDF** | 2–3 semanas | Helpers extraídos, `master-workbook-compiler` migrado, Opción A con guardarraíles (beta 2 sem), DOCX sincronizado, jsPDF retirado y capa de imprenta (RGB + post-proceso CMYK opcional). |
