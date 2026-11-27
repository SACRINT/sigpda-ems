# Plan de Fase 4 — Unificación Editorial (Render + Typst V2) y Control de Costos / Cuotas

- **Fecha:** 2026-11-26
- **Contexto:** Fase 3 (`PUBLISHING_ENGINE_V2`, commit `a47049e5`) y catálogo ampliado (`ecb3a42a`) cerrados y verificados (`109/109` Vitest, `0` diffs golden, `npm run build` EXIT 0, Render vivo en `https://sigpda-editorial-worker.onrender.com` con `typst 0.15.1` y 52 fuentes).
- **Decisión de infraestructura confirmada:** **NO usar Fly.io.** Producción corre sobre los 3 servicios ya existentes: **Vercel** (web/API) + **Neon** (PostgreSQL) + **Render** (worker Docker Typst `0.15.1`). No se migra de plataforma ahora; primero se unifica el motor, se aplican cuotas duras y se mide 1–2 meses con usuarios reales.

---

## 1. Desglose de PRs de Fase 4 (orden estricto)

| PR | Alcance técnico exacto | Archivos principales | Estado |
|---|---|---|---|
| **PR 4.0 · Ajustes operativos Render (esta entrega)** | Eliminar acoplamiento a Fly (`editorial:deploy` → `editorial:health` verificando Render `/health`), añadir Blueprint `render.yaml`, marcar `worker-editorial/fly.toml` como legado, limpiar duplicado `EDITORIAL_WORKER_URL` en `.env.local` y actualizar etiqueta UI `Typst 0.13` → `Typst 0.15`. | `render.yaml`, `scripts/check-editorial-worker.mjs`, `package.json`, `worker-editorial/fly.toml`, `PlanningTabDocumento.tsx` | **Ejecutado ahora** |
| **PR 4.1 · Fusión de Generadores + Caché Blob `content_hash` + Fallback Clásico (esta entrega)** | Crear `src/lib/editorial/unified-editorial-compiler.ts` + `readEditorialPdfFromStorage` (`blob-storage.ts`) + `template-version.ts`. Cablear `master-workbook-compiler.ts` (afecta `/api/pdf/libro-semestral/[id]` y `06_Libro_Semestral_*.pdf` dentro de `/api/pdf/extra/bulk`) y `/api/pdf/libro-bloque/[id]`. Con `PUBLISHING_ENGINE_V2=true`: busca PDF cacheado en `editorial_books` + Vercel Blob por `content_hash` (0 costo Render); si falta, compila en Render y cachea; si Render falla/duerme, hace **fallback automático a jsPDF** sin romper jamás la descarga. Ocultar barra morada duplicada a docentes cuando `PUBLISHING_ENGINE_V2=true` (solo visible a admin) y añadir endpoint ligero `GET /api/pdf/editorial-warmup` para precalentar Render al abrir la planeación. | `src/lib/editorial/template-version.ts`, `src/lib/editorial/blob-storage.ts`, `src/lib/editorial/unified-editorial-compiler.ts`, `src/lib/master-workbook-compiler.ts`, `src/app/api/pdf/libro-bloque/[id]/route.ts`, `src/app/api/pdf/editorial-warmup/route.ts`, `src/app/[locale]/planeacion/[id]/page.tsx`, `src/__tests__/editorial-phase4-unified.test.ts` | **Ejecutado ahora** |
| **PR 4.1.1 · Hotfix Calidad Editorial (`Paquete_CD1_PDF_2`)** | P0: rama temprana `isDigitalCultureSubject` en `visual-dispatcher.ts` (bloquea Plano Cartesiano en Cultura Digital sin quitarlo de `STEM_KEYWORDS`), guard defensivo en `editorial-v2-enricher.ts`, fix off-by-one `missionIndex` (adiós `"Misión 0"`), `<text>` vectoriales nativos en SVG para Typst y `'plano cartesiano'` en `forbiddenCrossDomainTerms`. P1: `requireSubjectAffinity` + `excludedSubjects` en `tabata_timer`/`kinovea_sport`/`biodigital`. P2: rotación de arquetipos 16:9 en `08` por bloque/misión. | `visual-dispatcher.ts`, `editorial-v2-enricher.ts`, `digital-tools-registry.ts`, `disciplinary-adapters/index.ts` | **Ejecutado ahora** |
| **PR 4.2 · Cuotas Duras, Rate Limits y Control de Concurrencia (aprobado por OpenCode con 3 ajustes)** | Crear tabla `usage_counters` (con `UPSERT` atómico y ventana anclada al periodo de facturación de Stripe en TZ `America/Mexico_City`, NO mes calendario) + `usage_idempotency_keys` + `editorial_render_locks` (con TTL) + `editorial_engine_telemetry` (`typst \| typst_cached \| jspdf_fallback \| jspdf_legacy \| ai_gemini \| docx_bulk`), más `idempotency_key` por job/request para no contar doble en reintentos (`cache-hit` nunca descuenta). Conectado a `getSubscriptionStatus()`, 7 planes reales y textos transparentes en `src/lib/stripe.ts`. Incluye integración de Parte B (16 PNGs mejorados), Parte C (8 portadas realistas V2) y Parte D (34 escenas verticales `4:5` → 102 escenas con rotación 3× en `09`). | `src/lib/db/usage-quotas.ts`, `src/lib/platform/usage-quota-guard.ts`, `src/lib/stripe.ts`, `unified-editorial-compiler.ts`, `scene-allocator.ts`, `infographic-builder.ts`, 7 rutas API + `usage-quota-guard.test.ts` | **Ejecutado ahora** |
| **PR 4.3 · Desacoplo de `workbook-shared-helpers.ts` y Sincronía Visual DOCX** | Extraer los 6 helpers + tipo `RealTocEntry` de `pdf-workbook-renderer.ts` → `src/lib/workbook-shared-helpers.ts` (re-export temporal) e inyectar paleta disciplinar y escenas arquetipo de apertura en `docx-workbook-renderer.ts` sin tocar su arquitectura golden (los 72+16 materiales PNG y 102 escenas WebP ya quedaron integrados en PR 4.2). | `src/lib/workbook-shared-helpers.ts`, `src/lib/docx-workbook-renderer.ts` | **Siguiente** |
| **PR 4.4 · Beta 2 Semanas, Retiro de `pdf-workbook-renderer.ts` y Edición Imprenta** | Tras 2 semanas de beta controlada con telemetría de costos y golden visual en 5 familias epistemológicas: migrar/retirar tests acoplados a coordenadas jsPDF, retirar `pdf-workbook-renderer.ts` (4,084 LOC) y activar modo `printEdition` (`bleed: 3mm`, marcas de corte, lomo/CCT). | `src/lib/pdf-workbook-renderer.ts`, `templates/editorial/workbook-template.typ`, tests legacy | **Pendiente** |

---

## 2. Diseño de Cuotas, Rate Limits y Control de Costos (para PR 4.2)

### Diagnóstico del riesgo actual en el código
Actualmente `src/lib/subscription-gate.ts` controla cuántas **materias (UACs)** puede registrar un docente, pero `src/lib/stripe.ts` ofrece `"Revisiones y ajustes ilimitados"` **sin cuota dura** en:
1. Regeneraciones de libros de bloque con IA (principal fuente de gasto de tokens Gemini y tiempo de cómputo).
2. Exportaciones repetidas de PDF/ZIP (principal fuente de CPU en Vercel, tráfico en Neon y wakeups en Render).
3. Concurrencia simultánea (un docente puede abrir 4 pestañas y lanzar 4 ZIPs/libros al mismo tiempo).

### Matriz de Cuotas Duras por Plan Real (mapeada a `src/lib/stripe.ts` + `src/lib/subscription-plans.ts`)

| Recurso / Límite | `bienvenida` (Cortesía · \$0) | `basico` (\$99 MXN/mes · 1 UAC) | `estandar` (\$249 MXN/mes · 3 UACs) | `avanzado` (\$399 MXN/mes · 5 UACs) | `completo` (\$699 MXN/mes · 10 UACs) | `director_pro` / `escuela_completa` (por docente) | `administrador` |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Materias (UACs) activas** | 1 | 1 | 3 | 5 | 10 | Según licencia | Ilimitado |
| **Planeaciones nuevas / mes** | 1 total | 2 | 6 | 10 | 20 | 10 / docente | Ilimitado |
| **Generaciones de Libro de Bloque IA / mes** *(3 bloques = 1 UAC)* | 1 bloque (preview) | 4 *(3 + 1 regen)* | 12 *(9 + 3 regen)* | 20 *(15 + 5 regen)* | 40 *(30 + 10 regen)* | 15 / docente | Ilimitado |
| **Regeneraciones de Secuencia / Extras IA / mes** | 2 | 10 | 25 | 40 | 80 | 30 / docente | Ilimitado |
| **Compilaciones PDF nuevas (cache-miss) / mes** *(cache-hit = \$0, no descuenta)* | 3 | 15 | 40 | 70 | 120 | 50 / docente | Ilimitado |
| **Descargas ZIP masivo (`Paquete Completo`) / día** | **Bloqueado** *(solo individuales)* | 2 / día | 5 / día | 8 / día | 15 / día | 6 / día | Ilimitado |
| **Rate limit IA (por hora)** | 3 / h | 10 / h | 15 / h | 20 / h | 30 / h | 15 / h | 120 / h |
| **Rate limit PDF / ZIP (por hora)** | 3 / h | 8 / h | 12 / h | 15 / h | 25 / h | 12 / h | 120 / h |
| **Concurrencia pesada simultánea (por docente)** | 1 job | 1 job | 1 job | 2 jobs | 2 jobs | 2 jobs | 4 jobs |

> **Regla de oro anti-fricción:** Las descargas repetidas de un PDF cuyo `content_hash` **ya está en caché en Vercel Blob** tienen costo casi cero y **NO descuentan cuota de compilación** (solo aplican rate-limit anti-scraping suave de 30/h). Así el docente puede bajar su libro las veces que quiera sin quemar recursos de Render ni de Vercel.

### Dónde se aplica cada guardia en PR 4.2 (rutas exactas)

| Punto de aplicación | Guardia | Código HTTP si excede | Persistencia |
|---|---|---|---|
| `POST /api/planeaciones/generar` (y orquestador V2) | `assertQuota(teacherId, 'ai_planning')` + `canCreatePlanningForSubject` | `403` (cuota plan) / `429` (hora) | Neon `usage_counters` (ventana mensual `YYYY-MM` + horaria `YYYY-MM-DDTHH`) |
| `POST /api/planeaciones/[id]/libro-bloque` / regenerar bloque | `assertQuota(teacherId, 'ai_workbook_block')` + lock concurrencia | `403` / `429` / `409` (job activo) | Neon `usage_counters` + `generation_jobs` |
| `POST /api/planeaciones/[id]/secuencia` y extras IA | `assertQuota(teacherId, 'ai_sequence_extra')` | `403` / `429` | Neon `usage_counters` |
| `GET /api/pdf/libro-semestral/[id]`, `GET /api/pdf/libro-bloque/[id]`, `POST /api/pdf/libro-editorial/[id]` | Cache-hit libre; en cache-miss `assertQuota(teacherId, 'pdf_compile')` + lock concurrencia | `403` / `429` / `409` | Neon `usage_counters` + `editorial_books` |
| `GET/POST /api/pdf/extra/bulk` y `/api/docx/extra/bulk` | `assertQuota(teacherId, 'bulk_zip_daily')` + lock concurrencia | `403` (plan bienvenida) / `429` (diario) | Neon `usage_counters` (ventana diaria `YYYY-MM-DD`) |

### Checklist operativo obligatorio antes de abrir al público (sin código)
1. **Vercel (Dashboard → Environment Variables):**
   - `PUBLISHING_ENGINE_V2=true`
   - `EDITORIAL_WORKER_URL=https://sigpda-editorial-worker.onrender.com`
   - `EDITORIAL_WORKER_SECRET=<mismo secreto que en Render>`
   - **Spend Management:** configurar tope duro mensual en Vercel Pro/Hobby.
2. **Neon (Console → Project Settings):**
   - Mantener *Scale to Zero / Auto-suspend* activo (5 min de inactividad) y límite máximo de CU (*autoscaling cap*) para evitar facturas sorpresa.
3. **Render (Dashboard → `sigpda-editorial-worker`):**
   - Para pruebas personales/beta cerrada: **Free tier** funciona bien con el precalentamiento (`/api/pdf/editorial-warmup`) y fallback clásico.
   - Al abrir al público de pago: evaluar **Starter (\$7 USD/mes)** para eliminar los 50 s de cold-start (se paga solo con 2 suscripciones Básicas de \$99 MXN).
4. **Regla de textos en `src/lib/stripe.ts`:** al activar PR 4.2, reemplazar la leyenda `"Revisiones y ajustes ilimitados"` por el número claro de regeneraciones incluidas por plan (transparencia legal y comercial).
