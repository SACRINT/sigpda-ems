/**
 * src/lib/assistant/context-extractor.ts
 * SACRINT Systems IA · SAPCU
 * Extractor no invasivo de contexto pedagógico y de navegación.
 */

import type {
  ContextoAsistente,
  NivelEducativo,
  ProgramaPlataforma,
} from "@/types/assistant";

/**
 * Normaliza la ruta eliminando el prefijo de idioma i18n (ej. /es/...).
 */
export function stripLocaleFromPath(pathname: string): string {
  if (!pathname) return "/";
  const cleaned = pathname.replace(/^\/[a-zA-Z]{2}(?=\/|$)/, "");
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

/**
 * Determina el programa de la plataforma según la ruta activa.
 */
export function resolveProgramFromPath(path: string): {
  programa: ProgramaPlataforma;
  pantallaActiva: string;
  documentoId?: string;
} {
  const cleanPath = stripLocaleFromPath(path);
  const segments = cleanPath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { programa: "general", pantallaActiva: "inicio" };
  }

  const first = segments[0].toLowerCase();
  const second = segments[1]?.toLowerCase();

  // 1. Planeaciones
  if (first === "planeacion" || first === "nueva-planeacion" || (first === "dashboard" && second === "planning")) {
    const id = first === "planeacion" ? segments[1] : first === "dashboard" ? segments[2] : undefined;
    return {
      programa: "planeaciones",
      pantallaActiva: first === "nueva-planeacion" ? "nuevo" : id ? "detalle" : "lista",
      documentoId: id && id !== "nuevo" ? id : undefined,
    };
  }

  // 2. PAEC (Proyecto Escolar Comunitario)
  if (first === "paec") {
    const isNew = second === "nuevo";
    return {
      programa: "paec",
      pantallaActiva: isNew ? "nuevo" : second ? "detalle" : "lista",
      documentoId: !isNew && second ? second : undefined,
    };
  }

  // 3. PMC (Programa de Mejora Continua)
  if (first === "pmc") {
    const isNew = second === "nuevo";
    return {
      programa: "pmc",
      pantallaActiva: isNew ? "nuevo" : second ? "detalle" : "lista",
      documentoId: !isNew && second ? second : undefined,
    };
  }

  // 4. PIPS
  if (first === "pips") {
    const isNew = second === "nuevo";
    const isCartografia = segments.includes("cartografia");
    return {
      programa: isCartografia ? "cartografia" : "pips",
      pantallaActiva: isCartografia ? "cartografia" : isNew ? "nuevo" : second ? "detalle" : "lista",
      documentoId: !isNew && second ? second : undefined,
    };
  }

  // 5. Horarios
  if (first === "horarios") {
    return {
      programa: "horarios",
      pantallaActiva: second ? "configuracion" : "asistente",
      documentoId: second,
    };
  }

  // 6. Cartografía Curricular
  if (first === "cartografia") {
    return {
      programa: "cartografia",
      pantallaActiva: second ? "detalle" : "mapa",
      documentoId: second,
    };
  }

  return {
    programa: "general",
    pantallaActiva: first,
    documentoId: second,
  };
}

/**
 * Resuelve y ensambla el contexto integral del asistente pedagógico.
 */
export function extractContextFromPath(
  pathname: string,
  overrides?: Partial<ContextoAsistente>
): ContextoAsistente {
  const { programa, pantallaActiva, documentoId } = resolveProgramFromPath(pathname);

  const baseContext: ContextoAsistente = {
    nivel: overrides?.nivel || "media_superior",
    programa,
    pantallaActiva: overrides?.pantallaActiva || pantallaActiva,
    documentoId: overrides?.documentoId || documentoId,
    seccionActiva: overrides?.seccionActiva,
    campoEnFoco: overrides?.campoEnFoco,
    plantel: overrides?.plantel,
    usuario: overrides?.usuario,
    detallesMediaSuperior: overrides?.detallesMediaSuperior,
    detallesBasica: overrides?.detallesBasica,
    detallesSuperior: overrides?.detallesSuperior,
  };

  return baseContext;
}

/**
 * Alias canónico para extracción de contexto desde una ruta de navegación.
 */
export const extractContextFromRoute = extractContextFromPath;

/**
 * Extrae contexto didáctico y administrativo a partir de los datos crudos del documento activo.
 */
export function extractDocumentContext(
  docData: Record<string, unknown>,
  programa: ProgramaPlataforma
): Partial<ContextoAsistente> {
  if (!docData) return {};

  switch (programa) {
    case "planeaciones": {
      const secI = (docData.sectionI || {}) as Record<string, unknown>;
      const secII = (docData.sectionII || {}) as Record<string, unknown>;
      const reto = (secII.retoSituado || {}) as Record<string, unknown>;

      return {
        detallesMediaSuperior: {
          uac: (docData.uacName as string) || (secI.uacName as string),
          semestre: (docData.semester as number) || (secI.semester as number),
          subsistema: (docData.subsystem as "bge" | "tecnologico" | "general") || (secI.subsystem as "bge" | "tecnologico" | "general"),
          metodologiaActiva: (docData.metodologiaActiva as string) || (secI.metodologiaActiva as string),
          retoSituado: {
            contextoReal: reto.contextoLocal as string | undefined,
            problemaComunidad: reto.problematicaReal as string | undefined,
            accionCognitiva: reto.verboInfinitivo as string | undefined,
            productoEvidencia: reto.retoCompleto as string | undefined,
          },
          paecNombre: secII.paecProjectName as string | undefined,
          paecProblema: secII.paecProblem as string | undefined,
        },
      };
    }

    case "paec": {
      return {
        detallesMediaSuperior: {
          paecNombre: (docData.projectName as string) || (docData.nombre as string),
          paecProblema: (docData.problem as string) || (docData.problematica as string),
        },
      };
    }

    case "pmc": {
      return {
        seccionActiva: (docData.fase as string) || "diagnostico",
      };
    }

    case "horarios": {
      return {
        plantel: {
          cct: docData.cct as string | undefined,
          nombre: docData.schoolName as string | undefined,
        },
      };
    }

    case "cartografia": {
      return {
        plantel: {
          cct: docData.cct as string | undefined,
        },
      };
    }

    default:
      return {};
  }
}

export function buildProgramLabel(programa: ProgramaPlataforma): string {
  const map: Record<ProgramaPlataforma, string> = {
    planeaciones: "Planeación Didáctica",
    paec: "PAEC / Proyecto Comunitario",
    pmc: "Programa de Mejora Continua (PMC)",
    pips: "PIPS Institucional",
    horarios: "Optimización de Horarios",
    cartografia: "Cartografía Curricular",
    general: "Asistente SACRINT",
  };
  return map[programa] || "SACRINT";
}

export function buildLevelLabel(nivel: NivelEducativo): string {
  const map: Record<NivelEducativo, string> = {
    preescolar: "Educación Preescolar",
    primaria: "Educación Primaria",
    secundaria: "Educación Secundaria",
    media_superior: "Educación Media Superior (MCCEMS DBEPA)",
    superior: "Educación Superior",
  };
  return map[nivel] || "Media Superior";
}

export function formatContextBadge(contexto: ContextoAsistente): string {
  const level = buildLevelLabel(contexto.nivel);
  const prog = buildProgramLabel(contexto.programa);
  const sec = contexto.seccionActiva ? ` · ${contexto.seccionActiva}` : "";
  return `${level} | ${prog}${sec}`;
}
