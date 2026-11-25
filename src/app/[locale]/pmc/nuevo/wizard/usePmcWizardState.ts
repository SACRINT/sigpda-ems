'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { SchoolZoneContextResponse } from '@/lib/zone-sync-service';
import { useAssistant } from '@/components/assistant';
import { synthesizeSituatedFoda } from '@/lib/pmc/pmc-foda-synthesizer';
import { useLocalDraft } from '@/hooks/useLocalDraft';
import {
  readPmcDraft,
  type Props,
  type DirectorSource,
  type StaffMember,
  type IndicadoresAcademicos,
  type Foda,
  type CategoriaPriorizada,
  type DiagnosticoGenerado,
  type PlanAccion,
  type EditablePlanElement,
  type IngestCoverageData,
  type PmcPreviousExtractDTO,
} from './helpers';

export function usePmcWizardState({ locale, teacherSchool, teacherMunicipality, existingProject }: Props) {
  const router = useRouter();

  // Initialize state from existing project or defaults (safe for SSR hydration, prevents error #418)
  const [projectId, setProjectId] = useState<string | null>(existingProject?.id || null);
  const [activeStep, setActiveStep] = useState<number>(existingProject?.current_step || 1);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<number | null>(null);
  const [editingPersonal, setEditingPersonal] = useState<number | null>(null);
  const [step5Tab, setStep5Tab] = useState<'descargas' | 'metas_complementarias'>('descargas');
  const [showPaso4Complementarias, setShowPaso4Complementarias] = useState(false);

  // Step 1: Institutional data
  const [schoolName, setSchoolName] = useState(existingProject?.school_name || teacherSchool || '');
  const [schoolCct, setSchoolCct] = useState(existingProject?.school_cct || '');
  const [municipality, setMunicipality] = useState(existingProject?.municipality || teacherMunicipality || '');
  const [locality, setLocality] = useState(existingProject?.locality || '');
  const [schoolZone, setSchoolZone] = useState(existingProject?.school_zone || '');
  const [directorName, setDirectorName] = useState(existingProject?.director_name || '');
  const [directorSource, setDirectorSource] = useState<DirectorSource>(
    existingProject?.director_name ? 'bd' : 'none'
  );
  const [directorMismatchWarning, setDirectorMismatchWarning] = useState<string | null>(null);
  const [alternativeDirector, setAlternativeDirector] = useState<{ name: string; source: DirectorSource } | null>(null);
  const [isPlatformPmcDoc, setIsPlatformPmcDoc] = useState(false);
  const [supervisorName, setSupervisorName] = useState(existingProject?.supervisor_name || '');
  const [cicloEscolar, setCicloEscolar] = useState(existingProject?.ciclo_escolar || '2025-2026');
  const [subsystem, setSubsystem] = useState(existingProject?.subsystem || 'BGE');

  // Hydrate draft from localStorage on mount (client-only, prevents SSR hydration mismatch #418)
  useEffect(() => {
    if (!existingProject) {
      const draft = readPmcDraft();
      if (draft) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (draft.schoolName) setSchoolName(draft.schoolName);
        if (draft.schoolCct) setSchoolCct(draft.schoolCct);
        if (draft.municipality) setMunicipality(draft.municipality);
        if (draft.locality) setLocality(draft.locality);
        if (draft.schoolZone) setSchoolZone(draft.schoolZone);
        if (draft.directorName) {
          setDirectorName(draft.directorName);
          setDirectorSource('draft');
        }
        if (draft.supervisorName) setSupervisorName(draft.supervisorName);
        if (draft.cicloEscolar) setCicloEscolar(draft.cicloEscolar);
        if (draft.subsystem) setSubsystem(draft.subsystem);
      }
    }
  }, [existingProject]);

  // Step 2: Staff
  const [totalStaff, setTotalStaff] = useState(existingProject?.total_staff || 1);
  const [staffData, setStaffData] = useState<StaffMember[]>(
    existingProject?.staff_data || [{ nombre: '', cargo: 'Director(a)', meta_individual: '' }]
  );

  // Step 3: Diagnosis
  const [diagnosticoComunidad, setDiagnosticoComunidad] = useState(existingProject?.diagnostico_comunidad || '');
  const [indicadores, setIndicadores] = useState<IndicadoresAcademicos>(
    existingProject?.indicadores_academicos || {
      matricula: undefined, matricula_meta: undefined,
      promedio_f11: undefined, promedio_meta: undefined,
      aprobacion_ant: undefined, aprobacion_meta: undefined,
      reprobacion_ant: undefined, reprobacion_meta: undefined,
      abandono_ant: undefined, abandono_meta: undefined,
      et_ant: undefined, et_meta: undefined,
    }
  );
  const [metasConfirmadas, setMetasConfirmadas] = useState<boolean>(
    Boolean(existingProject?.indicadores_academicos?.metas_confirmadas)
  );
  const [metasMateriasConfirmadas, setMetasMateriasConfirmadas] = useState<boolean>(
    Boolean(existingProject?.indicadores_academicos?.reprobacionPorMateria?.some(m => m.metaConfirmada))
  );

  // SAPCU Copiloto Pedagógico: Sincronización contextual bidireccional
  const { setDetallesDocumento } = useAssistant();
  useEffect(() => {
    setDetallesDocumento({
      programa: 'pmc',
      documentoId: projectId || 'nuevo',
      seccionActiva: `Paso ${activeStep}`,
      detallesMediaSuperior: {
        subsistema: (subsystem?.toLowerCase() as 'bge' | 'tecnologico' | 'general') || 'bge',
        retoSituado: diagnosticoComunidad
          ? {
              contextoReal: `${schoolName || ''} - ${locality || ''}, ${municipality || ''}`.trim(),
              problemaComunidad: diagnosticoComunidad,
            }
          : undefined,
      },
    });
  }, [projectId, activeStep, subsystem, schoolName, locality, municipality, diagnosticoComunidad, setDetallesDocumento]);

  const [foda, setFoda] = useState<Foda>(
    existingProject?.foda || { fortalezas: '', oportunidades: '', debilidades: '', amenazas: '' }
  );

  // Auto-síntesis y enriquecimiento del FODA al entrar al Paso 3 si está vacío o incompleto (H-FODA-AUTO)
  useEffect(() => {
    if (activeStep === 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFoda(prev => {
        const hasSubstance = Boolean(prev.fortalezas && prev.fortalezas.trim().length >= 15);
        if (hasSubstance) return prev;
        const res = synthesizeSituatedFoda({
          schoolName,
          schoolCct,
          municipality,
          locality,
          totalStaff,
          rawFoda: prev,
          indicadores,
          diagnosticoComunidad,
          promediosPorAsignatura: (indicadores as unknown as { promediosPorAsignatura?: Record<string, number> })?.promediosPorAsignatura,
        });
        return {
          fortalezas: res.fortalezas || prev.fortalezas || '',
          oportunidades: res.oportunidades || prev.oportunidades || '',
          debilidades: res.debilidades || prev.debilidades || '',
          amenazas: res.amenazas || prev.amenazas || '',
        };
      });
    }
  }, [activeStep, schoolName, schoolCct, municipality, locality, totalStaff, indicadores, diagnosticoComunidad]);

  const [categoriasPriorizadas, setCategoriasPriorizadas] = useState<CategoriaPriorizada[]>(
    existingProject?.categorias_priorizadas || []
  );

  // Step 4: Generated content
  const [normativaData, setNormativaData] = useState<unknown>(
    existingProject?.normativa || null
  );
  const [diagnosticoGenerado, setDiagnosticoGenerado] = useState<DiagnosticoGenerado | null>(
    existingProject?.diagnostico_generado || null
  );
  const [planAccion, setPlanAccion] = useState<PlanAccion | null>(
    existingProject?.plan_accion || null
  );
  const [allowPartialGeneration, setAllowPartialGeneration] = useState(true);
  const [metasPreviasReferencia, setMetasPreviasReferencia] = useState<Array<{
    categoria?: string;
    tema?: string;
    meta?: string;
    texto_original?: string;
    linea_base?: string;
    estrategia?: string;
    responsable?: string;
    entregable?: string;
    periodo?: string;
  }>>([]);

  // Zona Context Bridge (Fase 9)
  const [zonaData, setZonaData] = useState<SchoolZoneContextResponse | null>(null);
  const [showZonaModal, setShowZonaModal] = useState(false);
  const [loadingZona, setLoadingZona] = useState(false);
  const [zonaFeedback, setZonaFeedback] = useState<string | null>(null);

  // Quality Coverage Warning Modal (C10 / D6)
  const [showCoverageModal, setShowCoverageModal] = useState(false);
  const [coverageWarningDismissed, setCoverageWarningDismissed] = useState(false);
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState<string | null>(null);

  // Carga Inteligente de PMC Anterior (PDF/Word)
  const fileInputPmcRef = useRef<HTMLInputElement>(null);
  const [uploadingPmc, setUploadingPmc] = useState(false);
  const [parsedPmcData, setParsedPmcData] = useState<PmcPreviousExtractDTO | null>(null);
  const [editableElementosPlan, setEditableElementosPlan] = useState<EditablePlanElement[]>([]);
  const [ingestWarnings, setIngestWarnings] = useState<string[]>([]);
  // H-240 / H-250: F11-specific warnings persist inside indicadores_academicos to survive F5
  const [f11Warnings, setF11Warnings] = useState<string[]>(
    ((existingProject?.indicadores_academicos as unknown as { f11_warnings?: string[] } | undefined)?.f11_warnings) || []
  );
  const [ingestCoverage, setIngestCoverage] = useState<IngestCoverageData | null>(
    // H-238: ingest_coverage persists inside indicadores_academicos (no DB migration needed)
    ((existingProject?.indicadores_academicos as unknown as { ingest_coverage?: IngestCoverageData } | undefined)?.ingest_coverage) || null
  );
  const [showPmcReviewModal, setShowPmcReviewModal] = useState(false);

  // Carga Inteligente de PAEC Anterior (PDF/Word) en Paso 1 (H-155)
  const fileInputPaecRef = useRef<HTMLInputElement>(null);
  const [uploadingPaec, setUploadingPaec] = useState(false);

  // F11 y Estadística 911 uploads con diferenciación de momentos
  const fileInputF11Ref = useRef<HTMLInputElement>(null);
  const fileInput911Ref = useRef<HTMLInputElement>(null);
  const uploadMomentoRef = useRef<'inicio_anterior' | 'fin_anterior' | 'inicio_actual'>('fin_anterior');
  const [activeMomento911, setActiveMomento911] = useState<'inicio_anterior' | 'fin_anterior' | 'inicio_actual' | null>(null);
  const [uploadingF11, setUploadingF11] = useState(false);
  const [uploading911, setUploading911] = useState(false);
  const [docsStatus, setDocsStatus] = useState<{
    f11?: boolean;
    pmcAnt?: boolean;
    paecAnt?: boolean;
    n911FinAnt?: boolean;
    n911IniAnt?: boolean;
    n911IniAct?: boolean;
  }>({});

  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const pmcLocalDraft = {
    schoolName,
    schoolCct,
    municipality,
    locality,
    schoolZone,
    directorName,
    supervisorName,
    cicloEscolar,
    subsystem,
    totalStaff,
    staffData,
    diagnosticoComunidad,
    indicadores,
    foda,
    categoriasPriorizadas,
  };
  const { clearDraft: clearPmcLocalDraft } = useLocalDraft('pmc-nuevo', pmcLocalDraft, {
    enabled: !existingProject && !projectId,
    onRestore: (draft) => {
      setSchoolName((prev) => prev || draft.schoolName || '');
      setSchoolCct((prev) => prev || draft.schoolCct || '');
      setMunicipality((prev) => prev || draft.municipality || '');
      setLocality((prev) => prev || draft.locality || '');
      setSchoolZone((prev) => prev || draft.schoolZone || '');
      setDirectorName((prev) => prev || draft.directorName || '');
      setSupervisorName((prev) => prev || draft.supervisorName || '');
      setCicloEscolar((prev) => prev || draft.cicloEscolar || '');
      setSubsystem((prev) => prev || draft.subsystem || '');
      setTotalStaff((prev) => (prev > 1 ? prev : draft.totalStaff || prev));
      setStaffData((prev) =>
        prev.length > 1 || !draft.staffData?.length ? prev : draft.staffData
      );
      setDiagnosticoComunidad((prev) => prev || draft.diagnosticoComunidad || '');
      setIndicadores((prev) => (Object.keys(prev).length > 0 ? prev : draft.indicadores));
      setFoda((prev) =>
        prev.fortalezas || prev.oportunidades || prev.debilidades || prev.amenazas
          ? prev
          : draft.foda
      );
      setCategoriasPriorizadas((prev) =>
        prev.length > 0 || !draft.categoriasPriorizadas?.length ? prev : draft.categoriasPriorizadas
      );
      setSuccessBanner('Borrador local recuperado. Recuperamos los avances que ya habías capturado en el PMC.');
    },
  });


  return {
    locale,
    teacherSchool,
    teacherMunicipality,
    existingProject,
    router,
    projectId,
    setProjectId,
    activeStep,
    setActiveStep,
    saving,
    setSaving,
    generating,
    setGenerating,
    error,
    setError,
    editingMeta,
    setEditingMeta,
    editingPersonal,
    setEditingPersonal,
    step5Tab,
    setStep5Tab,
    showPaso4Complementarias,
    setShowPaso4Complementarias,
    schoolName,
    setSchoolName,
    schoolCct,
    setSchoolCct,
    municipality,
    setMunicipality,
    locality,
    setLocality,
    schoolZone,
    setSchoolZone,
    directorName,
    setDirectorName,
    directorSource,
    setDirectorSource,
    directorMismatchWarning,
    setDirectorMismatchWarning,
    alternativeDirector,
    setAlternativeDirector,
    isPlatformPmcDoc,
    setIsPlatformPmcDoc,
    supervisorName,
    setSupervisorName,
    cicloEscolar,
    setCicloEscolar,
    subsystem,
    setSubsystem,
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
    metasMateriasConfirmadas,
    setMetasMateriasConfirmadas,
    setDetallesDocumento,
    foda,
    setFoda,
    categoriasPriorizadas,
    setCategoriasPriorizadas,
    normativaData,
    setNormativaData,
    diagnosticoGenerado,
    setDiagnosticoGenerado,
    planAccion,
    setPlanAccion,
    allowPartialGeneration,
    setAllowPartialGeneration,
    metasPreviasReferencia,
    setMetasPreviasReferencia,
    zonaData,
    setZonaData,
    showZonaModal,
    setShowZonaModal,
    loadingZona,
    setLoadingZona,
    zonaFeedback,
    setZonaFeedback,
    showCoverageModal,
    setShowCoverageModal,
    coverageWarningDismissed,
    setCoverageWarningDismissed,
    pendingDownloadUrl,
    setPendingDownloadUrl,
    fileInputPmcRef,
    uploadingPmc,
    setUploadingPmc,
    parsedPmcData,
    setParsedPmcData,
    editableElementosPlan,
    setEditableElementosPlan,
    ingestWarnings,
    setIngestWarnings,
    f11Warnings,
    setF11Warnings,
    ingestCoverage,
    setIngestCoverage,
    showPmcReviewModal,
    setShowPmcReviewModal,
    fileInputPaecRef,
    uploadingPaec,
    setUploadingPaec,
    fileInputF11Ref,
    fileInput911Ref,
    uploadMomentoRef,
    activeMomento911,
    setActiveMomento911,
    uploadingF11,
    setUploadingF11,
    uploading911,
    setUploading911,
    docsStatus,
    setDocsStatus,
    successBanner,
    setSuccessBanner,
    clearPmcLocalDraft,
  };
}

export type PmcWizardState = ReturnType<typeof usePmcWizardState>;
