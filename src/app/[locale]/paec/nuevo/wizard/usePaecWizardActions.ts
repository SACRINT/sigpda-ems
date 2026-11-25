'use client';

import type React from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type {
  PaecProject,
  PaecAuditResult,
  PaecQualityAudit,
} from '@/types/paec';
import { UACS_LABORALES_OFICIALES_BGE } from '@/lib/capacitaciones-data';
import { normalizeActiveStep } from '@/lib/paec-steps';
import { getMissingStep1Fields } from '@/lib/prompts/paec-extraction';
import {
  savePaecDraft,
  clearPaecDraft,
  getCachedPaecStep,
  setCachedPaecStep,
  invalidatePaecStepCache,
  classifyError,
  FFE_PAIRS,
  type AcademicBaseline,
  type PaecEditPayload,
} from './helpers';
import type { PaecWizardState } from './usePaecWizardState';

export function usePaecWizardActions(state: PaecWizardState) {
  const {
    locale,
    router,
    projectId,
    setProjectId,
    project,
    setProject,
    setLoading,
    setGenerating,
    activeStep,
    setActiveStep,
    setError,
    setErrorType,
    retryCount,
    setRetryCount,
    setNeedsInputWarning,
    projectName,
    setProjectName,
    problemStatement,
    setProblemStatement,
    cycleType,
    setCycleType,
    community,
    setCommunity,
    school,
    setSchool,
    academicBaseline,
    setAcademicBaseline,
    laboralCatalog,
    setLaboralCatalog,
    setFfeCatalog,
    selectedFundamental,
    setSelectedFundamental,
    selectedLaboralCustom,
    selectedFfeCustom,
    groupsCount,
    setGroupsCount,
    groupsConfig,
    setGroupsConfig,
    schoolType,
    setSchoolType,
    selectedBtCarreras,
    setSelectedBtCarreras,
    semestersConfig,
    setSemestersConfig,
    setGroupAssignments,
    groupAssignments,
    findTrackForUacOrTrackName,
    selectedLaboral,
    selectedFfe,
    clearPaecLocalDraft,
    uniqueUacsList,
  } = state;

  // Manual Edit States
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editPayload, setEditPayload] = useState<PaecEditPayload>(null);

  // Quality Audit States (Quality Gate continuo MCCEMS/NEM)
  const [auditResult, setAuditResult] = useState<PaecQualityAudit | PaecAuditResult | null>(null);
  const [stepAudits, setStepAudits] = useState<Record<number, PaecQualityAudit>>({});
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
    const norm = normalizeActiveStep(activeStep, cycleType);
    if (norm !== activeStep) {
      queueMicrotask(() => {
        setActiveStep(norm);
      });
    }
  }, [cycleType, activeStep, setActiveStep]);

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
      selectedLaboralCustom,
      selectedFfe,
      selectedFfeCustom,
      selectedBtCarreras,
      groupsCount,
      groupsConfig,
      groupAssignments,
      semestersConfig,
    });
  }, [projectId, projectName, problemStatement, cycleType, community, school, schoolType, selectedFundamental, selectedLaboral, selectedLaboralCustom, selectedFfe, selectedFfeCustom, selectedBtCarreras, groupsCount, groupsConfig, groupAssignments, semestersConfig]);

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
  }, [setFfeCatalog, setLaboralCatalog]);

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
  }, [setAuditResult]);

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
      const rawP = p as unknown as Record<string, unknown>;
      setProjectName(p.projectName || (rawP.project_name as string) || '');
      setProblemStatement(p.problemStatement || (rawP.problem_statement as string) || '');
      setCycleType(p.cycleType || (rawP.cycle_type as PaecProject['cycleType']) || 'A');
      const commCtx = p.communityContext || (rawP.community_context as PaecProject['communityContext']);
      if (commCtx) setCommunity(commCtx);
      const schoolCtx = p.schoolContext || (rawP.school_context as PaecProject['schoolContext']);
      if (schoolCtx) {
        setSchool(schoolCtx);
        if ((schoolCtx as unknown as Record<string, unknown>).academicBaseline) {
          setAcademicBaseline((schoolCtx as unknown as Record<string, unknown>).academicBaseline as AcademicBaseline);
        }
        setSelectedFundamental(schoolCtx.activeFundamentalUacs || []);
        setSelectedBtCarreras(schoolCtx.activeBtCarreras || []);
        setSchoolType(schoolCtx.schoolType || 'general');
        if (schoolCtx.groupStructure) {
          const rawGroups = schoolCtx.groupStructure.groupAssignments || [];
          let fallbackTrack = '';
          if (Array.isArray(schoolCtx.activeLaboralUacs) && schoolCtx.activeLaboralUacs.length > 0) {
            for (const item of schoolCtx.activeLaboralUacs) {
              const t = findTrackForUacOrTrackName(item);
              if (t) { fallbackTrack = t; break; }
            }
          }
          const activeFfe = Array.isArray(schoolCtx.activeFfeUacs) ? schoolCtx.activeFfeUacs : [];
          const hydratedGroups = rawGroups.map(g => {
            let updated = g;
            if ((g.semester === 3 || g.semester === 4) && !g.trackName && fallbackTrack) {
              updated = { ...updated, trackId: fallbackTrack, trackName: fallbackTrack };
            }
            if ((g.semester === 5 || g.semester === 6) && (!g.ffeSelections || g.ffeSelections.length === 0) && activeFfe.length > 0) {
              const relevant = g.semester === 6
                ? activeFfe.filter(s => FFE_PAIRS.some(p => p.name6 === s))
                : activeFfe.filter(s => FFE_PAIRS.some(p => p.name5 === s));
              updated = {
                ...updated,
                ffeSelections: relevant.length > 0 ? relevant : activeFfe.slice(0, 4),
              };
            }
            return updated;
          });
          setSemestersConfig(schoolCtx.groupStructure.semestersConfig || { 1: 1, 3: 1, 5: 1 });
          setGroupAssignments(hydratedGroups);
        }
        setGroupsCount(schoolCtx.groupsCount || '1');
        setGroupsConfig(schoolCtx.groupsConfig || '');
      }

      // Set active step to the furthest generated step, or current step
      const effectiveCycle = (p.cycleType || (rawP.cycle_type as PaecProject['cycleType']) || 'A') as 'A' | 'B' | 'annual';
      setActiveStep(normalizeActiveStep(p.currentStep, effectiveCycle));

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
  }, [fetchAudit, findTrackForUacOrTrackName, setAuditResult, setAcademicBaseline, setActiveStep, setCommunity, setCycleType, setError, setGroupAssignments, setGroupsConfig, setGroupsCount, setLoading, setProblemStatement, setProject, setProjectName, setSchool, setSchoolType, setSelectedBtCarreras, setSelectedFundamental, setSemestersConfig]);

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

  const semsInCycle = cycleType === 'A' ? [1, 3, 5] : cycleType === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6];
  const hasLaboralSemesters = schoolType !== 'tecnico' && semsInCycle.some(s => s >= 3 && (semestersConfig[s] ?? 0) > 0);
  const hasFfeSemesters = schoolType !== 'tecnico' && semsInCycle.some(s => s >= 5 && (semestersConfig[s] ?? 0) > 0);

  const isStep1Valid = Boolean(
    (projectName?.trim?.() ?? '') &&
    (problemStatement?.trim?.() ?? '') &&
    (community?.location?.trim?.() ?? '') &&
    (community?.demographics?.trim?.() ?? '') &&
    (community?.economy?.trim?.() ?? '') &&
    (school?.enrollment?.trim?.() ?? '') &&
    (school?.teacherCount?.trim?.() ?? '') &&
    (!hasLaboralSemesters || selectedLaboral.length > 0) &&
    (!hasFfeSemesters || selectedFfe.length > 0) &&
    (schoolType !== 'tecnico' || selectedBtCarreras.length > 0)
  );

  // Handle Form Submission (Create Project)
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isStep1Valid) {
      const missing = getMissingStep1Fields({
        projectName,
        problemStatement,
        community,
        school,
        curricular: {
          hasLaboralSemesters,
          selectedLaboralCount: selectedLaboral.length,
          hasFfeSemesters,
          selectedFfeCount: selectedFfe.length,
          isTecnico: schoolType === 'tecnico',
          selectedBtCarrerasCount: selectedBtCarreras.length,
        },
      });
      setError(
        missing.length > 0
          ? `Por favor completa los siguientes campos obligatorios (*) antes de continuar: ${missing.join(', ')}.`
          : 'Por favor completa todos los campos obligatorios marcados con asterisco rojo (*) antes de continuar.'
      );
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          const firstMissing = missing[0];
          let targetEl: HTMLElement | null = null;
          if (firstMissing === 'Nombre del Proyecto') targetEl = document.getElementById('paec-project-name');
          else if (firstMissing === 'Problemática Central') targetEl = document.getElementById('paec-problem-statement');
          else if (firstMissing === 'Ubicación Geográfica') targetEl = document.getElementById('paec-community-location');
          else if (firstMissing === 'Situación Demográfica') targetEl = document.getElementById('paec-community-demographics');
          else if (firstMissing === 'Actividades Socioeconómicas') targetEl = document.getElementById('paec-community-economy');
          else if (firstMissing === 'Matrícula Estudiantil') targetEl = document.getElementById('paec-school-enrollment');
          else if (firstMissing === 'Plantilla Docente') targetEl = document.getElementById('paec-school-teachercount');
          else if (firstMissing?.includes('Laboral')) targetEl = document.getElementById('paec-laboral-section');
          else if (firstMissing?.includes('FFE')) targetEl = document.getElementById('paec-ffe-section');

          const errorBanner = document.getElementById('step1-error-banner');
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.focus?.();
          } else if (errorBanner) {
            errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
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
            academicBaseline,
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
      clearPaecLocalDraft();
      setProjectId(data.project.id);
      router.push(`/${locale}/paec/nuevo?id=${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al registrar el proyecto.');
      setLoading(false);
    }
  }

  // Handle Step Generation (Call Claude API)
  async function generateCurrentStep(allowPartial?: boolean | React.MouseEvent) {
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
    setNeedsInputWarning(null);
    try {
      const res = await fetch(`/api/paec/${projectId}/generate-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: activeStep,
          allowPartialGeneration: allowPartial === true,
        }),
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

      // H-314: Intercepción de falta de insumos mínimos
      if (data.needsInput) {
        setNeedsInputWarning({
          step: activeStep,
          missingFields: data.missingFields || [],
          message: data.message || 'Se requiere información adicional antes de generar este paso.',
        });
        setGenerating(false);
        return;
      }

      setProject(data.project);

      if (data.stepAudit) {
        setStepAudits((prev) => ({ ...prev, [activeStep]: data.stepAudit }));
      }

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


  return {
    isEditingContent,
    setIsEditingContent,
    editPayload,
    setEditPayload,
    auditResult,
    setAuditResult,
    stepAudits,
    setStepAudits,
    loadingAudit,
    setLoadingAudit,
    auditError,
    setAuditError,
    showAuditDetails,
    setShowAuditDetails,
    auditFilter,
    setAuditFilter,
    showQGTooltip,
    setShowQGTooltip,
    collapsedCarta,
    setCollapsedCarta,
    collapsedMinuta,
    setCollapsedMinuta,
    collapsedOficios,
    setCollapsedOficios,
    activeAnexoTab,
    setActiveAnexoTab,
    collapsedGobernanza,
    setCollapsedGobernanza,
    collapsedInforme,
    setCollapsedInforme,
    fetchAudit,
    loadProject,
    semsInCycle,
    hasLaboralSemesters,
    hasFfeSemesters,
    isStep1Valid,
    handleCreate,
    generateCurrentStep,
    getCurrentStepData,
    saveStepEdits,
    groupedLaboral,
  };
}

export type PaecWizardActions = ReturnType<typeof usePaecWizardActions>;
export type PaecWizardController = PaecWizardState & PaecWizardActions;
