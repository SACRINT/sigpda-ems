# Fase 5 — Analítica Avanzada y Supervisión Inteligente Zonal

> **Documento Oficial de Arquitectura e Infraestructura de Fase 5**  
> **Sistema**: SIGPDA-EMS DBEPA Puebla 2026-2027  
> **Marca & Motor**: SACRINT Systems IA  
> **Estado**: Producción (Fase 5 - Cerrada al 100%)

---

## 1. Visión General y Propósito

La **Fase 5: Analítica Avanzada y Supervisión Inteligente** transforma a SIGPDA-EMS de una plataforma transaccional de planeación didáctica en un **Centro de Mando Pedagógico de Alta Dirección** para supervisores escolares, directores de plantel y administradores de la Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA Puebla).

### Objetivos Clave:
1. **Pipeline de Calidad Determinista**: Conexión directa y unificada con `evaluatePlanningQuality` (DBEPA Puebla MCCEMS), calificando cada planeación didáctica en una escala 0-100 pts con desglose en Reto Situado (4/4), Tres Saberes (Saber, Saber Hacer, Saber Ser), Coherencia Metodológica y Balance de Horas por Corte (6 semanas por corte).
2. **Event Bus Transaccional (`domain_events`)**: Registro auditable de eventos de dominio persistido en PostgreSQL Serverless (Neon), evitando dependencias frágiles de Redis o colas en memoria volátiles.
3. **Streaming en Tiempo Real Nativo (Server-Sent Events)**: Difusión de pulsos de calidad y alertas en tiempo real vía Web Streams estándar (`ReadableStream`, `text/event-stream`), compatible al 100% con Next.js App Router (v16.2.9) y Edge/Node runtime sin requerir servidores WebSocket con estado.
4. **Motor de Alertas Pedagógicas de Supervisión**: Detección reactiva y proactiva de anomalías curriculares (`QUALITY_SCORE_DROP`, `HORAS_CORTE_DESBALANCEADO`, `PAEC_DESVINCULADO`, `RETO_SITUADO_INCOMPLETO`, `DOCENTE_INACTIVO`) con severidades normativas P0 (Crítica), P1 (Alta), P2 (Media) y P3 (Informativa).
5. **Centro de Mando para Supervisores**: Interfaz interactiva (`SupervisorDashboard`, `ZoneQualityHeatmap`, `SchoolDrillDownModal`, `AlertPanel`, `TrendCharts`) que brinda semaforización instantánea de planteles por CCT, desglose por UAC y análisis de tendencias a 30 días.

---

## 2. Diagrama de Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CENTRO DE MANDO SUPERVISOR (UI)                        │
│   src/app/[locale]/admin/analytics/page.tsx                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                        SupervisorDashboard                           │  │
│   │  - KPI Cards Zonales (Calidad Promedio, Planeaciones, Docentes, CCT) │  │
│   │  - Selector Zonal (Puebla Oriente, Tehuacán, Huauchinango, etc.)     │  │
│   ├────────────────────────────────────────┬─────────────────────────────┤  │
│   │  ZoneQualityHeatmap (Semaforización)   │ AlertPanel (Tiempo Real)    │  │
│   │  TrendCharts (Recharts - 30 días)      │ - Suscripción SSE Nativa    │  │
│   │  SchoolDrillDownModal (Desglose UAC)   │ - Resolución de alertas 1-cl│  │
│   └────────────────────────────────────────┴─────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / SSE
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CAPA API REST & STREAM V1                          │
│  - GET  /api/analytics/v1/zone/[zoneId]       (Métricas + Tendencias 30d)   │
│  - GET  /api/analytics/v1/school/[schoolId]   (Drill-down UAC y Docentes)   │
│  - GET  /api/analytics/v1/alerts              (Alertas Activas no leídas)   │
│  - POST /api/analytics/v1/alerts              (Resolver / Disparar alerta)  │
│  - GET  /api/analytics/v1/stream              (SSE text/event-stream nativo)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MOTOR DE ANALÍTICA Y ALERTAS                        │
│  ┌───────────────────────────────┐        ┌──────────────────────────────┐  │
│  │ src/lib/analytics/pipeline.ts │        │ alert-engine.ts              │  │
│  │ - evaluatePlanningQuality()   │        │ - triggerSupervisoryAlert()  │  │
│  │ - ensureAnalyticsTables()     │        │ - getActiveSupervisoryAlerts │  │
│  │ - Ingesta y scoring 0-100 pts │        │ - resolveSupervisoryAlert()  │  │
│  └───────────────┬───────────────┘        └──────────────┬───────────────┘  │
│                  │                                       │                  │
│                  ▼                                       ▼                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ src/lib/analytics/events.ts (Event Bus sobre domain_events)           │  │
│  │ - PLANNING_EVALUATED, SUPERVISORY_ALERT, ALERT_RESOLVED               │  │
│  └───────────────────────────────────────┬───────────────────────────────┘  │
│                                          │                                  │
│                                          ▼                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ src/lib/analytics/aggregations.ts (Multi-nivel Zonal, Plantel, Días)  │  │
│  │ - getZoneAggregatedMetrics(), getSchoolAggregatedMetrics(), Trends    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ SQL Transaccional
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BASE DE DATOS NEON POSTGRESQL                         │
│  - Tabla domain_events (id, event_type, aggregate_id, payload, created_at)  │
│  - Tabla notifications (user_id, type LIKE 'alert_%', read, severity)       │
│  - Tabla plannings (quality_score, quality_status, quality_checks)          │
│  - Índices B-Tree: idx_plannings_quality_score, idx_domain_events_stream    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Módulos Implementados

### 3.1. Pipeline de Ingesta y Scoring Determinista (`src/lib/analytics/pipeline.ts`)
- Vincula la evaluación oficial DBEPA (`evaluatePlanningQuality` de `quality-pipeline.ts`).
- Evalúa:
  * **Reto Situado (4/4)**: Verbo en infinitivo contextualizado, municipio local, problemática territorial real y propósito curricular.
  * **Tres Saberes**: Presencia explícita y estructurada de saber conceptual, saber procedimental (hacer) y saber actitudinal (ser).
  * **Coherencia Metodológica**: Metodología activa correspondiente a la UAC (ABP, ABProblemas, STEAM, AS).
  * **Dosificación de Horas**: 18 horas lectivas exactas por corte semestral (6 semanas).
- Actualiza columnas persistentes en `plannings`: `quality_score`, `quality_status` (`excelente`, `aceptable`, `atencion`) y `quality_checks`.
- Asegura la existencia idempotente de tablas e índices con `ensureAnalyticsTables()`.

### 3.2. Event Bus Transaccional (`src/lib/analytics/events.ts`)
- Implementa almacenamiento confiable de eventos de dominio en PostgreSQL.
- Tipos de eventos gestionados:
  * `PLANNING_EVALUATED`: Nueva planeación evaluada con puntaje oficial.
  * `SUPERVISORY_ALERT`: Anomalía detectada que requiere intervención zonal.
  * `ALERT_RESOLVED`: Confirmación de atención por parte del supervisor/director.
  * `QUALITY_THRESHOLD_CROSSED`: Variación sustancial en el desempeño de un plantel.

### 3.3. Motor de Agregaciones Multi-nivel (`src/lib/analytics/aggregations.ts`)
- **Nivel Zonal (`getZoneAggregatedMetrics`)**: Agrupa métricas de todos los CCT pertenecientes a la zona, calculando promedios ponderados, porcentaje de cobertura curricular, porcentaje de vinculación PAEC y alertas activas.
- **Nivel Plantel (`getSchoolAggregatedMetrics`)**: Proporciona el desglose analítico para la modal drill-down, computando el rendimiento específico por cada UAC y listando las planeaciones recientes.
- **Nivel Temporal (`getZone30DayTrends`)**: Genera una serie cronológica continua de 30 días con los promedios diarios de calidad y volumen de secuencias.

### 3.4. Motor de Alertas Pedagógicas (`src/lib/analytics/alert-engine.ts`)
- Clases de anomalía supervisadas:
  * `QUALITY_SCORE_DROP`: Planeaciones con puntaje < 60 pts (P0) o 60-74 pts (P1).
  * `HORAS_CORTE_DESBALANCEADO`: Inconsistencia en la distribución horaria semestral (P2).
  * `PAEC_DESVINCULADO`: Planeación sin articular con el Proyecto Escolar Comunitario (P2).
  * `RETO_SITUADO_INCOMPLETO`: Incumplimiento de la regla de oro 4/4 del MCCEMS (P2).
  * `DOCENTE_INACTIVO`: Periodo prolongado sin registrar secuencias didácticas (P3).
- Persistencia dual: Notificación in-app en `notifications` + evento en `domain_events`.

### 3.5. Streaming SSE Nativo (`src/app/api/analytics/v1/stream/route.ts`)
- Sin dependencias de socket.io ni servidores de WebSocket con estado.
- Emite eventos formateados `event: alert\ndata: {...}\n\n` y pulsos periódicos de calidad `event: quality_pulse\ndata: {...}\n\n`.
- Incorpora heartbeat cada 15 segundos (`event: ping`) para mantener vivo el canal a través de proxies y balanceadores.

### 3.6. Componentes de Interfaz de Usuario
- `SupervisorDashboard.tsx`: Centro de mando general con métricas KPI, selectores y coordinación global.
- `ZoneQualityHeatmap.tsx`: Cuadrícula semafórica de planteles con filtros por estado y buscador por CCT/Nombre.
- `SchoolDrillDownModal.tsx`: Inspección profunda de plantel con tabla de UACs y lista de secuencias.
- `AlertPanel.tsx`: Panel lateral con conexión SSE nativa y botón de resolución en 1 clic.
- `TrendCharts.tsx`: Gráficos vectoriales interactivos con Recharts (Área de calidad y Líneas de actividad).

---

## 4. Estrategia de Pruebas y Verificación

La Fase 5 cuenta con cobertura de pruebas automatizadas mediante Vitest:
- `src/__tests__/analytics-pipeline.test.ts`: Verificación de DDL idempotente, scoring determinista, persistencia en `domain_events` y agregaciones multinivel.
- `src/__tests__/alert-engine.test.ts`: Verificación de severidades (P0/P1/P2/P3), generación de notificaciones y ciclo de vida de resolución.
- `src/__tests__/analytics-api.test.ts`: Verificación de seguridad por rol (401/403/200), contratos JSON de los endpoints REST v1 y encabezados del stream SSE.

---

## 5. Control de Despliegue y Rollback

- **Requisitos de Base de Datos**: Neon PostgreSQL compatible. No requiere Redis ni servicios auxiliares.
- **Rollback Seguro**: Si se requiere revertir la Fase 5, basta con despublicar la ruta `/admin/analytics`. Las tablas e índices creados son no destructivos y conviven armónicamente con las fases previas.
