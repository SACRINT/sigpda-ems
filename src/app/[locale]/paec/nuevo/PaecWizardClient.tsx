'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  PaecProject,
  CommunityContext,
  SchoolContext,
  PaecAuditResult,
  PaecAuditCriterion,
  PaecQualityAudit,
  PlanOperativoRow,
  PaecImplementacion,
  PaecGobernanza,
  PaecInformeSupervision,
  AnexosData,
  MinutaData,
  SeguimientoRow,
  ReporteMensualData,
  LikertSurveyData,
} from '@/types/paec';
import { clearAllWizardDrafts } from '@/hooks/useWizardPersistence';

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
  selectedLaboral: string[];
  selectedFfe: string[];
  groupsCount: string;
  groupsConfig: string;
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
  'Administracion': '💼 Administración',
  'Agricultura Sostenible de Traspatio': '🌱 Agricultura Sostenible de Traspatio',
  'Area de la Salud': '🩺 Área de la Salud',
  'Comunicacion Grafica': '🎨 Comunicación Gráfica',
  'Contabilidad': '📊 Contabilidad',
  'Domotica': '🏠 Domótica',
  'Instalaciones Residenciales': '🛠️ Instalaciones Residenciales',
  'Mecanica Dental': '🦷 Mecánica Dental',
  'Preparacion de Alimentos Artesanales': '🍯 Preparación de Alimentos Artesanales',
  'Procesos Culinarios y Reposteria': '🍰 Procesos Culinarios y Repostería',
  'Redes y Mantenimiento': '💻 Redes y Mantenimiento',
  'Servicios Ecosistemicos': '🌳 Servicios Ecosistémicos',
  'Sistemas Electricos': '⚡ Sistemas Eléctricos',
  'Tecnologia Informatica': '💾 Tecnología Informática',
  'Turismo': '✈️ Turismo',
};

const FFE_PAIRS = [
  { name5: 'Análisis de Fenómenos Físicos I (CNET)', name6: 'Análisis de Fenómenos Físicos II (CNET)', label: 'Análisis de Fenómenos Físicos (CNET)' },
  { name5: 'Análisis de Fenómenos Biológicos (CNET)', name6: 'Temas Selectos de Biología (CNET)', label: 'Ciencias Biológicas (CNET)' },
  { name5: 'Salud Integral I (CNET)', name6: 'Salud Integral II (CNET)', label: 'Salud Integral (CNET)' },
  { name5: 'Organización del Flujo de Materia I (CNET)', name6: 'Organización del Flujo de Materia II (CNET)', label: 'Organización del Flujo de Materia (CNET)' },
  { name5: 'Derecho y Sociedad I (CS)', name6: 'Derecho y Sociedad II (CS)', label: 'Derecho y Sociedad (CS)' },
  { name5: 'Fundamentos de Administración I (CS)', name6: 'Fundamentos de Administración II (CS)', label: 'Fundamentos de Administración (CS)' },
  { name5: 'Economía I (CS)', name6: 'Economía II (CS)', label: 'Economía (CS)' },
  { name5: 'Procesos Contables I (CS)', name6: 'Procesos Contables II (CS)', label: 'Procesos Contables (CS)' },
  { name5: 'Psicología I (HUM)', name6: 'Psicología II (HUM)', label: 'Psicología (HUM)' },
  { name5: 'Pensamiento Filosófico I (HUM)', name6: 'Pensamiento Filosófico II (HUM)', label: 'Pensamiento Filosófico (HUM)' },
  { name5: 'Arte y Cultura I', name6: 'Arte y Cultura II', label: 'Arte y Cultura' },
  { name5: 'Lógica y Pensamiento Crítico', name6: 'Experiencia Estética', label: 'Lógica y Estética' },
  { name5: 'Pensamiento Matemático Finanzas I (CS)', name6: 'Pensamiento Matemático Finanzas II (CS)', label: 'Pensamiento Matemático Finanzas (CS)' },
  { name5: 'Temas Selectos CS I (CS)', name6: 'Temas Selectos CS II (CS)', label: 'Temas Selectos Ciencias Sociales (CS)' },
  { name5: 'Comunicación y Sociedad I (Lengua)', name6: 'Comunicación y Sociedad II (Lengua)', label: 'Comunicación y Sociedad (Lengua)' },
  { name5: 'Inglés V (Lengua)', name6: 'Inglés VI (Lengua)', label: 'Inglés Avanzado (Lengua)' },
  { name5: 'Raíces etimológicas I (Lengua)', name6: 'Raíces etimológicas II (Lengua)', label: 'Raíces Etimológicas (Lengua)' },
  { name5: 'Taller Pensamiento Variacional I (PM)', name6: 'Taller Pensamiento Variacional II (PM)', label: 'Taller Pensamiento Variacional (PM)' },
  { name5: 'Dibujo Técnico I (PM)', name6: 'Dibujo Técnico II (PM)', label: 'Dibujo Técnico (PM)' },
  { name5: 'Probabilidad y Estadística I (PM)', name6: 'Probabilidad y Estadística II (PM)', label: 'Probabilidad y Estadística (PM)' },
];

function classifyError(err: unknown): { message: string; type: 'timeout' | 'json' | 'rate_limit' | 'network' | 'unknown' } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('timeout') || lower.includes('tiempo') || lower.includes('504') || lower.includes('408')) {
    return { type: 'timeout', message: 'Timeout de red: El servidor tardó más de 120s en procesar la fase. Por favor reintenta.' };
  }
  if (lower.includes('json') || lower.includes('validar estructura') || lower.includes('schema') || lower.includes('malform')) {
    return { type: 'json', message: 'JSON malformado: La estructura retornada por el modelo de IA no cumple la validación oficial DBEPA.' };
  }
  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('límite') || lower.includes('cuota')) {
    return { type: 'rate_limit', message: 'Límite de API alcanzado: Se superó la cuota de peticiones o el límite por minuto de la IA.' };
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('conexión') || lower.includes('offline')) {
    return { type: 'network', message: 'Error de red o conexión: No se pudo establecer comunicación con el servidor.' };
  }
  return { type: 'unknown', message: msg || 'Error al generar la fase con IA.' };
}

export default function PaecWizardClient({ locale, initialId }: Props) {
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

  const [cctSearching, setCctSearching] = useState(false);
  const [cctWarning, setCctWarning] = useState<string | null>(null);

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
        setProject(prev => prev ? ({ ...prev, fase2Cronograma: cached4 as any }) : prev);
      }
    }
    if (activeStep === 5 && !project.fase2DetalleCurricular) {
      const cached5 = getCachedPaecStep(projectId, 5);
      if (cached5) {
        setProject(prev => prev ? ({ ...prev, fase2DetalleCurricular: cached5 as any }) : prev);
      }
    }
  }, [activeStep, projectId, project]);

  // Catalogs and Selections
  const [laboralCatalog, setLaboralCatalog] = useState<{ uac_name: string; semester: number; curriculum_name: string }[]>([]);
  const [ffeCatalog, setFfeCatalog] = useState<{ uac_name: string; semester: number; component: string }[]>([]);
  const [selectedLaboral, setSelectedLaboral] = useState<string[]>(savedDraft?.selectedLaboral ?? []);
  const [selectedFfe, setSelectedFfe] = useState<string[]>(savedDraft?.selectedFfe ?? []);
  const [groupsCount, setGroupsCount] = useState(savedDraft?.groupsCount ?? '1');
  const [groupsConfig, setGroupsConfig] = useState(savedDraft?.groupsConfig ?? '');

  // Manual Edit States
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editPayload, setEditPayload] = useState<any>(null);

  // Quality Audit States (Quality Gate continuo DBEPA/NEM)
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
      if (nextValid) setActiveStep(nextValid.num);
    }
  }, [cycleType]);

  // Auto-save form draft to localStorage whenever step-1 form fields change (only when no projectId)
  const isFirstRenderDraft = useRef(true);
  useEffect(() => {
    if (isFirstRenderDraft.current) { isFirstRenderDraft.current = false; return; }
    if (projectId) return; // project already in DB, no need to save draft
    savePaecDraft({ projectName, problemStatement, cycleType, community, school, selectedLaboral, selectedFfe, groupsCount, groupsConfig });
  }, [projectId, projectName, problemStatement, cycleType, community, school, selectedLaboral, selectedFfe, groupsCount, groupsConfig]);

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

  // Load project details if ID is present
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId]);

  async function loadProject(id: string) {
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
        if (cached4) (p as any).fase2Cronograma = cached4;
      }
      if (p.fase2DetalleCurricular) {
        setCachedPaecStep(id, 5, p.fase2DetalleCurricular);
      } else {
        const cached5 = getCachedPaecStep(id, 5);
        if (cached5) (p as any).fase2DetalleCurricular = cached5;
      }
      setProject(p);
      setProjectName(p.projectName);
      setProblemStatement(p.problemStatement);
      setCycleType(p.cycleType);
      if (p.communityContext) setCommunity(p.communityContext);
      if (p.schoolContext) {
        setSchool(p.schoolContext);
        setSelectedLaboral(p.schoolContext.activeLaboralUacs || []);
        setSelectedFfe(p.schoolContext.activeFfeUacs || []);
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
  }

  // Fetch PAEC Quality Audit (Evaluación continua 23 Criterios DBEPA/NEM)
  async function fetchAudit(pId: string) {
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
  }

  // Auto-fetch audit on mount / project change
  useEffect(() => {
    if (projectId) {
      fetchAudit(projectId);
    }
  }, [projectId]);

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
            activeLaboralUacs: selectedLaboral,
            activeFfeUacs: selectedFfe,
            groupsConfig,
            groupsCount,
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

  // Grouping helper for laboral UACs
  const groupedLaboral = laboralCatalog.reduce((acc, item) => {
    const cap = item.curriculum_name || 'General';
    if (!acc[cap]) acc[cap] = {};
    if (!acc[cap][item.semester]) acc[cap][item.semester] = [];
    acc[cap][item.semester].push(item);
    return acc;
  }, {} as Record<string, Record<number, typeof laboralCatalog>>);

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
                  onChange={(e) => setCycleType(e.target.value as any)}
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
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                  {cctWarning && (
                    <div style={{ color: '#f87171', fontSize: '11.5px', marginTop: '4px', fontWeight: 500 }}>
                      ⚠️ {cctWarning} (puedes capturar los datos manualmente)
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
            <h2 style={{ fontSize: '18px', color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '16px', fontWeight: 700 }}>4. Estructura de Grupos y Materias Específicas</h2>
            <p style={{ margin: '-10px 0 16px', fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>
              Configura los grupos y selecciona las capacitaciones o asignaturas del componente laboral y FFE activas en tu plantel.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Número de Grupos por Semestre</label>
                  <input
                    type="text"
                    placeholder="Ej: 3 grupos (A, B, C)"
                    value={groupsCount}
                    onChange={(e) => setGroupsCount(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Grupos específicos asignados a este proyecto</label>
                  <input
                    type="text"
                    placeholder="Ej: 1°A, 2°A, 3°A, 4°A (o Dejar vacío para todos)"
                    value={groupsConfig}
                    onChange={(e) => setGroupsConfig(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                  />
                </div>
              </div>

              <div>
                <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', margin: '4px 0 0' }}>
                  El proyecto transversal cruzará únicamente las asignaturas seleccionadas a continuación para evitar sobrecargar los planes de los docentes.
                </p>
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

                {ffeCatalog.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)', fontStyle: 'italic' }}>Cargando catálogo FFE...</p>
                ) : (
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
                )}
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
            const rawAudit = auditResult as any;
            const scorePct = Math.round(rawAudit.percentage ?? rawAudit.score ?? 0);
            const isGreen = scorePct >= 80;
            const isYellow = scorePct >= 60 && scorePct < 80;
            const isRed = scorePct < 60;
            const barColor = isGreen ? '#10b981' : isYellow ? '#f59e0b' : '#ef4444';
            const statusLabel = isGreen ? 'Excelente (≥80 pts)' : isYellow ? 'Regular (60-79 pts)' : 'Requiere Ajustes (<60 pts)';
            const criteriaList: PaecAuditCriterion[] = rawAudit.criteria || rawAudit.criterios || [];
            const failedOrWarn = criteriaList.filter((c: PaecAuditCriterion) => c.status === 'fail' || c.status === 'warning');

            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>🛡️</span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#f0f4ff' }}>Quality Gate DBEPA / NEM: </span>
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
                    <span>El proyecto tiene áreas de oportunidad según la rúbrica oficial DBEPA ({failedOrWarn.length} observaciones). Puedes continuar avanzando o consultar los criterios señalados.</span>
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
                      <span>Desglose de Criterios DBEPA / NEM ({criteriaList.length} evaluados):</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }} onClick={() => setShowQGTooltip(false)}>✕ Cerrar</span>
                    </div>
                    {failedOrWarn.length === 0 ? (
                      <div style={{ fontSize: '11.5px', color: '#34d399', padding: '6px 0' }}>
                        🎉 Todos los 23 criterios evaluados cumplen con la rúbrica DBEPA/NEM.
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
              <span>🛡️ Quality Gate DBEPA / NEM: Evaluación disponible tras generar fases.</span>
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
            {activeStep === 1 && project.fase1Diagnostico && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 1: Características de la comunidad (Contexto Externo)</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Aspecto</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEditingContent && editPayload?.tabla1 ? editPayload.tabla1 : project.fase1Diagnostico.tabla1).map((r: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.col1}</td>
                          <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                            {isEditingContent ? (
                              <textarea
                                value={r.col2}
                                onChange={(e) => {
                                  const copy = { ...editPayload };
                                  copy.tabla1[i].col2 = e.target.value;
                                  setEditPayload(copy);
                                }}
                                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                              />
                            ) : (
                              r.col2
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 2: Características de la educación e institución (Contexto Interno)</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Aspecto Escolar</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEditingContent && editPayload?.tabla2 ? editPayload.tabla2 : project.fase1Diagnostico.tabla2).map((r: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.col1}</td>
                          <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                            {isEditingContent ? (
                              <textarea
                                value={r.col2}
                                onChange={(e) => {
                                  const copy = { ...editPayload };
                                  copy.tabla2[i].col2 = e.target.value;
                                  setEditPayload(copy);
                                }}
                                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                              />
                            ) : (
                              r.col2
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 3: Análisis FODA y Estrategia Maestra del PEC</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Aspecto FODA</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Análisis Estratégico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEditingContent && editPayload?.tabla3 ? editPayload.tabla3 : project.fase1Diagnostico.tabla3).map((r: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.aspect}</td>
                          <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                            {isEditingContent ? (
                              <textarea
                                value={r.analysis}
                                onChange={(e) => {
                                  const copy = { ...editPayload };
                                  copy.tabla3[i].analysis = e.target.value;
                                  setEditPayload(copy);
                                }}
                                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                              />
                            ) : (
                              r.analysis
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 4: Problemáticas o necesidades de la comunidad (Proceso de Selección)</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Etapa del Proceso</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEditingContent && editPayload?.tabla4 ? editPayload.tabla4 : project.fase1Diagnostico.tabla4).map((r: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.col1}</td>
                          <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                            {isEditingContent ? (
                              <textarea
                                value={r.col2}
                                onChange={(e) => {
                                  const copy = { ...editPayload };
                                  copy.tabla4[i].col2 = e.target.value;
                                  setEditPayload(copy);
                                }}
                                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                              />
                            ) : (
                              r.col2
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 2 Visual Render */}
            {activeStep === 2 && project.fase2Justificacion && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', lineHeight: 1.6 }}>
                <div>
                  <strong>Nombre del Proyecto Definitivo:</strong>
                  {isEditingContent ? (
                    <input
                      type="text"
                      value={editPayload?.projectName || ''}
                      onChange={(e) => {
                        const copy = { ...editPayload };
                        copy.projectName = e.target.value;
                        setEditPayload(copy);
                      }}
                      style={{ width: '100%', padding: '8px', fontSize: '15px', fontWeight: 600, borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                    />
                  ) : (
                    <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--c-navy)' }}>{project.fase2Justificacion.projectName}</p>
                  )}
                </div>
                <div>
                  <strong>Introducción y Justificación Académica:</strong>
                  {isEditingContent ? (
                    <textarea
                      value={editPayload?.introduction || ''}
                      onChange={(e) => {
                        const copy = { ...editPayload };
                        copy.introduction = e.target.value;
                        setEditPayload(copy);
                      }}
                      style={{ width: '100%', padding: '8px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ccc', minHeight: '140px', marginTop: '4px', fontFamily: 'inherit' }}
                    />
                  ) : (
                    <p style={{ fontSize: '14px', whiteSpace: 'pre-line' }}>{project.fase2Justificacion.introduction}</p>
                  )}
                </div>
                <div>
                  <strong>Pilares Estratégicos de Viabilidad:</strong>
                  {isEditingContent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      {(editPayload?.pilares || []).map((pilar: string, i: number) => (
                        <input
                          key={i}
                          type="text"
                          value={pilar}
                          onChange={(e) => {
                            const copy = { ...editPayload };
                            copy.pilares[i] = e.target.value;
                            setEditPayload(copy);
                          }}
                          style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                      ))}
                    </div>
                  ) : (
                    <ul style={{ listStyleType: 'disc', paddingLeft: '20px', fontSize: '14px' }}>
                      {project.fase2Justificacion.pilares.map((pilar, i) => (
                        <li key={i} style={{ marginBottom: '8px' }}>{pilar}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <strong>Propósitos Integrales del PEC:</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '8px' }}>
                    <div style={{ padding: '12px', background: 'var(--c-blue-pale)', borderRadius: '6px' }}>
                      <strong style={{ color: 'var(--c-navy)' }}>Propósito Educativo:</strong>
                      {isEditingContent ? (
                        <textarea
                          value={editPayload?.proposito?.educativo || ''}
                          onChange={(e) => {
                            const copy = { ...editPayload };
                            copy.proposito.educativo = e.target.value;
                            setEditPayload(copy);
                          }}
                          style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', marginTop: '4px', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{project.fase2Justificacion.proposito.educativo}</p>
                      )}
                    </div>
                    <div style={{ padding: '12px', background: 'var(--c-blue-pale)', borderRadius: '6px' }}>
                      <strong style={{ color: 'var(--c-navy)' }}>Propósito Social:</strong>
                      {isEditingContent ? (
                        <textarea
                          value={editPayload?.proposito?.social || ''}
                          onChange={(e) => {
                            const copy = { ...editPayload };
                            copy.proposito.social = e.target.value;
                            setEditPayload(copy);
                          }}
                          style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', marginTop: '4px', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{project.fase2Justificacion.proposito.social}</p>
                      )}
                    </div>
                    <div style={{ padding: '12px', background: 'var(--c-blue-pale)', borderRadius: '6px' }}>
                      <strong style={{ color: 'var(--c-navy)' }}>Propósito Funcional:</strong>
                      {isEditingContent ? (
                        <textarea
                          value={editPayload?.proposito?.funcional || ''}
                          onChange={(e) => {
                            const copy = { ...editPayload };
                            copy.proposito.funcional = e.target.value;
                            setEditPayload(copy);
                          }}
                          style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', marginTop: '4px', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{project.fase2Justificacion.proposito.funcional}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <strong>Metas Cuantitativas:</strong>
                  {isEditingContent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      {(editPayload?.alcance?.metas || []).map((m: string, i: number) => (
                        <input
                          key={i}
                          type="text"
                          value={m}
                          onChange={(e) => {
                            const copy = { ...editPayload };
                            copy.alcance.metas[i] = e.target.value;
                            setEditPayload(copy);
                          }}
                          style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                      ))}
                    </div>
                  ) : (
                    <ul style={{ listStyleType: 'decimal', paddingLeft: '20px', fontSize: '13px' }}>
                      {project.fase2Justificacion.alcance.metas.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Step 3 Visual Render */}
            {activeStep === 3 && project.fase2Mapeo && (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '10%' }}>Sem</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Asignatura (UAC)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Actividad / Tema Práctico</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Vinculación y Progresión Curricular</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditingContent && editPayload ? editPayload : project.fase2Mapeo).map((r: any, i: number) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.semester}°</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.uacName}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {isEditingContent ? (
                            <input
                              type="text"
                              value={r.topic}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].topic = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                          ) : (
                            r.topic
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.linking}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].linking = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.linking
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Step 4 Visual Render */}
            {activeStep === 4 && project.fase2Cronograma && (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '18%' }}>Fase Bimestral</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '22%' }}>Objetivo de la Etapa</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '24%' }}>Macro-Actividades del Proyecto</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '24%' }}>Asignaturas Responsables y Justificación</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '12%' }}>Semestre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditingContent && editPayload ? editPayload : project.fase2Cronograma).map((r: any, i: number) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.phase}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.objective}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].objective = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.objective
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.macroActivities}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].macroActivities = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.macroActivities
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.responsibleSubjects || ''}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].responsibleSubjects = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.responsibleSubjects || 'Todas las asignaturas vinculadas'
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.semesterInvolved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Step 5 Visual Render: Detalle Curricular */}
            {activeStep === 5 && project.fase2DetalleCurricular && (
              <div>
                <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>
                  Matriz de Detalle Curricular por Semestre (Fundamentación y Progresiones / Propósitos NOM-MCCEMS)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '8%' }}>Sem</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '22%' }}>Asignatura (UAC)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Progresiones o Propósitos Formativos</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '15%' }}>Fase(s) del Proyecto</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '30%' }}>Justificación Curricular</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditingContent && editPayload ? editPayload : project.fase2DetalleCurricular).map((r: any, i: number) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.semester}°</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.uacName}</td>
                        <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.progressionsOrPurposes}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].progressionsOrPurposes = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.progressionsOrPurposes
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {isEditingContent ? (
                            <input
                              type="text"
                              value={r.projectPhases}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].projectPhases = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                          ) : (
                            r.projectPhases
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.curricularJustification}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].curricularJustification = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.curricularJustification
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Step 6 Visual Render: Plan Operativo Semestre A */}
            {activeStep === 6 && (() => {
              const semAData: PlanOperativoRow[] = (isEditingContent && Array.isArray(editPayload))
                ? editPayload
                : (project.fase3PlanOperativoA && project.fase3PlanOperativoA.length > 0
                    ? project.fase3PlanOperativoA
                    : (project.fase2PlanOperativo?.semestreA || []));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h3 style={{ fontSize: '17px', color: 'var(--c-navy-light)', fontWeight: 700, margin: 0 }}>
                        Plan Operativo: Semestre A (1°, 3° y 5° Semestre)
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', margin: '4px 0 0' }}>
                        Desglose operativo semanal estructurado en 3 bloques de ejecución conforme al estándar normativo DBEPA.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="badge" style={{ backgroundColor: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '4px 10px', fontSize: '12px' }}>
                        ⚡ 16 Semanas × 8 Columnas
                      </span>
                      <span className="badge" style={{ backgroundColor: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '4px 10px', fontSize: '12px' }}>
                        {semAData.length} Actividades
                      </span>
                    </div>
                  </div>

                  {semAData.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', color: 'var(--c-text-muted)' }}>
                      No se encontraron actividades del Plan Operativo Semestre A. Haz clic en regenerar.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--c-border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                      <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '9%' }}>Fase</th>
                            <th style={{ padding: '8px 6px', textAlign: 'center', width: '5%' }}>Sem.</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '22%' }}>Actividad Semanal</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '14%' }}>UAC / Asignatura</th>
                            <th style={{ padding: '8px 10px', textAlign: 'center', width: '9%' }}>Progresión / Propósito</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '13%' }}>Estrategia Didáctica</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '14%' }}>Docentes Responsables</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '14%' }}>Inst. Evaluación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {semAData.map((r: PlanOperativoRow, i: number) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--c-blue-light)' }}>{r.phase}</td>
                              <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: '#f0f4ff' }}>{r.week}</td>
                              <td style={{ padding: '8px 10px' }}>
                                {isEditingContent ? (
                                  <textarea
                                    value={r.activity}
                                    onChange={(e) => {
                                      const copy = [...semAData];
                                      copy[i] = { ...copy[i], activity: e.target.value };
                                      setEditPayload(copy);
                                    }}
                                    style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff', minHeight: '54px', fontFamily: 'inherit' }}
                                  />
                                ) : (
                                  <span style={{ color: '#f0f4ff', lineHeight: 1.4 }}>{r.activity}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#93c5fd' }}>{r.uac}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#cbd5e1' }}>{r.progression}</td>
                              <td style={{ padding: '8px 10px' }}>
                                {isEditingContent ? (
                                  <input
                                    type="text"
                                    value={r.strategy}
                                    onChange={(e) => {
                                      const copy = [...semAData];
                                      copy[i] = { ...copy[i], strategy: e.target.value };
                                      setEditPayload(copy);
                                    }}
                                    style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff' }}
                                  />
                                ) : (
                                  <span style={{ color: '#e2e8f0' }}>{r.strategy}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {isEditingContent ? (
                                  <input
                                    type="text"
                                    value={r.responsibles}
                                    onChange={(e) => {
                                      const copy = [...semAData];
                                      copy[i] = { ...copy[i], responsibles: e.target.value };
                                      setEditPayload(copy);
                                    }}
                                    style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff' }}
                                  />
                                ) : (
                                  <span style={{ color: '#cbd5e1' }}>{r.responsibles}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {isEditingContent ? (
                                  <input
                                    type="text"
                                    value={r.evaluationInstrument || ''}
                                    onChange={(e) => {
                                      const copy = [...semAData];
                                      copy[i] = { ...copy[i], evaluationInstrument: e.target.value };
                                      setEditPayload(copy);
                                    }}
                                    style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff' }}
                                  />
                                ) : (
                                  <span style={{ color: '#a7f3d0' }}>{r.evaluationInstrument || 'Rúbrica'}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Step 7 Visual Render: Plan Operativo Semestre B */}
            {activeStep === 7 && (() => {
              const semBData: PlanOperativoRow[] = (isEditingContent && Array.isArray(editPayload))
                ? editPayload
                : (project.fase3PlanOperativoB && project.fase3PlanOperativoB.length > 0
                    ? project.fase3PlanOperativoB
                    : (project.fase2PlanOperativo?.semestreB || []));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h3 style={{ fontSize: '17px', color: 'var(--c-navy-light)', fontWeight: 700, margin: 0 }}>
                        Plan Operativo: Semestre B (2°, 4° y 6° Semestre)
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', margin: '4px 0 0' }}>
                        Continuidad operativa mediante el Modelo de Relevos Curriculares hasta la entrega de la solución comunitaria.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="badge" style={{ backgroundColor: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', padding: '4px 10px', fontSize: '12px' }}>
                        ⚡ 16 Semanas × 8 Columnas
                      </span>
                      <span className="badge" style={{ backgroundColor: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '4px 10px', fontSize: '12px' }}>
                        {semBData.length} Actividades
                      </span>
                    </div>
                  </div>

                  {/* Banner Semana 16 */}
                  <div style={{ padding: '12px 16px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>🏆</span>
                    <div style={{ fontSize: '13px', color: '#fde68a', lineHeight: 1.4 }}>
                      <strong>Semana 16 de Cierre Institucional:</strong> Culminación de proyectos integradores, Feria / Muestra Comunitaria de Aprendizajes y Rendición de Cuentas a familias y autoridades educativas.
                    </div>
                  </div>

                  {semBData.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', color: 'var(--c-text-muted)' }}>
                      No se encontraron actividades del Plan Operativo Semestre B. Haz clic en regenerar.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--c-border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                      <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '9%' }}>Fase</th>
                            <th style={{ padding: '8px 6px', textAlign: 'center', width: '5%' }}>Sem.</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '22%' }}>Actividad Semanal</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '14%' }}>UAC / Asignatura</th>
                            <th style={{ padding: '8px 10px', textAlign: 'center', width: '9%' }}>Progresión / Propósito</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '13%' }}>Estrategia Didáctica</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '14%' }}>Docentes Responsables</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '14%' }}>Inst. Evaluación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {semBData.map((r: PlanOperativoRow, i: number) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--c-blue-light)' }}>{r.phase}</td>
                              <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: String(r.week) === '16' ? '#fbbf24' : '#f0f4ff' }}>
                                {String(r.week) === '16' ? '⭐ 16' : r.week}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {isEditingContent ? (
                                  <textarea
                                    value={r.activity}
                                    onChange={(e) => {
                                      const copy = [...semBData];
                                      copy[i] = { ...copy[i], activity: e.target.value };
                                      setEditPayload(copy);
                                    }}
                                    style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff', minHeight: '54px', fontFamily: 'inherit' }}
                                  />
                                ) : (
                                  <span style={{ color: '#f0f4ff', lineHeight: 1.4 }}>{r.activity}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#93c5fd' }}>{r.uac}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#cbd5e1' }}>{r.progression}</td>
                              <td style={{ padding: '8px 10px' }}>
                                {isEditingContent ? (
                                  <input
                                    type="text"
                                    value={r.strategy}
                                    onChange={(e) => {
                                      const copy = [...semBData];
                                      copy[i] = { ...copy[i], strategy: e.target.value };
                                      setEditPayload(copy);
                                    }}
                                    style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff' }}
                                  />
                                ) : (
                                  <span style={{ color: '#e2e8f0' }}>{r.strategy}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {isEditingContent ? (
                                  <input
                                    type="text"
                                    value={r.responsibles}
                                    onChange={(e) => {
                                      const copy = [...semBData];
                                      copy[i] = { ...copy[i], responsibles: e.target.value };
                                      setEditPayload(copy);
                                    }}
                                    style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff' }}
                                  />
                                ) : (
                                  <span style={{ color: '#cbd5e1' }}>{r.responsibles}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {isEditingContent ? (
                                  <input
                                    type="text"
                                    value={r.evaluationInstrument || ''}
                                    onChange={(e) => {
                                      const copy = [...semBData];
                                      copy[i] = { ...copy[i], evaluationInstrument: e.target.value };
                                      setEditPayload(copy);
                                    }}
                                    style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff' }}
                                  />
                                ) : (
                                  <span style={{ color: '#a7f3d0' }}>{r.evaluationInstrument || 'Rúbrica'}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Step 8 Visual Render: Implementación y Anexos */}
            {activeStep === 8 && (() => {
              const imp: PaecImplementacion | undefined = project.fase3Implementacion || undefined;
              const carta = imp?.cartaInvitacion;
              const minuta = imp?.minutaArranque;
              const oficios = imp?.oficiosAliados || [];
              const anexos: AnexosData | undefined = (project.fase2Anexos as unknown as AnexosData) || undefined;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Secciones Colapsables de Implementación */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* 1. Carta de Convocatoria */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div
                        onClick={() => setCollapsedCarta(!collapsedCarta)}
                        style={{ padding: '14px 18px', background: 'rgba(30,58,138,0.25)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>✉️</span>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#93c5fd' }}>
                            1. Carta de Convocatoria Comunitaria (Asamblea de Vinculación)
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                          {collapsedCarta ? '▶ Mostrar' : '▼ Ocultar'}
                        </span>
                      </div>

                      {!collapsedCarta && (
                        <div style={{ padding: '18px', fontSize: '13px', lineHeight: 1.6, color: '#f0f4ff' }}>
                          {carta ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', padding: '10px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px' }}>
                                <div><strong>Asunto:</strong> {carta.asunto}</div>
                                <div><strong>Fecha de emisión:</strong> {carta.fecha}</div>
                                <div><strong>Destinatarios:</strong> {carta.destinatarios}</div>
                                <div><strong>Cita:</strong> {carta.fechaReunion} a las {carta.hora} hrs en {carta.lugar}</div>
                              </div>
                              <div style={{ whiteSpace: 'pre-line', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                                {carta.cuerpo}
                              </div>
                              {carta.objetivos && carta.objetivos.length > 0 && (
                                <div>
                                  <strong style={{ color: '#93c5fd' }}>Objetivos de la Convocatoria:</strong>
                                  <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
                                    {carta.objetivos.map((obj, oi) => (
                                      <li key={oi}>{obj}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <div style={{ textAlign: 'right', marginTop: '10px', fontStyle: 'italic', color: 'rgba(255,255,255,0.7)' }}>
                                <div>Atentamente,</div>
                                <strong>{carta.firmante}</strong>
                                <div>{carta.cargo}</div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>Carta generada como parte de la fase de implementación.</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. Minuta de Arranque */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div
                        onClick={() => setCollapsedMinuta(!collapsedMinuta)}
                        style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.18)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>📝</span>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#6ee7b7' }}>
                            2. Minuta de Arranque e Instalación del Comité de Proyecto
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                          {collapsedMinuta ? '▶ Mostrar' : '▼ Ocultar'}
                        </span>
                      </div>

                      {!collapsedMinuta && (
                        <div style={{ padding: '18px', fontSize: '13px', color: '#f0f4ff' }}>
                          {minuta ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'rgba(255,255,255,0.8)' }}>
                                <span><strong>Fecha:</strong> {minuta.fecha}</span>
                                <span><strong>Tipo:</strong> {minuta.tipoReunion}</span>
                                {minuta.cct && <span><strong>CCT:</strong> {minuta.cct}</span>}
                              </div>

                              {minuta.acuerdos && minuta.acuerdos.length > 0 && (
                                <div>
                                  <h4 style={{ fontSize: '14px', color: '#a7f3d0', margin: '0 0 8px' }}>Acuerdos y Compromisos Formales:</h4>
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                      <thead>
                                        <tr style={{ background: 'rgba(16,185,129,0.2)', color: '#fff' }}>
                                          <th style={{ padding: '6px 8px', textAlign: 'center', width: '5%' }}>No.</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'left', width: '45%' }}>Acuerdo</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'left', width: '25%' }}>Responsable</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'center', width: '15%' }}>Límite</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'center', width: '10%' }}>Estatus</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {minuta.acuerdos.map((ac, ai) => (
                                          <tr key={ai} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{ac.no}</td>
                                            <td style={{ padding: '6px 8px' }}>{ac.acuerdo}</td>
                                            <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{ac.responsable}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{ac.fechaLimite}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
                                                {ac.estatus || 'Vigente'}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {minuta.firmas && minuta.firmas.length > 0 && (
                                <div style={{ marginTop: '10px' }}>
                                  <h4 style={{ fontSize: '14px', color: '#a7f3d0', margin: '0 0 8px' }}>Firmas de Validación y Compromiso:</h4>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                                    {minuta.firmas.map((f, fi) => (
                                      <div key={fi} style={{ padding: '10px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', textAlign: 'center' }}>
                                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '16px', marginBottom: '6px' }} />
                                        <div style={{ fontWeight: 600 }}>{f.nombre}</div>
                                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{f.cargo}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>Minuta generada como parte de la fase de implementación.</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3. Oficios a Aliados */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div
                        onClick={() => setCollapsedOficios(!collapsedOficios)}
                        style={{ padding: '14px 18px', background: 'rgba(245,158,11,0.18)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>🏛️</span>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#fde68a' }}>
                            3. Oficios a Aliados Estratégicos ({oficios.length > 0 ? oficios.length : 3} Oficios de Vinculación)
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                          {collapsedOficios ? '▶ Mostrar' : '▼ Ocultar'}
                        </span>
                      </div>

                      {!collapsedOficios && (
                        <div style={{ padding: '18px', fontSize: '13px', color: '#f0f4ff' }}>
                          {oficios.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                              {oficios.map((oficio, oi) => (
                                <div key={oi} style={{ padding: '14px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                                    Oficio de Vinculación #{oi + 1}
                                  </div>
                                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>
                                    {oficio.destinatario}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#93c5fd' }}>
                                    {oficio.cargo} — {oficio.institucion}
                                  </div>
                                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                                    Asunto: {oficio.asunto}
                                  </div>
                                  <div style={{ fontSize: '12px', lineHeight: 1.4, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px' }}>
                                    {oficio.propuestaColaboracion}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>Oficios a aliados generados formalmente para Salud, Municipio y Sociedad Civil.</div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Vista Previa de los 6 Anexos Normativos con Tabs */}
                  <div style={{ marginTop: '12px', background: 'rgba(13,21,48,0.9)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '18px' }}>
                    <div style={{ marginBottom: '14px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#f0f4ff', margin: 0 }}>
                        📋 Sistema Integral de Anexos Técnicos Oficiales (Anexos 1 al 6)
                      </h4>
                      <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>
                        Selecciona un anexo para consultar su formato e instrumentos normativos de evaluación y seguimiento.
                      </p>
                    </div>

                    {/* Tabs Navigation */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '10px', marginBottom: '16px' }}>
                      {[
                        { tab: 1, title: 'Anexo 1: Minuta Instalación' },
                        { tab: 2, title: 'Anexo 2: Seguimiento Semanal' },
                        { tab: 3, title: 'Anexo 3: Reporte Mensual' },
                        { tab: 4, title: 'Anexo 4: Impacto Comunidad' },
                        { tab: 5, title: 'Anexo 5: Autoevaluación' },
                        { tab: 6, title: 'Anexo 6: Evaluación Colegiado' },
                      ].map(t => (
                        <button
                          key={t.tab}
                          type="button"
                          onClick={() => setActiveAnexoTab(t.tab)}
                          className="btn btn-sm"
                          style={{
                            background: activeAnexoTab === t.tab ? 'var(--c-blue-mid)' : 'rgba(255,255,255,0.06)',
                            color: activeAnexoTab === t.tab ? '#fff' : 'rgba(255,255,255,0.7)',
                            border: activeAnexoTab === t.tab ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>

                    {/* Tab Content Display */}
                    <div style={{ minHeight: '180px' }}>
                      {/* Tab 1 */}
                      {activeAnexoTab === 1 && (
                        <div>
                          <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 1: Minuta de Instalación del Comité PAEC</h5>
                          <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                            {anexos?.anexo1Minuta ? JSON.stringify(anexos.anexo1Minuta, null, 2) : (anexos?.anexo1 || 'Sin datos generados aún')}
                          </pre>
                        </div>
                      )}

                      {/* Tab 2 */}
                      {activeAnexoTab === 2 && (
                        <div>
                          <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 2: Cuadro de Seguimiento Semanal con Semáforo</h5>
                          {Array.isArray(anexos?.anexo2Seguimiento) && anexos.anexo2Seguimiento.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                  <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Semana</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Fase</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>UAC</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Meta Operativa</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Evidencia</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Avance</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Semáforo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {anexos.anexo2Seguimiento.map((s, si) => (
                                    <tr key={si} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{s.semana}</td>
                                      <td style={{ padding: '6px 8px' }}>{s.fase}</td>
                                      <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{s.uac}</td>
                                      <td style={{ padding: '6px 8px' }}>{s.metaOperativa}</td>
                                      <td style={{ padding: '6px 8px' }}>{s.evidencia}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{s.avancePorcentaje}%</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                        <span style={{
                                          padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase',
                                          background: s.semaforo === 'verde' ? 'rgba(16,185,129,0.2)' : s.semaforo === 'amarillo' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                                          color: s.semaforo === 'verde' ? '#34d399' : s.semaforo === 'amarillo' ? '#fbbf24' : '#f87171'
                                        }}>
                                          {s.semaforo}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                              {anexos?.anexo2 || 'Sin datos generados aún'}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Tab 3 */}
                      {activeAnexoTab === 3 && (
                        <div>
                          <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 3: Reporte Mensual de Avances</h5>
                          <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                            {anexos?.anexo3ReporteMensual ? JSON.stringify(anexos.anexo3ReporteMensual, null, 2) : (anexos?.anexo3 || 'Sin datos generados aún')}
                          </pre>
                        </div>
                      )}

                      {/* Tab 4 */}
                      {activeAnexoTab === 4 && (
                        <div>
                          <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 4: Cuestionario de Impacto Comunitario (Escala Likert 1-5)</h5>
                          {anexos?.anexo4ImpactoComunidad?.reactivos ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                                <strong>Título:</strong> {anexos.anexo4ImpactoComunidad.titulo}
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                  <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                                    <th style={{ padding: '6px 8px', textAlign: 'center', width: '6%' }}>No.</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '64%' }}>Reactivo / Pregunta de Impacto</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '30%' }}>Dimensión</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {anexos.anexo4ImpactoComunidad.reactivos.map((r, ri) => (
                                    <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{ri + 1}</td>
                                      <td style={{ padding: '6px 8px' }}>{r.reactivo}</td>
                                      <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{r.dimension}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                              {anexos?.anexo4 || 'Sin datos generados aún'}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Tab 5 */}
                      {activeAnexoTab === 5 && (
                        <div>
                          <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 5: Cuestionario de Autoevaluación de Estudiantes</h5>
                          {anexos?.anexo5AutoevaluacionEstudiantes?.reactivos ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                                <strong>Título:</strong> {anexos.anexo5AutoevaluacionEstudiantes.titulo}
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                  <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                                    <th style={{ padding: '6px 8px', textAlign: 'center', width: '6%' }}>No.</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '64%' }}>Reactivo de Autoevaluación</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '30%' }}>Dimensión</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {anexos.anexo5AutoevaluacionEstudiantes.reactivos.map((r, ri) => (
                                    <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{ri + 1}</td>
                                      <td style={{ padding: '6px 8px' }}>{r.reactivo}</td>
                                      <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{r.dimension}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                              {anexos?.anexo5 || 'Sin datos generados aún'}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Tab 6 */}
                      {activeAnexoTab === 6 && (
                        <div>
                          <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 6: Cuestionario de Evaluación para Docentes y Colegiado</h5>
                          {anexos?.anexo6EvaluacionColegiado?.reactivos ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                                <strong>Título:</strong> {anexos.anexo6EvaluacionColegiado.titulo}
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                  <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                                    <th style={{ padding: '6px 8px', textAlign: 'center', width: '6%' }}>No.</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '64%' }}>Reactivo Colegiado Docente</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '30%' }}>Dimensión</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {anexos.anexo6EvaluacionColegiado.reactivos.map((r, ri) => (
                                    <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{ri + 1}</td>
                                      <td style={{ padding: '6px 8px' }}>{r.reactivo}</td>
                                      <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{r.dimension}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                              {anexos?.anexo6 || 'Sin datos generados aún'}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* Step 9 Visual Render: Gobernanza e Informe Supervisión */}
            {activeStep === 9 && (() => {
              const gob: PaecGobernanza | undefined = project.fase4Gobernanza || undefined;
              const inf: PaecInformeSupervision | undefined = project.fase4InformeSupervision || undefined;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Secciones Colapsables de Paso 9 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* 1. Gobernanza Escolar en 4 Niveles */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div
                        onClick={() => setCollapsedGobernanza(!collapsedGobernanza)}
                        style={{ padding: '14px 18px', background: 'rgba(99,102,241,0.22)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>👥</span>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#c7d2fe' }}>
                            1. Gobernanza Escolar en 4 Niveles Institucionales
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                          {collapsedGobernanza ? '▶ Mostrar' : '▼ Ocultar'}
                        </span>
                      </div>

                      {!collapsedGobernanza && (
                        <div style={{ padding: '18px', fontSize: '13px', color: '#f0f4ff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {/* Grid 4 Niveles */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                            <div style={{ padding: '12px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px' }}>
                              <div style={{ fontWeight: 700, color: '#93c5fd', fontSize: '13px', marginBottom: '4px' }}>
                                Nivel 1: Coordinación Directiva
                              </div>
                              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.4 }}>
                                Liderazgo institucional, asignación de recursos y vinculación oficial con dependencias externas.
                              </p>
                            </div>

                            <div style={{ padding: '12px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px' }}>
                              <div style={{ fontWeight: 700, color: '#6ee7b7', fontSize: '13px', marginBottom: '4px' }}>
                                Nivel 2: Colegiado Docente
                              </div>
                              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.4 }}>
                                Academias transversales, articulación de progresiones MCCEMS y evaluación formativa colegiada.
                              </p>
                            </div>

                            <div style={{ padding: '12px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px' }}>
                              <div style={{ fontWeight: 700, color: '#fde68a', fontSize: '13px', marginBottom: '4px' }}>
                                Nivel 3: Brigadas Estudiantiles
                              </div>
                              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.4 }}>
                                Protagonismo juvenil, ejecución de trabajo de campo comunitario y documentación en bitácoras.
                              </p>
                            </div>

                            <div style={{ padding: '12px', background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '8px' }}>
                              <div style={{ fontWeight: 700, color: '#fbcfe8', fontSize: '13px', marginBottom: '4px' }}>
                                Nivel 4: Red Comunitaria
                              </div>
                              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.4 }}>
                                Padres de familia, contraloría social y aliados vecinales para la sostenibilidad del cambio.
                              </p>
                            </div>
                          </div>

                          {/* Calendario de Gobernanza */}
                          {gob?.calendario && gob.calendario.length > 0 && (
                            <div>
                              <h4 style={{ fontSize: '14px', color: '#c7d2fe', margin: '8px 0' }}>Calendario de Sesiones y Seguimiento:</h4>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ background: 'rgba(99,102,241,0.25)', color: '#fff' }}>
                                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tipo de Sesión</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Frecuencia</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Participantes</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Objetivo Estratégico</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Evidencia</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {gob.calendario.map((c, ci) => (
                                      <tr key={ci} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.tipo}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'center', color: '#93c5fd' }}>{c.frecuencia}</td>
                                        <td style={{ padding: '6px 8px' }}>{c.participantes}</td>
                                        <td style={{ padding: '6px 8px' }}>{c.objetivo}</td>
                                        <td style={{ padding: '6px 8px', color: '#6ee7b7' }}>{c.evidencia}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Preguntas Guía NEM */}
                          {gob?.metodologiaEvaluacion?.preguntasGuiaNem && (
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', borderLeft: '3px solid #6366f1' }}>
                              <h4 style={{ fontSize: '13px', color: '#a5b4fc', margin: '0 0 6px' }}>Preguntas Guía NEM de Evaluación Formativa:</h4>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', fontSize: '12px' }}>
                                <div><strong>¿Dónde estamos?:</strong> {gob.metodologiaEvaluacion.preguntasGuiaNem.dondeEstamos}</div>
                                <div><strong>¿Hacia dónde vamos?:</strong> {gob.metodologiaEvaluacion.preguntasGuiaNem.haciaDondeVamos}</div>
                                <div><strong>¿Cómo superamos?:</strong> {gob.metodologiaEvaluacion.preguntasGuiaNem.comoSuperamos}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. Informe Final de Supervisión (Guía 004) */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div
                        onClick={() => setCollapsedInforme(!collapsedInforme)}
                        style={{ padding: '14px 18px', background: 'rgba(14,165,233,0.22)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>📊</span>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#7dd3fc' }}>
                            2. Informe Final de Supervisión Escolar (Guía Oficial 004)
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                          {collapsedInforme ? '▶ Mostrar' : '▼ Ocultar'}
                        </span>
                      </div>

                      {!collapsedInforme && (
                        <div style={{ padding: '18px', fontSize: '13px', color: '#f0f4ff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {inf ? (
                            <>
                              {/* Resumen Ejecutivo */}
                              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', borderLeft: '3px solid #0ea5e9' }}>
                                <strong style={{ color: '#7dd3fc' }}>Resumen Ejecutivo de la Supervisión:</strong>
                                <p style={{ margin: '6px 0 0', lineHeight: 1.5, color: 'rgba(255,255,255,0.9)' }}>
                                  {inf.resumenEjecutivo}
                                </p>
                              </div>

                              {/* Tabla de Metas vs Logros */}
                              {inf.metasVsLogros && inf.metasVsLogros.length > 0 && (
                                <div>
                                  <h4 style={{ fontSize: '14px', color: '#7dd3fc', margin: '0 0 8px' }}>
                                    Tabla Comparativa: Metas Planteadas vs Logros Obtenidos
                                  </h4>
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                      <thead>
                                        <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                                          <th style={{ padding: '6px 8px', textAlign: 'left', width: '30%' }}>Meta Planteada</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'left', width: '25%' }}>Indicador de Verificación</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'center', width: '15%' }}>Línea Base (Pre)</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'center', width: '15%' }}>Resultado Final (Post)</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'center', width: '15%' }}>% Cumplimiento</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {inf.metasVsLogros.map((m, mi) => (
                                          <tr key={mi} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>{m.meta}</td>
                                            <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.8)' }}>{m.indicador}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center', color: '#cbd5e1' }}>{m.programado}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center', color: '#6ee7b7', fontWeight: 600 }}>{m.alcanzado}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                              <span style={{
                                                padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                                                background: m.porcentaje >= 80 ? 'rgba(16,185,129,0.2)' : m.porcentaje >= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                                                color: m.porcentaje >= 80 ? '#34d399' : m.porcentaje >= 60 ? '#fbbf24' : '#f87171'
                                              }}>
                                                {m.porcentaje}%
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Indicadores Pre / Post Intervención */}
                              {inf.analisisPrePost && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                                  <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Participación Total</div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f4ff', marginTop: '2px' }}>{inf.analisisPrePost.participacionTotal}</div>
                                  </div>
                                  <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Alcance Comunitario</div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#93c5fd', marginTop: '2px' }}>{inf.analisisPrePost.alcanceComunitario}</div>
                                  </div>
                                  <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Cambio de Conocimientos</div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#6ee7b7', marginTop: '2px' }}>{inf.analisisPrePost.cambioConocimientos}</div>
                                  </div>
                                  <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Desarrollo Competencias</div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fde68a', marginTop: '2px' }}>{inf.analisisPrePost.desarrolloCompetencias}</div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>Informe de supervisión disponible al generar la fase 9.</div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Tarjeta de Auditoría de Calidad Técnica PAEC (23 Criterios DBEPA/NEM) */}
                  <div style={{
                    marginTop: '8px',
                    padding: '24px',
                    borderRadius: '12px',
                    background: 'rgba(13,21,48,0.92)',
                    border: `1px solid ${
                      !auditResult ? 'rgba(255,255,255,0.15)' :
                      ((auditResult as any).percentage ?? (auditResult as any).score ?? 0) >= 80 ? 'rgba(16, 185, 129, 0.45)' :
                      ((auditResult as any).percentage ?? (auditResult as any).score ?? 0) >= 60 ? 'rgba(245, 158, 11, 0.45)' :
                      'rgba(239, 68, 68, 0.45)'
                    }`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                  }}>
                    {/* Header de la Tarjeta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '22px' }}>📋</span>
                          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f0f4ff', margin: 0 }}>
                            Auditoría de Calidad Técnica PAEC (23 Criterios DBEPA/NEM)
                          </h3>
                        </div>
                        <p style={{ color: 'rgba(240,244,255,0.65)', fontSize: '13px', margin: '4px 0 0' }}>
                          Evaluación integral de rigor normativo, FODA, transversalidad UAC, cronograma macro, plan de relevos y anexos.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => projectId && fetchAudit(projectId)}
                        disabled={loadingAudit}
                        className="btn btn-ghost btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#f0f4ff',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: loadingAudit ? 'not-allowed' : 'pointer'
                        }}
                        title="Volver a ejecutar auditoría de calidad"
                      >
                        {loadingAudit ? (
                          <>
                            <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                            Auditando...
                          </>
                        ) : (
                          <>🔄 Re-auditar</>
                        )}
                      </button>
                    </div>

                    {/* Estado Cargando */}
                    {loadingAudit && !auditResult && (
                      <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(240,244,255,0.7)' }}>
                        <span className="spinner" style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <p style={{ marginTop: '12px', fontSize: '14px' }}>Ejecutando evaluación de los 23 criterios DBEPA/NEM...</p>
                      </div>
                    )}

                    {/* Estado Error */}
                    {auditError && !auditResult && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '8px', color: '#fca5a5' }}>
                        <div style={{ fontWeight: 600, marginBottom: '6px' }}>Error al obtener la auditoría:</div>
                        <div style={{ fontSize: '13px' }}>{auditError}</div>
                        <button
                          type="button"
                          onClick={() => projectId && fetchAudit(projectId)}
                          className="btn btn-sm"
                          style={{ marginTop: '10px', background: '#ef4444', color: '#fff', border: 'none' }}
                        >
                          Reintentar Auditoría
                        </button>
                      </div>
                    )}

                    {/* Visualización de Resultados */}
                    {auditResult && (() => {
                      const rawAudit = auditResult as any;
                      const scorePct = Math.round(rawAudit.percentage ?? rawAudit.score ?? 0);
                      const isGreen = scorePct >= 80;
                      const isYellow = scorePct >= 60 && scorePct < 80;
                      const isRed = scorePct < 60;

                      const semaforoColor = isGreen ? '#10b981' : isYellow ? '#f59e0b' : '#ef4444';
                      const semaforoBg = isGreen ? 'rgba(16, 185, 129, 0.12)' : isYellow ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)';
                      const semaforoBorder = isGreen ? 'rgba(16, 185, 129, 0.4)' : isYellow ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)';

                      const statusTitle = (rawAudit.status || rawAudit.estatus) === 'aprobado_excelente'
                        ? 'Aprobado con Excelencia'
                        : (rawAudit.status || rawAudit.estatus) === 'aprobado'
                        ? 'Aprobado'
                        : 'Requiere Ajustes';

                      const criteriaList: PaecAuditCriterion[] = rawAudit.criteria || rawAudit.criterios || [];
                      const summary = rawAudit.summary || {
                        passedCount: criteriaList.filter((c: PaecAuditCriterion) => c.status === 'pass').length,
                        warningCount: criteriaList.filter((c: PaecAuditCriterion) => c.status === 'warning').length,
                        failedCount: criteriaList.filter((c: PaecAuditCriterion) => c.status === 'fail').length,
                      };
                      const totalScore = rawAudit.totalScore ?? Math.round((scorePct / 100) * 92);

                      const criteriaToRender: PaecAuditCriterion[] = auditFilter === 'deficient'
                        ? criteriaList.filter((c: PaecAuditCriterion) => c.status === 'fail' || c.status === 'warning')
                        : criteriaList;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {/* Semáforo Visual & Bloque de Puntaje */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '16px',
                            alignItems: 'center',
                            background: semaforoBg,
                            border: `1px solid ${semaforoBorder}`,
                            padding: '20px',
                            borderRadius: '10px'
                          }}>
                            {/* Semáforo Físico & Puntaje Grande */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                background: '#090d1a',
                                padding: '8px 10px',
                                borderRadius: '20px',
                                border: '1px solid rgba(255,255,255,0.15)',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)'
                              }}>
                                <div
                                  title="Verde (≥80): Aprobado con Excelencia"
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: isGreen ? '#10b981' : '#064e3b',
                                    boxShadow: isGreen ? '0 0 12px #10b981, 0 0 4px #10b981' : 'none',
                                    border: '1px solid rgba(0,0,0,0.5)',
                                    transition: 'all 0.3s ease'
                                  }}
                                />
                                <div
                                  title="Amarillo (60-79): Aprobado con Observaciones"
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: isYellow ? '#f59e0b' : '#78350f',
                                    boxShadow: isYellow ? '0 0 12px #f59e0b, 0 0 4px #f59e0b' : 'none',
                                    border: '1px solid rgba(0,0,0,0.5)',
                                    transition: 'all 0.3s ease'
                                  }}
                                />
                                <div
                                  title="Rojo (<60): Requiere Ajustes"
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: isRed ? '#ef4444' : '#7f1d1d',
                                    boxShadow: isRed ? '0 0 12px #ef4444, 0 0 4px #ef4444' : 'none',
                                    border: '1px solid rgba(0,0,0,0.5)',
                                    transition: 'all 0.3s ease'
                                  }}
                                />
                              </div>

                              <div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                  <span style={{ fontSize: '38px', fontWeight: 800, color: semaforoColor, lineHeight: 1 }}>
                                    {scorePct}%
                                  </span>
                                  <span style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', fontWeight: 500 }}>
                                    ({totalScore} / 92 pts)
                                  </span>
                                </div>
                                <div style={{ marginTop: '6px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    background: semaforoColor,
                                    color: '#fff',
                                    letterSpacing: '0.3px',
                                    textTransform: 'uppercase'
                                  }}>
                                    {isGreen ? '🟢 ' : isYellow ? '🟡 ' : '🔴 '}
                                    {statusTitle}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 3 Contadores de Criterios */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>{summary.passedCount}</div>
                                <div style={{ fontSize: '11px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase' }}>Cumple</div>
                              </div>
                              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>{summary.warningCount}</div>
                                <div style={{ fontSize: '11px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase' }}>Advertencias</div>
                              </div>
                              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>{summary.failedCount}</div>
                                <div style={{ fontSize: '11px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase' }}>Deficientes</div>
                              </div>
                            </div>
                          </div>

                          {/* Controles de Filtro */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => setAuditFilter('all')}
                                className="btn btn-sm"
                                style={{
                                  background: auditFilter === 'all' ? 'var(--c-blue-mid)' : 'rgba(255,255,255,0.06)',
                                  color: auditFilter === 'all' ? '#fff' : 'rgba(255,255,255,0.7)',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  fontSize: '12px'
                                }}
                              >
                                Todos ({criteriaList.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setAuditFilter('deficient')}
                                className="btn btn-sm"
                                style={{
                                  background: auditFilter === 'deficient' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)',
                                  color: auditFilter === 'deficient' ? '#fca5a5' : 'rgba(255,255,255,0.7)',
                                  border: '1px solid rgba(239,68,68,0.3)',
                                  fontSize: '12px'
                                }}
                              >
                                Observados ({summary.warningCount + summary.failedCount})
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => setShowAuditDetails(!showAuditDetails)}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}
                            >
                              {showAuditDetails ? '▲ Ocultar Lista' : '▼ Mostrar Lista Detallada'}
                            </button>
                          </div>

                          {/* Lista Detallada de Criterios */}
                          {showAuditDetails && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                              {criteriaToRender.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', color: '#6ee7b7' }}>
                                  🎉 ¡Excelente! No se encontraron criterios deficientes ni advertencias en este proyecto.
                                </div>
                              ) : (
                                criteriaToRender.map((c) => {
                                  const isPass = c.status === 'pass';
                                  const isWarn = c.status === 'warning';
                                  const cardBorder = isPass ? 'rgba(16,185,129,0.3)' : isWarn ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
                                  const cardBg = isPass ? 'rgba(16,185,129,0.05)' : isWarn ? 'rgba(245,158,11,0.05)' : 'rgba(239,68,68,0.05)';
                                  const badgeBg = isPass ? '#10b981' : isWarn ? '#f59e0b' : '#ef4444';

                                  return (
                                    <div
                                      key={c.id}
                                      style={{
                                        padding: '12px 14px',
                                        borderRadius: '8px',
                                        background: cardBg,
                                        border: `1px solid ${cardBorder}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontWeight: 700, color: '#f0f4ff', fontSize: '13px' }}>
                                            Criterio {c.id}: {c.name}
                                          </span>
                                          <span style={{ fontSize: '11px', color: 'rgba(240,244,255,0.5)', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                                            {c.dimension}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.7)' }}>
                                            Puntaje: <strong>{c.score}/4</strong> ({c.expectedLevel})
                                          </span>
                                          <span style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '10px', background: badgeBg, color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>
                                            {isPass ? 'Cumple' : isWarn ? 'Advertencia' : 'Deficiente'}
                                          </span>
                                        </div>
                                      </div>

                                      <div style={{ fontSize: '12.5px', color: 'rgba(240,244,255,0.85)', lineHeight: 1.4 }}>
                                        <strong style={{ color: isPass ? '#6ee7b7' : isWarn ? '#fde68a' : '#fca5a5' }}>Feedback: </strong>
                                        {c.feedback}
                                      </div>

                                      <div style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.5)', fontStyle: 'italic' }}>
                                        <strong>Evidencia encontrada: </strong>{c.evidenceFound}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                </div>
              );
            })()}

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

      </div>
    </div>
  );
}
