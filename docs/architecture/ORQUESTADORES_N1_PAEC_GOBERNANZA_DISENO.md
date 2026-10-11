# PLAN DE DISEÑO Y ARQUITECTURA: ORQUESTADOR N1 PAEC Y GOBERNANZA STRANGLER FIG
## Integración Comunitaria, Diagnóstico Territorial, Auditoría NEM y Producción Editorial (Gate 0)

> **Documento Oficial de Arquitectura — Gate 0**  
> **Sistema**: SIGPDA-EMS DBEPA Puebla (Ciclo Escolar 2026–2027)  
> **Módulo**: Orquestador Central Nivel 1 del Programa Aula Escuela Comunidad (PAEC)  
> **Archivo Central**: [`src/lib/paec/orchestrator.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/paec/orchestrator.ts)  
> **Bandera de Control**: `PAEC_ORCHESTRATOR_V2` (Default `false` en [`src/lib/platform/feature-flags.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/platform/feature-flags.ts))  
> **Estado**: Propuesta de Diseño para Aprobación  
> **Auditoría Receptora**: OpenCode QA / Usuario / SACRINT Systems IA  

---

## 1. Visión Ejecutiva y Justificación Curricular

El **Programa Aula Escuela Comunidad (PAEC)** constituye el eje articulador de la Nueva Escuela Mexicana (NEM) y del Marco Curricular Común de la Educación Media Superior (MCCEMS) en el Estado de Puebla. Conecta el diagnóstico sociodemográfico del entorno local, la problematización comunitaria situada y la articulación curricular transversal de las Unidades de Aprendizaje Curricular (UACs) del Componente Fundamental, Ampliado y Laboral.

Actualmente, las responsabilidades del PAEC se encuentran distribuidas entre múltiples controladores API, librerías de extracción y utilerías de renderizado DOCX/PDF. Para asegurar reproducibilidad determinista, trazabilidad institucional y cero fallas de memoria o timeouts bajo alta concurrencia, SIGPDA-EMS requiere consolidar el **Orquestador Central PAEC V2 (Nivel 1)** implementando el contrato formal `IPaecOrchestrator` / `IProgramSystem`.

La migración se ejecutará bajo el patrón arquitectónico **Strangler Fig**, gobernado de forma estricta por las políticas de `AGENTS.md` y controlado por la feature flag `PAEC_ORCHESTRATOR_V2`.

---

## 2. Los 3 Criterios de Gobernanza Formal (AGENTS.md)

Toda implementación sobre el Orquestador PAEC N1 se rige de manera obligatoria por los tres criterios institucionales de gobernanza:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CRITERIOS DE GOBERNANZA PAEC N1                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  [G1] Banderas Seguras por Defecto                                         │
│       - La feature flag PAEC_ORCHESTRATOR_V2 opera en 'false' en código     │
│         fuente (src/lib/platform/feature-flags.ts).                         │
│       - La producción permanece 100% operativa sobre controladores legacy. │
├─────────────────────────────────────────────────────────────────────────────┤
│  [G2] Paridad Funcional Absoluta y Cero Silent Stubs (Política B-001)       │
│       - Prohibido simular éxito con objetos vacíos {} o listas vacías [].   │
│       - Métodos pendientes lanzan explícitamente PaecOrchestratorError(501).│
│       - Paridad estricta de esquemas Zod y códigos HTTP (200, 400, 401,     │
│         403, 404, 500, 503 ante caídas de IA upstream).                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  [G3] Validación de Métrica Verificada y Sondeo Honesto (B-002 / C-001)     │
│       - Toda conmutación requiere smoke test adversarial con planteles.     │
│       - healthCheck() debe reportar honestamente el estado de DB, IA y flags│
│         sin respuestas tautológicas ni hardcodeadas.                        │
│       - Ninguna activación sin runbook formal y firma del usuario.          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Invariantes del Dominio PAEC (Políticas Técnicas Obligatorias)

1. **Presupuesto Temporal Unificado de 90s (D-001)**:
   - Todas las llamadas de IA de extracción, generación o auditoría se ejecutan mediante `withTimeoutBudget(promise, budgetMs)` con cota máxima de 90,000 ms para prevenir errores 504 Gateway Timeout de proxies o Vercel.
2. **Reintento Correctivo Tipado (`correctiveRetry`)**:
   - Si la respuesta del modelo no satisface el esquema Zod estructurado, se ejecuta un reintento con realimentación del error exacto de validación antes de arrojar excepción.
3. **Manejo de Errores con `PaecOrchestratorError`**:
   - Errores de negocio y validación arrojan `PaecOrchestratorError(message, status)` con mapeo semántico directo a códigos HTTP.
4. **Resiliencia ante Caídas de Proveedores de IA (`isUpstreamAIError`)**:
   - Agotamiento de cuotas, timeouts de socket o indisponibilidad de la API se mapean deterministamente a HTTP 503 (`AI_OUTAGE_USER_MESSAGE`).
5. **Cero Stubs Silenciosos (Política B-001)**:
   - Queda terminantemente prohibido retornar estructuras vacías o simuladas en métodos no migrados; deben arrojar ruidosamente HTTP 501 `NOT_IMPLEMENTED`.
6. **Aislamiento Multitenant y Control de Ownership (F-49)**:
   - Todo acceso o descarga de proyectos PAEC valida pertenencia al docente o membresía de la escuela/plantel, retornando HTTP 403 Forbidden ante intentos ajenos no administrativos.

---

## 4. Estado Actual y Alcance Técnico de `src/lib/paec/orchestrator.ts`

El archivo [`src/lib/paec/orchestrator.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/paec/orchestrator.ts) define la interfaz `IPaecOrchestrator`:

```typescript
export interface IPaecOrchestrator extends IProgramSystem {
  ingestPrevious(
    buffer: Buffer,
    options: PaecIngestOptions
  ): Promise<PaecExtractionSuccess<PaecPreviousExtractDTO>>;
  generateProject(): Promise<Record<string, unknown>>;
  auditProject(): Promise<Record<string, unknown>>;
  renderDOCX(): Promise<Buffer>;
  renderPDF(): Promise<Buffer>;
}
```

### 4.1 Métodos y Estatus Actual

| Método | Estatus Actual | Comportamiento Vigente | Plan de Migración |
| :--- | :--- | :--- | :--- |
| `ingestPrevious(...)` | **Completado y Operando** | Extrae y estructura proyectos previos (PDF OCR / DOCX) con chunking, `PaecPreviousExtractSchema` y presupuesto de 90s. | Mantenimiento y optimización de tokens. |
| `generateProject(...)` | **Pendiente (501 Ruidoso)** | Lanza `PaecOrchestratorError(..., 501)` cumpliendo B-001. | **Fase 1**: Generación multidimensional por fases comunitarias. |
| `auditProject(...)` | **Pendiente (501 Ruidoso)** | Lanza `PaecOrchestratorError(..., 501)` cumpliendo B-001. | **Fase 2**: Auditoría de pertinencia NEM, transversalidad y evidencias. |
| `renderDOCX(...)` | **Pendiente (501 Ruidoso)** | Lanza `PaecOrchestratorError(..., 501)` cumpliendo B-001. | **Fase 3**: Renderizado binario DOCX con membrete oficial SEP/DGB. |
| `renderPDF(...)` | **Pendiente (501 Ruidoso)** | Lanza `PaecOrchestratorError(..., 501)` cumpliendo B-001. | **Fase 3**: Renderizado binario PDF con fuentes oficiales y diseño Carta. |
| `healthCheck()` | **Completado** | Sondea `DATABASE_URL`, `GEMINI_API_KEY` y `isFeatureEnabled`. | Monitoreo continuo de salud del subsistema. |
| `getMetrics(tenantId)`| **Completado** | Reporta estado de banderas y versiones a plataforma Nivel 2. | Telemetría operativa. |

---

## 5. Plan de Ejecución Propuesto por Fases (Falsables con Mutaciones Anti-F11)

Cada fase se ejecutará de forma atómica en **un solo commit**, con paso obligatorio por los 4 gates del repositorio (`tsc`, `eslint`, `vitest`, `build`) y verificación de mutaciones load-bearing anti-F11.

```
       ┌──────────────────────────────────────────────────────────────────┐
       │   FASE 1: Generación Integral de Proyecto Comunitario PAEC       │
       │   (generateProject con esquemas Zod y presupuesto 90s D-001)     │
       └────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │   FASE 2: Motor de Auditoría y Alineación Curricular NEM/MCCEMS  │
       │   (auditProject con rúbrica sociocrítica y scoring objetivo)     │
       └────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │   FASE 3: Renderizado Editorial Oficial en Servidor (DOCX y PDF) │
       │   (renderDOCX + renderPDF con fuentes oficiales y membretes)     │
       └────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │   FASE 4: Gobernanza Strangler Fig en Rutas API y Control 403    │
       │   (Feature-detection 501, paridad HTTP y ownership docente)      │
       └──────────────────────────────────────────────────────────────────┘
```

---

### Fase 1: Generación y Estructuración de Proyecto PAEC (`generateProject`)
- **Archivos a intervenir**:
  - `src/lib/paec/orchestrator.ts`
  - `src/lib/prompts/paec-generation.ts` (esquemas y prompts estructurados)
  - `src/__tests__/paec-orchestrator.test.ts`
- **Alcance Técnico**:
  - Implementar `generateProject(input: PaecGenerationInput): Promise<PaecProjectDTO>`.
  - Desglose por dimensiones: Diagnóstico territorial contextualizado, Problematización comunitaria priorizada, Articulación transversal con UACs, Propósito y Metodología sociocrítica (ABP, AS, STEAM), Cronograma operativo y Mecanismos de evaluación comunitaria.
  - Validación defensiva de entradas con Zod y cota máxima de presupuesto de 90s (`withTimeoutBudget`).
- **Comando de Verificación**:
  ```bash
  npx vitest run src/__tests__/paec-orchestrator.test.ts
  ```
- **Mutación Load-Bearing Anti-F11 (MUT-PAEC-1)**:
  - *Mutación*: Forzar que la generación retorne un proyecto sin articulación curricular (`uacsArticuladas: []` o `undefined`).
  - *Comportamiento esperado*: El test DEBE fallar inmediatamente reportando violación de contrato y rechazando persistir un proyecto no alineado a la NEM.

---

### Fase 2: Motor de Auditoría y Alineación NEM/MCCEMS (`auditProject`)
- **Archivos a intervenir**:
  - `src/lib/paec/orchestrator.ts`
  - `src/lib/paec/evaluator.ts`
  - `src/__tests__/paec-orchestrator.test.ts`
- **Alcance Técnico**:
  - Implementar `auditProject(projectId: string): Promise<PaecAuditReportDTO>`.
  - Evaluación objetiva de 5 dimensiones normativas:
    1. Pertinencia del diagnóstico sociodemográfico (INEGI/comunidad).
    2. Rigor de la problematización situada.
    3. Coherencia de la metodología activa sociocrítica.
    4. Efectividad de la transversalidad con los programas de estudio.
    5. Viabilidad de las evidencias y productos integradores comunitarios.
  - Cálculo de puntaje 0–100, identificación de banderas de riesgo pedagógico y recomendaciones accionables.
- **Comando de Verificación**:
  ```bash
  npx vitest run src/__tests__/paec-orchestrator.test.ts
  ```
- **Mutación Load-Bearing Anti-F11 (MUT-PAEC-2)**:
  - *Mutación*: Alterar el evaluador para que devuelva puntaje 100/100 ante un proyecto con problemática vacía o genérica.
  - *Comportamiento esperado*: El test DEBE fallar ruidosamente, verificando que la dimensión de problematización aplica una penalización mínima de 25 puntos ante diagnósticos incompletos.

---

### Fase 3: Renderizado Editorial Oficial en Servidor (`renderDOCX` y `renderPDF`)
- **Archivos a intervenir**:
  - `src/lib/paec/orchestrator.ts`
  - `src/lib/docx/paec-docx-renderer.ts`
  - `src/lib/pdf/paec-pdf-renderer.ts`
  - `src/__tests__/paec-orchestrator.test.ts`
- **Alcance Técnico**:
  - Implementar `renderDOCX(projectId: string): Promise<Buffer>` y `renderPDF(projectId: string): Promise<Buffer>`.
  - Integración de membretes oficiales de la Subsecretaría de Educación Media Superior de Puebla y DGB.
  - Tipografía oficial institucional, tablas de articulación de UACs sin desbordes y código QR de autenticidad institucional.
- **Comando de Verificación**:
  ```bash
  npx vitest run src/__tests__/paec-orchestrator.test.ts
  ```
- **Mutación Load-Bearing Anti-F11 (MUT-PAEC-3)**:
  - *Mutación*: Retornar un buffer simulado menor a 8,000 bytes o sin cabecera binaria `%PDF` / estructura de paquete ZIP/DOCX válida.
  - *Comportamiento esperado*: El test DEBE fallar inmediatamente comprobando cabeceras mágicas y tamaño editorial mínimo garantizado.

---

### Fase 4: Gobernanza Strangler Fig en Rutas API y Control de Ownership (F-49)
- **Archivos a intervenir**:
  - `src/app/api/paec/[id]/route.ts`
  - `src/app/api/paec/[id]/generate-step/route.ts`
  - `src/app/api/paec/[id]/audit/route.ts`
  - `src/app/api/docx/paec/[id]/route.ts`
  - `src/app/api/pdf/paec/[id]/route.ts`
  - `src/lib/paec/strangler-client.ts` (helper de cliente con feature-detection por 501)
  - `src/__tests__/paec-routes-orchestrator.test.ts`
- **Alcance Técnico**:
  - Delegación condicional mediante `isFeatureEnabled('PAEC_ORCHESTRATOR_V2')`.
  - Si flag está en `false`, las rutas retornan HTTP 501 para exportaciones en servidor o continúan su ejecución legacy probada.
  - Validación de ownership F-49: si el usuario no es el creador del proyecto ni es administrador escolar, retorno estricto de HTTP 403 Forbidden.
  - Respuestas tipadas con mensajes descriptivos ante 401, 403, 404 y 400.
- **Comando de Verificación**:
  ```bash
  npm test && npm run build
  ```
- **Mutación Load-Bearing Anti-F11 (MUT-PAEC-4)**:
  - *Mutación*: Suprimir la comprobación de ownership en la ruta de exportación PDF o DOCX.
  - *Comportamiento esperado*: El test de acceso cruzado entre docentes DEBE fallar por no arrojar HTTP 403 Forbidden.

---

## 6. Matriz de Riesgos y Procedimiento de Contingencia

| Riesgo | Probabilidad | Impacto | Mitigación Inmediata |
| :--- | :--- | :--- | :--- |
| Regresión en proyectos PAEC existentes en producción | Nula | Alto | La bandera `PAEC_ORCHESTRATOR_V2` permanece inactiva (`false`) por defecto (Criterio G1). |
| Timeout en generación por diagnósticos territoriales extensos | Baja | Medio | Presupuesto temporal estricto de 90s (`withTimeoutBudget`, D-001) y chunking particionado. |
| Disparidad de formatos en plantillas docentes locales | Media | Bajo | Generación dual DOCX/PDF con esquema formal MCCEMS y preservación de descargas legacy. |
| Inconsistencias de permisos entre escuelas de la misma zona | Baja | Alto | Aislamiento estricto por `school_id` y `teacher_id` con validación 403 (F-49). |

### Procedimiento de Rollback Inmediato (< 2 Minutos)
1. **Conmutación de Bandera**: Establecer `PAEC_ORCHESTRATOR_V2: false` en [`src/lib/platform/feature-flags.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/platform/feature-flags.ts).
2. **Reversión de Git**: Ejecutar `git revert <hash-fase> --no-edit` y compilar.
3. **Verificación de Aislamiento**: Verificar que las rutas responden con el circuito legacy probado o código 501 sin degradar la UI.

---

## 7. Dictamen de Auditoría y Control de Puertas (Gate 0)

| Hito / Dimensión | Estatus | Evidencia / Observaciones |
| :--- | :--- | :--- |
| **Gate 0: Propuesta de Diseño PAEC** | **PROPUESTA PARA APROBACIÓN** | Documento completo, falsable y con mutaciones anti-F11 definidas. |
| **Gobernanza G1 (Banderas Seguras)** | **CUMPLIDO** | `PAEC_ORCHESTRATOR_V2 = false` verificado en `feature-flags.ts`. |
| **Gobernanza G2 (Cero Silent Stubs)** | **CUMPLIDO** | Métodos pendientes en `orchestrator.ts` arrojan explícitamente HTTP 501. |
| **Gobernanza G3 (Validación Honesta)** | **PLANIFICADO** | Protocolo de activación condicionado a runbook formal post-Fase 4. |
| **Código de Implementación PAEC** | **CERO LÍNEAS TOCADAS** | Se respeta la regla de diseño puro para el Gate 0 en este commit. |
| **Dictamen de Auditoría Externa / Usuario** | **PENDIENTE DE AUDITORÍA Y FIRMA** | Fila reservada para dictamen formal del revisor / usuario administrador. |

---

> **Compromiso de Arquitectura**: Ninguna implementación de código de las Fases 1 a 4 iniciará hasta que el presente documento de diseño cuente con dictamen favorable y aprobación explícita.
