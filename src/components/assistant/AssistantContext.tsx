/**
 * src/components/assistant/AssistantContext.tsx
 * SACRINT Systems IA · SAPCU
 * Proveedor de estado global para el asistente pedagógico contextual.
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type {
  ContextoAsistente,
  MensajeAsistente,
  NivelEducativo,
} from "@/types/assistant";
import { extractContextFromPath } from "@/lib/assistant/context-extractor";

interface AssistantContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  contexto: ContextoAsistente;
  setNivelEducativo: (nivel: NivelEducativo) => void;
  setDetallesDocumento: (detalles: Partial<ContextoAsistente>) => void;
  setCampoEnFoco: (campo: string | undefined) => void;
  registerInsertHandler: (campo: string, handler: (text: string) => void) => () => void;
  insertTextIntoField: (campo: string, text: string) => boolean;
  mensajes: MensajeAsistente[];
  agregarMensaje: (msg: Omit<MensajeAsistente, "id" | "fechaCreacion">) => void;
  limpiarConversacion: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const [isOpen, setIsOpen] = useState(false);
  const [customOverrides, setCustomOverrides] = useState<Partial<ContextoAsistente>>({});
  const [mensajes, setMensajes] = useState<MensajeAsistente[]>([]);
  const [insertHandlers, setInsertHandlers] = useState<Map<string, (text: string) => void>>(
    new Map()
  );

  // Extraer contexto automáticamente según la ruta activa
  const contexto = extractContextFromPath(pathname, customOverrides);

  // Sincronizar y limpiar overrides de documento al cambiar de ruta
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setCustomOverrides((prev) => ({
      nivel: prev.nivel || "media_superior",
    }));
  }

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const setNivelEducativo = useCallback((nivel: NivelEducativo) => {
    setCustomOverrides((prev) => ({ ...prev, nivel }));
  }, []);

  const setDetallesDocumento = useCallback((detalles: Partial<ContextoAsistente>) => {
    setCustomOverrides((prev) => ({ ...prev, ...detalles }));
  }, []);

  const setCampoEnFoco = useCallback((campo: string | undefined) => {
    setCustomOverrides((prev) => ({ ...prev, campoEnFoco: campo }));
  }, []);

  const registerInsertHandler = useCallback(
    (campo: string, handler: (text: string) => void) => {
      setInsertHandlers((prev) => {
        const next = new Map(prev);
        next.set(campo, handler);
        return next;
      });

      return () => {
        setInsertHandlers((prev) => {
          const next = new Map(prev);
          next.delete(campo);
          return next;
        });
      };
    },
    []
  );

  const insertTextIntoField = useCallback(
    (campo: string, text: string): boolean => {
      const handler = insertHandlers.get(campo);
      if (handler) {
        handler(text);
        return true;
      }
      return false;
    },
    [insertHandlers]
  );

  const agregarMensaje = useCallback(
    (msg: Omit<MensajeAsistente, "id" | "fechaCreacion">) => {
      const nuevo: MensajeAsistente = {
        ...msg,
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        fechaCreacion: new Date().toISOString(),
      };
      setMensajes((prev) => [...prev, nuevo]);
    },
    []
  );

  const limpiarConversacion = useCallback(() => {
    setMensajes([]);
  }, []);

  return (
    <AssistantContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggleOpen,
        contexto,
        setNivelEducativo,
        setDetallesDocumento,
        setCampoEnFoco,
        registerInsertHandler,
        insertTextIntoField,
        mensajes,
        agregarMensaje,
        limpiarConversacion,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    return {
      isOpen: false,
      setIsOpen: () => {},
      toggleOpen: () => {},
      contexto: { programa: "general", nivel: "media_superior", ruta: "/" } as ContextoAsistente,
      setNivelEducativo: () => {},
      setDetallesDocumento: () => {},
      setCampoEnFoco: () => {},
      registerInsertHandler: () => () => {},
      insertTextIntoField: () => false,
      mensajes: [],
      agregarMensaje: () => {},
      limpiarConversacion: () => {},
    };
  }
  return context;
}

