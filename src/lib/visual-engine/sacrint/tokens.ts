export type SacrintThemeMode = 'dark' | 'light';

export const SACRINT = {
  canvas: '#05070B',
  canvasDeep: '#02040A',
  panel: '#08111D',
  panelAlt: '#0B1826',
  stroke: '#1E3A5B',
  strokeSoft: '#244668',
  grid: 'rgba(0,127,255,0.075)',
  gridStrong: 'rgba(0,127,255,0.16)',
  text: '#E6EEF8',
  textSoft: '#AFC1D6',
  muted: '#71869D',
  dim: '#4B6077',
  gold: '#D4AF37',
  goldBright: '#F1D27A',
  blue: '#007FFF',
  cyan: '#38BDF8',
  emerald: '#50C878',
  red: '#FF3131',
  amber: '#F5A524',
  white: '#FFFFFF',
} as const;

export const SACRINT_LIGHT = {
  canvas: '#F8FAFC',
  canvasDeep: '#F1F5F9',
  panel: '#FFFFFF',
  panelAlt: '#F1F5F9',
  stroke: '#CBD5E1',
  strokeSoft: '#E2E8F0',
  grid: 'rgba(15,23,42,0.04)',
  gridStrong: 'rgba(15,23,42,0.08)',
  text: '#0F172A',
  textSoft: '#334155',
  muted: '#475569',
  dim: '#64748B',
  gold: '#B45309',
  goldBright: '#D97706',
  blue: '#1D4ED8',
  cyan: '#0369A1',
  emerald: '#047857',
  red: '#B91C1C',
  amber: '#B45309',
  white: '#0F172A',
} as const;

/** Oscurece acentos luminosos de fondo oscuro para alto contraste en papel blanco (infografía imprimible). */
export function resolveLightAccent(hex: string): string {
  const map: Record<string, string> = {
    '#D4AF37': '#9A6B00',
    '#F1D27A': '#9A6B00',
    '#007FFF': '#1D4ED8',
    '#38BDF8': '#0369A1',
    '#50C878': '#047857',
    '#C084FC': '#7E22CE',
    '#F97316': '#C2410C',
    '#34D399': '#047857',
    '#FBBF24': '#B45309',
    '#F472B6': '#BE185D',
    '#A78BFA': '#6D28D9',
  };
  return map[hex.toUpperCase()] ?? hex;
}

export const SACRINT_FONT = {
  display: 'Space Grotesk',
  body: 'Inter',
  fallback: 'sans-serif',
} as const;

export const SLIDE = {
  width: 1920,
  height: 1080,
  margin: 80,
  gutter: 28,
  headerY: 72,
  footerY: 1010,
} as const;

export const INFOGRAPHIC = {
  wide: { width: 2752, height: 1536 },
  letter: { width: 1275, height: 1650 },
  printWidth: 2550,
} as const;

export const SACRINT_TYPE = {
  eyebrow: 17,
  label: 14,
  micro: 12,
  body: 23,
  bodySmall: 18,
  h1: 76,
  h2: 48,
  h3: 32,
  quote: 42,
} as const;

export const SACRINT_RADIUS = {
  sm: 8,
  md: 18,
  lg: 28,
  pill: 999,
} as const;

export const SACRINT_STROKE = {
  hair: 1,
  thin: 1.5,
  normal: 2,
  strong: 3,
} as const;

export const FIGURE = {
  gridMinor: 24,
  gridMajor: 120,
} as const;
