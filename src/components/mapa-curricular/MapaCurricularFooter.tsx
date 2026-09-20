"use client";

import React from "react";
import { X, RefreshCw, Save } from "lucide-react";

export interface MapaCurricularFooterProps {
  totalGrupos: number;
  paso: 1 | 2;
  setPaso: (paso: 1 | 2) => void;
  isAdmin?: boolean;
  onClose?: () => void;
  guardando: boolean;
  onSave: () => void;
}

export default function MapaCurricularFooter({
  totalGrupos,
  paso,
  setPaso,
  isAdmin = false,
  onClose,
  guardando,
  onSave,
}: MapaCurricularFooterProps) {
  return (
    <div
      style={{
        padding: "1rem 1.5rem",
        background: "#1e293b",
        borderTop: "1px solid #334155",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
        Total de grupos a registrar: <strong style={{ color: "#ffffff" }}>{totalGrupos} grupos</strong>
      </span>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        {isAdmin && onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              border: "1px solid rgba(239, 68, 68, 0.5)",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#fca5a5",
              borderRadius: "8px",
              padding: "0.5rem 0.9rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              cursor: "pointer",
            }}
          >
            <X size={16} /> Cerrar sin guardar (Admin)
          </button>
        )}

        {paso === 2 && (
          <button
            type="button"
            onClick={() => setPaso(1)}
            disabled={guardando}
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              background: "#334155",
              color: "#f8fafc",
              border: "1px solid #475569",
              borderRadius: "8px",
              padding: "0.5rem 0.9rem",
              cursor: "pointer",
            }}
          >
            Regresar a Grupos
          </button>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={guardando}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.85rem",
            fontWeight: 700,
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "0.5rem 1.1rem",
            cursor: guardando ? "not-allowed" : "pointer",
          }}
        >
          {guardando ? (
            <>
              <RefreshCw size={16} className="spin" /> Guardando...
            </>
          ) : (
            <>
              <Save size={16} /> Guardar Mapa Curricular del Plantel
            </>
          )}
        </button>
      </div>
    </div>
  );
}
