# Auditoría y Remediación — Prompts, Writers y Clasificador Disciplinar para 400+ UAC (SIGPDA-EMS)

- **Fecha:** 2026-11-20
- **Repositorio:** `C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS`
- **Commit base (HEAD):** `f7bc947a` (*sin commit nuevo, según límite explícito*)
- **Veredicto sobre la auditoría previa de Opencode:** **De acuerdo sustancialmente** — las 6 hipótesis (`H1`–`H6`) se reprodujeron con evidencia directa en el código y las sondas. Además, la inspección completa de las 204 UAC únicas en `scripts/data/curriculum_canonical_203.json` reveló colisiones adicionales por subcadenas (`cad` en *aplicado/diagnosticado/especificada/indicadas* y `logica` en *agroecológicas/médicoodontológica*) y 16 UAC culinarias + 7 de TI/Redes cayendo en industrial. Se ejecutó el plan completo (Fases 0, 1, 2 y 3).

---

## 1. Fase 0 — Tabla de Verificación de Hipótesis

| Hallazgo | Evidencia (`archivo:línea` o comando) | ¿Se reproduce? | Decisión propuesta | Riesgo |
|---|---|---|---|---|
| **H1 — Clasificador disciplinar roto a escala 400+** (`23/204` fallback genérico, `76/204` industrial, colisiones por `includes()` y default `normComp.includes('laboral')`) | `src/lib/prompts/disciplinary-adapters/index.ts:891–1112`; `npx --no-install tsx scripts/tmp-adapter-coverage.ts`; `npx --no-install tsx scripts/tmp-adapter-probe.ts`; barrido completo de las 204 UAC | **Sí** (y peor que lo reportado: además de `artes` en *artesanales*, `cad` capturó 6 UAC no técnicas y `logica` capturó 4 UAC agroecológicas/dentales) | Reescribir `getDisciplinaryAdapter` con normalización, mapa canónico de prefijos UAC, señal secundaria de carrera, reglas por límites de palabra, eliminación del default `laboral → industrial`, y 2 adaptadores dedicados: `formacion_laboral_salud_clinica` y `lengua_extranjera_general`. Conservar `Laboratorio de Investigación` como único fallback legítimo (`1/204`). | Bajo: se preservan los 15 IDs existentes y todas las pruebas previas; se añade cobertura en `cross-contamination-guard.ts` y `curated-resources.ts`. |
| **H2 — Contrato de palabras incoherente y QA de densidad laxo** (`~780–920` vs suma de mínimos `>1,037`, `content-budget.ts` `1,125–1,250`, tope `Math.min(720, ...)` en `session-shard.ts:119`) | `src/lib/guide-engine/writers/session-prompt-contract.ts:23–54`; `src/lib/guide-engine/content-budget.ts:59–60,346–378`; `src/lib/guide-engine/writers/session-shard.ts:102–122`; `foundation-writer.ts:72` (`0.72`) vs `lab/project/evaluation` (`0.78`) | **Sí** | Definir SSoT `SESSION_PLAN_WORD_CONTRACT` (`1,120–1,250` palabras/sesión; suma exacta de mínimos `1,096 ≤ 1,120 ≤ 1,250`). Unificar los 4 writers en `sessionPlanWordTarget` (piso `1,120`, ratio `0.94`). Quitar el tope `720` en `densityThresholdsFor`: `minTotalWords = Math.max(790, Math.round(target * 0.895))` (`1,002` a `1,120`), `minContenidoWords = 320`, `minEjemploWords = 220`. | Medio-bajo: se actualizaron 4 fixtures/expectativas en tests que reflejaban explícitamente el contrato anterior (`0.72/0.78`, `900`, `198w`), sin relajar QA. |
| **H3 — Sesgos disciplinares transversales en prompts** (`NÚMEROS`, `2x+5=15`, `NOM/ISO`, `Parámetros`, `Seguridad`, `Laboratorio/Taller`, `y física`) | `foundation-writer.ts:91,136,142,144–145,233,321`; `lab-writer.ts:228,282,490`; `project-writer.ts:143–144,187,191,197,390,392,416,423`; `evaluation-writer.ts:211,274–276,286–348` | **Sí** (incluye también sesgos confirmados en `lab-writer.ts`) | Declarar metadatos por adaptador en `DisciplinaryAdapterV2` (`requiresQuantitativeData`, `requiresNormativeStandards`, `requiresLabSafety`, `approachDescriptor`, `practiceSpaceLabel`, `projectAcceptanceDirective`, `projectLogTemplate`, `projectSpecsExample`, `evaluationChecklistCategories`, `evaluationChecklistExample`) y eliminar condicionales por nombre de UAC en los 4 writers. | Bajo: preserva todo el rigor técnico/sanitario donde aplica y limpia humanidades/comunicación/matemáticas. |
| **H4 — Pérdida de contexto en `session-plan-completion.ts`** (`getDisciplinaryAdapter(params.uacName)` sin `component`, `curriculumName` ni `careerOrProgramName`) | `src/lib/guide-engine/writers/session-plan-completion.ts:7–18,73`; `lab-writer.ts:435–445`; `project-writer.ts:445–455`; `session-shard.ts:235` (faltaba `curriculumName`) | **Sí** | Extender `MissingPlanParams` con campos opcionales `component`, `curriculumName`, `careerOrProgramName` (retrocompatible), exportar `resolveCompletionAdapter` y propagar el contexto completo desde `lab-writer.ts`, `project-writer.ts` y `session-shard.ts:235`. | Muy bajo: cambio estrictamente aditivo y retrocompatible. |
| **H5 — Falta de gate de `sintesisVisual` en `session-shard.ts`** | `session-prompt-contract.ts:47–54`; `writer-contract.ts:349–404` (devuelve `undefined` si falta, no rellena); `session-shard.ts:124–169` (nunca inspeccionaba `plan.sintesisVisual`) | **Sí** (riesgo estructural confirmado para 400+ UAC; no se atribuye como causa del `08` previo de PM3) | Añadir `validateVisualSynthesisDeficits(plan)` en `session-shard.ts` e integrarlo en `evaluateSessionPlanDensity` bajo `requireVisualSynthesis` (activo por defecto en `generateShardedSessionPlans`, disparando reparación quirúrgica solo para la sesión deficiente sin bloquear ni romper `06`). | Bajo: los fixtures de test unitarios previos sin `sintesisVisual` se actualizaron al contrato V2. |
| **H6 — Documentación desalineada (`docs/CATALOGO_PROMPTS_LIBROS_V2.md`)** | `docs/CATALOGO_PROMPTS_LIBROS_V2.md:5,13,195,428–434` (aún decía `"No aplicar"`, `~780–920` y `minTotalWords = 720`) | **Sí** | Actualizar `docs/CATALOGO_PROMPTS_LIBROS_V2.md` al estado vigente (V2.1), eliminar la tabla duplicada de presupuestos y apuntar a `content-budget.ts`, `session-prompt-contract.ts` y `session-shard.ts` como SSoT. | Muy bajo: solo documentación. |

---

## 2. Hallazgos Confirmados, Adicionales y Reconciliación de Conflictos

### 2.1 Hallazgos confirmados y adicionales descubiertos en Fase 0 y Fase 3
1. **Todos los casos reportados en `H1`–`H6` se confirmaron.**
2. **Hallazgos adicionales detectados al auditar las 204 UAC completas de `curriculum_canonical_203.json`:**
   - **Subcadena `cad` en `dibujo_tecnico_diseno_arquitectura`:** capturaba erróneamente *Pensamiento Matemático Aplicado a las Finanzas I y II* (`apli**cad**o`), *Asiste especialistas del área en las necesidades del paciente diagnosticado* (`diagnosti**cad**o`), *Prepara materiales en cantidad y calidad especificada...* (`especifi**cad**a`) y 2 UAC de *Servicios Ecosistémicos* (`indi**cad**as`).
   - **Subcadena `logica` en `humanidades_filosofia_logica_etica`:** capturaba 3 UAC de *Agricultura Sostenible de Traspatio* (`agroeco**logica**s`) y 1 UAC de *Mecánica Dental* (`médicoodonto**logica**`).
   - **16 UAC culinarias y de panificación en industrial:** las 8 UAC de *Preparación de Alimentos Artesanales* y las 8 de *Procesos Culinarios y Repostería* caían en `formacion_laboral_industrial_agro_salud` porque `normCareer` no contemplaba `culinarios` ni `alimentos artesanales`.
   - **7 UAC de TI/Redes en industrial y 1 en matemáticas:** 5 UAC de *Redes y Mantenimiento* y 2 de *Tecnología Informática* caían en industrial; *Elabora libros electrónicos en hojas de cálculo (Tecnología Informática)* y 3 UAC de *Contabilidad* caían en `pensamiento_matematico` por la palabra `calculo`.
   - **Fragmentación de *Comunicación Gráfica*:** sus 8 UAC se repartían en 3 adaptadores distintos (`industrial`, `artes` por `artesanales` y `cultura_digital`). Ahora las 8 resuelven coherentemente a `artes_educacion_artistica_cultural`.
   - **Sesgo de `lab-writer.ts`:** además de `foundation`, `project` y `evaluation`, `lab-writer.ts:228,282,490` forzaba `"Laboratorio/Taller"`, `"rigor experimental"`, `"instrucción cuantitativa"` y `"Protocolo Técnico:"` en todas las disciplinas.
   - **Fricción detectada en el piloto de 3 UAC (Fase 3):** `workedExampleDirective` en `tecnica_laboral` y `formacion_laboral_salud_clinica` pedía `"Paso 4: Dictamen de calidad..."` / `"Verificación de seguridad..."` sin la palabra `"Conclusión"`, provocando un rechazo de `hasCompleteWorkedExampleClosure` en el piloto de *Mecánica Dental*. Se corrigió el prompt de ambos adaptadores para pedir explícitamente `"Paso 4: Conclusión..."` **sin relajar** el validador `hasCompleteWorkedExampleClosure`.
3. **Hallazgos descartados / matizados:**
   - **Fallback de `Laboratorio de Investigación` (FFEO):** NO se forzó a un adaptador artificial; se clasificó intencionalmente en `indagacion_interdisciplinaria_general` por ser un taller de metodología interdisciplinaria.
   - **`Ciencias Naturales, Experimentales y Tecnología I–VI`:** sí se clasificó como fallback **erróneo** (no legítimo), porque `indagacion_interdisciplinaria_general` pertenece a `humanistica_comunicativa_social`, prohíbe ejemplos cuantitativos y bloquea términos científicos en `cross-contamination-guard.ts`. Se asignaron II y V a `ciencias_fisica_ingenieria`, y I, III, IV y VI a `ciencias_quimica_biologia_ambiental` (`cuantitativa_experimental`).
   - **Causa del `08` previo de PM3:** no se atribuye a `H5` sin evidencia; `H5` se documenta y corrige como riesgo estructural real al escalar a 400+ UAC.

### 2.2 Reconciliación trazable de conflictos con `AGENTS.md`
1. **`AGENTS.md` ("solo pistas, sin solución completa") vs `practica[].solucion` en el contrato:**
   - **Trazabilidad en código:** `src/__tests__/student-teacher-parity.test.ts:11,408–418` verifica estáticamente que ni `pdf-workbook-renderer.ts` ni `docx-workbook-renderer.ts` acceden jamás a `.solucion`. `practica[].solucion` solo es consumido por `src/lib/guide-engine/material-extractor.ts:787` para construir el solucionario docente (`04_Solucionario` / `07_Solucionario`) y auditado por `material-review.ts:683`.
   - **Decisión:** se **conserva** `practica[].solucion` en el contrato y se explicita en el prompt que es de uso exclusivo para el solucionario docente y nunca se imprime en el libro del estudiante (`06`).
2. **`AGENTS.md` ("ejemplo resuelto paso a paso con números") vs disciplinas humanísticas/comunicativas:**
   - **Decisión reconciliada por familia/adaptador:** `requiresQuantitativeData = true` aplica en `cuantitativa_experimental`, `computacional_algoritmica`, `corporal_motriz` y `tecnica_laboral` (incluyendo salud clínica y servicios/costeo). En `humanistica_comunicativa_social` (`requiresQuantitativeData = false`) se exige un ejemplo resuelto igual de concreto y verificable con textos, fuentes, casos o evidencia argumentativa, evitando números artificiales y preservando el principio de contenido real y autodidacta en voz de estudiante (`tú`) sin etiquetas docentes.

---

## 3. Decisiones Técnicas y Archivos Modificados

No se agregaron dependencias, no se modificaron modelos ni proveedores de IA (`gemini-3.5-flash-lite`), no se tocaron datos de producción, no se eliminaron los scripts `scripts/tmp-*.ts` y no se modificó `scripts/qa-sacrint-materials.ts`.

| Archivo | Cambio realizado |
|---|---|
| `src/lib/prompts/disciplinary-adapters/index.ts` | 17 dominios (nuevos `formacion_laboral_salud_clinica` y `lengua_extranjera_general`), metadatos declarativos V2.1 para writers, normalizador + mapa canónico + señal de carrera + coincidencia por límites de palabra, eliminación del default `laboral → industrial`. |
| `src/lib/guide-engine/cross-contamination-guard.ts` | Soporte nativo para `formacion_laboral_salud_clinica` y ampliación de `isCulinary` (`alimentos artesanales`, `panificaci`). |
| `src/lib/resources/curated-resources.ts` | Etiquetas curadas para `formacion_laboral_salud_clinica` y `lengua_extranjera_general`. |
| `src/lib/guide-engine/writers/session-prompt-contract.ts` | Exportación de `SESSION_PLAN_WORD_CONTRACT` (`1,120–1,250`) y `computeSessionPlanContractMinWords()` (`1,096`), interpolación directa en el prompt y nota explícita de solucionario docente. |
| `src/lib/guide-engine/writers/session-shard.ts` | `sessionPlanWordTarget` con piso `1,120` y ratio `0.94`; `densityThresholdsFor` sin tope `720` (`minContenidoWords = 320`, `minEjemploWords = 220`, `minTotalWords ≈ 1,002` a `1,120`); gate `validateVisualSynthesisDeficits`; corrección de `curriculumName \|\| careerOrProgramName` en `buildSessionPackPrompts`. |
| `src/lib/guide-engine/writers/session-plan-completion.ts` | Extensión retrocompatible de `MissingPlanParams` con `component`, `curriculumName`, `careerOrProgramName` y `resolveCompletionAdapter`. |
| `src/lib/guide-engine/writers/foundation-writer.ts` | Unificación con `sessionPlanWordTarget` y prompts condicionados por metadatos del adaptador (sin `NÚMEROS`, `2x+5=15`, `estándar industrial` ni `física` en disciplinas cualitativas). |
| `src/lib/guide-engine/writers/lab-writer.ts` | Unificación con `sessionPlanWordTarget`, etiqueta `discipline.practiceSpaceLabel`, reintento y encabezado condicionados, y paso completo de contexto a `generateMissingSessionPlans`. |
| `src/lib/guide-engine/writers/project-writer.ts` | Unificación con `sessionPlanWordTarget`, eliminación de `NOM/ISO`, `Parámetros:` y `Diagnóstico técnico` en humanidades usando metadatos del adaptador, y paso completo de contexto a `generateMissingSessionPlans`. |
| `src/lib/guide-engine/writers/evaluation-writer.ts` | Unificación con `sessionPlanWordTarget`, categorías y ejemplo de checklist por adaptador (cero `"Seguridad"` en humanidades) y ejemplos de `tieredExercises` / metacognición adaptados. |
| `docs/CATALOGO_PROMPTS_LIBROS_V2.md` | Actualizado a V2.1 vigente, eliminando tablas duplicadas y apuntando a la SSoT en código. |
| `src/__tests__/prompts-400uac-generalization.test.ts` | **Nueva suite permanente** (57 pruebas de regresión de clasificador, contrato, completado, pureza de prompts y gate `sintesisVisual`). |
| `src/__tests__/session-shard.test.ts`, `proactive-alignment-and-sharding.test.ts`, `writer-prompts-calibration.test.ts`, `prompts-v2-contract.test.ts`, `job-cooldown-resilience.test.ts` | Actualización de fixtures/expectativas alineadas al contrato V2 (`sintesisVisual`, `minEjemploWords = 220`, piso `1,120` y eliminación de `as any`). |

---

## 4. Comandos Ejecutados y Resultados Reales

| Comando | Resultado real |
|---|---|
| `git status --short` / `git log -1 --oneline` | HEAD `f7bc947a`; los 5 scripts `scripts/tmp-*.ts` intactos. |
| `npx --no-install tsx scripts/tmp-adapter-coverage.ts` | Antes: `fallbackCount = 23`, `industrial = 76`. Después: **`fallbackCount = 1` (`Laboratorio de Investigación`), `industrial = 40`, `salud_clinica = 16`, `servicios = 44`, `cultura_digital = 20`**. |
| `npx --no-install tsx scripts/tmp-adapter-probe.ts` | **35/35 sondas** clasificadas correctamente (incluyendo `Mecánica Dental → salud_clinica`, `Francés → lengua_extranjera_general`, `Preparación de Alimentos Artesanales → servicios`, `Estética y Belleza → servicios`, `Geografía → ciencias_sociales`). |
| `npx --no-install tsc --noEmit` | **Exit 0** (0 errores de TypeScript). |
| `npx --no-install eslint --max-warnings=0 <16 archivos modificados/creados>` | **Exit 0** (0 errores, 0 warnings). |
| `npm run test:isolation` | **OK:** 300 archivos unitarios sin acceso directo a Neon. |
| `npm run test:keywords` | **OK:** 0 colisiones de subcadenas en `REGLAS` (16/16 casos canónicos). |
| `npx --no-install vitest run --maxWorkers=2` + re-ejecución tras actualizar fixture `job-cooldown-resilience.test.ts` | **300/300 archivos aprobados** (299/300 en la primera corrida completa + `job-cooldown-resilience.test.ts` 8/8 aprobado tras añadir `sintesisVisual` al fixture; 2,481 tests passed, 7 skipped, 0 failed). Suite dirigida post-ajuste final: **9/9 archivos, 138/138 tests passed** (`prompts-400uac-generalization.test.ts` 57/57). |
| `npx --no-install tsx scripts/tmp-render-06.ts` (solo lectura sobre PM3 en Neon) | **Baseline `06` conservado sin regresiones:** Bloque 1 (55 págs, 38,191 pal., `findings: {}`), Bloque 2 (59 págs, 38,730 pal., únicamente el falso positivo conocido `dangling_question`), Bloque 3 (55 págs, 36,966 pal., `findings: {}`). **0 glued, 0 orphan, 0 latex.** |
| Piloto acotado 3 UAC (`scratch/pilot_3uac.ts` con render real `06` PDF + `08` PPTX + `09` PDF + `qa-sacrint-materials`) | **3/3 UAC aprobadas** en densidad V2 (`minTotalWords = 1,002`, `minContenido = 320`, `minEjemplo = 220`, `requireVisualSynthesis = true`), anti-contaminación (`0 issues`) y QA de `06`/`08`/`09` (`0 findings`, `0 collisions`, `0 wrapNone`, `0 outOfBounds`). *(Nota: piloto determinista con fixtures V2 conformes al nuevo contrato y renderizado real de PDF/PPTX/Infografías; no genera llamadas a IA ni escribe en BD de producción).* |

---

## 5. Métricas Antes / Después

### 5.1 Clasificador Disciplinar (`curriculum_canonical_203.json` — 204 UAC únicas)

| Métrica | Antes | Después |
|---|---:|---:|
| UAC en `indagacion_interdisciplinaria_general` (fallback) | **23 (11.3%)** | **1 (0.5%)** (`Laboratorio de Investigación`, justificado) |
| UAC en `formacion_laboral_industrial_agro_salud` | **76 (37.3%)** | **40 (19.6%)** (solo industrial, eléctrica, domótica, construcción, agro/ecosistemas) |
| UAC en `formacion_laboral_salud_clinica` (nuevo) | 0 | **16 (7.8%)** (`Área de la Salud` + `Mecánica Dental`) |
| UAC en `formacion_laboral_servicios_gestion_turismo` | 23 | **44 (21.6%)** (+16 culinarias/artesanales + 3 Contabilidad + 2 Procesos Contables) |
| UAC en `cultura_digital_programacion_ti` | 13 | **20 (9.8%)** (+7 de Redes y Tecnología Informática) |
| UAC en `dibujo_tecnico_diseno_arquitectura` | 8 (6 falsos `cad`) | **2 (1.0%)** (solo `Dibujo Técnico I y II`) |
| UAC en `artes_educacion_artistica_cultural` | 2 (por `artesanales`) | **11 (5.4%)** (`Comunicación Gráfica` 8 + `Arte y Cultura` 2 + `Actividades Artísticas` 1) |
| Falsos positivos por subcadena (`artes`, `cad`, `logica`) | **11+ detectados** | **0** |
| Sondas `tmp-adapter-probe.ts` acertadas | ~16/35 | **35/35 (100%)** |

### 5.2 Contrato de Palabras y Umbrales de Densidad

| Parámetro | Antes | Después |
|---|---|---|
| Encabezado `session-prompt-contract.ts` | `~780 a 920` (contradecía sus propios mínimos) | **`1,120 a 1,250`** (interpolado de `SESSION_PLAN_WORD_CONTRACT`) |
| Suma exacta de mínimos declarados | `~1,037–1,100+` (> máx. `920`) | **`1,096`** (`≤ 1,120 ≤ 1,250`, invariante verificado en test) |
| `sessionPlanWordTarget` (misión estándar `1,188 w/sesión`) | `855` (`foundation`) / `927` (`lab/project/eval`) / `903` (`shard`) | **`1,120`** unificado en los 4 writers y `session-shard` |
| `densityThresholdsFor(target).minTotalWords` | Tope duro `Math.min(720, ...)` → **`720`** | **`1,002`** a `target = 1,120` (sin tope artificial) |
| `minContenidoWords` / `minEjemploWords` | `300` / `190` | **`320` / `220`** (exacto al contrato y `session-plan-expansion.ts`) |
| Validación de `sintesisVisual` en `session-shard` | Ninguna | **Activa por defecto** (`validateVisualSynthesisDeficits` + reparación quirúrgica) |

### 5.3 Piloto Acotado de 3 UAC Diversas (Render Real `06` + `08` + `09` + QA)

| UAC | Adaptador (`family`) | Palabras sesión (`min 1,002`) | Densidad V2 | Contaminación | `06` PDF (págs / findings) | `08` PPTX (`slide12Avg` / colisiones / findings) | `09` Infografía (findings) |
|---|---|---:|:---:|:---:|:---:|:---:|:---:|
| **Lenguaje y Comunicación I** | `lengua_comunicacion_literatura` (`humanistica_comunicativa_social`) | 1,244 | ✅ OK (`0` déficits) | ✅ 0 | 12 págs / `0` | 164 / `0` / `0` | `0` |
| **Mecánica Dental** | `formacion_laboral_salud_clinica` (`tecnica_laboral`) | 1,324 | ✅ OK (`0` déficits) | ✅ 0 | 11 págs / `0` | 186 / `0` / `0` | `0` |
| **Pensamiento Matemático I** | `pensamiento_matematico` (`cuantitativa_experimental`) | 1,172 | ✅ OK (`0` déficits) | ✅ 0 | 11 págs / `0` | 159 / `0` / `0` | `0` |

---

## 6. Pruebas Nuevas y Cómo Ejecutarlas

- **Archivo nuevo permanente:** `src/__tests__/prompts-400uac-generalization.test.ts` (57 pruebas).
- **Ejecución directa:**
  ```bash
  npx --no-install vitest run src/__tests__/prompts-400uac-generalization.test.ts
  ```
- **Validación completa del módulo de prompts/writers:**
  ```bash
  npx --no-install tsc --noEmit
  npx --no-install vitest run src/__tests__/prompts-400uac-generalization.test.ts src/__tests__/prompts-v2-contract.test.ts src/__tests__/session-shard.test.ts src/__tests__/proactive-alignment-and-sharding.test.ts src/__tests__/writer-prompts-calibration.test.ts src/__tests__/job-cooldown-resilience.test.ts src/__tests__/universal-uac-architecture.test.ts src/__tests__/student-teacher-parity.test.ts
  npm run test:isolation && npm run test:keywords
  ```

---

## 7. Riesgos Residuales y Confirmación de Integridad de QA

1. **Riesgos residuales:**
   - **Tasa real de reintentos en LLM vivo:** al subir `minTotalWords` de `720` a `~1,002`, `minContenidoWords` de `300` a `320`, `minEjemploWords` de `190` a `220` y activar el gate de `sintesisVisual`, las primeras corridas reales con `gemini-3.5-flash-lite` podrían disparar alguna reparación quirúrgica adicional si el modelo tiende a resumir en bloques de 24 sesiones. Se recomienda ejecutar **1 generación real end-to-end en entorno de pruebas** sobre 3 UAC diversas (p. ej. *Lenguaje y Comunicación I*, *Mecánica Dental* y *Pensamiento Matemático I*) y medir `repairedSessions`, `stillDeficient`, latencia y tasa de `429/503` antes de escalar a 400 UAC.
   - **Catálogo futuro (>204 UAC):** cualquier carrera técnica nueva cuyo nombre no esté en `CANONICAL_UAC_PREFIX_MAP` ni `resolveByCareerSignal` caerá de forma segura en `indagacion_interdisciplinaria_general` en lugar de industrial; conviene revisar periódicamente nuevos nombres de carreras al cargarlas en BD.
   - **Métrica `slide12Avg = 186` en Mecánica Dental (piloto):** aunque `08` pasó sin colisiones ni hallazgos y `< 200`, los términos clínicos extensos en `sintesisVisual` acercan la lámina `1/2` al borde de 170–190 palabras; vigilar el promedio en generación real.
2. **Confirmación explícita de integridad de QA:**
   - **No se relajó ningún umbral de QA** (`scripts/qa-sacrint-materials.ts` no fue modificado; los umbrales de `session-shard.ts` se endurecieron al alinearlos con `SESSION_PLAN_WORD_CONTRACT`, de `720/300/190` a `1,002/320/220` + gate `sintesisVisual`).
   - **No se ocultó ningún fallo ni se eliminaron validaciones ni campos.**
   - **No se realizó commit, no se agregaron dependencias, no se tocaron datos de producción y se preservaron intactos todos los scripts `scripts/tmp-*.ts`.**
