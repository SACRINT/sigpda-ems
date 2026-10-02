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
import { cleanPmcPlaceholders } from './plan-element-normalizer';

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
  elementosPlan?: Array<{
    tipo?: string;
    responsable?: string;
    texto_normalizado?: string;
    texto_original?: string;
    categoria?: string;
    tema?: string;
    periodo?: string;
  }> | null;
  allowEmptyPadding?: boolean;
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
  'docentes',
  'profesor',
  'profesores',
  'profesora',
  'profesoras',
  'maestro',
  'maestros',
  'maestra',
  'maestras',
  'director',
  'directora',
  'directivo',
  'directivos',
  'subdirector',
  'subdirectora',
  'tutor',
  'tutora',
  'tutores',
  'asesor',
  'asesora',
  'asesores',
  'orientador',
  'orientadora',
  'orientadores',
  'alumno',
  'alumna',
  'alumnos',
  'alumnas',
  'estudiante',
  'estudiantes',
  'aprendiente',
  'aprendientes',
  'padre',
  'padres',
  'madre',
  'madres',
  'autoridad',
  'autoridades',
  'comite',
  'comité',
  'direccion',
  'dirección',
  'plantel',
  'apf',
  'comunidad',
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
 * Detecta si una cadena corresponde a un comité, colectivo u órgano colegiado
 * y NO a una persona física individual.
 */
export function isCollectiveOrNonHumanEntity(name: string | null | undefined): boolean {
  if (!name) return false;
  const clean = name.trim().toLowerCase();

  // 1. Detección por combinaciones de cargos/colectivos unidos por 'y', comas, 'e', '/' u 'o'
  if (/\b(?:director|directora|directivo|directivos|docente|docentes|administrativo|administrativos|padres|madres|tutores|tutor|asesor|asesores|comite|comité|alumnos|estudiantes|aprendientes|autoridad|autoridades|comunidad)\b.*\b(?:y|e|o|,|\/)\b.*\b(?:director|directora|directivo|directivos|docente|docentes|administrativo|administrativos|padres|madres|tutores|tutor|asesor|asesores|comite|comité|alumnos|estudiantes|aprendientes|autoridad|autoridades|comunidad|salud|familia|grupo|plantel|escolar)\b/i.test(clean)) {
    return true;
  }

  // 2. Frases colectivas o institucionales explícitas
  const collectivePhrases = [
    'colectivo docente',
    'comunidad escolar',
    'comunidad educativa',
    'padres de familia',
    'comite de salud',
    'comité de salud',
    'comite escolar',
    'comité escolar',
    'comite de apf',
    'comité de apf',
    'comite',
    'comité',
    'apf',
    'asociacion de padres',
    'asociación de padres',
    'direccion del plantel',
    'dirección del plantel',
    'direccion escolar',
    'dirección escolar',
    'plantel',
    'frente a grupo',
    'socioemocionales',
    'todo el personal',
    'todos los docentes',
    'toda la comunidad',
    'consejo tecnico',
    'consejo técnico',
    'cte',
    'academia de',
    'asociacion de',
    'asociación de',
    'asesor de grupo',
    'asesor del grupo',
    'asesores de grupo',
    'tutor del plantel',
    'tutor escolar',
    'tutor de grupo',
    'alumnos',
    'estudiantes',
    'aprendientes',
    'autoridades',
    'autoridad local',
  ];
  if (collectivePhrases.some((phrase) => clean.includes(phrase))) {
    return true;
  }

  // 3. Inicio con conectores o cargos colectivos o palabras individuales colectivas
  if (/^(?:director[a]?\s*(?:,|y)\s*|docentes\b|directivos\b|alumnos\b|estudiantes\b|aprendientes\b|autoridades\b|tutores\b|asesores\b|personal\s+(?:docente|administrativo|de\s+apoyo)|colectivo\s+)/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Normaliza un nombre para comparación (sin acentos, minúsculas, sin títulos profesionales ni prefijos).
 * Expande abreviaturas comunes de apellidos mexicanos para garantizar deduplicación exacta.
 */
export function normalizeStaffName(name: string | null | undefined): string {
  if (!name) return '';
  const withoutTitle = name
    .trim()
    .replace(TITLE_PREFIX_REGEX, '')
    .trim();

  let normalized = withoutTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Expansión de abreviaturas de apellidos mexicanos frecuentes en documentos oficiales
  normalized = normalized
    .replace(/\bhdez\b/g, 'hernandez')
    .replace(/\bglez\b/g, 'gonzalez')
    .replace(/\bmtz\b/g, 'martinez')
    .replace(/\brdz\b/g, 'rodriguez')
    .replace(/\bpz\b/g, 'perez')
    .replace(/\bfdez\b/g, 'fernandez')
    .replace(/\blpr\b/g, 'lopez')
    .replace(/\bvqz\b/g, 'vazquez')
    .replace(/\bsnchz\b/g, 'sanchez')
    .replace(/\bgtz\b/g, 'gutierrez');

  return normalized;
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
 * Determina si una cadena es un nombre de persona válido (no genérico, no colectivo ni vacío).
 */
export function isValidStaffName(name: string | null | undefined): boolean {
  if (!name) return false;
  const clean = name.trim();
  if (clean.length < 3) return false;
  if (/sin nombre expl[íi\ufffd]cito/i.test(clean) || /bloque final/i.test(clean) || /\bdocente sin\b/i.test(clean)) {
    return false;
  }
  if (isCollectiveOrNonHumanEntity(clean)) return false;
  const normalized = normalizeStaffName(clean);
  if (!normalized || normalized.length < 3) return false;
  if (INVALID_NAME_PATTERNS.includes(normalized)) return false;

  // Un nombre de persona física en México tiene al menos 2 palabras (Nombre + Apellido)
  const words = normalized.split(' ').filter((w) => w.length > 1);
  if (words.length < 2) {
    return false;
  }

  // Descartar si alguna palabra clave es institucional o un rol aislado
  const nonPersonTokens = new Set([
    'comite',
    'direccion',
    'plantel',
    'alumnos',
    'estudiantes',
    'aprendientes',
    'docentes',
    'autoridades',
    'apf',
    'escuela',
    'colectivo',
    'directivo',
    'directivos',
    'asesor',
    'asesores',
    'tutor',
    'tutores',
    'comunidad',
    'familia',
    'familias',
  ]);
  if (words.some((w) => nonPersonTokens.has(w))) {
    return false;
  }

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
    allowEmptyPadding = true,
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
        periodo: `Agosto ${safeCiclo.split('-')[0] || '2026'} — Junio ${safeCiclo.split('-')[1] || '2027'}`,
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
      const hasAbbr = /\b(?:hdez|glez|mtz|rdz|pz|fdez|lpr|vqz|snchz|gtz)\b/i;
      if (cleanDisplay && (
        (existing.nombre === existing.nombre.toUpperCase() && cleanDisplay !== cleanDisplay.toUpperCase()) ||
        (hasAbbr.test(existing.nombre) && !hasAbbr.test(cleanDisplay)) ||
        (cleanDisplay.length > existing.nombre.length && !hasAbbr.test(cleanDisplay))
      )) {
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

  // 6b. Asociar metas/actividades extraídas del plan de acción a cada docente/responsable individual
  if (Array.isArray(options.elementosPlan) && options.elementosPlan.length > 0) {
    const rawTeachers = Array.from(staffByNormName.values()).filter(
      (s) => !s.cargo.toLowerCase().includes('director')
    );
    const directorMember = Array.from(staffByNormName.values()).find(
      (s) => s.cargo.toLowerCase().includes('director')
    );
    let roundRobinDocenteIdx = 0;

    for (const elem of options.elementosPlan) {
      const resp = elem.responsable?.trim();
      if (!resp) continue;

      const rawTexto = (elem.texto_normalizado || elem.texto_original || '').trim();
      const texto = cleanPmcPlaceholders(rawTexto);
      if (!texto) continue;

      let targetStaff: StaffMember | undefined;

      // Caso A: El responsable es una persona física real ya registrada o un nombre humano nuevo válido
      if (isValidStaffName(resp)) {
        const normRespKey = normalizeStaffName(resp);
        targetStaff = staffByNormName.get(normRespKey);
        if (!targetStaff) {
          addOrUpdateStaff({
            nombre: resp,
            cargo: 'Docente',
          });
          targetStaff = staffByNormName.get(normRespKey);
        }
      } else {
        // Caso B: El responsable es un rol o colectivo (ej. "Docentes", "Tutor del Plantel", "Dirección")
        const lowerResp = resp.toLowerCase();

        // Omitir actores puramente externos o comunitarios (alumnos, APF, padres, autoridades)
        if (
          lowerResp.includes('alumno') ||
          lowerResp.includes('estudiante') ||
          lowerResp.includes('comite') ||
          lowerResp.includes('comité') ||
          lowerResp.includes('apf') ||
          lowerResp.includes('padre') ||
          lowerResp.includes('madre') ||
          lowerResp.includes('autoridad') ||
          lowerResp.includes('comunidad')
        ) {
          continue; // Permanece en el plan general institucional, pero no crea ni asigna a empleados individuales
        }

        // B1: Si refiere a Dirección / Director
        if (lowerResp.includes('director') || lowerResp.includes('direccion') || lowerResp.includes('dirección')) {
          targetStaff = directorMember;
        }
        // B2: Si refiere al Tutor del Plantel / Tutor
        else if (lowerResp.includes('tutor')) {
          const tutorMember = rawTeachers.find((s) => s.cargo.toLowerCase().includes('tutor'));
          targetStaff = tutorMember || (rawTeachers.length > 0 ? rawTeachers[roundRobinDocenteIdx++ % rawTeachers.length] : directorMember);
        }
        // B3: Si refiere a Asesor de grupo
        else if (lowerResp.includes('asesor')) {
          const asesorMember = rawTeachers.find(
            (s) => s.cargo.toLowerCase().includes('asesor') || s.cargo.toLowerCase().includes('grupo')
          );
          targetStaff = asesorMember || (rawTeachers.length > 0 ? rawTeachers[roundRobinDocenteIdx++ % rawTeachers.length] : directorMember);
        }
        // B4: Si refiere a Docentes / Colectivo
        else if (
          lowerResp.includes('docente') ||
          lowerResp.includes('profesor') ||
          lowerResp.includes('directivo') ||
          lowerResp.includes('colectivo')
        ) {
          if (rawTeachers.length > 0) {
            targetStaff = rawTeachers[roundRobinDocenteIdx++ % rawTeachers.length];
          } else {
            targetStaff = directorMember;
          }
        }
      }

      if (targetStaff) {
        const catNorm = normalizePmcCategoria(elem.categoria || null);
        const temaNorm = normalizePmcTema(elem.tema || null, catNorm);
        if (!targetStaff.metas_individuales) {
          targetStaff.metas_individuales = [];
        }
        const exists = targetStaff.metas_individuales.some(
          (m) => m.meta.toLowerCase() === texto.toLowerCase()
        );
        if (!exists) {
          targetStaff.metas_individuales.push({
            categoria: catNorm,
            tema: temaNorm,
            meta: texto,
            estrategia:
              elem.tipo === 'actividad'
                ? 'Implementación de actividades focalizadas en el aula y plantel.'
                : 'Estrategia institucional del plan de mejora continua.',
            entregable:
              elem.tipo === 'actividad'
                ? 'Reporte de evidencias, listas de asistencia y productos.'
                : 'Informe de cumplimiento y evaluación de metas.',
            periodo:
              elem.periodo?.trim() ||
              `Agosto ${safeCiclo.split('-')[0] || '2026'} — Junio ${safeCiclo.split('-')[1] || '2027'}`,
          });
        }
        if (!targetStaff.meta_individual) {
          targetStaff.meta_individual = texto;
        }
      }
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
  const explicitTarget = (allowEmptyPadding && targetTotalStaff) ? Number(targetTotalStaff) : 0;
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

  // 10. Si el conteo total objetivo (ej. 911 totalDocentes) supera los nombres identificados y se permite relleno,
  // completar con slots listos para rellenar
  if (allowEmptyPadding && reconciledList.length < finalTotalStaff) {
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
    totalStaff: allowEmptyPadding ? finalTotalStaff : reconciledList.length,
  };
}

export interface DerivedPersonalMeta {
  nombre: string;
  cargo: string;
  categoria: string;
  tema: string;
  meta_individual: string;
  estrategia: string;
  entregable: string;
  periodo: string;
}

/**
 * Genera o sincroniza metas individuales SMART para cada integrante de la plantilla escolar.
 * Si el trabajador ya tiene metas definidas en el formulario (Paso 2) o existentes, las preserva.
 * Si no tiene metas capturadas, genera una sugerencia oficial SMART adaptada a su cargo institucional
 * para asegurar el cumplimiento del estándar de corresponsabilidad docente (C10 / Cobertura >= 80%).
 */
export function derivePersonalMetasFromStaff(
  staff: StaffMember[] | RawStaffCandidate[],
  cicloEscolar = '2026-2027',
  existingMetas?: Array<{ nombre?: string; meta_individual?: string; cargo?: string; categoria?: string; tema?: string; estrategia?: string; entregable?: string; periodo?: string }> | null
): DerivedPersonalMeta[] {
  const safeCiclo = cicloEscolar || '2026-2027';
  const startYear = safeCiclo.split('-')[0] || '2026';
  const endYear = safeCiclo.split('-')[1] || '2027';
  const defaultPeriodo = `Agosto ${startYear} — Junio ${endYear}`;

  type ExistingMetaItem = NonNullable<typeof existingMetas>[number];
  const existingMap = new Map<string, ExistingMetaItem>();
  for (const em of existingMetas || []) {
    if (em?.nombre && isValidStaffName(em.nombre)) {
      existingMap.set(normalizeStaffName(em.nombre), em);
    }
  }

  const result: DerivedPersonalMeta[] = [];

  for (const member of staff || []) {
    const rawName = member.nombre?.trim();
    if (!rawName || !isValidStaffName(rawName) || isNonStaffRole(member.cargo)) {
      continue;
    }

    const normKey = normalizeStaffName(rawName);
    const displayName = cleanStaffDisplayName(rawName);
    const cargo = member.cargo?.trim() || 'Docente';
    const lowerCargo = cargo.toLowerCase();

    // 1. Si ya existe una meta personal previa capturada con texto sustantivo, respetarla
    const existing = existingMap.get(normKey);
    if (existing && existing.meta_individual && existing.meta_individual.trim().length >= 5) {
      result.push({
        nombre: displayName,
        cargo,
        categoria: existing.categoria || PMC_CATEGORIAS_OFICIALES[0].nombre,
        tema: existing.tema || PMC_CATEGORIAS_OFICIALES[0].temas[0],
        meta_individual: existing.meta_individual.trim(),
        estrategia: existing.estrategia?.trim() || 'Acciones colegiadas de seguimiento y evaluación formativa.',
        entregable: existing.entregable?.trim() || 'Informe de seguimiento y evidencias.',
        periodo: existing.periodo?.trim() || defaultPeriodo,
      });
      continue;
    }

    // 2. Si el miembro tiene metas individuales predefinidas en staffData (Paso 2)
    const staffMeta = member.metas_individuales?.find((m) => m && m.meta && m.meta.trim().length >= 5);
    if (staffMeta && staffMeta.meta) {
      result.push({
        nombre: displayName,
        cargo,
        categoria: normalizePmcCategoria(staffMeta.categoria || null),
        tema: staffMeta.tema || 'Formación y actualización docente',
        meta_individual: staffMeta.meta.trim(),
        estrategia: staffMeta.estrategia?.trim() || 'Acciones de implementación en aula y colegiado.',
        entregable: staffMeta.entregable?.trim() || 'Evidencias y constancias oficiales.',
        periodo: staffMeta.periodo?.trim() || defaultPeriodo,
      });
      continue;
    }

    // 3. Si tiene meta_individual en campo directo
    if (member.meta_individual && member.meta_individual.trim().length >= 5) {
      result.push({
        nombre: displayName,
        cargo,
        categoria: PMC_CATEGORIAS_OFICIALES[0].nombre,
        tema: PMC_CATEGORIAS_OFICIALES[0].temas[0],
        meta_individual: member.meta_individual.trim(),
        estrategia: 'Acciones de implementación en aula y colegiado.',
        entregable: 'Informe y evidencias de cumplimiento.',
        periodo: defaultPeriodo,
      });
      continue;
    }

    // 4. Generar sugerencia SMART contextualizada por función institucional
    let suggestedCategoria = PMC_CATEGORIAS_OFICIALES[0].nombre;
    let suggestedTema = 'Planeación didáctica';
    let suggestedMeta = 'Diseñar e implementar el 100% de las secuencias didácticas situadas integrando evaluación formativa continua y estrategias de regularización.';
    let suggestedEstrategia = 'Planeaciones por progresiones de aprendizaje del MCCEMS, rúbricas analíticas y círculos de nivelación académica.';
    let suggestedEntregable = 'Portafolio docente con secuencias validadas y reporte bimestral de aprovechamiento.';

    if (lowerCargo.includes('director') && !lowerCargo.includes('subdirector')) {
      suggestedCategoria = PMC_CATEGORIAS_OFICIALES[1].nombre;
      suggestedTema = 'Infraestructura y equipamiento del plantel';
      suggestedMeta = 'Liderar la gestión de recursos de infraestructura y coordinar el cumplimiento colegiado del 100% de los compromisos institucionales del PMC.';
      suggestedEstrategia = 'Reuniones mensuales de seguimiento colegiado en CTE, gestión ante autoridades municipales/SEMS y vinculación con comités escolares.';
      suggestedEntregable = 'Actas y minutas de seguimiento colegiado y memoria anual de gestión escolar.';
    } else if (lowerCargo.includes('subdirector')) {
      suggestedCategoria = PMC_CATEGORIAS_OFICIALES[1].nombre;
      suggestedTema = 'Administración escolar';
      suggestedMeta = 'Supervisar el seguimiento académico y el cumplimiento del cronograma institucional del PMC en un 100%.';
      suggestedEstrategia = 'Revisión periódica de avances programáticos y calendarización de evaluaciones diagnósticas y formativas.';
      suggestedEntregable = 'Bitácora de seguimiento académico y control de avance de metas.';
    } else if (lowerCargo.includes('tutor') && (lowerCargo.includes('plantel') || lowerCargo.includes('escolar'))) {
      suggestedCategoria = PMC_CATEGORIAS_OFICIALES[0].nombre;
      suggestedTema = 'Tutorías';
      suggestedMeta = 'Coordinar el plan integral de tutorías del plantel atendiendo al 100% de los aprendientes detectados con riesgo de abandono escolar.';
      suggestedEstrategia = 'Detección temprana en evaluaciones diagnósticas y parciales, canalización pedagógica y coordinación colegiada de tutores de grupo.';
      suggestedEntregable = 'Padrón escolar de aprendientes en tutoría y reporte estadístico de retención.';
    } else if (lowerCargo.includes('tutor') && (lowerCargo.includes('grupo') || lowerCargo.includes('grupal'))) {
      suggestedCategoria = PMC_CATEGORIAS_OFICIALES[2].nombre;
      suggestedTema = 'Desarrollo de habilidades socioemocionales';
      suggestedMeta = 'Brindar acompañamiento tutorial continuo al grupo a cargo y mantener comunicación con el 100% de madres/padres de aprendientes en rezago.';
      suggestedEstrategia = 'Entrevistas individuales y colegiadas, seguimiento de inasistencias y talleres vivenciales de habilidades socioemocionales.';
      suggestedEntregable = 'Expediente de tutoría grupal y minutas de acuerdos con padres de familia.';
    } else if (lowerCargo.includes('orientador')) {
      suggestedCategoria = PMC_CATEGORIAS_OFICIALES[2].nombre;
      suggestedTema = 'Orientación vocacional y socioemocional';
      suggestedMeta = 'Implementar el programa institucional de orientación vocacional y atención psicoemocional preventiva para el alumnado del plantel.';
      suggestedEstrategia = 'Talleres de proyecto de vida, ferias profesiográficas y canalización a instancias de apoyo ante factores de riesgo.';
      suggestedEntregable = 'Registro de atenciones vocacionales y reporte semestral de seguimiento.';
    } else if (lowerCargo.includes('administrativ') || lowerCargo.includes('secretari')) {
      suggestedCategoria = PMC_CATEGORIAS_OFICIALES[1].nombre;
      suggestedTema = 'Administración escolar';
      suggestedMeta = 'Mantener al 100% actualizados los expedientes escolares, estadísticas 911 y registros de control académico.';
      suggestedEstrategia = 'Auditoría interna continua de expedientes de aprendientes y validación oportuna de calificaciones en plataformas oficiales.';
      suggestedEntregable = 'Expedientes escolares completos y constancia de entrega de estadística 911 validada.';
    } else if (lowerCargo.includes('intendenc') || lowerCargo.includes('mantenimient') || lowerCargo.includes('apoyo')) {
      suggestedCategoria = PMC_CATEGORIAS_OFICIALES[1].nombre;
      suggestedTema = 'Mantenimiento de instalaciones';
      suggestedMeta = 'Garantizar que las aulas, sanitarios y áreas comunes permanezcan limpias, funcionales y seguras durante todo el ciclo escolar.';
      suggestedEstrategia = 'Programa semanal de mantenimiento preventivo y reporte inmediato de fallas en servicios de agua, luz o sanitarios.';
      suggestedEntregable = 'Bitácora semanal de mantenimiento e inventario de insumos escolares.';
    }

    result.push({
      nombre: displayName,
      cargo,
      categoria: suggestedCategoria,
      tema: suggestedTema,
      meta_individual: suggestedMeta,
      estrategia: suggestedEstrategia,
      entregable: suggestedEntregable,
      periodo: defaultPeriodo,
    });
  }

  return result;
}
