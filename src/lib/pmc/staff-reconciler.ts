/**
 * src/lib/pmc/staff-reconciler.ts
 *
 * Motor Arquitectónico de Reconciliación y Sincronización de Plantilla (PMC CREAA).
 * Consolida, desduplica y propaga limpiamente el personal extraído desde múltiples
 * fuentes documentales (PMC anterior, Formato F11, Estadística 911 y formulario wizard)
 * garantizando integridad referencial y asignación segura del Director(a).
 *
 * SIGPDA-EMS · SEMS Puebla MCCEMS
 */

import {
  PMC_CATEGORIAS_OFICIALES,
  normalizePmcCategoria,
  normalizePmcTema,
} from '@/lib/constants/pmc-categorias';

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
  meta_individual?: string;
  metas_individuales?: MetaIndividual[];
  asignaturas?: string;
  grupos?: string;
}

export interface RawStaffCandidate {
  nombre?: string | null;
  cargo?: string | null;
  meta_individual?: string | null;
  metas_individuales?: Array<{
    categoria?: string | null;
    tema?: string | null;
    meta?: string | null;
    estrategia?: string | null;
    entregable?: string | null;
    periodo?: string | null;
  }> | null;
  asignaturas?: string | null;
  grupos?: string | null;
}

export interface ReconcileStaffOptions {
  existingStaff?: RawStaffCandidate[] | null;
  extractedStaff?: RawStaffCandidate[] | null;
  participantes?: Array<{ nombre?: string | null; cargo?: string | null; firma?: string | null }> | null;
  f11Docentes?: Array<{ docente?: string | null; asignatura?: string | null; grupos?: string | null }> | null;
  docentesList?: Array<string | null> | null;
  directorName?: string | null;
  targetTotalStaff?: number | null;
  cicloEscolar?: string | null;
}

export interface ReconciledStaffResult {
  staff: StaffMember[];
  totalStaff: number;
}

const INVALID_NAME_PATTERNS = [
  'sin asignar',
  'vacante',
  'por asignar',
  'pendiente',
  'no asignado',
  'docente',
  'profesor',
  'maestro',
  'director',
  'subdirector',
  'n/a',
  'ninguno',
  'ninguna',
];

export const TITLE_PREFIX_REGEX = /^(?:profr\.|profr|profra\.|profra|prof\.|prof|ing\.|ing|lic\.|lic|dr\.|dr|dra\.|dra|mtro\.|mtro|mtra\.|mtra|c\.|c)\s+/i;

const NON_STAFF_CARGO_KEYWORDS = [
  'alumno',
  'alumna',
  'estudiante',
  'aprendiente',
  'padre',
  'madre',
  'tutor legal',
  'comite de padres',
  'comite escolar',
  'asociacion de padres',
  'apf',
  'supervisor',
  'supervisora',
];

/**
 * Normaliza un nombre para comparación (sin acentos, minúsculas, sin títulos profesionales ni prefijos).
 */
export function normalizeStaffName(name: string | null | undefined): string {
  if (!name) return '';
  const withoutTitle = name
    .trim()
    .replace(TITLE_PREFIX_REGEX, '')
    .trim();

  return withoutTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpia un nombre de persona para presentación:
 * - Si viene todo en MAYÚSCULAS sostenidas (ej. tablas oficiales 'PROFR. JUAN...'),
 *   elimina el prefijo y lo convierte a formato Capitalizado (Title Case).
 * - Si ya viene en formato mixto, preserva la cadena original.
 */
export function cleanStaffDisplayName(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) {
    const withoutTitle = trimmed.replace(TITLE_PREFIX_REGEX, '').trim();
    return withoutTitle
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((word, idx) => {
        if (idx > 0 && ['de', 'del', 'la', 'las', 'los', 'y', 'e'].includes(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }
  return trimmed;
}

/**
 * Determina si un cargo corresponde a personal no docente/no interno del plantel
 * (alumnos, padres de familia o supervisores externos).
 */
export function isNonStaffRole(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  const lower = cargo.toLowerCase();
  return NON_STAFF_CARGO_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Determina si una cadena es un nombre de persona válido (no genérico ni vacío).
 */
export function isValidStaffName(name: string | null | undefined): boolean {
  if (!name) return false;
  const clean = name.trim();
  if (clean.length < 3) return false;
  const normalized = normalizeStaffName(clean);
  if (!normalized || normalized.length < 3) return false;
  if (INVALID_NAME_PATTERNS.includes(normalized)) return false;
  return true;
}

/**
 * Normaliza el cargo de un trabajador o asigna un default oficial.
 */
function normalizeCargo(cargo: string | null | undefined, isDirector = false): string {
  if (isDirector) return 'Director(a)';
  if (!cargo || !cargo.trim()) return 'Docente';
  const c = cargo.trim();
  const lower = c.toLowerCase();
  if (lower.includes('director') && !lower.includes('subdirector')) return 'Director(a)';
  if (lower.includes('subdirector')) return 'Subdirector(a)';
  if (lower.includes('tutor') && (lower.includes('plantel') || lower.includes('escolar'))) return 'Docente y tutor del plantel';
  if (lower.includes('tutor') && (lower.includes('grupo') || lower.includes('grupal'))) return 'Docente y tutor de grupo';
  if (lower.includes('orientador')) return 'Orientador(a) educativo(a)';
  if (lower.includes('secretario')) return 'Secretario(a) académico(a)';
  if (lower.includes('administrativ')) return 'Auxiliar administrativo(a)';
  if (lower.includes('prefect')) return 'Prefecto(a)';
  if (lower.includes('social')) return 'Trabajador(a) social';
  if (lower.includes('intendenc')) return 'Personal de intendencia';
  if (lower.includes('mantenimient') || lower.includes('apoyo')) return 'Personal de apoyo / mantenimiento';
  if (lower.includes('tiempo completo')) return 'Docente de tiempo completo';
  if (lower.includes('horas')) return 'Docente por horas';
  if (lower.includes('docente') || lower.includes('profesor') || lower.includes('maestro')) return 'Docente';
  return c;
}

/**
 * Reconcilia y consolida la plantilla del personal del plantel desde múltiples fuentes.
 */
export function reconcilePmcStaff(options: ReconcileStaffOptions): ReconciledStaffResult {
  const {
    existingStaff = [],
    extractedStaff = [],
    participantes = [],
    f11Docentes = [],
    docentesList = [],
    directorName,
    targetTotalStaff,
    cicloEscolar = '2026-2027',
  } = options;

  const safeCiclo = cicloEscolar || '2026-2027';
  const staffByNormName = new Map<string, StaffMember>();
  const staffOrder: string[] = [];

  const addOrUpdateStaff = (candidate: RawStaffCandidate, isDirectorCandidate = false) => {
    const rawName = candidate.nombre?.trim();
    if (!rawName || !isValidStaffName(rawName)) return;
    if (isNonStaffRole(candidate.cargo)) return;

    const normKey = normalizeStaffName(rawName);
    const cargoNorm = normalizeCargo(candidate.cargo, isDirectorCandidate);
    const cleanDisplay = cleanStaffDisplayName(rawName);

    // Normalizar metas individuales asociadas
    const rawMetas = candidate.metas_individuales || [];
    const normalizedMetas: MetaIndividual[] = rawMetas
      .filter((m) => m && (m.meta || m.tema || m.categoria))
      .map((m) => {
        const catNorm = normalizePmcCategoria(m.categoria || null);
        const temaNorm = normalizePmcTema(m.tema || null, catNorm);
        return {
          categoria: catNorm,
          tema: temaNorm,
          meta: m.meta?.trim() || '',
          estrategia: m.estrategia?.trim() || '',
          entregable: m.entregable?.trim() || '',
          periodo: m.periodo?.trim() || `agosto ${safeCiclo.split('-')[0] || '2026'} - junio ${safeCiclo.split('-')[1] || '2027'}`,
        };
      });

    // Si tiene meta individual como texto libre pero no arreglo estructurado
    if (normalizedMetas.length === 0 && candidate.meta_individual && candidate.meta_individual.trim()) {
      normalizedMetas.push({
        categoria: PMC_CATEGORIAS_OFICIALES[0].nombre,
        tema: PMC_CATEGORIAS_OFICIALES[0].temas[0],
        meta: candidate.meta_individual.trim(),
        estrategia: '',
        entregable: '',
        periodo: `agosto ${safeCiclo.split('-')[0] || '2026'} - junio ${safeCiclo.split('-')[1] || '2027'}`,
      });
    }

    if (!staffByNormName.has(normKey)) {
      staffByNormName.set(normKey, {
        nombre: cleanDisplay,
        cargo: cargoNorm,
        meta_individual: candidate.meta_individual?.trim() || '',
        metas_individuales: normalizedMetas,
        asignaturas: candidate.asignaturas?.trim() || '',
        grupos: candidate.grupos?.trim() || '',
      });
      staffOrder.push(normKey);
    } else {
      // Enriquecer datos existentes si la nueva fuente aporta más detalles
      const existing = staffByNormName.get(normKey)!;
      if (cleanDisplay && existing.nombre === existing.nombre.toUpperCase() && cleanDisplay !== cleanDisplay.toUpperCase()) {
        existing.nombre = cleanDisplay;
      }
      if (isDirectorCandidate && existing.cargo !== 'Director(a)') {
        existing.cargo = 'Director(a)';
      }
      if (candidate.asignaturas && !existing.asignaturas) {
        existing.asignaturas = candidate.asignaturas.trim();
      }
      if (candidate.grupos && !existing.grupos) {
        existing.grupos = candidate.grupos.trim();
      }
      if (normalizedMetas.length > 0 && (!existing.metas_individuales || existing.metas_individuales.length === 0)) {
        existing.metas_individuales = normalizedMetas;
      }
      if (candidate.meta_individual && !existing.meta_individual) {
        existing.meta_individual = candidate.meta_individual.trim();
      }
    }
  };

  // 1. Director institucional prioritario
  const cleanDirectorName = directorName?.trim();
  const hasValidDirector = isValidStaffName(cleanDirectorName);
  if (hasValidDirector) {
    addOrUpdateStaff(
      {
        nombre: cleanDirectorName!,
        cargo: 'Director(a)',
      },
      true
    );
  }

  // 2. Personal existente del wizard (si ya fue capturado con nombres válidos)
  for (const s of existingStaff || []) {
    if (s && isValidStaffName(s.nombre)) {
      addOrUpdateStaff(s, s.cargo?.toLowerCase().includes('director'));
    }
  }

  // 3. Personal extraído de PMC Anterior (staffData)
  for (const s of extractedStaff || []) {
    if (s && isValidStaffName(s.nombre)) {
      addOrUpdateStaff(s, s.cargo?.toLowerCase().includes('director'));
    }
  }

  // 4. Participantes extraídos de PMC Anterior (portadas, comités, firmas)
  for (const p of participantes || []) {
    if (p && isValidStaffName(p.nombre) && !isNonStaffRole(p.cargo)) {
      addOrUpdateStaff(
        {
          nombre: p.nombre!,
          cargo: p.cargo || 'Docente',
        },
        p.cargo?.toLowerCase().includes('director')
      );
    }
  }

  // 5. Docentes de F11 (docentesPorAsignatura)
  if (Array.isArray(f11Docentes) && f11Docentes.length > 0) {
    const f11Map = new Map<string, { asignaturas: string[]; grupos: string[] }>();
    for (const item of f11Docentes) {
      const docName = item.docente?.trim();
      if (isValidStaffName(docName)) {
        if (!f11Map.has(docName!)) {
          f11Map.set(docName!, { asignaturas: [], grupos: [] });
        }
        const entry = f11Map.get(docName!)!;
        if (item.asignatura && !entry.asignaturas.includes(item.asignatura.trim())) {
          entry.asignaturas.push(item.asignatura.trim());
        }
        if (item.grupos && !entry.grupos.includes(item.grupos.trim())) {
          entry.grupos.push(item.grupos.trim());
        }
      }
    }
    for (const [nombre, meta] of f11Map.entries()) {
      addOrUpdateStaff({
        nombre,
        cargo: 'Docente',
        asignaturas: meta.asignaturas.join(', '),
        grupos: meta.grupos.join(', '),
      });
    }
  }

  // 6. Lista general de docentes (F11 u otras fuentes)
  for (const d of docentesList || []) {
    if (isValidStaffName(d)) {
      addOrUpdateStaff({
        nombre: d!.trim(),
        cargo: 'Docente',
      });
    }
  }

  // 7. Ensamblar lista resultante ordenando Director(a) al inicio
  const reconciledList: StaffMember[] = staffOrder.map((key) => staffByNormName.get(key)!);

  const directorIdx = reconciledList.findIndex((s) => s.cargo === 'Director(a)');
  if (directorIdx > 0) {
    const [dir] = reconciledList.splice(directorIdx, 1);
    reconciledList.unshift(dir);
  } else if (directorIdx === -1 && hasValidDirector) {
    reconciledList.unshift({
      nombre: cleanStaffDisplayName(cleanDirectorName!),
      cargo: 'Director(a)',
      meta_individual: '',
      metas_individuales: [],
    });
  }

  // Si el director quedó en posición 0, asegurar nombre limpio
  if (reconciledList.length > 0 && reconciledList[0].cargo === 'Director(a)') {
    const preferredName = cleanStaffDisplayName(cleanDirectorName || reconciledList[0].nombre);
    if (preferredName) {
      reconciledList[0].nombre = preferredName;
    }
  }

  // 8. Determinar conteo objetivo de trabajadores
  const explicitTarget = targetTotalStaff ? Number(targetTotalStaff) : 0;
  const countWithNames = reconciledList.length;
  const finalTotalStaff = Math.max(1, explicitTarget > countWithNames ? explicitTarget : countWithNames);

  // 9. Si la lista está completamente vacía (sin nombres válidos aún), asegurar slot inicial con Director
  if (reconciledList.length === 0) {
    reconciledList.push({
      nombre: cleanDirectorName || '',
      cargo: 'Director(a)',
      meta_individual: '',
      metas_individuales: [],
    });
  }

  // 10. Si el conteo total objetivo (ej. 911 totalDocentes) supera los nombres identificados,
  // completar con slots listos para rellenar
  if (reconciledList.length < finalTotalStaff) {
    const needed = finalTotalStaff - reconciledList.length;
    for (let i = 0; i < needed; i++) {
      reconciledList.push({
        nombre: '',
        cargo: 'Docente de tiempo completo',
        meta_individual: '',
        metas_individuales: [],
      });
    }
  }

  return {
    staff: reconciledList,
    totalStaff: finalTotalStaff,
  };
}
