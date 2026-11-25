'use client';

import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { SchoolZoneContextResponse } from '@/lib/zone-sync-service';
import { computeRecommendedReprobacionMeta, resolveBajasPercentage } from '@/lib/qa/paec-pmc-semantic-qa';
import { computeCoverage } from '@/lib/coverage-core';
import { reconcilePmcStaff, derivePersonalMetasFromStaff, normalizeStaffName } from '@/lib/pmc/staff-reconciler';
import type { PmcAuditCalculationEntry } from '@/types/pmc';
import {
  savePmcDraft,
  clearPmcDraft,
  buildIndicadoresPayload,
  buildPmcSaveBody,
  validateCanGenerateStep,
  parseSafeApiResponse,
  CATEGORIAS_OFICIALES,
  type PmcProject,
  type MetaPersonal,
  type DiagnosticoGenerado,
  type PlanAccion,
} from './helpers';
import type { PmcWizardState } from './usePmcWizardState';

export function usePmcGenerationAndNav(state: PmcWizardState) {
  const {
    locale,
    router,
    projectId,
    setProjectId,
    activeStep,
    setActiveStep,
    setSaving,
    setGenerating,
    setError,
    schoolName,
    schoolCct,
    municipality,
    locality,
    schoolZone,
    setSchoolZone,
    directorName,
    supervisorName,
    setSupervisorName,
    cicloEscolar,
    subsystem,
    totalStaff,
    setTotalStaff,
    staffData,
    setStaffData,
    diagnosticoComunidad,
    setDiagnosticoComunidad,
    indicadores,
    setIndicadores,
    metasConfirmadas,
    setMetasConfirmadas,
    setMetasMateriasConfirmadas,
    foda,
    categoriasPriorizadas,
    setCategoriasPriorizadas,
    normativaData,
    setNormativaData,
    diagnosticoGenerado,
    setDiagnosticoGenerado,
    planAccion,
    setPlanAccion,
    allowPartialGeneration,
    zonaData,
    setZonaData,
    setShowZonaModal,
    setLoadingZona,
    setZonaFeedback,
    setShowCoverageModal,
    coverageWarningDismissed,
    setCoverageWarningDismissed,
    pendingDownloadUrl,
    setPendingDownloadUrl,
    f11Warnings,
    ingestCoverage,
    setSuccessBanner,
    clearPmcLocalDraft,
  } = state;

  const handleConsultarZona = useCallback(async () => {
    const targetCct = schoolCct.trim();
    if (!targetCct) {
      setError('Por favor ingresa primero la Clave de Centro de Trabajo (CCT).');
      return;
    }
    setLoadingZona(true);
    setZonaFeedback(null);
    try {
      const res = await fetch(`/api/pmc/zona-context?cct=${encodeURIComponent(targetCct)}`);
      const data = await parseSafeApiResponse<SchoolZoneContextResponse>(
        res,
        'Error al consultar la Cartografía de Zona.'
      );
      if (!res.ok || !data.found) {
        setZonaFeedback('No se encontró Cartografía de Zona activa para este CCT escolar.');
      } else {
        setZonaData(data);
        setShowZonaModal(true);
      }
    } catch {
      setZonaFeedback('Error al consultar la Cartografía de Zona.');
    } finally {
      setLoadingZona(false);
    }
  }, [schoolCct, setError, setLoadingZona, setShowZonaModal, setZonaData, setZonaFeedback]);

  const handleAplicarSugerenciasZona = () => {
    if (!zonaData || !zonaData.zona) return;
    const { zona, plantel } = zonaData;

    if (zona.identificacion.zonaNumero && !schoolZone) {
      setSchoolZone(`Zona ${zona.identificacion.zonaNumero}`);
    }
    if (zona.identificacion.supervisorName && !supervisorName) {
      setSupervisorName(zona.identificacion.supervisorName);
    }

    if (plantel) {
      setIndicadores(prev => ({
        ...prev,
        matricula: prev.matricula ?? plantel.matricula,
        abandono_ant: prev.abandono_ant ?? plantel.abandono,
        et_ant: prev.et_ant ?? plantel.eficienciaTerminal,
        reprobacion_ant: prev.reprobacion_ant ?? plantel.reprobacion,
      }));
    }

    if (zona.momento3Territorio?.descripcionTerritorial && !diagnosticoComunidad.trim()) {
      setDiagnosticoComunidad(zona.momento3Territorio.descripcionTerritorial);
    }

    setShowZonaModal(false);
    setZonaFeedback('✅ Datos y sugerencias de la Cartografía de Zona aplicados exitosamente a tu PMC.');
    setTimeout(() => setZonaFeedback(null), 4000);
  };

  // Auto-save step-1 form fields to localStorage (only when no project in DB yet)
  const isFirstRenderDraft = useRef(true);
  useEffect(() => {
    if (isFirstRenderDraft.current) { isFirstRenderDraft.current = false; return; }
    if (projectId) return; // project already saved in DB
    savePmcDraft({ schoolName, schoolCct, municipality, locality, schoolZone, directorName, supervisorName, cicloEscolar, subsystem });
  }, [projectId, schoolName, schoolCct, municipality, locality, schoolZone, directorName, supervisorName, cicloEscolar, subsystem]);

  const handleConfirmarMetasCiclo = () => {
    const nowIso = new Date().toISOString();
    const newCalc: Record<string, PmcAuditCalculationEntry> = { ...(indicadores._calc || {}) };

    const aprobAnt = indicadores.aprobacion_ant;
    const reprobAnt = indicadores.reprobacion_ant;
    const etAnt = indicadores.et_ant;
    const abAnt = indicadores.abandono_ant;
    const matVigente = indicadores.matricula;

    const finalAprobMeta = indicadores.aprobacion_meta !== undefined
      ? indicadores.aprobacion_meta
      : (aprobAnt !== undefined ? Math.min(100, Math.round((aprobAnt + 5) * 10) / 10) : undefined);

    const bajasPctResolved = resolveBajasPercentage(indicadores as unknown as Record<string, unknown>);
    const finalReprobMeta = indicadores.reprobacion_meta !== undefined
      ? indicadores.reprobacion_meta
      : computeRecommendedReprobacionMeta({
          aprobacionMeta: finalAprobMeta,
          reprobacionAnt: reprobAnt,
          bajasPct: bajasPctResolved,
        });

    const finalEtMeta = indicadores.et_meta !== undefined
      ? indicadores.et_meta
      : (etAnt !== undefined ? Math.min(100, Math.round((etAnt + 5) * 10) / 10) : undefined);

    const finalAbMeta = indicadores.abandono_meta !== undefined
      ? indicadores.abandono_meta
      : (abAnt !== undefined ? Math.max(0, Math.round((abAnt - 1.5) * 10) / 10) : undefined);

    const finalMatMeta = indicadores.matricula_meta !== undefined
      ? indicadores.matricula_meta
      : matVigente;

    if (finalAprobMeta !== undefined) {
      newCalc.aprobacion_meta = {
        valor: finalAprobMeta,
        formula: `min(100, ${aprobAnt ?? 'N/D'} + 5)`,
        fuentes: ['F11', 'meta_sugerida'],
        fecha: nowIso,
      };
    }
    if (finalReprobMeta !== undefined) {
      newCalc.reprobacion_meta = {
        valor: finalReprobMeta,
        formula:
          reprobAnt === 0
            ? '0 (reprobación actual es 0%)'
            : bajasPctResolved !== undefined && finalAprobMeta !== undefined
              ? `min(${reprobAnt ?? 'N/D'}, max(0, 100 - ${finalAprobMeta} - ${bajasPctResolved}))`
              : `min(${reprobAnt ?? 'N/D'}, max(0, 100 - ${finalAprobMeta ?? 'N/D'}))`,
        fuentes: ['F11', 'meta_sugerida'],
        fecha: nowIso,
      };
    }
    if (finalEtMeta !== undefined) {
      newCalc.et_meta = {
        valor: finalEtMeta,
        formula: `min(100, ${etAnt ?? 'N/D'} + 5)`,
        fuentes: ['911 Fin', 'meta_sugerida'],
        fecha: nowIso,
      };
    }
    if (finalAbMeta !== undefined) {
      newCalc.abandono_meta = {
        valor: finalAbMeta,
        formula: `max(0, ${abAnt ?? 'N/D'} - 1.5)`,
        fuentes: ['911 Fin', 'meta_sugerida'],
        fecha: nowIso,
      };
    }
    if (finalMatMeta !== undefined) {
      newCalc.matricula_meta = {
        valor: finalMatMeta,
        formula: `matricula_vigente = ${matVigente ?? 'N/D'}`,
        fuentes: ['911 Inicio', 'meta_sugerida'],
        fecha: nowIso,
      };
    }

    setIndicadores(prev => ({
      ...prev,
      aprobacion_meta: finalAprobMeta,
      reprobacion_meta: finalReprobMeta,
      et_meta: finalEtMeta,
      abandono_meta: finalAbMeta,
      matricula_meta: finalMatMeta,
      _calc: newCalc,
      metas_confirmadas: true,
    }));
    setMetasConfirmadas(true);
    setSuccessBanner('✓ Metas del ciclo escolar confirmadas exitosamente.');
  };

  const handleConfirmarMetasMaterias = () => {
    if (!indicadores.reprobacionPorMateria || indicadores.reprobacionPorMateria.length === 0) return;
    const updated = indicadores.reprobacionPorMateria.map(m => ({
      ...m,
      metaConfirmada: true,
      metaSugerida: m.metaUsuario !== undefined ? m.metaUsuario : m.metaSugerida,
    }));
    setIndicadores(prev => ({
      ...prev,
      reprobacionPorMateria: updated,
    }));
    setMetasMateriasConfirmadas(true);
    setSuccessBanner('✓ Metas de reducción de reprobación por asignatura confirmadas exitosamente.');
  };

  const saveProject = useCallback(async (data: Partial<PmcProject>, goToStep?: number): Promise<string | null> => {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...data };
      if (goToStep !== undefined) payload.current_step = goToStep;

      // H-246 / H-247: Construir indicadores_academicos enriquecidos con el estado completo del wizard.
      // Debe posicionarse siempre después de ...payload tanto en POST como en PUT para garantizar
      // que no sea pisado y que los PUT sin indicadores (ej. paso 2→3 y 4→5) no reemplacen la columna
      // JSONB entera con solo { ingest_coverage }.
      const indicadoresBody = buildIndicadoresPayload(indicadores, metasConfirmadas, ingestCoverage, f11Warnings);

      if (!projectId) {
        // Create new
        const baseFields = {
          school_name: schoolName,
          school_cct: schoolCct,
          municipality,
          locality,
          school_zone: schoolZone,
          director_name: directorName,
          supervisor_name: supervisorName,
          ciclo_escolar: cicloEscolar,
          subsystem,
          total_staff: totalStaff,
          staff_data: staffData,
          diagnostico_comunidad: diagnosticoComunidad,
          foda,
          categorias_priorizadas: categoriasPriorizadas,
        };
        const bodyObj = buildPmcSaveBody('POST', baseFields, payload, indicadoresBody);
        const res = await fetch('/api/pmc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj),
        });
        const created = await parseSafeApiResponse<{ project?: { id?: string }; id?: string; error?: string }>(
          res,
          'Error al guardar el proyecto.'
        );
        if (!res.ok) throw new Error(created.error || 'Error al guardar');
        clearPmcDraft(); // Draft saved to DB — clear localStorage
        clearPmcLocalDraft();
        const newId = created.project?.id || created.id;
        if (newId) {
          setProjectId(newId);
          router.replace(`/${locale}/pmc/nuevo?id=${newId}`);
          return newId;
        }
        return null;
      } else {
        // Update existing — H-286: incluir plan_accion para persistir metas adaptadas contra F5
        const basePutFields: Record<string, unknown> = {
          ...(planAccion ? { plan_accion: planAccion } : {}),
        };
        const bodyObj = buildPmcSaveBody('PUT', basePutFields, payload, indicadoresBody);
        const res = await fetch(`/api/pmc/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj),
        });
        if (!res.ok) {
          const errData = await parseSafeApiResponse<{ error?: string }>(res, 'Error al actualizar el proyecto.');
          throw new Error(errData.error || 'Error al actualizar');
        }
        return projectId;
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'Error al guardar');
      return null;
    } finally {
      setSaving(false);
    }
  }, [projectId, schoolName, schoolCct, municipality, locality, schoolZone, directorName, supervisorName, cicloEscolar, subsystem, totalStaff, staffData, indicadores, metasConfirmadas, diagnosticoComunidad, foda, categoriasPriorizadas, ingestCoverage, f11Warnings, planAccion, locale, router, clearPmcLocalDraft, setError, setProjectId, setSaving]);

  const generateStep = useCallback(async (step: string): Promise<void> => {
    if (!projectId) return;
    const validation = validateCanGenerateStep(step, metasConfirmadas, ingestCoverage, allowPartialGeneration);
    if (!validation.allowed) {
      setError(validation.error || 'No se puede generar este paso.');
      return;
    }
    setGenerating(step);
    setError(null);
    try {
      const res = await fetch(`/api/pmc/${projectId}/generate-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
      const data = await parseSafeApiResponse<{
        diagnostico_generado?: DiagnosticoGenerado;
        plan_accion?: PlanAccion;
        normativa?: unknown;
        data?: unknown;
        error?: string;
      }>(res, 'Error al generar contenido');
      if (!res.ok) {
        throw new Error(data.error || 'Error al generar');
      }
      if (step === 'diagnostico' && data.diagnostico_generado) {
        setDiagnosticoGenerado(data.diagnostico_generado);
      }
      if (step === 'plan_accion' && data.plan_accion) {
        setPlanAccion(data.plan_accion);
      }
      if (step === 'normativa') {
        const norm = data.normativa || data.data;
        if (norm) {
          setNormativaData(norm);
        }
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'Error al generar contenido');
    } finally {
      setGenerating(null);
    }
  }, [projectId, metasConfirmadas, ingestCoverage, allowPartialGeneration, setDiagnosticoGenerado, setError, setGenerating, setNormativaData, setPlanAccion]);

  // H-099: Auto-ejecución de normativa al ingresar a Paso 4 si aún no existe en BD
  const hasTriggeredNormativaRef = useRef(false);
  useEffect(() => {
    if (activeStep === 4 && projectId && !normativaData && !hasTriggeredNormativaRef.current) {
      hasTriggeredNormativaRef.current = true;
      generateStep('normativa');
    }
  }, [activeStep, projectId, normativaData, generateStep]);

  const adjustStaffCount = (newCount: number) => {
    const n = Math.max(1, Math.min(100, newCount));
    setTotalStaff(n);
    setStaffData(prev => {
      if (n > prev.length) {
        const toAdd = Array.from({ length: n - prev.length }, () => ({ nombre: '', cargo: 'Docente', meta_individual: '' }));
        return [...prev, ...toAdd];
      }
      return prev.slice(0, n);
    });
  };

  const removeStaffMember = (indexToRemove: number) => {
    const memberToRemove = staffData[indexToRemove];
    const updated = staffData.length <= 1
      ? [{ nombre: '', cargo: 'Docente', meta_individual: '', metas_individuales: [] }]
      : staffData.filter((_, idx) => idx !== indexToRemove);

    setStaffData(updated);
    setTotalStaff(updated.length);

    // H-045: Podar inmediatamente de metas_personales al responsable eliminado usando normalizeStaffName
    if (memberToRemove?.nombre?.trim()) {
      const removedNorm = normalizeStaffName(memberToRemove.nombre);
      setPlanAccion(prev => {
        if (!prev) return prev;
        const remainingMetas = (prev.metas_personales || []).filter(
          mp => normalizeStaffName(mp.nombre || '') !== removedNorm
        );
        return {
          ...prev,
          metas_personales: remainingMetas,
        };
      });
    }
  };

  const addStaffMember = () => {
    const updated = [
      ...staffData,
      { nombre: '', cargo: 'Docente', meta_individual: '', metas_individuales: [] },
    ];
    setStaffData(updated);
    setTotalStaff(updated.length);
  };

  // Toggle categoria (activa/desactiva la categoría completa)
  const toggleCategoria = (cat: typeof CATEGORIAS_OFICIALES[0]) => {
    setCategoriasPriorizadas(prev => {
      const exists = prev.find(c => c.id === cat.id);
      if (exists) return prev.filter(c => c.id !== cat.id);
      return [...prev, { id: cat.id, nombre: cat.nombre, temas: [] }];
    });
  };

  // Toggle tema dentro de una categoría
  const toggleTema = (catId: string, tema: string) => {
    setCategoriasPriorizadas(prev => prev.map(c => {
      if (c.id !== catId) return c;
      const temas = c.temas.includes(tema)
        ? c.temas.filter(t => t !== tema)
        : [...c.temas, tema];
      return { ...c, temas };
    }));
  };

  const isCatSelected = (id: string) => categoriasPriorizadas.some(c => c.id === id);
  const isTemaSelected = (catId: string, tema: string) =>
    categoriasPriorizadas.find(c => c.id === catId)?.temas.includes(tema) ?? false;
  const totalTemasSeleccionados = categoriasPriorizadas.reduce((sum, c) => sum + c.temas.length, 0);

  // Sincronización de metas individuales de plantilla (C10 - Corresponsabilidad)
  const syncPersonalMetas = useCallback((overrideBase?: MetaPersonal[], forceReset = false) => {
    const base = forceReset ? [] : (overrideBase || planAccion?.metas_personales || []);
    const derived = derivePersonalMetasFromStaff(staffData, cicloEscolar, base);
    setPlanAccion(prev => ({
      metas_institucionales: prev?.metas_institucionales || [],
      metas_personales: derived,
    }));
    return derived;
  }, [staffData, cicloEscolar, planAccion, setPlanAccion]);

  // ── Step navigation ────────────────────────────────────────────────────────

  const goToStep = (targetStep: number) => {
    if (targetStep === 4 && staffData.length > 0) {
      setPlanAccion(prev => {
        const existing = prev?.metas_personales || [];
        if (existing.length === 0 || existing.length < staffData.length) {
          const derived = derivePersonalMetasFromStaff(staffData, cicloEscolar, existing);
          return {
            metas_institucionales: prev?.metas_institucionales || [],
            metas_personales: derived,
          };
        }
        return prev;
      });
    }
    setActiveStep(targetStep);
  };

  const handleNext = async () => {
    setError(null);
    let idToUse = projectId;
    const targetNextStep = Math.min(activeStep + 1, 5);

    if (activeStep === 1) {
      if (!schoolName.trim() || !schoolCct.trim() || !directorName.trim()) {
        setError('Por favor completa: nombre del plantel, CCT y nombre del director.');
        return;
      }

      // Reconciliación arquitectónica asegurando sincronización de Director en plantilla
      const effStaff = reconcilePmcStaff({
        existingStaff: staffData,
        directorName,
        targetTotalStaff: totalStaff,
        cicloEscolar,
      });
      setStaffData(effStaff.staff);
      setTotalStaff(effStaff.totalStaff);

      idToUse = await saveProject({
        school_name: schoolName,
        school_cct: schoolCct,
        municipality,
        locality,
        school_zone: schoolZone,
        director_name: directorName,
        supervisor_name: supervisorName,
        ciclo_escolar: cicloEscolar,
        subsystem,
        total_staff: effStaff.totalStaff,
        staff_data: effStaff.staff,
        diagnostico_comunidad: diagnosticoComunidad,
        foda,
        categorias_priorizadas: categoriasPriorizadas,
        current_step: 2,
      });
    } else if (activeStep === 2) {
      // H-042: Si hay slots sin nombre (ej. derivados del conteo numérico de la 911),
      // se podan automáticamente los slots vacíos en vez de bloquear el avance del wizard
      const validStaff = staffData.filter(s => s.nombre.trim().length > 0);
      if (validStaff.length === 0) {
        setError('Por favor registra al menos a un integrante de la plantilla (Director o Docente).');
        return;
      }
      const incompleteRole = validStaff.some(s => !s.cargo.trim());
      if (incompleteRole) {
        setError('Por favor completa el cargo de todos los miembros registrados.');
        return;
      }
      if (validStaff.length !== staffData.length) {
        const prunedSlots = staffData.length - validStaff.length;
        setStaffData(validStaff);
        setTotalStaff(validStaff.length);
        setSuccessBanner(`✓ Se podaron automáticamente ${prunedSlots} slot(s) sin nombre de la plantilla.`);
      }
      // Derivar y propagar metas individuales de la plantilla hacia el plan de acción
      const derived = derivePersonalMetasFromStaff(validStaff, cicloEscolar, planAccion?.metas_personales);
      setPlanAccion(prev => ({
        metas_institucionales: prev?.metas_institucionales || [],
        metas_personales: derived,
      }));
      idToUse = await saveProject({ total_staff: validStaff.length, staff_data: validStaff, current_step: 3 });
    } else if (activeStep === 3) {
      if (!diagnosticoComunidad.trim()) {
        setError('Por favor describe el contexto de la comunidad.');
        return;
      }
      if (categoriasPriorizadas.length === 0 || totalTemasSeleccionados === 0) {
        setError('Selecciona al menos una categoría y al menos un tema a priorizar.');
        return;
      }
      // Asegurar que las metas personales estén preparadas para el Paso 4
      const derived = derivePersonalMetasFromStaff(staffData, cicloEscolar, planAccion?.metas_personales);
      setPlanAccion(prev => ({
        metas_institucionales: prev?.metas_institucionales || [],
        metas_personales: derived,
      }));
      idToUse = await saveProject({
        diagnostico_comunidad: diagnosticoComunidad,
        foda, categorias_priorizadas: categoriasPriorizadas,
        current_step: 4,
      });
    } else if (activeStep === 4) {
      if (!diagnosticoGenerado) {
        setError('Debes generar el diagnóstico oficial antes de continuar.');
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      const numMetasInst = planAccion?.metas_institucionales?.length || 0;
      if (numMetasInst === 0) {
        setError('Debes generar o adaptar al menos una meta institucional en el plan de acción antes de continuar.');
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }

      // Finalizar metas personales garantizando 100% de cobertura de la plantilla antes de guardar y avanzar al paso 5
      const finalizedPersonalMetas = derivePersonalMetasFromStaff(
        staffData,
        cicloEscolar,
        planAccion?.metas_personales
      );
      const finalizedPlanAccion: PlanAccion = {
        metas_institucionales: planAccion!.metas_institucionales,
        metas_personales: finalizedPersonalMetas,
      };
      setPlanAccion(finalizedPlanAccion);

      idToUse = await saveProject({
        diagnostico_generado: diagnosticoGenerado,
        plan_accion: finalizedPlanAccion,
        status: 'completed',
        current_step: 5,
      });
    }

    if (idToUse) {
      goToStep(targetNextStep);
    }
  };

  const handleBack = () => goToStep(Math.max(activeStep - 1, 1));

  // Invariante de Cobertura de Metas de Personal (C10 / D6)
  const coverage = computeCoverage(planAccion?.metas_personales, totalStaff, staffData);
  const realStaffCount = coverage.realStaffCount;
  const personalWithGoals = coverage.metasCount;
  const coveragePercent = coverage.coveragePercent;
  const isLowCoverage = coverage.isLowCoverage;

  const handleExportWithCoverageCheck = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    if (isLowCoverage && !coverageWarningDismissed) {
      e.preventDefault();
      setPendingDownloadUrl(url);
      setShowCoverageModal(true);
    }
  };

  const handleProceedDownload = () => {
    setShowCoverageModal(false);
    setCoverageWarningDismissed(true);
    if (pendingDownloadUrl) {
      window.location.href = pendingDownloadUrl;
      setPendingDownloadUrl(null);
    }
  };

  const handleGoToStep4 = () => {
    setShowCoverageModal(false);
    goToStep(4);
  };

  return {
    handleConsultarZona,
    handleAplicarSugerenciasZona,
    handleConfirmarMetasCiclo,
    handleConfirmarMetasMaterias,
    saveProject,
    generateStep,
    adjustStaffCount,
    removeStaffMember,
    addStaffMember,
    toggleCategoria,
    toggleTema,
    isCatSelected,
    isTemaSelected,
    totalTemasSeleccionados,
    syncPersonalMetas,
    goToStep,
    handleNext,
    handleBack,
    coverage,
    realStaffCount,
    personalWithGoals,
    coveragePercent,
    isLowCoverage,
    handleExportWithCoverageCheck,
    handleProceedDownload,
    handleGoToStep4,
  };
}

export type PmcGenerationAndNavHandlers = ReturnType<typeof usePmcGenerationAndNav>;
export type PmcWizardController = PmcWizardState & PmcFileIngestHandlers & PmcGenerationAndNavHandlers;
import type { PmcFileIngestHandlers } from './usePmcFileIngest';
