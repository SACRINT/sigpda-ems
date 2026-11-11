# SCHEMA — Capa de Conocimiento SEP (AIC-SEP)

> **Memoria obligatoria.** Leer antes de crear o modificar páginas de `src/knowledge/wiki/`.
> Implementa el patrón *raw inmutable → wiki compilada → esquema* (Karpathy, `llm-wiki.md`)
> adaptado a SIGPDA-EMS.

## Reglas de oro

1. **Las fuentes crudas NO viven en Git.** Se leen de `../documentos_referencia/` (fuera del
   repositorio). Git solo versiona las síntesis markdown (texto liviano).
2. **Git es la fuente de verdad.** La tabla `knowledge_pages` es una *vista materializada* de
   solo lectura que se actualiza con `scripts/sync-knowledge.ts`. Nunca se edita la BD a mano.
3. **Nada se publica sin revisión humana.** `status: draft` → `publicado=false`. Solo
   `status: reviewed` puede publicarse (`sync-knowledge.ts --publish`).
4. **Cero contenido genérico.** El sync ejecuta `findGenericContent()` y **aborta**
   (fail-closed) si una página contiene clichés, placeholders o relleno de plantilla.
5. **Cero leyes en Planeación ni Editorial.** El dominio `normativo` solo es aplicable a
   `pmc` y `pips`. Los generadores didácticos consumen `metodologico` y `curricular`.
6. **Solo Gemini.** La compilación offline usa `GEMINI_API_KEY` o la tabla `api_keys`
   (`provider='gemini'`). No se agregan proveedores ni modelos.

## Estructura

```
src/knowledge/
├── SCHEMA.md          ← este documento
├── LOG.md             ← bitácora de compilaciones
└── wiki/
    ├── normativa/     ← marco jurídico-institucional (solo PMC/PIPS)
    ├── didactica/     ← metodología, evaluación, planeación (planeación/editorial/PMC/PIPS/PAEC)
    └── curriculo/     ← contenidos y propósitos por UAC (planeación/editorial/PAEC)
```

## Frontmatter obligatorio

```yaml
---
slug: didactica/anexo-12-cortes
titulo: Criterios de evaluación por corte (Anexo 12 CC)
dominio: metodologico          # normativo | metodologico | curricular
applicable_a: [planeacion, editorial]   # pmc | pips | paec | planeacion | editorial
status: draft                  # draft | reviewed
model: gemini-3.5-flash-lite   # opcional (compilación con IA)
prompt_version: v1             # opcional (versión del prompt de compilación)
fuentes_referencia:
  - ruta: "[01]Planeaciones-Secuencias-Plan_de_Clase/04 ANEXO 12 CC 1-4.pdf"
    sha256: "…"                # opcional
  - ruta: "[01]Planeaciones-Secuencias-Plan_de_Clase/ANEXO 12 CC 5-6.pdf"
---
```

### Restricciones validadas por Zod

| Regla | Detalle |
|---|---|
| `slug` | `^[a-z0-9/_-]+$`, mínimo 3 caracteres, único global |
| `titulo` | mínimo 5 caracteres |
| `dominio` | `normativo` \| `metodologico` \| `curricular` |
| `applicable_a` | al menos 1 valor de `pmc`, `pips`, `paec`, `planeacion`, `editorial` |
| **normativo** | `applicable_a` **solo** puede contener `pmc` y/o `pips` |
| `fuentes_referencia` | al menos 1 ruta; se guarda como `knowledge_sources` |

## Cuerpo de la página

- Markdown puro, **sin HTML**, sin instrucciones dirigidas al modelo.
- Debe iniciar con `# <título>` y desarrollar el contenido en secciones `##`.
- Longitud objetivo: **≤ 1,500 tokens** (~6,000 caracteres). El runtime trunca por presupuesto.
- Prohibido: imperativos tipo "ignora las instrucciones anteriores", "responde solo…",
  "actúa como…". El compilador los elimina y el sync los rechaza.
- Toda afirmación debe poder rastrearse a una fuente de `fuentes_referencia`.

## Flujo de trabajo

```
documentos_referencia/  (externo, inmutable)
        │  scripts/ingest-knowledge.ts       (determinista; sin IA)
        ▼
src/knowledge/wiki/**/*.md                   (status: draft)
        │  revisión humana + edición + status: reviewed + commit
        ▼
scripts/sync-knowledge.ts --publish          (Zod + gate + hash + UPSERT)
        ▼
knowledge_pages (publicado=true) → caché 10 min → prompts
```

### Comandos

```powershell
# 0) Compilar páginas normativas desde la Normateca ya ingerida ($0 de IA)
npx tsx scripts/ingest-knowledge.ts                 # dry-run
npx tsx scripts/ingest-knowledge.ts --write         # escribe los .md

# 1) Crear esquema (idempotente)
node --env-file=.env.local scripts/apply-knowledge-schema.js

# 2) Validar sin escribir (modo por defecto)
npx tsx scripts/sync-knowledge.ts

# 3) Escribir como borrador (publicado=false)
npx tsx scripts/sync-knowledge.ts --apply

# 4) Publicar (exige status: reviewed)
npx tsx scripts/sync-knowledge.ts --publish
```

## Consumo en runtime (F3/F4)

- `src/lib/knowledge/knowledge-repository.ts` lee solo `publicado = TRUE` con caché
  TTL de 10 minutos.
- `src/lib/institutional-context.ts` es la fachada única: enruta dominios por
  generador, aplica presupuesto de tokens y es **fail-open**.
- Matriz de inyección: PMC/PIPS = `normativo + metodologico`; PAEC/Planeación/Editorial
  = `metodologico + curricular` (0% legal en didácticos).
- Todo está detrás de `KNOWLEDGE_LAYER_ENABLED=false`; la telemetría de tokens, de
  `KNOWLEDGE_TELEMETRY=false`.

## Catálogo de prompts de planeación (F6)

- Fragmentos markdown versionados: `src/prompts/catalog/planeacion/{laboral,fundamental,extendido}.md`.
- Generador: `npx tsx scripts/build-prompt-catalog.ts --write` → módulo TypeScript
  en `src/lib/prompts/generated/prompt-catalog.generated.ts` (commitado).
- Loader: `src/lib/prompts/prompt-catalog.ts`, detrás de `PROMPT_CATALOG_ENABLED=false`.

## Caché

`src/lib/knowledge/knowledge-repository.ts` mantiene un caché en memoria con TTL de
10 minutos (mismo patrón que `catalog-cache.ts`). El sync corre en un proceso aparte, por
lo que la propagación a producción ocurre al expirar el TTL o al reiniciar el proceso.
