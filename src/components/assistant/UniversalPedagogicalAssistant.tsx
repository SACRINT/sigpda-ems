/**
 * src/components/assistant/UniversalPedagogicalAssistant.tsx
 * SACRINT Systems IA · SAPCU
 * Widget flotante universal del copiloto pedagógico.
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  Copy,
  Check,
  CornerDownLeft,
  Trash2,
  Minimize2,
  GraduationCap,
  Compass,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAssistant } from "./AssistantContext";
import { generateQuickActions } from "@/lib/assistant/prompt-builder";
import { buildLevelLabel, buildProgramLabel } from "@/lib/assistant/context-extractor";
import type { AccionSugerida, RespuestaAsistente } from "@/types/assistant";

export default function UniversalPedagogicalAssistant() {
  const {
    isOpen,
    toggleOpen,
    contexto,
    mensajes,
    agregarMensaje,
    limpiarConversacion,
    insertTextIntoField,
  } = useAssistant();

  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const quickActions = generateQuickActions(contexto);

  // Auto-scroll al final de los mensajes
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensajes, isOpen]);

  // Foco en textarea al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleCopiar = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiedId(id);
    toast.success("Texto copiado al portapapeles");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsertar = (campo: string, texto: string) => {
    const exito = insertTextIntoField(campo, texto);
    if (exito) {
      toast.success(`Texto insertado en "${campo}"`);
    } else {
      navigator.clipboard.writeText(texto);
      toast.success("Copiado al portapapeles (campo no detectado en foco)");
    }
  };

  const enviarConsulta = async (texto: string, accion?: AccionSugerida) => {
    const query = texto.trim();
    if (!query || cargando) return;

    agregarMensaje({
      rol: "user",
      contenido: query,
    });
    setInput("");
    setCargando(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: query,
          contexto,
          historial: mensajes.map((m) => ({ rol: m.rol, contenido: m.contenido })),
          campoObjetivo: accion?.campoObjetivo || contexto.campoEnFoco,
        }),
      });

      const data: RespuestaAsistente & { error?: string } = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo obtener respuesta del asistente");
      }

      agregarMensaje({
        rol: "assistant",
        contenido: data.mensaje,
        accionesSugeridas: data.accionesSugeridas,
        campoInsercion: data.sugerenciaInsercion?.campo,
        textoAInsertar: data.sugerenciaInsercion?.texto,
      });
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error ? err.message : "Error al comunicarse con SAPCU";
      agregarMensaje({
        rol: "assistant",
        contenido: `⚠️ **Aviso del Sistema**: ${errMessage}. Verifica tu conexión o intenta con otra consulta.`,
      });
    } finally {
      setCargando(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enviarConsulta(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarConsulta(input);
    }
  };

  return (
    <>
      {/* Botón Flotante Disparador */}
      <aside aria-label="Asistente Pedagógico Flotante">
        {!isOpen && (
          <button
            onClick={toggleOpen}
            className="fixed bottom-6 right-6 z-[9990] flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-600 text-white font-medium rounded-full shadow-2xl hover:scale-105 hover:shadow-cyan-500/25 transition-all duration-200 border border-white/20 active:scale-95 group"
            aria-label="Abrir Asistente Pedagógico Universal"
          >
            <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
            <span className="text-sm font-semibold tracking-wide">Asistente SAPCU</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </button>
        )}
      </aside>

      {/* Panel Flotante del Asistente */}
      {isOpen && (
        <section
          aria-label="Panel de Asistente Pedagógico Contextual Universal"
          className="fixed bottom-6 right-6 z-[9995] w-[95vw] max-w-[480px] h-[640px] max-h-[85vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Encabezado */}
          <header className="p-4 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg">
                <Sparkles className="w-5 h-5 text-yellow-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-white tracking-tight">SAPCU</h2>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    SACRINT
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3 text-cyan-400" />
                  {buildLevelLabel(contexto.nivel)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {mensajes.length > 0 && (
                <button
                  onClick={limpiarConversacion}
                  title="Limpiar conversación"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={toggleOpen}
                title="Minimizar panel"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={toggleOpen}
                title="Cerrar asistente"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Badge de Contexto Activo */}
          <nav aria-label="Contexto de Navegación Activo" className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/50 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5 truncate">
              <Compass className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate font-medium text-slate-300">
                {buildProgramLabel(contexto.programa)}
              </span>
              {contexto.pantallaActiva && (
                <span className="text-[10px] text-slate-500 truncate">
                  / {contexto.pantallaActiva}
                </span>
              )}
            </div>
            {contexto.campoEnFoco && (
              <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full shrink-0">
                Foco: {contexto.campoEnFoco}
              </span>
            )}
          </nav>

          {/* Área de Mensajes */}
          <main aria-label="Hilo de Conversación" className="flex-1 overflow-y-auto p-4 space-y-4">
            {mensajes.length === 0 && (
              <div className="h-full flex flex-col justify-center items-center text-center p-6 text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Copiloto Pedagógico Listo
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                    Selecciona una acción sugerida o escribe tu consulta sobre el diseño didáctico.
                  </p>
                </div>
              </div>
            )}

            {mensajes.map((m) => {
              const esUsuario = m.rol === "user";
              return (
                <article
                  key={m.id}
                  className={`flex flex-col ${esUsuario ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                      esUsuario
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-slate-800/90 text-slate-200 border border-slate-700/50 rounded-bl-none"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{m.contenido}</div>

                    {/* Acciones del Mensaje del Asistente */}
                    {!esUsuario && (
                      <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-end gap-2 text-xs">
                        <button
                          onClick={() => handleCopiar(m.id, m.contenido)}
                          className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors px-2 py-1 rounded bg-slate-900/60"
                          title="Copiar texto"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span className="text-[11px]">Copiar</span>
                        </button>

                        {m.campoInsercion && m.textoAInsertar && (
                          <button
                            onClick={() => handleInsertar(m.campoInsercion!, m.textoAInsertar!)}
                            className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 transition-colors px-2 py-1 rounded bg-cyan-950/60 border border-cyan-800/50"
                            title={`Insertar en ${m.campoInsercion}`}
                          >
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Insertar en campo</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

            {cargando && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-100" />
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce delay-200" />
                <span className="ml-1 text-slate-400">Analizando contexto pedagógico...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </main>

          {/* Sugerencias Rápidas */}
          {quickActions.length > 0 && (
            <div className="p-3 bg-slate-950/60 border-t border-slate-800/50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-cyan-400" />
                Sugerencias contextuales:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
                {quickActions.map((qa) => (
                  <button
                    key={qa.id}
                    onClick={() => enviarConsulta(qa.prompt, qa)}
                    disabled={cargando}
                    className="whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white text-xs border border-slate-700/60 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {qa.titulo}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Formulario de Entrada */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta pedagógica (Enter para enviar)..."
              rows={2}
              disabled={cargando}
              className="flex-1 bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/40 resize-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || cargando}
              className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
              title="Enviar consulta"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
