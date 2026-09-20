"use client";

import React from "react";
import { Search, FileSpreadsheet } from "lucide-react";
import { descargarPlantillaExcelDocentes, type DocenteImportado } from "@/lib/excel-plantilla";
import { descargarPlantillaIntegralHorarios, ResultadoParseoMatriz, CargaImportada } from "@/lib/excel-matriz";
import type { DocenteHorario, GrupoHorario, CustomUacHorario } from "@/lib/horarios/types";

export interface ModalDividirData {
  grupo: GrupoHorario;
  uac: CustomUacHorario;
  horasTotalOriginal: number;
  horasA: number;
  horasB: number;
  nombreA: string;
  nombreB: string;
  abrevA: string;
  abrevB: string;
}

export interface ModalEditarNombreData {
  grupo: GrupoHorario;
  uac: CustomUacHorario;
  nuevoNombre: string;
  nuevaAbrev: string;
}

export interface ModalAgregarUacData {
  grupo: GrupoHorario;
  nombre: string;
  abrev: string;
  horas: number;
  tipo: string;
}

export interface HorariosModalesProps {
  mostrarModalDocente: boolean;
  setMostrarModalDocente: (v: boolean) => void;
  tabModalDocente: "PLATAFORMA" | "MANUAL" | "EXCEL";
  setTabModalDocente: (v: "PLATAFORMA" | "MANUAL" | "EXCEL") => void;
  busquedaPersonal: string;
  setBusquedaPersonal: (v: string) => void;
  personalDisponibleModal: DocenteHorario[];
  personalNoAgregado: DocenteHorario[];
  personalPlataforma: DocenteHorario[];
  handleAgregarPersonalExistente: (p: DocenteHorario) => void;
  nuevoDocenteNombre: string;
  setNuevoDocenteNombre: (v: string) => void;
  nuevoDocentePaterno: string;
  setNuevoDocentePaterno: (v: string) => void;
  nuevoDocenteMaterno: string;
  setNuevoDocenteMaterno: (v: string) => void;
  nuevoDocenteCargo: string;
  setNuevoDocenteCargo: (v: string) => void;
  nuevoDocenteHoras: number;
  setNuevoDocenteHoras: (v: number) => void;
  nuevoDocenteEmail: string;
  setNuevoDocenteEmail: (v: string) => void;
  handleCrearNuevoDocenteManual: () => void;
  fileInputHorariosRef: React.RefObject<HTMLInputElement | null>;
  handleCargarArchivoExcelHorarios: (e: React.ChangeEvent<HTMLInputElement>) => void;
  archivoExcelHorarios: File | null;
  setArchivoExcelHorarios: (f: File | null) => void;
  cargandoExcelHorarios: boolean;
  docentesParseadosHorarios: DocenteImportado[];
  setDocentesParseadosHorarios: React.Dispatch<React.SetStateAction<DocenteImportado[]>>;
  handleImportarExcelEnHorarios: () => void;
  mostrarModalMatrizExcel: boolean;
  setMostrarModalMatrizExcel: (v: boolean) => void;
  fileInputMatrizRef: React.RefObject<HTMLInputElement | null>;
  handleCargarArchivoMatrizExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  archivoMatrizExcel: File | null;
  setArchivoMatrizExcel: (f: File | null) => void;
  cargandoMatrizExcel: boolean;
  resultadoParseoMatriz: ResultadoParseoMatriz | null;
  setResultadoParseoMatriz: (v: ResultadoParseoMatriz | null) => void;
  handleConfirmarImportacionMatriz: () => void;
  modalDividir: ModalDividirData | null;
  setModalDividir: (v: ModalDividirData | null) => void;
  handleConfirmarDivisionUAC: (grupo: GrupoHorario, uac: CustomUacHorario, hA: number, hB: number, nomA: string, nomB: string, abrA: string, abrB: string) => void;
  modalEditarNombre: ModalEditarNombreData | null;
  setModalEditarNombre: (v: ModalEditarNombreData | null) => void;
  handleConfirmarRenombrarUAC: (grupo: GrupoHorario, uacId: string, nuevoNombre: string, nuevaAbrev: string) => void;
  modalAgregarUac: ModalAgregarUacData | null;
  setModalAgregarUac: (v: ModalAgregarUacData | null) => void;
  handleConfirmarAgregarUAC: (grupo: GrupoHorario, nombre: string, abrev: string, horas: number, tipo: string) => void;
  grupos: GrupoHorario[];
  periodoActivo: "A" | "B";
  getUACsIndividualesGrupo: (g: GrupoHorario) => CustomUacHorario[];
  docentes: DocenteHorario[];
  loading: boolean;
}

export default function HorariosModales({
  mostrarModalDocente,
  setMostrarModalDocente,
  tabModalDocente,
  setTabModalDocente,
  busquedaPersonal,
  setBusquedaPersonal,
  personalDisponibleModal,
  personalNoAgregado,
  personalPlataforma,
  handleAgregarPersonalExistente,
  nuevoDocenteNombre,
  setNuevoDocenteNombre,
  nuevoDocentePaterno,
  setNuevoDocentePaterno,
  nuevoDocenteMaterno,
  setNuevoDocenteMaterno,
  nuevoDocenteCargo,
  setNuevoDocenteCargo,
  nuevoDocenteHoras,
  setNuevoDocenteHoras,
  nuevoDocenteEmail,
  setNuevoDocenteEmail,
  handleCrearNuevoDocenteManual,
  fileInputHorariosRef,
  handleCargarArchivoExcelHorarios,
  archivoExcelHorarios,
  setArchivoExcelHorarios,
  cargandoExcelHorarios,
  docentesParseadosHorarios,
  setDocentesParseadosHorarios,
  handleImportarExcelEnHorarios,
  mostrarModalMatrizExcel,
  setMostrarModalMatrizExcel,
  fileInputMatrizRef,
  handleCargarArchivoMatrizExcel,
  archivoMatrizExcel,
  setArchivoMatrizExcel,
  cargandoMatrizExcel,
  resultadoParseoMatriz,
  setResultadoParseoMatriz,
  handleConfirmarImportacionMatriz,
  modalDividir,
  setModalDividir,
  handleConfirmarDivisionUAC,
  modalEditarNombre,
  setModalEditarNombre,
  handleConfirmarRenombrarUAC,
  modalAgregarUac,
  setModalAgregarUac,
  handleConfirmarAgregarUAC,
  grupos,
  periodoActivo,
  getUACsIndividualesGrupo,
  docentes,
  loading,
}: HorariosModalesProps) {
  return (
    <>
      {/* MODAL: AGREGAR DOCENTE / PERSONAL */}
      {mostrarModalDocente && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#0f172a", borderRadius: "16px", padding: "1.5rem", maxWidth: tabModalDocente === "EXCEL" ? "680px" : "540px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", border: "1px solid #334155" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                Agregar Personal a la Plantilla Horaria
              </h3>
              <button
                onClick={() => setMostrarModalDocente(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", borderBottom: "1px solid #334155", marginBottom: "1.25rem", gap: "4px" }}>
              <button
                type="button"
                onClick={() => setTabModalDocente("PLATAFORMA")}
                style={{
                  flex: 1,
                  padding: "0.5rem 0.25rem",
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  border: "none",
                  background: "none",
                  borderBottom: tabModalDocente === "PLATAFORMA" ? "3px solid #38bdf8" : "none",
                  color: tabModalDocente === "PLATAFORMA" ? "#38bdf8" : "#94a3b8",
                  cursor: "pointer"
                }}
              >
                1. Registrados ({personalNoAgregado.length})
              </button>
              <button
                type="button"
                onClick={() => setTabModalDocente("MANUAL")}
                style={{
                  flex: 1,
                  padding: "0.5rem 0.25rem",
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  border: "none",
                  background: "none",
                  borderBottom: tabModalDocente === "MANUAL" ? "3px solid #38bdf8" : "none",
                  color: tabModalDocente === "MANUAL" ? "#38bdf8" : "#94a3b8",
                  cursor: "pointer"
                }}
              >
                2. Nuevo Manual
              </button>
              <button
                type="button"
                onClick={() => setTabModalDocente("EXCEL")}
                style={{
                  flex: 1,
                  padding: "0.5rem 0.25rem",
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  border: "none",
                  background: "none",
                  borderBottom: tabModalDocente === "EXCEL" ? "3px solid #10b981" : "none",
                  color: tabModalDocente === "EXCEL" ? "#34d399" : "#94a3b8",
                  cursor: "pointer"
                }}
              >
                3. 📥 Cargar Excel / CSV
              </button>
            </div>

            {tabModalDocente === "PLATAFORMA" ? (
              <div>
                <div style={{ position: "relative", marginBottom: "0.85rem" }}>
                  <Search style={{ width: "16px", height: "16px", position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o cargo (Docente, Administrativo...)..."
                    value={busquedaPersonal}
                    onChange={(e) => setBusquedaPersonal(e.target.value)}
                    style={{ width: "100%", padding: "0.45rem 0.6rem 0.45rem 2.2rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.8125rem" }}
                  />
                </div>

                <div style={{ maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", paddingRight: "0.25rem" }}>
                  {personalDisponibleModal.length === 0 ? (
                    <div style={{ padding: "1.25rem", textAlign: "center", background: "#1e293b", borderRadius: "10px", border: "1px solid #334155" }}>
                      <p style={{ fontSize: "0.8125rem", color: "#94a3b8", margin: 0, fontWeight: 600 }}>
                        {personalPlataforma.length === 0
                          ? "Cargando personal registrado de la escuela..."
                          : personalNoAgregado.length === 0
                          ? "Todo el personal registrado ya forma parte de la plantilla del Paso 2. Puedes registrar nuevo personal en '2. Nuevo Manual' o en '3. Cargar Excel'."
                          : "No se encontró personal coincidente con el filtro."}
                      </p>
                    </div>
                  ) : (
                    personalDisponibleModal.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.75rem", border: "1px solid #334155", borderRadius: "8px", background: "#1e293b" }}>
                        <div>
                          <p style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                            {p.apellidoPaterno} {p.apellidoMaterno || ""} {p.nombre}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "2px" }}>
                            <span style={{ fontSize: "0.6875rem", color: p.cargo === "DOCENTE" ? "#60a5fa" : "#fbbf24", fontWeight: 700 }}>
                              {p.cargo || "DOCENTE"}
                            </span>
                            {p.horas_base !== undefined && (
                              <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>
                                • {p.horas_base} hrs base
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAgregarPersonalExistente(p)}
                          style={{ background: "#2563eb", color: "#ffffff", padding: "0.35rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, border: "none", cursor: "pointer" }}
                        >
                          + Agregar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : tabModalDocente === "MANUAL" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Nombre(s) *</label>
                  <input
                    type="text"
                    placeholder="Ej. Juan Manuel"
                    value={nuevoDocenteNombre}
                    onChange={(e) => setNuevoDocenteNombre(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem", fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Apellido Paterno *</label>
                    <input
                      type="text"
                      placeholder="Ej. Pérez"
                      value={nuevoDocentePaterno}
                      onChange={(e) => setNuevoDocentePaterno(e.target.value)}
                      style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem", fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Apellido Materno</label>
                    <input
                      type="text"
                      placeholder="Ej. Gómez"
                      value={nuevoDocenteMaterno}
                      onChange={(e) => setNuevoDocenteMaterno(e.target.value)}
                      style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem", fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Cargo / Rol *</label>
                    <select
                      value={nuevoDocenteCargo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNuevoDocenteCargo(val);
                        if (val !== "DOCENTE" && nuevoDocenteHoras === 20) {
                          setNuevoDocenteHoras(0);
                        } else if (val === "DOCENTE" && nuevoDocenteHoras === 0) {
                          setNuevoDocenteHoras(20);
                        }
                      }}
                      style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem", fontWeight: 700 }}
                    >
                      <option value="DOCENTE">Docente</option>
                      <option value="DIRECTIVO">Directivo</option>
                      <option value="PREFECTO">Prefecto</option>
                      <option value="ORIENTADOR">Orientador</option>
                      <option value="ADMINISTRATIVO">Administrativo</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Horas Frente a Grupo</label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={nuevoDocenteHoras}
                      onChange={(e) => setNuevoDocenteHoras(Number(e.target.value))}
                      style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "2px solid #3b82f6", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem", fontWeight: 800 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Email Institucional (Opcional)</label>
                  <input
                    type="email"
                    placeholder="docente@escuela.edu.mx"
                    value={nuevoDocenteEmail}
                    onChange={(e) => setNuevoDocenteEmail(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setMostrarModalDocente(false)}
                    style={{ background: "#334155", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCrearNuevoDocenteManual}
                    style={{ background: "#2563eb", color: "#ffffff", padding: "0.5rem 1.25rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
                  >
                    Guardar Personal
                  </button>
                </div>
              </div>
            ) : (
              /* TAB 3: IMPORTAR EXCEL */
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ border: "2px dashed #475569", borderRadius: "12px", padding: "1.25rem", textAlign: "center", background: "#1e293b" }}>
                  <input
                    ref={fileInputHorariosRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleCargarArchivoExcelHorarios}
                    style={{ display: "none" }}
                    id="excel-horarios-input"
                  />
                  <div style={{ fontSize: "2rem", marginBottom: "0.35rem" }}>📑</div>
                  <p style={{ color: "#ffffff", fontWeight: 700, margin: "0 0 0.25rem", fontSize: "0.875rem" }}>
                    {archivoExcelHorarios ? archivoExcelHorarios.name : "Seleccione su archivo Excel (.xlsx, .xls) o CSV"}
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 0.75rem" }}>
                    Columnas detectadas: Nombre, Apellidos, Cargo/Rol, Horas Base y Email.
                  </p>

                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => fileInputHorariosRef.current?.click()}
                      style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "0.45rem 0.85rem", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      📁 {archivoExcelHorarios ? "Cambiar Archivo" : "Seleccionar Archivo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => descargarPlantillaExcelDocentes()}
                      style={{ background: "#334155", color: "#38bdf8", border: "1px solid #475569", padding: "0.45rem 0.85rem", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      ⬇️ Descargar Formato
                    </button>
                  </div>
                </div>

                {cargandoExcelHorarios && (
                  <div style={{ textAlign: "center", color: "#38bdf8", fontSize: "0.8rem", fontWeight: 700 }}>
                    ⏳ Analizando hoja de cálculo...
                  </div>
                )}

                {docentesParseadosHorarios.length > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ffffff" }}>
                        Previsualización ({docentesParseadosHorarios.filter(d => d.valido).length} listos de {docentesParseadosHorarios.length})
                      </span>
                    </div>

                    <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #334155", borderRadius: "6px", background: "#1e293b" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                        <thead>
                          <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
                            <th style={{ padding: "0.35rem 0.5rem", textAlign: "left", color: "#94a3b8" }}>#</th>
                            <th style={{ padding: "0.35rem 0.5rem", textAlign: "left", color: "#94a3b8" }}>Nombre</th>
                            <th style={{ padding: "0.35rem 0.5rem", textAlign: "left", color: "#94a3b8" }}>Cargo</th>
                            <th style={{ padding: "0.35rem 0.5rem", textAlign: "center", color: "#94a3b8" }}>Horas</th>
                            <th style={{ padding: "0.35rem 0.5rem", textAlign: "center", color: "#94a3b8" }}>Estatus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docentesParseadosHorarios.map((d, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #334155", background: !d.valido ? "rgba(239,68,68,0.1)" : "transparent" }}>
                              <td style={{ padding: "0.35rem 0.5rem", color: "#64748b" }}>{i + 1}</td>
                              <td style={{ padding: "0.35rem 0.5rem", color: "#ffffff", fontWeight: 700 }}>
                                {d.apellidoPaterno} {d.apellidoMaterno} {d.nombre}
                              </td>
                              <td style={{ padding: "0.35rem 0.5rem", color: d.cargo === "DOCENTE" ? "#60a5fa" : "#fbbf24" }}>
                                {d.cargo}
                              </td>
                              <td style={{ padding: "0.35rem 0.5rem", textAlign: "center", color: "#4ade80", fontWeight: 700 }}>
                                {d.horasBase}h
                              </td>
                              <td style={{ padding: "0.35rem 0.5rem", textAlign: "center" }}>
                                {d.valido ? <span style={{ color: "#4ade80", fontWeight: 800 }}>✓ Listo</span> : <span style={{ color: "#f87171" }}>⚠️ Incompleto</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0 && (
                  <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: "8px", padding: "0.6rem 0.85rem", color: "#86efac", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>📑</span>
                    <div>
                      <strong>¡Libro Integral Detectado!</strong> Se detectó también la hoja de <strong>Matriz de Horarios</strong> con {resultadoParseoMatriz.resumen.asignadasConExito} asignaciones para {resultadoParseoMatriz.gruposDetectados.length} grupo(s). Al confirmar, se importará el personal y se preparará la matriz de horarios automáticamente.
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarModalDocente(false);
                      setArchivoExcelHorarios(null);
                      setDocentesParseadosHorarios([]);
                    }}
                    style={{ background: "#334155", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleImportarExcelEnHorarios}
                    disabled={docentesParseadosHorarios.filter(d => d.valido).length === 0}
                    style={{
                      background: docentesParseadosHorarios.filter(d => d.valido).length === 0 ? "#334155" : "#10b981",
                      color: "#ffffff",
                      padding: "0.5rem 1.25rem",
                      borderRadius: "8px",
                      fontWeight: 800,
                      border: "none",
                      cursor: docentesParseadosHorarios.filter(d => d.valido).length === 0 ? "not-allowed" : "pointer"
                    }}
                  >
                    {resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0 ? "Confirmar e Importar Libro Completo" : "Confirmar e Importar a Plantilla"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CARGAR MATRIZ HORARIA DESDE EXCEL */}
      {mostrarModalMatrizExcel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#0f172a", borderRadius: "16px", padding: "1.5rem", maxWidth: "780px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", border: "1px solid #334155" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileSpreadsheet style={{ width: "22px", height: "22px", color: "#10b981" }} />
                <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                  Cargar Horario y Matriz de Asignación desde Excel
                </h3>
              </div>
              <button
                onClick={() => {
                  setMostrarModalMatrizExcel(false);
                  setArchivoMatrizExcel(null);
                  setResultadoParseoMatriz(null);
                }}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Dropzone / File input */}
              <div style={{ border: "2px dashed #475569", borderRadius: "12px", padding: "1.25rem", textAlign: "center", background: "#1e293b" }}>
                <input
                  ref={fileInputMatrizRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleCargarArchivoMatrizExcel}
                  style={{ display: "none" }}
                  id="excel-matriz-input"
                />
                <div style={{ fontSize: "2.25rem", marginBottom: "0.35rem" }}>📑</div>
                <p style={{ color: "#ffffff", fontWeight: 700, margin: "0 0 0.25rem", fontSize: "0.9375rem" }}>
                  {archivoMatrizExcel ? archivoMatrizExcel.name : "Seleccione su archivo Excel con la tabla de horarios"}
                </p>
                <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 0.85rem" }}>
                  Formato compatible: Columnas con los nombres de grupos (ej: 1A, 1B, 1C, 2A, 3A...) y nombres de docentes en las celdas.
                </p>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => fileInputMatrizRef.current?.click()}
                    style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer" }}
                  >
                    📁 {archivoMatrizExcel ? "Cambiar Archivo" : "Seleccionar Archivo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
                      descargarPlantillaIntegralHorarios(gruposDelPeriodoActual, periodoActivo, getUACsIndividualesGrupo, docentes);
                    }}
                    style={{ background: "#334155", color: "#38bdf8", border: "1px solid #475569", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer" }}
                  >
                    ⬇️ Descargar Plantilla Integral
                  </button>
                </div>
              </div>

              {cargandoMatrizExcel && (
                <div style={{ textAlign: "center", color: "#38bdf8", fontSize: "0.875rem", fontWeight: 700, padding: "1rem" }}>
                  ⏳ Analizando tabla de horarios y asociando docentes...
                </div>
              )}

              {/* Previsualización de Cargas Encontradas */}
              {resultadoParseoMatriz && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Banner de resumen */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem" }}>
                    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "0.5rem 0.75rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.6875rem", color: "#94a3b8", fontWeight: 700, display: "block" }}>Grupos Detectados</span>
                      <strong style={{ fontSize: "1rem", color: "#38bdf8" }}>{resultadoParseoMatriz.gruposDetectados.length}</strong>
                    </div>
                    <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", padding: "0.5rem 0.75rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.6875rem", color: "#86efac", fontWeight: 700, display: "block" }}>Asignadas con Éxito</span>
                      <strong style={{ fontSize: "1rem", color: "#4ade80" }}>{resultadoParseoMatriz.resumen.asignadasConExito}</strong>
                    </div>
                    <div style={{ background: resultadoParseoMatriz.resumen.requierenRevision > 0 ? "rgba(245,158,11,0.1)" : "#1e293b", border: "1px solid " + (resultadoParseoMatriz.resumen.requierenRevision > 0 ? "rgba(245,158,11,0.3)" : "#334155"), borderRadius: "8px", padding: "0.5rem 0.75rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.6875rem", color: "#fcd34d", fontWeight: 700, display: "block" }}>Docente No Reconocido</span>
                      <strong style={{ fontSize: "1rem", color: resultadoParseoMatriz.resumen.requierenRevision > 0 ? "#fbbf24" : "#94a3b8" }}>{resultadoParseoMatriz.resumen.requierenRevision}</strong>
                    </div>
                  </div>

                  {docentesParseadosHorarios.filter(d => d.valido).length > 0 && (
                    <div style={{ background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.4)", borderRadius: "8px", padding: "0.5rem 0.85rem", color: "#7dd3fc", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>👥</span>
                      <div>
                        <strong>Personal Detectado en Libro:</strong> Se sincronizarán {docentesParseadosHorarios.filter(d => d.valido).length} docentes del archivo con el catálogo de su escuela.
                      </div>
                    </div>
                  )}

                  <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid #334155", borderRadius: "8px", background: "#1e293b" }}>
                    {resultadoParseoMatriz.cargas.length > 0 ? (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                        <thead>
                          <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", position: "sticky", top: 0 }}>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Grupo</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Materia (UAC)</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Texto en Excel</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Docente Asociado</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: "#94a3b8" }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadoParseoMatriz.cargas.map((c: CargaImportada, i: number) => (
                            <tr key={i} style={{ borderBottom: "1px solid #334155", background: c.valido ? "transparent" : "rgba(245,158,11,0.08)" }}>
                              <td style={{ padding: "0.35rem 0.6rem", color: "#38bdf8", fontWeight: 800 }}>{c.grupoNombre}</td>
                              <td style={{ padding: "0.35rem 0.6rem", color: "#ffffff", fontWeight: 600 }}>{c.uacName}</td>
                              <td style={{ padding: "0.35rem 0.6rem", color: "#94a3b8" }}>{c.docenteTextoExcel}</td>
                              <td style={{ padding: "0.35rem 0.6rem", color: c.valido ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                                {c.docenteNombreMatch || "No encontrado"}
                              </td>
                              <td style={{ padding: "0.35rem 0.6rem", textAlign: "center" }}>
                                {c.valido ? (
                                  <span style={{ color: "#4ade80", fontWeight: 800 }}>✓ Listo</span>
                                ) : (
                                  <span style={{ color: "#fbbf24", fontSize: "0.6875rem" }}>⚠️ Sin coincidencia</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : docentesParseadosHorarios.length > 0 ? (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                        <thead>
                          <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", position: "sticky", top: 0 }}>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>#</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Nombre Docente / Directivo</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Cargo</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: "#94a3b8" }}>Horas</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: "#94a3b8" }}>Estatus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docentesParseadosHorarios.map((d, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #334155" }}>
                              <td style={{ padding: "0.35rem 0.6rem", color: "#64748b" }}>{i + 1}</td>
                              <td style={{ padding: "0.35rem 0.6rem", color: "#ffffff", fontWeight: 700 }}>
                                {d.apellidoPaterno} {d.apellidoMaterno} {d.nombre}
                              </td>
                              <td style={{ padding: "0.35rem 0.6rem", color: d.cargo === "DOCENTE" ? "#60a5fa" : "#fbbf24" }}>
                                {d.cargo}
                              </td>
                              <td style={{ padding: "0.35rem 0.6rem", textAlign: "center", color: "#4ade80", fontWeight: 700 }}>
                                {d.horasBase}h
                              </td>
                              <td style={{ padding: "0.35rem 0.6rem", textAlign: "center" }}>
                                {d.valido ? <span style={{ color: "#4ade80", fontWeight: 800 }}>✓ Listo</span> : <span style={{ color: "#f87171" }}>⚠️ Incompleto</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8125rem" }}>
                        No se detectaron asignaciones en la matriz ni registros de personal.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalMatrizExcel(false);
                    setArchivoMatrizExcel(null);
                    setResultadoParseoMatriz(null);
                    setDocentesParseadosHorarios([]);
                  }}
                  style={{ background: "#334155", color: "#ffffff", padding: "0.5rem 1.1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarImportacionMatriz}
                  disabled={
                    loading ||
                    (!docentesParseadosHorarios.some(d => d.valido) && (!resultadoParseoMatriz || resultadoParseoMatriz.cargas.length === 0))
                  }
                  style={{
                    background: (loading || (!docentesParseadosHorarios.some(d => d.valido) && (!resultadoParseoMatriz || resultadoParseoMatriz.cargas.length === 0))) ? "#334155" : "#10b981",
                    color: "#ffffff",
                    padding: "0.5rem 1.4rem",
                    borderRadius: "8px",
                    fontWeight: 800,
                    border: "none",
                    cursor: (loading || (!docentesParseadosHorarios.some(d => d.valido) && (!resultadoParseoMatriz || resultadoParseoMatriz.cargas.length === 0))) ? "not-allowed" : "pointer"
                  }}
                >
                  {loading ? "Procesando..." : (resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0) ? "Confirmar e Importar a Matriz" : "Confirmar e Importar Personal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Dividir Asignatura en 2 Partes (Parte A y B para distintos docentes) */}
      {modalDividir && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem"
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                background: "#1e293b",
                padding: "1rem 1.25rem",
                borderBottom: "1px solid #334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>✂️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#f8fafc" }}>
                    Dividir Asignatura en 2 Partes
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Grupo {modalDividir.grupo.nombre} • Total original: {modalDividir.horasTotalOriginal} horas semanales
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDividir(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "8px", padding: "0.75rem", fontSize: "0.78rem", color: "#bae6fd", lineHeight: 1.4 }}>
                💡 <strong>Asignación independiente:</strong> Esta acción dividirá <em>&quot;{modalDividir.uac.uacName}&quot;</em> en dos bloques independientes para poder asignar dos docentes diferentes. Las horas totales del grupo se mantienen idénticas.
              </div>

              {/* Parte A */}
              <div style={{ background: "#1e293b", padding: "0.85rem", borderRadius: "10px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#38bdf8", marginBottom: "0.5rem" }}>
                  🔹 Parte A
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: "0.5rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.2rem", fontWeight: 700 }}>
                      Nombre de la Parte A:
                    </label>
                    <input
                      type="text"
                      value={modalDividir.nombreA}
                      onChange={(e) => setModalDividir({ ...modalDividir, nombreA: e.target.value })}
                      style={{ width: "100%", padding: "0.45rem 0.6rem", background: "#0f172a", border: "1px solid #475569", borderRadius: "6px", color: "#ffffff", fontSize: "0.8rem", fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.2rem", fontWeight: 700 }}>
                      Horas:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={modalDividir.horasTotalOriginal - 1}
                      value={modalDividir.horasA}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        const complemento = Math.max(1, modalDividir.horasTotalOriginal - val);
                        setModalDividir({
                          ...modalDividir,
                          horasA: val,
                          horasB: complemento
                        });
                      }}
                      style={{ width: "100%", padding: "0.45rem 0.6rem", background: "#0f172a", border: "1px solid #475569", borderRadius: "6px", color: "#38bdf8", fontSize: "0.85rem", fontWeight: 800, textAlign: "center" }}
                    />
                  </div>
                </div>
              </div>

              {/* Parte B */}
              <div style={{ background: "#1e293b", padding: "0.85rem", borderRadius: "10px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#a855f7", marginBottom: "0.5rem" }}>
                  🟣 Parte B
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: "0.5rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.2rem", fontWeight: 700 }}>
                      Nombre de la Parte B:
                    </label>
                    <input
                      type="text"
                      value={modalDividir.nombreB}
                      onChange={(e) => setModalDividir({ ...modalDividir, nombreB: e.target.value })}
                      style={{ width: "100%", padding: "0.45rem 0.6rem", background: "#0f172a", border: "1px solid #475569", borderRadius: "6px", color: "#ffffff", fontSize: "0.8rem", fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.2rem", fontWeight: 700 }}>
                      Horas:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={modalDividir.horasTotalOriginal - 1}
                      value={modalDividir.horasB}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        const complemento = Math.max(1, modalDividir.horasTotalOriginal - val);
                        setModalDividir({
                          ...modalDividir,
                          horasB: val,
                          horasA: complemento
                        });
                      }}
                      style={{ width: "100%", padding: "0.45rem 0.6rem", background: "#0f172a", border: "1px solid #475569", borderRadius: "6px", color: "#a855f7", fontSize: "0.85rem", fontWeight: 800, textAlign: "center" }}
                    />
                  </div>
                </div>
              </div>

              {/* Verificación de suma */}
              {modalDividir.horasA + modalDividir.horasB !== modalDividir.horasTotalOriginal ? (
                <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "8px", padding: "0.6rem 0.8rem", fontSize: "0.75rem", color: "#fca5a5" }}>
                  ⚠️ La suma de horas es {modalDividir.horasA + modalDividir.horasB}h, pero debe sumar exactamente {modalDividir.horasTotalOriginal}h.
                </div>
              ) : (
                <div style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "8px", padding: "0.6rem 0.8rem", fontSize: "0.75rem", color: "#86efac", display: "flex", justifyContent: "space-between" }}>
                  <span>✓ Reparto exacto: {modalDividir.horasA}h + {modalDividir.horasB}h</span>
                  <strong>Total: {modalDividir.horasTotalOriginal}h</strong>
                </div>
              )}
            </div>

            <div style={{ background: "#1e293b", padding: "0.85rem 1.25rem", borderTop: "1px solid #334155", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                onClick={() => setModalDividir(null)}
                style={{ background: "#334155", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer", fontSize: "0.8125rem" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={modalDividir.horasA + modalDividir.horasB !== modalDividir.horasTotalOriginal || !modalDividir.nombreA.trim() || !modalDividir.nombreB.trim()}
                onClick={() => handleConfirmarDivisionUAC(
                  modalDividir.grupo,
                  modalDividir.uac,
                  modalDividir.horasA,
                  modalDividir.horasB,
                  modalDividir.nombreA,
                  modalDividir.nombreB,
                  modalDividir.abrevA,
                  modalDividir.abrevB
                )}
                style={{
                  background: (modalDividir.horasA + modalDividir.horasB === modalDividir.horasTotalOriginal && modalDividir.nombreA.trim() && modalDividir.nombreB.trim()) ? "#0284c7" : "#475569",
                  color: "#ffffff",
                  padding: "0.5rem 1.3rem",
                  borderRadius: "8px",
                  fontWeight: 800,
                  border: "none",
                  cursor: (modalDividir.horasA + modalDividir.horasB === modalDividir.horasTotalOriginal && modalDividir.nombreA.trim() && modalDividir.nombreB.trim()) ? "pointer" : "not-allowed",
                  fontSize: "0.8125rem"
                }}
              >
                Confirmar División
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Editar Nombre de Asignatura */}
      {modalEditarNombre && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem"
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                background: "#1e293b",
                padding: "1rem 1.25rem",
                borderBottom: "1px solid #334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#f8fafc" }}>
                ✏️ Editar Nombre de Asignatura
              </h3>
              <button
                type="button"
                onClick={() => setModalEditarNombre(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.3rem", fontWeight: 700 }}>
                  Nombre de la Asignatura / UAC:
                </label>
                <input
                  type="text"
                  value={modalEditarNombre.nuevoNombre}
                  onChange={(e) => setModalEditarNombre({ ...modalEditarNombre, nuevoNombre: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", background: "#1e293b", border: "1px solid #475569", borderRadius: "8px", color: "#ffffff", fontSize: "0.85rem", fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.3rem", fontWeight: 700 }}>
                  Abreviatura / Código:
                </label>
                <input
                  type="text"
                  value={modalEditarNombre.nuevaAbrev}
                  onChange={(e) => setModalEditarNombre({ ...modalEditarNombre, nuevaAbrev: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", background: "#1e293b", border: "1px solid #475569", borderRadius: "8px", color: "#38bdf8", fontSize: "0.85rem", fontWeight: 700 }}
                />
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "0.85rem 1.25rem", borderTop: "1px solid #334155", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                onClick={() => setModalEditarNombre(null)}
                style={{ background: "#334155", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer", fontSize: "0.8125rem" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!modalEditarNombre.nuevoNombre.trim()}
                onClick={() => handleConfirmarRenombrarUAC(
                  modalEditarNombre.grupo,
                  modalEditarNombre.uac.id || "",
                  modalEditarNombre.nuevoNombre,
                  modalEditarNombre.nuevaAbrev
                )}
                style={{ background: "#10b981", color: "#ffffff", padding: "0.5rem 1.3rem", borderRadius: "8px", fontWeight: 800, border: "none", cursor: "pointer", fontSize: "0.8125rem" }}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Agregar Asignatura al Grupo */}
      {modalAgregarUac && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem"
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                background: "#1e293b",
                padding: "1rem 1.25rem",
                borderBottom: "1px solid #334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#f8fafc" }}>
                  ➕ Agregar Asignatura al Grupo
                </h3>
                <span style={{ fontSize: "0.75rem", color: "#38bdf8" }}>
                  Grupo {modalAgregarUac.grupo.nombre} ({modalAgregarUac.grupo.semestre}° Semestre)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalAgregarUac(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.3rem", fontWeight: 700 }}>
                  Nombre de la Asignatura / UAC:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Taller Especial de Contabilidad"
                  value={modalAgregarUac.nombre}
                  onChange={(e) => setModalAgregarUac({ ...modalAgregarUac, nombre: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", background: "#1e293b", border: "1px solid #475569", borderRadius: "8px", color: "#ffffff", fontSize: "0.85rem", fontWeight: 600 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.3rem", fontWeight: 700 }}>
                    Abreviatura:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: TALL-CONT"
                    value={modalAgregarUac.abrev}
                    onChange={(e) => setModalAgregarUac({ ...modalAgregarUac, abrev: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", background: "#1e293b", border: "1px solid #475569", borderRadius: "8px", color: "#38bdf8", fontSize: "0.85rem", fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.3rem", fontWeight: 700 }}>
                    Horas/Sem:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={modalAgregarUac.horas}
                    onChange={(e) => setModalAgregarUac({ ...modalAgregarUac, horas: parseInt(e.target.value, 10) || 1 })}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", background: "#1e293b", border: "1px solid #475569", borderRadius: "8px", color: "#38bdf8", fontSize: "0.85rem", fontWeight: 800, textAlign: "center" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.3rem", fontWeight: 700 }}>
                  Tipo / Categoría:
                </label>
                <select
                  value={modalAgregarUac.tipo}
                  onChange={(e) => setModalAgregarUac({ ...modalAgregarUac, tipo: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", background: "#1e293b", border: "1px solid #475569", borderRadius: "8px", color: "#cbd5e1", fontSize: "0.85rem", fontWeight: 600 }}
                >
                  <option value="MODULAR">Formación Técnica / Modular</option>
                  <option value="UNIVERSAL">Fundamental / Universal</option>
                  <option value="PROPEDUTICA">Propedéutica</option>
                  <option value="LABORAL">Formación Laboral</option>
                  <option value="AMPLIADO">Currículum Ampliado (FFEO)</option>
                  <option value="CUSTOM">Personalizada / Taller</option>
                </select>
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "0.85rem 1.25rem", borderTop: "1px solid #334155", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                onClick={() => setModalAgregarUac(null)}
                style={{ background: "#334155", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer", fontSize: "0.8125rem" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!modalAgregarUac.nombre.trim()}
                onClick={() => handleConfirmarAgregarUAC(
                  modalAgregarUac.grupo,
                  modalAgregarUac.nombre,
                  modalAgregarUac.abrev,
                  modalAgregarUac.horas,
                  modalAgregarUac.tipo
                )}
                style={{ background: "#0284c7", color: "#ffffff", padding: "0.5rem 1.3rem", borderRadius: "8px", fontWeight: 800, border: "none", cursor: "pointer", fontSize: "0.8125rem" }}
              >
                Agregar Asignatura
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
