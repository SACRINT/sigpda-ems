import { normalizeUnicode } from '@/lib/utils/normalize';

export type SacrintPackId =
  | 'matematicas'
  | 'fisica'
  | 'quimica'
  | 'biologia'
  | 'salud'
  | 'filosofia'
  | 'literatura'
  | 'ingles'
  | 'historia'
  | 'tecnologia'
  | 'laboral'
  | 'artes'
  | 'educacion_fisica'
  | 'socioemocional'
  | 'general';

export interface SacrintPack {
  id: SacrintPackId;
  label: string;
  short: string;
  accent: string;
  accent2: string;
  motif: string;
  diagram: string;
  heroPrompt: string;
  keywords: string[];
}

const BASE_HERO =
  'dark technical realism, deep black background, subtle blueprint grid, glass HUD panels, cinematic volumetric light, high contrast, gold and electric blue accents, no text, no letters, no numbers, no logos, clean negative space for overlay';

export const SACRINT_PACKS: Record<SacrintPackId, SacrintPack> = {
  matematicas: {
    id: 'matematicas',
    label: 'Pensamiento Matemático',
    short: 'MAT',
    accent: '#D4AF37',
    accent2: '#007FFF',
    motif: 'coordinate geometry',
    diagram: 'linear-model',
    heroPrompt: `${BASE_HERO}, golden ratio spiral, cartesian grid, luminous function curve, geometric construction lines, analytical X-ray aesthetic`,
    keywords: [
      'pensamiento matematico',
      'matematicas',
      'algebra',
      'calculo',
      'geometria',
      'trigonometria',
      'estadistica',
      'probabilidad',
      'aritmetica',
      'pensamiento variacional',
      'variacional',
      'funciones matematicas',
      'razon de cambio',
    ],
  },
  fisica: {
    id: 'fisica',
    label: 'Física',
    short: 'FIS',
    accent: '#38BDF8',
    accent2: '#D4AF37',
    motif: 'motion and fields',
    diagram: 'vector-field',
    heroPrompt: `${BASE_HERO}, particle trails, vector fields, orbital mechanics, free-body schematic, laboratory instrument glow, blue cyan palette`,
    keywords: ['fisica', 'fenomenos fisicos', 'movimiento', 'energia', 'electricidad', 'magnetismo', 'optica', 'termodinamica'],
  },
  quimica: {
    id: 'quimica',
    label: 'Química',
    short: 'QUI',
    accent: '#50C878',
    accent2: '#38BDF8',
    motif: 'molecular lattice',
    diagram: 'reaction-scheme',
    heroPrompt: `${BASE_HERO}, hexagonal molecular lattice, reaction pathways, translucent orbitals, laboratory glassware silhouettes, emerald and cyan glow`,
    keywords: ['quimica', 'materia y sus interacciones', 'reacciones quimicas', 'bioquimica', 'quimica organica', 'quimica inorganica'],
  },
  biologia: {
    id: 'biologia',
    label: 'Biología',
    short: 'BIO',
    accent: '#50C878',
    accent2: '#D4AF37',
    motif: 'living systems',
    diagram: 'system-map',
    heroPrompt: `${BASE_HERO}, cellular microscopy, DNA helix, ecosystem network, botanical scan lines, emerald bioluminescence`,
    keywords: [
      'biologia',
      'ciencias naturales',
      'ecologia',
      'ecosistemas',
      'organismos',
      'botanica',
      'zoologia',
      'genetica',
      'procesos biologicos',
      'biologicos',
    ],
  },
  salud: {
    id: 'salud',
    label: 'Ciencias de la Salud',
    short: 'SAL',
    accent: '#50C878',
    accent2: '#FF3131',
    motif: 'clinical protocol',
    diagram: 'clinical-flow',
    heroPrompt: `${BASE_HERO}, anatomical scan, ECG waveform, sterile clinical instrumentation, DNA diagnostics, emerald and red alert accents`,
    keywords: ['salud', 'salud integral', 'anatomia', 'microbiologia', 'enfermeria', 'medicina', 'nutricion', 'odontologia', 'primeros auxilios'],
  },
  filosofia: {
    id: 'filosofia',
    label: 'Filosofía y Humanidades',
    short: 'FIL',
    accent: '#D4AF37',
    accent2: '#AFC1D6',
    motif: 'argument architecture',
    diagram: 'argument-map',
    heroPrompt: `${BASE_HERO}, classical bust dissolved into wireframe, argument nodes, golden geometric halos, archival paper texture under glass, gold and ivory light`,
    keywords: [
      'filosofia',
      'humanidades',
      'pensamiento filosofico',
      'filosofico',
      'etica',
      'logica',
      'estetica',
      'experiencia estetica',
      'epistemologia',
      'ontologia',
      'pensamiento critico',
      'etimologicas',
    ],
  },
  literatura: {
    id: 'literatura',
    label: 'Lengua y Literatura',
    short: 'LIT',
    accent: '#D4AF37',
    accent2: '#FF3131',
    motif: 'textual constellation',
    diagram: 'rhetorical-map',
    heroPrompt: `${BASE_HERO}, floating manuscript pages, typographic constellations, quill and ink silhouette, gold and crimson rim light, editorial archive`,
    keywords: [
      'literatura',
      'lengua',
      'lengua y comunicacion',
      'comunicacion y sociedad',
      'pensamiento literario',
      'literario',
      'comunicacion',
      'lectura',
      'escritura',
      'redaccion',
      'analisis literario',
      'espanol',
    ],
  },
  ingles: {
    id: 'ingles',
    label: 'Inglés',
    short: 'ENG',
    accent: '#007FFF',
    accent2: '#D4AF37',
    motif: 'language network',
    diagram: 'word-map',
    heroPrompt: `${BASE_HERO}, phonetic waveform, word-network constellation, global communication grid, electric blue and gold glow`,
    keywords: ['ingles', 'english', 'language', 'spelling bee', 'phonetics', 'lengua extranjera'],
  },
  historia: {
    id: 'historia',
    label: 'Historia y Ciencias Sociales',
    short: 'HIS',
    accent: '#F5A524',
    accent2: '#FF3131',
    motif: 'chronology and territory',
    diagram: 'timeline',
    heroPrompt: `${BASE_HERO}, archival maps, timeline filaments, causal network, museum vitrine reflections, amber and red signal accents`,
    keywords: [
      'historia',
      'ciencias sociales',
      'sociologia',
      'geografia',
      'economia',
      'politica',
      'conciencia historica',
      'estructura socioeconomica',
      'espacio y sociedad',
      'derecho',
      'derecho y sociedad',
      'investigacion social',
      'laboratorio de investigacion',
    ],
  },
  tecnologia: {
    id: 'tecnologia',
    label: 'Tecnología e Ingeniería',
    short: 'TEC',
    accent: '#38BDF8',
    accent2: '#007FFF',
    motif: 'technical schematic',
    diagram: 'block-diagram',
    heroPrompt: `${BASE_HERO}, isometric circuit board, exploded engineering view, robotics blueprint, cyan and electric blue circuitry, precision instrumentation`,
    keywords: [
      'tecnologia',
      'computacion',
      'informatica',
      'robotica',
      'electronica',
      'programacion',
      'diseno grafico',
      'ingenieria',
      'cultura digital',
      'cibernexus',
      'dibujo tecnico',
      'dibujo industrial',
      'diseno asistido',
      'cad',
      'planos',
    ],
  },
  laboral: {
    id: 'laboral',
    label: 'Formación para el Trabajo',
    short: 'LAB',
    accent: '#D4AF37',
    accent2: '#007FFF',
    motif: 'technical operations',
    diagram: 'sop-flow',
    heroPrompt: `${BASE_HERO}, industrial workshop, precision tools, technical drawing table, safety protocol HUD, gold and blue instrumentation`,
    keywords: [
      'formacion para el trabajo',
      'capacitacion para el trabajo',
      'contabilidad',
      'contable',
      'procesos contables',
      'administracion',
      'fundamentos de administracion',
      'mantenimiento',
      'electricidad',
      'mecanica',
      'gastronomia',
      'agropecuario',
      'seguridad e higiene',
      'turismo',
      'ofimatica',
    ],
  },
  artes: {
    id: 'artes',
    label: 'Artes y Cultura',
    short: 'ART',
    accent: '#C084FC',
    accent2: '#D4AF37',
    motif: 'expressive composition',
    diagram: 'creative-cycle',
    heroPrompt: `${BASE_HERO}, expressive brushstroke light trails, stage lighting beams, musical waveform sculpture, gallery glass reflections, violet and gold glow`,
    keywords: [
      'artes',
      'artes visuales',
      'musica',
      'danza',
      'teatro',
      'expresion artistica',
      'apreciacion artistica',
      'artes plasticas',
      'taller de artes',
      'actividades artisticas',
      'artisticas',
      'arte y cultura',
      'culturales',
    ],
  },
  educacion_fisica: {
    id: 'educacion_fisica',
    label: 'Educación Física',
    short: 'EFI',
    accent: '#F97316',
    accent2: '#38BDF8',
    motif: 'movement and effort',
    diagram: 'training-cycle',
    heroPrompt: `${BASE_HERO}, motion capture silhouettes, running track geometry, heart-rate waveform, kinetic light arcs, orange and electric blue energy`,
    keywords: [
      'actividades fisicas y deportivas',
      'actividades fisicas',
      'actividad fisica',
      'acondicionamiento fisico',
      'educacion fisica',
      'deporte',
      'deportes',
      'deportiv',
      'deportiva',
      'deportivas',
      'activacion fisica',
      'cultura fisica',
      'recreacion',
      'entrenamiento deportivo',
      'motricidad',
      'afyd',
    ],
  },
  socioemocional: {
    id: 'socioemocional',
    label: 'Desarrollo Socioemocional',
    short: 'SOC',
    accent: '#A78BFA',
    accent2: '#F5A524',
    motif: 'emotional regulation',
    diagram: 'regulation-flow',
    heroPrompt: `${BASE_HERO}, translucent concentric emotion rings, neural network glow, calm horizon gradient, violet and amber light`,
    keywords: ['socioemocional', 'desarrollo socioemocional', 'psicologia', 'tutoria', 'orientacion educativa', 'habilidades socioemocionales', 'inteligencia emocional', 'bienestar emocional'],
  },
  general: {
    id: 'general',
    label: 'Formación General',
    short: 'GEN',
    accent: '#D4AF37',
    accent2: '#007FFF',
    motif: 'knowledge system',
    diagram: 'concept-map',
    heroPrompt: `${BASE_HERO}, abstract knowledge network, orbiting nodes, translucent glass architecture, gold and blue light`,
    keywords: [],
  },
};

export const CANONICAL_UAC_PACKS: Record<string, SacrintPackId> = {
  // Ciencias Naturales y Exactas
  'ciencias naturales, experimentales y tecnologia i': 'biologia',
  'ciencias naturales, experimentales y tecnologia ii': 'quimica',
  'ciencias naturales, experimentales y tecnologia iii': 'fisica',
  'ciencias naturales, experimentales y tecnologia iv': 'biologia',
  'ciencias naturales, experimentales y tecnologia v': 'quimica',
  'ciencias naturales, experimentales y tecnologia vi': 'fisica',
  'taller de ciencias i': 'biologia',
  'taller de ciencias ii': 'quimica',
  'temas selectos de biologia': 'biologia',
  'analisis de fenomenos y procesos biologicos': 'biologia',
  'organizacion del flujo de materia y energia en los organismos i': 'biologia',
  'organizacion del flujo de materia y energia en los organismos ii': 'biologia',
  'analisis de fenomenos fisicos i': 'fisica',
  'analisis de fenomenos fisicos ii': 'fisica',

  // Pensamiento Matemático
  'pensamiento matematico i': 'matematicas',
  'pensamiento matematico ii': 'matematicas',
  'pensamiento matematico iii': 'matematicas',
  'taller de pensamiento variacional i': 'matematicas',
  'taller pensamiento variacional i': 'matematicas',
  'taller pensamiento variacional ii': 'matematicas',
  'temas selectos de matematicas i': 'matematicas',
  'temas selectos de matematicas ii': 'matematicas',
  'pensamiento matematico aplicado a las finanzas i': 'matematicas',
  'pensamiento matematico aplicado a las finanzas ii': 'matematicas',
  'taller de probabilidad y estadistica i': 'matematicas',
  'taller de probabilidad y estadistica ii': 'matematicas',

  // Tecnología e Ingeniería
  'cultura digital i': 'tecnologia',
  'cultura digital ii': 'tecnologia',
  'taller de cultura digital i': 'tecnologia',
  'dibujo tecnico i': 'tecnologia',
  'dibujo tecnico ii': 'tecnologia',

  // Lengua, Comunicación e Idiomas
  'lengua y comunicacion i': 'literatura',
  'lengua y comunicacion ii': 'literatura',
  'lengua y comunicacion iii': 'literatura',
  'comunicacion y sociedad i': 'literatura',
  'comunicacion y sociedad ii': 'literatura',
  'pensamiento literario': 'literatura',
  'ingles i': 'ingles',
  'ingles ii': 'ingles',
  'ingles iii': 'ingles',
  'ingles iv': 'ingles',
  'ingles v': 'ingles',
  'ingles vi': 'ingles',

  // Humanidades y Filosofía
  'humanidades i': 'filosofia',
  'humanidades ii': 'filosofia',
  'humanidades iii': 'filosofia',
  'pensamiento filosofico i': 'filosofia',
  'pensamiento filosofico ii': 'filosofia',
  'logica y pensamiento critico': 'filosofia',
  'experiencia estetica': 'filosofia',
  'raices etimologicas del espanol i': 'filosofia',
  'raices etimologicas del espanol ii': 'filosofia',

  // Ciencias Sociales e Historia
  'ciencias sociales i': 'historia',
  'ciencias sociales ii': 'historia',
  'ciencias sociales iii': 'historia',
  'conciencia historica i': 'historia',
  'conciencia historica ii': 'historia',
  'conciencia historica iii': 'historia',
  'laboratorio de investigacion': 'historia',
  'espacio y sociedad': 'historia',
  'derecho y sociedad i': 'historia',
  'derecho y sociedad ii': 'historia',
  'economia i. la funcion de los agentes economicos en la sociedad': 'historia',
  'economia ii. politica economica y politica publica mexicana': 'historia',
  'temas selectos de ciencias sociales i': 'historia',
  'temas selectos de ciencias sociales ii': 'historia',

  // Educación Física y Salud
  'actividades fisicas y deportivas i': 'educacion_fisica',
  'actividades fisicas y deportivas ii': 'educacion_fisica',
  'actividades fisicas y deportivas': 'educacion_fisica',
  'salud integral i': 'salud',
  'salud integral ii': 'salud',

  // Artes y Cultura
  'actividades artisticas y culturales i': 'artes',
  'actividades artisticas y culturales ii': 'artes',
  'arte y cultura i': 'artes',
  'arte y cultura ii': 'artes',

  // Formación Socioemocional
  'formacion socioemocional iii': 'socioemocional',
  'formacion socioemocional iv': 'socioemocional',
  'formacion socioemocional v': 'socioemocional',
  'psicologia i': 'socioemocional',
  'psicologia ii': 'socioemocional',

  // Formación Laboral y Contabilidad
  'fundamentos de administracion i': 'laboral',
  'fundamentos de administracion ii': 'laboral',
  'procesos contables i': 'laboral',
  'procesos contables ii': 'laboral',
};

const ORDER: SacrintPackId[] = [
  'matematicas',
  'educacion_fisica',
  'fisica',
  'quimica',
  'biologia',
  'salud',
  'filosofia',
  'literatura',
  'ingles',
  'historia',
  'tecnologia',
  'laboral',
  'artes',
  'socioemocional',
];

export function resolveSacrintPack(uacName: string, component?: string): SacrintPack {
  const normalized = normalizeUnicode(uacName || '');

  // 1. Catálogo Canónico Integral SSoT (inmunidad a colisiones de subcadenas)
  const canonicalPackId = CANONICAL_UAC_PACKS[normalized];
  if (canonicalPackId && SACRINT_PACKS[canonicalPackId]) {
    return SACRINT_PACKS[canonicalPackId];
  }

  // 2. Garantía para módulos del componente de formación laboral
  if (component && normalizeUnicode(component).includes('laboral')) {
    return SACRINT_PACKS.laboral;
  }

  // 3. Fallback disciplinar por palabras clave
  for (const id of ORDER) {
    const pack = SACRINT_PACKS[id];
    if (pack.keywords.some((keyword) => normalized.includes(normalizeUnicode(keyword)))) {
      return pack;
    }
  }

  return SACRINT_PACKS.general;
}

export function packAccent(pack: SacrintPack, index = 0): string {
  return index % 2 === 0 ? pack.accent : pack.accent2;
}
