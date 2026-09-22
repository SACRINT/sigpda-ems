/**
 * src/lib/assistant/prompt-builder.ts
 * SACRINT Systems IA · SAPCU
 * Constructor de prompts pedagógicos contextuales y generador de acciones rápidas.
 */

import type {
  AccionSugerida,
  ContextoAsistente,
} from "@/types/assistant";
import { buildLevelLabel, buildProgramLabel } from "./context-extractor";

/**
 * Genera acciones sugeridas automáticas de un clic dependiendo de la pantalla y foco actual.
 */
export function generateQuickActions(contexto: ContextoAsistente): AccionSugerida[] {
  const rawActions: AccionSugerida[] = [];

  switch (contexto.programa) {
    case "planeaciones":
      rawActions.push(
        {
          id: "plan-reto-situado",
          titulo: "Formular Reto Situado 4/4",
          prompt: "Ayúdame a formular un Reto Situado con los 4 componentes oficiales de DBEPA: contexto territorial, problema auténtico, acción cognitiva de orden superior y producto tangible.",
          categoria: "redaccion",
          campoObjetivo: "retoSituado",
        },
        {
          id: "generar-reto-situado",
          titulo: "Generar Reto Situado",
          prompt: "Genera una propuesta contextualizada de Reto Situado bajo la normativa DBEPA Puebla.",
          categoria: "redaccion",
          campoObjetivo: "retoSituado",
        },
        {
          id: "plan-tres-saberes",
          titulo: "Estructurar Tres Saberes",
          prompt: "Desglosa los Tres Saberes (Conceptual, Procedimental y Actitudinal) para esta Unidad de Aprendizaje Curricular acorde al nuevo marco curricular.",
          categoria: "estrategia",
          campoObjetivo: "tresSaberes",
        },
        {
          id: "validar-tres-saberes",
          titulo: "Validar Tres Saberes",
          prompt: "Verifica que los Tres Saberes estén balanceados y cumplan con la taxonomía formativa.",
          categoria: "evaluacion",
          campoObjetivo: "tresSaberes",
        },
        {
          id: "coherencia-metodologica",
          titulo: "Coherencia Metodológica",
          prompt: "Verifica que la secuencia didáctica sea coherente con la metodología activa seleccionada y los tiempos DBEPA.",
          categoria: "evaluacion",
        },
        {
          id: "plan-preguntas-detonadoras",
          titulo: "Preguntas Detonadoras (Apertura)",
          prompt: "Sugiere 3 preguntas detonadoras desafiantes para la fase de Apertura de la sesión que despierten el interés de los estudiantes.",
          categoria: "estrategia",
        },
        {
          id: "plan-evaluacion-formativa",
          titulo: "Instrumento de Evaluación",
          prompt: "Recomienda un instrumento de evaluación formativa (lista de cotejo o rúbrica analítica) alineado con la metodología activa elegida.",
          categoria: "evaluacion",
        }
      );
      break;

    case "paec":
      rawActions.push(
        {
          id: "paec-foda",
          titulo: "Diagnóstico Territorial Comunitario",
          prompt: "Oriéntame para redactar la justificación territorial y el diagnóstico colectivo de la Macro-Fase I del PAEC.",
          categoria: "redaccion",
        },
        {
          id: "paec-nem-principios",
          titulo: "Vincular Principios de la NEM",
          prompt: "¿Cómo vinculo este problema comunitario con los 8 principios de la Nueva Escuela Mexicana?",
          categoria: "normativa",
        },
        {
          id: "paec-mifo",
          titulo: "Formular Propósito MIFO",
          prompt: "Ayúdame a redactar el Propósito Integral del Proyecto considerando los criterios de pertinencia territorial MIFO / DBEPA.",
          categoria: "redaccion",
        }
      );
      break;

    case "pmc":
      rawActions.push(
        {
          id: "pmc-metas-smart",
          titulo: "Metas e Indicadores SMART",
          prompt: "Propón metas cuantificables e indicadores de logro con temporalidad y metas claras para el Programa de Mejora Continua.",
          categoria: "estrategia",
        },
        {
          id: "pmc-ambitos",
          titulo: "Articulación por Ámbitos",
          prompt: "¿Cómo articular los objetivos del PMC con los ámbitos de infraestructura y aprovechamiento académico?",
          categoria: "normativa",
        },
        {
          id: "pmc-creaa-fases",
          titulo: "Fases CREAA de Seguimiento",
          prompt: "Oriéntame sobre los entregables y rúbricas de evaluación requeridos en cada fase CREAA.",
          categoria: "normativa",
        }
      );
      break;

    case "horarios":
      rawActions.push(
        {
          id: "horarios-pedagogicos",
          titulo: "Optimización Pedagógica",
          prompt: "¿Cuáles son las mejores prácticas para distribuir las cargas horarias de materias complejas para evitar la fatiga mental de los alumnos?",
          categoria: "estrategia",
        },
        {
          id: "horarios-bloques",
          titulo: "Manejo de Bloques de 2 Horas",
          prompt: "¿Cómo estructurar una sesión de 2 horas consecutivas manteniendo una alta participación activa?",
          categoria: "estrategia",
        },
        {
          id: "horarios-carga-uac",
          titulo: "Validar Carga Horaria",
          prompt: "Verifica que el número de horas asignadas a cada docente y grupo cuadre con el mapa curricular.",
          categoria: "normativa",
        }
      );
      break;

    case "cartografia":
      rawActions.push(
        {
          id: "cartografia-interdisciplinar",
          titulo: "Articulación Interdisciplinar",
          prompt: "Identifica posibles nodos de vinculación entre las UACs de este semestre y el proyecto comunitario PAEC.",
          categoria: "estrategia",
        },
        {
          id: "cartografia-mapa-curricular",
          titulo: "Mapeo Curricular Oficial",
          prompt: "Verifica la distribución de asignaturas del mapa curricular para planteles BGE y Tecnológicos.",
          categoria: "normativa",
        },
        {
          id: "cartografia-zona-diagnostico",
          titulo: "Diagnóstico de Zona Escolar",
          prompt: "Sintetiza las características sociodemográficas y de oferta educativa de la zona escolar.",
          categoria: "normativa",
        }
      );
      break;

    default:
      rawActions.push(
        {
          id: "gen-normativa",
          titulo: "Normativa DBEPA Puebla 2026-2027",
          prompt: "¿Cuáles son las directrices pedagógicas fundamentales del ciclo escolar actual?",
          categoria: "normativa",
        },
        {
          id: "gen-metodologia",
          titulo: "Metodologías Activas Recomendadas",
          prompt: "Explícame la diferencia de aplicación práctica entre Aprendizaje Basado en Proyectos y Aprendizaje Basado en Problemas.",
          categoria: "estrategia",
        },
        {
          id: "gen-evaluacion",
          titulo: "Principios de Evaluación Formativa",
          prompt: "¿Cómo ponderar la heteroevaluación, coevaluación y autoevaluación en la NEM?",
          categoria: "evaluacion",
        }
      );
  }

  return rawActions.map((act) => ({
    ...act,
    etiqueta: act.titulo,
    label: act.titulo,
  }));
}

/**
 * Construye el System Prompt con las directrices institucionales de SACRINT.
 */
export function buildSystemPrompt(contexto: ContextoAsistente): string {
  const nivelDesc = buildLevelLabel(contexto.nivel);
  const progDesc = buildProgramLabel(contexto.programa);

  let detallesEspecificos = "";
  if (contexto.detallesMediaSuperior) {
    const d = contexto.detallesMediaSuperior;
    detallesEspecificos = `
DATOS DE LA UAC / MEDIA SUPERIOR:
- UAC Activa: ${d.uac || "No especificada"}
- Semestre: ${d.semestre || "No especificado"}
- Subsistema: ${d.subsistema?.toUpperCase() || "General / BGE"}
- Metodología Activa: ${d.metodologiaActiva || "No asignada"}
- PAEC Vinculado: ${d.paecNombre || "No vinculado"}
- Horas semanales: ${d.horasSemanales || "Estándar"}
`;
  }

  return `Eres el Asistente Pedagógico Contextual Universal (SAPCU) de SACRINT Systems IA.
Tu misión es asistir a docentes, directores y supervisores educativos con rigor metodológico, empatía y apego estricto a las normas pedagógicas oficiales.
Marco normativo de referencia: MCCEMS y DBEPA Puebla 2026-2027.

CONTEXTO EDUCATIVO ACTUAL:
- Nivel Educativo: ${nivelDesc}
- Módulo / Programa: ${progDesc}
- Pantalla Activa: ${contexto.pantallaActiva || "Vista general"}
- Sección en Edición: ${contexto.seccionActiva || "No especificada"}
- Campo en Foco: ${contexto.campoEnFoco || "General"}
- Plantel: ${contexto.plantel?.nombre || "Plantel Educativo"} (CCT: ${contexto.plantel?.cct || "N/D"})
${detallesEspecificos}

CRITERIOS NORMATIVOS QUE DEBES APLICAR:
1. Reto Situado 4/4 (DBEPA Puebla): Debe integrar 1) Contexto territorial real, 2) Problema auténtico del entorno, 3) Acción cognitiva de orden superior (Bloom/Marzano), y 4) Producto o evidencia verificable.
2. Tres Saberes: Saber Conceptual (hechos, teorías), Saber Procedimental (habilidades, aplicación) y Saber Actitudinal (valores, ética ciudadana).
3. Metodologías Activas: Centradas en el estudiante (ABProyecto, ABProblemas, AServicio, STEM, Indagación).
4. Distribución Temporal recomendada para sesiones: 20% Apertura, 50% Desarrollo, 30% Cierre.
5. Lenguaje: Claro, institucional, constructivo y directamente aplicable al aula.
6. Si propones texto para un campo específico, márcalo claramente para que el usuario pueda insertarlo de inmediato.`;
}

/**
 * Ensambla el prompt del usuario junto con el contexto adicional necesario.
 */
export function buildUserPromptWithContext(
  mensaje: string,
  contexto: ContextoAsistente
): string {
  const parts: string[] = [];

  if (contexto.campoEnFoco) {
    parts.push(`[Campo en foco: ${contexto.campoEnFoco}]`);
  }

  const contextMeta: string[] = [];
  if (contexto.detallesMediaSuperior?.uac) {
    contextMeta.push(`UAC: ${contexto.detallesMediaSuperior.uac}`);
  }
  if (contexto.detallesMediaSuperior?.metodologiaActiva) {
    contextMeta.push(`Metodología: ${contexto.detallesMediaSuperior.metodologiaActiva}`);
  }
  if (contexto.detallesMediaSuperior?.paecNombre) {
    contextMeta.push(`PAEC: ${contexto.detallesMediaSuperior.paecNombre}`);
  }

  if (contextMeta.length > 0) {
    parts.push(`[Contexto: ${contextMeta.join(" | ")}]`);
  }

  parts.push(mensaje);
  return parts.join("\n\n");
}
