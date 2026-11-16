# Plan de corrección para Antigravity — Paquete PM3

**Objetivo:** corregir los 16 fallos de la QA strict del paquete actual de **Pensamiento Matemático III** y dejar el generador listo para producir otra asignatura sin repetir los mismos defectos.

**Regla principal:** no se debe debilitar la QA ni ocultar fallos. Si una validación falla, se corrige el contenido o el render; no se elimina la validación.

**Estado de partida del ZIP auditado:**

- 16 fallos QA strict.
- 08: 15 actividades débiles/truncadas, 19 slides 1/2 y 3 slides 2/2 con más de 200 palabras, 2 colisiones geométricas, 2 tablas Markdown crudas.
- 09: 54 páginas, 0 títulos duplicados, pero 32.9 % de solapamiento de 6-gramas con el libro 06, 3 tablas Markdown crudas y tarjetas `R/A/B`.
- 03/04/05/07: pies fragmentados “Página 1 de N”.
- 06: tablas Markdown crudas, `raiz(...)`, pasos pegados y pasos huérfanos.
- 01/02: sin fallos QA.

---

## 0. Antes de tocar código: entender por qué el ZIP actual falla

No hay que investigar todo el repositorio. Los defectos ya están localizados:

| Defecto | Archivo responsable | Causa exacta |
|---|---|---|
| 03/04/05/07 con “Página 1 de N” repetido | `src/app/api/pdf/extra/combined/route.ts` | La ruta combina PDFs con `generateExtraPdfDocument(...)` sin `suppressPageFooter`; cada extra dibuja su propio pie y nadie lo elimina. |
| 08/09/06 con tablas Markdown crudas | `src/lib/visual-engine/content-extractor.ts` y `src/lib/visual-engine/sacrint/content-distiller.ts` | `stripMarkdown()` y `cleanSacrintText()` no eliminan bloques de tabla Markdown. |
| 08 Actividad 2 de S3 termina en “señala c” | `src/lib/editorial/pedagogical-text-fitter.ts` y `src/lib/visual-engine/sacrint/content-distiller.ts` | `hasDanglingEnding()` acepta una letra aislada (`c`) sin contexto de variable; además el presupuesto de actividad es 158 caracteres / 23 palabras. |
| 08 S19 con ejemplo roto (“multiplicados.”, “obtenemos.”, “y x₂.”) | `src/lib/visual-engine/sacrint/content-distiller.ts` | `extractWorkedExample()` acepta pasos y conclusiones sintácticamente terminados pero semánticamente incompletos; el fitter recorta a 78 caracteres por paso. |
| 08 colisión S92 `V(14.5,-0.2)` vs `x1=14` | `src/lib/visual-engine/sacrint/sacrint-pptx-generator.ts` | Solo se evita la etiqueta de raíz cuando la parábola es tangente; no hay detección general de etiquetas cercanas. |
| 08 con 22 slides > 200 palabras / promedio 188.5 | `src/lib/visual-engine/sacrint/spec.ts` | No existe una pasada final de presupuesto de palabras por slide. |
| 09 con 32.9 % de solapamiento | `src/lib/visual-engine/sacrint/spec.ts` y `content-distiller.ts` | `deOverlap` solo se aplica a claim, pasos, ejemplo y aplicación; no a definiciones, conceptos clave, mapa conceptual, criterios, proyecto ni error común. `preventSixGramTheoryOverlap` solo sustituye palabras; si no hay sinónimo, deja la frase copiada. |
| 09 con `R/A/B` | `src/lib/visual-engine/sacrint/spec.ts` | Las tarjetas vienen de `diagram.highlights`; el filtro actual no se aplica al spec final que consume el PDF vectorial. |
| 09 ángulos + Pitágoras mezclados | `src/lib/visual-engine/sacrint/spec.ts` | `isInfographicDiagramCoherent()` no compara familia conceptual de título/fórmula; acepta geometría con geometría aunque sean temas distintos. |
| 06 con `raiz(...)` | `src/lib/pdf-workbook-renderer.ts` | El libro usa `stripMarkdown` + `sanitizePdfText`, pero no `normalizeMathNotation`. |
| 06 con pasos pegados/huérfanos | `src/lib/pdf-workbook-renderer.ts` | `stepProtected` solo separa “Paso” al inicio o tras punto; no separa “Ecuación 2:” ni “Paso 1:” inline. |

---

## 1. Corregir pies fragmentados en 03/04/05/07

### Archivo

`src/app/api/pdf/extra/combined/route.ts`

### Problema exacto

En la sección “Generar PDF individual por extra y fusionar con pdf-lib” (aprox. líneas 229–260) se hace:

```ts
const pdfDoc = generateExtraPdfDocument({ ...extra, keyIndex: canonicalKeyIndex }, brandingCtx);
const bytes = Buffer.from(pdfDoc.output('arraybuffer'));
const individualPdf = await PDFDocument.load(bytes);
const pages = await mergedPdf.copyPages(individualPdf, individualPdf.getPageIndices());
for (const page of pages) mergedPdf.addPage(page);
```

Cada `generateExtraPdfDocument` dibuja su propio pie “Página 1 de N”. Al copiar páginas, esos pies se conservan. El resultado son 72 pies “Página 1 de N” en 03.

Ya existe la función correcta en `src/lib/pdf-extra-renderer.ts`:

```ts
mergeCompiledExtrasPdf(items, context, { compiledLabel })
```

Esa función:

- renderiza cada extra con `{ suppressPageFooter: true }`;
- fusiona las páginas;
- añade un solo pie continuo “Página P de N”.

### Corrección

1. Importar `mergeCompiledExtrasPdf`:

```ts
import { mergeCompiledExtrasPdf } from '@/lib/pdf-extra-renderer';
```

2. Sustituir el bucle manual de generación/fusión por:

```ts
const mergeItems = allExtras.map((extra) => {
  const rawKey = extra.key_index;
  const resolved = rawKey !== null && rawKey !== undefined ? resolveBlockNumber(rawKey) : null;
  return {
    id: extra.id,
    title: extra.title,
    type: extra.type,
    content_text: extra.content_text,
    keyIndex: resolved !== null ? resolved - 1 : rawKey,
  };
});

let generatedCount = 0;
const mergedBytes = await mergeCompiledExtrasPdf(
  mergeItems,
  brandingCtx,
  {
    compiledLabel: typeLabel(cleanType).replace(/_/g, ' ').toUpperCase(),
    onItemRendered: () => { generatedCount += 1; },
  }
);

if (!mergedBytes) {
  return new Response('No se pudo generar ningún documento', { status: 500 });
}

if (blockIndex !== null && generatedCount !== allExtras.length) {
  return new Response(
    `No se pudo generar el documento completo del bloque (${generatedCount} de ${allExtras.length}). Intenta de nuevo.`,
    { status: 500 }
  );
}
```

3. Añadir `onItemRendered` a las opciones de `mergeCompiledExtrasPdf` en `src/lib/pdf-extra-renderer.ts`:

```ts
options?: {
  compiledLabel?: string;
  onItemRendered?: () => void;
}
```

Dentro del bucle, después de `count++`:

```ts
options?.onItemRendered?.();
```

4. Eliminar el import de `PDFDocument` de esa ruta si ya no se usa. No eliminar `PDFDocument` de `pdf-extra-renderer.ts`.

### Prueba obligatoria

Añadir/ajustar una prueba de la ruta combinada que verifique:

- se llama `mergeCompiledExtrasPdf`;
- no se entrega un PDF con pies “Página 1 de N”;
- si un extra falla y `blockIndex !== null`, responde 500.

La prueba existente de `mergeCompiledExtrasPdf` está en `src/__tests__/pm3-semantic-regressions.test.ts` (aprox. línea 269). No basta con esa prueba: hay que cubrir la ruta `/api/pdf/extra/combined`.

### Criterio de aceptación

- 03: 0 pies “Página 1 de N”.
- 04: 0 pies “Página 1 de N”.
- 05: 0 pies “Página 1 de N”.
- 07: 0 pies “Página 1 de N”.
- Cada compilado tiene un solo pie continuo “Página P de N”.

---

## 2. Eliminar tablas Markdown crudas en 06, 08 y 09

### Archivos

- `src/lib/visual-engine/content-extractor.ts`
- `src/lib/visual-engine/sacrint/content-distiller.ts`
- `src/lib/pdf-workbook-renderer.ts` (consumidor)

### Problema exacto

`stripMarkdown()` en `content-extractor.ts` (aprox. línea 48) elimina encabezados, viñetas, negritas, código y tachado, pero **no** elimina tablas:

```text
| y | Par ordenado (x, y) |
|---|---|
| 0 | (0, 3) |
```

`cleanSacrintText()` en `content-distiller.ts` (aprox. línea 70) tampoco las elimina. Por eso la tabla llega al PPTX de 08 y al PDF de 09. El libro 06 también la conserva porque su render usa `stripMarkdown`.

### Corrección

1. Crear un helper compartido, por ejemplo en `src/lib/editorial/markdown-table-sanitizer.ts`:

```ts
export function stripMarkdownTables(value: string | null | undefined): string {
  if (!value) return '';

  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inTable = false;

  const isSeparator = (line: string) =>
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

  const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);

  for (const line of lines) {
    if (isSeparator(line)) {
      inTable = true;
      continue;
    }

    if (isTableRow(line)) {
      inTable = true;
      continue;
    }

    if (inTable) {
      if (!line.trim()) {
        inTable = false;
        continue;
      }
      // Una línea normal después de una tabla cierra la tabla.
      inTable = false;
    }

    out.push(line);
  }

  return out
    .join('\n')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

2. En `stripMarkdown()`:

```ts
import { stripMarkdownTables } from '@/lib/editorial/markdown-table-sanitizer';

export function stripMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  const structuralCleaned = stripMarkdownTables(text)
    .replace(/<!--[\s\S]*?-->/g, '')
    // ...resto de reglas existentes...
```

3. En `cleanSacrintText()` y `cleanSacrintTextPreservingLines()`:

```ts
import { stripMarkdownTables } from '@/lib/editorial/markdown-table-sanitizer';

export function cleanSacrintText(value: string | null | undefined): string {
  if (!value) return '';
  let text = stripWorkbookTags(value);
  text = stripMaterialTagsForSlide(text);
  text = stripMarkdownTables(text);
  // ...resto de reglas existentes...
```

4. Para tablas que lleguen aplanadas en una sola línea, añadir un segundo pase **solo si contiene separador de tabla**:

```ts
const hasTableSeparator = /\|\s*:?-{3,}:?\s*\|/.test(text);
if (hasTableSeparator) {
  text = text.replace(/\|\s*[^|\n]{1,80}\s*\|(?:\s*[^|\n]{1,80}\s*\|)+\s*/g, ' ');
}
```

No aplicar ese segundo pase a fórmulas con `|` (valor absoluto o “tal que”) sin comprobar que hay `---` en el bloque.

### Pruebas obligatorias

```ts
expect(cleanSacrintText('| y | Par ordenado (x, y) |\n|---|---|\n| 0 | (0, 3) |')).not.toContain('|');
expect(stripMarkdown('| y | Par ordenado (x, y) |\n|---|---|\n| 0 | (0, 3) |')).not.toContain('---');
```

Añadir también una prueba con la cadena exacta que aparece en la QA:

```ts
const raw = '| y | Par ordenado (x, y) | |---|---|--------------------| | 0 | (0, 3) |';
expect(cleanSacrintText(raw)).not.toMatch(/\|\s*-{3,}/);
```

### Criterio de aceptación

- 06: 0 `raw_markdown_table`.
- 08: 0 `raw_markdown_table`.
- 09: 0 `raw_markdown_table`.

---

## 3. Corregir actividades truncadas en 08 (S3 “señala c”)

### Archivos

- `src/lib/editorial/pedagogical-text-fitter.ts`
- `src/lib/visual-engine/sacrint/content-distiller.ts`

### Problema exacto

En `content-distiller.ts`, dentro de la extracción de actividades (aprox. líneas 1762–1775):

```ts
const stmtMax = allowMission ? 235 : 158;
const stmtWords = allowMission ? undefined : 23;
```

La actividad de S3 queda en 156 caracteres y termina en “señala c”. El texto original completo es:

> “Si el desembolso total es de $1,000, formula la igualdad lineal correspondiente y señala claramente cuál es el factor y cuál es el componente independiente.”

El corte ocurre porque:

1. El presupuesto de 158 caracteres es menor que la consigna completa.
2. `fitPedagogicalText()` hace un recorte por palabras y acepta terminar en la letra `c`.
3. `hasDanglingEnding()` trata `x,y,z,a,b,c,m,n` como letras válidas sin exigir contexto de variable.

### Corrección A — `hasDanglingEnding`

En `src/lib/editorial/pedagogical-text-fitter.ts`, cambiar el bloque de letras aisladas para que solo sean válidas con contexto matemático explícito:

```ts
if (/^[xyzabcmn]$/i.test(lastWord)) {
  const hasVariableContext =
    /\b(?:variable|inc[oó]gnita|valor(?:\s+de)?|despejar|eliminar|para|eje|cateto|lado|[aá]ngulo)\s+[xyzabcmn]$/i.test(
      withoutTrailingDot
    );
  if (!hasVariableContext) return true;
}
```

Con esto, “señala c” se considera final colgado y el fitter debe quitar ese fragmento o conservar una cláusula completa.

### Corrección B — presupuesto de actividades

En `content-distiller.ts`:

```ts
const stmtMax = allowMission ? 235 : 190;
const stmtWords = allowMission ? undefined : 30;
```

También en la rama de pregunta completa, permitir hasta 240 caracteres:

```ts
if (questionSentence && questionSentence.length <= maxChars + 60) {
  // ...
}
```

No bajar estos límites para “hacer pasar” la QA. El objetivo es que la consigna completa quepa.

### Corrección C — `ensureActivityTask` real

Actualmente es un no-op:

```ts
const ensureActivityTask = (text: string): string => text.trim();
```

Implementar una guarda final:

```ts
const ensureActivityTask = (text: string): string => {
  const clean = text.trim();
  if (!clean) return '';

  const words = clean.split(/\s+/);
  const last = words[words.length - 1] ?? '';

  // Nunca terminar en una letra suelta que no sea variable con contexto.
  if (/^[xyzabcmn]$/i.test(last)) {
    const withoutLast = words.slice(0, -1).join(' ').replace(/[,;:\s]+$/, '').trim();
    if (withoutLast) return `${withoutLast}.`;
    return '';
  }

  return clean;
};
```

Y usar el resultado en **todas** las salidas de `distillExerciseStatement`, incluidas las ramas que hoy devuelven `fitPedagogicalText(...)` directamente.

### Corrección D — validar que la actividad tenga consigna

Añadir una comprobación final:

```ts
const hasTask =
  /[?]/.test(result) ||
  /\b(?:calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|señala|identifica|compara|justifica|explica|traza|completa)\b/i.test(
    result
  );

if (!hasTask) {
  // Usar la oración de pregunta/consigna original completa si cabe.
  const fallback = questionSentence || clean;
  return ensureActivityTask(
    fitPedagogicalText(fallback, {
      maxChars: maxChars + 60,
      maxWords: 34,
      role: 'activity',
    })
  );
}
```

### Pruebas obligatorias

```ts
const s3 =
  'Si el desembolso total es de $1,000, formula la igualdad lineal correspondiente y señala claramente cuál es el factor y cuál es el componente independiente.';

const result = distillExerciseStatement(s3, 190, 30);

expect(result).toContain('independiente');
expect(result).not.toMatch(/señala\s+c\.?$/i);
expect(result).not.toMatch(/\b[a-záéíóúñ]$/i);
```

### Criterio de aceptación

- 08: 0 `weak_or_truncated_activity`.
- S3 Act 2 termina en una idea completa, no en “señala c”.
- No aparecen actividades terminadas en una letra suelta.

---

## 4. Corregir ejemplo resuelto incompleto de 08 (S19)

### Archivo

`src/lib/visual-engine/sacrint/content-distiller.ts`

### Problema exacto

En S19 el ejemplo aparece así:

- “superficie exacta de 210.” → falta unidad y relación de dimensiones.
- “Aplicamos el método de factorización buscando dos números que multiplicados.” → paso incompleto.
- “De (x - 14) = 0 obtenemos x₁ = 14, y de (x - 15) = 0 obtenemos.” → paso incompleto.
- “Conclusión: Calculamos las dos raíces a partir de la regla general: x₁ = 15, y x₂.” → conclusión incompleta.
- “Error común: Resultados obtenidos al resolver.” → texto genérico, no es un error conceptual.

La causa es que `extractWorkedExample()` acepta pasos que terminan en punto pero no tienen operación completa, y `extractExampleConclusion()` acepta una conclusión con `=` aunque el segundo valor esté vacío.

### Corrección A — validador de pasos

Añadir cerca de `extractWorkedExample()`:

```ts
function isCompleteMathStep(step: string): boolean {
  const clean = step.trim();
  if (!clean) return false;
  if (hasDanglingEnding(clean)) return false;

  // Verbos/participios que indican una idea cortada.
  if (
    /\b(?:multiplicados|multiplicadas|obtenemos|obtenido|resolver|sustituir|aplicamos|calculamos|despejamos|factorizamos|igualamos|completamos)\s*[.,;:]?$/i.test(
      clean
    ) &&
    !clean.includes('=')
  ) {
    return false;
  }

  // Casos como "y x₂." o "x₁ = 15, y x₂."
  if (/\by\s+[xy]\s*[₀₁₂₃₄₅₆₇₈₉\d]*\s*[.,;:]?$/i.test(clean)) return false;
  if (/\b[xy]\s*[₀₁₂₃₄₅₆₇₈₉\d]*\s*[.,;:]?$/i.test(clean) && !clean.includes('=')) return false;

  // Un paso de matemáticas debe contener operación o igualdad.
  return /=|[+\-*/^√]|\b(?:suma|resta|multiplica|divide|factoriza|sustituye)\b/i.test(clean);
}
```

Aplicar en `extractWorkedExample()`:

```ts
const steps = selectedRawSteps
  .map((step) => distillStepPreservingMath(step, stepBudget, stepWords))
  .filter(Boolean)
  .filter(isCompleteMathStep)
  .slice(0, allowMission ? 4 : 3);
```

Añadir también un validador de enunciado, porque S19 dice “superficie exacta de 210.” sin unidad ni pregunta:

```ts
function isCompleteProblemStatement(value: string): boolean {
  const clean = value.trim();
  if (clean.length < 45) return false;
  if (!/\d/.test(clean)) return false;

  const hasTask =
    /[?]/.test(clean) ||
    /\b(?:calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|delimita|diseña|traza|completa|obtén)\b/i.test(clean);

  const hasUnitOrMoney =
    /(?:m²|cm²|\bm\b|\bcm\b|\bmm\b|\bkm\b|\bu\b|\bunidades\b|\bpesos\b|\$|°|\bgrados\b|\baños\b|\bhoras\b|\bsillas\b|\bpersonas\b|\blitros\b|\bkg\b)/i.test(clean);

  return hasTask && hasUnitOrMoney;
}
```

En `extractWorkedExample()`:

```ts
if (!allowMission && !isCompleteProblemStatement(statement)) {
  // No usar un enunciado mutilado: intentar práctica o devolver vacío para reparación.
  return buildFallbackFromPractice(mission, session) ?? {
    problemStatement: '',
    steps: [],
    interpretation: '',
  };
}
```

`buildFallbackFromPractice` debe usar `session.practica[0]` y validar también con `isCompleteProblemStatement`, `isCompleteMathStep` e `isCompleteConclusion`.

Subir el presupuesto de pasos para guía:

```ts
const stepBudget = allowMission ? 180 : 110;
const stepWords = allowMission ? undefined : 16;
const interpBudget = allowMission ? 155 : 100;
const interpWords = allowMission ? undefined : 15;
```

### Corrección B — conclusión completa

Añadir:

```ts
function isCompleteConclusion(value: string): boolean {
  const clean = value.trim();
  if (!clean || clean.length < 18) return false;
  if (/^resultados?\s+obtenidos/i.test(clean)) return false;
  if (/\by\s+[xy]\s*[₀₁₂₃₄₅₆₇₈₉\d]*\s*\.?$/i.test(clean)) return false;
  if (!/\d/.test(clean)) return false;

  // Debe haber un valor numérico después de "=" o una unidad/resultado explícito.
  return /=\s*-?\d+(?:[.,]\d+)?/.test(clean) || /\b\d+(?:[.,]\d+)?\s*(?:m|cm|mm|km|m²|cm²|u|unidades|pesos|\$|°|grados|años|horas|sillas|personas)\b/i.test(clean);
}
```

En `extractExampleConclusion()`, antes de devolver cualquier candidato:

```ts
if (!isCompleteConclusion(candidate)) return '';
```

Si no hay conclusión completa, no inventar; devolver `''` y dejar que el writer repare/regenera la sesión.

### Corrección C — error común no genérico

Añadir:

```ts
function isGenericMisconception(value: string): boolean {
  return /^(?:resultados?\s+obtenidos|error\s+común|revisar|analizar|evaluar|comprobar|verificar)\b/i.test(
    value.trim()
  ) || value.trim().length < 25;
}
```

En `resolveMissionMisconceptionParts()` o donde se construye `misconception`, si el texto es genérico:

- usar `mission.conceptZero?.contrastTable?.[0]?.commonMisconception`; o
- usar `session.practica[0]`/`bundle` para un error concreto; o
- omitir el bloque “Error común” si no hay uno real.

Nunca dejar “Resultados obtenidos al resolver.”.

### Corrección D — fallback desde práctica

Si después de filtrar quedan menos de 2 pasos:

1. Intentar construir el ejemplo desde `session.practica[0]`:
   - `enunciado` como `problemStatement`;
   - `solucion` como pasos;
   - última oración con resultado como `interpretation`.
2. Si tampoco hay 2 pasos completos, devolver `{ problemStatement: '', steps: [], interpretation: '' }`.
3. En el writer de sesión (`src/lib/guide-engine/writers/session-shard.ts` y/o `writer-contract.ts`), añadir un gate que rechace `ejemploResuelto` sin:
   - enunciado con datos y pregunta/consigna;
   - 2 pasos con operación;
   - conclusión con valor numérico.

El writer debe reparar/regenerar la sesión. No se debe renderizar un ejemplo vacío en 08.

### Pruebas obligatorias

```ts
expect(isCompleteMathStep('Aplicamos el método de factorización buscando dos números que multiplicados.')).toBe(false);
expect(isCompleteMathStep('De (x - 14) = 0 obtenemos x₁ = 14, y de (x - 15) = 0 obtenemos.')).toBe(false);
expect(isCompleteMathStep('x₁ = 14 y x₂ = 15.')).toBe(true);
expect(isCompleteConclusion('x₁ = 15, y x₂.')).toBe(false);
expect(isCompleteConclusion('x₁ = 15 y x₂ = 14; el área es 210 m².')).toBe(true);
```

### Criterio de aceptación

- S19 tiene enunciado con unidad (`m²`) y pregunta/consigna.
- S19 tiene al menos 2 pasos completos con `=`.
- S19 tiene conclusión con dos valores y unidad.
- No aparecen “multiplicados.”, “obtenemos.”, “y x₂.” ni “Resultados obtenidos al resolver.”.

---

## 5. Corregir colisiones geométricas en 08

### Archivo

`src/lib/visual-engine/sacrint/sacrint-pptx-generator.ts`

### Problema exacto

En `addPointMarker()` (aprox. líneas 555–580), la etiqueta siempre se coloca a la derecha:

```ts
const pillX = Math.min(1816 - pillW, px + 8);
const pillY = Math.max(336, py - 26);
```

En el diagrama cuadrático (aprox. líneas 671–678) solo se evita la etiqueta de raíz cuando la parábola es tangente:

```ts
if (tangentRoot !== undefined && Math.abs(root - tangentRoot) <= 1e-6) return;
```

En S92 el vértice es `V(14.5, -0.2)` y una raíz es `14`; no es tangente, pero las etiquetas se solapan.

### Corrección

1. Añadir una colocación opcional a `addPointMarker`:

```ts
type MarkerPlacement = 'right' | 'left' | 'below';

function addPointMarker(
  slide: PptxGenJS.Slide,
  px: number,
  py: number,
  label: string,
  accent: string,
  accent2: string,
  width = 88,
  placement: MarkerPlacement = 'right'
) {
  const pillW = Math.max(width, Math.min(186, Math.round(label.length * 10 + 22)));

  const pillX =
    placement === 'left'
      ? Math.max(16, px - pillW - 8)
      : Math.min(1816 - pillW, px + 8);

  const pillY =
    placement === 'below'
      ? Math.min(1040, py + 10)
      : Math.max(336, py - 26);

  // ...resto igual...
}
```

2. En el dibujo de raíces, detectar cercanía con el vértice y cambiar de lado:

```ts
const overlapsVertex = (rx: number, ry: number) =>
  Math.abs(rx - vx) < 140 && Math.abs(ry - vy) < 46;

diagram.roots.slice(0, 2).forEach((root, idx) => {
  const rx = xToPx(root);
  const ry = yToPx(0);
  const placement: MarkerPlacement = overlapsVertex(rx, ry) ? 'left' : 'right';

  addPointMarker(
    slide,
    rx,
    ry,
    `${idx === 0 ? 'x₁' : 'x₂'}=${formatTickLabel(root)}`,
    accent2,
    accent,
    88,
    placement
  );
});
```

3. Si dos raíces también están muy cerca, alternar `right` / `below`:

```ts
const usedRootLabelRects: Array<{ x: number; y: number; w: number; h: number }> = [];
```

Y elegir la primera colocación que no choque con el vértice ni con una etiqueta de raíz ya dibujada.

### Pruebas / verificación

- Añadir un fixture de parábola con vértice `14.5` y raíz `14`.
- Regenerar 08.
- La QA no debe reportar `colisiones geométricas`.
- Revisar visualmente S92: `V(14.5, -0.2)` y `x₁=14` deben leerse separados.

### Criterio de aceptación

- 0 colisiones geométricas en 08.
- No se elimina información de raíces; solo se recoloca.

---

## 6. Imponer presupuesto de palabras en 08

### Archivo

`src/lib/visual-engine/sacrint/spec.ts`

### Problema exacto

No hay una pasada final de compactación. Los campos se llenan con definiciones de hasta 220 caracteres, ejemplos, pasos, variables, hechos, etc. Resultado:

- 19 slides 1/2 con > 200 palabras.
- 3 slides 2/2 con > 200 palabras.
- Promedio 1/2: 188.5 palabras (QA exige 90–130).

### Corrección

Añadir una función `enforceLessonGuideSlideBudget(slide)` en `spec.ts` y aplicarla a `conceptSlide` y `practiceSlide` antes de devolverlas en `buildLessonGuideSlidesForSession()`.

```ts
function fitShort(value: string | undefined, maxChars: number, maxWords: number, role: 'concept' | 'problem' | 'step' | 'conclusion' | 'activity' | 'application' | 'hint'): string {
  if (!value) return '';
  return fitPedagogicalText(value, { maxChars, maxWords, role }) || value;
}

function enforceLessonGuideSlideBudget(slide: SacrintSlide): SacrintSlide {
  if (slide.kind === 'concept') {
    slide.explanation = fitShort(slide.explanation, 150, 22, 'concept');
    slide.analogy = fitShort(slide.analogy, 70, 11, 'concept');

    if (slide.keyTakeaways) {
      slide.keyTakeaways = slide.keyTakeaways
        .slice(0, 1)
        .map((item) => fitShort(item, 46, 7, 'concept'))
        .filter(Boolean);
    }

    if (slide.workedExample) {
      slide.workedExample = {
        problemStatement: fitShort(slide.workedExample.problemStatement, 110, 16, 'problem'),
        steps: slide.workedExample.steps
          .slice(0, 2)
          .map((step) => fitShort(step, 58, 9, 'step'))
          .filter(Boolean),
        interpretation: fitShort(slide.workedExample.interpretation, 55, 8, 'conclusion'),
      };
    }

    slide.variables = (slide.variables ?? [])
      .slice(0, 3)
      .map((variable) => ({
        ...variable,
        meaning: fitShort(variable.meaning, 32, 5, 'concept'),
      }));

    slide.facts = (slide.facts ?? []).slice(0, 1);
  }

  if (slide.kind === 'practice') {
    slide.activities = (slide.activities ?? []).slice(0, 2).map((activity) => ({
      ...activity,
      statement: fitShort(activity.statement, 150, 23, 'activity'),
      hint: fitShort(activity.hint, 60, 9, 'hint'),
    }));

    slide.applicationText = fitShort(slide.applicationText, 90, 14, 'application');
    slide.practiceText = fitShort(slide.practiceText, 90, 14, 'application');

    slide.objectiveBullets = (slide.objectiveBullets ?? [])
      .slice(0, 1)
      .map((item) => fitShort(item, 60, 9, 'concept'));

    slide.evaluationCriteria = (slide.evaluationCriteria ?? [])
      .slice(0, 2)
      .map((item) => fitShort(item, 48, 8, 'concept'));

    slide.exitChecks = (slide.exitChecks ?? [])
      .slice(0, 2)
      .map((item) => fitShort(item, 48, 8, 'concept'));

    slide.artifactName = fitShort(slide.artifactName, 40, 6, 'concept');
    slide.artifactStep = fitShort(slide.artifactStep, 60, 9, 'application');
  }

  return slide;
}
```

Aplicar:

```ts
const conceptSlide = enforceLessonGuideSlideBudget({ /* ... */ });
const practiceSlide = enforceLessonGuideSlideBudget({ /* ... */ });
```

Después de esa compactación, añadir un conteo duro:

```ts
function countSlideWords(slide: SacrintSlide): number {
  return JSON.stringify(slide)
    .replace(/"[^"]*":/g, ' ')
    .replace(/[{}[\],"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function finalCompact(slide: SacrintSlide, maxWords = 180): SacrintSlide {
  if (countSlideWords(slide) <= maxWords) return slide;

  if (slide.kind === 'concept') {
    slide.analogy = '';
    slide.keyTakeaways = [];
    slide.variables = (slide.variables ?? []).slice(0, 2);
    slide.facts = [];
  }

  if (slide.kind === 'practice') {
    slide.objectiveBullets = (slide.objectiveBullets ?? []).slice(0, 1);
    slide.exitChecks = (slide.exitChecks ?? []).slice(0, 1);
    slide.evaluationCriteria = (slide.evaluationCriteria ?? []).slice(0, 1);
  }

  return slide;
}
```

**Importante:** el conteo de QA cuenta el texto visible de la diapositiva, no solo el objeto. Si al aplicar `maxWords = 180` el promedio sigue >135, bajar los topes de contenido, no desactivar la QA:

- `explanation`: 120–150 caracteres.
- `workedExample.problemStatement`: 90–110.
- `workedExample.steps`: 2 × 55–60.
- `interpretation`: 45–55.
- `activities.statement`: 120–150.
- `applicationText`: 70–90.
- `evaluationCriteria` / `exitChecks`: 2 × 40–48.

### Pruebas

Añadir una prueba con un workbook sintético que tenga textos largos y verificar:

```ts
const deck = buildSacrintDeck(workbook, { mode: 'lesson-guide' });
for (const slide of deck.slides) {
  expect(countSlideWords(slide)).toBeLessThanOrEqual(180);
}
```

La aceptación final es la QA real: 0 slides > 200 y promedio 1/2 entre 90 y 130.

---

## 7. Corregir 09: solapamiento, coherencia y tarjetas R/A/B

### Archivos

- `src/lib/visual-engine/sacrint/spec.ts`
- `src/lib/visual-engine/sacrint/content-distiller.ts`

### 7.1 Solapamiento de 6-gramas (32.9 %)

#### Problema exacto

`buildSacrintInfographic()` aplica `deOverlap` solo a:

- `cleanClaim`;
- `steps[].body`;
- `quickExample`;
- `applicationSummary`.

No lo aplica a:

- `rawKeyConcepts` (de ahí salen `definitions`);
- `definitions[].definition`;
- `conceptMap[].detail`;
- `criteria`;
- `project`;
- `misconceptionFix`;
- `facts`;
- títulos secundarios.

Además, `preventSixGramTheoryOverlap()` solo sustituye palabras por sinónimos. Si una frase de 6 palabras no tiene sinónimo, permanece igual.

#### Corrección

1. Aplicar `deOverlap` a todos los campos visibles:

```ts
const rawKeyConcepts = (conceptHighlights.keyRules.length > 0
  ? conceptHighlights.keyRules
  : [conceptHighlights.definition]
)
  .map((c) => finalizeVisibleText(deOverlap(sanitizePedagogicalMetaPhrases(c)), { ensurePeriod: true }))
  .filter(Boolean);
```

2. En `definitions`, aplicar también al término y a la definición:

```ts
const definitions: ConceptManualDefinition[] = [
  {
    term: finalizeVisibleText(deOverlap(cleanTitle), { ensurePeriod: false }),
    definition: cleanClaim,
  },
  ...rawKeyConcepts.slice(0, 2).map((rule, idx) => {
    const colonIdx = rule.indexOf(':');
    const term = colonIdx > 3 && colonIdx < 36 ? rule.slice(0, colonIdx).trim() : idx === 0 ? 'Principio operativo' : 'Condición clave';
    const definition = colonIdx > 3 && colonIdx < 36 ? rule.slice(colonIdx + 1).trim() : rule;
    return {
      term: finalizeVisibleText(deOverlap(term), { ensurePeriod: false }),
      definition: finalizeVisibleText(deOverlap(definition), { ensurePeriod: true }),
    };
  }),
];
```

3. Añadir una pasada final al spec de 09. Debe recorrer **todos** los strings visibles:

```ts
function enforceInfographicOverlap(
  spec: SacrintInfographicSpec,
  sources: string[],
  maxRatio = 0.15
): SacrintInfographicSpec {
  const deOverlapStrict = (value: string): string => {
    if (!value) return value;
    const rewritten = preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(value), sources);
    const ratio = sixGramOverlapRatio(rewritten, sources);
    if (ratio <= maxRatio) return rewritten;

    // Si sigue copiando, se reemplaza por una síntesis breve del tema,
    // no por una frase genérica sin contenido.
    const topic = spec.title;
    const formulaClause = spec.formula ? ` Se modela con ${spec.formula}.` : '';
    const applicationClause = spec.applicationSummary ? ` Aplicación: ${spec.applicationSummary}` : '';
    return `${topic}.${formulaClause}${applicationClause}`.slice(0, 180);
  };

  spec.claim = deOverlapStrict(spec.claim);
  if (spec.conceptManual) {
    spec.conceptManual = {
      ...spec.conceptManual,
      centralConcept: deOverlapStrict(spec.conceptManual.centralConcept),
      conceptMap: spec.conceptManual.conceptMap.map((node) => ({
        ...node,
        detail: deOverlapStrict(node.detail),
      })),
      definitions: spec.conceptManual.definitions.map((d) => ({
        term: deOverlapStrict(d.term),
        definition: deOverlapStrict(d.definition),
      })),
      usageGuidance: spec.conceptManual.usageGuidance.map(deOverlapStrict),
      masteryChecklist: spec.conceptManual.masteryChecklist.map(deOverlapStrict),
    };
  }
  spec.keyConcepts = (spec.keyConcepts ?? []).map(deOverlapStrict);
  spec.criteria = (spec.criteria ?? []).map(deOverlapStrict);
  spec.steps = (spec.steps ?? []).map((step) => ({
    ...step,
    title: deOverlapStrict(step.title),
    body: deOverlapStrict(step.body),
  }));
  if (spec.quickExample) {
    spec.quickExample = {
      problemStatement: deOverlapStrict(spec.quickExample.problemStatement),
      steps: spec.quickExample.steps.map(deOverlapStrict),
      interpretation: deOverlapStrict(spec.quickExample.interpretation),
    };
  }
  if (spec.applicationSummary) spec.applicationSummary = deOverlapStrict(spec.applicationSummary);
  spec.misconception = deOverlapStrict(spec.misconception);
  if (spec.misconceptionFix) {
    spec.misconceptionFix = {
      error: deOverlapStrict(spec.misconceptionFix.error),
      correction: deOverlapStrict(spec.misconceptionFix.correction),
    };
  }

  return spec;
}
```

4. Implementar `sixGramOverlapRatio(text, sources)` con la misma normalización que la QA:

```ts
function sixGramOverlapRatio(text: string, sources: string[]): number {
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const sourceGrams = new Set<string>();
  for (const source of sources) {
    const words = normalize(source).split(/\s+/).filter(Boolean);
    for (let i = 0; i <= words.length - 6; i++) {
      sourceGrams.add(words.slice(i, i + 6).join(' '));
    }
  }

  const words = normalize(text).split(/\s+/).filter(Boolean);
  let total = 0;
  let hits = 0;
  for (let i = 0; i <= words.length - 6; i++) {
    total++;
    if (sourceGrams.has(words.slice(i, i + 6).join(' '))) hits++;
  }

  return total === 0 ? 0 : hits / total;
}
```

5. Aplicar al final de `buildSacrintInfographic()`:

```ts
return enforceInfographicOverlap(spec, infographicSources, 0.15);
```

6. Si después de esa pasada la QA sigue >20 %, no bajar el umbral. Hay que quitar las frases copiadas: eliminar `definitions`/`conceptMap` que sigan solapando o reemplazarlas por una síntesis original del tema. La meta es **≤ 20 %**.

### 7.2 Coherencia de fórmula/diagrama: ángulos vs Pitágoras

#### Problema exacto

En la página 54 aparece:

- Título: “Tipos de ángulos aplicados en el diseño estructural de espacios”.
- Fórmula: `c² = a² + b² | ángulo A + ángulo B = 90°`.

`isInfographicDiagramCoherent()` acepta ambos porque los dos son “geometría”. No distingue “ángulos” de “Pitágoras”.

#### Corrección

Añadir una familia conceptual:

```ts
type ConceptFamily = 'angles' | 'pythagoras' | 'area-perimeter' | 'congruence' | 'linear' | 'quadratic' | 'statistics' | 'other';

function conceptFamily(text: string): ConceptFamily {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/angul|complement|suplement|paralel|transversal|grados|°/.test(t)) return 'angles';
  if (/pitagor|hipotenusa|cateto|c\s*[²^]?2\s*=\s*a\s*[²^]?2\s*\+\s*b/.test(t)) return 'pythagoras';
  if (/perimetro|area|superficie|rectangulo|triangulo|poligono/.test(t)) return 'area-perimeter';
  if (/congruen|semejan|lll|lal|ala/.test(t)) return 'congruence';
  if (/ecuacion lineal|pendiente|interseccion|recta/.test(t)) return 'linear';
  if (/cuadratica|parabola|vertice|raices/.test(t)) return 'quadratic';
  if (/estadistica|muestra|poblacion|frecuencia|media|mediana|moda/.test(t)) return 'statistics';
  return 'other';
}
```

Reglas:

- Si `titleFamily === 'angles'` y `formulaFamily === 'pythagoras'`, **rechazar** la fórmula y el diagrama, salvo que el contexto mencione explícitamente “triángulo rectángulo” o “Pitágoras”.
- Si la fórmula tiene `|` y mezcla dos familias (`c²=a²+b² | ángulo A + ángulo B=90°`), dividir por `|`, elegir solo la parte que coincide con la familia del título y descartar la otra.
- Si no hay fórmula coherente, dejar `formula = ''` y `diagram.available = false`. Es mejor una lámina sin fórmula que una fórmula equivocada.

Implementar:

```ts
function isFormulaCoherentWithTitle(title: string, formula: string): boolean {
  if (!formula) return false;

  const titleFamily = conceptFamily(title);
  const parts = formula.split('|').map((p) => p.trim()).filter(Boolean);
  const coherentPart = parts.find((part) => {
    const family = conceptFamily(part);
    if (titleFamily === 'other') return true;
    if (titleFamily === 'angles' && family === 'pythagoras') return false;
    return family === titleFamily || family === 'other';
  });

  return Boolean(coherentPart);
}

const rawFormula = validFormulas[0] ?? (diagram.available && isQuantitativeOrReaction ? diagramFormula(diagram) : '');
const formula = rawFormula && isFormulaCoherentWithTitle(cleanTitle, rawFormula)
  ? rawFormula.split('|').map((p) => p.trim()).find((p) => {
      const f = conceptFamily(p);
      return f === conceptFamily(cleanTitle) || f === 'other';
    }) ?? ''
  : '';
```

Si `formula === ''`, poner `diagram.available = false` para no renderizar un diagrama de otro tema.

### 7.3 Tarjetas R/A/B

#### Problema exacto

Las tarjetas `R`, `A`, `B` vienen de `diagram.highlights` (o de `buildDiagramVariables` a partir de highlights). El filtro actual no se aplica al spec final que usa el PDF vectorial.

#### Corrección

Añadir un saneador final de diagrama en `buildSacrintInfographic()` antes de construir el spec:

```ts
function sanitizeInfographicDiagram(diagram: SacrintDiagramSpec): SacrintDiagramSpec {
  const isSingleLetter = (value: string | undefined) =>
    /^\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]\s*$/u.test(value ?? '');

  // SacrintDiagramSpec es una unión; no todos los tipos tienen highlights/nodes.
  const candidate = diagram as SacrintDiagramSpec & {
    highlights?: Array<{ label: string; detail?: string }>;
    nodes?: Array<{ label: string }>;
  };

  return {
    ...candidate,
    ...(Array.isArray(candidate.highlights)
      ? {
          highlights: candidate.highlights.filter(
            (h) => !isSingleLetter(h.label) && !isSingleLetter(h.detail)
          ),
        }
      : {}),
    ...(Array.isArray(candidate.nodes)
      ? {
          nodes: candidate.nodes.filter((node) => !isSingleLetter(node.label)),
        }
      : {}),
  } as SacrintDiagramSpec;
}
```

Aplicar:

```ts
const safeDiagram = sanitizeInfographicDiagram(diagram);
```

Y usar `safeDiagram` en el spec:

```ts
const variables = safeDiagram.available ? buildDiagramVariables(safeDiagram) : [];
```

No filtrar `variables` por símbolo: `x`, `y` o `b` son legítimos. El filtro de una letra aplica solo a `highlights`/`nodes`, que son las tarjetas `R/A/B`. Si una letra es una variable legítima (`A` = área, `b` = base), debe venir con nombre completo (`Área A`, `Base b`), no como tarjeta suelta.

### Pruebas

- `sixGramOverlapRatio` con una frase copiada del libro debe ser > 0.2; después de `enforceInfographicOverlap`, <= 0.15.
- Un spec con `diagram.highlights = [{ label: 'R', detail: '...' }]` no debe renderizar `R`.
- Un título de ángulos con fórmula `c²=a²+b²` debe producir `formula=''` y `diagram.available=false` (salvo contexto de triángulo rectángulo).

### Criterio de aceptación

- 09: solapamiento ≤ 20 % (ideal ≤ 15 %).
- 09: 0 tablas Markdown.
- 09: 0 tarjetas R/A/B.
- 09: 0 fórmulas de otro tema.
- 09: 54+ páginas, 0 títulos duplicados.

---

## 8. Corregir libro 06: `raiz(...)`, tablas, pasos pegados y huérfanos

### Archivo

`src/lib/pdf-workbook-renderer.ts`

### Problema exacto

- `printParagraph()` usa `sanitizePdfText(stripMarkdown(text))`; no normaliza `raiz(...)`.
- `stepProtected` solo separa “Paso” al inicio o tras punto; no separa “Ecuación 2:” ni “Paso 1:” cuando vienen inline.
- Al dividir párrafos, una etiqueta “Paso 3:” puede quedar sola al final de una página y el contenido en la siguiente.

### Corrección A — normalizar matemáticas

Importar:

```ts
import { normalizeMathNotation } from '@/lib/editorial/text-normalization';
```

En `printParagraph()` (aprox. línea 1338):

```ts
const cleanText = sanitizePdfText(
  normalizeMathNotation(stripMarkdown(stripWorkbookTags(text || '')))
);
```

Aplicar el mismo `normalizeMathNotation` a:

- enunciados de práctica;
- pistas;
- pasos de ejemplo;
- conclusiones;
- títulos con fórmulas.

Buscar en el archivo los usos de `sanitizePdfText(stripMarkdown(` y envolverlos en un helper:

```ts
function cleanBookText(value: string | null | undefined): string {
  return sanitizePdfText(normalizeMathNotation(stripMarkdown(stripWorkbookTags(value || ''))));
}
```

Reemplazar los usos de texto visible por `cleanBookText`. No cambiar usos de `sanitizePdfText` para metadatos sin matemáticas.

### Corrección B — separar pasos inline

En `stepProtected`:

```ts
const stepProtected = cleanText
  .replace(/(?<!\n)\s+(Paso\s+\d+\s*[:\-])/gi, '\n\n$1')
  .replace(/(?<!\n)\s+(Ecuaci[oó]n\s+\d+\s*:)/gi, '\n\n$1')
  .replace(/(?:^|\n|\.\s+)(Paso\s+\d+\s*[:\-])/gi, '\n\n$1')
  .replace(/(?:^|\n)(\d+[\.\)]\s+)/g, '\n\n$1')
  .replace(/(?:^|\n)([•\-\*]\s+)/g, '\n\n$1');
```

Esto convierte:

```text
2y = 19 Ecuación 2: x - y = 2 Paso 1: Despejamos...
```

en párrafos separados.

### Corrección C — evitar “Paso N:” huérfano

Al construir `rawParagraphs`, unir una etiqueta suelta con el siguiente párrafo:

```ts
const rawParagraphs = stepProtected
  .split(/\r?\n\r?\n/)
  .map((p) => p.trim())
  .filter(Boolean);

const mergedParagraphs: string[] = [];
for (const paragraph of rawParagraphs) {
  if (/^Paso\s+\d+\s*:$/i.test(paragraph)) {
    mergedParagraphs.push(paragraph);
    continue;
  }
  const previous = mergedParagraphs[mergedParagraphs.length - 1];
  if (previous && /^Paso\s+\d+\s*:$/i.test(previous)) {
    mergedParagraphs[mergedParagraphs.length - 1] = `${previous} ${paragraph}`;
  } else {
    mergedParagraphs.push(paragraph);
  }
}
```

Usar `mergedParagraphs` en el bucle de dibujo.

### Corrección D — líneas huérfanas con solo “1.”

En `src/lib/pdf-extra-renderer.ts` (04 tiene 2 casos), en el render de párrafos/listas:

- detectar `^\s*\d+\.\s*$`;
- unir con el siguiente renglón;
- si no hay siguiente, descartar.

```ts
if (/^\s*\d+\.\s*$/.test(line) && nextLine) {
  line = `${line.trim()} ${nextLine.trim()}`;
}
```

Aplicar antes de `renderFormattedBlock`/`splitTextToSize`.

### Pruebas

```ts
expect(cleanBookText('x = (-b ± raiz(b² - 4ac)) / (2a)')).not.toMatch(/raiz\s*\(/i);
expect(cleanBookText('x = (-b ± raiz(b² - 4ac)) / (2a)')).toContain('√');
```

Añadir una prueba de separación:

```ts
const glued = '2y = 19 Ecuación 2: x - y = 2 Paso 1: Despejamos la variable y';
expect(splitBookSteps(glued)).toHaveLength(3);
```

### Criterio de aceptación

- 06: 0 `raiz(...)`.
- 06: 0 `glued_paso_inline`.
- 06: 0 `orphan_paso_number`.
- 06/04: 0 `orphan_numbered_lines`.
- 06: 0 `raw_markdown_table`.

---

## 9. Nombre del ZIP (ya aplicado; verificar)

### Archivo

`src/components/planeacion/PlanningDownloadsHub.tsx`

### Estado

Ya se agregó la propiedad `zipFileName` a `BulkDownloadButton` y se pasa:

```ts
zipFileName={`Paquete_${zipSubject}_PDF_PPTX.zip`}
zipFileName={`Paquete_${zipSubject}_Word_PPTX.zip`}
```

con:

```ts
const zipSubject = (planning.uacName || 'UAC')
  .split('.')[0]
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^\wáéíóúñÁÉÍÓÚÑ_-]+/g, '');
```

Si el cambio no está en la rama de Antigravity, aplicarlo. El nombre esperado es:

- `Paquete_Pensamiento_Matemático_III_PDF_PPTX.zip`
- `Paquete_Pensamiento_Matemático_III_Word_PPTX.zip`

No cambiar los nombres internos de los 9 entregables.

---

## 10. Orden de implementación recomendado

1. Pies 03/04/05/07 (ruta combinada + `mergeCompiledExtrasPdf`).
2. Tablas Markdown globales (06/08/09).
3. Actividades truncadas 08 (S3).
4. Ejemplo resuelto 08 (S19) + gate del writer.
5. Colisiones geométricas 08.
6. Presupuesto de palabras 08.
7. 09: solapamiento, fórmula/tema y R/A/B.
8. 06: `raiz`, pasos pegados/huérfanos.
9. Nombre del ZIP.
10. Pruebas + regeneración + QA strict.

No regenerar materiales hasta terminar los puntos 1–9. Si se regenera antes, el ZIP seguirá fallando y se perderá tiempo.

---

## 11. Pruebas y validaciones obligatorias

### Comandos

```powershell
npx tsc --noEmit
npm run lint
npm test
npm run audit:contamination
```

Si `npm test` es muy largo, se puede correr primero:

```powershell
npx vitest run src/__tests__/pm3-semantic-regressions.test.ts src/__tests__/editorial-remediation.test.ts src/__tests__/editorial-baseline-qa.test.ts
```

Pero antes de entregar, debe pasar la suite completa.

### Pruebas nuevas mínimas

- Ruta `/api/pdf/extra/combined`: usa `mergeCompiledExtrasPdf` y no deja pies locales.
- `stripMarkdownTables` / `cleanSacrintText`: elimina tabla Markdown.
- `distillExerciseStatement`: no termina en “señala c”.
- `isCompleteMathStep` / `isCompleteConclusion`: rechaza S19 roto.
- `addPointMarker`: coloca etiqueta de raíz sin colisión.
- `buildSacrintDeck`: slides de guía ≤ 180 palabras.
- `sixGramOverlapRatio` / `enforceInfographicOverlap`: ≤ 20 %.
- `sanitizeInfographicDiagram`: elimina highlights de una letra.
- `cleanBookText`: convierte `raiz(...)` y separa pasos inline.

### QA final

Con el ZIP nuevo descargado y descomprimido:

```powershell
npx tsx scripts/qa-sacrint-materials.ts --dir "RUTA_AL_PAQUETE_NUEVO" --json --strict > qa_final.json
```

Criterio de aceptación:

- **0 failures** en QA strict.
- 08:
  - 0 `weak_or_truncated_activity`.
  - 0 slides > 200 palabras.
  - promedio 1/2 entre 90 y 130.
  - 0 `colisiones geométricas`.
  - 0 `raw_markdown_table`.
  - S19 con ejemplo completo.
- 09:
  - 0 `raw_markdown_table`.
  - solapamiento ≤ 20 %.
  - 0 títulos duplicados.
  - 0 tarjetas R/A/B.
  - 0 fórmulas de otro tema.
- 03/04/05/07: 0 `fragmented_compiled_footer`.
- 04: 0 `orphan_numbered_lines`.
- 06: 0 `glued_paso_inline`, 0 `orphan_paso_number`, 0 `literal_sqrt_notation`, 0 `raw_markdown_table`.
- 01/02: sin fallos.

No se acepta un ZIP con “solo warnings” si los warnings son de contenido pedagógico. Los warnings de QA strict también deben revisarse.

---

## 12. Regeneración correcta de PM3

Cambiar el código no corrige mágicamente un ejemplo ya guardado en el workbook. Después de los puntos 1–9:

1. Regenerar la planeación/workbooks de Pensamiento Matemático III desde la app, no solo volver a descargar.
2. Verificar que las sesiones se regeneraron (nuevo contenido en `workbooks_json` / libro activo).
3. Descargar el paquete completo con el nombre nuevo.
4. Ejecutar la QA strict sobre el ZIP nuevo.
5. Si falla, corregir la causa raíz; no reutilizar el ZIP anterior.

Si el writer sigue generando `ejemploResuelto` incompletos después del gate, hay que reforzar el prompt/repair del writer de sesión. No se debe “maquillar” el ejemplo en la diapositiva.

---

## 13. Qué NO hacer

- No bajar el umbral de QA para que pase el paquete.
- No eliminar la detección de tablas Markdown, colisiones, `raiz`, pies fragmentados o solapamiento.
- No ocultar diapositivas problemáticas.
- No reemplazar el ejemplo roto por texto genérico vacío.
- No aceptar “Página 1 de N” en compilados.
- No aceptar 09 con 32.9 % de copia del libro.
- No generar otra asignatura hasta que PM3 tenga **0 fallos QA strict**.
- No hacer commit/push sin que el usuario lo pida.

---

## 14. Entregable que debe devolver Antigravity

Al terminar, debe entregar:

1. Lista de archivos modificados.
2. Resultado de `npx tsc --noEmit`.
3. Resultado de `npm run lint`.
4. Resultado de `npm test`.
5. Resultado de `npm run audit:contamination` si aplica.
6. Ruta del ZIP nuevo y nombre exacto.
7. Resultado de la QA strict con `failures=0`.
8. Capturas o evidencia de:
   - 03/04/05/07 con pie continuo;
   - 08 S3 y S19 corregidos;
   - 09 sin R/A/B y sin tablas;
   - 06 sin `raiz`.
9. Confirmación de que no se debilitó ninguna prueba.

---

## 15. Criterio final para autorizar otra asignatura

Solo se autoriza generar otra asignatura cuando:

- PM3 tenga **0 failures** en QA strict;
- 08 y 09 pasen sus gates específicos;
- 03/04/05/07 no tengan pies fragmentados;
- 06 no tenga tablas/raíz/pasos rotos;
- el ZIP se descargue con el nombre correcto;
- el usuario reciba el reporte y los materiales nuevos.

Hasta entonces, el estado es: **PM3 no aprobado; no iniciar otra asignatura.**
