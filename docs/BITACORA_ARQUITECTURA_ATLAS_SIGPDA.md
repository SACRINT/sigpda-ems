# BITÁCORA Y BLUEPRINT ARQUITECTÓNICO: SIGPDA-EMS & SACRINT_SYSTEMS
## Sistema Integral de Autoría Pedagógica, Compilación Editorial y Experiencias de Aprendizaje
### DBEPA Puebla · Bachillerato General Estatal (BGE) · Bachillerato Tecnológico (BT) · 2026-2027

> **Versión:** 1.1.0 — Consolidación de Inteligencia de Código Abierto 2026 y Arquitectura Pragmática en 3 Capas  
> **Estado:** Documento Maestro de Arquitectura y Bitácora de Evolución  
> **Propósito:** Registrar las decisiones de diseño, marcos pedagógicos adoptados, arquitectura del Visual Assets Engine y hoja de ruta de integración entre SIGPDA-EMS y el orquestador SACRINT_SYSTEMS.

---

## 1. Evaluación de Inteligencia de Código Abierto (Repositorios 2026)

Tras analizar los repositorios identificados en el estado del arte (2025-2026), se clasifica cada proyecto en una matriz de decisión: **Adoptar Concepto**, **Adaptar Módulo** o **Descartar Implementación**:

| Repositorio / Proyecto | Enfoque Principal | Veredicto Arquitectónico | Decisión para SIGPDA-EMS / SACRINT_SYSTEMS |
| :--- | :--- | :--- | :--- |
| **[DaRL-GenAI / instructional_agents](https://github.com/DaRL-GenAI/instructional_agents)** *(EACL 2026)* | Multiagente basado en ADDIE (Analysis, Design, Development, Implementation, Evaluation) con Catalog y Copilot Mode. | ⭐⭐⭐⭐⭐ **ADOPTAR CONCEPTO** | Adoptar su pipeline de fases ADDIE para el `PedagogicalEngine`. No copiar su código (es académico en Python), sino reescribir la orquestación en TypeScript nativo. |
| **[maxthraxx / openmaic](https://github.com/maxthraxx/openmaic)** | Aula interactiva multiagente: convierte documentos en aulas con profesores, compañeros IA, simulación y voz. | ⭐⭐⭐⭐⭐ **MODELO BASE SACRINT_SYSTEMS** | Este es el blueprint directo para **SACRINT_SYSTEMS**. SIGPDA compila el contenido educativo formal; SACRINT_SYSTEMS toma ese manifest y levanta el aula virtual interactiva y simulada. |
| **[epaproditus / claw-ed](https://github.com/epaproditus/claw-ed)** | Paquete de clase completo con **Pedagogical Quality Gate** (Bloom, diferenciación, estímulo-respuesta). | ⭐⭐⭐⭐⭐ **ADOPTAR MÓDULO** | Implementar su bucle estricto: `Generar -> Auditar -> ¿Cumple Score >= 85? -> Regenerar sector deficiente o Aprobar`. |
| **[chrishrp / pbl-design-tools](https://github.com/chrishrp/pbl-design-tools)** | Currículum basado en HQPBL (High Quality Project Based Learning) y Design Thinking. | ⭐⭐⭐⭐⭐ **ADOPTAR MARCO** | Integrar los 6 criterios HQPBL en el `ProjectWriter` (Misión 3 Comunitaria PAEC) para exigir un Producto Público Real. |
| **[ronda-ai / ronda-app](https://github.com/ronda-ai/ronda-app)** | PBL Lab: hitos de equipo y andamiaje dinámico (microactividades cuando el alumno se traba). | ⭐⭐⭐⭐½ **ADOPTAR ESTRUCTURA** | Enriquecer la matriz de troubleshooting y el cuaderno activo con "Micro-retos de rescate" cuando falla un experimento o despeje. |
| **[Enterprise-DNA-OS / ai-learning-path-generator](https://github.com/Enterprise-DNA-OS/ai-learning-path-generator)** | Rutas de aprendizaje, modelos mentales y grafos de prerrequisitos. | ⭐⭐⭐⭐½ **ADOPTAR PATRÓN** | Estructurar el "Concepto Cero" del libro activo como un árbol de prerrequisitos conceptuales antes del tema formal. |
| **[comfyanonymous / ComfyUI](https://github.com/comfyanonymous/ComfyUI)** | Orquestación visual modular por nodos para generación y edición de imágenes (FLUX, SD, ControlNet). | ⭐⭐⭐⭐⭐ **FUTURO BACKEND IA** | Adoptar como arquitectura de referencia para el pipeline generativo visual desacoplado en SACRINT_SYSTEMS. |
| **[WordPress / openverse](https://github.com/WordPress/openverse)** | Motor de búsqueda de 700M+ de recursos bajo licencias Creative Commons y Dominio Público. | ⭐⭐⭐⭐⭐ **CONECTAR DIRECTO** | Conector principal del `VisualAssetsEngine` para fotografías y diagramas científicos reales bajo CC-BY. |
| **PhET Simulations (Univ. of Colorado)** | Vectores y simuladores STEM. | ⚠️ **CONDICIONADO** | Licencia CC BY-NC 4.0 (No Comercial). Útil como referencia pedagógica; requiere validación estricta por el `LicenseEngine`. |

---

## 2. Paradigma Central: "Educational Content Compiler"

SIGPDA-EMS es el **Compilador Pedagógico Multimodal**. El PDF o DOCX deja de ser el origen; es solo una vista o artefacto de exportación.

```mermaid
graph TD
    subgraph IN["1. INSUMOS DE ENTRADA"]
        CURR["Currículo Oficial MCCEMS / DBEPA<br><i>(Progresiones, UAC, Semestre, Horas)</i>"]
        CTX["Contexto Plantel & PAEC<br><i>(Comunidad, Problemática, Equipamiento)</i>"]
        PRF["Perfil Docente & BAP<br><i>(Diagnóstico de Rezago y Estilos)</i>"]
    end

    subgraph ENGINE["2. MOTOR PEDAGÓGICO DE AUTORÍA (Kernel)"]
        ADDIE["Pipeline ADDIE<br><i>(Analysis -> Design -> Dev -> Eval)</i>"]
        CPA["Enfoque Singapur CPA<br><i>(Concreto -> Pictórico -> Abstracto)</i>"]
        PHEN["Finlandia PhenoBL<br><i>(Pregunta detonadora & Fenómeno situado)</i>"]
        HQPBL["Estándar HQPBL<br><i>(Misión comunitaria con producto público)</i>"]
    end

    subgraph ASSETS["3. VISUAL ASSETS ENGINE & LICENSE GATE"]
        D0["Nivel 0: Determinístico SVG<br><i>(Gráficas cartesianas, rough.js, Mermaid, KaTeX)</i>"]
        D1["Nivel 1: Medios Abiertos CC<br><i>(Openverse API, Wikimedia Commons)</i>"]
        D2["Nivel 2: Generación IA Controlada<br><i>(Pollinations / FLUX / Imagen 3)</i>"]
        LG["License & Attribution Gate<br><i>(Verificación CC-BY / Comercial / Atribución legal)</i>"]
    end

    subgraph QUALITY["4. QUALITY GATING (Claw-ED Pattern)"]
        QG{"Auditoría Pedagógica<br>¿Score >= 85 & Bloom OK?"}
        REGEN["Reintento Focalizado por Redactor"]
    end

    subgraph OUT["5. SALIDAS MULTIPLATAFORMA"]
        PDF["PDF Cuaderno Activo Editorial<br><i>(jsPDF / AutoTable 8.5pt / Trazo manual)</i>"]
        DOCX["DOCX Editable Institucional<br><i>(Word DBEPA / Rúbricas Horizontales)</i>"]
        SACRINT["Manifest Interactivo SACRINT_SYSTEMS<br><i>(Aula virtual, simulaciones, laboratorios)</i>"]
    end

    IN --> ENGINE
    ENGINE --> ASSETS
    ASSETS --> LG
    LG --> QUALITY
    QUALITY -- "No (< 85)" --> REGEN
    REGEN --> ENGINE
    QUALITY -- "Sí (>= 85)" --> OUT
```

---

## 3. Arquitectura del Visual Assets Engine & License Engine

### A. Estrategia Multicapa (Eficiencia, Costo Cero y Escalabilidad)
1. **Capa 0 (Determinística / 0 tokens / Costo $0.00):**
   * **Gráficas de Funciones:** Módulo matemático en Node.js que genera cadenas SVG puras para funciones lineales, cuadráticas, racionales y trigonométricas con ejes graduados y etiquetas.
   * **Geometría con Trazo Activo:** Figuras geométricas (círculos, conos, cilindros, triángulos rectángulos) estilizadas con `rough.js` para dar la apariencia de cuaderno de apuntes.
   * **Diagramas Conceptuales:** `Mermaid.js` para flujogramas de algoritmos en programación (BT), ciclos biogeoquímicos y líneas de tiempo históricas.
2. **Capa 1 (Medios Abiertos Verificados):**
   * Integración con la API de **Openverse** y **Wikimedia Commons**.
   * Búsqueda por metadatos curriculares: `biologia celular`, `circuito rlc`, `destilador quimica`.
3. **Capa 2 (Generativa IA para Portadas y Escenas Situadas):**
   * Modelos abiertos compatibles comercialmente (`FLUX.1-schnell` con licencia Apache-2.0 / Google Imagen 3 institucional).

### B. El License Engine (Blindaje Jurídico y Comercial)
Cada imagen almacenada o incrustada en un libro debe registrarse en la tabla `image_assets`:
```sql
CREATE TABLE IF NOT EXISTS image_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uac_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL, -- 'math_plot', 'scientific_diagram', 'historical', 'community'
  asset_type VARCHAR(50) NOT NULL, -- 'svg_inline', 'remote_url', 'cached_blob'
  content_data TEXT NOT NULL,      -- Código SVG o URL segura
  source VARCHAR(100) NOT NULL,    -- 'deterministic_generator', 'wikimedia', 'openverse', 'flux'
  license VARCHAR(50) NOT NULL,   -- 'Public Domain', 'CC-BY-4.0', 'Apache-2.0'
  author VARCHAR(255),
  attribution_text TEXT NOT NULL,  -- Pie de figura formal: 'Figura 1.2. Fuente: X bajo licencia Y'
  commercial_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. El Marco Pedagógico Internacional Fusionado

Para superar el estándar de los libros de texto tradicionales (CECyTE, DGETI, DGB), el motor fusiona los puntos más fuertes de cada pedagogía líder:

1. **Singapur (Método CPA):**
   * *Concreto:* El libro inicia con la situación cotidiana (ej. facturación eléctrica, mezclas de granos, fallas mecánicas).
   * *Pictórico:* **Diagrama o gráfica obligatoria** antes de las fórmulas (renderizada por el Visual Assets Engine).
   * *Abstracto:* El modelo algebraico, la ley de Ohm o la ecuación diferencial.
2. **Finlandia (Phenomenon-Based Learning - PhenoBL):**
   * El bloque no es una lista de temas aislados; es la investigación de un **Fenómeno Situado Regional** de Puebla.
3. **Estados Unidos (HQPBL):**
   * El Proyecto Comunitario PAEC exige un producto público verificable (filtro de agua, prototipo funcional, campaña de salud, software administrativo escolar).
4. **Inclusión y Equidad (BAP & Rezago):**
   * Cada sesión integra andamiajes diferenciados (estrategias para estudiantes que requieren apoyo y desafíos de extensión para estudiantes avanzados).

---

## 5. Hoja de Ruta de Implementación por Fases (Sin Afectar Producción)

### Fase 1: Motor Gráfico Determinístico dentro de SIGPDA_EMS (SVG & Matemáticas)
- [x] Crear generadores matemáticos y vectoriales (`stem-generator.ts`, `humanities-generator.ts`, `laboral-generator.ts`) para graficar funciones en 2D y diagramas sin dependencias externas pesadas.
- [x] Crear generadores de figuras geométricas, diagramas de bloques, flujos técnicos y listas de seguridad con anotaciones desacopladas (cero tags `<text>`).
- [x] Conectar la inserción de gráficos en `pdf-workbook-renderer.ts`, `docx-workbook-renderer.ts`, `cascade-block-materials.ts` y en `ExtraPreviewModal.tsx`.

### Fase 2: License Engine & Cliente de Medios Abiertos (Openverse)
- [x] Crear migración y funciones ORM para la tabla `image_assets` en Neon PostgreSQL (`src/lib/db.ts`).
- [x] Crear cliente de búsqueda `src/lib/visual-engine/openverse-client.ts` con filtro estricto de licencias educativas/comerciales (CC0, CC-BY, CC-BY-SA).
- [x] Formatear el pie de imprenta y pie de figura legal institucional en cada imagen insertada en PDF y DOCX.

### Fase 3: Quality Gate Pedagógico (Patrón Claw-ED)
- [x] Implementar `src/lib/guide-engine/pedagogical-quality-gate.ts` con:
  - Distribución cognitiva equilibrada según la Taxonomía de Bloom (LOTS vs HOTS).
  - Criterios HQPBL (High Quality Project Based Learning) en la Misión Comunitaria PAEC.
  - Mitigación de Barreras para el Aprendizaje y la Participación (BAP) y Diseño Universal (DUA).
  - Score institucional ponderado (0-100) y dictamen formal (A+, A, B, C, D).

### Fase 4: Exportación del Manifest para SACRINT_SYSTEMS
- [x] Generar el constructor estandarizado (`src/lib/export/sacrint-course-manifest.ts`) que permite exportar el `SACRINTCourseManifest` para que el orquestador hermano **SACRINT_Systems_IA** levante aulas virtuales, simulaciones interactivas y agentes pedagógicos.

---

## 6. Consolidación de Arquitectura y Eliminación de Deuda Técnica (Septiembre 2026)

Para garantizar un código mantenible, libre de parches frágiles y desacoplado, se completó la auditoría y refactorización estructural del repositorio:

1. **Eliminación de Archivos Basura:**
   - Se eliminaron los respaldos obsoletos `src/lib/prompts/*.bak_20260911`.
2. **Conexión Unificada de `visual-asset-manager`:**
   - Los 3 motores de salida (`pdf-workbook-renderer.ts`, `docx-workbook-renderer.ts` y `cascade-block-materials.ts`) ahora consumen `resolveVisualForMission`, garantizando la resolución multicapa (Capa 0 determinística + Capa 1 Openverse CC + BD `image_assets`).
3. **Centralización de Normalización Unicode:**
   - Se creó `src/lib/utils/normalize.ts` con la función compartida `normalizeUnicode(str)`.
   - Se reemplazaron las 23 ocurrencias dispersas en 10 archivos por la función única.
4. **Centralización de URLs de API Externa:**
   - Se creó `src/lib/config.ts` exportando `API_CONFIG` (`gemini`, `openverse`, `mermaid`).
   - Se desacoplaron las URLs en `gemini.ts`, `rag-curricular.ts`, `ai-provider/gemini.ts`, `openverse-client.ts`, `mermaid-renderer.ts` y rutas administrativas de prueba.
5. **Centralización de Identificadores y Cargos Escolares:**
   - Se incorporaron `normalizarId` y `normalizarCargo` en `src/lib/utils/normalize.ts`, eliminando duplicaciones en el solver de horarios, chain-swap, editor de horarios y rutas de importación docente.
6. **Verificación Estricta de Tipos:**
   - Validación completa con `npx tsc --noEmit` resultando en 0 errores de compilación.

---

## 7. Blindaje Arquitectónico y Limpieza Estructural de Producción (Septiembre 2026)

Se ejecutó la fase de blindaje arquitectónico integral en 5 pasos prioritarios para erradicar la deuda técnica y consolidar la robustez en producción:

1. **Centralización del Ciclo Escolar (`SCHOOL_YEAR`):**
   - Se definió `export const SCHOOL_YEAR = '2026-2027';` en `src/lib/config.ts`.
   - Se sustituyeron todas las cadenas hardcodeadas en los generadores de PDF (`pdf-generator.ts`, `pdf-workbook-renderer.ts`, `pdf-extra-generator.ts`), documentos Word (`pmc-docx-generator.ts`, `paec-docx-generator.ts`), exportadores SACRINT (`sacrint-manifest-exporter.ts`), prompts de generación (`build-prompt.ts`, `extras-prompts.ts`) y el sistema de integridad de planeaciones.

2. **Tipado Estricto de `jspdf-autotable` y Erradicación de `(doc as any)`:**
   - Se creó el archivo de declaración de tipos `src/types/jspdf-autotable.d.ts`, extendiendo la interfaz `jsPDF` con `lastAutoTable?: { finalY: number }` y la estructura interna de páginas.
   - Se reemplazaron todas las llamadas inseguras `(doc as any).internal.getNumberOfPages()` por la API oficial nativa de jsPDF `doc.getNumberOfPages()`.
   - Se eliminaron las 22 ocurrencias de `(doc as any)` en `pdf-workbook-renderer.ts`, `pdf-generator.ts`, `pdf-extra-generator.ts` y `src/lib/horarios/exportador.ts`.

3. **Migración Integral a Logging Estructurado (`logger`):**
   - Se erradicaron todos los `console.log` de producción en favor de `logger` (`src/lib/logger.ts`), garantizando sanitización automática de datos sensibles (tokens, llaves API, secrets).
   - Se migraron los 4 writers del motor pedagógico (`foundation-writer.ts`, `lab-writer.ts`, `project-writer.ts`, `evaluation-writer.ts`), orquestadores (`cascade-block-materials.ts`, `block-guide-orchestrator.ts`), workers de fondo (`job-worker.ts`, `api/jobs/process/route.ts`), webhooks de Stripe, asistentes de horarios y rutas API de generación (`plannings/[id]/generate`, `plannings/[id]/extras`, `pips/[id]/generate`, `paec/[id]/generate-step`).

4. **Blindaje de Bloques `catch` Silenciosos:**
   - Se auditaron y protegieron todos los bloques `catch` vacíos o desatendidos en `pdf-workbook-renderer.ts`, `mermaid-renderer.ts`, `canonical-seed-repository.ts`, `block-guide-orchestrator.ts` y `subscription-gate.ts`, asegurando trazabilidad y observabilidad mediante `logger.warn` y `logger.error` contextuales.

5. **Unificación de Consumo de IA bajo `@/lib/ai-provider`:**
   - Se migraron todos los consumidores de IA del sistema hacia `@/lib/ai-provider`, incorporando `generateWithRotation`, `generateStreamWithRotation` y `generateMultimodalWithRotation`.
   - Se eliminó el acoplamiento directo a `@/lib/gemini` en los parsers curriculares (`pdf-parser.ts`, `pdf-scanned.ts`), asistente de horarios (`ai-schedule-assistant.ts`) y rutas de generación (`pmc/[id]/generate-step`, `pdf/parse-paec`, `plannings/[id]/generate`, `plannings/[id]/extras`).
   - El sistema cuenta ahora con rotación transparente de API keys y conmutación por falla (fallback multinivel: OpenRouter, Mistral, OpenAI, Claude, Gemini) en toda la plataforma.

6. **Validación de Calidad y Tipos:**
   - Compilación completa con TypeScript (`npx tsc --noEmit`) con código de salida 0 (cero errores, cero advertencias de tipo).

---

## 8. Blindaje de Resiliencia del Motor y Paridad Administrativa (Septiembre 2026)

En respuesta a la auditoría técnica y alineación con el propósito original de SIGPDA-EMS (exclusivo para Docentes, Directores y Supervisores, trasladando cualquier alcance estudiantil al ecosistema externo SACRINT Systems), se ejecutó la **Fase 1: Blindaje del Motor de Generación**:

1. **PIPS Checkpoints & Retry (`pips/[id]/generate/route.ts`):**
   - Se implementó la persistencia incremental de checkpoints tras cada chunk (1/3, 2/3 y 3/3) directamente en la base de datos Neon. Si la conexión o la IA falla en el último tercio, los dos primeros se conservan intactos.
   - Se integró reintento con retroceso exponencial (`generateChunkWithRetry`, hasta 2 reintentos con duplicación progresiva de espera) y registro estructurado de progreso en `logger.info`.

2. **PAEC Step 6 Checkpoints & Retry (`paec/[id]/generate-step/route.ts`):**
   - Se introdujo partición resiliente por bloques de UACs en el Plan Operativo Comunitario.
   - Cada bloque cuenta con reintento individual y persistencia parcial de filas (`allPlanRows`) en `paec_projects` mediante `updatePaecProjectStep`. Si un bloque aislado presenta anomalías de formato o timeout, los bloques previos no se descartan.

3. **Seguridad y Verificación en PIPS DELETE (`pips/[id]/route.ts`):**
   - Se blindó la eliminación de proyectos PIPS utilizando `RETURNING id`.
   - Se retorna `404 Not Found` en caso de que el proyecto no exista o pertenezca a otro usuario.
   - Se migraron todas las capturas de error a `logger.error`.

4. **Centralización Completa de `SCHOOL_YEAR` en Wizards:**
   - Se erradicaron las cadenas `'2026-2027'` hardcodeadas en `src/app/[locale]/pips/nuevo/PipsWizard.tsx` (estado inicial y placeholders) y en `src/components/horarios/EditorHorarios.tsx` (exportación a libro integral y reportes), vinculándolas a `import { SCHOOL_YEAR } from '@/lib/config'`.

5. **Consolidación de Endpoints de Horarios:**
   - Se eliminó el endpoint huérfano e inconsistente `/api/horarios/generate`.
   - Se consolidó toda la lógica en `/api/horarios/generar`, el cual cuenta con normalización exhaustiva de docentes y grupos, cálculo dinámico de jornadas, persistencia en `horario_config` y manejo de eliminación `DELETE`.
   - Se migraron todos los registros a `logger.warn` y `logger.error` tipados con `LogContext`.

6. **Verificación Estricta:**
   - Verificación de tipos con `npx tsc --noEmit` completada exitosamente con código de salida 0.

---

## 9. Paridad Documental Oficial: Generadores de PDF Institucionales para PMC, PIPS y PAEC (Septiembre 2026)

Con el fin de cumplir estrictamente con los requerimientos de entrega de la Secretaría de Educación Pública del Estado de Puebla y la Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA), donde la entrega y cotejo formal de expedientes escolares se realiza en formato PDF inalterable con membrete y sellos oficiales, se diseñó e implementó la suite completa de generadores de PDF vectoriales de alta fidelidad:

1. **PMC PDF Generator (`src/lib/pmc-pdf-generator.ts` & `src/app/api/pdf/pmc/[id]/route.ts`):**
   - **Propósito:** Generación del Plan de Mejora Continua para Directores de Bachilleratos Generales Estatales.
   - **Estructura Oficial:**
     - Portada institucional formal en hoja Carta con membrete del Gobierno del Estado de Puebla, logotipo oficial de la SEP y sello de la Supervisión de Zona Escolar 004.
     - Cédula técnica escolar y directiva con CCT, turno, modalidad, matrícula y datos del Director(a).
     - Marco normativo de la Nueva Escuela Mexicana (NEM) y contexto situacional.
     - Matriz diagnóstica de indicadores académicos (aprobación, reprobación, retención, eficiencia terminal).
     - Matriz FODA institucional estratégica.
     - Metas institucionales SMART categorizadas por ámbito de gestión escolar (aprovechamiento académico, formación docente, infraestructura, convivencia escolar).
     - Metas individuales de desempeño docente por UAC.
     - Bloque reglamentario tripartita de firmas: *Elaboró: Director del Plantel*, *Revisó: Consejo Técnico Escolar (CTE)*, *Validó: Supervisor de Zona Escolar 004*.
   - **UI:** Botón `"↓ PMC Oficial PDF"` integrado en el listado (`pmc/page.tsx`) y en la tarjeta de descarga final del Wizard (`pmc/nuevo/PmcWizardClient.tsx`).

2. **PIPS PDF Generator (`src/lib/pips-pdf-generator.ts` & `src/app/api/pdf/pips/[id]/route.ts`):**
   - **Propósito:** Generación del Plan de Intervención y Acompañamiento Pedagógico de Supervisión para Supervisores Escolares y ATPs.
   - **Estructura Oficial:**
     - Portada monumental de supervisión con cintillo dorado y heráldica oficial poblana.
     - Cédula de datos generales de la Zona Escolar (municipios sede, clave de zona, supervisor titular).
     - Presentación pedagógica y justificación institucional.
     - Evaluación diagnóstica cuantitativa del ciclo escolar inmediato anterior.
     - Directorio concentrador zonal de escuelas con desglose pormenorizado de matrícula por sexo (Hombres, Mujeres, Matrícula Total).
     - Matriz de problemáticas zonales prioritarias y factores causales.
     - Objetivos estratégicos y metas cuantitativas de asesoría técnica.
     - Cronograma y calendario anual de visitas técnico-pedagógicas a planteles.
     - Bloque reglamentario de acreditación oficial: *Elaboró: Asesores Técnico Pedagógicos (ATPs)*, *Revisó y Avaló: Supervisor de Zona Escolar 004*, *Autorizó: Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA)*.
   - **UI:** Botón `"↓ PIPS Oficial PDF"` integrado en el listado (`pips/page.tsx`) y en el asistente (`pips/nuevo/PipsWizard.tsx`).

3. **PAEC PDF Generator (`src/lib/paec-pdf-generator.ts` & `src/app/api/pdf/paec/[id]/route.ts`):**
   - **Propósito:** Generación del Proyecto Escolar Comunitario (PEC / PAEC) para Colectivos Docentes y Planteles Escolares bajo el Marco Curricular Común (MCCEMS).
   - **Estructura Oficial:**
     - Portada monumental con escudos oficiales del Estado de Puebla, SEP y Supervisión Escolar 004.
     - Cédula técnica de identificación del PEC (Nombre del proyecto, problemática central abordada, docente coordinador, ciclo semestral / anual, plantel escolar, CCT y localidad).
     - **FASE 1 — Diagnóstico Colectivo:** Características del entorno comunitario (contexto externo), características de la institución escolar (contexto interno), análisis estratégico FODA del colegiado y justificación metodológica del problema.
     - **FASE 2 — Diseño y Fundamentación:** Introducción y sustento académico, pilares estratégicos de viabilidad, propósitos integrales (Educativo, Social/Ambiental, Funcional) y metas cuantitativas.
     - **FASE 2 — Articulación Multidisciplinaria:** Mapeo exhaustivo de Unidades de Aprendizaje Curricular (UACs) participantes, temas transversales y vinculación comunitaria.
     - **FASE 2 — Cronograma General y Etapas:** Fases macro, objetivos operativos, macroactividades y semestres involucrados.
     - **FASE 2 — Plan Operativo de Aula:** Tablas pormenorizadas de actividades por UAC, progresiones del MCCEMS, semanas de ejecución, docentes responsables e instrumentos de evaluación formativa para Semestre A y Semestre B.
     - **FASE 3 — Protocolo y Anexos Técnicos:** Ficha resumen de instrumentos de evaluación (Minutas de acuerdos CTE, Matriz de seguimiento semanal con semáforos, Reportes mensuales de avance, Encuestas Likert de impacto social, Autoevaluación estudiantil y Evaluación docente).
     - Bloque oficial tripartita de firmas: *Elaboró: Docente Coordinador PAEC*, *Revisó: Colectivo Docente (CTE)*, *Validó y Autorizó: Dirección del Plantel / Supervisión de Zona Escolar 004*.
   - **UI:** Botón `"↓ PAEC Oficial PDF"` añadido al listado principal (`paec/page.tsx`) y en el Paso 7 del Wizard (`paec/nuevo/PaecWizardClient.tsx`).

4. **Calidad de Compilación:**
   - Todo el código compila con `npx tsc --noEmit` con código de salida 0 (cero errores, cero warnings).

---

## 10. Matriz de Auditoría y Estado de las 25 Mejoras de Opencode (Propósito Original)

A continuación se registra el diagnóstico y estado de atención de las 25 mejoras identificadas para consolidar la plataforma en su misión única de servicio a **Docentes, Directores y Supervisores**:

| # | Módulo / Componente | Descripción de la Mejora | Estado Actual | Resolución / Plan de Acción |
|---|---|---|---|---|
| **1** | **PIPS Generator** | Checkpoints BD y reintento en partes 1/3, 2/3 y 3/3 | ✅ **RESUELTO** | Implementado en `pips/[id]/generate/route.ts` con persistencia parcial y exponential backoff. |
| **2** | **PAEC Step 6** | Checkpoints BD y reintento por chunk de UACs | ✅ **RESUELTO** | Implementado en `paec/[id]/generate-step/route.ts` con división por semestres y preservación de filas. |
| **3** | **Horarios Endpoints** | Eliminar duplicación entre `generar/route.ts` y `generate/route.ts` | ✅ **RESUELTO** | Eliminado endpoint huérfano y consolidado 100% en `generar/route.ts`. |
| **4** | **PMC Subscription Gate** | Validar cuota y plan en generación de pasos del PMC | ✅ **RESUELTO** | Gate de suscripción activo con límite de plantilla (máx 35/100) en `pmc/[id]/generate-step/route.ts`. |
| **5** | **PIPS DELETE** | Verificar propiedad con `RETURNING id` y retornar 404 | ✅ **RESUELTO** | Implementado en `pips/[id]/route.ts` con tipado estricto y `logger.error`. |
| **6** | **Horarios as any** | Erradicar `as any` en wizards y solver de horarios | ✅ **RESUELTO** | Interfaces estrictas (`Escuela`, `Horario`, `Grupo`, `Docente`, `Aula`, `Carga`) en `types.ts`, `EditorHorarios`, `WizardConfiguracion` y `solver.ts`. |
| **7** | **PAEC Wizard Retry** | Agregar botón de reintento granular en steps del wizard | ✅ **RESUELTO** | Banner de reintento con clasificación de errores (Timeout, JSON, Rate-Limit, Red) y máx 3 reintentos en `PaecWizardClient.tsx`. |
| **8** | **PMC FODA Fallback** | Fallback estructurado si la IA no devuelve los 4 cuadrantes FODA | ✅ **RESUELTO** | Parser regex flexible con advertencia de revisión manual en `pmc/[id]/generate-step/route.ts`. |
| **9** | **SCHOOL_YEAR Central** | Erradicar `'2026-2027'` hardcodeado en UI y APIs | ✅ **RESUELTO** | Erradicado en PIPS Wizard, Horarios Editor, PAEC routes y centralizado en `@/lib/config`. |
| **10** | **PAEC Step 1 Validation** | Validación antes de avanzar al Step 2 | ✅ **RESUELTO** | Asteriscos rojos en campos obligatorios y bloqueo reactivo de botón en `PaecWizardClient.tsx`. |
| **11** | **Paridad PDF Oficiales** | Crear generadores PDF oficiales para PMC, PIPS y PAEC | ✅ **RESUELTO** | Creados `pmc-pdf-generator.ts`, `pips-pdf-generator.ts` y `paec-pdf-generator.ts` con rutas API y UI. |
| **12** | **PIPS Step 3 Preview** | Vista previa de concentrado zonal antes de exportar | ✅ **RESUELTO** | Tabla interactiva de concentrado zonal y modal de exportación/previsualización formateada en `PipsWizard.tsx`. |
| **13** | **PAEC Rubric / Audit** | Validación de criterios NEM contra rúbrica DBEPA | ✅ **RESUELTO** | Auditoría automática de 23 criterios ya activa en Step 7 del wizard. |
| **14** | **Horarios Solver Timeout** | Control de timeout en backtracking de asignación de horas | ✅ **RESUELTO** | Timeout de 30 segundos con `{ success: false, error: 'Conflicto no resoluble en tiempo límite' }` y `logger.warn` en `solver.ts`. |
| **15** | **CCT Lookup & Autocomplete** | Autocompletar datos del bachillerato a partir del CCT | ✅ **RESUELTO** | Endpoint `/api/admin/catalogo-escuelas` con catálogo oficial de Puebla e integración en PIPS y PAEC. |
| **16** | **PAEC Step 4-5 Cache** | Cache en cliente del mapeo curricular para navegación rápida | ✅ **RESUELTO** | Almacenamiento y recuperación en `localStorage` con invalidación selectiva en `PaecWizardClient.tsx`. |
| **17** | **PIPS School Directory** | Importación masiva de matrícula de escuelas vía Excel/CSV | ✅ **RESUELTO** | Modal con soporte de subida de archivo o pegado directo, validador de CCT y preview en `PipsWizard.tsx`. |
| **18** | **Logos Institucionales** | Carga unificada y confiable de sellos oficiales en PDFs | ✅ **RESUELTO** | Centralizado en `pdf-logos.ts` con compatibilidad servidor/cliente. |
| **19** | **Tipado jspdf-autotable** | Eliminar `(doc as any)` en renderizadores de documentos | ✅ **RESUELTO** | Archivo `jspdf-autotable.d.ts` creado y código refactorizado a APIs nativas. |
| **20** | **Logging de Producción** | Eliminar `console.log` en favor de `logger` estructurado | ✅ **RESUELTO** | Erradicado en `src/lib/` y rutas API, con sanitización automática. |
| **21** | **Manejo de Errores Catch** | Proteger bloques `catch` silenciosos en orquestadores | ✅ **RESUELTO** | Auditados y protegidos con `logger.warn` y `logger.error`. |
| **22** | **Rotación Multi-IA** | Aislar llamadas directas a Gemini y unificar en `ai-provider` | ✅ **RESUELTO** | Migrado a rotación automática con failover en toda la plataforma. |
| **23** | **Filtro de Criterios PAEC** | Filtrado de criterios deficientes vs aprobados en auditoría | ✅ **RESUELTO** | Implementado en `PaecWizardClient.tsx` con tabs de filtro. |
| **24** | **Deduplicación de Planes** | Validación contra duplicados en generación concurrente | ⏳ *Próximo Lote* | Constraints en BD e idempotency tokens. |
| **25** | **Firmas Reglamentarias** | Bloques oficiales de 3 firmas según normativa de Puebla | ✅ **RESUELTO** | Integrado en los 3 generadores PDF (PMC, PIPS, PAEC) según roles SEP. |

---

## 11. Ejecución del Lote A: Seguridad, Resiliencia y Robustez de UI (Septiembre 2026)

Se completó de forma exitosa la ejecución de los 6 pasos del Lote A de mejoras, manteniendo verificación continua de tipado con `npx tsc --noEmit` (código de salida 0 en cada fase):

1. **PASO 1 — Gate de Suscripción y Protección Anti-Desbordamiento en PMC:**
   - **Archivo:** `src/app/api/pmc/[id]/generate-step/route.ts`
   - Se integró la verificación obligatoria mediante `getSubscriptionStatus(session.user.id)`. Si el usuario carece de plan activo y no posee rol `ADMIN`, la API responde con `403 Forbidden` y un mensaje explícito orientando a la reactivación de cuenta.
   - **Protección de Tokens/Prompt:** Se blindó el endpoint contra solicitudes masivas (e.g. directores con más de 100 docentes) limitando la plantilla enviada a la IA a 35 miembros para usuarios estándar y 100 para administradores, evitando colapsos de contexto y timeouts.

2. **PASO 2 — Botón de Reintento y Clasificación de Errores en PAEC Wizard:**
   - **Archivo:** `src/app/[locale]/paec/nuevo/PaecWizardClient.tsx`
   - Se implementó la función clasificadora `classifyError` que distingue con precisión entre:
     - ⏳ *Timeout de red* (HTTP 504 / 408 / peticiones prolongadas).
     - ⚠️ *Respuesta IA malformada (JSON)* (errores de parseo o payloads truncados).
     - 🚦 *Límite de API alcanzado* (HTTP 429 / Rate limit de proveedores).
     - 📡 *Error de conexión de red* (pérdida de conectividad client-side).
   - Se añadió un banner de alerta con contador de reintentos por paso (`retryCount[activeStep]` limitado a un máximo de 3) y botón dedicado `↻ Reintentar (Paso X)`.

3. **PASO 3 — Parser Fallback Resiliente en PMC FODA:**
   - **Archivo:** `src/app/api/pmc/[id]/generate-step/route.ts`
   - Si la IA devuelve un JSON defectuoso o incompleto para el diagnóstico institucional (Paso 4), el sistema activa un parser secundario basado en expresiones regulares flexibles multilínea (`[\s\S]*?`) para rescatar los campos esenciales (`presentacion`, `contexto`, `analisis_indicadores`, `sintesis_foda`, `priorizacion`).
   - Si la extracción estructural falla por completo, almacena el texto crudo en `sintesis_foda` y devuelve una advertencia controlada (`warning: 'El FODA necesita revisión manual...'`) en lugar de arrojar un error 500 no controlado.

4. **PASO 4 — Validación Estricta en PAEC Paso 1 (Diagnóstico):**
   - **Archivo:** `src/app/[locale]/paec/nuevo/PaecWizardClient.tsx`
   - Se señalizaron todos los campos obligatorios del formulario diagnóstico con asteriscos rojos (`*`).
   - Se implementó la validación reactiva `isStep1Valid` que comprueba en tiempo real: nombre del proyecto, problemática comunitaria, ubicación y datos demográficos/económicos de la comunidad, y matrícula y docentes del plantel.
   - El botón `"Guardar y Empezar Generación"` permanece deshabilitado (`disabled`, opacidad reducida y cursor `not-allowed`) hasta que todos los requisitos sean satisfechos.

5. **PASO 5 — Timeout de Seguridad en Solver de Horarios (30s):**
   - **Archivo:** `src/lib/horarios/solver.ts`
   - Se configuró la constante de tiempo límite `GLOBAL_TIME_LIMIT = 30000;` (30 segundos).
   - Tanto el bucle de permutaciones mínimas como la búsqueda multi-start evalúan continuamente el tiempo transcurrido.
   - Si el solver excede los 30 segundos sin encontrar una solución factible con 0 empalmes, interrumpe la ejecución de forma ordenada y retorna `{ success: false, error: 'Conflicto no resoluble en tiempo límite' }`.
   - Se registra el incidente con `logger.warn` incluyendo métricas del plantel (`tiempoMs`, cantidad de grupos, docentes y cargas).

6. **PASO 6 — Anti Doble Clic y Feedback Visual de Generación en Wizards:**
   - **Archivos:** `PaecWizardClient.tsx`, `PmcWizardClient.tsx`, `PipsWizard.tsx`, `WizardConfiguracion.tsx`, `EditorHorarios.tsx`.
   - Se confirmó y reforzó que todos los botones de acción de IA se deshabiliten de forma inmediata al iniciar el proceso (`disabled={generating}`, `disabled={loading}`, etc.).
   - Se adicionaron spinners visuales animados y textos de estado dinámicos (`"Generando..."`, `"Reintentando..."`, `"Generando Horarios con IA..."`) para evitar envíos duplicados o sobrecarga concurrente de la API.

---

## 12. Ejecución del Lote B: Optimización, Experiencia de Usuario (UX) y Tipado Estricto (Septiembre 2026)

Se completó con éxito el **Lote B de mejoras**, erradicando los `as any` en el subsistema de Horarios, incorporando el Concentrado Zonal con previsualización en PIPS, dotando a la plataforma de autocompletado inteligente por CCT y optimizando la navegación en PAEC mediante caché local:

1. **PASO 1 — Tipado Estricto de Interfaces en Horarios:**
   - **Archivos:** `src/lib/horarios/types.ts` (creado), `src/components/horarios/EditorHorarios.tsx`, `src/components/horarios/WizardConfiguracion.tsx`, `src/lib/horarios/solver.ts`.
   - Se definieron interfaces canónicas en TypeScript: `Escuela`, `Horario`, `Grupo`, `Docente`, `Aula`, `Carga`, `ReglaDocente`, `SlotAsignado`, `SolverConfig`, `SolverOutput`.
   - Se reemplazaron todas las firmas `Props { escuela: any; ... }` por tipos fuertes en ambos componentes de UI.
   - Se eliminaron todos los `as any` en `WizardConfiguracion` (líneas 506-529, 2528), `EditorHorarios` (líneas 383, 826, 833, 1012) y `solver.ts` (líneas 247, 255, 324, 340).

2. **PASO 2 — Previsualización del Concentrado Zonal en PIPS Step 3:**
   - **Archivo:** `src/app/[locale]/pips/nuevo/PipsWizard.tsx`
   - El Paso 3 ahora se denomina formalmente **Directorio de Escuelas**, integrando una tabla de supervisión zonal con: No., Nombre del Plantel, CCT, Localidad, Municipio, Matrícula Hombres, Matrícula Mujeres, Total y fila de sumatoria de Concentrado Total Zonal.
   - Se integró el botón **"📋 Exportar vista previa"** que despliega un modal estilizado con encabezado institucional (Zona Escolar, Supervisor, Ciclo Escolar), KPIs consolidados, tabla formateada y botón de exportación rápida a portapapeles en formato TSV (para pegado directo en Excel y Google Sheets).

3. **PASO 3 — Autocompletado de Bachilleratos por CCT (Puebla):**
   - **Archivos:** `src/app/api/admin/catalogo-escuelas/route.ts` (nuevo endpoint), `PipsWizard.tsx`, `PaecWizardClient.tsx`.
   - Se desarrolló el endpoint unificado `/api/admin/catalogo-escuelas?cct=...` que consulta un catálogo maestro de bachilleratos estatales de Puebla (Zona 004 y planteles de referencia) complementado con búsquedas dinámicas en las tablas `supervisor_escuelas`, `teachers` y `pmc_projects`.
   - **En PIPS Wizard:** Al escribir la clave CCT en el alta de planteles, el sistema autocompleta nombre, municipio y localidad. Si no existe, muestra advertencia clara: *"CCT no encontrado en el catálogo de Puebla"*.
   - **En PAEC Wizard:** En la Sección 3 (*"Ficha de Datos del Plantel"*), se añadió el campo CCT con autocompletado en tiempo real de Nombre del Plantel, Municipio, Localidad y Zona Escolar, sugiriendo la ubicación comunitaria si aún no se había capturado, permitiendo continuar manualmente si la escuela es de nueva creación.

4. **PASO 4 — Caché de Steps PAEC en LocalStorage:**
   - **Archivo:** `src/app/[locale]/paec/nuevo/PaecWizardClient.tsx`
   - Se implementaron las funciones auxiliares `getCachedPaecStep`, `setCachedPaecStep` e `invalidatePaecStepCache`.
   - Al generar con IA el Paso 4 (*Cronograma*) o Paso 5 (*Detalle Curricular*), el resultado se almacena en `localStorage` bajo las claves `paec_cache_${projectId}_step4` y `paec_cache_${projectId}_step5`.
   - Al navegar entre pasos (adelante/atrás o carga inicial), el sistema restaura el contenido directamente desde la caché local sin requerir reconsultas lentas a la API.
   - Si el docente o directivo regenera un paso anterior (pasos 1, 2 o 3), el sistema invalida automáticamente la caché de los pasos 4 y 5 para garantizar coherencia pedagógica. Si regenera el paso 4, invalida la del paso 5.

5. **PASO 5 — Importador CSV para Directorio de Supervisión PIPS:**
   - **Archivo:** `src/app/[locale]/pips/nuevo/PipsWizard.tsx`
   - Se agregó en el Paso 3 el botón **"📥 Importar directorio desde CSV"** que abre un modal con dos modalidades de ingesta: carga de archivo `.csv`/`.txt`/`.tsv` o pegado directo de texto copiado de hojas de cálculo.
   - Parser inteligente que detecta delimitadores (coma, punto y coma, tabulación) e indexa columnas (`nombre, CCT, matricula_h, matricula_m`).
   - Validación sintáctica de formato CCT oficial de Puebla (con prefijo 21) mostrando insignias de estado (✓ Válido / ⚠️ No estándar) y previsualización de registros antes de la confirmación.
   - Al confirmar, concatena automáticamente las escuelas importadas al concentrado zonal `planteles_json` y actualiza `num_planteles`.

---

> **Verificación Global del Lote B:** Ejecución de `npx tsc --noEmit` completada con **código 0 (cero errores de compilación)** en todo el repositorio de SIGPDA-EMS. Plataforma 100% tipada, optimizada y operativa para Docentes, Directores y Supervisores.

---

## 13. Motor Generador PAEC-PEC 2.0 — Ejecución y Verificación de la FASE A (Septiembre 2026)

De acuerdo con el blueprint arquitectónico unificado y el estándar oficial de 35 páginas del Bachillerato General Estatal "Héroes de la Patria" (CCT 21EBH0200X), se ejecutó y validó la **FASE A: Migración de Base de Datos, Modelo de Tipos y Capa de Persistencia**:

1. **PASO 1 — Migración SQL en Base de Datos Neon (PostgreSQL):**
   - Se crearon las 6 columnas `JSONB` requeridas mediante script de migración idempotente (`ALTER TABLE paec_projects ADD COLUMN IF NOT EXISTS ...`):
     - `fase3_plan_operativo_a JSONB` (Plan Semestre A: 1°, 3°, 5° semestre, 16 semanas, metodología ABP/ApS y semana 16 de transferencia).
     - `fase3_plan_operativo_b JSONB` (Plan Semestre B: 2°, 4°, 6° semestre, 16 semanas, despliegue territorial y feria comunitaria).
     - `fase3_implementacion JSONB` (Carta de invitación comunitaria, minuta de asamblea y oficios para aliados estratégicos).
     - `fase4_gobernanza JSONB` (Calendario de 4 niveles de comités y metodología de evaluación formativa NEM Tabla 6).
     - `fase4_informe_supervision JSONB` (Informe final para Supervisión 004 / DG con metas vs logros y análisis pre/post).
     - `quality_audit JSONB` (Matriz de validación y auditoría de calidad contra los 23 criterios de la Rúbrica Oficial PAEC-PEC 2025).
   - Nomenclatura normalizada con prefijos limpios `fase3_` y `fase4_`.

2. **PASO 2 — Actualización del Modelo de Datos (`src/types/paec.ts`):**
   - Se agregaron las interfaces tipadas: `PaecCartaInvitacion`, `PaecSesionLanzamiento`, `PaecOficioAliado`, `PaecImplementacion`, `PaecCalendarioItem`, `PaecGobernanza`, `PaecMetaLogroRow`, `PaecInformeSupervision`, `PaecQualityAudit`.
   - Se extendió la entidad principal `PaecProject` con las propiedades camelCase correspondientes y se actualizó el rango operativo a 9 pasos (`currentStep: number`).

3. **PASO 3 — Capa de Persistencia y Helpers (`src/lib/db.ts`):**
   - Se modificó `updatePaecProjectStep` para admitir y mapear los 9 pasos del motor generador manteniendo retrocompatibilidad total con proyectos existentes de 7 pasos (`fase2_plan_operativo` y `fase2_anexos`).
   - Se implementó la función de auditoría `updatePaecQualityAudit(id, teacherId, auditData)`.
   - Se centralizó la hidratación y transformación de filas SQL snake_case a la entidad `PaecProject` en `mapRawPaecProject(raw)`, actualizando las rutas consumidoras (`/api/docx/paec/[id]`, `/api/pdf/paec/[id]`, `/api/paec/[id]/audit`).

4. **PASO 4 — Verificación Rigurosa y Compilación de Producción:**
   - Verificación de TypeScript: `npx tsc --noEmit` completado con **0 errores**.
   - Verificación de Build: `npm run build` completado exitosamente con **código de salida 0 (Next.js 16 Turbopack optimizado, 102 rutas estáticas/dinámicas generadas)**.

---

## 14. Motor Generador PAEC-PEC 2.0 — Ejecución y Verificación de la FASE B (Septiembre 2026)

Se completó en su totalidad la **FASE B: Orquestador de Prompts y Schemas Zod** dividida en las 3 sesiones de trabajo acordadas, garantizando una generación curricular de nivel excelencia:

1. **SESIÓN 1 — Prompts 1 al 3 (`src/lib/prompts/paec-prompts.ts`):**
   - **`buildPrompt1Diagnostico`:** Diagnóstico integral con datos duros situados (cifras de matrícula, porcentajes socioeconómicos y servicios reales), análisis FODA bajo la "Estrategia Maestra de Cruce Adaptativo" (FO, DO, FA, DA) y Tabla 4 con las 3 etapas metodológicas: 1. Recuperación de información, 2. Sistematización y análisis, 3. Selección consensuada del problema central.
   - **`buildPrompt2Justificacion`:** Justificación técnica obligatoria bajo los 4 sub-apartados del Criterio 7 DBEPA (Magnitud, Interés, Factibilidad, Oportunidad), 5 pilares estratégicos, propósito tridimensional (Educativo, Social, Funcional) y 5 metas numéricas medibles.
   - **`buildPrompt3Mapeo`:** Mapeo del 100% de UACs activas del catálogo escolar sin omisiones ni agrupaciones, respetando la nomenclatura curricular estricta NOM-MCCEMS (1.º-4.º Propósitos Formativos y Contenidos; 5.º-6.º Progresiones de Aprendizaje) y articulando una cadena de valor pedagógica interdisciplinar.

2. **SESIÓN 2 — Prompts 4 al 6 (`src/lib/prompts/paec-prompts.ts`):**
   - **`buildPrompt4Cronograma`:** Diseño general de implementación en 6 fases bimestrales bajo el estándar oficial de 5 columnas (Fase, Objetivo medible, Macro-actividades situadas, Asignaturas viga maestra con justificación de competencias, y Semestres involucrados).
   - **`buildPrompt5DetalleCurricular`:** Matriz curricular por semestre que fundamenta la intervención técnica y metodológica de cada asignatura en las fases bimestrales correspondientes.
   - **`buildPrompt6PlanOperativoSemestreA`:** Programación operativa de 16 semanas para semestres impares (1.°, 3.°, 5.°) con la estructura oficial de 8 columnas, metodologías activas (ABP, ApS, STEAM) y regla inquebrantable de cierre y entrega del Manual Técnico de Transferencia en la Semana 16.

3. **SESIÓN 3 — Prompts 7 al 9 (`src/lib/prompts/paec-prompts.ts`):**
   - **`buildPrompt7PlanOperativoSemestreB`:** Programación operativa de 16 semanas para semestres pares (2.°, 4.°, 6.°) con despliegue territorial, instalación comunitaria y semana 16 consagrada a la Feria Escolar Comunitaria, socialización abierta y evaluación de impacto POST.
   - **`buildPrompt8ImplementacionYAnexos`:** Generación completa de Carta de Convocatoria a Asamblea, Minuta de Arranque con acuerdos y firmas, 3 oficios formales para aliados estratégicos (Junta Auxiliar, Centro de Salud, Comisariado Ejidal) y los 6 anexos técnicos con esquemas tabulares detallados y contenido real.
   - **`buildPrompt9GobernanzaEInformeSupervision`:** Gobernanza escolar en 4 niveles institucionales (Comité PEC, CTE, Asamblea Comunitaria, Supervisión 004), metodología de evaluación formativa NEM basada en la Tabla 6 oficial, e Informe Final de Rendición de Cuentas con balance de Metas vs Logros y análisis comparativo Pre vs Post.

4. **Esquemas Zod en `src/lib/ai-schemas.ts`:**
   - Se crearon y exportaron los validadores: `PaecPaso6PlanSchema`, `PaecPaso7PlanSchema`, `PaecPaso8ImplementacionSchema`, `PaecPaso9GobernanzaSchema`.
   - Se mantuvieron intactos los esquemas y bloques de retrocompatibilidad (`PaecPaso6BlockSchema`, `PaecPaso6FullSchema`, `PaecPaso7Schema`).

5. **Orquestador API en `src/app/api/paec/[id]/generate-step/route.ts`:**
   - Se amplió la validación y ejecución a los 9 pasos del motor.
   - **Chunking Anti-Timeout en Pasos 6 y 7:** Si el número de UACs activas del semestre supera 8 materias, se subdividen automáticamente en bloques de 6 UACs con reintentos exponenciales y guardado de checkpoints parciales en la base de datos Neon.
   - **Retrocompatibilidad Automática:** Al guardar el Plan A o Plan B, se sincroniza simultáneamente la estructura `fase2_plan_operativo`. Al guardar el Paso 8, se sincronizan los 6 anexos en `fase2_anexos`.

6. **Verificación Rigurosa:**
   - **TypeScript Check:** `npx tsc --noEmit` completado con **0 errores**.
   - **Production Build:** `npm run build` completado exitosamente con **código de salida 0 (Next.js 16 Turbopack optimizado, 102 rutas estáticas/dinámicas generadas)**.

---

## 15. Motor Generador PAEC-PEC 2.0 — Ejecución y Verificación de la FASE C (Septiembre 2026)

Se completó en su totalidad la **FASE C: Quality Gate Oficial (`src/lib/paec-quality-gate.ts`)** implementando la auditoría automática contra los 23 criterios normativos de la Rúbrica Oficial PAEC-PEC 2025 (DBEPA / COSFAC / NEM):

1. **PASO 1 — Arquitectura del Quality Gate (`src/lib/paec-quality-gate.ts`):**
   - Se estructuraron las 8 dimensiones normativas y sus 23 criterios de evaluación continua:
     - **Dimensión 1: Diagnóstico Comunitario y Escolar (C1-C4):**
       - C1: Tabla 1 (Comunidad) con datos duros situados (cifras, porcentajes, fuentes INEGI/censo territorial).
       - C2: Tabla 2 (Educación) con indicadores reales del plantel (matrícula, rezago, aprobación, infraestructura).
       - C3: FODA con análisis cruzado FO-DO-FA-DA y articulación de Estrategia Maestra adaptativa.
       - C4: Tabla 4 con las 3 etapas técnicas documentadas (Recuperación, Análisis/Deliberación y Selección consensuada).
     - **Dimensión 2: Justificación y Fundamentación (C5-C7):**
       - C5: Introducción contextualizada al PEC con sentido comunitario y educativo profundo (≥100 palabras).
       - C6: Articulación de un mínimo de 5 pilares de la NEM desglosados en compromisos de proyecto.
       - C7: Sustentación del Criterio DBEPA en sus 4 vertientes técnicas (Magnitud, Interés, Factibilidad, Oportunidad).
     - **Dimensión 3: Mapeo Curricular y Cobertura (C8-C10):**
       - C8: Cobertura del 100% de UACs activas en semestres escolares sin omisiones ni exclusión de áreas.
       - C9: Nomenclatura NOM-MCCEMS estricta por semestre (erradicación de nombres de planes antiguos).
       - C10: Vinculación específica y diferenciada por asignatura en cadena de valor comunitaria.
     - **Dimensión 4: Cronograma Bimestral (C11-C12):**
       - C11: 6 fases bimestrales con 5 columnas normativas completas al 100%.
       - C12: Asignaturas viga maestra identificadas con justificación de su rol articulador y liderazgo pedagógico.
     - **Dimensión 5: Detalle Curricular y Progresiones (C13-C14):**
       - C13: Diferenciación normativa entre progresiones de aprendizaje (1.°-4.° semestre) y propósitos formativos (5.°-6.° semestre).
       - C14: Articulación curricular explícita de cada UAC con las fases del PEC y justificación de intervención.
     - **Dimensión 6: Plan Operativo Territorial (C15-C18):**
       - C15: Semestre A con cobertura completa de 16 semanas y las 8 columnas obligatorias pobladas.
       - C16: Semestre B con cobertura completa de 16 semanas y las 8 columnas obligatorias pobladas.
       - C17: Hito crítico de Semana 16 validado como Cierre/Transferencia (A) y Feria de Resultados Comunitarios (B).
       - C18: Metodologías sociocríticas activas documentadas (ABPC, STEAM, Aprendizaje Servicio, ABP).
     - **Dimensión 7: Implementación y Formalización (C19-C20):**
       - C19: Instrumentos de formalización con contenido real (Carta de Invitación, Minuta formal con firmas, Oficios a aliados territoriales).
       - C20: 6 anexos técnicos normativos completos y estructurados.
     - **Dimensión 8: Gobernanza Escolar e Informe de Supervisión (C21-C23):**
       - C21: Gobernanza multinivel estructurada en 4 niveles (Directivo, Colegiado, Aula, Comunidad) con calendario formal.
       - C22: Informe final de rendición de cuentas con tabla comparativa Metas vs Logros y análisis Pre/Post multidimensional.
       - C23: Plan de sostenibilidad y continuidad institucional con estrategias concretas de custodia comunitaria.
   - **Funciones Públicas Exportadas:**
     - `validatePaecStepResult(step: number, data: any): PaecQualityAudit` (evalúa los criterios específicos del paso en tiempo real).
     - `calculateGlobalPaecScore(project: PaecProject): PaecQualityAudit` (audita los 23 criterios sobre el proyecto integral, calcula score 0-100 y emite dictamen: `aprobado_excelente`, `aprobado` o `requiere_ajustes`).
     - `formatAuditReport(audit: PaecQualityAudit): string` (genera el dictamen oficial en Markdown con desglose por dimensión, tablas de criterios, observaciones técnicas y espacios para sellos y firmas de Supervisión Escolar).

2. **PASO 2 — Integración en `src/app/api/paec/[id]/generate-step/route.ts`:**
   - Después de cada persistencia en Neon (`updatePaecProjectStep`):
     - Se ejecuta `validatePaecStepResult(step, parsedJson)`.
     - Si algún criterio tiene puntaje menor a 60% (`score <= 2` de 4), se registra una advertencia detallada en logger (`logger.warn`) sin interrumpir ni bloquear la experiencia del docente.
     - Al completar el **Paso 9**, se invoca `calculateGlobalPaecScore(updatedProject)` y se persiste el dictamen definitivo en la columna `quality_audit` mediante `updatePaecQualityAudit`.
     - Se actualizó también el endpoint `/api/paec/[id]/audit` para aprovechar el nuevo motor de evaluación global y el formateador de reportes.

3. **PASO 3 — Verificación y Certificación Técnica:**
   - **TypeScript Compilation:** `npx tsc --noEmit` completado con **0 errores**.
   - **Production Build:** `npm run build` completado exitosamente con **código de salida 0 (Next.js 16 Turbopack optimizado, 102 rutas estáticas/dinámicas generadas)**.

---

## 16. Motor Generador PAEC-PEC 2.0 — Ejecución y Verificación de la FASE D: Wizard UI de 9 Pasos (`PaecWizardClient.tsx`) (Septiembre 2026)

Se completó en su totalidad la **FASE D: Wizard UI de 9 Pasos (`src/app/[locale]/paec/nuevo/PaecWizardClient.tsx`)**, modernizando la interfaz de usuario del generador de proyectos comunitarios para dar soporte pleno a la estructura de 35 páginas del estándar Bachillerato General "Héroes de la Patria" y a la Rúbrica de 23 Criterios DBEPA/NEM:

1. **Ampliación del Stepper de 7 a 9 Pasos:**
   - **Conservación de Pasos 1 a 5:**
     - Paso 1: Diagnóstico Comunitario y Escolar (FODA cruzado, Tablas 1 a 4).
     - Paso 2: Justificación y Fundamentación (Criterio DBEPA MIFO, Pilares NEM).
     - Paso 3: Mapeo Curricular y Cobertura (UACs participantes, vinculación comunitaria).
     - Paso 4: Cronograma Bimestral (6 fases bimestrales, asignaturas viga maestra).
     - Paso 5: Detalle Curricular y Progresiones (progresiones/propósitos formativos).
   - **Paso 6: Plan Operativo Territorial Semestre A:**
     - Renderizado de las 16 semanas escolares del Semestre A.
     - Tabla interactiva de 8 columnas normativas: *Semana, Fases PEC, Materias/UAC, Actividades Detalladas, Metodología Activa, Recursos Requeridos, Productos/Evidencias, Responsables*.
     - Identificador visual del semestre y orientación de arranque diagnóstica en semana 1 y cierre de ciclo A en semana 16.
   - **Paso 7: Plan Operativo Territorial Semestre B:**
     - Renderizado de las 16 semanas escolares del Semestre B con estructura idéntica de 8 columnas.
     - **Callout Normativo Especial en Semana 16:** Destacado visual dorado/ámbar (`rgba(245, 158, 11, 0.15)`) para la *Feria de Resultados Comunitarios, Evaluación de Impacto y Rendición de Cuentas*.
   - **Paso 8: Implementación y Anexos Operativos:**
     - **3 Acordeones Colapsables para Formalización Institucional:**
       1. *Carta de Invitación a la Comunidad:* Asunto, fecha, orden del día, objetivos de la reunión y cargo del directivo firmante.
       2. *Minuta de Arranque del Comité de Seguimiento:* Integración formal de la mesa directiva (presidente, secretario, vocales estudiantiles y comunitarios) y acuerdos de instalación.
       3. *Oficios a Aliados Estratégicos del Territorio:* Grid de oficios formales de colaboración dirigidos a dependencias gubernamentales, empresas locales, colectivos sociales y autoridades auxiliares/ejidales.
     - **6 Pestañas Interactivas (Tabs) para Anexos Técnicos de Campo:**
       - *Tab 1: Minuta Formal del Comité de Seguimiento.*
       - *Tab 2: Matriz de Seguimiento Semanal por UAC.*
       - *Tab 3: Reporte Mensual de Rendición de Cuentas (logros, dificultades y ajustes).*
       - *Tab 4: Encuesta de Impacto Comunitario (Escala Likert).*
       - *Tab 5: Instrumento de Autoevaluación para Estudiantes.*
       - *Tab 6: Rúbrica de Evaluación para el Trabajo Colegiado Docente.*
   - **Paso 9: Gobernanza Escolar, Informe de Supervisión 004 y Scorecard DBEPA:**
     - **2 Secciones Colapsables de Gestión Directiva:**
       1. *Gobernanza Escolar en 4 Niveles:* Directivo Plantel, Trabajo Colegiado Docente, Aula/Comunidad de Aprendizaje y Comunidad Territorial, con calendario de sesiones programadas y metodología de preguntas guía NEM.
       2. *Informe de Supervisión Escolar Guía 004:* Resumen ejecutivo, Tabla Metas vs Logros (programado vs alcanzado con semáforo de cumplimiento), Análisis Pre/Post multidimensional (participación, alcance territorial, competencias, conocimientos), obstáculos superados, plan de sostenibilidad y firmas de supervisión.
     - **Scorecard de Auditoría de Calidad Técnica PAEC (23 Criterios DBEPA/NEM):**
       - Semáforo físico tricolor y visualizador de porcentaje (Verde ≥80%, Amarillo 60-79%, Rojo <60%).
       - Contadores de criterios: *Cumple*, *Advertencias* y *Deficientes*.
       - Filtros interactivos (*Todos* vs *Observados*) y acordeón de lista detallada con justificación pedagógica y evidencia localizada.

2. **Barra Visual del Quality Gate en Cabecera (Bajo el Stepper):**
   - Indicador permanente de nivel de calidad con barra de progreso reactiva.
   - Botón interactivo para desplegar el resumen de criterios en popover sin abandonar el paso actual.
   - Botón de re-auditoría bajo demanda (`fetchAudit`).
   - **Aviso Informativo No Bloqueante:** Si el puntaje es menor a 80 puntos, se muestra una recomendación constructiva de mejora normativa, permitiendo al docente avanzar al siguiente paso o realizar modificaciones de acuerdo a sus tiempos institucionales.

3. **Lógica Condicional por Ciclo Escolar (`cycleType`):**
   - Soporte dinámico para `cycleType`: `'A'`, `'B'` y `'annual'`.
   - Función utilitaria `getVisibleSteps(cycleType)`:
     - Ciclo `A`: Pasos 1, 2, 3, 4, 5, 6, 8 (oculta planes de ciclo B e informe final anual).
     - Ciclo `B`: Pasos 1, 2, 3, 4, 5, 7, 9 (oculta planes de ciclo A e instrumentos iniciales).
     - Ciclo `annual`: Muestra los 9 pasos en su totalidad.
   - Navegación (`prevStep`, `nextStep`, botones inferiores de navegación y generación) sincronizada de manera automática con los pasos visibles.
   - Métodos de guardado manual y sincronización en tiempo real con `localStorage` y la base de datos Neon.

4. **Verificación y Certificación de Calidad:**
   - **TypeScript Strict Checking:** `npx tsc --noEmit` completado con **0 errores**.
   - **Production Build:** `npm run build` ejecutado exitosamente con **código de salida 0 (Next.js 16 Turbopack optimizado, 102 rutas generadas limpiamente)**.

---

### 17. FASE E: GENERADORES EDITORIALES DOCX Y PDF (30 A 35 PÁGINAS) — ESTÁNDAR SEP/DBEPA PUEBLA

Se completó en su totalidad la **FASE E: Generadores Editoriales DOCX y PDF** del Motor PAEC-PEC 2.0 (`src/lib/paec-docx-generator.ts` y `src/lib/paec-pdf-generator.ts`), implementando una arquitectura de orientación híbrida institucional y resolviendo el 100% de los señalamientos de la auditoría técnica OpenCode para cumplir con el estándar documental de 30 a 35 páginas del Bachillerato General "Héroes de la Patria":

#### 1. Resolución Integral de Señalamientos Técnicos (OpenCode Audit):
- **DOCX (`paec-docx-generator.ts`):**
  1. *Orientación Híbrida Real por Secciones Word:* Se estructuró el documento en 3 secciones nativas de Word (`SectionProperties`):
     - **Sección 1 (Portrait):** Macro-Fases I y II (Portada, Diagnóstico, FODA cruzado, Priorización, Justificación, Mapeo Curricular y Cronograma).
     - **Sección 2 (Landscape):** Macro-Fase III (Plan Operativo Territorial Semestre A y B en tablas de 8 columnas).
     - **Sección 3 (Portrait):** Macro-Fase III Formalización (Carta, Minuta, Oficios), 6 Anexos Técnicos y Macro-Fase IV (Gobernanza, Informe 004 y Firmas).
  2. *Renderizado de `fase3Implementacion`:* Carta Convocatoria con orden del día, Minuta de Instalación del Comité con compromisos operativos y los 3 Oficios formales a aliados territoriales (Presidencia Municipal, Sector Salud, Comisariado Ejidal).
  3. *Renderizado de `fase4Gobernanza`:* Calendario de 4 sesiones de gobernanza multinivel (Instalación, Medio Término, Monitoreo/Ajustes y Cierre/Rendición), Metodología de Evaluación Formativa y Preguntas Guía NEM.
  4. *Renderizado de `fase4InformeSupervision`:* Resumen Ejecutivo Oficial, Tabla Metas vs Logros con semáforos, Análisis Comparativo Situacional Pre/Post, Sistematización de Obstáculos/Soluciones y Plan de Sostenibilidad Comunitaria.
  5. *Matriz FODA Cruzada 4×2:* Reemplazo de tabla simple por matriz 2×2 acompañada de estrategias cruzadas explícitas (FO Maxi-Maxi, DO Mini-Maxi, FA Maxi-Mini y DA Mini-Mini).
  6. *Extracción Dinámica de Firmas:* Eliminación de textos genéricos; extracción vinculante desde `fase4InformeSupervision.firmas`, director convocante y autoridades de Supervisión Escolar Zona 004.

- **PDF (`paec-pdf-generator.ts`):**
  1. *Orientación Landscape Nativa para Plan Operativo:* Invocación de `doc.addPage('letter', 'landscape')` (279.4 mm × 215.9 mm) para las 16 semanas del Semestre A y Semestre B en 8 columnas, retornando a `doc.addPage('letter', 'portrait')` (215.9 mm × 279.4 mm) para el resto del expediente.
  2. *Páginas Dedicadas para los 6 Anexos Técnicos:* Cada anexo ocupa una página completa con diseño formal institucional:
     - Anexo 1: Cédula de Diagnóstico Comunitario Participativo.
     - Anexo 2: Matriz de Monitoreo y Seguimiento Semanal por UAC con Semáforo.
     - Anexo 3: Formato de Reporte Mensual de Avance y Ajustes Pedagógicos.
     - Anexo 4: Encuesta de Impacto Comunitario (Escala Likert de 5 niveles).
     - Anexo 5: Instrumento de Autoevaluación Estudiantil y Metacognición.
     - Anexo 6: Rúbrica de Evaluación del Trabajo Colegiado Docente.
  3. *Renderizado de `fase4InformeSupervision`:* Desglose técnico de metas cualitativas/cuantitativas, análisis pre/post en dos columnas territoriales, obstáculos y sostenibilidad.
  4. *Documentos Formales en Páginas Separadas:* Carta Convocatoria (P20), Minuta de Instalación (P21) y 3 Oficios Individuales de Vinculación (P22 Presidencia, P23 Salud, P24 Ejido) cada uno con acuse de recibo y bloque de sellos.
  5. *Mapeo Curricular Completo:* Desglose de todas las UACs con sus progresiones, horas de dedicación y articulación comunitaria.
  6. *Meta Cumplida de 35 Páginas:* Distribución editorial exacta de 35 páginas (1:1 con el estándar de supervisión escolar DBEPA).

#### 2. Distribución Exacta del Dossier Editorial (35 Páginas):
- **Macro-Fase I: Portada y Diagnóstico (pp. 1-5) [Portrait]:**
  - *Pág 1:* Portada Oficial Monumental SEP/DBEPA con logos institucionales, recuadros centrales y datos del plantel.
  - *Pág 2:* Cédula Oficial de Identificación Institucional del Proyecto PEC y marco jurídico-normativo de la NEM.
  - *Pág 3:* Diagnóstico Territorial Integral (1.1 Diagnóstico Comunitario Tabla 1 y 1.2 Diagnóstico del Centro Educativo Tabla 2).
  - *Pág 4:* 1.3 Matriz FODA Integral (2×2) y Formulación de Estrategias Cruzadas Situadas (4×2: FO, DO, FA, DA).
  - *Pág 5:* 1.4 Proceso Técnico de Priorización (Tabla 4 DBEPA), Matriz de Ponderación Multicriterio y Declaratoria del Problema.
- **Macro-Fase II: Justificación Pedagógica y Diseño Curricular (pp. 6-11) [Portrait]:**
  - *Pág 6:* 2.1 Fundamentación en la NEM, Pilares Fundamentales, 2.2 Propósitos Integrales (MIFO) y Alcance Territorial.
  - *Pág 7:* 2.3 Mapeo Curricular Integral y Articulación Multidisciplinaria (Semestres 1°, 2° y 3°).
  - *Pág 8:* 2.3 Mapeo Curricular Integral (Semestres 4°, 5° y 6°).
  - *Pág 9:* 2.4 Cronograma Bimestral Macro del Proyecto (6 Fases Oficiales × 5 Columnas).
  - *Pág 10:* 2.5 Detalle Curricular: Progresiones y Metas — Semestre A (Semestres Nones 1°, 3°, 5°).
  - *Pág 11:* 2.5 Detalle Curricular: Progresiones y Metas — Semestre B (Semestres Pares 2°, 4°, 6°).
- **Macro-Fase III: Plan Operativo Territorial e Instrumentos (pp. 12-30):**
  - *Pág 12:* Plan Operativo Semestre A — Semanas 1 a 4 (Fase I: Diagnóstico) [Landscape, 8 cols].
  - *Pág 13:* Plan Operativo Semestre A — Semanas 5 a 8 (Fase II: Diseño) [Landscape, 8 cols].
  - *Pág 14:* Plan Operativo Semestre A — Semanas 9 a 12 (Fase III: Gestión) [Landscape, 8 cols].
  - *Pág 15:* Plan Operativo Semestre A — Semanas 13 a 16 (Fase IV: Ejecución) [Landscape, 8 cols].
  - *Pág 16:* Plan Operativo Semestre B — Semanas 1 a 4 (Fase IV: Intervención) [Landscape, 8 cols].
  - *Pág 17:* Plan Operativo Semestre B — Semanas 5 a 8 (Fase V: Monitoreo) [Landscape, 8 cols].
  - *Pág 18:* Plan Operativo Semestre B — Semanas 9 a 12 (Fase V: Evaluación) [Landscape, 8 cols].
  - *Pág 19:* Plan Operativo Semestre B — Semanas 13 a 16 (Fase VI: Cierre y Feria Comunitaria con llamada destacada) [Landscape, 8 cols].
  - *Pág 20:* 3.1 Carta Oficial de Convocatoria a la Asamblea Escolar y Comunitaria [Portrait].
  - *Pág 21:* 3.2 Minuta de Instalación del Comité de Seguimiento Comunitario [Portrait].
  - *Pág 22:* 3.3 Oficio Oficial a Aliados No. 001/PEC — H. Ayuntamiento Municipal [Portrait].
  - *Pág 23:* 3.3 Oficio Oficial a Aliados No. 002/PEC — Centro de Salud Territorial [Portrait].
  - *Pág 24:* 3.3 Oficio Oficial a Aliados No. 003/PEC — Comité Ejidal y Productores [Portrait].
  - *Pág 25:* Anexo 1: Cédula de Diagnóstico Comunitario Participativo [Portrait].
  - *Pág 26:* Anexo 2: Matriz de Monitoreo y Seguimiento Semanal por UAC [Portrait].
  - *Pág 27:* Anexo 3: Formato de Reporte Mensual de Avance y Ajustes Pedagógicos [Portrait].
  - *Pág 28:* Anexo 4: Encuesta de Impacto Comunitario (Escala Likert 5 Niveles) [Portrait].
  - *Pág 29:* Anexo 5: Instrumento de Autoevaluación Estudiantil y Metacognición [Portrait].
  - *Pág 30:* Anexo 6: Rúbrica de Evaluación del Trabajo Colegiado Docente [Portrait].
- **Macro-Fase IV: Gobernanza, Evaluación e Informe 004 (pp. 31-35) [Portrait]:**
  - *Pág 31:* Macro-Fase IV: 4.1 Calendario y Estructura de Sesiones de Gobernanza Escolar (4 Sesiones × 6 Columnas).
  - *Pág 32:* 4.2 Metodología de Evaluación Formativa y Preguntas Guía NEM.
  - *Pág 33:* 4.3 Informe Oficial para Supervisión Escolar (Guía DBEPA 004): Resumen Ejecutivo y Metas vs Logros.
  - *Pág 34:* 4.4 Análisis Comparativo Situacional Pre/Post, Obstáculos Superados y Plan de Sostenibilidad.
  - *Pág 35:* 4.6 Dictamen Oficial de Validación Colegiada y Firmas Reglamentarias Extraídas (Elaboró, Revisó, Testigo Social y Código SHA256 de Validación Digital).

#### 3. Verificación y Resultados de Ejecución:
#### 4. Corrección y Pulido de Observaciones Menores (DOCX y PDF):
- **Normalizador Universal de Datos FODA (`parseFodaData`):**
  - Implementado tanto en `paec-docx-generator.ts` como en `paec-pdf-generator.ts`.
  - Normaliza cadenas con eliminación de diacríticos (`normalize("NFD")`), detección case-insensitive de prefijos y términos (español/inglés: fortalezas/strengths, oportunidades/opportunities, debilidades/weaknesses, amenazas/threats, FO/DO/FA/DA, maxi-maxi, mini-maxi, maxi-mini, mini-mini).
  - Incluye fallback posicional inteligente para arreglos de 4 u 8 posiciones cuando no existen etiquetas semánticas explícitas.
  - Inyecta fallbacks pedagógicos oficiales DBEPA / SEP Puebla de máxima calidad en caso de arrays u objetos vacíos.
- **Anexo 1 en DOCX Estructurado:**
  - Sustituido el párrafo descriptivo por la tabla técnica institucional completa de 2 columnas: *Cédula de Diagnóstico Comunitario Participativo y Levantamiento de Campo* (Objetivo del Instrumento, Metodología de Aplicación, Universo de Muestreo, Dimensiones Indagadas, Responsables de Brigada y Criterios de Validación), alineada 1:1 con el instrumento oficial del PDF (pág. 25).
- **Encuestas y Rúbricas Likert en DOCX (Anexos 4, 5 y 6):**
  - Desplegados los 8 reactivos normativos completos para cada instrumento (Impacto Comunitario, Autoevaluación Estudiantil y Coevaluación del Trabajo Colegiado Docente).
  - Formato tabular de 7 columnas (`Reactivo`, `Dimensión`, `TD (1)`, `D (2)`, `N (3)`, `A (4)`, `TA (5)`), leyenda técnica de escala y saltos de página dedicados para impresión independiente.
- **Validación Integral de Salida:**
  - `npx tsc --noEmit`: **0 errores**.
  - `scratch/inspect_with_pdfjs.ts`: **Exactamente 35 páginas verificadas** con orientación híbrida perfecta (P1-P11 Portrait, P12-P19 Landscape de 8 columnas, P20-P35 Portrait).
  - `npm run build`: **Código de salida 0 (102 rutas estáticas y dinámicas compiladas en Next.js 16.2.9)**.





