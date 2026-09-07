/**
 * Recomendador Automático de Metodologías Activas — SIGPDA-EMS
 *
 * Función pura (sin BD, sin IA) que recomienda la metodología activa
 * más adecuada para una UAC dado su nombre y componente curricular.
 *
 * Criterios basados en el catálogo de 8 metodologías MCCEMS 2025 / NEM.
 * El docente siempre puede sobrescribir la sugerencia en el wizard.
 */

import { CATALOGO_METODOLOGIAS_ACTIVAS, type MetodologiaActiva } from '@/lib/catalogo-metodologias';

// ─── Reglas de recomendación (orden importa: primera coincidencia gana) ───────

interface ReglaRecomendacion {
  /** ID de metodología a recomendar */
  metodologiaId: string;
  /** Palabras clave en el nombre de la UAC (case-insensitive) */
  keywordsUac?: string[];
  /** Componentes curriculares que activan esta regla */
  components?: string[];
  /** Subsistemas que favorecen esta regla */
  subsystems?: string[];
}

const REGLAS: ReglaRecomendacion[] = [
  // ── Formación Laboral (módulos/submódulos técnicos) → Práctica de Taller ────
  {
    metodologiaId: 'practica_laboratorio',
    components: ['laboral'],
  },
  // ── Programación, Sistemas, TI → ABR (Aprendizaje Basado en Retos) ──────────
  {
    metodologiaId: 'abr',
    keywordsUac: [
      'programación', 'programacion', 'software', 'código', 'codigo',
      'redes', 'sistemas operativos', 'base de datos', 'web', 'app',
      'algoritmos', 'javascript', 'python', 'java', 'machine learning',
      'inteligencia artificial', 'ia ', 'ciberseguridad', 'cloud',
    ],
  },
  // ── Electrónica, Mecatrónica, Taller, Agropecuaria → Práctica de Taller ─────
  {
    metodologiaId: 'practica_laboratorio',
    keywordsUac: [
      'electr', 'mecatr', 'soldad', 'tornería', 'torneria', 'instalaciones',
      'automotr', 'refriger', 'aire acondicionado', 'construcción', 'construccion',
      'agropec', 'ganadería', 'ganaderia', 'agricultura', 'laboratorio',
      'taller', 'mantenimiento', 'maquinaria', 'metalmecánica', 'metalmecanic',
    ],
  },
  // ── Ciencias Naturales → STEAM ───────────────────────────────────────────────
  {
    metodologiaId: 'steam',
    keywordsUac: [
      'química', 'quimica', 'física', 'fisica', 'biología', 'biologia',
      'ecología', 'ecologia', 'ciencias naturales', 'la materia',
      'conservación de la energía', 'energia', 'cambio climático',
    ],
  },
  // ── Matemáticas → Aula Invertida ────────────────────────────────────────────
  {
    metodologiaId: 'aula_invertida',
    keywordsUac: [
      'matemátic', 'matematik', 'álgebra', 'algebra', 'cálculo', 'calculo',
      'estadística', 'estadistica', 'probabilidad', 'trigonometría',
      'pensamiento matemático', 'pensamiento logico',
    ],
  },
  // ── Inglés / Comunicación / Lengua Extranjera → Gamificación ────────────────
  {
    metodologiaId: 'gamificacion',
    keywordsUac: [
      'inglés', 'ingles', 'lengua extranjera', 'idioma', 'comunicación',
      'comunicacion', 'lengua y comunicación', 'lectura', 'escritura',
      'redacción', 'redaccion', 'expresión oral', 'literatur',
    ],
  },
  // ── Ciencias Sociales, Historia, Ética, Derecho → Estudio de Casos ──────────
  {
    metodologiaId: 'estudio_casos',
    keywordsUac: [
      'ciencias social', 'historia', 'ética', 'etica', 'derecho',
      'filosofía', 'filosofia', 'humanidades', 'sociedad', 'política',
      'politica', 'economía', 'economia', 'conciencia histórica',
      'pensamiento filosófico', 'pensamiento humanístico',
    ],
  },
  // ── Formación para el Trabajo, Servicio Comunitario → ApS ───────────────────
  {
    metodologiaId: 'aprendizaje_servicio',
    keywordsUac: [
      'formación para el trabajo', 'formacion para el trabajo',
      'habilidades para la vida', 'servicio', 'comunitaria',
      'proyectos comunitarios', 'paec', 'pips', 'vinculación',
      'vinculacion', 'prácticas profesionales', 'practicas profesionales',
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

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Recomienda una metodología activa dado el nombre de la UAC, el componente
 * curricular y opcionalmente el subsistema.
 *
 * @returns ID de la metodología recomendada (siempre uno del catálogo)
 */
export function recomendarMetodologia(
  uacName: string,
  component: string,
  _subsystem?: string
): string {
  const uacLower = uacName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const componentLower = component.toLowerCase();

  for (const regla of REGLAS) {
    // Verificar componente curricular primero (mayor prioridad)
    if (regla.components && !regla.components.includes(componentLower)) {
      // Si la regla tiene restricción de componente y no coincide, saltamos
      // EXCEPTO si también tiene keywords (regla mixta)
      if (!regla.keywordsUac) continue;
    }

    // Si la regla requiere componente específico y coincide (y no tiene keywords), usar directamente
    if (regla.components?.includes(componentLower) && !regla.keywordsUac) {
      return regla.metodologiaId;
    }

    // Verificar palabras clave en el nombre de la UAC
    if (regla.keywordsUac) {
      const uacNorm = uacLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const match = regla.keywordsUac.some(kw =>
        uacNorm.includes(kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      );
      if (match) return regla.metodologiaId;
    }
  }

  // Default: ABP (metodología más versátil y general)
  return 'abp';
}

/**
 * Devuelve el objeto MetodologiaActiva completo para un ID dado.
 * Si el ID no existe, devuelve la metodología por defecto (ABP).
 */
export function obtenerMetodologiaRecomendada(
  uacName: string,
  component: string,
  subsystem?: string
): MetodologiaActiva {
  const id = recomendarMetodologia(uacName, component, subsystem);
  return (
    CATALOGO_METODOLOGIAS_ACTIVAS.find(m => m.id === id) ??
    CATALOGO_METODOLOGIAS_ACTIVAS.find(m => m.id === 'abp')!
  );
}
