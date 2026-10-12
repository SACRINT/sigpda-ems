# INSTRUCCIONES PARA ANTIGRAVITY — Motor Editorial, Fase 1 (Spike Typst)

> **Agente receptor**: Antigravity AI Agent (SACRINT)
> **Remitente**: OpenCode (auditoría Gate 0) + Usuario SIGPDA-EMS
> **Fecha**: 2026-10-12
> **Documento maestro obligatorio**: [`docs/architecture/EDITORIAL_PUBLISHER_ENGINE_DISENO.md`](architecture/EDITORIAL_PUBLISHER_ENGINE_DISENO.md) — léelo completo antes de escribir una sola línea de código. El Gate 0 está **aprobado con salvedad crítica** (§9); la salvedad condiciona esta tarea.

---

## 0. Disciplina de carril (OBLIGATORIO — lee esto primero)

Estamos trabajando **en paralelo**. OpenCode está reparando los renderers actuales (`docx-workbook-renderer.ts`, `pdf-workbook-renderer.ts`) y reescribiendo el contenido a voz de estudiante. **NO toques esos archivos.** Para no chocar:

- **Trabaja en una rama separada**: crea y trabaja SOLO en `feature/libro-santillana`. No hagas `merge` a `main` sin aviso del usuario.
- **NO modifiques** (son de OpenCode): `src/lib/docx-workbook-renderer.ts`, `src/lib/pdf-workbook-renderer.ts`, `src/lib/visual-engine/pdf-components-core.ts`, `src/lib/guide-engine/writers/*.ts`, `src/types/work-textbook.ts`.
- **NO modifiques** la ruta legacy `/api/pdf/libro-semestral/[id]` ni `/api/pdf/libro-bloque/[id]`.
- Puedes **leer** cualquier archivo para entender contratos, pero crearás archivos nuevos bajo `src/lib/editorial/`, `templates/editorial/` y `src/__tests__/editorial-*.test.ts`.
- Sigue `AGENTS.md`: modelos autorizados, toda IA vía `generateWithRotation` de `src/lib/ai-provider`, cero claves nuevas, feature flag `EDITORIAL_PUBLISHER_ENGINE` en `false`.

---

## 1. Objetivo de la Fase 1

**Spike del motor de composición Typst, SIN IA**, que compile un **libro de texto completo para ESTUDIANTE** (no guía del docente) a partir de un JSON fixture, con calidad de maqueta editorial (retícula asimétrica a 2 columnas, encabezados corrientes, cajas pedagógicas, portada institucional), de forma **determinista** y en **< 2 segundos**.

**Salvedad crítica que condiciona esta fase (del §9 del diseño):** el fixture NO debe ser un `ActiveWorkTextbook` con contenido de docente. Define y usa un **modelo de contenido de estudiante** (ver §3). Si el JSON de entrada trae texto con etiquetas "Docente:"/"Estudiante:" o verbos de instrucción ("activar el interés", "verificar comprensión"), ese contenido es **inválido para esta fase**.

---

## 2. Archivos a intervenir (crea los que no existan)

| Archivo | Propósito |
| :--- | :--- |
| `src/lib/editorial/typst-compiler.ts` | Wrapper `execFile` del binario Typst. Fijar `SOURCE_DATE_EPOCH=0` para determinismo. |
| `templates/editorial/workbook-template.typ` | Plantilla escolar estilo Santillana/Pearson (retícula 2 columnas asimétricas, running heads con UAC+bloque, cajas didácticas, portada institucional). |
| `src/lib/editorial/student-content-model.ts` (nuevo) | Tipos/validación del **modelo de contenido de estudiante** (ver §3). |
| `src/__tests__/editorial-typst-spike.test.ts` | Test falsable de la Fase 1. |

Puedes añadir un fixture JSON real bajo `src/__tests__/fixtures/editorial/`.

---

## 3. Modelo de contenido de ESTUDIANTE (salvedad crítica — define esto primero)

Cada sesión del libro debe ser **autodidacta**: un estudiante aprende leyéndola sin el maestro. **Prohibido** el texto con voz de docente. Esquema mínimo por sesión (voz en "tú"):

```
Sesion {
  numero: number
  titulo: string                 // "Sesión 10: Modelado Matemático y Cálculo de Dimensiones"
  objetivo: string               // "Lo que vas a aprender:" (1-2 frases)
  motivacion: string             // Caso real / historia detonadora contada AL estudiante
  saberesPrevios: string         // Qué ya sabes que conecta con esto
  contenido: ContenidoBloque[]   // TEORÍA REAL: definiciones, fórmulas, explicación
  ejemploResuelto: { enunciado: string, pasos: string[] }  // Con NÚMEROS, paso a paso
  practica: { enunciado: string, pista: string }[]         // Ejercicios con datos + PISTA (sin solución completa)
  aplicacion: string             // Tarea a la vida real del estudiante
  autoevaluacion: string[]       // Checklist / preguntas de autorevisión
  recursos: { titulo: string, url: string, tipo: 'video'|'web'|'lectura' }[]  // Enlaces de ampliación
}
ContenidoBloque { tipo: 'parrafo'|'formula'|'definicion'|'tabla', texto: string }
```

> **Nota**: este modelo es el mismo que OpenCode está implementando en los writers de IA (`foundation-writer.ts` / `lab-writer.ts`). Mantén los nombres de campo alineados para que en el futuro la Fase 3/5 consuma el contenido ya convertido a estudiante. Coordina con el usuario si necesitas renombrar campos.

---

## 4. Alcance técnico de la Fase 1

- Compilar un **capítulo completo** (≥ 30 páginas) desde el JSON fixture del modelo de estudiante, **sin llamadas a IA**.
- Retícula **asimétrica a 2 columnas** (columna principal de contenido + columna marginal de notas/recursos), encabezados corrientes dinámicos con UAC y bloque, cajas estilizadas para motivación/práctica/autoevaluación, portada escolar institucional.
- Los 244 PNGs de materiales (512×512 px) SOLO como figuras spot/columna marginal ≤ 4.2 cm de ancho (≥ 300 DPI); **prohibido** escalarlos a página completa.
- **Determinismo estricto**: dos ejecuciones con el mismo fixture producen un PDF con **hash idéntico** (fijar `SOURCE_DATE_EPOCH=0`; verificar también orden de incrustación de fuentes/imágenes).
- **Rendimiento**: ≥ 30 páginas en **< 2 s**, < 50 MB RAM.
- **Valida YA el binario Typst en el entorno** (salvedad menor §9.2): documenta cómo se obtiene/ejecuta el binario y si requiere worker en contenedor (Fly/Render) en lugar de Vercel Serverless.

---

## 5. Verificación (gate de la fase)

```bash
npx vitest run src/__tests__/editorial-typst-spike.test.ts
```

**Mutación Load-Bearing anti-F11 (MUT-EDIT-1)**: elimina una sesión del fixture o altera la numeración. El test DEBE fallar al comprobar que el número de páginas/secciones renderizadas no coincide con la cuenta matemática del fixture.

**Extra de contenido (salvedad crítica)**: el test debe **fallar** si el fixture contiene strings con las marcas de docente (`/Docente:/`, `/Estudiante:/`, "activar el interés", "verificar comprensión", "orientar el avance"), garantizando que nunca se imprime una guía de docente como si fuera libro de estudiante.

---

## 6. Fuera de alcance en la Fase 1 (no hagas esto todavía)

- Llamadas a IA (pulido, sidenotes) → Fase 3.
- Cola asíncrona, subscription gate, tabla `editorial_books`, Vercel Blob → Fase 2.
- CMYK/bleed/lomo/portada desplegada → Fase 4.
- Integración UI y upsell → Fase 5.
- Exportación editorial en DOCX → fuera de alcance del Motor Editorial (sigue el renderer actual de OpenCode).

---

## 7. Al entregar la Fase 1

Reporta al usuario: (1) resultado del test, (2) hash de determinismo verificado, (3) tiempo de compilación medido, (4) cómo se resolvió el binario Typst y si implica worker en contenedor, (5) el fixture de estudiante usado. **No hagas merge a `main` sin autorización del usuario.**
