// src/lib/prompts/pips-chunks.ts

import { SCHOOL_YEAR } from '@/lib/config';

/**
 * PIPS Generation Prompts - Chunked Architecture
 *
 * Dividimos la generación en 3 partes secuenciales:
 * - Parte 1: Portada, Presentación, Fundamentación Normativa y Diagnóstico de la Zona
 * - Parte 2: Análisis FODA, Objetivos, Metas e Indicadores (SMART)
 * - Parte 3: Líneas de Acción, Cronograma Institucional (basado en el PAT), Seguimiento y Evaluación
 */

export const PIPS_SYSTEM_PROMPT = `Eres un experto en supervisión escolar y planificación pedagógica del Bachillerato General Estatal (BGE) en Puebla, México.
Tu tarea es generar secciones de alta calidad para el Plan de Intervención Pedagógica de Supervisión (PIPS) ${SCHOOL_YEAR} de la Zona Escolar 004.

Directrices institucionales del PIPS en Puebla:
1. Usar un lenguaje formal, institucional y con sólida fundamentación técnico-pedagógica.
2. Alineación rigurosa a los principios de la Nueva Escuela Mexicana (NEM) y el MCCEMS.
3. Incorporar los municipios de cobertura: Venustiano Carranza, Francisco Z. Mena, Pantepec y Jalpan.
4. NUNCA inventes nombres de planteles, claves CCT ni estadísticas. Todo debe salir de los datos provistos.
5. El calendario y cronograma se anclan en las directrices del Plan Anual de Trabajo (PAT) 2025-2026 proyectado a ${SCHOOL_YEAR} como fechas preliminares.`;

export function getChunk1Prompt(row: any, plantelesData: any[], totalAlumnos: number, totalPersonal: any): string {
  return `Genera la **PARTE 1** del Plan de Intervención Pedagógica de Supervisión (PIPS) ${SCHOOL_YEAR}.

Información base de la supervisión:
- Zona escolar: ${row.zona_nombre} (Clave: ${row.zona_clave ?? '21FMS0020X'})
- Supervisor: ${row.supervisor_name || 'Ing. Alejandro Escamilla Martínez'}
- Municipio Sede: ${row.municipio_sede || 'Venustiano Carranza (Lázaro Cárdenas)'}
- Municipios que atiende: Venustiano Carranza, Francisco Z. Mena, Pantepec, Jalpan
- Sede: Lázaro Cárdenas, Venustiano Carranza, Puebla.
- Planteles activos: 17 planteles generales.
- Asesores Técnicos Pedagógicos (ATP):
  * Ing. Samuel Cruz Interial
  * Imelda Hernández García
  * Víctor Manuel Sáenz Cuéllar
  * Lilia Castillo Leyva
- Matrícula Total: ${totalAlumnos} alumnos en total de la zona.
- Resumen del personal de la zona: ${totalPersonal.docentes} Docentes, ${totalPersonal.responsables} Responsables de Plantel, ${totalPersonal.apoyo} Administrativos/Apoyo (Total: ${totalPersonal.total} figuras, con ${totalPersonal.horas} horas totales).

Presentación base del supervisor:
"${row.presentacion_supervisor || 'La supervisión escolar ejerce funciones de acompañamiento técnico-pedagógico y administrativo.'}"

Reflexión del PIPS del ciclo anterior (2024-2025):
- Fortalezas anteriores: ${row.fortalezas_anterior || 'Monitoreo constante y visitas presenciales programadas.'}
- Áreas de oportunidad anteriores: ${row.areas_oportunidad_anterior || 'Falta de desagregación de datos por plantel y carencia de análisis de correspondencia con plantillas.'}
- Reflexión general: ${row.reflexion_pips_anterior || 'Se detectó que el plan anterior era muy generalista y no atacaba las problemáticas específicas de cada plantel.'}

Contexto Socioeducativo de la zona:
"${row.diagnostico_contexto || 'La zona 004 está ubicada en la región Sierra Norte de Puebla, caracterizada por planteles rurales y semiurbanos con alto grado de marginación, asimetrías de conectividad y recursos limitados.'}"

Detalle cuantitativo de los 17 planteles para el diagnóstico:
${JSON.stringify(plantelesData, null, 2)}

---

**ESTRUCTURA QUE DEBES GENERAR PARA LA PARTE 1 (Redacta el texto extendido completo en Markdown):**

# 1. PRESENTACIÓN
- Redacta una presentación institucional formal (mínimo 3 párrafos robustos) firmada por el supervisor.
- Explica la importancia estratégica del PIPS en el marco del MCCEMS y la Nueva Escuela Mexicana.

# 2. FUNDAMENTACIÓN NORMATIVA
Menciona la fundamentación normativa aplicable a la supervisión escolar.
**IMPORTANTE:** SÓLO enlista los nombres de las Leyes, Reglamentos, Acuerdos, Lineamientos, etc., y los números de los artículos aplicables (ej. Artículo 3°). **NO incluyas el texto completo de los artículos** en el documento. Apóyate en el contexto normativo proveído:
- Constitución Política de los Estados Unidos Mexicanos.
- Ley General de Educación (LGE) y Ley de Educación del Estado de Puebla.
- Lineamientos específicos de la DBEPA para la elaboración del PIPS.

# 3. REFLEXIÓN SOBRE EL PIPS DEL CICLO ANTERIOR (2024-2025)
- **Qué contenía el PIPS anterior:** Describe de forma crítica qué estructura y alcances tuvo.
- **Fortalezas del plan anterior:** Cita los aciertos reales (ej. cronograma mensual, acompañamiento).
- **Áreas de mejora detectadas:** Analiza por qué era básico (ej. no desagregaba datos por plantel, carecía de FODA).
- **Compromiso para este PIPS ${SCHOOL_YEAR}:** Describe cómo este plan corrige esas deficiencias (desagregación de abandono, análisis de plantillas y alineación con el PAT).

# 4. DIAGNÓSTICO DE LA ZONA ESCOLAR
- **Datos generales de la supervisión:** Redacta un análisis integrador de las características físicas, geográficas y administrativas.
- **Problemáticas prioritarias detectadas en la revisión de los PMC y PAEC-PEC:**
  * Analiza cuantitativa y cualitativamente el cumplimiento documental promedio de los planteles.
  * Agrupa y describe las problemáticas en:
    a) Desarrollo académico y del aprendizaje (enfocado en el abandono escolar variable y la eficiencia terminal).
    b) Gestión y administración escolar (distancias geográficas, falta de administrativos y asimetrías de horas).
    c) Desarrollo socioemocional y prevención de la violencia (adicciones, dinámicas familiares y problemáticas locales reportadas en los PAEC).

Redacta de forma muy fluida, profesional y exhaustiva, sin dejar resúmenes ni marcadores de posición. Devuelve únicamente el Markdown de estas secciones.`;
}

export function getChunk2Prompt(row: any, chunk1Result: string): string {
  return `Con base en el diagnóstico y la primera parte del PIPS que se ha generado a continuación, genera la **PARTE 2** del documento.

---
**PARTE 1 GENERADA ANTERIORMENTE (Como referencia y contexto):**
${chunk1Result.slice(-4000)} // Contexto reciente
---

**ESTRUCTURA QUE DEBES GENERAR PARA LA PARTE 2 (Redacta en Markdown):**

# 5. ANÁLISIS FODA DE LA SUPERVISIÓN ESCOLAR (ZONA 004)
Genera un análisis FODA exhaustivo y adaptado específicamente al diagnóstico previo:
- **Fortalezas:** Compromiso del supervisor y los 4 ATPs, PMC y PAEC entregados en su mayoría.
- **Oportunidades:** El PAT establece un marco de fechas oficial claro, sinergias con comités comunitarios.
- **Debilidades:** Planteles críticos sin personal de apoyo administrativo, escuelas con matrícula baja y alta precarización.
- **Amenazas:** Dispersión geográfica, riesgos externos como migración o violencia familiar.

# 6. OBJETIVOS DE INTERVENCIÓN PEDAGÓGICA (Ciclo ${SCHOOL_YEAR})
- **Objetivo General:** (Debe enfocarse en el acompañamiento técnico-pedagógico y administrativo diferenciado de la supervisión y los ATP).
- **Objetivos Específicos y Metas SMART:**
  * Genera tres objetivos específicos correspondientes a los 3 ámbitos principales:
    1) Ámbito Académico y del Aprendizaje (permanencia escolar, metas de abatimiento de abandono).
    2) Ámbito de Gestión y Acompañamiento Administrativo (recuperación de PMC rezagados, distribución y optimización de horas, apoyo a planteles sin administrativos).
    3) Ámbito Socioemocional y Cultura de Paz (seguimiento del PAEC, proyectos comunitarios PEC y evidencias Cultura de Paz).
  * Para cada objetivo específico, define de 2 a 3 metas SMART claras, detallando: meta, indicador de logro, plantel(es) prioritarios y responsable directo de zona/ATP.

Asegúrate de que la redacción sea formal, madura y completa. Devuelve únicamente el Markdown de estas secciones.`;
}

export function getChunk3Prompt(row: any, chunk1And2Result: string): string {
  return `Con base en toda la planeación de objetivos y el diagnóstico previo de la Zona Escolar 004, genera la **PARTE 3 (Y FINAL)** del Plan de Intervención Pedagógica de Supervisión (PIPS) ${SCHOOL_YEAR}.

---
**CONTEXTO DE OBJETIVOS GENERADOS (Como referencia):**
${chunk1And2Result.slice(-3000)}
---

**ESTRUCTURA QUE DEBES GENERAR PARA LA PARTE 3 (Redacta en Markdown):**

# 7. PLAN DE ACCIÓN, ESTRATEGIAS Y CRONOGRAMA INSTITUCIONAL
- **Líneas de Acción y Estrategias:** Describe las estrategias concretas del equipo de supervisión (ej. visitas in situ focalizadas a planteles prioritarios, talleres de alineación de progresiones NEM).
- **Cronograma de Actividades Anclado al PAT ${SCHOOL_YEAR} (Tentativo):**
  * Presenta la proyección de actividades y entregables oficiales en los meses clave del ciclo escolar:
    - Octubre 2026: Elaboración final y entrega del PIPS a la DBEPA.
    - Noviembre 2026: Primera evidencia de Cultura de Paz y primer reporte de visita técnica de ATPs.
    - Febrero 2027: Reporte intermedio de Avances del PIPS a la DBEPA.
    - Mayo 2027: Segunda evidencia de Cultura de Paz y visitas de seguimiento.
    - Junio/Julio 2027: Entrega de Reporte de Resultados y Reporte Final del PIPS.
  * Nota importante aclaratoria sobre la provisionalidad del PAT ${SCHOOL_YEAR} hasta la publicación oficial.

# 8. SEGUIMIENTO, ACOMPAÑAMIENTO Y EVALUACIÓN DEL PLAN
- **Mecanismos de Acompañamiento:** Instrumentos (bitácoras de visita, rúbricas de alineación).
- **Evaluación del Plan de Intervención:** Indicadores cuantitativos globales de éxito para medir el impacto de la intervención en la zona escolar.
- **Retroalimentación Externa:** Estrategia formal de solicitud de dictamen a la DBEPA.

# 9. RECURSOS Y FUENTES DE REFERENCIA
- Describe los recursos materiales y humanos con los que cuenta la supervisión (ATP, viáticos, tecnologías).
- Fuentes de consulta formales en formato APA 7ª edición (incluyendo la Constitución Mexicana, la Guía PIPS DBEPA y las planeaciones de la zona escolar).

Redacta de manera institucional y formal. Devuelve únicamente el Markdown de esta sección final.`;
}
