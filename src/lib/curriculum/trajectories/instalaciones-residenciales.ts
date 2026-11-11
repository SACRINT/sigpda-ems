/**
 * instalaciones-residenciales.ts — Malla y trayectoria DAG (BGE, 2024).
 *
 * Fuente: `Instalaciones_Residenciales_2024.pdf` (SEP Puebla, Acuerdo 09/08/23),
 * páginas 16–18 (mapa de competencias) y 22–126 (UACs y procesos).
 *
 * Regla: los nombres, horas, actividades clave y ocupaciones son literales del
 * programa oficial. Los prerrequisitos y el proyecto integrador son una
 * articulación curricular explícita, validada por `trajectory-validator.ts`.
 */

import type { CurriculumTrajectory } from '../trajectory-types';

const SINCO_PLOMERIA = ['9222 — Trabajadores de apoyo en plomería e instalación de tuberías'];
const SINCO_CONSTRUCCION = [
  '9221 — Trabajadores de apoyo en la construcción',
  '9222 — Trabajadores de apoyo en plomería e instalación de tuberías',
];
const SCIAN_INSTALACIONES = [
  '238210 — Instalaciones eléctricas en construcciones',
  '238221 — Instalaciones hidrosanitarias y de gas',
];
const SCIAN_CONSTRUCCION = ['238130 — Trabajos de albañilería', ...SCIAN_INSTALACIONES];

export const INSTALACIONES_RESIDENCIALES_TRAJECTORY: CurriculumTrajectory = {
  id: 'instalaciones-residenciales-bge-2024',
  name: 'Instalaciones Residenciales',
  subsystem: 'bge',
  curriculumName: 'Formación Laboral Básico — Instalaciones Residenciales',
  generation: 'Generación 2023–2026',
  agreement: 'Acuerdo 09/08/23',
  durationSemesters: 4,
  totalUacs: 8,
  totalHours: 432,
  sourceDocument: 'Instalaciones_Residenciales_2024.pdf',
  sourcePages: '16–18 (mapa de competencias) y 22–126 (UACs)',
  nodes: [
    {
      id: 'IR-3.1',
      uacName: 'Interpreta croquis de diferentes instalaciones básicas de una vivienda',
      semester: 3,
      order: 1,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Interpreta croquis de diferentes instalaciones básicas de una vivienda.',
      keyActivities: [
        {
          id: 'IR-3.1-A1',
          name: 'Identifica instalaciones básicas de una vivienda de acuerdo con los diferentes espacios',
          hours: 18,
          contents: [
            'Instalaciones básicas de una vivienda: eléctrica, hidráulica, sanitaria y de gas',
            'Espacios de la vivienda y servicios asociados',
          ],
          description:
            'Recorrido por una vivienda para identificar instalaciones eléctrica, hidráulica, sanitaria y de gas por espacio; registro en portafolio y tabla comparativa.',
        },
        {
          id: 'IR-3.1-A2',
          name: 'Interpreta símbolos para la construcción e instalaciones hidráulicas, de gas y eléctricas',
          hours: 18,
          contents: ['Simbología de construcción e instalaciones'],
          description:
            'Investigación y comparación de simbología de construcción e instalaciones hidráulicas, de gas y eléctricas; material visual y plenaria.',
        },
        {
          id: 'IR-3.1-A3',
          name: 'Elabora croquis de construcción e instalaciones hidráulicas, de gas y eléctricas de una vivienda bajo la supervisión del experto',
          hours: 18,
          contents: [
            'Croquis, planos, escalas y dimensiones',
            'Lectura e interpretación de planos arquitectónicos',
          ],
          description:
            'Rediseño de croquis de construcción e instalaciones con espacios, dimensiones y simbología, bajo supervisión del experto.',
        },
      ],
      contents: [
        'Instalaciones básicas de una vivienda: eléctrica, hidráulica, sanitaria y de gas',
        'Espacios de la vivienda y servicios asociados',
        'Simbología de construcción e instalaciones',
        'Croquis, planos, escalas y dimensiones',
        'Lectura e interpretación de planos arquitectónicos',
      ],
      sinco: SINCO_PLOMERIA,
      scian: SCIAN_INSTALACIONES,
      prerequisites: [],
      projectMilestone: 'Diagnóstico y croquis del espacio comunitario',
    },
    {
      id: 'IR-3.2',
      uacName:
        'Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas bajo la supervisión del experto',
      semester: 3,
      order: 2,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome:
        'Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas bajo la supervisión del experto.',
      keyActivities: [
        {
          id: 'IR-3.2-A1',
          name: 'Verifica materiales de construcción acordes a las necesidades de las instalaciones hidráulicas, de gas y eléctricas',
          hours: 18,
          contents: [
            'Materiales de construcción para instalaciones hidráulicas, de gas y eléctricas',
            'Proveedores, costos y criterios de selección',
          ],
          description:
            'Registro y clasificación de materiales de construcción por instalación residencial básica, con fuentes confiables y tabla comparativa.',
        },
        {
          id: 'IR-3.2-A2',
          name: 'Cuantifica materiales como tuberías, conexiones, pegamentos, codos que son necesarios por cada instalación',
          hours: 18,
          contents: [
            'Cuantificación de tuberías, conexiones, pegamentos y codos',
            'Mezclas y proporciones de agregados',
          ],
          description:
            'Cuantificación de tuberías, conexiones, pegamentos y codos por instalación; tabla de doble entrada y costos.',
        },
        {
          id: 'IR-3.2-A3',
          name: 'Verifica calidad del material a utilizar de acuerdo con manuales hidrosanitarios, de gas y eléctricos',
          hours: 18,
          contents: ['Certificaciones, sellos y normas de calidad'],
          description:
            'Verificación de calidad y certificaciones de materiales según manuales hidrosanitarios, de gas y eléctricos.',
        },
      ],
      contents: [
        'Materiales de construcción para instalaciones hidráulicas, de gas y eléctricas',
        'Cuantificación de tuberías, conexiones, pegamentos y codos',
        'Mezclas y proporciones de agregados',
        'Certificaciones, sellos y normas de calidad',
        'Proveedores, costos y criterios de selección',
      ],
      sinco: SINCO_PLOMERIA,
      scian: SCIAN_INSTALACIONES,
      prerequisites: ['IR-3.1'],
      projectMilestone: 'Cuantificación y selección de materiales',
    },
    {
      id: 'IR-4.1',
      uacName: 'Traslada materiales constructivos hacia sitios de trabajo bajo normas de seguridad',
      semester: 4,
      order: 1,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Traslada materiales constructivos hacia sitios de trabajo bajo normas de seguridad.',
      keyActivities: [
        {
          id: 'IR-4.1-A1',
          name: 'Verifica equipo de seguridad para trasladar materiales de construcción',
          hours: 18,
          contents: ['Equipo de seguridad para construcción e instalaciones'],
          description:
            'Reconocimiento del equipo de seguridad para trabajos de albañilería y traslado de materiales; ficha y lista de cotejo.',
        },
        {
          id: 'IR-4.1-A2',
          name: 'Utiliza equipo de seguridad para cada proceso de instalación eléctrica, hidrosanitaria y de gas',
          hours: 18,
          contents: [
            'Riesgos en el traslado y almacenamiento de materiales',
            'Manejo manual de cargas y ergonomía',
          ],
          description:
            'Uso del equipo de seguridad en procesos de instalación eléctrica, hidrosanitaria y de gas; registro de accidentes e incidentes.',
        },
        {
          id: 'IR-4.1-A3',
          name: 'Transporta material con base a normas, reglamentos de seguridad y prevención de riesgos',
          hours: 18,
          contents: [
            'Normas y reglamentos de seguridad y prevención de riesgos',
            'Registro de accidentes e incidentes',
          ],
          description:
            'Transporte de materiales con base en normas, reglamentos de seguridad y prevención de riesgos.',
        },
      ],
      contents: [
        'Equipo de seguridad para construcción e instalaciones',
        'Normas y reglamentos de seguridad y prevención de riesgos',
        'Riesgos en el traslado y almacenamiento de materiales',
        'Manejo manual de cargas y ergonomía',
        'Registro de accidentes e incidentes',
      ],
      sinco: SINCO_CONSTRUCCION,
      scian: SCIAN_CONSTRUCCION,
      prerequisites: ['IR-3.2'],
      projectMilestone: 'Plan de seguridad y traslado',
    },
    {
      id: 'IR-4.2',
      uacName: 'Realiza cortes, ranuras en pisos, techos y muros en construcción e instalaciones residenciales',
      semester: 4,
      order: 2,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome:
        'Realiza cortes, ranuras en pisos, techos y muros en construcción e instalaciones residenciales.',
      keyActivities: [
        {
          id: 'IR-4.2-A1',
          name: 'Organiza equipo y herramientas por categorías y uso residencial',
          hours: 18,
          contents: ['Herramientas y equipo de albañilería e instalaciones'],
          description:
            'Clasificación de herramientas y equipo de albañilería e instalaciones por categoría y uso residencial.',
        },
        {
          id: 'IR-4.2-A2',
          name: 'Realiza cortes y ranuras para la construcción bajo las indicaciones del experto',
          hours: 18,
          contents: [
            'Cortes y ranuras en muros, pisos y techos',
            'Grietas y criterios de intervención',
          ],
          description:
            'Cortes y ranuras en muros, pisos y techos bajo indicaciones del experto; selección de herramienta y equipo.',
        },
        {
          id: 'IR-4.2-A3',
          name: 'Realiza cortes, ranuras en instalaciones hidráulicas, eléctricas y de gas bajo las indicaciones del experto',
          hours: 18,
          contents: [
            'Cortes y ranuras en instalaciones hidráulicas, eléctricas y de gas',
            'Uniones, sellado y acabados',
          ],
          description:
            'Cortes y ranuras en instalaciones hidráulicas, eléctricas y de gas bajo indicaciones del experto.',
        },
      ],
      contents: [
        'Herramientas y equipo de albañilería e instalaciones',
        'Cortes y ranuras en muros, pisos y techos',
        'Cortes y ranuras en instalaciones hidráulicas, eléctricas y de gas',
        'Uniones, sellado y acabados',
        'Grietas y criterios de intervención',
      ],
      sinco: SINCO_CONSTRUCCION,
      scian: SCIAN_CONSTRUCCION,
      prerequisites: ['IR-4.1', 'IR-3.1'],
      projectMilestone: 'Habilitación de cortes y ranuras',
    },
    {
      id: 'IR-5.1',
      uacName: 'Limpia muebles, tuberías y conexiones para llevar a cabo diferentes instalaciones de una vivienda',
      semester: 5,
      order: 1,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome:
        'Limpia muebles, tuberías y conexiones para llevar a cabo diferentes instalaciones de una vivienda.',
      keyActivities: [
        {
          id: 'IR-5.1-A1',
          name: 'Considera formas y manejo de los muebles, tuberías y conexiones para la construcción e instalaciones residenciales',
          hours: 18,
          contents: [
            'Muebles, tuberías y conexiones: formas y manejo',
            'Áreas y zonas de trabajo para instalaciones',
          ],
          description:
            'Reconocimiento de formas y manejo de muebles, tuberías y conexiones; tendido de redes residenciales y portafolio.',
        },
        {
          id: 'IR-5.1-A2',
          name: 'Clasifica materiales de plomería, hidráulica e instalaciones de gas de acuerdo con las dimensiones de la vivienda y los muebles',
          hours: 18,
          contents: ['Materiales de plomería, hidráulica y gas'],
          description:
            'Clasificación de materiales de plomería, hidráulica y gas según dimensiones de la vivienda y muebles.',
        },
        {
          id: 'IR-5.1-A3',
          name: 'Utiliza materiales y equipo para la limpieza de muebles, tuberías y conexiones',
          hours: 18,
          contents: [
            'Limpieza de muebles, tuberías y conexiones',
            'Productos de limpieza y medidas de seguridad',
          ],
          description:
            'Uso de materiales y equipo para la limpieza de muebles, tuberías y conexiones; productos y seguridad.',
        },
      ],
      contents: [
        'Muebles, tuberías y conexiones: formas y manejo',
        'Áreas y zonas de trabajo para instalaciones',
        'Materiales de plomería, hidráulica y gas',
        'Limpieza de muebles, tuberías y conexiones',
        'Productos de limpieza y medidas de seguridad',
      ],
      sinco: SINCO_PLOMERIA,
      scian: SCIAN_INSTALACIONES,
      prerequisites: ['IR-4.2', 'IR-3.1', 'IR-3.2'],
      projectMilestone: 'Limpieza y preparación de muebles, tuberías y conexiones',
    },
    {
      id: 'IR-5.2',
      uacName: 'Coloca elementos constructivos básicos de una vivienda',
      semester: 5,
      order: 2,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Coloca elementos constructivos básicos de una vivienda.',
      keyActivities: [
        {
          id: 'IR-5.2-A1',
          name: 'Reúne elementos constructivos básicos de una vivienda',
          hours: 18,
          contents: [
            'Elementos constructivos básicos: cimentación, cadenas, castillos, muros, losas y acabados',
            'Agregados: arena, cemento, grava, mortero y agua',
          ],
          description:
            'Identificación de elementos constructivos básicos: cimentación, cadenas, castillos, muros, losas y acabados.',
        },
        {
          id: 'IR-5.2-A2',
          name: 'Traslada materiales requeridos al sitio de la obra',
          hours: 18,
          contents: [
            'Procesos de construcción de una vivienda',
            'Traslado de materiales al sitio de la obra',
          ],
          description:
            'Análisis de agregados y traslado de materiales requeridos al sitio de la obra.',
        },
        {
          id: 'IR-5.2-A3',
          name: 'Instala muebles y accesorios de acuerdo con lo especificado en el plano',
          hours: 18,
          contents: ['Instalación de muebles y accesorios según plano'],
          description:
            'Instalación de muebles y accesorios de acuerdo con lo especificado en el plano.',
        },
      ],
      contents: [
        'Elementos constructivos básicos: cimentación, cadenas, castillos, muros, losas y acabados',
        'Agregados: arena, cemento, grava, mortero y agua',
        'Procesos de construcción de una vivienda',
        'Traslado de materiales al sitio de la obra',
        'Instalación de muebles y accesorios según plano',
      ],
      sinco: SINCO_PLOMERIA,
      scian: SCIAN_INSTALACIONES,
      prerequisites: ['IR-4.1', 'IR-4.2', 'IR-3.2'],
      projectMilestone: 'Colocación de elementos constructivos básicos',
    },
    {
      id: 'IR-6.1',
      uacName: 'Coloca muebles, tuberías y conexiones de acuerdo con instrucciones',
      semester: 6,
      order: 1,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Coloca muebles, tuberías y conexiones de acuerdo con instrucciones.',
      keyActivities: [
        {
          id: 'IR-6.1-A1',
          name: 'Clasifica instalaciones sustentables de electricidad, hidrosanitarias y de gas',
          hours: 18,
          contents: ['Instalaciones residenciales sustentables: hidrosanitaria, eléctrica y gas'],
          description:
            'Clasificación de instalaciones residenciales sustentables de electricidad, hidrosanitarias y de gas.',
        },
        {
          id: 'IR-6.1-A2',
          name: 'Verifica viabilidad del espacio para la instalación sustentable',
          hours: 18,
          contents: [
            'Viabilidad del espacio y criterios de sustentabilidad',
            'Documentación técnica y especificaciones',
          ],
          description:
            'Verificación de viabilidad del espacio para la instalación sustentable; recorrido y lista de cotejo.',
        },
        {
          id: 'IR-6.1-A3',
          name: 'Elabora croquis de la instalación residencial sustentable',
          hours: 18,
          contents: [
            'Croquis de la instalación residencial sustentable',
            'Colocación de muebles, tuberías y conexiones',
          ],
          description:
            'Elaboración de croquis de la instalación residencial sustentable con dimensiones y especificaciones.',
        },
      ],
      contents: [
        'Instalaciones residenciales sustentables: hidrosanitaria, eléctrica y gas',
        'Viabilidad del espacio y criterios de sustentabilidad',
        'Croquis de la instalación residencial sustentable',
        'Colocación de muebles, tuberías y conexiones',
        'Documentación técnica y especificaciones',
      ],
      sinco: SINCO_PLOMERIA,
      scian: SCIAN_INSTALACIONES,
      prerequisites: ['IR-5.1', 'IR-5.2', 'IR-3.1'],
      projectMilestone: 'Instalación sustentable de muebles, tuberías y conexiones',
    },
    {
      id: 'IR-6.2',
      uacName: 'Recupera materiales de construcción para su reúso',
      semester: 6,
      order: 2,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Recupera materiales de construcción para su reúso.',
      keyActivities: [
        {
          id: 'IR-6.2-A1',
          name: 'Clasifica material sobrante durante la construcción o instalación residencial',
          hours: 18,
          contents: [
            'Clasificación de material sobrante de construcción e instalación',
            'Economía circular en la construcción',
          ],
          description:
            'Clasificación del material sobrante durante la construcción o instalación residencial; las tres R.',
        },
        {
          id: 'IR-6.2-A2',
          name: 'Registra material sobrante en una bitácora, acorde con especificaciones del especialista',
          hours: 18,
          contents: ['Bitácora de material sobrante'],
          description:
            'Registro del material sobrante en bitácora conforme a las especificaciones del especialista.',
        },
        {
          id: 'IR-6.2-A3',
          name: 'Reutiliza material sobrante de manera sustentable',
          hours: 18,
          contents: [
            'Reutilización y reciclaje: las tres R',
            'Disposición final de residuos',
          ],
          description:
            'Reutilización del material sobrante de manera sustentable; diseño e innovación.',
        },
      ],
      contents: [
        'Clasificación de material sobrante de construcción e instalación',
        'Bitácora de material sobrante',
        'Reutilización y reciclaje: las tres R',
        'Economía circular en la construcción',
        'Disposición final de residuos',
      ],
      sinco: SINCO_PLOMERIA,
      scian: SCIAN_INSTALACIONES,
      prerequisites: ['IR-5.2', 'IR-6.1'],
      projectMilestone: 'Recuperación y reúso de material sobrante',
    },
  ],
  project: {
    name: 'Taller Comunitario de Instalaciones Residenciales Sustentables',
    description:
      'Proyecto integrador de dos años que articula las ocho UAC en la mejora de un espacio comunitario real, con instalación residencial básica documentada, segura y sustentable.',
    finalProduct:
      'Espacio comunitario con instalación residencial básica (hidrosanitaria, eléctrica y de gas) documentada, segura y con recuperación de material sobrante.',
    milestones: [
      {
        semester: 3,
        title: 'Diagnóstico y croquis del espacio comunitario',
        description:
          'Levantamiento de instalaciones y espacios, interpretación de simbología y cuantificación de materiales necesarios.',
        linkedUacs: ['IR-3.1', 'IR-3.2'],
        evidence: 'Croquis con simbología, tabla de instalaciones y cuantificación de materiales.',
      },
      {
        semester: 4,
        title: 'Preparación segura y habilitación del espacio',
        description:
          'Plan de seguridad y traslado de materiales, organización de herramientas y ejecución de cortes y ranuras.',
        linkedUacs: ['IR-4.1', 'IR-4.2'],
        evidence: 'Checklist de EPP, plan de traslado y registro fotográfico de cortes y ranuras.',
      },
      {
        semester: 5,
        title: 'Acondicionamiento y colocación de elementos constructivos',
        description:
          'Limpieza y preparación de muebles, tuberías y conexiones, y colocación de elementos constructivos básicos.',
        linkedUacs: ['IR-5.1', 'IR-5.2'],
        evidence: 'Bitácora de limpieza, elementos constructivos colocados y muebles/accesorios instalados.',
      },
      {
        semester: 6,
        title: 'Instalación sustentable y recuperación de sobrantes',
        description:
          'Colocación de muebles, tuberías y conexiones con criterios de sustentabilidad, y recuperación de material sobrante.',
        linkedUacs: ['IR-6.1', 'IR-6.2'],
        evidence: 'Croquis de instalación sustentable, instalación colocada y bitácora de reúso.',
      },
    ],
  },
};
