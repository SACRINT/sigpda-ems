/**
 * src/lib/assistant/pedagogical-rules-engine.ts
 * SACRINT Systems IA · SAPCU
 * Motor de reglas pedagógicas y validación curricular por nivel educativo.
 */

import type {
  ContextoAsistente,
  NivelEducativo,
} from "@/types/assistant";

export interface ResultadoValidacionRegla {
  criterio: string;
  valido: boolean;
  puntaje: number; // 0 a 100
  observaciones: string[];
  sugerenciasMejora: string[];
}

export interface EvaluacionPedagogicaCompleta {
  nivel: NivelEducativo;
  esApto: boolean;
  puntajeGlobal: number; // 0 a 100
  reglas: ResultadoValidacionRegla[];
}

// Verbos de acción cognitiva de orden superior (Bloom / Marzano)
const VERBOS_ACCION_COGNITIVA = [
  "analizar", "diseñar", "elaborar", "construir", "proponer", "desarrollar",
  "investigar", "evaluar", "argumentar", "resolver", "implementar", "modelar",
  "identificar", "examinar", "demostrar", "crear", "estructurar", "planificar"
];

// Indicadores de evidencia o producto tangible
const PALABRAS_PRODUCTO = [
  "campaña", "prototipo", "reporte", "informe", "cartel", "tríptico", "infografía",
  "manual", "ensayo", "video", "podcast", "maqueta", "plan", "propuesta",
  "diagnóstico", "bitácora", "rúbrica", "guía", "exposición", "proyecto", "estrategia"
];

/**
 * Valida el Reto Situado bajo el estándar 4/4 DBEPA Puebla 2026-2027.
 */
export function validarRetoSituadoMediaSuperior(
  texto: string,
  contextoPlantel?: string
): ResultadoValidacionRegla {
  const t = (texto || "").toLowerCase();
  const observaciones: string[] = [];
  const sugerenciasMejora: string[] = [];
  let componentesCumplidos = 0;

  // 1. Contexto Real / Territorial
  const tieneContexto =
    t.includes("comunidad") ||
    t.includes("localidad") ||
    t.includes("municipio") ||
    t.includes("escuela") ||
    t.includes("entorno") ||
    t.includes("puebla") ||
    (contextoPlantel && t.includes(contextoPlantel.toLowerCase()));

  if (tieneContexto) {
    componentesCumplidos++;
    observaciones.push("Contexto territorial identificado.");
  } else {
    sugerenciasMejora.push("Especifica el entorno o comunidad real donde se ubica el problema.");
  }

  // 2. Problemática Auténtica
  const tieneProblema =
    t.includes("problem") ||
    t.includes("necesidad") ||
    t.includes("desafío") ||
    t.includes("afect") ||
    t.includes("impacto") ||
    t.includes("falta de") ||
    t.includes("deterioro") ||
    t.includes("riesgo") ||
    t.includes("contaminaci") ||
    t.includes("escasez");

  if (tieneProblema) {
    componentesCumplidos++;
    observaciones.push("Problemática o necesidad auténtica descrita.");
  } else {
    sugerenciasMejora.push("Define con mayor claridad la necesidad o conflicto comunitario a resolver.");
  }

  // 3. Acción Cognitiva Operativa
  const tieneAccion = VERBOS_ACCION_COGNITIVA.some((v) => t.includes(v));
  if (tieneAccion) {
    componentesCumplidos++;
    observaciones.push("Acción cognitiva de orden superior identificada.");
  } else {
    sugerenciasMejora.push("Incorpora un verbo de acción operativa (ej. diseñar, proponer, modelar, analizar).");
  }

  // 4. Producto / Evidencia Tangible
  const tieneProducto = PALABRAS_PRODUCTO.some((p) => t.includes(p));
  if (tieneProducto) {
    componentesCumplidos++;
    observaciones.push("Producto o evidencia tangible explícita.");
  } else {
    sugerenciasMejora.push("Señala el producto o entregable final que evidenciará el aprendizaje.");
  }

  const puntaje = Math.round((componentesCumplidos / 4) * 100);

  return {
    criterio: "Reto Situado (4/4 DBEPA)",
    valido: componentesCumplidos === 4,
    puntaje,
    observaciones,
    sugerenciasMejora,
  };
}

/**
 * Valida la estructuración de los Tres Saberes (Conceptual, Procedimental, Actitudinal).
 */
export function validarTresSaberesMediaSuperior(saberes: {
  conceptual?: string;
  procedimental?: string;
  actitudinal?: string;
}): ResultadoValidacionRegla {
  const observaciones: string[] = [];
  const sugerenciasMejora: string[] = [];
  let aciertos = 0;

  if (saberes.conceptual && saberes.conceptual.trim().length >= 10) {
    aciertos++;
    observaciones.push("Saber Conceptual (conocimientos fundamentales) delimitado.");
  } else {
    sugerenciasMejora.push("Detalla los conceptos, teorías o hechos del Saber Conceptual.");
  }

  if (saberes.procedimental && saberes.procedimental.trim().length >= 10) {
    aciertos++;
    observaciones.push("Saber Procedimental (habilidades y métodos) definido.");
  } else {
    sugerenciasMejora.push("Especifica las habilidades técnicas o procedimientos del Saber Procedimental.");
  }

  if (saberes.actitudinal && saberes.actitudinal.trim().length >= 10) {
    aciertos++;
    observaciones.push("Saber Actitudinal (valores y convivencia) formalizado.");
  } else {
    sugerenciasMejora.push("Incluye las actitudes, valores o compromisos éticos del Saber Actitudinal.");
  }

  const puntaje = Math.round((aciertos / 3) * 100);

  return {
    criterio: "Estructura de Tres Saberes",
    valido: aciertos === 3,
    puntaje,
    observaciones,
    sugerenciasMejora,
  };
}

/**
 * Evalúa integralmente el contexto pedagógico en base al nivel educativo activo.
 */
export function evaluarContextoPedagogico(
  contexto: ContextoAsistente,
  textoAnalizado?: string
): EvaluacionPedagogicaCompleta {
  const reglas: ResultadoValidacionRegla[] = [];

  if (contexto.nivel === "media_superior") {
    const reto = textoAnalizado || contexto.detallesMediaSuperior?.retoSituado?.problemaComunidad || "";
    if (reto) {
      reglas.push(validarRetoSituadoMediaSuperior(reto, contexto.plantel?.nombre));
    }

    if (contexto.detallesMediaSuperior?.tresSaberes) {
      reglas.push(validarTresSaberesMediaSuperior(contexto.detallesMediaSuperior.tresSaberes));
    }
  } else {
    // Stubs extensibles para otros niveles
    reglas.push({
      criterio: `Taxonomía ${contexto.nivel}`,
      valido: true,
      puntaje: 100,
      observaciones: [`Modelo normativo adaptado a ${contexto.nivel}.`],
      sugerenciasMejora: [],
    });
  }

  const puntajeGlobal =
    reglas.length > 0
      ? Math.round(reglas.reduce((acc, r) => acc + r.puntaje, 0) / reglas.length)
      : 100;

  return {
    nivel: contexto.nivel,
    esApto: puntajeGlobal >= 75,
    puntajeGlobal,
    reglas,
  };
}
