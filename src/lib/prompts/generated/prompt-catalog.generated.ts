// AUTO-GENERADO por scripts/build-prompt-catalog.ts — NO EDITAR A MANO.
// Fuente: src/prompts/catalog/planeacion/*.md

export type PlanningPromptType = 'laboral' | 'fundamental' | 'extendido';

export interface PromptCatalogEntry {
  id: string;
  tipo: PlanningPromptType;
  version: string;
  descripcion: string;
  contenido: string;
}

export const PROMPT_CATALOG: Record<PlanningPromptType, PromptCatalogEntry> = {
  extendido: {
    id: "planeacion/extendido",
    tipo: "extendido",
    version: "v1",
    descripcion: "Secuencia didáctica para Formación Fundamental Extendida (obligatoria u optativa) y talleres de ampliación.",
    contenido: "# Reglas específicas — Planeación de Formación Fundamental Extendida\n\n## Estructura obligatoria\n\n1. Identifica si la UAC es **obligatoria** u **optativa** y declara el campo de formación extendida al que pertenece.\n2. Organiza la secuencia por los propósitos y contenidos del programa extendido; cuando no exista programa, fundamenta la propuesta en el perfil de egreso y en las necesidades del contexto escolar.\n3. Cada corte debe declarar: propósito, contenido, actividad, evidencia y criterio de evaluación.\n4. El cierre debe producir una evidencia transferible a la vida escolar o comunitaria del estudiante.\n\n## Alineación curricular\n\n- No dupliques contenidos del Currículum Fundamental; justifica el valor formativo adicional de la UAC extendida.\n- Vincula la secuencia con el proyecto PAEC y con el contexto de la zona escolar cuando sea pertinente.\n- Mantén coherencia entre el nombre de la UAC, el campo de formación y el semestre.\n\n## Evaluación\n\n- Define criterios observables y pertinentes al carácter optativo u obligatorio de la UAC.\n- Exige al menos una evidencia de producto y una de desempeño.\n- Prohíbe criterios genéricos que puedan aplicarse a cualquier asignatura.",
  },
  fundamental: {
    id: "planeacion/fundamental",
    tipo: "fundamental",
    version: "v1",
    descripcion: "Secuencia didáctica para el Currículum Fundamental (1.º a 4.º semestre) basada en Propósitos Formativos y Contenidos Temáticos oficiales.",
    contenido: "# Reglas específicas — Planeación del Currículum Fundamental\n\n## Estructura obligatoria\n\n1. Organiza la secuencia por **Propósitos Formativos** y **Contenidos Temáticos** oficiales del programa; no inventes ejes ni renombres los existentes.\n2. Cada corte debe declarar: propósito formativo, contenido temático, actividad de apertura, desarrollo y cierre, y evidencia de aprendizaje.\n3. El desarrollo debe explicitar el **contenidoFormativo oficial exacto** que se trabaja en la secuencia.\n4. El cierre debe recuperar el propósito formativo y valorar su logro con un instrumento explícito.\n\n## Alineación curricular\n\n- Respeta las progresiones de aprendizaje cuando el semestre sea de transición (5.º y 6.º).\n- Vincula la secuencia con el campo de formación y con la UAC; evita contenidos de otras asignaturas.\n- Usa el contexto comunitario y el proyecto PAEC solo cuando aporten al propósito, no como relleno.\n\n## Evaluación\n\n- Define criterios observables ligados al propósito formativo.\n- Distingue evidencia de proceso y evidencia de producto.\n- Prohíbe rúbricas con criterios ambiguos o no verificables.",
  },
  laboral: {
    id: "planeacion/laboral",
    tipo: "laboral",
    version: "v1",
    descripcion: "Secuencia didáctica para Formación Laboral BGE (3 Actividades Clave de 18 h) y Carrera Técnica por Módulos/Submódulos.",
    contenido: "# Reglas específicas — Planeación de Formación Laboral\n\n## Estructura obligatoria\n\n1. Divide el bloque en **exactamente 3 Actividades Clave**, una por corte, de **18 horas cada una** (54 h totales). En Carrera Técnica respeta los módulos y submódulos del programa oficial y su base de 16 semanas.\n2. Cada corte debe declarar: Actividad Clave oficial, contenido formativo, horas, evidencia de producto y criterio de evaluación.\n3. El Desarrollo debe alcanzar **Nivel 2 de complejidad técnica** (aplicación autónoma con supervisión mínima).\n4. El Cierre debe ser una **simulación práctica evaluable** con lista de cotejo o rúbrica, no una exposición teórica.\n\n## Alineación con el programa oficial\n\n- Usa literalmente los nombres de las Actividades Clave del programa; no los parafrasees ni los renombres.\n- Vincula cada actividad con el perfil de egreso y con el campo de formación laboral correspondiente.\n- Declara el escenario real de desempeño (taller, laboratorio, empresa o comunidad) y los instrumentos requeridos.\n\n## Evaluación\n\n- Cada corte requiere al menos una evidencia de desempeño y una de producto.\n- La rúbrica debe describir niveles de dominio técnico observables, no adjetivos genéricos.\n- Prohíbe criterios que no puedan verificarse con la evidencia entregada.",
  },
};
