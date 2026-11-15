# AUDITORÍA SIGPDA-EMS — SEGURIDAD, DEUDA TÉCNICA Y MATERIALES PM3

> **Dictamen ejecutivo:** **NO-GO para producción** hasta resolver los bloqueadores de seguridad P0.  
> **Dictamen editorial:** los materiales de Pensamiento Matemático III **no cumplen** el estándar didáctico solicitado, aunque el QA automático de Antigravity reporte “TODOS LOS CONTROLES PASARON”.

| Dato | Valor |
|---|---|
| Fecha de auditoría | 2026-11-15 |
| Repositorio | `C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS` |
| Rama | `main` |
| Commit auditado | `44926ad3e1d1eef2dde8f04ac4375103dea1b494` |
| Commit corto | `44926ad3` |
| Estado del árbol | Limpio (`git status --short` sin salida) |
| Materiales auditados | `documentos_referencia\[01]Planeaciones-Secuencias-Plan_de_Clase\Libros Planeaciones 2026\pensamiento_matematico_iii` |
| Método | Revisión estática de código, `npm audit`, inspección de texto/estructura de PDF y PPTX, análisis de QA y materiales |
| No realizado en esta pasada | Pentest dinámico, pruebas de carga, ejecución completa de tests/build/lint, rasterización visual de todas las páginas |

---

## 1. RESUMEN EJECUTIVO

### 1.1 Seguridad

El sistema tiene una base funcional importante: usa autenticación, consultas parametrizadas con Neon y controles de rol en varias rutas. Sin embargo, existen fallos que permiten **fraude de suscripción, escalada de privilegios y acceso a datos de otros docentes/planteles**. Los más graves:

1. El precio de Stripe se toma del cuerpo de la petición del cliente.
2. Cualquier docente puede cambiarse a `director` o `supervisor` desde su perfil.
3. `next@16.2.9`, `next-auth@5.0.0-beta.31`, `@auth/core@0.41.2` y `dompurify@3.4.13` tienen vulnerabilidades críticas.
4. Varias rutas institucionales validan el rol, pero no la pertenencia al plantel/zona.
5. La RLS de PostgreSQL está habilitada solo en dos tablas y depende de una variable de sesión que la aplicación no establece.

### 1.2 Materiales

El QA de Antigravity es un buen filtro geométrico, pero **no evalúa si el material enseña**. Puede detectar colisiones, cajas sin wrap, exceso de palabras y algunos patrones de texto, pero no detecta:

- actividades truncadas o sin consigna;
- conclusiones que no concluyen;
- errores comunes que no corresponden al tema;
- gráficas que no corresponden al ejercicio;
- fórmulas incompletas o con Unicode perdido;
- figuras genéricas que no ilustran el problema;
- pasos que no llegan al resultado.

Por eso el resultado “TODOS LOS CONTROLES PASARON” es cierto para el script, pero **falso como veredicto de calidad**.

### 1.3 Reconciliación con Antigravity

- El **segundo informe** de Antigravity es el más preciso: detecta truncamientos, errores comunes desalineados y figuras incorrectas.
- El **primer informe** (“todo corregido”) sobreestima la calidad.
- La afirmación “sin commit” es incorrecta para el estado actual: existe el commit `44926ad3` y el árbol está limpio.
- No se encontró `qa-regen/` ni PNGs de evidencia visual; no se pudieron validar las inspecciones visuales que Antigravity dice haber realizado.

---

## 2. ALCANCE Y MÉTODO

### 2.1 Alcance

- Rutas API y librerías de autenticación, suscripciones, analytics, expedientes, notificaciones, PDF y generación de materiales.
- Dependencias de producción y cadena transitiva relevante.
- Deuda técnica, tipado, i18n y acoplamiento territorial.
- Nueve entregables de Pensamiento Matemático III: planeación, secuencia, planes, solucionario, guías, libro, instrumentos, presentaciones e infografías.

### 2.2 Evidencia utilizada

- `git rev-parse`, `git status`, `git log`.
- `npm audit --omit=dev --json`.
- `npm ls` para versiones instaladas.
- Lectura directa de código con referencias `archivo:línea`.
- Extracción de texto y coordenadas de PDF con PyMuPDF.
- Extracción de texto y geometría de PPTX con `python-pptx`.
- Lectura del QA `scripts/qa-sacrint-materials.ts`.

### 2.3 Límites

- No se ejecutó un pentest dinámico ni pruebas de explotación.
- No se ejecutaron `npm test`, `npm run build` ni `npm run lint` en esta pasada.
- No se rasterizaron todas las páginas; los hallazgos visuales se basan en texto, coordenadas, etiquetas y estructura vectorial.
- Los conteos léxicos de hardcodeo son señales de acoplamiento, no todos son defectos individuales.

---

## 3. HALLAZGOS DE SEGURIDAD

### 3.1 Bloqueadores críticos

#### S-01. Precio y plan de Stripe controlados por el cliente

- **Severidad:** Crítica.
- **Evidencia:** `src/app/api/stripe/checkout/route.ts:25` recibe `{ planId, planName, price }` desde `req.json()`; `:82` usa `unit_amount: price * 100`. El `planId` solo se usa para calcular `limit` (`:34-40`), pero el precio no se valida contra un catálogo del servidor.
- **Impacto:** un atacante autenticado puede pagar un peso por un plan de 999 materias, o alterar el nombre del plan. Es fraude directo de suscripción.
- **Remediación:** catálogo server-side `planId -> Stripe Price ID`; ignorar `price` y `planName` del cliente; rechazar planes desconocidos; pruebas de manipulación de payload.

#### S-02. Autoescalada de rol a director/supervisor

- **Severidad:** Crítica.
- **Evidencia:** `src/app/api/teacher-profile/route.ts:16` acepta `role` desde el cuerpo; `:26-29` solo valida que sea un rol permitido; `:55` escribe `role = COALESCE(${role || null}, role, 'docente')` sin verificar que el solicitante sea administrador.
- **Impacto:** cualquier docente puede convertirse en `director` o `supervisor` y acceder a analytics, expedientes y datos institucionales.
- **Remediación:** el perfil de autoservicio no debe aceptar `role`; solo un administrador puede cambiarlo; registrar auditoría de cambios; prueba negativa con sesión de docente.

#### S-03. Next.js 16.2.9 con vulnerabilidades críticas

- **Severidad:** Crítica.
- **Evidencia:** `package.json` fija `next@16.2.9`; `npm audit` reporta rango `9.3.4-canary.0 - 16.4.0` y fix `16.4.6`.
- **Impacto:** el advisory incluye RCE no autenticado en servidores Windows, RCE en Image Optimization, SSRF en rewrites/Server Actions, bypass de middleware/proxy, cache poisoning y DoS. Es el paquete más crítico de la cadena.
- **Remediación:** actualizar a `next@16.4.6` o superior; ejecutar regresión de auth, middleware, imágenes y cache; no desplegar con la versión actual.

#### S-04. NextAuth beta y `@auth/core` con fallos de autenticación

- **Severidad:** Crítica.
- **Evidencia:** `next-auth@5.0.0-beta.31` y `@auth/core@0.41.2`; `npm audit` reporta fallo abierto en comprobaciones de existencia, bypass de normalización de email con homóglifos, `getToken()` con excepción no capturada y cookies OAuth no vinculadas al proveedor.
- **Impacto:** posibles bypass de autenticación, confusión de proveedor y denegación de servicio en flujos de login.
- **Remediación:** actualizar a la versión parcheada; si no hay estable compatible, migrar a Auth.js estable o aislar el flujo; pruebas de login con emails Unicode y headers Bearer malformados.

#### S-05. DOMPurify 3.4.13 con XSS crítico

- **Severidad:** Crítica.
- **Evidencia:** `jspdf@4.2.1` y `mermaid@11.17.2` arrastran `dompurify@3.4.13`; `npm audit` reporta rango `<=3.4.16`. Además, el proyecto usa HTML crudo en `src/components/common/MarkdownWithMermaid.tsx:91` y `src/components/planeacion/ExtraPreviewModal.tsx:344,555`.
- **Impacto:** XSS en contenido generado o importado; ejecución de manejadores en subárboles desconectados y bypass de plantillas.
- **Remediación:** actualizar DOMPurify a `>3.4.16`; sanitizar todo HTML/SVG antes de `dangerouslySetInnerHTML`; preferir renderizado estructurado sobre HTML crudo.

### 3.2 Hallazgos altos de lógica de negocio

#### S-06. Enumeración global de docentes en expedientes

- **Severidad:** Alta.
- **Evidencia:** `src/app/api/expedientes/personal/route.ts:14` lee `escuelaId`, pero `:17-21` consulta `SELECT id, name, email, role FROM teachers ORDER BY name ASC` sin filtro por escuela, zona o rol del solicitante.
- **Impacto:** cualquier usuario autenticado obtiene nombres, emails y cargos de todos los docentes; es un directorio de PII y un insumo para phishing.
- **Remediación:** exigir `director`/`administrador`; filtrar por CCT/zona; devolver solo campos necesarios; prueba con docente de otra escuela.

#### S-07. Crons fail-open si falta `CRON_SECRET`

- **Severidad:** Alta.
- **Evidencia:** `src/app/api/cron/cleanup-idempotency/route.ts:10` y `src/app/api/cron/prune-ingest-cache/route.ts:10` solo validan si `process.env.CRON_SECRET` existe. Si no existe, la condición es falsa y la ruta continúa.
- **Impacto:** en un despliegue sin la variable, cualquiera puede disparar limpiezas/prunes y afectar disponibilidad o integridad.
- **Remediación:** fail-closed en producción; rechazar si el secreto no está configurado; comparación timing-safe; monitoreo de ejecuciones.

#### S-08. IDOR en analytics por escuela

- **Severidad:** Alta.
- **Evidencia:** `src/app/api/analytics/v1/school/[schoolId]/route.ts:30-41` autoriza por rol (`director`, `supervisor`, admin), pero no verifica que el `schoolId`/CCT corresponda al director o a su zona.
- **Impacto:** un director puede leer métricas de cualquier CCT si conoce o enumera el identificador.
- **Remediación:** comparar `teacher.cct`/zona con el objetivo; permitir override solo a admin; prueba con director de otro plantel.

#### S-09. IDOR en analytics por zona

- **Severidad:** Alta.
- **Evidencia:** `src/app/api/analytics/v1/zone/[zoneId]/route.ts:31-43` autoriza a cualquier supervisor y usa `targetSupervisorId = zoneId` sin comprobar que sea su propia zona.
- **Impacto:** un supervisor puede consultar analytics de cualquier otra zona.
- **Remediación:** si el rol es supervisor, forzar `teacher.id` o validar pertenencia; admin puede consultar cualquier zona; prueba negativa.

#### S-10. IDOR en auditorías

- **Severidad:** Alta.
- **Evidencia:** `src/app/api/audit/[id]/route.ts:68-75` permite a cualquier `supervisor` o `administrador` leer cualquier auditoría; no hay filtro por zona, escuela ni relación con el docente.
- **Impacto:** exposición de evaluaciones, planeaciones y datos pedagógicos de otros planteles.
- **Remediación:** alcance por zona/escuela; supervisor solo su ámbito; admin global; prueba con supervisor ajeno.

#### S-11. Descarga de PDF editorial sin ownership

- **Severidad:** Alta.
- **Evidencia:** `src/app/api/pdf/libro-editorial/[id]/route.ts:544-565` autoriza sesión/suscripción, pero `bookId`, `contentHash` y `planningId` se usan directamente para buscar el libro; no se valida que el libro pertenezca al docente.
- **Impacto:** un usuario con suscripción puede descargar libros de otras planeaciones si conoce un `bookId` o `planningId`.
- **Remediación:** unir `editorial_books` con `plannings.teacher_id`; exigir ownership o admin; URLs firmadas de corta duración; prueba cross-tenant.

#### S-12. RLS inefectiva

- **Severidad:** Alta.
- **Evidencia:** `schema.sql:85-105` habilita RLS solo en `plannings` y `uploaded_pdfs`; las políticas usan `current_setting('app.current_user_email', true)`, pero no se encontró `set_config` en `src`. El resto de tablas institucionales no tiene RLS.
- **Impacto:** la base de datos no es una segunda barrera; cualquier fallo de autorización en la aplicación se convierte en acceso cross-tenant.
- **Remediación:** establecer `app.current_user_email` por request/transacción; políticas en todas las tablas con `teacher_id`/`school_id`; pruebas de aislamiento con dos usuarios; documentar tablas excluidas.

### 3.3 Hallazgos medios

#### S-13. Caché de idempotencia sin usuario

- **Severidad:** Media.
- **Evidencia:** `src/app/api/bundles/generate/route.ts:29-56` usa una clave de header o un hash de `planningId:type:ventana de 5 min`; la consulta a `generation_audit_logs` no incluye `teacher_id`.
- **Impacto:** reutilización o colisión de claves puede devolver `result_json`/`bundle_url` de otro usuario.
- **Remediación:** incluir `teacher_id` en la clave y en el `WHERE`; validar ownership de `planningId`; no aceptar claves de cliente sin namespace.

#### S-14. Notificaciones in-app para `user_id` arbitrario

- **Severidad:** Media.
- **Evidencia:** `src/app/api/notifications/route.ts:74-82` usa `user_id: body.user_id || teacherId`.
- **Impacto:** un usuario autenticado puede inyectar notificaciones en la bandeja de otro; spam/phishing interno.
- **Remediación:** ignorar `body.user_id`; usar siempre el usuario de sesión; permitir cross-user solo a admin con validación.

#### S-15. Email a destinatario y HTML controlados por el cliente

- **Severidad:** Media.
- **Evidencia:** `src/app/api/notifications/send/route.ts:28-36` pasa `body.metadata`; `src/lib/notifications.ts:38-44,70-93` envía a `metadata.email` y construye HTML con `data.subject`, `data.body` y `data.link` sin escapar.
- **Impacto:** envío de correos desde el dominio institucional a direcciones arbitrarias y HTML injection en el correo.
- **Remediación:** destinatario server-side; permitir email solo a direcciones verificadas; escapar HTML; rate limit; plantillas fijas.

#### S-16. XSS potencial en Markdown/Mermaid

- **Severidad:** Media.
- **Evidencia:** `src/components/common/MarkdownWithMermaid.tsx:87-93` convierte Markdown a HTML y lo inyecta con `dangerouslySetInnerHTML`; Mermaid también procesa contenido.
- **Impacto:** XSS almacenado si el contenido generado/importado no es confiable.
- **Remediación:** sanitizar con DOMPurify parcheado; deshabilitar HTML crudo; probar payloads `<img onerror>`, SVG y enlaces `javascript:`.

#### S-17. XSS potencial en vista previa de extras

- **Severidad:** Media.
- **Evidencia:** `src/components/planeacion/ExtraPreviewModal.tsx:344` inyecta `line` y `:555` inyecta `enrichedSvg`.
- **Impacto:** ejecución de scripts/manejadores en SVG o HTML generado.
- **Remediación:** sanitizar SVG/HTML; usar `DOMPurify` con perfil SVG; evitar `dangerouslySetInnerHTML` para contenido no confiable.

#### S-18. SSRF en descarga de imágenes

- **Severidad:** Media.
- **Evidencia:** `src/lib/visual-engine/image-downloader.ts:30-50` acepta cualquier URL que empiece con `http`, sigue redirecciones y no bloquea IPs privadas/link-local ni metadata de nube.
- **Impacto:** acceso a red interna o endpoints de metadata si una URL llega desde contenido generado/importado.
- **Remediación:** allowlist de dominios; bloquear rangos privados y link-local; validar cada redirección; resolver DNS y fijar IP; límites de tamaño.

#### S-19. CCT/municipio hardcodeados como fallback

- **Severidad:** Media.
- **Evidencia:** `src/lib/paec-pdf-generator.ts:216` usa `'21EBH0045X'`; `:220` usa `'Zacatlán'`; `src/app/api/pdf/libro-editorial/[id]/route.ts:352` usa `'21EBH0001X'`; `src/lib/config.ts:12` fija `SCHOOL_YEAR = '2026-2027'`.
- **Impacto:** documentos oficiales con plantel, municipio o ciclo incorrectos cuando falta contexto; riesgo de credibilidad y cumplimiento.
- **Remediación:** exigir identidad escolar resuelta; bloquear exportación si no hay CCT/ciclo; un solo proveedor de contexto; pruebas con plantel sin datos.

### 3.4 Fortalezas de seguridad observadas

- Las consultas revisadas usan tagged templates de Neon, no concatenación SQL directa.
- Hay autenticación y gates por rol en varias rutas.
- Hay uso de bcrypt y validaciones de sesión.
- Existen pruebas y utilidades de auditoría, aunque no cubren semántica de materiales.

---

## 4. DEPENDENCIAS Y CADENA DE SUMINISTRO

`npm audit --omit=dev` reporta:

| Severidad | Cantidad |
|---|---:|
| Crítica | 4 |
| Alta | 13 |
| Moderada | 3 |
| Baja | 2 |
| **Total** | **22** |

### 4.1 Críticas

| Paquete | Versión instalada | Rango vulnerable | Fix / acción |
|---|---:|---|---|
| `next` | 16.2.9 | `9.3.4-canary.0 - 16.4.0` | Actualizar a `16.4.6` |
| `next-auth` | 5.0.0-beta.31 | `4.24.8 - 5.0.0-beta.31` | Actualizar a versión parcheada o migrar |
| `@auth/core` | 0.41.2 | `<=0.41.2` | Actualizar con NextAuth |
| `dompurify` | 3.4.13 | `<=3.4.16` | Actualizar a `>3.4.16` |

### 4.2 Altas

| Paquete | Versión instalada | Problema | Fix / acción |
|---|---:|---|---|
| `pdfjs-dist` | 6.0.227 | Ejecución arbitraria de JS al abrir PDF malicioso | `6.2.108` |
| `xlsx` | 0.18.5 | Prototype pollution y ReDoS | **Sin fix**; aislar/reemplazar |
| `sharp` | 0.34.5 | Vulnerabilidades de libvips/libheif/librsvg | `0.35.5`; validar compatibilidad |
| `pptxgenjs` | 4.0.1 | DoS vía `image-size` | Audit propone `4.0.0`; validar o parchear |
| `zod` | 4.6.2 | Agotamiento de memoria en colecciones grandes | `>=4.6.6` |
| `@vercel/blob` | 2.4.1 | Cadena `@vercel/oidc`/`@vercel/cli-config` | Audit propone `2.4.0`; validar |
| `undici` | 6.27.0 / 7.30.0 / 8.12.2 | DoS, CRLF, TLS, cache poisoning | Actualizar a versión parcheada |
| `postcss` | 8.4.31 / 8.5.28 | XSS y lectura arbitraria vía source maps | Subir con `next@16.4.6` |
| `brace-expansion` | 1.1.15 | DoS por expansión | Actualizar |
| `source-map-js` | 1.2.1 | DoS por offsets | Actualizar |
| `image-size` | 1.2.1 | DoS en parsers JXL/HEIF/ICNS | Subir con `pptxgenjs` |

> La tabla resume los paquetes de mayor impacto; el detalle completo de las 13 alertas altas está en la salida de `npm audit`.

### 4.3 Moderadas y bajas

- `exceljs@4.4.0` y `uuid@8.3.2`: fallo moderado de `uuid`; audit propone `exceljs@3.4.0`.
- `baseline-browser-mapping`: DoS moderado.
- `katex@0.16.47` y `mermaid@11.17.2`: prototype pollution/trust bypass bajo; audit propone `mermaid@12.3.0`.

### 4.4 Prioridad de dependencias

1. `next`, `next-auth`, `@auth/core`, `dompurify`.
2. `pdfjs-dist` y `xlsx` por procesar archivos subidos.
3. `sharp`, `pptxgenjs`, `zod`, `@vercel/blob`, `undici`.
4. Toolchain (`postcss`, `brace-expansion`, `source-map-js`) y librerías de render.

---

## 5. DEUDA TÉCNICA, HARDCODEO E I18N

### 5.1 Tipado y robustez

| Señal | Conteo bruto en `src` |
|---|---:|
| `: any` | 495 |
| `any[]` | 98 |
| `as any` | 124 |
| `@ts-expect-error` | 19 |
| `catch {}` vacío | 18 |
| `console.error` | 44 |
| `console.warn` | 34 |
| Rutas API | 139 |

**Lectura:** el tipado estricto no es una barrera real en las zonas de integración; los `any` se concentran en respuestas de BD, PDFs y contenido generado. Esto facilita que errores de forma lleguen a producción.

**Literales:** 9,738 literales largos y 537 duplicados; el conteo es léxico y requiere revisión caso a caso, pero confirma el alto grado de texto embebido en código.

### 5.2 i18n

- `messages/es.json`: 105 hojas.
- `messages/en.json`: 7 hojas.
- Solo 10 archivos importan utilidades de i18n.
- Solo 4 coincidencias de `t(` en `src`.
- `src/app/page.tsx` sigue siendo el boilerplate de `create-next-app` (“To get started, edit the page.tsx file.”).

**Lectura:** la plataforma es funcionalmente monolingüe en español y tiene una promesa de i18n incompleta. No es un bloqueador de seguridad, pero sí una deuda de producto y accesibilidad.

### 5.3 Acoplamiento territorial

| Término | Coincidencias | Archivos |
|---|---:|---:|
| `Puebla` | 1,676 | 318 |
| `MCCEMS` | 1,184 | 316 |
| `BGE` | 1,808 | 187 |
| `2026-2027` | 492 | 249 |
| `SCHOOL_YEAR` | 134 | 32 |

**Lectura:** hay una fuerte dispersión de supuestos territoriales y de ciclo. `SCHOOL_YEAR` existe en `src/lib/config.ts:12`, pero no es la única fuente. Los fallbacks de CCT/municipio son un síntoma del mismo problema.

### 5.4 Timeouts y resiliencia

- Hay 139 rutas API y no hay un presupuesto uniforme de timeout/abort.
- `src/lib/visual-engine/image-downloader.ts` sí usa `AbortController`, pero no valida destinos.
- Las rutas de generación pesada dependen de límites de Vercel; no se observó un patrón único de cancelación.

---

## 6. AUDITORÍA DE MATERIALES DE PENSAMIENTO MATEMÁTICO III

### 6.1 Criterio de evaluación

Un material se considera aceptable solo si cumple lo siguiente:

1. **Presentación 1/2:** conocimiento nuevo breve, con definición/fórmula correcta; ejemplo resuelto que llega a un resultado; gráfica coherente con el ejemplo.
2. **Presentación 2/2:** dos actividades con consigna explícita (verbo + datos + pregunta), pistas pertinentes y evaluación.
3. **Infografía:** fórmula completa y correcta; procedimiento que llega al resultado; gráfica coherente; sin texto roto ni Unicode perdido.
4. **Libro:** figuras que correspondan al ejercicio; texto limpio; sin Markdown crudo; sin operadores ASCII; sin etiquetas cortadas.
5. **Compilados:** numeración y pies de página consistentes; sin pasos huérfanos; sin ejercicios genéricos.

### 6.2 Dictamen por material

| Material | Extensión | Dictamen | Evidencia principal |
|---|---:|---|---|
| `01_Planeacion_Didactica_Semestral...pdf` | 12 p | Aceptable con defectos de continuidad | La tabla se corta y `S1/24` reaparece dentro de una página con encabezado del bloque anterior |
| `02_Secuencia_Didactica...pdf` | 14 p | Aceptable con defectos de continuidad | Mismo patrón de corte de tabla y numeración |
| `03_Planes_de_Clase_Compilado...pdf` | 100 p | **No cumple** | 54 repeticiones de la frase de rol, 72 “Meta Educativa”, 216 “Rol del Estudiante”, pies por sesión, cierre de p50 cita Sesión 4 |
| `04_Solucionario_Docente_Compilado...pdf` | 80 p | **No cumple** | 598 números huérfanos; ejercicio 6 de p52 es genérico; falta área máxima 312.5 |
| `05_Guias_de_Practica_Compilado...pdf` | 72 p | **No cumple parcialmente** | 7 casos de `Ejercicio 1.:`; título en futuro en p62 |
| `06_Libro_de_Texto_Semestral_Consolidado...pdf` | 150 p | **No cumple** | Markdown crudo, `!=`, figuras desalineadas, semáforos cortados, figura genérica en p132 |
| `07_Instrumentos_de_Evaluacion_Compilado...pdf` | 6 p | Aceptable con defecto menor | 6 pies `Página 1 de 1`; contenido mínimo |
| `08_Presentaciones_SACRINT...pptx` | 156 slides | **No cumple** | Actividades truncadas, conclusiones vacías, errores comunes cruzados, gráficas incorrectas, 18 montos `$X,$Y` |
| `09_Infografias_Sinteticas...pdf` | 12 p | **No cumple** | Fórmulas rotas, Unicode perdido, títulos incorrectos, procedimientos incompletos, gráficas desalineadas |

### 6.3 Presentaciones 08 (156 diapositivas)

**Estructura:** 12 portadas + 72 diapositivas de 1/2 + 72 de 2/2. La arquitectura es correcta; la ejecución didáctica no.

#### Métricas de “CONOCIMIENTO NUEVO”

| Métrica | Valor |
|---|---:|
| Diapositivas 1/2 | 72 |
| Mediana de caracteres | 73 |
| Mínimo | 24 |
| Máximo | 201 |
| `< 65` caracteres | 29 |
| `< 90` caracteres | 48 |
| `< 110` caracteres | 63 |
| `< 130` caracteres | 67 |

**Lectura:** 40% de las diapositivas no alcanza 65 caracteres de explicación. Muchas son eslóganes, no conocimiento nuevo.

#### Fallos verificados

- **Slide 2:** conclusión “Sustituimos x = 200 en la ecuación original.”; no presenta el resultado como cierre. La gráfica tiene dominio `[0, 40]`, meta 750 y no muestra `x = 200`.
- **Slide 3:** Actividad 1 termina en “Se rentan dos tableros portátiles con pago fijo de $400 más una tarifa de $80/hora.”; faltan el presupuesto de 880 y la pregunta. Actividad 2 también queda truncada; la pista es “Luego, plantea una ecuación.”.
- **Slide 6:** el tema es una ecuación de dos variables, pero la figura es un sistema 2x2 con `L2: 3x + 2y = 24` y solución `(-4, 18)`, que no corresponde al ejemplo `2x + y = 10`. La conclusión solo dice “Representar los pares en papel milimétrico…”.
- **Slide 7:** Actividad 2 no tiene pregunta ni consigna; Actividad 1 tampoco formula una tarea explícita.
- **Slide 25:** el “ERROR COMÚN” quedó como “Vas a evaluar tus: mover términos sin aplicar operación inversa bilateral.”; no hay conclusión y el conocimiento nuevo está duplicado/incompleto.
- **Slide 42:** el ejemplo es una ecuación lineal de una sola ecuación, pero la figura muestra un sistema 2x2 con `L2: 1200x + 400y = 4800` y solución `(24, -60)`; la conclusión es “Redacta la conclusión técnica.”.
- **Slide 65:** el conocimiento nuevo es una sola frase genérica (“El método de sustitución es un método simbólico fundamental…”); no explica el procedimiento.
- **Slide 68:** Actividad 1 y Actividad 2 repiten la misma pista “Multiplica la primera ecuación por -2.”.
- **Slide 99:** conclusión “Valida el resultado verificando que el discriminante.”; no verifica ni cierra.
- **Slide 125:** el ejemplo usa 3 años/8% semestral y llega a `$18,979.79`, pero la gráfica usa 8% a 6 períodos y `$23,803`; hay desalineación de horizonte y monto. También imprime `$15,$000`.
- **Títulos en futuro:** slides 25, 42, 99 y 125 (“Vas a evaluar…”, “Vas a integrar…”, “Vas a integrar, depurar”, “Vas a optimizar…”).
- **Montos mal formateados:** 18 casos con `$X,$Y`, por ejemplo `$1,$200`, `$15,$000`, `$8,$500`, `$25,$000`.
- **Actividades sin pregunta:** 71/72 de Actividad 1 no tienen `?`; 52/72 tienen menos de 125 caracteres. El patrón se repite en Actividad 2.

#### Diagnóstico 08

La presentación **no es una guía compacta de enseñanza**: es un resumen de estructura con contenido truncado. No cumple el requisito de “conocimiento nuevo breve, ejemplo, ejercicio resuelto breve y aplicación”.

### 6.4 Infografías 09 (12 páginas)

El diseño vectorial es limpio y el texto es seleccionable, pero al menos 7/12 páginas tienen fallos conceptuales o matemáticos verificados (páginas 2, 3, 7, 9, 10, 11 y 12).

- **Página 2:** fórmula central `2x = (2x + 420) - 2x`; “01 EL FENÓMENO” empieza roto: “(3x + 250), der. (2x + 420).”; la gráfica muestra un solo lado del modelo.
- **Página 3:** el tema es una ecuación con dos variables, pero se inventa `L2: 500x + 400y = 4000` y `Sol(2.67, 6.67)`; imprime `($1,$200)`.
- **Página 7:** fórmula central `c = 0` en vez de `ax² + bx + c = 0`; el paso 04 descarta `x = -8` pero no da `x = 5` ni las dimensiones; la etiqueta `V(-1.5, -42.3)` roza la parábola y no coincide con `(-1.5, -42.25)`.
- **Página 9:** mezcla interés simple y compuesto; fórmula `M = C(1 + i)^t`, pasos con `t = 4`, gráfica con `t = 6` y `M = $19,042`.
- **Página 10:** fórmula de interés simple `I = C * i * t`, pero el ejemplo usa 18% a 3 años y la gráfica usa 12% a 6 períodos con `M = $29,607`; el paso 04 se corta en la ecuación de interés simple.
- **Página 11:** imprime `a/a = b/b = c/c = k` por pérdida de primas/`≅`; “Congruencia ( )” queda vacío; el título es “Dossier Técnico…” y no hay triángulos que ilustren los criterios.
- **Página 12:** fórmula `(2x + 20) = 180` incompleta; el paso 03 termina en `6x = 150` sin `x = 25` (aunque el paso 04 lo usa); el error común habla de congruencia de triángulos en un tema de ángulos.
- **Transversal:** las 12 páginas fuerzan `01 EL FENÓMENO`, `02 LA TABULACIÓN`, `03 EL MODELO`, `04 EL IMPACTO` aunque no haya tabulación; `ERROR COMUN` sin tilde; `Correccion` sin tilde; `[OK]` en texto plano.

#### Diagnóstico 09

No es un manual visual de conceptos: es una plantilla visual aplicada a contenidos que no siempre le corresponden. La calidad gráfica no compensa los errores matemáticos.

### 6.5 Libro 06 (150 páginas)

- **Pág. 44 y 107:** `Figura M4.1` / `M10.1 — Representación gráfica conceptual y espacio de tabulación guiada`; es una figura genérica, no una figura del problema.
- **Pág. 52:** Markdown crudo `:--- :--- :---`.
- **Págs. 76 y 78:** operador `!=` en texto de matemáticas.
- **Pág. 65:** el ejercicio usa `4x + 3y = 22` y `2x + 5y = 24`, pero la figura muestra `L1: y = -0.5x + 5`, `L2: y = 1.5x - 5` y solución `(5, 2.5)`.
- **Pág. 80:** ecuación `4x² + 60x - 400 = 0`, pero la gráfica es `f(x) = 4x²`.
- **Pág. 84:** ecuación `2x² - 8x + 5 = 0`, pero la gráfica es `f(x) = x² + 2`.
- **Semáforo cortado:** `Identi con`, `Expl con`, `Optimi con` en págs. 41, 49 y 135; el informe de Antigravity reporta 9 casos.
- **Pág. 132:** el contenido es el Teorema de Napoleón, pero la figura es un diagrama genérico de ángulos de la Sesión 20, no la construcción de triángulos equiláteros.
- **Pág. 130:** la figura es genérica de ángulos, pero al menos es coherente con el tema de tipos de ángulos.

#### Diagnóstico 06

El libro tiene profundidad y estructura, pero las figuras y los artefactos de edición no están a la altura del texto. No es un libro autodidacta confiable hasta corregir figuras, Markdown y etiquetas.

### 6.6 Solucionario 04 (80 páginas)

- **598 líneas** que son solo un número con punto (`1.`, `2.`, `3.`), producto de la extracción/maquetación; no son pasos numerados útiles.
- **Pág. 52, Ejercicio 6:** la “solución” es “Reporte técnico justificando que el terreno propuesto es geométricamente imposible…”, sin cálculo ni criterio verificable.
- **Pág. 52, Ejercicio 5:** da vértice `x = 12.5` y función `A(x) = -2x² + 50x`, pero no calcula el área máxima `312.5`.
- **Pies:** `Página 1 de 26/27` por bloque, no por compilado.

#### Diagnóstico 04

No es un solucionario docente utilizable: los números huérfanos y los ejercicios genéricos impiden seguirlo.

### 6.7 Planes 03 (100 páginas)

- “Recuperar insumos previos y organizar mesa de trabajo colaborativa” aparece **54 veces**.
- “Meta Educativa:” aparece **72 veces**.
- “Rol del Estudiante” aparece **216 veces**.
- **100 páginas** con pies por sesión (`Página 1 de 2`, `Página 2 de 2`, y algunos `Página 1 de 1`), no por compilado.
- **Pág. 50:** el encabezado es Sesión 11, pero el cierre cita “Sesión 4” y una rúbrica de otra sesión.
- **Pág. 35/50/83:** títulos y cierres en futuro (“Identificarás”, “Dominarás”, “Recuperarás”) y actividades genéricas.
- **Pág. 35:** el pie es `Página 1 de 1`; en otras sesiones es `1 de 2`, lo que rompe la consistencia.

#### Diagnóstico 03

Es un compilado repetitivo, con contaminación cruzada entre sesiones. No cumple el estándar de plan de clase listo para aula.

### 6.8 Guías 05 (72 páginas)

- **7 casos** de `Ejercicio 1.:` (punto y dos puntos).
- **Pág. 62:** título en futuro (“Recuperar saberes previos…”) y ejercicios con etiqueta mal formada.
- **Pág. 49:** ejercicio de interés simple/compuesto correcto en planteamiento, pero el material no incluye una progresión visual que conecte con la infografía 09.

#### Diagnóstico 05

Aceptable como base, pero requiere normalización editorial y revisión de títulos.

### 6.9 Instrumentos 07 (6 páginas)

- **6 pies** `Página 1 de 1`; cada instrumento se pagina solo, no el compilado.
- El contenido es mínimo; no se observaron errores matemáticos graves, pero falta evidencia de aplicación completa.

#### Diagnóstico 07

Aceptable con defecto menor de paginación.

### 6.10 Planeación 01 y Secuencia 02

- La tabla de sesiones se corta entre páginas; `S1/24` reaparece dentro de una página con encabezado del bloque anterior.
- En 01, `S1/24` aparece en págs. 2, 5 y 9; en 02, en págs. 2, 6 y 10.
- No es un reinicio de datos necesariamente, pero **rompe la continuidad visual** y hace parecer que la secuencia se duplica.

#### Diagnóstico 01/02

Aceptables en contenido, con defecto de maquetación/continuidad que debe corregirse antes de imprimir.

---

## 7. CAUSAS RAÍZ DE LOS DEFECTOS DE MATERIALES

1. **El fitter prioriza caber sobre enseñar.** `src/lib/editorial/pedagogical-text-fitter.ts:907` (`finalizeVisibleText`) repara finales colgantes y puntuación, pero no garantiza que una actividad conserve verbo, datos y pregunta. `ensurePeriod` es `false` por defecto (`:916`), así que muchos textos quedan como fragmentos.
2. **El diagrama no se deriva del ejercicio.** `src/lib/visual-engine/sacrint/diagrams.ts:273` y siguientes recolectan objetivo/contenido/ejemplo/práctica; la selección puede producir un diagrama 2x2 o una función genérica aunque el ejemplo sea una ecuación de una variable. Los slides 6 y 42 lo demuestran.
3. **El QA mide forma, no semántica.** `scripts/qa-sacrint-materials.ts:85-104` escanea patrones editoriales; `:320-333` cuenta palabras; `:416-433` valida geometría y palabras. No verifica correspondencia ejercicio-gráfica, completitud de fórmula, pertinencia del error común ni presencia de consigna.
4. **Las plantillas de infografía son fijas.** Las 12 páginas usan los mismos cuatro bloques, aunque el tema no tenga tabulación; eso fuerza contenido y produce frases como “02 LA TABULACIÓN” sin tabla.
5. **El libro usa figuras/captions genéricos.** `src/lib/visual-engine/visual-asset-manager.ts:370` genera `Figura M${missionIndex}.1 — Representación gráfica conceptual y espacio de tabulación guiada`; no se sustituye por una figura específica del ejercicio.
6. **La extracción de PDF/PPTX no preserva todos los glifos.** Se pierden primas, `≅`, tildes y formatos; por eso aparecen `a/a = b/b = c/c = k`, `Correccion`, `ERROR COMUN` y `!=`.

---

## 8. RECONCILIACIÓN CON ANTIGRAVITY

| Afirmación de Antigravity | Verificación | Conclusión |
|---|---|---|
| “Todos los controles pasaron” | El script `qa-sacrint-materials.ts` no reporta fallos geométricos | Cierto para el script; **no** es un veredicto de calidad |
| “Sin commit” | `HEAD 44926ad3`, árbol limpio | **Falso** para el estado actual |
| “PM3 08: 156 slides, collisions=0, wrapNone=0, 1/2avg=184.3w, 2/2avg=172.2w, missEval=0” | Los conteos son plausibles, pero el contenido sigue truncado | Métricas correctas; calidad **no** demostrada |
| “PDFs rasterLowText=0, findings=0” | `findings=0` significa que no hay patrones del QA, no que no haya errores | Cierto para el QA; **no** para contenido |
| “78/144 actividades sin consigna” (segundo informe) | Nuestro muestreo: 71/72 de Actividad 1 sin `?`, 52/72 <125 caracteres | **Plausible**; el segundo informe acierta |
| “Inspección visual con PNGs” | No existe `qa-regen/` ni PNGs en el workspace | **No verificable** |
| “Tests/build/lint OK” | No ejecutados en esta auditoría | **No verificado** |

### 8.1 Por qué el QA dio verde

El script revisa:

- colisiones de cajas, `wrap="none"`, fuera de límites;
- palabras por diapositiva;
- 2/2 con rúbrica/objetivo;
- errores comunes repetidos más de 2 veces;
- patrones como `Modelo por construir`, `Paso 1: Comprensión…`, dobles puntos, `!=` (solo algunos);
- para 09: poco texto seleccionable o rasterización.

No revisa:

- si la actividad tiene una pregunta o tarea;
- si la conclusión responde al problema;
- si la gráfica corresponde al ejercicio;
- si el error común corresponde al tema;
- si la fórmula está completa;
- si el procedimiento llega al resultado;
- si la figura es específica o genérica;
- si el formato monetario es correcto.

**Conclusión:** el QA es una condición necesaria, no suficiente. Hay que añadir gates semánticos y revisión humana.

---

## 9. PLAN DE REMEDIACIÓN PRIORIZADO

### P0 — Antes de cualquier nuevo despliegue o regeneración

1. **Stripe:** catálogo server-side de precios; eliminar `price`/`planName` del cliente; pruebas de manipulación.
2. **Roles:** impedir que el autoservicio cambie `role`; solo admin; auditoría de cambios.
3. **Dependencias críticas:** subir `next`, `next-auth`, `@auth/core`, `dompurify`; bloquear despliegue si `npm audit --omit=dev` tiene críticos.
4. **Aislamiento multi-tenant:** corregir expedientes, analytics school/zone, auditorías y PDF editorial; agregar pruebas cross-tenant.
5. **RLS:** `set_config` por request/transacción; políticas en tablas con `teacher_id`/`school_id`; pruebas con dos usuarios.
6. **Crons:** fail-closed si falta `CRON_SECRET`.

### P1 — Antes de producción estable

7. **Idempotencia:** incluir `teacher_id` y ownership de `planningId`.
8. **Notificaciones:** destinatario server-side; escapar HTML; rate limit.
9. **XSS/SSRF:** sanitizar HTML/SVG; allowlist de imágenes; bloquear IPs privadas.
10. **Dependencias altas:** `pdfjs-dist`, `xlsx` (aislar/reemplazar), `sharp`, `pptxgenjs`, `zod`, `@vercel/blob`, `undici`, toolchain.
11. **Hardcodeo:** eliminar fallbacks de CCT/municipio; un solo proveedor de contexto; i18n real o declarar monolingüe.
12. **Tipado:** reducir `any` en rutas críticas; reemplazar `catch {}` por manejo observable.

### P2 — Calidad editorial

13. **QA semántico:** añadir reglas que fallen si:
   - una actividad no tiene verbo/pregunta;
   - una conclusión no contiene resultado o decisión;
   - una gráfica no coincide con la ecuación;
   - una fórmula no está completa;
   - un error común no corresponde al tema;
   - una figura es genérica;
   - hay `$X,$Y`, `!=`, `:---`, `Correccion`, `ERROR COMUN`, etc.
14. **Corregir generadores:** fitter que preserve consigna; diagramas derivados del ejercicio; figuras específicas; plantillas de infografía condicionales.
15. **Regenerar PM3** solo después de P0/P1/P2 y revisar manualmente 100% de 08/09 y una muestra estratificada de 06/04/03.

### Criterios de aceptación

- `npm audit --omit=dev --audit-level=high` sin críticos/altos, o excepción documentada y mitigada (`xlsx`).
- Pruebas cross-tenant: docente A no puede leer datos de docente B; director A no puede leer CCT B; supervisor A no puede leer zona B.
- Stripe: precio manipulado no altera el cobro.
- Rol: docente no puede autoasignarse `director`/`supervisor`.
- Materiales: 0 actividades sin consigna; 0 gráficas desalineadas; 0 fórmulas incompletas; 0 `$X,$Y`; 0 `!=`; 0 Markdown crudo; 0 figuras genéricas en 06/08/09.
- QA: el script falla ante los defectos anteriores y adjunta evidencia visual (PNG por página/slide).

---

## 10. MENSAJE RECOMENDADO PARA ANTIGRAVITY

> Antigravity: no regeneres todavía. El QA actual pasa porque mide geometría, conteos y patrones, no contenido. Antes de volver a generar:
>
> 1. Corrige las actividades truncadas o sin consigna; cada actividad debe tener verbo, datos y pregunta.
> 2. Corrige el `ERROR COMÚN` para que corresponda al tema; no uses el título como error.
> 3. Haz que la gráfica corresponda al ejercicio; no inventes una segunda ecuación ni cambies el horizonte.
> 4. Corrige las infografías: fórmulas completas, Unicode, títulos, procedimiento y gráfica coherente.
> 5. Corrige el libro: Markdown crudo, `!=`, semáforos cortados y figuras que no correspondan.
> 6. Corrige el solucionario: números huérfanos y ejercicios genéricos.
> 7. Añade gates semánticos al QA y adjunta PNGs de evidencia.
> 8. Aclara el estado de commit/push y no declares “todo pasó” sin revisión humana.
>
> El objetivo no es que el QA pase; es que el material enseñe.

---

## 11. ANEXO: EVIDENCIA Y COMANDOS

### 11.1 Estado del repositorio

```text
HEAD 44926ad3e1d1eef2dde8f04ac4375103dea1b494
main
git status --short: (sin salida)
```

### 11.2 Dependencias

```text
npm audit --omit=dev
critical: 4
high: 13
moderate: 3
low: 2
total: 22
```

### 11.3 Materiales

- `08_Presentaciones_SACRINT_pensamiento_matematico_iii_pen.pptx`: 156 slides; 72 de 1/2; 72 de 2/2.
- `09_Infografias_Sinteticas_pensamiento_matematico_iii_pen.pdf`: 12 páginas.
- `06_Libro_de_Texto_Semestral_Consolidado_pensamiento_matematico_iii_pen.pdf`: 150 páginas.
- `04_Solucionario_Docente_Compilado_pensamiento_matematico_iii_pen.pdf`: 80 páginas; 598 números huérfanos.
- `03_Planes_de_Clase_Compilado_pensamiento_matematico_iii_pen.pdf`: 100 páginas; 54/72/216 repeticiones.
- `05_Guias_de_Practica_Compilado_pensamiento_matematico_iii_pen.pdf`: 72 páginas; 7 `Ejercicio 1.:`.
- `07_Instrumentos_de_Evaluacion_Compilado_pensamiento_matematico_iii_pen.pdf`: 6 páginas; 6 pies `Página 1 de 1`.
- `01_Planeacion_Didactica_Semestral...pdf`: 12 páginas.
- `02_Secuencia_Didactica...pdf`: 14 páginas.

### 11.4 Limitaciones finales

- No se ejecutó explotación real de las vulnerabilidades.
- No se ejecutaron tests/build/lint.
- No se rasterizaron todas las páginas; los hallazgos visuales son de texto/estructura.
- Los conteos de hardcodeo son señales, no una lista de defectos individuales.

---

**Fin del informe.**
