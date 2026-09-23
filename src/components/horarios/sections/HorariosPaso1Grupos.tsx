"use client";

import React from "react";
import { Users, Clock, ShieldCheck, Plus, Trash2, Layers } from "lucide-react";
import type { GrupoHorario, CustomUacHorario } from "@/lib/horarios/types";
import type { CarreraTecnica } from "@/lib/bt-carreras-catalog";
import {
  FORMACIONES_LABORALES,
  FORMACIONES_SOCIOEMOCIONALES,
  FFE_OPTATIVAS_CATALOGO,
  FFE_RECURSOS_SOCIOCOGNITIVOS as FFE_RECURSO_SOCIOCOGNITIVO,
  FFE_AREAS_CONOCIMIENTO as FFE_AREA_CONOCIMIENTO,
} from "@/lib/escuela-grupos";
import { CATALOGO_PROPEDUTICAS_5TO } from "@/lib/bt-carreras-catalog";

export interface HorariosPaso1GruposProps {
  periodoActivo: "A" | "B";
  setPeriodoActivo: (v: "A" | "B") => void;
  setUsuarioCambioGrupos: (v: boolean) => void;
  nombreEscuela: string;
  setNombreEscuela: (v: string) => void;
  cctEscuela: string;
  setCctEscuela: (v: string) => void;
  zonaEscolar: string;
  setZonaEscolar: (v: string) => void;
  esTecnologico: boolean;
  setModoConfiguracion: (v: "SEMIAUTOMATICO" | "MANUAL_TECNOLOGICO") => void;
  g1: number;
  setG1: (v: number) => void;
  g2: number;
  setG2: (v: number) => void;
  g3: number;
  setG3: (v: number) => void;
  generarGruposSegunEstructura: (n1: number, n2: number, n3: number) => void;
  numPeriodos: number;
  setNumPeriodos: (v: number) => void;
  grupos: GrupoHorario[];
  carrerasTecnologicas: CarreraTecnica[];
  handleActualizarConfigGrupo: (index: number, field: string, value: string | number | boolean | null) => void;
  handleActualizarOptativaGrupo: (grupoIdx: number, optativaIdx: number, value: string) => void;
  modoConfiguracion: string;
  grupoActivoManual: string;
  setGrupoActivoManual: (v: string) => void;
  curriculoManualPorGrupo: Record<string, CustomUacHorario[]>;
  handleAgregarMateriaManual: (sem: number, grupoLetra: string) => void;
  handleActualizarMateriaManual: (sem: number, grupoLetra: string, index: number, field: string, value: string | number) => void;
  handleEliminarMateriaManual: (sem: number, grupoLetra: string, index: number) => void;
  normalizarNombreGrupo: (nombre: string) => string;
  handleAvanzarPaso1: () => void;
}

export default function HorariosPaso1Grupos({
  periodoActivo,
  setPeriodoActivo,
  setUsuarioCambioGrupos,
  nombreEscuela,
  setNombreEscuela,
  cctEscuela,
  setCctEscuela,
  zonaEscolar,
  setZonaEscolar,
  esTecnologico,
  setModoConfiguracion,
  g1,
  setG1,
  g2,
  setG2,
  g3,
  setG3,
  generarGruposSegunEstructura,
  numPeriodos,
  setNumPeriodos,
  grupos,
  carrerasTecnologicas,
  handleActualizarConfigGrupo,
  handleActualizarOptativaGrupo,
  modoConfiguracion,
  grupoActivoManual,
  setGrupoActivoManual,
  curriculoManualPorGrupo,
  handleAgregarMateriaManual,
  handleActualizarMateriaManual,
  handleEliminarMateriaManual,
  normalizarNombreGrupo,
  handleAvanzarPaso1,
}: HorariosPaso1GruposProps) {
  return (
        <>
        {/* Selector de Período Semestral */}
        <div style={{ background: "#1e293b", border: "2px solid #38bdf8", borderRadius: "14px", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 900, color: "#38bdf8", marginBottom: "0.2rem" }}>📅 Período Semestral a Configurar</div>
            <div style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>Seleccione qué semestre desea configurar. El Semestre A es Agosto-Enero (1°,3°,5°) y el Semestre B es Febrero-Julio (2°,4°,6°).</div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => { setPeriodoActivo("A"); setUsuarioCambioGrupos(true); }}
              style={{
                padding: "0.6rem 1.4rem",
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: "0.9rem",
                border: "2px solid " + (periodoActivo === "A" ? "#38bdf8" : "#475569"),
                background: periodoActivo === "A" ? "#0284c7" : "#0f172a",
                color: periodoActivo === "A" ? "#ffffff" : "#cbd5e1",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              📘 Semestre A (1°, 3°, 5°)
            </button>
            <button
              type="button"
              onClick={() => { setPeriodoActivo("B"); setUsuarioCambioGrupos(true); }}
              style={{
                padding: "0.6rem 1.4rem",
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: "0.9rem",
                border: "2px solid " + (periodoActivo === "B" ? "#a78bfa" : "#475569"),
                background: periodoActivo === "B" ? "#7c3aed" : "#0f172a",
                color: periodoActivo === "B" ? "#ffffff" : "#cbd5e1",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              📗 Semestre B (2°, 4°, 6°)
            </button>
          </div>
          <div style={{ background: periodoActivo === "A" ? "rgba(2,132,199,0.2)" : "rgba(124,58,237,0.2)", border: `1px solid ${periodoActivo === "A" ? "rgba(56,189,248,0.3)" : "rgba(167,139,250,0.3)"}`, padding: "0.4rem 0.85rem", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 800, color: periodoActivo === "A" ? "#38bdf8" : "#c084fc" }}>
            {periodoActivo === "A" ? "⚙️ Configurando: Agosto-Enero" : "⚙️ Configurando: Febrero-Julio"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Datos del Plantel y Supervisión Escolar */}
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "14px", padding: "1.25rem", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
              <span style={{ fontSize: "1.25rem" }}>🏫</span>
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#ffffff" }}>Datos Oficiales del Plantel y Supervisión Escolar</div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Personalice el nombre del plantel, clave CCT y su Supervisión / Zona Escolar correspondiente (se reflejará en todos los membretes oficiales).</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.3rem" }}>
                  🏛️ Nombre del Plantel / Escuela:
                </label>
                <input
                  type="text"
                  value={nombreEscuela}
                  onChange={(e) => setNombreEscuela(e.target.value)}
                  placeholder="Ej. Bachillerato General Oficial..."
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#0f172a", color: "#ffffff", fontSize: "0.8125rem", fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.3rem" }}>
                  📋 Clave de Centro de Trabajo (C.C.T.):
                </label>
                <input
                  type="text"
                  value={cctEscuela}
                  onChange={(e) => setCctEscuela(e.target.value)}
                  placeholder="Ej. 21EBH0000X"
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#0f172a", color: "#ffffff", fontSize: "0.8125rem", fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#38bdf8", marginBottom: "0.3rem" }}>
                  📍 Supervisión / Zona Escolar:
                </label>
                <input
                  type="text"
                  value={zonaEscolar}
                  onChange={(e) => setZonaEscolar(e.target.value)}
                  placeholder="Ej. 004, 012, Zona 025..."
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "2px solid #38bdf8", background: "#0f172a", color: "#38bdf8", fontSize: "0.875rem", fontWeight: 800 }}
                />
              </div>
            </div>
          </div>

          {/* Banner Selector de Subsistema Educativo */}
          <div style={{ background: "#1e293b", padding: "1.25rem", borderRadius: "14px", border: "1px solid #334155", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#ffffff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Layers style={{ width: "18px", height: "18px", color: "#38bdf8" }} /> Subsistema Educativo Oficial del Plantel:
              </h3>
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "0.25rem 0.65rem",
                borderRadius: "6px",
                background: esTecnologico ? "rgba(245, 158, 11, 0.2)" : "rgba(37, 99, 235, 0.2)",
                color: esTecnologico ? "#fbbf24" : "#60a5fa",
                border: esTecnologico ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(59, 130, 246, 0.4)"
              }}>
                {esTecnologico ? "🏫 Bachillerato Tecnológico Activo" : "🏛️ Bachillerato General Estatal Activo"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <button
                type="button"
                onClick={() => setModoConfiguracion("SEMIAUTOMATICO")}
                style={{
                  textAlign: "left",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "2px solid " + (!esTecnologico ? "#38bdf8" : "#334155"),
                  background: !esTecnologico ? "rgba(37,99,235,0.2)" : "#0f172a",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "0.875rem", color: !esTecnologico ? "#60a5fa" : "#f8fafc" }}>
                  🏛️ Bachillerato General Estatal (BGE)
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  Malla Oficial MCCEMS Puebla (25h/30h). Precarga UACs fundamentales, 15 capacitaciones laborales y optativas FFE.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setModoConfiguracion("MANUAL_TECNOLOGICO")}
                style={{
                  textAlign: "left",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "2px solid " + (esTecnologico ? "#f59e0b" : "#334155"),
                  background: esTecnologico ? "rgba(217,119,6,0.2)" : "#0f172a",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "0.875rem", color: esTecnologico ? "#fbbf24" : "#f8fafc" }}>
                  🏫 Bachillerato Tecnológico (BT Puebla)
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  Malla Tecnológica MCCEMS (28h/39h/35h). Precarga 10 UACs, Carreras Técnicas oficiales, Módulos Profesionales y Propedéuticas.
                </div>
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "12px", border: "1px solid #334155" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.4rem" }}>
                <Users style={{ width: "15px", height: "15px", color: "#38bdf8", display: "inline", marginRight: "5px" }} />
                1.er Año ({periodoActivo === "A" ? "1.º Semestre" : "2.º Semestre"})
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={g1}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value));
                    setG1(val);
                    setUsuarioCambioGrupos(true);
                    generarGruposSegunEstructura(val, g2, g3);
                  }}
                  style={{ width: "70px", padding: "0.4rem", borderRadius: "8px", border: "2px solid #3b82f6", background: "#0f172a", fontWeight: 800, textAlign: "center", fontSize: "1.125rem", color: "#ffffff" }}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#38bdf8" }}>
                  Genera {periodoActivo === "A" ? "1°" : "2°"} A a {periodoActivo === "A" ? "1°" : "2°"} {String.fromCharCode(64 + Math.min(g1, 26))}
                </span>
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "12px", border: "1px solid #334155" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.4rem" }}>
                <Users style={{ width: "15px", height: "15px", color: "#38bdf8", display: "inline", marginRight: "5px" }} />
                2.º Año ({periodoActivo === "A" ? "3.er Semestre" : "4.º Semestre"})
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={g2}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value));
                    setG2(val);
                    setUsuarioCambioGrupos(true);
                    generarGruposSegunEstructura(g1, val, g3);
                  }}
                  style={{ width: "70px", padding: "0.4rem", borderRadius: "8px", border: "2px solid #3b82f6", background: "#0f172a", fontWeight: 800, textAlign: "center", fontSize: "1.125rem", color: "#ffffff" }}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#38bdf8" }}>
                  Genera {periodoActivo === "A" ? "3°" : "4°"} A a {periodoActivo === "A" ? "3°" : "4°"} {String.fromCharCode(64 + Math.min(g2, 26))}
                </span>
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "12px", border: "1px solid #334155" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.4rem" }}>
                <Users style={{ width: "15px", height: "15px", color: "#38bdf8", display: "inline", marginRight: "5px" }} />
                3.er Año ({periodoActivo === "A" ? "5.º Semestre" : "6.º Semestre"})
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={g3}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value));
                    setG3(val);
                    setUsuarioCambioGrupos(true);
                    generarGruposSegunEstructura(g1, g2, val);
                  }}
                  style={{ width: "70px", padding: "0.4rem", borderRadius: "8px", border: "2px solid #3b82f6", background: "#0f172a", fontWeight: 800, textAlign: "center", fontSize: "1.125rem", color: "#ffffff" }}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#38bdf8" }}>
                  Genera {periodoActivo === "A" ? "5°" : "6°"} A a {periodoActivo === "A" ? "5°" : "6°"} {String.fromCharCode(64 + Math.min(g3, 26))}
                </span>
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "12px", border: "1px solid #334155" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.4rem" }}>
                <Clock style={{ width: "15px", height: "15px", color: "#4ade80", display: "inline", marginRight: "5px" }} />
                {esTecnologico ? "Jornada Escolar (Bachillerato Tecnológico)" : "Jornada Escolar"}
              </label>
              <select
                value={numPeriodos}
                onChange={(e) => setNumPeriodos(Number(e.target.value))}
                style={{ width: "100%", padding: "0.45rem", borderRadius: "8px", border: "2px solid #22c55e", background: "#0f172a", fontWeight: 800, fontSize: "0.8125rem", color: "#ffffff" }}
              >
                <option value={8} style={{ background: "#0f172a", color: "#ffffff" }}>8 Horas diarias (40 hrs/sem) {esTecnologico ? "— Requerido para BT (39 hrs)" : ""}</option>
                <option value={7} style={{ background: "#0f172a", color: "#ffffff" }}>7 Horas diarias (35 hrs/sem)</option>
                <option value={6} style={{ background: "#0f172a", color: "#ffffff" }}>6 Horas diarias (30 hrs/sem) — Estándar BGE</option>
                <option value={5} style={{ background: "#0f172a", color: "#ffffff" }}>5 Horas diarias (25 hrs/sem)</option>
              </select>
            </div>
          </div>

          {modoConfiguracion === "MANUAL_TECNOLOGICO" ? (
            <div style={{ border: "1px solid #f59e0b", borderRadius: "12px", padding: "1.25rem", background: "#1e293b" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#fbbf24", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ShieldCheck style={{ width: "18px", height: "18px", color: "#f59e0b" }} /> Asignaturas y Módulos del Subsistema Tecnológico / CBTIS
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "#cbd5e1", margin: "0 0 1rem" }}>
                Configure las asignaturas de <strong>cada grupo de manera independiente</strong>.
              </p>

              {Math.max(g1, g2, g3) > 1 && (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "#0f172a", borderRadius: "10px", border: "1px solid #334155", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#fbbf24", marginRight: "0.25rem" }}>Configurar Grupo:</span>
                  {["A","B","C","D","E","F","G","H","I","J"].slice(0, Math.max(g1, g2, g3)).map(letra => (
                    <button
                      key={letra}
                      type="button"
                      onClick={() => setGrupoActivoManual(letra)}
                      style={{
                        padding: "0.45rem 1.1rem",
                        borderRadius: "8px",
                        fontWeight: 800,
                        fontSize: "0.8125rem",
                        border: "1px solid " + (grupoActivoManual === letra ? "#f59e0b" : "#475569"),
                        cursor: "pointer",
                        background: grupoActivoManual === letra ? "#d97706" : "#1e293b",
                        color: "#ffffff",
                        boxShadow: grupoActivoManual === letra ? "0 2px 8px rgba(217,119,6,0.4)" : "none"
                      }}
                    >
                      Grupo {letra}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
                {(periodoActivo === "A"
                  ? [
                    { sem: 1, label: "1er Semestre (Asignaturas Base)" },
                    { sem: 3, label: "3er Semestre (Física / Módulos Especialidad)" },
                    { sem: 5, label: "5to Semestre (Cálculo / Módulos Especialidad)" }
                  ]
                  : [
                    { sem: 2, label: "2do Semestre (Asignaturas Base)" },
                    { sem: 4, label: "4to Semestre (Física II / Módulos Especialidad)" },
                    { sem: 6, label: "6to Semestre (Estadística / Módulos Especialidad)" }
                  ]
                ).map(({ sem, label }) => {
                  const key = `${sem}_${grupoActivoManual}`;
                  const lista: CustomUacHorario[] = curriculoManualPorGrupo[key] || [];
                  return (
                    <div key={sem} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "1rem", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #334155", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "#fbbf24", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          {label}
                          {Math.max(g1, g2, g3) > 1 && (
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "#d97706", color: "#fff", padding: "0.15rem 0.5rem", borderRadius: "20px" }}>
                              Grupo {grupoActivoManual}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, background: "#1e293b", color: "#fbbf24", border: "1px solid #f59e0b", padding: "0.25rem 0.5rem", borderRadius: "6px", whiteSpace: "nowrap" }}>
                          {lista.reduce((sum: number, m: CustomUacHorario) => sum + Number(m.horasSemanales || 0), 0)} hrs/sem
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {lista.map((m: CustomUacHorario, mIdx: number) => (
                          <div key={m.id || mIdx} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <input
                              type="text"
                              value={m.uacName}
                              onChange={(e) => handleActualizarMateriaManual(sem, grupoActivoManual, mIdx, "uacName", e.target.value)}
                              placeholder="Nombre de la Asignatura / Módulo"
                              style={{ flex: 1, padding: "0.45rem 0.6rem", borderRadius: "6px", border: "1px solid #475569", background: "#1e293b", fontSize: "0.8125rem", fontWeight: 700, color: "#ffffff" }}
                            />
                            <input
                              type="number"
                              min={1}
                              max={25}
                              value={m.horasSemanales}
                              onChange={(e) => handleActualizarMateriaManual(sem, grupoActivoManual, mIdx, "horasSemanales", Math.max(1, Number(e.target.value)))}
                              style={{ width: "55px", padding: "0.45rem", borderRadius: "6px", border: "1px solid #475569", background: "#1e293b", fontSize: "0.8125rem", fontWeight: 800, textAlign: "center", color: "#ffffff" }}
                            />
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8" }}>hrs</span>
                            <button
                              type="button"
                              onClick={() => handleEliminarMateriaManual(sem, grupoActivoManual, mIdx)}
                              style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", padding: "0.4rem", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center" }}
                              title="Eliminar asignatura"
                            >
                              <Trash2 style={{ width: "14px", height: "14px" }} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAgregarMateriaManual(sem, grupoActivoManual)}
                        style={{ marginTop: "0.85rem", width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px dashed #f59e0b", background: "rgba(217,119,6,0.15)", color: "#fbbf24", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                      >
                        <Plus style={{ width: "14px", height: "14px" }} /> + Agregar Asignatura a {sem}° Semestre{Math.max(g1, g2, g3) > 1 ? ` – Grupo ${grupoActivoManual}` : ""}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ border: "1px solid #334155", borderRadius: "12px", padding: "1.25rem", background: "#1e293b" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ShieldCheck style={{ width: "18px", height: "18px", color: "#38bdf8" }} /> Configuración Curricular Individual por Grupo
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {Array.from({ length: Math.max(g1, g2, g3) }, (_, i) => String.fromCharCode(65 + i)).map((letra) => {
                  const s1 = periodoActivo === "A" ? 1 : 2;
                  const s2 = periodoActivo === "A" ? 3 : 4;
                  const s3 = periodoActivo === "A" ? 5 : 6;
                  const g1Letra = grupos.find((g) => g.semestre === s1 && g.nombre.endsWith(letra));
                  const g3Letra = grupos.find((g) => g.semestre === s2 && g.nombre.endsWith(letra));
                  const g5Letra = grupos.find((g) => g.semestre === s3 && g.nombre.endsWith(letra));
                  const gruposTrack = [g1Letra, g3Letra, g5Letra].filter((g): g is GrupoHorario => !!g);

                  if (gruposTrack.length === 0) return null;

                  return (
                    <div key={letra} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "1rem", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                      <h4 style={{ fontSize: "0.875rem", fontWeight: 900, color: "#38bdf8", margin: "0 0 0.85rem", borderBottom: "1px solid #334155", paddingBottom: "0.4rem" }}>
                        📌 Track de Grupos Letra &quot;{letra}&quot; ({gruposTrack.map(g => g.nombre).join(" | ")})
                      </h4>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
                        {gruposTrack.map((g) => {
                          const idx = grupos.findIndex((grp) => grp.nombre === g.nombre && grp.semestre === g.semestre);

                          return (
                            <div key={g.nombre} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "10px", padding: "0.85rem" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #334155", paddingBottom: "0.4rem", marginBottom: "0.6rem" }}>
                                <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "#ffffff" }}>
                                  Grupo {g.nombre} ({g.semestre}° Semestre)
                                </span>
                                <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "0.2rem 0.4rem", borderRadius: "6px" }}>
                                  {(esTecnologico || g.carreraTecnicaId)
                                    ? (g.semestre === 1 ? "Universal Tecnológica (10 UACs • 28 hrs)" : (g.semestre === 2 ? "Universal Tecnológica (10 UACs • 30 hrs)" : (g.semestre === 3 || g.semestre === 4) ? "Módulos Profesionales (39-40 hrs)" : "Técnica + Propedéutica (35 hrs)"))
                                    : (g.semestre === 1 ? "Universal (8 UACs • 25 hrs)" : (g.semestre === 2 ? "Universal (10 UACs • 30 hrs)" : (g.semestre === 3 || g.semestre === 4) ? "Laboral (9 UACs • 30 hrs)" : "Laboral + FFE (10 UACs • 30 hrs)"))}
                                </span>
                              </div>

                              <div style={{ marginBottom: "0.65rem" }}>
                                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "0.2rem" }}>
                                  Jornada Diaria del Grupo (Horas por día)
                                </label>
                                <select
                                  value={g.horasPorDia || (esTecnologico || g.carreraTecnicaId ? (g.semestre === 3 ? 8 : g.semestre === 5 ? 7 : 6) : 6)}
                                  onChange={(e) => handleActualizarConfigGrupo(idx, "horasPorDia", Number(e.target.value))}
                                  style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #475569", background: "#0f172a", fontSize: "0.75rem", fontWeight: 700, color: "#ffffff" }}
                                >
                                  <option value={8} style={{ background: "#0f172a", color: "#ffffff" }}>8 horas por día (40 hrs / semana) — Requerido BT 3° (39h)</option>
                                  <option value={7} style={{ background: "#0f172a", color: "#ffffff" }}>7 horas por día (35 hrs / semana)</option>
                                  <option value={6} style={{ background: "#0f172a", color: "#ffffff" }}>6 horas por día (30 hrs / semana)</option>
                                  <option value={5} style={{ background: "#0f172a", color: "#ffffff" }}>5 horas por día (25 hrs / semana)</option>
                                </select>
                              </div>

                              {g.semestre >= 3 && (
                                <div style={{ marginBottom: "0.65rem" }}>
                                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "0.2rem" }}>
                                    {g.carreraTecnicaId || esTecnologico ? "Carrera Técnica" : "Formación Laboral (Capacitación del Grupo)"}
                                  </label>
                                  {g.carreraTecnicaId || esTecnologico ? (
                                    <select
                                      value={g.carreraTecnicaId || "contabilidad"}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        handleActualizarConfigGrupo(idx, "carreraTecnicaId", val);
                                        const cObj = carrerasTecnologicas.find(c => c.id === val);
                                        if (cObj) {
                                          handleActualizarConfigGrupo(idx, "versionPrograma", cObj.tipoPrograma);
                                        }
                                      }}
                                      style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #475569", background: "#0f172a", fontSize: "0.78125rem", fontWeight: 700, color: "#ffffff" }}
                                    >
                                      {carrerasTecnologicas.map((c) => (
                                        <option key={c.id} value={c.id} style={{ background: "#0f172a", color: "#ffffff" }}>
                                          {c.nombre} ({c.tipoPrograma === "nuevo" ? "Nuevo Prog. 2024" : "Acuerdo 653"})
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <select
                                      value={g.capacitacionNombre || FORMACIONES_LABORALES[0]}
                                      onChange={(e) => handleActualizarConfigGrupo(idx, "capacitacionNombre", e.target.value)}
                                      style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #475569", background: "#0f172a", fontSize: "0.78125rem", fontWeight: 700, color: "#ffffff" }}
                                    >
                                      {FORMACIONES_LABORALES.map((cap) => (
                                        <option key={cap} value={cap} style={{ background: "#0f172a", color: "#ffffff" }}>
                                          {cap}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              )}

                              {g.semestre >= 3 && !g.carreraTecnicaId && !esTecnologico && (() => {
                                const letraGrupo = g.nombre.split(" ")[1] || "A";
                                const g3 = grupos.find(grp => normalizarNombreGrupo(grp.nombre) === `3° ${letraGrupo}`);
                                const socio3 = g3?.ffeoSocioemocional;
                                const opcionesDisponibles = (g.semestre === 5 && socio3)
                                  ? FORMACIONES_SOCIOEMOCIONALES.filter(s => s !== socio3)
                                  : FORMACIONES_SOCIOEMOCIONALES;

                                const esAuto = g.semestre === 4 || g.semestre === 6;

                                return (
                                  <div style={{ marginBottom: "0.65rem" }}>
                                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "0.2rem" }}>
                                      Currículum Ampliado / Formación Socioemocional (FFEO) {esAuto && "(Automático Semestre B)"}
                                    </label>
                                    <select
                                      disabled={esAuto}
                                      value={g.ffeoSocioemocional || (g.semestre === 3 ? FORMACIONES_SOCIOEMOCIONALES[0] : FORMACIONES_SOCIOEMOCIONALES[1])}
                                      onChange={(e) => handleActualizarConfigGrupo(idx, "ffeoSocioemocional", e.target.value)}
                                      style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #475569", background: "#0f172a", fontSize: "0.72rem", fontWeight: 700, color: "#ffffff", opacity: esAuto ? 0.8 : 1 }}
                                    >
                                      {opcionesDisponibles.map((ffeo) => (
                                        <option key={ffeo} value={ffeo} style={{ background: "#0f172a", color: "#ffffff" }}>
                                          {ffeo}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                );
                              })()}

                              {g.semestre === 5 && (
                                (g.carreraTecnicaId || esTecnologico) ? (
                                  <div style={{ marginBottom: "0.65rem" }}>
                                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "0.2rem" }}>
                                      Materia Propedéutica (3 Horas Semanales)
                                    </label>
                                    <select
                                      value={g.materiaPropedutica5to || "Derecho y Sociedad I"}
                                      onChange={(e) => handleActualizarConfigGrupo(idx, "materiaPropedutica5to", e.target.value)}
                                      style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #475569", background: "#0f172a", fontSize: "0.78125rem", fontWeight: 700, color: "#ffffff" }}
                                    >
                                      {CATALOGO_PROPEDUTICAS_5TO.map((prop) => (
                                        <option key={prop.nombre} value={prop.nombre} style={{ background: "#0f172a", color: "#ffffff" }}>
                                          {prop.nombre} ({prop.area}) - 3h
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div>
                                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "0.3rem" }}>
                                      Optativas FFE (Selección libre de 4 asignaturas del catálogo oficial MCCEMS)
                                    </label>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
                                      {[0, 1, 2, 3].map((optIdx) => {
                                        const valorActual = g.ffeOptativas?.[optIdx] || FFE_OPTATIVAS_CATALOGO[optIdx] || FFE_OPTATIVAS_CATALOGO[0];
                                        const otrasSeleccionadas = (g.ffeOptativas || []).filter((_: string, i: number) => i !== optIdx);

                                        return (
                                          <div key={optIdx}>
                                            <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#94a3b8", display: "block" }}>
                                              Optativa FFE {optIdx + 1}
                                            </span>
                                            <select
                                              value={valorActual}
                                              onChange={(e) => handleActualizarOptativaGrupo(idx, optIdx, e.target.value)}
                                              style={{ width: "100%", padding: "0.35rem", borderRadius: "6px", border: "1px solid #475569", background: "#0f172a", fontSize: "0.6875rem", fontWeight: 700, color: "#ffffff" }}
                                            >
                                              <optgroup label="Recursos Sociocognitivos" style={{ background: "#0f172a", color: "#38bdf8" }}>
                                                {FFE_RECURSO_SOCIOCOGNITIVO.map((mat) => (
                                                  <option key={mat} value={mat} disabled={otrasSeleccionadas.includes(mat)} style={{ background: "#0f172a", color: "#ffffff" }}>
                                                    {mat} {otrasSeleccionadas.includes(mat) ? "(Ya elegida)" : ""}
                                                  </option>
                                                ))}
                                              </optgroup>
                                              <optgroup label="Áreas de Conocimiento" style={{ background: "#0f172a", color: "#a78bfa" }}>
                                                {FFE_AREA_CONOCIMIENTO.map((mat) => (
                                                  <option key={mat} value={mat} disabled={otrasSeleccionadas.includes(mat)} style={{ background: "#0f172a", color: "#ffffff" }}>
                                                    {mat} {otrasSeleccionadas.includes(mat) ? "(Ya elegida)" : ""}
                                                  </option>
                                                ))}
                                              </optgroup>
                                            </select>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )
                              )}

                              {g.semestre === 1 && (
                                <div style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "6px", padding: "0.5rem", marginTop: "0.4rem" }}>
                                  <p style={{ fontSize: "0.72rem", color: "#4ade80", margin: 0, fontWeight: 700 }}>
                                    {(g.carreraTecnicaId || esTecnologico)
                                      ? "✓ 1.er Semestre Tecnológico: 10 Asignaturas Fundamentales Oficiales (incluye Bioética Social y Humanismo Mexicano - 28 hrs/semana)."
                                      : "✓ 1.er Semestre: 8 Asignaturas Fundamentales Oficiales (5 horas diarias = 25 hrs/semana)."}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "1rem" }}>
            <button
              onClick={handleAvanzarPaso1}
              style={{ background: "#2563eb", color: "#ffffff", padding: "0.75rem 1.75rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.9375rem", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}
            >
              Siguiente: Plantilla Docente →
            </button>
          </div>
        </div>
        </>
  );
}
