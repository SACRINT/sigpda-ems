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
