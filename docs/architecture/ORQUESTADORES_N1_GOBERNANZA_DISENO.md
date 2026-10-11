# PLAN DE DISEÑO Y ARQUITECTURA: ORQUESTADORES N1 Y GOBERNANZA STRANGLER FIG
## Suite Editorial a Escala y Producción Automatizada de Contenido (Gate 0)

> **Documento Oficial de Arquitectura — Gate 0**  
> **Sistema**: SIGPDA-EMS DBEPA Puebla (Ciclo Escolar 2026–2027)  
> **Área**: Plataforma Nivel 2 y Orquestadores Centrales Nivel 1  
> **Estado**: Propuesta de Diseño para Aprobación  
> **Auditoría Receptora**: OpenCode / SACRINT Systems IA  

---

## 1. Visión Ejecutiva y Justificación

Tras el cierre y dictamen **APTO** de la Suite Editorial (Fases 0 a 6: Tipografía Lato/Montserrat, Iconografía vectorial offline de 10 iconos, Process Flow Banners, Step Cards unificadas y catálogo exhaustivo de 244 materiales PNG a 512×512 px), el cuello de botella del sistema ya no radica en la capa estética ni en los primitivos de renderizado, sino en la **capacidad de producción masiva y estructurada de contenido pedagógico**.

Para competir en volumen, rigor y fidelidad editorial frente a modelos institucionales consolidados (como los Cuadernos de Trabajo y Secuencias Didácticas de CECyTE), SIGPDA-EMS requiere habilitar sus **Orquestadores Centrales Nivel 1** bajo el patrón **Strangler Fig** y la gobernanza estricta definida en `AGENTS.md`.

Este documento constituye el **Gate 0 de Diseño y Arquitectura**, estableciendo el plan por fases, la resolución del backlog de deuda técnica previa (F-13 / F-14) y la hoja de ruta de implementación quirúrgica.

---

## 2. Los 3 Criterios de Gobernanza Formal (AGENTS.md)

Cualquier trabajo sobre los Orquestadores N1 se rige de manera obligatoria por los tres criterios institucionales de gobernanza:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CRITERIOS DE GOBERNANZA N1                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  [G1] Banderas Seguras por Defecto                                         │
│       - Todas las feature flags N1 (PLANEACION_ORCHESTRATOR_V2, etc.)       │
│         operan con valor predeterminado 'false' en código.                  │
│       - El sistema productivo preserva 100% de operatividad en rutas legacy.│
├─────────────────────────────────────────────────────────────────────────────┤
│  [G2] Paridad Funcional Absoluta y Cero Silent Stubs (Política B-001)       │
│       - Prohibido simular éxito con objetos vacíos o mocks silenciosos.      │
│       - La rama migrada del orquestador debe responder exactamente los      │
│         mismos esquemas JSON y códigos HTTP canónicos (200, 400, 404, 422), │
│         mapeando caídas de upstream de IA a 503 en la capa de resiliencia.  │
│       - Métodos fuera de alcance de una fase lanzan explícitamente 501.     │
├─────────────────────────────────────────────────────────────────────────────┤
│  [G3] Validación de Métrica Verificada y Sondeo Honesto (B-002 / C-001)     │
│       - La activación de una bandera requiere prueba de carga comparativa    │
│         de latencia (p95/p99) y ausencia de regresiones.                    │
│       - healthCheck() debe verificar dependencias reales (DB, IA, Flags)    │
│         sin tautologías en /api/platform/health.                            │
│       - Aprobación explícita previa a cualquier conmutación en producción.  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chore Inicial: Backlog de Deuda Técnica (F-13 / F-14)

Antes de iniciar la expansión de capacidades en los orquestadores, se aborda como chore de saneamiento inicial el backlog P3 pendiente:

### 3.1 Hallazgo F-13: Fallback STEM Determinista en `pdf-workbook-renderer.ts:2141`
- **Diagnóstico**: En `src/lib/pdf-workbook-renderer.ts`, la sección 2.1 gestiona imágenes y diagramas para asignaturas STEM (Matemáticas, Física, Química, Biología). Si `resolveVisualForMission` no encuentra un asset o falla la lectura de un PNG de material, la rama STEM carece de un fallback sintético determinista, dejando potencialmente un espacio en blanco. En contraste, la rama NO-STEM (línea 2243) sí cuenta con un fallback a `dispatchVisual(...)` + `svgToPngBuffer(...)`.
- **Solución Quirúrgica**: Incorporar en la rama STEM el fallback determinista Capa 0 (`dispatchVisual` con diagrama vectorial matemático/científico y tabulación guiada) en caso de que el asset de material no exista o el vector primario resulte nulo.
- **Invariante**: Ningún capítulo o misión STEM del cuaderno de trabajo se emitirá con huecos visuales por fallas de resolución de assets.

### 3.2 Hallazgo F-14: Blindaje Documental y Estabilidad de Pruebas
- **Diagnóstico**: Garantizar que todas las suites de prueba unitarias operen con 100% de aislamiento y determinismo en entornos locales y CI, asegurando que los tests condicionales (como fixtures de PDFs de planteles reales) reporten claramente su estatus sin generar advertencias espurias.
- **Acción**: Documentar el inventario de fixtures y verificar que el test runner mantenga 0 flakes con `npm test`.

---

## 4. Arquitectura de los Orquestadores N1 para Producción a Escala

La meta principal es dotar al **Orquestador de Planeaciones (`PlaneacionOrchestrator`)** de la capacidad de coordinar la generación y ensamble de unidades curriculares completas, integrando el motor visual y los estándares DBEPA Puebla / MCCEMS.

```
                                  PETICIÓN DEL DOCENTE / API
                                              │
                                              ▼
                             ┌───────────────────────────────────┐
                             │    FeatureFlagService             │
                             │    PLANEACION_ORCHESTRATOR_V2     │
                             └───────────────┬───────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
                 [flag = false]                               [flag = true]
                       │                                           │
                       ▼                                           ▼
             Controlador Legacy                         PlaneacionOrchestrator (N1)
             /api/planeaciones/...                      - evaluate() [Anexo 12]
                                                        - buildSequence() [MCCEMS]
                                                        - generate() [Tres Saberes / Reto]
                                                        - renderPDF() [Lato/Montserrat]
                                                                   │
                                                ┌──────────────────┴──────────────────┐
                                                ▼                                     ▼
                                       PlanningPdfRenderer                   PdfWorkbookRenderer
                                       (Planeación Didáctica)                (Libro del Estudiante)
                                       - Motor Visual SSoT                   - Misiones Didácticas
                                       - Iconografía Vectorial               - Diagramas STEM
                                       - Fuentes Editoriales                 - Step Cards y Banners
```

### 4.1 Métodos del Contrato `IPlaneacionOrchestrator` a Habilitar

> **Nota de Refirmado (F-41)**: En la Fase 1 se refirma formalmente la interfaz `IPlaneacionOrchestrator` (cuyas firmas vigentes son `buildSequence(id: string): Promise<Record<string, unknown>>` y `generate(): Promise<Record<string, unknown>>` sin argumentos) y se auditan exhaustivamente todos los consumidores de la interfaz (`src/__tests__/planeaciones-orchestrator.test.ts`, etc.) para asegurar compatibilidad y tipado estricto.

| Método | Entrada Vigente → Nueva (Fase 1) | Salida | Propósito y Contrato |
| :--- | :--- | :--- | :--- |
| `evaluate(input)` | `InputEvaluacion` | `ResultadoEvaluacion` | **Implementado y operando**. Evaluación rúbrica Anexo 12 USICAMM. |
| `buildSequence(...)` | `id: string` → `SecuenciaInput` | `SecuenciaDidacticaDTO` | **Fase 1 (Refirmado)**. Construcción de secuencias didácticas (Apertura, Desarrollo, Cierre), articulación con Progresiones y Reto Situado 4/4. |
| `generate(...)` | `void` → `PlaneacionGenInput` | `PlaneacionDTO` | **Fase 1 (Refirmado)**. Generación completa de planeación con Tres Saberes (Saber, Saber Hacer, Saber Ser/Convivir) y transversalidad PAEC. |
| `renderPDF(id)` | `string` (UUID) | `Buffer` | **Fase 2**. Renderizado tipográfico editorial a PDF oficial con `planning-pdf-renderer.ts`, fuentes Lato/Montserrat e iconografía vectorial offline. |
| `healthCheck()` | — | `HealthCheckResult` | **Implementado**. Sondeo honesto de Neon DB, credencial de IA y Feature Flags. |

---

## 5. Plan de Ejecución por Fases (1 Commit por Fase, Protocolo Estricto)

Para mantener la estabilidad absoluta en producción y cumplir las reglas de SIGPDA-EMS, cada fase se ejecutará de forma atómica:

### Fase 0 — Chore Inicial (Remediación F-13 y F-14)
- **Alcance**: `src/lib/pdf-workbook-renderer.ts` (línea 2162–2230).
- **Acción**: Añadir fallback sintético determinista Capa 0 con `dispatchVisual` en la rama STEM.
- **Gates**: `tsc --noEmit`, `eslint`, `npm test`, `npm run build`, byte 10.
- **Commit**: `fix(visual-engine): add deterministic stem fallback in workbook renderer (F-13, F-14)`.

### Fase 1 — Planeaciones N1: Generación y Secuenciación Didáctica
- **Alcance**: `src/lib/planeaciones/orchestrator.ts` y pruebas unitarias en `src/__tests__/planeaciones-orchestrator.test.ts`.
- **Acción**: Refirmar `IPlaneacionOrchestrator`, auditar consumidores, e implementar `buildSequence()` y `generate()` conectando con los esquemas de validación `SecuenciaGenerateInputSchema` y `SecuenciaUpdateInputSchema` de `@/lib/ai-schemas` (F-40), garantizando el cumplimiento de la política B-001 (sin stubs silenciosos).
- **Gates**: `tsc --noEmit`, `eslint`, `npm test`, `npm run build`, byte 10.
- **Commit**: `feat(planeaciones): implement sequence building and planning generation in orchestrator (Phase 1)`.

### Fase 2 — Planeaciones N1: Renderizado Editorial Tipográfico
- **Alcance**: `src/lib/planeaciones/orchestrator.ts`, delegación en `planning-pdf-renderer.ts`.
- **Acción**: Implementar `renderPDF()` para generar el documento de planeación con fuentes Lato/Montserrat y motor vectorial offline de forma determinista.
- **Gates**: `tsc --noEmit`, `eslint`, `npm test`, `npm run build`, byte 10.
- **Commit**: `feat(planeaciones): implement editorial pdf rendering in planeaciones orchestrator (Phase 2)`.

### Fase 3 — Gobernanza Strangler Fig, Cobertura y Verificación de Paridad
- **Alcance**: `src/__tests__/planeaciones-orchestrator.test.ts` y rutas de consumo.
- **Acción**: Tests exhaustivos de conmutación de bandera (`PLANEACION_ORCHESTRATOR_V2 = true / false`), verificación de códigos de estado HTTP y mutaciones falsables anti-F11.
- **Gates**: `tsc --noEmit`, `eslint`, `npm test`, `npm run build`, byte 10.
- **Commit**: `test(planeaciones): complete strangler fig parity and mutation test suite (Phase 3)`.

---

## 6. Matriz de Riesgos y Procedimiento de Contingencia

| Riesgo | Probabilidad | Impacto | Mitigación Inmediata |
| :--- | :--- | :--- | :--- |
| Regresión en flujos legacy de docentes en producción | Nula | Alto | La feature flag `PLANEACION_ORCHESTRATOR_V2` permanece en `false` por defecto (Criterio G1). |
| Latencia excesiva en generación de secuencias | Baja | Medio | Timeout budget global unificado de 90s (`withTimeoutBudget`) y reintento correctivo. |
| Inconsistencia de formato en PDF de planeación | Nula | Medio | Monkey-patch oficial de autoTable y fallback tipográfico D9 a Helvetica si las fuentes fallan. |

**Plan de Rollback**: Al mantener un commit por fase, cualquier desviación se revierte de forma inmediata mediante `git revert <hash>` sin afectar commits previos.

---

## 7. Dictamen Solicitado

Se somete este documento a revisión de **OpenCode / Usuario** para emitir el dictamen del **Gate 0**.
Una vez aprobado, se dará inicio a la **Fase 0 (Chore F-13/F-14)** bajo el protocolo de ejecución estándar.
