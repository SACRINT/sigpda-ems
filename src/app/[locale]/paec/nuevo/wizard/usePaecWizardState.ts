'use client';

import type React from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type {
  PaecProject,
  CommunityContext,
  SchoolContext,
  SchoolType,
  GroupTrackConfig,
} from '@/types/paec';
import {
  consolidarUacsUnicasPlantel,
  FORMACIONES_LABORALES,
  obtenerFundamentalesPorSemestres,
  obtenerFfeSemestre6,
  areGroupTrackConfigsEqual,
  deriveSelectedLaboralUacs,
  deriveSelectedFfeUacs,
} from '@/lib/escuela-grupos';
import { ALL_STEPS } from '@/lib/paec-steps';
import { UACS_LABORALES_OFICIALES_BGE } from '@/lib/capacitaciones-data';
import { loadCarrerasTecnicas, type BTCarrera } from '@/lib/bt-carreras-catalog';
import type { SchoolZoneContextResponse } from '@/lib/zone-sync-service';
import { useLocalDraft } from '@/hooks/useLocalDraft';
import { useAssistant } from '@/components/assistant';
import {
  type PaecPreviousExtractDTO,
  mapParsedCommunityToState,
  getMissingStep1Fields,
  sanitizeSchoolUpdates,
} from '@/lib/prompts/paec-extraction';
import {
  readPaecDraft,
  getCachedPaecStep,
  CAPACITACION_TITLES,
  FFE_PAIRS,
  type PaecFormDraft,
  type Props,
  type AcademicBaseline,
} from './helpers';

export function usePaecWizardState({ locale, initialId }: Props) {
  const router = useRouter();

  // Restore draft from localStorage once on mount if this is a fresh wizard (no project ID in URL)
  const [savedDraft] = useState<PaecFormDraft | null>(() => (!initialId ? readPaecDraft() : null));

  // Navigation / Loading States
  const [projectId, setProjectId] = useState<string | null>(initialId);
  const [project, setProject] = useState<PaecProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'timeout' | 'json' | 'rate_limit' | 'network' | 'unknown' | null>(null);
  const [retryCount, setRetryCount] = useState<Record<number, number>>({});
  const [needsInputWarning, setNeedsInputWarning] = useState<{
    step: number;
    missingFields: string[];
    message: string;
  } | null>(null);

  // Form States (Paso 1: Datos Base) — initialized from saved draft if present
  const [projectName, setProjectName] = useState(savedDraft?.projectName ?? '');
  const [problemStatement, setProblemStatement] = useState(savedDraft?.problemStatement ?? '');
  const [showFullProblem, setShowFullProblem] = useState(false);
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

  const [academicBaseline, setAcademicBaseline] = useState<AcademicBaseline | null>(null);

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
        enrollment: prev.enrollment || (typeof plantel.matricula === 'number' && Number.isFinite(plantel.matricula) && plantel.matricula >= 0 ? `${plantel.matricula} estudiantes (Registrado en 911/F11)` : prev.enrollment),
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

    // Extender el estado con academicBaseline opcional (sin ?? 0, conserva undefined, acepta >= 0 como dato legítimo)
    const safeNum = (v: unknown): number | undefined => {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
      if (typeof v === 'string' && v.trim() !== '') {
        const parsed = Number(v);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
      }
      return undefined;
    };

    const baseline: AcademicBaseline = {
      abandono: safeNum(plantel?.abandono),
      eficienciaTerminal: safeNum(plantel?.eficienciaTerminal),
      aprobacion: safeNum((plantel as unknown as Record<string, unknown>)?.aprobacion),
      reprobacion: safeNum(plantel?.reprobacion),
      rezago: safeNum((plantel as unknown as Record<string, unknown>)?.rezago),
      promAbandonoZona: safeNum(zona.averages?.promAbandono),
      promEficienciaZona: safeNum(zona.averages?.promEficiencia),
      problematicasComunesZona: zona.problematicasComunes && zona.problematicasComunes.length > 0 ? zona.problematicasComunes : undefined,
    };
    setAcademicBaseline(baseline);

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
  const [selectedLaboralCustom, setSelectedLaboralCustom] = useState<string[]>(savedDraft?.selectedLaboralCustom ?? []);
  const [selectedFfeCustom, setSelectedFfeCustom] = useState<string[]>(savedDraft?.selectedFfeCustom ?? []);
  const [groupsCount, setGroupsCount] = useState(savedDraft?.groupsCount ?? '1');
  const [groupsConfig, setGroupsConfig] = useState(savedDraft?.groupsConfig ?? '');
  const [schoolType, setSchoolType] = useState<SchoolType>(savedDraft?.schoolType ?? 'general');
  const [selectedBtCarreras, setSelectedBtCarreras] = useState<string[]>(savedDraft?.selectedBtCarreras ?? []);
  const [semestersConfig, setSemestersConfig] = useState<Record<number, number>>(
    savedDraft?.semestersConfig ?? { 1: 1, 3: 1, 5: 1 }
  );
  const [rawGroupAssignments, setGroupAssignments] = useState<GroupTrackConfig[]>(
    savedDraft?.groupAssignments ?? []
  );

  // H-04: Acoplar automáticamente continuidad de 3° a 4° y de 5° a 6° (Single Source of Truth)
  // Excepción Semestre B: Si cycleType === 'B', 3° y 5° no están cursando; 4° y 6° operan de forma autónoma.
  const groupAssignments = useMemo(() => {
    if (cycleType === 'B') {
      return rawGroupAssignments;
    }

    const sem3Groups = rawGroupAssignments.filter(g => g.semester === 3);
    const sem5Groups = rawGroupAssignments.filter(g => g.semester === 5);

    return rawGroupAssignments.map(g => {
      // 4° hereda Formación Laboral de 3° (mismo grupo, ej. 4° A de 3° A)
      if (g.semester === 4) {
        const letter = g.groupName.split(' ')[1] || g.groupId.split('-')[1];
        const match3 = sem3Groups.find(s3 => (s3.groupId === `3-${letter}` || s3.groupName.endsWith(letter)));
        if (match3) {
          return {
            ...g,
            trackId: match3.trackId || g.trackId,
            trackName: match3.trackName || g.trackName,
          };
        }
        return g;
      }

      // 6° hereda Formación Laboral y Continuidad FFE de 5° (mismo grupo, ej. 6° A de 5° A)
      if (g.semester === 6) {
        const letter = g.groupName.split(' ')[1] || g.groupId.split('-')[1];
        const match5 = sem5Groups.find(s5 => (s5.groupId === `5-${letter}` || s5.groupName.endsWith(letter)));
        if (!match5) return g;

        const expectedFfe = (match5.ffeSelections || []).map(s => obtenerFfeSemestre6(s));
        return {
          ...g,
          trackId: match5.trackId || g.trackId,
          trackName: match5.trackName || g.trackName,
          ffeSelections: expectedFfe,
        };
      }

      return g;
    });
  }, [rawGroupAssignments, cycleType]);

  // H-02: Helper para identificar capacitación oficial desde nombre de UAC o track
  const findTrackForUacOrTrackName = useCallback((item: string): string | null => {
    if (FORMACIONES_LABORALES.includes(item as (typeof FORMACIONES_LABORALES)[number]) || Object.prototype.hasOwnProperty.call(CAPACITACION_TITLES, item)) {
      return item;
    }
    for (const [track, semObj] of Object.entries(UACS_LABORALES_OFICIALES_BGE)) {
      for (const uacs of Object.values(semObj)) {
        if (uacs.some(u => u.toLowerCase() === item.toLowerCase())) {
          return track;
        }
      }
    }
    return null;
  }, []);

  // H-02: Derivar capacitaciones asignadas en grupos (Single Source of Truth)
  const assignedLaboralTracks = useMemo(() => {
    const tracks = new Set<string>();
    for (const g of groupAssignments) {
      if (g.trackName && g.trackName.trim()) {
        const name = g.trackName.trim();
        if (FORMACIONES_LABORALES.includes(name as (typeof FORMACIONES_LABORALES)[number]) || Object.prototype.hasOwnProperty.call(CAPACITACION_TITLES, name)) {
          tracks.add(name);
        }
      }
    }
    return Array.from(tracks);
  }, [groupAssignments]);

  // Todas las UACs laborales asociadas a las capacitaciones asignadas
  const allAssignedLaboralUacs = useMemo(() => {
    const uacs: string[] = [];
    for (const track of assignedLaboralTracks) {
      const semMap = UACS_LABORALES_OFICIALES_BGE[track];
      if (semMap) {
        for (const semUacs of Object.values(semMap)) {
          for (const u of semUacs) {
            if (!uacs.includes(u)) {
              uacs.push(u);
            }
          }
        }
      }
    }
    return uacs;
  }, [assignedLaboralTracks]);

  // UACs laborales seleccionadas para este proyecto PAEC específico (Soporte Multi-PAEC)
  const selectedLaboral = useMemo(() => {
    return deriveSelectedLaboralUacs(allAssignedLaboralUacs, selectedLaboralCustom);
  }, [allAssignedLaboralUacs, selectedLaboralCustom]);

  // Todas las UACs FFE derivadas de las selecciones de grupos
  const allAssignedFfeUacs = useMemo(() => {
    const set = new Set<string>();
    for (const g of groupAssignments) {
      if (Array.isArray(g.ffeSelections)) {
        for (const subj of g.ffeSelections) {
          if (subj && subj.trim()) {
            set.add(subj.trim());
            const cont = obtenerFfeSemestre6(subj.trim());
            if (cont && cont !== 'Optativa FFE II') {
              set.add(cont);
            }
          }
        }
      }
    }
    return Array.from(set);
  }, [groupAssignments]);

  // UACs FFE seleccionadas para este proyecto PAEC específico (Soporte Multi-PAEC)
  const selectedFfe = useMemo(() => {
    return deriveSelectedFfeUacs(allAssignedFfeUacs, selectedFfeCustom);
  }, [allAssignedFfeUacs, selectedFfeCustom]);

  const [expandedGroupFfe, setExpandedGroupFfe] = useState<Record<string, boolean>>({});
  const [showFundamentalCustomizer, setShowFundamentalCustomizer] = useState<boolean>(true);
  const [carrerasBT, setCarrerasBT] = useState<BTCarrera[]>([]);

  const availableFundamentalUacs = useMemo(() => {
    const sems = cycleType === 'A' ? [1, 3, 5] : cycleType === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6];
    return obtenerFundamentalesPorSemestres(sems);
  }, [cycleType]);

  // Carga inteligente de PAEC anterior (PDF/Word)
  const fileInputPaecRef = useRef<HTMLInputElement>(null);
  const [uploadingPaec, setUploadingPaec] = useState(false);
  const [parsedPaecData, setParsedPaecData] = useState<PaecPreviousExtractDTO | null>(null);
  const [showPaecReviewModal, setShowPaecReviewModal] = useState(false);
  const [paecSuccessBanner, setPaecSuccessBanner] = useState<string | null>(null);
  const [paecWarnings, setPaecWarnings] = useState<string[]>([]);

  const paecLocalDraft = {
    projectName,
    problemStatement,
    cycleType,
    community,
    school,
    selectedFundamental,
    selectedLaboralCustom,
    selectedFfeCustom,
    groupsCount,
    groupsConfig,
    schoolType,
    selectedBtCarreras,
    semestersConfig,
    groupAssignments,
  };
  const { clearDraft: clearPaecLocalDraft } = useLocalDraft('paec-nuevo', paecLocalDraft, {
    enabled: !initialId && !projectId,
    onRestore: (draft) => {
      setProjectName((prev) => prev || draft.projectName || '');
      setProblemStatement((prev) => prev || draft.problemStatement || '');
      setCycleType((prev) => (draft.cycleType ? draft.cycleType : prev));
      setCommunity((prev) =>
        Object.values(prev).some(Boolean) ? prev : draft.community
      );
      setSchool((prev) => (Object.values(prev).some(Boolean) ? prev : draft.school));
      setSelectedFundamental((prev) => (prev.length ? prev : draft.selectedFundamental));
      setSelectedLaboralCustom((prev) => (prev.length ? prev : draft.selectedLaboralCustom));
      setSelectedFfeCustom((prev) => (prev.length ? prev : draft.selectedFfeCustom));
      setGroupsCount((prev) => prev || draft.groupsCount || '1');
      setGroupsConfig((prev) => prev || draft.groupsConfig || '');
      setSchoolType((prev) => (draft.schoolType ? draft.schoolType : prev));
      setSelectedBtCarreras((prev) => (prev.length ? prev : draft.selectedBtCarreras));
      setSemestersConfig((prev) =>
        Object.keys(prev).length ? prev : draft.semestersConfig
      );
      setGroupAssignments((prev) => (prev.length ? prev : draft.groupAssignments));
      setPaecSuccessBanner('Borrador local recuperado. Recuperamos los avances que ya habías capturado en el PAEC.');
    },
  });

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
      if (Array.isArray(json.warnings) && json.warnings.length > 0) {
        setPaecWarnings(json.warnings);
      } else {
        setPaecWarnings([]);
      }
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
    if (parsedPaecData.schoolType === 'general' || parsedPaecData.schoolType === 'tecnico' || parsedPaecData.schoolType === 'telebachillerato') {
      setSchoolType(parsedPaecData.schoolType);
    }

    let nextSchool = school;
    if (parsedPaecData.school) {
      const cleanSchoolUpdates = sanitizeSchoolUpdates(parsedPaecData.school);
      nextSchool = {
        ...school,
        ...cleanSchoolUpdates,
      };
      setSchool(nextSchool);
    }

    let nextCommunity = community;
    if (parsedPaecData.community) {
      nextCommunity = mapParsedCommunityToState(parsedPaecData.community, community);
      setCommunity(nextCommunity);
    }

    let nextGroups = [...groupAssignments];

    if (Array.isArray(parsedPaecData.selectedLaboral) && parsedPaecData.selectedLaboral.length > 0) {
      const detectedTracks = new Set<string>();
      for (const item of parsedPaecData.selectedLaboral) {
        const found = findTrackForUacOrTrackName(item);
        if (found) detectedTracks.add(found);
      }
      if (detectedTracks.size > 0) {
        const primaryTrack = Array.from(detectedTracks)[0];
        nextGroups = nextGroups.map(g =>
          (g.semester === 3 || g.semester === 4) && !g.trackName ? { ...g, trackId: primaryTrack, trackName: primaryTrack } : g
        );
      }
    }

    if (Array.isArray(parsedPaecData.selectedFfe) && parsedPaecData.selectedFfe.length > 0) {
      const ffeList = parsedPaecData.selectedFfe;
      nextGroups = nextGroups.map(g => {
        if ((g.semester === 5 || g.semester === 6) && (!g.ffeSelections || g.ffeSelections.length === 0)) {
          const relevant = g.semester === 6
            ? ffeList.filter(s => FFE_PAIRS.some(p => p.name6 === s))
            : ffeList.filter(s => FFE_PAIRS.some(p => p.name5 === s));
          return {
            ...g,
            ffeSelections: relevant.length > 0 ? relevant : ffeList.slice(0, 4),
          };
        }
        return g;
      });
    }

    setGroupAssignments(nextGroups);
    setShowPaecReviewModal(false);

    // Derivar dinámicamente de nextGroups el conteo real de UACs laborales y FFE (F-R3-08)
    const derivedLaboralUacs = new Set<string>();
    for (const g of nextGroups) {
      if ((g.semester === 3 || g.semester === 4 || g.semester === 5 || g.semester === 6) && g.trackName) {
        const uacs = UACS_LABORALES_OFICIALES_BGE[g.trackName]?.[g.semester] || [];
        for (const u of uacs) derivedLaboralUacs.add(u);
      }
    }
    const derivedFfeUacs = new Set<string>();
    for (const g of nextGroups) {
      if (g.semester === 5 || g.semester === 6) {
        if (Array.isArray(g.ffeSelections)) {
          for (const u of g.ffeSelections) derivedFfeUacs.add(u);
        }
      }
    }

    const effectiveIsTecnico = (parsedPaecData.schoolType || schoolType) === 'tecnico';
    const effectiveLaboralCount = derivedLaboralUacs.size;
    const effectiveFfeCount = derivedFfeUacs.size;
    const semsInCycleLocal = cycleType === 'A' ? [1, 3, 5] : cycleType === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6];
    const hasLaboralSemesters = schoolType !== 'tecnico' && semsInCycleLocal.some(s => s >= 3 && (semestersConfig[s] ?? 0) > 0);
    const hasFfeSemesters = schoolType !== 'tecnico' && semsInCycleLocal.some(s => s >= 5 && (semestersConfig[s] ?? 0) > 0);

    const missing = getMissingStep1Fields({
      projectName: parsedPaecData.projectName || projectName,
      problemStatement: parsedPaecData.problemStatement || problemStatement,
      community: nextCommunity,
      school: nextSchool,
      curricular: {
        hasLaboralSemesters,
        selectedLaboralCount: effectiveLaboralCount,
        hasFfeSemesters,
        selectedFfeCount: effectiveFfeCount,
        isTecnico: effectiveIsTecnico,
        selectedBtCarrerasCount: selectedBtCarreras.length,
      },
    });

    if (missing.length > 0) {
      setPaecSuccessBanner(
        `✓ Datos del PAEC anterior extraídos y aplicados. Por favor completa los campos obligatorios pendientes (*): ${missing.join(', ')}.`
      );
    } else {
      setPaecSuccessBanner('✓ Datos del PAEC anterior extraídos y aplicados exitosamente. Todos los campos obligatorios del Paso 1 están completos.');
    }
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
        let fallbackTrack = '';
        if (savedDraft?.selectedLaboral && savedDraft.selectedLaboral.length > 0) {
          for (const item of savedDraft.selectedLaboral) {
            const t = findTrackForUacOrTrackName(item);
            if (t) { fallbackTrack = t; break; }
          }
        }

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
              const defaultTrack = (sem === 3 || sem === 4) ? fallbackTrack : '';
              const fallbackFfe = (sem === 5 || sem === 6) && savedDraft?.selectedFfe && savedDraft.selectedFfe.length > 0
                ? (sem === 6
                    ? savedDraft.selectedFfe.filter(s => FFE_PAIRS.some(p => p.name6 === s))
                    : savedDraft.selectedFfe.filter(s => FFE_PAIRS.some(p => p.name5 === s))
                  ).slice(0, 4)
                : [];
              updated.push({
                groupId: gId,
                groupName: gName,
                semester: sem,
                trackId: (sem === 3 || sem === 4) ? defaultTrack : '',
                trackName: (sem === 3 || sem === 4) ? defaultTrack : '',
                ffeSelections: fallbackFfe,
              });
            }
          }
        }

        // Guard F-A01/F-A08: si no hay cambios estructurales, mantener la referencia previa para evitar render loops
        if (areGroupTrackConfigsEqual(prev, updated)) {
          return prev;
        }

        return updated;
      });
    });
  }, [cycleType, semestersConfig, findTrackForUacOrTrackName, savedDraft]);

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


  return {
    locale,
    initialId,
    router,
    savedDraft,
    projectId,
    setProjectId,
    project,
    setProject,
    loading,
    setLoading,
    generating,
    setGenerating,
    activeStep,
    setActiveStep,
    error,
    setError,
    errorType,
    setErrorType,
    retryCount,
    setRetryCount,
    needsInputWarning,
    setNeedsInputWarning,
    projectName,
    setProjectName,
    problemStatement,
    setProblemStatement,
    showFullProblem,
    setShowFullProblem,
    cycleType,
    setCycleType,
    community,
    setCommunity,
    school,
    setSchool,
    academicBaseline,
    setAcademicBaseline,
    setDetallesDocumento,
    cctSearching,
    setCctSearching,
    cctWarning,
    setCctWarning,
    zonaData,
    setZonaData,
    showZonaModal,
    setShowZonaModal,
    loadingZona,
    setLoadingZona,
    zonaFeedback,
    setZonaFeedback,
    handleConsultarZona,
    handleAplicarSugerenciasZona,
    handleCctLookup,
    laboralCatalog,
    setLaboralCatalog,
    setFfeCatalog,
    selectedFundamental,
    setSelectedFundamental,
    selectedLaboralCustom,
    setSelectedLaboralCustom,
    selectedFfeCustom,
    setSelectedFfeCustom,
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
    rawGroupAssignments,
    setGroupAssignments,
    groupAssignments,
    findTrackForUacOrTrackName,
    assignedLaboralTracks,
    allAssignedLaboralUacs,
    selectedLaboral,
    allAssignedFfeUacs,
    selectedFfe,
    expandedGroupFfe,
    setExpandedGroupFfe,
    showFundamentalCustomizer,
    setShowFundamentalCustomizer,
    carrerasBT,
    setCarrerasBT,
    availableFundamentalUacs,
    fileInputPaecRef,
    uploadingPaec,
    setUploadingPaec,
    parsedPaecData,
    setParsedPaecData,
    showPaecReviewModal,
    setShowPaecReviewModal,
    paecSuccessBanner,
    setPaecSuccessBanner,
    paecWarnings,
    setPaecWarnings,
    clearPaecLocalDraft,
    handleUploadPreviousPaec,
    handleApplyParsedPaec,
    uniqueUacsList,
  };
}

export type PaecWizardState = ReturnType<typeof usePaecWizardState>;
