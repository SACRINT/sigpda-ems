# Brief de Correcciones — Revisor Determinista R1 de Materiales

**Proyecto:** SIGPDA-EMS (MCCEMS 2026-2027)
**Commit revisado:** `e8af5e2` — `feat(guide-engine): add deterministic R1 block material reviewer and fail-closed download gates`
**Revisor:** OpenCode
**Fecha:** 2026-11-08
**Veredicto:** **NO MERGE** hasta corregir los hallazgos P0. `tsc --noEmit` y `eslint` pasan; la suite `material-review.test.ts` da **16/17** (falla el benchmark de rendimiento).

---

## 0. Resumen Ejecutivo

| ID | Severidad | Hallazgo | Archivo(s) |
| :--- | :--- | :--- | :--- |
| **P0-1** | Crítico | `material_png` legítimos se marcan `S6_CORRUPT_VISUAL_ASSET` y se omiten | `material-review.ts:743-761`, `cascade-block-materials.ts:594-600` |
| **P0-2** | Crítico | La cascada borra todos los extras antes de saber si podrá reinsertarlos; GET muta BD | `materiales-bloque/route.ts:63`, `cascade-block-materials.ts:389-400` |
| **P0-3** | Crítico | POST responde `200 success:true` cuando la cascada falla por completo | `materiales-bloque/route.ts:81-85` |
| **P1-1** | Alto | S8 se evalúa con `component`/`curriculumName` distintos a los de generación | rutas de descarga + `cascade-block-materials.ts:389` |
| **P1-2** | Alto | S7 no compara `lesson_plan` persistido contra la extracción fresca | `material-review.ts:727-734` |
| **P1-3** | Alto | Bulk multi-bloque produce falsos `S7_TRUNCATED_MATERIAL` | `pdf|docx/extra/bulk/route.ts:126-136` |
| **P1-4** | Medio | Revisión R1 dentro del render del cliente (re-extrae todo el bloque por render) | `PlanningTabDocumento.tsx:1010`, `PlanningTabMateriales.tsx:139-153` |
| **P1-5** | Medio | Regresión no relacionada: se eliminó el sync `planning.contentJson → localContent` | `PlanningTabDocumento.tsx:99-101` |
| **P2-1** | Bajo | Benchmark `p95 < 50 ms` falla en entorno real (59.3 ms) | `material-review.test.ts:457-472` |

**Evidencia de datos reales (Neon):** de 24 extras visuales persistidos, **7 son `material_png`** (`type:"material_png"`, `slug`, `altText`, sin `svg` ni `mediaAsset`), 16 son `vector_svg` y 1 es `openverse_media`. Los 7 `material_png` se rompen con la implementación actual.

---

## 1. Restricciones No Negociables

- **Sin migraciones DDL** en Neon. `planning_extras` conserva su esquema actual.
- **Sin fallback sintético** ni materiales de relleno.
- **Sin hardcodear** sesiones (6/12/18/24/30) ni tipos de material.
- **No modificar** `maxTokens` ni el pipeline de IA.
- **No tocar** la planeación `dfd5e2d6-6a84-4a3d-a4a9-8e128e523fa4`.
- Mantener el contrato híbrido: errores estructurales → `422`; solo advertencias → `200` + `X-Material-Warnings`.
- Añadir tests falsables por cada corrección.

---

## 2. P0 — Bloqueantes de Merge

### P0-1. `material_png` debe considerarse un visual válido

**Evidencia**
- `material-review.ts:743-761` exige `svg` o `mediaAsset.imageUrl`/`.url`.
- `cascade-block-materials.ts:594-600` exige `resolved.svg` o `resolved.mediaAsset.imageUrl`.
- `visual-asset-manager.ts:352-358` genera `material_png` con `materialSlug`, `materialAltText` y `materialPngPath`, **sin `svg` ni `mediaAsset`**.
- Payload persistido real: `{"type":"material_png","slug":"balanza-digital","altText":"...","caption":"...","annotations":[]}`.

**Impacto**
- Descarga individual de un visual `material_png` → `422 S6_CORRUPT_VISUAL_ASSET`.
- Bulk full-suite del bloque → `422`.
- Cascada → omite el visual (`omitted: ['visual_asset']`).
- Regenerar el bloque elimina visuales válidos.

**Corrección requerida**
1. En `material-review.ts`, extender la validez:
```ts
const hasMaterialPng =
  (typeof parsed?.slug === 'string' && parsed.slug.trim().length > 0) ||
  (typeof parsed?.materialPngPath === 'string' && parsed.materialPngPath.trim().length > 0);
if (!hasType || (!hasSvg && !hasMediaUrl && !hasMaterialPng) || placeholder) { ... }
```
2. En `cascade-block-materials.ts`, alinear el gate:
```ts
const isMaterialPng = resolved.type === 'material_png';
const hasValidVisualContent = Boolean(
  resolved.type &&
    (isMaterialPng
      ? Boolean(resolved.materialPngPath || resolved.materialSlug)
      : ((typeof resolved.svg === 'string' && resolved.svg.trim().length > 0) ||
         (typeof resolved.mediaAsset?.imageUrl === 'string' && resolved.mediaAsset.imageUrl.trim().length > 0))) &&
    !/\bundefined\b|\$\{[^}]*\}/i.test(visualPayload)
);
```
3. Añadir test con fixture `material_png`:
   - `reviewBlockMaterials` con `persistedExtras:[{type:'material', title:'[Visual] ...', content_text: JSON.stringify({type:'material_png', slug:'balanza-digital', altText:'...'})}]` → `byMaterial.visual_asset.ok === true`.
   - Cascada inserta el visual (no lo omite).
   - `GET /api/pdf/extra/[extraId]` de un `material_png` → `200`.

**Criterio de aceptación:** los 7 `material_png` reales pasan R1 y se descargan sin 422.

---

### P0-2. La cascada no debe destruir datos antes de poder reinsertarlos

**Evidencia**
- `materiales-bloque/route.ts:63` ejecuta `cascadeBlockMaterials` también en `GET`.
- `cascade-block-materials.ts:389-400` calcula `review` y luego hace `DELETE` de **todos** los extras del bloque.
- Si `review.byMaterial.lesson_plan.ok === false`, se borran los 24 planes y no se inserta ninguno.
- El POST devuelve `422` **después** de haber mutado la BD.

**Impacto**
- Un simple `GET` de materiales puede vaciar planes/rúbricas/solucionarios.
- Un falso positivo (P0-1, S8 con adapter distinto, S7) provoca pérdida de datos.
- El usuario ve error 422 pero la BD ya cambió.

**Corrección requerida (invariantes)**
1. **GET debe ser read-only.** No llamar `cascadeBlockMaterials` en `GET`; solo calcular `reviewBlockMaterials` y devolver los extras existentes (`getPlanningExtrasByBlock`).
2. **Nunca borrar un tipo que no se va a reinsertar.** Sustituir el `DELETE` global por:
```sql
DELETE FROM planning_extras
WHERE planning_id = ${planningId}::uuid
  AND key_index = ${blockIndex}
  AND type = ANY(${typesToPersist}::text[])
```
donde `typesToPersist` son los tipos con `review.byMaterial[t].ok === true` y contenido fresco disponible. Si el driver de Neon no enlaza arreglos en `ANY`, usar `sql.join(typesToPersist.map(t => sql`${t}`), sql`, `)` dentro de un `IN (...)`.
3. **POST con errores estructurales no debe mutar.** Si `review.errors.length > 0`, responder `422` **antes** de cualquier `DELETE`/`INSERT`.
4. **Job-worker** puede persistir parcialmente (solo tipos `ok`), pero **no debe borrar** los tipos omitidos.
5. Envolver `DELETE` + `INSERT` en una transacción por bloque (o mantener el lease actual y garantizar que el fallo no deje el bloque vacío).

**Criterio de aceptación**
- `GET /materiales-bloque` no altera `planning_extras` (verificar conteo antes/después).
- `POST` con rúbrica defectuosa → `422` y `planning_extras` intacto.
- Regeneración con un tipo defectuoso conserva los tipos omitidos existentes.

---

### P0-3. Fallo total de cascada no puede responder 200

**Evidencia**
- `materiales-bloque/route.ts:81-85` exige `cascadeResult?.review`.
- `cascade-block-materials.ts:656-663` devuelve `{ success:false, error }` **sin `review`**.
- Por tanto, un fallo de BD/lease cae al `200 success:true`.

**Corrección requerida**
```ts
if (!cascadeResult?.success) {
  return NextResponse.json(
    {
      ok: false,
      success: false,
      blockIndex,
      error: cascadeResult?.error || 'No se pudieron persistir los materiales del bloque',
      cascade: cascadeResult,
    },
    { status: 500 }
  );
}
```
Aplicar antes del bloque de `422` por `review`.

**Criterio de aceptación:** simular `cascadeBlockMaterials` con `{success:false}` → respuesta `500` (o `422` si el fallo es estructural), nunca `200`.

---

## 3. P1 — Correcciones de Consistencia y Robustez

### P1-1. S8 debe usar los mismos argumentos que la generación

**Evidencia**
- Generación: `block-guide-orchestrator.ts:831-836` usa `planning.uacName`, `planning.component`, `planning.curriculumName`.
- `pdf/extra/[extraId]/route.ts:49-52` y `docx/extra/[extraId]/route.ts:49-52` no pasan `uacName`/`component`/`curriculumName`.
- `pdf|docx/extra/combined/route.ts:163-168` solo pasan `uacName`.
- `pdf|docx/extra/bulk/route.ts:127-131` solo pasan `workbook`.
- `cascade-block-materials.ts:389-394` solo pasa `uacName: workbook.coverData?.subjectName`.
- `getDisciplinaryAdapter` usa `component` para desambiguar (`disciplinary-adapters/index.ts:669,805-806`).

**Corrección requerida**
1. En `[extraId]`, obtener la planeación (`getPlanningById(extra.planning_id, teacher.id)`) y pasar:
```ts
reviewBlockMaterials({
  workbook,
  persistedExtras: [extra],
  checkFullBlockPersistence: false,
  uacName: planning.uac_name,
  component: planning.component || '',
  curriculumName: planning.curriculum_name || '',
});
```
2. En `combined` y `bulk`, añadir `component` y `curriculumName` a la llamada.
3. En `cascadeBlockMaterials`, aceptar `component`/`curriculumName` como parámetros opcionales y pasarlos desde:
   - `materiales-bloque/route.ts` (ampliar el `SELECT` a `component, curriculum_name`).
   - `job-worker.ts` (obtenerlos del job/planning antes de llamar a la cascada).
4. `materiales-bloque` fallback de `review` debe usar los mismos 4 campos.

**Criterio de aceptación:** un bloque con UAC cuyo adapter depende de `component` produce el mismo resultado S8 en generación, cascada y descarga.

---

### P1-2. S7 debe comparar `lesson_plan` persistido contra el plan fresco

**Evidencia**
- `material-review.ts:727-734`: `freshByMaterial` no incluye `lesson_plan`.
- `material-review.ts:795-812` solo compara contra `freshRef`; para `lesson_plan` no hay referencia.
- Una descarga individual de un plan truncado a >300 chars pasa sin error.

**Corrección requerida**
1. Construir un mapa por sesión:
```ts
const freshLessonPlanBySession = new Map(
  (extracted.planesDeClase || []).map((p) => [p.numeroSesion, serializePlanContent(p)])
);
```
2. Para cada extra con `mType === 'lesson_plan'`, extraer la sesión de `title` (`/Sesión\s+(\d+)/i`) o del encabezado de `content_text`; comparar `normalizeForMatch(rawText).length >= 0.9 * normalizeForMatch(fresh).length`.
3. Si no se puede resolver la sesión, mantener solo el piso mínimo actual y emitir `W0` (no bloquear).
4. Añadir test: truncar un `lesson_plan` persistido al 60% (manteniendo >300 chars) → `S7_TRUNCATED_MATERIAL`.

**Criterio de aceptación:** descarga individual de un plan truncado → `422`.

---

### P1-3. Bulk multi-bloque debe revisarse por bloque

**Evidencia**
- `pdf|docx/extra/bulk/route.ts:126-136` revisa todos los `extras` con el workbook del bloque de `extras[0]`.
- S7 compara extras de otros bloques contra la extracción fresca del bloque 0 → falsos `S7_TRUNCATED_MATERIAL`.

**Corrección requerida**
1. Agrupar `extras` por bloque canónico:
```ts
const raw = e.key_index;
const bIdx = raw != null ? (resolveBlockNumber(raw) ?? raw) - 1 : null;
```
2. Para cada grupo con `bIdx >= 0`, cargar su workbook y llamar `reviewBlockMaterials` con `persistedExtras: group`.
3. Acumular errores/advertencias con alcance por tipo.
4. Si hay extras sin bloque resoluble, excluirlos del gate y registrar `W0` (o rechazar con `400` si el tipo es singleton).
5. Añadir test con `extraIds` de bloques 0 y 1.

**Criterio de aceptación:** un ZIP con extras de dos bloques válidos no produce 422.

---

### P1-4. No ejecutar R1 dentro del render del cliente

**Evidencia**
- `PlanningTabDocumento.tsx:1010` llama `reviewBlockMaterials` dentro de una IIFE en JSX; se re-ejecuta en cada render y re-extrae todo el bloque.
- `PlanningTabMateriales.tsx:139-153` re-extrae por bloque en el navegador (aunque dentro de `useMemo`).
- El benchmark ya muestra ~59 ms por bloque de 24 sesiones solo para la revisión.

**Corrección requerida (elegir una)**
- **Opción A (recomendada):** endpoint server-side `GET /api/planeaciones/[id]/materiales-review?blockIndex=N` que devuelva `{ review, omitted }`; el cliente solo pinta el badge.
- **Opción B:** `useMemo` en `PlanningTabDocumento` con dependencias estables (`wbItem.version`, `sequenceData`, `uacName`, etc.) y sin llamar dentro del JSX.
- En `PlanningTabMateriales`, estabilizar la dependencia `blockWorkbooks` por firma (`Object.values(...).map(b => b.version).join(',')`) para evitar recálculos por identidad.

**Criterio de aceptación:** `reviewBlockMaterials` no se invoca en el cuerpo de render; el badge se actualiza al cambiar `version`.

---

### P1-5. Restaurar el sync de `localContent`

**Evidencia**
- `PlanningTabDocumento.tsx:99-101`: se eliminó el `useEffect` que sincronizaba `planning.contentJson → localContent`.
- Tras `QuickEditPlanningModal` (`:334-339`), `localContent` queda fijo y no se refresca si el padre recarga/regenera la planeación.

**Corrección requerida**
- Restaurar:
```ts
const [localContent, setLocalContent] = useState<GeneratedPlanningContent | null>(
  (planning?.contentJson as GeneratedPlanningContent) || null
);
React.useEffect(() => {
  if (planning?.contentJson) {
    setLocalContent(planning.contentJson as GeneratedPlanningContent);
  }
}, [planning?.contentJson]);
```
- Si la eliminación fue intencional para no pisar ediciones optimistas, implementar un guard por `updated_at`/`version` y documentarlo.

**Criterio de aceptación:** tras guardar QuickEdit y recargar la planeación, el visor muestra el contenido actualizado.

---

### P2-1. Estabilizar el benchmark de rendimiento

**Evidencia**
- `material-review.test.ts:457-472`: `p95 = 59.3 ms` > 50 ms en este entorno.

**Corrección requerida**
- Calentar JIT antes de medir (3 iteraciones descartadas).
- Subir el umbral a `150 ms` (o medir mediana en lugar de p95).
- Mantener una aserción funcional separada de que el reporte es correcto.

**Criterio de aceptación:** el test pasa de forma estable en CI y local sin relajar la validación funcional.

---

## 4. Verificado Correcto (No Requiere Acción)

- **S1 con datos reales:** `sessionsPerBlock` 18/24 y `coveredSessions` 1..N; no hay falsos positivos por bloques 2/3.
- **S4:** rúbricas reales con 4 criterios × 4 niveles y pesos que suman 100 (25×4 o 30+25+25+20).
- **S6 deck:** 8 láminas con `eyebrow`; `buildSacrintDeck` las puebla todas.
- **S6 infografía:** `claim`, `steps` y `artifactName` tienen fallbacks; no bloquea por campos ausentes.
- **`resolveBlockNumber`:** el round-trip 0-based (`0→1→0`, `1→2→1`) es correcto.
- **`material-extractor`:** el cambio a `missions.length >= 1` y el uso de `sessionsPerBlock` son correctos.
- **Grafo de imports cliente:** no hay `fs`/`server-only` en `material-review` → no rompe el build; solo aumenta el bundle (ver P1-4).

---

## 5. Plan de Pruebas y DoD

### Tests a añadir
1. `material_png` válido → `review.ok` y cascada no lo omite (P0-1).
2. `GET /materiales-bloque` no muta `planning_extras` (P0-2).
3. `POST /materiales-bloque` con rúbrica defectuosa → `422` y BD intacta (P0-2).
4. `cascadeBlockMaterials` con `success:false` → respuesta `500` (P0-3).
5. Mismo adapter S8 en generación y descarga para una UAC con `component` (P1-1).
6. `lesson_plan` truncado en descarga individual → `422` (P1-2).
7. Bulk con extras de dos bloques válidos → `200` (P1-3).
8. Badge UI sin llamada a R1 en render (P1-4, si se implementa endpoint).

### Comandos de verificación
```powershell
npx tsc --noEmit
npx eslint "src/lib/guide-engine/material-review.ts" "src/lib/guide-engine/cascade-block-materials.ts" "src/app/api/pdf/extra/[extraId]/route.ts" "src/app/api/docx/extra/[extraId]/route.ts" "src/app/api/pdf/extra/bulk/route.ts" "src/app/api/docx/extra/bulk/route.ts" "src/app/api/pdf/extra/combined/route.ts" "src/app/api/docx/extra/combined/route.ts" "src/app/api/planeaciones/[id]/materiales-bloque/route.ts" "src/components/planeacion/tabs/PlanningTabDocumento.tsx" "src/components/planeacion/tabs/PlanningTabMateriales.tsx"
npx vitest run src/__tests__/material-review.test.ts
```

### Prueba manual mínima
1. Descargar un visual `material_png` real → `200` (antes `422`).
2. Abrir la pestaña de materiales (GET) y verificar que el conteo de `planning_extras` no cambia.
3. Forzar una rúbrica con pesos ≠100 y hacer POST → `422`; verificar que los extras previos siguen en BD.
4. Descargar un ZIP bulk con extras de dos bloques → `200`.

### Definición de Terminado
- [ ] P0-1, P0-2 y P0-3 corregidos con tests.
- [ ] P1-1 a P1-5 corregidos o justificados por escrito.
- [ ] `tsc`, `eslint` y `vitest` verdes (incluido el benchmark estabilizado).
- [ ] Ninguna ruta de descarga devuelve `200` ante un fallo de cascada.
- [ ] Ningún `GET` muta `planning_extras`.
- [ ] Los 7 `material_png` reales se descargan sin bloqueo.
- [ ] La planeación `dfd5e2d6-6a84-4a3d-a4a9-8e128e523fa4` permanece intacta.

---

## 6. Orden de Trabajo Sugerido

1. **P0-1** (visual `material_png`) + test.
2. **P0-3** (fallo de cascada) + test.
3. **P0-2** (GET read-only, DELETE selectivo, POST sin mutación en error) + tests.
4. **P1-1** (argumentos S8 homogéneos).
5. **P1-2** (S7 lesson_plan) y **P1-3** (bulk multi-bloque).
6. **P1-4** / **P1-5** (UI).
7. **P2-1** (benchmark) y corrida completa de pruebas.

**Mensaje de commit sugerido:**
```
fix(guide-engine): accept material_png visuals, make R1 cascade non-destructive, and align S8/S7 gates
```
