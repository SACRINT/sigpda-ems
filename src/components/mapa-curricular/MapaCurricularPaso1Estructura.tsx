"use client";

import React from "react";
import { AlertCircle, Layers, ChevronRight } from "lucide-react";

export interface MapaCurricularPaso1EstructuraProps {
  esTecnologico: boolean;
  onSelectSubsistema: (subsistema: "bge" | "tecnologico") => void;
  g1: number;
  setG1: React.Dispatch<React.SetStateAction<number>>;
  g2: number;
  setG2: React.Dispatch<React.SetStateAction<number>>;
  g3: number;
  setG3: React.Dispatch<React.SetStateAction<number>>;
  onContinuar: () => void;
}

export default function MapaCurricularPaso1Estructura({
  esTecnologico,
  onSelectSubsistema,
  g1,
  setG1,
  g2,
  setG2,
  g3,
  setG3,
  onContinuar,
}: MapaCurricularPaso1EstructuraProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div
        style={{
          background: "rgba(37, 99, 235, 0.15)",
          border: "1px solid rgba(59, 130, 246, 0.35)",
          padding: "1rem",
          borderRadius: "12px",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <AlertCircle size={24} color="#38bdf8" />
        <div style={{ fontSize: "0.85rem", color: "#bfdbfe", lineHeight: 1.4 }}>
          <strong style={{ color: "#ffffff" }}>Paso 1: Confirme los grupos activos en su plantel.</strong>
          <br />
          Escriba la cantidad de grupos activos por grado/año. Esta información se usará para construir automáticamente las listas en Horarios IA y Planeaciones Didácticas.
        </div>
      </div>

      {/* Selector Interactivo de Subsistema */}
      <div
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "14px",
          padding: "1.25rem",
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.85rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: "0.95rem",
                fontWeight: 800,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Layers size={18} color="#38bdf8" /> Subsistema Educativo del Plantel:
            </h4>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>
              Seleccione el modelo educativo oficial aplicable a su escuela para configurar la malla curricular, horas semanales y módulos:
            </p>
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              padding: "0.25rem 0.65rem",
              borderRadius: "6px",
              background: esTecnologico ? "rgba(245, 158, 11, 0.2)" : "rgba(37, 99, 235, 0.2)",
              color: esTecnologico ? "#fbbf24" : "#60a5fa",
              border: esTecnologico ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(59, 130, 246, 0.4)",
            }}
          >
            {esTecnologico ? "🏫 Bachillerato Tecnológico Activo" : "🏛️ Bachillerato General Activo"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {/* Opción BGE */}
          <button
            type="button"
            onClick={() => onSelectSubsistema("bge")}
            style={{
              textAlign: "left",
              padding: "1rem",
              borderRadius: "12px",
              border: `2px solid ${!esTecnologico ? "#38bdf8" : "#334155"}`,
              background: !esTecnologico ? "rgba(37, 99, 235, 0.18)" : "#0f172a",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
              <span style={{ fontWeight: 800, fontSize: "0.9rem", color: !esTecnologico ? "#38bdf8" : "#f1f5f9" }}>
                🏛️ Bachillerato General Estatal (BGE)
              </span>
              {!esTecnologico && (
                <span
                  style={{
                    color: "#38bdf8",
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    background: "rgba(56, 189, 248, 0.2)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                >
                  ✓ Seleccionado
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.45 }}>
              <strong>Plan Normativo MCCEMS Puebla:</strong> 25h en 1.er sem, 30h en 3.er y 5.º sem. Configura{" "}
              <strong>15 Capacitaciones Laborales</strong> y Formación Fundamental Extendida (<strong>Optativas FFE</strong>).
            </div>
          </button>

          {/* Opción Tecnológico */}
          <button
            type="button"
            onClick={() => onSelectSubsistema("tecnologico")}
            style={{
              textAlign: "left",
              padding: "1rem",
              borderRadius: "12px",
              border: `2px solid ${esTecnologico ? "#f59e0b" : "#334155"}`,
              background: esTecnologico ? "rgba(245, 158, 11, 0.18)" : "#0f172a",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
              <span style={{ fontWeight: 800, fontSize: "0.9rem", color: esTecnologico ? "#fbbf24" : "#f1f5f9" }}>
                🏫 Bachillerato Tecnológico (BT / DBEPA)
              </span>
              {esTecnologico && (
                <span
                  style={{
                    color: "#fbbf24",
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    background: "rgba(245, 158, 11, 0.2)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                >
                  ✓ Seleccionado
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.45 }}>
              <strong>Estructura Tecnológica DBEPA Puebla:</strong> 28h en 1.er sem (10 UACs), 39h en 3.er sem (Módulo II 17h) y 35h en 5.º sem (Módulo IV 12h + Propedéutica 3h). Configura{" "}
              <strong>Carreras Técnicas</strong>.
            </div>
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
        <div style={{ padding: "1.25rem", border: "1px solid #334155", background: "#1e293b", borderRadius: "12px", textAlign: "center" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.5rem" }}>
            1.er Año (1.º y 2.º Semestre)
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={g1}
            onChange={(e) => setG1(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: "100%",
              fontSize: "1.5rem",
              fontWeight: 800,
              textAlign: "center",
              padding: "0.5rem",
              borderRadius: "8px",
              border: "2px solid #3b82f6",
              background: "#0f172a",
              color: "#ffffff",
            }}
          />
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.5rem" }}>
            Genera: 1º A {g1 > 1 ? `hasta 1º ${String.fromCharCode(64 + g1)}` : ""}
          </div>
        </div>

        <div style={{ padding: "1.25rem", border: "1px solid #334155", background: "#1e293b", borderRadius: "12px", textAlign: "center" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.5rem" }}>
            2.º Año (3.er y 4.º Semestre)
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={g2}
            onChange={(e) => setG2(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: "100%",
              fontSize: "1.5rem",
              fontWeight: 800,
              textAlign: "center",
              padding: "0.5rem",
              borderRadius: "8px",
              border: "2px solid #3b82f6",
              background: "#0f172a",
              color: "#ffffff",
            }}
          />
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.5rem" }}>
            Genera: 3º A {g2 > 1 ? `hasta 3º ${String.fromCharCode(64 + g2)}` : ""}
          </div>
        </div>

        <div style={{ padding: "1.25rem", border: "1px solid #334155", background: "#1e293b", borderRadius: "12px", textAlign: "center" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.5rem" }}>
            3.er Año (5.º y 6.º Semestre)
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={g3}
            onChange={(e) => setG3(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: "100%",
              fontSize: "1.5rem",
              fontWeight: 800,
              textAlign: "center",
              padding: "0.5rem",
              borderRadius: "8px",
              border: "2px solid #3b82f6",
              background: "#0f172a",
              color: "#ffffff",
            }}
          />
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.5rem" }}>
            Genera: 5º A {g3 > 1 ? `hasta 5º ${String.fromCharCode(64 + g3)}` : ""}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onContinuar();
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontWeight: 700,
            padding: "0.65rem 1.25rem",
            background: "#2563eb",
            color: "#ffffff",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Continuar al Mapa Curricular por Grupo <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
