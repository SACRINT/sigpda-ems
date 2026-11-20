# Instrucciones Técnicas para Opencode — Implementación y Consumo de los Prompts V2 de Libros (`CATALOGO_PROMPTS_LIBROS_V2.md`)

Este documento detalla los pasos exactos para conectar el catálogo **[CATALOGO_PROMPTS_LIBROS_V2.md](./CATALOGO_PROMPTS_LIBROS_V2.md)** al motor de generación de libros y materiales derivados de SIGPDA-EMS.

> **Orden de ejecución obligatorio:**
> 1. **Primero:** Terminar y verificar al 100% los 6 puntos P0 de remediación de `08_Presentaciones`, `09_Infografías` y `√` en `06_Libro_Semestral` sobre la planeación actual de Pensamiento Matemático III (`c416a62e-a247-4d9e-8749-5cb955da6714`).
> 2. **Segundo:** Una vez aprobado PM3, aplicar esta actualización V2 de prompts antes de generar libros de nuevas asignaturas.

---

## Prompt listo para copiar y pegar en Opencode (Fase V2 de Prompts)

```markdown
Lee completo el archivo `docs/CATALOGO_PROMPTS_LIBROS_V2.md` y aplica su arquitectura V2 en la plataforma para que todos los generadores de libros y materiales (`06`, `08`, `09`, `03`, `04`, `05`, `07`) consuman los nuevos prompts unificados y el bloque nativo `sintesisVisual`.

Ejecuta los cambios en este orden exacto, manteniendo retrocompatibilidad total con los libros V1 ya almacenados en PostgreSQL/Neon:

### PASO 1 — Tipos e Interfaces (`src/types/work-textbook.ts`)
1. Agrega la interfaz `SessionVisualSynthesis` exactamente como está definida en la sección `3.1` de `docs/CATALOGO_PROMPTS_LIBROS_V2.md`:
   - `conceptoBreve: string`
   - `formulaOReglaClave: string`
   - `ejemploBreve: { planteamiento: string; pasos: string[]; conclusion: string }`
   - `mapaConceptual: { definicionClave: string; criterioDesarrollo: string; errorComun: string; correccionBreve: string }`
2. Añade `sintesisVisual?: SessionVisualSynthesis;` como campo opcional en `SessionPlan`.

### PASO 2 — Matriz V2 de 15 Adaptadores Disciplinares (`src/lib/prompts/disciplinary-adapters/index.ts`)
1. Extiende `DisciplinaryDomainId` añadiendo `'indagacion_interdisciplinaria_general'`.
2. Agrega el tipo `EpistemologicalFamily` (`'cuantitativa_experimental' | 'humanistica_comunicativa_social' | 'computacional_algoritmica' | 'corporal_motriz' | 'tecnica_laboral'`) y las 3 propiedades nuevas en `DisciplinaryAdapter`:
   - `family: EpistemologicalFamily`
   - `workedExampleDirective: string`
   - `defaultTableColumns: string[]`
   - `keyFormulaOrRuleDirective: string`
3. Pobla esas propiedades en los 14 adaptadores existentes siguiendo la sección `2.2` de `docs/CATALOGO_PROMPTS_LIBROS_V2.md`.
4. Registra el adaptador #15 `indagacion_interdisciplinaria_general` y úsalo como retorno final por defecto en `getDisciplinaryAdapter` (reemplazando el fallback riesgoso a `ADAPTERS.ciencias_quimica_biologia_ambiental` de la línea 826).

### PASO 3 — Contrato Único de Prompt de Sesiones (`src/lib/guide-engine/writers/session-prompt-contract.ts`)
1. Crea el archivo `src/lib/guide-engine/writers/session-prompt-contract.ts` que exporte:
   - `buildCanonicalSessionPlanInstructions(adapter: DisciplinaryAdapter, missionType: 'foundation' | 'lab' | 'project' | 'evaluation', options?: { firstSession?: number }): string`
   - `buildCanonicalSessionPlanJsonExample(adapter: DisciplinaryAdapter, firstSession?: number): string`
2. Incluye las reglas de la sección `3.2` de `docs/CATALOGO_PROMPTS_LIBROS_V2.md`:
   - Voz estricta en segunda persona (`tú`).
   - Presupuesto equilibrado: `contenido` de `320 a 440` palabras en 3 párrafos separados por `\n\n`; `ejemploResuelto` de `220 a 300` palabras con `Planteamiento:`, `Paso 1:`, `Paso 2:`, `Paso 3:` y `Paso 4:` siempre en líneas separadas (`\n`).
   - `practica`: 2 ejercicios autocontenidos con todos sus datos y consigna explícita (pregunta o verbo imperativo), prohibiendo remitir a *"del ejercicio anterior"*.
   - `sintesisVisual`: especificación completa de `conceptoBreve`, `formulaOReglaClave`, `ejemploBreve` y `mapaConceptual`.
   - Higiene tipográfica: símbolos Unicode (`√`, `²`, `³`, `≠`, `≤`, `≥`, `°`), prohibición de `raiz(`, `sqrt(`, `!=`, `$...$` y `x_v`.

### PASO 4 — Actualizar los 4 Escritores y los 4 Agentes Auxiliares de Sesiones
Actualiza los prompts conforme a la sección `4` de `docs/CATALOGO_PROMPTS_LIBROS_V2.md`:
1. `src/lib/guide-engine/writers/foundation-writer.ts`:
   - Usa el prompt V2 de la sección `4.1` (100% voz de estudiante, sin `"demostración docente"`).
   - Consume `buildCanonicalSessionPlanInstructions`.
2. `src/lib/guide-engine/writers/lab-writer.ts`:
   - Usa el prompt V2 de la sección `4.2`, adaptando el procedimiento y `dataTableColumns` a `discipline.family` y `discipline.defaultTableColumns` (para no forzar tablas de laboratorio físico/químico en Humanidades, Lengua, Historia, Inglés, Artes o Socioemocional).
3. `src/lib/guide-engine/writers/project-writer.ts`:
   - Usa el prompt V2 de la sección `4.3` y consume `buildCanonicalSessionPlanInstructions`.
4. `src/lib/guide-engine/writers/evaluation-writer.ts`:
   - Usa el prompt V2 de la sección `4.4` (voz de estudiante, sin jerga de `"evaluador educativo"` ni `"dictamen formativo"`).
   - En el esquema JSON de ejemplo de `"rubric"`, muestra **4 criterios con `weightPercent: 25` cada uno (suma = 100)** en lugar de 1 criterio con `100`.
5. `src/lib/guide-engine/writers/session-shard.ts`:
   - Consume `buildCanonicalSessionPlanInstructions` en `buildSessionPackPrompts`.
   - En `termsBlock`, indica integrar los términos en sustantivo o presente natural (transformando verbos en futuro como `"Identificarás..."` a forma conceptual/presente).
   - Actualiza `densityThresholdsFor`: `minContenidoWords: 300`, `minContenidoParagraphs: 3`, `minEjemploWords: 190`, `minEjemploSteps: 3`, `minPractica: 2`, `minPracticaEnunciadoWords: 28`, `minTotalWords: Math.min(720, Math.round(targetWordsPerPlan * 0.78))`.
6. `src/lib/guide-engine/writers/session-plan-completion.ts`, `src/lib/guide-engine/session-plan-expansion.ts` y `src/lib/guide-engine/resilience-agent.ts`:
   - Alinea sus prompts con la sección `4.6` de `docs/CATALOGO_PROMPTS_LIBROS_V2.md`.

### PASO 5 — Sanitización y Evaluación en `writer-contract.ts`
En `src/lib/guide-engine/writers/writer-contract.ts`:
1. En `sanitizeSessionPlans`, preserva y sanitiza el objeto opcional `sintesisVisual` (aplicando `toStudentVoice` y `asText` a `conceptoBreve`, `formulaOReglaClave`, `ejemploBreve` y `mapaConceptual` si vienen presentes en la respuesta del LLM).
2. En `evaluateWriterQuality`, no penalices si el texto no repite literalmente la palabra `"Puebla"`; valida situacionalidad/aplicación real (`comunidad`, `entorno`, `proyecto`, `caso`, `situación`, `cotidian`, `plantel`, `PAEC`, `Puebla`).

### PASO 6 — Consumo Prioritario de `sintesisVisual` en `08_Presentaciones` y `09_Infografías`
1. En `src/lib/visual-engine/sacrint/content-distiller.ts`:
   - Cuando `session?.sintesisVisual` esté presente y tenga campos válidos, úsalos de forma prioritaria en `extractConceptHighlights` (`conceptoBreve`, `formulaOReglaClave`, `mapaConceptual.criterioDesarrollo`) y en `extractWorkedExample` (`ejemploBreve.planteamiento`, `ejemploBreve.pasos`, `ejemploBreve.conclusion`), manteniendo el destilador actual como fallback para workbooks V1.
2. En `src/lib/visual-engine/sacrint/spec.ts`:
   - En `buildSacrintInfographic`, cuando `selectedSession?.sintesisVisual?.mapaConceptual` esté disponible, úsalo prioritariamente para `claim`, `definitions`, `conceptMap`, `misconceptionFix` y `quickExample`.

### PASO 7 — Pruebas y Verificación
1. Agrega pruebas unitarias en `src/__tests__/prompts-v2-contract.test.ts` verificando:
   - Que `getDisciplinaryAdapter('Asignatura Experimental Desconocida XYZ')` devuelva `indagacion_interdisciplinaria_general` y NO `ciencias_quimica_biologia_ambiental`.
   - Que cada una de las 5 familias epistemológicas (`cuantitativa_experimental`, `humanistica_comunicativa_social`, `computacional_algoritmica`, `corporal_motriz`, `tecnica_laboral`) inyecte su `workedExampleDirective` y `defaultTableColumns` correspondientes.
   - Que `sanitizeSessionPlans` preserve `sintesisVisual` y que `distillLessonBundle` / `buildSacrintInfographic` lo consuman prioritariamente cuando existe y mantengan retrocompatibilidad cuando no existe.
2. Ejecuta `npx tsc --noEmit`, `npx eslint` sobre los archivos modificados y `npx vitest run`.
```
