/**
 * src/lib/assistant/pedagogical-rules-engine.ts
 * SACRINT Systems IA · SAPCU
 * Motor determinista de validación pedagógica contextual por nivel educativo.
 */

import type { ContextoAsistente, NivelEducativo } from "@/types/assistant";

export interface ResultadoValidacionRegla {
  criterio: string;
  valido: boolean;
  puntaje: number; // 0 - 100
  observaciones: string[];
  sugerenciasMejora: string[];
}

export interface ResultadoValidacionRetoSituado extends ResultadoValidacionRegla {
  completitud: string;
  estado: "optimo" | "completo" | "parcial" | "incompleto";
  alertas: string[];
  sugerencias: string[];
}

export interface ResultadoValidacionSaberes extends ResultadoValidacionRegla {
  saberesFaltantes: string[];
}

export interface EvaluacionPedagogicaCompleta {
  nivel: NivelEducativo;
  esApto: boolean;
  puntajeGlobal: number;
  reglas: ResultadoValidacionRegla[];
  evaluaciones: ResultadoValidacionRegla[];
}

// Verbos de acción cognitiva de orden superior (Taxonomía Bloom / Marzano)
const VERBOS_ACCION_COGNITIVA = [
  "analizar", "diseñar", "proponer", "construir", "evaluar", "sintetizar",
  "investigar", "evaluar", "argumentar", "resolver", "implementar", "modelar",
  "identificar", "examinar", "demostrar", "crear", "estructurar", "planificar"
];

// Indicadores de evidencia o producto tangible
const PALABRAS_PRODUCTO = [
  "campaña", "prototipo", "reporte", "informe", "cartel", "tríptico", "infografía",
  "manual", "ensayo", "video", "podcast", "maqueta", "plan", "propuesta",
  "diagnóstico", "bitácora", "rúbrica", "guía", "exposición", "proyecto", "estrategia"
];

export type RetoSituadoInput =
  | string
  | {
      contextoReal?: string;
      contextoLocal?: string;
      problemaComunidad?: string;
      problematicaReal?: string;
      accionCognitiva?: string;
      verboInfinitivo?: string;
      productoEvidencia?: string;
      retoCompleto?: string;
    };

/**
 * Valida el Reto Situado bajo el estándar 4/4 MCCEMS Puebla 2026-2027.
 * Soporta cadena de texto concatenada o estructura desglosada en objeto.
 */
export function validarRetoSituadoMediaSuperior(
  input: RetoSituadoInput,
  contextoPlantel?: string
): ResultadoValidacionRetoSituado {
  const observaciones: string[] = [];
  const sugerenciasMejora: string[] = [];
  const alertas: string[] = [];
  let componentesCumplidos = 0;

  if (typeof input === "object" && input !== null) {
    const ctx = (input.contextoReal || input.contextoLocal || "").trim();
    const prob = (input.problemaComunidad || input.problematicaReal || "").trim();
    const acc = (input.accionCognitiva || input.verboInfinitivo || "").trim();
    const prod = (input.productoEvidencia || input.retoCompleto || "").trim();

    if (ctx.length >= 4) {
      componentesCumplidos++;
      observaciones.push("Contexto territorial identificado.");
    } else {
      alertas.push("Falta especificar el contexto territorial real.");
      sugerenciasMejora.push("Especifica el entorno o comunidad real donde se ubica el problema.");
    }

    if (prob.length >= 4) {
      componentesCumplidos++;
      observaciones.push("Problemática o necesidad auténtica descrita.");
    } else {
      alertas.push("Falta delimitar la problemática comunitaria auténtica.");
      sugerenciasMejora.push("Define con mayor claridad la necesidad o conflicto comunitario a resolver.");
    }

    if (acc.length >= 3) {
      componentesCumplidos++;
      observaciones.push("Acción cognitiva de orden superior identificada.");
    } else {
      alertas.push("Falta acción cognitiva operativa.");
      sugerenciasMejora.push("Incorpora un verbo de acción operativa (ej. diseñar, proponer, modelar, analizar).");
    }

    if (prod.length >= 4) {
      componentesCumplidos++;
      observaciones.push("Producto o evidencia tangible explícita.");
    } else {
      alertas.push("Falta producto o evidencia tangible.");
      sugerenciasMejora.push("Señala el producto o entregable final que evidenciará el aprendizaje.");
    }
  } else {
    const t = (input || "").toLowerCase();

    // 1. Contexto Real / Territorial
    const tieneContexto =
      t.includes("comunidad") ||
      t.includes("localidad") ||
      t.includes("municipio") ||
      t.includes("escuela") ||
      t.includes("entorno") ||
      t.includes("puebla") ||
      (contextoPlantel ? t.includes(contextoPlantel.toLowerCase()) : false);

    if (tieneContexto) {
      componentesCumplidos++;
      observaciones.push("Contexto territorial identificado.");
    } else {
      alertas.push("Falta contexto territorial.");
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
      alertas.push("Falta problemática auténtica.");
      sugerenciasMejora.push("Define con mayor claridad la necesidad o conflicto comunitario a resolver.");
    }

    // 3. Acción Cognitiva Operativa
    const tieneAccion = VERBOS_ACCION_COGNITIVA.some((v) => t.includes(v));
    if (tieneAccion) {
      componentesCumplidos++;
      observaciones.push("Acción cognitiva de orden superior identificada.");
    } else {
      alertas.push("Falta acción cognitiva operativa.");
      sugerenciasMejora.push("Incorpora un verbo de acción operativa (ej. diseñar, proponer, modelar, analizar).");
    }

    // 4. Producto / Evidencia Tangible
    const tieneProducto = PALABRAS_PRODUCTO.some((p) => t.includes(p));
    if (tieneProducto) {
      componentesCumplidos++;
      observaciones.push("Producto o evidencia tangible explícita.");
    } else {
      alertas.push("Falta evidencia tangible.");
      sugerenciasMejora.push("Señala el producto o entregable final que evidenciará el aprendizaje.");
    }
  }

  const puntaje = Math.round((componentesCumplidos / 4) * 100);
  const estado: "optimo" | "completo" | "parcial" | "incompleto" =
    componentesCumplidos === 4
      ? "optimo"
      : componentesCumplidos === 3
      ? "parcial"
      : "incompleto";

  return {
    criterio: "Reto Situado (4/4 MCCEMS)",
    valido: componentesCumplidos === 4,
    completitud: `${componentesCumplidos}/4`,
    estado,
    puntaje,
    alertas,
    observaciones,
    sugerenciasMejora,
    sugerencias: sugerenciasMejora,
  };
}

export interface TresSaberesInput {
  conceptual?: string;
  saber?: string;
  procedimental?: string;
  saberHacer?: string;
  actitudinal?: string;
  saberSer?: string;
  saberSerYConvivir?: string;
}

/**
 * Valida la estructuración de los Tres Saberes (Conceptual, Procedimental, Actitudinal).
 */
export function validarTresSaberesMediaSuperior(
  saberes: TresSaberesInput
): ResultadoValidacionSaberes {
  const observaciones: string[] = [];
  const sugerenciasMejora: string[] = [];
  const saberesFaltantes: string[] = [];
  let aciertos = 0;

  const conceptual = (saberes.conceptual || saberes.saber || "").trim();
  const procedimental = (saberes.procedimental || saberes.saberHacer || "").trim();
  const actitudinal = (saberes.actitudinal || saberes.saberSer || saberes.saberSerYConvivir || "").trim();

  if (conceptual.length >= 10) {
    aciertos++;
    observaciones.push("Saber Conceptual (conocimientos fundamentales) delimitado.");
  } else {
    saberesFaltantes.push("conceptual");
    sugerenciasMejora.push("Detalla los conceptos, teorías o hechos del Saber Conceptual.");
  }

  if (procedimental.length >= 10) {
    aciertos++;
    observaciones.push("Saber Procedimental (habilidades y métodos) definido.");
  } else {
    saberesFaltantes.push("procedimental");
    sugerenciasMejora.push("Especifica las habilidades técnicas o procedimientos del Saber Procedimental.");
  }

  if (actitudinal.length >= 10) {
    aciertos++;
    observaciones.push("Saber Actitudinal (valores y convivencia) formalizado.");
  } else {
    saberesFaltantes.push("actitudinal");
    sugerenciasMejora.push("Incluye las actitudes, valores o compromisos éticos del Saber Actitudinal.");
  }

  const puntaje = Math.round((aciertos / 3) * 100);

  return {
    criterio: "Estructura de Tres Saberes",
    valido: aciertos === 3,
    puntaje,
    saberesFaltantes,
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
    const retoStr = textoAnalizado || "";
    const retoObj = contexto.detallesMediaSuperior?.retoSituado;

    if (retoStr) {
      reglas.push(validarRetoSituadoMediaSuperior(retoStr, contexto.plantel?.nombre));
    } else if (retoObj) {
      reglas.push(validarRetoSituadoMediaSuperior(retoObj, contexto.plantel?.nombre));
    }

    if (contexto.detallesMediaSuperior?.tresSaberes) {
      reglas.push(validarTresSaberesMediaSuperior(contexto.detallesMediaSuperior.tresSaberes));
    }
  } else {
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
    evaluaciones: reglas,
  };
}

export const EVALUADORES_PEDAGOGICOS = {
  retoSituado: validarRetoSituadoMediaSuperior,
  tresSaberes: validarTresSaberesMediaSuperior,
  contextoGlobal: evaluarContextoPedagogico,
};
