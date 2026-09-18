/**
 * design-tokens.ts -- Single Source of Truth del Sistema Editorial SIGPDA-EMS V7
 * DBEPA Puebla MCCEMS 2026-2027
 *
 * REGLA: Ningun numero magico en el renderer.
 * Todos los valores del sistema visual viven aqui.
 */

export type RGB = [number, number, number];

// -- Pagina (en mm) -----------------------------------------------------------

export const PAGE = {
  WIDTH_MM: 215.9,
  HEIGHT_MM: 279.4,
  MARGIN_TOP: 14,
  MARGIN_BOTTOM: 14,
  MARGIN_OUTER: 14,
  MARGIN_INNER: 16,
  HEADER_H: 7,
  FOOTER_H: 6,
} as const;

// -- Grid de columnas ---------------------------------------------------------

export const GRID = {
  MAIN_RATIO: 0.68,
  SIDEBAR_RATIO: 0.28,
  GUTTER: 5,
  FULL_RATIO: 1.0,
} as const;
// -- Familias tipográficas -----------------------------------------------------

export const FONT = {
  BODY: 'Lato',
  HEADING: 'Montserrat',
  FALLBACK: 'helvetica',
} as const;

// -- Escala tipografica (puntos) -----------------------------------------------

export const TYPE = {
  BODY: 9.0,
  BODY_SM: 8.0,
  CAPTION: 7.5,
  LABEL: 6.8,
  H1: 11.0,
  H2: 9.5,
  H3: 8.5,
  H4: 8.0,
  MISSION_NUM: 32,
  SIDEBAR_BODY: 7.5,
  SIDEBAR_TITLE: 8.0,
  COVER_TITLE: 18,
  COVER_TITLE_MIN: 12,
  HEADING_THRESHOLD: 10.5,
} as const;

export const HEADING_THRESHOLD = TYPE.HEADING_THRESHOLD;

// -- Interlineado (leading) en mm ---------------------------------------------

export const LEADING = {
  BODY: 4.8,
  COMPACT: 4.0,
  SIDEBAR: 3.8,
  HEADING: 5.5,
} as const;

// -- Espaciado vertical entre elementos (mm) ----------------------------------

export const SPACING = {
  BEFORE_SECTION: 4,
  AFTER_SECTION: 3,
  PARAGRAPH: 2.5,
  LIST_ITEM: 1.5,
  SIDEBAR_GAP: 4,
  MAX_GAP: 8,
  BOX_PADDING: 4,
  INDENT: 0,
} as const;

export const SIDEBAR_GAP = SPACING.SIDEBAR_GAP;

// -- Radios de borde (mm) -----------------------------------------------------

export const RADIUS = {
  NONE: 0,
  SM: 1.5,
  MD: 3,
  LG: 5,
  PILL: 20,
} as const;

// -- Grosor de lineas (mm) ----------------------------------------------------

export const STROKE = {
  HAIRLINE: 0.2,
  THIN: 0.3,
  NORMAL: 0.5,
  ACCENT: 2.5,
  HEAVY: 3.5,
} as const;

// -- Sistema de Color Funcional ------------------------------------------------
//
// REGLA DE APLICACION:
//   COLOR.MISSION[n]  -- identidad de la mision (banner, ribbon borde, header)
//   COLOR.pedagogico  -- siempre fijo por tipo de contenido, nunca por mision
//
// El estudiante aprende el lenguaje visual: Glosario=indigo, Seguridad=naranja, VidaReal=verde

export const COLOR = {
  PAGE_BG:          [255, 255, 255] as RGB,
  HEADER_LINE:      [210, 218, 230] as RGB,
  FOOTER_TEXT:      [148, 155, 165] as RGB,
  DIVIDER:          [226, 232, 240] as RGB,
  BORDER:           [226, 232, 240] as RGB,

  TEXT_PRIMARY:     [26,  32,  44]  as RGB,
  TEXT_SECONDARY:   [75,  85, 100]  as RGB,
  TEXT_MUTED:       [130, 140, 155] as RGB,
  TEXT_ON_DARK:     [255, 255, 255] as RGB,
  TEXT_ACCENT:      [37,   99, 235] as RGB,
  TEXT_GOLD:        [180, 120,   0] as RGB,

  MISSION: [
    [17,  53,  96]  as RGB,
    [124, 58,  237] as RGB,
    [5,  150, 105]  as RGB,
    [217, 119,   6] as RGB,
    [220,  38,  38] as RGB,
    [2,  132, 199]  as RGB,
  ] as RGB[],

  COVER_NAVY:       [17,  30,  64]  as RGB,
  COVER_GOLD:       [245, 158,  11] as RGB,
  COVER_DARK_LINE:  [80,   0,   0]  as RGB,

  DIAGNOSTIC_BG:    [239, 246, 255] as RGB,
  DIAGNOSTIC_BORDER:[37,   99, 235] as RGB,
  DIAGNOSTIC_TEXT:  [30,   58, 138] as RGB,

  SEM_GREEN_BG:     [240, 253, 244] as RGB,
  SEM_GREEN_ACC:    [21,  128,  61] as RGB,
  SEM_YELLOW_BG:    [254, 252, 232] as RGB,
  SEM_YELLOW_ACC:   [161,  98,   7] as RGB,
  SEM_RED_BG:       [254, 242, 242] as RGB,
  SEM_RED_ACC:      [185,  28,  28] as RGB,

  GLOSSARY_BG:      [245, 243, 255] as RGB,
  GLOSSARY_ACCENT:  [99,  102, 241] as RGB,

  SAFETY_BG:        [255, 247, 237] as RGB,
  SAFETY_ACCENT:    [194,  65,  12] as RGB,

  REAL_LIFE_BG:     [240, 253, 244] as RGB,
  REAL_LIFE_ACCENT: [22,  163,  74] as RGB,

  CALLOUT_IDEA_BG:  [250, 245, 255] as RGB,
  CALLOUT_IDEA_ACC: [124,  58, 237] as RGB,

  CALLOUT_EX_BG:    [255, 251, 235] as RGB,
  CALLOUT_EX_ACC:   [180, 120,   0] as RGB,

  CALLOUT_Q_BG:     [255, 250, 240] as RGB,
  CALLOUT_Q_ACC:    [194,  65,  12] as RGB,

  TABLE_HEADER_BG:  [30,   58, 138] as RGB,
  TABLE_ALT_ROW:    [248, 250, 252] as RGB,
  TABLE_BORDER:     [203, 213, 225] as RGB,

  RUBRIC_EXCELLENT: [21,  128,  61] as RGB,
  RUBRIC_GOOD:      [37,   99, 235] as RGB,
  RUBRIC_PASS:      [161,  98,   7] as RGB,
  RUBRIC_FAIL:      [185,  28,  28] as RGB,

  GOLD:             [245, 158,  11] as RGB,
  GOLD_LIGHT:       [254, 243, 199] as RGB,

  // Legacy aliases para retrocompatibilidad con el renderer
  NAVY:             [17,  30,  64]  as RGB,
  MID_BLUE:         [37,   99, 235] as RGB,
  DARK_TEXT:        [26,   32,  44] as RGB,
  MUTED_TEXT:       [130, 140, 155] as RGB,
  LIGHT_BG:         [241, 245, 249] as RGB,
  DARK_MAROON:      [80,    0,   0] as RGB,
} as const;

// -- Helpers ------------------------------------------------------------------

/**
 * Retorna el color de mision para un numero dado (ciclo rotativo de 6).
 */
export function getMissionColor(missionNumber: number): RGB {
  const idx = ((missionNumber - 1) % COLOR.MISSION.length + COLOR.MISSION.length) % COLOR.MISSION.length;
  return COLOR.MISSION[idx];
}

/**
 * Retorna la version tintada del color (mezcla con blanco segun factor 0-1).
 * Util para fondos de ribbons de seccion con color de mision.
 */
export function missionTint(missionColor: RGB, factor = 0.12): RGB {
  return [
    Math.round(255 - (255 - missionColor[0]) * factor),
    Math.round(255 - (255 - missionColor[1]) * factor),
    Math.round(255 - (255 - missionColor[2]) * factor),
  ];
}

/**
 * Retorna el color de texto mas legible sobre un fondo dado.
 * Usa luminancia relativa WCAG 2.1.
 */
export function contrastText(bg: RGB): RGB {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(bg[0]) + 0.7152 * lin(bg[1]) + 0.0722 * lin(bg[2]);
  return L > 0.179 ? COLOR.TEXT_PRIMARY : COLOR.TEXT_ON_DARK;
}