/**
 * pmc-categorias.ts
 * Catálogo canónico de Categorías y Temas / Ámbitos Oficiales para la
 * Planeación de la Mejora Continua (PMC) 2024-2025 / 2025-2026 / 2026-2027.
 *
 * Fuente Oficial:
 * Lineamientos para la Planeación de la Mejora Continua en Educación Media Superior (SEP / SEMS / MCCEMS)
 * Cuadro 2: Temas por categoría.
 */

export interface PmcTemaOficial {
  nombre: string;
  descripcion?: string;
}

export interface PmcCategoriaOficial {
  id: string;
  numero: number;
  nombre: string;
  temas: string[];
}

export const PMC_CATEGORIAS_OFICIALES: readonly PmcCategoriaOficial[] = [
  {
    id: 'desarrollo_academico',
    numero: 1,
    nombre: 'Desarrollo académico y aprendizaje',
    temas: [
      'Formación y actualización docente',
      'Propuestas pedagógicas',
      'Trabajo colegiado',
      'Proyecto Escolar Comunitario (PEC)',
      'Movimiento Nacional por la Alfabetización y la Educación (MONAE)',
      'Clubes de lectura',
      'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)',
      'Orientación y Tutoría',
      'Planeación didáctica',
      'Otras actividades académicas (proyectos escolares, p. ej.)',
    ],
  },
  {
    id: 'gestion_administracion',
    numero: 2,
    nombre: 'Gestión y administración escolar',
    temas: [
      'Vinculación con instituciones educativas',
      'Vinculación con empresas, fundaciones e instituciones públicas',
      'Gestión y administración de recursos, equipamiento y servicios',
      'Seguimiento al desempeño docente en el aula',
      'Seguimiento de egresados',
    ],
  },
  {
    id: 'desarrollo_socioemocional',
    numero: 3,
    nombre: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
    temas: [
      'Ámbitos de formación socioemocional (Currículum Ampliado)',
      'Estrategias, programas y/o proyectos sobre violencia',
      'Orientación educativa',
    ],
  },
] as const;

export const PMC_NOMBRES_CATEGORIAS = PMC_CATEGORIAS_OFICIALES.map(c => c.nombre);

/**
 * Normaliza cualquier variante, código numérico ('1'|'2'|'3'), etiqueta legacy
 * ('practica_docente', 'convivencia_paec', etc.) o texto desalineado a la
 * Categoría Oficial correspondiente de los Lineamientos del PMC.
 * Acepta `tema` opcional como desempate semántico para llaves ambiguas.
 */
export function normalizePmcCategoria(
  rawCategoria: string | undefined | null,
  tema?: string | undefined | null
): string {
  const clean = (rawCategoria ?? '').trim().toLowerCase();
  const cleanTema = (tema ?? '').trim().toLowerCase();

  // 1. Códigos numéricos explícitos (evita que '2' y '3' caigan al fallback de Cat 1)
  if (clean === '1' || /^cat(?:egor[ií]a)?\s*1\b/.test(clean)) {
    return 'Desarrollo académico y aprendizaje';
  }
  if (clean === '2' || /^cat(?:egor[ií]a)?\s*2\b/.test(clean)) {
    return 'Gestión y administración escolar';
  }
  if (clean === '3' || /^cat(?:egor[ií]a)?\s*3\b/.test(clean)) {
    return 'Desarrollo socioemocional y prevención de la violencia en la escuela';
  }

  // 2. Llaves legacy del modal de metas complementarias (con desempate por tema oficial)
  if (clean === 'practica_docente') {
    if (/desempe[nñ]o\s+docente|observaci[oó]n\s+(?:de\s+|en\s+el\s+)?aula|visitas?\s+[aá]ulicas?/i.test(cleanTema)) {
      return 'Gestión y administración escolar';
    }
    return 'Desarrollo académico y aprendizaje';
  }
  if (clean === 'convivencia_paec') {
    if (
      /proyecto\s+escolar\s+comunitario|\bpec\b|\bpaec\b/i.test(cleanTema) &&
      !/violencia|paz|convivencia|socioemocional|orientaci[oó]n/i.test(cleanTema)
    ) {
      return 'Desarrollo académico y aprendizaje';
    }
    return 'Desarrollo socioemocional y prevención de la violencia en la escuela';
  }
  if (clean === 'aprovechamiento') {
    return 'Desarrollo académico y aprendizaje';
  }
  if (clean === 'infraestructura') {
    return 'Gestión y administración escolar';
  }

  if (!clean) {
    // Desempate por tema cuando la categoría viene vacía
    if (cleanTema) {
      if (/desempe[nñ]o\s+docente|vinculaci[oó]n|egresados|equipamiento|infraestructura|gesti[oó]n/i.test(cleanTema)) {
        return 'Gestión y administración escolar';
      }
      if (/violencia|paz|convivencia|socioemocional|orientaci[oó]n\s+educativa/i.test(cleanTema)) {
        return 'Desarrollo socioemocional y prevención de la violencia en la escuela';
      }
    }
    return PMC_CATEGORIAS_OFICIALES[0].nombre;
  }

  // Limpiar prefijos comunes como "categoría:", "categoría 1:", etc.
  const sinPrefijo = clean.replace(/^(categor[ií]a\s*\d*\s*[:\-–]\s*)/i, '').trim();

  // Categoría 1: Desarrollo académico y aprendizaje
  if (
    /acad[eé]mico/i.test(sinPrefijo) ||
    sinPrefijo.includes('aprendizaje') ||
    sinPrefijo.includes('procesos para el desarrollo') ||
    clean.includes('categoría 1') ||
    clean.includes('categoria 1') ||
    clean.includes('cat 1')
  ) {
    return 'Desarrollo académico y aprendizaje';
  }

  // Categoría 2: Gestión y administración escolar
  if (
    /gesti[oó]n/i.test(sinPrefijo) ||
    /administraci[oó]n/i.test(sinPrefijo) ||
    sinPrefijo.includes('recursos') ||
    /vinculaci[oó]n/i.test(sinPrefijo) ||
    clean.includes('categoría 2') ||
    clean.includes('categoria 2') ||
    clean.includes('cat 2')
  ) {
    return 'Gestión y administración escolar';
  }

  // Categoría 3: Desarrollo socioemocional y prevención de la violencia en la escuela
  if (
    sinPrefijo.includes('socioemocional') ||
    sinPrefijo.includes('violencia') ||
    sinPrefijo.includes('paz') ||
    sinPrefijo.includes('convivencia') ||
    clean.includes('categoría 3') ||
    clean.includes('categoria 3') ||
    clean.includes('cat 3')
  ) {
    return 'Desarrollo socioemocional y prevención de la violencia en la escuela';
  }

  // Si coincide exactamente con alguna categoría oficial
  const exactMatch = PMC_CATEGORIAS_OFICIALES.find(
    c => c.nombre.toLowerCase() === clean || c.nombre.toLowerCase() === sinPrefijo
  );
  if (exactMatch) return exactMatch.nombre;

  // Desempate por tema antes del fallback
  if (cleanTema) {
    if (/desempe[nñ]o\s+docente|vinculaci[oó]n|egresados|equipamiento|infraestructura|gesti[oó]n/i.test(cleanTema)) {
      return 'Gestión y administración escolar';
    }
    if (/violencia|paz|convivencia|socioemocional|orientaci[oó]n\s+educativa/i.test(cleanTema)) {
      return 'Desarrollo socioemocional y prevención de la violencia en la escuela';
    }
  }

  // Fallback por defecto a Categoría 1
  return 'Desarrollo académico y aprendizaje';
}

/**
 * Normaliza el Tema / Ámbito específico de acuerdo a la categoría oficial seleccionada.
 */
export function normalizePmcTema(rawTema: string | undefined | null, categoriaNombre: string): string {
  if (!rawTema || !rawTema.trim()) return '';
  const clean = rawTema.trim();
  const cleanLower = clean.toLowerCase();

  const catObj = PMC_CATEGORIAS_OFICIALES.find(c => c.nombre === categoriaNombre);
  if (!catObj) return clean;

  // Buscar coincidencia exacta insensible a mayúsculas
  const exact = catObj.temas.find(t => t.toLowerCase() === cleanLower);
  if (exact) return exact;

  // Normalizaciones semánticas conocidas
  if (/actualizaci[oó]n/i.test(cleanLower) || /formaci[oó]n docente/i.test(cleanLower) || cleanLower.includes('cosfac')) {
    return 'Formación y actualización docente';
  }
  if (/pedag[oó]gic/i.test(cleanLower)) {
    return 'Propuestas pedagógicas';
  }
  if (cleanLower.includes('colegiado')) {
    return 'Trabajo colegiado';
  }
  if (cleanLower.includes('pec') || cleanLower.includes('comunitario')) {
    return 'Proyecto Escolar Comunitario (PEC)';
  }
  if (cleanLower.includes('monae') || cleanLower.includes('alfabetizaci')) {
    return 'Movimiento Nacional por la Alfabetización y la Educación (MONAE)';
  }
  if (cleanLower.includes('lectura')) {
    return 'Clubes de lectura';
  }
  if (cleanLower.includes('indicadores') || cleanLower.includes('reprobaci') || cleanLower.includes('eficiencia') || cleanLower.includes('abandono')) {
    return 'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)';
  }
  if (cleanLower.includes('tutor') || /orientaci[oó]n y tutor/i.test(cleanLower)) {
    return 'Orientación y Tutoría';
  }
  if (/planeaci[oó]n/i.test(cleanLower) || /did[aá]ctic/i.test(cleanLower)) {
    return 'Planeación didáctica';
  }
  if (cleanLower.includes('otra') || cleanLower.includes('desfile') || cleanLower.includes('bander') || cleanLower.includes('civic') || cleanLower.includes('proyecto')) {
    return 'Otras actividades académicas (proyectos escolares, p. ej.)';
  }
  if (cleanLower.includes('paz') || cleanLower.includes('violencia')) {
    return 'Estrategias, programas y/o proyectos sobre violencia';
  }
  if (cleanLower.includes('socioemocional') || /curr[ií]culum ampliado/i.test(cleanLower)) {
    return 'Ámbitos de formación socioemocional (Currículum Ampliado)';
  }
  if (/orientaci[oó]n educativa/i.test(cleanLower)) {
    return 'Orientación educativa';
  }
  if (cleanLower.includes('desempeño') || cleanLower.includes('aula')) {
    return 'Seguimiento al desempeño docente en el aula';
  }
  if (cleanLower.includes('egresado')) {
    return 'Seguimiento de egresados';
  }
  if (cleanLower.includes('empresa') || cleanLower.includes('fundaci')) {
    return 'Vinculación con empresas, fundaciones e instituciones públicas';
  }
  if (cleanLower.includes('instituci') || cleanLower.includes('universidad')) {
    return 'Vinculación con instituciones educativas';
  }
  if (cleanLower.includes('recurso') || cleanLower.includes('equipamiento') || cleanLower.includes('servicio')) {
    return 'Gestión y administración de recursos, equipamiento y servicios';
  }

  return clean;
}
