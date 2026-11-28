/**
 * editorial-scenes-catalog.ts — Catálogo Maestro Tipado de 68 Escenas Arquetipo (17 dominios × 4)
 * SIGPDA-EMS · Fase 2 Motor Editorial Unificado (Libros Typst + DOCX + 08 + 09)
 *
 * Fuente de verdad:
 * - Dominios: unión exacta `DisciplinaryDomainId` (`src/lib/prompts/disciplinary-adapters/index.ts:16-33`).
 * - Producción visual: `docs/CATALOGO_MAESTRO_ESCENAS_ARQUETIPO_NANOBANANA.md`.
 *
 * Si se añade un nuevo dominio a `DisciplinaryDomainId`, TypeScript exige registrar
 * sus 4 arquetipos en `EDITORIAL_SCENES_CATALOG` en tiempo de compilación.
 */

import type { DisciplinaryDomainId } from '@/lib/prompts/disciplinary-adapters';

export type EditorialSceneArchetype = 'portada' | 'concepto' | 'practica' | 'comunidad';

export type EditorialSceneRole =
  | 'block_cover'
  | 'mission_1'
  | 'mission_2'
  | 'mission_3'
  | 'mission_4'
  | 'slides_hero'
  | 'slides_concept'
  | 'infographic_activity';

export type EditorialSceneCrop =
  | 'full'
  | 'top_band'
  | 'horizontal_editorial'
  | 'detail_right';

export interface EditorialSceneEntry {
  id: string;
  domainId: DisciplinaryDomainId;
  archetype: EditorialSceneArchetype;
  filename: string;
  /** Ruta relativa bajo `public/` (siempre inicia con `/images/escenas/`). */
  relativePath: string;
  aspectRatio: '16:9' | '4:5';
  width: number;
  height: number;
  alt: string;
  lot: 1 | 2 | 3;
  /** Etiquetas semánticas del contenido visual real del asset (evita mezclar hardware/protoboard con ofimática o ciudadanía). */
  visualTags?: readonly string[];
}

export type DomainSceneSet = Record<EditorialSceneArchetype, EditorialSceneEntry>;

export const EDITORIAL_SCENES_BASE_PATH = '/images/escenas';
export const EDITORIAL_SCENES_OVERRIDES_PATH = '/images/escenas/overrides';

function makeDomainSet(
  domainId: DisciplinaryDomainId,
  prefix: string,
  lot: 1 | 2 | 3,
  alts: Record<EditorialSceneArchetype, string>,
): DomainSceneSet {
  const build = (
    archetype: EditorialSceneArchetype,
    num: string,
    aspectRatio: '16:9' | '4:5',
  ): EditorialSceneEntry => {
    const id = `${prefix}-${num}-${archetype}`;
    const filename = `${id}.webp`;
    return {
      id,
      domainId,
      archetype,
      filename,
      relativePath: `${EDITORIAL_SCENES_BASE_PATH}/${domainId}/${filename}`,
      aspectRatio,
      width: aspectRatio === '16:9' ? 1600 : 1200,
      height: aspectRatio === '16:9' ? 900 : 1500,
      alt: alts[archetype],
      lot,
    };
  };

  return {
    portada: build('portada', '01', '16:9'),
    concepto: build('concepto', '02', '16:9'),
    practica: build('practica', '03', '4:5'),
    comunidad: build('comunidad', '04', '16:9'),
  };
}

export const EDITORIAL_SCENES_CATALOG: Record<DisciplinaryDomainId, DomainSceneSet> = {
  pensamiento_matematico: makeDomainSet('pensamiento_matematico', 'mat', 1, {
    portada: 'Estudiantes aplicando medición geométrica en el patio escolar',
    concepto: 'Instrumentos geométricos y curva matemática sobre mesa de estudio',
    practica: 'Estudiante trabajando con calculadora e instrumentos geométricos',
    comunidad: 'Equipo estudiantil recabando datos estadísticos en su comunidad',
  }),
  ciencias_fisica_ingenieria: makeDomainSet('ciencias_fisica_ingenieria', 'fis', 1, {
    portada: 'Estudiantes experimentando con un plano inclinado y poleas en laboratorio',
    concepto: 'Prisma óptico, imán y bobina ilustrando fenómenos físicos',
    practica: 'Estudiante armando un circuito eléctrico con panel solar en mesa de pruebas',
    comunidad: 'Estudiantes evaluando prototipos de energía solar y eólica en su plantel',
  }),
  ciencias_quimica_biologia_ambiental: makeDomainSet('ciencias_quimica_biologia_ambiental', 'bio', 1, {
    portada: 'Estudiantes analizando muestras en laboratorio de biología y química',
    concepto: 'Modelo molecular, placas de Petri y material de laboratorio',
    practica: 'Estudiante realizando una titulación química controlada',
    comunidad: 'Estudiantes realizando monitoreo ambiental de agua y flora comunitaria',
  }),
  lengua_comunicacion_literatura: makeDomainSet('lengua_comunicacion_literatura', 'lit', 1, {
    portada: 'Estudiantes dialogando en círculo de lectura en biblioteca escolar',
    concepto: 'Libro abierto, pluma y tarjetas de análisis textual sobre escritorio',
    practica: 'Estudiante realizando exposición oral argumentada ante su grupo',
    comunidad: 'Estudiantes entrevistando a un miembro de la comunidad para crónica local',
  }),
  lengua_extranjera_ingles: makeDomainSet('lengua_extranjera_ingles', 'eng', 2, {
    portada: 'Estudiantes practicando conversación en lengua extranjera con apoyo multimedia',
    concepto: 'Equipo de audio y recursos visuales para práctica de idiomas',
    practica: 'Estudiante realizando práctica auditiva y toma de notas',
    comunidad: 'Estudiantes practicando comunicación intercultural en un espacio cultural local',
  }),
  lengua_extranjera_general: makeDomainSet('lengua_extranjera_general', 'lex', 3, {
    portada: 'Estudiantes en práctica comunicativa intercultural en aula de idiomas',
    concepto: 'Recursos visuales de viaje y comunicación plurilingüe',
    practica: 'Pareja de estudiantes realizando juego de rol comunicativo',
    comunidad: 'Muestra de intercambio cultural y diversidad lingüística en plantel',
  }),
  conciencia_historica_ciencias_sociales: makeDomainSet('conciencia_historica_ciencias_sociales', 'his', 1, {
    portada: 'Estudiantes analizando fuentes cartográficas y documentales',
    concepto: 'Símbolos editoriales de historia, territorio, sociedad y derecho',
    practica: 'Estudiantes organizando evidencias históricas y argumentos sociales',
    comunidad: 'Participación cívica y análisis territorial en la comunidad',
  }),
  humanidades_filosofia_logica_etica: makeDomainSet('humanidades_filosofia_logica_etica', 'fil', 1, {
    portada: 'Círculo de diálogo filosófico entre estudiantes al aire libre',
    concepto: 'Objetos simbólicos de reflexión filosófica, ética y lógica',
    practica: 'Estudiantes practicando escucha activa y análisis argumentativo',
    comunidad: 'Foro escolar y comunitario de reflexión ética',
  }),
  cultura_digital_programacion_ti: (() => {
    const base = makeDomainSet('cultura_digital_programacion_ti', 'tic', 2, {
      portada: 'Estudiantes diseñando algoritmos y soluciones digitales en aula',
      concepto: 'Componentes de pensamiento computacional y ciudadanía digital',
      practica: 'Estudiante programando y probando un prototipo tecnológico',
      comunidad: 'Taller comunitario de alfabetización y seguridad digital',
    });
    return {
      portada: {
        ...base.portada,
        visualTags: ['hardware', 'protoboard', 'electronica', 'arquitectura'],
      },
      concepto: {
        ...base.concepto,
        visualTags: ['hardware', 'protoboard', 'electronica', 'circuitos'],
      },
      practica: {
        ...base.practica,
        visualTags: ['software', 'programacion', 'practica'],
      },
      comunidad: {
        ...base.comunidad,
        visualTags: [
          'comunidad',
          'ciudadania',
          'alfabetizacion_digital',
          'colaboracion',
          'socializacion',
        ],
      },
    };
  })(),
  dibujo_tecnico_diseno_arquitectura: makeDomainSet('dibujo_tecnico_diseno_arquitectura', 'dib', 3, {
    portada: 'Estudiante elaborando trazo geométrico en restirador técnico',
    concepto: 'Herramientas de dibujo técnico y maqueta arquitectónica básica',
    practica: 'Construcción de maqueta a escala en taller de diseño',
    comunidad: 'Presentación de proyecto de diseño de espacio comunitario',
  }),
  actividades_fisicas_deportivas_salud: makeDomainSet('actividades_fisicas_deportivas_salud', 'efd', 2, {
    portada: 'Estudiantes realizando calentamiento guiado en cancha escolar',
    concepto: 'Equipo básico de acondicionamiento físico e hidratación',
    practica: 'Estudiantes realizando circuito de coordinación y control motriz',
    comunidad: 'Jornada comunitaria de activación física y deporte cooperativo',
  }),
  artes_educacion_artistica_cultural: makeDomainSet('artes_educacion_artistica_cultural', 'art', 2, {
    portada: 'Estudiantes creando obra artística en taller escolar de artes',
    concepto: 'Materiales de artes visuales, música y expresión escénica',
    practica: 'Estudiante desarrollando una pieza práctica en taller artístico',
    comunidad: 'Muestra artística y cultural estudiantil abierta a la comunidad',
  }),
  socioemocional_tutoria_educacion_integral: makeDomainSet('socioemocional_tutoria_educacion_integral', 'soc', 2, {
    portada: 'Sesión de tutoría socioemocional y escucha empática en grupo',
    concepto: 'Elementos visuales de autocuidado, equilibrio emocional y salud integral',
    practica: 'Estudiantes elaborando un plan visual de bienestar y autocuidado',
    comunidad: 'Jóvenes participando en jornada comunitaria solidaria',
  }),
  formacion_laboral_servicios_gestion_turismo: makeDomainSet(
    'formacion_laboral_servicios_gestion_turismo',
    'srv',
    3,
    {
      portada: 'Estudiantes gestionando procesos administrativos y de servicios',
      concepto: 'Instrumentos de gestión administrativa, contable y turística',
      practica: 'Estudiante aplicando estándares de calidad en taller de servicios',
      comunidad: 'Feria estudiantil de emprendimiento y servicios comunitarios',
    },
  ),
  formacion_laboral_salud_clinica: makeDomainSet('formacion_laboral_salud_clinica', 'sal', 3, {
    portada: 'Práctica supervisada de signos vitales en aula clínica escolar',
    concepto: 'Instrumental básico de bioseguridad y valoración clínica',
    practica: 'Estudiante aplicando protocolo de bioseguridad y primeros auxilios',
    comunidad: 'Brigada estudiantil de prevención y educación para la salud comunitaria',
  }),
  formacion_laboral_industrial_agro_salud: makeDomainSet('formacion_laboral_industrial_agro_salud', 'ind', 3, {
    portada: 'Estudiantes con equipo de protección trabajando en taller técnico',
    concepto: 'Herramientas de precisión y equipo de protección personal en taller',
    practica: 'Estudiante ejecutando medición y ensamble en práctica de taller',
    comunidad: 'Proyecto técnico comunitario de captación pluvial y cultivo sostenible',
  }),
  indagacion_interdisciplinaria_general: makeDomainSet('indagacion_interdisciplinaria_general', 'gen', 2, {
    portada: 'Equipo interdisciplinario colaborando en proyecto integrador escolar',
    concepto: 'Símbolos editoriales de indagación y pensamiento interdisciplinario',
    practica: 'Estudiantes estructurando un proyecto de investigación colaborativa',
    comunidad: 'Feria escolar comunitaria de proyectos integradores PAEC',
  }),
};

export const EDITORIAL_SCENES_THEMATIC_VARIANTS: Partial<
  Record<DisciplinaryDomainId, readonly EditorialSceneEntry[]>
> = {
  cultura_digital_programacion_ti: [
    {
      id: 'tic-07-software-datos',
      domainId: 'cultura_digital_programacion_ti',
      archetype: 'concepto',
      filename: 'tic-07-software-datos.webp',
      relativePath: `${EDITORIAL_SCENES_BASE_PATH}/cultura_digital_programacion_ti/tic-07-software-datos.webp`,
      aspectRatio: '16:9',
      width: 1600,
      height: 900,
      alt: 'Escritorio escolar con laptop mostrando hoja de cálculo y gráficas junto a tableta con diagrama de flujo',
      lot: 2,
      visualTags: [
        'software',
        'sistemas_operativos',
        'hoja_calculo',
        'datos',
        'diagrama_flujo',
        'algoritmo',
        'resolucion_problemas',
      ],
    },
    {
      id: 'tic-08-ciudadania-seguridad',
      domainId: 'cultura_digital_programacion_ti',
      archetype: 'comunidad',
      filename: 'tic-08-ciudadania-seguridad.webp',
      relativePath: `${EDITORIAL_SCENES_BASE_PATH}/cultura_digital_programacion_ti/tic-08-ciudadania-seguridad.webp`,
      aspectRatio: '16:9',
      width: 1600,
      height: 900,
      alt: 'Estudiantes de bachillerato colaborando en biblioteca escolar con laptop de seguridad y ciudadanía digital',
      lot: 2,
      visualTags: [
        'ciudadania',
        'privacidad',
        'seguridad',
        'software_libre',
        'licencias',
      ],
    },
    {
      id: 'tic-09-redes-flujos',
      domainId: 'cultura_digital_programacion_ti',
      archetype: 'concepto',
      filename: 'tic-09-redes-flujos.webp',
      relativePath: `${EDITORIAL_SCENES_BASE_PATH}/cultura_digital_programacion_ti/tic-09-redes-flujos.webp`,
      aspectRatio: '16:9',
      width: 1600,
      height: 900,
      alt: 'Mesa técnica de conectividad digital con switch de red, cableado estructurado y cuaderno con diagrama de flujo',
      lot: 2,
      visualTags: [
        'historia_digital',
        'corporaciones',
        'redes',
        'diagrama_flujo',
        'algoritmo',
        'operadores',
        'resolucion_problemas',
        'software_libre',
        'navegadores',
      ],
    },
  ],
};

export function listDomainLandscapeCandidates(domainId: DisciplinaryDomainId): EditorialSceneEntry[] {
  const base = EDITORIAL_SCENES_CATALOG[domainId];
  const variants = (EDITORIAL_SCENES_THEMATIC_VARIANTS[domainId] ?? []).filter(
    (v) => v.aspectRatio === '16:9',
  );
  return [base.portada, base.concepto, base.comunidad, ...variants];
}

export function listAllEditorialScenes(): EditorialSceneEntry[] {
  return Object.values(EDITORIAL_SCENES_CATALOG).flatMap((set) => [
    set.portada,
    set.concepto,
    set.practica,
    set.comunidad,
  ]);
}
