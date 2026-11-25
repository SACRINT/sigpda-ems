import type React from 'react';
import { PMC_CATEGORIAS_OFICIALES } from '@/lib/constants/pmc-categorias';
import { computeMetaSimilarity, normalizeMetaText, hasDistinctEvaluationLevels, isAbandonoGoal } from '@/lib/pmc-meta-deduplicator';
import { mapFinAnteriorToIndicadores } from '@/lib/pmc/indicadores-mapping';
import type { PmcAuditCalculationEntry, PmcMetaAsignaturaDTO } from '@/types/pmc';

export type DirectorSource = 'manual' | 'bd' | 'f11' | '911' | 'paec' | 'pmc_anterior' | 'draft' | 'none';

export const PMC_DRAFT_KEY = 'didactica_pmc_draft';

export interface PmcFormDraft {
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

export function readPmcDraft(): PmcFormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PMC_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function savePmcDraft(draft: PmcFormDraft) {
  try { window.localStorage.setItem(PMC_DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
}

export function clearPmcDraft() {
  try { window.localStorage.removeItem(PMC_DRAFT_KEY); } catch { /* ignore */ }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface MetaIndividual {
  categoria: string;
  tema: string;
  meta: string;
  estrategia: string;
  entregable: string;
  periodo: string;
}

export interface StaffMember {
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

export interface Foda {
  fortalezas: string;
  oportunidades: string;
  debilidades: string;
  amenazas: string;
}

export interface MetaInstitucional {
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
      if (
        normM === normMp ||
        (!hasDistinctEvaluationLevels(m.meta, mp.meta || mp.texto_original) &&
          computeMetaSimilarity(m.meta, mp.meta || mp.texto_original) >= 0.60)
      ) {
        return true;
      }
    }
    // Regla de unicidad institucional para abandono escolar: si ya existe una meta oficial de abandono, está cubierta
    if (
      isAbandonoGoal(mp as Parameters<typeof isAbandonoGoal>[0]) &&
      isAbandonoGoal(m as Parameters<typeof isAbandonoGoal>[0])
    ) {
      return true;
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

export interface MetaPersonal {
  nombre: string;
  cargo: string;
  categoria?: string;
  tema?: string;
  meta_individual: string;
  estrategia: string;
  entregable: string;
  periodo: string;
}

export interface PlanAccion {
  metas_institucionales: MetaInstitucional[];
  metas_personales: MetaPersonal[];
}

export interface DiagnosticoGenerado {
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

export interface Props {
  locale: string;
  teacherId: string;
  teacherName: string;
  teacherSchool?: string;
  teacherMunicipality?: string;
  existingProject: PmcProject | null;
}

export async function parseSafeApiResponse<T = { success?: boolean; error?: string; data?: unknown }>(
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

export interface CategoriaPriorizada {
  id: string;
  nombre: string;
  temas: string[];
}

export const CATEGORIAS_OFICIALES = [
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

export const CARGOS_COMUNES = [
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

export const SUBSISTEMAS = ['BGE', 'Bachillerato Tecnológico', 'TBC', 'CBTA', 'CECyTE', 'COBACH', 'Preparatoria federal', 'Otro'];

export const STEPS = [
  { n: 1, label: 'Datos institucionales' },
  { n: 2, label: 'Personal' },
  { n: 3, label: 'Diagnóstico' },
  { n: 4, label: 'Generación IA' },
  { n: 5, label: 'Revisión y exportar' },
];


export const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.14)', fontSize: '14px',
    fontFamily: 'inherit',
    background: 'rgba(255,255,255,0.07)',
    color: '#f0f4ff',
  };
export const labelStyle: React.CSSProperties = {
    display: 'block', fontWeight: 600, fontSize: '12px',
    color: 'rgba(240,244,255,0.6)', marginBottom: '4px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  };
export const sectionCard: React.CSSProperties = {
    background: 'rgba(13,21,48,0.7)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '20px', marginBottom: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  };

export interface PmcPreviousExtractStaff {
  nombre: string;
  cargo: string;
  meta_individual?: string;
  metas_individuales?: MetaIndividual[];
  asignaturas?: string;
  grupos?: string;
  horas?: number | string;
}

export interface F11ResponseDTO {
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

export interface Estadistica911ResponseDTO {
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

export interface PmcPreviousExtractDTO {
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

export interface EditablePlanElement {
  tipo: 'meta' | 'actividad' | 'estrategia' | 'indicador' | 'responsable' | 'evidencia' | 'cronograma' | 'otro';
  texto_original: string;
  texto_normalizado: string;
  categoria?: string;
  tema?: string;
  responsable?: string;
  periodo?: string;
  requiere_revision?: boolean;
}
