<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reglas de IA y Modelos (SIGPDA-EMS)

## Modelos autorizados
- **Modelo estándar y premium por defecto**: `gemini-3.5-flash-lite` (proveedor `gemini`). Definidos en `src/lib/ai-provider/index.ts` (`DEFAULT_STANDARD_MODEL`, `DEFAULT_PREMIUM_MODEL`).
- Los scripts offline (ej. `scripts/seed-*.js`, `scripts/ingest-normateca.js`) usan exclusivamente Gemini (vía `GEMINI_API_KEY` de `.env.local` o la tabla `api_keys` con `provider='gemini'`).
- **NO agregar** nuevos proveedores, claves externas ni modelos hardcodeados sin aprobación del usuario. La cadena de fallback multi-proveedor de `src/lib/ai-provider/` existe solo como respaldo operativo; no se amplía por iniciativa propia.

## Reglas de orquestación
- Todo llamado de IA en la app debe pasar por `src/lib/ai-provider` (`generateWithRotation` / `generateStreamWithRotation`), nunca llamar SDKs externos directamente desde rutas API o componentes.
- Los scripts offline que llamen IA deben reutilizar las claves del proyecto (env o tabla `api_keys`), nunca introducir claves nuevas ni pedirlas al usuario.

## Normateca SEP (tablas `normativa_documentos` / `normativa_articulos`)
- `scripts/ingest-normateca.js` procesa SOLO las carpetas de `documentos_referencia\[08] Normateca` listadas en `ALLOWED_FOLDERS`.
- Reglas de extracción obligatorias (verificables en el prompt del script):
  1. El texto de cada artículo es transcripción **LITERAL** del documento, nunca resumen ni parafraseo.
  2. Los documentos sin relevancia educativa (fiscal, hacendaria, administrativa no escolar, etc.) se marcan `aplica: false` y NO se insertan.
  3. `aplicable_a` se clasifica por artículo entre `['pmc','paec','pips','planeacion']`; no se asigna a todos por defecto.
- Los documentos irrelevantes o duplicados se **desactivan** con `vigente=false` (nunca se borran); `getNormativaForGenerator` (`src/lib/normativa-context.ts`) solo inyecta artículos de documentos `vigente=true`.
- **Alcance de inyección (decisión del usuario, 2026-08-08)**: la normativa se inyecta ÚNICAMENTE en **PMC** (`/api/pmc/[id]/generate-step/route.ts`) y **PIPS** (`/api/pips/[id]/generate/route.ts`). PAEC-PEC y Planeaciones NO inyectan normativa (los documentos reales de la Zona 004 no citan leyes; el formato DBEPA de planeación no la incluye). Los artículos clasificados como `paec`/`planeacion` permanecen en la BD para uso futuro.

## Arquitectura de Generación de Extras Didácticos (PDF / DOCX)
- **Motor Canónico y Orquestador Visual**: `src/lib/pdf-extra-renderer.ts` es el SSoT que implementa el maquetado visual, ribbons de momentos didácticos, cajas pedagógicas, `renderFormattedBlock` con word-wrap para negritas inline y exporta `renderExtraDocument(doc, extra, context)` y `generateExtraPdfDocument(extra, context)`. Garantiza la inicialización automática de fuentes editoriales oficiales (`areEditorialFontsLoaded`).
- **Fachada Pública**: `src/lib/pdf-extra-generator.ts` exporta `generateExtraPDF(extra, context)` para mantener total compatibilidad con las llamadas de consumo único individual (`/api/pdf/extra/[extraId]`).
- **Descargas Masivas (Bulk)**: Las rutas masivas (`/api/pdf/extra/bulk`) y pipelines de exportación empaquetada utilizan `generateExtraPdfDocument` para generar buffers optimizados empaquetados en archivos ZIP sin redundancias.
- **DOCX SSoT**: Los generadores Word de extras, secuencias y planeaciones delegan en `src/lib/docx-helpers.ts` (`buildExtraDocx`, `tbl`, `tc`, `tcH`, `bdr`, `parseTextRuns`, `createParagraphFromLine`) para consistencia normativa de estilos institucionales DBEPA Puebla.
