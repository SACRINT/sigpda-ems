"use client";

import React from "react";
import { UserCheck, UserPlus, Download, FileSpreadsheet, AlertCircle, Trash2 } from "lucide-react";
import { descargarPlantillaIntegralHorarios } from "@/lib/excel-matriz";
import type { DocenteHorario, GrupoHorario } from "@/lib/horarios/types";

export interface HorariosPaso2DocentesProps {
  docentes: DocenteHorario[];
  docentesAptosParaHorario: DocenteHorario[];
  horasDocentes: Record<string, number>;
  setHorasDocentes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  totalHorasPlantillaDocente: number;
  horasRequeridasPlantel: number;
  gruposDelPeriodoActual: GrupoHorario[];
  getHorasConsumidasDocente: (docenteId: string) => number;
  setMostrarModalDocente: (v: boolean) => void;
  setTabModalDocente: (v: "PLATAFORMA" | "MANUAL" | "EXCEL") => void;
  handleEliminarDocentePlantilla: (docenteId: string) => void;
  handleAvanzarPaso2: () => void;
  setPaso: (paso: number) => void;
  grupos: GrupoHorario[];
  periodoActivo: "A" | "B";
  getUACsIndividualesGrupo: (grupo: GrupoHorario) => any[];
}

export default function HorariosPaso2Docentes({
  docentes,
  docentesAptosParaHorario,
  horasDocentes,
  setHorasDocentes,
  totalHorasPlantillaDocente,
  horasRequeridasPlantel,
  gruposDelPeriodoActual,
  getHorasConsumidasDocente,
  setMostrarModalDocente,
  setTabModalDocente,
  handleEliminarDocentePlantilla,
  handleAvanzarPaso2,
  setPaso,
  grupos,
  periodoActivo,
  getUACsIndividualesGrupo,
}: HorariosPaso2DocentesProps) {
  return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", background: "#1e293b", padding: "1.25rem", borderRadius: "12px", border: "1px solid #334155" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <UserCheck style={{ width: "18px", height: "18px", color: "#38bdf8" }} /> Carga Horaria de la Plantilla Docente Frente a Grupo
              </h3>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem", margin: 0 }}>
                Administrativos, Apoyo y Responsables inician con 0 hrs. Asigne únicamente las horas frente a grupo reales.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ background: "#0f172a", padding: "0.5rem 1rem", borderRadius: "10px", border: "1px solid #334155", textAlign: "right" }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Plantilla Contratada</div>
                <div style={{ fontSize: "1.125rem", fontWeight: 900, color: totalHorasPlantillaDocente >= horasRequeridasPlantel ? "#4ade80" : "#fbbf24" }}>
                  {totalHorasPlantillaDocente} / {horasRequeridasPlantel} hrs
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
                  descargarPlantillaIntegralHorarios(gruposDelPeriodoActual, periodoActivo, getUACsIndividualesGrupo, docentes);
                }}
                title="Descargar libro de Excel unificado (Personal + Horarios)"
                style={{ background: "#1e293b", color: "#38bdf8", border: "1px solid #0284c7", padding: "0.625rem 0.85rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}
              >
                <Download style={{ width: "15px", height: "15px" }} /> 📑 Plantilla Integral (.xlsx)
              </button>

              <button
                type="button"
                onClick={() => {
                  setTabModalDocente("EXCEL");
                  setMostrarModalDocente(true);
                }}
                title="Subir archivo Excel o CSV con la plantilla docente"
                style={{ background: "#047857", color: "#ffffff", border: "1px solid #10b981", padding: "0.625rem 1rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}
              >
                <FileSpreadsheet style={{ width: "15px", height: "15px" }} /> 📥 Importar Excel
              </button>

              <button
                type="button"
                onClick={() => {
                  setTabModalDocente("PLATAFORMA");
                  setMostrarModalDocente(true);
                }}
                style={{ background: "#2563eb", color: "#ffffff", padding: "0.625rem 1.1rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
              >
                <UserPlus style={{ width: "16px", height: "16px" }} /> + Agregar Personal
              </button>
            </div>
          </div>

          {docentes.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", background: "#1e293b", border: "2px dashed #334155", borderRadius: "12px" }}>
              <AlertCircle style={{ width: "32px", height: "32px", color: "#94a3b8", margin: "0 auto 0.5rem" }} />
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#ffffff" }}>No se encontraron docentes activos en la plantilla del horario.</p>
              <button
                onClick={() => setMostrarModalDocente(true)}
                style={{ marginTop: "0.75rem", background: "#2563eb", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.8125rem", border: "none", cursor: "pointer" }}
              >
                + Agregar Personal a la Plantilla
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "0.85rem" }}>
              {docentesAptosParaHorario.map((d) => {
                const hrsAsignadasMatriz = getHorasConsumidasDocente(d.id);
                const hrsContratadas = horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0);
                const esExcedido = hrsAsignadasMatriz > hrsContratadas;

                return (
                  <div
                    key={d.id}
                    style={{
                      padding: "0.85rem",
                      border: "1px solid " + (esExcedido ? "#ef4444" : "#334155"),
                      borderRadius: "10px",
                      background: esExcedido ? "rgba(239, 68, 68, 0.15)" : "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: "0.5rem" }}>
                      <p style={{ fontSize: "0.875rem", fontWeight: 800, color: esExcedido ? "#f87171" : "#ffffff", margin: 0 }}>
                        {d.apellidoPaterno} {d.apellidoMaterno || ""} {d.nombre}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: d.cargo === "DOCENTE" ? "#60a5fa" : "#fbbf24", background: "#0f172a", padding: "0.1rem 0.4rem", borderRadius: "4px", border: "1px solid #334155" }}>
                          {d.cargo || "DOCENTE"}
                        </span>
                        {hrsAsignadasMatriz > 0 && (
                          <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: esExcedido ? "#f87171" : "#4ade80" }}>
                            Asignadas: {hrsAsignadasMatriz}/{hrsContratadas}h {esExcedido ? "⚠️ EXCEDIDO" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0)}
                          onChange={(e) => setHorasDocentes({ ...horasDocentes, [d.id]: Math.max(0, Number(e.target.value)) })}
                          style={{ width: "60px", padding: "0.35rem", borderRadius: "6px", border: "2px solid " + (esExcedido ? "#ef4444" : "#3b82f6"), background: "#0f172a", fontWeight: 800, textAlign: "center", fontSize: "0.875rem", color: "#ffffff" }}
                        />
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8" }}>hrs</span>
                      </div>

                      <button
                        type="button"
                        title="Remover docente de la plantilla activa"
                        onClick={() => handleEliminarDocentePlantilla(d.id)}
                        style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", padding: "0.4rem", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center" }}
                      >
                        <Trash2 style={{ width: "16px", height: "16px" }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "1rem" }}>
            <button
              onClick={() => setPaso(1)}
              style={{ background: "#334155", color: "#ffffff", padding: "0.75rem 1.5rem", borderRadius: "10px", fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              ← Atrás
            </button>
            <button
              onClick={handleAvanzarPaso2}
              style={{ background: "#2563eb", color: "#ffffff", padding: "0.75rem 1.75rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.9375rem", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}
            >
              Siguiente: Matriz por Semestre →
            </button>
          </div>
        </div>
  );
}
