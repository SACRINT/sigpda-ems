// src/lib/pmc-document-structure.ts
/**
 * Single Source of Truth (SSoT) para la estructura documental del Programa de Mejora Continua (PMC).
 * Define la canónica de secciones oficiales para garantizar paridad exacta entre PDF, DOCX y Formato Oficial.
 * Conforme a los lineamientos oficiales SEMS / DBEPA Puebla (2026-2027).
 */

import { SCHOOL_YEAR } from '@/lib/config';
import { getJustificacionNormativa, isPlaceholderArticulo } from './normativa-context';

export interface PmcSubseccionDef {
  id: string;
  numero: string;
  titulo: string;
}

export interface PmcSeccionDef {
  id: string;
  numero: number;
  titulo: string;
  pageBreakBefore?: boolean;
  subsecciones?: PmcSubseccionDef[];
}

export const PMC_TITULOS_SECCIONES = {
  PRESENTACION: '1. PRESENTACIÓN',
  OBJETIVO: '2. OBJETIVO DEL PMC',
  NORMATIVIDAD: '3. NORMATIVIDAD APLICABLE',
  DIAGNOSTICO: '4. DIAGNÓSTICO',
  PRIORIZACION: '5. PRIORIZACIÓN DE CATEGORÍAS',
  PLAN_ACCION: '6. PLAN DE ACCIÓN',
  METAS_INDIVIDUALES: '7. METAS INDIVIDUALES DEL PERSONAL',
  PARTICIPANTES_CONTROL: '8. PARTICIPANTES, CONTROL DE REVISIONES Y APROBACIÓN',
} as const;

export const PMC_FICHAS_TECNICAS_HEADING = 'Fichas Técnicas Descriptivas por Meta Institucional:' as const;
export const PMC_FICHAS_TECNICAS_PAGE_BREAK_BEFORE = true as const;

const SUBSECCIONES_DIAGNOSTICO_CANONICAS: readonly PmcSubseccionDef[] = [
  { id: 'contexto', numero: '4.1', titulo: 'Contexto Socioeducativo y Territorial' },
  { id: 'indicadores', numero: '4.2', titulo: 'Análisis de Indicadores Académicos (Línea Base vs Metas)' },
  { id: 'infraestructura', numero: '4.3', titulo: 'Infraestructura y Equipamiento Escolar' },
  { id: 'beneficios', numero: '4.4', titulo: 'Beneficios y Vinculación Comunitaria' },
  { id: 'foda', numero: '4.5', titulo: 'Matriz FODA Situacional' },
] as const;

export const PMC_SUBSECCIONES_DIAGNOSTICO = {
  CONTEXTO: `${SUBSECCIONES_DIAGNOSTICO_CANONICAS[0].numero} ${SUBSECCIONES_DIAGNOSTICO_CANONICAS[0].titulo}`,
  INDICADORES: `${SUBSECCIONES_DIAGNOSTICO_CANONICAS[1].numero} ${SUBSECCIONES_DIAGNOSTICO_CANONICAS[1].titulo}`,
  INFRAESTRUCTURA: `${SUBSECCIONES_DIAGNOSTICO_CANONICAS[2].numero} ${SUBSECCIONES_DIAGNOSTICO_CANONICAS[2].titulo}`,
  BENEFICIOS: `${SUBSECCIONES_DIAGNOSTICO_CANONICAS[3].numero} ${SUBSECCIONES_DIAGNOSTICO_CANONICAS[3].titulo}`,
  FODA: `${SUBSECCIONES_DIAGNOSTICO_CANONICAS[4].numero} ${SUBSECCIONES_DIAGNOSTICO_CANONICAS[4].titulo}`,
} as const;

export const PMC_SECCIONES_CANONICAS: readonly PmcSeccionDef[] = [
  {
    id: 'presentacion',
    numero: 1,
    titulo: PMC_TITULOS_SECCIONES.PRESENTACION,
    pageBreakBefore: true,
  },
  {
    id: 'objetivo',
    numero: 2,
    titulo: PMC_TITULOS_SECCIONES.OBJETIVO,
    pageBreakBefore: true,
  },
  {
    id: 'normatividad',
    numero: 3,
    titulo: PMC_TITULOS_SECCIONES.NORMATIVIDAD,
    pageBreakBefore: true,
  },
  {
    id: 'diagnostico',
    numero: 4,
    titulo: PMC_TITULOS_SECCIONES.DIAGNOSTICO,
    pageBreakBefore: true,
    subsecciones: [...SUBSECCIONES_DIAGNOSTICO_CANONICAS],
  },
  {
    id: 'priorizacion',
    numero: 5,
    titulo: PMC_TITULOS_SECCIONES.PRIORIZACION,
    pageBreakBefore: true,
  },
  {
    id: 'plan_accion',
    numero: 6,
    titulo: PMC_TITULOS_SECCIONES.PLAN_ACCION,
    pageBreakBefore: true,
  },
  {
    id: 'metas_individuales',
    numero: 7,
    titulo: PMC_TITULOS_SECCIONES.METAS_INDIVIDUALES,
    pageBreakBefore: true,
  },
  {
    id: 'participantes_control',
    numero: 8,
    titulo: PMC_TITULOS_SECCIONES.PARTICIPANTES_CONTROL,
    pageBreakBefore: true,
  },
] as const;

/**
 * Consulta si una sección o encabezado especial debe iniciar en nueva página según el SSoT documental.
 */
export function shouldSectionPageBreak(tituloOrId: string): boolean {
  if (tituloOrId === PMC_FICHAS_TECNICAS_HEADING) return PMC_FICHAS_TECNICAS_PAGE_BREAK_BEFORE;
  const sec = PMC_SECCIONES_CANONICAS.find(s => s.id === tituloOrId || s.titulo === tituloOrId);
  return sec?.pageBreakBefore ?? false;
}

export interface JerarquiaNormativaGrupo {
  clave: string;
  categoria: string;
  documentos: Array<{
    orden?: number;
    titulo: string;
    articulos?: string[];
    justificacion?: string;
  }>;
}

/**
 * Clasifica y jerarquiza los documentos normativos conforme a la pirámide jurídica:
 * A. Leyes y Disposiciones Constitucionales
 * B. Reglamentos, Acuerdos Secretariales y Marco Curricular
 * C. Lineamientos, Planes y Manuales Oficiales
 *
 * H-121c: Renumera los documentos secuencialmente (1..n) dentro de cada grupo para
 * eliminar huecos en la presentación oficial.
 */
export function clasificarNormativaJerarquica(
  documentos: Array<{ orden?: number; titulo?: string; articulos?: string[]; justificacion?: string }>
): JerarquiaNormativaGrupo[] {
  const leyes: Array<{ orden?: number; titulo: string; articulos?: string[]; justificacion?: string }> = [];
  const acuerdos: Array<{ orden?: number; titulo: string; articulos?: string[]; justificacion?: string }> = [];
  const lineamientos: Array<{ orden?: number; titulo: string; articulos?: string[]; justificacion?: string }> = [];

  for (const doc of documentos) {
    if (!doc?.titulo) continue;

    // H-125: Saneamiento defensivo de títulos - si viene de snapshot previo con fecha abrogada 14/08/22, mapear a 09/08/23
    let tituloNormalizado = doc.titulo.trim();
    if (tituloNormalizado.includes('14/08/22')) {
      tituloNormalizado = tituloNormalizado.replace(/14\/08\/22/g, '09/08/23');
    }

    // H-125: Saneamiento defensivo de artículos - filtrar placeholders 'Artículo Relevante...', números huérfanos '15 21 42'
    const articulosLimpios = Array.isArray(doc.articulos)
      ? doc.articulos.filter((art) => typeof art === 'string' && !isPlaceholderArticulo(art))
      : [];

    let articulosFinales = articulosLimpios;
    if (articulosFinales.length === 0) {
      if (tituloNormalizado.includes('09/08/23') || tituloNormalizado.toLowerCase().includes('mccems')) {
        articulosFinales = ['Lineamiento General', 'Componente Curricular'];
      }
    }

    const docWithJust = {
      orden: doc.orden,
      titulo: tituloNormalizado,
      articulos: articulosFinales,
      justificacion: doc.justificacion || getJustificacionNormativa(tituloNormalizado),
    };

    const t = tituloNormalizado.toLowerCase();
    if (t.includes('constitución') || t.includes('constitucion') || t.includes('ley')) {
      leyes.push(docWithJust);
    } else if (
      t.includes('acuerdo') ||
      t.includes('reglamento') ||
      t.includes('mccems') ||
      t.includes('marco curricular')
    ) {
      acuerdos.push(docWithJust);
    } else {
      lineamientos.push(docWithJust);
    }
  }

  const grupos: JerarquiaNormativaGrupo[] = [];
  // H-121c: Renumerar documentos 1..n dentro de cada grupo para evitar huecos en la presentación
  if (leyes.length > 0) {
    grupos.push({
      clave: 'A',
      categoria: 'A. LEYES Y DISPOSICIONES CONSTITUCIONALES',
      documentos: leyes.map((d, idx) => ({ ...d, orden: idx + 1 })),
    });
  }
  if (acuerdos.length > 0) {
    grupos.push({
      clave: 'B',
      categoria: 'B. REGLAMENTOS, ACUERDOS SECRETARIALES Y MARCO CURRICULAR',
      documentos: acuerdos.map((d, idx) => ({ ...d, orden: idx + 1 })),
    });
  }
  if (lineamientos.length > 0) {
    grupos.push({
      clave: 'C',
      categoria: 'C. LINEAMIENTOS, PLANES Y MANUALES OFICIALES (SEMS / SEP PUEBLA)',
      documentos: lineamientos.map((d, idx) => ({ ...d, orden: idx + 1 })),
    });
  }

  if (grupos.length === 0 && documentos.length > 0) {
    grupos.push({
      clave: 'A',
      categoria: 'A. MARCO NORMATIVO GENERAL',
      documentos: documentos.map((d, idx) => ({
        orden: idx + 1,
        titulo: d.titulo || 'Disposición Normativa Oficial',
        articulos: d.articulos,
        justificacion: d.justificacion || getJustificacionNormativa(d.titulo || ''),
      })),
    });
  }

  return grupos;
}

/**
 * Retorna el texto institucional del Objetivo General del PMC alineado a la política CREAA y la NEM.
 */
export function getObjetivoPmcText(schoolName?: string, cicloEscolar?: string): string {
  const nombrePlantel = schoolName ? `el plantel "${schoolName}"` : 'el plantel escolar';
  const ciclo = cicloEscolar || SCHOOL_YEAR;

  return `El presente Programa de Mejora Continua (PMC) tiene como objetivo general establecer las prioridades, metas y acciones estratégicas para elevar la calidad, permanencia, equidad e inclusión del servicio educativo en ${nombrePlantel} durante el ciclo escolar ${ciclo}. A través de la planeación participativa, el liderazgo directivo colegiado y la corresponsabilidad de la comunidad escolar, se busca consolidar los aprendizajes fundamentales del Marco Curricular Común de la Educación Media Superior (MCCEMS) y asegurar el desarrollo integral de las y los aprendientes conforme a los ejes de la política educativa estatal CREAA.`;
}

export interface PmcDatosContextuales {
  school_name?: string;
  school_cct?: string;
  municipality?: string;
  locality?: string;
  diagnostico_comunidad?: string;
}

/**
 * Retorna el texto situado para la subsección 4.3 Infraestructura y Equipamiento Escolar.
 * Si el proyecto contiene datos territoriales o de comunidad, los incorpora evitando boilerplate genérico.
 * Respeto estricto a B-001 (sin fabricar cifras).
 */
export function getTextoInfraestructura(project?: PmcDatosContextuales): string {
  const nombre = project?.school_name ? `el plantel "${project.school_name}"` : 'el plantel escolar';
  const ubicacion = (project?.locality && project?.municipality)
    ? ` en la localidad de ${project.locality}, municipio de ${project.municipality}`
    : project?.municipality ? ` en el municipio de ${project.municipality}` : '';

  if (project?.diagnostico_comunidad && project.diagnostico_comunidad.trim().length > 20) {
    return `En ${nombre}${ubicacion}, las instalaciones físicas, espacios educativos y equipamiento se gestionan para atender las necesidades formativas del entorno territorial. El colectivo escolar prioriza el mantenimiento preventivo y la optimización de aulas y talleres, asegurando condiciones dignas, seguras e inclusivas que salvaguarden el patrimonio escolar y favorezcan el logro de los aprendizajes fundamentales conforme al MCCEMS.`;
  }

  return `En ${nombre}${ubicacion}, las instalaciones físicas, aulas y recursos didácticos se gestionan de forma continua para asegurar condiciones dignas y seguras que favorezcan los procesos de enseñanza y aprendizaje, promoviendo la inclusión, la equidad formativa y la preservación del patrimonio escolar conforme al MCCEMS.`;
}

/**
 * Retorna el texto situado para la subsección 4.4 Beneficios y Vinculación Comunitaria.
 * Si existe diagnostico_comunidad o contexto territorial, lo articula con el PEC sin inventar números.
 */
export function getTextoBeneficiosComunitarios(project?: PmcDatosContextuales): string {
  const nombre = project?.school_name ? `del plantel "${project.school_name}"` : 'del plantel';
  const localidad = project?.locality ? `de ${project.locality}` : 'de la comunidad';

  if (project?.diagnostico_comunidad && project.diagnostico_comunidad.trim().length > 20) {
    return `La articulación comunitaria ${nombre} con las familias y actores sociales ${localidad} se orienta a atender la problemática socioeducativa territorial: ${project.diagnostico_comunidad.trim()}. A través de comités participativos, proyectos escolares comunitarios y alianzas locales, se generan redes de corresponsabilidad que fortalecen la permanencia escolar, la retención de aprendientes y el bienestar colectivo.`;
  }

  return `La relación corresponsable ${nombre} con las familias, autoridades locales y comunidades aledañas ${localidad} permite consolidar redes de apoyo que impulsan la retención escolar, la captación de matrícula y la solución colectiva de problemáticas territoriales en el marco del Proyecto Escolar Comunitario.`;
}

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

/**
 * Normaliza de forma robusta la cadena de período para metas y tablas del PMC (SSoT):
 * - Capitaliza los 12 meses del año en español.
 * - Protege los guiones de rango de años compactos (e.g. "Ciclo Escolar 2026-2027").
 * - Convierte guiones separadores entre fechas a em-dash (" — ").
 * - Provee fallback defensivo 'Ciclo Escolar' ante nulos o cadenas vacías.
 */
export function normalizePmcPeriodo(periodo?: string | null): string {
  if (!periodo || !periodo.trim()) return 'Ciclo Escolar';
  let s = periodo.trim();

  // 1. Capitalizar los 12 meses del año en español
  for (const mes of MESES_ES) {
    const capitalized = mes.charAt(0).toUpperCase() + mes.slice(1);
    s = s.replace(new RegExp(`\\b${mes}\\b`, 'gi'), capitalized);
  }

  // 2. Proteger guiones de años (e.g. 2026-2027) con placeholder
  const placeholder = '___YEAR_RANGE_HYPHEN___';
  s = s.replace(/(\b\d{4})\s*-\s*(\d{4}\b)/g, `$1${placeholder}$2`);

  // 3. Reemplazar separadores de rango por em-dash (" — ")
  s = s.replace(/\s*[-–—]\s*/g, ' — ');

  // 4. Restaurar el guion estándar compacto en el rango de años
  s = s.replace(new RegExp(placeholder, 'g'), '-');

  return s;
}

// ─── IDENTIDAD CROMÁTICA CUADRO 2 Y PALETA ECO-FORMAL ───────────────────────

export interface PmcCategoryTheme {
  categoriaId: 'categoria_1' | 'categoria_2' | 'categoria_3' | 'neutro';
  categoriaNum: number;
  categoriaTitulo: string;
  nombreOficial: string;
  colorHeaderHex: string;
  colorBgEcoHex: string;
  colorBorderHex: string;
  colorTextAccentHex: string;
  rgbHeader: [number, number, number];
  rgbBgEco: [number, number, number];
  rgbBorder: [number, number, number];
  temasOficiales: string[];
}

export const PMC_CUADRO_2_CATEGORIAS: Record<string, PmcCategoryTheme> = {
  categoria_1: {
    categoriaId: 'categoria_1',
    categoriaNum: 1,
    categoriaTitulo: 'CATEGORÍA 1',
    nombreOficial: 'Desarrollo académico y aprendizaje',
    colorHeaderHex: '1E5638', // Verde Bosque Institucional DGB
    colorBgEcoHex: 'F0F7F2',  // Menta suave ahorro de tinta
    colorBorderHex: '7BB896',
    colorTextAccentHex: '16422B',
    rgbHeader: [30, 86, 56],
    rgbBgEco: [240, 247, 242],
    rgbBorder: [123, 184, 150],
    temasOficiales: [
      'Formación y actualización docente',
      'Propuestas pedagógicas',
      'Trabajo colegiado',
      'Proyecto Escolar Comunitario (PEC / PAEC)',
      'Movimiento Nacional por la Alfabetización y la Educación (MONAE)',
      'Clubes de lectura',
      'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)',
      'Orientación y Tutoría',
      'Planeación didáctica',
      'Otras actividades académicas (proyectos escolares, p. ej.)',
    ],
  },
  categoria_2: {
    categoriaId: 'categoria_2',
    categoriaNum: 2,
    categoriaTitulo: 'CATEGORÍA 2',
    nombreOficial: 'Gestión y administración escolar',
    colorHeaderHex: '996515', // Dorado Ocre Clásico DGB
    colorBgEcoHex: 'FCF8EE',  // Marfil dorado suave ahorro de tinta
    colorBorderHex: 'D4B26F',
    colorTextAccentHex: '6E480C',
    rgbHeader: [153, 101, 21],
    rgbBgEco: [252, 248, 238],
    rgbBorder: [212, 178, 111],
    temasOficiales: [
      'Vinculación con instituciones educativas',
      'Vinculación con empresas, fundaciones e instituciones públicas',
      'Gestión y administración de recursos, equipamiento y servicios',
      'Seguimiento al desempeño docente en el aula',
      'Seguimiento de egresados',
    ],
  },
  categoria_3: {
    categoriaId: 'categoria_3',
    categoriaNum: 3,
    categoriaTitulo: 'CATEGORÍA 3',
    nombreOficial: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
    colorHeaderHex: '821A36', // Vino Tinto Institucional DGB
    colorBgEcoHex: 'FDF1F3',  // Rosa pálido suave ahorro de tinta
    colorBorderHex: 'C5768B',
    colorTextAccentHex: '540F22',
    rgbHeader: [130, 26, 54],
    rgbBgEco: [253, 241, 243],
    rgbBorder: [197, 118, 139],
    temasOficiales: [
      'Ámbitos de formación socioemocional (Currículum Ampliado)',
      'Estrategias, programas y/o proyectos sobre violencia',
      'Orientación educativa',
      'Promoción de hábitos de vida saludable y bienestar emocional (Vive Saludable y Vive Feliz)',
    ],
  },
};

/**
 * Resuelve deterministamente el tema cromático oficial según la categoría o tema.
 */
export function getPmcCategoryTheme(categoria?: string | null, tema?: string | null): PmcCategoryTheme {
  const combined = `${categoria || ''} ${tema || ''}`.toLowerCase();

  // Categoría 3: Socioemocional, violencia, paz, vida saludable, bienestar, convivencia
  if (
    /socioemocional|violencia|convivencia|paz|saludable|feliz|autocuidado|emocional|adiccion|bienestar|seguridad escolar/i.test(combined) ||
    /convivencia_paec/i.test(categoria || '') ||
    /categor[ií]a\s*3/i.test(combined) ||
    /área 4|area 4|area-4/i.test(combined)
  ) {
    return PMC_CUADRO_2_CATEGORIAS.categoria_3;
  }

  // Categoría 2: Gestión, vinculación, infraestructura, equipamiento, desempeño docente, visitas áulicas
  if (
    /gesti[oó]n|administraci[oó]n|vinculaci[oó]n|infraestructura|equipamiento|desempeño docente|acompañamiento|visitas? [aá]ulicas?|egresados|empresas|convenios/i.test(combined) ||
    /infraestructura/i.test(categoria || '') ||
    /categor[ií]a\s*2/i.test(combined) ||
    /área 2|area 2|area-2|área 3|area 3|area-3/i.test(combined)
  ) {
    return PMC_CUADRO_2_CATEGORIAS.categoria_2;
  }

  // Categoría 1: Por defecto para desarrollo académico, indicadores, reprobación, aprovechamiento, COSFAC
  return PMC_CUADRO_2_CATEGORIAS.categoria_1;
}

// ─── RECONCILIADOR Y FUSIÓN DE METAS INDIVIDUALES POR DOCENTE ────────────────

export interface MetaPersonalItemBase {
  nombre?: string;
  cargo?: string;
  categoria?: string;
  tema?: string;
  meta_individual?: string;
  estrategia?: string;
  entregable?: string;
  periodo?: string;
}

/**
 * Normaliza y consolida de forma determinista el arreglo de metas individuales del personal.
 * Si un docente tiene 2 o más metas registradas en el sistema (por ejemplo registros adicionales),
 * las fusiona en UNA SOLA FILA con viñetas estructuradas (•), consolidando sus metas,
 * estrategias y entregables sin duplicar al docente en la tabla.
 */
export function consolidateMetasPersonalesByTeacher<T extends MetaPersonalItemBase>(metas: T[]): T[] {
  if (!Array.isArray(metas) || metas.length === 0) return [];

  const map = new Map<string, T[]>();

  for (const item of metas) {
    const rawName = (item.nombre || '').trim();
    if (!rawName) continue;
    // Clave de normalización de nombre: minúsculas, sin títulos de cortesía y espacios unificados
    const cleanKey = rawName
      .toLowerCase()
      .replace(/^(mtro|mtra|prof|profr|profra|lic|ing|dr|dra)\.?\s+/i, '')
      .replace(/\s+/g, ' ');

    const existing = map.get(cleanKey);
    if (existing) {
      existing.push(item);
    } else {
      map.set(cleanKey, [item]);
    }
  }

  const result: T[] = [];

  for (const [, items] of map.entries()) {
    if (items.length === 1) {
      result.push(items[0]);
      continue;
    }

    // Fusión de múltiples metas de un mismo docente en una sola fila
    const base = { ...items[0] };

    // Selección del cargo más completo
    const bestCargo = items
      .map((it) => it.cargo?.trim())
      .filter(Boolean)
      .sort((a, b) => (b ? b.length : 0) - (a ? a.length : 0))[0] || base.cargo;
    base.cargo = bestCargo;

    // Fusión de metas individuales
    const uniqueMetas: string[] = [];
    items.forEach((it) => {
      const cleanMeta = (it.meta_individual || '').trim();
      if (!cleanMeta) return;
      const prefix = it.categoria ? `[${it.categoria}${it.tema ? ` — ${it.tema}` : ''}] ` : '';
      const fullMeta = cleanMeta.startsWith('[') ? cleanMeta : `${prefix}${cleanMeta}`;
      if (!uniqueMetas.some((m) => m.toLowerCase() === fullMeta.toLowerCase())) {
        uniqueMetas.push(fullMeta);
      }
    });

    base.meta_individual = uniqueMetas.length > 1
      ? uniqueMetas.map((m) => m.startsWith('•') ? m : `• ${m}`).join('\n\n')
      : uniqueMetas[0] || base.meta_individual;

    // Fusión de estrategias
    const uniqueEstrategias: string[] = [];
    items.forEach((it) => {
      const cleanEst = (it.estrategia || '').trim();
      if (!cleanEst) return;
      if (!uniqueEstrategias.some((e) => e.toLowerCase() === cleanEst.toLowerCase())) {
        uniqueEstrategias.push(cleanEst);
      }
    });

    base.estrategia = uniqueEstrategias.length > 1
      ? uniqueEstrategias.map((e) => e.startsWith('•') ? e : `• ${e}`).join('\n\n')
      : uniqueEstrategias[0] || base.estrategia;

    // Fusión de entregables
    const uniqueEntregables: string[] = [];
    items.forEach((it) => {
      const cleanEnt = (it.entregable || '').trim();
      if (!cleanEnt) return;
      if (!uniqueEntregables.some((e) => e.toLowerCase() === cleanEnt.toLowerCase())) {
        uniqueEntregables.push(cleanEnt);
      }
    });

    base.entregable = uniqueEntregables.length > 1
      ? uniqueEntregables.map((e) => e.startsWith('•') ? e : `• ${e}`).join('\n\n')
      : uniqueEntregables[0] || base.entregable;

    // Período unificado
    const bestPeriodo = items.find((it) => it.periodo && it.periodo.trim())?.periodo || base.periodo;
    base.periodo = bestPeriodo;

    result.push(base);
  }

  return result;
}

