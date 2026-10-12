# PLAN DE DISEÑO Y ARQUITECTURA: MOTOR EDITORIAL DE ALTA GAMA (GATE 0)
## Pipeline de Publicación Comercial Impresa Tipo Pearson / Santillana / McGraw-Hill

> **Documento Oficial de Arquitectura — Gate 0**  
> **Sistema**: SIGPDA-EMS DBEPA Puebla (Ciclo Escolar 2026–2027)  
> **Módulo**: Motor Editorial N1 (Editorial Publisher Engine)  
> **Bandera de Control**: `EDITORIAL_PUBLISHER_ENGINE` (Default `false` en [`src/lib/platform/feature-flags.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/platform/feature-flags.ts))  
> **Estado**: Propuesta de Diseño para Aprobación (Consenso Técnico con Auditoría OpenCode)  
> **Auditoría Receptora**: OpenCode QA / Usuario / SACRINT Systems IA  

---

## 1. Visión Ejecutiva y Justificación de Producto

La plataforma SIGPDA-EMS cuenta actualmente con generación curricular de alta fidelidad: progreso pedagógico sesión por sesión ([`src/lib/session-progression-engine.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/session-progression-engine.ts)), compilador maestro semestral a costo cero de tokens ([`src/lib/master-workbook-compiler.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/master-workbook-compiler.ts)) y un inventario de 244 materiales didácticos visuales con iconografía vectorial offline.

Sin embargo, los motores actuales de renderizado (`jsPDF` en [`src/lib/pdf-workbook-renderer.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/pdf-workbook-renderer.ts)) están orientados a documentos digitales ofimáticos: operan exclusivamente en espacio de color RGB, carecen de retícula tipográfica balanceada de doble columna, no aplican sangrado perimetral (bleed) ni calculan el lomo de encuadernación para prensas comerciales.

El **Motor Editorial de Alta Gama (Editorial Publisher Engine)** transformará a SIGPDA-EMS en una **plataforma de publicación editorial comercial automatizada**, permitiendo emitir libros de texto escolares con la misma calidad visual, tipográfica y cromática de sellos internacionales (Santillana, Pearson, McGraw-Hill, CECyTE), resolviendo la producción física a un costo marginal de segundos.

---

## 2. Estrategia de Producto: Arquitectura Dual (Freemium vs. Premium)

Se adopta un **modelo de entrega en 2 capas** que maximiza la adopción sin fricción y crea una palanca de monetización directa para el tier Premium/Institucional:

```
                                  PETICIÓN DEL USUARIO EN UI
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │                                               │
             [PLAN GRATUITO / BASE]                         [PLAN PREMIUM / INSTITUCIONAL]
                       │                                               │
                       ▼                                               ▼
              Edición Digital Estándar                        Edición Editorial Imprenta
              (master-workbook-compiler)                      (Editorial Publisher Engine)
              - Espacio de color RGB                          - Espacio CMYK nativo (FOGRA39)
              - Render rápido (< 3 seg)                       - Retícula asimétrica a 2 columnas
              - Archivo liviano (~8 MB)                       - Sangrado a 3 mm + marcas de corte
              - Descarga directa en pantalla                  - Cálculo dinámico de lomo y portada
              - Formato PDF/DOCX ofimático                    - Procesamiento desacoplado en cola
```

* **Capa Base (Docente en aula)**: Mantiene el compilador existente intacto. El profesor descarga su libro en segundos para consulta en pantalla o impresión económica escolar.
* **Capa Premium (Colegios / Directores / Publicación Formal)**: Desbloquea la exportación comercial para prensas offset o imprenta digital bajo demanda, ahorrando los $35,000–$60,000 MXN que cobraría una agencia de diseño editorial por maqueta en Adobe InDesign.

---

## 3. Auditoría Exhaustiva de Repositorios y Licencias (Open Source Audit)

Para evitar dependencias espurias o infracciones de propiedad intelectual, se auditaron rigurosamente las fuentes públicas del ecosistema:

| Repositorio / Proyecto | Licencia Verificada | Estado de Disponibilidad | Veredicto de Uso en SIGPDA-EMS |
| :--- | :--- | :--- | :--- |
| **[`typst/typst`](https://github.com/typst/typst)** | **Apache-2.0** | Activo (v0.15+, 2026) | **MOTOR PRINCIPAL SELECCIONADO**. Permite uso comercial sin copyleft. PDF/A nativo, PDF/UA-1, CMYK en sintaxis, compilación a ~1s por 150 páginas. |
| **[`electricbookworks/paged-design`](https://github.com/electricbookworks/paged-design)** | **CC0 (Dominio Público)** | Activo en GitHub | **REFERENCIA DE DISEÑO LIBRE**. Sus plantillas (Beatrix, Apollo, Demeter) se usarán como especificación de retículas y cajas didácticas. |
| **[`pagedjs/pagedjs`](https://github.com/pagedjs/pagedjs)** | **MIT** | Activo en npm | **PLAN B DE RESPALDO**. Registrado como alternativa de contingencia; no se implementa en paralelo para evitar doble mantenimiento. |
| **[`electricbookworks/electric-book`](https://github.com/electricbookworks/electric-book)** | **GPL-3.0** | Activo en GitHub | **SOLO ESTUDIO ARQUITECTÓNICO**. Prohibido copiar código fuente por restricción de copyleft comercial. |
| **[`openstax/cookbook`](https://github.com/openstax/cookbook)** | **MIT** | Activo en GitHub | **INSPIRACIÓN METODOLÓGICA**. Proceso de "baking" de capítulos; su contenido (`osbooks-*` CC-BY-NC-SA) no se utiliza. |
| **[`VikParuchuri/textbook_quality`](https://github.com/VikParuchuri/textbook_quality)** | **MIT** | Activo en GitHub | **REFERENCIA DE PROMPTS**. Herramienta de síntesis y densidad pedagógica, no de composición tipográfica. |
| *adamwlarson/ai-book-writer* | MIT | Activo en GitHub | Referencia de descomposición jerárquica de temas a capítulos (sustituto del citado `AutoGenBook`). |

---

## 4. Resoluciones Arquitectónicas a las 3 Preguntas de Diseño

Conforme al dictamen adversarial y consenso técnico con OpenCode:

### Q1: Selección del Motor de Composición $\rightarrow$ TYPST (Binario Nativo)
* **Decisión**: Se selecciona **Typst** ejecutado como binario estático mediante `execFile` de Node.js dentro del worker de procesamiento.
* **Justificación de Rendimiento y Memoria**:
  * Puppeteer / Chromium (Paged.js) consume más de 500 MB de RAM y requiere 20 a 60 segundos para maquetar 150 páginas, alcanzando el límite fatal de timeout de Vercel (60s en plan Hobby).
  * Typst (~30 MB de binario) compila 150 páginas en **1.2 a 1.8 segundos** consumiendo menos de 50 MB de memoria RAM.
  * Typst ofrece soporte nativo para **PDF/A**, accesibilidad **PDF/UA-1** y espacio de color **CMYK** (`color.cmyk(c, m, y, k)`).
* **Plan B**: Paged.js queda documentado como opción de contingencia sin desarrollo simultáneo.

### Q2: Modelo de Ejecución $\rightarrow$ COLA DE TRABAJOS ASÍNCRONA (`/api/jobs/process`)
* **Decisión**: La generación editorial **jamás se ejecutará en la ruta HTTP síncrona**.
* **Arquitectura de Ejecución**:
  1. La UI llama a `POST /api/pdf/libro-editorial/[id]`.
  2. La ruta valida la suscripción con `getSubscriptionStatus()` y encola un trabajo de tipo `editorial_book` en la tabla de jobs.
  3. El worker existente ([`src/lib/job-worker.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/job-worker.ts)), invocado por el endpoint asegurado [`/api/jobs/process`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/app/api/jobs/process/route.ts) con `claimNextPendingJob`, toma la tarea y ejecuta Typst.
  4. Al concluir, el PDF queda persistido y se emite notificación al docente para descarga directa.
* **Almacenamiento persistente del PDF**: Vercel Blob (`@vercel/blob` ^2.4.1, ya presente en `package.json`) — obligatorio porque el filesystem de Vercel Serverless es efímero entre invocaciones del worker y requests de descarga.

### Q3: Desacoplamiento de Datos $\rightarrow$ ARTEFACTO SEPARADO `editorial_books`
* **Decisión**: **Prohibido contaminar o extender `ActiveWorkTextbook`**.
* **Justificación de Dominio**: `ActiveWorkTextbook` es el modelo caliente de trabajo pedagógico que muta ante cada edición del docente. Los metadatos editoriales (retícula, cálculo de lomo, enriquecimiento de notas marginales) son artefactos derivados y pesados con distinta cadencia de invalidación.
* **Modelo Propuesto en Neon DB**:
  ```sql
  CREATE TABLE editorial_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
    workbook_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    pdf_storage_path TEXT, -- URL en Vercel Blob (@vercel/blob ^2.4.1)
    page_count INTEGER,
    spine_width_mm NUMERIC(5,2),
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
    job_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX idx_editorial_books_planning_hash ON editorial_books(planning_id, content_hash);
  ```
* **Almacenamiento persistente del PDF (`pdf_storage_path`)**: Vercel Blob (`@vercel/blob` ^2.4.1, ya presente en `package.json`) — obligatorio porque el filesystem de Vercel Serverless es efímero entre invocaciones del worker y requests de descarga.
* **Control de Acceso**: Se utiliza la función real y probada [`getSubscriptionStatus(teacherId, teacherEmail?)`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/subscription-gate.ts) de `src/lib/subscription-gate.ts`. Si el docente no cuenta con suscripción activa o plan con acceso editorial, la API retorna `403 Forbidden` con detalle de plan para upsell.

---

## 5. Tres Correcciones Obligatorias de Dominio Técnico

1. **Auditoría de Resolución de los 244 PNGs Existentes**:
   * Los 244 assets de materiales didácticos tienen resolución base de $512 \times 512 \text{ px}$.
   * A $300 \text{ DPI}$ de imprenta, una imagen de 512 px mide exactamente:
     $$\frac{512 \text{ px}}{300 \text{ DPI}} \times 2.54 \text{ cm/in} \approx 4.33 \text{ cm}$$
   * **Regla de Diagramación**: En la plantilla Typst, estos assets se posicionan exclusivamente como **ilustraciones spot, badges de actividad o figuras en la columna marginal** ($\le 4 \text{ cm}$ de ancho). Queda prohibido escalarlos a página completa (full-page bleed) sin antes regenerar los assets a $2400 \times 3200 \text{ px}$ para evitar pixelación en prensa.
2. **Postergación y Aislamiento de Ghostscript**:
   * Ghostscript no forma parte del runtime estándar de Vercel Serverless.
   * Por tanto, la Fase 1 y 2 utilizarán la exportación CMYK y PDF/A nativa de Typst. El procesamiento con Ghostscript se confina a la Fase 4 como un paso opcional empaquetado exclusivamente si una imprenta comercial exige de forma ineludible perfiles `PDF/X-1a` externos.
3. **Gobierno Estricto de IA vía `src/lib/ai-provider`**:
   * Todo módulo de pulido editorial con LLMs debe invocar de forma obligatoria `generateWithRotation` desde [`src/lib/ai-provider/index.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/ai-provider/index.ts), cumpliendo las reglas de `AGENTS.md` (rotación de llaves, modelos autorizados y presupuesto temporal de 90s).

---

## 6. Plan de Ejecución por Fases (Falsables con Mutaciones Anti-F11)

El orden de construcción sitúa el **motor tipográfico y la arquitectura en primer lugar**, y el **pulido con IA en etapas posteriores**:

```
       ┌──────────────────────────────────────────────────────────────────┐
       │   FASE 0: Gate 0 — Documento de Diseño y Gobernanza (Actual)     │
       └────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │   FASE 1: Spike del Motor de Composición Typst (Sin IA)          │
       │   (Template Typst, 2 columnas, running heads, cajas pedagógicas) │
       └────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │   FASE 2: Trabajo en Cola Asíncrona y Ruta con Subscription Gate │
       │   (job-worker + /api/pdf/libro-editorial/[id] + getSubscription) │
       └────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │   FASE 3: Motor de Pulido Editorial con IA Estructurada          │
       │   (Sidenotes, errores comunes, glosario lateral vía ai-provider) │
       └────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │   FASE 4: Pre-Prensa: CMYK, Sangrado a 3mm y Calculadora de Lomo │
       │   (sharp con ICC, portada completa desplegada y perfiles de imp) │
       └────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │   FASE 5: Integración en Interfaz de Usuario y Modal de Upsell   │
       │   (Comparativa Free vs Premium, botón de encolamiento y descarga)│
       └──────────────────────────────────────────────────────────────────┘
```

---

### Fase 1: Spike del Motor de Composición Typst (JSON Fixture, SIN IA)
- **Archivos a intervenir**:
  - `src/lib/editorial/typst-compiler.ts` (wrapper de ejecución de Typst)
  - `templates/editorial/workbook-template.typ` (plantilla escolar con diseño Pearson/Santillana)
  - `src/__tests__/editorial-typst-spike.test.ts`
- **Alcance Técnico**:
  - Compilar un capítulo completo a partir de un JSON fixture real de `ActiveWorkTextbook` sin llamadas a modelos de IA.
  - Implementar retícula de 2 columnas asimétricas (columna de contenido principal + columna marginal de notas), encabezados dinámicos con UAC y bloque, cajas estilizadas para el Reto Situado y portada escolar institucional.
  - Generación de un PDF de $\ge 30$ páginas en $< 2$ segundos con determinismo estricto (dos ejecuciones con el mismo fixture producen un binario con hash idéntico, fijando `SOURCE_DATE_EPOCH=0` en el wrapper `typst-compiler.ts` para que Typst no varíe `CreationDate`/`ModDate` en el trailer del PDF).
- **Comando de Verificación**:
  ```bash
  npx vitest run src/__tests__/editorial-typst-spike.test.ts
  ```
- **Mutación Load-Bearing Anti-F11 (MUT-EDIT-1)**:
  - *Mutación*: Eliminar una misión del fixture JSON o alterar la numeración de sesiones.
  - *Comportamiento esperado*: El test DEBE fallar inmediatamente al comprobar que el número de páginas o secciones renderizadas no coincide con la cuenta matemática del fixture.

---

### Fase 2: Trabajo en Cola Asíncrona y Ruta con Subscription Gate
- **Archivos a intervenir**:
  - `src/lib/job-worker.ts` (manejo del tipo de job `editorial_book`)
  - `src/app/api/pdf/libro-editorial/[id]/route.ts` (endpoint de encolamiento y consulta de estatus)
  - `src/lib/editorial/editorial-db.ts` (consultas a la tabla `editorial_books`)
  - `src/__tests__/editorial-job-queue.test.ts`
- **Alcance Técnico**:
  - Gating estricto mediante `getSubscriptionStatus()`: si el usuario no tiene plan activo ni es administrador, retorna `403 Forbidden` con metadata del tier requerido.
  - Encolamiento mediante `claimNextPendingJob` compatible con el timeout de 60s de Vercel.
  - Preservación de la ruta legacy `/api/pdf/libro-semestral/[id]` (100% operativa).
- **Comando de Verificación**:
  ```bash
  npx vitest run src/__tests__/editorial-job-queue.test.ts
  ```
- **Mutación Load-Bearing Anti-F11 (MUT-EDIT-2)**:
  - *Mutación*: Mockear un docente con suscripción vencida (`hasActiveSubscription: false`) y omitir el chequeo en la ruta.
  - *Comportamiento esperado*: El test de seguridad DEBE fallar al no rechazar la solicitud con HTTP 403.

---

### Fase 3: Motor de Pulido Editorial con IA Estructurada
- **Archivos a intervenir**:
  - `src/lib/editorial/polish-engine.ts`
  - `src/lib/prompts/editorial-polish.ts` (esquemas Zod para micro-elementos)
  - `src/__tests__/editorial-polish.test.ts`
- **Alcance Técnico**:
  - Enriquecimiento de misiones mediante `generateWithRotation` de `src/lib/ai-provider`:
    * *Sidenotes*: curiosidades científicas y notas históricas.
    * *Cajas "Error Común"*: conceptos erróneos frecuentes del examen.
    * *Glosario Marginal*: términos clave con definición concisa para la columna lateral.
  - Caché de pulido indexada por `content_hash`: si el contenido de la misión no cambia, el costo en tokens es cero. Si el docente edita la planeación, el hash cambia y el pulido se invalida automáticamente.
- **Comando de Verificación**:
  ```bash
  npx vitest run src/__tests__/editorial-polish.test.ts
  ```
- **Mutación Load-Bearing Anti-F11 (MUT-EDIT-3)**:
  - *Mutación*: Alterar el texto de una misión en la base de datos y reutilizar la caché anterior sin invalidarla.
  - *Comportamiento esperado*: El test de verificación de hash DEBE fallar al detectar que el `content_hash` almacenado no corresponde al hash derivado del contenido actualizado.

---

### Fase 4: Pre-Prensa y Artes Gráficas (CMYK, Sangrado y Calculadora de Lomo)
- **Archivos a intervenir**:
  - `src/lib/editorial/pre-press.ts`
  - `src/lib/editorial/spine-calculator.ts`
  - `templates/editorial/cover-spread.typ` (cubierta desplegada: contraportada + lomo + portada)
  - `src/__tests__/editorial-pre-press.test.ts`
- **Alcance Técnico**:
  - Restricción dimensional estricta para los 244 PNGs: ancho máximo en Typst de $4.2 \text{ cm}$ para garantizar $\ge 300 \text{ DPI}$ reales.
  - Cálculo paramétrico de lomo de libro:
    $$\text{Ancho Lomo (mm)} = \left(\frac{\text{Total Páginas}}{2}\right) \times \text{Calibre Papel (ej. 0.09 mm)}$$
  - Generación de pliego de portada desplegada con 3 mm de sangrado (`bleed: 3mm`) y marcas de corte perimetrales (`marks: ("crop")`).
- **Comando de Verificación**:
  ```bash
  npx vitest run src/__tests__/editorial-pre-press.test.ts
  ```
- **Mutación Load-Bearing Anti-F11 (MUT-EDIT-4)**:
  - *Mutación*: Forzar un cálculo de lomo de 0 mm en un libro de 160 páginas.
  - *Comportamiento esperado*: El test DEBE fallar al exigir que el lomo calculado para 160 páginas con calibre 0.09 mm sea de $7.2 \text{ mm} \pm 0.1 \text{ mm}$.

---

### Fase 5: Integración en Interfaz de Usuario y Modal de Upsell
- **Archivos a intervenir**:
  - `src/components/planeacion/tabs/PlanningTabDocumento.tsx`
  - `src/components/editorial/EditorialUpgradeModal.tsx`
  - `src/__tests__/editorial-ui-integration.test.ts`
- **Alcance Técnico**:
  - Añadir botón distintivo "Edición de Imprenta Comercial (Santillana / Offset)" junto al botón existente de descarga rápida.
  - Si el usuario es Free: abre modal visual comparando la versión digital estándar vs. la versión para imprenta offset con enlace a suscripción Stripe (`/api/stripe/checkout`).
  - Si el usuario es Premium: encola el trabajo, muestra barra de progreso asíncrona y botón de descarga al completarse.
- **Comando de Verificación**:
  ```bash
  npm test && npm run build
  ```
- **Mutación Load-Bearing Anti-F11 (MUT-EDIT-5)**:
  - *Mutación*: Deshabilitar o alterar el botón legacy de descarga PDF rápida.
  - *Comportamiento esperado*: El test de regresión UI DEBE fallar garantizando que los usuarios Free conservan intacto el acceso al libro estándar.

---

## 7. Matriz de Riesgos y Procedimiento de Contingencia

| Riesgo Técnico / Operativo | Probabilidad | Impacto | Mitigación Inmediata |
| :--- | :--- | :--- | :--- |
| Incompatibilidad de binario Typst en entorno Linux de producción (Vercel) | Media | Alto | Compilar Typst como binario estático x86_64 embebido o utilizar contenedor Docker oficial en worker desacoplado. |
| Saturación de memoria en PDFs de más de 200 páginas | Baja | Medio | La ejecución vive en el worker de cola (`/api/jobs/process`), fuera de la petición HTTP del usuario. |
| Inconsistencia de color en imprenta local | Baja | Medio | Especificación estricta de perfil de color FOGRA39 y verificación previa en software de pre-prensa. |
| Rechazo de usuarios Free por percepción de bloqueo | Nula | Bajo | La versión actual del libro sigue 100% disponible sin costo adicional (enfoque aditivo, no restrictivo). |

---

## 8. Tabla de Firmas y Control de Dictamen (Gate 0)

| Rol / Responsabilidad | Nombre y Entidad | Estado de Aprobación | Fecha |
| :--- | :--- | :--- | :--- |
| **Ingeniería de Software / Arquitectura** | Antigravity AI Agent (SACRINT) | **Propuesta Técnica Formalizada** | 2026-10-11 |
| **Auditoría de Calidad y Procesos** | OpenCode Adversarial Reviewer | **APROBADO CON SALVEDAD CRÍTICA** (ver §9) | 2026-10-12 |
| **Dirección de Tecnología / Producto** | *Usuario / Administrador SIGPDA-EMS* | **APROBADO** | 2026-10-11 |

> **Compromiso Estricto**: Ninguna línea de código de las Fases 1 a 5 será escrita o introducida en el repositorio hasta que este documento cuente con el visto bueno y dictamen favorable de la Auditoría OpenCode.

---

## 9. Dictamen de Auditoría OpenCode (Gate 0) — 2026-10-12

**Veredicto: APROBADO CON SALVEDAD CRÍTICA.** La arquitectura es sólida para su objetivo declarado (PDF de imprenta con Typst). Fortalezas verificadas: auditoría de licencias correcta (Typst Apache-2.0; se evita el copyleft comercial de `electric-book` GPL-3.0), justificación de rendimiento frente a Puppeteer/Paged.js válida para el timeout de 60 s de Vercel, separación de dominio (`editorial_books` sin contaminar `ActiveWorkTextbook`), gate de suscripción y gobernanza de flags/IA conforme a `AGENTS.md`, y cada fase con test falsable + mutación anti-F11.

**Salvedad crítica (bloquea Fases 3–5 hasta resolverse):**
1. **Modelo de contenido**: la Fase 1 compila desde un fixture de `ActiveWorkTextbook`, cuyo contenido de sesión es **guía del docente** (etiquetas "Docente:"/"Estudiante:", verbos de instrucción), no material que un estudiante pueda leer solo. Typst imprimiría con calidad de imprenta el mismo contenido deficiente. **Obligación**: migrar el modelo de contenido a **voz de estudiante** (teoría real, ejemplo resuelto con números, práctica con pistas, recursos de ampliación) antes de que Fases 3–5 consuman contenido real; idealmente la Fase 1 ya usa el modelo de estudiante.

**Salvedades menores:**
2. **Binario Typst en Vercel Serverless**: riesgo técnico real. Mitigación (binario estático embebido o worker en contenedor Fly/Render) debe validarse de forma temprana en la Fase 1, no postergarse a la Fase 4.
3. **Determinismo de hash**: fijar `SOURCE_DATE_EPOCH=0` es correcto, pero verificar también el orden de incrustación de fuentes/imágenes para lograr hash idéntico entre ejecuciones.
4. **Enlaces `file:///c:/…`**: las referencias a archivos usan rutas absolutas de Windows, inoperantes como vínculos relativos en el repo. Corregir a rutas relativas del repositorio.
5. **Alcance DOCX**: el Motor Editorial es solo PDF (Typst). La exportación editorial de alta calidad en DOCX queda fuera de alcance y seguirá en el renderer actual.
