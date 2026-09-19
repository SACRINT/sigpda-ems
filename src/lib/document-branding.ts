/**
 * document-branding.ts — Configuración Centralizada de Marca Institucional y Metadatos Documentales
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Single Source of Truth para:
 * 1. Nombres institucionales, siglas y membretes oficiales.
 * 2. Catálogo maestro de tipos de extras didácticos con etiquetas, paleta RGB/HEX e iconos.
 * 3. Resolvedores dinámicos de cabeceras y pies de página adaptables por plantel/CCT/ciclo.
 * 4. Sanitización Unicode normalizada (NFD) para nombres de archivo limpios y descriptivos.
 */

import { SCHOOL_YEAR } from '@/lib/config';
import type { RGB } from '@/lib/visual-engine/design-tokens';

export interface BrandingContext {
  cct?: string;
  cct_plantel?: string;
  schoolName?: string;
  school_name?: string;
  cycle?: string;
  academic_cycle?: string;
  subsistema?: 'bge' | 'bt' | string;
  teacherName?: string;
  zone?: string;
  semester?: number | string;
  uacName?: string;
}

export const INSTITUTIONAL_DEFAULTS = {
  SUBSECRETARIA: 'SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR',
  DIRECCION: 'DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA',
  SIGLA: 'DBEPA',
  ORGANISMO: 'DBEPA PUEBLA',
  DEFAULT_CYCLE: SCHOOL_YEAR,
  DEFAULT_CCT: '21EBH0000X',
  SUPERVISION_FALLBACK: 'SUPERVISIÓN DE BACHILLERATOS',
} as const;

export interface DocTypeMetadata {
  label: string;
  shortLabel: string;
  color: RGB;
  hex: string;
  icon: string;
  description: string;
}

export const DOC_TYPE_CONFIG: Record<string, DocTypeMetadata> = {
  lesson_plan: {
    label: 'PLAN DE CLASE (50 min)',
    shortLabel: 'PLAN DE CLASE',
    color: [26, 26, 46],
    hex: '1A1A2E',
    icon: '📋',
    description: 'Guion instruccional de 50 minutos con momentos pedagógicos y roles activos.',
  },
  rubric: {
    label: 'RÚBRICA ANALÍTICA DE EVALUACIÓN',
    shortLabel: 'RÚBRICA',
    color: [15, 52, 96],
    hex: '0F3460',
    icon: '📊',
    description: 'Matriz analítica de desempeño con niveles e indicadores socioformativos.',
  },
  checklist: {
    label: 'LISTA DE COTEJO FORMATIVA',
    shortLabel: 'LISTA DE COTEJO',
    color: [1, 88, 76],
    hex: '01584C',
    icon: '✅',
    description: 'Instrumento dicotómico para verificación rápida de criterios de entrega.',
  },
  material: {
    label: 'MATERIALES DIDÁCTICOS E INSUMOS',
    shortLabel: 'MATERIAL DIDÁCTICO',
    color: [120, 53, 15],
    hex: '78350F',
    icon: '📦',
    description: 'Insumos, reactivos, herramientas y recursos necesarios para la sesión.',
  },
  practice_guide: {
    label: 'GUÍA DE TRABAJO DEL ESTUDIANTE',
    shortLabel: 'GUÍA DEL ESTUDIANTE',
    color: [76, 29, 149],
    hex: '4C1D95',
    icon: '📘',
    description: 'Cuaderno operativo del estudiante con consignas prácticas situadas.',
  },
  teacher_guide: {
    label: 'SOLUCIONARIO Y PAUTAS DOCENTES',
    shortLabel: 'SOLUCIONARIO DOCENTE',
    color: [27, 107, 138],
    hex: '1B6B8A',
    icon: '🔒',
    description: 'Guía pedagógica de mediación, respuestas esperadas y retroalimentación.',
  },
  visual: {
    label: 'RECURSOS VISUALES E INFOGRAFÍAS',
    shortLabel: 'VISUALES',
    color: [37, 99, 235],
    hex: '2563EB',
    icon: '🎨',
    description: 'Diagramas, infografías y artefactos visuales de apoyo curricular.',
  },
};

export interface HeaderBranding {
  topSup: string;
  typeLabel: string;
  shortLabel: string;
  color: RGB;
  hex: string;
  icon: string;
  cycle: string;
  cct: string;
  schoolName: string;
}

/**
 * Resuelve la información de cabecera institucional según el tipo de documento y el contexto del plantel.
 */
export function resolveHeaderBranding(docType: string, ctx?: BrandingContext): HeaderBranding {
  const meta = DOC_TYPE_CONFIG[docType] || {
    label: 'RECURSO DIDÁCTICO INSTITUCIONAL',
    shortLabel: 'RECURSO',
    color: [26, 26, 46] as RGB,
    hex: '1A1A2E',
    icon: '📄',
    description: 'Documento didáctico oficial.',
  };

  const cycle = ctx?.cycle || ctx?.academic_cycle || INSTITUTIONAL_DEFAULTS.DEFAULT_CYCLE;
  const cct = ctx?.cct || ctx?.cct_plantel || INSTITUTIONAL_DEFAULTS.DEFAULT_CCT;
  const schoolName = ctx?.schoolName || ctx?.school_name || 'BACHILLERATO GENERAL ESTATAL';

  const topSup = `${INSTITUTIONAL_DEFAULTS.ORGANISMO} — SECUENCIAS DIDÁCTICAS ${cycle}`;

  return {
    topSup,
    typeLabel: meta.label,
    shortLabel: meta.shortLabel,
    color: meta.color,
    hex: meta.hex,
    icon: meta.icon,
    cycle,
    cct,
    schoolName,
  };
}

export interface FooterBranding {
  leftText: string;
  rightText: string;
  dividerColor: RGB;
  textColor: RGB;
}

/**
 * Resuelve el texto de pie de página para documentos y reportes oficiales.
 */
export function resolveFooterBranding(
  docType: string,
  title: string,
  ctx?: BrandingContext,
  page = 1,
  totalPages = 1
): FooterBranding {
  const meta = DOC_TYPE_CONFIG[docType] || {
    shortLabel: 'RECURSO',
    color: [26, 26, 46] as RGB,
  };

  const truncatedTitle = (title || '').substring(0, 50);
  const leftText = `SIGPDA-EMS · ${meta.shortLabel} · ${truncatedTitle}`;
  const rightText = `Página ${page} de ${totalPages}`;

  return {
    leftText,
    rightText,
    dividerColor: [230, 81, 0], // Accent orange
    textColor: [120, 120, 120],
  };
}

/**
 * Sanitiza un título para generar nombres de archivo seguros, legibles y sin underscores destructivos.
 * Normaliza caracteres Unicode eliminando tildes y diacríticos sin convertirlos a guiones bajos.
 *
 * Ejemplo: "Rúbrica Analítica de Evaluación" -> "rubrica_analitica_de_evaluacion"
 */
export function sanitizeDocFilename(
  title: string,
  maxLength = 60,
  prefix?: string
): string {
  const clean = (title || 'documento')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos sin sustituir por _
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const base = prefix ? `${prefix}_${clean}` : clean;
  return base.substring(0, maxLength);
}
