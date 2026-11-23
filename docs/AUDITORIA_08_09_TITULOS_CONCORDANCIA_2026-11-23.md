# Auditoría editorial 08/09: títulos y concordancia

**Fecha:** 2026-11-23  
**Alcance:** 12 paquetes de `Libros Planeaciones 2026` (`01` a `09`)  
**Estado:** corrección de código aplicada y validada con tests; materiales `08/09` aún no regenerados.

## 1. Dictamen ejecutivo

- Se confirmaron **22 slides con títulos defectuosos en `08`** y **al menos 6 títulos defectuosos en `09`**.
- Se confirmaron **más de 20 errores de concordancia** en `08/09`, no 14.
- Los defectos ya existían en `_ANT`; no son regresiones introducidas por Antigravity, pero tampoco quedaron resueltos.
- Se aplicó el fix en el motor editorial: limpieza de concordancia, rechazo de fragmentos corruptos y recorte de segunda persona en títulos.
- La suite completa pasa: **304 archivos, 2556 tests passed, 7 skipped**.
- **Los PDF/PPTX descargados no están corregidos**: el fix vive en código. Sin regenerar `08/09`, los archivos actuales siguen mostrando los defectos.
- **Dictamen de entrega: NO APTA todavía.** No se deben crear nuevas asignaturas ni declarar calidad final hasta regenerar y reauditar `08/09`.

## 2. Evidencia y cobertura

| Paquete | Asignatura | Subsistema |
|---|---|---|
| AECAEF | Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante | Formación Laboral |
| CECBV | Coloca elementos constructivos básicos de una vivienda | Formación Laboral |
| CNET1 | Ciencias Naturales, Experimentales y Tecnología I | Formación Fundamental |
| CS1 | Ciencias Sociales I | Formación Fundamental |
| DT1 | Dibujo Técnico I | Formación Fundamental Extendida |
| I1 | Inglés I | Formación Fundamental |
| ICDIBV | Interpreta croquis de diferentes instalaciones básicas de una vivienda | Formación Laboral |
| LC1 | Lenguaje y Comunicación I | Formación Fundamental |
| LMTCLCDIV | Limpia muebles, tuberías y conexiones para llevar a cabo diferentes instalaciones de una vivienda | Formación Laboral |
| PM3 | Pensamiento Matemático III | Formación Fundamental |
| PMCCELCDTM | Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas | Formación Laboral |
| TPV1 | Taller de Pensamiento Variacional I | Formación Fundamental Extendida |

Fuentes usadas:

- QA oficial `--strict --json` sobre los 12 paquetes descargados.
- Auditoría independiente de texto extraído de PDF/PPTX.
- Comparación `_ANT` contra `_NVO`.
- Tests unitarios y de integración del motor editorial.
- Inspección de `src/lib/editorial/topic-title-resolver.ts`, `src/lib/visual-engine/sacrint/content-distiller.ts` y `spec.ts`.

## 3. Hallazgos confirmados

### 3.1 Títulos defectuosos en `08_Presentaciones`

| Paquete | Slides | Defecto | Total |
|---|---|---:|---:|
| CNET1 | S9–S12 | `Sistemas de unidades SI y anglosajón, identificas...`; `(Ciencias Naturales` | 4 |
| DT1 | S2–S3 | `Evolución histórica..., comprendes...` | 2 |
| I1 | S49–S52 | `) — Sesión 22: Session 22: Negative forms: There isn't / There aren't and` | 4 |
| I1 | S91–S92 | `) — Sesión 40: Session` | 2 |
| PM3 | S28–S29 | `Fundamentos de la igualdad algebraica, identificas variables` | 2 |
| CS1 | S50–S51 | `Resultados obtenidos y a jerarquizar las problemáticas` | 2 |
| PMCCELCDTM | S30–S33 | `Digitalizas planos técnicos`; `... realizas la defensa grupal` | 4 |
| PMCCELCDTM | S108–S109 | `Digitalizas los planos arquitectónicos`; `... realizas...` | 2 |
| **Total** |  |  | **22** |

### 3.2 Títulos defectuosos en `09_Infografías`

| Paquete | Página | Defecto |
|---|---:|---|
| DT1 | 1 | `... aplicas correctamente...` |
| PMCCELCDTM | 13, 14, 43 | `Digitalizas...` / `... realizas...` |
| Varios | 5, 35, 46 | Títulos genéricos o poco específicos |

### 3.3 Errores de concordancia

| Paquete | Ubicación | Ejemplo |
|---|---|---|
| LC1 | `08` S40 / `09` p14 | `todas los...` / `todos las...` |
| PMCCELCDTM | `08` S19, S40, S111 / `09` p8, p17, p44 | `las pautas técnicos`; `los tres clases`; `respaldos ... firmadas` |
| TPV1 | `08` S60 / `09` p24 | `conforme a corresponda` |
| LMTCLCDIV | `08` S118 | `respaldos requeridas` |
| ICDIBV | `08` S20 | `pautas ... requeridos` |

Se detectaron más de 20 casos en total. Los ejemplos anteriores son los de mayor visibilidad.

### 3.4 Falsos positivos que no deben contarse como defecto

- **PMCCELCDTM `09` p2:** el texto real es `Compara: 0.03 mm > 0.02 mm.`; el QA corta `0.03` como `0.` y lo marca como paso numérico truncado.
- **11 `activitiesBad` de `08`:** son truncamientos del parser; el texto completo del PPTX sí contiene la actividad.
- **`09 AECAEF`:** `prueba de escritorio` es una técnica pedagógica legítima, no una plantilla vacía.
- **`06 AECAEF`:** `Paso 1: Definición de entradas...` aparece contextualizado y con contenido; no se contó como defecto.

## 4. Causa raíz

1. `extractDisciplinaryConceptPhrase` aceptaba títulos que empezaban o contenían fragmentos de sesión (`) — Sesión 22`, `(Ciencias Naturales`) y no recortaba la segunda persona incrustada después de una coma.
2. El QA no tenía reglas para detectar concordancias ni títulos estructuralmente corruptos; por eso los tests pasaban con contenido defectuoso.
3. La limpieza de superficie no cubría ambos embudos de texto (`cleanSacrintText` y `cleanSacrintTextPreservingLines`).
4. `06` difiere de `_ANT` en 11/12 paquetes. Esa diferencia sigue sin explicación y merece una auditoría separada.

## 5. Cambios aplicados

### 5.1 `src/lib/visual-engine/sacrint/content-distiller.ts`

- Se agregó `repairSpanishSurfaceGrammar`.
- Repara, entre otros:
  - `todas los` → `todos los` o `todas las`, según el sustantivo.
  - `todos las` → `todas las` o `todos los`.
  - `las pautas técnicos` → `las pautas técnicas`.
  - `los tres clases` → `las tres clases`.
  - `conforme a corresponda` → `conforme corresponda`.
  - `respaldos ... firmadas` → `respaldos ... firmados`.
  - `respaldos requeridas` → `respaldos requeridos`.
  - `pautas ... requeridos` → `pautas ... requeridas`.
- Se aplica en:
  - `cleanSacrintText`.
  - `cleanSacrintTextPreservingLines`.
  - `sanitizePedagogicalMetaPhrases`.

### 5.2 `src/lib/editorial/topic-title-resolver.ts`

- Se agregaron `digitalizas` y `valoras` a los patrones de segunda persona.
- Se agregó `sanitizeMalformedTitleFragment`, que:
  - rechaza `) — Sesión ...`.
  - rechaza paréntesis incompletos como `(Ciencias Naturales`.
  - elimina sufijos/prefijos de sesión.
  - recorta cláusulas de segunda persona después de coma o `y`: `..., identificas...`, `... y realizas...`.
  - reescribe `Resultados obtenidos y a jerarquizar las problemáticas` a `Jerarquización de problemáticas`.
- `extractDisciplinaryConceptPhrase` ahora usa ese saneador antes de validar el título.

### 5.3 `scripts/qa-sacrint-materials.ts`

Se agregaron reglas de QA:

- `surface_concordance`: detecta `todas los`, `todos las`, `pautas técnicos`, `los tres clases`, `conforme a corresponda`, `respaldos firmadas`, `respaldos requeridas`, `pautas requeridos`.
- `corrupt_title_fragment`: detecta `) — Sesión N:` y `Sesión N: Session N`.
- `corrupt_title_paren`: detecta paréntesis de materia sin cerrar.
- `broken_nominal_title`: detecta `Resultados obtenidos y a jerarquizar` y `Fundamentos de la igualdad algebraica, identificas`.

### 5.4 Tests

- Nuevo archivo: `src/__tests__/editorial-surface-quality.test.ts`.
- Cubre concordancias, segundo embudo de limpieza, títulos corruptos, segunda persona incrustada, reescritura nominal, fallback de títulos y detección por QA.

## 6. Validación ejecutada

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `npx vitest run` de pruebas focalizadas | 14/14 passed |
| `npm test` | 304 archivos; 2556 passed; 7 skipped |
| Auditoría de keywords | OK, 0 colisiones |

La validación demuestra que el fix no rompe la suite. **No demuestra que los PDF/PPTX actuales estén corregidos**, porque no se regeneraron.

## 7. Pendientes y bloqueos

- Regenerar `08/09` desde el pipeline con el código corregido.
- Reauditar los archivos regenerados con el QA nuevo.
- Revisar visualmente una muestra de `08/09` para confirmar que no hay títulos vacíos, recortados o genéricos.
- Investigar la diferencia de `06` contra `_ANT`.
- Auditar duplicados/huérfanos del catálogo de imágenes antes de generar nuevas.
- Eliminar `scratch/audit-downloaded.ts` al cerrar.
- La auditoría de BD/R1/rúbricas sigue bloqueada por falta de `planning_id`.

## 8. Respuestas a las dudas pendientes

### 8.1 ¿Ya podemos modularizar o refactorizar el código grande?

Todavía no. El fix actual toca dos módulos sensibles (`topic-title-resolver.ts` y `content-distiller.ts`). Conviene primero regenerar `08/09`, reauditar y congelar el comportamiento. Después se puede refactorizar por partes, con tests de caracterización antes de mover código.

### 8.2 ¿Faltan más gráficos o imágenes para actividades?

Sí, es probable. Hay **245 PNG** y **244 slugs** en el catálogo, pero muchas son imágenes de instrumentos/materiales, no escenas contextuales por sesión. La percepción de “pocas imágenes” es razonable. El catálogo nuevo prioriza 36 escenas para `08/09` y una regla explícita: no generar relleno decorativo.

### 8.3 ¿Cuál es la opinión sobre refactorizar códigos gigantes?

Es necesaria, pero no ahora. Refactorizar antes de estabilizar el contenido multiplica el riesgo de regresión. La secuencia correcta es: corregir contenido → congelar con tests → extraer módulos pequeños → medir.

### 8.4 ¿La plataforma está lista para entregar materiales con calidad?

No. QA funcional pasó 11/12, pero el QA anterior no detectaba títulos ni concordancias. Con el fix y el QA nuevo, falta regenerar y reauditar. La entrega debe esperar.

### 8.5 ¿Ya se pueden crear nuevas asignaturas?

No. Primero deben cerrarse los defectos de `08/09` y demostrarse con archivos regenerados. Crear nuevas asignaturas ahora replicaría los mismos defectos.

### 8.6 ¿La IA genera todos los materiales?

No exactamente. La IA genera el contenido pedagógico y las planeaciones mediante los agentes del `block-guide-orchestrator`; los libros `08/09` se construyen de forma determinista desde `workbooks_json`, y las imágenes provienen de catálogo/Openverse, no de generación automática. La IA no “diseña” por sí sola todos los recursos visuales ni las bases curriculares.

## 9. Siguiente paso recomendado

1. Regenerar un paquete piloto (`PMCCELCDTM` o `CNET1`) con el código corregido.
2. Ejecutar QA nuevo y revisar títulos/concordancias en el archivo regenerado.
3. Si el piloto queda limpio, regenerar los 12 paquetes.
4. Recién entonces abrir la discusión de nuevas asignaturas y refactor.
