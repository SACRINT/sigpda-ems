'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  PaecProject,
  CommunityContext,
  SchoolContext,
  SchoolType,
  GroupTrackConfig,
  PaecAuditResult,
  PaecAuditCriterion,
  PaecQualityAudit,
  Fase1Diagnostico,
  Fase2Justificacion,
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
  PlanOperativoRow,
} from '@/types/paec';
import {
  consolidarUacsUnicasPlantel,
  FORMACIONES_LABORALES,
  obtenerFundamentalesPorSemestres,
  obtenerFfeSemestre6,
} from '@/lib/escuela-grupos';
import { UACS_LABORALES_OFICIALES_BGE } from '@/lib/capacitaciones-data';
import { loadCarrerasTecnicas, type BTCarrera } from '@/lib/bt-carreras-catalog';
import type { SchoolZoneContextResponse } from '@/lib/zone-sync-service';
import {
  PaecStep1Diagnostico,
  PaecStep2Justificacion,
  PaecStep3Mapeo,
  PaecStep4Cronograma,
  PaecStep5DetalleCurricular,
  PaecStep6PlanOpA,
  PaecStep7PlanOpB,
  PaecStep8Implementacion,
  PaecStep9GobernanzaSupervision,
} from './steps';
import PaecWizardLegacy from './legacy/PaecWizardLegacy';
import { useAssistant } from '@/components/assistant';


const PAEC_DRAFT_KEY = 'didactica_paec_draft';

/** Reads the PAEC draft from localStorage (returns null if none) */
function readPaecDraft(): PaecFormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PAEC_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Saves PAEC form draft to localStorage */
function savePaecDraft(draft: PaecFormDraft) {
  try {
    window.localStorage.setItem(PAEC_DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage full or unavailable */ }
}

/** Clears PAEC form draft from localStorage */
function clearPaecDraft() {
  try { window.localStorage.removeItem(PAEC_DRAFT_KEY); } catch { /* ignore */ }
}

/** Reads cached step data (Step 4 or 5) from localStorage */
function getCachedPaecStep(pId: string, stepNum: 4 | 5): unknown | null {
  if (typeof window === 'undefined' || !pId) return null;
  try {
    const raw = window.localStorage.getItem(`paec_cache_${pId}_step${stepNum}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Saves step data (Step 4 or 5) to localStorage */
function setCachedPaecStep(pId: string, stepNum: 4 | 5, data: unknown) {
  if (typeof window === 'undefined' || !pId || !data) return;
  try {
    window.localStorage.setItem(`paec_cache_${pId}_step${stepNum}`, JSON.stringify(data));
  } catch { /* storage full or unavailable */ }
}

/** Invalidates cached steps when an earlier step is regenerated */
function invalidatePaecStepCache(pId: string, startingFromStep: number) {
  if (typeof window === 'undefined' || !pId) return;
  try {
    if (startingFromStep <= 4) {
      window.localStorage.removeItem(`paec_cache_${pId}_step4`);
    }
    if (startingFromStep <= 5) {
      window.localStorage.removeItem(`paec_cache_${pId}_step5`);
    }
  } catch { /* ignore */ }
}

interface PaecFormDraft {
  projectName: string;
  problemStatement: string;
  cycleType: 'A' | 'B' | 'annual';
  community: CommunityContext;
  school: SchoolContext;
  schoolType?: SchoolType;
  selectedFundamental?: string[];
  selectedLaboral: string[];
  selectedFfe: string[];
  selectedBtCarreras?: string[];
  groupsCount: string;
  groupsConfig: string;
  groupAssignments?: GroupTrackConfig[];
  semestersConfig?: Record<number, number>;
}

interface Props {
  locale: string;
  initialId: string | null;
}

export const ALL_STEPS = [
  { num: 1, label: 'Diagnóstico Colectivo' },
  { num: 2, label: 'Justificación y Propósitos' },
  { num: 3, label: 'Mapeo de UACs' },
  { num: 4, label: 'Cronograma' },
  { num: 5, label: 'Detalle Curricular' },
  { num: 6, label: 'Plan Operativo Semestre A' },
  { num: 7, label: 'Plan Operativo Semestre B' },
  { num: 8, label: 'Implementación y Anexos' },
  { num: 9, label: 'Gobernanza e Informe' },
];

export function getVisibleSteps(cycle: 'A' | 'B' | 'annual') {
  if (cycle === 'A') {
    return ALL_STEPS.filter((s) => s.num !== 7 && s.num !== 9);
  }
  if (cycle === 'B') {
    return ALL_STEPS.filter((s) => s.num !== 6 && s.num !== 8);
  }
  return ALL_STEPS;
}

const CYCLE_LABELS: Record<string, string> = {
  A: 'Semestre A (1°, 3° y 5°)',
  B: 'Semestre B (2°, 4° y 6°)',
  annual: 'Proyecto Completo (1° al 6°)',
};

const CAPACITACION_TITLES: Record<string, string> = {
  'Administración': '💼 Administración',
  'Agricultura Sostenible de Traspatio': '🌱 Agricultura Sostenible de Traspatio',
  'Área de la Salud': '🩺 Área de la Salud',
  'Comunicación Gráfica': '🎨 Comunicación Gráfica',
  'Contabilidad': '📊 Contabilidad',
  'Domótica': '🏠 Domótica',
  'Instalaciones Residenciales': '🛠️ Instalaciones Residenciales',
  'Mecánica Dental': '🦷 Mecánica Dental',
  'Preparación de Alimentos Artesanales': '🍯 Preparación de Alimentos Artesanales',
  'Procesos Culinarios y Repostería': '🍰 Procesos Culinarios y Repostería',
  'Redes y Mantenimiento': '💻 Redes y Mantenimiento',
  'Servicios Ecosistémicos': '🌳 Servicios Ecosistémicos',
  'Sistemas Eléctricos': '⚡ Sistemas Eléctricos',
  'Tecnología Informática': '💾 Tecnología Informática',
  'Turismo': '✈️ Turismo',
};

export const FFE_PACKAGES: Record<string, { label: string; subjects: string[] }> = {
  'fisico_matematico': {
    label: '📐 Físico-Matemático',
    subjects: ['Análisis de Fenómenos Físicos I', 'Dibujo Técnico I', 'Taller de Pensamiento Variacional I', 'Taller de Probabilidad y Estadística I']
  },
  'quimico_biologico': {
    label: '🧬 Químico-Biológico',
    subjects: ['Análisis de Fenómenos y Procesos Biológicos', 'Salud Integral I', 'Organización del Flujo de Materia y Energía en los Organismos I', 'Taller de Probabilidad y Estadística I']
  },
  'economico_admin': {
    label: '📊 Económico-Administrativo',
    subjects: ['Fundamentos de Administración I', 'Procesos Contables I', 'Economía I. La Función de los Agentes Económicos en la Sociedad', 'Pensamiento Matemático Aplicado a las Finanzas I']
  },
  'humanidades_sociales': {
    label: '🏛️ Humanidades y Ciencias Sociales',
    subjects: ['Derecho y Sociedad I', 'Psicología I', 'Temas Selectos de Ciencias Sociales I', 'Pensamiento Filosófico I']
  }
};

export const FFE_PAIRS = [
  // ── Recursos Sociocognitivos (7) ──────────────────────────────────────────
  { name5: 'Comunicación y Sociedad I', name6: 'Comunicación y Sociedad II', label: 'Comunicación y Sociedad', category: 'Recursos Sociocognitivos' },
  { name5: 'Raíces Etimológicas del Español I', name6: 'Raíces Etimológicas del Español II', label: 'Raíces Etimológicas del Español', category: 'Recursos Sociocognitivos' },
  { name5: 'Inglés V (Avanzado)', name6: 'Inglés VI (Avanzado)', label: 'Inglés Avanzado', category: 'Recursos Sociocognitivos' },
  { name5: 'Taller de Pensamiento Variacional I', name6: 'Taller de Pensamiento Variacional II', label: 'Taller de Pensamiento Variacional', category: 'Recursos Sociocognitivos' },
  { name5: 'Dibujo Técnico I', name6: 'Dibujo Técnico II', label: 'Dibujo Técnico', category: 'Recursos Sociocognitivos' },
  { name5: 'Pensamiento Matemático Aplicado a las Finanzas I', name6: 'Pensamiento Matemático Aplicado a las Finanzas II', label: 'Pensamiento Matemático Finanzas', category: 'Recursos Sociocognitivos' },
  { name5: 'Taller de Probabilidad y Estadística I', name6: 'Taller de Probabilidad y Estadística II', label: 'Taller de Probabilidad y Estadística', category: 'Recursos Sociocognitivos' },

  // ── Áreas de Conocimiento (13) ─────────────────────────────────────────────
  { name5: 'Salud Integral I', name6: 'Salud Integral II', label: 'Salud Integral', category: 'Ciencias Naturales y Salud' },
  { name5: 'Análisis de Fenómenos y Procesos Biológicos', name6: 'Temas Selectos de Biología', label: 'Ciencias Biológicas', category: 'Ciencias Naturales y Salud' },
  { name5: 'Análisis de Fenómenos Físicos I', name6: 'Análisis de Fenómenos Físicos II', label: 'Análisis de Fenómenos Físicos', category: 'Ciencias Naturales y Salud' },
  { name5: 'Organización del Flujo de Materia y Energía en los Organismos I', name6: 'Organización del Flujo de Materia en los Organismos II', label: 'Flujo de Materia y Energía', category: 'Ciencias Naturales y Salud' },
  { name5: 'Fundamentos de Administración I', name6: 'Fundamentos de Administración II', label: 'Fundamentos de Administración', category: 'Ciencias Sociales' },
  { name5: 'Procesos Contables I', name6: 'Procesos Contables II', label: 'Procesos Contables', category: 'Ciencias Sociales' },
  { name5: 'Derecho y Sociedad I', name6: 'Derecho y Sociedad II', label: 'Derecho y Sociedad', category: 'Ciencias Sociales' },
  { name5: 'Economía I. La Función de los Agentes Económicos en la Sociedad', name6: 'Economía II. Política Económica y Política Pública Mexicana', label: 'Economía y Política Pública', category: 'Ciencias Sociales' },
  { name5: 'Temas Selectos de Ciencias Sociales I', name6: 'Temas Selectos de Ciencias Sociales II', label: 'Temas Selectos Ciencias Sociales', category: 'Ciencias Sociales' },
  { name5: 'Psicología I', name6: 'Psicología II', label: 'Psicología', category: 'Humanidades y Ciencias Sociales' },
  { name5: 'Arte y Cultura I', name6: 'Arte y Cultura II', label: 'Arte y Cultura', category: 'Humanidades' },
  { name5: 'Lógica y Pensamiento Crítico', name6: 'Experiencia Estética', label: 'Lógica y Experiencia Estética', category: 'Humanidades' },
  { name5: 'Pensamiento Filosófico I', name6: 'Pensamiento Filosófico II', label: 'Pensamiento Filosófico', category: 'Humanidades' },
];

function classifyError(err: unknown): { message: string; type: 'timeout' | 'json' | 'rate_limit' | 'network' | 'unknown' } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('timeout') || lower.includes('tiempo') || lower.includes('504') || lower.includes('408')) {
    return { type: 'timeout', message: 'Timeout de red: El servidor tardó más de 120s en procesar la fase. Por favor reintenta.' };
  }
  if (lower.includes('json') || lower.includes('validar estructura') || lower.includes('schema') || lower.includes('malform')) {
    return { type: 'json', message: 'JSON malformado: La estructura retornada por el modelo de IA no cumple la validación oficial MCCEMS.' };
  }
  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('límite') || lower.includes('cuota')) {
    return { type: 'rate_limit', message: 'Límite de API alcanzado: Se superó la cuota de peticiones o el límite por minuto de la IA.' };
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('conexión') || lower.includes('offline')) {
    return { type: 'network', message: 'Error de red o conexión: No se pudo establecer comunicación con el servidor.' };
  }
  return { type: 'unknown', message: msg || 'Error al generar la fase con IA.' };
}

function PaecWizardModularClient({ locale, initialId }: Props) {
  const router = useRouter();

  // Restore draft from localStorage if this is a fresh wizard (no project ID in URL)
  const savedDraft = !initialId ? readPaecDraft() : null;

  // Navigation / Loading States
  const [projectId, setProjectId] = useState<string | null>(initialId);
  const [project, setProject] = useState<PaecProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'timeout' | 'json' | 'rate_limit' | 'network' | 'unknown' | null>(null);
  const [retryCount, setRetryCount] = useState<Record<number, number>>({});

  // Form States (Paso 1: Datos Base) — initialized from saved draft if present
  const [projectName, setProjectName] = useState(savedDraft?.projectName ?? '');
  const [problemStatement, setProblemStatement] = useState(savedDraft?.problemStatement ?? '');
  const [cycleType, setCycleType] = useState<'A' | 'B' | 'annual'>(savedDraft?.cycleType ?? 'A');

  const [community, setCommunity] = useState<CommunityContext>(savedDraft?.community ?? {
    location: '',
    demographics: '',
    economy: '',
    traditions: '',
    security: '',
    environment: '',
  });

  const [school, setSchool] = useState<SchoolContext>(savedDraft?.school ?? {
    cct: '',
    schoolName: '',
    municipality: '',
    locality: '',
    schoolZone: '',
    enrollment: '',
    teacherCount: '',
    indicators: '',
    previousPrograms: '',
    facilities: '',
  });

  // SAPCU Copiloto Pedagógico: Sincronización contextual bidireccional
  const { setDetallesDocumento } = useAssistant();
  useEffect(() => {
    setDetallesDocumento({
      programa: 'paec',
      documentoId: projectId || 'nuevo',
      seccionActiva: `Paso ${activeStep}: ${ALL_STEPS.find((s) => s.num === activeStep)?.label || ''}`,
      detallesMediaSuperior: {
        semestre: cycleType === 'A' ? 1 : cycleType === 'B' ? 2 : undefined,
        paecNombre: projectName || undefined,
        retoSituado: problemStatement
          ? {
              contextoReal: community?.location || community?.demographics || undefined,
              problemaComunidad: problemStatement,
            }
          : undefined,
      },
    });
  }, [projectId, activeStep, projectName, problemStatement, cycleType, community, setDetallesDocumento]);


  const [cctSearching, setCctSearching] = useState(false);
  const [cctWarning, setCctWarning] = useState<string | null>(null);

  // Zona Context Bridge (Fase 9)
  const [zonaData, setZonaData] = useState<SchoolZoneContextResponse | null>(null);
  const [showZonaModal, setShowZonaModal] = useState(false);
  const [loadingZona, setLoadingZona] = useState(false);
  const [zonaFeedback, setZonaFeedback] = useState<string | null>(null);

  const handleConsultarZona = useCallback(async () => {
    const targetCct = (school.cct || '').trim().toUpperCase();
    if (!targetCct) {
      setError('Por favor ingresa primero la Clave CCT de tu plantel en la Ficha del Plantel.');
      return;
    }
    setLoadingZona(true);
    setZonaFeedback(null);
    try {
      const res = await fetch(`/api/paec/zona-context?cct=${encodeURIComponent(targetCct)}`);
      const data: SchoolZoneContextResponse & { message?: string } = await res.json();
      if (!res.ok || !data.found) {
        setZonaFeedback(data.message || 'No se encontró Cartografía de Zona activa para este CCT escolar.');
      } else {
        setZonaData(data);
        setShowZonaModal(true);
      }
    } catch {
      setZonaFeedback('Error de comunicación al consultar la Cartografía de Zona.');
    } finally {
      setLoadingZona(false);
    }
  }, [school.cct]);

  const handleAplicarSugerenciasZona = () => {
    if (!zonaData || !zonaData.zona) return;
    const { zona, plantel } = zonaData;

    if (plantel) {
      setSchool(prev => ({
        ...prev,
        schoolName: prev.schoolName || plantel.nombre,
        municipality: prev.municipality || plantel.municipio,
        locality: prev.locality || plantel.localidad,
        schoolZone: prev.schoolZone || (zona.identificacion.zonaNumero ? `Zona ${zona.identificacion.zonaNumero}` : prev.schoolZone),
        enrollment: prev.enrollment || `${plantel.matricula} estudiantes (Registrado en 911/F11)`,
        teacherCount: prev.teacherCount || (plantel.docentesCount ? `${plantel.docentesCount} docentes` : prev.teacherCount),
      }));

      if (plantel.paecProyecto && !projectName.trim()) {
        setProjectName(plantel.paecProyecto);
      }
      if (plantel.paecProblematica && !problemStatement.trim()) {
        setProblemStatement(plantel.paecProblematica);
      }
    }

    if (zona.momento3Territorio?.descripcionTerritorial && !community.location?.trim()) {
      setCommunity(prev => ({
        ...prev,
        location: `${plantel?.localidad ? plantel.localidad + ', ' : ''}${plantel?.municipio ? plantel.municipio + ', ' : ''}Puebla`,
        environment: prev.environment || (zona.momento3Territorio?.conectividadInfraestructura ? `Condiciones territoriales: ${zona.momento3Territorio.conectividadInfraestructura}` : prev.environment),
      }));
    }

    setShowZonaModal(false);
    setZonaFeedback('✅ Datos y contexto territorial de la Cartografía de Zona aplicados exitosamente a tu PAEC.');
    setTimeout(() => setZonaFeedback(null), 4000);
  };

  // Autocompletado de CCT mediante el catálogo de Puebla
  const handleCctLookup = async (cctInput: string) => {
    const clean = cctInput.trim().toUpperCase();
    if (!clean || clean.length < 5) {
      setCctWarning(null);
      return;
    }
    setCctSearching(true);
    setCctWarning(null);
    try {
      const res = await fetch(`/api/admin/catalogo-escuelas?cct=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (res.ok && data.success && data.escuela) {
        const esc = data.escuela;
        setSchool(prev => ({
          ...prev,
          cct: esc.cct || clean,
          schoolName: esc.nombre || prev.schoolName,
          municipality: esc.municipio || prev.municipality,
          locality: esc.localidad || prev.locality,
          schoolZone: esc.zona || prev.schoolZone,
        }));
        // Si la comunidad no tiene ubicación definida, sugerir la del catálogo
        setCommunity(prev => ({
          ...prev,
          location: prev.location?.trim() ? prev.location : `${esc.localidad ? esc.localidad + ', ' : ''}${esc.municipio ? esc.municipio + ', ' : ''}Puebla`,
        }));
        setCctWarning(null);
      } else {
        setCctWarning('CCT no encontrado en el catálogo de Puebla');
      }
    } catch {
      setCctWarning('Error de conexión al consultar el catálogo');
    } finally {
      setCctSearching(false);
    }
  };

  // Restaurar caché de Step 4 o 5 al navegar entre pasos
  useEffect(() => {
    if (!projectId || !project) return;
    if (activeStep === 4 && !project.fase2Cronograma) {
      const cached4 = getCachedPaecStep(projectId, 4);
      if (cached4) {
        queueMicrotask(() => {
          setProject(prev => prev ? ({ ...prev, fase2Cronograma: cached4 as unknown as PaecProject['fase2Cronograma'] }) : prev);
        });
      }
    }
    if (activeStep === 5 && !project.fase2DetalleCurricular) {
      const cached5 = getCachedPaecStep(projectId, 5);
      if (cached5) {
        queueMicrotask(() => {
          setProject(prev => prev ? ({ ...prev, fase2DetalleCurricular: cached5 as unknown as PaecProject['fase2DetalleCurricular'] }) : prev);
        });
      }
    }
  }, [activeStep, projectId, project]);

  // Catalogs and Selections
  const [laboralCatalog, setLaboralCatalog] = useState<{ uac_name: string; semester: number; curriculum_name: string }[]>([]);
  const [, setFfeCatalog] = useState<{ uac_name: string; semester: number; component: string }[]>([]);
  const [selectedFundamental, setSelectedFundamental] = useState<string[]>(savedDraft?.selectedFundamental ?? []);
  const [selectedLaboral, setSelectedLaboral] = useState<string[]>(savedDraft?.selectedLaboral ?? []);
  const [selectedFfe, setSelectedFfe] = useState<string[]>(savedDraft?.selectedFfe ?? []);
  const [groupsCount, setGroupsCount] = useState(savedDraft?.groupsCount ?? '1');
  const [groupsConfig, setGroupsConfig] = useState(savedDraft?.groupsConfig ?? '');
  const [schoolType, setSchoolType] = useState<SchoolType>(savedDraft?.schoolType ?? 'general');
  const [selectedBtCarreras, setSelectedBtCarreras] = useState<string[]>(savedDraft?.selectedBtCarreras ?? []);
  const [semestersConfig, setSemestersConfig] = useState<Record<number, number>>(
    savedDraft?.semestersConfig ?? { 1: 1, 3: 1, 5: 1 }
  );
  const [groupAssignments, setGroupAssignments] = useState<GroupTrackConfig[]>(
    savedDraft?.groupAssignments ?? []
  );
  const [expandedGroupFfe, setExpandedGroupFfe] = useState<Record<string, boolean>>({});
  const [showFundamentalCustomizer, setShowFundamentalCustomizer] = useState<boolean>(false);
  const [carrerasBT, setCarrerasBT] = useState<BTCarrera[]>([]);

  const availableFundamentalUacs = useMemo(() => {
    const sems = cycleType === 'A' ? [1, 3, 5] : cycleType === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6];
    return obtenerFundamentalesPorSemestres(sems);
  }, [cycleType]);

  interface PaecPreviousExtractDTO {
    projectName?: string;
    problemStatement?: string;
    cycleType?: 'A' | 'B' | 'annual';
    schoolType?: SchoolType;
    school?: {
      schoolName?: string;
      cct?: string;
      directorName?: string;
      municipality?: string;
      [key: string]: unknown;
    };
    community?: {
      context?: string;
      [key: string]: unknown;
    };
    diagnosticoGeneral?: string;
    resumenFase1?: string;
    [key: string]: unknown;
  }

  // Carga inteligente de PAEC anterior (PDF/Word)
  const fileInputPaecRef = useRef<HTMLInputElement>(null);
  const [uploadingPaec, setUploadingPaec] = useState(false);
  const [parsedPaecData, setParsedPaecData] = useState<PaecPreviousExtractDTO | null>(null);
  const [showPaecReviewModal, setShowPaecReviewModal] = useState(false);
  const [paecSuccessBanner, setPaecSuccessBanner] = useState<string | null>(null);

  const handleUploadPreviousPaec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPaec(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/paec/parse-previous', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al analizar el PAEC anterior.');
      }
      setParsedPaecData(json.data as PaecPreviousExtractDTO);
      setShowPaecReviewModal(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'No se pudo procesar el documento anterior.';
      setError(errMsg);
    } finally {
      setUploadingPaec(false);
      if (fileInputPaecRef.current) fileInputPaecRef.current.value = '';
    }
  };

  const handleApplyParsedPaec = () => {
    if (!parsedPaecData) return;
    if (parsedPaecData.projectName) setProjectName(parsedPaecData.projectName);
    if (parsedPaecData.problemStatement) setProblemStatement(parsedPaecData.problemStatement);
    if (parsedPaecData.cycleType) setCycleType(parsedPaecData.cycleType);
    if (parsedPaecData.schoolType) setSchoolType(parsedPaecData.schoolType);

    if (parsedPaecData.school) {
      setSchool(prev => ({
        ...prev,
        ...parsedPaecData.school,
      }));
    }

    if (parsedPaecData.community) {
      setCommunity(prev => ({
        ...prev,
        ...parsedPaecData.community,
      }));
    }

    if (Array.isArray(parsedPaecData.selectedLaboral) && parsedPaecData.selectedLaboral.length > 0) {
      setSelectedLaboral(parsedPaecData.selectedLaboral);
    }

    if (Array.isArray(parsedPaecData.selectedFfe) && parsedPaecData.selectedFfe.length > 0) {
      setSelectedFfe(parsedPaecData.selectedFfe);
    }

    setShowPaecReviewModal(false);
    setPaecSuccessBanner('✓ Datos del PAEC anterior extraídos y aplicados exitosamente.');
  };

  useEffect(() => {
    if (schoolType === 'tecnico' || (selectedBtCarreras && selectedBtCarreras.length > 0)) {
      loadCarrerasTecnicas().then(setCarrerasBT);
    }
  }, [schoolType, selectedBtCarreras]);

  // Sincronizar grupos por semestre cuando cambia la configuración o el ciclo
  useEffect(() => {
    const sems = cycleType === 'A' ? [1, 3, 5] : cycleType === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6];
    const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    queueMicrotask(() => {
      setGroupAssignments((prev) => {
        const updated: GroupTrackConfig[] = [];
        for (const sem of sems) {
          const count = Math.max(1, Math.min(8, semestersConfig[sem] || 1));
          for (let i = 0; i < count; i++) {
            const letter = LETRAS[i] || `${i + 1}`;
            const gId = `${sem}-${letter}`;
            const gName = `${sem}° ${letter}`;
            const existing = prev.find((g) => g.groupId === gId || (g.semester === sem && g.groupName === gName));
            if (existing) {
              updated.push(existing);
            } else {
              updated.push({
                groupId: gId,
                groupName: gName,
                semester: sem,
                trackId: '',
                trackName: '',
                ffeSelections: [],
              });
            }
          }
        }
        return updated;
      });
    });
  }, [cycleType, semestersConfig]);

  // Cómputo en tiempo real de UACs Únicas Consolidadas (Regla de Oro Curricular: Cero Duplicados)
  const uniqueUacsList = useMemo(() => {
    const sems = cycleType === 'A' ? [1, 3, 5] : cycleType === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6];
    return consolidarUacsUnicasPlantel({
      semesters: sems,
      schoolType,
      groupAssignments,
      activeFundamentalUacs: selectedFundamental.length > 0 ? selectedFundamental : undefined,
      activeLaboralUacs: selectedLaboral,
      activeFfeUacs: selectedFfe,
      activeBtCarreras: selectedBtCarreras,
    });
  }, [cycleType, schoolType, groupAssignments, selectedFundamental, selectedLaboral, selectedFfe, selectedBtCarreras]);

  // Manual Edit States
  const [isEditingContent, setIsEditingContent] = useState(false);
  type PaecEditPayload = Fase1Diagnostico | Fase2Justificacion | MapeoRow[] | CronogramaRow[] | DetalleCurricularRow[] | PlanOperativoRow[] | Record<string, unknown> | null;
  const [editPayload, setEditPayload] = useState<PaecEditPayload>(null);

  // Quality Audit States (Quality Gate continuo MCCEMS/NEM)
  const [auditResult, setAuditResult] = useState<PaecQualityAudit | PaecAuditResult | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [showAuditDetails, setShowAuditDetails] = useState(false);
  const [auditFilter, setAuditFilter] = useState<'all' | 'deficient'>('deficient');
  const [showQGTooltip, setShowQGTooltip] = useState(false);

  // Step 8 & 9 Collapsible and Tab States
  const [collapsedCarta, setCollapsedCarta] = useState(false);
  const [collapsedMinuta, setCollapsedMinuta] = useState(false);
  const [collapsedOficios, setCollapsedOficios] = useState(false);
  const [activeAnexoTab, setActiveAnexoTab] = useState<number>(1);
  const [collapsedGobernanza, setCollapsedGobernanza] = useState(false);
  const [collapsedInforme, setCollapsedInforme] = useState(false);

  // Lógica condicional: Sincronizar activeStep si el ciclo oculta el paso actual
  useEffect(() => {
    const visible = getVisibleSteps(cycleType);
    if (!visible.some((s) => s.num === activeStep)) {
      const nextValid = visible.find((s) => s.num >= activeStep) || visible[visible.length - 1];
      if (nextValid) {
        queueMicrotask(() => {
          setActiveStep(nextValid.num);
        });
      }
    }
  }, [cycleType, activeStep]);

  // Auto-save form draft to localStorage whenever step-1 form fields change (only when no projectId)
  const isFirstRenderDraft = useRef(true);
  useEffect(() => {
    if (isFirstRenderDraft.current) { isFirstRenderDraft.current = false; return; }
    if (projectId) return; // project already in DB, no need to save draft
    savePaecDraft({
      projectName,
      problemStatement,
      cycleType,
      community,
      school,
      schoolType,
      selectedFundamental,
      selectedLaboral,
      selectedFfe,
      selectedBtCarreras,
      groupsCount,
      groupsConfig,
      groupAssignments,
      semestersConfig,
    });
  }, [projectId, projectName, problemStatement, cycleType, community, school, schoolType, selectedFundamental, selectedLaboral, selectedFfe, selectedBtCarreras, groupsCount, groupsConfig, groupAssignments, semestersConfig]);

  // Load UAC lists for select checklists
  useEffect(() => {
    async function fetchCatalog() {
      try {
        const resLab = await fetch(`/api/programs?component=laboral`);
        const dataLab = await resLab.json();
        if (dataLab.programs) {
          setLaboralCatalog(dataLab.programs);
        }

        const resFfe1 = await fetch(`/api/programs?component=ext_optativo`);
        const dataFfe1 = await resFfe1.json();
        const resFfe2 = await fetch(`/api/programs?component=ext_obligatorio`);
        const dataFfe2 = await resFfe2.json();
        
        const allFfe = [...(dataFfe1.programs || []), ...(dataFfe2.programs || [])];
        setFfeCatalog(allFfe);
      } catch (err) {
        console.error('Error fetching catalogs:', err);
      }
    }
    fetchCatalog();
  }, []);

  // Fetch PAEC Quality Audit (Evaluación continua 23 Criterios MCCEMS/NEM)
  const fetchAudit = useCallback(async (pId: string) => {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const res = await fetch(`/api/paec/${pId}/audit`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al ejecutar la auditoría de calidad.');
      }
      const data = await res.json();
      if (data.audit) {
        setAuditResult(data.audit);
      }
    } catch (err) {
      console.error('Error fetching audit:', err);
      setAuditError(err instanceof Error ? err.message : 'Error al consultar la auditoría.');
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  const loadProject = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/paec/${id}`);
      if (!res.ok) throw new Error('No se pudo cargar el proyecto.');
      const data = await res.json();
      
      const p = data.project as PaecProject;
      // Sincronizar e hidratar caché local de Steps 4 y 5
      if (p.fase2Cronograma) {
        setCachedPaecStep(id, 4, p.fase2Cronograma);
      } else {
        const cached4 = getCachedPaecStep(id, 4);
        if (cached4) p.fase2Cronograma = cached4 as unknown as PaecProject['fase2Cronograma'];
      }
      if (p.fase2DetalleCurricular) {
        setCachedPaecStep(id, 5, p.fase2DetalleCurricular);
      } else {
        const cached5 = getCachedPaecStep(id, 5);
        if (cached5) p.fase2DetalleCurricular = cached5 as unknown as PaecProject['fase2DetalleCurricular'];
      }
      setProject(p);
      setProjectName(p.projectName);
      setProblemStatement(p.problemStatement);
      setCycleType(p.cycleType);
      if (p.communityContext) setCommunity(p.communityContext);
      if (p.schoolContext) {
        setSchool(p.schoolContext);
        setSelectedFundamental(p.schoolContext.activeFundamentalUacs || []);
        setSelectedLaboral(p.schoolContext.activeLaboralUacs || []);
        setSelectedFfe(p.schoolContext.activeFfeUacs || []);
        setSelectedBtCarreras(p.schoolContext.activeBtCarreras || []);
        setSchoolType(p.schoolContext.schoolType || 'general');
        if (p.schoolContext.groupStructure) {
          setSemestersConfig(p.schoolContext.groupStructure.semestersConfig || { 1: 1, 3: 1, 5: 1 });
          setGroupAssignments(p.schoolContext.groupStructure.groupAssignments || []);
        }
        setGroupsCount(p.schoolContext.groupsCount || '1');
        setGroupsConfig(p.schoolContext.groupsConfig || '');
      }

      // Set active step to the furthest generated step, or current step
      setActiveStep(p.currentStep);

      // Cargar auditoría inicial si existe
      if (p.qualityAudit) {
        setAuditResult(p.qualityAudit);
      }
      fetchAudit(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, [fetchAudit]);

  // Load project details if ID is present
  useEffect(() => {
    if (!projectId) return;
    let isCancelled = false;
    queueMicrotask(() => {
      if (!isCancelled) {
        loadProject(projectId);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [projectId, loadProject]);

  // Auto-fetch audit on mount / project change
  useEffect(() => {
    if (!projectId) return;
    let isCancelled = false;
    queueMicrotask(() => {
      if (!isCancelled) {
        fetchAudit(projectId);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [projectId, fetchAudit]);

  const isStep1Valid = Boolean(
    projectName.trim() &&
    problemStatement.trim() &&
    community.location?.trim() &&
    community.demographics?.trim() &&
    community.economy?.trim() &&
    school.enrollment?.trim() &&
    school.teacherCount?.trim()
  );

  // Handle Form Submission (Create Project)
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isStep1Valid) {
      setError('Por favor completa todos los campos obligatorios marcados con asterisco rojo (*) antes de continuar.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/paec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          problemStatement,
          cycleType,
          communityContext: community,
          schoolContext: {
            ...school,
            schoolType,
            activeFundamentalUacs: selectedFundamental,
            activeLaboralUacs: selectedLaboral,
            activeFfeUacs: selectedFfe,
            activeBtCarreras: selectedBtCarreras,
            groupsConfig,
            groupsCount,
            groupStructure: {
              semestersConfig,
              groupAssignments,
            },
            uniqueUacsList,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar el proyecto.');
      }

      const data = await res.json();
      clearPaecDraft(); // Draft saved to DB — clear localStorage
      setProjectId(data.project.id);
      router.push(`/${locale}/paec/nuevo?id=${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al registrar el proyecto.');
      setLoading(false);
    }
  }

  // Handle Step Generation (Call Claude API)
  async function generateCurrentStep() {
    if (!projectId) return;

    // Invalidar caché si el usuario regenera un paso anterior
    if (activeStep < 4) {
      invalidatePaecStepCache(projectId, 4);
    } else if (activeStep === 4) {
      invalidatePaecStepCache(projectId, 5);
    }

    const currentRetries = retryCount[activeStep] || 0;
    setGenerating(true);
    setError(null);
    setErrorType(null);
    try {
      const res = await fetch(`/api/paec/${projectId}/generate-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: activeStep }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const status = res.status;
        let errMsg = data.error || `Error del servidor HTTP ${status}`;
        if (status === 504 || status === 408) {
          errMsg = 'Timeout de red: El servidor tardó más de 120s en procesar la fase.';
        } else if (status === 429) {
          errMsg = 'Límite de API alcanzado: Demasiadas solicitudes simultáneas a la IA.';
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      setProject(data.project);

      // Guardar en caché si se generó Step 4 o Step 5
      if (activeStep === 4 && data.project?.fase2Cronograma) {
        setCachedPaecStep(projectId, 4, data.project.fase2Cronograma);
      }
      if (activeStep === 5 && data.project?.fase2DetalleCurricular) {
        setCachedPaecStep(projectId, 5, data.project.fase2DetalleCurricular);
      }

      setRetryCount((prev) => ({ ...prev, [activeStep]: 0 }));
      if (data.globalAudit) {
        setAuditResult(data.globalAudit);
      } else if (projectId) {
        fetchAudit(projectId);
      }
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message);
      setErrorType(classified.type);
      setRetryCount((prev) => ({ ...prev, [activeStep]: currentRetries + 1 }));
    } finally {
      setGenerating(false);
    }
  }

  // Get current step's generated JSON data
  function getCurrentStepData() {
    if (!project) return null;
    switch (activeStep) {
      case 1: return JSON.parse(JSON.stringify(project.fase1Diagnostico));
      case 2: return JSON.parse(JSON.stringify(project.fase2Justificacion));
      case 3: return JSON.parse(JSON.stringify(project.fase2Mapeo));
      case 4: return JSON.parse(JSON.stringify(project.fase2Cronograma));
      case 5: return JSON.parse(JSON.stringify(project.fase2DetalleCurricular));
      case 6: return JSON.parse(JSON.stringify(project.fase3PlanOperativoA || project.fase2PlanOperativo?.semestreA || []));
      case 7: return JSON.parse(JSON.stringify(project.fase3PlanOperativoB || project.fase2PlanOperativo?.semestreB || []));
      case 8: return JSON.parse(JSON.stringify(project.fase3Implementacion || project.fase2Anexos || {}));
      case 9: return JSON.parse(JSON.stringify({
        gobernanza: project.fase4Gobernanza || {},
        informeSupervision: project.fase4InformeSupervision || {},
      }));
      default: return null;
    }
  }

  // Save manual modifications back to database
  async function saveStepEdits() {
    if (!projectId || !project || !editPayload) return;
    setLoading(true);
    setError(null);
    try {
      let fieldName = '';
      switch (activeStep) {
        case 1: fieldName = 'fase1_diagnostico'; break;
        case 2: fieldName = 'fase2_justificacion'; break;
        case 3: fieldName = 'fase2_mapeo'; break;
        case 4: fieldName = 'fase2_cronograma'; break;
        case 5: fieldName = 'fase2_detalle_curricular'; break;
        case 6: fieldName = 'fase3_plan_operativo_a'; break;
        case 7: fieldName = 'fase3_plan_operativo_b'; break;
        case 8: fieldName = 'fase3_implementacion'; break;
        case 9: fieldName = 'fase4_gobernanza_e_informe'; break;
      }

      const res = await fetch(`/api/paec/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldName,
          stepData: editPayload,
          step: project.currentStep,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar los cambios.');
      }

      const data = await res.json();
      setProject(data.project);
      setIsEditingContent(false);
      setEditPayload(null);
      if (projectId) {
        fetchAudit(projectId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la edición.');
    } finally {
      setLoading(false);
    }
  }

  // Grouping helper for laboral UACs with fallback to authentic official catalog
  const groupedLaboral = useMemo(() => {
    const normalizeKey = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const map: Record<string, Record<number, { uac_name: string; semester: number; curriculum_name: string }[]>> = {};

    // 1. Pre-seed with authentic official catalog (15 capacitaciones × 4 semestres × 2 UACs = 120 UACs)
    for (const [capName, sems] of Object.entries(UACS_LABORALES_OFICIALES_BGE)) {
      const normKey = normalizeKey(capName);
      const semObj: Record<number, { uac_name: string; semester: number; curriculum_name: string }[]> = {};
      for (const [semStr, uacList] of Object.entries(sems)) {
        const sem = parseInt(semStr, 10);
        semObj[sem] = uacList.map(name => ({
          uac_name: name,
          semester: sem,
          curriculum_name: capName,
        }));
      }
      map[capName] = semObj;
      map[normKey] = semObj;
    }

    // 2. Overlay dynamic catalog from DB if loaded
    for (const item of laboralCatalog) {
      const cap = item.curriculum_name || 'General';
      const normCap = normalizeKey(cap);
      if (!map[cap]) {
        map[cap] = {};
        map[normCap] = map[cap];
      }
      if (!map[cap][item.semester]) {
        map[cap][item.semester] = [];
      }
      if (!map[cap][item.semester].some(u => u.uac_name.toLowerCase() === item.uac_name.toLowerCase())) {
        map[cap][item.semester].push(item);
      }
    }

    return map;
  }, [laboralCatalog]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--c-text-muted)' }}>
        <span className="spinner" style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid var(--c-blue-pale)', borderTopColor: 'var(--c-blue-mid)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', fontSize: '16px' }}>Cargando proyecto...</p>
      </div>
    );
  }

  // Render Paso 0: Formulario de Creación
  if (!projectId) {
    return (
      <div style={{ maxWidth: '880px', margin: '0 auto', paddingBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Link href={`/${locale}/paec`} className="btn btn-ghost" style={{ padding: '8px 12px', color: 'rgba(240,244,255,0.7)' }}>
            ← Volver
          </Link>
          <div>
            <h1 style={{ fontSize: '28px', color: '#f0f4ff', margin: 0, fontWeight: 800, fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", letterSpacing: '-0.5px' }}>Nuevo Proyecto PAEC-PEC</h1>
            <p style={{ color: 'rgba(240,244,255,0.6)', margin: '4px 0 0' }}>Completa los datos iniciales de tu plantel y comunidad para comenzar</p>
          </div>
        </div>

        {paecSuccessBanner && (
          <div style={{ marginBottom: '18px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{paecSuccessBanner}</span>
            <button
              type="button"
              onClick={() => setPaecSuccessBanner(null)}
              style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Barra de Carga Rápida de PAEC Anterior */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.95) 100%)', border: '1px solid rgba(99,102,241,0.3)', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📄</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>¿Cuentas con un PAEC anterior en PDF o Word?</div>
              <div style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.6)' }}>Sube el archivo para extraer automáticamente problemáticas, diagnóstico y datos del plantel</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputPaecRef.current?.click()}
            disabled={uploadingPaec}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.45)',
              color: '#c7d2fe', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {uploadingPaec ? '⏳ Analizando documento...' : '📄 Cargar PAEC Anterior (PDF/Word)'}
          </button>
          <input
            ref={fileInputPaecRef}
            type="file"
            accept=".pdf,.docx,.doc"
            style={{ display: 'none' }}
            onChange={handleUploadPreviousPaec}
          />
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Datos del Proyecto */}
          <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '18px', color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '16px', fontWeight: 700 }}>1. Identificación del Proyecto</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Nombre Preliminar del Proyecto Escolar Comunitario <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Transformando el PET en Soluciones Comunitarias Ecológicas"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#f0f4ff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Problemática o Necesidad seleccionada por el Comité del Plantel <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej: Alto índice de contaminación por residuos plásticos en los alrededores del plantel y falta de cultura de reciclaje en la comunidad."
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#f0f4ff', resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Ciclo Semestral / Bloque de Relevo <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={cycleType}
                  onChange={(e) => setCycleType(e.target.value as 'A' | 'B' | 'annual')}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#f0f4ff' }}
                >
                  <option value="A">Semestre A (1° y 3° Semestre - Septiembre-Enero)</option>
                  <option value="B">Semestre B (2° y 4° Semestre - Febrero-Junio)</option>
                  <option value="annual">Proyecto Completo (1° al 6° Semestre)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contexto Comunitario */}
          <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '18px', color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '16px', fontWeight: 700 }}>2. Ficha de Datos de la Comunidad (INEGI/Entorno)</h2>
            <p style={{ margin: '-10px 0 16px', fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>
              Puedes consultar y obtener los datos demográficos y socioeconómicos de tu localidad en el buscador oficial de INEGI:{' '}
              <a href="https://www.inegi.org.mx/app/areasgeograficas/" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'underline' }}>
                Sistema de Áreas Geográficas de INEGI 🔗
              </a>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
                  Ubicación Geográfica y Nombre de la Localidad <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: San Antonio Tepetitlán, Municipio de Chignahuapan, Puebla"
                  value={community.location}
                  onChange={(e) => setCommunity({ ...community, location: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
                  Situación Demográfica <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Población de 4,200 habitantes, mayoría joven menor de 25 años"
                  value={community.demographics}
                  onChange={(e) => setCommunity({ ...community, demographics: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
                  Actividades Socioeconómicas Principales <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Agricultura de temporal, comercio local y artesanías"
                  value={community.economy}
                  onChange={(e) => setCommunity({ ...community, economy: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Tradiciones Socioculturales</label>
                <input
                  type="text"
                  placeholder="Ej: Fiestas patronales locales, tradiciones comunitarias"
                  value={community.traditions}
                  onChange={(e) => setCommunity({ ...community, traditions: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Seguridad Pública</label>
                <input
                  type="text"
                  placeholder="Ej: Nivel de seguridad moderado, presencia de policía municipal"
                  value={community.security}
                  onChange={(e) => setCommunity({ ...community, security: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Situación Medioambiental</label>
                <input
                  type="text"
                  placeholder="Ej: Escasez de agua en temporada seca, manejo deficiente de residuos sólidos"
                  value={community.environment}
                  onChange={(e) => setCommunity({ ...community, environment: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
            </div>
          </div>

          {/* Contexto del Plantel */}
          <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', color: '#818cf8', margin: 0, fontWeight: 700 }}>3. Ficha de Datos del Plantel</h2>
              {cctSearching && (
                <span style={{ fontSize: '12px', color: '#38bdf8' }}>🔍 Buscando en catálogo de Puebla...</span>
              )}
            </div>

            {/* Búsqueda y Autocompletado por CCT */}
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'flex-start' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '12px', color: '#818cf8', textTransform: 'uppercase' }}>
                    Clave CCT (Puebla)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Ej: 21EBH0200X"
                      value={school.cct || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setSchool(prev => ({ ...prev, cct: val }));
                        if (val.length >= 7) {
                          handleCctLookup(val);
                        } else {
                          setCctWarning(null);
                        }
                      }}
                      onBlur={() => {
                        if (school.cct && school.cct.length >= 5) {
                          handleCctLookup(school.cct);
                        }
                      }}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff', fontFamily: 'monospace', fontWeight: 700 }}
                    />
                    <button
                      type="button"
                      onClick={handleConsultarZona}
                      disabled={loadingZona}
                      style={{
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: loadingZona ? 'wait' : 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                      }}
                      title="Consultar diagnóstico, estadísticas 911/F11 y contexto territorial desde la Cartografía de Zona Escolar"
                    >
                      {loadingZona ? '⏳ Consultando...' : '✨ Consultar Zona'}
                    </button>
                  </div>
                  {cctWarning && (
                    <div style={{ color: '#f87171', fontSize: '11.5px', marginTop: '4px', fontWeight: 500 }}>
                      ⚠️ {cctWarning} (puedes capturar los datos manualmente)
                    </div>
                  )}
                  {zonaFeedback && (
                    <div style={{
                      color: zonaFeedback.startsWith('✅') ? '#34d399' : '#fbbf24',
                      fontSize: '11.5px',
                      marginTop: '6px',
                      fontWeight: 600,
                      background: 'rgba(0,0,0,0.2)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                    }}>
                      {zonaFeedback}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px', fontSize: '12px', color: 'rgba(240,244,255,0.7)' }}>
                    Nombre del Plantel
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Bachillerato Digital Núm. 46"
                    value={school.schoolName || ''}
                    onChange={(e) => setSchool(prev => ({ ...prev, schoolName: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px', fontSize: '12px', color: 'rgba(240,244,255,0.7)' }}>
                    Municipio
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Venustiano Carranza"
                    value={school.municipality || ''}
                    onChange={(e) => setSchool(prev => ({ ...prev, municipality: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px', fontSize: '12px', color: 'rgba(240,244,255,0.7)' }}>
                    Localidad
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: San José"
                    value={school.locality || ''}
                    onChange={(e) => setSchool(prev => ({ ...prev, locality: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px', fontSize: '12px', color: 'rgba(240,244,255,0.7)' }}>
                    Zona Escolar
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Zona Escolar 004"
                    value={school.schoolZone || ''}
                    onChange={(e) => setSchool(prev => ({ ...prev, schoolZone: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
                  Matrícula Escolar (Estudiantes) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 280 alumnos inscritos en ambos semestres"
                  value={school.enrollment}
                  onChange={(e) => setSchool({ ...school, enrollment: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
                  Plantilla Docente <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 12 docentes, 1 orientador y 2 administrativos"
                  value={school.teacherCount}
                  onChange={(e) => setSchool({ ...school, teacherCount: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Indicadores Educativos (Aprovechamiento/Rezago)</label>
                <input
                  type="text"
                  placeholder="Ej: 78% de aprobación, 10% deserción semestral"
                  value={school.indicators}
                  onChange={(e) => setSchool({ ...school, indicators: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Programas Activos Previos</label>
                <input
                  type="text"
                  placeholder="Ej: Programa ConstruyeT, campaña de salud escolar"
                  value={school.previousPrograms}
                  onChange={(e) => setSchool({ ...school, previousPrograms: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Instalaciones y Equipamiento Destacado</label>
                <input
                  type="text"
                  placeholder="Ej: Aulas equipadas, biblioteca, cancha deportiva, área verde"
                  value={school.facilities}
                  onChange={(e) => setSchool({ ...school, facilities: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
            </div>
          </div>

          {/* Estructura de Grupos, Capacitaciones y FFE */}
          <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', color: '#818cf8', margin: 0, fontWeight: 700 }}>4. Estructura Curricular y Grupos del Plantel</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>
                  Regla de Oro PAEC: Tronco fundamental único por semestre + trayectos específicos por grupo sin asignaturas duplicadas.
                </p>
              </div>
              <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontWeight: 600 }}>
                {schoolType === 'tecnico' ? '⚙️ Bachillerato Tecnológico' : '🏫 Bachillerato General'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 4.1 Tipo de Plantel */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', fontSize: '13.5px', color: '#f0f4ff' }}>
                  Modalidad Oficial del Plantel
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {[
                    { id: 'general' as const, label: '🏫 Bachillerato General (BGE)', desc: 'Capacitaciones laborales y optativas FFE' },
                    { id: 'tecnico' as const, label: '⚙️ Bachillerato Tecnológico (BT)', desc: 'Módulos profesionales de carreras técnicas' },
                    { id: 'telebachillerato' as const, label: '🌄 Telebachillerato Comunitario', desc: 'Malla comunitaria articulada' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSchoolType(m.id)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: schoolType === m.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${schoolType === m.id ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                        color: schoolType === m.id ? '#ffffff' : 'rgba(240,244,255,0.7)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px', color: schoolType === m.id ? '#818cf8' : '#f0f4ff' }}>{m.label}</div>
                      <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4.2 Presets de Grupos */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13.5px', color: '#f0f4ff' }}>
                    Estructura de Grupos por Semestre Activo
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { label: 'Estructura 1-1-1', n: 1 },
                      { label: 'Estructura 2-2-2', n: 2 },
                      { label: 'Estructura 3-3-3', n: 3 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          const sems = cycleType === 'A' ? [1, 3, 5] : cycleType === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6];
                          const newConfig: Record<number, number> = {};
                          sems.forEach((s) => (newConfig[s] = p.n));
                          setSemestersConfig(newConfig);
                          setGroupsCount(`${p.n} grupo${p.n > 1 ? 's' : ''} por semestre`);
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: 'rgba(255,255,255,0.05)',
                          color: '#a5b4fc',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contadores por semestre activo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  {(cycleType === 'A' ? [1, 3, 5] : cycleType === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6]).map((sem) => (
                    <div key={sem} style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 600 }}>{sem}° Semestre</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                          {semestersConfig[sem] || 1} {((semestersConfig[sem] || 1) > 1 ? 'grupos' : 'grupo')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = semestersConfig[sem] || 1;
                            if (cur > 1) setSemestersConfig((prev) => ({ ...prev, [sem]: cur - 1 }));
                          }}
                          style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = semestersConfig[sem] || 1;
                            if (cur < 8) setSemestersConfig((prev) => ({ ...prev, [sem]: cur + 1 }));
                          }}
                          style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4.3 Asignación por Grupo (Laboral / FFE / BT) */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13.5px', color: '#f0f4ff' }}>
                  Asignación de Trayectos Especializados por Grupo
                </label>
                <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.6)', margin: '0 0 14px' }}>
                  Las materias del tronco fundamental aplican automáticamente una sola vez. Asigna aquí qué formación laboral, FFE o carrera cursa cada grupo para incluirlas sin duplicados.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {groupAssignments.map((grp) => {
                    const isLaboralSem = grp.semester === 3 || grp.semester === 4;
                    const isFfeSem = grp.semester === 5 || grp.semester === 6;

                    if (!isLaboralSem && !isFfeSem && schoolType !== 'tecnico') {
                      return (
                        <div key={grp.groupId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: '#a5b4fc' }}>Grupo {grp.groupName}</span>
                          <span style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.6)' }}>Tronco Fundamental MCCEMS (Unificado)</span>
                        </div>
                      );
                    }

                    return (
                      <div key={grp.groupId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', gap: '10px' }}>
                        <div style={{ minWidth: '120px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#ffffff' }}>Grupo {grp.groupName}</span>
                          <div style={{ fontSize: '11px', color: '#818cf8', marginTop: '2px' }}>
                            {schoolType === 'tecnico' ? 'Carrera Técnica BT' : isLaboralSem ? 'Formación Laboral (3°-4°)' : 'Paquete FFE (5°-6°)'}
                          </div>
                        </div>

                        <div style={{ flex: '1', minWidth: '240px' }}>
                          {schoolType === 'tecnico' ? (
                            <select
                              value={grp.trackId || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGroupAssignments((prev) =>
                                  prev.map((g) => (g.groupId === grp.groupId ? { ...g, trackId: val, trackName: val } : g))
                                );
                              }}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: '#0f172a', color: '#f0f4ff', fontSize: '12.5px' }}
                            >
                              <option value="">Selecciona Carrera Técnica BT...</option>
                              {carrerasBT.map((c) => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                              ))}
                            </select>
                          ) : isLaboralSem ? (
                            <select
                              value={grp.trackName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGroupAssignments((prev) =>
                                  prev.map((g) => (g.groupId === grp.groupId ? { ...g, trackId: val, trackName: val } : g))
                                );
                              }}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: '#0f172a', color: '#f0f4ff', fontSize: '12.5px' }}
                            >
                              <option value="">Selecciona Capacitación Laboral...</option>
                              {FORMACIONES_LABORALES.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {/* Barra de estado y presets rápidos */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: (grp.ffeSelections?.length || 0) > 0 ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)', color: (grp.ffeSelections?.length || 0) > 0 ? '#a5b4fc' : '#94a3b8', fontWeight: 600, border: '1px solid rgba(99,102,241,0.3)' }}>
                                    {grp.ffeSelections?.length || 0} UACs FFE
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedGroupFfe(prev => ({ ...prev, [grp.groupId]: !prev[grp.groupId] }))}
                                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: expandedGroupFfe[grp.groupId] ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)', color: '#ffffff', cursor: 'pointer', fontWeight: 500 }}
                                  >
                                    {expandedGroupFfe[grp.groupId] ? '▲ Ocultar 20 FFE' : '▼ Seleccionar asignaturas individuales (20 FFE)'}
                                  </button>
                                </div>

                                {/* Selector de Presets opcional */}
                                <select
                                  value={grp.trackId || ''}
                                  onChange={(e) => {
                                    const pkgKey = e.target.value;
                                    if (!pkgKey) {
                                      setGroupAssignments(prev => prev.map(g => g.groupId === grp.groupId ? { ...g, trackId: '', trackName: '', ffeSelections: [] } : g));
                                      return;
                                    }
                                    const pkg = FFE_PACKAGES[pkgKey];
                                    const subjects = pkg ? pkg.subjects.map(s => grp.semester === 6 ? obtenerFfeSemestre6(s) : s) : [];
                                    setGroupAssignments(prev =>
                                      prev.map(g =>
                                        g.groupId === grp.groupId
                                          ? {
                                              ...g,
                                              trackId: pkgKey,
                                              trackName: pkg ? pkg.label : 'Personalizado',
                                              ffeSelections: subjects,
                                            }
                                          : g
                                      )
                                    );
                                  }}
                                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.12)', background: '#0f172a', color: '#cbd5e1', fontSize: '11px' }}
                                >
                                  <option value="">⚡ Cargar preset propedéutico...</option>
                                  {Object.entries(FFE_PACKAGES).map(([k, p]) => (
                                    <option key={k} value={k}>{p.label}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Resumen de materias seleccionadas actualmente */}
                              {(grp.ffeSelections && grp.ffeSelections.length > 0) && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                  {grp.ffeSelections.map((subj) => (
                                    <span key={subj} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                      {subj}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setGroupAssignments(prev => prev.map(g => g.groupId === grp.groupId ? {
                                            ...g,
                                            trackId: 'custom',
                                            trackName: 'Personalizado',
                                            ffeSelections: (g.ffeSelections || []).filter(s => s !== subj),
                                          } : g));
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 2px', fontSize: '11px', fontWeight: 'bold' }}
                                        title="Quitar asignatura"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Panel desplegable con las 20 asignaturas de FFE */}
                              {expandedGroupFfe[grp.groupId] && (
                                <div style={{ marginTop: '8px', padding: '10px', borderRadius: '6px', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 600 }}>
                                      Catálogo Oficial de 20 UACs FFE ({grp.semester}° Semestre)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGroupAssignments(prev => prev.map(g => g.groupId === grp.groupId ? { ...g, trackId: '', trackName: '', ffeSelections: [] } : g));
                                      }}
                                      style={{ fontSize: '10px', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                      Limpiar asignaturas
                                    </button>
                                  </div>

                                  {/* Recursos Sociocognitivos (7) */}
                                  <div>
                                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>
                                      📘 Recursos Sociocognitivos (7 asignaturas)
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '5px' }}>
                                      {FFE_PAIRS.filter(p => p.category === 'Recursos Sociocognitivos').map((pair) => {
                                        const subjectName = grp.semester === 6 ? pair.name6 : pair.name5;
                                        const isChecked = (grp.ffeSelections || []).includes(subjectName);
                                        return (
                                          <label key={pair.name5} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '11px', cursor: 'pointer', color: isChecked ? '#ffffff' : 'rgba(240,244,255,0.7)', lineHeight: 1.25 }}>
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                setGroupAssignments(prev => prev.map(g => {
                                                  if (g.groupId !== grp.groupId) return g;
                                                  const current = g.ffeSelections || [];
                                                  const next = isChecked ? current.filter(s => s !== subjectName) : [...current, subjectName];
                                                  return {
                                                    ...g,
                                                    trackId: 'custom',
                                                    trackName: 'Personalizado',
                                                    ffeSelections: next,
                                                  };
                                                }));
                                              }}
                                              style={{ marginTop: '1px' }}
                                            />
                                            <span>{subjectName}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Áreas de Conocimiento (13) */}
                                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#34d399', marginBottom: '6px' }}>
                                      🔬 Áreas de Conocimiento (13 asignaturas)
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '5px' }}>
                                      {FFE_PAIRS.filter(p => p.category !== 'Recursos Sociocognitivos').map((pair) => {
                                        const subjectName = grp.semester === 6 ? pair.name6 : pair.name5;
                                        const isChecked = (grp.ffeSelections || []).includes(subjectName);
                                        return (
                                          <label key={pair.name5} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '11px', cursor: 'pointer', color: isChecked ? '#ffffff' : 'rgba(240,244,255,0.7)', lineHeight: 1.25 }}>
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                setGroupAssignments(prev => prev.map(g => {
                                                  if (g.groupId !== grp.groupId) return g;
                                                  const current = g.ffeSelections || [];
                                                  const next = isChecked ? current.filter(s => s !== subjectName) : [...current, subjectName];
                                                  return {
                                                    ...g,
                                                    trackId: 'custom',
                                                    trackName: 'Personalizado',
                                                    ffeSelections: next,
                                                  };
                                                }));
                                              }}
                                              style={{ marginTop: '1px' }}
                                            />
                                            <span>{subjectName}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4.3.5 Selección de Asignaturas del Tronco Fundamental (Soporte Multi-PAEC) */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13.5px', color: '#f0f4ff', margin: 0 }}>
                      <span>📘 Tronco Fundamental</span>
                      <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '10px', background: selectedFundamental.length > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(52,211,153,0.15)', color: selectedFundamental.length > 0 ? '#a5b4fc' : '#34d399', border: `1px solid ${selectedFundamental.length > 0 ? 'rgba(99,102,241,0.4)' : 'rgba(52,211,153,0.3)'}` }}>
                        {selectedFundamental.length > 0 ? `${selectedFundamental.length} seleccionadas (Multi-PAEC)` : 'Todas incluidas (100%)'}
                      </span>
                    </label>
                    <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.6)', margin: '4px 0 0' }}>
                      Por defecto, el PAEC abarca el 100% de las materias fundamentales. Si tu plantel desarrolla múltiples proyectos PAEC paralelos, puedes seleccionar qué materias específicas participan en este proyecto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFundamentalCustomizer(prev => !prev)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: showFundamentalCustomizer ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(99,102,241,0.4)',
                      color: '#a5b4fc',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {showFundamentalCustomizer ? '▲ Ocultar selector' : '⚙️ Personalizar asignaturas'}
                  </button>
                </div>

                {showFundamentalCustomizer && (
                  <div style={{ marginTop: '12px', padding: '14px', borderRadius: '8px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#c7d2fe', fontWeight: 600 }}>
                        Catálogo de Asignaturas Fundamentales ({availableFundamentalUacs.length} disponibles)
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedFundamental([])}
                          style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Incluir todas (Por defecto)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedFundamental(availableFundamentalUacs.map(u => u.nombre))}
                          style={{ fontSize: '11px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Marcar todas
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                      {availableFundamentalUacs.map((u) => {
                        const isChecked = selectedFundamental.length === 0 || selectedFundamental.includes(u.nombre);
                        return (
                          <label
                            key={`${u.semestre}_${u.nombre}`}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              background: isChecked ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.01)',
                              border: `1px solid ${isChecked ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'}`,
                              cursor: 'pointer',
                              fontSize: '11.5px',
                              color: isChecked ? '#ffffff' : 'rgba(240,244,255,0.5)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                let next: string[];
                                if (selectedFundamental.length === 0) {
                                  next = availableFundamentalUacs.map(item => item.nombre).filter(n => n !== u.nombre);
                                } else if (selectedFundamental.includes(u.nombre)) {
                                  next = selectedFundamental.filter(n => n !== u.nombre);
                                } else {
                                  next = [...selectedFundamental, u.nombre];
                                }
                                if (next.length === availableFundamentalUacs.length) {
                                  next = [];
                                }
                                setSelectedFundamental(next);
                              }}
                              style={{ marginTop: '2px' }}
                            />
                            <div>
                              <span style={{ fontWeight: 600, color: '#818cf8', marginRight: '4px' }}>{u.semestre}°</span>
                              <span>{u.nombre}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 4.4 PREVISUALIZACIÓN EN TIEMPO REAL: CERO DUPLICADOS */}
              <div style={{ marginTop: '6px', padding: '16px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)', border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 4px 15px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>🎯</span>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#ffffff', fontWeight: 700 }}>
                        Padrón Curricular Consolidado del PAEC
                      </h3>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.2)', color: '#34d399', fontWeight: 600, border: '1px solid rgba(16,185,129,0.4)' }}>
                        ✓ CERO DUPLICADOS
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(240,244,255,0.7)' }}>
                      Fórmula Oficial: Fundamental (1 vez) ∪ Laborales Únicas ∪ FFE Únicas ∪ BT Únicos
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '26px', fontWeight: 800, color: '#818cf8' }}>{uniqueUacsList.length}</span>
                    <span style={{ fontSize: '12px', color: 'rgba(240,244,255,0.8)', fontWeight: 600 }}>UACs Únicas</span>
                  </div>
                </div>

                {/* Badges de Desglose */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                  <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(30,58,138,0.5)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', fontWeight: 500 }}>
                    📘 Fundamental: {uniqueUacsList.filter((u) => u.component === 'fundamental').length}
                  </span>
                  <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(6,78,59,0.5)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', fontWeight: 500 }}>
                    💼 Laboral: {uniqueUacsList.filter((u) => u.component === 'laboral').length}
                  </span>
                  <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(88,28,135,0.5)', border: '1px solid rgba(168,85,247,0.3)', color: '#d8b4fe', fontWeight: 500 }}>
                    🧬 FFE: {uniqueUacsList.filter((u) => u.component === 'ffe').length}
                  </span>
                  {schoolType === 'tecnico' && (
                    <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(120,53,15,0.5)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d', fontWeight: 500 }}>
                      ⚙️ Profesional BT: {uniqueUacsList.filter((u) => u.component === 'profesional_bt').length}
                    </span>
                  )}
                </div>

                {/* Vista previa colapsable de las materias */}
                <div style={{ marginTop: '12px', maxHeight: '160px', overflowY: 'auto', padding: '8px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px' }}>
                    {uniqueUacsList.map((u, i) => (
                      <div key={`${u.semester}-${u.uacName}-${i}`} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(240,244,255,0.85)' }}>
                        <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', fontWeight: 600, fontSize: '10px' }}>
                          {u.semester}°
                        </span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.uacName}>
                          {u.uacName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Laboral Checklist */}
              <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '16px', marginTop: '8px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '10px', fontSize: '15px', color: 'var(--c-navy)' }}>
                  Capacitaciones para el Trabajo (Formación Laboral) activas *
                </label>
                <p style={{ fontSize: '12.5px', color: 'var(--c-text-muted)', marginBottom: '14px', marginTop: '-6px' }}>
                  Selecciona las capacitaciones de tu escuela. Cada capacitación contiene 8 asignaturas divididas de 3° a 6° semestre.
                </p>

                {laboralCatalog.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)', fontStyle: 'italic' }}>Cargando catálogo laboral...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '420px', overflowY: 'auto', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(8,12,24,0.5)' }}>
                    {Object.keys(CAPACITACION_TITLES).map((capKey) => {
                      const title = CAPACITACION_TITLES[capKey];
                      const semGroups = groupedLaboral[capKey] || {};
                      
                      const capUacs = Object.values(semGroups).flat();
                      const allSelected = capUacs.length > 0 && capUacs.every(u => selectedLaboral.includes(u.uac_name));

                      return (
                        <div key={capKey} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '12px', background: 'rgba(255,255,255,0.03)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '10px' }}>
                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#818cf8' }}>{title}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const names = capUacs.map(u => u.uac_name);
                                if (allSelected) {
                                  setSelectedLaboral(prev => prev.filter(n => !names.includes(n)));
                                } else {
                                  setSelectedLaboral(prev => Array.from(new Set([...prev, ...names])));
                                }
                              }}
                              style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', cursor: 'pointer', fontWeight: 600 }}
                            >
                              {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                            </button>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            {[3, 4, 5, 6].map((sem) => {
                              const uacs = semGroups[sem] || [];
                              if (uacs.length === 0) return null;
                              return (
                                <div key={sem} style={{ background: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '4px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', marginBottom: '6px' }}>{sem}° Semestre</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {uacs.map((u) => {
                                      const isChecked = selectedLaboral.includes(u.uac_name);
                                      return (
                                        <label key={u.uac_name} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11.5px', cursor: 'pointer', lineHeight: 1.3 }}>
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                              if (isChecked) {
                                                setSelectedLaboral(selectedLaboral.filter(n => n !== u.uac_name));
                                              } else {
                                                setSelectedLaboral([...selectedLaboral, u.uac_name]);
                                              }
                                            }}
                                            style={{ marginTop: '2px' }}
                                          />
                                          <span>{u.uac_name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* FFE Checklist */}
              <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '16px', marginTop: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '10px', fontSize: '15px', color: 'var(--c-navy)' }}>
                  Formación Fundamental Extendida (FFE/FFEO) activas
                </label>
                <p style={{ fontSize: '12.5px', color: 'var(--c-text-muted)', marginBottom: '14px', marginTop: '-6px' }}>
                  Selecciona las asignaturas de FFE. Dado que tienen continuidad obligatoria, al seleccionar la materia de 5° Semestre se vinculará automáticamente con su continuación en 6° Semestre.
                </p>


                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(8,12,24,0.5)' }}>
                    {FFE_PAIRS.map((pair) => {
                      const isChecked5 = selectedFfe.includes(pair.name5);
                      const isChecked6 = selectedFfe.includes(pair.name6);

                      return (
                        <div key={pair.label} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '10px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', gap: '10px' }}>
                          <div style={{ minWidth: '220px', flex: '1' }}>
                            <strong style={{ fontSize: '13px', color: '#818cf8' }}>{pair.label}</strong>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isChecked5}
                                onChange={() => {
                                  if (isChecked5) {
                                    setSelectedFfe(selectedFfe.filter(n => n !== pair.name5 && n !== pair.name6));
                                  } else {
                                    // Autoselect matching 6th semester FFE too
                                    setSelectedFfe(prev => Array.from(new Set([...prev, pair.name5, pair.name6])));
                                  }
                                }}
                              />
                              <span style={{ fontWeight: 500 }}>5° Sem:</span>
                              <span style={{ color: 'var(--c-text-muted)' }}>{pair.name5.split(' (')[0]}</span>
                            </label>

                            <span style={{ color: '#cbd5e1' }}>➔</span>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isChecked6}
                                onChange={() => {
                                  if (isChecked6) {
                                    setSelectedFfe(selectedFfe.filter(n => n !== pair.name6 && n !== pair.name5));
                                  } else {
                                    // Autoselect matching 5th semester FFE too
                                    setSelectedFfe(prev => Array.from(new Set([...prev, pair.name5, pair.name6])));
                                  }
                                }}
                              />
                              <span style={{ fontWeight: 500 }}>6° Sem:</span>
                              <span style={{ color: 'var(--c-text-muted)' }}>{pair.name6.split(' (')[0]}</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </div>

            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button
              type="submit"
              disabled={!isStep1Valid || loading}
              className="btn btn-primary"
              style={{
                padding: '12px 28px',
                fontSize: '16px',
                background: (!isStep1Valid || loading) ? '#64748b' : 'linear-gradient(135deg, var(--c-navy) 0%, var(--c-navy-light) 100%)',
                border: 'none',
                cursor: (!isStep1Valid || loading) ? 'not-allowed' : 'pointer',
                opacity: (!isStep1Valid || loading) ? 0.6 : 1,
              }}
            >
              {loading ? 'Guardando...' : 'Guardar y Empezar Generación →'}
            </button>
            {!isStep1Valid && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px' }}>
                * Por favor completa todos los campos obligatorios marcados con asterisco (*) antes de continuar.
              </p>
            )}
          </div>
        </form>

        {/* Modal de Revisión y Confirmación de PAEC Anterior Extraído */}
        {showPaecReviewModal && parsedPaecData && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
            backdropFilter: 'blur(5px)',
          }}>
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '16px',
              maxWidth: '740px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#f0f4ff', fontWeight: 700 }}>
                    📄 Revisión de Datos Extraídos del PAEC Anterior
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Revisa los datos extraídos automáticamente del documento antes de aplicarlos al formulario.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaecReviewModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              {/* Proyecto y Problemática */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>🎯 Identificación del Proyecto</h4>
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Nombre del Proyecto:</strong>
                  <div style={{ fontSize: '13.5px', color: '#f0f4ff', fontWeight: 600 }}>{parsedPaecData.projectName || '(Sin detectar)'}</div>
                </div>
                <div>
                  <strong style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Problemática Central:</strong>
                  <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.4 }}>{parsedPaecData.problemStatement || '(Sin detectar)'}</div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11.5px', color: '#a5b4fc' }}>
                  <span>Ciclo: <strong>{parsedPaecData.cycleType === 'annual' ? 'Anual' : `Semestre ${parsedPaecData.cycleType}`}</strong></span>
                  <span>Tipo: <strong>{parsedPaecData.schoolType}</strong></span>
                </div>
              </div>

              {/* Plantel */}
              {parsedPaecData.school && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>🏫 Datos del Plantel</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', fontSize: '12px' }}>
                    <div><strong style={{ color: '#94a3b8' }}>Plantel:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPaecData.school.schoolName || '-'}</span></div>
                    <div><strong style={{ color: '#94a3b8' }}>CCT:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPaecData.school.cct || '-'}</span></div>
                    <div><strong style={{ color: '#94a3b8' }}>Director:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPaecData.school.directorName || '-'}</span></div>
                    <div><strong style={{ color: '#94a3b8' }}>Municipio:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPaecData.school.municipality || '-'}</span></div>
                  </div>
                </div>
              )}

              {/* Comunidad */}
              {parsedPaecData.community && parsedPaecData.community.context && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>🌱 Contexto Comunitario y Territorial</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', maxHeight: '100px', overflowY: 'auto', lineHeight: 1.4 }}>
                    {parsedPaecData.community.context}
                  </p>
                </div>
              )}

              {/* Botones de acción modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowPaecReviewModal(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #475569', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyParsedPaec}
                  style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ✓ Aplicar al Formulario de PAEC
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Helper to determine if current active step is generated
  function isStepGenerated(s: number): boolean {
    if (!project) return false;
    switch (s) {
      case 1: return !!project.fase1Diagnostico;
      case 2: return !!project.fase2Justificacion;
      case 3: return !!(project.fase2Mapeo && project.fase2Mapeo.length > 0);
      case 4: return !!(project.fase2Cronograma && project.fase2Cronograma.length > 0);
      case 5: return !!(project.fase2DetalleCurricular && project.fase2DetalleCurricular.length > 0);
      case 6: return !!(project.fase3PlanOperativoA && project.fase3PlanOperativoA.length > 0) || !!(project.fase2PlanOperativo?.semestreA && project.fase2PlanOperativo.semestreA.length > 0);
      case 7: return !!(project.fase3PlanOperativoB && project.fase3PlanOperativoB.length > 0) || !!(project.fase2PlanOperativo?.semestreB && project.fase2PlanOperativo.semestreB.length > 0);
      case 8: return !!project.fase3Implementacion || !!project.fase2Anexos;
      case 9: return !!(project.fase4Gobernanza || project.fase4InformeSupervision);
      default: return false;
    }
  }

  const generated = isStepGenerated(activeStep);
  const visibleSteps = getVisibleSteps(cycleType);
  const currentStepIdx = visibleSteps.findIndex(s => s.num === activeStep);
  const prevStep = currentStepIdx > 0 ? visibleSteps[currentStepIdx - 1] : null;
  const nextStep = currentStepIdx >= 0 && currentStepIdx < visibleSteps.length - 1 ? visibleSteps[currentStepIdx + 1] : null;
  const isLastVisibleStep = currentStepIdx === visibleSteps.length - 1;
  const activeStepInfo = ALL_STEPS.find(s => s.num === activeStep) || ALL_STEPS[0];

  return (
    <div style={{ maxWidth: '1024px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--c-border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <Link href={`/${locale}/paec`} className="btn btn-ghost" style={{ marginBottom: '12px', display: 'inline-flex' }}>
          ← Volver a Proyectos
        </Link>
        <h1 className="page-title" style={{ fontSize: '28px', color: 'var(--c-navy)' }}>{projectName}</h1>
        <p style={{ color: 'var(--c-text-muted)', fontSize: '15px', margin: '4px 0 0' }}>
          Problemática: {problemStatement}
        </p>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge badge-semester" style={{ backgroundColor: 'var(--c-blue-mid)', color: '#fff' }}>
            {CYCLE_LABELS[cycleType]}
          </span>
          <span className="badge" style={{ backgroundColor: project?.status === 'completed' ? '#28a745' : '#ffc107', color: project?.status === 'completed' ? '#fff' : '#212529' }}>
            {project?.status === 'completed' ? 'Completado' : `Borrador — Paso ${activeStep} de ${visibleSteps.length}`}
          </span>
          {(project?.fase4Gobernanza || project?.fase3Implementacion || project?.fase2Anexos) && (
            <a href={`/api/docx/paec/${projectId}`} className="btn btn-amber btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--c-amber)', color: '#fff', marginLeft: 'auto' }}>
              <span>↓</span> Descargar PEC Completo (DOCX)
            </a>
          )}
        </div>
      </div>

      {/* Horizontal Step Indicator */}
      <div className="step-wizard" style={{ marginBottom: '20px' }}>
        {visibleSteps.map((s) => {
          const isDone = isStepGenerated(s.num);
          const isActive = s.num === activeStep;
          return (
            <button
              key={s.num}
              onClick={() => {
                // Allowed to click any step that has been generated or is the current step
                if (isDone || s.num <= (project?.currentStep || 1)) {
                  setActiveStep(s.num);
                  setError(null);
                }
              }}
              className={`step-item ${isDone ? 'done' : isActive ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', cursor: (isDone || s.num <= (project?.currentStep || 1)) ? 'pointer' : 'not-allowed', outline: 'none' }}
              disabled={!(isDone || s.num <= (project?.currentStep || 1))}
            >
              <div className="step-num">{isDone ? '✓' : s.num}</div>
              <span className="step-label" style={{ fontWeight: isActive ? 700 : 500 }}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Barra de Quality Gate Visual (Debajo del Stepper) */}
      {project && (
        <div style={{
          marginBottom: '24px',
          background: 'rgba(13,21,48,0.85)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px',
          padding: '14px 18px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          position: 'relative'
        }}>
          {auditResult ? (() => {
            const rawAudit = auditResult as unknown as Record<string, unknown>;
            const percentageVal = typeof rawAudit.percentage === 'number'
              ? rawAudit.percentage
              : typeof rawAudit.score === 'number'
              ? rawAudit.score
              : 0;
            const scorePct = Math.round(percentageVal);
            const isGreen = scorePct >= 80;
            const isYellow = scorePct >= 60 && scorePct < 80;
            const barColor = isGreen ? '#10b981' : isYellow ? '#f59e0b' : '#ef4444';
            const statusLabel = isGreen ? 'Excelente (≥80 pts)' : isYellow ? 'Regular (60-79 pts)' : 'Requiere Ajustes (<60 pts)';
            const rawCriteria = (rawAudit.criteria || rawAudit.criterios || []) as PaecAuditCriterion[];
            const criteriaList: PaecAuditCriterion[] = Array.isArray(rawCriteria) ? rawCriteria : [];
            const failedOrWarn = criteriaList.filter((c: PaecAuditCriterion) => c.status === 'fail' || c.status === 'warning');

            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>🛡️</span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#f0f4ff' }}>Quality Gate MCCEMS / NEM: </span>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: barColor }}>{scorePct}/100</span>
                      <span style={{ marginLeft: '8px', fontSize: '11.5px', padding: '2px 8px', borderRadius: '10px', background: `${barColor}22`, color: barColor, border: `1px solid ${barColor}55`, fontWeight: 600 }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowQGTooltip(!showQGTooltip)}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '12px', color: failedOrWarn.length > 0 ? (isYellow ? '#fbbf24' : '#f87171') : '#34d399', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      {failedOrWarn.length > 0 ? `⚠️ ${failedOrWarn.length} Criterios Observados` : '✓ 23 Criterios Cumplidos'}
                      <span style={{ marginLeft: '4px', fontSize: '10px' }}>{showQGTooltip ? '▲ Ocultar' : '▼ Ver'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => projectId && fetchAudit(projectId)}
                      disabled={loadingAudit}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '6px', cursor: loadingAudit ? 'not-allowed' : 'pointer' }}
                      title="Actualizar evaluación del Quality Gate"
                    >
                      {loadingAudit ? '⏳...' : '🔄 Re-auditar'}
                    </button>
                  </div>
                </div>

                {/* Progress Bar Container */}
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(5, scorePct))}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${barColor}, ${isGreen ? '#34d399' : isYellow ? '#fbbf24' : '#f87171'})`,
                    borderRadius: '4px',
                    transition: 'width 0.6s ease-in-out'
                  }} />
                </div>

                {/* Non-blocking Warning notice if < 80 */}
                {scorePct < 80 && (
                  <div style={{ marginTop: '8px', fontSize: '11.5px', color: isYellow ? '#fde68a' : '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>ℹ️</span>
                    <span>El proyecto tiene áreas de oportunidad según la rúbrica oficial MCCEMS ({failedOrWarn.length} observaciones). Puedes continuar avanzando o consultar los criterios señalados.</span>
                  </div>
                )}

                {/* Tooltip / Popover con desglose */}
                {showQGTooltip && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: 'rgba(8,12,28,0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#f0f4ff', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Desglose de Criterios MCCEMS / NEM ({criteriaList.length} evaluados):</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }} onClick={() => setShowQGTooltip(false)}>✕ Cerrar</span>
                    </div>
                    {failedOrWarn.length === 0 ? (
                      <div style={{ fontSize: '11.5px', color: '#34d399', padding: '6px 0' }}>
                        🎉 Todos los 23 criterios evaluados cumplen con la rúbrica MCCEMS/NEM.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {failedOrWarn.map((c: PaecAuditCriterion) => (
                          <div key={c.id} style={{
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: c.status === 'fail' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            borderLeft: `3px solid ${c.status === 'fail' ? '#ef4444' : '#f59e0b'}`,
                            fontSize: '11.5px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f0f4ff', fontWeight: 600 }}>
                              <span>#{c.id} {c.name}</span>
                              <span style={{ color: c.status === 'fail' ? '#f87171' : '#fbbf24', fontSize: '10.5px' }}>
                                {c.status === 'fail' ? 'Deficiente (0-1 pt)' : 'Advertencia (2 pts)'}
                              </span>
                            </div>
                            <div style={{ color: 'rgba(240,244,255,0.75)', marginTop: '2px', fontSize: '11px' }}>
                              {c.feedback}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })() : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              <span>🛡️ Quality Gate MCCEMS / NEM: Evaluación disponible tras generar fases.</span>
              <button
                type="button"
                onClick={() => projectId && fetchAudit(projectId)}
                disabled={loadingAudit}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '11.5px', padding: '3px 8px', border: '1px solid rgba(255,255,255,0.15)', cursor: loadingAudit ? 'not-allowed' : 'pointer' }}
              >
                {loadingAudit ? 'Evaluando...' : 'Calcular Score'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Panel Content */}
      <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        
        {error && (
          <div style={{ backgroundColor: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {errorType === 'timeout' && '⏳ Timeout de red'}
                  {errorType === 'json' && '⚠️ Respuesta IA malformada (JSON)'}
                  {errorType === 'rate_limit' && '🚦 Límite de API alcanzado'}
                  {errorType === 'network' && '📡 Error de conexión de red'}
                  {(!errorType || errorType === 'unknown') && '❌ Error al procesar la fase'}
                </div>
                <div style={{ fontSize: '14px', lineHeight: 1.5 }}>{error}</div>
                <div style={{ fontSize: '12px', color: 'rgba(251,113,133,0.8)', marginTop: '4px' }}>
                  Intentos realizados: {retryCount[activeStep] || 0} de 3
                </div>
              </div>
              {(retryCount[activeStep] || 0) < 3 ? (
                <button
                  type="button"
                  onClick={generateCurrentStep}
                  disabled={generating}
                  className="btn btn-primary"
                  style={{
                    backgroundColor: '#e11d48',
                    borderColor: '#be123c',
                    color: '#fff',
                    padding: '8px 16px',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: generating ? 'not-allowed' : 'pointer'
                  }}
                >
                  {generating ? (
                    <>
                      <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      Reintentando...
                    </>
                  ) : (
                    <>↻ Reintentar (Paso {activeStep})</>
                  )}
                </button>
              ) : (
                <div style={{ fontSize: '12px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '4px', color: '#fda4af' }}>
                  Límite de reintentos alcanzado (3/3)
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATE A: NOT GENERATED YET */}
        {!generated && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🤖</div>
            <h2 style={{ color: 'var(--c-navy)', marginBottom: '12px', fontSize: '22px', fontWeight: 600 }}>Paso {activeStep}: {activeStepInfo.label}</h2>
            <p style={{ color: 'var(--c-text-muted)', maxWidth: '560px', margin: '0 auto 24px', lineHeight: 1.6 }}>
              {activeStep === 1 && 'La Inteligencia Artificial recopilará los datos de la comunidad y del plantel para estructurar las 4 tablas oficiales de diagnóstico y realizar el análisis FODA del proyecto.'}
              {activeStep === 2 && 'Se redactará la justificación formal del proyecto, los 5 pilares estratégicos de viabilidad, los propósitos integrales (educativo, social y funcional) y las metas del PEC.'}
              {activeStep === 3 && 'La IA cruzará las asignaturas activas de tus semestres seleccionados (Modelo de Relevos) con la problemática común para detallar los temas prácticos de aprendizaje transversal.'}
              {activeStep === 4 && 'Estructuración del plan macro dividiendo las etapas del proyecto escolar en 6 fases bimestrales ordenadas cronológicamente con asignaturas responsables y justificación pedagógica.'}
              {activeStep === 5 && 'Matriz de Detalle Curricular por Semestre: fundamentación curricular inquebrantable (propósitos formativos o progresiones de aprendizaje NOM-MCCEMS) y vinculación con fases para cada UAC.'}
              {activeStep === 6 && 'Desglose detallado del Plan Operativo Semestre A (16 semanas × 8 columnas) con actividades semanales, UACs, progresiones, metodologías activas e instrumentos de evaluación.'}
              {activeStep === 7 && 'Desglose del Plan Operativo Semestre B (16 semanas × 8 columnas) con continuidad metodológica por relevos y preparación de la muestra o feria de aprendizajes final.'}
              {activeStep === 8 && 'Fase de Implementación y Anexos: Carta de Convocatoria Comunitaria, Minuta de Arranque con firmas, 3 Oficios de Vinculación y los 6 anexos técnicos normativos con vista en tabs.'}
              {activeStep === 9 && 'Gobernanza Escolar e Informe de Supervisión: Estructura de gobernanza escolar en 4 niveles, Informe Final Guía 004 con tabla de Metas vs Logros (Pre/Post) y scorecard técnico.'}
            </p>

            <button
              onClick={generateCurrentStep}
              disabled={generating}
              className="btn btn-primary"
              style={{ padding: '12px 32px', fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              {generating ? (
                <>
                  <span className="spinner" style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                  Generando con Inteligencia Artificial (Toma unos segundos)...
                </>
              ) : (
                <>Generar Fase con IA ✨</>
              )}
            </button>
          </div>
        )}

        {/* STATE B: SUCCESSFULLY GENERATED CONTENT VIEW */}
        {generated && project && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)', paddingBottom: '14px', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '20px', color: 'var(--c-navy)', margin: 0, fontWeight: 700 }}>
                {activeStepInfo.label} {isEditingContent ? '(Modo Edición)' : '(Contenido Generado)'}
              </h2>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {isEditingContent ? (
                  <>
                    <button
                      onClick={saveStepEdits}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '13px', backgroundColor: '#28a745', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px' }}
                    >
                      <span>💾</span> Guardar Cambios
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingContent(false);
                        setEditPayload(null);
                      }}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '13px', color: '#dc3545', cursor: 'pointer', padding: '6px 12px', borderRadius: '4px' }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditPayload(getCurrentStepData());
                        setIsEditingContent(true);
                      }}
                      className="btn btn-amber btn-sm"
                      style={{ fontSize: '13px', backgroundColor: 'var(--c-blue-mid)', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px' }}
                    >
                      <span>✏️</span> Editar Contenido
                    </button>
                    <button
                      onClick={generateCurrentStep}
                      disabled={generating}
                      className="btn btn-ghost"
                      style={{ fontSize: '13px', color: 'var(--c-navy-light)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: generating ? 'not-allowed' : 'pointer' }}
                    >
                      {generating ? (
                        <>
                          <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--c-navy-light)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          Regenerando fase...
                        </>
                      ) : (
                        'Regenerar esta fase 🔄'
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Step 1 Visual Render */}
            {activeStep === 1 && (
              <PaecStep1Diagnostico
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as Fase1Diagnostico | null}
                setEditPayload={setEditPayload as (v: Fase1Diagnostico | null) => void}
              />
            )}

            {/* Step 2 Visual Render */}
            {activeStep === 2 && (
              <PaecStep2Justificacion
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as Fase2Justificacion | null}
                setEditPayload={setEditPayload as (v: Fase2Justificacion | null) => void}
              />
            )}

            {/* Step 3 Visual Render */}
            {activeStep === 3 && (
              <PaecStep3Mapeo
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as MapeoRow[] | null}
                setEditPayload={setEditPayload as (v: MapeoRow[] | null) => void}
              />
            )}

            {/* Step 4 Visual Render */}
            {activeStep === 4 && (
              <PaecStep4Cronograma
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as CronogramaRow[] | null}
                setEditPayload={setEditPayload as (v: CronogramaRow[] | null) => void}
              />
            )}

            {/* Step 5 Visual Render: Detalle Curricular */}
            {activeStep === 5 && (
              <PaecStep5DetalleCurricular
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as DetalleCurricularRow[] | null}
                setEditPayload={setEditPayload as (v: DetalleCurricularRow[] | null) => void}
              />
            )}

            {/* Step 6 Visual Render: Plan Operativo Semestre A */}
            {activeStep === 6 && (
              <PaecStep6PlanOpA
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as PlanOperativoRow[] | null}
                setEditPayload={setEditPayload as (v: PlanOperativoRow[] | null) => void}
              />
            )}

            {/* Step 7 Visual Render: Plan Operativo Semestre B */}
            {activeStep === 7 && (
              <PaecStep7PlanOpB
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as PlanOperativoRow[] | null}
                setEditPayload={setEditPayload as (v: PlanOperativoRow[] | null) => void}
              />
            )}

            {/* Step 8 Visual Render: Implementación y Anexos */}
            {activeStep === 8 && (
              <PaecStep8Implementacion
                project={project}
                collapsedCarta={collapsedCarta}
                setCollapsedCarta={setCollapsedCarta}
                collapsedMinuta={collapsedMinuta}
                setCollapsedMinuta={setCollapsedMinuta}
                collapsedOficios={collapsedOficios}
                setCollapsedOficios={setCollapsedOficios}
                activeAnexoTab={activeAnexoTab}
                setActiveAnexoTab={setActiveAnexoTab}
              />
            )}

            {/* Step 9 Visual Render: Gobernanza e Informe Supervisión */}
            {activeStep === 9 && (
              <PaecStep9GobernanzaSupervision
                project={project}
                projectId={projectId}
                collapsedGobernanza={collapsedGobernanza}
                setCollapsedGobernanza={setCollapsedGobernanza}
                collapsedInforme={collapsedInforme}
                setCollapsedInforme={setCollapsedInforme}
                auditResult={auditResult}
                loadingAudit={loadingAudit}
                auditError={auditError}
                fetchAudit={fetchAudit}
                auditFilter={auditFilter}
                setAuditFilter={setAuditFilter}
                showAuditDetails={showAuditDetails}
                setShowAuditDetails={setShowAuditDetails}
              />
            )}

            {/* Navigation / Next actions */}
            <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--c-border)', paddingTop: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              {prevStep && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep(prevStep.num);
                    setError(null);
                  }}
                  className="btn btn-ghost"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  ← {prevStep.label}
                </button>
              )}
              
              {!isLastVisibleStep && nextStep ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep(nextStep.num);
                    setError(null);
                  }}
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  disabled={project.currentStep < nextStep.num && !isStepGenerated(nextStep.num)}
                >
                  Siguiente: {nextStep.label} (Paso {nextStep.num}) →
                </button>
              ) : (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#28a745', fontWeight: 600 }}>
                    🎉 ¡Proyecto PAEC-PEC Completo ({cycleType === 'annual' ? '9 Pasos' : 'Ciclo ' + cycleType})!
                  </span>
                  <a href={`/api/docx/paec/${projectId}`} className="btn btn-amber" style={{ backgroundColor: 'var(--c-amber)', color: '#fff' }}>
                    ↓ Descargar Word
                  </a>
                  <a href={`/api/pdf/paec/${projectId}`} className="btn btn-primary" style={{ backgroundColor: '#c0392b', borderColor: '#c0392b', color: '#fff' }}>
                    ↓ PAEC Oficial PDF
                  </a>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Modal de Sincronización con Cartografía de Zona (Fase 9) */}
        {showZonaModal && zonaData?.zona && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 25, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}>
            <div style={{
              background: '#0d1530',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
              color: '#f0f4ff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#c7d2fe' }}>
                    🗺️ Cartografía de Zona Escolar Disponible
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Sincronización asistida para el PAEC basada en el MCCEMS Puebla 2026-2027
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowZonaModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '20px',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Ficha de la Zona */}
              <div style={{
                background: '#1e293b',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Zona Escolar</span>
                  <strong style={{ fontSize: '13px', color: '#818cf8' }}>
                    {zonaData.zona.identificacion.zonaNumero ? `Zona ${zonaData.zona.identificacion.zonaNumero}` : 'Zona Oficial'}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Supervisión</span>
                  <strong style={{ fontSize: '13px', color: '#f1f5f9' }}>
                    {zonaData.zona.identificacion.supervisorName || 'Supervisión de Zona'}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Subsistema</span>
                  <strong style={{ fontSize: '13px', color: '#f1f5f9' }}>
                    {zonaData.zona.identificacion.subsistema || 'EMS Puebla'}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Ciclo Escolar</span>
                  <strong style={{ fontSize: '13px', color: '#f1f5f9' }}>
                    {zonaData.zona.identificacion.cicloEscolar || '2026-2027'}
                  </strong>
                </div>
              </div>

              {/* Indicadores 911/F11 del Plantel */}
              {zonaData.plantel && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                    📊 Línea Base 911/F11 Registrada para tu Plantel:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Matrícula</span>
                      <strong style={{ fontSize: '14px', color: '#f8fafc' }}>{zonaData.plantel.matricula}</strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Abandono</span>
                      <strong style={{ fontSize: '14px', color: '#fbbf24' }}>{zonaData.plantel.abandono}%</strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Efic. Terminal</span>
                      <strong style={{ fontSize: '14px', color: '#34d399' }}>
                        {zonaData.plantel.eficienciaTerminal !== undefined && zonaData.plantel.eficienciaTerminal > 0
                          ? `${zonaData.plantel.eficienciaTerminal}%`
                          : 'N/D'}
                      </strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Reprobación</span>
                      <strong style={{ fontSize: '14px', color: '#f87171' }}>{zonaData.plantel.reprobacion}%</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Registro previo en Cartografía (si existe) */}
              {zonaData.plantel?.paecProyecto && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase' }}>
                    📌 PAEC Pre-registrado en la Cartografía de Zona:
                  </span>
                  <p style={{ margin: '4px 0 2px', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                    {zonaData.plantel.paecProyecto}
                  </p>
                  {zonaData.plantel.paecProblematica && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>
                      {zonaData.plantel.paecProblematica}
                    </p>
                  )}
                </div>
              )}

              {/* Diagnóstico Territorial de Zona */}
              {zonaData.zona.momento3Territorio?.descripcionTerritorial && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>
                    📍 Diagnóstico Territorial de Zona (Momento 3):
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {zonaData.zona.momento3Territorio.descripcionTerritorial}
                  </p>
                </div>
              )}

              {/* Problemáticas Comunes de la Zona */}
              {zonaData.zona.problematicasComunes && zonaData.zona.problematicasComunes.length > 0 && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                    🎯 Problemáticas Comunitarias Identificadas en la Zona:
                  </span>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1' }}>
                    {zonaData.zona.problematicasComunes.map((prob, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{prob}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowZonaModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cerrar sin aplicar
                </button>
                <button
                  type="button"
                  onClick={handleAplicarSugerenciasZona}
                  style={{
                    padding: '8px 18px',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✨ Aplicar sugerencias de zona a mi PAEC
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function PaecWizardClient(props: Props) {
  if (process.env.NEXT_PUBLIC_FF_NEW_PAEC_WIZARD === 'false') {
    return <PaecWizardLegacy {...props} />;
  }
  return <PaecWizardModularClient {...props} />;
}
