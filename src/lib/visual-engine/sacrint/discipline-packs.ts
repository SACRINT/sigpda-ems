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
    keywords: ['pensamiento matematico', 'matematicas', 'algebra', 'calculo', 'geometria', 'trigonometria', 'estadistica', 'probabilidad', 'aritmetica'],
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
    keywords: ['biologia', 'ciencias naturales', 'ecologia', 'ecosistemas', 'organismos', 'botanica', 'zoologia', 'genetica'],
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
    keywords: ['salud', 'anatomia', 'microbiologia', 'enfermeria', 'medicina', 'nutricion', 'odontologia', 'primeros auxilios'],
  },
  filosofia: {
    id: 'filosofia',
    label: 'Filosofía',
    short: 'FIL',
    accent: '#D4AF37',
    accent2: '#AFC1D6',
    motif: 'argument architecture',
    diagram: 'argument-map',
    heroPrompt: `${BASE_HERO}, classical bust dissolved into wireframe, argument nodes, golden geometric halos, archival paper texture under glass, gold and ivory light`,
    keywords: ['filosofia', 'etica', 'logica', 'estetica', 'epistemologia', 'ontologia', 'pensamiento critico'],
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
    keywords: ['literatura', 'lengua', 'comunicacion', 'lectura', 'escritura', 'redaccion', 'analisis literario', 'espanol'],
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
    keywords: ['historia', 'ciencias sociales', 'sociologia', 'geografia', 'economia', 'politica', 'conciencia historica', 'estructura socioeconomica'],
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
    keywords: ['tecnologia', 'computacion', 'informatica', 'robotica', 'electronica', 'programacion', 'diseno grafico', 'ingenieria', 'cultura digital', 'cibernexus'],
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
    keywords: ['formacion para el trabajo', 'capacitacion para el trabajo', 'contabilidad', 'administracion', 'mantenimiento', 'electricidad', 'mecanica', 'gastronomia', 'agropecuario', 'seguridad e higiene'],
  },
  artes: {
    id: 'artes',
    label: 'Artes',
    short: 'ART',
    accent: '#C084FC',
    accent2: '#D4AF37',
    motif: 'expressive composition',
    diagram: 'creative-cycle',
    heroPrompt: `${BASE_HERO}, expressive brushstroke light trails, stage lighting beams, musical waveform sculpture, gallery glass reflections, violet and gold glow`,
    keywords: ['artes', 'artes visuales', 'musica', 'danza', 'teatro', 'expresion artistica', 'apreciacion artistica', 'artes plasticas', 'taller de artes'],
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
    keywords: ['educacion fisica', 'deporte', 'deportes', 'activacion fisica', 'cultura fisica', 'recreacion', 'entrenamiento deportivo'],
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
  for (const id of ORDER) {
    const pack = SACRINT_PACKS[id];
    if (pack.keywords.some((keyword) => normalized.includes(normalizeUnicode(keyword)))) {
      return pack;
    }
  }
  if (component && normalizeUnicode(component).includes('laboral')) {
    return SACRINT_PACKS.laboral;
  }
  return SACRINT_PACKS.general;
}

export function packAccent(pack: SacrintPack, index = 0): string {
  return index % 2 === 0 ? pack.accent : pack.accent2;
}
