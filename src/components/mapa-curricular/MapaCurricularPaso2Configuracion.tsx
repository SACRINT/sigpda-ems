"use client";

import React from "react";
import {
  FORMACIONES_LABORALES,
  FFE_RECURSOS_SOCIOCOGNITIVOS,
  FFE_AREAS_CONOCIMIENTO,
  FORMACIONES_SOCIOEMOCIONALES,
  type GrupoDefinicion,
} from "@/lib/escuela-grupos";
import {
  CATALOGO_PROPEDUTICAS_5TO,
  getModulosPorSemestre,
  type CarreraTecnica,
} from "@/lib/bt-carreras-catalog";
import type { GrupoConfigItem } from "./types";

export interface MapaCurricularPaso2ConfiguracionProps {
  esTecnologico: boolean;
  gruposGenerados: GrupoDefinicion[];
  mapaConfig: Record<string, GrupoConfigItem>;
  carrerasTecnologicas: CarreraTecnica[];
  handleUpdateGrupoConfig: (grupoNombre: string, field: string, value: any) => void;
}

const normalizarNombreGrupo = (n: string) => (n || "").replace(/º/g, "°");

export default function MapaCurricularPaso2Configuracion({
  esTecnologico,
  gruposGenerados,
  mapaConfig,
  carrerasTecnologicas,
  handleUpdateGrupoConfig,
}: MapaCurricularPaso2ConfiguracionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          padding: "0.85rem 1rem",
          borderRadius: "10px",
          fontSize: "0.8rem",
          color: "#cbd5e1",
        }}
      >
        <strong style={{ color: "#38bdf8" }}>
          {esTecnologico
            ? "Paso 2: Configure la Carrera Técnica y Materias Propedéuticas por Grupo."
            : "Paso 2: Configure la Formación Laboral, Optativas FFE y Socioemocional por Grupo."}
        </strong>
        <br />
        {esTecnologico
          ? "Para cada grupo de 3.º y 5.º semestre, seleccione la Carrera Técnica y la Materia Propedéutica correspondiente a su oferta educativa tecnológica."
          : "Para cada grupo de 3.º y 5.º semestre, seleccione las asignaturas correspondientes a su oferta educativa."}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {gruposGenerados.map((g) => {
          const rawCfg =
            mapaConfig[g.nombre] ||
            mapaConfig[g.nombre.replace("º", "°")] ||
            mapaConfig[g.nombre.replace("°", "º")];
          const cfg = {
            capacitacionNombre: rawCfg?.capacitacionNombre || "Administracion",
            ffeOptativas:
              Array.isArray(rawCfg?.ffeOptativas) && rawCfg.ffeOptativas.length === 4
                ? rawCfg.ffeOptativas
                : [
                    FFE_RECURSOS_SOCIOCOGNITIVOS[0],
                    FFE_RECURSOS_SOCIOCOGNITIVOS[1],
                    FFE_AREAS_CONOCIMIENTO[0],
                    FFE_AREAS_CONOCIMIENTO[1],
                  ],
            ffeoSocioemocional:
              rawCfg?.ffeoSocioemocional ||
              (g.semestre === 3
                ? FORMACIONES_SOCIOEMOCIONALES[0]
                : FORMACIONES_SOCIOEMOCIONALES[1]),
            carreraTecnicaId: rawCfg?.carreraTecnicaId || "contabilidad",
            versionPrograma: rawCfg?.versionPrograma || "nuevo",
            materiaPropedutica5to: rawCfg?.materiaPropedutica5to || "Derecho y Sociedad I",
          };

          return (
            <div
              key={g.id}
              style={{
                padding: "1.25rem",
                border: "1px solid #334155",
                background: "#1e293b",
                borderRadius: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid #334155",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      background: "#2563eb",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "0.85rem",
                    }}
                  >
                    {g.nombre.split(" ")[0]}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: "1rem", color: "#ffffff" }}>
                    Grupo {g.nombre} ({g.semestre}° Semestre)
                  </span>
                </div>

                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.6rem",
                    borderRadius: "12px",
                    background:
                      g.semestre === 1
                        ? "rgba(16, 185, 129, 0.2)"
                        : g.semestre === 3
                        ? "rgba(59, 130, 246, 0.2)"
                        : "rgba(139, 92, 246, 0.2)",
                    color:
                      g.semestre === 1
                        ? "#34d399"
                        : g.semestre === 3
                        ? "#60a5fa"
                        : "#a78bfa",
                    border: `1px solid ${
                      g.semestre === 1
                        ? "rgba(52, 211, 153, 0.3)"
                        : g.semestre === 3
                        ? "rgba(96, 165, 246, 0.3)"
                        : "rgba(167, 139, 250, 0.3)"
                    }`,
                  }}
                >
                  {esTecnologico
                    ? g.semestre === 1
                      ? "10 UACs Fundamentales (28h)"
                      : g.semestre === 3
                      ? "6 Fundamentales (22h) + Módulo II (17h) = 39h"
                      : "5 Fundamentales (20h) + Propedéutica (3h) + Módulo IV (12h) = 35h"
                    : g.semestre === 1
                    ? "100% Fundamental Universal"
                    : g.semestre === 3
                    ? "Laboral (9 UACs)"
                    : "Laboral + FFE (10 UACs)"}
                </span>
              </div>

              {/* Grupos de 1º Semestre */}
              {g.semestre === 1 &&
                (esTecnologico ? (
                  <div
                    style={{
                      background: "rgba(16, 185, 129, 0.1)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      padding: "0.85rem 1rem",
                      borderRadius: "10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        color: "#34d399",
                        marginBottom: "0.3rem",
                      }}
                    >
                      ✓ 10 UACs del Currículum Fundamental MCCEMS (28 Horas Semanales)
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                      Incluye las 8 UACs Fundamentales comunes (24h) + las 2 UACs estatales obligatorias de Puebla (4h):
                      <br />
                      • <strong>Bioética Social</strong> (2 horas semanales)
                      <br />• <strong>Humanismo Mexicano</strong> (2 horas semanales)
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic" }}>
                    ✓ Asignaturas del Currículum Fundamental MCCEMS 100% universales (Ciencias Naturales, Experimentales y Tecnología I, Pensamiento Matemático I, Humanidades I, Lenguaje y Comunicación I, etc.).
                  </div>
                ))}

              {/* Grupos de 3º Semestre */}
              {g.semestre === 3 &&
                (() => {
                  const letra = g.nombre.split(" ")[1];

                  if (esTecnologico) {
                    const moduloSem3 = getModulosPorSemestre(cfg.carreraTecnicaId, 3);
                    const moduloSem4 = getModulosPorSemestre(cfg.carreraTecnicaId, 4);
                    const horasMod3 = moduloSem3
                      ? moduloSem3.submodulos.reduce((acc, sub) => acc + sub.horasSemanales, 0)
                      : 17;
                    const horasMod4 = moduloSem4
                      ? moduloSem4.submodulos.reduce((acc, sub) => acc + sub.horasSemanales, 0)
                      : 17;

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "1rem",
                          }}
                        >
                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "#cbd5e1",
                                marginBottom: "0.3rem",
                              }}
                            >
                              CARRERA TÉCNICA:
                            </label>
                            <select
                              className="form-control"
                              value={cfg.carreraTecnicaId}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateGrupoConfig(g.nombre, "carreraTecnicaId", val);
                                const carrera = carrerasTecnologicas.find((c) => c.id === val);
                                if (carrera) {
                                  handleUpdateGrupoConfig(
                                    g.nombre,
                                    "versionPrograma",
                                    carrera.tipoPrograma
                                  );
                                }
                              }}
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                background: "#0f172a",
                                color: "#ffffff",
                                border: "1px solid #475569",
                                borderRadius: "8px",
                                padding: "0.5rem 0.75rem",
                                width: "100%",
                              }}
                            >
                              {carrerasTecnologicas.map((c) => (
                                <option
                                  key={c.id}
                                  value={c.id}
                                  style={{ background: "#0f172a", color: "#ffffff" }}
                                >
                                  {c.nombre} (
                                  {c.tipoPrograma === "nuevo"
                                    ? "Nuevo Prog. 2024"
                                    : "Acuerdo 653"}
                                  )
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "#cbd5e1",
                                marginBottom: "0.3rem",
                              }}
                            >
                              VERSIÓN DEL PROGRAMA:
                            </label>
                            <select
                              className="form-control"
                              value={cfg.versionPrograma}
                              onChange={(e) =>
                                handleUpdateGrupoConfig(
                                  g.nombre,
                                  "versionPrograma",
                                  e.target.value
                                )
                              }
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                background: "#0f172a",
                                color: "#ffffff",
                                border: "1px solid #475569",
                                borderRadius: "8px",
                                padding: "0.5rem 0.75rem",
                                width: "100%",
                              }}
                            >
                              <option
                                value="nuevo"
                                style={{ background: "#0f172a", color: "#ffffff" }}
                              >
                                Nuevo Programa 2024 (Acuerdos 09/08/23 y 09/05/24)
                              </option>
                              <option
                                value="anterior"
                                style={{ background: "#0f172a", color: "#ffffff" }}
                              >
                                Programa Anterior (Acuerdo Secretarial 653)
                              </option>
                            </select>
                          </div>
                        </div>

                        {/* Desglose dinámico del Módulo II */}
                        {moduloSem3 && (
                          <div
                            style={{
                              background: "rgba(59, 130, 246, 0.12)",
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                              padding: "0.75rem 1rem",
                              borderRadius: "10px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 800,
                                color: "#60a5fa",
                                marginBottom: "0.4rem",
                              }}
                            >
                              🛠️ Formación Profesional: {moduloSem3.nombre} ({horasMod3} Horas
                              Semanales)
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.3rem",
                                fontSize: "0.75rem",
                                color: "#cbd5e1",
                              }}
                            >
                              {moduloSem3.submodulos.map((sub) => (
                                <div key={sub.abreviatura}>
                                  • <strong>{sub.nombre}</strong> —{" "}
                                  <span style={{ color: "#93c5fd" }}>
                                    {sub.horasSemanales}h/semana
                                  </span>
                                </div>
                              ))}
                              <div
                                style={{
                                  marginTop: "0.2rem",
                                  paddingTop: "0.3rem",
                                  borderTop: "1px dashed rgba(255,255,255,0.15)",
                                  color: "#86efac",
                                  fontWeight: 700,
                                }}
                              >
                                Total semanal grupo: 6 UACs Fundamentales (22h) + Módulo II (
                                {horasMod3}h) = {22 + horasMod3} Horas
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Semestre B Informativo (4.º Semestre) */}
                        {moduloSem4 && (
                          <div
                            style={{
                              background: "rgba(16, 185, 129, 0.12)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              padding: "0.75rem 1rem",
                              borderRadius: "10px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.78125rem",
                                fontWeight: 800,
                                color: "#34d399",
                                marginBottom: "0.3rem",
                              }}
                            >
                              📗 Semestre B Correspondiente (4.º Semestre - Grupo 4° {letra})
                            </div>
                            <div style={{ fontSize: "0.725rem", color: "#86efac", lineHeight: 1.4 }}>
                              • <strong>Módulo Profesional:</strong> {moduloSem4.nombre} (
                              {horasMod4}h) (Automático)
                              <br />• 6 UACs Fundamentales (22h) + Módulo III ({horasMod4}h) ={" "}
                              {22 + horasMod4} Horas Semanales
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Lógica existente para Bachillerato General Estatal (BGE)
                  const config5 =
                    mapaConfig[normalizarNombreGrupo(`5° ${letra}`)] ||
                    mapaConfig[`5° ${letra}`] ||
                    mapaConfig[`5º ${letra}`];
                  const socio5 = config5?.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[1];
                  const socio4y6 =
                    FORMACIONES_SOCIOEMOCIONALES.find(
                      (soc) => soc !== cfg.ffeoSocioemocional && soc !== socio5
                    ) || FORMACIONES_SOCIOEMOCIONALES[2];

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "#cbd5e1",
                              marginBottom: "0.3rem",
                            }}
                          >
                            FORMACIÓN LABORAL (CAPACITACIÓN DEL GRUPO):
                          </label>
                          <select
                            className="form-control"
                            value={cfg.capacitacionNombre}
                            onChange={(e) =>
                              handleUpdateGrupoConfig(
                                g.nombre,
                                "capacitacionNombre",
                                e.target.value
                              )
                            }
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              background: "#0f172a",
                              color: "#ffffff",
                              border: "1px solid #475569",
                              borderRadius: "8px",
                              padding: "0.5rem 0.75rem",
                              width: "100%",
                            }}
                          >
                            {FORMACIONES_LABORALES.map((cap) => (
                              <option
                                key={cap}
                                value={cap}
                                style={{ background: "#0f172a", color: "#ffffff" }}
                              >
                                {cap}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "#cbd5e1",
                              marginBottom: "0.3rem",
                            }}
                          >
                            FORMACIÓN SOCIOEMOCIONAL (OPCIÓN 1 - 3.ER SEMESTRE):
                          </label>
                          <select
                            className="form-control"
                            value={cfg.ffeoSocioemocional}
                            onChange={(e) =>
                              handleUpdateGrupoConfig(
                                g.nombre,
                                "ffeoSocioemocional",
                                e.target.value
                              )
                            }
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              background: "#0f172a",
                              color: "#ffffff",
                              border: "1px solid #475569",
                              borderRadius: "8px",
                              padding: "0.5rem 0.75rem",
                              width: "100%",
                            }}
                          >
                            {FORMACIONES_SOCIOEMOCIONALES.map((soc) => (
                              <option
                                key={soc}
                                value={soc}
                                style={{ background: "#0f172a", color: "#ffffff" }}
                              >
                                {soc}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 📗 Bloque informativo: Semestre B (4.º Semestre automático) */}
                      <div
                        style={{
                          background: "rgba(16, 185, 129, 0.12)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          padding: "0.75rem 1rem",
                          borderRadius: "10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.78125rem",
                            fontWeight: 800,
                            color: "#34d399",
                            marginBottom: "0.3rem",
                          }}
                        >
                          📗 Semestre B Correspondiente (4.º Semestre - Grupo 4° {letra})
                        </div>
                        <div style={{ fontSize: "0.725rem", color: "#86efac", lineHeight: 1.4 }}>
                          • <strong>Laboral:</strong> Submódulos 3 y 4 de{" "}
                          <em>{cfg.capacitacionNombre}</em> (Automático)
                          <br />• <strong>Socioemocional:</strong> <em>{socio4y6}</em> (Automático)
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* Grupos de 5º Semestre */}
              {g.semestre === 5 &&
                (() => {
                  const letra = g.nombre.split(" ")[1];

                  if (esTecnologico) {
                    const moduloSem5 = getModulosPorSemestre(cfg.carreraTecnicaId, 5);
                    const moduloSem6 = getModulosPorSemestre(cfg.carreraTecnicaId, 6);
                    const horasMod5 = moduloSem5
                      ? moduloSem5.submodulos.reduce((acc, sub) => acc + sub.horasSemanales, 0)
                      : 12;
                    const horasMod6 = moduloSem6
                      ? moduloSem6.submodulos.reduce((acc, sub) => acc + sub.horasSemanales, 0)
                      : 12;

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "1rem",
                          }}
                        >
                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "#cbd5e1",
                                marginBottom: "0.3rem",
                              }}
                            >
                              CARRERA TÉCNICA:
                            </label>
                            <select
                              className="form-control"
                              value={cfg.carreraTecnicaId}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateGrupoConfig(g.nombre, "carreraTecnicaId", val);
                                const carrera = carrerasTecnologicas.find((c) => c.id === val);
                                if (carrera) {
                                  handleUpdateGrupoConfig(
                                    g.nombre,
                                    "versionPrograma",
                                    carrera.tipoPrograma
                                  );
                                }
                              }}
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                background: "#0f172a",
                                color: "#ffffff",
                                border: "1px solid #475569",
                                borderRadius: "8px",
                                padding: "0.5rem 0.75rem",
                                width: "100%",
                              }}
                            >
                              {carrerasTecnologicas.map((c) => (
                                <option
                                  key={c.id}
                                  value={c.id}
                                  style={{ background: "#0f172a", color: "#ffffff" }}
                                >
                                  {c.nombre} (
                                  {c.tipoPrograma === "nuevo"
                                    ? "Nuevo Prog. 2024"
                                    : "Acuerdo 653"}
                                  )
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "#cbd5e1",
                                marginBottom: "0.3rem",
                              }}
                            >
                              MATERIA PROPEDÉUTICA (3 HORAS SEMANALES):
                            </label>
                            <select
                              className="form-control"
                              value={cfg.materiaPropedutica5to}
                              onChange={(e) =>
                                handleUpdateGrupoConfig(
                                  g.nombre,
                                  "materiaPropedutica5to",
                                  e.target.value
                                )
                              }
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                background: "#0f172a",
                                color: "#ffffff",
                                border: "1px solid #475569",
                                borderRadius: "8px",
                                padding: "0.5rem 0.75rem",
                                width: "100%",
                              }}
                            >
                              {CATALOGO_PROPEDUTICAS_5TO.map((prop) => (
                                <option
                                  key={prop.nombre}
                                  value={prop.nombre}
                                  style={{ background: "#0f172a", color: "#ffffff" }}
                                >
                                  {prop.nombre} ({prop.area}) - 3 hrs
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Desglose dinámico del Módulo IV + Propedéutica */}
                        {moduloSem5 && (
                          <div
                            style={{
                              background: "rgba(168, 85, 247, 0.12)",
                              border: "1px solid rgba(168, 85, 247, 0.3)",
                              padding: "0.75rem 1rem",
                              borderRadius: "10px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 800,
                                color: "#c084fc",
                                marginBottom: "0.4rem",
                              }}
                            >
                              🛠️ Formación Profesional: {moduloSem5.nombre} ({horasMod5}h) +
                              Propedéutica ({cfg.materiaPropedutica5to}) 3h
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.3rem",
                                fontSize: "0.75rem",
                                color: "#cbd5e1",
                              }}
                            >
                              {moduloSem5.submodulos.map((sub) => (
                                <div key={sub.abreviatura}>
                                  • <strong>{sub.nombre}</strong> —{" "}
                                  <span style={{ color: "#d8b4fe" }}>
                                    {sub.horasSemanales}h/semana
                                  </span>
                                </div>
                              ))}
                              <div>
                                • <strong>{cfg.materiaPropedutica5to}</strong> (Propedéutica I) —{" "}
                                <span style={{ color: "#d8b4fe" }}>3h/semana</span>
                              </div>
                              <div
                                style={{
                                  marginTop: "0.2rem",
                                  paddingTop: "0.3rem",
                                  borderTop: "1px dashed rgba(255,255,255,0.15)",
                                  color: "#86efac",
                                  fontWeight: 700,
                                }}
                              >
                                Total semanal grupo: 5 UACs Fundamentales (20h) + Propedéutica
                                (3h) + Módulo IV ({horasMod5}h) = {20 + 3 + horasMod5} Horas
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Semestre B Informativo (6.º Semestre) */}
                        {moduloSem6 && (
                          <div
                            style={{
                              background: "rgba(16, 185, 129, 0.12)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              padding: "0.75rem 1rem",
                              borderRadius: "10px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.78125rem",
                                fontWeight: 800,
                                color: "#34d399",
                                marginBottom: "0.3rem",
                              }}
                            >
                              📗 Semestre B Correspondiente (6.º Semestre - Grupo 6° {letra})
                            </div>
                            <div style={{ fontSize: "0.725rem", color: "#86efac", lineHeight: 1.4 }}>
                              • <strong>Módulo Profesional:</strong> {moduloSem6.nombre} (
                              {horasMod6}h) (Automático)
                              <br />• <strong>Materia Propedéutica II:</strong> Continuación de{" "}
                              <em>{cfg.materiaPropedutica5to}</em> (3h) (Automático)
                              <br />• 5 UACs Fundamentales (20h) + Propedéutica (3h) + Módulo V (
                              {horasMod6}h) = {20 + 3 + horasMod6} Horas Semanales
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Lógica existente para Bachillerato General Estatal (BGE)
                  const config3 =
                    mapaConfig[normalizarNombreGrupo(`3° ${letra}`)] ||
                    mapaConfig[`3° ${letra}`] ||
                    mapaConfig[`3º ${letra}`];
                  const socio3 = config3?.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0];
                  const opcionesSocio5 = FORMACIONES_SOCIOEMOCIONALES.filter(
                    (soc) => soc !== socio3
                  );
                  const socio5Actual = opcionesSocio5.includes(cfg.ffeoSocioemocional)
                    ? cfg.ffeoSocioemocional
                    : opcionesSocio5[0];
                  const socio4y6 =
                    FORMACIONES_SOCIOEMOCIONALES.find(
                      (soc) => soc !== socio3 && soc !== socio5Actual
                    ) || FORMACIONES_SOCIOEMOCIONALES[2];

                  const optRecurso1 = cfg.ffeOptativas[0] || FFE_RECURSOS_SOCIOCOGNITIVOS[0];
                  const optRecurso2 = cfg.ffeOptativas[1] || FFE_RECURSOS_SOCIOCOGNITIVOS[1];
                  const optArea3 = cfg.ffeOptativas[2] || FFE_AREAS_CONOCIMIENTO[0];
                  const optArea4 = cfg.ffeOptativas[3] || FFE_AREAS_CONOCIMIENTO[1];

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "#cbd5e1",
                              marginBottom: "0.3rem",
                            }}
                          >
                            FORMACIÓN LABORAL (CAPACITACIÓN):
                          </label>
                          <select
                            className="form-control"
                            value={cfg.capacitacionNombre}
                            onChange={(e) =>
                              handleUpdateGrupoConfig(
                                g.nombre,
                                "capacitacionNombre",
                                e.target.value
                              )
                            }
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              background: "#0f172a",
                              color: "#ffffff",
                              border: "1px solid #475569",
                              borderRadius: "8px",
                              padding: "0.5rem 0.75rem",
                              width: "100%",
                            }}
                          >
                            {FORMACIONES_LABORALES.map((cap) => (
                              <option
                                key={cap}
                                value={cap}
                                style={{ background: "#0f172a", color: "#ffffff" }}
                              >
                                {cap}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "#cbd5e1",
                              marginBottom: "0.3rem",
                            }}
                          >
                            FORMACIÓN SOCIOEMOCIONAL (OPCIÓN 2 - 5.º SEMESTRE):
                          </label>
                          <select
                            className="form-control"
                            value={socio5Actual}
                            onChange={(e) =>
                              handleUpdateGrupoConfig(
                                g.nombre,
                                "ffeoSocioemocional",
                                e.target.value
                              )
                            }
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              background: "#0f172a",
                              color: "#ffffff",
                              border: "1px solid #475569",
                              borderRadius: "8px",
                              padding: "0.5rem 0.75rem",
                              width: "100%",
                            }}
                          >
                            {opcionesSocio5.map((soc) => (
                              <option
                                key={soc}
                                value={soc}
                                style={{ background: "#0f172a", color: "#ffffff" }}
                              >
                                {soc}
                              </option>
                            ))}
                          </select>
                          <div
                            style={{
                              fontSize: "0.725rem",
                              color: "#86efac",
                              marginTop: "0.4rem",
                              fontWeight: 700,
                              background: "rgba(16, 185, 129, 0.12)",
                              padding: "0.4rem 0.6rem",
                              borderRadius: "6px",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                            }}
                          >
                            ⚡ Opción de 3.er semestre:{" "}
                            <strong style={{ color: "#ffffff" }}>{socio3}</strong>
                            <br />
                            ℹ️ 4.º y 6.º Semestre llevarán automáticamente:{" "}
                            <strong style={{ color: "#ffffff" }}>{socio4y6}</strong>
                          </div>
                        </div>
                      </div>

                      {/* ── Optativas FFE Divididas por Categoría (Alto Contraste) ── */}
                      <div
                        style={{
                          background: "#0b132b",
                          padding: "1.1rem",
                          borderRadius: "12px",
                          border: "1px solid #334155",
                          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)",
                        }}
                      >
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.85rem",
                            fontWeight: 800,
                            color: "#38bdf8",
                            marginBottom: "0.85rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          ✨ Optativas FFE (2 Recursos Sociocognitivos + 2 Áreas de Conocimiento):
                        </label>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "1rem",
                          }}
                        >
                          {/* Bloque 1: Recursos Sociocognitivos */}
                          <div
                            style={{
                              background: "#1e293b",
                              padding: "0.9rem",
                              borderRadius: "10px",
                              border: "1.5px solid #3b82f6",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 800,
                                color: "#93c5fd",
                                marginBottom: "0.6rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem",
                              }}
                            >
                              📘 Recursos Sociocognitivos (Optativas 1 y 2):
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    color: "#60a5fa",
                                    marginBottom: "0.25rem",
                                  }}
                                >
                                  Optativa 1 (Recurso):
                                </label>
                                <select
                                  className="form-control"
                                  value={optRecurso1}
                                  onChange={(e) => {
                                    const copia = [...cfg.ffeOptativas];
                                    copia[0] = e.target.value;
                                    handleUpdateGrupoConfig(g.nombre, "ffeOptativas", copia);
                                  }}
                                  style={{
                                    background: "#0f172a",
                                    color: "#ffffff",
                                    border: "1px solid #3b82f6",
                                    borderRadius: "6px",
                                    padding: "0.5rem 0.65rem",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    width: "100%",
                                  }}
                                >
                                  {FFE_RECURSOS_SOCIOCOGNITIVOS.map((opt) => (
                                    <option
                                      key={opt}
                                      value={opt}
                                      style={{ background: "#0f172a", color: "#ffffff" }}
                                    >
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    color: "#60a5fa",
                                    marginBottom: "0.25rem",
                                  }}
                                >
                                  Optativa 2 (Recurso):
                                </label>
                                <select
                                  className="form-control"
                                  value={optRecurso2}
                                  onChange={(e) => {
                                    const copia = [...cfg.ffeOptativas];
                                    copia[1] = e.target.value;
                                    handleUpdateGrupoConfig(g.nombre, "ffeOptativas", copia);
                                  }}
                                  style={{
                                    background: "#0f172a",
                                    color: "#ffffff",
                                    border: "1px solid #3b82f6",
                                    borderRadius: "6px",
                                    padding: "0.5rem 0.65rem",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    width: "100%",
                                  }}
                                >
                                  {FFE_RECURSOS_SOCIOCOGNITIVOS.filter(
                                    (o) => o !== optRecurso1
                                  ).map((opt) => (
                                    <option
                                      key={opt}
                                      value={opt}
                                      style={{ background: "#0f172a", color: "#ffffff" }}
                                    >
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Bloque 2: Áreas de Conocimiento */}
                          <div
                            style={{
                              background: "#1e293b",
                              padding: "0.9rem",
                              borderRadius: "10px",
                              border: "1.5px solid #a855f7",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 800,
                                color: "#d8b4fe",
                                marginBottom: "0.6rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem",
                              }}
                            >
                              🔬 Áreas de Conocimiento (Optativas 3 y 4):
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    color: "#c084fc",
                                    marginBottom: "0.25rem",
                                  }}
                                >
                                  Optativa 3 (Área):
                                </label>
                                <select
                                  className="form-control"
                                  value={optArea3}
                                  onChange={(e) => {
                                    const copia = [...cfg.ffeOptativas];
                                    copia[2] = e.target.value;
                                    handleUpdateGrupoConfig(g.nombre, "ffeOptativas", copia);
                                  }}
                                  style={{
                                    background: "#0f172a",
                                    color: "#ffffff",
                                    border: "1px solid #a855f7",
                                    borderRadius: "6px",
                                    padding: "0.5rem 0.65rem",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    width: "100%",
                                  }}
                                >
                                  {FFE_AREAS_CONOCIMIENTO.map((opt) => (
                                    <option
                                      key={opt}
                                      value={opt}
                                      style={{ background: "#0f172a", color: "#ffffff" }}
                                    >
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    color: "#c084fc",
                                    marginBottom: "0.25rem",
                                  }}
                                >
                                  Optativa 4 (Área):
                                </label>
                                <select
                                  className="form-control"
                                  value={optArea4}
                                  onChange={(e) => {
                                    const copia = [...cfg.ffeOptativas];
                                    copia[3] = e.target.value;
                                    handleUpdateGrupoConfig(g.nombre, "ffeOptativas", copia);
                                  }}
                                  style={{
                                    background: "#0f172a",
                                    color: "#ffffff",
                                    border: "1px solid #a855f7",
                                    borderRadius: "6px",
                                    padding: "0.5rem 0.65rem",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    width: "100%",
                                  }}
                                >
                                  {FFE_AREAS_CONOCIMIENTO.filter((o) => o !== optArea3).map(
                                    (opt) => (
                                      <option
                                        key={opt}
                                        value={opt}
                                        style={{ background: "#0f172a", color: "#ffffff" }}
                                      >
                                        {opt}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 📗 Bloque informativo: Semestre B (6.º Semestre automático) */}
                      <div
                        style={{
                          background: "rgba(16, 185, 129, 0.12)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          padding: "0.75rem 1rem",
                          borderRadius: "10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.78125rem",
                            fontWeight: 800,
                            color: "#34d399",
                            marginBottom: "0.3rem",
                          }}
                        >
                          📗 Semestre B Correspondiente (6.º Semestre - Grupo 6° {letra})
                        </div>
                        <div style={{ fontSize: "0.725rem", color: "#86efac", lineHeight: 1.4 }}>
                          • <strong>Laboral:</strong> Submódulos 5 y 6 de{" "}
                          <em>{cfg.capacitacionNombre}</em> (Automático)
                          <br />• <strong>Socioemocional:</strong> <em>{socio4y6}</em> (Automático)
                          <br />• <strong>Optativas FFE:</strong> Mantiene las 4 optativas FFE de
                          5.º Semestre (Automático)
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
