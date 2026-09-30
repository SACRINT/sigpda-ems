'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SchoolZoneContextResponse } from '@/lib/zone-sync-service';
import { formatZoneMetric } from '@/lib/zone-metric-format';
import { useAssistant } from '@/components/assistant';
import {
  PMC_CATEGORIAS_OFICIALES,
  normalizePmcCategoria,
} from '@/lib/constants/pmc-categorias';
import { toRealNumber } from '@/lib/numeric-guard';
import { computeCoverage } from '@/lib/coverage-core';
import { reconcilePmcStaff, derivePersonalMetasFromStaff, normalizeStaffName } from '@/lib/pmc/staff-reconciler';
import {
  deduplicateMetasInstitucionales,
  computeMetaSimilarity,
  normalizeMetaText,
} from '@/lib/pmc-meta-deduplicator';
import {
  mergePaecIntoDiagnostic,
  preservePaecOnPmcLoad,
  buildPaecDiagnosticParts,
  countPlantelFields,
  getPaecIngestionSummary,
} from '@/lib/pmc/paec-diagnostic-fusion';
import {
  mapFinAnteriorToIndicadores,
  mapInicioActualToIndicadores,
  mapInicioAnteriorToIndicadores,
} from '@/lib/pmc/indicadores-mapping';
import {
  deriveMetasPreviasFromElementos,
  deriveElementosFromMetasPrevias,
  calculatePmcCoverage,
} from '@/lib/pmc/plan-element-normalizer';
import type {
  PmcAuditCalculationEntry,
  PmcMetaAsignaturaDTO,
} from '@/types/pmc';

export type DirectorSource = 'manual' | 'bd' | 'f11' | '911' | 'paec' | 'pmc_anterior' | 'draft' | 'none';

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
  horas_base?: number | string | null;
  meta_individual?: string;
  metas_individuales?: MetaIndividual[];
  asignaturas?: string;
  grupos?: string;
}

export interface IndicadoresAcademicos {
  matricula?: number;
  matriculaAnterior?: number;
  matriculaInicioCicloAnterior?: number;
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
  totalAlumnosF11?: number;
  aprobados?: number;
  regulares?: number;
  irregulares?: number;
  reprobados?: number;
  bajas?: number;
  porcentajes?: {
    aprobados?: number;
    regulares?: number;
    irregulares?: number;
    reprobados?: number;
    bajas?: number;
  };
  reprobacionPorMateria?: PmcMetaAsignaturaDTO[];
  _calc?: Record<string, PmcAuditCalculationEntry>;
  metas_confirmadas?: boolean;
  existenciaFin?: number;
  bajasDefinitivas?: number;
  altas?: number;
  baselineWarning?: string;
  crossChecks?: {
    alumnosF11?: number;
    existencia911?: number;
    bajasF11?: number;
    bajas911?: number;
    mensaje?: string;
  };
  f11_warnings?: string[];
  ingest_coverage?: IngestCoverageData;
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
  continuidad_de?: string; // H-052: Enlace estructural para rastrear meta previa adaptada
  accion_especifica?: string;
  finalidad?: string;
  necesidad?: string;
  proceso_evaluacion?: string;
  subcategorias_vinculadas?: string[];
  estrategias_seguimiento?: string;
  observaciones?: string;
}

/**
 * Sintetiza una estrategia situada en 3 etapas conforme a lineamientos oficiales DBEPA / MCCEMS
 * cuando una meta previa carece de estrategia explícita en el documento de origen.
 */
export function generarEstrategiaSituada(categoria?: string, meta?: string): string {
  const normCat = normalizeMetaText(categoria || '');
  const normMeta = normalizeMetaText(meta || '');

  if (
    normCat.includes('socioemocional') ||
    normMeta.includes('socioemocional') ||
    normMeta.includes('ballet') ||
    normMeta.includes('verde') ||
    normMeta.includes('bienestar') ||
    normMeta.includes('violencia') ||
    normMeta.includes('salud')
  ) {
    return '1. Diagnóstico participativo y calendarización de actividades formativas y socioemocionales. 2. Operación continua de talleres, dinámicas de convivencia y círculos de apoyo. 3. Evaluación de impacto y recopilación de memorias gráficas y listas de asistencia.';
  }
  if (
    normCat.includes('gestion') ||
    normMeta.includes('convenio') ||
    normMeta.includes('patrulla') ||
    normMeta.includes('egresad') ||
    normMeta.includes('desempeno') ||
    normMeta.includes('observar')
  ) {
    return '1. Formalización de acuerdos, convenios e instrumentos de gestión institucional. 2. Acompañamiento, visitas programadas y seguimiento periódico de compromisos. 3. Sistematización de evidencias, oficios firmados y reporte al Consejo Técnico.';
  }
  if (
    normMeta.includes('electrica') ||
    normMeta.includes('bano') ||
    normMeta.includes('alumbrado') ||
    normCat.includes('infraestructura')
  ) {
    return '1. Cuantificación técnica de requerimientos y presupuesto participativo. 2. Adquisición supervisada de materiales y ejecución colaborativa de trabajos técnicos. 3. Verificación de funcionalidad operativa y acta de entrega-recepción.';
  }
  if (
    normCat.includes('academico') ||
    normMeta.includes('reprobacion') ||
    normMeta.includes('aprobacion') ||
    normMeta.includes('curso') ||
    normMeta.includes('cosfac') ||
    normMeta.includes('lecto') ||
    normMeta.includes('planea')
  ) {
    return '1. Aplicación de diagnóstico inicial e identificación de necesidades académicas formativas. 2. Sesiones programadas de asesoría, regularización y módulos de estudio continuo. 3. Evaluación periódica de avances y concentrado estadístico de resultados.';
  }
  return '1. Planeación situada y acuerdos formales con la comunidad escolar. 2. Implementación continua de acciones formativas con acompañamiento pedagógico. 3. Evaluación de entregables y recopilación de evidencias comprobables.';
}

export function isPreviousMetaAdapted(
  mp: { meta?: string; texto_original?: string },
  metasInstitucionales?: Array<{ meta: string; continuidad_de?: string }>,
  index?: number
): boolean {
  if (!metasInstitucionales || metasInstitucionales.length === 0) return false;
  const mpKey = mp.meta ? mp.meta.trim().toLowerCase() : (index !== undefined ? `meta_previa_${index}` : '');
  const origKey = mp.texto_original ? mp.texto_original.trim().toLowerCase() : '';
  const normMp = normalizeMetaText(mp.meta || mp.texto_original || '');

  return metasInstitucionales.some((m) => {
    const contDe = m.continuidad_de ? m.continuidad_de.trim().toLowerCase() : '';
    if (contDe) {
      if (origKey && contDe === origKey) return true;
      if (mpKey && contDe === mpKey) return true;
    }
    if (mp.meta && m.meta === `[Continuidad 2026-2027] ${mp.meta}`) {
      return true;
    }
    if (mpKey && m.meta.trim().toLowerCase() === mpKey) {
      return true;
    }
    if (origKey && m.meta.trim().toLowerCase() === origKey) {
      return true;
    }
    // H-283 / H-289: Coincidencia semántica con deduplicateMetasInstitucionales para evitar botones inactivos
    if (normMp) {
      const normM = normalizeMetaText(m.meta);
      if (normM === normMp || computeMetaSimilarity(m.meta, mp.meta || mp.texto_original) >= 0.60) {
        return true;
      }
    }
    return false;
  });
}

export interface IngestCoverageData {
  detectados: number | null;
  extraidos: number;
  parcial: boolean;
  indeterminada?: boolean;
  ratio?: number;
  esperado?: number;
  detalles?: {
    metas: { detectados: number | null; extraidos: number; parcial: boolean };
    actividades: { detectados: number | null; extraidos: number; parcial: boolean };
  };
}

export function buildIndicadoresPayload(
  indicadores: IndicadoresAcademicos,
  metasConfirmadas: boolean,
  ingestCoverage?: IngestCoverageData | null,
  f11Warnings?: string[]
): IndicadoresAcademicos & {
  metas_confirmadas: boolean;
  ingest_coverage?: IngestCoverageData;
  f11_warnings?: string[];
} {
  // H-252: Excluir f11_warnings e ingest_coverage del clon de indicadores para evitar
  // que arrastren valores hidratados cuando se limpia el estado en el cliente.
  const baseIndicadores: IndicadoresAcademicos = { ...indicadores };
  delete baseIndicadores.f11_warnings;
  delete baseIndicadores.ingest_coverage;

  return {
    ...baseIndicadores,
    metas_confirmadas: metasConfirmadas,
    ...(ingestCoverage ? { ingest_coverage: ingestCoverage } : {}),
    ...(f11Warnings && f11Warnings.length > 0 ? { f11_warnings: f11Warnings } : {}),
  };
}

export function buildPmcSaveBody(
  method: 'POST' | 'PUT',
  baseFields: Record<string, unknown>,
  payload: Partial<PmcProject>,
  indicadoresBody: ReturnType<typeof buildIndicadoresPayload>
): Record<string, unknown> {
  if (method === 'POST') {
    return {
      ...baseFields,
      ...payload,
      indicadores_academicos: indicadoresBody,
    };
  }
  return {
    ...baseFields,
    ...payload,
    indicadores_academicos: indicadoresBody,
  };
}

export function format911FinAnteriorBanner(
  data: Parameters<typeof mapFinAnteriorToIndicadores>[0],
  currentIndicadores: IndicadoresAcademicos
): { banner: string; mapped: IndicadoresAcademicos } {
  const mappedSnapshot = mapFinAnteriorToIndicadores(data, currentIndicadores);
  const calculatedEt = mappedSnapshot.et_ant;
  const calculatedAb = mappedSnapshot.abandono_ant;
  const etStr = calculatedEt !== undefined ? `${calculatedEt}%` : 'N/D';
  const abStr = calculatedAb !== undefined ? `${calculatedAb}%` : 'N/D';
  return {
    banner: `✓ 911 (Fin Ciclo Anterior) cargada: Abandono ${abStr}, Eficiencia Terminal ${etStr}`,
    mapped: mappedSnapshot,
  };
}

export function extractF11Warnings(jsonResponse?: { warnings?: string[]; [key: string]: unknown } | null): string[] {
  if (jsonResponse && Array.isArray(jsonResponse.warnings) && jsonResponse.warnings.length > 0) {
    return jsonResponse.warnings;
  }
  return [];
}

export function validateCanGenerateStep(
  step: string,
  metasConfirmadas: boolean,
  ingestCoverage?: { parcial?: boolean } | null,
  allowPartialGeneration?: boolean
): { allowed: boolean; error?: string } {
  if (step === 'diagnostico' || step === 'plan_accion') {
    if (!metasConfirmadas) {
      return {
        allowed: false,
        error: 'Debes confirmar las metas del ciclo en el Paso 3 antes de generar con Inteligencia Artificial.',
      };
    }
    if (ingestCoverage?.parcial && !allowPartialGeneration) {
      return {
        allowed: false,
        error: 'El PMC previo tiene una cobertura de extracción parcial (<90%). Puedes marcar la casilla de autorización en el panel para continuar con los datos actuales.',
      };
    }
  }
  return { allowed: true };
}

interface MetaPersonal {
  nombre: string;
  cargo: string;
  categoria?: string;
  tema?: string;
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

export interface PmcProject {
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
  const [directorSource, setDirectorSource] = useState<DirectorSource>(
    existingProject?.director_name ? 'bd' : savedDraft?.directorName ? 'draft' : 'none'
  );
  const [directorMismatchWarning, setDirectorMismatchWarning] = useState<string | null>(null);
  const [alternativeDirector, setAlternativeDirector] = useState<{ name: string; source: DirectorSource } | null>(null);
  const [isPlatformPmcDoc, setIsPlatformPmcDoc] = useState(false);
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
  regulares?: number;
  irregulares?: number;
  aprobados?: number;
  reprobados?: number;
  bajas?: number;
  sinCalificacion?: number;
  porcentajes?: {
    aprobados: number;
    regulares: number;
    irregulares: number;
    reprobados: number;
    bajas: number;
  };
  reprobacionPorMateria?: PmcMetaAsignaturaDTO[];
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
  matriculaAnterior?: number;
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
  elementos_plan?: Array<{
    tipo: 'meta' | 'actividad' | 'estrategia' | 'indicador' | 'responsable' | 'evidencia' | 'cronograma' | 'otro';
    texto_original: string;
    texto_normalizado: string;
    categoria?: string;
    tema?: string;
    responsable?: string;
    periodo?: string;
    ubicacion?: {
      pagina?: number;
      seccion?: string;
      tabla?: string;
    };
    requiere_revision?: boolean;
  }>;
  metas_institucionales_previas?: Array<{
    categoria?: string;
    tema?: string;
    meta?: string;
    texto_original?: string;
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
  totales_detectados?: { metas?: number | null; actividades?: number | null } | null;
  expectedActivities?: number;
}

interface EditablePlanElement {
  tipo: 'meta' | 'actividad' | 'estrategia' | 'indicador' | 'responsable' | 'evidencia' | 'cronograma' | 'otro';
  texto_original: string;
  texto_normalizado: string;
  categoria?: string;
  tema?: string;
  responsable?: string;
  periodo?: string;
  requiere_revision?: boolean;
}

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

  const triggerUpload911 = (momento: 'inicio_anterior' | 'fin_anterior' | 'inicio_actual') => {
    uploadMomentoRef.current = momento;
    setActiveMomento911(momento);
    fileInput911Ref.current?.click();
  };

  const handleUploadPreviousPmc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPlatformDoc = file.name.startsWith('PMC_Oficial_') || file.name.includes('PMC_Oficial_');
    setIsPlatformPmcDoc(isPlatformDoc);
    setUploadingPmc(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/pmc/parse-previous', {
        method: 'POST',
        body: formData,
      });
      const json = await parseSafeApiResponse<{
        success?: boolean;
        error?: string;
        data?: PmcPreviousExtractDTO;
        warnings?: string[];
        coverage?: {
          detectados: number | null;
          extraidos: number;
          parcial: boolean;
          indeterminada?: boolean;
          ratio?: number;
          esperado?: number;
          detalles?: {
            metas: { detectados: number | null; extraidos: number; parcial: boolean; indeterminada?: boolean };
            actividades: { detectados: number | null; extraidos: number; parcial: boolean; indeterminada?: boolean };
          };
        };
      }>(
        res,
        'Error al analizar el documento anterior.'
      );
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al analizar el documento.');
      }
      const rawElementos = (json.data?.elementos_plan && json.data.elementos_plan.length > 0)
        ? json.data.elementos_plan
        : deriveElementosFromMetasPrevias(json.data?.metas_institucionales_previas || []);

      const elementsToEdit: EditablePlanElement[] = rawElementos.map(e => ({
        tipo: (e.tipo as EditablePlanElement['tipo']) || 'otro',
        texto_original: e.texto_original || '',
        texto_normalizado: e.texto_normalizado || e.texto_original || '',
        categoria: e.categoria || '',
        tema: e.tema || '',
        responsable: e.responsable || '',
        periodo: e.periodo || '',
        requiere_revision: Boolean(e.requiere_revision),
      }));

      const warningsList = Array.isArray(json.warnings) ? [...json.warnings] : [];
      if (isPlatformDoc) {
        warningsList.unshift('Documento generado por la plataforma detectado ("PMC_Oficial_"): se omiten director e indicadores para evitar sobreescritura recursiva.');
      }

      setParsedPmcData(json.data as PmcPreviousExtractDTO);
      setEditableElementosPlan(elementsToEdit);
      setIngestWarnings(warningsList);
      setIngestCoverage(json.coverage || null);
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
    setDirectorSource('manual');
    setDirectorMismatchWarning(null);
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

  const updateEditableElemento = (index: number, patch: Partial<EditablePlanElement>) => {
    setEditableElementosPlan(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...patch };
      }
      return next;
    });
  };

  const handleApplyParsedPmc = () => {
    if (!parsedPmcData) return;
    if (parsedPmcData.schoolName) setSchoolName(parsedPmcData.schoolName);
    if (parsedPmcData.schoolCct) setSchoolCct(parsedPmcData.schoolCct);
    if (parsedPmcData.municipality) setMunicipality(parsedPmcData.municipality);
    if (parsedPmcData.locality) setLocality(parsedPmcData.locality);
    if (parsedPmcData.schoolZone) setSchoolZone(parsedPmcData.schoolZone);
    if (!isPlatformPmcDoc && parsedPmcData.directorName) {
      const docDir = parsedPmcData.directorName.trim();
      if (directorName && docDir.toLowerCase() !== directorName.trim().toLowerCase()) {
        setAlternativeDirector({ name: directorName, source: directorSource });
      }
      setDirectorName(docDir);
      setDirectorSource('pmc_anterior');
      setDirectorMismatchWarning(null);
    }
    if (parsedPmcData.supervisorName) setSupervisorName(parsedPmcData.supervisorName);
    if (parsedPmcData.cicloEscolar) setCicloEscolar(parsedPmcData.cicloEscolar);
    if (parsedPmcData.subsystem) setSubsystem(parsedPmcData.subsystem);

    const effDirector = (!isPlatformPmcDoc && parsedPmcData.directorName) || directorName;
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

    // Derivar y precargar metas individuales SMART para la plantilla consolidada
    const derivedFromExtract = derivePersonalMetasFromStaff(
      reconciled.staff,
      parsedPmcData.cicloEscolar || cicloEscolar
    );
    setPlanAccion(prev => ({
      metas_institucionales: prev?.metas_institucionales || [],
      metas_personales: derivedFromExtract,
    }));

    // C1: Derivar metas e insumos a partir de los elementos editados por el usuario
    const finalElementsForDerivation = editableElementosPlan.map(e => ({
      tipo: e.tipo,
      texto_original: e.texto_original,
      texto_normalizado: e.texto_normalizado,
      categoria: e.categoria || '',
      tema: e.tema || '',
      responsable: e.responsable || '',
      periodo: e.periodo || '',
      ubicacion: {},
      requiere_revision: e.requiere_revision || false,
    }));

    const derivedFromEdited = deriveMetasPreviasFromElementos(
      finalElementsForDerivation,
      parsedPmcData.metas_institucionales_previas
    );

    // Adjuntar texto_original a cada meta para trazabilidad H-052 en panel de continuidad
    const metasWithOriginal = derivedFromEdited.map(dm => {
      const matchingElem = finalElementsForDerivation.find(
        fe => fe.tipo === 'meta' && (fe.texto_normalizado === dm.meta || fe.texto_original === dm.meta)
      );
      return {
        ...dm,
        texto_original: matchingElem?.texto_original || dm.meta,
      };
    });

    if (metasWithOriginal.length > 0) {
      setMetasPreviasReferencia(metasWithOriginal);
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
      setDiagnosticoComunidad(prev => preservePaecOnPmcLoad(parsedPmcData.diagnosticoComunidad!, prev));
    }

    // H-218: Merge POR CAMPO de indicadores. PMC anterior solo llena campos vacíos y no pisa F11/911.
    if (!isPlatformPmcDoc && parsedPmcData.indicadores) {
      const ind = parsedPmcData.indicadores;
      setIndicadores(prev => ({
        ...prev,
        matricula: prev.matricula ?? toRealNumber(ind.matricula),
        matricula_meta: prev.matricula_meta ?? toRealNumber(ind.matricula_meta),
        aprobacion_ant: prev.aprobacion_ant ?? toRealNumber(ind.aprobacion_ant),
        aprobacion_meta: prev.aprobacion_meta ?? toRealNumber(ind.aprobacion_meta),
        reprobacion_ant: prev.reprobacion_ant ?? toRealNumber(ind.reprobacion_ant),
        reprobacion_meta: prev.reprobacion_meta ?? toRealNumber(ind.reprobacion_meta),
        abandono_ant: prev.abandono_ant ?? toRealNumber(ind.abandono_ant),
        abandono_meta: prev.abandono_meta ?? toRealNumber(ind.abandono_meta),
        et_ant: prev.et_ant ?? toRealNumber(ind.et_ant),
        et_meta: prev.et_meta ?? toRealNumber(ind.et_meta),
        promedio_f11: prev.promedio_f11 ?? toRealNumber(ind.promedio_f11),
        promedio_meta: prev.promedio_meta ?? toRealNumber(ind.promedio_meta),
      }));
    }

    if (parsedPmcData.foda) {
      setFoda(prev => ({
        ...prev,
        ...parsedPmcData.foda,
      }));
    }

    // H-282: Recalcular cobertura viva desde los elementos editados en el modal
    const metasEditadasCount = editableElementosPlan.filter(e => e.tipo === 'meta').length;
    const totalElementosEditados = editableElementosPlan.length;
    const updatedCoverage = calculatePmcCoverage(
      parsedPmcData.totales_detectados,
      metasEditadasCount,
      totalElementosEditados,
      ingestCoverage?.esperado ?? parsedPmcData.expectedActivities
    );
    setIngestCoverage(updatedCoverage);

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
      // H-240 / H-255: capture F11 layout warnings (column mismatch, zip truncation) and surface to user
      const extractedWarnings = extractF11Warnings(json as { warnings?: string[] });
      setF11Warnings(extractedWarnings);
      if (json.data?.schoolName && !schoolName) setSchoolName(json.data.schoolName);
      if (json.data?.schoolCct && !schoolCct) setSchoolCct(json.data.schoolCct);

      const docDirF11 = json.data?.directorName?.trim();
      if (docDirF11) {
        if (directorSource === 'manual') {
          if (directorName && docDirF11.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en F11 ("${docDirF11}") difiere del ingresado manualmente ("${directorName}"). Se mantiene la edición manual.`);
          }
        } else if (directorSource === 'bd') {
          if (directorName && docDirF11.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en F11 ("${docDirF11}") difiere del registrado en BD ("${directorName}"). Se mantiene el valor de BD.`);
          }
        } else {
          setDirectorName(docDirF11);
          setDirectorSource('f11');
          setDirectorMismatchWarning(null);
        }
      }

      if (json.data?.aprobadosPorcentaje !== undefined || json.data?.reprobadosPorcentaje !== undefined || json.data?.promedioGeneral !== undefined) {
        setIndicadores(p => {
          const rawAp = json.data?.aprobadosPorcentaje ?? json.data?.porcentajes?.aprobados;
          const rawRep = json.data?.reprobadosPorcentaje ?? json.data?.porcentajes?.reprobados;
          const aprobAnt = toRealNumber(rawAp) ?? p.aprobacion_ant;
          const reprobAnt = toRealNumber(rawRep) ?? p.reprobacion_ant;
          const aprobMeta = p.aprobacion_meta !== undefined && p.metas_confirmadas
            ? p.aprobacion_meta
            : (aprobAnt !== undefined && !isNaN(aprobAnt)
                ? Math.min(100, Math.round((aprobAnt + 5) * 10) / 10)
                : undefined);
          const reprobMeta = p.reprobacion_meta !== undefined && p.metas_confirmadas
            ? p.reprobacion_meta
            : (aprobMeta !== undefined ? Math.max(0, Math.round((100 - aprobMeta) * 10) / 10) : (reprobAnt !== undefined && !isNaN(reprobAnt) ? Math.max(0, Math.round((reprobAnt - 5) * 10) / 10) : undefined));

          const nowIso = new Date().toISOString();
          const newCalc: Record<string, PmcAuditCalculationEntry> = { ...(p._calc || {}) };
          const reg = json.data?.regulares ?? p.regulares;
          const irreg = json.data?.irregulares ?? p.irregulares;
          const tot = json.data?.totalAlumnos ?? p.totalAlumnosF11 ?? p.matricula;
          const rep = json.data?.reprobados ?? p.reprobados;

          if (aprobAnt !== undefined) {
            const formulaAprob = (reg !== undefined && irreg !== undefined && tot)
              ? `(${reg} Regulares + ${irreg} Irregulares) / ${tot} = ${aprobAnt}%`
              : `Aprobación reportada en F11 = ${aprobAnt}%`;
            newCalc.aprobacion_ant = {
              valor: aprobAnt,
              formula: formulaAprob,
              fuentes: ['F11 Fin Ciclo Anterior'],
              fecha: nowIso,
            };
          }
          if (reprobAnt !== undefined) {
            const formulaReprob = (rep !== undefined && tot)
              ? `${rep} Reprobados / ${tot} = ${reprobAnt}%`
              : `Reprobación reportada en F11 = ${reprobAnt}%`;
            newCalc.reprobacion_ant = {
              valor: reprobAnt,
              formula: formulaReprob,
              fuentes: ['F11 Fin Ciclo Anterior'],
              fecha: nowIso,
            };
          }

          const baj = json.data?.bajas ?? p.bajas;
          const pctReg = json.data?.porcentajes?.regulares;
          const pctIrreg = json.data?.porcentajes?.irregulares;
          const pctBaj = json.data?.porcentajes?.bajas;

          if (reg !== undefined && tot) {
            newCalc.regulares = {
              valor: reg,
              formula: `${reg} alumnos regulares / ${tot} = ${pctReg ?? Number(((reg / tot) * 100).toFixed(1))}%`,
              fuentes: ['F11 Fin Ciclo Anterior'],
              fecha: nowIso,
            };
          }
          if (irreg !== undefined && tot) {
            newCalc.irregulares = {
              valor: irreg,
              formula: `${irreg} alumnos irregulares / ${tot} = ${pctIrreg ?? Number(((irreg / tot) * 100).toFixed(1))}%`,
              fuentes: ['F11 Fin Ciclo Anterior'],
              fecha: nowIso,
            };
          }
          if (baj !== undefined && tot) {
            newCalc.bajas = {
              valor: baj,
              formula: `${baj} bajas registradas ("B") / ${tot} = ${pctBaj ?? Number(((baj / tot) * 100).toFixed(1))}%`,
              fuentes: ['F11 Fin Ciclo Anterior'],
              fecha: nowIso,
            };
          }

          const materias = Array.isArray(json.data?.reprobacionPorMateria)
            ? json.data.reprobacionPorMateria.map(m => ({
                materia: m.materia,
                n: m.n,
                reprobados: m.reprobados,
                porcentaje: m.porcentaje,
                porcentajeAprobacion: m.porcentajeAprobacion,
                metaSugerida: m.metaSugerida,
                metaUsuario: m.metaUsuario !== undefined ? m.metaUsuario : m.metaSugerida,
                metaConfirmada: false,
                detallePorGrupo: m.detallePorGrupo as Record<string, { n: number; reprobados: number; porcentajeReprobacion: number }> | undefined,
              }))
            : p.reprobacionPorMateria;

          return {
            ...p,
            aprobacion_ant: aprobAnt,
            reprobacion_ant: reprobAnt,
            aprobacion_meta: aprobMeta,
            reprobacion_meta: reprobMeta,
            promedio_f11: toRealNumber(json.data?.promedioGeneral) ?? p.promedio_f11,
            matricula: p.matricula || (json.data?.totalAlumnos ? Number(json.data.totalAlumnos) : undefined),
            totalAlumnosF11: json.data?.totalAlumnos ?? p.totalAlumnosF11,
            aprobados: json.data?.aprobados ?? p.aprobados,
            regulares: json.data?.regulares ?? p.regulares,
            irregulares: json.data?.irregulares ?? p.irregulares,
            reprobados: json.data?.reprobados ?? p.reprobados,
            bajas: json.data?.bajas ?? p.bajas,
            porcentajes: json.data?.porcentajes ?? p.porcentajes,
            reprobacionPorMateria: materias,
            _calc: newCalc,
            metas_confirmadas: false,
          };
        });
        setMetasConfirmadas(false);
        setMetasMateriasConfirmadas(false);
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
      setSuccessBanner(`✓ F11 Fin Ciclo Anterior cargado: ${json.data?.totalAlumnos ?? 'N/D'} alumnos evaluados, promedio general ${json.data?.promedioGeneral ?? 'N/D'}`);
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
      if (json.data?.supervisorName && !supervisorName) setSupervisorName(json.data.supervisorName);

      const docDir911 = json.data?.directorName?.trim();
      if (docDir911) {
        if (directorSource === 'manual') {
          if (directorName && docDir911.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en Estadística 911 ("${docDir911}") difiere del ingresado manualmente ("${directorName}"). Se mantiene la edición manual.`);
          }
        } else if (directorSource === 'bd') {
          if (directorName && docDir911.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en Estadística 911 ("${docDir911}") difiere del registrado en BD ("${directorName}"). Se mantiene el valor de BD.`);
          }
        } else {
          setDirectorName(docDir911);
          setDirectorSource('911');
          setDirectorMismatchWarning(null);
        }
      }

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
        // H-239 / H-253: Compute ET/Ab OUTSIDE the updater using the captured `indicadores` value from the
        // handler closure. React 19 may defer updater evaluation when prior setState calls are
        // scheduled in the same event, causing calculatedEt to be undefined at banner time.
        const { banner, mapped } = format911FinAnteriorBanner(json.data, indicadores);
        setIndicadores(() => mapped);
        if (json.data?.totalDocentes) syncStaffFrom911(json.data.totalDocentes);
        setDocsStatus(p => ({ ...p, n911FinAnt: true }));
        setSuccessBanner(banner);

      } else if (momento === 'inicio_actual') {
        setIndicadores(p => mapInicioActualToIndicadores(json.data, p));
        if (json.data?.totalDocentes) syncStaffFrom911(json.data.totalDocentes);
        setDocsStatus(p => ({ ...p, n911IniAct: true }));
        const mat = json.data?.matriculaInicio ?? json.data?.matricula ?? 'N/D';
        setSuccessBanner(`✓ 911 (Inicio Ciclo Actual) cargada: Matrícula vigente de ${mat} alumnos`);
      } else {
        // inicio_anterior
        setIndicadores(p => mapInicioAnteriorToIndicadores(json.data, p));
        setDocsStatus(p => ({ ...p, n911IniAnt: true }));
        const mat = json.data?.matriculaInicio ?? json.data?.matricula ?? 'N/D';
        setSuccessBanner(`✓ 911 (Inicio Ciclo Anterior) cargada: Matrícula inicial de ${mat} alumnos`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la Estadística 911.');
    } finally {
      setUploading911(false);
      setActiveMomento911(null);
      if (fileInput911Ref.current) fileInput911Ref.current.value = '';
    }
  };

  // Carga Inteligente de PAEC Anterior (PDF/Word) en Paso 1 (H-155)
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
      const json = await parseSafeApiResponse<{
        success?: boolean;
        error?: string;
        data?: {
          projectName?: string | null;
          problemStatement?: string | null;
          school?: {
            schoolName?: string | null;
            cct?: string | null;
            municipality?: string | null;
            locality?: string | null;
            schoolZone?: string | null;
            directorName?: string | null;
            supervisorName?: string | null;
          };
          community?: {
            context?: string | null;
            location?: string | null;
            problematics?: string | null;
            economicActivities?: string | null;
            culturalAspects?: string | null;
          };
        };
      }>(
        res,
        'Error al analizar el documento PAEC anterior.'
      );
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Error al procesar el archivo PAEC.');
      }

      const pData = json.data;
      const sCtx = pData.school || {};
      const cCtx = pData.community || {};

      if (typeof sCtx.schoolName === 'string' && sCtx.schoolName && !schoolName) setSchoolName(sCtx.schoolName);
      if (typeof sCtx.cct === 'string' && sCtx.cct && !schoolCct) setSchoolCct(sCtx.cct);
      if (typeof sCtx.supervisorName === 'string' && sCtx.supervisorName && !supervisorName) setSupervisorName(sCtx.supervisorName);
      if (typeof sCtx.schoolZone === 'string' && sCtx.schoolZone && !schoolZone) setSchoolZone(sCtx.schoolZone);
      if (typeof sCtx.municipality === 'string' && sCtx.municipality && !municipality) setMunicipality(sCtx.municipality);
      if (typeof sCtx.locality === 'string' && sCtx.locality && !locality) setLocality(sCtx.locality);

      const docDirPaec = typeof sCtx.directorName === 'string' ? sCtx.directorName.trim() : '';
      if (docDirPaec) {
        if (directorSource === 'manual') {
          if (directorName && docDirPaec.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en PAEC ("${docDirPaec}") difiere del ingresado manualmente ("${directorName}"). Se mantiene la edición manual.`);
          }
        } else if (directorSource === 'bd') {
          if (directorName && docDirPaec.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en PAEC ("${docDirPaec}") difiere del registrado en BD ("${directorName}"). Se mantiene el valor de BD.`);
          }
        } else {
          setDirectorName(docDirPaec);
          setDirectorSource('paec');
          setDirectorMismatchWarning(null);
        }
      }

      const plantelFieldsExtracted = countPlantelFields(sCtx);

      const paecDiagParts = buildPaecDiagnosticParts(
        {
          context: cCtx.context,
          location: cCtx.location,
          problematics: cCtx.problematics,
          economicActivities: cCtx.economicActivities,
        },
        {
          projectName: pData.projectName,
          problemStatement: pData.problemStatement,
        }
      );

      const summary = getPaecIngestionSummary(paecDiagParts.length, plantelFieldsExtracted);

      if (summary.isSuccess) {
        if (paecDiagParts.length > 0) {
          const combined = paecDiagParts.join('\n\n');
          setDiagnosticoComunidad(prev => mergePaecIntoDiagnostic(prev, combined));
        }
        setDocsStatus(prev => ({ ...prev, paecAnt: true }));
        setSuccessBanner(summary.message);
      } else {
        setDocsStatus(prev => ({ ...prev, paecAnt: false }));
        setError(summary.message);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'No se pudo procesar el PAEC anterior.';
      setError(errMsg);
    } finally {
      setUploadingPaec(false);
      if (fileInputPaecRef.current) fileInputPaecRef.current.value = '';
    }
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

    const finalReprobMeta = indicadores.reprobacion_meta !== undefined
      ? indicadores.reprobacion_meta
      : (finalAprobMeta !== undefined ? Math.max(0, Math.round((100 - finalAprobMeta) * 10) / 10) : (reprobAnt !== undefined ? Math.max(0, Math.round((reprobAnt - 5) * 10) / 10) : undefined));

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
        formula: `max(0, 100 - ${finalAprobMeta ?? 'N/D'})`,
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
  }, [projectId, schoolName, schoolCct, municipality, locality, schoolZone, directorName, supervisorName, cicloEscolar, subsystem, totalStaff, staffData, indicadores, metasConfirmadas, diagnosticoComunidad, foda, categoriasPriorizadas, ingestCoverage, f11Warnings, planAccion, locale, router]);

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
  }, [projectId, metasConfirmadas, ingestCoverage, allowPartialGeneration]);

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
  }, [staffData, cicloEscolar, planAccion]);

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
            }} onClick={() => activeStep > step.n && goToStep(step.n)}>
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

        {/* Success / Notification banner */}
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

        {/* ── STEP 1: Datos Institucionales ─────────────────────────── */}
        {activeStep === 1 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 1: Datos Institucionales
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Ingresa los datos generales del plantel educativo. Esta información aparecerá en la portada del PMC.
            </p>

            {/* Barra de Acciones Inteligentes: Cargar PMC Anterior + F11 + Estadística 911 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.95) 100%)', border: '1px solid rgba(99,102,241,0.3)', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Carga Inteligente de Documentos Oficiales</div>
                  <div style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.6)' }}>Sube F11 (calificaciones), Estadística 911 (matrícula), PMC o PAEC anterior para pre-llenar tu PMC</div>
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

                <button
                  type="button"
                  onClick={() => fileInputPaecRef.current?.click()}
                  disabled={uploadingPaec}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.paecAnt ? 'rgba(168,85,247,0.35)' : 'rgba(168,85,247,0.2)',
                    border: '1px solid rgba(168,85,247,0.45)',
                    color: '#e9d5ff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploadingPaec ? '⏳ Analizando PAEC...' : `📄 Cargar PAEC anterior (PDF/Word)${docsStatus.paecAnt ? ' ✓' : ''}`}
                </button>
                <input ref={fileInputPaecRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={handleUploadPreviousPaec} />
              </div>
            </div>

            {/* Banner de estado PMC anterior y reintento de extracción (H-282) */}
            {docsStatus.pmcAnt && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: '8px', marginBottom: '20px',
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
                color: '#c7d2fe', fontSize: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📜</span>
                  <span>
                    <strong>PMC anterior cargado:</strong> {ingestCoverage?.extraidos ?? parsedPmcData?.metas_institucionales_previas?.length ?? 0} metas listas
                    {ingestCoverage?.parcial && ingestCoverage.extraidos < (ingestCoverage.detectados || 0) && (
                      <span style={{ color: '#fbbf24', marginLeft: '6px' }}>— Cobertura parcial ({ingestCoverage.extraidos}/{ingestCoverage.detectados})</span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowPmcReviewModal(true)}
                    style={{
                      background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                      color: '#e0e7ff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    👁️ Revisar datos
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputPmcRef.current?.click()}
                    disabled={uploadingPmc}
                    style={{
                      background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)',
                      color: '#fcd34d', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    {uploadingPmc ? '⏳ Procesando...' : '🔄 Reintentar extracción'}
                  </button>
                </div>
              </div>
            )}

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: directorSource === 'manual' ? 'rgba(99,102,241,0.2)' : directorSource === 'bd' ? 'rgba(16,185,129,0.2)' : 'rgba(14,165,233,0.2)',
                      color: directorSource === 'manual' ? '#a5b4fc' : directorSource === 'bd' ? '#6ee7b7' : '#7dd3fc',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      {directorSource === 'manual' ? '✏️ Edición manual (Prioridad Máxima)' :
                       directorSource === 'bd' ? '🏛️ Registrado en BD' :
                       directorSource === 'f11' ? '📊 Extraído de F11' :
                       directorSource === '911' ? '📈 Extraído de Estadística 911' :
                       directorSource === 'paec' ? '📘 Extraído de PAEC' :
                       directorSource === 'pmc_anterior' ? '📜 Extraído de PMC anterior' :
                       directorSource === 'draft' ? '💾 Restaurado de borrador' : '⚠️ Pendiente de captura o carga'}
                    </span>
                  </div>
                  {alternativeDirector && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#93c5fd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}>
                      <span>
                        ℹ️ Director actualizado con PMC anterior (&ldquo;{directorName}&rdquo;). En {alternativeDirector.source === '911' ? 'Estadística 911' : alternativeDirector.source === 'f11' ? 'F11' : 'otro origen'} figuraba &ldquo;{alternativeDirector.name}&rdquo;.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const prevName = alternativeDirector.name;
                          const prevSource = alternativeDirector.source;
                          setAlternativeDirector({ name: directorName, source: directorSource });
                          handleDirectorNameChange(prevName);
                          setDirectorSource(prevSource);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.12)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          color: '#ffffff',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Usar &ldquo;{alternativeDirector.name}&rdquo; ({alternativeDirector.source === '911' ? '911' : 'previo'})
                      </button>
                    </div>
                  )}
                  {directorMismatchWarning && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', fontSize: '12px', color: '#fcd34d' }}>
                      ⚠️ {directorMismatchWarning}
                    </div>
                  )}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 110px', gap: '12px' }}>
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
                    <div>
                      <label style={labelStyle}>Horas Base</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        style={inputStyle}
                        value={member.horas_base ?? ''}
                        onChange={e => {
                          const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                          const copy = [...staffData];
                          copy[idx] = { ...copy[idx], horas_base: val };
                          setStaffData(copy);
                        }}
                        placeholder={member.cargo === 'Director(a)' ? '40' : '20'}
                      />
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
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '12px' }}>🌍 Contexto de la Comunidad</h3>
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
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '8px' }}>📊 Indicadores Académicos y Metas del Plantel</h3>
              <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '8px' }}>
                La plataforma <strong>calcula todos los porcentajes</strong> a partir de los documentos oficiales subidos (F11 y Estadística 911). Las metas del ciclo {cicloEscolar} son sugeridas conforme a los lineamientos oficiales y deben ser confirmadas antes de generar el plan.
              </p>
              <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '6px', padding: '8px 12px', fontSize: '11.5px', color: '#7dd3fc', marginBottom: '16px' }}>
                💡 <strong>Cálculo Determinístico:</strong> Ningún porcentaje de línea base se captura a mano. Si falta un archivo, se muestra &quot;N/D (falta &lt;archivo&gt;)&quot;. Las metas son lo único que se sugiere y tú dispones o confirmas su valor final.
              </div>

              {/* H-225: Advertencia de Línea Base si usa fallback de fin o falta concentrado de inicio */}
              {indicadores.baselineWarning && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#fca5a5',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span>⚠️</span>
                  <span><strong>Advertencia de Línea Base:</strong> {indicadores.baselineWarning}</span>
                </div>
              )}

              {/* H-226: Consumo visible de Cross-Checks F11 ↔ 911 */}
              {Boolean(indicadores.totalAlumnosF11 && (indicadores.existenciaFin || indicadores.matriculaAnterior)) && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '11.5px',
                  color: '#c7d2fe',
                  marginBottom: '16px',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔍</span> Cross-Checks F11 ↔ 911 (Consistencia de Control Escolar y Estadística):
                  </div>
                  <div style={{ fontSize: '11px', color: '#e0e7ff', lineHeight: 1.5 }}>
                    • Total Alumnos F11: <strong>{indicadores.totalAlumnosF11}</strong> vs Existencia 911: <strong>{indicadores.existenciaFin ?? indicadores.matriculaAnterior}</strong>
                    {indicadores.bajas !== undefined && ` (Bajas F11: ${indicadores.bajas})`}
                    {indicadores.bajasDefinitivas !== undefined && ` vs (Bajas 911: ${indicadores.bajasDefinitivas})`}
                  </div>
                </div>
              )}

              {/* H-240: F11 column mismatch / zip truncation warnings */}
              {f11Warnings.length > 0 && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.10)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#fde68a',
                  marginBottom: '16px',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Advertencias del F11 (requiere revisión):</div>
                  <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.6 }}>
                    {f11Warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* 5 Tarjetas Situacionales */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f0f4ff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>👥</span> Diagnóstico Situacional del Alumnado (F11 Base: {indicadores.totalAlumnosF11 ? `${indicadores.totalAlumnosF11} alumnos` : 'N/D (falta F11)'})
                  </h4>
                  <span style={{ fontSize: '11px', color: 'rgba(240,244,255,0.6)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                    100% calculado determinísticamente
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                  {/* Card 1: Aprobados */}
                  <div
                    title={
                      !indicadores.totalAlumnosF11
                        ? 'Fórmula: (Regulares + Irregulares) / Total alumnos F11 (falta cargar F11)'
                        : (indicadores._calc?.aprobacion_ant?.formula ||
                           (indicadores.regulares !== undefined && indicadores.irregulares !== undefined && indicadores.porcentajes?.aprobados !== undefined
                             ? `(${indicadores.regulares} Regulares + ${indicadores.irregulares} Irregulares) / ${indicadores.totalAlumnosF11} = ${indicadores.porcentajes.aprobados}%`
                             : 'Fórmula: (Regulares + Irregulares) / Total alumnos F11'))
                    }
                    style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'help',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🎓 Aprobados
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399', margin: '4px 0 2px' }}>
                      {indicadores.totalAlumnosF11 && indicadores.porcentajes?.aprobados !== undefined ? `${indicadores.porcentajes.aprobados}%` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.75)' }}>
                      {indicadores.totalAlumnosF11 && indicadores.aprobados !== undefined ? `${indicadores.aprobados} alumnos` : 'N/D (falta F11)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#a7f3d0', marginTop: '6px', fontStyle: 'italic' }}>
                      Con derecho a reinscripción
                    </div>
                  </div>

                  {/* Card 2: Regulares */}
                  <div
                    title={
                      !indicadores.totalAlumnosF11
                        ? 'Fórmula: Alumnos regulares (0 adeudos) / Total alumnos F11 (falta cargar F11)'
                        : (indicadores._calc?.regulares?.formula ||
                           (indicadores.regulares !== undefined && indicadores.porcentajes?.regulares !== undefined
                             ? `${indicadores.regulares} alumnos regulares / ${indicadores.totalAlumnosF11} = ${indicadores.porcentajes.regulares}%`
                             : 'Fórmula: Alumnos regulares / Total alumnos F11'))
                    }
                    style={{
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'help',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📘 Regulares
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8', margin: '4px 0 2px' }}>
                      {indicadores.totalAlumnosF11 && indicadores.porcentajes?.regulares !== undefined ? `${indicadores.porcentajes.regulares}%` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.75)' }}>
                      {indicadores.totalAlumnosF11 && indicadores.regulares !== undefined ? `${indicadores.regulares} alumnos` : 'N/D (falta F11)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#bae6fd', marginTop: '6px', fontStyle: 'italic' }}>
                      0 adeudos de materias
                    </div>
                  </div>

                  {/* Card 3: Irregulares */}
                  <div
                    title={
                      !indicadores.totalAlumnosF11
                        ? 'Fórmula: Alumnos irregulares (1-3 adeudos) / Total alumnos F11 (falta cargar F11)'
                        : (indicadores._calc?.irregulares?.formula ||
                           (indicadores.irregulares !== undefined && indicadores.porcentajes?.irregulares !== undefined
                             ? `${indicadores.irregulares} alumnos irregulares / ${indicadores.totalAlumnosF11} = ${indicadores.porcentajes.irregulares}%`
                             : 'Fórmula: Alumnos irregulares / Total alumnos F11'))
                    }
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'help',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📙 Irregulares
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#fbbf24', margin: '4px 0 2px' }}>
                      {indicadores.totalAlumnosF11 && indicadores.porcentajes?.irregulares !== undefined ? `${indicadores.porcentajes.irregulares}%` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.75)' }}>
                      {indicadores.totalAlumnosF11 && indicadores.irregulares !== undefined ? `${indicadores.irregulares} alumnos` : 'N/D (falta F11)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#fef08a', marginTop: '6px', fontStyle: 'italic' }}>
                      arrastrando hasta 3 materias
                    </div>
                  </div>

                  {/* Card 4: Reprobados */}
                  <div
                    title={
                      !indicadores.totalAlumnosF11
                        ? 'Fórmula: Alumnos reprobados (4+ adeudos) / Total alumnos F11 (falta cargar F11)'
                        : (indicadores._calc?.reprobacion_ant?.formula ||
                           (indicadores.reprobados !== undefined && indicadores.porcentajes?.reprobados !== undefined
                             ? `${indicadores.reprobados} alumnos reprobados / ${indicadores.totalAlumnosF11} = ${indicadores.porcentajes.reprobados}%`
                             : 'Fórmula: Alumnos reprobados / Total alumnos F11'))
                    }
                    style={{
                      background: 'rgba(244, 63, 94, 0.08)',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'help',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#fda4af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📕 Reprobados
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#f43f5e', margin: '4px 0 2px' }}>
                      {indicadores.totalAlumnosF11 && indicadores.porcentajes?.reprobados !== undefined ? `${indicadores.porcentajes.reprobados}%` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.75)' }}>
                      {indicadores.totalAlumnosF11 && indicadores.reprobados !== undefined ? `${indicadores.reprobados} alumnos` : 'N/D (falta F11)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#fecdd3', marginTop: '6px', fontStyle: 'italic' }}>
                      no inscribibles al siguiente semestre
                    </div>
                  </div>

                  {/* Card 5: Bajas */}
                  <div
                    title={
                      !indicadores.totalAlumnosF11
                        ? 'Fórmula: Bajas registradas ("B") / Total alumnos F11 (falta cargar F11)'
                        : (indicadores._calc?.bajas?.formula ||
                           (indicadores.bajas !== undefined && indicadores.porcentajes?.bajas !== undefined
                             ? `${indicadores.bajas} bajas registradas ("B") / ${indicadores.totalAlumnosF11} = ${indicadores.porcentajes.bajas}%`
                             : 'Fórmula: Bajas registradas / Total alumnos F11'))
                    }
                    style={{
                      background: 'rgba(251, 146, 60, 0.08)',
                      border: '1px solid rgba(251, 146, 60, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'help',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#fdba74', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ⚠️ Bajas
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#fb923c', margin: '4px 0 2px' }}>
                      {indicadores.totalAlumnosF11 && indicadores.porcentajes?.bajas !== undefined ? `${indicadores.porcentajes.bajas}%` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.75)' }}>
                      {indicadores.totalAlumnosF11 && indicadores.bajas !== undefined ? `${indicadores.bajas} alumnos` : 'N/D (falta F11)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#fed7aa', marginTop: '6px', fontStyle: 'italic' }}>
                      Marcados con clave &quot;B&quot;
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Indicadores Académicos Oficiales (H-221) */}
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(99,102,241,0.25)', color: '#f0f4ff' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', width: '38%' }}>Indicador</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '31%' }}>% Ciclo Anterior (Línea Base)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '31%' }}>% Meta {cicloEscolar}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label: 'Aprobación',
                        fuente: 'F11',
                        antKey: 'aprobacion_ant' as const,
                        metaKey: 'aprobacion_meta' as const,
                        falta: 'N/D (falta F11)',
                      },
                      {
                        label: 'Reprobación',
                        fuente: 'F11',
                        antKey: 'reprobacion_ant' as const,
                        metaKey: 'reprobacion_meta' as const,
                        falta: 'N/D (falta F11)',
                      },
                      {
                        label: 'Abandono escolar / Deserción',
                        fuente: '911 Fin',
                        antKey: 'abandono_ant' as const,
                        metaKey: 'abandono_meta' as const,
                        falta: 'N/D (falta 911 Fin)',
                      },
                      {
                        label: 'Eficiencia terminal',
                        fuente: '911 Fin',
                        antKey: 'et_ant' as const,
                        metaKey: 'et_meta' as const,
                        falta: 'N/D (falta 911 Fin)',
                      },
                    ].map((row, i) => {
                      const antVal = indicadores[row.antKey];
                      const metaVal = indicadores[row.metaKey];
                      const hasBaseline = antVal !== undefined && !isNaN(Number(antVal));
                      return (
                        <tr key={row.label} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(99,102,241,0.06)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontWeight: 600, color: '#f0f4ff' }}>{row.label}</span>
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: row.fuente === 'F11' ? 'rgba(14,165,233,0.2)' : 'rgba(245,158,11,0.2)',
                              color: row.fuente === 'F11' ? '#7dd3fc' : '#fcd34d',
                              border: `1px solid ${row.fuente === 'F11' ? 'rgba(14,165,233,0.3)' : 'rgba(245,158,11,0.3)'}`
                            }}>
                              {row.fuente}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {hasBaseline ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, fontSize: '14px', color: '#f0f4ff' }}>
                                  {antVal}%
                                </span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: 'rgba(16,185,129,0.15)',
                                  color: '#6ee7b7',
                                  border: '1px solid rgba(16,185,129,0.25)',
                                }}>
                                  cálculo oficial
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <span style={{ color: 'rgba(240,244,255,0.4)', fontWeight: 600 }}>—</span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(239,68,68,0.15)',
                                  color: '#fca5a5',
                                  border: '1px solid rgba(239,68,68,0.25)',
                                }}>
                                  {row.falta}
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {hasBaseline ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.1}
                                  style={{
                                    width: '74px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(99,102,241,0.4)',
                                    textAlign: 'center',
                                    background: 'rgba(99,102,241,0.12)',
                                    color: '#f0f4ff',
                                    fontWeight: 700,
                                  }}
                                  value={metaVal ?? ''}
                                  onChange={e => {
                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                    setIndicadores(p => ({
                                      ...p,
                                      [row.metaKey]: val,
                                      metas_confirmadas: false,
                                    }));
                                    setMetasConfirmadas(false);
                                  }}
                                  placeholder="—"
                                />
                                <span>%</span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: 'rgba(99,102,241,0.2)',
                                  color: '#a5b4fc',
                                  border: '1px solid rgba(99,102,241,0.3)',
                                }}>
                                  sugerida
                                </span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: metasConfirmadas ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                                  color: metasConfirmadas ? '#6ee7b7' : '#fcd34d',
                                  border: `1px solid ${metasConfirmadas ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                }}>
                                  {metasConfirmadas ? '✓ confirmada' : 'pendiente'}
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <span style={{ color: 'rgba(240,244,255,0.4)', fontWeight: 600 }}>—</span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(245,158,11,0.15)',
                                  color: '#fcd34d',
                                  border: '1px solid rgba(245,158,11,0.25)',
                                }}>
                                  N/D (falta línea base)
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Matrícula y Confirmación de Metas del Ciclo */}
              <div style={{ marginTop: '14px', padding: '14px', background: 'rgba(8,12,24,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Matrícula total del plantel (alumnos)</label>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
                          911 Inicio
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: indicadores.matricula ? '#f0f4ff' : 'rgba(240,244,255,0.4)', padding: '6px 0' }}>
                        {indicadores.matricula ? `${indicadores.matricula} alumnos` : '— (N/D falta 911 Inicio)'}
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Matrícula meta proyectada</label>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                          sugerida
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        style={{ ...inputStyle, width: '160px' }}
                        value={indicadores.matricula_meta ?? ''}
                        onChange={e => {
                          const val = parseInt(e.target.value) || undefined;
                          setIndicadores(p => ({ ...p, matricula_meta: val, metas_confirmadas: false }));
                          setMetasConfirmadas(false);
                        }}
                        placeholder={indicadores.matricula ? String(indicadores.matricula) : '—'}
                      />
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleConfirmarMetasCiclo}
                      style={{
                        padding: '10px 18px',
                        background: metasConfirmadas ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {metasConfirmadas ? '✓ Metas del Ciclo Confirmadas' : '🎯 Confirmar Metas del Ciclo'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Metas por Asignatura (Paquete A2 / D5) */}
              {Array.isArray(indicadores.reprobacionPorMateria) && indicadores.reprobacionPorMateria.length > 0 && (
                <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f0f4ff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📚</span> Metas de Reducción de Reprobación por Asignatura
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(240,244,255,0.6)' }}>
                        Calculadas a partir del F11 según regla de bandas (&le;5%: 0.0%, 5-20%: -5 pts, &gt;20%: -10 pts). Tú dispones y confirmas la meta final.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirmarMetasMaterias}
                      style={{
                        padding: '8px 14px',
                        background: metasMateriasConfirmadas ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {metasMateriasConfirmadas ? '✓ Metas por Asignatura Confirmadas' : '🎯 Confirmar Metas por Asignatura'}
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(14,165,233,0.18)', color: '#f0f4ff' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Asignatura / UAC</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>n</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '100px' }}>Reprobados</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '120px' }}>% Reprobación Actual</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>% Meta Sugerida</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '120px' }}>Meta Plantel (%)</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {indicadores.reprobacionPorMateria.map((mat, mIdx) => {
                          const isZero = mat.porcentaje === 0 || mat.reprobados === 0;
                          return (
                            <tr key={mat.materia + mIdx} style={{ background: mIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(14,165,233,0.04)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#f0f4ff' }}>
                                {mat.materia}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: 'rgba(240,244,255,0.8)' }}>
                                {mat.n}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: mat.reprobados > 0 ? '#fda4af' : '#6ee7b7' }}>
                                {mat.reprobados}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: mat.porcentaje > 15 ? '#fb7185' : mat.porcentaje > 5 ? '#fcd34d' : '#6ee7b7' }}>
                                {mat.porcentaje}%
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#a5b4fc', fontWeight: 600 }}>
                                {mat.metaSugerida !== undefined ? `${mat.metaSugerida}%` : '0.0%'}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                {isZero ? (
                                  <span style={{ fontSize: '11px', color: '#6ee7b7' }}>0.0%</span>
                                ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    style={{
                                      width: '65px',
                                      padding: '3px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(14,165,233,0.4)',
                                      textAlign: 'center',
                                      background: 'rgba(14,165,233,0.1)',
                                      color: '#f0f4ff',
                                      fontWeight: 600,
                                    }}
                                    value={mat.metaUsuario !== undefined ? mat.metaUsuario : mat.metaSugerida ?? 0}
                                    onChange={e => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setIndicadores(p => {
                                        const list = [...(p.reprobacionPorMateria || [])];
                                        if (list[mIdx]) {
                                          list[mIdx] = { ...list[mIdx], metaUsuario: val, metaConfirmada: false };
                                        }
                                        return { ...p, reprobacionPorMateria: list };
                                      });
                                      setMetasMateriasConfirmadas(false);
                                    }}
                                  />
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                {isZero ? (
                                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)' }}>
                                    sin reprobación
                                  </span>
                                ) : mat.metaConfirmada ? (
                                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
                                    ✓ Confirmada
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(245,158,11,0.2)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)' }}>
                                    Sugerida
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

            {/* Banner: Bloqueo de Generación si las metas no están confirmadas */}
            {!metasConfirmadas && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  <div>
                    <strong style={{ color: '#fcd34d', fontSize: '13.5px', display: 'block', marginBottom: '2px' }}>
                      Confirmación de Metas Requerida
                    </strong>
                    <span style={{ color: 'rgba(240,244,255,0.8)', fontSize: '12.5px', lineHeight: 1.5 }}>
                      Para asegurar rigor metodológico y normativo, debes revisar y confirmar las metas académicas del ciclo en el Paso 3 antes de generar con IA.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(245,158,11,0.3)',
                  }}
                >
                  Ir al Paso 3 →
                </button>
              </div>
            )}

            {/* H-099: Marco Normativo Oficial */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0 }}>
                    ⚖️ Marco Normativo y Fundamentación Jurídica
                    {normativaData ? (
                      <span style={{ marginLeft: '8px', color: '#34d399', fontSize: '13px' }}>
                        ✓ Vinculado{Array.isArray((normativaData as { documentos?: unknown[] })?.documentos) ? ` (${(normativaData as { documentos?: unknown[] }).documentos!.length} documentos)` : ''}
                      </span>
                    ) : (
                      <span style={{ marginLeft: '8px', color: '#f59e0b', fontSize: '13px' }}>
                        ⚠️ Pendiente de sincronización
                      </span>
                    )}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)', margin: '4px 0 0' }}>
                    Sustento legal oficial: Art. 3° Constitucional, Ley General de Educación, Ley de Educación del Estado de Puebla y MCCEMS
                  </p>
                </div>
                <button
                  onClick={() => generateStep('normativa')}
                  disabled={generating !== null}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: generating === 'normativa' ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: generating !== null ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                  }}
                >
                  {generating === 'normativa' ? '⏳ Sincronizando...' : normativaData ? '🔄 Sincronizar Normativa' : '✨ Generar Normativa'}
                </button>
              </div>
              {normativaData ? (
                <div style={{ background: 'rgba(8,12,24,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px 16px', fontSize: '13px', color: '#f0f4ff', lineHeight: 1.6 }}>
                  <div style={{ color: '#818cf8', fontWeight: 600, marginBottom: '4px' }}>
                    {(normativaData as { titulo?: string })?.titulo || 'Marco Normativo Institucional'}
                  </div>
                  <div style={{ color: 'rgba(240,244,255,0.75)', fontSize: '12px' }}>
                    {(normativaData as { descripcion?: string })?.descripcion ||
                      'El presente Plan de Mejora Continua se sustenta en el marco jurídico y normativo vigente para la Educación Media Superior en el Estado de Puebla.'}
                  </div>
                </div>
              ) : generating === 'normativa' ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}>
                  <p style={{ fontWeight: 600, color: '#818cf8', margin: 0 }}>Sincronizando normateca jurídica oficial...</p>
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(240,244,255,0.45)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '13px' }}>
                  Haz clic en &quot;Generar Normativa&quot; para vincular los documentos oficiales vigentes a tu PMC.
                </div>
              )}
            </div>

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
                  disabled={generating !== null || !metasConfirmadas || (Boolean(ingestCoverage?.parcial) && !allowPartialGeneration)}
                  title={!metasConfirmadas ? 'Debes confirmar las metas del ciclo en el Paso 3 primero' : (ingestCoverage?.parcial && !allowPartialGeneration) ? 'El PMC previo tiene cobertura de extracción parcial (<90%). Autoriza abajo para continuar.' : undefined}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: generating === 'diagnostico' ? 'rgba(255,255,255,0.1)' : (!metasConfirmadas || (ingestCoverage?.parcial && !allowPartialGeneration)) ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: (generating !== null || !metasConfirmadas || (Boolean(ingestCoverage?.parcial) && !allowPartialGeneration)) ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    boxShadow: (!metasConfirmadas || (ingestCoverage?.parcial && !allowPartialGeneration)) ? 'none' : '0 2px 8px rgba(99,102,241,0.4)',
                    opacity: (!metasConfirmadas || (ingestCoverage?.parcial && !allowPartialGeneration)) ? 0.5 : 1,
                  }}
                >
                  {generating === 'diagnostico' ? '⏳ Generando...' : diagnosticoGenerado ? '🔄 Regenerar' : '✨ Generar Diagnóstico'}
                </button>
              </div>
              {!metasConfirmadas && (
                <p style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                  ⚠️ Debes confirmar las metas del ciclo en el Paso 3 antes de generar el diagnóstico.
                </p>
              )}
              {ingestCoverage?.parcial && (
                <div style={{
                  fontSize: '12px',
                  color: ingestCoverage.extraidos >= (ingestCoverage.detectados || 0) ? '#6ee7b7' : '#f87171',
                  background: ingestCoverage.extraidos >= (ingestCoverage.detectados || 0) ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.12)',
                  border: ingestCoverage.extraidos >= (ingestCoverage.detectados || 0) ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.25)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span>{ingestCoverage.extraidos >= (ingestCoverage.detectados || 0) ? '✅' : '⚠️'}</span>
                    <strong>
                      {ingestCoverage.extraidos >= (ingestCoverage.detectados || 0)
                        ? `Metas extraídas del PMC anterior (${ingestCoverage.extraidos} metas estructuradas)`
                        : `Extracción parcial del PMC anterior (${ingestCoverage.extraidos}/${ingestCoverage.detectados || '?'})`}
                    </strong>
                  </div>
                  <p style={{ margin: '0 0 8px', color: 'rgba(240,244,255,0.85)', lineHeight: 1.5 }}>
                    {ingestCoverage.extraidos >= (ingestCoverage.detectados || 0)
                      ? `Se consolidaron exitosamente ${ingestCoverage.extraidos} metas (incluyendo las metas individuales de la plantilla docente). Cobertura total de actividades: ${Math.round((ingestCoverage.ratio || 0) * 100)}% (${ingestCoverage.extraidos}/${ingestCoverage.esperado || ingestCoverage.detectados}).`
                      : 'El PMC anterior cargado tiene cobertura de extracción parcial (<90%). Puedes continuar usando las metas extraídas actualmente autorizando la generación.'}
                  </p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fcd34d', fontWeight: 600, fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={allowPartialGeneration}
                      onChange={(e) => setAllowPartialGeneration(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: '#f59e0b' }}
                    />
                    <span>Autorizar generación con las metas extraídas ({ingestCoverage.extraidos} metas listas)</span>
                  </label>
                </div>
              )}
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
                    {(planAccion?.metas_institucionales?.length || 0) > 0 && <span style={{ marginLeft: '8px', color: '#34d399', fontSize: '13px' }}>✓ {planAccion?.metas_institucionales?.length} Metas Institucionales</span>}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)', margin: '4px 0 0' }}>
                    Metas institucionales por categoría + metas individuales para los {totalStaff} trabajadores
                  </p>
                </div>
                <button
                  onClick={() => generateStep('plan_accion')}
                  disabled={generating !== null || !diagnosticoGenerado || !metasConfirmadas || (Boolean(ingestCoverage?.parcial) && !allowPartialGeneration)}
                  title={!metasConfirmadas ? 'Debes confirmar las metas del ciclo en el Paso 3 primero' : !diagnosticoGenerado ? 'Primero debes generar el diagnóstico oficial' : (ingestCoverage?.parcial && !allowPartialGeneration) ? 'El PMC previo tiene cobertura de extracción parcial (<90%). Autoriza arriba para continuar.' : undefined}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: generating === 'plan_accion' ? 'rgba(255,255,255,0.1)' : (!diagnosticoGenerado || !metasConfirmadas || (ingestCoverage?.parcial && !allowPartialGeneration)) ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: (generating !== null || !diagnosticoGenerado || !metasConfirmadas || (Boolean(ingestCoverage?.parcial) && !allowPartialGeneration)) ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    opacity: (!diagnosticoGenerado || !metasConfirmadas || (ingestCoverage?.parcial && !allowPartialGeneration)) ? 0.5 : 1,
                  }}
                >
                  {generating === 'plan_accion' ? '⏳ Generando...' : (planAccion?.metas_institucionales?.length || 0) > 0 ? '🔄 Regenerar Metas Institucionales con IA' : '✨ Generar Plan de Acción con IA'}
                </button>
              </div>
              {!metasConfirmadas ? (
                <p style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                  ⚠️ Debes confirmar las metas del ciclo en el Paso 3 antes de generar el plan de acción.
                </p>
              ) : !diagnosticoGenerado ? (
                <p style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                  ⚠️ Primero genera el diagnóstico para poder generar el plan de acción.
                </p>
              ) : null}
              {ingestCoverage?.parcial && !allowPartialGeneration && (
                <p style={{ fontSize: '12px', color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                  ⚠️ El PMC anterior cargado tiene cobertura de extracción parcial (&lt;90%). Marca la casilla de autorización arriba para desbloquear la generación.
                </p>
              )}

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
                      const isAlreadyAdded = isPreviousMetaAdapted(mp, planAccion?.metas_institucionales, idx);

                      return (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ flex: 1, fontSize: '12px' }}>
                            <div style={{ fontWeight: 600, color: '#93c5fd', marginBottom: '2px' }}>
                              {mp.categoria || 'Categoría general'} {mp.tema ? `— ${mp.tema}` : ''}
                            </div>
                            <div style={{ color: '#f0f4ff', marginBottom: '4px' }}><strong>Meta:</strong> {mp.meta || 'Sin redacción'}</div>
                            {mp.texto_original && mp.texto_original !== mp.meta && (
                              <div style={{ fontSize: '11px', color: 'rgba(240,244,255,0.6)', marginBottom: '4px' }}>
                                <em>Original:</em> {mp.texto_original}
                              </div>
                            )}
                            {mp.estrategia && <div style={{ color: 'rgba(240,244,255,0.65)' }}><strong>Estrategia:</strong> {mp.estrategia}</div>}
                            {mp.linea_base && <div style={{ color: 'rgba(240,244,255,0.5)' }}><strong>Línea base:</strong> {mp.linea_base}</div>}
                          </div>
                          <button
                            type="button"
                            disabled={Boolean(isAlreadyAdded)}
                            onClick={() => {
                              if (isAlreadyAdded) return;
                              const cat = mp.categoria || PMC_CATEGORIAS_OFICIALES[0].nombre;
                              const estrategiaSintetizada = mp.estrategia?.trim() || generarEstrategiaSituada(cat, mp.meta);
                              const adaptedMeta: MetaInstitucional = {
                                categoria: cat,
                                nombre_categoria: cat,
                                tema: mp.tema || 'Mejora continua',
                                meta: mp.meta ? `[Continuidad 2026-2027] ${mp.meta}` : '',
                                estrategia: estrategiaSintetizada,
                                linea_base: mp.linea_base || '',
                                personal_designado: mp.responsable || '',
                                entregable: mp.entregable || 'Reporte de seguimiento',
                                periodo_inicio: 'Agosto 2026',
                                periodo_fin: 'Junio 2027',
                                diagnostico_meta: `Meta adaptada del ciclo previo: ${mp.meta || ''}`,
                                continuidad_de: mp.texto_original ? mp.texto_original.trim() : (mp.meta ? mp.meta.trim() : `meta_previa_${idx}`),
                                accion_especifica: estrategiaSintetizada,
                                finalidad: `Fortalecer la continuidad institucional de las acciones en ${cat} durante el ciclo 2026-2027.`,
                                necesidad: `Consolidar las metas institucionales de continuidad identificadas en el ciclo escolar previo.`,
                                proceso_evaluacion: 'Evaluación formativa y seguimiento bimestral en Consejo Técnico Escolar.',
                                subcategorias_vinculadas: [mp.tema || 'Mejora continua'],
                                estrategias_seguimiento: 'Cortes bimestrales en CTE y listas de cotejo de evidencias.',
                                observaciones: 'Meta de continuidad institucional adaptada del ciclo previo.',
                              };
                              const currentPersonal = (planAccion?.metas_personales && planAccion.metas_personales.length > 0)
                                ? planAccion.metas_personales
                                : derivePersonalMetasFromStaff(staffData, cicloEscolar);
                              const nextInstitucionales = deduplicateMetasInstitucionales(
                                [...(planAccion?.metas_institucionales || []), adaptedMeta],
                                indicadores
                              );
                              const nextPlan: PlanAccion = {
                                metas_institucionales: nextInstitucionales,
                                metas_personales: currentPersonal,
                              };
                              setPlanAccion(nextPlan);
                              setEditingMeta(Math.max(0, nextInstitucionales.length - 1));
                              // H-286: Auto-persistir en Neon DB para que un F5 no pierda la meta adaptada
                              if (projectId) {
                                fetch(`/api/pmc/${projectId}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ plan_accion: nextPlan }),
                                }).catch(() => {});
                              }
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
                  {planAccion.metas_institucionales.length === 0 && (
                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(240,244,255,0.6)', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>
                      Aún no hay metas institucionales formuladas. Haz clic en <strong>✨ Generar Plan de Acción con IA</strong> o adapta las metas del ciclo previo de arriba.
                    </div>
                  )}
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
                              { key: 'accion_especifica', label: 'Acciones Específicas a Realizar (Formato 4.1)', multi: true },
                              { key: 'personal_designado', label: 'Personal designado', multi: false },
                              { key: 'entregable', label: 'Entregable / Evidencia', multi: true },
                              { key: 'estrategias_seguimiento', label: 'Estrategias de Seguimiento (Formato 4.1)', multi: true },
                              { key: 'periodo_inicio', label: 'Período inicio (MM/YYYY)', multi: false },
                              { key: 'periodo_fin', label: 'Período fin (MM/YYYY)', multi: false },
                              { key: 'observaciones', label: 'Observaciones (Formato 4.1)', multi: true },
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
                                  <>
                                    <input
                                      value={((meta as unknown) as Record<string, string>)[f.key] || ''}
                                      onChange={e => {
                                        const copy = { ...planAccion! };
                                        const arr = [...copy.metas_institucionales];
                                        arr[i] = { ...arr[i], [f.key]: e.target.value };
                                        copy.metas_institucionales = arr;
                                        setPlanAccion(copy);
                                      }}
                                      placeholder={f.key === 'personal_designado' ? 'Ej. Director y Colegiado Docente, o selecciona de la plantilla abajo' : ''}
                                      style={{ ...inputStyle, fontSize: '13px' }}
                                    />
                                    {f.key === 'personal_designado' && (
                                      <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(99,102,241,0.08)', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.2)' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#a5b4fc', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <span>👥 Asignar responsable(s) de tu plantilla escolar:</span>
                                          {meta.personal_designado && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const copy = { ...planAccion! };
                                                const arr = [...copy.metas_institucionales];
                                                arr[i] = { ...arr[i], personal_designado: '' };
                                                copy.metas_institucionales = arr;
                                                setPlanAccion(copy);
                                              }}
                                              style={{ background: 'none', border: 'none', color: '#fca5a5', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                                            >
                                              Limpiar responsable
                                            </button>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                          {[
                                            'Director y Colegiado Docente',
                                            'Todo el Personal Docente',
                                            'Comité de Tutorías',
                                            'Director(a) del Plantel',
                                          ].map(preset => (
                                            <button
                                              key={preset}
                                              type="button"
                                              onClick={() => {
                                                const copy = { ...planAccion! };
                                                const arr = [...copy.metas_institucionales];
                                                arr[i] = { ...arr[i], personal_designado: preset };
                                                copy.metas_institucionales = arr;
                                                setPlanAccion(copy);
                                              }}
                                              style={{
                                                fontSize: '11px',
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                border: '1px solid rgba(99,102,241,0.35)',
                                                background: 'rgba(99,102,241,0.2)',
                                                color: '#c7d2fe',
                                                cursor: 'pointer',
                                              }}
                                            >
                                              + {preset}
                                            </button>
                                          ))}
                                          {staffData
                                            .filter(s => s.nombre && s.nombre.trim())
                                            .map((staffMember, sIdx) => {
                                              const sName = staffMember.nombre.trim();
                                              const isAssigned = meta.personal_designado?.includes(sName);
                                              return (
                                                <button
                                                  key={sIdx}
                                                  type="button"
                                                  onClick={() => {
                                                    const copy = { ...planAccion! };
                                                    const arr = [...copy.metas_institucionales];
                                                    const current = arr[i].personal_designado || '';
                                                    const nextVal = current.trim()
                                                      ? (current.includes(sName) ? current : `${current}, ${sName}`)
                                                      : `${sName} (${staffMember.cargo})`;
                                                    arr[i] = { ...arr[i], personal_designado: nextVal };
                                                    copy.metas_institucionales = arr;
                                                    setPlanAccion(copy);
                                                  }}
                                                  style={{
                                                    fontSize: '11px',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    border: isAssigned ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.15)',
                                                    background: isAssigned ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                                                    color: isAssigned ? '#6ee7b7' : '#e0e7ff',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                  }}
                                                  title={`Asignar a ${sName} (${staffMember.cargo})`}
                                                >
                                                  <span>{isAssigned ? '✓' : '+'}</span>
                                                  <span>{sName}</span>
                                                  <span style={{ opacity: 0.6, fontSize: '10px' }}>({staffMember.cargo})</span>
                                                </button>
                                              );
                                            })}
                                        </div>
                                      </div>
                                    )}
                                  </>
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
                  <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(99,102,241,0.06)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>🎯</span> Metas Individuales del Personal (Corresponsabilidad Docente — Criterio C10)
                        </h4>
                        <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.7)', margin: '4px 0 0', lineHeight: 1.5 }}>
                          La plataforma sugiere metas SMART por cargo para todo tu personal (o las que hayas definido en el Paso 2). Si el director está de acuerdo las deja tal como están; si no, puede editarlas directamente.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => syncPersonalMetas(undefined, false)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(99,102,241,0.4)',
                            background: 'rgba(99,102,241,0.2)',
                            color: '#c7d2fe',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Sincroniza y arrastra nombres y metas capturadas en el Paso 2"
                        >
                          🔄 Sincronizar con Plantilla (Paso 2)
                        </button>
                        <button
                          type="button"
                          onClick={() => syncPersonalMetas(undefined, true)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(245,158,11,0.4)',
                            background: 'rgba(245,158,11,0.15)',
                            color: '#fcd34d',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Regenera sugerencias SMART oficiales por cada cargo de la plantilla"
                        >
                          ✨ Regenerar sugerencias SMART por rol
                        </button>
                      </div>
                    </div>

                    {/* Status banner de Cobertura C10 */}
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: coveragePercent >= 80 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      border: `1px solid ${coveragePercent >= 80 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                      color: coveragePercent >= 80 ? '#6ee7b7' : '#fcd34d',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span>{coveragePercent >= 80 ? '✅' : '⚠️'}</span>
                      <span>
                        Cobertura de metas: <strong>{personalWithGoals} de {realStaffCount} trabajadores ({coveragePercent}%)</strong>
                        {coveragePercent >= 80 ? ' — Cumple con la recomendación de corresponsabilidad docente de la norma SEP Puebla / SEMS.' : ' — Se recomienda al menos 80%.'}
                      </span>
                    </div>

                    <div style={{ maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(planAccion?.metas_personales || []).map((mp, i) => {
                        const isFromStep2 = staffData.some(
                          s => s.nombre?.trim().toLowerCase() === mp.nombre?.trim().toLowerCase() &&
                               ((s.metas_individuales && s.metas_individuales.length > 0 && s.metas_individuales[0]?.meta?.trim().length >= 5) ||
                                (s.meta_individual && s.meta_individual.trim().length >= 5))
                        );

                        return (
                          <div key={i} style={{ padding: '12px', background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.06)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#c7d2fe' }}>{mp.nombre}</div>
                                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', color: 'rgba(240,244,255,0.7)' }}>{mp.cargo}</span>
                                <span style={{ fontSize: '10.5px', background: isFromStep2 ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.18)', color: isFromStep2 ? '#6ee7b7' : '#a5b4fc', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                  {isFromStep2 ? '🏷️ Definida en Paso 2' : '✨ Sugerencia SMART por Cargo (Aceptada)'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => setEditingPersonal(editingPersonal === i ? null : i)}
                                  style={{ background: 'rgba(99,102,241,0.3)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                >
                                  {editingPersonal === i ? '✓ Listo' : '✏️ Editar'}
                                </button>
                              </div>
                            </div>

                            {editingPersonal === i ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                  { key: 'meta_individual', label: 'Redacción de Meta Individual SMART' },
                                  { key: 'estrategia', label: 'Estrategia / Acciones de implementación' },
                                  { key: 'entregable', label: 'Entregable / Evidencia verificable' },
                                  { key: 'periodo', label: 'Período de ejecución' },
                                ].map(f => (
                                  <div key={f.key}>
                                    <label style={{ ...labelStyle, fontSize: '11px' }}>{f.label}</label>
                                    <textarea
                                      value={((mp as unknown) as Record<string, string>)[f.key] || ''}
                                      onChange={e => {
                                        const copy = { ...planAccion! };
                                        const arr = [...copy.metas_personales];
                                        arr[i] = { ...arr[i], [f.key]: e.target.value };
                                        copy.metas_personales = arr;
                                        setPlanAccion(copy);
                                      }}
                                      style={{ ...inputStyle, minHeight: f.key === 'meta_individual' || f.key === 'estrategia' ? '54px' : '36px', fontSize: '12px' }}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
                                <div><strong>Meta:</strong> {mp.meta_individual}</div>
                                {mp.estrategia && <div style={{ marginTop: '3px', color: 'rgba(240,244,255,0.75)' }}><strong>Estrategia:</strong> {mp.estrategia}</div>}
                                <div style={{ marginTop: '3px', color: 'rgba(240,244,255,0.85)' }}><strong>Entregable:</strong> {mp.entregable}</div>
                                <div style={{ marginTop: '3px', color: 'rgba(240,244,255,0.5)', fontSize: '11px' }}><strong>Período:</strong> {mp.periodo}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!projectId || !planAccion) return;
                        setSaving(true);
                        await fetch(`/api/pmc/${projectId}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ plan_accion: planAccion }),
                        });
                        setSaving(false);
                        setSuccessBanner('✓ Cambios en el plan de acción guardados correctamente.');
                        setTimeout(() => setSuccessBanner(null), 3500);
                      }}
                      style={{ marginTop: '14px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                      disabled={saving}
                    >
                      {saving ? 'Guardando...' : '💾 Guardar cambios del plan'}
                    </button>
                  </div>
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
                  onClick={() => goToStep(4)}
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
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#818cf8', marginBottom: '18px' }}>📥 Documentos Oficiales y Entregables</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1. ENTREGA PRINCIPAL OFICIAL PARA SUPERVISIÓN */}
                <div style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.45) 100%)', border: '1.5px solid rgba(99, 102, 241, 0.5)', borderRadius: '10px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#e0e7ff' }}>🏛️ Programa de Mejora Continua (PMC) — Documento Oficial</span>
                      <span style={{ background: '#3b82f6', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>ENTREGA OFICIAL SUPERVISIÓN</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(240, 244, 255, 0.8)', marginTop: '6px', lineHeight: '1.5' }}>
                      Documento oficial institucional de 8 secciones canónicas conforme a los lineamientos vigentes de Supervisión Escolar SEMS Puebla. Versiones en Word (.docx) y PDF con contenido, estructura, tablas normativas de 4 columnas con justificación y matriz de seguimiento 100% espejo.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <a
                      href={`/api/pdf/pmc/${projectId}`}
                      onClick={(e) => handleExportWithCoverageCheck(e, `/api/pdf/pmc/${projectId}`)}
                      className="btn btn-primary"
                      style={{ backgroundColor: '#c0392b', borderColor: '#c0392b', color: '#fff', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      📕 Descargar PMC Oficial (.pdf)
                    </a>
                    <a
                      href={`/api/docx/pmc/${projectId}`}
                      onClick={(e) => handleExportWithCoverageCheck(e, `/api/docx/pmc/${projectId}`)}
                      className="btn btn-primary"
                      style={{ backgroundColor: 'var(--c-navy)', borderColor: 'var(--c-navy)', color: '#fff', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      📄 Descargar PMC Oficial (.docx)
                    </a>
                  </div>
                </div>

                {/* 2. ANEXO TÉCNICO OFICIAL DE SUPERVISIÓN */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#34d399' }}>📊 Anexo Técnico: Matriz de Supervisión y Metas (.xlsx)</span>
                      <span style={{ background: '#059669', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>ANEXO OFICIAL</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(240,244,255,0.7)' }}>
                      Formato oficial de 3 hojas (Indicadores, Punto de partida, METAS) y Anexo de Plan de Acción alineado byte a byte a los requerimientos de la Supervisión Escolar SEMS Puebla.
                    </div>
                  </div>
                  <a
                    href={`/api/excel/metas/${projectId}`}
                    className="btn btn-primary"
                    style={{ flexShrink: 0, backgroundColor: '#059669', borderColor: '#059669', textDecoration: 'none', fontWeight: 600 }}
                  >
                    ↓ Descargar Excel Anexo (.xlsx)
                  </a>
                </div>

                {/* 3. PLANTILLAS DE SEGUIMIENTO Y EVALUACIÓN */}
                <div style={{ marginTop: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(240,244,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>📁 Plantillas Oficiales de Seguimiento y Monitoreo</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Informe Parcial */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '2px' }}>📋 Plantilla: Informe Parcial de Avance</div>
                        <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.6)' }}>
                          Formato para el seguimiento a mitad de ciclo. Incluye las metas de tu PMC con espacios para registrar los avances y evidencias reales.
                        </div>
                      </div>
                      <a
                        href={`/api/docx/pmc/${projectId}/informe-parcial`}
                        className="btn btn-sm"
                        style={{ flexShrink: 0, background: 'rgba(14,165,233,0.2)', border: '1px solid rgba(14,165,233,0.4)', color: '#38bdf8', textDecoration: 'none' }}
                      >
                        ↓ Informe Parcial (.docx)
                      </a>
                    </div>

                    {/* Informe Final */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#34d399', marginBottom: '2px' }}>📋 Plantilla: Informe Final</div>
                        <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.6)' }}>
                          Formato para el informe anual al cierre del ciclo escolar con espacios para evidencias y conclusiones.
                        </div>
                      </div>
                      <a
                        href={`/api/docx/pmc/${projectId}/informe-final`}
                        className="btn btn-sm"
                        style={{ flexShrink: 0, background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', textDecoration: 'none' }}
                      >
                        ↓ Informe Final (.docx)
                      </a>
                    </div>
                  </div>
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
                      <strong style={{ fontSize: '14px', color: '#f8fafc' }}>
                        {formatZoneMetric(zonaData.plantel.matricula)}
                      </strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Abandono</span>
                      <strong style={{ fontSize: '14px', color: '#fbbf24' }}>
                        {formatZoneMetric(zonaData.plantel.abandono, { pct: true })}
                      </strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Efic. Terminal</span>
                      <strong style={{ fontSize: '14px', color: '#34d399' }}>
                        {formatZoneMetric(zonaData.plantel.eficienciaTerminal, { pct: true })}
                      </strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Reprobación</span>
                      <strong style={{ fontSize: '14px', color: '#f87171' }}>
                        {formatZoneMetric(zonaData.plantel.reprobacion, { pct: true })}
                      </strong>
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
              maxWidth: '880px',
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

              {/* Banner de Cobertura Honesta (H-296): verde sólo si ratio >= 0.9 y sin parcialMetas; si no, conteo exacto */}
              {ingestCoverage && (() => {
                const ratio = typeof ingestCoverage.ratio === 'number'
                  ? ingestCoverage.ratio
                  : (ingestCoverage.detectados ? ingestCoverage.extraidos / ingestCoverage.detectados : 1);
                const isParcialMetas = Boolean(ingestCoverage.detalles?.metas?.parcial);
                const isComplete = !ingestCoverage.parcial && ratio >= 0.9 && !isParcialMetas;
                const totalEsperado = ingestCoverage.esperado ?? ingestCoverage.detectados ?? ingestCoverage.extraidos;
                const totalExtraidos = ingestCoverage.extraidos;
                const faltantes = Math.max(0, totalEsperado - totalExtraidos);

                if (isComplete) {
                  return (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      color: '#6ee7b7',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '16px' }}>✅</span>
                      <span>
                        <strong>Extracción completa:</strong> se estructuraron satisfactoriamente {totalExtraidos}/{totalEsperado} elementos ({Math.round(ratio * 100)}%).
                      </span>
                    </div>
                  );
                }

                if (ingestCoverage.parcial) {
                  return (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      color: '#fbbf24',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '16px' }}>⚠️</span>
                      <span>
                        <strong>Extracción parcial ({Math.round(ratio * 100)}%):</strong> se extrajeron {totalExtraidos} de {totalEsperado} elementos detectados (faltan {faltantes} por estructurar). Puedes revisar y editar los elementos en la tabla inferior antes de continuar.
                      </span>
                    </div>
                  );
                }

                if (ingestCoverage.indeterminada) {
                  return (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px dashed rgba(245, 158, 11, 0.35)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      color: '#fbbf24',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '16px' }}>ℹ️</span>
                      <span>
                        <strong>Cobertura no totalizada:</strong> se extrajeron {ingestCoverage.extraidos} elementos, pero el modelo no reportó el total detectado para contrastar. Revisa los elementos en el modal.
                      </span>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Banner Ámbar de Advertencias Literales del Parser (H-182) */}
              {ingestWarnings.length > 0 && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ⚠️ Advertencias de Ingesta ({ingestWarnings.length})
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#fde68a', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {ingestWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

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

              {/* Elementos del Plan de Acción Previo (Revisión editable C1) */}
              {editableElementosPlan.length > 0 ? (() => {
                const metasGroup = editableElementosPlan.map((e, idx) => ({ e, idx })).filter(item => item.e.tipo === 'meta');
                const actividadesGroup = editableElementosPlan.map((e, idx) => ({ e, idx })).filter(item => item.e.tipo === 'actividad');
                const otrosGroup = editableElementosPlan.map((e, idx) => ({ e, idx })).filter(item => item.e.tipo !== 'meta' && item.e.tipo !== 'actividad');

                const renderElementCard = ({ e, idx }: { e: EditablePlanElement; idx: number }) => (
                  <div key={idx} style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: e.requiere_revision ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Tipo:</label>
                        <select
                          value={e.tipo}
                          onChange={(ev) => updateEditableElemento(idx, { tipo: ev.target.value as EditablePlanElement['tipo'] })}
                          style={{
                            background: '#1e293b',
                            color: '#f0f4ff',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="meta">🎯 Meta (Resultado con indicador)</option>
                          <option value="actividad">⚡ Actividad (Acción de ejecución)</option>
                          <option value="estrategia">🛠️ Estrategia (Medio/Agrupación)</option>
                          <option value="indicador">📊 Indicador</option>
                          <option value="responsable">👤 Responsable</option>
                          <option value="evidencia">📁 Evidencia</option>
                          <option value="cronograma">📅 Cronograma</option>
                          <option value="otro">📌 Otro elemento</option>
                        </select>
                        {e.categoria && (
                          <span style={{ fontSize: '10px', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                            {e.categoria}
                          </span>
                        )}
                        {e.tema && (
                          <span style={{ fontSize: '10px', color: '#c7d2fe', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                            {e.tema}
                          </span>
                        )}
                        {e.responsable && (
                          <span style={{ fontSize: '10px', color: '#a7f3d0', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                            👤 {e.responsable}
                          </span>
                        )}
                      </div>
                      {e.requiere_revision && (
                        <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          ⚠️ Requiere revisión
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                      <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 700 }}>
                          📖 Texto Original del Documento (Solo lectura)
                        </div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {e.texto_original || '(Vacío)'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '10px', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 700 }}>
                          ✍️ Texto Normalizado / Corregido (Editable)
                        </div>
                        <textarea
                          value={e.texto_normalizado}
                          onChange={(ev) => updateEditableElemento(idx, { texto_normalizado: ev.target.value })}
                          rows={3}
                          style={{
                            width: '100%',
                            background: 'rgba(30, 41, 59, 0.85)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            fontSize: '12px',
                            color: '#f0f4ff',
                            lineHeight: 1.4,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                          placeholder="Redacción de la meta o elemento..."
                        />
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>
                        📋 Elementos del Plan de Acción Previo ({editableElementosPlan.length} detectados)
                      </h4>
                      <span style={{ fontSize: '11px', color: 'rgba(240,244,255,0.6)' }}>
                        {metasGroup.length} Metas · {actividadesGroup.length} Actividades · {otrosGroup.length} Otros
                      </span>
                    </div>

                    {/* Bloque 1: Metas Institucionales */}
                    {metasGroup.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#93c5fd', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🎯</span> Metas Institucionales ({metasGroup.length})
                        </div>
                        <div style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                          {metasGroup.map(renderElementCard)}
                        </div>
                      </div>
                    )}

                    {/* Bloque 2: Actividades */}
                    {actividadesGroup.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>⚡</span> Actividades del Plan ({actividadesGroup.length})
                        </div>
                        <div style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                          {actividadesGroup.map(renderElementCard)}
                        </div>
                      </div>
                    )}

                    {/* Bloque 3: Otros elementos */}
                    {otrosGroup.length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📌</span> Otros Elementos ({otrosGroup.length})
                        </div>
                        <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                          {otrosGroup.map(renderElementCard)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })() : parsedPmcData.metas_institucionales_previas && parsedPmcData.metas_institucionales_previas.length > 0 ? (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>
                    🎯 Metas del Plan de Acción Previo ({parsedPmcData.metas_institucionales_previas.length} detectadas)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                    {parsedPmcData.metas_institucionales_previas.map((m, idx: number) => (
                      <div key={idx} style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '4px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                        <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{m.categoria} · {m.tema}:</span>{' '}
                        <span style={{ color: '#f0f4ff' }}>{m.meta}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

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
