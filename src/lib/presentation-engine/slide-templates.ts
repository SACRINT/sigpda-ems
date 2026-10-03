/**
 * slide-templates.ts — Paletas y tipologías visuales por área disciplinar.
 * SIGPDA-EMS · Motor de Presentaciones (H-317)
 *
 * Los colores se expresan en HEX sin '#' (formato requerido por pptxgenjs)
 * y se reutilizan en el visor web agregando el prefijo '#'.
 */

import {
  isStemSubject,
  isHumanitiesSubject,
  isLaboralSubject,
} from '@/lib/visual-engine/visual-dispatcher';

export type DisciplineArea = 'stem' | 'humanidades' | 'sociales' | 'laboral' | 'general';

export interface SlidePalette {
  area: DisciplineArea;
  label: string;
  /** Color de fondo principal de portada y cierre */
  primary: string;
  /** Color de acento para títulos, líneas y viñetas */
  accent: string;
  /** Color de fondo claro de las diapositivas de contenido */
  surface: string;
  /** Color del texto de cuerpo sobre `surface` */
  text: string;
  /** Color del texto sobre `primary` */
  onPrimary: string;
  /** Color de recuadros destacados */
  highlight: string;
}

export const PALETTES: Record<DisciplineArea, SlidePalette> = {
  stem: {
    area: 'stem',
    label: 'Ciencias y Matemáticas',
    primary: '0B3C5D',
    accent: '1CA58A',
    surface: 'F4F9FC',
    text: '1B2A38',
    onPrimary: 'FFFFFF',
    highlight: 'D7F0EA',
  },
  humanidades: {
    area: 'humanidades',
    label: 'Humanidades',
    primary: '6B1F35',
    accent: 'E0A030',
    surface: 'FDF8F3',
    text: '2E1F25',
    onPrimary: 'FFFFFF',
    highlight: 'FBEBCB',
  },
  sociales: {
    area: 'sociales',
    label: 'Ciencias Sociales',
    primary: '3B4A2A',
    accent: '4F5BD5',
    surface: 'F7F8F2',
    text: '24291C',
    onPrimary: 'FFFFFF',
    highlight: 'E0E3FA',
  },
  laboral: {
    area: 'laboral',
    label: 'Formación para el Trabajo',
    primary: '2F3E4E',
    accent: 'F27C21',
    surface: 'F5F6F7',
    text: '1F2933',
    onPrimary: 'FFFFFF',
    highlight: 'FDE4CE',
  },
  general: {
    area: 'general',
    label: 'Formación General',
    primary: '2C3E73',
    accent: '8E5CF0',
    surface: 'F6F6FB',
    text: '1F2340',
    onPrimary: 'FFFFFF',
    highlight: 'E6DDFB',
  },
};

/**
 * Resuelve el área disciplinar de una UAC a partir de su nombre y,
 * opcionalmente, del componente curricular declarado.
 */
export function resolveDisciplineArea(uacName: string, component?: string): DisciplineArea {
  if (component && component.toLowerCase().includes('laboral')) return 'laboral';
  if (isLaboralSubject(uacName)) return 'laboral';
  if (isStemSubject(uacName)) return 'stem';
  if (isHumanitiesSubject(uacName)) {
    return /sociolog|ciencias sociales|socioecon|geograf/i.test(
      uacName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    )
      ? 'sociales'
      : 'humanidades';
  }
  return 'general';
}

export function getPalette(uacName: string, component?: string): SlidePalette {
  return PALETTES[resolveDisciplineArea(uacName, component)];
}
