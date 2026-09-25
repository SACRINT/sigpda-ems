'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SchoolZoneContextResponse } from '@/lib/zone-sync-service';
import { useAssistant } from '@/components/assistant';
import {
  PMC_CATEGORIAS_OFICIALES,
  normalizePmcCategoria,
} from '@/lib/constants/pmc-categorias';
import { toRealNumber } from '@/lib/numeric-guard';
import { computeCoverage } from '@/lib/coverage-core';
import { reconcilePmcStaff } from '@/lib/pmc/staff-reconciler';


const PMC_DRAFT_KEY = 'didactica_pmc_draft';

interface PmcFormDraft {
  schoolName: string;
  schoolCct: string;
  municipality: string;
  locality: string;
  schoolZone: string;
  directorName: string;
  supervisorName: string;
  cicloEscolar: string;
  subsystem: string;
}

function readPmcDraft(): PmcFormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PMC_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePmcDraft(draft: PmcFormDraft) {
  try { window.localStorage.setItem(PMC_DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
}

function clearPmcDraft() {
  try { window.localStorage.removeItem(PMC_DRAFT_KEY); } catch { /* ignore */ }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface MetaIndividual {
  categoria: string;
  tema: string;
  meta: string;
  estrategia: string;
  entregable: string;
  periodo: string;
}

interface StaffMember {
  nombre: string;
  cargo: string;
  meta_individual?: string;
  metas_individuales?: MetaIndividual[];
  asignaturas?: string;
  grupos?: string;
}

interface IndicadoresAcademicos {
  matricula?: number;
  matricula_meta?: number;
  promedio_f11?: number;
  promedio_meta?: number;
  aprobacion_ant?: number;
  aprobacion_meta?: number;
  reprobacion_ant?: number;
  reprobacion_meta?: number;
  abandono_ant?: number;
  abandono_meta?: number;
  et_ant?: number;
  et_meta?: number;
}

interface Foda {
  fortalezas: string;
  oportunidades: string;
  debilidades: string;
  amenazas: string;
}

interface MetaInstitucional {
  categoria: string;
  nombre_categoria: string;
  tema: string;
  meta: string;
  estrategia: string;
  linea_base: string;
  personal_designado: string;
  entregable: string;
  periodo_inicio: string;
  periodo_fin: string;
  diagnostico_meta: string;
}

interface MetaPersonal {
  nombre: string;
  cargo: string;
  meta_individual: string;
  estrategia: string;
  entregable: string;
  periodo: string;
}

interface PlanAccion {
  metas_institucionales: MetaInstitucional[];
  metas_personales: MetaPersonal[];
}

interface DiagnosticoGenerado {
  presentacion: string;
  contexto: string;
  analisis_indicadores: string;
  sintesis_foda: string;
  priorizacion: string;
}

interface PmcProject {
  id?: string;
  school_name?: string;
  school_cct?: string;
  municipality?: string;
  locality?: string;
  school_zone?: string;
  director_name?: string;
  supervisor_name?: string;
  ciclo_escolar?: string;
  subsystem?: string;
  total_staff?: number;
  staff_data?: StaffMember[];
  indicadores_academicos?: IndicadoresAcademicos;
  foda?: Foda;
  categorias_priorizadas?: CategoriaPriorizada[];
  diagnostico_comunidad?: string;
  normativa?: Record<string, string>;
  diagnostico_generado?: DiagnosticoGenerado;
  plan_accion?: PlanAccion;
  current_step?: number;
  status?: string;
}

interface Props {
  locale: string;
  teacherId: string;
  teacherName: string;
  teacherSchool?: string;
  teacherMunicipality?: string;
  existingProject: PmcProject | null;
}

async function parseSafeApiResponse<T = { success?: boolean; error?: string; data?: unknown }>(
  res: Response,
  defaultErrorMsg: string
): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.status === 504) {
      throw new Error('El servidor tardó más de 120 segundos en procesar el documento (tiempo límite excedido). Por favor, intenta de nuevo o sube un documento con menos páginas.');
    }
    if (res.status === 503) {
      throw new Error('El servicio de IA está temporalmente saturado en upstream. Por favor espera un momento y vuelve a intentar.');
    }
    const rawText = await res.text().catch(() => '');
    const cleanText = rawText.replace(/<[^>]*>?/gm, '').trim();
    throw new Error(cleanText.slice(0, 160) || defaultErrorMsg);
  }

  const json = await res.json();
  return json as T;
}

// ── Constants ────────────────────────────────────────────────────────────────

interface CategoriaPriorizada {
  id: string;
  nombre: string;
  temas: string[];
}

const CATEGORIAS_OFICIALES = [
  {
    id: '1',
    nombre: 'Categoría 1: Desarrollo académico y aprendizaje',
    color: '#1a4a7a',
    temas: [...PMC_CATEGORIAS_OFICIALES[0].temas],
  },
  {
    id: '2',
    nombre: 'Categoría 2: Gestión y administración escolar',
    color: '#2d6a2d',
    temas: [...PMC_CATEGORIAS_OFICIALES[1].temas],
  },
  {
    id: '3',
    nombre: 'Categoría 3: Desarrollo socioemocional y prevención de la violencia en la escuela',
    color: '#7a1a1a',
    temas: [...PMC_CATEGORIAS_OFICIALES[2].temas],
  },
];

const CARGOS_COMUNES = [
  'Director(a)',
  'Subdirector(a)',
  'Docente',
  'Docente y tutor de grupo',
  'Docente y tutor del plantel',
  'Docente de tiempo completo',
  'Docente por horas',
  'Orientador(a) educativo(a)',
  'Secretario(a) académico(a)',
  'Auxiliar administrativo(a)',
  'Prefecto(a)',
  'Trabajador(a) social',
  'Personal de intendencia',
  'Personal de apoyo / mantenimiento',
  'Otro',
];

const SUBSISTEMAS = ['BGE', 'Bachillerato Tecnológico', 'TBC', 'CBTA', 'CECyTE', 'COBACH', 'Preparatoria federal', 'Otro'];

const STEPS = [
  { n: 1, label: 'Datos institucionales' },
  { n: 2, label: 'Personal' },
  { n: 3, label: 'Diagnóstico' },
  { n: 4, label: 'Generación IA' },
  { n: 5, label: 'Revisión y exportar' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function PmcWizardClient({ locale, teacherSchool, teacherMunicipality, existingProject }: Props) {
  const router = useRouter();

  // Restore draft from localStorage if this is a fresh PMC wizard (no existing project)
  const savedDraft = !existingProject ? readPmcDraft() : null;

  // Initialize state from existing project or from saved localStorage draft or defaults
  const [projectId, setProjectId] = useState<string | null>(existingProject?.id || null);
  const [activeStep, setActiveStep] = useState<number>(existingProject?.current_step || 1);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<number | null>(null);
  const [editingPersonal, setEditingPersonal] = useState<number | null>(null);

  // Step 1: Institutional data — restored from draft if no existing project in DB
  const [schoolName, setSchoolName] = useState(existingProject?.school_name || savedDraft?.schoolName || teacherSchool || '');
  const [schoolCct, setSchoolCct] = useState(existingProject?.school_cct || savedDraft?.schoolCct || '');
  const [municipality, setMunicipality] = useState(existingProject?.municipality || savedDraft?.municipality || teacherMunicipality || '');
  const [locality, setLocality] = useState(existingProject?.locality || savedDraft?.locality || '');
  const [schoolZone, setSchoolZone] = useState(existingProject?.school_zone || savedDraft?.schoolZone || '');
  const [directorName, setDirectorName] = useState(existingProject?.director_name || savedDraft?.directorName || '');
  const [supervisorName, setSupervisorName] = useState(existingProject?.supervisor_name || savedDraft?.supervisorName || '');
  const [cicloEscolar, setCicloEscolar] = useState(existingProject?.ciclo_escolar || savedDraft?.cicloEscolar || '2025-2026');
  const [subsystem, setSubsystem] = useState(existingProject?.subsystem || savedDraft?.subsystem || 'BGE');

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
  const [categoriasPriorizadas, setCategoriasPriorizadas] = useState<CategoriaPriorizada[]>(
    existingProject?.categorias_priorizadas || []
  );

  // Step 4: Generated content
  const [diagnosticoGenerado, setDiagnosticoGenerado] = useState<DiagnosticoGenerado | null>(
    existingProject?.diagnostico_generado || null
  );
  const [planAccion, setPlanAccion] = useState<PlanAccion | null>(
    existingProject?.plan_accion || null
  );
  const [metasPreviasReferencia, setMetasPreviasReferencia] = useState<Array<{
    categoria?: string;
    tema?: string;
    meta?: string;
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

interface PmcPreviousExtractStaff {
  nombre: string;
  cargo: string;
  meta_individual?: string;
  metas_individuales?: MetaIndividual[];
  asignaturas?: string;
  grupos?: string;
  horas?: number | string;
}

interface F11ResponseDTO {
  schoolName?: string;
  schoolCct?: string;
  directorName?: string;
  totalAlumnos?: number;
  totalDocentes?: number;
  totalGrupos?: number;
  promedioGeneral?: number;
  aprobadosPorcentaje?: number;
  reprobadosPorcentaje?: number;
  promediosPorAsignatura?: Record<string, number>;
  docentes?: string[];
  docentesPorAsignatura?: Array<{
    asignatura?: string;
    docente?: string;
    grupos?: string;
    promedio?: number;
  }>;
  [key: string]: unknown;
}

interface Estadistica911ResponseDTO {
  schoolName?: string;
  schoolCct?: string;
  directorName?: string;
  supervisorName?: string;
  matricula?: number;
  abandonoPorcentaje?: number;
  eficienciaTerminal?: number;
  reprobacionPorcentaje?: number;
  aprobacionPorcentaje?: number;
  totalDocentes?: number;
  momento?: string;
  [key: string]: unknown;
}

interface PmcPreviousExtractDTO {
  schoolName?: string;
  schoolCct?: string;
  municipality?: string;
  locality?: string;
  schoolZone?: string;
  directorName?: string;
  supervisorName?: string;
  cicloEscolar?: string;
  subsystem?: string;
  totalStaff?: number | string;
  participantes?: Array<{
    nombre: string;
    cargo: string;
    firma?: string;
  }>;
  staffData?: PmcPreviousExtractStaff[];
  metas_institucionales_previas?: Array<{
    categoria?: string;
    tema?: string;
    meta?: string;
    linea_base?: string;
    estrategia?: string;
    responsable?: string;
    entregable?: string;
    periodo?: string;
  }>;
  categorias_priorizadas?: Array<{
    categoria?: string;
    temas?: string[];
  }>;
  indicadores?: {
    aprobacion_ant?: number | string;
    reprobacion_ant?: number | string;
    abandono_ant?: number | string;
    et_ant?: number | string;
    matriculaTotal?: number | string;
    abandonoEscolar?: number | string;
    eficienciaTerminal?: number | string;
    reprobacion?: number | string;
    [key: string]: unknown;
  };
  foda?: Record<string, unknown>;
  diagnosticoComunidad?: string;
  diagnosticoEscuela?: string;
  diagnosticoDesempeno?: string;
  objetivosPrioritarios?: string[];
  metasPrincipales?: string[];
  observacionesGenerales?: string;
}

interface PaecProjectForPmc {
  id: string;
  projectName: string;
  problemStatement?: string;
  cycleType?: string;
  communityContext?: {
    context?: string;
    barreras?: string[];
    recursos?: string[];
    necesidades?: string[];
    [key: string]: unknown;
  };
  schoolContext?: {
    cct?: string;
    nombre?: string;
    [key: string]: unknown;
  };
  fase1Diagnostico?: {
    resumen?: string;
    [key: string]: unknown;
  };
  createdAt?: string;
}

  // Carga Inteligente de PMC Anterior (PDF/Word)
  const fileInputPmcRef = useRef<HTMLInputElement>(null);
  const [uploadingPmc, setUploadingPmc] = useState(false);
  const [parsedPmcData, setParsedPmcData] = useState<PmcPreviousExtractDTO | null>(null);
  const [showPmcReviewModal, setShowPmcReviewModal] = useState(false);

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
    n911FinAnt?: boolean;
    n911IniAnt?: boolean;
    n911IniAct?: boolean;
  }>({});

  // Sinergia PAEC -> PMC (Importar diagnósticos)
  const [loadingPaecList, setLoadingPaecList] = useState(false);
  const [paecProjectsList, setPaecProjectsList] = useState<PaecProjectForPmc[]>([]);
  const [selectedPaecToImport, setSelectedPaecToImport] = useState<PaecProjectForPmc | null>(null);
  const [showPaecImportModal, setShowPaecImportModal] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const triggerUpload911 = (momento: 'inicio_anterior' | 'fin_anterior' | 'inicio_actual') => {
    uploadMomentoRef.current = momento;
    setActiveMomento911(momento);
    fileInput911Ref.current?.click();
  };

  const handleUploadPreviousPmc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPmc(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/pmc/parse-previous', {
        method: 'POST',
        body: formData,
      });
      const json = await parseSafeApiResponse<{ success?: boolean; error?: string; data?: PmcPreviousExtractDTO }>(
        res,
        'Error al analizar el documento anterior.'
      );
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al analizar el documento.');
      }
      setParsedPmcData(json.data as PmcPreviousExtractDTO);
      setShowPmcReviewModal(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'No se pudo procesar el documento anterior.';
      setError(errMsg);
    } finally {
      setUploadingPmc(false);
      if (fileInputPmcRef.current) fileInputPmcRef.current.value = '';
    }
  };

  const handleDirectorNameChange = (val: string) => {
    setDirectorName(val);
    setStaffData(prev => {
      if (prev.length === 0) {
        return [{ nombre: val, cargo: 'Director(a)', meta_individual: '', metas_individuales: [] }];
      }
      const dirIdx = prev.findIndex(s => s.cargo === 'Director(a)');
      if (dirIdx >= 0) {
        const copy = [...prev];
        copy[dirIdx] = { ...copy[dirIdx], nombre: val };
        return copy;
      }
      return [{ nombre: val, cargo: 'Director(a)', meta_individual: '', metas_individuales: [] }, ...prev];
    });
  };

  const handleApplyParsedPmc = () => {
    if (!parsedPmcData) return;
    if (parsedPmcData.schoolName) setSchoolName(parsedPmcData.schoolName);
    if (parsedPmcData.schoolCct) setSchoolCct(parsedPmcData.schoolCct);
    if (parsedPmcData.municipality) setMunicipality(parsedPmcData.municipality);
    if (parsedPmcData.locality) setLocality(parsedPmcData.locality);
    if (parsedPmcData.schoolZone) setSchoolZone(parsedPmcData.schoolZone);
    if (parsedPmcData.directorName) setDirectorName(parsedPmcData.directorName);
    if (parsedPmcData.supervisorName) setSupervisorName(parsedPmcData.supervisorName);
    if (parsedPmcData.cicloEscolar) setCicloEscolar(parsedPmcData.cicloEscolar);
    if (parsedPmcData.subsystem) setSubsystem(parsedPmcData.subsystem);

    const effDirector = parsedPmcData.directorName || directorName;
    const hasExtractedStaff = Array.isArray(parsedPmcData.staffData) && parsedPmcData.staffData.length > 0;
    const reconciled = reconcilePmcStaff({
      existingStaff: hasExtractedStaff ? [] : staffData,
      extractedStaff: parsedPmcData.staffData,
      participantes: parsedPmcData.participantes,
      directorName: effDirector,
      targetTotalStaff: parsedPmcData.totalStaff ? Number(parsedPmcData.totalStaff) : undefined,
      cicloEscolar: parsedPmcData.cicloEscolar || cicloEscolar,
    });
    setStaffData(reconciled.staff);
    setTotalStaff(reconciled.totalStaff);

    if (parsedPmcData.metas_institucionales_previas && parsedPmcData.metas_institucionales_previas.length > 0) {
      setMetasPreviasReferencia(parsedPmcData.metas_institucionales_previas);
    }

    // Auto-activar las categorías y temas priorizados a partir del PMC anterior
    const detectedCategoriesMap = new Map<string, Set<string>>();
    for (const cp of (parsedPmcData.categorias_priorizadas || [])) {
      if (cp?.categoria) {
        const catNorm = normalizePmcCategoria(cp.categoria);
        if (!detectedCategoriesMap.has(catNorm)) detectedCategoriesMap.set(catNorm, new Set());
        for (const t of (cp.temas || [])) {
          detectedCategoriesMap.get(catNorm)!.add(t);
        }
      }
    }
    for (const m of (parsedPmcData.metas_institucionales_previas || [])) {
      if (m?.categoria) {
        const catNorm = normalizePmcCategoria(m.categoria);
        if (!detectedCategoriesMap.has(catNorm)) detectedCategoriesMap.set(catNorm, new Set());
        if (m.tema) detectedCategoriesMap.get(catNorm)!.add(m.tema);
      }
    }

    if (detectedCategoriesMap.size > 0) {
      const newCategorias: CategoriaPriorizada[] = [];
      for (const catDef of CATEGORIAS_OFICIALES) {
        const catNorm = normalizePmcCategoria(catDef.nombre);
        if (detectedCategoriesMap.has(catNorm)) {
          const matchedTemas = Array.from(detectedCategoriesMap.get(catNorm)!);
          const validTemas = catDef.temas.filter((officialTema) =>
            matchedTemas.some(
              (mt) =>
                mt.toLowerCase().includes(officialTema.toLowerCase()) ||
                officialTema.toLowerCase().includes(mt.toLowerCase())
            )
          );
          newCategorias.push({
            id: catDef.id,
            nombre: catDef.nombre,
            temas: validTemas.length > 0 ? validTemas : [catDef.temas[0]],
          });
        }
      }
      if (newCategorias.length > 0) {
        setCategoriasPriorizadas(newCategorias);
      }
    }

    if (parsedPmcData.diagnosticoComunidad) {
      setDiagnosticoComunidad(parsedPmcData.diagnosticoComunidad);
    }

    if (parsedPmcData.indicadores) {
      const ind = parsedPmcData.indicadores;
      setIndicadores(prev => ({
        ...prev,
        matricula: toRealNumber(ind.matricula) ?? prev.matricula,
        matricula_meta: toRealNumber(ind.matricula_meta) ?? prev.matricula_meta,
        aprobacion_ant: toRealNumber(ind.aprobacion_ant) ?? prev.aprobacion_ant,
        aprobacion_meta: toRealNumber(ind.aprobacion_meta) ?? prev.aprobacion_meta,
        reprobacion_ant: toRealNumber(ind.reprobacion_ant) ?? prev.reprobacion_ant,
        reprobacion_meta: toRealNumber(ind.reprobacion_meta) ?? prev.reprobacion_meta,
        abandono_ant: toRealNumber(ind.abandono_ant) ?? prev.abandono_ant,
        abandono_meta: toRealNumber(ind.abandono_meta) ?? prev.abandono_meta,
        et_ant: toRealNumber(ind.et_ant) ?? prev.et_ant,
        et_meta: toRealNumber(ind.et_meta) ?? prev.et_meta,
        promedio_f11: toRealNumber(ind.promedio_f11) ?? prev.promedio_f11,
        promedio_meta: toRealNumber(ind.promedio_meta) ?? prev.promedio_meta,
      }));
    }

    if (parsedPmcData.foda) {
      setFoda(prev => ({
        ...prev,
        ...parsedPmcData.foda,
      }));
    }

    setShowPmcReviewModal(false);
    setDocsStatus(p => ({ ...p, pmcAnt: true }));
    setSuccessBanner('✓ Datos del PMC anterior cargados y pre-llenados exitosamente en todos los pasos.');
  };

  // ── F11 Upload Handler (Fin de Ciclo Anterior) ──────────────────────────────
  const handleUploadF11 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingF11(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/pmc/f11', { method: 'POST', body: formData });
      const json = await parseSafeApiResponse<{ success?: boolean; error?: string; data?: F11ResponseDTO }>(
        res,
        'Error al analizar el F11.'
      );
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al analizar el F11.');
      if (json.data?.schoolName && !schoolName) setSchoolName(json.data.schoolName);
      if (json.data?.schoolCct && !schoolCct) setSchoolCct(json.data.schoolCct);
      if (json.data?.directorName && !directorName) setDirectorName(json.data.directorName);

      if (json.data?.aprobadosPorcentaje !== undefined || json.data?.reprobadosPorcentaje !== undefined || json.data?.promedioGeneral !== undefined) {
        setIndicadores(p => {
          const rawAp = json.data?.aprobadosPorcentaje;
          const rawRep = json.data?.reprobadosPorcentaje;
          const aprobAnt = toRealNumber(rawAp) ?? p.aprobacion_ant;
          const reprobAnt = toRealNumber(rawRep) ?? p.reprobacion_ant;
          const aprobMeta = p.aprobacion_meta !== undefined
            ? p.aprobacion_meta
            : (aprobAnt !== undefined && !isNaN(aprobAnt)
                ? Math.min(100, Math.round((aprobAnt + 2) * 10) / 10)
                : undefined);
          const reprobMeta = p.reprobacion_meta !== undefined
            ? p.reprobacion_meta
            : (reprobAnt !== undefined && !isNaN(reprobAnt)
                ? Math.max(0, Math.round((reprobAnt - 2) * 10) / 10)
                : undefined);
          return {
            ...p,
            aprobacion_ant: aprobAnt,
            reprobacion_ant: reprobAnt,
            aprobacion_meta: aprobMeta,
            reprobacion_meta: reprobMeta,
            matricula: p.matricula || (json.data?.totalAlumnos ? Number(json.data.totalAlumnos) : undefined),
          };
        });
      }

      // H-005: Enlazar asignaturas críticas detectadas en F11 al FODA
      if (json.data?.promediosPorAsignatura && typeof json.data.promediosPorAsignatura === 'object') {
        const entries = Object.entries(json.data.promediosPorAsignatura as Record<string, number>);
        if (entries.length > 0) {
          const critical = entries
            .filter(([, avg]) => typeof avg === 'number' && avg < 7.5)
            .map(([subj, avg]) => `${subj} (promedio ${avg})`)
            .slice(0, 4)
            .join(', ');
          if (critical) {
            setFoda(prev => ({
              ...prev,
              debilidades: prev.debilidades
                ? `${prev.debilidades}\n- Asignaturas de atención prioritaria según F11: ${critical}`
                : `Asignaturas de atención prioritaria según F11: ${critical}`,
            }));
          }
        }
      }

      // Reconciliación arquitectónica de plantilla docente desde F11
      const effDirector = json.data?.directorName || directorName;
      const targetCount = json.data?.totalDocentes ? Number(json.data.totalDocentes) : totalStaff;
      const reconciled = reconcilePmcStaff({
        existingStaff: staffData,
        f11Docentes: json.data?.docentesPorAsignatura,
        docentesList: json.data?.docentes,
        directorName: effDirector,
        targetTotalStaff: targetCount,
        cicloEscolar,
      });
      setStaffData(reconciled.staff);
      setTotalStaff(reconciled.totalStaff);

      setDocsStatus(p => ({ ...p, f11: true }));
      setSuccessBanner(`✓ F11 Fin Ciclo Anterior cargado: ${json.data?.totalAlumnos || '?'} alumnos evaluados, promedio general ${json.data?.promedioGeneral || '?'}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el F11.');
    } finally {
      setUploadingF11(false);
      if (fileInputF11Ref.current) fileInputF11Ref.current.value = '';
    }
  };

  // ── Estadística 911 Upload Handler (con soporte de 3 momentos) ──────────────
  const handleUpload911 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const momento = uploadMomentoRef.current;
    setUploading911(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('momento', momento);
      const res = await fetch('/api/pmc/estadistica-911', { method: 'POST', body: formData });
      const json = await parseSafeApiResponse<{ success?: boolean; error?: string; data?: Estadistica911ResponseDTO }>(
        res,
        'Error al analizar la Estadística 911.'
      );
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al analizar la Estadística 911.');
      if (json.data?.schoolName && !schoolName) setSchoolName(json.data.schoolName);
      if (json.data?.schoolCct && !schoolCct) setSchoolCct(json.data.schoolCct);
      if (json.data?.directorName && !directorName) setDirectorName(json.data.directorName);
      if (json.data?.supervisorName && !supervisorName) setSupervisorName(json.data.supervisorName);

      const syncStaffFrom911 = (totalDocs?: number) => {
        if (!totalDocs || isNaN(Number(totalDocs))) return;
        const effDirector = json.data?.directorName || directorName;
        const reconciled = reconcilePmcStaff({
          existingStaff: staffData,
          directorName: effDirector,
          targetTotalStaff: Number(totalDocs),
          cicloEscolar,
        });
        setStaffData(reconciled.staff);
        setTotalStaff(reconciled.totalStaff);
      };

      if (momento === 'fin_anterior') {
        setIndicadores(p => {
          const rawAb = json.data?.abandonoPorcentaje;
          const rawEt = json.data?.eficienciaTerminal;
          const rawRep = json.data?.reprobacionPorcentaje;
          const rawAp = json.data?.aprobacionPorcentaje;

          const abandonoAnt = toRealNumber(rawAb) ?? p.abandono_ant;
          const etAnt = toRealNumber(rawEt) ?? p.et_ant;
          const reprobAnt = toRealNumber(rawRep) ?? p.reprobacion_ant;
          const aprobAnt = toRealNumber(rawAp) ?? p.aprobacion_ant;

          const abandonoMeta = p.abandono_meta !== undefined
            ? p.abandono_meta
            : (abandonoAnt !== undefined && !isNaN(abandonoAnt)
                ? Math.max(0, Math.round((abandonoAnt - 1.5) * 10) / 10)
                : undefined);
          const etMeta = p.et_meta !== undefined
            ? p.et_meta
            : (etAnt !== undefined && !isNaN(etAnt)
                ? Math.min(100, Math.round((etAnt + 2) * 10) / 10)
                : undefined);
          const reprobMeta = p.reprobacion_meta !== undefined
            ? p.reprobacion_meta
            : (reprobAnt !== undefined && !isNaN(reprobAnt)
                ? Math.max(0, Math.round((reprobAnt - 2) * 10) / 10)
                : undefined);
          const aprobMeta = p.aprobacion_meta !== undefined
            ? p.aprobacion_meta
            : (aprobAnt !== undefined && !isNaN(aprobAnt)
                ? Math.min(100, Math.round((aprobAnt + 2) * 10) / 10)
                : undefined);

          return {
            ...p,
            matricula: toRealNumber(json.data?.matricula) ?? p.matricula,
            abandono_ant: abandonoAnt,
            abandono_meta: abandonoMeta,
            et_ant: etAnt,
            et_meta: etMeta,
            reprobacion_ant: reprobAnt,
            reprobacion_meta: reprobMeta,
            aprobacion_ant: aprobAnt,
            aprobacion_meta: aprobMeta,
          };
        });
        if (json.data?.totalDocentes) syncStaffFrom911(json.data.totalDocentes);
        setDocsStatus(p => ({ ...p, n911FinAnt: true }));
        setSuccessBanner(`✓ 911 (Fin Ciclo Anterior) cargada: Abandono ${json.data?.abandonoPorcentaje || '?'}%, Eficiencia Terminal ${json.data?.eficienciaTerminal || '?'}%`);
      } else if (momento === 'inicio_actual') {
        setIndicadores(p => ({
          ...p,
          matricula: json.data?.matricula ? Number(json.data.matricula) : p.matricula,
        }));
        if (json.data?.totalDocentes) syncStaffFrom911(json.data.totalDocentes);
        setDocsStatus(p => ({ ...p, n911IniAct: true }));
        setSuccessBanner(`✓ 911 (Inicio Ciclo Actual) cargada: Matrícula vigente de ${json.data?.matricula || '?'} alumnos`);
      } else {
        // inicio_anterior
        setIndicadores(p => ({
          ...p,
          matricula: p.matricula || (json.data?.matricula ? Number(json.data.matricula) : undefined),
        }));
        setDocsStatus(p => ({ ...p, n911IniAnt: true }));
        setSuccessBanner(`✓ 911 (Inicio Ciclo Anterior) cargada: Matrícula inicial de ${json.data?.matricula || '?'} alumnos`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la Estadística 911.');
    } finally {
      setUploading911(false);
      setActiveMomento911(null);
      if (fileInput911Ref.current) fileInput911Ref.current.value = '';
    }
  };

  // Sinergia PAEC → PMC (Importar diagnósticos hacia Paso 3)
  const handleOpenImportPaecModal = async () => {
    setLoadingPaecList(true);
    setShowPaecImportModal(true);
    setSelectedPaecToImport(null);
    try {
      const url = schoolCct.trim()
        ? `/api/paec/for-pmc?cct=${encodeURIComponent(schoolCct.trim())}`
        : '/api/paec/for-pmc';
      const res = await fetch(url);
      const json = await parseSafeApiResponse<{ success?: boolean; projects?: PaecProjectForPmc[] }>(
        res,
        'Error al consultar proyectos PAEC.'
      );
      if (res.ok && json.success) {
        setPaecProjectsList(json.projects || []);
        if (json.projects && json.projects.length > 0) {
          setSelectedPaecToImport(json.projects[0]);
        }
      } else {
        setPaecProjectsList([]);
      }
    } catch {
      setPaecProjectsList([]);
    } finally {
      setLoadingPaecList(false);
    }
  };

  const handleApplyPaecToPmc = () => {
    if (!selectedPaecToImport) return;
    const p = selectedPaecToImport;
    const sCtx = p.schoolContext || {};
    const cCtx = p.communityContext || {};

    if (typeof sCtx.schoolName === 'string' && !schoolName) setSchoolName(sCtx.schoolName);
    if (typeof sCtx.cct === 'string' && !schoolCct) setSchoolCct(sCtx.cct);
    if (typeof sCtx.directorName === 'string' && !directorName) setDirectorName(sCtx.directorName);
    if (typeof sCtx.supervisorName === 'string' && !supervisorName) setSupervisorName(sCtx.supervisorName);
    if (typeof sCtx.schoolZone === 'string' && !schoolZone) setSchoolZone(sCtx.schoolZone);
    if (typeof sCtx.municipality === 'string' && !municipality) setMunicipality(sCtx.municipality);
    if (typeof sCtx.locality === 'string' && !locality) setLocality(sCtx.locality);

    const paecDiagParts = [
      cCtx.context ? `[Contexto Comunitario PAEC]: ${cCtx.context}` : '',
      cCtx.location ? `[Entorno Geográfico]: ${cCtx.location}` : '',
      p.problemStatement ? `[Problemática Comunitaria Central - ${p.projectName || 'PAEC'}]: ${p.problemStatement}` : '',
      cCtx.problematics ? `[Problemáticas Detectadas]: ${cCtx.problematics}` : '',
      cCtx.economicActivities ? `[Actividades Económicas]: ${cCtx.economicActivities}` : '',
    ].filter(Boolean);

    if (paecDiagParts.length > 0) {
      const combined = paecDiagParts.join('\n\n');
      setDiagnosticoComunidad(prev => prev.trim() ? `${prev}\n\n--- Integrado desde PAEC ---\n${combined}` : combined);
    }

    setShowPaecImportModal(false);
    setSuccessBanner(`✓ Diagnóstico y contexto importados exitosamente desde el PAEC "${p.projectName}".`);
  };

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
  }, [schoolCct]);

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

  const saveProject = useCallback(async (data: Partial<PmcProject>, goToStep?: number): Promise<string | null> => {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...data };
      if (goToStep !== undefined) payload.current_step = goToStep;

      if (!projectId) {
        // Create new
        const res = await fetch('/api/pmc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
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
            indicadores_academicos: indicadores,
            diagnostico_comunidad: diagnosticoComunidad,
            foda,
            categorias_priorizadas: categoriasPriorizadas,
            ...payload,
          }),
        });
        const created = await parseSafeApiResponse<{ project?: { id?: string }; id?: string; error?: string }>(
          res,
          'Error al guardar el proyecto.'
        );
        if (!res.ok) throw new Error(created.error || 'Error al guardar');
        clearPmcDraft(); // Draft saved to DB — clear localStorage
        const newId = created.project?.id || created.id;
        if (newId) {
          setProjectId(newId);
          router.replace(`/${locale}/pmc/nuevo?id=${newId}`);
          return newId;
        }
        return null;
      } else {
        // Update existing
        const res = await fetch(`/api/pmc/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
  }, [projectId, schoolName, schoolCct, municipality, locality, schoolZone, directorName, supervisorName, cicloEscolar, subsystem, totalStaff, staffData, indicadores, diagnosticoComunidad, foda, categoriasPriorizadas, locale, router]);

  const generateStep = useCallback(async (step: string): Promise<void> => {
    if (!projectId) return;
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
    } catch (e: unknown) {
      setError((e as Error).message || 'Error al generar contenido');
    } finally {
      setGenerating(null);
    }
  }, [projectId]);

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
    setStaffData(prev => {
      if (prev.length <= 1) {
        return [{ nombre: '', cargo: 'Docente', meta_individual: '', metas_individuales: [] }];
      }
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      setTotalStaff(updated.length);
      return updated;
    });
  };

  const addStaffMember = () => {
    setStaffData(prev => {
      const updated = [
        ...prev,
        { nombre: '', cargo: 'Docente', meta_individual: '', metas_individuales: [] },
      ];
      setTotalStaff(updated.length);
      return updated;
    });
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

  // ── Step navigation ────────────────────────────────────────────────────────

  const handleNext = async () => {
    setError(null);
    let idToUse = projectId;

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
        indicadores_academicos: indicadores,
        diagnostico_comunidad: diagnosticoComunidad,
        foda,
        categorias_priorizadas: categoriasPriorizadas,
        current_step: 2,
      });
    } else if (activeStep === 2) {
      const incomplete = staffData.some(s => !s.nombre.trim() || !s.cargo.trim());
      if (incomplete) {
        setError('Por favor completa el nombre y cargo de todos los miembros del personal.');
        return;
      }
      idToUse = await saveProject({ total_staff: totalStaff, staff_data: staffData, current_step: 3 });
    } else if (activeStep === 3) {
      if (!diagnosticoComunidad.trim()) {
        setError('Por favor describe el contexto de la comunidad.');
        return;
      }
      if (categoriasPriorizadas.length === 0 || totalTemasSeleccionados === 0) {
        setError('Selecciona al menos una categoría y al menos un tema a priorizar.');
        return;
      }
      idToUse = await saveProject({
        diagnostico_comunidad: diagnosticoComunidad,
        indicadores_academicos: indicadores,
        foda, categorias_priorizadas: categoriasPriorizadas,
        current_step: 4,
      });
    } else if (activeStep === 4) {
      if (!diagnosticoGenerado || !planAccion) {
        setError('Debes generar tanto el diagnóstico como el plan de acción con IA antes de continuar.');
        return;
      }
      idToUse = await saveProject({
        diagnostico_generado: diagnosticoGenerado,
        plan_accion: planAccion,
        status: 'completed',
        current_step: 5,
      });
    }

    if (idToUse) {
      setActiveStep(s => Math.min(s + 1, 5));
    }
  };

  const handleBack = () => setActiveStep(s => Math.max(s - 1, 1));

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
    setActiveStep(4);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.14)', fontSize: '14px',
    fontFamily: 'inherit',
    background: 'rgba(255,255,255,0.07)',
    color: '#f0f4ff',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontWeight: 600, fontSize: '12px',
    color: 'rgba(240,244,255,0.6)', marginBottom: '4px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  };
  const sectionCard: React.CSSProperties = {
    background: 'rgba(13,21,48,0.7)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '20px', marginBottom: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0d1530 0%, #080c18 60%, #020408 100%)', backgroundAttachment: 'fixed', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: 'rgba(6,10,20,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#f0f4ff', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📈</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.3px', background: 'linear-gradient(135deg,#e0e7ff,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Plan de Mejora Continua</div>
            <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)' }}>Lineamientos MCCEMS {cicloEscolar}</div>
          </div>
        </div>
        <Link href={`/${locale}/pmc`} style={{ color: 'rgba(240,244,255,0.6)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
          ← Volver
        </Link>
      </header>

      {/* Progress steps */}
      <div style={{ background: 'rgba(8,12,24,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 0, maxWidth: '900px', margin: '0 auto' }}>
          {STEPS.map(step => (
            <div key={step.n} style={{
              flex: 1, padding: '14px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600,
              borderBottom: `3px solid ${activeStep === step.n ? '#6366f1' : activeStep > step.n ? '#10b981' : 'transparent'}`,
              color: activeStep === step.n ? '#818cf8' : activeStep > step.n ? '#34d399' : 'rgba(240,244,255,0.4)',
              cursor: activeStep > step.n ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }} onClick={() => activeStep > step.n && setActiveStep(step.n)}>
              <div style={{ fontSize: '18px', marginBottom: '2px' }}>
                {activeStep > step.n ? '✓' : step.n}
              </div>
              {step.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>

        {/* Error banner */}
        {error && (
          <div style={{ background: 'rgba(244,63,94,0.12)', color: '#fb7185', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(244,63,94,0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── STEP 1: Datos Institucionales ─────────────────────────── */}
        {activeStep === 1 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 1: Datos Institucionales
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Ingresa los datos generales del plantel educativo. Esta información aparecerá en la portada del PMC.
            </p>

            {successBanner && (
              <div style={{ marginBottom: '18px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{successBanner}</span>
                <button
                  type="button"
                  onClick={() => setSuccessBanner(null)}
                  style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                >
                  ×
                </button>
              </div>
            )}

            {/* Barra de Acciones Inteligentes: Cargar PMC Anterior + F11 + Estadística 911 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.95) 100%)', border: '1px solid rgba(99,102,241,0.3)', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Carga Inteligente de Documentos Oficiales</div>
                  <div style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.6)' }}>Sube el F11 (calificaciones) y Estadística 911 (matrícula) para pre-llenar tu PMC</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputF11Ref.current?.click()}
                  disabled={uploadingF11}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.f11 ? 'rgba(14,165,233,0.35)' : 'rgba(14,165,233,0.2)',
                    border: '1px solid rgba(14,165,233,0.45)',
                    color: '#7dd3fc', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploadingF11 ? '⏳ Analizando F11...' : `📊 F11 (Fin Ciclo Anterior)${docsStatus.f11 ? ' ✓' : ''}`}
                </button>
                <input ref={fileInputF11Ref} type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,image/*" style={{ display: 'none' }} onChange={handleUploadF11} />

                <button
                  type="button"
                  onClick={() => triggerUpload911('fin_anterior')}
                  disabled={uploading911}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.n911FinAnt ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.2)',
                    border: '1px solid rgba(245,158,11,0.45)',
                    color: '#fcd34d', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'fin_anterior' ? '⏳...' : `📈 911 (Fin Ciclo Ant.)${docsStatus.n911FinAnt ? ' ✓' : ''}`}
                </button>

                <button
                  type="button"
                  onClick={() => triggerUpload911('inicio_anterior')}
                  disabled={uploading911}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.n911IniAnt ? 'rgba(56,189,248,0.35)' : 'rgba(56,189,248,0.2)',
                    border: '1px solid rgba(56,189,248,0.45)',
                    color: '#38bdf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'inicio_anterior' ? '⏳...' : `📈 911 (Inicio Ciclo Ant.)${docsStatus.n911IniAnt ? ' ✓' : ''}`}
                </button>

                <button
                  type="button"
                  onClick={() => triggerUpload911('inicio_actual')}
                  disabled={uploading911}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.n911IniAct ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.2)',
                    border: '1px solid rgba(16,185,129,0.45)',
                    color: '#6ee7b7', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'inicio_actual' ? '⏳...' : `📈 911 (Inicio Ciclo Act.)${docsStatus.n911IniAct ? ' ✓' : ''}`}
                </button>
                <input ref={fileInput911Ref} type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,image/*" style={{ display: 'none' }} onChange={handleUpload911} />

                <button
                  type="button"
                  onClick={() => fileInputPmcRef.current?.click()}
                  disabled={uploadingPmc}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.pmcAnt ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.2)',
                    border: '1px solid rgba(99,102,241,0.45)',
                    color: '#c7d2fe', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploadingPmc ? '⏳ Analizando...' : `📄 Cargar PMC Anterior${docsStatus.pmcAnt ? ' ✓' : ''}`}
                </button>
                <input ref={fileInputPmcRef} type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,image/*" style={{ display: 'none' }} onChange={handleUploadPreviousPmc} />
              </div>
            </div>

            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '16px' }}>🏫 Datos del Plantel</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Nombre oficial del plantel *</label>
                  <input style={inputStyle} value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Ej: Bachillerato General Oficial 'Lázaro Cárdenas'" />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={labelStyle}>Clave de Centro de Trabajo (CCT) *</label>
                    <button
                      type="button"
                      onClick={handleConsultarZona}
                      disabled={loadingZona || !schoolCct.trim()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: schoolCct.trim() ? '#818cf8' : 'rgba(255,255,255,0.3)',
                        fontSize: '11px',
                        cursor: schoolCct.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        marginBottom: '4px',
                      }}
                    >
                      {loadingZona ? '🔍 Consultando...' : '✨ Consultar Datos de Zona'}
                    </button>
                  </div>
                  <input style={inputStyle} value={schoolCct} onChange={e => setSchoolCct(e.target.value.toUpperCase())} placeholder="Ej: 21EBH0000A" maxLength={12} />
                  <small style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>Formato: 21EBH0000X (10 caracteres)</small>
                </div>
                <div>
                  <label style={labelStyle}>Subsistema</label>
                  <select style={inputStyle} value={subsystem} onChange={e => setSubsystem(e.target.value)}>
                    {SUBSISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Municipio *</label>
                  <input style={inputStyle} value={municipality} onChange={e => setMunicipality(e.target.value)} placeholder="Ej: Zacapoaxtla" />
                </div>
                <div>
                  <label style={labelStyle}>Localidad / Comunidad *</label>
                  <input style={inputStyle} value={locality} onChange={e => setLocality(e.target.value)} placeholder="Ej: San Marcos Tlacoyalco" />
                </div>
                <div>
                  <label style={labelStyle}>Zona Escolar</label>
                  <input style={inputStyle} value={schoolZone} onChange={e => setSchoolZone(e.target.value)} placeholder="Ej: Zona 004" />
                </div>
                <div>
                  <label style={labelStyle}>Ciclo escolar</label>
                  <input style={inputStyle} value={cicloEscolar} onChange={e => setCicloEscolar(e.target.value)} placeholder="2025-2026" />
                </div>
              </div>
            </div>

            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '16px' }}>👤 Autoridades</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Nombre del Director(a) *</label>
                  <input style={inputStyle} value={directorName} onChange={e => handleDirectorNameChange(e.target.value)} placeholder="Nombre completo del director(a)" />
                </div>
                <div>
                  <label style={labelStyle}>Nombre del Supervisor(a) de Zona</label>
                  <input style={inputStyle} value={supervisorName} onChange={e => setSupervisorName(e.target.value)} placeholder="Nombre completo del supervisor(a)" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Personal ────────────────────────────────────────── */}
        {activeStep === 2 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 2: Personal del Plantel
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Registra a <strong>todo el personal</strong> del plantel. Cada persona debe participar en el PMC
              con una meta individual. Si no defines su meta ahora, la IA generará una acorde a su cargo.
            </p>

            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Número total de trabajadores en el plantel</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => adjustStaffCount(totalStaff - 1)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--c-border)', cursor: 'pointer', fontSize: '16px' }}>−</button>
                    <span style={{ fontSize: '24px', fontWeight: 700, minWidth: '40px', textAlign: 'center', color: '#818cf8' }}>{totalStaff}</span>
                    <button onClick={() => adjustStaffCount(totalStaff + 1)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '16px', background: 'rgba(255,255,255,0.06)', color: '#f0f4ff' }}>+</button>
                    <span style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)', marginLeft: '8px' }}>personas</span>
                  </div>
                </div>
                <div style={{ flex: 1, padding: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', fontSize: '13px', color: '#a5b4fc' }}>
                  💡 Incluye: director, docentes, orientador, prefectos, administrativos, intendentes, etc. Todos deben tener una meta en el PMC.
                </div>
              </div>

              {staffData.map((member, idx) => (
                <div key={idx} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--c-border)', paddingTop: idx === 0 ? 0 : '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <strong style={{ fontSize: '14px', color: '#818cf8' }}>
                        {member.nombre || `Trabajador ${idx + 1}`}
                      </strong>
                    </div>
                    {staffData.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStaffMember(idx)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                        title="Eliminar este trabajador de la plantilla"
                      >
                        ✕ Eliminar trabajador
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Nombre completo *</label>
                      <input
                        style={inputStyle}
                        value={member.nombre}
                        onChange={e => {
                          const val = e.target.value;
                          const copy = [...staffData];
                          copy[idx] = { ...copy[idx], nombre: val };
                          setStaffData(copy);
                          if (copy[idx].cargo === 'Director(a)') {
                            setDirectorName(val);
                          }
                        }}
                        placeholder="Nombre del trabajador"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Cargo / Función *</label>
                      <select
                        style={inputStyle}
                        value={member.cargo || 'Docente'}
                        onChange={e => {
                          const copy = [...staffData];
                          copy[idx] = { ...copy[idx], cargo: e.target.value };
                          setStaffData(copy);
                          if (e.target.value === 'Director(a)') {
                            setDirectorName(copy[idx].nombre);
                          }
                        }}
                      >
                        {member.cargo && !CARGOS_COMUNES.includes(member.cargo) && (
                          <option value={member.cargo}>{member.cargo}</option>
                        )}
                        {CARGOS_COMUNES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Metas individuales para el ciclo {cicloEscolar} (opcional — si no defines las metas la IA las generará)</label>
                      {(member.metas_individuales && member.metas_individuales.length > 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                          {member.metas_individuales.map((meta, mIdx) => {
                            const catNorm = normalizePmcCategoria(meta.categoria);
                            const catObj = PMC_CATEGORIAS_OFICIALES.find(c => c.nombre === catNorm) || PMC_CATEGORIAS_OFICIALES[0];
                            const isKnownTema = catObj.temas.includes(meta.tema);

                            return (
                              <div key={mIdx} style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '12px', fontSize: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                  <div>
                                    <label style={{ fontSize: '10.5px', color: '#a5b4fc', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Categoría Oficial (Cuadro 2 Lineamientos)</label>
                                    <select
                                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '11.5px', cursor: 'pointer' }}
                                      value={catNorm}
                                      onChange={e => {
                                        const newCat = e.target.value;
                                        const newCatObj = PMC_CATEGORIAS_OFICIALES.find(c => c.nombre === newCat) || PMC_CATEGORIAS_OFICIALES[0];
                                        const copy = [...staffData];
                                        const metas = [...(copy[idx].metas_individuales || [])];
                                        const currentTema = metas[mIdx]?.tema || '';
                                        const newTema = newCatObj.temas.includes(currentTema) ? currentTema : newCatObj.temas[0];
                                        metas[mIdx] = { ...metas[mIdx], categoria: newCat, tema: newTema };
                                        copy[idx] = { ...copy[idx], metas_individuales: metas };
                                        setStaffData(copy);
                                      }}
                                    >
                                      {PMC_CATEGORIAS_OFICIALES.map(cat => (
                                        <option key={cat.id} value={cat.nombre} style={{ background: '#1e1b4b', color: '#f0f4ff' }}>
                                          {cat.numero}. {cat.nombre}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '10.5px', color: '#a5b4fc', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Ámbito / Tema Específico</label>
                                    <select
                                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '11.5px', cursor: 'pointer' }}
                                      value={isKnownTema ? meta.tema : (meta.tema ? '__custom__' : catObj.temas[0])}
                                      onChange={e => {
                                        const val = e.target.value;
                                        const copy = [...staffData];
                                        const metas = [...(copy[idx].metas_individuales || [])];
                                        metas[mIdx] = { ...metas[mIdx], tema: val === '__custom__' ? (meta.tema || '') : val };
                                        copy[idx] = { ...copy[idx], metas_individuales: metas };
                                        setStaffData(copy);
                                      }}
                                    >
                                      {catObj.temas.map(t => (
                                        <option key={t} value={t} style={{ background: '#1e1b4b', color: '#f0f4ff' }}>
                                          {t}
                                        </option>
                                      ))}
                                      {!isKnownTema && meta.tema && (
                                        <option value="__custom__" style={{ background: '#1e1b4b', color: '#f0f4ff' }}>
                                          Otro: {meta.tema}
                                        </option>
                                      )}
                                    </select>
                                  </div>
                                  <button
                                    type="button"
                                    title="Eliminar esta meta"
                                    onClick={() => {
                                      const copy = [...staffData];
                                      const metas = [...(copy[idx].metas_individuales || [])];
                                      metas.splice(mIdx, 1);
                                      copy[idx] = { ...copy[idx], metas_individuales: metas };
                                      setStaffData(copy);
                                    }}
                                    style={{ background: 'rgba(244,63,94,0.2)', border: 'none', color: '#fb7185', cursor: 'pointer', fontSize: '12px', padding: '6px 10px', borderRadius: '4px', alignSelf: 'flex-end', height: '32px' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                  <label style={{ fontSize: '10.5px', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Redacción de la Meta Individual</label>
                                  <textarea
                                    style={{ ...inputStyle, minHeight: '50px', resize: 'vertical', fontSize: '12px', padding: '6px 8px' }}
                                    value={meta.meta || ''}
                                    onChange={e => {
                                      const copy = [...staffData];
                                      const metas = [...(copy[idx].metas_individuales || [])];
                                      metas[mIdx] = { ...metas[mIdx], meta: e.target.value };
                                      copy[idx] = { ...copy[idx], metas_individuales: metas };
                                      setStaffData(copy);
                                    }}
                                    placeholder="Ej: Acreditar 2 cursos de formación docente COSFAC con calificación aprobatoria..."
                                  />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  <div>
                                    <label style={{ fontSize: '10px', color: 'rgba(240,244,255,0.6)', display: 'block', marginBottom: '2px' }}>Estrategia / Acciones (opcional)</label>
                                    <input
                                      type="text"
                                      style={{ ...inputStyle, padding: '4px 8px', fontSize: '11px' }}
                                      value={meta.estrategia || ''}
                                      onChange={e => {
                                        const copy = [...staffData];
                                        const metas = [...(copy[idx].metas_individuales || [])];
                                        metas[mIdx] = { ...metas[mIdx], estrategia: e.target.value };
                                        copy[idx] = { ...copy[idx], metas_individuales: metas };
                                        setStaffData(copy);
                                      }}
                                      placeholder="Ej. Inscripción y seguimiento en plataforma"
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '10px', color: 'rgba(240,244,255,0.6)', display: 'block', marginBottom: '2px' }}>Entregable / Evidencia (opcional)</label>
                                    <input
                                      type="text"
                                      style={{ ...inputStyle, padding: '4px 8px', fontSize: '11px' }}
                                      value={meta.entregable || ''}
                                      onChange={e => {
                                        const copy = [...staffData];
                                        const metas = [...(copy[idx].metas_individuales || [])];
                                        metas[mIdx] = { ...metas[mIdx], entregable: e.target.value };
                                        copy[idx] = { ...copy[idx], metas_individuales: metas };
                                        setStaffData(copy);
                                      }}
                                      placeholder="Ej. Constancias COSFAC"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.4)', fontStyle: 'italic', marginBottom: '8px' }}>
                          Sin metas predefinidas — la IA generará metas individuales acordes al cargo y las categorías seleccionadas.
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const copy = [...staffData];
                          const metas = [...(copy[idx].metas_individuales || [])];
                          metas.push({
                            categoria: PMC_CATEGORIAS_OFICIALES[0].nombre,
                            tema: PMC_CATEGORIAS_OFICIALES[0].temas[0],
                            meta: '',
                            estrategia: '',
                            entregable: '',
                            periodo: `agosto ${cicloEscolar.split('-')[0] || '2026'} - junio ${cicloEscolar.split('-')[1] || '2027'}`,
                          });
                          copy[idx] = { ...copy[idx], metas_individuales: metas };
                          setStaffData(copy);
                        }}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px dashed rgba(99,102,241,0.4)', background: 'transparent', color: '#818cf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Agregar meta individual
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={addStaffMember}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px dashed rgba(99,102,241,0.5)',
                    background: 'rgba(99,102,241,0.08)',
                    color: '#a5b4fc',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  ➕ Agregar trabajador
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Diagnóstico ─────────────────────────────────────── */}
        {activeStep === 3 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 3: Diagnóstico Socioeducativo
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Proporciona los datos del contexto comunitario, los indicadores académicos del ciclo anterior
              y el análisis FODA. La IA usará esta información para redactar el diagnóstico oficial.
            </p>

            {/* Banner: Carga de Datos Oficiales + Cartografía de Zona */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.28)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <div>
                <strong style={{ color: '#c7d2fe', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📊 Datos Oficiales para el Diagnóstico
                </strong>
                <p style={{ margin: '2px 0 0', color: 'rgba(240, 244, 255, 0.6)', fontSize: '12px' }}>
                  Sube tu F11 y Estadística 911, o consulta la Cartografía de Zona para benchmarks regionales.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputF11Ref.current?.click()}
                  disabled={uploadingF11}
                  style={{
                    padding: '7px 14px',
                    background: uploadingF11 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {uploadingF11 ? '⏳...' : `📊 F11${docsStatus.f11 ? ' ✓' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => triggerUpload911('fin_anterior')}
                  disabled={uploading911}
                  style={{
                    padding: '7px 14px',
                    background: uploading911 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'fin_anterior' ? '⏳...' : `📈 911 Fin Ant.${docsStatus.n911FinAnt ? ' ✓' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => triggerUpload911('inicio_anterior')}
                  disabled={uploading911}
                  style={{
                    padding: '7px 14px',
                    background: uploading911 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'inicio_anterior' ? '⏳...' : `📈 911 Ini Ant.${docsStatus.n911IniAnt ? ' ✓' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => triggerUpload911('inicio_actual')}
                  disabled={uploading911}
                  style={{
                    padding: '7px 14px',
                    background: uploading911 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'inicio_actual' ? '⏳...' : `📈 911 Inicio Act.${docsStatus.n911IniAct ? ' ✓' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={handleConsultarZona}
                  disabled={loadingZona || !schoolCct.trim()}
                  style={{
                    padding: '7px 14px',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: schoolCct.trim() ? 'pointer' : 'not-allowed',
                    opacity: schoolCct.trim() ? 1 : 0.5,
                  }}
                >
                  {loadingZona ? 'Consultando...' : '🗺️ Zona'}
                </button>
              </div>
            </div>

            {zonaFeedback && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#6ee7b7',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                {zonaFeedback}
              </div>
            )}

            {/* Contexto Comunitario */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0 }}>🌍 Contexto de la Comunidad</h3>
                <button
                  type="button"
                  onClick={handleOpenImportPaecModal}
                  disabled={loadingPaecList}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.35)',
                    color: '#6ee7b7',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {loadingPaecList ? 'Consultando PAEC...' : '📥 Importar contexto desde PAEC del Plantel'}
                </button>
              </div>
              <label style={labelStyle}>Descripción del contexto socioeducativo de la comunidad *</label>
              <textarea
                style={{ ...inputStyle, minHeight: '140px', resize: 'vertical' }}
                value={diagnosticoComunidad}
                onChange={e => setDiagnosticoComunidad(e.target.value)}
                placeholder="Describe la comunidad donde se ubica el plantel: ubicación geográfica, número de habitantes, condiciones socioeconómicas, acceso a servicios, problemáticas sociales relevantes (migración, marginación, violencia), acceso a internet y tecnología, distancia a centros urbanos, principales fuentes de empleo, etc."
              />
              <small style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>
                Incluye datos cuantitativos si los tienes (número de habitantes, % de marginación, etc.)
              </small>
            </div>

            {/* Indicadores académicos */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '8px' }}>📊 Indicadores Académicos</h3>
              <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '8px' }}>
                Ingresa los datos del ciclo anterior y tus metas para el ciclo {cicloEscolar}. Estos datos son obligatorios para el diagnóstico cuantitativo.
              </p>
              <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '6px', padding: '8px 12px', fontSize: '11.5px', color: '#7dd3fc', marginBottom: '14px' }}>
                💡 <strong>Extracción Automática:</strong> Al subir tu <strong>F11</strong> (aprobación/reprobación) y <strong>Estadística 911</strong> (abandono, eficiencia terminal y matrícula), ya sea en <strong>PDF, Word o Fotografía/Imagen</strong>, la plataforma los calcula y pre-llena automáticamente.
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(99,102,241,0.25)', color: '#f0f4ff' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', width: '38%' }}>Indicador</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>% Ciclo Anterior</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>% Meta {cicloEscolar}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Aprobación', fuente: 'F11', antKey: 'aprobacion_ant' as const, metaKey: 'aprobacion_meta' as const },
                      { label: 'Reprobación', fuente: 'F11', antKey: 'reprobacion_ant' as const, metaKey: 'reprobacion_meta' as const },
                      { label: 'Abandono escolar / Deserción', fuente: '911 Fin', antKey: 'abandono_ant' as const, metaKey: 'abandono_meta' as const },
                      { label: 'Eficiencia terminal', fuente: '911 Fin', antKey: 'et_ant' as const, metaKey: 'et_meta' as const },
                    ].map((row, i) => (
                      <tr key={row.label} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(99,102,241,0.06)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontWeight: 600 }}>{row.label}</span>
                          <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: row.fuente === 'F11' ? 'rgba(14,165,233,0.2)' : 'rgba(245,158,11,0.2)', color: row.fuente === 'F11' ? '#7dd3fc' : '#fcd34d', border: `1px solid ${row.fuente === 'F11' ? 'rgba(14,165,233,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                            {row.fuente}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <input
                              type="number" min={0} max={100} step={0.1}
                              style={{ width: '70px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--c-border)', textAlign: 'center' }}
                              value={indicadores[row.antKey] ?? ''}
                              onChange={e => setIndicadores(p => ({ ...p, [row.antKey]: parseFloat(e.target.value) || undefined }))}
                              placeholder="0"
                            />
                            <span>%</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <input
                              type="number" min={0} max={100} step={0.1}
                              style={{ width: '70px', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.3)', textAlign: 'center', background: 'rgba(99,102,241,0.1)', color: '#f0f4ff' }}
                              value={indicadores[row.metaKey] ?? ''}
                              onChange={e => setIndicadores(p => ({ ...p, [row.metaKey]: parseFloat(e.target.value) || undefined }))}
                              placeholder="0"
                            />
                            <span>%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Matrícula total del plantel (alumnos)</label>
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
                      911 Inicio
                    </span>
                  </div>
                  <input
                    type="number" min={1}
                    style={{ ...inputStyle, width: '160px' }}
                    value={indicadores.matricula ?? ''}
                    onChange={e => setIndicadores(p => ({ ...p, matricula: parseInt(e.target.value) || undefined }))}
                    placeholder="Número de alumnos"
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Matrícula meta proyectada (opcional)</label>
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                      Meta
                    </span>
                  </div>
                  <input
                    type="number" min={1}
                    style={{ ...inputStyle, width: '160px' }}
                    value={indicadores.matricula_meta ?? ''}
                    onChange={e => setIndicadores(p => ({ ...p, matricula_meta: parseInt(e.target.value) || undefined }))}
                    placeholder="Meta alumnos"
                  />
                </div>
              </div>
            </div>

            {/* FODA */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '12px' }}>📋 Análisis FODA del Plantel</h3>
              <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.55)', marginBottom: '16px' }}>
                Realizado de manera colegiada con todo el personal del plantel.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { key: 'fortalezas' as const, label: '💪 Fortalezas', hint: 'Recursos, capacidades y ventajas internas del plantel', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', color: '#34d399' },
                  { key: 'oportunidades' as const, label: '🌟 Oportunidades', hint: 'Factores externos favorables que puede aprovechar el plantel', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.25)', color: '#38bdf8' },
                  { key: 'debilidades' as const, label: '⚠️ Debilidades', hint: 'Limitaciones internas y áreas de oportunidad del plantel', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', color: '#fcd34d' },
                  { key: 'amenazas' as const, label: '🔴 Amenazas', hint: 'Factores externos que pueden afectar negativamente al plantel', bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.25)', color: '#fb7185' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ ...labelStyle, color: field.color }}>{field.label}</label>
                    <small style={{ display: 'block', color: 'rgba(240,244,255,0.45)', fontSize: '11px', marginBottom: '6px' }}>{field.hint}</small>
                    <textarea
                      style={{ ...inputStyle, minHeight: '100px', background: field.bg, border: `1px solid ${field.border}`, resize: 'vertical' }}
                      value={foda[field.key]}
                      onChange={e => setFoda(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={`Lista los principales ${field.label.split(' ')[1].toLowerCase()}...`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Categorías y Temas Priorizados */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '4px' }}>🎯 Categorías y Temas a Priorizar *</h3>
              <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.55)', marginBottom: '8px' }}>
                Según los <strong>Lineamientos MCCEMS 2025-2026</strong>, el PMC se organiza en <strong>3 categorías oficiales</strong>. Selecciona la(s) categoría(s) y marca los <strong>temas específicos</strong> que tu plantel abordará. La IA generará metas SMART (con Diagnóstico → Meta → Estrategia → Producto) para cada tema seleccionado.
              </p>
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#a5b4fc' }}>
                <strong>📐 Metodología SMART:</strong> Cada meta que genere la IA será: <em>Específica · Medible · Alcanzable · Relevante · Temporal</em> — siguiendo la estructura: <strong>Diagnóstico → Meta → Estrategia → Producto</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {CATEGORIAS_OFICIALES.map(cat => {
                  const selected = isCatSelected(cat.id);
                  const temasSeleccionados = categoriasPriorizadas.find(c => c.id === cat.id)?.temas ?? [];
                  return (
                    <div key={cat.id} style={{ border: `2px solid ${selected ? cat.color : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', overflow: 'hidden', transition: 'all 0.2s' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', background: selected ? `${cat.color}22` : 'rgba(255,255,255,0.03)', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCategoria(cat)}
                          style={{ width: '18px', height: '18px', accentColor: cat.color, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: selected ? cat.color : '#f0f4ff' }}>{cat.nombre}</span>
                          {selected && temasSeleccionados.length > 0 && (
                            <span style={{ marginLeft: '10px', fontSize: '11px', background: cat.color, color: '#fff', borderRadius: '20px', padding: '2px 8px' }}>
                              {temasSeleccionados.length} tema(s)
                            </span>
                          )}
                        </div>
                      </label>
                      {selected && (
                        <div style={{ padding: '8px 16px 14px 48px', background: 'rgba(8,12,24,0.6)', borderTop: `1px solid ${cat.color}40` }}>
                          <p style={{ fontSize: '11px', color: 'rgba(240,244,255,0.4)', marginBottom: '8px', fontStyle: 'italic' }}>
                            Selecciona los temas específicos que trabajará tu plantel en esta categoría:
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {cat.temas.map(tema => (
                              <label key={tema} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px', color: isTemaSelected(cat.id, tema) ? cat.color : 'rgba(240,244,255,0.75)', fontWeight: isTemaSelected(cat.id, tema) ? 600 : 400 }}>
                                <input
                                  type="checkbox"
                                  checked={isTemaSelected(cat.id, tema)}
                                  onChange={() => toggleTema(cat.id, tema)}
                                  style={{ width: '14px', height: '14px', marginTop: '2px', accentColor: cat.color, flexShrink: 0 }}
                                />
                                {tema}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {totalTemasSeleccionados > 0 && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', fontSize: '13px', color: '#34d399', fontWeight: 600 }}>
                  ✅ {categoriasPriorizadas.length} categoría(s) · {totalTemasSeleccionados} tema(s) seleccionado(s) — la IA generará una meta SMART por cada tema
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 4: Generación IA ───────────────────────────────────── */}
        {activeStep === 4 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 4: Generación con Inteligencia Artificial
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              La IA redactará el diagnóstico oficial y el plan de acción con metas SMART para tu plantel.
              Puedes editar cualquier sección después de generarla.
            </p>

            {/* Generate Diagnóstico */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0 }}>
                    📄 Diagnóstico Socioeducativo
                    {diagnosticoGenerado && <span style={{ marginLeft: '8px', color: '#34d399', fontSize: '13px' }}>✓ Generado</span>}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)', margin: '4px 0 0' }}>
                    Presentación, contexto, análisis de indicadores, FODA y priorización de categorías
                  </p>
                </div>
                <button
                  onClick={() => generateStep('diagnostico')}
                  disabled={generating !== null}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: generating === 'diagnostico' ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 600, cursor: generating !== null ? 'not-allowed' : 'pointer', fontSize: '13px', boxShadow: '0 2px 8px rgba(99,102,241,0.4)' }}
                >
                  {generating === 'diagnostico' ? '⏳ Generando...' : diagnosticoGenerado ? '🔄 Regenerar' : '✨ Generar Diagnóstico'}
                </button>
              </div>
              {diagnosticoGenerado && (
                <div style={{ background: 'rgba(8,12,24,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px', fontSize: '13px', color: '#f0f4ff', lineHeight: 1.7 }}>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Presentación:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6', color: 'rgba(240,244,255,0.85)' }}>{diagnosticoGenerado.presentacion}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Contexto Socioeducativo:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.contexto}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Análisis de Indicadores Académicos:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.analisis_indicadores}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Síntesis FODA:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.sintesis_foda}</p>
                  </div>
                  <div>
                    <strong style={{ color: '#818cf8' }}>Priorización de Categorías:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.priorizacion}</p>
                  </div>
                </div>
              )}
              {!diagnosticoGenerado && generating !== 'diagnostico' && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(240,244,255,0.45)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '13px' }}>
                  Haz clic en &quot;Generar Diagnóstico&quot; para que la IA redacte el diagnóstico oficial del PMC
                </div>
              )}
              {generating === 'diagnostico' && (
                <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
                  <p style={{ fontWeight: 600, color: '#818cf8' }}>Generando diagnóstico...</p>
                  <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)' }}>La IA está analizando el contexto y los indicadores del plantel</p>
                </div>
              )}
            </div>

            {/* Generate Plan de Acción */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0 }}>
                    🎯 Plan de Acción con Metas SMART
                    {planAccion && <span style={{ marginLeft: '8px', color: '#34d399', fontSize: '13px' }}>✓ Generado</span>}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)', margin: '4px 0 0' }}>
                    Metas institucionales por categoría + metas individuales para los {totalStaff} trabajadores
                  </p>
                </div>
                <button
                  onClick={() => generateStep('plan_accion')}
                  disabled={generating !== null || !diagnosticoGenerado}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: generating === 'plan_accion' ? 'rgba(255,255,255,0.1)' : !diagnosticoGenerado ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 600, cursor: (generating !== null || !diagnosticoGenerado) ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: !diagnosticoGenerado ? 0.5 : 1 }}
                >
                  {generating === 'plan_accion' ? '⏳ Generando...' : planAccion ? '🔄 Regenerar' : '✨ Generar Plan de Acción'}
                </button>
              </div>
              {!diagnosticoGenerado && <p style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>⚠️ Primero genera el diagnóstico para poder generar el plan de acción.</p>}

              {/* Metas del ciclo previo (Referencia Histórica Aislada - H-006) */}
              {metasPreviasReferencia.length > 0 && (
                <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fcd34d', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📜</span> Metas del Ciclo Previo (Insumo Histórico de Referencia)
                    </h4>
                    <span style={{ fontSize: '11px', color: 'rgba(240,244,255,0.6)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                      {metasPreviasReferencia.length} metas extraídas
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.7)', margin: '0 0 12px', lineHeight: 1.5 }}>
                    Estas metas provienen del PMC anterior cargado. Por rigor normativo no se incluyen automáticamente en el Plan de Acción 2026-2027 para evitar compromisos extemporáneos. Puedes adaptar aquellas que requieran continuidad formal:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {metasPreviasReferencia.map((mp, idx) => {
                      const isAlreadyAdded = planAccion?.metas_institucionales?.some(
                        (m) =>
                          m.meta === `[Continuidad 2026-2027] ${mp.meta}` ||
                          (mp.meta && m.meta.trim().toLowerCase() === mp.meta.trim().toLowerCase()) ||
                          (mp.meta && m.meta.includes(mp.meta))
                      );

                      return (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ flex: 1, fontSize: '12px' }}>
                            <div style={{ fontWeight: 600, color: '#93c5fd', marginBottom: '2px' }}>
                              {mp.categoria || 'Categoría general'} {mp.tema ? `— ${mp.tema}` : ''}
                            </div>
                            <div style={{ color: '#f0f4ff', marginBottom: '4px' }}><strong>Meta:</strong> {mp.meta || 'Sin redacción'}</div>
                            {mp.estrategia && <div style={{ color: 'rgba(240,244,255,0.65)' }}><strong>Estrategia:</strong> {mp.estrategia}</div>}
                            {mp.linea_base && <div style={{ color: 'rgba(240,244,255,0.5)' }}><strong>Línea base:</strong> {mp.linea_base}</div>}
                          </div>
                          <button
                            type="button"
                            disabled={Boolean(isAlreadyAdded)}
                            onClick={() => {
                              if (isAlreadyAdded) return;
                              const cat = mp.categoria || PMC_CATEGORIAS_OFICIALES[0].nombre;
                              const adaptedMeta: MetaInstitucional = {
                                categoria: cat,
                                nombre_categoria: cat,
                                tema: mp.tema || 'Mejora continua',
                                meta: mp.meta ? `[Continuidad 2026-2027] ${mp.meta}` : '',
                                estrategia: mp.estrategia || '',
                                linea_base: mp.linea_base || '',
                                personal_designado: mp.responsable || '',
                                entregable: mp.entregable || 'Reporte de seguimiento',
                                periodo_inicio: 'Agosto 2026',
                                periodo_fin: 'Junio 2027',
                                diagnostico_meta: `Meta adaptada del ciclo previo: ${mp.meta || ''}`,
                              };
                              setPlanAccion(prev => ({
                                metas_institucionales: [...(prev?.metas_institucionales || []), adaptedMeta],
                                metas_personales: prev?.metas_personales || [],
                              }));
                              setEditingMeta(planAccion?.metas_institucionales?.length || 0);
                            }}
                            style={{
                              padding: '6px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: isAlreadyAdded ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(99,102,241,0.4)',
                              background: isAlreadyAdded ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.2)',
                              color: isAlreadyAdded ? '#6ee7b7' : '#c7d2fe',
                              cursor: isAlreadyAdded ? 'default' : 'pointer',
                              whiteSpace: 'nowrap',
                              opacity: isAlreadyAdded ? 0.75 : 1,
                            }}
                          >
                            {isAlreadyAdded ? '✓ Agregada al Plan' : '➕ Adaptar para 2026-2027'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {planAccion && (
                <div>
                  {/* Metas institucionales */}
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8', marginBottom: '12px' }}>
                    Metas Institucionales ({planAccion.metas_institucionales.length})
                  </h4>
                  {planAccion.metas_institucionales.map((meta, i) => (
                    <div key={i} style={{ marginBottom: '12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.25)', overflow: 'hidden' }}>
                      <div style={{ background: 'rgba(99,102,241,0.25)', color: '#f0f4ff', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>
                          {meta.nombre_categoria} — {meta.tema}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setEditingMeta(editingMeta === i ? null : i)}
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            {editingMeta === i ? 'Cerrar' : '✏️ Editar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPlanAccion(prev => {
                                if (!prev) return null;
                                const updated = prev.metas_institucionales.filter((_, mIdx) => mIdx !== i);
                                return { ...prev, metas_institucionales: updated };
                              });
                              if (editingMeta === i) setEditingMeta(null);
                            }}
                            style={{
                              background: 'rgba(239,68,68,0.2)',
                              border: '1px solid rgba(239,68,68,0.4)',
                              color: '#fca5a5',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                            title="Eliminar esta meta del plan"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>
                      <div style={{ padding: '12px 14px', background: 'rgba(8,12,24,0.5)', fontSize: '13px', color: '#f0f4ff', lineHeight: 1.6 }}>
                        {editingMeta === i ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                              { key: 'meta', label: 'Meta SMART', multi: true },
                              { key: 'estrategia', label: 'Estrategia de implementación', multi: true },
                              { key: 'personal_designado', label: 'Personal designado', multi: false },
                              { key: 'entregable', label: 'Entregable / Evidencia', multi: true },
                              { key: 'periodo_inicio', label: 'Período inicio (MM/YYYY)', multi: false },
                              { key: 'periodo_fin', label: 'Período fin (MM/YYYY)', multi: false },
                            ].map(f => (
                              <div key={f.key}>
                                <label style={{ ...labelStyle, fontSize: '12px' }}>{f.label}</label>
                                {f.multi ? (
                                  <textarea
                                    value={((meta as unknown) as Record<string, string>)[f.key] || ''}
                                    onChange={e => {
                                      const copy = { ...planAccion };
                                      const arr = [...copy.metas_institucionales];
                                      arr[i] = { ...arr[i], [f.key]: e.target.value };
                                      copy.metas_institucionales = arr;
                                      setPlanAccion(copy);
                                    }}
                                    style={{ ...inputStyle, minHeight: '70px', fontSize: '13px' }}
                                  />
                                ) : (
                                  <input
                                    value={((meta as unknown) as Record<string, string>)[f.key] || ''}
                                    onChange={e => {
                                      const copy = { ...planAccion };
                                      const arr = [...copy.metas_institucionales];
                                      arr[i] = { ...arr[i], [f.key]: e.target.value };
                                      copy.metas_institucionales = arr;
                                      setPlanAccion(copy);
                                    }}
                                    style={{ ...inputStyle, fontSize: '13px' }}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ gridColumn: '1/-1' }}><strong>Meta:</strong> {meta.meta}</div>
                            <div style={{ gridColumn: '1/-1' }}><strong>Estrategia:</strong> {meta.estrategia}</div>
                            <div><strong>Responsable:</strong> {meta.personal_designado}</div>
                            <div><strong>Período:</strong> {meta.periodo_inicio} — {meta.periodo_fin}</div>
                            <div style={{ gridColumn: '1/-1' }}><strong>Entregable:</strong> {meta.entregable}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Metas personales */}
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8', margin: '20px 0 12px' }}>
                    Metas Individuales del Personal ({planAccion.metas_personales.length} personas)
                  </h4>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {planAccion.metas_personales.map((mp, i) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '10px', padding: '10px', background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.07)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: '200px' }}>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#818cf8' }}>{mp.nombre}</div>
                          <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)' }}>{mp.cargo}</div>
                        </div>
                        <div style={{ flex: 1, fontSize: '12px' }}>
                          {editingPersonal === i ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {[
                                { key: 'meta_individual', label: 'Meta individual' },
                                { key: 'entregable', label: 'Entregable' },
                                { key: 'periodo', label: 'Período' },
                              ].map(f => (
                                <div key={f.key}>
                                  <label style={{ ...labelStyle, fontSize: '11px' }}>{f.label}</label>
                                  <textarea
                                    value={((mp as unknown) as Record<string, string>)[f.key] || ''}
                                    onChange={e => {
                                      const copy = { ...planAccion };
                                      const arr = [...copy.metas_personales];
                                      arr[i] = { ...arr[i], [f.key]: e.target.value };
                                      copy.metas_personales = arr;
                                      setPlanAccion(copy);
                                    }}
                                    style={{ ...inputStyle, minHeight: '50px', fontSize: '12px' }}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div>
                              <div><strong>Meta:</strong> {mp.meta_individual}</div>
                              <div style={{ marginTop: '4px' }}><strong>Entregable:</strong> {mp.entregable}</div>
                              <div style={{ marginTop: '4px', color: 'var(--c-text-muted)' }}>Período: {mp.periodo}</div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingPersonal(editingPersonal === i ? null : i)}
                          style={{ background: 'rgba(99,102,241,0.3)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', alignSelf: 'flex-start', flexShrink: 0 }}
                        >
                          {editingPersonal === i ? '✓ OK' : '✏️'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={async () => {
                      if (!projectId) return;
                      setSaving(true);
                      await fetch(`/api/pmc/${projectId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ plan_accion: planAccion }),
                      });
                      setSaving(false);
                    }}
                    style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                    disabled={saving}
                  >
                    {saving ? 'Guardando...' : '💾 Guardar cambios del plan'}
                  </button>
                </div>
              )}
              {generating === 'plan_accion' && (
                <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
                  <p style={{ fontWeight: 600, color: '#818cf8' }}>Generando plan de acción...</p>
                  <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)' }}>La IA está creando metas SMART para {totalStaff} trabajadores y {categoriasPriorizadas.length} categorías</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 5: Revisión y exportar ───────────────────────────── */}
        {activeStep === 5 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 5: Revisión Final y Exportación
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Tu PMC está completo. Descarga los documentos oficiales para su entrega a la supervisión.
            </p>

            {/* Summary card */}
            <div style={{ ...sectionCard, background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(79,70,229,0.2) 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>✅ PMC Completado</h3>
              <p style={{ fontSize: '14px', opacity: 0.85, margin: '0 0 16px' }}>
                {schoolName} · CCT: {schoolCct} · Ciclo {cicloEscolar}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Trabajadores con meta', value: planAccion?.metas_personales.length || 0 },
                  { label: 'Metas institucionales', value: planAccion?.metas_institucionales.length || 0 },
                  { label: 'Categorías priorizadas', value: categoriasPriorizadas.length },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stat.value}</div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Banner de Advertencia de Calidad Normativa si cobertura < 80% */}
            {isLowCoverage && (
              <div style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div style={{ flex: 1, fontSize: '13px', color: '#fef3c7', lineHeight: 1.4 }}>
                  <strong>Advertencia de Calidad Normativa (C10):</strong> Cobertura de metas del personal al{' '}
                  <strong style={{ color: '#fbbf24' }}>{coveragePercent}%</strong> ({personalWithGoals} de {realStaffCount} trabajadores). La norma SEP Puebla / SEMS recomienda al menos 80% de corresponsabilidad docente. Puedes descargar de todos modos o volver al Paso 4.
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  style={{
                    flexShrink: 0,
                    padding: '7px 14px',
                    background: 'rgba(245,158,11,0.25)',
                    border: '1px solid rgba(245,158,11,0.45)',
                    borderRadius: '6px',
                    color: '#fef3c7',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ← Paso 4: Completar
                </button>
              </div>
            )}

            {/* Download buttons */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '16px' }}>📥 Documentos para descargar</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: '4px' }}>📕 PMC Oficial en PDF (Formato SEP Puebla)</div>
                    <div style={{ fontSize: '13px', color: 'rgba(240,244,255,0.7)' }}>Documento PDF inmutable con membrete oficial del Gobierno de Puebla, escudos oficiales SEP, matriz FODA, metas y bloque de 3 firmas listo para impresión o firma electrónica.</div>
                  </div>
                  <a
                    href={`/api/pdf/pmc/${projectId}`}
                    onClick={(e) => handleExportWithCoverageCheck(e, `/api/pdf/pmc/${projectId}`)}
                    className="btn btn-primary"
                    style={{ flexShrink: 0, backgroundColor: '#c0392b', borderColor: '#c0392b', color: '#fff', fontWeight: 600, textDecoration: 'none' }}
                  >
                    ↓ Descargar PDF Oficial
                  </a>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#818cf8', marginBottom: '4px' }}>📄 PMC Completo (Word Editable)</div>
                    <div style={{ fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>Documento Word (.docx) editable con todas las secciones para realizar ajustes manuales si se requieren.</div>
                  </div>
                  <a
                    href={`/api/docx/pmc/${projectId}`}
                    onClick={(e) => handleExportWithCoverageCheck(e, `/api/docx/pmc/${projectId}`)}
                    className="btn btn-primary"
                    style={{ flexShrink: 0, backgroundColor: 'var(--c-navy)', borderColor: 'var(--c-navy)', textDecoration: 'none' }}
                  >
                    ↓ Descargar Word
                  </a>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>📋 Plantilla: Informe Parcial de Avance</div>
                    <div style={{ fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>
                      Formato personalizado para el seguimiento a mitad de ciclo. Incluye las metas de tu PMC con espacios para registrar los avances y evidencias reales.
                    </div>
                    <div style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '4px 8px', borderRadius: '4px', marginTop: '6px', display: 'inline-block' }}>
                      ⚠️ Este documento lo debe completar el personal con evidencias reales — NO es generado por IA
                    </div>
                  </div>
                  <a
                    href={`/api/docx/pmc/${projectId}/informe-parcial`}
                    className="btn btn-sm"
                    style={{ flexShrink: 0, background: 'rgba(14,165,233,0.25)', border: '1px solid rgba(14,165,233,0.4)', color: '#38bdf8', textDecoration: 'none' }}
                  >
                    ↓ Informe Parcial
                  </a>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>📋 Plantilla: Informe Final</div>
                    <div style={{ fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>
                      Formato para el informe anual al cierre del ciclo escolar. Incluye todas las metas institucionales e individuales con espacios para evidencias y conclusiones.
                    </div>
                    <div style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '4px 8px', borderRadius: '4px', marginTop: '6px', display: 'inline-block' }}>
                      ⚠️ Este documento lo debe completar el personal con evidencias reales — NO es generado por IA
                    </div>
                  </div>
                  <a
                    href={`/api/docx/pmc/${projectId}/informe-final`}
                    className="btn btn-sm"
                    style={{ flexShrink: 0, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', textDecoration: 'none' }}
                  >
                    ↓ Informe Final
                  </a>
                </div>
              </div>
            </div>

            <div style={{ ...sectionCard, background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fcd34d', marginBottom: '8px' }}>📌 Instrucciones para los Informes</h3>
              <ul style={{ fontSize: '13px', color: 'rgba(240,244,255,0.75)', paddingLeft: '18px', margin: 0, lineHeight: '1.8' }}>
                <li>El <strong>Informe Parcial</strong> se entrega aproximadamente a mitad del ciclo escolar (enero-febrero 2026)</li>
                <li>El <strong>Informe Final</strong> se entrega al cierre del ciclo escolar (junio-julio 2026)</li>
                <li>Cada trabajador debe registrar sus avances con <strong>evidencias documentales reales</strong> (no fotografías solas)</li>
                <li>El director(a) consolida los informes individuales y elabora el informe institucional final</li>
                <li>Los informes deben ser firmados por el director y validados por el supervisor de zona</li>
              </ul>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--c-border)', paddingTop: '16px' }}>
          {activeStep > 1 ? (
            <button onClick={handleBack} disabled={saving} className="btn btn-secondary">
              ← Anterior
            </button>
          ) : (
            <Link href={`/${locale}/pmc`} className="btn btn-secondary">← Cancelar</Link>
          )}

          {activeStep < 5 && (
            <button onClick={handleNext} disabled={saving || generating !== null} className="btn btn-primary">
              {saving ? 'Guardando...' : activeStep === 4 ? '✓ Finalizar PMC' : 'Siguiente →'}
            </button>
          )}
          {activeStep === 5 && (
            <Link href={`/${locale}/pmc`} className="btn btn-primary">
              Ir a mis PMC →
            </Link>
          )}
        </div>

        {/* MODAL DE CONSULTA DE CARTOGRAFÍA DE ZONA */}
        {showZonaModal && zonaData?.zona && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}>
            <div style={{
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '16px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                    🗺️ Cartografía de Zona {zonaData.zona.identificacion.zonaNumero}
                  </h3>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Supervisor(a): <strong style={{ color: '#e2e8f0' }}>{zonaData.zona.identificacion.supervisorName}</strong> · Clave: {zonaData.zona.identificacion.zonaClave}
                  </span>
                </div>
                <button
                  onClick={() => setShowZonaModal(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Metas CREAA */}
              {zonaData.zona.momento5Metas?.metaGeneralZona && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
                    🎯 Meta Estratégica de Zona (Fórmula CREAA):
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#e0e7ff', lineHeight: 1.4 }}>
                    {zonaData.zona.momento5Metas.metaGeneralZona}
                  </p>
                </div>
              )}

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
                      <strong style={{ fontSize: '14px', color: '#34d399' }}>{zonaData.plantel.eficienciaTerminal}%</strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Reprobación</span>
                      <strong style={{ fontSize: '14px', color: '#f87171' }}>{zonaData.plantel.reprobacion}%</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnóstico Territorial */}
              {zonaData.zona.momento3Territorio?.descripcionTerritorial && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>
                    📍 Diagnóstico Territorial Sugerido (Momento 3):
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {zonaData.zona.momento3Territorio.descripcionTerritorial}
                  </p>
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
                  ✨ Aplicar sugerencias de zona a mi PMC
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Revisión y Confirmación de PMC Anterior Extraído */}
        {showPmcReviewModal && parsedPmcData && (
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
                    📄 Revisión de Datos Extraídos del PMC Anterior
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Revisa la información extraída automáticamente antes de pre-llenar los campos del wizard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPmcReviewModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              {/* Plantel */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>🏫 Datos del Plantel</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '12px' }}>
                  <div><strong style={{ color: '#94a3b8' }}>Plantel:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.schoolName || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>CCT:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.schoolCct || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Director:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.directorName || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Supervisor:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.supervisorName || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Zona:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.schoolZone || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Municipio:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.municipality || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Ciclo Escolar:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.cicloEscolar || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Subsistema:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.subsystem || 'BGE'}</span></div>
                </div>
              </div>

              {/* Personal */}
              {parsedPmcData.staffData && parsedPmcData.staffData.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>
                    👥 Plantilla Docente y Administrativa ({parsedPmcData.staffData.length} miembros detectados)
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                    {parsedPmcData.staffData.map((s: PmcPreviousExtractStaff, idx: number) => (
                      <span key={idx} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', color: '#c7d2fe', border: '1px solid rgba(99,102,241,0.25)' }}>
                        {s.nombre} ({s.cargo})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnóstico Comunidad */}
              {parsedPmcData.diagnosticoComunidad && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>🌱 Diagnóstico Comunitario Detectado</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', maxHeight: '100px', overflowY: 'auto', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                    {parsedPmcData.diagnosticoComunidad}
                  </p>
                </div>
              )}

              {/* Indicadores Académicos */}
              {parsedPmcData.indicadores && Object.values(parsedPmcData.indicadores).some(v => v !== null && v !== undefined) && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>📊 Indicadores Académicos</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Aprobación</span>
                      <strong style={{ fontSize: '13px', color: '#34d399' }}>{parsedPmcData.indicadores.aprobacion_ant ?? '-'}%</strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Reprobación</span>
                      <strong style={{ fontSize: '13px', color: '#f87171' }}>{parsedPmcData.indicadores.reprobacion_ant ?? '-'}%</strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Abandono</span>
                      <strong style={{ fontSize: '13px', color: '#fbbf24' }}>{parsedPmcData.indicadores.abandono_ant ?? '-'}%</strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Efic. Terminal</span>
                      <strong style={{ fontSize: '13px', color: '#38bdf8' }}>{parsedPmcData.indicadores.et_ant ?? '-'}%</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Metas del Plan de Acción Previo */}
              {parsedPmcData.metas_institucionales_previas && parsedPmcData.metas_institucionales_previas.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>
                    🎯 Metas del Plan de Acción Previo ({parsedPmcData.metas_institucionales_previas.length} detectadas)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                    {parsedPmcData.metas_institucionales_previas.map((m, idx: number) => (
                      <div key={idx} style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '4px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                        <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{m.categoria} · {m.tema}:</span>{' '}
                        <span style={{ color: '#f0f4ff' }}>{m.meta}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botones de acción modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowPmcReviewModal(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #475569', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyParsedPmc}
                  style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ✓ Aplicar al Formulario de PMC
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Importación desde PAEC */}
        {showPaecImportModal && (
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
              border: '1px solid rgba(16,185,129,0.4)',
              borderRadius: '16px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#f0f4ff', fontWeight: 700 }}>
                    📥 Importar Diagnóstico desde PAEC del Plantel
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Reutiliza el diagnóstico territorial, la problemática comunitaria y datos del plantel validados.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaecImportModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              {loadingPaecList ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#a5b4fc', fontSize: '13px' }}>
                  🔍 Consultando proyectos PAEC del plantel...
                </div>
              ) : paecProjectsList.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                  No se encontraron proyectos PAEC registrados para este CCT o usuario.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#c7d2fe' }}>
                    Selecciona el proyecto PAEC fuente:
                  </label>
                  <select
                    value={selectedPaecToImport?.id || ''}
                    onChange={(e) => {
                      const found = paecProjectsList.find(p => p.id === e.target.value);
                      setSelectedPaecToImport(found || null);
                    }}
                    style={{ ...inputStyle, background: '#1e293b' }}
                  >
                    {paecProjectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectName} ({p.cycleType === 'annual' ? 'Anual' : `Semestre ${p.cycleType}`})
                      </option>
                    ))}
                  </select>

                  {selectedPaecToImport && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '8px' }}>
                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ fontSize: '12px', color: '#34d399', display: 'block' }}>Problemática Comunitaria Central:</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#f0f4ff', lineHeight: 1.4 }}>
                          {selectedPaecToImport.problemStatement || 'Sin descripción'}
                        </p>
                      </div>
                      {selectedPaecToImport.communityContext?.context && (
                        <div>
                          <strong style={{ fontSize: '12px', color: '#38bdf8', display: 'block' }}>Contexto Territorial de la Comunidad:</strong>
                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#cbd5e1', maxHeight: '100px', overflowY: 'auto', lineHeight: 1.4 }}>
                            {selectedPaecToImport.communityContext.context}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowPaecImportModal(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #475569', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedPaecToImport}
                  onClick={handleApplyPaecToPmc}
                  style={{
                    padding: '8px 20px',
                    background: selectedPaecToImport ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: selectedPaecToImport ? 'pointer' : 'not-allowed',
                  }}
                >
                  ✓ Importar al Diagnóstico del PMC
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Informativo de Cobertura de Metas (C10 / D6 - Jamás bloquear export) */}
        {showCoverageModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
            backdropFilter: 'blur(5px)',
          }}>
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#fef3c7', fontWeight: 700 }}>
                    Recomendación de Calidad Normativa (C10)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCoverageModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: '10px', padding: '14px', marginBottom: '18px', border: '1px solid rgba(245,158,11,0.2)' }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#fef3c7', lineHeight: 1.5 }}>
                  La cobertura actual de metas individuales es del <strong>{coveragePercent}%</strong> ({personalWithGoals} de {realStaffCount} trabajadores registrados con meta formulada).
                </p>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Los lineamientos normativos de la SEP Puebla / SEMS recomiendan una cobertura de al menos el <strong>80%</strong> de la plantilla para asegurar la corresponsabilidad escolar.
                </p>
              </div>

              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.4 }}>
                Puedes descargar el documento ahora mismo o regresar al Paso 4 para complementar las metas de los trabajadores faltantes.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleGoToStep4}
                  style={{
                    padding: '9px 16px',
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: '8px',
                    color: '#c7d2fe',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ← Completar metas (Paso 4)
                </button>
                <button
                  type="button"
                  onClick={handleProceedDownload}
                  style={{
                    padding: '9px 18px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Descargar de todos modos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
