/**
 * src/__tests__/universal-assistant.test.ts
 * Tests unitarios para el Sistema de Asistente Pedagógico Contextual Universal (SAPCU).
 * SACRINT Systems IA · Fase 4
 */

import { describe, it, expect } from "vitest";
import {
  stripLocaleFromPath,
  resolveProgramFromPath,
  extractContextFromPath,
  buildProgramLabel,
  buildLevelLabel,
  formatContextBadge,
} from "@/lib/assistant/context-extractor";
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
import type { ContextoAsistente } from "@/types/assistant";

describe("SAPCU — Extractor de Contexto No Invasivo", () => {
  it("normaliza rutas removiendo el prefijo de idioma i18n", () => {
    expect(stripLocaleFromPath("/es/planeacion/plan-123")).toBe("/planeacion/plan-123");
    expect(stripLocaleFromPath("/en/paec/nuevo")).toBe("/paec/nuevo");
    expect(stripLocaleFromPath("/horarios")).toBe("/horarios");
    expect(stripLocaleFromPath("")).toBe("/");
  });

  it("resuelve el programa y pantalla activa para Planeaciones Didácticas", () => {
    const resDetalle = resolveProgramFromPath("/es/planeacion/plan-uuid-001");
    expect(resDetalle.programa).toBe("planeaciones");
    expect(resDetalle.pantallaActiva).toBe("detalle");
    expect(resDetalle.documentoId).toBe("plan-uuid-001");

    const resNuevo = resolveProgramFromPath("/nueva-planeacion");
    expect(resNuevo.programa).toBe("planeaciones");
    expect(resNuevo.pantallaActiva).toBe("nuevo");
  });

  it("resuelve programas institucionales: PAEC, PMC, Horarios y Cartografía", () => {
    const resPaec = resolveProgramFromPath("/es/paec/paec-99");
    expect(resPaec.programa).toBe("paec");
    expect(resPaec.documentoId).toBe("paec-99");

    const resPmc = resolveProgramFromPath("/pmc/nuevo");
    expect(resPmc.programa).toBe("pmc");
    expect(resPmc.pantallaActiva).toBe("nuevo");

    const resHorarios = resolveProgramFromPath("/horarios/escuela-1");
    expect(resHorarios.programa).toBe("horarios");

    const resCartografia = resolveProgramFromPath("/pips/123/cartografia");
    expect(resCartografia.programa).toBe("cartografia");
  });

  it("ensambla el contexto completo y genera badges informativos", () => {
    const ctx = extractContextFromPath("/es/planeacion/plan-abc", {
      seccionActiva: "Secuencia Didáctica",
      campoEnFoco: "retoSituado",
    });

    expect(ctx.nivel).toBe("media_superior");
    expect(ctx.programa).toBe("planeaciones");
    expect(ctx.seccionActiva).toBe("Secuencia Didáctica");
    expect(ctx.campoEnFoco).toBe("retoSituado");

    const badge = formatContextBadge(ctx);
    expect(badge).toContain("Media Superior");
    expect(badge).toContain("Planeación Didáctica");
    expect(badge).toContain("Secuencia Didáctica");

    expect(buildProgramLabel("planeaciones")).toBe("Planeación Didáctica");
    expect(buildLevelLabel("media_superior")).toContain("Media Superior");
  });
});

describe("SAPCU — Motor de Reglas Pedagógicas DBEPA Puebla 2026-2027", () => {
  it("valida un Reto Situado 4/4 completo satisfactoriamente", () => {
    const textoReto =
      "En la comunidad de San Pedro Cholula, Puebla, ante la escasez crítica de agua potable, los estudiantes diseñarán una propuesta integral comunitaria y un prototipo de captación pluvial.";

    const resultado = validarRetoSituadoMediaSuperior(textoReto);
    expect(resultado.valido).toBe(true);
    expect(resultado.puntaje).toBe(100);
    expect(resultado.observaciones.length).toBe(4);
    expect(resultado.sugerenciasMejora.length).toBe(0);
  });

  it("detecta componentes faltantes en un Reto Situado deficiente", () => {
    const textoDeficiente = "Aprender sobre el agua en clase.";
    const resultado = validarRetoSituadoMediaSuperior(textoDeficiente);
    expect(resultado.valido).toBe(false);
    expect(resultado.puntaje).toBeLessThanOrEqual(50);
    expect(resultado.sugerenciasMejora.length).toBeGreaterThanOrEqual(2);
  });

  it("valida la estructuración completa de los Tres Saberes", () => {
    const saberesValidos = {
      conceptual: "Leyes de la termodinámica, calor, temperatura y equilibrio térmico.",
      procedimental: "Cálculo de eficiencia energética y calibración de termómetros analógicos.",
      actitudinal: "Responsabilidad comunitaria en el consumo consciente de energía eléctrica.",
    };

    const resultado = validarTresSaberesMediaSuperior(saberesValidos);
    expect(resultado.valido).toBe(true);
    expect(resultado.puntaje).toBe(100);
  });

  it("evalúa el contexto global con soporte multi-nivel extensible", () => {
    const ctxMediaSuperior: ContextoAsistente = {
      nivel: "media_superior",
      programa: "planeaciones",
      detallesMediaSuperior: {
        tresSaberes: {
          conceptual: "Ecuaciones lineales de primer grado.",
          procedimental: "Resolución de problemas algebraicos mediante el método de sustitución.",
          actitudinal: "Perseverancia, trabajo colaborativo y pensamiento crítico en equipo.",
        },
      },
    };

    const evalMs = evaluarContextoPedagogico(ctxMediaSuperior);
    expect(evalMs.esApto).toBe(true);
    expect(evalMs.puntajeGlobal).toBeGreaterThanOrEqual(75);

    const ctxPrimaria: ContextoAsistente = {
      nivel: "primaria",
      programa: "general",
    };
    const evalPrimaria = evaluarContextoPedagogico(ctxPrimaria);
    expect(evalPrimaria.esApto).toBe(true);
    expect(evalPrimaria.reglas[0].criterio).toContain("primaria");
  });
});

describe("SAPCU — Constructor de Prompts y Acciones Rápidas", () => {
  it("genera acciones rápidas contextuales específicas por programa", () => {
    const ctxPlaneacion: ContextoAsistente = {
      nivel: "media_superior",
      programa: "planeaciones",
    };
    const accionesPlan = generateQuickActions(ctxPlaneacion);
    expect(accionesPlan.some((a) => a.id === "plan-reto-situado")).toBe(true);
    expect(accionesPlan.some((a) => a.id === "plan-tres-saberes")).toBe(true);

    const ctxPaec: ContextoAsistente = {
      nivel: "media_superior",
      programa: "paec",
    };
    const accionesPaec = generateQuickActions(ctxPaec);
    expect(accionesPaec.some((a) => a.id === "paec-nem-principios")).toBe(true);
  });

  it("construye un System Prompt institucional enriquecido con datos del plantel y UAC", () => {
    const contexto: ContextoAsistente = {
      nivel: "media_superior",
      programa: "planeaciones",
      pantallaActiva: "detalle",
      seccionActiva: "Secuencia Didáctica",
      plantel: {
        nombre: "Bachillerato General Lic. Benito Juárez",
        cct: "21EBH0012A",
      },
      detallesMediaSuperior: {
        uac: "Pensamiento Matemático II",
        semestre: 2,
        subsistema: "bge",
        metodologiaActiva: "ABProblemas",
        paecNombre: "Huerto Escolar Sustentable",
      },
    };

    const prompt = buildSystemPrompt(contexto);
    expect(prompt).toContain("SACRINT");
    expect(prompt).toContain("SAPCU");
    expect(prompt).toContain("Reto Situado 4/4");
    expect(prompt).toContain("Pensamiento Matemático II");
    expect(prompt).toContain("Huerto Escolar Sustentable");
    expect(prompt).toContain("Bachillerato General Lic. Benito Juárez");
  });

  it("construye el user prompt incorporando el campo en foco si existe", () => {
    const ctx: ContextoAsistente = {
      nivel: "media_superior",
      programa: "planeaciones",
      campoEnFoco: "tresSaberes",
    };

    const userPrompt = buildUserPromptWithContext("Sugiéreme la redacción adecuada", ctx);
    expect(userPrompt).toContain("[Campo en foco: tresSaberes]");
    expect(userPrompt).toContain("Sugiéreme la redacción adecuada");
  });
});
