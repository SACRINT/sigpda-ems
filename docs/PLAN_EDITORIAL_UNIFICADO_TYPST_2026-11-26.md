# Plan de Implementación Editorial Unificado (Typst + DOCX + Escenas Arquetipo)

- **Fecha:** 2026-11-26
- **Estado:** Propuesta consolidada (convergencia técnica verificada entre Antigravity y OpenCode sobre el código real de `SIGPDA_EMS`).
- **Objetivo estratégico:** Eliminar la duplicidad actual entre dos libros de estudiante con calidades opuestas (jsPDF de 3 bloques rico en pedagogía vs. Typst editorial hoy recortado y sin imágenes), convergiendo en **un solo Libro-Cuaderno de Texto de calidad editorial comercial en PDF (Typst)** + **versión editable sincronizada en Word (DOCX)** + **sistema visual compartido con `08 Presentaciones` y `09 Infografías`**.

---

## 0. Principios Arquitectónicos Convergidos (verificados en código)

1. **Un solo perfil de libro (Estudiante):** tanto `src/lib/pdf-workbook-renderer.ts` (4,084 LOC) como `src/lib/docx-workbook-renderer.ts` (5,964 LOC) ya son el **Libro-Cuaderno Activo del Estudiante** (voz en 2.ª persona `"tú"`, renglones, tablas vacías, retos). Los materiales docentes ya son entregables independientes (`03 Planes de Clase`, `04 Solucionario Docente`, `05 Guías de Práctica`). No se inventa un perfil docente de libro.
2. **`ActiveWorkTextbook` es la fuente canónica (SIN IR genérico nuevo):** `src/types/work-textbook.ts:162-231` ya modela con riqueza pedagógica misiones, sesiones, `sintesisVisual.mapaConceptual`, `projectSection` y `evaluationSection`. No se construye un AST genérico de 16 bloques; se usa un **adaptador de vista delgado** hacia Typst.
3. **NO se reescribe `docx-workbook-renderer.ts`:** sus 5,964 LOC ya funcionan en producción y Word tiene un techo de maquetación inferior a Typst. Se conserva íntegro y solo se sincronizan paletas disciplinares y escenas contextuales.
4. **Infraestructura Typst y fuentes ya están empacadas:** `Dockerfile:26-49` ya instala `typst v0.13.0`, `fonts-liberation`, `fonts-inter` en `/app/fonts` y copia `public/images`; falta únicamente fijar el comando reproducible de deploy (`Dockerfile` en raíz vs. `worker-editorial/fly.toml`) y exponer fuentes cargadas en `/health`.
5. **Taxonomía visual basada en `DisciplinaryDomainId` (17 dominios verificados):** `src/lib/prompts/disciplinary-adapters/index.ts:16-33` define exactamente 17 dominios; `docs/CATALOGO_MAESTRO_ESCENAS_ARQUETIPO_NANOBANANA.md` cubre `17 × 4 = 68` escenas arquetipo.
6. **Deduplicación de escenas por BLOQUE (no por libro semestral):** un semestral tiene 72 sesiones (`72 > 68`), por lo que la deduplicación estricta se aplica a nivel **bloque/capítulo**, rotando arquetipos (`01-portada`, `02-concepto`, `04-comunidad`) entre Bloques 1, 2 y 3 para garantizar 0 repeticiones de portadas de bloque en el semestre.
7. **Rigurosidad en impresión CMYK:** Typst exporta **RGB** (soporta PDF/A y PDF/UA, sangrado/bleed 3 mm y marcas de corte, **no CMYK nativo**). La salida CMYK / PDF/X-1a para imprenta offset se modela como **post-proceso opcional separado** con Ghostscript + perfil ICC (`FOGRA39` / `USWebCoatedSWOP`), nunca como un flag de Typst.
8. **Cronograma realista:** **7–10 semanas totales** para paridad 100 % y retiro de jsPDF, con **salto visual inmediato en producción desde la Semana 1–2 (Fase 1)**.

### Decisión de producto requerida del usuario antes de Fase 3/4 (Modelo Premium)
Hoy el gate de acceso está atado al **motor** (`EDITORIAL_PUBLISHER_ENGINE` + `getSubscriptionStatus()` + tabla `editorial_books`). Antes de activar el libro unificado en producción, debes elegir:
- **Opción A (Recomendada):** El **Libro de Texto Unificado en Typst (por bloque)** queda disponible para **todos los usuarios** (eleva el estándar de la marca y elimina mantener dos motores PDF), y el nivel **Premium / Institucional** desbloquea las **capacidades de Edición de Imprenta y Escala**: *Compendio Semestral Consolidado, portada/lomo/contraportada personalizada con escudo y CCT del plantel, sangrado 3 mm + marcas de corte (y post-proceso CMYK opcional), foliado institucional y descarga masiva*.
- **Opción B (Conservadora de costos Fly.io):** Mantener el motor Typst detrás del gate Premium durante el piloto de Fases 1–3 para medir consumo real en Fly Machines (`qro`), y decidir la migración de plan antes de retirar jsPDF en Fase 4.

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

2. **Poblar `materialSpot` y `sidenote` (0 tokens adicionales de IA)**
   - Archivo: `src/lib/editorial/student-content-model.ts` (`adaptSessionPlanToStudentSession`, líneas 439–466).
   - Acción:
     - **Antes** de invocar `stripMaterialTokensDeep(plan)`, extraer el primer token `[[material:slug]]` válido presente en la sesión (o en su defecto resolver vía `requiredMaterials` + `detectCatalogMaterials` contra los 244 PNGs verificados en `public/images/materiales/`).
     - Poblar `materialSpot = { slug, path: "/images/materiales/<slug>.png", caption }` verificando existencia real del archivo en disco.
     - Poblar `sidenote` desde `sessionPlan.sintesisVisual?.mapaConceptual?.definicionClave` (con fallback a la primera idea clave o término del glosario de la sesión, limitado a 140–200 caracteres).

3. **Fuente única de verdad (SSoT) para la plantilla Typst**
   - Archivos: `templates/editorial/workbook-template.typ`, `worker-editorial/templates/editorial/workbook-template.typ`, `package.json`.
   - Acción: crear `scripts/sync-editorial-template.mjs` y agregarlo a `prebuild` y a una prueba de CI (`editorial-template-sync.test.ts`) que falle si las dos copias difieren por 1 byte.

4. **Verificación y estandarización del deploy del worker Fly.io**
   - Archivos: `Dockerfile`, `worker-editorial/fly.toml`, `worker-editorial/server.js`, `package.json`.
   - Problema detectado: `worker-editorial/fly.toml` declara `dockerfile = "Dockerfile"`, pero el `Dockerfile` real está en la raíz del repo y ejecuta `COPY worker-editorial/ ./` y `COPY public/images ./public/images`.
   - Acción:
     - Validar y fijar el comando oficial reproducible en `package.json`: `"editorial:deploy": "fly deploy --config worker-editorial/fly.toml --dockerfile Dockerfile"` ejecutado desde la raíz (y documentar el contrato en `worker-editorial/README.md`).
     - Enriquecer `GET /health` en `worker-editorial/server.js` para devolver además `{ fontsDir, fontsCount, fontsLoaded: [...] }` leyendo `FONTS_DIR`.
     - Correr smoke test de compilación real en local/worker con 3 UACs de familias distintas: *Pensamiento Matemático I*, *Pensamiento Literario* y *Educación para la Salud*.

### Criterios de aceptación de Fase 1
- [ ] Cero textos matemáticos en PDFs editoriales de Literatura, Inglés, Filosofía y Educación para la Salud.
- [ ] ≥ 90 % de las sesiones muestran `materialSpot` (cuando hay insumo físico aplicable) o justificación explícita, y ≥ 90 % muestran `sidenote` con definición clave real.
- [ ] Test automatizado garantiza sincronía byte-a-byte entre `templates/editorial/` y `worker-editorial/templates/editorial/`.
- [ ] `GET /health` del worker reporta `typstVersion`, `templateVersion` y fuentes `Inter`/`Liberation Sans` cargadas; `npm run editorial:deploy` probado y reproducible.

---

## 2. Fase 2 · Motor de Escenas Contextuales y Soporte WebP (2 semanas)

> **Propósito:** Integrar las 68 escenas arquetipo de `docs/CATALOGO_MAESTRO_ESCENAS_ARQUETIPO_NANOBANANA.md` con deduplicación por bloque para **Libros (Typst + DOCX) + `08 Presentaciones` + `09 Infografías`**.

### Tareas técnicas exactas
1. **Habilitar `.webp` de extremo a extremo**
   - `src/lib/editorial/student-content-model.ts`: actualizar `SpotMaterialSchema` (`\.(png|webp)$`) y añadir `EditorialSceneSchema` (`id`, `domainId`, `archetype`, `path`, `aspectRatio`, `alt`).
   - `src/lib/visual-engine/visual-asset-manager.ts`: añadir capa de resolución de escenas en `public/images/escenas/<domainId>/` y *overrides* en `public/images/escenas/overrides/`.
   - Verificar que Typst 0.13 renderiza `.webp` nativamente en el contenedor Linux del worker (y en `08 PPTX` convertir vía `sharp` a PNG embebido si PowerPoint requiere raster PNG).

2. **Registro tipado y asignador determinista con dedupe por bloque**
   - Nuevo `src/lib/visual-engine/editorial-scenes-catalog.ts`: tipado estrictamente con `Record<DisciplinaryDomainId, DomainSceneSet>` (si algún día se añade un dominio 18, TypeScript avisa en compilación).
   - Nuevo `src/lib/visual-engine/scene-allocator.ts`:
     - Recibe `{ domainId, blockNumber, uacName, target: 'book' | 'slides' | 'infographic' }`.
     - Mantiene `usedSceneIds` **por bloque** (dedupe estricto dentro del bloque).
     - Rota portadas de bloque: Bloque 1 → `01-portada`, Bloque 2 → `02-concepto`, Bloque 3 → `04-comunidad`; taller/infografía → `03-practica`; fallbacks seguros a `indagacion_interdisciplinaria_general` si un lote aún no se ha subido al disco.

3. **Integración 3-en-1**
   - Portadas de capítulo/bloque en `workbook-template.typ`.
   - Escenas hero y actividad en `08 Presentaciones` y `09 Infografías` (`src/lib/visual-engine/sacrint/`).

### Criterios de aceptación de Fase 2
- [ ] `tsc` valida cobertura 100 % de los 17 miembros de `DisciplinaryDomainId`.
- [ ] 0 escenas repetidas dentro de un mismo bloque; 0 portadas de bloque repetidas entre Bloques 1, 2 y 3 del semestral.
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
   - Actualizar `compose-student-sessions.ts` para proyectar todo `workbooks[key].current` (ya no solo `missions[].sessionPlans`).

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

## 4. Fase 4 · Unificación Bloque + Semestral, Sincronía DOCX, Retiro de jsPDF y Capa de Imprenta (1–2 semanas)

> **Propósito:** Cerrar la deuda técnica de 4,084 LOC de jsPDF, entregar un solo libro coherente y habilitar la capa opcional de imprenta profesional.

### Tareas técnicas exactas
1. **Unificación de rutas de descarga PDF**
   - `/api/pdf/libro-bloque/[id]` compila el bloque en Fly.io (descarga directa en ~1–3 s, con caché por `content_hash`).
   - `/api/pdf/libro-semestral/[id]` compila el compendio de los 3 bloques con índice consolidado, portadillas de bloque con escenas rotadas y persistencia en Vercel Blob.
   - Retirar el botón duplicado en la UI: el usuario ve **un solo Libro de Texto** con dos formatos claros: **PDF Editorial** (Typst) y **Word Editable** (DOCX).

2. **Sincronía visual en `docx-workbook-renderer.ts` (SIN reescribir)**
   - Inyectar únicamente la paleta disciplinar (`discipline-packs.ts` versión clara) y las escenas arquetipo de apertura de bloque desde `scene-allocator.ts`, preservando intacta la lógica existente de sus 5,964 LOC y sus pruebas golden.

3. **Retiro controlado de `pdf-workbook-renderer.ts` (4,084 LOC)**
   - Solo tras aprobar el baseline visual golden de los 5 arquetipos en Typst y validar 0 regresiones en producción durante 1 semana de convivencia con `PUBLISHING_ENGINE_V2`.

4. **Capa de Edición de Imprenta (opcional / según decisión Premium)**
   - En Typst: modo `printEdition` con sangrado (`bleed: 3mm`), marcas de corte y portada/lomo/contraportada con escudo, CCT y folio del plantel.
   - **Conversión CMYK / PDF/X-1a (solo si se requiere imprenta offset comercial):** micro-etapa opcional de post-proceso con **Ghostscript (`gs -dPDFX -sColorConversionStrategy=CMYK`) + perfil ICC (`FOGRA39` / `USWebCoatedSWOP`)**, separada de la compilación estándar RGB para no añadir latencia ni peso a descargas cotidianas.

### Criterios de aceptación de Fase 4
- [ ] Golden visual aprobado en 5 familias epistemológicas (PDF Typst) + Golden DOCX sin regresiones.
- [ ] Un solo flujo de descarga de libro en UI (PDF Editorial + DOCX Editable).
- [ ] `pdf-workbook-renderer.ts` retirado y `tsc` + `eslint --max-warnings=0` + `vitest` 100 % en verde.

---

## 5. Resumen de Cronograma Convergido (7–10 semanas totales)

| Fase | Duración realista | Entregable visible para el usuario |
|---|---:|---|
| **Fase 1 · Rescate Editorial** | 1–2 semanas | Libro Editorial actual ya sin bugs matemáticos, con `materialSpot` + `sidenote`, plantilla SSoT y worker Fly.io verificable. *(En paralelo a la producción del Lote 1 de imágenes.)* |
| **Fase 2 · Escenas Arquetipo (68)** | 2 semanas | Escenas editoriales sin texto en Libros, `08` y `09`, soporte `.webp` y dedupe por bloque. |
| **Fase 3 · Paridad `ActiveWorkTextbook` → Typst** | 3–4 semanas | Typst renderiza 4 Misiones, Proyecto Integrador, Evaluación NEM, SVG STEM, QR y Cuaderno Activo completo (72/72 sesiones). |
| **Fase 4 · Unificación, DOCX y Retiro jsPDF** | 1–2 semanas | Un solo libro editorial por bloque y semestral, DOCX sincronizado, jsPDF retirado y capa de imprenta (RGB + post-proceso CMYK opcional). |
