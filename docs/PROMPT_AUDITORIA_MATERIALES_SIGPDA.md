# Prompt Maestro de Auditoría General de Materiales — SIGPDA-EMS (Para Opencode)

Este documento contiene las instrucciones estandarizadas para auditar **cualquier planeación y paquete completo de entregables (`01_` a `09_`)** de **cualquier asignatura o módulo** en SIGPDA-EMS (Pensamiento Matemático, Humanidades, Lengua y Comunicación, Ciencias Experimentales, Formación Técnica/BT, Socioemocional, etc.), antes de entregar materiales a usuarios o escalar la generación a nuevas asignaturas.

---

## Cómo usar este prompt

Copia el bloque de abajo completo a **Opencode** y sustituye únicamente los 4 parámetros entre `<...>`:

- `<NOMBRE_ASIGNATURA>`: nombre oficial de la UAC o módulo.
- `<RUTA_CARPETA_NVO>`: ruta absoluta de la carpeta recién descargada de la plataforma.
- `<RUTA_CARPETA_ANT>`: ruta absoluta de la carpeta anterior para comparar cambios (o escribe `N/A` si es una planeación nueva desde cero).
- `<PLANNING_ID>`: UUID de la planeación en PostgreSQL/Neon si deseas auditar BD y R1 (o escribe `N/A` si solo auditas los archivos descargados).

---

## Prompt listo para copiar y pegar en Opencode

```markdown
Eres el auditor técnico y pedagógico de SIGPDA-EMS. Debes auditar de forma objetiva, determinista y con evidencia verificable los materiales generados para la asignatura:

- Asignatura / UAC: <NOMBRE_ASIGNATURA>
- Carpeta de materiales nuevos (NVO): <RUTA_CARPETA_NVO>
- Carpeta de materiales anteriores (ANT, si aplica): <RUTA_CARPETA_ANT>
- ID de planeación en BD (si aplica): <PLANNING_ID>

El objetivo NO es validar si los tests o scripts dicen "pass", sino dictaminar con total honestidad si esta planeación **está realmente lista para entregarse a docentes/estudiantes** y si la plataforma demuestra calidad estable para crear otras asignaturas.

### REGLA CERO — ANTI-AUTOENGAÑO Y VERIFICABILIDAD
1. Prohibido declarar "APROBADA" o "LISTA PARA USUARIO" basándote únicamente en métricas de forma, badges verdes de la UI o conteos agregados.
2. Solo reporta como hecho lo que ejecutes e inspecciones directamente en archivos descargados, scripts, código o BD en esta sesión. Todo lo que no inspecciones decláralo en "Límites de la auditoría".
3. Si el resultado tiene defectos semánticos, pedagógicos, de español o de coherencia visual aunque el QA automático dé verde, el dictamen DEBE ser **NO APTA** o **CON CORRECCIONES NECESARIAS**.

---

### ESTÁNDAR PEDAGÓGICO OBLIGATORIO DE LA PLATAFORMA

#### A. Documentos rectores, libro y evaluación (`01` a `07`)
- **`01_Planeacion` y `02_Secuencia`**: cobertura completa del semestre/bloques/sesiones oficiales, continuidad visual sin reinicios falsos de tablas, ponderaciones globales consistentes, cero placeholders y cero texto de otra asignatura.
- **`03_Planes_Clase`**: 1 plan por cada sesión programada; pie de página continuo en el compilado (no `Página 1 de N` por cada sesión); actividades diferenciadas por sesión (sin plantillas repetidas idénticas decenas de veces); cero fugas o citas a otra sesión.
- **`04_Solucionario`**: paridad 1:1 con los ejercicios prácticos, pasos completos hasta el resultado numérico/argumentado final, sin líneas de números sueltos/huérfanos ni soluciones genéricas ("Reporte técnico justificando...").
- **`05_Guias_Practica`**: fichas completas, consignas accionables, formato limpio sin `Ejercicio 1.:` ni títulos en futuro mal normalizados.
- **`06_Libro_Semestral`**: cuaderno autodidacta confiable; figuras/diagramas coherentes con cada ejercicio (no figuras genéricas ni de otro problema); sin Markdown crudo (`|---`), sin `!=`, sin `raiz(...)` literal o LaTeX sin convertir, sin semáforos o párrafos truncados; rúbrica analítica con suma de ponderaciones = 100% (±0.5%) y 4 niveles completos.
- **`07_Instrumentos`**: rúbricas y listas de cotejo completas por bloque, paginación continua y ponderaciones al 100%.

#### B. Presentaciones Electrónicas (`08_*.pptx`) — Guía expositiva del docente en clase
Las presentaciones **NO deben copiar ni repetir párrafos del libro** ni ser resúmenes planos. Deben funcionar como un **pizarrón expositivo compacto e inteligente** que ahorre tiempo al docente y le permita explicar cada sesión paso a paso:
1. **Conocimiento nuevo breve (`1/2`)**: explicar de forma clara, compacta y directa el concepto o principio nuevo que se va a aprender (no un eslogan genérico ni repetición del título).
2. **Ejemplificación y ejercicio resuelto breve (`1/2`)**: mostrar un ejemplo concreto y su resolución breve paso a paso hasta concluir el resultado real (sin paja, sin pasos truncados y NUNCA repitiendo el texto de "Conocimiento nuevo" dentro de "Ejemplo resuelto").
3. **Actividades del libro completas (`2/2`)**: proyectar las actividades que el estudiante debe realizar en el libro conservando **contexto/datos + verbo de acción/consigna + pregunta o producto explícito** (junto con pistas útiles y no duplicadas). Nunca cortar la pregunta dejando solo los datos.
4. **Aplicación real y evaluación (`2/2`)**: mostrar dónde se aplica el conocimiento nuevo (vinculado al tema/producto integrador, no relleno genérico) y proyectar criterios claros de evaluación/rúbrica para guiar al grupo.
5. **Coherencia visual y español natural**: fórmula/esquema coherente con el ejemplo; cero colisiones geométricas; español gramaticalmente natural sin palabras deformadas.

#### C. Infografías (`09_*.pdf`) — Manual visual de conceptos para el estudiante
Las infografías **NO deben ser un clon del libro ni repetir verbatim las diapositivas**. Deben funcionar como un **manual de conceptos clave / mapa conceptual / ruta de alto impacto** ("en un solo golpe de vista"):
1. **Síntesis conceptual real**: presentar qué es el concepto central, qué ideas o definiciones clave debe dominar el alumno para resolver actividades y cómo se relacionan (mapa conceptual o diagrama claro).
2. **Prohibidas las tautologías**: no abrir con frases plantilla vacías como *"El concepto central es <título> y se aplica en situaciones del entorno"* ni definiciones circulares.
3. **Coherencia estricta tema ↔ fórmula ↔ diagrama ↔ mini-ejemplo**: la fórmula destacada debe estar completa y ser correcta; el diagrama/gráfica debe corresponder exactamente al tema de esa lámina (ej. nunca mezclar diagramas de otro tema ni inventar parámetros que contradicen el ejemplo).
4. **Español limpio y vectorial**: texto 100% seleccionable, Unicode/notación matemática íntegra (primas, grados, símbolos, signos), sin traslape excesivo literal con el libro ni mutaciones sintácticas absurdas.

---

### PROCEDIMIENTO DE AUDITORÍA EN 6 FASES (EJECUTAR EN ORDEN)

#### FASE 1 — Comparación ANT vs NVO y Verificación de Caché / Despliegue
1. Si `<RUTA_CARPETA_ANT>` es distinto de `N/A`:
   - Compara por nombre los archivos de `ANT` y `NVO`: tamaño en bytes, fecha y **contenido de texto extraído real** (PDFs con `pdf-parse`/`pdfjs` y PPTX leyendo todas las `ppt/slides/slide*.xml`), no solo el hash del binario.
   - **Regla de bloqueo inmediato:** si los archivos `08_*.pptx` y/o `09_*.pdf` de `NVO` tienen exactamente el mismo texto extraído que `ANT`, decláralo de inmediato como **fallo de despliegue/caché o no-regeneración en el entorno**, y NO atribuyas defectos sin verificar qué genera el código local (`HEAD`).
2. Registra el estado del repositorio:
   - `git rev-parse --short HEAD`
   - `git status --short`
   - Ejecuta `npx tsc --noEmit` y `npx vitest run` (reporta cifras exactas observadas).
   - Si sospechas desfase entre el código local (`HEAD`) y los archivos descargados, ejecuta una prueba rápida en memoria con `buildSacrintDeck` / `buildSacrintInfographic` sobre una sesión real de `<PLANNING_ID>` (o del texto del libro `06_`) para confirmar qué genera exactamente `HEAD` hoy.

#### FASE 2 — Auditoría Automática QA y Contaminación Cruzada
1. Ejecuta el script oficial en modo estricto y guarda el JSON para inspeccionarlo completo:
   - `npx tsx scripts/qa-sacrint-materials.ts --dir "<RUTA_CARPETA_NVO>" --strict`
   - `npx tsx scripts/qa-sacrint-materials.ts --dir "<RUTA_CARPETA_NVO>" --strict --json`
2. Si existe `<PLANNING_ID>` y acceso a BD (`.env.local`), ejecuta en modo read-only:
   - `npx tsx scripts/audit-cross-contamination.ts --planning <PLANNING_ID>`
   - Revisa también en BD el estado de los bloques (`version`, `qualityScore`, `alignmentScore`, errores R1 en `reviewBlockMaterials` y suma de ponderaciones de `evaluationSection.rubric`).
3. Nota técnica sobre `qa-sacrint-materials.ts`: si el reporte marca `dangling_question` en palabras válidas terminadas en `<letra_diacrítica>o?` (p. ej. `diseño?` por límite `\b` no-Unicode en JS), verifícalo con el fragmento literal y clasifícalo como falso positivo del regex, pero **NO omitas ningún otro fallo ni bajes ningún umbral**.

#### FASE 3 — Auditoría Estructural y de Contenido en `01` a `07`
Inspecciona mediante script los textos extraídos de `01_` a `07_`:
1. Verifica que existan todos los archivos esperados (`01_` a `09_`).
2. Mide cobertura real de sesiones (sin huecos ni reinicios) y verifica pies continuos (`Página 1 de N` debe aparecer máximo 1 vez al inicio de cada compilado `03`, `04`, `05`, `07`).
3. Verifica ausencia de plantillas genéricas, fallbacks (`Modelo por construir`, `undefined`, `[completar]`, `[...]`, `${...}`, `[OK]`), tablas Markdown crudas (`|---`), operadores `!=`, `raiz(...)` o LaTeX sin renderizar.
4. **Contaminación disciplinar:** busca términos ajenos a `<NOMBRE_ASIGNATURA>` (p. ej., conceptos de otra materia, fallbacks geográficos/CCT improcedentes o vocabulario técnico de otra especialidad).
5. **Ponderaciones y evaluación:** verifica en `04`, `06` y `07` que cada rúbrica analítica sume `100%` (no confundas la ponderación global semestral Diagnóstica/Formativa/Sumativa de `01`/`02` con las rúbricas internas de bloque en `04`/`06`/`07`).
6. Revisa una muestra estratificada de al menos 3 sesiones (inicio, mitad y final) en `03`, `04`, `05` y `06` verificando coherencia ejercicio ↔ solución ↔ figura.

#### FASE 4 — Auditoría Exhaustiva (100% de diapositivas) de `08_*.pptx`
Escribe/ejecuta un script de inspección sobre **TODAS** las diapositivas de `08_*.pptx` + lectura manual de al menos **4 portadas/sesiones completas (inicio, 2 intermedias y final)** más todas las diapositivas con alertas:
1. **Conteo y estructura:** total de portadas, láminas `1/2`, láminas `2/2`, colisiones geométricas, `wrap="none"`, palabras promedio en `1/2` y `2/2`, y cuántas superan 200 palabras.
2. **Chequeo `1/2` (Conocimiento nuevo + Ejemplo + Fórmula + Figura):**
   - ¿Cuántas láminas `1/2` tienen `CONOCIMIENTO NUEVO` vacío, tautológico o `< 60` caracteres?
   - **¿Cuántas láminas `1/2` repiten el texto de `CONOCIMIENTO NUEVO` dentro de `EJEMPLO RESUELTO` o carecen de pasos resueltos y conclusión numérica/argumentada?** (Inaceptable si > 0).
   - ¿Hay fórmulas erróneas o truncadas (p. ej. `x = 1800` cuando `12x = 1800`, `c = 0`, etc.) o diagramas que no corresponden al ejemplo de esa sesión?
3. **Chequeo `2/2` (Actividades del libro + Aplicación + Evaluación):**
   - **¿Cuántas `Actividad 1` o `Actividad 2` carecen de verbo de consigna o de pregunta (`?`), o quedaron recortadas solo al planteamiento/datos?** (Reporta conteo exacto y ejemplos literales).
   - ¿Cuántas pistas se repiten o dicen genéricos como `"Luego, plantea una ecuación."`?
   - ¿`APLICACIÓN REAL`, `EVALUACIÓN` y `EVIDENCIA` son específicas del tema y comprensibles sin leer el libro?
4. **Chequeo lingüístico anti-corrupción por reescritura de sinónimos:**
   - Busca en TODAS las láminas y páginas errores introducidos por reemplazos automáticos sin concordancia, tales como:
     - Sustitución de verbos por sustantivos (ej. `"nos subconjunto"` por `"nos muestra"`).
     - Discordancia de género/número (ej. `"el regla"`, `"el plantilla"`, `"todo + sustantivo femenino/singular mal concordado"` como `"todo donación"`, `"todo unidad"`).
     - Alteración de términos disciplinares (ej. `"polígono"` en lugar de `"triángulo"`, `"costado"` en lugar de `"lado"`, `"memoria de cómputo"` por `"cálculo"`, tautologías como `"Una equivalencia es una equivalencia..."`).
   - Busca también en general cualquier frase agramatical o truncada a mitad de idea.
5. **Independencia frente al libro (`06_`):** reporta el porcentaje de coincidencia de 6-gramas por diapositiva y promedio, verificando que las diapositivas sinteticen sin copiar párrafos completos del libro y sin destruir la gramática española.

#### FASE 5 — Auditoría Exhaustiva (100% de páginas) de `09_*.pdf`
Extrae texto página por página de `09_*.pdf` e inspecciona manualmente al menos 4 páginas distribuidas (inicio, bloque intermedio, cierre y las de mayor solapamiento):
1. Páginas totales, promedio de caracteres por página, `rasterLowText`, títulos duplicados entre páginas.
2. **Detector de tautologías y genéricos:** cuenta cuántas páginas contienen fórmulas vacías como `"El concepto central es ... y se aplica en situaciones del entorno"` o `"Concepto clave para interpretar ..."` en lugar de una explicación real.
3. **Coherencia título ↔ fórmula ↔ diagrama ↔ procedimiento:** verifica que el diagrama vectorial o conceptual dibujado corresponda realmente al tema del título de esa página (sin diagramas de otro tema), que la fórmula esté completa y que el mini-ejemplo/procedimiento llegue al resultado correcto.
4. **Calidad del español y solapamiento:** reporta las mismas anomalías de sinonimia mecánica/agramaticalidad que en `08` y el solapamiento global de 6-gramas con `06_Libro` (junto con el conteo de páginas > 15% y > 20%).

#### FASE 6 — Dictamen Final y Reglas de Aprobación
Emite uno de estos **3 únicos dictámenes** según criterios estrictos:

- **`✅ LISTA PARA ENTREGAR AL USUARIO` (y apta para probar nuevas asignaturas):**
  Cumple **TODOS** estos requisitos:
  1. Todos los entregables `01`–`09` presentes y actualizados (no congelados respecto a `ANT`).
  2. `qa-sacrint-materials.ts --strict`: `0` fallos reales (solo se toleran falsos positivos demostrados del propio regex QA, documentados uno por uno).
  3. `0` contaminación disciplinar, `0` fallbacks/placeholders, rúbricas al 100%, paginación continua.
  4. En `08_*.pptx`: `0` actividades sin consigna/pregunta, `0` láminas `1/2` que repitan `CONOCIMIENTO NUEVO` como `EJEMPLO RESUELTO` o carezcan de ejemplo resuelto breve, `0` fórmulas falsas/diagramas ajenos, `0` corrupción gramatical por sinónimos.
  5. En `09_*.pdf`: funciona realmente como manual de conceptos claro, `0` tautologías genéricas de relleno, `0` diagramas de otro tema, `0` corrupción gramatical y texto 100% vectorial legible.

- **`⚠️ CON CORRECCIONES NECESARIAS ANTES DE ENTREGA`:**
  Los documentos `01`–`07` son utilizables como base, pero persisten defectos puntuales de edición, español, diapositivas sin consigna/ejemplo o infografías desalineadas/genéricas en `08` o `09`. **No entregar al usuario final hasta corregirlos.**

- **`❌ NO APTA / BLOQUEADA`:**
  Existen fallos críticos en `01`–`09`: contaminación de otra asignatura, rúbricas desbalanceadas, `08`/`09` sin regenerar o congelados por caché, truncamientos masivos, fórmulas o diagramas incorrectos o fallos estructurales graves en R1 / QA.

---

### FORMATO OBLIGATORIO DE RESPUESTA DE OPENCODE

Entrega siempre el informe con esta estructura exacta y concisa:

1. **Veredicto ejecutivo (máx. 3 líneas):**
   - Dictamen: `✅ LISTA PARA ENTREGAR AL USUARIO` / `⚠️ CON CORRECCIONES NECESARIAS` / `❌ NO APTA / BLOQUEADA`.
   - Respuesta directa a: **¿Se puede entregar al usuario?** (`Sí/No` + razón) y **¿Conviene pasar ya a crear otra asignatura?** (`Sí/No` + condición).
2. **Control de cambios (`ANT` vs `NVO`) y Estado del Repositorio/BD:**
   - Commit `HEAD`, `tsc --noEmit`, `vitest run`, `audit:contamination`.
   - Confirmación por archivo (`01`..`09`) de si `NVO` realmente cambió en **texto extraído** respecto a `ANT` (no solo tamaño).
3. **Tabla resumen de los 9 entregables (`01` a `09`):**
   - Columnas: `Material` | `Págs/Slides` | `QA strict` | `Calidad didáctica real` | `Estado (✅/⚠️/❌)` | `Hallazgos clave con cita exacta (pág/slide)`.
4. **Auditoría pedagógica profunda de `08 Presentaciones` y `09 Infografías`:**
   - Cumplimiento punto por punto de: conocimiento nuevo breve, ejemplo resuelto real sin duplicar definición, actividades completas con consigna/pregunta, aplicación real y evaluación; y en `09` su utilidad real como manual/mapa conceptual.
   - Métricas exactas observadas: slides `1/2` sin ejemplo o con duplicación `Concepto == Ejemplo`; actividades truncadas o sin `?`; casos de español corrompido por sinónimos; páginas de `09` con tautologías o diagramas desalineados; solapamiento de 6-gramas.
5. **Brechas exactas para corregir (si no es `✅`) y límites de la auditoría.**
```
