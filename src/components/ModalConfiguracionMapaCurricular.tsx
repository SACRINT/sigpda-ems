/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Sparkles, Layers, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import {
  FFE_RECURSOS_SOCIOCOGNITIVOS,
  FFE_AREAS_CONOCIMIENTO,
  FORMACIONES_SOCIOEMOCIONALES,
  generarGruposPorEstructura,
} from "@/lib/escuela-grupos";
import {
  loadCarrerasTecnicas,
  type CarreraTecnica,
} from "@/lib/bt-carreras-catalog";
import {
  MapaCurricularPaso1Estructura,
  MapaCurricularPaso2Configuracion,
  MapaCurricularFooter,
  type GrupoConfigItem,
  type GrupoInicialItem,
} from "./mapa-curricular";
import ModalConfiguracionMapaCurricularLegacy from "./mapa-curricular/ModalConfiguracionMapaCurricularLegacy";
import { useAssistant } from "@/components/assistant";

export type { GrupoConfigItem, GrupoInicialItem };

interface Props {
  escuela: {
    id: string;
    cct: string;
    nombre: string;
    subsystem?: string;
    gruposPrimerAno?: number;
    gruposSegundoAno?: number;
    gruposTercerAno?: number;
    mapaCurricularCompletado?: boolean;
  };
  subsystem?: "bge" | "tecnologico";
  gruposIniciales?: GrupoInicialItem[];
  isOpen: boolean;
  onClose?: () => void;
  onSaved?: () => void;
  forceObligatorio?: boolean;
  isAdmin?: boolean;
}

function ModalConfiguracionMapaCurricularModular({
  escuela,
  subsystem,
  gruposIniciales = [],
  isOpen,
  onClose,
  onSaved,
  forceObligatorio = false,
  isAdmin = false,
}: Props) {
  const subsysProp = (subsystem || escuela?.subsystem || "").toLowerCase();
  const initialEsTec =
    subsysProp.includes("tecnol") || (escuela?.cct || "").toUpperCase().startsWith("21ECT");
  const [subsistemaSeleccionado, setSubsistemaSeleccionado] = useState<"bge" | "tecnologico">(
    initialEsTec ? "tecnologico" : "bge"
  );
  const esTecnologico = subsistemaSeleccionado === "tecnologico";
  const [carrerasTecnologicas, setCarrerasTecnologicas] = useState<CarreraTecnica[]>([]);

  useEffect(() => {
    if (isOpen && esTecnologico) {
      loadCarrerasTecnicas().then(setCarrerasTecnologicas);
    }
  }, [isOpen, esTecnologico]);

  const [paso, setPaso] = useState<1 | 2>(1);
  const [guardando, setGuardando] = useState(false);

  // SAPCU Copiloto Pedagógico: Sincronización contextual bidireccional
  const { setDetallesDocumento } = useAssistant();
  useEffect(() => {
    if (isOpen) {
      setDetallesDocumento({
        programa: 'cartografia',
        documentoId: escuela?.id || 'cartografia',
        seccionActiva: `Paso ${paso}: ${paso === 1 ? 'Estructura de Grupos' : 'Configuración de Asignaturas'}`,
        detallesMediaSuperior: {
          subsistema: subsistemaSeleccionado,
          uac: escuela?.nombre,
        },
      });
    }
  }, [isOpen, paso, subsistemaSeleccionado, escuela, setDetallesDocumento]);

  // Paso 1: Estructura de Grupos
  const [g1, setG1] = useState<number>(escuela.gruposPrimerAno || 1);
  const [g2, setG2] = useState<number>(escuela.gruposSegundoAno || 1);
  const [g3, setG3] = useState<number>(escuela.gruposTercerAno || 1);

  // Config por Grupo (nombre -> GrupoConfigItem)
  const [mapaConfig, setMapaConfig] = useState<Record<string, GrupoConfigItem>>({});

  const [initialized, setInitialized] = useState(false);

  // Reset y sincronización al abrir el modal (solo una vez por apertura)
  useEffect(() => {
    if (isOpen && !initialized) {
      const sProp = (subsystem || escuela?.subsystem || "").toLowerCase();
      const isTec =
        sProp.includes("tecnol") || (escuela?.cct || "").toUpperCase().startsWith("21ECT");
      setSubsistemaSeleccionado(isTec ? "tecnologico" : "bge");

      setG1(Math.max(1, escuela?.gruposPrimerAno || 1));
      setG2(Math.max(1, escuela?.gruposSegundoAno || 1));
      setG3(Math.max(1, escuela?.gruposTercerAno || 1));

      const initialMap: Record<string, GrupoConfigItem> = {};

      if (Array.isArray(gruposIniciales)) {
        gruposIniciales.forEach((g) => {
          let opts = g.ffeOptativas;
          if (typeof opts === "string") {
            try {
              opts = JSON.parse(opts);
            } catch {
              opts = [];
            }
          }

          const parsedOpts =
            Array.isArray(opts) && opts.length === 4
              ? opts
              : [
                  FFE_RECURSOS_SOCIOCOGNITIVOS[0],
                  FFE_RECURSOS_SOCIOCOGNITIVOS[1],
                  FFE_AREAS_CONOCIMIENTO[0],
                  FFE_AREAS_CONOCIMIENTO[1],
                ];

          const itemData: GrupoConfigItem = {
            capacitacionNombre: g.capacitacionNombre || "Administracion",
            ffeOptativas: parsedOpts,
            ffeoSocioemocional:
              g.ffeoSocioemocional ||
              (g.semestre === 3 ? FORMACIONES_SOCIOEMOCIONALES[0] : FORMACIONES_SOCIOEMOCIONALES[1]),
            carreraTecnicaId: g.carreraTecnicaId || "contabilidad",
            versionPrograma: (g.versionPrograma as "nuevo" | "anterior") || "nuevo",
            materiaPropedutica5to: g.materiaPropedutica5to || "Derecho y Sociedad I",
          };

          if (g.nombre) {
            initialMap[g.nombre] = itemData;
            initialMap[g.nombre.replace("º", "°")] = itemData;
            initialMap[g.nombre.replace("°", "º")] = itemData;
          }
        });
      }
      setMapaConfig(initialMap);
      setPaso(1);
      setInitialized(true);
    } else if (!isOpen && initialized) {
      setInitialized(false);
    }
  }, [isOpen, initialized, escuela, gruposIniciales]);

  // Generar lista dinámica de grupos según la estructura actual de los inputs
  const gruposGenerados = useMemo(() => {
    return generarGruposPorEstructura(
      { gruposPrimerAno: g1, gruposSegundoAno: g2, gruposTercerAno: g3 },
      "SEMESTRE_A"
    );
  }, [g1, g2, g3]);

  if (!isOpen) return null;

  const normalizarNombreGrupo = (n: string) => (n || "").replace(/º/g, "°");

  const handleUpdateGrupoConfig = (grupoNombre: string, field: string, value: string | string[]) => {
    const nNorm = normalizarNombreGrupo(grupoNombre);
    const nAlt = grupoNombre.includes("°")
      ? grupoNombre.replace("°", "º")
      : grupoNombre.replace("º", "°");

    setMapaConfig((prev) => {
      const actual = prev[nNorm] || prev[grupoNombre] || prev[nAlt] || {
        capacitacionNombre: "Administracion",
        ffeOptativas: [
          FFE_RECURSOS_SOCIOCOGNITIVOS[0],
          FFE_RECURSOS_SOCIOCOGNITIVOS[1],
          FFE_AREAS_CONOCIMIENTO[0],
          FFE_AREAS_CONOCIMIENTO[1],
        ],
        ffeoSocioemocional: FORMACIONES_SOCIOEMOCIONALES[0],
        carreraTecnicaId: "contabilidad",
        versionPrograma: "nuevo",
        materiaPropedutica5to: "Derecho y Sociedad I",
      };

      const updatedConfig = {
        ...actual,
        [field]: value,
      };

      const nuevoMapa = {
        ...prev,
        [nNorm]: updatedConfig,
        [grupoNombre]: updatedConfig,
        [nAlt]: updatedConfig,
      };

      // Auto-swap inteligente bidireccional entre 3.er y 5.º Semestre (evita colisiones)
      if (field === "ffeoSocioemocional") {
        const letra = grupoNombre.split(" ")[1];
        if (grupoNombre.startsWith("3º") || grupoNombre.startsWith("3°")) {
          const key5Norm = normalizarNombreGrupo(`5° ${letra}`);
          const key5Alt = `5º ${letra}`;
          const config5 = prev[key5Norm] || prev[key5Alt] || {
            capacitacionNombre: "Administracion",
            ffeOptativas: [
              FFE_RECURSOS_SOCIOCOGNITIVOS[0],
              FFE_RECURSOS_SOCIOCOGNITIVOS[1],
              FFE_AREAS_CONOCIMIENTO[0],
              FFE_AREAS_CONOCIMIENTO[1],
            ],
            ffeoSocioemocional: FORMACIONES_SOCIOEMOCIONALES[1],
          };
          if (config5.ffeoSocioemocional === value) {
            const opcionDisponible =
              FORMACIONES_SOCIOEMOCIONALES.find((soc) => soc !== value) ||
              FORMACIONES_SOCIOEMOCIONALES[1];
            const updated5 = { ...config5, ffeoSocioemocional: opcionDisponible };
            nuevoMapa[key5Norm] = updated5;
            nuevoMapa[key5Alt] = updated5;
          }
        } else if (grupoNombre.startsWith("5º") || grupoNombre.startsWith("5°")) {
          const key3Norm = normalizarNombreGrupo(`3° ${letra}`);
          const key3Alt = `3º ${letra}`;
          const config3 = prev[key3Norm] || prev[key3Alt] || {
            capacitacionNombre: "Administracion",
            ffeOptativas: [
              FFE_RECURSOS_SOCIOCOGNITIVOS[0],
              FFE_RECURSOS_SOCIOCOGNITIVOS[1],
              FFE_AREAS_CONOCIMIENTO[0],
              FFE_AREAS_CONOCIMIENTO[1],
            ],
            ffeoSocioemocional: FORMACIONES_SOCIOEMOCIONALES[0],
          };
          if (config3.ffeoSocioemocional === value) {
            const opcionDisponible =
              FORMACIONES_SOCIOEMOCIONALES.find((soc) => soc !== value) ||
              FORMACIONES_SOCIOEMOCIONALES[0];
            const updated3 = { ...config3, ffeoSocioemocional: opcionDisponible };
            nuevoMapa[key3Norm] = updated3;
            nuevoMapa[key3Alt] = updated3;
          }
        }
      }

      return nuevoMapa;
    });
  };

  const handleSave = async () => {
    setGuardando(true);
    try {
      // Construir array de gruposConfig
      const gruposConfig = gruposGenerados.map((g) => {
        const cfg =
          mapaConfig[g.nombre] ||
          mapaConfig[g.nombre.replace("º", "°")] ||
          mapaConfig[g.nombre.replace("°", "º")] || {
            capacitacionNombre: "Administracion",
            ffeOptativas: [
              "Análisis de Fenómenos y Procesos Biológicos",
              "Pensamiento Matemático Aplicado a las Finanzas I",
              "Fundamentos de Administración I",
              "Lógica y Pensamiento Crítico",
            ],
            ffeoSocioemocional: FORMACIONES_SOCIOEMOCIONALES[0],
            carreraTecnicaId: "contabilidad",
            versionPrograma: "nuevo",
            materiaPropedutica5to: "Derecho y Sociedad I",
          };

        if (esTecnologico) {
          return {
            grupoNombre: g.nombre,
            semestre: g.semestre,
            carreraTecnicaId: cfg.carreraTecnicaId || "contabilidad",
            versionPrograma: cfg.versionPrograma || "nuevo",
            materiaPropedutica5to: cfg.materiaPropedutica5to || "Derecho y Sociedad I",
          };
        }

        return {
          grupoNombre: g.nombre,
          semestre: g.semestre,
          capacitacionNombre: cfg.capacitacionNombre,
          ffeOptativas: cfg.ffeOptativas,
          ffeoSocioemocional: cfg.ffeoSocioemocional,
        };
      });

      const res = await fetch(`/api/escuelas/${escuela.id}/mapa-curricular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gruposPrimerAno: g1,
          gruposSegundoAno: g2,
          gruposTercerAno: g3,
          gruposConfig,
          subsystem: subsistemaSeleccionado === "tecnologico" ? "Bachillerato Tecnológico" : "bge",
        }),
      });

      if (!res.ok) throw new Error("Error al guardar mapa curricular");

      try {
        localStorage.removeItem(`horarios_wizard_config_v4_${escuela.id}`);
        localStorage.removeItem(`horarios_wizard_config_${escuela.id}`);
        localStorage.setItem(`horarios_paso_${escuela.id}`, "1");
      } catch (e) {
        console.warn("No se pudo limpiar localStorage", e);
      }

      toast.success("¡Mapa curricular y estructura del plantel guardados exitosamente!");
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "No se pudo guardar la configuración";
      toast.error(errorMessage);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#0f172a",
          width: "100%",
          maxWidth: "880px",
          maxHeight: "90vh",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #334155",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  opacity: 0.9,
                }}
              >
                {escuela.cct} • {escuela.nombre}
              </span>
              <button
                type="button"
                onClick={() =>
                  setSubsistemaSeleccionado((prev) => (prev === "tecnologico" ? "bge" : "tecnologico"))
                }
                title="Haga clic para cambiar de subsistema"
                style={{
                  background: esTecnologico ? "#f59e0b" : "#38bdf8",
                  color: "#0f172a",
                  border: "none",
                  borderRadius: "12px",
                  padding: "3px 10px",
                  fontSize: "0.6875rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                  transition: "all 0.15s ease",
                }}
              >
                {esTecnologico
                  ? "🏫 Bachillerato Tecnológico (BT Puebla) ▾"
                  : "🏛️ Bachillerato General Estatal (BGE Puebla) ▾"}
              </button>
            </div>
            <h3
              style={{
                margin: "0.2rem 0 0",
                fontSize: "1.15rem",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Sparkles size={18} /> Mapa Curricular y Estructura del Plantel (1.º a 6.º Semestre)
            </h3>
          </div>
          {(!forceObligatorio || isAdmin) && onClose && (
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.35)",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "6px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.85rem",
                fontWeight: 700,
                transition: "all 0.2s",
              }}
              title="Cerrar modal (Modo Administrador / Opcional)"
            >
              <X size={18} />
              <span>{isAdmin ? "Cerrar (Admin)" : "Cerrar"}</span>
            </button>
          )}
        </div>

        {/* Stepper Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #334155",
            background: "#1e293b",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setPaso(1);
            }}
            style={{
              flex: 1,
              padding: "0.85rem",
              border: "none",
              background: paso === 1 ? "#0f172a" : "transparent",
              color: paso === 1 ? "#38bdf8" : "#94a3b8",
              fontWeight: 800,
              fontSize: "0.875rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              borderBottom: paso === 1 ? "3px solid #38bdf8" : "none",
            }}
          >
            <Layers size={16} /> 1. Estructura de Grupos ({g1 + g2 + g3} grupos)
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setPaso(2);
            }}
            style={{
              flex: 1,
              padding: "0.85rem",
              border: "none",
              background: paso === 2 ? "#0f172a" : "transparent",
              color: paso === 2 ? "#38bdf8" : "#94a3b8",
              fontWeight: 800,
              fontSize: "0.875rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              borderBottom: paso === 2 ? "3px solid #38bdf8" : "none",
            }}
          >
            <BookOpen size={16} /> 2.{" "}
            {esTecnologico
              ? "Carreras Técnicas & Módulos"
              : "Formaciones Laborales & Optativas FFE"}
          </button>
        </div>

        {/* Body scrollable */}
        <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1, background: "#0f172a" }}>
          {paso === 1 && (
            <MapaCurricularPaso1Estructura
              esTecnologico={esTecnologico}
              onSelectSubsistema={setSubsistemaSeleccionado}
              g1={g1}
              setG1={setG1}
              g2={g2}
              setG2={setG2}
              g3={g3}
              setG3={setG3}
              onContinuar={() => setPaso(2)}
            />
          )}

          {paso === 2 && (
            <MapaCurricularPaso2Configuracion
              esTecnologico={esTecnologico}
              gruposGenerados={gruposGenerados}
              mapaConfig={mapaConfig}
              carrerasTecnologicas={carrerasTecnologicas}
              handleUpdateGrupoConfig={handleUpdateGrupoConfig}
            />
          )}
        </div>

        {/* Footer */}
        <MapaCurricularFooter
          totalGrupos={g1 + g2 + g3}
          paso={paso}
          setPaso={setPaso}
          isAdmin={isAdmin}
          onClose={onClose}
          guardando={guardando}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}

export default function ModalConfiguracionMapaCurricular(props: Props) {
  if (process.env.NEXT_PUBLIC_FF_NEW_MAPA_MODAL === 'false') {
    return <ModalConfiguracionMapaCurricularLegacy {...props} />;
  }
  return <ModalConfiguracionMapaCurricularModular {...props} />;
}
