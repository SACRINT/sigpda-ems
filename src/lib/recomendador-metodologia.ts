/**
 * Recomendador Automático y Basado en Programas de Metodologías Activas — SIGPDA-EMS
 *
 * Motor disciplinar e institucional que recomienda la metodología activa
 * óptima basada en:
 *  1. Catálogo Canónico Curricular SSoT (MCCEMS 2025 / NEM).
 *  2. Análisis pedagógico de Propósitos Formativos y Contenidos/Progresiones.
 *  3. Inferencia por Dominio Disciplinar Canónico (resolveSacrintPack).
 *  4. Inmunidad absoluta contra falsos amigos ("Taller" académico ≠ Taller mecánico/industrial).
 *
 * El docente siempre puede sobrescribir libremente la sugerencia en el wizard.
 */

import {
  CATALOGO_METODOLOGIAS_ACTIVAS,
  type MetodologiaActiva,
} from '@/lib/catalogo-metodologias';
import { normalizeUnicode } from '@/lib/utils/normalize';
import { isTechnologicalSubsystem } from '@/lib/subsystem-config';
import { resolveSacrintPack } from '@/lib/visual-engine/sacrint/discipline-packs';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ContextDataRecomendacion {
  learningOutcome?: string | null;
  contenidosFormativos?: unknown;
  activities?: unknown;
  carreraTecnica?: string;
}

export interface RecomendacionDetalle {
  metodologiaId: string;
  razon: string;
  dominioDisciplinar: string;
}

export interface ReglaRecomendacion {
  metodologiaId: string;
  keywordsUac?: string[];
  keywordsExact?: string[];
  components?: string[];
  subsystems?: string[];
}

// ─── Catálogo Canónico SSoT de Metodologías por UAC Oficial ───────────────────
// Basado en el Marco Curricular Común de la Educación Media Superior (MCCEMS 2025 / NEM)
export const CANONICAL_UAC_METODOLOGIAS: Record<string, { id: string; razon: string; dominio: string }> = {
  // ── Pensamiento Variacional (5° y 6° Semestre FFE) → STEAM ──────────────────
  'taller de pensamiento variacional i': {
    id: 'steam',
    razon: 'Modelado matemático, funciones y análisis dinámico del cambio',
    dominio: 'Matemáticas y Modelado',
  },
  'taller pensamiento variacional i': {
    id: 'steam',
    razon: 'Modelado matemático, funciones y análisis dinámico del cambio',
    dominio: 'Matemáticas y Modelado',
  },
  'taller de pensamiento variacional ii': {
    id: 'steam',
    razon: 'Modelado matemático, cálculo y análisis dinámico del cambio',
    dominio: 'Matemáticas y Modelado',
  },
  'taller pensamiento variacional ii': {
    id: 'steam',
    razon: 'Modelado matemático, cálculo y análisis dinámico del cambio',
    dominio: 'Matemáticas y Modelado',
  },
  'pensamiento variacional': {
    id: 'steam',
    razon: 'Modelado matemático, funciones y análisis dinámico del cambio',
    dominio: 'Matemáticas y Modelado',
  },
  'temas selectos de matematicas i': {
    id: 'steam',
    razon: 'Indagación y modelado matemático avanzado',
    dominio: 'Matemáticas Avanzadas',
  },
  'temas selectos de matematicas ii': {
    id: 'steam',
    razon: 'Indagación y modelado matemático avanzado',
    dominio: 'Matemáticas Avanzadas',
  },

  // ── Pensamiento Matemático (1° a 4° Semestre y Aplicadas) → ABProblemas ─────
  'pensamiento matematico i': {
    id: 'abproblemas',
    razon: 'Resolución heurística de situaciones problemáticas y modelado',
    dominio: 'Pensamiento Matemático',
  },
  'pensamiento matematico ii': {
    id: 'abproblemas',
    razon: 'Resolución inductiva de problemas geométricos y algebraicos',
    dominio: 'Pensamiento Matemático',
  },
  'pensamiento matematico iii': {
    id: 'abproblemas',
    razon: 'Resolución de problemas de probabilidad y optimización',
    dominio: 'Pensamiento Matemático',
  },
  'pensamiento matematico iv': {
    id: 'abproblemas',
    razon: 'Modelado y resolución de problemas cuantitativos complejos',
    dominio: 'Pensamiento Matemático',
  },
  'taller de probabilidad y estadistica i': {
    id: 'abproblemas',
    razon: 'Análisis de datos, inferencia y resolución de problemas estocásticos',
    dominio: 'Pensamiento Matemático',
  },
  'taller de probabilidad y estadistica ii': {
    id: 'abproblemas',
    razon: 'Inferencia estadística y resolución de problemas del entorno',
    dominio: 'Pensamiento Matemático',
  },
  'pensamiento matematico aplicado a las finanzas i': {
    id: 'abproblemas',
    razon: 'Resolución de problemas financieros y de toma de decisiones',
    dominio: 'Pensamiento Matemático',
  },
  'pensamiento matematico aplicado a las finanzas ii': {
    id: 'abproblemas',
    razon: 'Resolución de problemas financieros y presupuestos',
    dominio: 'Pensamiento Matemático',
  },

  // ── Ciencias Naturales y Experimentales → Indagación ABI ────────────────────
  'la materia y sus interacciones': {
    id: 'indagacion',
    razon: 'Indagación científica escolar sobre la estructura y cambio de la materia',
    dominio: 'Ciencias Naturales',
  },
  'conservacion de la energia y sus interacciones con la materia': {
    id: 'indagacion',
    razon: 'Indagación experimental sobre termodinámica y energía',
    dominio: 'Ciencias Naturales',
  },
  'ecosistemas: interacciones, energia y dinamica': {
    id: 'indagacion',
    razon: 'Indagación biológica y ecológica con trabajo de campo',
    dominio: 'Ciencias Naturales',
  },
  'taller de ciencias i': {
    id: 'indagacion',
    razon: 'Experimentación escolar y contrastación empírica de hipótesis',
    dominio: 'Ciencias Naturales',
  },
  'taller de ciencias ii': {
    id: 'indagacion',
    razon: 'Experimentación escolar y contrastación empírica de hipótesis',
    dominio: 'Ciencias Naturales',
  },
  'fisica i': {
    id: 'indagacion',
    razon: 'Experimentación física y análisis de variables cinemáticas',
    dominio: 'Física',
  },
  'fisica ii': {
    id: 'indagacion',
    razon: 'Experimentación física y análisis de campos electromagnéticos',
    dominio: 'Física',
  },
  'fisica experimental': {
    id: 'indagacion',
    razon: 'Protocolo de indagación y contrastación experimental de variables',
    dominio: 'Física',
  },
  'quimica i': {
    id: 'indagacion',
    razon: 'Indagación sobre enlaces, reacciones y balance estequiométrico',
    dominio: 'Química',
  },
  'quimica ii': {
    id: 'indagacion',
    razon: 'Indagación sobre cinética química y equilibrio',
    dominio: 'Química',
  },
  'biologia': {
    id: 'indagacion',
    razon: 'Indagación sobre sistemas vivos y genética',
    dominio: 'Biología',
  },
  'biologia general': {
    id: 'indagacion',
    razon: 'Indagación biológica y observación celular',
    dominio: 'Biología',
  },
  'analisis de fenomenos fisicos i': {
    id: 'indagacion',
    razon: 'Indagación empírica de fenómenos físicos',
    dominio: 'Física',
  },
  'analisis de fenomenos fisicos ii': {
    id: 'indagacion',
    razon: 'Indagación empírica de fenómenos físicos',
    dominio: 'Física',
  },
  'analisis de fenomenos y procesos biologicos': {
    id: 'indagacion',
    razon: 'Indagación y observación biológica',
    dominio: 'Biología',
  },
  'organizacion del flujo de materia y energia en los organismos i': {
    id: 'indagacion',
    razon: 'Indagación sobre metabolismo celular y bioenergética',
    dominio: 'Biología',
  },
  'organizacion del flujo de materia y energia en los organismos ii': {
    id: 'indagacion',
    razon: 'Indagación sobre biosistemas y ecología',
    dominio: 'Biología',
  },
  'robotica y prototipos': {
    id: 'steam',
    razon: 'Diseño técnico, programación y prototipado físico interdisciplinario',
    dominio: 'Tecnología e Ingeniería',
  },
  'dibujo tecnico i': {
    id: 'steam',
    razon: 'Modelado geométrico espacial y diseño técnico proyectivo',
    dominio: 'Tecnología e Ingeniería',
  },
  'dibujo tecnico ii': {
    id: 'steam',
    razon: 'Diseño técnico avanzado y planos normalizados',
    dominio: 'Tecnología e Ingeniería',
  },

  // ── Educación Física y Salud → Gamificación ─────────────────────────────────
  'actividades fisicas y deportivas i': {
    id: 'gamificacion',
    razon: 'Retos motrices, dinámicas de juego estructurado y estaciones fisiológicas',
    dominio: 'Educación Física y Salud',
  },
  'actividades fisicas y deportivas ii': {
    id: 'gamificacion',
    razon: 'Retos motrices, dinámicas lúdicas y entrenamiento colaborativo',
    dominio: 'Educación Física y Salud',
  },
  'actividades fisicas y deportivas': {
    id: 'gamificacion',
    razon: 'Retos motrices, dinámicas de juego estructurado y estaciones',
    dominio: 'Educación Física y Salud',
  },
  'educacion fisica': {
    id: 'gamificacion',
    razon: 'Retos motrices, superación de niveles y juego en equipo',
    dominio: 'Educación Física y Salud',
  },
  'condicion fisica y deportiva': {
    id: 'gamificacion',
    razon: 'Misiones motrices, circuitos y retos de resistencia',
    dominio: 'Educación Física y Salud',
  },
  'salud integral i': {
    id: 'gamificacion',
    razon: 'Desafíos formativos y estaciones de monitoreo saludable',
    dominio: 'Educación Física y Salud',
  },
  'salud integral ii': {
    id: 'gamificacion',
    razon: 'Desafíos de estilo de vida saludable y prevención',
    dominio: 'Educación Física y Salud',
  },

  // ── Lengua Extranjera (Inglés) → Gamificación ───────────────────────────────
  'ingles i': {
    id: 'gamificacion',
    razon: 'Misiones comunicativas, desafíos lúdicos por estaciones e interacción oral',
    dominio: 'Lengua Extranjera',
  },
  'ingles ii': {
    id: 'gamificacion',
    razon: 'Desafíos interactivos de fluidez y superación de niveles lingüísticos',
    dominio: 'Lengua Extranjera',
  },
  'ingles iii': {
    id: 'gamificacion',
    razon: 'Escape rooms lingüísticos y misiones comunicativas situadas',
    dominio: 'Lengua Extranjera',
  },
  'ingles iv': {
    id: 'gamificacion',
    razon: 'Retos de interacción y roles comunicativos en entornos simulados',
    dominio: 'Lengua Extranjera',
  },
  'ingles v': {
    id: 'gamificacion',
    razon: 'Misiones avanzadas de debate y argumentación en inglés',
    dominio: 'Lengua Extranjera',
  },
  'ingles vi': {
    id: 'gamificacion',
    razon: 'Desafíos globales de comunicación y proyectos bilingües',
    dominio: 'Lengua Extranjera',
  },

  // ── Cultura Digital y Tecnologías de la Información → ABR ───────────────────
  'cultura digital i': {
    id: 'abr',
    razon: 'Desafíos técnicos y algoritmos para la solución de problemas cotidianos',
    dominio: 'Cultura Digital',
  },
  'cultura digital ii': {
    id: 'abr',
    razon: 'Retos de desarrollo de software, análisis de datos y ciberseguridad',
    dominio: 'Cultura Digital',
  },
  'taller de cultura digital i': {
    id: 'abr',
    razon: 'Retos aplicados de código, hojas de cálculo y automatización',
    dominio: 'Cultura Digital',
  },
  'programacion web': {
    id: 'abr',
    razon: 'Retos ágiles de desarrollo web y despliegue de aplicaciones',
    dominio: 'Cultura Digital',
  },
  'desarrollo de software': {
    id: 'abr',
    razon: 'Retos de ingeniería de software y prototipado ágil',
    dominio: 'Cultura Digital',
  },
  'inteligencia artificial': {
    id: 'abr',
    razon: 'Retos de entrenamiento de modelos y analítica predictiva',
    dominio: 'Cultura Digital',
  },

  // ── Ciencias Sociales e Historia → Estudio de Casos ─────────────────────────
  'ciencias sociales i': {
    id: 'estudio_casos',
    razon: 'Análisis deliberativo de dilemas sociales y desigualdades del entorno',
    dominio: 'Ciencias Sociales',
  },
  'ciencias sociales ii': {
    id: 'estudio_casos',
    razon: 'Estudio de casos sobre organización comunitaria y estructura social',
    dominio: 'Ciencias Sociales',
  },
  'ciencias sociales iii': {
    id: 'estudio_casos',
    razon: 'Análisis de políticas públicas y dilemas socioeconómicos',
    dominio: 'Ciencias Sociales',
  },
  'conciencia historica i': {
    id: 'estudio_casos',
    razon: 'Análisis crítico de fuentes históricas y causas de procesos sociales',
    dominio: 'Conciencia Histórica',
  },
  'conciencia historica ii': {
    id: 'estudio_casos',
    razon: 'Estudio de coyunturas y memoria histórica contextualizada',
    dominio: 'Conciencia Histórica',
  },
  'conciencia historica iii': {
    id: 'estudio_casos',
    razon: 'Contrastación de interpretaciones históricas y transformaciones',
    dominio: 'Conciencia Histórica',
  },
  'laboratorio de investigacion': {
    id: 'estudio_casos',
    razon: 'Investigación metodológica, levantamiento de testimonios y análisis de casos',
    dominio: 'Ciencias Sociales',
  },
  'derecho y sociedad i': {
    id: 'estudio_casos',
    razon: 'Análisis de casos jurídicos y dilemas constitucionales',
    dominio: 'Ciencias Sociales',
  },
  'derecho y sociedad ii': {
    id: 'estudio_casos',
    razon: 'Resolución argumentada de litigios y derechos humanos',
    dominio: 'Ciencias Sociales',
  },
  'espacio y sociedad': {
    id: 'estudio_casos',
    razon: 'Estudio de casos socioespaciales y dinámicas territoriales',
    dominio: 'Ciencias Sociales',
  },
  'economia i': {
    id: 'estudio_casos',
    razon: 'Análisis de casos económicos y decisiones de mercado',
    dominio: 'Ciencias Sociales',
  },
  'economia ii': {
    id: 'estudio_casos',
    razon: 'Estudio de casos sobre política monetaria y bienestar',
    dominio: 'Ciencias Sociales',
  },

  // ── Humanidades y Filosofía → Estudio de Casos ──────────────────────────────
  'humanidades i': {
    id: 'estudio_casos',
    razon: 'Diálogo socrático y análisis de dilemas sobre la experiencia humana',
    dominio: 'Humanidades',
  },
  'humanidades ii': {
    id: 'estudio_casos',
    razon: 'Deliberación ética y dilemas sobre justicia y comunidad',
    dominio: 'Humanidades',
  },
  'humanidades iii': {
    id: 'estudio_casos',
    razon: 'Análisis filosófico de la condición contemporánea y tecnología',
    dominio: 'Humanidades',
  },
  'pensamiento filosofico i': {
    id: 'estudio_casos',
    razon: 'Discusión y argumentación sobre problemas filosóficos fundamentales',
    dominio: 'Humanidades',
  },
  'pensamiento filosofico ii': {
    id: 'estudio_casos',
    razon: 'Análisis crítico de corrientes epistemológicas y existenciales',
    dominio: 'Humanidades',
  },
  'logica y pensamiento critico': {
    id: 'estudio_casos',
    razon: 'Análisis de falacias y deliberación estructurada de argumentos',
    dominio: 'Humanidades',
  },
  'logica': {
    id: 'aula_invertida',
    razon: 'Discusión socrática y resolución activa de ejercicios conceptuales',
    dominio: 'Humanidades y Filosofía',
  },
  'experiencia estetica': {
    id: 'estudio_casos',
    razon: 'Deliberación crítica sobre manifestaciones artísticas y estética',
    dominio: 'Humanidades',
  },
  'raices etimologicas del espanol i': {
    id: 'estudio_casos',
    razon: 'Análisis de fuentes léxicas y construcción del discurso',
    dominio: 'Humanidades',
  },
  'raices etimologicas del espanol ii': {
    id: 'estudio_casos',
    razon: 'Etimología aplicada a terminología científica y humanística',
    dominio: 'Humanidades',
  },

  // ── Lengua, Comunicación y Literatura → ABP ────────────────────────────────
  'lengua y comunicacion i': {
    id: 'abp',
    razon: 'Proyectos comunicativos de lectura crítica y expresión escrita auténtica',
    dominio: 'Lengua y Comunicación',
  },
  'lengua y comunicacion ii': {
    id: 'abp',
    razon: 'Elaboración de proyectos periodísticos, ensayos y reseñas',
    dominio: 'Lengua y Comunicación',
  },
  'lengua y comunicacion iii': {
    id: 'abp',
    razon: 'Proyectos integradores de divulgación y debate comunitario',
    dominio: 'Lengua y Comunicación',
  },
  'comunicacion y sociedad i': {
    id: 'abp',
    razon: 'Creación de productos mediáticos y campañas informativas',
    dominio: 'Lengua y Comunicación',
  },
  'comunicacion y sociedad ii': {
    id: 'abp',
    razon: 'Proyectos audiovisuales y crítica de medios',
    dominio: 'Lengua y Comunicación',
  },
  'pensamiento literario': {
    id: 'abp',
    razon: 'Creación de antologías literarias y talleres de escritura',
    dominio: 'Lengua y Comunicación',
  },
  'taller de lectura y redaccion i': {
    id: 'abp',
    razon: 'Talleres de producción textual y proyectos editoriales',
    dominio: 'Lengua y Comunicación',
  },
  'taller de lectura y redaccion ii': {
    id: 'abp',
    razon: 'Proyectos de redacción académica y gacetas estudiantiles',
    dominio: 'Lengua y Comunicación',
  },

  // ── Artes y Expresión Cultural → ABP ────────────────────────────────────────
  'actividades artisticas y culturales i': {
    id: 'abp',
    razon: 'Proyectos integradores de expresión artística comunitaria',
    dominio: 'Artes y Cultura',
  },
  'actividades artisticas y culturales ii': {
    id: 'abp',
    razon: 'Montaje de exposiciones o muestras multidisciplinarias',
    dominio: 'Artes y Cultura',
  },
  'arte y cultura i': {
    id: 'abp',
    razon: 'Proyectos de apreciación estética y creación artística',
    dominio: 'Artes y Cultura',
  },
  'arte y cultura ii': {
    id: 'abp',
    razon: 'Proyectos de patrimonio cultural y artes visuales',
    dominio: 'Artes y Cultura',
  },

  // ── Formación Socioemocional y PAEC → ApS ───────────────────────────────────
  'formacion socioemocional iii': {
    id: 'aprendizaje_servicio',
    razon: 'Servicio colaborativo a la comunidad escolar y empatía',
    dominio: 'Socioemocional',
  },
  'formacion socioemocional iv': {
    id: 'aprendizaje_servicio',
    razon: 'Proyectos de bienestar social y transformación comunitaria',
    dominio: 'Socioemocional',
  },
  'formacion socioemocional v': {
    id: 'aprendizaje_servicio',
    razon: 'Servicio solidario y liderazgo comunitario',
    dominio: 'Socioemocional',
  },
  'proyectos comunitarios': {
    id: 'abp',
    razon: 'Proyectos orientados al PAEC y diagnóstico situacional',
    dominio: 'Comunitario',
  },
  'paec': {
    id: 'abp',
    razon: 'Proyecto Aula Escuela Comunidad integrador',
    dominio: 'Comunitario',
  },
};

// ─── Reglas de Fallback Heurístico (Filtradas con Seguridad Anti-Colisión) ─────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchExactWord(textLower: string, keyword: string): boolean {
  const normKw = normalizeUnicode(keyword).trim();
  if (!normKw) return false;
  const pattern = new RegExp(`\\b${escapeRegex(normKw)}\\b`, 'i');
  return pattern.test(textLower);
}

export const REGLAS: ReglaRecomendacion[] = [
  // ── Formación Laboral Técnica → Práctica de Taller (Estilo Técnico) ─────────
  {
    metodologiaId: 'practica_laboratorio',
    components: ['laboral'],
  },
  // ── Pensamiento Variacional y Modelado Matemático → STEAM ───────────────────
  {
    metodologiaId: 'steam',
    keywordsUac: [
      'pensamiento variacional', 'variacional', 'razon de cambio', 'razón de cambio',
      'modelado matematico', 'modelado matemático',
    ],
  },
  // ── Programación, Sistemas, TI → ABR (Aprendizaje Basado en Retos) ──────────
  {
    metodologiaId: 'abr',
    keywordsUac: [
      'programación', 'programacion', 'software', 'código', 'codigo',
      'redes', 'sistemas operativos', 'base de datos', ' web ', ' app ',
      'algoritmos', 'javascript', 'python', 'java', 'machine learning',
      'inteligencia artificial', ' ia ', 'ciberseguridad', 'cloud',
    ],
  },
  // ── Especialidades Técnicas Vocacionales (SIN 'taller' ni 'laboratorio' genéricos) ───
  // Prefijos técnicos específicos: electrónica, mecatrónica, soldadura, tornería, etc.
  {
    metodologiaId: 'practica_laboratorio',
    keywordsUac: [
      'electr', 'mecatr', 'soldad', 'tornería', 'torneria',
      'instalaciones electricas', 'instalaciones eléctricas', 'automotr', 'refriger',
      'aire acondicionado', 'maquinaria pesada', 'metalmecánica', 'metalmecanic',
      'mantenimiento industrial', 'taller mecanico', 'taller mecánico', 'taller automotriz',
    ],
  },
  // ── Actividades Físicas, Deportes, Educación Física → Gamificación ──────────
  {
    metodologiaId: 'gamificacion',
    keywordsUac: [
      'actividades físicas', 'actividades fisicas', 'actividad física', 'actividad fisica',
      'deportiv', 'educación física', 'educacion fisica',
      'condición física', 'condicion fisica', 'salud integral',
    ],
  },
  // ── Ciencias Experimentales (Naturales) → Indagación ABI ────────────────────
  {
    metodologiaId: 'indagacion',
    keywordsExact: [
      'química', 'quimica', 'física', 'fisica', 'biología', 'biologia',
      'ecología', 'ecologia',
    ],
    keywordsUac: [
      'ciencias naturales', 'la materia', 'ecosistema', 'biodiversidad',
      'ciencias química', 'ciencias quimica', 'taller de ciencias',
    ],
  },
  // ── Robótica, Prototipado, Energía → STEAM ──────────────────────────────────
  {
    metodologiaId: 'steam',
    keywordsUac: [
      'conservación de la energía', 'conservacion de la energia', 'energia', 'cambio climático',
      'ingeniería', 'ingenieria', 'prototipo', 'robótica', 'robotica',
      'modelado', 'automatización', 'dibujo técnico', 'dibujo tecnico',
    ],
  },
  // ── Matemáticas / Pensamiento Matemático → ABProblemas ───────────────────────
  {
    metodologiaId: 'abproblemas',
    keywordsUac: [
      'matemátic', 'matematik', 'álgebra', 'algebra', 'cálculo', 'calculo',
      'estadística', 'estadistica', 'probabilidad', 'trigonometría', 'trigonometria',
      'pensamiento matemático', 'pensamiento logico',
    ],
  },
  // ── Lógica Conceptual y Epistemología → Aula Invertida ─────────────────────
  {
    metodologiaId: 'aula_invertida',
    keywordsExact: [
      'lógica', 'logica',
    ],
    keywordsUac: [
      'filosofía lógica', 'filosofia logica', 'epistemología', 'epistemologia',
    ],
  },
  // ── Inglés / Lengua Extranjera → Gamificación ───────────────────────────────
  {
    metodologiaId: 'gamificacion',
    keywordsUac: [
      'inglés', 'ingles', 'lengua extranjera', 'idioma',
    ],
  },
  // ── Lengua, Comunicación, Redacción → ABP ───────────────────────────────────
  {
    metodologiaId: 'abp',
    keywordsUac: [
      'lengua y comunicación', 'lengua y comunicacion', 'lectura', 'escritura',
      'redacción', 'redaccion', 'expresión oral', 'literatur',
      'taller de lectura y redaccion', 'taller de lectura',
    ],
  },
  // ── Ciencias Sociales, Historia, Ética, Derecho, Filosofía → Estudio de Casos ──
  {
    metodologiaId: 'estudio_casos',
    keywordsUac: [
      'ciencias social', 'historia', 'ética', 'etica', 'derecho',
      'filosofía', 'filosofia', 'humanidades', 'sociedad', 'política',
      'politica', 'economía', 'economia', 'conciencia histórica',
      'conciencia historica', 'pensamiento filosófico', 'pensamiento filosofico',
      'pensamiento humanístico', 'laboratorio de investigacion',
      'laboratorio de investigación', 'logica y pensamiento',
    ],
  },
  // ── Proyectos Comunitarios, Servicio → ApS ──────────────────────────────────
  {
    metodologiaId: 'aprendizaje_servicio',
    keywordsUac: [
      'habilidades para la vida', 'servicio', 'comunitaria',
      'proyectos comunitarios', 'paec', 'pips', 'vinculación', 'vinculacion',
      'formacion socioemocional', 'formación socioemocional',
    ],
  },
  // ── Emprendimiento, Administración → ABP ────────────────────────────────────
  {
    metodologiaId: 'abp',
    keywordsUac: [
      'emprendimiento', 'administración', 'administracion', 'gestión',
      'gestion', 'proyecto', 'innovación', 'innovacion',
      'contabilidad', 'finanzas',
    ],
  },
];

// ─── Analizador Pedagógico de Textos Curriculares ─────────────────────────────

function extractFullCurriculumText(contextData?: ContextDataRecomendacion): string {
  if (!contextData) return '';
  const chunks: string[] = [];

  if (contextData.learningOutcome && typeof contextData.learningOutcome === 'string') {
    chunks.push(contextData.learningOutcome);
  }

  if (contextData.carreraTecnica && typeof contextData.carreraTecnica === 'string') {
    chunks.push(contextData.carreraTecnica);
  }

  if (contextData.contenidosFormativos) {
    if (typeof contextData.contenidosFormativos === 'string') {
      chunks.push(contextData.contenidosFormativos);
    } else if (Array.isArray(contextData.contenidosFormativos)) {
      for (const item of contextData.contenidosFormativos) {
        if (typeof item === 'string') {
          chunks.push(item);
        } else if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          if (obj.proposito) chunks.push(String(obj.proposito));
          if (obj.progresion) chunks.push(String(obj.progresion));
          if (obj.actividad) chunks.push(String(obj.actividad));
          if (Array.isArray(obj.contenidos)) chunks.push(obj.contenidos.join(' '));
          if (Array.isArray(obj.saberes)) chunks.push(obj.saberes.join(' '));
        }
      }
    }
  }

  if (Array.isArray(contextData.activities)) {
    for (const act of contextData.activities) {
      if (act && typeof act === 'object' && 'name' in act) {
        chunks.push(String((act as { name: unknown }).name));
      }
    }
  }

  return normalizeUnicode(chunks.join(' '));
}

// ─── Funciones Principales de Recomendación ───────────────────────────────────

/**
 * Recomienda una metodología activa con desglose detallado de razones
 * pedagógicas e institucionales del MCCEMS.
 */
export function recomendarMetodologiaConDetalle(
  uacName: string,
  component: string,
  subsystem?: string,
  contextData?: ContextDataRecomendacion
): RecomendacionDetalle {
  const normUac = normalizeUnicode(uacName || '').trim();
  const componentLower = (component || '').toLowerCase().trim();
  const isLaboral = componentLower === 'laboral' || componentLower.includes('laboral') || componentLower.includes('profesional');
  const isBt = isTechnologicalSubsystem(subsystem);

  // ── PASO 1: Catálogo Canónico Curricular SSoT (Máxima Precisión) ─────────────
  if (normUac && CANONICAL_UAC_METODOLOGIAS[normUac]) {
    const entry = CANONICAL_UAC_METODOLOGIAS[normUac];
    return {
      metodologiaId: entry.id,
      razon: `Sugerencia basada en el enfoque de ${entry.razon} (${entry.dominio})`,
      dominioDisciplinar: entry.dominio,
    };
  }

  // ── PASO 2: Análisis Pedagógico de Propósitos y Contenidos Oficiales ─────────
  const fullText = extractFullCurriculumText(contextData);
  if (fullText) {
    // 2.1 Modelado del cambio y fenómenos dinámicos → STEAM
    if (
      fullText.includes('variacional') ||
      fullText.includes('razon de cambio') ||
      fullText.includes('razones de cambio') ||
      fullText.includes('calculo diferencial') ||
      fullText.includes('calculo integral') ||
      fullText.includes('derivada') ||
      fullText.includes('integral') ||
      fullText.includes('modelado matematico') ||
      fullText.includes('sistemas dinamicos') ||
      fullText.includes('optimizacion')
    ) {
      return {
        metodologiaId: 'steam',
        razon: 'Sugerencia basada en el análisis de cambio dinámico, funciones y modelado matemático en los contenidos del programa',
        dominioDisciplinar: 'Pensamiento Variacional',
      };
    }

    // 2.2 Indagación científica y contrastación empírica → ABI
    if (
      fullText.includes('preguntas investigables') ||
      fullText.includes('hipotesis') ||
      fullText.includes('experimentacion escolar') ||
      fullText.includes('recoleccion de datos') ||
      fullText.includes('fenomenos naturales') ||
      fullText.includes('ecosistemas') ||
      fullText.includes('materia y sus interacciones')
    ) {
      return {
        metodologiaId: 'indagacion',
        razon: 'Sugerencia basada en la formulación de hipótesis, experimentación y contrastación empírica en el programa',
        dominioDisciplinar: 'Ciencias Naturales',
      };
    }

    // 2.3 Estudio de Casos Situados (Dilemas éticos, históricos, normativos)
    if (
      fullText.includes('estudio de casos') ||
      fullText.includes('dilema moral') ||
      fullText.includes('dilema etico') ||
      fullText.includes('deliberacion') ||
      fullText.includes('derechos humanos') ||
      fullText.includes('conciencia historica') ||
      fullText.includes('marco normativo')
    ) {
      return {
        metodologiaId: 'estudio_casos',
        razon: 'Sugerencia basada en el análisis deliberativo de dilemas, fuentes y situaciones del entorno en el programa',
        dominioDisciplinar: 'Humanidades y Ciencias Sociales',
      };
    }

    // 2.4 Retos ágiles de software / tecnología → ABR
    if (
      fullText.includes('desafio tecnico') ||
      fullText.includes('algoritmo') ||
      fullText.includes('desarrollo de software') ||
      fullText.includes('cultura digital') ||
      fullText.includes('lenguaje de programacion')
    ) {
      return {
        metodologiaId: 'abr',
        razon: 'Sugerencia basada en la resolución de retos técnicos, algoritmos y prototipado ágil',
        dominioDisciplinar: 'Cultura Digital',
      };
    }

    // 2.5 Actividades motrices y lúdicas → Gamificación
    if (
      fullText.includes('motricidad') ||
      fullText.includes('frecuencia cardiaca') ||
      fullText.includes('circuito motriz') ||
      fullText.includes('juego motor') ||
      fullText.includes('condicion fisica')
    ) {
      return {
        metodologiaId: 'gamificacion',
        razon: 'Sugerencia basada en retos motrices, estaciones fisiológicas y dinámicas de juego formativo',
        dominioDisciplinar: 'Educación Física y Deporte',
      };
    }

    // 2.6 Protocolos técnicos y seguridad de taller (ÚNICAMENTE si es laboral/técnico)
    if (
      (isLaboral || isBt) &&
      (fullText.includes('protocolo tecnico') ||
        fullText.includes('seguridad industrial') ||
        fullText.includes('herramientas y maquinaria') ||
        fullText.includes('equipo de proteccion personal') ||
        fullText.includes('troubleshooting'))
    ) {
      return {
        metodologiaId: 'practica_laboratorio',
        razon: 'Sugerencia basada en la ejecución de protocolos técnicos, normas de seguridad y manual de taller',
        dominioDisciplinar: 'Formación para el Trabajo',
      };
    }
  }

  // ── PASO 3: Reglas Heurísticas Seguras ──────────────────────────────────────
  const uacPadded = ` ${normUac} `;
  for (const regla of REGLAS) {
    if (regla.subsystems && subsystem) {
      const matchesSub = regla.subsystems.some((s) => {
        const sNorm = s.toLowerCase().trim();
        if (sNorm === 'bt') return isBt;
        if (sNorm === 'bge') return !isBt;
        return sNorm === subsystem.toLowerCase().trim();
      });
      if (!matchesSub) continue;
    }

    if (regla.components && !regla.components.includes(componentLower)) {
      if (!regla.keywordsUac && !regla.keywordsExact) continue;
    }

    if (regla.components?.includes(componentLower) && !regla.keywordsUac && !regla.keywordsExact) {
      return {
        metodologiaId: regla.metodologiaId,
        razon: `Sugerencia asignada por componente curricular (${component})`,
        dominioDisciplinar: component,
      };
    }

    if (regla.keywordsUac || regla.keywordsExact) {
      const substringMatch = regla.keywordsUac
        ? regla.keywordsUac.some((kw) => {
            const normKw = normalizeUnicode(kw);
            return normKw.startsWith(' ') || normKw.endsWith(' ')
              ? uacPadded.includes(normKw)
              : normUac.includes(normKw);
          })
        : false;
      const exactMatch = regla.keywordsExact
        ? regla.keywordsExact.some((kw) => matchExactWord(normUac, kw))
        : false;

      if (substringMatch || exactMatch) {
        return {
          metodologiaId: regla.metodologiaId,
          razon: `Sugerencia asignada por afinidad temática con ${normUac}`,
          dominioDisciplinar: normUac,
        };
      }
    }
  }

  // ── PASO 4: Inferencia por Dominio Disciplinar Canónico (resolveSacrintPack) ──
  const pack = resolveSacrintPack(normUac, component);
  if (pack && pack.id !== 'general') {
    switch (pack.id) {
      case 'matematicas': {
        if (
          normUac.includes('variacional') ||
          normUac.includes('calculo') ||
          normUac.includes('funciones') ||
          normUac.includes('razon de cambio')
        ) {
          return {
            metodologiaId: 'steam',
            razon: 'Sugerencia interdisciplinaria STEAM para modelado matemático y análisis del cambio',
            dominioDisciplinar: 'Pensamiento Variacional',
          };
        }
        return {
          metodologiaId: 'abproblemas',
          razon: 'Sugerencia de Aprendizaje Basado en Problemas para el razonamiento matemático inductivo',
          dominioDisciplinar: 'Pensamiento Matemático',
        };
      }
      case 'fisica': {
        // Exigir límite de palabra para física para evitar falsos positivos con "físicas"
        if (!matchExactWord(normUac, 'física') && !matchExactWord(normUac, 'fisica')) {
          break;
        }
        return {
          metodologiaId: 'indagacion',
          razon: `Sugerencia de Indagación Científica (ABI) para experimentación y fenómenos en Física`,
          dominioDisciplinar: 'Física',
        };
      }
      case 'quimica':
      case 'biologia':
        return {
          metodologiaId: 'indagacion',
          razon: `Sugerencia de Indagación Científica (ABI) para experimentación y fenómenos en ${pack.label}`,
          dominioDisciplinar: pack.label,
        };
      case 'educacion_fisica':
      case 'salud':
        return {
          metodologiaId: 'gamificacion',
          razon: 'Sugerencia de Gamificación Pedagógica para dinámicas lúdicas y retos motrices',
          dominioDisciplinar: 'Educación Física y Salud',
        };
      case 'ingles':
        return {
          metodologiaId: 'gamificacion',
          razon: 'Sugerencia de Gamificación para misiones comunicativas y roles lingüísticos interactivos',
          dominioDisciplinar: 'Lengua Extranjera',
        };
      case 'tecnologia':
        return {
          metodologiaId: 'abr',
          razon: 'Sugerencia de Aprendizaje Basado en Retos para desafíos tecnológicos y prototipado',
          dominioDisciplinar: 'Cultura Digital',
        };
      case 'filosofia':
      case 'historia':
        return {
          metodologiaId: 'estudio_casos',
          razon: 'Sugerencia de Estudio de Casos Situados para deliberación y análisis crítico',
          dominioDisciplinar: pack.label,
        };
      case 'literatura':
        return {
          metodologiaId: 'abp',
          razon: 'Sugerencia de Aprendizaje Basado en Proyectos para productos comunicativos y textos',
          dominioDisciplinar: 'Lengua y Comunicación',
        };
      case 'artes':
        return {
          metodologiaId: 'abp',
          razon: 'Sugerencia de ABP para proyectos de creación y expresión artística comunitaria',
          dominioDisciplinar: 'Artes y Cultura',
        };
      case 'socioemocional':
        return {
          metodologiaId: 'aprendizaje_servicio',
          razon: 'Sugerencia de Aprendizaje-Servicio para proyectos socioemocionales comunitarios',
          dominioDisciplinar: 'Formación Socioemocional',
        };
      case 'laboral':
        return {
          metodologiaId: 'practica_laboratorio',
          razon: 'Sugerencia de Práctica de Taller / Manual Técnico para formación laboral y módulos profesionales',
          dominioDisciplinar: 'Formación para el Trabajo',
        };
    }
  }

  // ── PASO 5: Desempate Institucional por Subsistema ───────────────────────────
  if (isBt && isLaboral) {
    return {
      metodologiaId: 'practica_laboratorio',
      razon: 'Sugerencia de Práctica de Taller para formación técnica en Bachillerato Tecnológico',
      dominioDisciplinar: 'Formación Laboral Tecnológica',
    };
  }

  // Fallback Universal: ABP (Metodología eje integradora de la NEM y el PAEC)
  return {
    metodologiaId: 'abp',
    razon: 'Sugerencia integradora basada en Aprendizaje Basado en Proyectos (eje rector NEM)',
    dominioDisciplinar: 'Transversal',
  };
}

/**
 * Recomienda el ID de la metodología activa (interfaz 100% compatible con versiones previas).
 */
export function recomendarMetodologia(
  uacName: string,
  component: string,
  subsystem?: string,
  contextData?: ContextDataRecomendacion
): string {
  return recomendarMetodologiaConDetalle(uacName, component, subsystem, contextData).metodologiaId;
}

/**
 * Devuelve el objeto MetodologiaActiva completo para un nombre de UAC y contexto dados.
 */
export function obtenerMetodologiaRecomendada(
  uacName: string,
  component: string,
  subsystem?: string,
  contextData?: ContextDataRecomendacion
): MetodologiaActiva {
  const detalle = recomendarMetodologiaConDetalle(uacName, component, subsystem, contextData);
  return (
    CATALOGO_METODOLOGIAS_ACTIVAS.find((m) => m.id === detalle.metodologiaId) ??
    CATALOGO_METODOLOGIAS_ACTIVAS.find((m) => m.id === 'abp')!
  );
}
