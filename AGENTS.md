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

## PMC Wizard — Ingesta Documental y Momentos Estadística 911 (Decisión N-001)
- **Momentos de Estadística Escolar 911**: El wizard PMC soporta formalmente los 3 cortes oficiales en `/api/pmc/estadistica-911`:
  1. `fin_anterior` (911 fin de ciclo previo): Alimenta indicadores de cierre (abandono escolar, eficiencia terminal, reprobación y aprobación).
  2. `inicio_actual` (911 inicio ciclo vigente): Alimenta matrícula vigente activa y total de docentes.
  3. `inicio_anterior` (911 inicio ciclo previo): Alimenta matrícula inicial de referencia histórica para trazabilidad.
- **Acceso en UI (Decisión N-001)**: El momento `inicio_anterior` cuenta con botones dedicados de carga en Paso 1 (Datos del Plantel) y Paso 3 (Diagnóstico Institucional) para planteles que disponen de dicho corte histórico, integrándose armónicamente con los flujos de `fin_anterior` e `inicio_actual`.
- **Badges de Estado (`docsStatus`)**: Los botones de subida (F11, 911 y PMC anterior) proporcionan retroalimentación visual (`✓`) al completarse la ingesta, previniendo cargas redundantes en la sesión del wizard.

## Plataforma Nivel 2 — Feature Flags y Patrón Strangler Fig
- **Servicio Canónico**: `src/lib/platform/feature-flags.ts` provee `FeatureFlagService` y los helpers `isFeatureEnabled`, `setFeatureFlag`, `resetFeatureFlags`.
- **Restricción Server-Side Only**: Las feature flags operan exclusivamente en Node.js runtime / server-side (`process.env`). NO utilizan el prefijo `NEXT_PUBLIC_` para evitar exponer banderas de infraestructura o lógica interna al bundle cliente del navegador.
- **Valores Predeterminados Seguros**: Todas las banderas de subsistemas y orquestadores (`PMC_ORCHESTRATOR_V2`, `PLANEACION_ORCHESTRATOR_V2`, `PAEC_ORCHESTRATOR_V2`, `CARTOGRAFIA_ORCHESTRATOR_V2`, `HORARIOS_ORCHESTRATOR_V2`) tienen valor predeterminado `false`.
- **Patrón Strangler Fig**: La migración hacia los Orquestadores Centrales Nivel 1 se realiza ruta por ruta. Cuando la bandera está en `false`, la ruta ejecuta el flujo legacy probado e intacto. Cuando la bandera está en `true`, la ruta delega en el orquestador correspondiente sin alterar los contratos JSON ni los códigos de respuesta HTTP (`200`, `400`, `404`, `422`).
- **Política de Cero Stubs Silenciosos (B-001)**: Los orquestadores N1 (`PmcOrchestrator`, `PlaneacionOrchestrator`) tienen estrictamente prohibido simular éxito con buffers vacíos (`Buffer.from('')`) o retornos ficticios en métodos no migrados. Cualquier método en desarrollo lanza `501 NOT_IMPLEMENTED` de forma ruidosa.
- **Sondeo Honesto de Salud (B-002 / C-001)**: Las implementaciones de `healthCheck()` verifican el estado real de la infraestructura (configuración de base de datos `databaseConfigured`, credenciales de IA `aiServiceConfigured` y servicio de banderas `featureFlagService`). Si falta alguna configuración crítica, el subsistema reporta `status: 'degraded'` con detalle booleano por verificación, eliminando sondeos tautológicos.
- **Resiliencia de Ingesta y Proveedores de IA (Incidente 503 / 504)**:
  - **Fallback Dinámico**: `DEFAULT_MODEL_BY_PROVIDER.openrouter` utiliza el enrutador inteligente `openrouter/free` (configurable vía `OPENROUTER_FALLBACK_MODEL`), garantizando conmutación inmediata a modelos disponibles.
  - **Fast-fail en Caídas Globales (503)**: El rotador de claves (`key-rotator.ts`) detecta errores 503 de alta demanda upstream; tras 2 claves consecutivas detiene la rotación del pool primario y delega en el proveedor alternativo, protegiendo las cuotas y reduciendo drásticamente la latencia.
  - **Mapeo de Códigos HTTP**: Las indisponibilidades de IA se responden con `HTTP 503` y mensaje empático para el usuario, evitando acusar falsamente al archivo (`HTTP 400`) o emitir errores internos (`HTTP 500`).
  - **Presupuesto de Tiempo Activo en Rutas y Orquestador**: Se aplica un límite preventivo (`withTimeoutBudget`, 90s) cableado activamente tanto en `PmcOrchestrator.ingestDocument` como en las ramas legacy de las 3 rutas PMC (`/api/pmc/f11`, `/api/pmc/estadistica-911`, `/api/pmc/parse-previous`) para interceptar caídas o ralentizaciones de OCR/IA antes del corte forzado de 120s de Vercel (evitando 504 sucios). Además, los clientes web (`parseSafeApiResponse`) validan `content-type` antes de `res.json()`, eliminando excepciones sintácticas como `Unexpected token 'A'`.
- **Orquestador de Planeaciones (Fase C Piloto)**: `src/lib/planeaciones/orchestrator.ts` implementa `IProgramSystem` (`planeaciones`, `2.0.0`) orquestando la evaluación bajo el Anexo 12 USICAMM / Guía Laboral MCCEMS vía la bandera `PLANEACION_ORCHESTRATOR_V2`. La ruta piloto migrada es `/api/planeaciones/evaluar`. Los componentes de Reto Situado (`planning-evaluator.ts` 4/4) y renderizado PDF (`planning-pdf-renderer.ts`, `pdf-workbook-renderer.ts`) se mantienen desacoplados e intactos.

