# BITÁCORA DE ARQUITECTURA: VISIÓN ASISTENTE CONTEXTUAL MULTI-NIVEL (SAPCU)
**SACRINT Systems IA · Registro Estratégico de Evolución Futura**
**Fecha de registro**: Septiembre 2026  
**Estado**: *Documentado para desarrollo futuro (post-estabilización Media Superior)*

---

## 1. Justificación y Alcance de la Visión
El objetivo a mediano y largo plazo es evolucionar la plataforma SIGPDA-EMS / SACRINT para dar soporte no solo al Nivel Medio Superior (BGE y BT), sino expandirse gradualmente a:
- Educación Básica: Preescolar, Primaria y Secundaria (NEM / Campos Formativos).
- Educación Superior: Universidades e Institutos Tecnológicos (Competencias Profesionales / Créditos SATCA).

### Decisión de Alcance Actual
> [!NOTE]
> Se determina no apresurar la implementación multi-nivel hasta no contar con el levantamiento curricular exhaustivo, catálogos normativos oficiales y bancos de instrumentos de evaluación (listas de cotejo, rúbricas sintéticas y analíticas) de cada nivel educativo.
> 
> La prioridad actual es: **Consolidar Media Superior al 100%** (seguridad, estabilidad y calidad) y construir la arquitectura del Asistente Pedagógico Contextual de Campo (**FieldAssistant**) en los 5 programas activos (Planeaciones, PMC, PAEC-PEC, Horarios y Cartografía).

---

## 2. Retos de Dominio por Nivel Educativo

| Nivel Educativo | Paradigma Pedagógico | Unidad Curricular | Criterio de Calidad Central |
|---|---|---|---|
| **Preescolar** | Campos Formativos y Ejes Articuladores | Proyectos lúdicos / Situaciones didácticas | Desarrollo socioemocional, psicomotricidad y lenguaje |
| **Primaria** | Fases NEM (Fase 3, 4, 5) | Proyectos de aula, escolares y comunitarios | Articulación comunitaria, lectoescritura y pensamiento lógico |
| **Secundaria** | Disciplinas por Campos Formativos | Proyectos integradores / Aprendizaje Servicio | Reto situado disciplinar y pensamiento crítico |
| **Media Superior (ACTUAL)** | MCCEMS 2026-2027 (DBEPA Puebla) | UAC (Recursos Sociocognitivos / Áreas / Módulos) | **Reto Situado 4/4**, **Tres Saberes**, **Bitácora 50-20-30** |
| **Educación Superior** | Modelo por Competencias Profesionales | Asignaturas / Módulos de especialidad | Competencias de egreso, investigación y estadías |

---

## 3. Arquitectura Conceptual del "Field Assistant Service"

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIELD ASSISTANT SERVICE                      │
├─────────────────────────────────────────────────────────────────┤
│  1. Context Resolver (Extractor de Contexto en Tiempo Real)     │
│  ├── Current Program (Planeación, PMC, PAEC, Horarios, Cartog.) │
│  ├── Current Level (Media Superior [activo] -> Multi-nivel)    │
│  ├── Active Field/Step (campo en edición, bloque, UAC, fase)    │
│  ├── Cross-Entity Lookup (enlaza el PAEC activo del plantel)    │
│  └── User Context (rol, centro de trabajo, subsistema)          │
├─────────────────────────────────────────────────────────────────┤
│  2. Knowledge Router                                            │
│  ├── Curricular Knowledge Base (RAG indexado)                  │
│  ├── Validation Rules Engine (validadores específicos)          │
│  └── Prompt Templates por campo y metodología                   │
├─────────────────────────────────────────────────────────────────┤
│  3. AI Provider Router (Gemini / Groq / Flux)                   │
│  ├── Contextual Prompt Builder                                  │
│  ├── Schema Validator & Reparador Determinista                 │
│  └── Formatter con botón "Insertar en este campo"               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Hoja de Ruta de Implementación Progresiva

- **Fase 0 (En curso)**: Blindaje de seguridad P0/P1, eliminación de IDORs y estabilización de Media Superior.
- **Fase 1**: Asistente Contextual Universal para Media Superior en los 5 programas (Planeaciones, PMC, PAEC, Horarios, Cartografía) con consciencia cruzada de proyectos del plantel.
- **Fase 2**: Investigación curricular e indexación RAG de Primaria y Secundaria.
- **Fase 3**: Abstracción del esquema multi-nivel (`level_id`, `program_type`) y validadores por nivel.
- **Fase 4**: Expansión a Preescolar y Educación Superior.
