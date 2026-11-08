# Plan de Implementación R1 — Revisor Determinista de Materiales Derivados

## 1. Decisiones Arquitectónicas Bloqueadas

1. **Cálculo On-Demand sin Migración DDL (`0 tokens`, `< 15 ms`)**:
   - La tabla `planning_extras` posee el esquema `(id, planning_id, type, title, key_index, content_text, created_at)` sin columna `metadata`.
   - En lugar de añadir migraciones DDL ni persistir reportes susceptibles de quedar obsoletos, `reviewBlockMaterials` opera como una función pura en memoria (`< 15 ms`, `0 tokens`, sin llamadas de red ni consultas a base de datos).
2. **Omisión de Materiales Defectuosos en Cascada**:
   - En `cascadeBlockMaterials` (`src/lib/guide-engine/cascade-block-materials.ts`), antes de ejecutar cada `INSERT INTO planning_extras`, se evalúa `review.byMaterial[materialType].ok`.
   - Cualquier material con errores estructurales (`byMaterial[type].ok === false`) se **omite** de la inserción y se registra en `omitted: MaterialType[]`.
   - `job-worker.ts` inspecciona `cascadeResult.omitted` y `cascadeResult.review` y registra `logger.error` explícito con los códigos de fallo cuando se detectan inconsistencias.
3. **Gate Híbrido Fail-Closed en Rutas de Descarga**:
   - **Errores estructurales (`S1`–`S8`)**: Bloquean la descarga devolviendo HTTP `422 Unprocessable Entity` con JSON `{ ok: false, error: 'Material bloqueado por inconsistencia estructural', issues: [...] }`.
   - **Advertencias (`W0`, `S5_MISSING_MODEL_SOLUTION`, `S6_SLIDE_TITLE_TOO_LONG`)**: No bloquean la descarga (`HTTP 200`), pero adjuntan la cabecera HTTP `X-Material-Warnings: N`.
4. **Cero Llamadas Semánticas R2 (LLM)**:
   - Dado que los materiales del bloque se derivan de forma 100% determinista a partir del `ActiveWorkTextbook` (que ya superó los revisores de calidad y alineación curricular durante su orquestación), el revisor R1 es 100% determinista y consume `0 tokens`.

---

## 2. Contratos de Datos (`src/lib/guide-engine/material-review.ts`)

```ts
export type MaterialType =
  | 'lesson_plan'
  | 'student_guide'
  | 'rubric'
  | 'checklist'
  | 'answer_key'
  | 'didactic_material'
  | 'recovery_cards'
  | 'deck'
  | 'infographic'
  | 'visual_asset';

export interface ReviewIssue {
  code: string;
  material: MaterialType;
  session?: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface MaterialReviewReport {
  ok: boolean;
  score: number;
  issues: ReviewIssue[];
  errors: ReviewIssue[];
  warnings: ReviewIssue[];
  byMaterial: Record<MaterialType, { ok: boolean; issues: ReviewIssue[] }>;
}
```

---

## 3. Catálogo de Invariantes Deterministas (`S1`–`S8` y `W0`)

| Código | Severidad | Material Afectado | Regla Determinista |
| :--- | :--- | :--- | :--- |
| **`S1_MISSING_DECLARED_SESSIONS`** | `error` | `lesson_plan` | `declared = unique(missions.flatMap(m => m.coveredSessions))` debe cubrir `1..N` donde `N = resolveTargetSessionsForWorkbook(workbook, blockSequence)` (dinámico: 6, 12, 18, 24, 30; sin hardcodear 24). |
| **`S1_MISSING_SESSION_PLANS`** | `error` | `lesson_plan` | Toda sesión declarada en `mission.coveredSessions` debe contar con su `SessionPlan` real en `mission.sessionPlans`. |
| **`S1_FALLBACK_SESSION_IN_BOOK`** | `error` | `lesson_plan` | Ningún `SessionPlan` puede tener `isFallback === true`. |
| **`S1_FALLBACK_TEXT_DETECTED`** | `error` | `lesson_plan` | `detectFallbackWords(allSessionPlans, uacName)` debe ser `0`. |
| **`S1_SYNTHETIC_FALLBACK_DETECTED`** | `error` | `lesson_plan` | Ningún `PlanDeClaseDerivado` en `extracted.planesDeClase` puede provenir del relleno sintético del extractor (`material-extractor.ts:162-204`) ni carecer de sesión real en el libro. |
| **`S2_INVALID_TIME_BALANCE`** | `error` | `lesson_plan` | `apertura.tiempoMinutos + desarrollo.tiempoMinutos + cierre.tiempoMinutos === duracionMinutos` y cada fase `> 0`. |
| **`S2_MISSING_EVALUATION_INSTRUMENT`** | `error` | `lesson_plan` | `plan.instrumentoEvaluacion` no vacío en cada sesión. |
| **`S3_PLACEHOLDER_DETECTED`** | `error` | Todos | Ausencia de marcadores inválidos o sin interpolar (`undefined`, `[completar]`, `[...]`, `${...}`). |
| **`S3_INCOMPLETE_CONTENT`** | `error` | Todos | Campos obligatorios presentes y longitud mínima estructural alcanzada (`lesson_plan >= 300`, `answer_key >= 800`, `rubric >= 150`, `checklist >= 150`, otros `>= 200`). |
| **`S4_EMPTY_RUBRIC` / `S4_INVALID_CRITERION_WEIGHT` / `S4_RUBRIC_WEIGHT_SUM_MISMATCH` / `S4_INCOMPLETE_RUBRIC_LEVELS`** | `error` | `rubric` | Criterios con `weightPercent > 0`, suma `100 ± 0.5%`, y exactamente 4 niveles con `descriptor` no vacío. |
| **`S4_EMPTY_CHECKLIST`** | `error` | `checklist` | `evaluationSection.checklist.length > 0` con indicadores no vacíos. |
| **`S5_EXERCISE_NOT_IN_ANSWER_KEY`** | `error` | `answer_key` | Todo `practica[].enunciado` de `mission.sessionPlans` debe aparecer trazado en `solucionarioDocente`. |
| **`S5_MISSING_MODEL_SOLUTION`** | `warning` | `answer_key` | Si `practica[].solucion` está vacío, se emite advertencia no bloqueante (el solucionario emplea guía de mediación docente). |
| **`S5_QUIZ_MISSING_EXPLANATION` / `S5_QUIZ_NOT_IN_ANSWER_KEY`** | `error` | `answer_key` | Todo reactivo de `criticalThinkingQuiz` tiene `answerExplanation` y aparece en `solucionarioDocente`. |
| **`S5_TIERED_MISSING_CRITERIA`** | `error` | `answer_key` | Todo ejercicio en `tieredExercises` tiene `expectedOutputOrCriteria` no vacío. |
| **`S6_INVALID_SLIDE_COUNT` / `S6_EMPTY_SLIDE_CONTENT` / `S6_PLACEHOLDER_IN_DECK`** | `error` | `deck` | Mazo SACRINT con 8 diapositivas (o 4 en modo aula), títulos y encabezados no vacíos y sin placeholders. |
| **`S6_INCOMPLETE_INFOGRAPHIC` / `S6_PLACEHOLDER_IN_INFOGRAPHIC`** | `error` | `infographic` | Infografía SACRINT con título, tesis (`claim`), pasos, diagrama y entregable completos y sin placeholders. |
| **`S6_INVALID_VISUAL_JSON` / `S6_CORRUPT_VISUAL_ASSET`** | `error` | `visual_asset` | Payload JSON válido con `type` y `svg` (o `mediaAsset.url`) no vacíos y sin `undefined` ni `${`. |
| **`S7_TRUNCATED_MATERIAL` / `S7_PERSISTED_PLACEHOLDER`** | `error` | Persistidos | `content_text` persistido en `planning_extras` no truncado (`>= 90%` de la extracción canónica fresca) y sin placeholders. |
| **`S7_LESSON_PLAN_COUNT_MISMATCH` / `S7_MISSING_PERSISTED_MATERIAL`** | `error` | Persistidos | Conteo de `lesson_plan` persistidos igual a `declared.length` y presencia de materiales singleton obligatorios. |
| **`S8_CROSS_CONTAMINATION`** | `error` | `lesson_plan` / `deck` / `infographic` | `validateBlockCrossContamination` reporta `0` términos disciplinares ajenos a la UAC. |
| **`W0_*`** | `warning` | Varios | Advertencias no bloqueantes: densidad moderada (`W0_LOW_DENSITY`), presupuesto inferido (`W0_INFERRED_SESSION_BUDGET`), ausencia de troubleshooting (`W0_NO_TROUBLESHOOTING_ITEMS`) y advertencias H-324 (`W0_W1_MISSING_SEQ_SESSION`, etc.). |

---

## 4. Mapa Real de Rutas Protegidas

| Ruta | Método | Comportamiento con R1 |
| :--- | :--- | :--- |
| `src/app/api/planeaciones/[id]/materiales-bloque/route.ts` | `GET` / `POST` | Incluye `review` y `omitted` en la respuesta JSON. En `POST`, si `!cascadeResult.review.ok`, responde `422`. |
| `src/app/api/pdf/extra/[extraId]/route.ts` | `GET` | Valida el material solicitado contra el libro del bloque; bloquea con `422` ante errores o añade `X-Material-Warnings`. |
| `src/app/api/docx/extra/[extraId]/route.ts` | `GET` | Valida el material solicitado contra el libro del bloque; bloquea con `422` ante errores o añade `X-Material-Warnings`. |
| `src/app/api/pdf/extra/bulk/route.ts` | `GET` / `POST` | Valida el lote de materiales del bloque; bloquea con `422` ante errores o añade `X-Material-Warnings`. |
| `src/app/api/docx/extra/bulk/route.ts` | `GET` / `POST` | Valida el lote de materiales del bloque; bloquea con `422` ante errores o añade `X-Material-Warnings`. |
| `src/app/api/pdf/extra/combined/route.ts` | `GET` / `POST` | Valida por bloque el tipo de material combinado; bloquea con `422` ante errores o añade `X-Material-Warnings`. |
| `src/app/api/docx/extra/combined/route.ts` | `GET` / `POST` | Valida por bloque el tipo de material combinado; bloquea con `422` ante errores o añade `X-Material-Warnings`. |
| `src/app/api/planeaciones/[id]/presentacion/sacrint/route.ts` | `GET` | Valida `byMaterial.deck` (`S6` + `S8`); bloquea con `422` ante errores o añade `X-Material-Warnings`. |
| `src/app/api/planeaciones/[id]/infografia/sacrint/route.ts` | `GET` | Valida `byMaterial.infographic` (`S6` + `S8`); bloquea con `422` ante errores o añade `X-Material-Warnings`. |

### Ejemplo de Respuesta HTTP `422` (Fail-Closed)

```json
{
  "ok": false,
  "error": "Material bloqueado por inconsistencia estructural",
  "issues": [
    {
      "code": "S4_RUBRIC_WEIGHT_SUM_MISMATCH",
      "material": "rubric",
      "severity": "error",
      "message": "La suma de ponderaciones de la rúbrica es 90.0%, pero debe ser 100% (±0.5%)."
    }
  ]
}
```

