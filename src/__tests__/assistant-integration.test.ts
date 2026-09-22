/**
 * src/__tests__/assistant-integration.test.ts
 * Tests de integración para el Sistema de Asistente Pedagógico Contextual Universal (SAPCU).
 * Cubre:
 *  - Extractor de contexto de navegación y documento (extractContextFromRoute, extractDocumentContext)
 *  - Registro y puente transversal de los 5 programas (PROGRAM_SYSTEM_REGISTRY, cross-program bridge)
 *  - Motor de reglas pedagógicas (Reto Situado 4/4, Tres Saberes, Coherencia, Horas)
 *  - Generación de sugerencias y Quick Actions por programa
 *  - Compatibilidad de contratos y esquemas OpenAPI/TypeScript
 */

import { describe, it, expect } from "vitest";
import {
  extractContextFromRoute,
  extractDocumentContext,
  resolveProgramFromPath,
  stripLocaleFromPath,
} from "@/lib/assistant/context-extractor";
import {
  PROGRAM_SYSTEM_REGISTRY,
  buildCrossProgramContext,
  getProgramBridgeSummary,
} from "@/lib/assistant/cross-program-context";
import {
  validarRetoSituadoMediaSuperior,
  validarTresSaberesMediaSuperior,
  evaluarContextoPedagogico,
} from "@/lib/assistant/pedagogical-rules-engine";
import {
  generateQuickActions,
  buildSystemPrompt,
  buildUserPromptWithContext,
} from "@/lib/assistant/prompt-builder";
import type {
  ContextoAsistente,
  ProgramaPlataforma,
} from "@/types/assistant";

describe("SAPCU Integration Suite — Context Extractor & Route Awareness", () => {
  it("Test 1: extrae contexto canónico desde rutas para los 5 programas oficiales", () => {
    const rutas = [
      { path: "/es/planeacion/plan-123", expected: "planeaciones" },
      { path: "/paec/nuevo", expected: "paec" },
      { path: "/es/pmc/nuevo", expected: "pmc" },
      { path: "/pips/zona-01/cartografia", expected: "cartografia" },
      { path: "/horarios/escuela-xyz", expected: "horarios" },
    ];

    for (const item of rutas) {
      const ctx = extractContextFromRoute(item.path);
      expect(ctx.programId).toBe(item.expected);
      expect(ctx.route).toBe(stripLocaleFromPath(item.path));
      expect(ctx.educationLevel).toBe("media_superior");
    }
  });

  it("Test 2: resuelve correctamente el ID del documento y la pantalla activa", () => {
    const resPlan = resolveProgramFromPath("/es/planeacion/plan-d784a");
    expect(resPlan.programa).toBe("planeaciones");
    expect(resPlan.documentoId).toBe("plan-d784a");
    expect(resPlan.pantallaActiva).toBe("detalle");

    const resNuevoPaec = resolveProgramFromPath("/es/paec/nuevo");
    expect(resNuevoPaec.programa).toBe("paec");
    expect(resNuevoPaec.pantallaActiva).toBe("nuevo");
    expect(resNuevoPaec.documentoId).toBeUndefined();
  });

  it("Test 3: extractDocumentContext extrae metadatos pedagógicos de una planeación real", () => {
    const docPlaneacion = {
      id: "plan-mat-01",
      uacName: "Pensamiento Matemático III",
      semester: 3,
      metodologiaActiva: "abproblemas",
      content: {
        sectionI: { subsystem: "bge" },
        sectionII: {
          paecConnection: "Agua y Sustentabilidad",
          retoSituado: {
            contextoLocal: "Comunidad de Coronel Tito Hernández",
            problematicaReal: "Escasez de agua en temporada de estiaje",
            verboInfinitivo: "Calcular",
            retoCompleto: "Diseño de un modelo de captación de agua pluvial",
          },
        },
      },
    };

    const extracted = extractDocumentContext(docPlaneacion, "planeaciones");
    expect(extracted.programa).toBe("planeaciones");
    expect(extracted.documentoId).toBe("plan-mat-01");
    expect(extracted.detallesMediaSuperior?.uac).toBe("Pensamiento Matemático III");
    expect(extracted.detallesMediaSuperior?.semestre).toBe(3);
    expect(extracted.detallesMediaSuperior?.metodologiaActiva).toBe("abproblemas");
    expect(extracted.detallesMediaSuperior?.retoSituado?.contextoReal).toBe(
      "Comunidad de Coronel Tito Hernández"
    );
  });

  it("Test 4: extractDocumentContext maneja objetos vacíos o nulos sin lanzar excepción", () => {
    const extractedNull = extractDocumentContext(null);
    expect(extractedNull.programa).toBe("general");

    const extractedEmpty = extractDocumentContext({}, "paec");
    expect(extractedEmpty.programa).toBe("paec");
    expect(extractedEmpty.documentoId).toBeUndefined();
  });
});

describe("SAPCU Integration Suite — Cross-Program Registry & Awareness Bridge", () => {
  it("Test 5: PROGRAM_SYSTEM_REGISTRY contiene los 5 programas con definiciones completas", () => {
    const programas: ProgramaPlataforma[] = [
      "planeaciones",
      "paec",
      "pmc",
      "cartografia",
      "horarios",
    ];

    for (const prog of programas) {
      const def = PROGRAM_SYSTEM_REGISTRY[prog];
      expect(def).toBeDefined();
      expect(def.id).toBe(prog);
      expect(def.name).toBeTruthy();
      expect(def.routePrefix).toBeTruthy();
      expect(Array.isArray(def.supportedRoles)).toBe(true);
      expect(def.supportedRoles?.length).toBeGreaterThan(0);
    }
  });

  it("Test 6: buildCrossProgramContext enlaza contexto entre Planeación y PAEC", () => {
    const ctxPlaneacion: ContextoAsistente = {
      programa: "planeaciones",
      nivel: "media_superior",
      ruta: "/planeacion/plan-1",
      detallesMediaSuperior: {
        uac: "Pensamiento Matemático III",
        paecNombre: "Proyecto Hidrocomunitario",
      },
    };

    const cross = buildCrossProgramContext(ctxPlaneacion);
    expect(cross.activeProgram.id).toBe("planeaciones");
    expect(cross.primaryEntityName).toBe("Pensamiento Matemático III");
    expect(cross.relatedProgramIds).toContain("paec");
    expect(cross.integrationNotes.some((n) => n.includes("PAEC"))).toBe(true);
  });

  it("Test 7: buildCrossProgramContext enlaza Horarios con Cartografía", () => {
    const ctxHorarios: ContextoAsistente = {
      programa: "horarios",
      nivel: "media_superior",
      ruta: "/horarios/escuela-01",
      seccionActiva: "Paso 1: Grupos",
    };

    const cross = buildCrossProgramContext(ctxHorarios);
    expect(cross.activeProgram.id).toBe("horarios");
    expect(cross.relatedProgramIds).toContain("cartografia");
    expect(cross.integrationNotes.some((n) => n.includes("Cartografía"))).toBe(true);
  });

  it("Test 8: getProgramBridgeSummary retorna resumen institucional para cualquier programa", () => {
    const summary = getProgramBridgeSummary("pmc");
    expect(summary).toContain("PMC CREAA");
    expect(summary).toContain("Ruta:");
  });
});

describe("SAPCU Integration Suite — Pedagogical Rules Engine", () => {
  it("Test 9: valida Reto Situado completo (4/4) con estatus optimo", () => {
    const retoCompleto = {
      contextoReal: "Mercado local de Teziutlán",
      problemaComunidad: "Manejo inadecuado de residuos sólidos orgánicos",
      accionCognitiva: "Diseñar un sistema de compostaje comunitario",
      productoEvidencia: "Prototipo de compostera y manual de operación",
    };

    const res = validarRetoSituadoMediaSuperior(retoCompleto);
    expect(res.completitud).toBe("4/4");
    expect(res.estado).toBe("optimo");
    expect(res.alertas.length).toBe(0);
  });

  it("Test 10: detecta Reto Situado incompleto y genera alertas y sugerencias accionables", () => {
    const retoIncompleto = {
      contextoReal: "Escuela",
      problemaComunidad: "",
      accionCognitiva: "Aprender",
      productoEvidencia: "",
    };

    const res = validarRetoSituadoMediaSuperior(retoIncompleto);
    expect(res.estado).toBe("incompleto");
    expect(res.alertas.length).toBeGreaterThanOrEqual(2);
    expect(res.sugerencias.length).toBeGreaterThanOrEqual(2);
  });

  it("Test 11: valida los Tres Saberes (Conceptual, Procedimental, Actitudinal)", () => {
    const saberesCompletos = {
      saber: "Conceptos de funciones lineales y razón de cambio",
      saberHacer: "Graficar y modelar situaciones reales con GeoGebra",
      saberSerYConvivir: "Colaboración solidaria y respeto por la diversidad de opiniones",
    };

    const res = validarTresSaberesMediaSuperior(saberesCompletos);
    expect(res.valido).toBe(true);
    expect(res.saberesFaltantes.length).toBe(0);
  });

  it("Test 12: evalúa contexto pedagógico global de Media Superior", () => {
    const ctx: ContextoAsistente = {
      programa: "planeaciones",
      nivel: "media_superior",
      ruta: "/planeacion/123",
      detallesMediaSuperior: {
        metodologiaActiva: "abproblemas",
        retoSituado: {
          contextoReal: "Comunidad Venustiano Carranza",
          problemaComunidad: "Contaminación de arroyos",
          accionCognitiva: "Investigar y proponer",
          productoEvidencia: "Tríptico informativo y filtro casero",
        },
      },
    };

    const evalResult = evaluarContextoPedagogico(ctx);
    expect(evalResult.nivel).toBe("media_superior");
    expect(evalResult.evaluaciones.length).toBeGreaterThan(0);
  });
});

describe("SAPCU Integration Suite — Prompt Builder & Quick Actions", () => {
  it("Test 13: genera Quick Actions especializadas para cada uno de los 5 programas", () => {
    const progs: Array<ContextoAsistente["programa"]> = [
      "planeaciones",
      "paec",
      "pmc",
      "cartografia",
      "horarios",
      "general",
    ];

    for (const p of progs) {
      const actions = generateQuickActions({
        programa: p,
        nivel: "media_superior",
        ruta: `/${p}`,
      });
      expect(actions.length).toBeGreaterThanOrEqual(3);
      for (const act of actions) {
        expect(act.id).toBeTruthy();
        expect(act.etiqueta).toBeTruthy();
        expect(act.prompt).toBeTruthy();
      }
    }
  });

  it("Test 14: Quick Actions de Planeaciones incluyen validaciones clave DBEPA", () => {
    const actions = generateQuickActions({
      programa: "planeaciones",
      nivel: "media_superior",
      ruta: "/planeacion/abc",
    });

    const ids = actions.map((a) => a.id);
    expect(ids).toContain("generar-reto-situado");
    expect(ids).toContain("validar-tres-saberes");
    expect(ids).toContain("coherencia-metodologica");
  });

  it("Test 15: ensambla System Prompt con directrices institucionales SACRINT", () => {
    const prompt = buildSystemPrompt({
      programa: "planeaciones",
      nivel: "media_superior",
      ruta: "/planeacion/xyz",
    });

    expect(prompt).toContain("SACRINT");
    expect(prompt).toContain("MCCEMS");
    expect(prompt).toContain("DBEPA Puebla");
    expect(prompt).toContain("Reto Situado");
  });

  it("Test 16: construye User Prompt contextual inyectando variables del documento activo", () => {
    const userPrompt = buildUserPromptWithContext("¿Cómo redacto el saber ser?", {
      programa: "planeaciones",
      nivel: "media_superior",
      ruta: "/planeacion/p-1",
      seccionActiva: "Pestaña: planning",
      detallesMediaSuperior: {
        uac: "Cultura Digital I",
        metodologiaActiva: "abproyectos",
      },
    });

    expect(userPrompt).toContain("¿Cómo redacto el saber ser?");
    expect(userPrompt).toContain("Cultura Digital I");
    expect(userPrompt).toContain("abproyectos");
  });
});
