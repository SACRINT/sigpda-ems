"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Users, BookOpen, Clock, AlertCircle, ShieldCheck, UserCheck, Plus, Trash2, CheckCircle2, UserPlus, Layers, Search, Save, AlertTriangle, FileSpreadsheet, Download, Upload, Scissors, Edit2, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { parsearExcelPersonal, descargarPlantillaExcelDocentes, DocenteImportado } from "@/lib/excel-plantilla";
import { parsearExcelMatriz, parsearLibroIntegralExcel, descargarPlantillaIntegralHorarios, descargarPlantillaMatrizDocente, ResultadoParseoMatriz, ResultadoLibroIntegral } from "@/lib/excel-matriz";
import { normalizeUnicode } from "@/lib/utils/normalize";
import {
  HorariosPaso1Grupos,
  HorariosPaso2Docentes,
  HorariosPaso3Matriz,
  HorariosModales,
} from "./sections";


import type {
  ConfiguracionHorario,
  GrupoHorario,
  AulaHorario,
  DocenteHorario,
  CargaHoraria
} from "@/lib/horarios/types";

interface Props {
  escuelaId: string;
  configInicial: ConfiguracionHorario;
  gruposIniciales: GrupoHorario[];
  aulasIniciales: AulaHorario[];
  docentesIniciales: DocenteHorario[];
  cargasIniciales: CargaHoraria[];
  onGenerarClick: (params?: any) => void;
  pasoInicial?: number;
  onStepChange?: (paso: number) => void;
}

import {
  FORMACIONES_LABORALES,
  FORMACIONES_SOCIOEMOCIONALES,
  FORMACIONES_SOCIOEMOCIONALES as CURRICULUM_AMPLIADO_FFEO,
  FFE_RECURSOS_SOCIOCOGNITIVOS as FFE_RECURSO_SOCIOCOGNITIVO,
  FFE_AREAS_CONOCIMIENTO as FFE_AREA_CONOCIMIENTO,
  FFE_OPTATIVAS_CATALOGO,
  obtenerFfeSemestre6,
  resolverSocioemocionalGrupo,
  UACS_LABORALES_MAPA,
  obtenerAsignaturasParaGrupoTecnologico
} from "@/lib/escuela-grupos";
import {
  loadCarrerasTecnicas,
  CATALOGO_PROPEDUTICAS_5TO,
  type CarreraTecnica
} from "@/lib/bt-carreras-catalog";

export default function WizardConfiguracion({
  escuelaId,
  configInicial,
  gruposIniciales,
  aulasIniciales,
  docentesIniciales,
  cargasIniciales,
  onGenerarClick,
  pasoInicial = 1,
  onStepChange
}: Props) {
  const STORAGE_KEY = `horarios_wizard_v4_${escuelaId}`;

  const [paso, setPasoState] = useState<number>(pasoInicial);

  const setPaso = (nuevoPaso: number) => {
    setPasoState(nuevoPaso);
    if (typeof window !== "undefined" && escuelaId) {
      try {
        localStorage.setItem(`horarios_paso_${escuelaId}`, String(nuevoPaso));
      } catch {}
    }
    if (onStepChange) onStepChange(nuevoPaso);
  };

  useEffect(() => {
    if (pasoInicial && pasoInicial >= 1 && pasoInicial <= 3 && pasoInicial !== paso) {
      setPasoState(pasoInicial);
    }
  }, [pasoInicial]);

  // Período Semestral: A = semestres impares (1°,3°,5°), B = semestres pares (2°,4°,6°)
  const [periodoActivo, setPeriodoActivo] = useState<"A" | "B">("A");
  const [loading, setLoading] = useState<boolean>(false);
  const [carrerasTecnologicas, setCarrerasTecnologicas] = useState<CarreraTecnica[]>([]);

  useEffect(() => {
    loadCarrerasTecnicas().then(setCarrerasTecnologicas);
  }, []);

  // Jornada Escolar predeterminada (8 horas para Tecnológico por las 39h de 3er semestre, 6 para BGE)
  const [numPeriodos, setNumPeriodos] = useState<number>(() => {
    if (configInicial?.horasPorDia) return Number(configInicial.horasPorDia);
    if (configInicial?.horas_por_dia) return Number(configInicial.horas_por_dia);
    const sub = (configInicial?.escuela?.subsystem || configInicial?.subsystem || "").toLowerCase();
    if (sub.includes("tecnol")) return 8;
    return 6;
  });
  const [horaInicio, setHoraInicio] = useState<string>("08:00");

  // Flag: true = ya se cargaron grupos desde BD, NO regenerar automáticamente
  const [inicializadoDesdeBD, setInicializadoDesdeBD] = useState<boolean>(false);
  // Flag: true = el usuario cambió manualmente el número de grupos, SÍ regenerar
  const [usuarioCambioGrupos, setUsuarioCambioGrupos] = useState<boolean>(false);

  // Número de grupos por grado independiente (1º, 3º, 5º)
  const [g1, setG1] = useState<number>(() => {
    if (configInicial?.escuela?.gruposPrimerAno) return Number(configInicial.escuela.gruposPrimerAno);
    const g1Count = Math.max(
      (gruposIniciales || []).filter(g => g.semestre === 1).length,
      (gruposIniciales || []).filter(g => g.semestre === 2).length
    );
    return g1Count > 0 ? g1Count : 1;
  });
  const [g2, setG2] = useState<number>(() => {
    if (configInicial?.escuela?.gruposSegundoAno) return Number(configInicial.escuela.gruposSegundoAno);
    const g2Count = Math.max(
      (gruposIniciales || []).filter(g => g.semestre === 3).length,
      (gruposIniciales || []).filter(g => g.semestre === 4).length
    );
    return g2Count > 0 ? g2Count : 1;
  });
  const [g3, setG3] = useState<number>(() => {
    if (configInicial?.escuela?.gruposTercerAno) return Number(configInicial.escuela.gruposTercerAno);
    const g3Count = Math.max(
      (gruposIniciales || []).filter(g => g.semestre === 5).length,
      (gruposIniciales || []).filter(g => g.semestre === 6).length
    );
    return g3Count > 0 ? g3Count : 1;
  });

  // Datos del Plantel y Supervisión Escolar dinámicos
  const [nombreEscuela, setNombreEscuela] = useState<string>(() => configInicial?.escuela?.nombre || configInicial?.escuela?.school_name || "Mi Plantel");
  const [cctEscuela, setCctEscuela] = useState<string>(() => configInicial?.escuela?.cct || "");
  const [zonaEscolar, setZonaEscolar] = useState<string>(() => configInicial?.escuela?.zonaEscolar || configInicial?.escuela?.zona || "");

  const esTecnologico = React.useMemo(() => {
    const sub = (configInicial?.escuela?.subsystem || configInicial?.subsystem || "").toLowerCase();
    if (sub.includes("tecnol")) return true;
    return (gruposIniciales || []).some((g: any) => Boolean(g.carreraTecnicaId || g.carrera_tecnica_id));
  }, [configInicial, gruposIniciales]);

  useEffect(() => {
    if (esTecnologico && numPeriodos < 8) {
      setNumPeriodos(8);
    }
  }, [esTecnologico]);

  const [inicializadoConfig, setInicializadoConfig] = useState(false);

  // Sincronizar g1, g2, g3 y datos de escuela cuando cambia configInicial o escuelaId
  useEffect(() => {
    if (inicializadoConfig) return;

    if (configInicial?.escuela) {
      if (configInicial.escuela.gruposPrimerAno) setG1(Number(configInicial.escuela.gruposPrimerAno));
      if (configInicial.escuela.gruposSegundoAno) setG2(Number(configInicial.escuela.gruposSegundoAno));
      if (configInicial.escuela.gruposTercerAno) setG3(Number(configInicial.escuela.gruposTercerAno));
      if (configInicial.escuela.nombre) setNombreEscuela(configInicial.escuela.nombre);
      if (configInicial.escuela.cct) setCctEscuela(configInicial.escuela.cct);
      if (configInicial.escuela.zonaEscolar || configInicial.escuela.zona) {
        setZonaEscolar(configInicial.escuela.zonaEscolar || configInicial.escuela.zona || "");
      }
      setInicializadoConfig(true);
    } else if (gruposIniciales && gruposIniciales.length > 0) {
      const c1 = Math.max(
        gruposIniciales.filter(g => g.semestre === 1).length,
        gruposIniciales.filter(g => g.semestre === 2).length
      );
      const c2 = Math.max(
        gruposIniciales.filter(g => g.semestre === 3).length,
        gruposIniciales.filter(g => g.semestre === 4).length
      );
      const c3 = Math.max(
        gruposIniciales.filter(g => g.semestre === 5).length,
        gruposIniciales.filter(g => g.semestre === 6).length
      );
      if (c1 > 0) setG1(c1);
      if (c2 > 0) setG2(c2);
      if (c3 > 0) setG3(c3);
      setInicializadoConfig(true);
    }
  }, [configInicial, escuelaId, gruposIniciales, inicializadoConfig]);

  // ─── PRIORIDAD ABSOLUTA BD: Los grupos de la BD recargan y generan los grupos completos ───
  useEffect(() => {
    if (gruposIniciales && gruposIniciales.length > 0) {
      generarGruposSegunEstructura(g1, g2, g3);
      setInicializadoDesdeBD(true);
    }
  }, [gruposIniciales, escuelaId, g1, g2, g3]);

  // Modo de Configuración: Semiautomático (SEP General) vs Manual Libre (Tecnológicos)
  const [modoConfiguracion, setModoConfiguracion] = useState<"SEMIAUTOMATICO" | "MANUAL_TECNOLOGICO">("SEMIAUTOMATICO");

  // Tab activa en editor manual (letra del grupo: "A", "B", "C"...)
  const [grupoActivoManual, setGrupoActivoManual] = useState<string>("A");

  // Currículo manual por grupo: clave = "semestre_letra" (ej: "1_A", "3_B", "5_C")
  const [curriculoManualPorGrupo, setCurriculoManualPorGrupo] = useState<Record<string, any[]>>({});

  // Estado customUacsPorGrupo: mapa por grupo (id o nombre) con su lista de UACs personalizadas
  const [customUacsPorGrupo, setCustomUacsPorGrupo] = useState<Record<string, any[]>>(() => {
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem(`custom_uacs_${escuelaId}`);
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed && typeof parsed === "object") return parsed;
        }
      } catch (e) {
        console.warn("Error leyendo custom_uacs de localStorage", e);
      }
    }
    return {};
  });

  // Modales de personalización de UACs en Paso 3
  const [modalDividir, setModalDividir] = useState<{
    grupo: any;
    uac: any;
    horasTotalOriginal: number;
    horasA: number;
    horasB: number;
    nombreA: string;
    nombreB: string;
    abrevA: string;
    abrevB: string;
  } | null>(null);

  const [modalEditarNombre, setModalEditarNombre] = useState<{
    grupo: any;
    uac: any;
    nuevoNombre: string;
    nuevaAbrev: string;
  } | null>(null);

  const [modalAgregarUac, setModalAgregarUac] = useState<{
    grupo: any;
    nombre: string;
    abrev: string;
    horas: number;
    tipo: string;
  } | null>(null);

  // Estado de Grupos
  const [grupos, setGrupos] = useState<any[]>([]);

  // Docentes activos en la plantilla del horario
  const [docentes, setDocentes] = useState<any[]>(docentesIniciales || []);
  const [horasDocentes, setHorasDocentes] = useState<Record<string, number>>({});

  // Filtrado de personal apto para dar clases (excluir Apoyo / Asistencia)
  const docentesAptosParaHorario = React.useMemo(() => {
    return docentes.filter((d) => {
      if (!d.cargo) return true;
      const cargoUpper = String(d.cargo).toUpperCase();
      return (
        !cargoUpper.includes("ASISTENCIA") &&
        !cargoUpper.includes("APOYO") &&
        cargoUpper !== "PERSONAL_DE_ASISTENCIA" &&
        cargoUpper !== "APOYO_ADMINISTRATIVO"
      );
    });
  }, [docentes]);

  // Cargas Docente-Materia-Grupo (Paso 3)
  const normalizarCargas = (cargasRaw: any[]) => {
    if (!cargasRaw || cargasRaw.length === 0) return [];
    const mapa = new Map<string, any>();
    for (const c of cargasRaw) {
      const uacNameReal = c.uacName || c.asignatura?.uacName || c.asignaturaNombre;
      if (!c.uacName && uacNameReal) {
        c.uacName = uacNameReal;
      }
      const key = `${c.grupoId}__${c.uacName || c.asignaturaId}`;
      mapa.set(key, c);
    }
    return Array.from(mapa.values());
  };
  const [cargas, setCargas] = useState<any[]>(() => normalizarCargas(cargasIniciales || []));

  // Modal para agregar nuevo docente
  const [mostrarModalDocente, setMostrarModalDocente] = useState<boolean>(false);
  const [tabModalDocente, setTabModalDocente] = useState<"PLATAFORMA" | "MANUAL" | "EXCEL">("PLATAFORMA");
  const [personalPlataforma, setPersonalPlataforma] = useState<any[]>([]);
  const [busquedaPersonal, setBusquedaPersonal] = useState<string>("");

  const [nuevoDocenteNombre, setNuevoDocenteNombre] = useState<string>("");
  const [nuevoDocentePaterno, setNuevoDocentePaterno] = useState<string>("");
  const [nuevoDocenteMaterno, setNuevoDocenteMaterno] = useState<string>("");
  const [nuevoDocenteCargo, setNuevoDocenteCargo] = useState<string>("DOCENTE");
  const [nuevoDocenteEmail, setNuevoDocenteEmail] = useState<string>("");
  const [nuevoDocenteHoras, setNuevoDocenteHoras] = useState<number>(20);

  // Estados para Importación Masiva Excel de Personal (Paso 2)
  const [archivoExcelHorarios, setArchivoExcelHorarios] = useState<File | null>(null);
  const [docentesParseadosHorarios, setDocentesParseadosHorarios] = useState<DocenteImportado[]>([]);
  const [cargandoExcelHorarios, setCargandoExcelHorarios] = useState<boolean>(false);
  const fileInputHorariosRef = useRef<HTMLInputElement>(null);

  // Estados para Importación Masiva de Matriz Horaria Excel (Paso 3)
  const [mostrarModalMatrizExcel, setMostrarModalMatrizExcel] = useState<boolean>(false);
  const [archivoMatrizExcel, setArchivoMatrizExcel] = useState<File | null>(null);
  const [resultadoParseoMatriz, setResultadoParseoMatriz] = useState<ResultadoParseoMatriz | null>(null);
  const [cargandoMatrizExcel, setCargandoMatrizExcel] = useState<boolean>(false);
  const fileInputMatrizRef = useRef<HTMLInputElement>(null);

  // Cargar estado guardado previamente desde localStorage
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        // NOTA: NO sobreescribir 'paso', 'g1', 'g2', 'g3' desde localStorage para respetar la base de datos y la navegación directa del usuario
        if (parsed.numPeriodos) setNumPeriodos(parsed.numPeriodos);
        if ((!gruposIniciales || gruposIniciales.length === 0) && parsed.grupos && parsed.grupos.length > 0) {
          setGrupos(parsed.grupos);
        }
        if (parsed.horasDocentes) setHorasDocentes(parsed.horasDocentes);
        if (parsed.curriculoManualPorGrupo) setCurriculoManualPorGrupo(parsed.curriculoManualPorGrupo);
        if (parsed.grupoActivoManual) setGrupoActivoManual(parsed.grupoActivoManual);
        if (parsed.cargas && parsed.cargas.length > 0) setCargas(parsed.cargas);
        if (parsed.periodoActivo === "A" || parsed.periodoActivo === "B") setPeriodoActivo(parsed.periodoActivo);
        if (parsed.zonaEscolar) setZonaEscolar(parsed.zonaEscolar);
        if (parsed.nombreEscuela) setNombreEscuela(parsed.nombreEscuela);
        if (parsed.cctEscuela) setCctEscuela(parsed.cctEscuela);
      }
    } catch (e) {
      console.warn("No se pudo cargar estado local previo", e);
    }
  }, [escuelaId, gruposIniciales]);

  // Autoguardado continuo en localStorage
  const guardarProgresoLocal = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          paso,
          g1,
          g2,
          g3,
          numPeriodos,
          grupos,
          horasDocentes,
          curriculoManualPorGrupo,
          grupoActivoManual,
          cargas,
          periodoActivo,
          zonaEscolar,
          nombreEscuela,
          cctEscuela
        })
      );
    } catch (e) {
      console.warn("Error al guardar en localStorage", e);
    }
  };

  useEffect(() => {
    guardarProgresoLocal();
  }, [paso, g1, g2, g3, numPeriodos, grupos, horasDocentes, cargas, curriculoManualPorGrupo, grupoActivoManual, periodoActivo, zonaEscolar, nombreEscuela, cctEscuela]);

  useEffect(() => {
    cargarPersonalCompleto();
  }, [escuelaId]);

  useEffect(() => {
    if (docentesIniciales && docentesIniciales.length > 0 && docentes.length === 0) {
      setDocentes(docentesIniciales);
    }
  }, [docentesIniciales]);

  // Normaliza nombre de grupo: convierte tanto "3º A" como "3° A" a "3° A" (símbolo grado)
  const normalizarNombreGrupo = (nombre: string) =>
    (nombre || "").replace(/º/g, "°");

  // Sincronizar customUacs desde la base de datos (gruposIniciales)
  useEffect(() => {
    if (Array.isArray(gruposIniciales) && gruposIniciales.length > 0) {
      setCustomUacsPorGrupo((prev) => {
        const next = { ...prev };
        let huboCambios = false;
        gruposIniciales.forEach((g: any) => {
          let uacs = g.customUacs || g.custom_uacs;
          if (typeof uacs === "string") {
            try { uacs = JSON.parse(uacs); } catch {}
          }
          if (Array.isArray(uacs) && uacs.length > 0) {
            const keyId = g.id ? String(g.id) : "";
            const keyNombre = g.nombre ? String(g.nombre) : "";
            const keyNorm = g.nombre ? normalizarNombreGrupo(g.nombre) : "";
            if ((keyId && !next[keyId]) || (keyNombre && !next[keyNombre]) || (keyNorm && !next[keyNorm])) {
              if (keyId) next[keyId] = uacs;
              if (keyNombre) next[keyNombre] = uacs;
              if (keyNorm) next[keyNorm] = uacs;
              huboCambios = true;
            }
          }
        });
        if (huboCambios) {
          try {
            localStorage.setItem(`custom_uacs_${escuelaId}`, JSON.stringify(next));
          } catch {}
          return next;
        }
        return prev;
      });
    }
  }, [gruposIniciales, escuelaId]);

  const getCustomUacsDeGrupo = (grupo: any): any[] | null => {
    if (!grupo) return null;
    const keyId = grupo.id ? String(grupo.id) : "";
    const keyNombre = grupo.nombre ? String(grupo.nombre) : "";
    const keyNorm = grupo.nombre ? normalizarNombreGrupo(grupo.nombre) : "";

    const list = (keyId && customUacsPorGrupo[keyId]) ||
                 (keyNombre && customUacsPorGrupo[keyNombre]) ||
                 (keyNorm && customUacsPorGrupo[keyNorm]);

    if (Array.isArray(list) && list.length > 0) return list;
    return null;
  };

  const setCustomUacsDeGrupo = (grupo: any, nuevaLista: any[] | null) => {
    setCustomUacsPorGrupo((prev) => {
      const next = { ...prev };
      const keyId = grupo.id ? String(grupo.id) : "";
      const keyNombre = grupo.nombre ? String(grupo.nombre) : "";
      const keyNorm = grupo.nombre ? normalizarNombreGrupo(grupo.nombre) : "";

      if (nuevaLista === null) {
        if (keyId) delete next[keyId];
        if (keyNombre) delete next[keyNombre];
        if (keyNorm) delete next[keyNorm];
      } else {
        if (keyId) next[keyId] = nuevaLista;
        if (keyNombre) next[keyNombre] = nuevaLista;
        if (keyNorm) next[keyNorm] = nuevaLista;
      }

      try {
        localStorage.setItem(`custom_uacs_${escuelaId}`, JSON.stringify(next));
      } catch (e) {
        console.warn("Error guardando custom_uacs en localStorage", e);
      }
      return next;
    });
  };

  const generarGruposSegunEstructura = (n1: number, n2: number, n3: number) => {
    const letras = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const nuevosGrupos: any[] = [];
    const semestresActivos = [1, 2, 3, 4, 5, 6];
    const counts: Record<number, number> = {
      1: n1, 2: n1,
      3: n2, 4: n2,
      5: n3, 6: n3
    };

    const gruposActuales = grupos;

    for (let sem of semestresActivos) {
      const countSem = counts[sem] || 1;
      for (let i = 0; i < countSem; i++) {
        const letra = letras[i] || `G${i + 1}`;
        const nombreGrupo = `${sem}° ${letra}`;

        const grupoEnMemoria = gruposActuales.find(
          (g) => normalizarNombreGrupo(g.nombre) === nombreGrupo
        );
        const grupoDbOficial = (gruposIniciales || []).find(
          (g: any) => normalizarNombreGrupo(g.nombre) === nombreGrupo
        );

        let grupoExistente = grupoEnMemoria || grupoDbOficial;

        const semBaseTrack = sem === 4 ? 3 : sem === 6 ? 5 : sem;
        const nombreBaseTrack = `${semBaseTrack}° ${letra}`;
        const grupoBaseTrack = gruposActuales.find(
          (g: any) => normalizarNombreGrupo(g.nombre) === nombreBaseTrack
        ) || (gruposIniciales || []).find(
          (g: any) => normalizarNombreGrupo(g.nombre) === nombreBaseTrack
        );

        let ffeOpts = grupoExistente?.ffeOptativas || grupoDbOficial?.ffeOptativas || grupoBaseTrack?.ffeOptativas;
        if (typeof ffeOpts === "string") {
          try { ffeOpts = JSON.parse(ffeOpts); } catch { ffeOpts = null; }
        }

        const g3Socio = gruposActuales.find(g => normalizarNombreGrupo(g.nombre) === `3° ${letra}`)?.ffeoSocioemocional
          || (gruposIniciales || []).find((g: any) => normalizarNombreGrupo(g.nombre) === `3° ${letra}`)?.ffeoSocioemocional;
        const g5Socio = gruposActuales.find(g => normalizarNombreGrupo(g.nombre) === `5° ${letra}`)?.ffeoSocioemocional
          || (gruposIniciales || []).find((g: any) => normalizarNombreGrupo(g.nombre) === `5° ${letra}`)?.ffeoSocioemocional;
        const resolvedSocio = resolverSocioemocionalGrupo(g3Socio, g5Socio);

        let socioCalculado: string;
        if (sem === 3) {
          socioCalculado = grupoExistente?.ffeoSocioemocional || resolvedSocio.sem3;
        } else if (sem === 4) {
          socioCalculado = resolvedSocio.sem4;
        } else if (sem === 5) {
          socioCalculado = grupoExistente?.ffeoSocioemocional || resolvedSocio.sem5;
        } else if (sem === 6) {
          socioCalculado = resolvedSocio.sem6;
        } else {
          socioCalculado = FORMACIONES_SOCIOEMOCIONALES[0];
        }

        const tieneLaboral = sem >= 3;
        const capFinal = grupoExistente?.capacitacionNombre || grupoDbOficial?.capacitacionNombre || grupoBaseTrack?.capacitacionNombre || FORMACIONES_LABORALES[i % FORMACIONES_LABORALES.length];

        const hrsDia = grupoEnMemoria?.horasPorDia
          || grupoEnMemoria?.horas_por_dia
          || grupoDbOficial?.horasPorDia
          || grupoDbOficial?.horas_por_dia
          || (esTecnologico || grupoExistente?.carreraTecnicaId || grupoDbOficial?.carreraTecnicaId ? (sem === 3 ? 8 : sem === 5 ? 7 : 6) : (sem === 1 ? 5 : 6));

        nuevosGrupos.push({
          id: grupoExistente?.id || grupoDbOficial?.id || `temp_${sem}_${letra}`,
          nombre: nombreGrupo,
          semestre: sem,
          horasPorDia: Number(hrsDia),
          customUacs: grupoExistente?.customUacs || grupoDbOficial?.customUacs || undefined,
          capacitacionNombre: tieneLaboral ? capFinal : undefined,
          ffeoSocioemocional: tieneLaboral ? socioCalculado : undefined,
          ffeOptativas: (Array.isArray(ffeOpts) && ffeOpts.length > 0) ? ffeOpts : [
            FFE_OPTATIVAS_CATALOGO[0],
            FFE_OPTATIVAS_CATALOGO[1],
            FFE_OPTATIVAS_CATALOGO[7],
            FFE_OPTATIVAS_CATALOGO[8]
          ],
          carreraTecnicaId: grupoExistente?.carreraTecnicaId || grupoExistente?.carrera_tecnica_id || grupoDbOficial?.carreraTecnicaId || grupoDbOficial?.carrera_tecnica_id || grupoBaseTrack?.carreraTecnicaId || grupoBaseTrack?.carrera_tecnica_id || (esTecnologico ? "contabilidad" : undefined),
          versionPrograma: grupoExistente?.versionPrograma || grupoExistente?.version_programa || grupoDbOficial?.versionPrograma || grupoDbOficial?.version_programa || grupoBaseTrack?.versionPrograma || grupoBaseTrack?.version_programa || (esTecnologico ? "nuevo" : undefined),
          materiaPropedutica5to: grupoExistente?.materiaPropedutica5to || grupoExistente?.materia_propedutica_5to || grupoDbOficial?.materiaPropedutica5to || grupoDbOficial?.materia_propedutica_5to || grupoBaseTrack?.materiaPropedutica5to || grupoBaseTrack?.materia_propedutica_5to || (esTecnologico ? "Derecho y Sociedad I" : undefined)
        });
      }
    }
    setGrupos(nuevosGrupos);

    setCurriculoManualPorGrupo(prev => {
      const nuevoMapa = { ...prev };
      const semestresActivos2 = periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6];
      const counts2: Record<number, number> = periodoActivo === "A"
        ? { 1: n1, 3: n2, 5: n3 }
        : { 2: n1, 4: n2, 6: n3 };
      for (const sem of semestresActivos2) {
        const countSem = counts2[sem] || 1;
        for (let i = 0; i < countSem; i++) {
          const letra = letras[i] || `G${i + 1}`;
          const key = `${sem}_${letra}`;
          if (!nuevoMapa[key]) {
            nuevoMapa[key] = getDefaultMateriasSem(sem, letra);
          }
        }
      }
      return nuevoMapa;
    });

    const maxGrupos = Math.max(n1, n2, n3);
    const letrasActivas = letras.slice(0, maxGrupos);
    setGrupoActivoManual(prev => letrasActivas.includes(prev) ? prev : "A");
    return nuevosGrupos;
  };

  useEffect(() => {
    if (usuarioCambioGrupos) {
      generarGruposSegunEstructura(g1, g2, g3);
      setUsuarioCambioGrupos(false);
    }
  }, [g1, g2, g3, usuarioCambioGrupos]);

  const getDefaultMateriasSem = (sem: number, letra: string): any[] => {
    if (sem === 1) return [
      { id: `man_1_1_${letra}`, uacName: "Matemáticas Tecnológicas I", horasSemanales: 5 },
      { id: `man_1_2_${letra}`, uacName: "Química I", horasSemanales: 4 },
      { id: `man_1_3_${letra}`, uacName: "Lengua y Comunicación I", horasSemanales: 4 },
      { id: `man_1_4_${letra}`, uacName: "Inglés I", horasSemanales: 3 },
      { id: `man_1_5_${letra}`, uacName: "Tecnologías de la Información", horasSemanales: 4 }
    ];
    if (sem === 2) return [
      { id: `man_2_1_${letra}`, uacName: "Matemáticas Tecnológicas II", horasSemanales: 5 },
      { id: `man_2_2_${letra}`, uacName: "Química II", horasSemanales: 4 },
      { id: `man_2_3_${letra}`, uacName: "Lengua y Comunicación II", horasSemanales: 4 },
      { id: `man_2_4_${letra}`, uacName: "Inglés II", horasSemanales: 3 },
      { id: `man_2_5_${letra}`, uacName: "Tecnologías de la Información II", horasSemanales: 4 }
    ];
    if (sem === 3) return [
      { id: `man_3_1_${letra}`, uacName: "Física I", horasSemanales: 4 },
      { id: `man_3_2_${letra}`, uacName: "Cálculo Diferencial", horasSemanales: 5 },
      { id: `man_3_3_${letra}`, uacName: "Módulo Profesional I (Especialidad)", horasSemanales: 12 },
      { id: `man_3_4_${letra}`, uacName: "Inglés III", horasSemanales: 3 }
    ];
    if (sem === 4) return [
      { id: `man_4_1_${letra}`, uacName: "Física II", horasSemanales: 4 },
      { id: `man_4_2_${letra}`, uacName: "Cálculo Integral", horasSemanales: 5 },
      { id: `man_4_3_${letra}`, uacName: "Módulo Profesional I B (Especialidad)", horasSemanales: 12 },
      { id: `man_4_4_${letra}`, uacName: "Inglés IV", horasSemanales: 3 }
    ];
    if (sem === 5) return [
      { id: `man_5_1_${letra}`, uacName: "Cálculo Integral", horasSemanales: 5 },
      { id: `man_5_2_${letra}`, uacName: "Módulo Profesional II (Especialidad)", horasSemanales: 12 },
      { id: `man_5_3_${letra}`, uacName: "Ciencia, Tecnología y Sociedad", horasSemanales: 4 },
      { id: `man_5_4_${letra}`, uacName: "Inglés V", horasSemanales: 3 }
    ];
    if (sem === 6) return [
      { id: `man_6_1_${letra}`, uacName: "Estadística y Probabilidad", horasSemanales: 4 },
      { id: `man_6_2_${letra}`, uacName: "Módulo Profesional II B (Especialidad)", horasSemanales: 12 },
      { id: `man_6_3_${letra}`, uacName: "Ciencia, Tecnología y Sociedad II", horasSemanales: 4 },
      { id: `man_6_4_${letra}`, uacName: "Inglés VI", horasSemanales: 3 }
    ];
    return [];
  };

  const handleAgregarMateriaManual = (semestre: number, letra: string) => {
    const key = `${semestre}_${letra}`;
    const nuevaMateria = {
      id: `man_${semestre}_${letra}_${Date.now()}`,
      uacName: `Nueva Asignatura ${semestre}° Semestre`,
      horasSemanales: 4
    };
    setCurriculoManualPorGrupo(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), nuevaMateria]
    }));
    toast.success(`Asignatura agregada al Grupo ${letra} – ${semestre}° Semestre`);
  };

  const handleActualizarMateriaManual = (semestre: number, letra: string, index: number, field: string, value: any) => {
    const key = `${semestre}_${letra}`;
    setCurriculoManualPorGrupo(prev => {
      const copia = [...(prev[key] || [])];
      copia[index] = { ...copia[index], [field]: value };
      return { ...prev, [key]: copia };
    });
  };

  const handleEliminarMateriaManual = (semestre: number, letra: string, index: number) => {
    const key = `${semestre}_${letra}`;
    setCurriculoManualPorGrupo(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_: any, i: number) => i !== index)
    }));
    toast.success("Asignatura removida");
  };

  // Inicializar horas por docente (0 hrs para Administrativos/Apoyo/Responsable, 20 hrs para Docentes)
  useEffect(() => {
    if (docentes.length > 0) {
      const mapaHoras: Record<string, number> = { ...horasDocentes };
      docentes.forEach((d) => {
        if (mapaHoras[d.id] === undefined) {
          const esDocentePuro = d.cargo === "DOCENTE";
          mapaHoras[d.id] = d.horasAsignadas !== undefined ? d.horasAsignadas : (d.horasOficiales !== undefined ? d.horasOficiales : (esDocentePuro ? 20 : 0));
        }
      });
      setHorasDocentes(mapaHoras);
    }
  }, [docentes]);

  const cargarPersonalCompleto = async () => {
    try {
      const res = await fetch(`/api/horarios/catalogos`);
      const data = await res.json();
      const arrayPersonal = data.docentes || (Array.isArray(data) ? data : []);
      setPersonalPlataforma(arrayPersonal);
    } catch (e) {
      console.error("Error al cargar personal de la escuela:", e);
    }
  };

  const handleActualizarConfigGrupo = (index: number, field: string, value: any) => {
    const copia = [...grupos];
    copia[index][field] = value;

    if (field === "ffeoSocioemocional") {
      const sem = copia[index].semestre;
      const letraGrupo = copia[index].nombre.split(" ")[1];

      if (sem === 3 || sem === 5) {
        const g3 = copia.find((g) => g.semestre === 3 && g.nombre.endsWith(letraGrupo));
        const g5 = copia.find((g) => g.semestre === 5 && g.nombre.endsWith(letraGrupo));

        const socio3 = g3?.ffeoSocioemocional;
        const socio5 = g5?.ffeoSocioemocional;
        const resolved = resolverSocioemocionalGrupo(socio3, socio5);

        if (g3) g3.ffeoSocioemocional = resolved.sem3;
        if (g5) g5.ffeoSocioemocional = resolved.sem5;

        const g4 = copia.find((g) => g.semestre === 4 && g.nombre.endsWith(letraGrupo));
        if (g4) g4.ffeoSocioemocional = resolved.sem4;

        const g6 = copia.find((g) => g.semestre === 6 && g.nombre.endsWith(letraGrupo));
        if (g6) g6.ffeoSocioemocional = resolved.sem6;
      }
    }

    setGrupos(copia);
  };

  const handleActualizarOptativaGrupo = (grupoIdx: number, optativaIdx: number, value: string) => {
    const copia = [...grupos];
    const optativas = [...(copia[grupoIdx].ffeOptativas || [])];
    optativas[optativaIdx] = value;
    copia[grupoIdx].ffeOptativas = optativas;
    setGrupos(copia);
  };

  const handleEliminarDocentePlantilla = (docenteId: string) => {
    setDocentes(docentes.filter((d) => d.id !== docenteId));
    const copiaHoras = { ...horasDocentes };
    delete copiaHoras[docenteId];
    setHorasDocentes(copiaHoras);
    setCargas(cargas.filter((c) => c.personalId !== docenteId));
    toast.success("Docente removido de la plantilla activa.");
  };

  const handleAgregarPersonalExistente = (persona: any) => {
    if (docentes.some((d) => d.id === persona.id)) {
      toast.error("El personal ya está en la plantilla.");
      return;
    }
    setDocentes([...docentes, persona]);
    const esDocentePuro = persona.cargo === "DOCENTE";
    setHorasDocentes({ ...horasDocentes, [persona.id]: esDocentePuro ? 20 : 0 });
    toast.success(`${persona.nombre} ${persona.apellidoPaterno} agregado a la plantilla.`);
    setMostrarModalDocente(false);
  };

  const handleCrearNuevoDocenteManual = async () => {
    if (!nuevoDocenteNombre.trim() || !nuevoDocentePaterno.trim()) {
      toast.error("El nombre y apellido paterno son obligatorios.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/horarios/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "CREAR_DOCENTE",
          escuelaId,
          nombre: nuevoDocenteNombre.trim(),
          apellidoPaterno: nuevoDocentePaterno.trim(),
          apellidoMaterno: nuevoDocenteMaterno.trim(),
          cargo: nuevoDocenteCargo,
          email: nuevoDocenteEmail.trim(),
          horasBase: nuevoDocenteHoras,
        })
      });
      const data = await res.json();
      if (data.success && data.docente) {
        toast.success(`${nuevoDocenteCargo === "DOCENTE" ? "Docente" : "Personal"} ${data.docente.nombre} ${data.docente.apellidoPaterno} registrado y agregado.`);
        setDocentes([...docentes, data.docente]);
        setHorasDocentes({ ...horasDocentes, [data.docente.id]: nuevoDocenteHoras });
        setNuevoDocenteNombre("");
        setNuevoDocentePaterno("");
        setNuevoDocenteMaterno("");
        setNuevoDocenteEmail("");
        setNuevoDocenteCargo("DOCENTE");
        setNuevoDocenteHoras(20);
        setMostrarModalDocente(false);
        cargarPersonalCompleto();
      } else {
        toast.error(data.error || "Error al registrar docente.");
      }
    } catch (e) {
      toast.error("Error de conexión al agregar docente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCargarArchivoExcelHorarios = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoExcelHorarios(file);
    setCargandoExcelHorarios(true);
    try {
      const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
      const resIntegral = await parsearLibroIntegralExcel(file, gruposDelPeriodoActual, getUACsIndividualesGrupo, personalPlataforma);

      setDocentesParseadosHorarios(resIntegral.docentes);
      if (resIntegral.tieneMatriz) {
        setResultadoParseoMatriz(resIntegral.matriz);
      }

      if (resIntegral.docentes.length === 0 && !resIntegral.tieneMatriz) {
        toast.error("No se encontraron datos válidos de personal ni horarios en el archivo.");
      } else if (resIntegral.tienePersonal && resIntegral.tieneMatriz) {
        toast.success(`¡Libro Integral detectado! ${resIntegral.docentes.filter(d => d.valido).length} docentes y ${resIntegral.matriz.resumen.asignadasConExito} materias.`);
      } else if (resIntegral.tienePersonal) {
        toast.success(`Se encontraron ${resIntegral.docentes.filter(d => d.valido).length} registros de personal.`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error al procesar el archivo Excel / CSV.");
    } finally {
      setCargandoExcelHorarios(false);
    }
  };

  const handleImportarExcelEnHorarios = async () => {
    const validos = docentesParseadosHorarios.filter(d => d.valido);
    setLoading(true);
    try {
      let arrayPersonal = [...personalPlataforma];

      if (validos.length > 0) {
        const res = await fetch("/api/escuela-personal/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personal: validos }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast.error(data.error || "Error al importar personal.");
          return;
        }

        arrayPersonal = data.docentes || [];
        if (!arrayPersonal || arrayPersonal.length === 0) {
          const resCat = await fetch(`/api/horarios/catalogos`);
          const dataCat = await resCat.json();
          arrayPersonal = dataCat.docentes || (Array.isArray(dataCat) ? dataCat : []);
        }

        setPersonalPlataforma(arrayPersonal);

        const mapaHorasActualizado = { ...horasDocentes };
        arrayPersonal.forEach((p: any) => {
          const esDocentePuro = p.cargo === "DOCENTE";
          const hrs = p.horasAsignadas !== undefined ? p.horasAsignadas : (p.horas_base !== undefined ? p.horas_base : (esDocentePuro ? 20 : 0));
          mapaHorasActualizado[p.id] = hrs;
        });

        setDocentes(arrayPersonal);
        setHorasDocentes(mapaHorasActualizado);
      }

      // Si el archivo también incluía la Hoja de Matriz Horaria, aplicarla
      if (resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0) {
        const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
        // Reparsear la matriz con los IDs de docentes actualizados de la base de datos
        if (archivoExcelHorarios) {
          const reparseado = await parsearExcelMatriz(archivoExcelHorarios, gruposDelPeriodoActual, getUACsIndividualesGrupo, arrayPersonal);
          const cargasValidas = reparseado.cargas.filter(c => c.valido && c.personalId);
          if (cargasValidas.length > 0) {
            const mapaCargas = new Map<string, any>();
            cargas.forEach(c => mapaCargas.set(`${c.grupoId}___${c.uacName || c.asignaturaId}`, c));
            cargasValidas.forEach(c => {
              mapaCargas.set(`${c.grupoId}___${c.uacName}`, {
                grupoId: c.grupoId,
                asignaturaId: c.uacName,
                uacName: c.uacName,
                personalId: c.personalId,
                horasSemanales: c.horasSemanales,
                requiereAulaEspecial: false,
              });
            });
            setCargas(Array.from(mapaCargas.values()));
          }
        }
      }

      toast.success(
        resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0
          ? "¡Plantilla de personal y matriz horaria importadas con éxito!"
          : "¡Plantilla de personal importada con éxito!"
      );

      // Limpiar estados de Excel y cerrar modal
      setArchivoExcelHorarios(null);
      setDocentesParseadosHorarios([]);
      if (fileInputHorariosRef.current) fileInputHorariosRef.current.value = "";
      setMostrarModalDocente(false);
    } catch (e) {
      toast.error("Error de conexión al importar plantilla.");
    } finally {
      setLoading(false);
    }
  };

  const handleCargarArchivoMatrizExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoMatrizExcel(file);
    setCargandoMatrizExcel(true);
    try {
      const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
      const resIntegral = await parsearLibroIntegralExcel(file, gruposDelPeriodoActual, getUACsIndividualesGrupo, docentes);

      setResultadoParseoMatriz(resIntegral.matriz);
      if (resIntegral.tienePersonal) {
        setDocentesParseadosHorarios(resIntegral.docentes);
      }

      if (resIntegral.matriz.cargas.length === 0 && resIntegral.docentes.length === 0) {
        toast.error("No se encontraron materias ni grupos válidos en el archivo.");
      } else if (resIntegral.tienePersonal && resIntegral.tieneMatriz) {
        toast.success(`¡Libro Integral detectado! ${resIntegral.docentes.filter(d => d.valido).length} docentes y ${resIntegral.matriz.resumen.asignadasConExito} asignaciones.`);
      } else if (resIntegral.matriz.resumen.asignadasConExito > 0) {
        toast.success(`Se detectaron ${resIntegral.matriz.resumen.asignadasConExito} asignaciones para ${resIntegral.matriz.gruposDetectados.length} grupo(s).`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error al procesar el archivo Excel de la Matriz.");
    } finally {
      setCargandoMatrizExcel(false);
    }
  };

  const handleConfirmarImportacionMatriz = async () => {
    const docentesValidos = docentesParseadosHorarios.filter(d => d.valido);
    const hayCargasEnMatriz = resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0;

    if (docentesValidos.length === 0 && !hayCargasEnMatriz) {
      toast.error("No se encontraron registros de docentes ni asignaciones en el archivo.");
      return;
    }

    setLoading(true);
    try {
      let arrayPersonal = [...docentes];

      // 1. Si el archivo tenía docentes en la Hoja 1, registrarlos/actualizarlos en bulk
      if (docentesValidos.length > 0) {
        const res = await fetch("/api/escuela-personal/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personal: docentesValidos }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.docentes) {
          arrayPersonal = data.docentes;
          setPersonalPlataforma(arrayPersonal);
          setDocentes(arrayPersonal);

          const mapaHoras = { ...horasDocentes };
          arrayPersonal.forEach((p: any) => {
            mapaHoras[p.id] = p.horasAsignadas ?? p.horas_base ?? (p.cargo === "DOCENTE" ? 20 : 0);
          });
          setHorasDocentes(mapaHoras);
        }
      }

      // 2. Si hay asignaciones en la matriz, aplicarlas con los IDs de docentes actualizados
      let numAsignadas = 0;
      if (hayCargasEnMatriz && archivoMatrizExcel) {
        const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
        const reparseado = await parsearExcelMatriz(archivoMatrizExcel, gruposDelPeriodoActual, getUACsIndividualesGrupo, arrayPersonal);
        const cargasValidas = reparseado.cargas.filter(c => c.valido && c.personalId);

        if (cargasValidas.length > 0) {
          const mapaCargas = new Map<string, any>();
          cargas.forEach((c) => {
            const key = `${c.grupoId}___${c.uacName || c.asignaturaId}`;
            mapaCargas.set(key, c);
          });

          cargasValidas.forEach((c) => {
            const key = `${c.grupoId}___${c.uacName}`;
            mapaCargas.set(key, {
              grupoId: c.grupoId,
              asignaturaId: c.uacName,
              uacName: c.uacName,
              personalId: c.personalId,
              horasSemanales: c.horasSemanales,
              requiereAulaEspecial: false,
            });
          });

          setCargas(Array.from(mapaCargas.values()));
          numAsignadas = cargasValidas.length;
        }
      }

      if (numAsignadas > 0 && docentesValidos.length > 0) {
        toast.success(`¡Importación exitosa! ${docentesValidos.length} docentes sincronizados y ${numAsignadas} materias asignadas.`);
      } else if (numAsignadas > 0) {
        toast.success(`¡Matriz actualizada! ${numAsignadas} materias asignadas a docentes.`);
      } else if (docentesValidos.length > 0) {
        toast.success(`¡Personal sincronizado con éxito (${docentesValidos.length} docentes)!`);
      }

      setMostrarModalMatrizExcel(false);
      setArchivoMatrizExcel(null);
      setResultadoParseoMatriz(null);
      setDocentesParseadosHorarios([]);
      if (fileInputMatrizRef.current) fileInputMatrizRef.current.value = "";
    } catch (e) {
      toast.error("Error al procesar la importación.");
    } finally {
      setLoading(false);
    }
  };

  const matchGrupoCarga = (cargaGrupoId: string, grpIdOrNombre: string) => {
    if (!cargaGrupoId || !grpIdOrNombre) return false;
    if (cargaGrupoId === grpIdOrNombre) return true;
    const grp = grupos.find(g => g.id === grpIdOrNombre || g.nombre === grpIdOrNombre);
    if (grp) {
      if (cargaGrupoId === grp.id || cargaGrupoId === grp.nombre) return true;
      if (normalizarNombreGrupo(cargaGrupoId) === normalizarNombreGrupo(grp.nombre)) return true;
    }
    return normalizarNombreGrupo(cargaGrupoId) === normalizarNombreGrupo(grpIdOrNombre);
  };

  const matchUacCarga = (cargaUac: string, cargaAsigId: string, uacObj: any) => {
    if (!uacObj) return false;
    if (cargaUac === uacObj.uacName || (cargaAsigId && cargaAsigId === uacObj.id)) return true;
    const normCarga = normalizeUnicode(cargaUac || '').trim().toUpperCase();
    const normObj = normalizeUnicode(uacObj.uacName || '').trim().toUpperCase();
    if (normCarga === normObj) return true;
    if (normCarga.includes('TALLER DE CIENCIAS') && normObj.includes('TALLER DE CIENCIAS')) return true;
    return false;
  };

  const handleAsignarDocenteMatriz = (grupoId: string, uacObj: any, personalId: string) => {
    const uacName = uacObj.uacName;
    const asignaturaId = uacObj.id;
    const horasSemanales = uacObj.horasSemanales || 3;

    const cargasLimpias = cargas.filter(
      (c) => !(matchGrupoCarga(c.grupoId, grupoId) && matchUacCarga(c.uacName, c.asignaturaId, uacObj))
    );

    if (!personalId) {
      setCargas(cargasLimpias);
      return;
    }

    setCargas([
      ...cargasLimpias,
      {
        grupoId,
        asignaturaId,
        uacName,
        personalId,
        horasSemanales,
        requiereAulaEspecial: false
      }
    ]);
  };

  const getDocenteAsignado = (grupoId: string, uacObj: any) => {
    const matches = cargas.filter(
      (c) => matchGrupoCarga(c.grupoId, grupoId) && matchUacCarga(c.uacName, c.asignaturaId, uacObj)
    );
    const asignacion = matches.length > 0 ? matches[matches.length - 1] : undefined;
    return asignacion?.personalId || "";
  };

  const getHorasConsumidasDocente = (docenteId: string, excludeGrupoId?: string, excludeUacId?: string) => {
    let total = 0;

    grupos.forEach((g) => {
      const uacs = getUACsIndividualesGrupo(g);
      uacs.forEach((uac) => {
        if (excludeGrupoId && excludeUacId && g.id === excludeGrupoId && (uac.id === excludeUacId || uac.uacName === excludeUacId)) {
          return;
        }
        const asignadoId = getDocenteAsignado(g.id, uac);
        if (asignadoId === docenteId) {
          total += (uac.horasSemanales || 3);
        }
      });
    });

    return total;
  };

  const handleAvanzarPaso1 = async () => {
    const gruposGenerados = generarGruposSegunEstructura(g1, g2, g3);
    const gruposFinales = (gruposGenerados && gruposGenerados.length > 0 ? gruposGenerados : grupos);
    const gruposAGuardar = gruposFinales.map((g: any) => ({
      ...g,
      horasPorDia: g.horasPorDia ? Number(g.horasPorDia) : (g.horas_por_dia ? Number(g.horas_por_dia) : (esTecnologico || g.carreraTecnicaId ? (g.semestre === 3 ? 8 : g.semestre === 5 ? 7 : 6) : (g.semestre === 1 ? 5 : 6))),
      customUacs: g.customUacs || undefined
    }));

    try {
      await fetch("/api/horarios/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escuelaId,
          config: {
            diasLectivos: 5,
            horasPorDia: numPeriodos,
            horaInicio,
            periodoActivo,
            g1, g2, g3,
            zonaEscolar
          },
          grupos: gruposAGuardar,
          escuela: {
            id: escuelaId,
            nombre: nombreEscuela,
            cct: cctEscuela,
            zonaEscolar,
            zona: zonaEscolar,
            gruposPrimerAno: g1,
            gruposSegundoAno: g2,
            gruposTercerAno: g3,
            mapaCurricularCompletado: true
          }
        })
      });
    } catch (e) {
      console.error("[handleAvanzarPaso1] Error al guardar configuración de grupos:", e);
    }

    guardarProgresoLocal();
    if (typeof window !== "undefined" && escuelaId) {
      try {
        localStorage.setItem(`horarios_paso_${escuelaId}`, "2");
      } catch {}
    }
    setPaso(2);
  };

  const handleAvanzarPaso2 = () => {
    guardarProgresoLocal();
    setPaso(3);
  };

  const handleGuardarConfiguracion = async () => {
    setLoading(true);

    const docentesSobrecargados = docentes.filter((d) => {
      const hrsConsumidas = getHorasConsumidasDocente(d.id);
      const hrsMax = horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0);
      return hrsConsumidas > hrsMax;
    });

    if (docentesSobrecargados.length > 0) {
      toast.error(`Atención: ${docentesSobrecargados.length} docente(s) exceden sus horas contratadas. Por favor reasigne materias.`);
      setLoading(false);
      return;
    }

    const cargasCompletas: any[] = [];
    grupos.forEach((g) => {
      const uacs = getUACsIndividualesGrupo(g);
      uacs.forEach((uac) => {
        const docenteId = getDocenteAsignado(g.id, uac);
        if (docenteId) {
          cargasCompletas.push({
            grupoId: g.id,
            asignaturaId: uac.id,
            uacName: uac.uacName,
            personalId: docenteId,
            docenteId: docenteId,
            horasSemanales: uac.horasSemanales || 3,
            tipo: uac.tipo || "fundamental"
          });
        }
      });
    });

    if (cargasCompletas.length === 0) {
      toast.error("Debe asignar al menos una materia a un docente en el Paso 3 antes de generar el horario.");
      setLoading(false);
      return;
    }

    // Calcular requerimiento diario por grupo según sus asignaturas
    let maxHorasDiariasRequeridas = 6;
    for (const g of grupos) {
      const uacs = getUACsIndividualesGrupo(g);
      const totalHorasGrupo = uacs.reduce((sum: number, u: any) => sum + (Number(u.horas) || 0), 0);
      const minDiarias = Math.ceil(totalHorasGrupo / 5);
      if (minDiarias > maxHorasDiariasRequeridas) {
        maxHorasDiariasRequeridas = minDiarias;
      }
    }

    const periodosFinales = Math.max(numPeriodos, maxHorasDiariasRequeridas);
    if (periodosFinales !== numPeriodos) {
      setNumPeriodos(periodosFinales);
    }

    const gruposConCustom = grupos.map((g) => {
      const customList = getCustomUacsDeGrupo(g);
      const uacs = getUACsIndividualesGrupo(g);
      const totalHorasGrupo = uacs.reduce((sum: number, u: any) => sum + (Number(u.horas) || 0), 0);
      const minDiarias = Math.ceil(totalHorasGrupo / 5);
      return {
        ...g,
        horasPorDia: g.horasPorDia ? Number(g.horasPorDia) : Math.max(minDiarias, (esTecnologico || g.carreraTecnicaId ? (g.semestre === 3 ? 8 : g.semestre === 5 ? 7 : 6) : (g.semestre === 1 ? 5 : 6))),
        customUacs: customList && customList.length > 0 ? customList : (g.customUacs || null)
      };
    });

    try {
      localStorage.setItem(`custom_uacs_${escuelaId}`, JSON.stringify(customUacsPorGrupo));
    } catch (e) {
      console.warn("Error guardando custom_uacs en localStorage", e);
    }

    try {
      const res = await fetch("/api/horarios/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escuelaId,
          config: {
            diasLectivos: 5,
            horasPorDia: periodosFinales,
            horaInicio,
            periodoActivo
          },
          grupos: gruposConCustom,
          aulas: aulasIniciales.length > 0 ? aulasIniciales : [{ nombre: "Aula General", tipo: "REGULAR" }],
          cargas: cargasCompletas,
          escuela: {
            id: escuelaId,
            nombre: nombreEscuela,
            cct: cctEscuela,
            zonaEscolar,
            zona: zonaEscolar,
            gruposPrimerAno: g1,
            gruposSegundoAno: g2,
            gruposTercerAno: g3,
            mapaCurricularCompletado: true,
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Configuración guardada correctamente");
        onGenerarClick({
          grupos: gruposConCustom,
          docentes,
          aulas: aulasIniciales.length > 0 ? aulasIniciales : [{ id: "aula-gen", nombre: "Aula General", tipo: "REGULAR" }],
          cargas: cargasCompletas,
          config: {
            diasLectivos: 5,
            horasPorDia: periodosFinales,
            horaInicio,
            periodoActivo,
            zonaEscolar
          },
          escuela: {
            id: escuelaId,
            nombre: nombreEscuela,
            cct: cctEscuela,
            zonaEscolar,
            zona: zonaEscolar,
            gruposPrimerAno: g1,
            gruposSegundoAno: g2,
            gruposTercerAno: g3,
            mapaCurricularCompletado: true
          },
          diasLectivos: 5,
          horasPorDia: periodosFinales,
          horaInicio
        });
      } else {
        toast.error(data.error || "Error al guardar configuración");
      }
    } catch (e) {
      toast.error("Error de conexión al servidor");
    } finally {
      setLoading(false);
    }
  };

  const getUACsIndividualesGrupo = (grupo: any) => {
    // 1. Si el grupo tiene una lista personalizada de UACs (horas modificadas, divididas o agregadas), usarla con máxima prioridad
    const customList = getCustomUacsDeGrupo(grupo);
    if (customList && customList.length > 0) {
      return customList;
    }

    const sem = grupo.semestre;

    if (modoConfiguracion === "MANUAL_TECNOLOGICO") {
      const letraGrupo = grupo.nombre.split(" ")[1] || "A";
      const key = `${sem}_${letraGrupo}`;
      const listaCustom = curriculoManualPorGrupo[key] || [];
      return listaCustom.map((m: any, i: number) => ({
        id: m.id || `uac_custom_${sem}_${letraGrupo}_${i}`,
        uacName: m.uacName,
        abrev: (m.uacName || "UAC").substring(0, 10).toUpperCase(),
        tipo: "CUSTOM_MANUAL",
        horasSemanales: Number(m.horasSemanales || 3)
      }));
    }

    // Si el grupo pertenece a un Bachillerato Tecnológico o tiene Carrera Técnica configurada
    const carreraId = grupo.carreraTecnicaId || (esTecnologico ? "contabilidad" : undefined);
    if (carreraId) {
      const versionProg = (grupo.versionPrograma as "nuevo" | "anterior") || "nuevo";
      const propedutica = grupo.materiaPropedutica5to || "Derecho y Sociedad I";

      const asignaturasTec = obtenerAsignaturasParaGrupoTecnologico(sem, carreraId, versionProg, propedutica);
      return asignaturasTec.map((asig, i) => ({
        id: `uac_tec_${sem}_${i + 1}`,
        uacName: asig.nombre,
        abrev: asig.nombre.substring(0, 12).toUpperCase(),
        tipo: asig.tipo,
        horasSemanales: asig.horas,
        carreraId
      }));
    }

    if (sem === 1) {
      return [
        { id: `uac_1_1`, uacName: "Ciencias Naturales, Experimentales y Tecnología I", abrev: "CNEyT-I", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_1_2`, uacName: "Pensamiento Matemático I", abrev: "PENS-MAT-I", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_1_3`, uacName: "Humanidades I", abrev: "HUM-I", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_1_4`, uacName: "Lenguaje y Comunicación I", abrev: "LENG-COM-I", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_1_5`, uacName: "Inglés I", abrev: "ING-I", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_1_6`, uacName: "Cultura Digital I", abrev: "CULT-DIG-I", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_1_8`, uacName: "Ciencias Sociales I", abrev: "CS-SOC-I", tipo: "UNIVERSAL", horasSemanales: 2 },
        { id: `uac_1_10`, uacName: "Actividades Físicas y Deportivas I", abrev: "ACT-FIS-I", tipo: "UNIVERSAL", horasSemanales: 2 }
      ];
    }

    if (sem === 3) {
      const capNombre = grupo.capacitacionNombre || FORMACIONES_LABORALES[0];
      const uacsLabInfo = UACS_LABORALES_MAPA[capNombre]?.sem3 || [
        { name: `Asignatura 1 de ${capNombre}`, abrev: "LAB-1" },
        { name: `Asignatura 2 de ${capNombre}`, abrev: "LAB-2" }
      ];

      return [
        { id: `uac_3_1`, uacName: "Ciencias Naturales, Experimentales y Tecnología III", abrev: "CNEyT-III", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_3_2`, uacName: "Pensamiento Matemático III", abrev: "PENS-MAT-III", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_3_3`, uacName: "Humanidades III", abrev: "HUM-III", tipo: "UNIVERSAL", horasSemanales: 5 },
        { id: `uac_3_4`, uacName: "Taller de Ciencias II", abrev: "TALL-CIEN-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_3_5`, uacName: grupo.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0], abrev: "CURR-AMP-3", tipo: "AMPLIADO", horasSemanales: 2 },
        { id: `uac_3_6`, uacName: "Lengua y Comunicación III", abrev: "LENG-COM-III", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_3_7`, uacName: "Inglés III", abrev: "ING-III", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_3_lab_a`, uacName: uacsLabInfo[0].name, abrev: uacsLabInfo[0].abrev, capNombre, tipo: "LABORAL_A", horasSemanales: 3 },
        { id: `uac_3_lab_b`, uacName: uacsLabInfo[1].name, abrev: uacsLabInfo[1].abrev, capNombre, tipo: "LABORAL_B", horasSemanales: 3 }
      ];
    }

    if (sem === 5) {
      const capNombre = grupo.capacitacionNombre || FORMACIONES_LABORALES[0];
      const uacsLabInfo = UACS_LABORALES_MAPA[capNombre]?.sem5 || [
        { name: `Asignatura 1 de ${capNombre}`, abrev: "LAB-1" },
        { name: `Asignatura 2 de ${capNombre}`, abrev: "LAB-2" }
      ];
      const opts = grupo.ffeOptativas || [
        FFE_OPTATIVAS_CATALOGO[0],
        FFE_OPTATIVAS_CATALOGO[1],
        FFE_OPTATIVAS_CATALOGO[7],
        FFE_OPTATIVAS_CATALOGO[8]
      ];

      return [
        { id: `uac_5_1`, uacName: "La Energía en los Procesos de la Vida Diaria", abrev: "ENERG-VIDA", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_5_2`, uacName: "Conciencia Histórica II. México Durante el Expansionismo Capitalista", abrev: "CONC-HIST-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_5_3`, uacName: "Taller de Habilidades del Pensamiento", abrev: "TALL-HAB-PENS", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_5_ffe_1`, uacName: opts[0] || FFE_OPTATIVAS_CATALOGO[0], abrev: "FFE-1", tipo: "FFE_1", horasSemanales: 3 },
        { id: `uac_5_ffe_2`, uacName: opts[1] || FFE_OPTATIVAS_CATALOGO[1], abrev: "FFE-2", tipo: "FFE_2", horasSemanales: 3 },
        { id: `uac_5_ffe_3`, uacName: opts[2] || FFE_OPTATIVAS_CATALOGO[7], abrev: "FFE-3", tipo: "FFE_3", horasSemanales: 3 },
        { id: `uac_5_ffe_4`, uacName: opts[3] || FFE_OPTATIVAS_CATALOGO[8], abrev: "FFE-4", tipo: "FFE_4", horasSemanales: 3 },
        { id: `uac_5_5`, uacName: grupo.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[1], abrev: "CURR-AMP-5", tipo: "AMPLIADO", horasSemanales: 2 },
        { id: `uac_5_lab_a`, uacName: uacsLabInfo[0].name, abrev: uacsLabInfo[0].abrev, capNombre, tipo: "LABORAL_A", horasSemanales: 3 },
        { id: `uac_5_lab_b`, uacName: uacsLabInfo[1].name, abrev: uacsLabInfo[1].abrev, capNombre, tipo: "LABORAL_B", horasSemanales: 3 }
      ];
    }

    if (sem === 2) {
      return [
        { id: `uac_2_1`, uacName: "Ciencias Naturales, Experimentales y Tecnología II", abrev: "CNEyT-II", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_2_2`, uacName: "Pensamiento Matemático II", abrev: "PENS-MAT-II", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_2_3`, uacName: "Humanidades II", abrev: "HUM-II", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_2_4`, uacName: "Lenguaje y Comunicación II", abrev: "LENG-COM-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_2_5`, uacName: "Inglés II", abrev: "ING-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_2_6`, uacName: "Cultura Digital II", abrev: "CULT-DIG-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_2_7`, uacName: "Laboratorio de Investigación II", abrev: "LAB-INV-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_2_8`, uacName: "Ciencias Sociales II", abrev: "CS-SOC-II", tipo: "UNIVERSAL", horasSemanales: 2 },
        { id: `uac_2_9`, uacName: "Actividades Artísticas y Culturales II", abrev: "ART-CULT-II", tipo: "UNIVERSAL", horasSemanales: 2 },
        { id: `uac_2_10`, uacName: "Actividades Físicas y Deportivas II", abrev: "ACT-FIS-II", tipo: "UNIVERSAL", horasSemanales: 2 }
      ];
    }

    if (sem === 4) {
      const capNombre = grupo.capacitacionNombre || FORMACIONES_LABORALES[0];
      const uacsLabInfo = UACS_LABORALES_MAPA[capNombre]?.sem4 || UACS_LABORALES_MAPA["Administracion"].sem4;

      return [
        { id: `uac_4_1`, uacName: "Ciencias Naturales, Experimentales y Tecnología IV", abrev: "CNEyT-IV", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_4_2`, uacName: "Pensamiento Matemático IV", abrev: "PENS-MAT-IV", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_4_3`, uacName: "Humanidades IV", abrev: "HUM-IV", tipo: "UNIVERSAL", horasSemanales: 5 },
        { id: `uac_4_4`, uacName: "Taller de Ciencias III", abrev: "TALL-CIEN-III", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_4_5`, uacName: grupo.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0], abrev: "CURR-AMP-4", tipo: "AMPLIADO", horasSemanales: 2 },
        { id: `uac_4_6`, uacName: "Lengua y Comunicación IV", abrev: "LENG-COM-IV", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_4_7`, uacName: "Inglés IV", abrev: "ING-IV", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_4_lab_a`, uacName: uacsLabInfo[0].name, abrev: uacsLabInfo[0].abrev, capNombre, tipo: "LABORAL_A", horasSemanales: 3 },
        { id: `uac_4_lab_b`, uacName: uacsLabInfo[1].name, abrev: uacsLabInfo[1].abrev, capNombre, tipo: "LABORAL_B", horasSemanales: 3 }
      ];
    }

    if (sem === 6) {
      const capNombre = grupo.capacitacionNombre || FORMACIONES_LABORALES[0];
      const uacsLabInfo = UACS_LABORALES_MAPA[capNombre]?.sem6 || UACS_LABORALES_MAPA["Administracion"].sem6;
      const opts5 = grupo.ffeOptativas || [
        FFE_OPTATIVAS_CATALOGO[0],
        FFE_OPTATIVAS_CATALOGO[1],
        FFE_OPTATIVAS_CATALOGO[7],
        FFE_OPTATIVAS_CATALOGO[8]
      ];
      const opts6 = opts5.map((f: string) => obtenerFfeSemestre6(f));

      return [
        { id: `uac_6_1`, uacName: "La Energía en los Procesos de la Vida Diaria II", abrev: "ENERG-VIDA-II", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_6_2`, uacName: "Conciencia Histórica III. México en el Siglo XXI", abrev: "CONC-HIST-III", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_6_3`, uacName: "Taller de Habilidades del Pensamiento II", abrev: "TALL-HAB-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_6_ffe_1`, uacName: opts6[0], abrev: "FFE-1-CONT", tipo: "FFE_1", horasSemanales: 3 },
        { id: `uac_6_ffe_2`, uacName: opts6[1], abrev: "FFE-2-CONT", tipo: "FFE_2", horasSemanales: 3 },
        { id: `uac_6_ffe_3`, uacName: opts6[2], abrev: "FFE-3-CONT", tipo: "FFE_3", horasSemanales: 3 },
        { id: `uac_6_ffe_4`, uacName: opts6[3], abrev: "FFE-4-CONT", tipo: "FFE_4", horasSemanales: 3 },
        { id: `uac_6_5`, uacName: grupo.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[1], abrev: "CURR-AMP-6", tipo: "AMPLIADO", horasSemanales: 2 },
        { id: `uac_6_lab_a`, uacName: uacsLabInfo[0].name, abrev: uacsLabInfo[0].abrev, capNombre, tipo: "LABORAL_A", horasSemanales: 3 },
        { id: `uac_6_lab_b`, uacName: uacsLabInfo[1].name, abrev: uacsLabInfo[1].abrev, capNombre, tipo: "LABORAL_B", horasSemanales: 3 }
      ];
    }

    return [];
  };

  const handleCambiarHorasUAC = (grupo: any, uacId: string, nuevasHoras: number) => {
    const horasValidadas = Math.max(1, Math.min(25, Math.round(nuevasHoras) || 1));
    const listaActual = getUACsIndividualesGrupo(grupo).map(u => ({ ...u }));
    const idx = listaActual.findIndex(u => u.id === uacId);
    if (idx !== -1) {
      listaActual[idx].horasSemanales = horasValidadas;
      listaActual[idx].esPersonalizada = true;
      setCustomUacsDeGrupo(grupo, listaActual);

      // Actualizar carga docente existente si corresponde
      setCargas(prev => prev.map(c => {
        if (matchGrupoCarga(c.grupoId, grupo.id) && matchUacCarga(c.uacName, c.asignaturaId, listaActual[idx])) {
          return { ...c, horasSemanales: horasValidadas };
        }
        return c;
      }));
    }
  };

  const handleConfirmarRenombrarUAC = (grupo: any, uacId: string, nuevoNombre: string, nuevaAbrev: string) => {
    const nombreLimpio = nuevoNombre.trim();
    if (!nombreLimpio) {
      toast.error("El nombre de la asignatura no puede estar vacío");
      return;
    }
    const listaActual = getUACsIndividualesGrupo(grupo).map(u => ({ ...u }));
    const idx = listaActual.findIndex(u => u.id === uacId);
    if (idx !== -1) {
      const nombreAnterior = listaActual[idx].uacName;
      listaActual[idx].uacName = nombreLimpio;
      listaActual[idx].abrev = (nuevaAbrev || nombreLimpio.substring(0, 12)).toUpperCase();
      listaActual[idx].esPersonalizada = true;
      setCustomUacsDeGrupo(grupo, listaActual);

      setCargas(prev => prev.map(c => {
        if (matchGrupoCarga(c.grupoId, grupo.id) && (c.asignaturaId === uacId || c.uacName === nombreAnterior)) {
          return { ...c, uacName: nombreLimpio };
        }
        return c;
      }));
      toast.success("Nombre de la asignatura actualizado");
    }
    setModalEditarNombre(null);
  };

  const handleConfirmarDivisionUAC = (
    grupo: any,
    uacOriginal: any,
    horasA: number,
    horasB: number,
    nombreA: string,
    nombreB: string,
    abrevA: string,
    abrevB: string
  ) => {
    const totalOriginal = uacOriginal.horasSemanales || 3;
    if (horasA + horasB !== totalOriginal) {
      toast.error(`La suma (${horasA} + ${horasB} = ${horasA + horasB}h) debe ser exactamente igual a ${totalOriginal}h`);
      return;
    }

    const listaActual = getUACsIndividualesGrupo(grupo).map(u => ({ ...u }));
    const idx = listaActual.findIndex(u => u.id === uacOriginal.id);
    if (idx === -1) return;

    const timestamp = Date.now();
    const itemA = {
      ...uacOriginal,
      id: `${uacOriginal.id}_part_a_${timestamp}`,
      uacName: nombreA.trim() || `${uacOriginal.uacName} A`,
      abrev: (abrevA || `${uacOriginal.abrev || 'UAC'}-A`).toUpperCase(),
      horasSemanales: horasA,
      esDividida: true,
      esPersonalizada: true,
      originalUacId: uacOriginal.id
    };

    const itemB = {
      ...uacOriginal,
      id: `${uacOriginal.id}_part_b_${timestamp}`,
      uacName: nombreB.trim() || `${uacOriginal.uacName} B`,
      abrev: (abrevB || `${uacOriginal.abrev || 'UAC'}-B`).toUpperCase(),
      horasSemanales: horasB,
      esDividida: true,
      esPersonalizada: true,
      originalUacId: uacOriginal.id
    };

    listaActual.splice(idx, 1, itemA, itemB);
    setCustomUacsDeGrupo(grupo, listaActual);

    // Limpiar cargas previas de la UAC original para que cada parte se asigne limpiamente
    setCargas(prev => prev.filter(c => !(matchGrupoCarga(c.grupoId, grupo.id) && (c.asignaturaId === uacOriginal.id || c.uacName === uacOriginal.uacName))));

    toast.success(`Asignatura dividida exitosamente en ${horasA}h y ${horasB}h`);
    setModalDividir(null);
  };

  const handleConfirmarAgregarUAC = (
    grupo: any,
    nombre: string,
    abrev: string,
    horas: number,
    tipo: string
  ) => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      toast.error("El nombre de la asignatura es requerido");
      return;
    }
    const horasValidadas = Math.max(1, Math.min(25, Number(horas) || 3));
    const nuevaAbrev = (abrev || nombreLimpio.substring(0, 10)).toUpperCase();
    const nuevoId = `uac_custom_${grupo.semestre}_${Date.now()}`;

    const nuevaUAC = {
      id: nuevoId,
      uacName: nombreLimpio,
      abrev: nuevaAbrev,
      tipo: tipo || "CUSTOM",
      horasSemanales: horasValidadas,
      esPersonalizada: true
    };

    const listaActual = [...getUACsIndividualesGrupo(grupo).map(u => ({ ...u })), nuevaUAC];
    setCustomUacsDeGrupo(grupo, listaActual);
    toast.success(`Asignatura "${nombreLimpio}" (${horasValidadas}h) agregada al Grupo ${grupo.nombre}`);
    setModalAgregarUac(null);
  };

  const handleEliminarUAC = (grupo: any, uacId: string) => {
    const uacAEliminar = getUACsIndividualesGrupo(grupo).find(u => u.id === uacId);
    const nombre = uacAEliminar?.uacName || "la asignatura";
    if (!window.confirm(`¿Seguro que deseas eliminar "${nombre}" del Grupo ${grupo.nombre}?`)) {
      return;
    }
    const listaActual = getUACsIndividualesGrupo(grupo).filter(u => u.id !== uacId);
    setCustomUacsDeGrupo(grupo, listaActual);
    setCargas(prev => prev.filter(c => !(matchGrupoCarga(c.grupoId, grupo.id) && (c.asignaturaId === uacId || c.uacName === nombre))));
    toast.success(`Asignatura eliminada del Grupo ${grupo.nombre}`);
  };

  const handleRestaurarUACsOficiales = (grupo: any) => {
    if (window.confirm(`¿Restaurar las asignaturas oficiales para el Grupo ${grupo.nombre}? Se descartarán las divisiones, cambios de horas o asignaturas agregadas para este grupo.`)) {
      setCustomUacsDeGrupo(grupo, null);
      toast.success(`Asignaturas oficiales restauradas para el Grupo ${grupo.nombre}`);
    }
  };

  const abrirModalDividir = (grupo: any, uac: any) => {
    const totalHoras = uac.horasSemanales || 3;
    let horasA = Math.ceil(totalHoras / 2);
    let horasB = Math.floor(totalHoras / 2);
    if (totalHoras === 12) {
      horasA = 7;
      horasB = 5;
    }
    setModalDividir({
      grupo,
      uac,
      horasTotalOriginal: totalHoras,
      horasA,
      horasB,
      nombreA: `${uac.uacName} A`,
      nombreB: `${uac.uacName} B`,
      abrevA: `${uac.abrev || 'UAC'}-A`,
      abrevB: `${uac.abrev || 'UAC'}-B`
    });
  };

  const abrirModalEditarNombre = (grupo: any, uac: any) => {
    setModalEditarNombre({
      grupo,
      uac,
      nuevoNombre: uac.uacName || "",
      nuevaAbrev: uac.abrev || ""
    });
  };

  const abrirModalAgregarUac = (grupo: any) => {
    setModalAgregarUac({
      grupo,
      nombre: "",
      abrev: "",
      horas: 3,
      tipo: "MODULAR"
    });
  };

  const semestresActivosPeriodo = periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6];
  const gruposDelPeriodo = grupos.filter((g) => semestresActivosPeriodo.includes(g.semestre));
  const totalGrupos = gruposDelPeriodo.length;

  const horasRequeridasPlantel = gruposDelPeriodo.reduce((sum, g) => {
    const uacs = getUACsIndividualesGrupo(g);
    return sum + uacs.reduce((uSum: number, u: any) => uSum + Number(u.horasSemanales || 0), 0);
  }, 0);

  const totalHorasPlantillaDocente = Object.entries(horasDocentes).reduce((sum, [id, h]) => {
    const docente = docentes.find(d => d.id === id);
    const cargoUpper = String(docente?.cargo || "").toUpperCase();
    if (cargoUpper === "APOYO" || cargoUpper === "PERSONAL_DE_ASISTENCIA" || cargoUpper === "ASISTENCIA") {
      return sum;
    }
    return sum + Number(h || 0);
  }, 0);

  const totalHorasAsignadasMatriz = (() => {
    let total = 0;
    gruposDelPeriodo.forEach((g) => {
      const uacs = getUACsIndividualesGrupo(g);
      uacs.forEach((uac) => {
        const docenteId = getDocenteAsignado(g.id, uac);
        if (docenteId) {
          total += uac.horasSemanales || 3;
        }
      });
    });
    return total;
  })();

  const personalNoAgregado = personalPlataforma
    .filter((p) => {
      if (!p.cargo) return true;
      const cargoUpper = String(p.cargo).toUpperCase();
      return (
        !cargoUpper.includes("ASISTENCIA") &&
        !cargoUpper.includes("APOYO") &&
        cargoUpper !== "PERSONAL_DE_ASISTENCIA" &&
        cargoUpper !== "APOYO_ADMINISTRATIVO"
      );
    })
    .filter((p) => !docentes.some((d) => d.id === p.id));

  const personalDisponibleModal = personalNoAgregado.filter((p) => {
    return busquedaPersonal === "" || `${p.nombre} ${p.apellidoPaterno || ""} ${p.cargo || ""}`.toLowerCase().includes(busquedaPersonal.toLowerCase());
  });

  return (
    <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", maxWidth: "1250px", margin: "0 auto" }}>

      {/* PASO 1: Estructura Abierta de Grupos y Selección Curricular por Grupo */}
      {/* PASO 1: Estructura Abierta de Grupos y Selección Curricular por Grupo */}
      {paso === 1 && (
        <HorariosPaso1Grupos
          periodoActivo={periodoActivo}
          setPeriodoActivo={setPeriodoActivo}
          setUsuarioCambioGrupos={setUsuarioCambioGrupos}
          nombreEscuela={nombreEscuela}
          setNombreEscuela={setNombreEscuela}
          cctEscuela={cctEscuela}
          setCctEscuela={setCctEscuela}
          zonaEscolar={zonaEscolar}
          setZonaEscolar={setZonaEscolar}
          esTecnologico={esTecnologico}
          setModoConfiguracion={setModoConfiguracion}
          g1={g1}
          setG1={setG1}
          g2={g2}
          setG2={setG2}
          g3={g3}
          setG3={setG3}
          generarGruposSegunEstructura={generarGruposSegunEstructura}
          numPeriodos={numPeriodos}
          setNumPeriodos={setNumPeriodos}
          grupos={grupos}
          carrerasTecnologicas={carrerasTecnologicas}
          handleActualizarConfigGrupo={handleActualizarConfigGrupo}
          handleActualizarOptativaGrupo={handleActualizarOptativaGrupo}
          modoConfiguracion={modoConfiguracion}
          grupoActivoManual={grupoActivoManual}
          setGrupoActivoManual={setGrupoActivoManual}
          curriculoManualPorGrupo={curriculoManualPorGrupo}
          handleAgregarMateriaManual={handleAgregarMateriaManual}
          handleActualizarMateriaManual={handleActualizarMateriaManual}
          handleEliminarMateriaManual={handleEliminarMateriaManual}
          normalizarNombreGrupo={normalizarNombreGrupo}
          handleAvanzarPaso1={handleAvanzarPaso1}
        />
      )}

      {/* PASO 2: Plantilla Docente & Contador de Horas del Plantel */}
      {paso === 2 && (
        <HorariosPaso2Docentes
          docentes={docentes}
          docentesAptosParaHorario={docentesAptosParaHorario}
          horasDocentes={horasDocentes}
          setHorasDocentes={setHorasDocentes}
          totalHorasPlantillaDocente={totalHorasPlantillaDocente}
          horasRequeridasPlantel={horasRequeridasPlantel}
          gruposDelPeriodoActual={gruposDelPeriodo}
          getHorasConsumidasDocente={getHorasConsumidasDocente}
          setMostrarModalDocente={setMostrarModalDocente}
          setTabModalDocente={setTabModalDocente}
          handleEliminarDocentePlantilla={handleEliminarDocentePlantilla}
          handleAvanzarPaso2={handleAvanzarPaso2}
          setPaso={setPaso}
          grupos={grupos}
          periodoActivo={periodoActivo}
          getUACsIndividualesGrupo={getUACsIndividualesGrupo}
        />
      )}

      {/* PASO 3: Matriz Tabular Específica por Grupo */}
      {paso === 3 && (
        <HorariosPaso3Matriz
          horasRequeridasPlantel={horasRequeridasPlantel}
          totalHorasAsignadasMatriz={totalHorasAsignadasMatriz}
          setMostrarModalMatrizExcel={setMostrarModalMatrizExcel}
          gruposDelPeriodoActual={gruposDelPeriodo}
          carrerasTecnologicas={carrerasTecnologicas}
          esTecnologico={esTecnologico}
          abrirModalAgregarUac={abrirModalAgregarUac}
          handleRestaurarUACsOficiales={handleRestaurarUACsOficiales}
          getUACsIndividualesGrupo={getUACsIndividualesGrupo}
          getCustomUacsDeGrupo={getCustomUacsDeGrupo}
          getDocenteAsignado={getDocenteAsignado}
          handleAsignarDocenteMatriz={handleAsignarDocenteMatriz}
          docentesAptosParaHorario={docentesAptosParaHorario}
          getHorasConsumidasDocente={getHorasConsumidasDocente}
          horasDocentes={horasDocentes}
          handleCambiarHorasUAC={handleCambiarHorasUAC}
          abrirModalDividir={abrirModalDividir}
          abrirModalEditarNombre={abrirModalEditarNombre}
          handleEliminarUAC={handleEliminarUAC}
          setPaso={setPaso}
          loading={loading}
          handleGuardarConfiguracion={handleGuardarConfiguracion}
          grupos={grupos}
          periodoActivo={periodoActivo}
          docentes={docentes}
        />
      )}

      {/* Modales Auxiliares */}
      <HorariosModales
        mostrarModalDocente={mostrarModalDocente}
        setMostrarModalDocente={setMostrarModalDocente}
        tabModalDocente={tabModalDocente}
        setTabModalDocente={setTabModalDocente}
        busquedaPersonal={busquedaPersonal}
        setBusquedaPersonal={setBusquedaPersonal}
        personalDisponibleModal={personalDisponibleModal}
        personalNoAgregado={personalNoAgregado}
        personalPlataforma={personalPlataforma}
        handleAgregarPersonalExistente={handleAgregarPersonalExistente}
        nuevoDocenteNombre={nuevoDocenteNombre}
        setNuevoDocenteNombre={setNuevoDocenteNombre}
        nuevoDocentePaterno={nuevoDocentePaterno}
        setNuevoDocentePaterno={setNuevoDocentePaterno}
        nuevoDocenteMaterno={nuevoDocenteMaterno}
        setNuevoDocenteMaterno={setNuevoDocenteMaterno}
        nuevoDocenteCargo={nuevoDocenteCargo}
        setNuevoDocenteCargo={setNuevoDocenteCargo}
        nuevoDocenteHoras={nuevoDocenteHoras}
        setNuevoDocenteHoras={setNuevoDocenteHoras}
        nuevoDocenteEmail={nuevoDocenteEmail}
        setNuevoDocenteEmail={setNuevoDocenteEmail}
        handleCrearNuevoDocenteManual={handleCrearNuevoDocenteManual}
        fileInputHorariosRef={fileInputHorariosRef}
        handleCargarArchivoExcelHorarios={handleCargarArchivoExcelHorarios}
        archivoExcelHorarios={archivoExcelHorarios}
        setArchivoExcelHorarios={setArchivoExcelHorarios}
        cargandoExcelHorarios={cargandoExcelHorarios}
        docentesParseadosHorarios={docentesParseadosHorarios}
        setDocentesParseadosHorarios={setDocentesParseadosHorarios}
        handleImportarExcelEnHorarios={handleImportarExcelEnHorarios}
        mostrarModalMatrizExcel={mostrarModalMatrizExcel}
        setMostrarModalMatrizExcel={setMostrarModalMatrizExcel}
        fileInputMatrizRef={fileInputMatrizRef}
        handleCargarArchivoMatrizExcel={handleCargarArchivoMatrizExcel}
        archivoMatrizExcel={archivoMatrizExcel}
        setArchivoMatrizExcel={setArchivoMatrizExcel}
        cargandoMatrizExcel={cargandoMatrizExcel}
        resultadoParseoMatriz={resultadoParseoMatriz}
        setResultadoParseoMatriz={setResultadoParseoMatriz}
        handleConfirmarImportacionMatriz={handleConfirmarImportacionMatriz}
        modalDividir={modalDividir}
        setModalDividir={setModalDividir}
        handleConfirmarDivisionUAC={handleConfirmarDivisionUAC}
        modalEditarNombre={modalEditarNombre}
        setModalEditarNombre={setModalEditarNombre}
        handleConfirmarRenombrarUAC={handleConfirmarRenombrarUAC}
        modalAgregarUac={modalAgregarUac}
        setModalAgregarUac={setModalAgregarUac}
        handleConfirmarAgregarUAC={handleConfirmarAgregarUAC}
        grupos={grupos}
        periodoActivo={periodoActivo}
        getUACsIndividualesGrupo={getUACsIndividualesGrupo}
        docentes={docentes}
        loading={loading}
      />
    </div>
  );
}
