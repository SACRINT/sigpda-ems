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
  Volume2,
  Play,
  Pause,
  Square,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAssistant } from "./AssistantContext";
import { generateQuickActions } from "@/lib/assistant/prompt-builder";
import { buildLevelLabel, buildProgramLabel } from "@/lib/assistant/context-extractor";
import type { AccionSugerida, RespuestaAsistente } from "@/types/assistant";
import styles from "./UniversalPedagogicalAssistant.module.css";

function TTSControls({ text }: { text: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const charIndexRef = useRef(0);

  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
        utteranceRef.current.onboundary = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handlePlay = (rate: number, startPos = 0) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current.onboundary = null;
    }
    window.speechSynthesis.cancel();

    setTimeout(() => {
      const remainingText = text.substring(startPos);
      if (!remainingText.trim()) {
        setIsPlaying(false);
        setIsPaused(false);
        charIndexRef.current = 0;
        return;
      }

      const utterance = new SpeechSynthesisUtterance(remainingText);
      utteranceRef.current = utterance;
      utterance.lang = "es-MX";
      utterance.rate = rate;

      utterance.onboundary = (event) => {
        charIndexRef.current = startPos + event.charIndex;
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        charIndexRef.current = 0;
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (event.error !== "interrupted" && event.error !== "canceled") {
          console.error("TTS error:", event);
          setIsPlaying(false);
          setIsPaused(false);
        }
      };

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
      setIsPaused(false);
    }, 120);
  };

  const handlePlayPause = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (isPlaying) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      handlePlay(speed, 0);
    }
  };

  const handleStop = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    charIndexRef.current = 0;
  };

  const cycleSpeed = () => {
    const newSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(newSpeed);
    if (isPlaying) {
      handlePlay(newSpeed, charIndexRef.current);
    }
  };

  if (!isPlaying) {
    return (
      <div className={styles.tts}>
        <button
          type="button"
          onClick={handlePlayPause}
          title="Escuchar respuesta con voz"
          className={styles.ttsButton}
        >
          <Volume2 />
          <span>Leer respuesta</span>
        </button>
        <button
          type="button"
          onClick={cycleSpeed}
          title="Velocidad de lectura"
          className={styles.ttsSpeed}
        >
          {speed}x
        </button>
      </div>
    );
  }

  return (
    <div className={styles.tts}>
      <button
        type="button"
        onClick={handlePlayPause}
        title={isPaused ? "Reanudar" : "Pausar"}
        className={styles.ttsButton}
      >
        {isPaused ? <Play /> : <Pause />}
        <span>{isPaused ? "Reanudar" : "Pausar"}</span>
      </button>
      <button
        type="button"
        onClick={handleStop}
        title="Detener lectura"
        className={`${styles.ttsButton} ${styles.ttsButtonStop}`}
      >
        <Square />
        <span>Detener</span>
      </button>
      <button
        type="button"
        onClick={cycleSpeed}
        title="Velocidad de lectura"
        className={styles.ttsSpeed}
      >
        {speed}x
      </button>
    </div>
  );
}

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

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensajes, isOpen]);

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
      <aside aria-label="Asistente Pedagógico Flotante">
        {!isOpen && (
          <button
            onClick={toggleOpen}
            className={styles.trigger}
            aria-label="Abrir Asistente Pedagógico Universal"
          >
            <Sparkles className={styles.triggerIcon} />
            <span>SIGPDA Bot IA</span>
            <span className={styles.statusDot} />
          </button>
        )}
      </aside>

      {isOpen && (
        <section
          aria-label="Panel de Asistente Pedagógico Contextual Universal"
          className={styles.panel}
        >
          <header className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.logo}>
                <Sparkles className={styles.triggerIcon} />
              </div>
              <div>
                <div className={styles.titleRow}>
                  <h2 className={styles.title}>SIGPDA Bot IA</h2>
                  <span className={styles.badge}>SAPCU</span>
                </div>
                <p className={styles.level}>
                  <GraduationCap className={styles.levelIcon} />
                  {buildLevelLabel(contexto.nivel)}
                </p>
              </div>
            </div>

            <div className={styles.headerActions}>
              {mensajes.length > 0 && (
                <button
                  onClick={limpiarConversacion}
                  title="Limpiar conversación"
                  className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                >
                  <Trash2 />
                </button>
              )}
              <button
                onClick={toggleOpen}
                title="Minimizar panel"
                className={styles.iconButton}
              >
                <Minimize2 />
              </button>
              <button
                onClick={toggleOpen}
                title="Cerrar asistente"
                className={styles.iconButton}
              >
                <X />
              </button>
            </div>
          </header>

          <nav
            aria-label="Contexto de Navegación Activo"
            className={styles.contextBar}
          >
            <div className={styles.contextLeft}>
              <Compass className={styles.contextIcon} />
              <span className={styles.contextProgram}>
                {buildProgramLabel(contexto.programa)}
              </span>
              {contexto.pantallaActiva && (
                <span className={styles.contextScreen}>
                  / {contexto.pantallaActiva}
                </span>
              )}
            </div>
            {contexto.campoEnFoco && (
              <span className={styles.focusBadge}>
                Foco: {contexto.campoEnFoco}
              </span>
            )}
          </nav>

          <main aria-label="Hilo de Conversación" className={styles.messages}>
            {mensajes.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <Sparkles className={styles.triggerIcon} />
                </div>
                <div>
                  <p className={styles.emptyTitle}>Copiloto Pedagógico Listo</p>
                  <p className={styles.emptyText}>
                    Selecciona una acción sugerida o escribe tu consulta sobre el
                    diseño didáctico.
                  </p>
                </div>
              </div>
            )}

            {mensajes.map((m) => {
              const esUsuario = m.rol === "user";
              return (
                <article
                  key={m.id}
                  className={`${styles.messageRow} ${
                    esUsuario ? styles.messageRowUser : styles.messageRowAssistant
                  }`}
                >
                  <div
                    className={`${styles.bubble} ${
                      esUsuario ? styles.bubbleUser : styles.bubbleAssistant
                    }`}
                  >
                    <div className={styles.messageContent}>{m.contenido}</div>

                    {!esUsuario && (
                      <>
                        <TTSControls text={m.contenido} />
                        <div className={styles.messageActions}>
                          <button
                            onClick={() => handleCopiar(m.id, m.contenido)}
                            className={styles.actionButton}
                            title="Copiar texto"
                          >
                            {copiedId === m.id ? <Check /> : <Copy />}
                            <span>Copiar</span>
                          </button>

                          {m.campoInsercion && m.textoAInsertar && (
                            <button
                              onClick={() =>
                                handleInsertar(m.campoInsercion!, m.textoAInsertar!)
                              }
                              className={`${styles.actionButton} ${styles.actionButtonInsert}`}
                              title={`Insertar en ${m.campoInsercion}`}
                            >
                              <CornerDownLeft />
                              <span>Insertar en campo</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </article>
              );
            })}

            {cargando && (
              <div className={styles.loading}>
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
                <span>Analizando contexto pedagógico...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </main>

          {quickActions.length > 0 && (
            <div className={styles.quickActions}>
              <p className={styles.quickActionsTitle}>
                <AlertCircle className={styles.quickActionsTitleIcon} />
                Sugerencias contextuales:
              </p>
              <div className={styles.quickActionsList}>
                {quickActions.map((qa) => (
                  <button
                    key={qa.id}
                    onClick={() => enviarConsulta(qa.prompt, qa)}
                    disabled={cargando}
                    className={styles.quickAction}
                  >
                    {qa.titulo}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta pedagógica (Enter para enviar)..."
              rows={2}
              disabled={cargando}
              className={styles.textarea}
            />
            <button
              type="submit"
              disabled={!input.trim() || cargando}
              className={styles.sendButton}
              title="Enviar consulta"
            >
              <Send />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
