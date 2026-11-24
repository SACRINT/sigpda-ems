# Plan de Implementación — Refactorización Quirúrgica del Motor SACRINT

**Fecha:** 2026-11-24  
**Repositorio:** `C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS`  
**Base de partida:** Cierre de Fase 0 (incluye corrección de `training-cycle` / `regulation-flow`, guardia QA `diagram_label_body_mismatch` y AFD `1/2 avg < 170w`)  
**Documento de referencia:** `docs/AUDITORIA_5_NUEVAS_Y_PLAN_REFACTOR_2026-11-23.md`  
**Estado:** Borrador listo para revisión y visto bueno de **Opencode** antes de iniciar Fase 1.

---

## 1. Objetivo y estrategia

Modularizar los **6 archivos monolíticos centrales** del motor visual/editorial SACRINT sin alterar el contenido, la estructura pedagógica ni las métricas QA de los entregables `08 Presentaciones (.pptx)` y `09 Infografías (.pdf)`.

**Principio rector:**
- **Cero mezcla de refactor y cambios funcionales.** Cada commit de refactor debe producir **diff = 0** contra el *golden baseline* congelado en Fase 1. Si durante una fase aparece un bug nuevo, se aísla en un commit aparte con su propio test y actualización explícita del golden.
- **Un módulo extraído = un commit atómico verificable.** Si cualquier gate falla, se revierte únicamente ese commit.

---

## 2. Inventario real de monolitos y objetivos de tamaño

| Archivo actual | Líneas actuales | Exports públicos | Prioridad | Destino tras refactor |
|---|---:|---:|---|---|
| `src/lib/visual-engine/sacrint/spec.ts` | ~5,691 | 40 | **P0** | Fachada temporal (~90 LOC) → `types.ts`, `builders/{slide-budget,content-integrity,deck-builder,infographic-builder}.ts` |
| `src/lib/visual-engine/sacrint/content-distiller.ts` | ~4,334 | 43 | **P0** | Fachada temporal (~120 LOC) → `text/{grammar-normalization,six-gram-overlap,objective-and-activity-guards}.ts`, `distiller/{formula-extractor,lesson-bundle}.ts` |
| `src/lib/visual-engine/sacrint/diagrams.ts` | ~2,850 | 31 | **P0** | Fachada temporal (~60 LOC) → `diagrams/{shared,math-diagrams,conceptual-diagrams,cycle-diagrams,registry}.ts` |
| `src/lib/visual-engine/sacrint/sacrint-pptx-generator.ts` | ~2,104 | 2 | **P1** | Entrada delgada (~80 LOC) → `pptx/{theme-and-primitives,diagram-drawers,slide-composers}.ts` |
| `src/lib/editorial/pedagogical-text-fitter.ts` | ~1,741 | 13 | **P1** | Fachada temporal (~60 LOC) → `editorial/fitter/{dangling-guards,sentence-splitter,text-compactor}.ts` |
| `src/lib/visual-engine/sacrint/svg-primitives.ts` | ~1,514 | 40 | **P1** | Fachada temporal (~70 LOC) → `svg/{core-primitives,math-graphs,schematic-diagrams}.ts` |
| `sacrint-rasterizer.ts` / `slide-renderer.ts` / `infographic-renderer.ts` | 1,067 / 1,059 / 611 | — | **P2 (fuera de alcance inicial)** | Ya están por debajo de 1,100 líneas; se dejan intactos salvo ajuste de imports directos. |

> **Meta estructural (guía, no dogma):** ningún archivo del núcleo SACRINT > 1,100–1,200 líneas al cierre de Fase 5; módulos divididos por **eje de cambio y dirección de dependencias**, no por partición arbitraria.

---

## 3. Arquitectura objetivo (DAG estricto sin ciclos)

Todas las dependencias internas deben fluir **estrictamente de arriba hacia abajo** (Capa `N` solo importa de Capas `< N`):

```text
Capa 0 (Tipos puros y utilidades sin dependencias SACRINT)
  ├── src/lib/visual-engine/sacrint/types.ts
  └── src/lib/editorial/fitter/{dangling-guards,sentence-splitter,text-compactor}.ts

Capa 1 (Procesamiento de texto y guardias lingüísticos)
  └── src/lib/visual-engine/sacrint/text/
        ├── grammar-normalization.ts
        ├── six-gram-overlap.ts
        └── objective-and-activity-guards.ts

Capa 2 (Destilación de sesión y fórmulas)
  └── src/lib/visual-engine/sacrint/distiller/
        ├── formula-extractor.ts
        └── lesson-bundle.ts

Capa 3 (Modelado y selección de diagramas)
  └── src/lib/visual-engine/sacrint/diagrams/
        ├── shared.ts
        ├── math-diagrams.ts
        ├── conceptual-diagrams.ts
        ├── cycle-diagrams.ts
        └── registry.ts

Capa 4 (Presupuesto editorial, integridad y builders 08/09)
  └── src/lib/visual-engine/sacrint/builders/
        ├── slide-budget.ts
        ├── content-integrity.ts
        ├── deck-builder.ts
        └── infographic-builder.ts

Capa 5 (Renderizadores de salida PPTX / SVG / PDF)
  ├── src/lib/visual-engine/sacrint/svg/{core-primitives,math-graphs,schematic-diagrams}.ts
  ├── src/lib/visual-engine/sacrint/pptx/{theme-and-primitives,diagram-drawers,slide-composers}.ts
  └── slide-renderer.ts / infographic-renderer.ts / sacrint-rasterizer.ts
```

### Política de barrels (fachadas temporales)
- **Consumidores externos** (`src/app/api/**`, `src/lib/aula-package.ts`, `src/lib/guide-engine/material-review.ts`, `scripts/qa-sacrint-materials.ts`, `src/__tests__/**`) pueden seguir importando desde `spec.ts`, `content-distiller.ts`, `diagrams.ts`, `svg-primitives.ts` y `pedagogical-text-fitter.ts` durante Fases 2–5 para evitar diffs masivos mezclados con lógica.
- **Módulos internos de `sacrint/*`** tienen **prohibido** importar desde una fachada/barrel: deben importar siempre su ruta directa de capa inferior.
- **Retiro de fachadas:** en Commit 5.5 se migran los consumidores de producción (`src/app/api/**`, `src/lib/**`, `scripts/**`) a rutas directas o a un único entrypoint documentado, y se verifica con el auditor de dependencias que ningún archivo interno cruce por barrel.

---

## 4. Candados obligatorios por cada commit (5 gates)

Ningún commit se da por cerrado hasta pasar los **5 checks en verde**:

1. `npx tsc --noEmit` → **0 errores**.
2. `npx eslint --max-warnings=0 <archivos tocados>` → **0 errores, 0 warnings**.
3. `npx vitest run` → **100 % verde** en todas las suites SACRINT/curriculares/editoriales (el test de benchmark de tiempo en `editorial-typst-spike.test.ts` se aísla en Fase 1 para no introducir falsos negativos por contención de CPU).
4. `npm run test:sacrint-golden` → **0 diffs** respecto a `tests/fixtures/sacrint-golden/*.golden.json` + **`qa-sacrint-materials.ts --strict`** en verde sobre los `.pptx` generados desde los fixtures dorados (`collisions=0`, `wrapNone=0`, `1/2 avg <= 170w`, `>200w = 0`, `argument_placeholder_leak = 0`, `right_panel_duplicates_left = 0`, `all_caps_sentence_banner = 0`, `diagram_label_body_mismatch = 0`).
5. `npm run audit:sacrint-deps` → **0 ciclos**, **0 violaciones de capa**, **0 imports internos por barrel**.

---

## 5. Plan quirúrgico por fases y commits

### Fase 0 — Prerrequisito funcional (CERRADA antes de refactorizar)
- [x] `PFH1`: eliminar `"Sin registro."` / `"Sin objeción registrada"` en mapa argumental + guardia `argument_placeholder_leak`.
- [x] `AAC`: de-duplicar `CICLO CREATIVO` vs panel izquierdo, quitar franja en MAYÚSCULAS, bajar `1/2` promedio de 222.7w a ~162.8w (`0` > 200w) + guardias `right_panel_duplicates_left` y `all_caps_sentence_banner`.
- [x] `PM1`: impedir modelos lineales falsos (`x̄`) por fracciones/proporciones o verbo `"muestra"` + evitar colisiones de etiquetas en `addGraph`.
- [x] `CNET2` / `CD1`: eliminar láminas `2/2` > 200w y reducir 6-gramas de CNET2 a < 20 %.
- [x] `AFD` / Socioemocional: alinear etiqueta↔cuerpo en `buildTrainingCycleDiagram` y `buildRegulationFlowDiagram` (usar `DIAGNÓSTICO / CRITERIO / APLICACIÓN / MEJORA` y `SITUACIÓN / ANÁLISIS / ACCIÓN / BIENESTAR` cuando la sesión no describe protocolo fisiológico/emocional explícito; activar `CALENTAMIENTO/…` o `EMOCIÓN/…` solo cuando ≥ 3 etapas coinciden semánticamente), bajar `AFD 1/2` promedio < 170w y agregar guardia QA `diagram_label_body_mismatch`.
- [x] Nomenclatura MCCEMS: `Propósitos Formativos` obligatorio en 1.º–4.º semestre y `Progresiones` solo en 5.º–6.º.

---

### Fase 1 — Infraestructura de seguridad (0 cambios de lógica · 2 commits)

| Commit | Alcance exacto | Archivos nuevos / editados | Criterio de cierre |
|---|---|---|---|
| **1.1 Golden Baseline** | Crear fixtures autocontenidos (sin depender de red ni BD en CI) cubriendo **todas las familias de diagramas**: Matemáticas (`linear`, `quadratic`, `system-2x2`, `exponential`, `geometry`), Humanidades (`argument`), Artes (`creative-cycle`), Educación Física (`training-cycle` conceptual **y** protocolo físico), Socioemocional (`regulation-flow` genérico **y** protocolo emocional), Cultura Digital (`block-diagram`), Ciencias (`concept`/`system-map`). Congelar snapshot determinista con: conteos de palabras por lámina, títulos, objetivos, actividades, `diagram.kind`, etiquetas/textos de nodos, fórmulas, conteo de páginas de `09` y hash SHA-256 del texto visible. | `tests/fixtures/sacrint-golden/workbooks.ts`<br>`tests/fixtures/sacrint-golden/baseline.golden.json`<br>`scripts/verify-sacrint-golden.ts`<br>`src/__tests__/sacrint-golden.test.ts`<br>`package.json` (`test:sacrint-golden`) | `npm run test:sacrint-golden` genera PPTX reales en temp, corre `auditPptxFile` + `auditWorkbookVisualQuality` + comparación exacta contra `baseline.golden.json` en < 10 s y pasa 100 %. |
| **1.2 Auditor de dependencias + aislamiento flake Typst** | Crear verificador estático sin dependencias pesadas (o `dependency-cruiser` si Opencode prefiere) que valida el DAG de capas 0→5, prohíbe ciclos en `src/lib/visual-engine/sacrint/**` y `src/lib/editorial/**`, y prohíbe imports internos a barrels. Además, separar el umbral de tiempo 8 s de `editorial-typst-spike.test.ts` (o permitir holgura en carga paralela CI sin debilitar la verificación funcional de compilación PDF). | `scripts/audit-sacrint-deps.mjs`<br>`package.json` (`audit:sacrint-deps`)<br>`src/__tests__/editorial-typst-spike.test.ts` | `npm run audit:sacrint-deps` devuelve 0 ciclos y exit code 0; `vitest run` pasa sin flakiness. |

---

### Fase 2 — Extracción de capas puras de bajo riesgo (5 commits)

| Commit | Módulo extraído | Contenido exacto | Origen adelgazado |
|---|---|---|---|
| **2.1** | `sacrint/types.ts` | Todas las interfaces/tipos de `SacrintSlide`, `SacrintDeckSpec`, `SacrintInfographicSpec`, `SacrintDiagramSpec` (17 variantes), `DistilledLessonBundle`, `SacrintBuildOptions`, `LessonGuideNoSessionsError`. | `spec.ts`, `diagrams.ts`, `content-distiller.ts` re-exportan desde `./types`. |
| **2.2** | `sacrint/text/grammar-normalization.ts` | `repairSpanishSurfaceGrammar`, `cleanSacrintText`, `sanitizePedagogicalMetaPhrases`, `isRubricOrBoilerplateLeak`, `stripTemplateLabels`, regex `NUMERIC_ONLY_STEP_RE`, `ORPHAN_LIST_END_RE`, `GENERIC_CONCLUSION_RE`, `TEMPLATE_PHRASE_RE`. | `content-distiller.ts` re-exporta. |
| **2.3** | `sacrint/text/six-gram-overlap.ts` | `GENERIC_SIX_GRAM_PARAPHRASES`, `TARGETED_OVERLAP_SYNONYMS`, `WINDOW_BREAKER_REPLACEMENTS`, caché `resolveSourceSixGrams`, `breakRemainingSixGramWindows`, `paraphraseSixGramOverlap`, `preventSixGramTheoryOverlap`, `sixGramOverlapRatio`, `enforceSixGramOverlap`. | `content-distiller.ts` re-exporta. |
| **2.4** | `sacrint/text/objective-and-activity-guards.ts` | `SECOND_PERSON_TO_INFINITIVE_MAP`, `isSpanishInfinitiveVerb`, `normalizeLearningObjective`, `validatePracticeActivity`, `extractCleanTopicTitle`, `extractChalkboardTopicTitle`, `cleanMissionTopicLine`. | `content-distiller.ts` re-exporta. |
| **2.5** | `editorial/fitter/{dangling-guards,sentence-splitter,text-compactor}.ts` | Partición cohesiva de `pedagogical-text-fitter.ts` (1,741 LOC): guardias de truncamiento (`hasDanglingEnding`, `isTruncatedAgainstSource`, `isPublishablePedagogicalText`), segmentación española (`splitSpanishSentences`) y ajuste/compresión (`fitPedagogicalText`, `finalizeVisibleText`, `compressPedagogicalText`). | `pedagogical-text-fitter.ts` queda como fachada (~60 LOC). |

---

### Fase 3 — Destilador de sesiones y motor de presupuesto (4 commits)

| Commit | Módulo extraído | Contenido exacto | Origen adelgazado |
|---|---|---|---|
| **3.1** | `sacrint/distiller/formula-extractor.ts` | `extractFormulasFromText`, `distillStepPreservingMath`, `isCompleteMathStep`, `isCompleteConclusion`, `isCompleteProblemStatement`, `isGenericMisconception`, `isValidRenderableFormula`. | `content-distiller.ts`, `diagrams.ts`. |
| **3.2** | `sacrint/distiller/lesson-bundle.ts` | `distillConciseText`, `extractBulletSentences`, `distillProblemOrExerciseText`, `buildPresentationSummary`, `extractConceptHighlights`, `extractWorkedExample`, `distillExerciseStatement`, `extractPracticeActivities`, `extractApplicationAndExit`, `distillLessonBundle`. | **`content-distiller.ts` baja de 4,334 LOC → ~120 LOC.** |
| **3.3** | `sacrint/builders/slide-budget.ts` | `collectDiagramText`, `slideVisibleText`, `countSlideWords`, `enforceLessonGuideSlideBudget`, `finalCompact` (incluyendo Etapas 8–10 de `1/2` y `2/2`), `pruneConceptualDiagram`, `sanitizeMechanicalSlideCorruption`, `sanitizeDiagramPostBudget`. | `spec.ts` reduce ~1,800 LOC. |
| **3.4** | `sacrint/builders/content-integrity.ts` | `ConceptFamily`, `conceptFamily`, `isFormulaCoherentWithTitle`, `validateSacrintContentIntegrity`, `ensureActivityClosure`. | `spec.ts` reduce ~700 LOC. |

---

### Fase 4 — Modularización de diagramas (5 commits)

| Commit | Módulo extraído | Contenido exacto | Origen adelgazado |
|---|---|---|---|
| **4.1** | `sacrint/diagrams/shared.ts` | `completeDetail`, `safeCompleteDetail`, `detail`, `firstSentence`, `niceTickStep`, `normalizedDiagramOverlap`, `toSessionScopedMission`, `compactNonQuantitativeDiagram`, `buildDistinctSessionCycleSources`. | `diagrams.ts`. |
| **4.2** | `sacrint/diagrams/math-diagrams.ts` | Parsers y builders de `linear`, `quadratic`, `system-2x2`, `exponential`, `geometry` + `tryDetectDiagramFromTexts` + `buildMathDiagram`. | `diagrams.ts` reduce ~1,100 LOC. |
| **4.3** | `sacrint/diagrams/conceptual-diagrams.ts` | `buildReactionDiagram`, `buildArgumentDiagram`, `buildLanguageDiagram`, `buildConceptDiagram`, `buildTimelineDiagram`, `buildSystemMapDiagram`, `buildClinicalFlowDiagram`, `buildBlockDiagram`, `buildSopFlowDiagram`. | `diagrams.ts` reduce ~600 LOC. |
| **4.4** | `sacrint/diagrams/cycle-diagrams.ts` | `buildCreativeCycleDiagram`, `buildTrainingCycleDiagram`, `buildRegulationFlowDiagram` + `TRAINING_PROTOCOL_RULES`, `REGULATION_PROTOCOL_RULES`, `tryExtractDomainAlignedNodes`. | `diagrams.ts` reduce ~350 LOC. |
| **4.5** | `sacrint/diagrams/registry.ts` | `buildSacrintDiagram`, `buildDiagramVariables`, `diagramFormula`, `diagramModelLabel`, `diagramSubtitle`, `diagramFooterLabel`, `stepLabelsForPack`. | **`diagrams.ts` baja de ~2,850 LOC → ~60 LOC.** |

---

### Fase 5 — Builders `08`/`09`, renderizadores y limpieza de fachadas (5 commits)

| Commit | Módulo extraído | Contenido exacto | Origen adelgazado |
|---|---|---|---|
| **5.1** | `sacrint/builders/deck-builder.ts` | `collectWorkbookTheorySources`, `buildLessonGuideSlidesForSession`, `buildSacrintDeck`, `buildSacrintDecksForWorkbook`, `stripCoverMissionScaffolding`. | `spec.ts` reduce ~1,600 LOC. |
| **5.2** | `sacrint/builders/infographic-builder.ts` | `buildSteps`, `selectInfographicTargets`, `dedupeInfographicSpecs`, `buildSacrintInfographic`. | **`spec.ts` baja de 5,691 LOC → ~90 LOC.** |
| **5.3** | `sacrint/pptx/{theme-and-primitives,diagram-drawers,slide-composers}.ts` | Separación de `sacrint-pptx-generator.ts` (2,104 LOC): paleta/helpers de caja/markers con anticolisión, los 17 drawers de diagrama y la composición de láminas (`cover`, `concept`, `practice`, `full`). | **`sacrint-pptx-generator.ts` baja a ~80 LOC.** |
| **5.4** | `sacrint/svg/{core-primitives,math-graphs,schematic-diagrams}.ts` | Separación de `svg-primitives.ts` (1,514 LOC): primitivas puras (`rect`, `line`, `panel`, `nodeCard`), gráficas cartesianas (`linearGraph`, `quadraticGraph`, `system2x2Graph`, `exponentialGraph`, `geometryDiagram`) y esquemas (`argumentMap`, `creativeCycleDiagram`, `trainingCycleDiagram`, `regulationFlowDiagram`, etc.). | **`svg-primitives.ts` baja a ~70 LOC.** |
| **5.5** | Migración de consumidores y cierre | Migrar imports en `src/app/api/**`, `src/lib/**` y `scripts/**` a rutas directas o `sacrint/index.ts` documentado; confirmar con `audit:sacrint-deps` 0 ciclos y 0 imports internos por barrel; re-correr QA estricto sobre los 6 paquetes vivos en BD (`PFH1`, `AAC`, `PM1`, `CNET2`, `CD1`, `AFD`). | Cierre formal del refactor. |

---

## 6. Riesgos, mitigación y rollback

| Riesgo | Mitigación concreta |
|---|---|
| **Regresión silenciosa en texto/diagramas** (pasa `tsc` y `vitest`, rompe semántica de `08`/`09`) | Golden snapshot por campo + hash SHA-256 + `qa-sacrint-materials --strict` ejecutado en **cada commit** desde Fase 1. |
| **Ciclos de importación entre `spec`, `content-distiller` y `diagrams`** | Extracción obligatoria de `sacrint/types.ts` en Commit 2.1 + verificación automática de DAG en `audit:sacrint-deps`. |
| **Romper pruebas o rutas API por mover símbolos** | Fachadas temporales preservan el 100 % de los exports públicos durante Fases 2–5; las pruebas corren completas tras cada commit. |
| **Necesidad de abortar a mitad de proceso** | Cada commit es independiente y desplegable; revertir cualquier commit deja el árbol 100 % operativo con el golden intacto. |

---

## 7. Puntos de revisión solicitados a Opencode antes de ejecutar Fase 1

1. **Ámbito del golden (`Fase 1.1`):** ¿estás de acuerdo con congelar 7 fixtures sintéticos/anonimizados representativos en repo (`tests/fixtures/sacrint-golden/`) más validación periódica contra las 6 planeaciones vivas de Neon DB, o prefieres agregar algún caso límite adicional (p. ej. Laboral `sop-flow`, Química `reaction`, Historia `timeline`)?
2. **Auditor de dependencias (`Fase 1.2`):** ¿prefieres un script determinista propio sin nuevas dependencias (`scripts/audit-sacrint-deps.mjs`) o instalar `dependency-cruiser` en `devDependencies`?
3. **Granularidad de Fases 2–5 (21 commits atómicos):** ¿ves alguna frontera de módulo mal trazada o algún archivo que convenga fusionar/dividir distinto antes de comenzar?
4. **Orden de trabajo del usuario:** una vez aprobado este plan y completadas Fases 1–5 con golden diff = 0, el usuario reanudará la generación de asignaturas de 2.º–4.º semestre como prueba de estrés en producción.
