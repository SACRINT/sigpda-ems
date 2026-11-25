import type {
  CommunityContext,
  SchoolContext,
  SchoolType,
  GroupTrackConfig,
  Fase1Diagnostico,
  Fase2Justificacion,
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
  PlanOperativoRow,
} from '@/types/paec';

export type PaecEditPayload =
  | Fase1Diagnostico
  | Fase2Justificacion
  | MapeoRow[]
  | CronogramaRow[]
  | DetalleCurricularRow[]
  | PlanOperativoRow[]
  | Record<string, unknown>
  | null;

export const PAEC_DRAFT_KEY = 'didactica_paec_draft';

/** Reads the PAEC draft from localStorage (returns null if none) */
export function readPaecDraft(): PaecFormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PAEC_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Saves PAEC form draft to localStorage */
export function savePaecDraft(draft: PaecFormDraft) {
  try {
    window.localStorage.setItem(PAEC_DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage full or unavailable */ }
}

/** Clears PAEC form draft from localStorage */
export function clearPaecDraft() {
  try { window.localStorage.removeItem(PAEC_DRAFT_KEY); } catch { /* ignore */ }
}

export interface PaecCacheInvalidationOptions {
  startingFromStep?: number;
  targetStep?: number;
  targetBlock?: string | number;
}

export type InvalidateCacheTarget = number | PaecCacheInvalidationOptions;

/** Reads cached step data from localStorage */
export function getCachedPaecStep(pId: string, stepNum: number): unknown | null {
  if (typeof window === 'undefined' || !pId) return null;
  try {
    const raw = window.localStorage.getItem(`paec_cache_${pId}_step${stepNum}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Saves step data to localStorage */
export function setCachedPaecStep(pId: string, stepNum: number, data: unknown) {
  if (typeof window === 'undefined' || !pId || !data) return;
  try {
    window.localStorage.setItem(`paec_cache_${pId}_step${stepNum}`, JSON.stringify(data));
  } catch { /* storage full or unavailable */ }
}

/** Reads cached block data from localStorage */
export function getCachedPaecBlock(pId: string, stepNum: number, blockId: string | number): unknown | null {
  if (typeof window === 'undefined' || !pId) return null;
  try {
    const raw = window.localStorage.getItem(`paec_cache_${pId}_step${stepNum}_block${blockId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Saves block data to localStorage */
export function setCachedPaecBlock(pId: string, stepNum: number, blockId: string | number, data: unknown) {
  if (typeof window === 'undefined' || !pId || !data) return;
  try {
    window.localStorage.setItem(`paec_cache_${pId}_step${stepNum}_block${blockId}`, JSON.stringify(data));
  } catch { /* storage full or unavailable */ }
}

/** Invalidates cached steps or granular blocks when regenerated */
export function invalidatePaecStepCache(pId: string, target: InvalidateCacheTarget) {
  if (typeof window === 'undefined' || !pId) return;
  try {
    if (typeof target === 'number') {
      const startingFromStep = target;
      if (startingFromStep <= 4) {
        window.localStorage.removeItem(`paec_cache_${pId}_step4`);
      }
      if (startingFromStep <= 5) {
        window.localStorage.removeItem(`paec_cache_${pId}_step5`);
      }
      for (let s = startingFromStep; s <= 9; s++) {
        window.localStorage.removeItem(`paec_cache_${pId}_step${s}`);
        const prefix = `paec_cache_${pId}_step${s}_block`;
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            toRemove.push(key);
          }
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
      }
      return;
    }

    const { startingFromStep, targetStep, targetBlock } = target;

    // Granular block invalidation (preserves neighbor blocks)
    if (targetStep !== undefined && targetBlock !== undefined) {
      window.localStorage.removeItem(`paec_cache_${pId}_step${targetStep}_block${targetBlock}`);
      return;
    }

    // Step-level invalidation (clears step and all its sub-blocks)
    if (targetStep !== undefined) {
      window.localStorage.removeItem(`paec_cache_${pId}_step${targetStep}`);
      const prefix = `paec_cache_${pId}_step${targetStep}_block`;
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          toRemove.push(key);
        }
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k));
      return;
    }

    // Cascading invalidation starting from step
    if (startingFromStep !== undefined) {
      for (let s = startingFromStep; s <= 9; s++) {
        window.localStorage.removeItem(`paec_cache_${pId}_step${s}`);
        const prefix = `paec_cache_${pId}_step${s}_block`;
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            toRemove.push(key);
          }
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
      }
    }
  } catch { /* ignore */ }
}

export interface PaecFormDraft {
  projectName: string;
  problemStatement: string;
  cycleType: 'A' | 'B' | 'annual';
  community: CommunityContext;
  school: SchoolContext;
  schoolType?: SchoolType;
  selectedFundamental?: string[];
  selectedLaboral: string[];
  selectedLaboralCustom?: string[];
  selectedFfe: string[];
  selectedFfeCustom?: string[];
  selectedBtCarreras?: string[];
  groupsCount: string;
  groupsConfig: string;
  groupAssignments?: GroupTrackConfig[];
  semestersConfig?: Record<number, number>;
}

export interface Props {
  locale: string;
  initialId: string | null;
}


export const CYCLE_LABELS: Record<string, string> = {
  A: 'Semestre A (1°, 3° y 5°)',
  B: 'Semestre B (2°, 4° y 6°)',
  annual: 'Proyecto Completo (1° al 6°)',
};

export const CAPACITACION_TITLES: Record<string, string> = {
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

export const FFE_PAIRS = [
  // ── Recursos Sociocognitivos (7) ──────────────────────────────────────────
  { name5: 'Comunicación y Sociedad I', name6: 'Comunicación y Sociedad II', label: 'Comunicación y Sociedad', category: 'Recursos Sociocognitivos' },
  { name5: 'Raíces Etimológicas del Español I', name6: 'Raíces Etimológicas del Español II', label: 'Raíces Etimológicas del Español', category: 'Recursos Sociocognitivos' },
  { name5: 'Inglés V', name6: 'Inglés VI', label: 'Inglés Avanzado', category: 'Recursos Sociocognitivos' },
  { name5: 'Taller Pensamiento Variacional I', name6: 'Taller Pensamiento Variacional II', label: 'Taller de Pensamiento Variacional', category: 'Recursos Sociocognitivos' },
  { name5: 'Dibujo Técnico I', name6: 'Dibujo Técnico II', label: 'Dibujo Técnico', category: 'Recursos Sociocognitivos' },
  { name5: 'Pensamiento Matemático Aplicado a las Finanzas I', name6: 'Pensamiento Matemático Aplicado a las Finanzas II', label: 'Pensamiento Matemático Finanzas', category: 'Recursos Sociocognitivos' },
  { name5: 'Taller de Probabilidad y Estadística I', name6: 'Taller de Probabilidad y Estadística II', label: 'Taller de Probabilidad y Estadística', category: 'Recursos Sociocognitivos' },

  // ── Áreas de Conocimiento (13) ─────────────────────────────────────────────
  { name5: 'Salud Integral I', name6: 'Salud Integral II', label: 'Salud Integral', category: 'Ciencias Naturales y Salud' },
  { name5: 'Análisis de Fenómenos y Procesos Biológicos', name6: 'Temas Selectos de Biología', label: 'Ciencias Biológicas', category: 'Ciencias Naturales y Salud' },
  { name5: 'Análisis de Fenómenos Físicos I', name6: 'Análisis de Fenómenos Físicos II', label: 'Análisis de Fenómenos Físicos', category: 'Ciencias Naturales y Salud' },
  { name5: 'Organización del Flujo de Materia y Energía en los Organismos I', name6: 'Organización del Flujo de Materia y Energía en los Organismos II', label: 'Flujo de Materia y Energía', category: 'Ciencias Naturales y Salud' },
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

export function classifyError(err: unknown): { message: string; type: 'timeout' | 'json' | 'rate_limit' | 'network' | 'unknown' } {
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

export interface AcademicBaseline {
  abandono?: number;
  eficienciaTerminal?: number;
  aprobacion?: number;
  reprobacion?: number;
  rezago?: number;
  promAbandonoZona?: number;
  promEficienciaZona?: number;
  problematicasComunesZona?: string[];
}

