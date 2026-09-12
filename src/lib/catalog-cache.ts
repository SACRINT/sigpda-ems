import { sql, ProgramCatalogItem } from '@/lib/db';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let programsCatalogCache: CacheEntry<ProgramCatalogItem[]> | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Obtiene todos los programas oficiales del catálogo desde caché en memoria o base de datos.
 */
export async function getAllCachedPrograms(): Promise<ProgramCatalogItem[]> {
  const now = Date.now();
  if (programsCatalogCache && (now - programsCatalogCache.timestamp < CACHE_TTL_MS)) {
    return programsCatalogCache.data;
  }

  const client = sql();
  const rows = await client`
    SELECT id, uac_name, semester, component, curriculum_name, year, total_hours, 
           learning_outcome, activities, evidences, contenidos_formativos, subsystem, model_type, created_at
    FROM programs_catalog
    ORDER BY semester ASC, component ASC, uac_name ASC
  `;

  programsCatalogCache = {
    data: rows as unknown as ProgramCatalogItem[],
    timestamp: now,
  };

  return programsCatalogCache.data;
}

/**
 * Filtra programas en memoria usando el caché de alto rendimiento.
 */
export async function getFilteredCachedPrograms(
  semester?: number,
  component?: string,
  subsystem?: string
): Promise<ProgramCatalogItem[]> {
  const allPrograms = await getAllCachedPrograms();
  const normalizedSubsystem = (subsystem && subsystem !== 'all' && subsystem !== 'todos') ? subsystem.toLowerCase() : null;
  const normalizedComponent = (component && component !== 'all' && component !== 'todos') ? component : null;
  const sem = (semester !== undefined && !isNaN(semester)) ? semester : null;

  return allPrograms.filter(p => {
    if (sem !== null && p.semester !== sem) return false;
    if (normalizedComponent !== null && p.component !== normalizedComponent) return false;
    if (normalizedSubsystem !== null) {
      const pSub = (p.subsystem || 'all').toLowerCase();
      if (pSub !== 'all' && pSub !== normalizedSubsystem && pSub !== 'bge') return false;
    }
    return true;
  });
}

/**
 * Busca un programa específico por UAC y semestre usando coincidencia rápida en memoria.
 */
export async function getCachedProgramByUacAndSemester(
  uacName: string,
  semester?: number,
  component?: string,
  subsystem?: string
): Promise<ProgramCatalogItem | null> {
  const allPrograms = await getAllCachedPrograms();
  const target = uacName.trim().toLowerCase();
  const sem = (semester !== undefined && !isNaN(semester)) ? semester : null;
  const comp = component && component !== 'all' ? component : null;
  const sub = subsystem && subsystem !== 'all' ? subsystem.toLowerCase() : null;

  // 1. Coincidencia exacta con subsistema o fallback a 'bge'
  const exact = allPrograms.find(p => 
    p.uac_name.toLowerCase() === target &&
    (sem === null || p.semester === sem) &&
    (comp === null || p.component === comp) &&
    (sub === null || (p.subsystem || 'bge').toLowerCase() === sub || (p.subsystem || '').toLowerCase() === 'bge')
  );
  if (exact) return exact;

  // 2. Coincidencia por nombre y semestre
  const matchSem = allPrograms.find(p => 
    (p.uac_name.toLowerCase() === target || p.uac_name.toLowerCase().includes(target) || target.includes(p.uac_name.toLowerCase())) &&
    (sem === null || p.semester === sem)
  );
  if (matchSem) return matchSem;

  // 3. Coincidencia general
  return allPrograms.find(p => 
    p.uac_name.toLowerCase().includes(target) || target.includes(p.uac_name.toLowerCase())
  ) || null;
}

/**
 * Invalida el caché en memoria para forzar una recarga en la siguiente consulta.
 */
export function invalidateCatalogCache(): void {
  programsCatalogCache = null;
}
