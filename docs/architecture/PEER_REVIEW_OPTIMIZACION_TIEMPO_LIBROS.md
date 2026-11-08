# Peer Review y Arquitectura de Optimización de Tiempo de Generación de Libros

**Proyecto:** SIGPDA-EMS (MCCEMS 2026-2027)  
**Componente:** Motor Editorial de Libros-Cuaderno de Trabajo Activo (`src/lib/guide-engine/`)  
**Estado:** Implementado y Verificado

---

## 1. Diagnóstico Forense (Evidencia en Código)

### 1.1 Causas reales de la latencia de ~22 minutos y retroceso de la barra de progreso
1. **Ejecución en serie y mega-llamadas por redactor**:
   - Los 4 redactores (`foundation`, `lab`, `project`, `evaluation`) se ejecutaban secuencialmente con esperas fijas (`STAGGER_DELAY_MS = 4500`).
   - Cada redactor solicitaba la narrativa de la misión **más** todos sus `sessionPlans` (hasta 8-9 sesiones de ~1,100 palabras cada una, ~14,000 tokens de salida) en una sola llamada de `maxTokens: 16384`.
   - En asignaturas de 4 h/semana (24 sesiones por bloque), las misiones de `lab` y `project` rozaban el límite de salida, provocaban truncación o tardaban >80 s por llamada, y cualquier sesión omitida disparaba reintentos completos de la misión.
2. **Retroceso visual de la barra de progreso (`92 % → 45 % → 10 %`)**:
   - Cuando la suma de llamadas excedía `JOB_MAX_DURATION_SECONDS` (270 s), `job-worker.ts` abortaba la ejecución y `requeueGenerationJob` forzaba `progress = 45`.
   - `updateGenerationJobProgress` y `updateWorkbookProgress` sobrescribían el porcentaje sin `GREATEST`, por lo que al reanudar un job encolado el orquestador volvía a reportar `10 % → 20 % → 30 %`.
3. **Reparación tardía de alineación dura (Fase 8.5 al 92 %)**:
   - Aunque los redactores ya recibían `buildPlanningAlignmentPrompt(...)`, cuando `evaluatePlanningContentAlignment` detectaba términos faltantes al 92 %, la Fase 8.5 re-ejecutaba el redactor completo desde cero en lugar de inyectar preventivamente la lista determinista de términos extraídos y reparar únicamente la sesión deficiente.

---

## 2. Arquitectura Implementada (Agnóstica a la Asignatura)

### Fase 1 — Progreso Monótono E2E (`GREATEST` + alcance por `jobId`)
- **[generation-jobs.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/db/generation-jobs.ts)**:
  - `updateGenerationJobProgress` utiliza `GREATEST(COALESCE(progress, 0), ${progress}::int)`.
  - `requeueGenerationJob` conserva el máximo progreso alcanzado (`GREATEST(COALESCE(progress, 0), ${progress}::int)`).
- **[workbooks.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/db/workbooks.ts)**:
  - `updateWorkbookProgress` preserva atómicamente el mayor `percent` dentro del mismo `jobId` y permite reiniciar limpiamente cuando inicia un nuevo `jobId` o cuando la fase es `'failed'`.
- **[PlanningDetailClient.tsx](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/app/[locale]/planeacion/[id]/PlanningDetailClient.tsx)**:
  - El polling del cliente aplica `Math.max(cur.progress?.percent ?? 0, statusData.progress || 10)`.

### Fase 2 — Planificador de Concurrencia Acotada y Checkpoints Serializados
- **[writer-scheduler.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/guide-engine/writer-scheduler.ts)**:
  - Semáforo global `maxConcurrency = clamp(activeKeys, 1, 4)` alimentado por `getActiveKeyPoolSize` de [index.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/ai-provider/index.ts).
  - Jitter aleatorio (0–250 ms) antes de cada lanzamiento y **circuit breaker compartido** ante errores transitorios (`503 UNAVAILABLE` / `429 RESOURCE_EXHAUSTED`).
- **[block-guide-orchestrator.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/guide-engine/block-guide-orchestrator.ts)** y **[job-worker.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/job-worker.ts)**:
  - Los 4 redactores se lanzan en paralelo con `Promise.allSettled` bajo el `scheduler` compartido.
  - Cola/mutex de persistencia de checkpoints con snapshots inmutables y fusión determinista por `WriterOutput['type']` (cero *lost updates*).

### Fase 3 — Sharding por Paquetes de Sesiones y Reparación Quirúrgica de Densidad
- **[session-shard.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/guide-engine/writers/session-shard.ts)**:
  - `shardSessions(coveredSessions, packSize = 3)` divide las sesiones de cada misión en paquetes equilibrados de 2–3 sesiones (ej. 8 sesiones → `[3, 3, 2]`, 4 sesiones → `[2, 2]`).
  - Cada redactor ([foundation-writer.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/guide-engine/writers/foundation-writer.ts), [lab-writer.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/guide-engine/writers/lab-writer.ts), [project-writer.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/guide-engine/writers/project-writer.ts), [evaluation-writer.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/guide-engine/writers/evaluation-writer.ts)) ejecuta en paralelo:
    1. Una llamada ligera para la narrativa de la misión (`maxTokens: 8192`).
    2. `generateShardedSessionPlans` para los paquetes de 2–3 sesiones (`maxTokens: 8192` por paquete).
  - `evaluateSessionPlanDensity` valida cada sesión individualmente (extensión de `contenido`, bloques discursivos, pasos de `ejemploResuelto`, `practica` con pista y solución, y palabras totales) y regenera **únicamente la sesión deficiente**.

### Fase 4 — Alineación Preventiva y Reparación Quirúrgica en Fase 8.5
- **[planning-content-alignment.ts](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/guide-engine/planning-content-alignment.ts)**:
  - `extractRequiredCurricularTerms` y `partitionRequiredTerms` extraen los términos clave y materiales de la planeación con el mismo algoritmo del evaluador y los inyectan desde la primera pasada (`requiredTerms`) tanto en la narrativa como repartidos entre los paquetes de sesiones (`distributeTermsAcrossPacks`).
  - Si en la Fase 8.5 aún falta algún término, `assignTermsToSessions` asigna los términos faltantes a las sesiones más afines y `applySurgicalSessionRepair` regenera **solo las sesiones señaladas**, preservando intactos el resto de planes y la narrativa de la misión.

---

## 3. Invariantes de Calidad Preservados
- **Cero Hardcoding**: Toda la extracción de términos, partición de sesiones y cálculo de presupuestos opera dinámicamente a partir de `PlanningActivities`, `DetailedSession` y `ContentBudget` para cualquier UAC de BGE o BT (6, 18, 24, 30+ sesiones).
- **Gate Fail-Closed Intacto**: Se mantienen íntegros los controles de `fallbackWords === 0`, cobertura total de sesiones, presupuesto de palabras, `validateBlockCrossContamination` y `evaluatePlanningContentAlignment`.

