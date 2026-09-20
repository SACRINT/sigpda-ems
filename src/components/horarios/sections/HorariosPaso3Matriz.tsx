"use client";

import React from "react";
import { BookOpen, AlertTriangle, FileSpreadsheet, Download } from "lucide-react";
import { descargarPlantillaIntegralHorarios } from "@/lib/excel-matriz";
import type { DocenteHorario, GrupoHorario, CustomUacHorario } from "@/lib/horarios/types";
import type { CarreraTecnica } from "@/lib/bt-carreras-catalog";

export interface HorariosPaso3MatrizProps {
  horasRequeridasPlantel: number;
  totalHorasAsignadasMatriz: number;
  setMostrarModalMatrizExcel: (v: boolean) => void;
  gruposDelPeriodoActual: GrupoHorario[];
  carrerasTecnologicas: CarreraTecnica[];
  esTecnologico: boolean;
  abrirModalAgregarUac: (grupo: GrupoHorario) => void;
  handleRestaurarUACsOficiales: (grupo: GrupoHorario) => void;
  getUACsIndividualesGrupo: (grupo: GrupoHorario) => CustomUacHorario[];
  getCustomUacsDeGrupo: (grupo: GrupoHorario) => CustomUacHorario[] | null;
  getDocenteAsignado: (grupoId: string, uac: CustomUacHorario) => string;
  handleAsignarDocenteMatriz: (grupoId: string, uac: CustomUacHorario, docenteId: string) => void;
  docentesAptosParaHorario: DocenteHorario[];
  getHorasConsumidasDocente: (docenteId: string, excludeGrupoId?: string, excludeUacId?: string) => number;
  horasDocentes: Record<string, number>;
  handleCambiarHorasUAC: (grupo: GrupoHorario, uacId: string, nuevasHoras: number) => void;
  abrirModalDividir: (grupo: GrupoHorario, uac: CustomUacHorario) => void;
  abrirModalEditarNombre: (grupo: GrupoHorario, uac: CustomUacHorario) => void;
  handleEliminarUAC: (grupo: GrupoHorario, uacId: string) => void;
  setPaso: (paso: number) => void;
  loading: boolean;
  handleGuardarConfiguracion: () => void;
  grupos: GrupoHorario[];
  periodoActivo: "A" | "B";
  docentes: DocenteHorario[];
}

export default function HorariosPaso3Matriz({
  horasRequeridasPlantel,
  totalHorasAsignadasMatriz,
  setMostrarModalMatrizExcel,
  gruposDelPeriodoActual,
  carrerasTecnologicas,
  esTecnologico,
  abrirModalAgregarUac,
  handleRestaurarUACsOficiales,
  getUACsIndividualesGrupo,
  getCustomUacsDeGrupo,
  getDocenteAsignado,
  handleAsignarDocenteMatriz,
  docentesAptosParaHorario,
  getHorasConsumidasDocente,
  horasDocentes,
  handleCambiarHorasUAC,
  abrirModalDividir,
  abrirModalEditarNombre,
  handleEliminarUAC,
  setPaso,
  loading,
  handleGuardarConfiguracion,
  grupos,
  periodoActivo,
  docentes,
}: HorariosPaso3MatrizProps) {
  return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Banner Resumen de Cargas Horarias del Plantel */}
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "1rem 1.25rem", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#ffffff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <BookOpen style={{ width: "20px", height: "20px", color: "#38bdf8" }} /> Matriz de Asignación Docente por Grupo (UACs Específicas)
              </h3>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0.25rem 0 0" }}>
                Seleccione el docente responsable para cada UAC. Las opciones con exceso de horas contratadas se deshabilitan automáticamente.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  descargarPlantillaIntegralHorarios(gruposDelPeriodoActual, periodoActivo, getUACsIndividualesGrupo, docentes);
                }}
                title="Descargar libro de Excel unificado (Personal + Horarios)"
                style={{ background: "#1e293b", color: "#38bdf8", border: "1px solid #0284c7", padding: "0.625rem 0.85rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}
              >
                <Download style={{ width: "15px", height: "15px" }} /> 📑 Plantilla Integral (.xlsx)
              </button>

              <button
                type="button"
                onClick={() => setMostrarModalMatrizExcel(true)}
                title="Subir archivo Excel o CSV con la plantilla docente y horarios"
                style={{ background: "#047857", color: "#ffffff", border: "1px solid #10b981", padding: "0.625rem 1rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}
              >
                <FileSpreadsheet style={{ width: "15px", height: "15px" }} /> 📥 Importar Excel
              </button>

              <div style={{ background: "#0f172a", padding: "0.5rem 1rem", borderRadius: "10px", border: "1px solid #334155", textAlign: "right" }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Horas Asignadas en Matriz</div>
                <div style={{ fontSize: "1.125rem", fontWeight: 900, color: totalHorasAsignadasMatriz === horasRequeridasPlantel ? "#4ade80" : "#38bdf8" }}>
                  {totalHorasAsignadasMatriz} / {horasRequeridasPlantel} hrs
                </div>
              </div>
            </div>
          </div>

          {/* Alertas de Sobrecarga de Docentes */}
          {docentes.some((d) => getHorasConsumidasDocente(d.id) > (horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0))) && (
            <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "10px", padding: "0.85rem 1.25rem", color: "#fca5a5", fontSize: "0.8125rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <AlertTriangle style={{ width: "20px", height: "20px", color: "#ef4444", flexShrink: 0 }} />
              <div>
                <strong>⚠️ Advertencia de Sobre-asignación:</strong> Hay docente(s) que superan las horas contratadas en la plantilla. Ajuste las selecciones resaltadas en rojo para evitar empalmes.
              </div>
            </div>
          )}

          {(periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).map((sem) => {
            const gruposSemestre = grupos.filter((g) => g.semestre === sem);
            if (gruposSemestre.length === 0) return null;

            const labelSem: Record<number, string> = esTecnologico ? {
              1: "1er Semestre (1er Año - 10 UACs Fundamentales - 28 hrs)",
              2: "2do Semestre (1er Año - 10 UACs Fundamentales - 28 hrs)",
              3: "3er Semestre (2º Año - 6 Fundamentales + Módulo II - 39 hrs)",
              4: "4to Semestre (2º Año - 6 Fundamentales + Módulo III - 39 hrs)",
              5: "5to Semestre (3er Año - 5 Fundamentales + Propedéutica + Módulo IV - 35 hrs)",
              6: "6to Semestre (3er Año - 5 Fundamentales + Propedéutica + Módulo V - 35 hrs)"
            } : {
              1: "1er Semestre (1er Año - 10 UACs Universales)",
              2: "2do Semestre (1er Año - 10 UACs Universales)",
              3: "3er Semestre (2º Año - 9 UACs por Grupo)",
              4: "4to Semestre (2º Año - 9 UACs por Grupo)",
              5: "5to Semestre (3er Año - 10 UACs por Grupo)",
              6: "6to Semestre (3er Año - 10 UACs por Grupo)"
            };

            return (
              <div key={sem} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                <div style={{ background: "#0f172a", color: "#ffffff", padding: "0.625rem 1rem", borderRadius: "8px", fontWeight: 800, fontSize: "0.875rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #334155" }}>
                  <span style={{ color: "#38bdf8" }}>{labelSem[sem] || `${sem}° Semestre`}</span>
                  <span style={{ fontSize: "0.75rem", background: "#334155", color: "#e2e8f0", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
                    {gruposSemestre.length} Grupo(s) activo(s)
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
                  {gruposSemestre.map((g) => {
                    const uacsEspecificas = getUACsIndividualesGrupo(g);

                    return (
                      <div key={g.id} style={{ border: "1px solid #334155", borderRadius: "10px", overflow: "hidden", background: "#0f172a", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                        <div style={{ background: "#1e293b", padding: "0.75rem 1rem", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "0.9375rem", fontWeight: 900, color: "#60a5fa" }}>
                            Grupo {g.nombre}
                          </span>
                          {g.carreraTecnicaId ? (
                            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#f59e0b", background: "rgba(245, 158, 11, 0.15)", padding: "0.2rem 0.6rem", borderRadius: "6px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                              {carrerasTecnologicas.find(c => c.id === g.carreraTecnicaId)?.nombre || g.carreraTecnicaId}
                            </span>
                          ) : g.capacitacionNombre ? (
                            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#38bdf8", background: "#0f172a", padding: "0.2rem 0.6rem", borderRadius: "6px", border: "1px solid #334155" }}>
                              {g.capacitacionNombre}
                            </span>
                          ) : null}
                        </div>

                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78125rem" }}>
                          <thead>
                            <tr style={{ background: "#1e293b", borderBottom: "1px solid #334155" }}>
                              <th style={{ padding: "0.5rem 0.625rem", textAlign: "left", fontWeight: 800, color: "#cbd5e1", width: "42%" }}>Materia (UAC)</th>
                              <th style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#38bdf8", width: "16%" }}>Horas</th>
                              <th style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#cbd5e1", width: "26%" }}>Docente Asignado</th>
                              <th style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#cbd5e1", width: "16%" }}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uacsEspecificas.map((uac, uacIdx) => {
                              const docenteActualId = getDocenteAsignado(g.id, uac);
                              const docenteActualObj = docentes.find((d) => d.id === docenteActualId);
                              const hrsConsumidasDocenteActual = docenteActualId ? getHorasConsumidasDocente(docenteActualId, g.id, uac.id) : 0;
                              const hrsMaxDocenteActual = docenteActualId ? (horasDocentes[docenteActualId] !== undefined ? horasDocentes[docenteActualId] : (docenteActualObj?.cargo === "DOCENTE" ? 20 : 0)) : 0;
                              const hrsConDocenteConEsta = hrsConsumidasDocenteActual + (uac.horasSemanales || 3);
                              const esDocenteExcedido = docenteActualId && hrsConDocenteConEsta > hrsMaxDocenteActual;

                              return (
                                <tr key={uac.id || uacIdx} style={{ borderBottom: "1px solid #1e293b" }}>
                                  <td style={{ padding: "0.5rem 0.625rem", fontWeight: 700, color: "#f8fafc", lineHeight: 1.35 }}>
                                    {uac.tipo?.startsWith("LABORAL") ? (
                                      <div>
                                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#94a3b8", display: "block" }}>
                                          Formación Laboral {uac.tipo === "LABORAL_A" ? '"A"' : '"B"'} ({uac.capNombre})
                                        </span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexWrap: "wrap" }}>
                                          {uac.esDividida && (
                                            <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "#0284c7", color: "#ffffff", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
                                              ✂️ Dividida
                                            </span>
                                          )}
                                          <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: "0.8125rem" }}>
                                            {uac.uacName}
                                          </span>
                                          <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#60a5fa" }}>
                                            ({uac.abrev})
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => abrirModalEditarNombre(g, uac)}
                                            title="Editar nombre de asignatura"
                                            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.8rem", padding: "1px 4px", color: "#94a3b8" }}
                                          >
                                            ✏️
                                          </button>
                                        </div>
                                      </div>
                                    ) : uac.tipo === "AMPLIADO" ? (
                                      <div>
                                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#38bdf8", display: "block" }}>
                                          Currículum Ampliado (FFEO)
                                        </span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexWrap: "wrap" }}>
                                          {uac.esDividida && (
                                            <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "#0284c7", color: "#ffffff", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
                                              ✂️ Dividida
                                            </span>
                                          )}
                                          <span style={{ color: "#7dd3fc", fontWeight: 800 }}>
                                            {uac.uacName}
                                          </span>
                                          <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#94a3b8" }}>
                                            ({uac.abrev})
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => abrirModalEditarNombre(g, uac)}
                                            title="Editar nombre de asignatura"
                                            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.8rem", padding: "1px 4px", color: "#94a3b8" }}
                                          >
                                            ✏️
                                          </button>
                                        </div>
                                      </div>
                                    ) : uac.tipo?.startsWith("FFE_") ? (
                                      <div>
                                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#c084fc", display: "block" }}>
                                          Formación Fundamental Extendida (Optativa FFE)
                                        </span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexWrap: "wrap" }}>
                                          {uac.esDividida && (
                                            <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "#0284c7", color: "#ffffff", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
                                              ✂️ Dividida
                                            </span>
                                          )}
                                          <span style={{ color: "#d8b4fe", fontWeight: 800 }}>
                                            {uac.uacName}
                                          </span>
                                          <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#94a3b8" }}>
                                            ({uac.abrev})
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => abrirModalEditarNombre(g, uac)}
                                            title="Editar nombre de asignatura"
                                            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.8rem", padding: "1px 4px", color: "#94a3b8" }}
                                          >
                                            ✏️
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexWrap: "wrap" }}>
                                          {uac.esDividida && (
                                            <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "#0284c7", color: "#ffffff", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
                                              ✂️ Dividida
                                            </span>
                                          )}
                                          {uac.tipo === "MODULAR" && (
                                            <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", padding: "0.1rem 0.35rem", borderRadius: "4px", border: "1px solid rgba(245, 158, 11, 0.4)" }}>
                                              Módulo Técnico
                                            </span>
                                          )}
                                          {uac.esPersonalizada && !uac.esDividida && (
                                            <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
                                              Personalizada
                                            </span>
                                          )}
                                          <span style={{ color: "#f8fafc" }}>{uac.uacName}</span>
                                          <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#38bdf8" }}>
                                            ({uac.abrev})
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => abrirModalEditarNombre(g, uac)}
                                            title="Editar nombre de asignatura"
                                            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.8rem", padding: "1px 4px", color: "#94a3b8" }}
                                          >
                                            ✏️
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: "0.4rem 0.25rem", textAlign: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.2rem" }}>
                                      <input
                                        type="number"
                                        min={1}
                                        max={25}
                                        value={uac.horasSemanales || 3}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value, 10);
                                          if (!isNaN(val)) {
                                            handleCambiarHorasUAC(g, uac.id || '', val);
                                          }
                                        }}
                                        style={{
                                          width: "44px",
                                          padding: "0.25rem 0.1rem",
                                          borderRadius: "6px",
                                          border: "1px solid #475569",
                                          background: "#0f172a",
                                          color: "#38bdf8",
                                          fontWeight: 800,
                                          fontSize: "0.8125rem",
                                          textAlign: "center"
                                        }}
                                      />
                                      <span style={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 700 }}>h</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: "0.35rem" }}>
                                    <select
                                      value={docenteActualId}
                                      onChange={(e) => handleAsignarDocenteMatriz(g.id, uac, e.target.value)}
                                      style={{
                                        width: "100%",
                                        padding: "0.4rem 0.5rem",
                                        borderRadius: "6px",
                                        border: "2px solid " + (esDocenteExcedido ? "#ef4444" : docenteActualId ? "#22c55e" : "#475569"),
                                        background: esDocenteExcedido ? "#450a0a" : docenteActualId ? "#0f172a" : "#1e293b",
                                        fontSize: "0.72rem",
                                        fontWeight: 800,
                                        color: esDocenteExcedido ? "#f87171" : docenteActualId ? "#4ade80" : "#cbd5e1",
                                        outline: "none"
                                      }}
                                    >
                                      <option value="" style={{ background: "#0f172a", color: "#ffffff" }}>-- Sin Asignar --</option>
                                      {docentesAptosParaHorario.map((d) => {
                                        const hrsMax = horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0);
                                        const hrsConsumidasSinEstaCelda = getHorasConsumidasDocente(d.id, g.id, uac.id);
                                        const hrsTrasAsignar = hrsConsumidasSinEstaCelda + (uac.horasSemanales || 3);
                                        const esSeleccionado = docenteActualId === d.id;
                                        const excedeHoras = hrsTrasAsignar > hrsMax && !esSeleccionado;

                                        return (
                                          <option key={d.id} value={d.id} disabled={excedeHoras} style={{ background: "#0f172a", color: excedeHoras ? "#64748b" : "#ffffff" }}>
                                            {d.apellidoPaterno} {d.nombre} ({hrsConsumidasSinEstaCelda + (esSeleccionado ? (uac.horasSemanales || 3) : 0)}/{hrsMax}h) {excedeHoras ? `⚠️ EXCEDE LÍMITE (${hrsTrasAsignar}h > ${hrsMax}h)` : ""}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </td>
                                  <td style={{ padding: "0.35rem 0.25rem", textAlign: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                                      <button
                                        type="button"
                                        onClick={() => abrirModalDividir(g, uac)}
                                        title="Dividir asignatura en 2 partes (Parte A y Parte B para diferentes docentes)"
                                        style={{
                                          background: "rgba(56, 189, 248, 0.12)",
                                          border: "1px solid rgba(56, 189, 248, 0.3)",
                                          color: "#38bdf8",
                                          borderRadius: "6px",
                                          padding: "0.25rem 0.4rem",
                                          cursor: "pointer",
                                          fontSize: "0.78rem",
                                          fontWeight: 700,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "2px"
                                        }}
                                      >
                                        ✂️ <span style={{ fontSize: "0.6875rem" }}>Dividir</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEliminarUAC(g, uac.id || '')}
                                        title="Eliminar asignatura del grupo"
                                        style={{
                                          background: "rgba(239, 68, 68, 0.12)",
                                          border: "1px solid rgba(239, 68, 68, 0.3)",
                                          color: "#f87171",
                                          borderRadius: "6px",
                                          padding: "0.25rem 0.4rem",
                                          cursor: "pointer",
                                          fontSize: "0.78rem"
                                        }}
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Pie de tabla con Agregar Asignatura, Restaurar y Total de Horas */}
                        <div style={{ padding: "0.6rem 0.8rem", background: "#1e293b", borderTop: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => abrirModalAgregarUac(g)}
                              style={{
                                background: "#0284c7",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "6px",
                                padding: "0.35rem 0.75rem",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.3rem"
                              }}
                            >
                              ➕ Agregar Asignatura
                            </button>
                            {getCustomUacsDeGrupo(g) && (
                              <button
                                type="button"
                                onClick={() => handleRestaurarUACsOficiales(g)}
                                style={{
                                  background: "transparent",
                                  color: "#94a3b8",
                                  border: "1px solid #475569",
                                  borderRadius: "6px",
                                  padding: "0.35rem 0.6rem",
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.3rem"
                                }}
                              >
                                🔄 Restaurar Oficiales
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#f8fafc" }}>
                            Total: <span style={{ color: "#38bdf8", fontSize: "0.9rem" }}>{uacsEspecificas.reduce((s, u) => s + (u.horasSemanales || 3), 0)}h</span> / sem
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "1rem" }}>
            <button
              onClick={() => setPaso(2)}
              style={{ background: "#334155", color: "#ffffff", padding: "0.75rem 1.5rem", borderRadius: "10px", fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              ← Atrás
            </button>

            <button
              disabled={loading}
              onClick={handleGuardarConfiguracion}
              style={{ background: "#16a34a", color: "#ffffff", padding: "0.75rem 2.25rem", borderRadius: "12px", fontWeight: 800, fontSize: "1rem", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)" }}
            >
              {loading ? "Generando Matriz..." : "🚀 Generar Horarios con IA (0 Empalmes)"}
            </button>
          </div>
        </div>
  );
}
