# SAPCU — Sistema de Asistente Pedagógico Contextual Universal (SACRINT Systems IA)

> **Documento Oficial de Arquitectura e Integración de Fase 4**  
> **Sistema**: SIGPDA-EMS DBEPA Puebla 2026-2027  
> **Marca & Motor**: SACRINT Systems IA  
> **Estado**: Producción (Fase 4 - Cerrada al 100%)

---

## 1. Visión General y Propósito

El **Sistema de Asistente Pedagógico Contextual Universal (SAPCU)** es una infraestructura transversal de inteligencia artificial pedagógica diseñada para acompañar a docentes, directores y supervisores en la totalidad de sus labores institucionales en la plataforma SIGPDA-EMS.

A diferencia de un chatbot genérico o una ventana modal aislada, SAPCU opera como un **copiloto contextual universal no invasivo**:
1. **Conciencia Contextual Automática**: Detecta dinámicamente el programa activo, la pantalla, el documento en edición y el campo en foco sin requerir configuración manual.
2. **Puente Transversal entre 5 Programas**: Comparte y cruza datos entre Planeaciones Didácticas, PAEC-PEC, PMC CREAA, Cartografía de Zona y Horarios Escolares.
3. **Validación Determinista en Tiempo Real**: Aplica reglas normativas oficiales de DBEPA Puebla (Reto Situado 4/4, Tres Saberes, Coherencia Metodológica, Normalización al 100%).
4. **Inserción Directa en Campos (1-Click)**: Permite inyectar las propuestas redactadas por el asistente directamente en los inputs o textareas activos mediante el contrato `InsertionTarget`.
5. **Multi-nivel Educativo Extensible**: Soporta Media Superior (MCCEMS/DBEPA), con contratos preparados para Educación Básica (NEM Fases 1-6) y Educación Superior (SATCA).

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTERFAZ DE USUARIO                               │
│  [Planeaciones]   [PAEC-PEC]   [PMC CREAA]   [Cartografía]   [Horarios]     │
│        ▲               ▲            ▲              ▲              ▲         │
│        └───────────────┴─────┬──────┴──────────────┴──────────────┘         │
│                              │ useAssistant()                               │
│                              ▼                                              │
│          ┌───────────────────────────────────────────────┐                  │
│          │        UniversalPedagogicalAssistant          │                  │
│          │  - Badges de contexto vivo                    │                  │
│          │  - Carrusel de Quick Actions dinámicas        │                  │
│          │  - Historial conversacional interactivo       │                  │
│          │  - Botón de inserción 1-click en foco activo  │                  │
│          └───────────────────────┬───────────────────────┘                  │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                             ESTADO GLOBAL                                   │
│  AssistantProvider (src/components/assistant/AssistantContext.tsx)          │
│  - extractContextFromRoute() / extractDocumentContext()                     │
│  - Dispatcher de inserción bidireccional (registerInsertHandler)            │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                           CAPA DE NEGOCIO                                   │
│  ┌───────────────────────────┐      ┌────────────────────────────────────┐  │
│  │ cross-program-context.ts  │      │ pedagogical-rules-engine.ts        │  │
│  │ - PROGRAM_SYSTEM_REGISTRY │      │ - Reto Situado 4/4 DBEPA           │  │
│  │ - Cross-Program Bridge    │      │ - Tres Saberes (Saber, Hacer, Ser) │  │
│  │ - Relaciones de 5 módulos │      │ - Coherencia Metodológica          │  │
│  └───────────────────────────┘      └────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ prompt-builder.ts (System Prompt Institucional + Context Grounding)   │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │ POST /api/assistant/chat
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                            CAPA DE RED & IA                                 │
│  - Autenticación NextAuth y verificación de rol                             │
│  - Rotación multi-proveedor resiliente (generateWithRotation)               │
│  - Evaluación pedagógica inline post-generación                             │
│  - Respuesta estructurada { mensaje, accionesSugeridas, insercion }         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Integración en los 5 Programas Oficiales

| Programa | Componente Inyector | Contexto Inyectado a SAPCU | Acciones Rápidas Clave |
| :--- | :--- | :--- | :--- |
| **Planeaciones Didácticas** | `PlanningDetailClient.tsx` (Tabs) | `programId: 'planeaciones'`, `uac`, `semestre`, `metodologiaActiva`, `retoSituado`, `paecConnection` | Formular Reto Situado 4/4, Desglosar Tres Saberes, Coherencia Metodológica, Normalizar Evaluación 100% |
| **PAEC-PEC** | `PaecWizardClient.tsx` (Steps 1-9) | `programId: 'paec'`, `pasoActual`, `projectName`, `problemStatement`, `ciclo` | Delimitar Problemática Comunitaria, Articular con Asignaturas, Justificación MIFO |
| **PMC CREAA** | `PmcWizardClient.tsx` (Fases CREAA) | `programId: 'pmc'`, `faseActual`, `schoolName`, `municipality`, `diagnosticoComunidad` | Redactar Meta SMART CREAA, Cronograma Operativo, Alineación con Ámbitos |
| **Cartografía de Zona** | `ModalConfiguracionMapaCurricular.tsx` | `programId: 'cartografia'`, `paso`, `subsistema`, `plantel` | Sintetizar Diagnóstico Territorial, Articulación Interdisciplinar |
| **Horarios Escolares** | `WizardConfiguracion.tsx` (Pasos 1-3) | `programId: 'horarios'`, `paso`, `periodoActivo`, `escuelaId` | Optimización Pedagógica Antifatiga, Validación de Carga por UAC |

---

## 4. Motor de Reglas Pedagógicas (DBEPA Puebla 2026-2027)

El motor pedagógico (`src/lib/assistant/pedagogical-rules-engine.ts`) evalúa de forma determinista y sin alucinaciones los requisitos clave de la normativa:

### 4.1. Reto Situado 4/4
Debe satisfacer los 4 componentes estructurales de la Nueva Escuela Mexicana en Educación Media Superior:
1. **Contexto Real / Territorial**: Comunidad o entorno geográfico auténtico de Puebla (ej. Coronel Tito Hernández, Teziutlán, Huauchinango).
2. **Problemática Auténtica**: Conflicto o necesidad real comunitaria (escasez hídrica, manejo de residuos, soberanía alimentaria).
3. **Acción Cognitiva Operativa**: Verbo en infinitivo de orden superior de taxonomía Bloom/Marzano (diseñar, modelar, argumentar).
4. **Producto o Evidencia Tangible**: Entregable verificable que solucionará el problema (prototipo, filtro casero, manual operativo).

### 4.2. Estructuración de los Tres Saberes
- **Saber Conceptual**: Hechos, conceptos y principios fundamentales de la UAC.
- **Saber Procedimental / Saber Hacer**: Métodos, destrezas técnicas y aplicación práctica.
- **Saber Actitudinal / Saber Ser y Convivir**: Valores, colaboración solidaria, ética ciudadana y perspectiva bioética.

---

## 5. Contratos e Interoperabilidad de Tipos

Ubicación: `src/types/assistant.ts`

```typescript
export interface IAssistantContext {
  nivel: NivelEducativo;
  educationLevel?: NivelEducativo;
  programa: ProgramaPlataforma;
  programId?: ProgramaPlataforma;
  ruta?: string;
  route?: string;
  pantallaActiva?: string;
  seccionActiva?: string;
  campoEnFoco?: string;
  documentoId?: string;
  plantel?: {
    cct?: string;
    nombre?: string;
    subsistema?: string;
  };
  detallesMediaSuperior?: ContextoMediaSuperior;
}

export interface QuickAction {
  id: string;
  titulo: string;
  etiqueta?: string;
  prompt: string;
  categoria: "redaccion" | "evaluacion" | "estrategia" | "normativa";
  campoObjetivo?: string;
}

export interface InsertionTarget {
  fieldId: string;
  selector?: string;
  targetType: "input" | "textarea" | "custom";
  value?: string;
}
```

---

## 6. Verificación y Pruebas

El sistema cuenta con una cobertura integral de pruebas automáticas:
- **Pruebas de Integración**: `src/__tests__/assistant-integration.test.ts` (16 pruebas).
- **Pruebas Unitarias de Reglas**: `src/__tests__/universal-assistant.test.ts` (11 pruebas).
- **Cobertura Global**: 56 suites de prueba, 496 pruebas unitarias y de integración pasando al 100%.
- **Turbopack Build**: Compilación exitosa en Next.js (115/115 rutas estáticas y dinámicas).
- **Dependencias Circulares**: 0 ciclos detectados mediante `madge`.
