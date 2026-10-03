/**
 * ============================================================================
 * PAEC REGULATORY CONTEXT PACK (H-311)
 * ============================================================================
 * 
 * Inyección de criterios normativos oficiales VERBATIM extraídos directamente
 * de la Rúbrica Oficial PAEC-PEC 2025 VF (DGB / MCCEMS / Nueva Escuela Mexicana).
 *
 * Reglas de Arquitectura:
 * 1. Textos 100% literales de la rúbrica oficial, sin paráfrasis ni adulteraciones.
 * 2. Invocado una sola vez por llamada HTTP POST en route.ts.
 * 3. Presupuesto de longitud garantizado: <= 6,000 caracteres por paso.
 */

export const CRITERIO_8_VERBATIM = `8. El PEC se integra de los 6 contenidos mínimos:
- Nombre del proyecto.
- Introducción.
- Propósito y alcance.
- Diseño general.
- Plan operativo.
- Anexos.`;

export const CRITERIO_23_VERBATIM = `23. Los documentos revisados referentes al PAEC – PEC presentan redacción coherente y ortografía correcta.`;

export const CRITERIOS_VERBATIM_POR_PASO: Record<number, string[]> = {
  // PASO 1: Diagnóstico Colectivo y Metodología de Análisis
  1: [
    `2. En el Diagnóstico colectivo se identifican los 4 ejes temáticos:
- Características de la comunidad
- Características de la educación
- Análisis de información
- Principales problemáticas o necesidades de la comunidad`,

    `3. El diagnóstico describe las características de la comunidad:
- Ubicación geográfica
- Situación demográfica
- Situación socioeconómica
- Seguridad
- Participación comunitaria
- Recursos y servicios
- Medio ambiente`,

    `4. El diagnóstico describe las características de la educación:
- Cobertura
- Contexto familiar
- Contexto estudiantil
- Plantel
- Indicadores educativos
- Programas o proyectos`,

    `5. El análisis de información se realiza mediante alguna metodología: FODA, Árbol de Problemas, Diagrama de Ishikawa u otros`,

    `6. La problemática o necesidad seleccionada se deriva de la información contenida en el diagnóstico colectivo.
- Características de la Comunidad.
- Características de la educación.
- Análisis de la información.`
  ],

  // PASO 2: Justificación, Propósito y Alcance
  2: [
    `1. Comité del plantel:
Figuras mínimas obligatorias:
- Responsable de plantel (1)
- Docentes (2)
- Estudiantes (2)
- Padres de familia (1)
Son integrantes obligatorios en donde existen las figuras: un representante de asociación civil o dependencia pública o privada de la comunidad. Son opcionales: un apoyo administrativo y una autoridad local.`,

    `7. La problemática o necesidad seleccionada se justifica para ser atendida desde la acción de colectivo estudiantil y la comunidad, considerando a las siguientes razones:
- Magnitud
- Interés.
- Factibilidad.
- Oportunidad.`,

    `9. El propósito del PEC describe el qué y para qué, vinculado a la problemática que necesidad seleccionada.`,

    `10. Periodo de realización del PEC (semestral o anual).`
  ],

  // PASO 3: Mapeo Curricular y Densidad Interdisciplinar
  3: [
    `14. En el Abordaje de las UAC para el desarrollo del PEC se identifica la articulación de:
- Currículo fundamental.
- Recursos sociocognitivos / Áreas del conocimiento/ Ámbitos de la formación socioemocional / competencias laborales*.
- Progresiones de aprendizaje por semestre.
- Fases del proyecto.`
  ],

  // PASO 4: Cronograma y Fases Bimestrales
  4: [
    `10. Periodo de realización del PEC (semestral o anual).`,

    `11. Las fases (etapas) del PEC se describen de manera coherente y articulada para lograr el propósito.`,

    `12. Las actividades propician la vinculación de la escuela con la Comunidad.`,

    `13. Las actividades descritas están relacionadas y aportan al desarrollo de su fase correspondiente.`
  ],

  // PASO 5: Detalle Curricular y Progresiones/Propósitos
  5: [
    `14. En el Abordaje de las UAC para el desarrollo del PEC se identifica la articulación de:
- Currículo fundamental.
- Recursos sociocognitivos / Áreas del conocimiento/ Ámbitos de la formación socioemocional / competencias laborales*.
- Progresiones de aprendizaje por semestre.
- Fases del proyecto.`
  ],

  // PASO 6: Plan Operativo Semestre A (8 Columnas)
  6: [
    `15. Integración del plan operativo.
- Fase del proyecto.
- Actividad.
- UAC
- Progresión de aprendizaje.
- Estrategia didáctica.
- Semana.
- Participante.`,

    `16. El plan operativo integra las estrategias didácticas que vincula al estudiantado con la Comunidad.`,

    `17. Identifica el tipo de evaluación formativa que se utilizará vinculada a la estrategia didáctica.`
  ],

  // PASO 7: Plan Operativo Semestre B (8 Columnas)
  7: [
    `15. Integración del plan operativo.
- Fase del proyecto.
- Actividad.
- UAC
- Progresión de aprendizaje.
- Estrategia didáctica.
- Semana.
- Participante.`,

    `16. El plan operativo integra las estrategias didácticas que vincula al estudiantado con la Comunidad.`,

    `17. Identifica el tipo de evaluación formativa que se utilizará vinculada a la estrategia didáctica.`
  ],

  // PASO 8: Implementación, Formalización y Anexos Técnicos
  8: [
    `1. Comité del plantel:
Figuras mínimas obligatorias:
- Responsable de plantel (1)
- Docentes (2)
- Estudiantes (2)
- Padres de familia (1)
Son integrantes obligatorios en donde existen las figuras: un representante de asociación civil o dependencia pública o privada de la comunidad. Son opcionales: un apoyo administrativo y una autoridad local.`,

    `18. El responsable del plantel cuenta con evidencias acerca de la participación del colegiado docente en el proceso de discusión, identificación e integración de las progresiones de las UAC al PEC.`,

    `19. En el diseño del PEC se identifica la participación de las figuras involucradas.
- Directivos.
- Docentes.
- Estudiantes.
- Padres de familia.
- Comunidad (autoridades locales y asociaciones civiles)`
  ],

  // PASO 9: Gobernanza, Seguimiento e Informe de Supervisión
  9: [
    `20. Se identifica la realización de un informe como mecanismo de socialización del PEC a la Supervisión Escolar con toda la documentación:
-Diseño.
-Plan operativo.
-Minutas.
-Planeación didáctica articulada al proyecto.
-Productos o resultados`,

    `21. Seguimiento y retroalimentación del PEC (mensual, por momento de evaluación, semestral)
Evidencia de retroalimentación recibida por parte de Supervisión Escolar.`,

    `22. Componentes del PAEC:
- Recursos pedagógicos o referentes curriculares.
- Estructura organizacional.
     Comité del Plantel.
     Colegiado docente.
     Colectivo estudiantil.
     Colectivo escolar, apoyos administrativos y pedagógicos.
     Comunidad.
- Clima organizacional.
     Participación abierta e inclusiva.
     Trabajo colaborativo.
     Autonomía en la didáctica.
- Productos.
     PEC y otros proyectos.`
  ]
};

/**
 * Obtiene el paquete de contexto regulatorio oficial para un paso específico del PAEC.
 * 
 * @param step Número de paso (1 al 9)
 * @returns Cadena formateada para inyección en el prompt del sistema o usuario
 */
export function getPaecRegulatoryContext(step: number): string {
  const stepCriteria = CRITERIOS_VERBATIM_POR_PASO[step] || [];
  if (stepCriteria.length === 0) return '';

  const header = `### CRITERIOS OFICIALES DE EVALUACIÓN (RÚBRICA PAEC-PEC 2025 — PASO ${step}):\nEl contenido generado para este paso debe satisfacer con rigor técnico y evidencia observable los siguientes criterios normativos obligatorios:`;

  const body = stepCriteria.map((c, i) => `[Criterio Normativo ${i + 1}]\n${c}`).join('\n\n');

  const globalHeader = `\n[Criterios Transversales Obligatorios]\n${CRITERIO_8_VERBATIM}\n\n${CRITERIO_23_VERBATIM}`;

  const fullBlock = `${header}\n\n${body}\n${globalHeader}`;

  // Invariante de seguridad: Límite estricto <= 6000 caracteres
  if (fullBlock.length > 6000) {
    return fullBlock.slice(0, 6000);
  }

  return fullBlock;
}
