/**
 * src/app/api/assistant/chat/route.ts
 * SACRINT Systems IA · SAPCU (Sistema de Asistente Pedagógico Contextual Universal)
 * Endpoint de backend seguro para consultas contextuales y copiloto pedagógico.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db/client";
import { generateWithRotation } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";
import type {
  ContextoAsistente,
  PeticionAsistente,
  RespuestaAsistente,
} from "@/types/assistant";
import {
  buildSystemPrompt,
  buildUserPromptWithContext,
  generateQuickActions,
} from "@/lib/assistant/prompt-builder";
import { evaluarContextoPedagogico } from "@/lib/assistant/pedagogical-rules-engine";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "No autorizado. Inicie sesión para interactuar con SAPCU." },
        { status: 401 }
      );
    }

    const body: PeticionAsistente = await req.json();
    const { mensaje, contexto, historial = [], campoObjetivo } = body;

    if (!mensaje || typeof mensaje !== "string" || !mensaje.trim()) {
      return NextResponse.json(
        { error: "Se requiere un mensaje válido para el asistente pedagógico." },
        { status: 400 }
      );
    }

    const safeContext: ContextoAsistente = contexto || {
      nivel: "media_superior",
      programa: "general",
    };

    // Resolver teacherId de la base de datos para rotación de claves si existe
    let teacherId: string | undefined;
    try {
      if (process.env.DATABASE_URL) {
        const db = sql();
        const teachers = await db`SELECT id FROM teachers WHERE email = ${session.user.email} LIMIT 1`;
        if (teachers[0]?.id) {
          teacherId = teachers[0].id as string;
        }
      }
    } catch {
      // Continuar con pool general si la BD no está configurada o no responde
    }

    // 1. Construir Prompts
    const systemPrompt = buildSystemPrompt(safeContext);
    const userPrompt = buildUserPromptWithContext(mensaje, safeContext);

    // 2. Historial de conversación optimizado (máx 8 mensajes)
    const recentHistory = historial.slice(-8);
    const historyText = recentHistory
      .map((h) => `${h.rol === "user" ? "Docente" : "SAPCU"}: ${h.contenido}`)
      .join("\n\n");

    const fullPrompt = historyText
      ? `HISTORIAL DE INTERACCIÓN:\n${historyText}\n\nCONSULTA ACTUAL:\n${userPrompt}`
      : userPrompt;

    // 3. Generación con rotación de claves y fallback a Gemini 2.5 Flash / Groq
    const rawReply = await generateWithRotation(systemPrompt, fullPrompt, teacherId);

    // 4. Evaluación de Calidad Pedagógica
    const evaluacion = evaluarContextoPedagogico(safeContext, rawReply);

    // 5. Acciones sugeridas dinámicas
    const accionesSugeridas = generateQuickActions(safeContext);

    // 6. Detección de texto para inserción directa en el campo objetivo
    let sugerenciaInsercion: { campo: string; texto: string } | undefined;
    if (campoObjetivo || safeContext.campoEnFoco) {
      const target = campoObjetivo || safeContext.campoEnFoco || "";
      sugerenciaInsercion = {
        campo: target,
        texto: rawReply.trim(),
      };
    }

    const responseData: RespuestaAsistente = {
      mensaje: rawReply,
      accionesSugeridas,
      sugerenciaInsercion,
      validacionesPedagogicas: evaluacion.reglas.map((r) => ({
        nivel: r.valido ? "info" : "warning",
        criterio: r.criterio,
        mensaje: r.observaciones.join(" ") || r.sugerenciasMejora.join(" "),
      })),
    };

    return NextResponse.json({
      success: true,
      ...responseData,
    });
  } catch (error: unknown) {
    const errMessage =
      error instanceof Error ? error.message : "Error inesperado en SAPCU";
    logger.error("Error en endpoint /api/assistant/chat:", error);
    return NextResponse.json(
      { error: errMessage, success: false },
      { status: 500 }
    );
  }
}
