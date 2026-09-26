/**
 * src/lib/catalogo-metas-pmc.ts
 *
 * Catálogo Canónico Oficial de Metas Institucionales y Normativa Aplicable para el PMC
 * Basado estrictamente en:
 * - "5.2 FORMATO FINAL PARA PLANEACIÓN DE LA MEJORA CONTINUA 2025-2026.docx" (Subcategorías Literales)
 * - Base de datos de Normativa SEP/Puebla (28 documentos vigentes)
 * - Criterio C3 de Supervisión Escolar: Ficha de Aplicabilidad Normativa en el Plantel
 */

import type { MetaCatalogEntry } from '@/types/pmc';

export const SUBCATEGORIAS_OFICIALES_52 = [
  // CATEGORÍA 1 "DESARROLLO ACADÉMICO Y APRENDIZAJE"
  'FORMACIÓN Y ACTUALIZACIÓN DOCENTE',
  'PROPUESTAS PEDAGÓGICAS',
  'TRABAJO COLEGIADO',
  'PROYECTO ESCOLAR COMUNITARIO (PEC)',
  'CLUBES DE LECTURA',
  'INDICADORES ACADÉMICOS',
  'ORIENTACIÓN Y TUTORÍA',
  'PLANEACIÓN DIDÁCTICA',
  'OTRAS ACTIVIDADES ACADÉMICAS',

  // CATEGORÍA 2 "GESTIÓN Y ADMINISTRACIÓN ESCOLAR"
  'VINCULACIÓN CON INSTITUCIONES EDUCATIVAS',
  'VINCULACIÓN CON EMPRESAS, FUNDACIONES E INSTITUCIONES PÚBLICAS',
  'GESTIÓN Y ADMINISTRACIÓN DE RECURSOS, EQUIPAMIENTOS Y SERVICIOS',
  'SEGUIMIENTO AL DESEMPEÑO DOCENTE EN EL AULA',
  'SEGUIMIENTO DE EGRESADOS',

  // CATEGORÍA 3 "DESARROLLO SOCIOEMOCIONAL Y PREVENCIÓN DE LA VIOLENCIA EN LA ESCUELA"
  'ÁMBITOS DE FORMACIÓN SOCIOEMOCIONAL (CURRÍCULUM AMPLIADO)',
  'PREVENCIÓN DE LA VIOLENCIA EN LA ESCUELA',
  'ORIENTACIÓN EDUCATIVA',
] as const;

export const CATEGORIAS_OFICIALES_52 = [
  'Desarrollo académico y aprendizaje',
  'Gestión y administración escolar',
  'Desarrollo socioemocional y prevención de la violencia en la escuela',
] as const;

export const CATALOGO_METAS_CANONICO: MetaCatalogEntry[] = [
  // ── CATEGORÍA 1: DESARROLLO ACADÉMICO Y APRENDIZAJE ─────────────────────────
  {
    id: 'meta-formacion-docente-mccems',
    nombre: 'Capacitación docente continua en el MCCEMS',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'FORMACIÓN Y ACTUALIZACIÓN DOCENTE',
    articulos: ['LGSCMM-Art.4', 'Mejora-Continua-Art.16', 'Acuerdo-14/08/22-LineamientoGeneral'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Fundamenta el derecho y la obligación de las maestras y maestros de acceder a programas de capacitación situada sobre progresiones de aprendizaje del MCCEMS, evaluación formativa y metodologías sociocríticas, elevando la calidad pedagógica del plantel.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Constancias de cursos de actualización docente y minutas de academia colegiada',
    orden_display: 1,
  },
  {
    id: 'meta-propuestas-pedagogicas-innovacion',
    nombre: 'Innovación didáctica y proyectos transversales situados',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'PROPUESTAS PEDAGÓGICAS',
    articulos: ['Acuerdo-14/08/22-ComponenteCurricular', 'Lineamientos-PMC-2025-Lineamiento3'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'recomendada',
      justificacion: 'Impulsa el diseño de estrategias contextualizadas de aprendizaje activo (ABProyecto, ABP, Estudio de Casos) que articulen los recursos sociocognitivos y áreas de conocimiento a las problemáticas comunitarias.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Portafolio de propuestas didácticas transversales aprobadas por el Consejo Académico',
    orden_display: 2,
  },
  {
    id: 'meta-trabajo-colegiado-academias',
    nombre: 'Fortalecimiento de Academias y Trabajo Colegiado',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'TRABAJO COLEGIADO',
    articulos: ['LGSCMM-Art.69', 'Lineamientos-PMC-2025-Lineamiento2', 'LGE-Art.14'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Norma las reuniones ordinarias de academia por área de conocimiento para homologar criterios de evaluación formativa, intercambio de materiales y diseño de intervenciones ante el rezago académico.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Actas de sesiones colegiadas bimestrales y bitácora de acuerdos de autonomía curricular',
    orden_display: 3,
  },
  {
    id: 'meta-pec-comunidad-paec',
    nombre: 'Implementación del Proyecto Escolar Comunitario (PEC/PAEC)',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'PROYECTO ESCOLAR COMUNITARIO (PEC)',
    articulos: ['CPEUM-Art.3', 'Lineamientos-PAEC-2026-Lineamiento1', 'LGE-Art.14'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Asegura la integración del plantel con su entorno territorial mediante proyectos socioformativos que involucren a estudiantes, docentes y actores comunitarios para transformar problemáticas de la comunidad.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Documento rector del PAEC validado en plataforma y reporte de impacto comunitario',
    orden_display: 4,
  },
  {
    id: 'meta-clubes-lectura-estrategia',
    nombre: 'Fomento a la lectura y expresión comunicativa',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'CLUBES DE LECTURA',
    articulos: ['Ley-Fomento-Lectura-Art.10', 'Acuerdo-14/08/22-LineamientoGeneral', 'LGE-Art.18'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'recomendada',
      justificacion: 'Desarrolla el recurso sociocognitivo de Lengua y Comunicación mediante círculos de lectura, análisis de textos y producción escrita crítica, favoreciendo el desempeño académico transversal.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Registro de clubes de lectura escolares y antología de textos elaborados por estudiantes',
    orden_display: 5,
  },
  {
    id: 'meta-indicadores-reprobacion-rezago',
    nombre: 'Reducción de índices de reprobación en asignaturas críticas',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'INDICADORES ACADÉMICOS',
    articulos: ['CPEUM-Art.3', 'Lineamientos-PMC-2025-Lineamiento4', 'LGE-Art.16'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Sustenta la obligación de la escuela de diagnosticar semestralmente los cortes de acreditación (F11C) y desplegar tutorías académicas y asesorías específicas para disminuir el porcentaje de reprobación.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Reporte semestral de seguimiento estadístico F11C y listas de asistencia a asesorías',
    orden_display: 6,
  },
  {
    id: 'meta-orientacion-tutoria-integral',
    nombre: 'Sistema integral de tutoría y acompañamiento pedagógico',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'ORIENTACIÓN Y TUTORÍA',
    articulos: ['LGE-Art.18', 'Lineamientos-PMC-2025-Lineamiento2', 'Acuerdo-14/08/22-LineamientoGeneral'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Garantiza la designación de tutores grupales e individuales para dar seguimiento oportuno a estudiantes en riesgo de abandono escolar, atendiendo rezagos y canalizando necesidades específicas.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Plan de acción tutorial por grupo y fichas de seguimiento personalizado',
    orden_display: 7,
  },
  {
    id: 'meta-planeacion-didactica-alineada',
    nombre: 'Codiseño de planeaciones didácticas bajo progresiones MCCEMS',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'PLANEACIÓN DIDÁCTICA',
    articulos: ['Acuerdo-14/08/22-ComponenteCurricular', 'Lineamientos-PMC-2025-Lineamiento3', 'LGE-Art.16'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Establece la obligatoriedad de que el 100% de la plantilla docente cuente con planeaciones didácticas validadas institucionalmente, con metas de aprendizaje explícitas, progresiones y rúbricas formativas.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Concentrado de planeaciones didácticas registradas y evaluadas en SIGPDA-EMS',
    orden_display: 8,
  },
  {
    id: 'meta-otras-actividades-academicas',
    nombre: 'Feria de ciencias, humanidades y competencias tecnológicas',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'OTRAS ACTIVIDADES ACADÉMICAS',
    articulos: ['Ley-Ciencia-Tecnologia-Art.1', 'Plan-Sectorial-2025-2030-Obj.1'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'contextual',
      justificacion: 'Fomenta la divulgación del pensamiento científico, matemático y humanístico mediante muestras académicas públicas que fortalezcan la autoestima y pertenencia escolar del estudiantado.',
    },
    fase: 'FASE 2',
    estado: 'pendiente',
    evidencia: 'Memoria gráfica y programa oficial del evento académico anual del plantel',
    orden_display: 9,
  },

  // ── CATEGORÍA 2: GESTIÓN Y ADMINISTRACIÓN ESCOLAR ────────────────────────────
  {
    id: 'meta-vinculacion-instituciones-educativas',
    nombre: 'Articulación con secundarias y educación superior',
    categoria: 'Gestión y administración escolar',
    subcategoria: 'VINCULACIÓN CON INSTITUCIONES EDUCATIVAS',
    articulos: ['Educacion-Media-Puebla-Art.3', 'Lineamientos-PMC-2025-Lineamiento2'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'recomendada',
      justificacion: 'Favorece la captación oportuna de egresados de secundaria en la micro-región y orienta vocacionalmente a los alumnos de 5º y 6º semestre hacia instituciones de educación superior de Puebla.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Convenios de colaboración académica y registro de jornadas de orientación vocacional',
    orden_display: 10,
  },
  {
    id: 'meta-vinculacion-empresas-comunidad',
    nombre: 'Vinculación con el sector productivo y fundaciones locales',
    categoria: 'Gestión y administración escolar',
    subcategoria: 'VINCULACIÓN CON EMPRESAS, FUNDACIONES E INSTITUCIONES PÚBLICAS',
    articulos: ['Formacion-Dual-Art.16', 'Lineamientos-PMC-2025-Lineamiento2'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'contextual',
      justificacion: 'Permite gestionar apoyos, donaciones de insumos, visitas guiadas y prácticas laborales para la formación propedéutica y para el trabajo, beneficiando la economía del plantel.',
    },
    fase: 'FASE 2',
    estado: 'pendiente',
    evidencia: 'Cartas de intención, convenios formales de colaboración y donativos registrados',
    orden_display: 11,
  },
  {
    id: 'meta-gestion-recursos-equipamiento',
    nombre: 'Mantenimiento y equipamiento de aulas, talleres y conectividad',
    categoria: 'Gestión y administración escolar',
    subcategoria: 'GESTIÓN Y ADMINISTRACIÓN DE RECURSOS, EQUIPAMIENTOS Y SERVICIOS',
    articulos: ['LGE-Art.14', 'Lineamientos-PMC-2025-Lineamiento2', 'Ley-Educacion-Puebla-Art.14'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Garantiza condiciones físicas dignas y seguras para el aprendizaje, optimizando los recursos escolares propios y gestionando apoyos ante autoridades municipales y comités de padres.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Inventario físico actualizado y actas de entrega-recepción de mantenimiento escolar',
    orden_display: 12,
  },
  {
    id: 'meta-seguimiento-desempeno-docente-aula',
    nombre: 'Acompañamiento directivo y retroalimentación pedagógica en aula',
    categoria: 'Gestión y administración escolar',
    subcategoria: 'SEGUIMIENTO AL DESEMPEÑO DOCENTE EN EL AULA',
    articulos: ['LGSCMM-Art.4', 'LGSCMM-Art.69', 'Lineamientos-PMC-2025-Lineamiento4'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Sustenta la función directiva de realizar visitas de acompañamiento respetuoso y formativo al aula, retroalimentando la práctica docente con enfoque de mejora continua y no punitivo.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Instrumentos de observación formativa de clase y acuerdos individuales de mejora',
    orden_display: 13,
  },
  {
    id: 'meta-seguimiento-egresados-trayectoria',
    nombre: 'Estudio de trayectoria y seguimiento de egresados',
    categoria: 'Gestión y administración escolar',
    subcategoria: 'SEGUIMIENTO DE EGRESADOS',
    articulos: ['Lineamientos-PMC-2025-Lineamiento4', 'Plan-Sectorial-2025-2030-Obj.3'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'recomendada',
      justificacion: 'Evalúa la pertinencia de la formación impartida midiendo el ingreso al nivel superior y la inserción laboral de las generaciones egresadas para retroalimentar la oferta educativa.',
    },
    fase: 'FASE 2',
    estado: 'pendiente',
    evidencia: 'Base de datos de contacto de egresados y reporte estadístico de inserción',
    orden_display: 14,
  },

  // ── CATEGORÍA 3: DESARROLLO SOCIOEMOCIONAL Y PREVENCIÓN DE LA VIOLENCIA ─────
  {
    id: 'meta-socioemocional-curriculum-ampliado',
    nombre: 'Implementación de los Ámbitos de Formación Socioemocional',
    categoria: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
    subcategoria: 'ÁMBITOS DE FORMACIÓN SOCIOEMOCIONAL (CURRÍCULUM AMPLIADO)',
    articulos: ['Acuerdo-14/08/22-ComponenteCurricular', 'CPEUM-Art.3', 'LGE-Art.18'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Asegura que el estudiantado participe activamente en al menos dos ámbitos de formación socioemocional (Práctica y Colaboración Ciudadana, Educación para la Salud, Actividades Físicas o Educación Integral en Sexualidad).',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Cronograma de actividades socioemocionales semestrales y evidencias fotográficas/formativas',
    orden_display: 15,
  },
  {
    id: 'meta-prevencion-violencia-paz-escolar',
    nombre: 'Estrategias de cultura de paz, inclusión y erradicación de violencia',
    categoria: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
    subcategoria: 'PREVENCIÓN DE LA VIOLENCIA EN LA ESCUELA',
    articulos: ['Seguridad-Escolar-Puebla-Art.2', 'Seguridad-Escolar-Puebla-Art.11', 'Lineamientos-PMC-2025-Lineamiento2'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Establece protocolos preventivos ante acoso escolar, violencia de género o discriminación, garantizando un entorno seguro, inclusivo y propicio para la convivencia pacífica.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Reglamento escolar actualizado con enfoque de derechos humanos y bitácora de mediación',
    orden_display: 16,
  },
  {
    id: 'meta-orientacion-educativa-vocacional',
    nombre: 'Orientación educativa y proyecto de vida estudiantil',
    categoria: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
    subcategoria: 'ORIENTACIÓN EDUCATIVA',
    articulos: ['Derechos-NNA-Puebla-Art.47', 'LGE-Art.18', 'Ley-Educacion-Puebla-Art.7'],
    vigencia: true,
    aplicabilidad_pmc: {
      nivel: 'obligatoria',
      justificacion: 'Acompaña a las y los estudiantes en la construcción de su proyecto de vida, toma de decisiones informadas y desarrollo de habilidades intrapersonales e interpersonales resilientes.',
    },
    fase: 'FASE 1',
    estado: 'pendiente',
    evidencia: 'Talleres de proyecto de vida impartidos y registro de orientación psicopedagógica',
    orden_display: 17,
  },
];

export interface NormativaCitationResolution {
  ok: boolean;
  documentoId?: number;
  documentoTitulo?: string;
  articulo?: string;
  error?: string;
}

export interface CanonicalNormativaDocRef {
  docId: number;
  titulo: string;
  articulosValidos: string[];
}

export const CANONICAL_NORMATIVA_REFS: Record<string, CanonicalNormativaDocRef> = {
  CPEUM: {
    docId: 1,
    titulo: 'Constitución Política de los Estados Unidos Mexicanos',
    articulosValidos: ['Art.3'],
  },
  LGE: {
    docId: 2,
    titulo: 'Ley General de Educación (2019)',
    articulosValidos: ['Art.14', 'Art.16', 'Art.18', 'Art.44', 'Art.46'],
  },
  LGSCMM: {
    docId: 3,
    titulo: 'Ley General del Sistema para la Carrera de las Maestras y los Maestros (LGSCMM, 2019)',
    articulosValidos: ['Art.4', 'Art.69'],
  },
  'Acuerdo-14/08/22': {
    docId: 4,
    titulo: 'Acuerdo Secretarial 14/08/22 — Marco Curricular Común de la Educación Media Superior (MCCEMS)',
    articulosValidos: ['LineamientoGeneral', 'ComponenteCurricular'],
  },
  'Lineamientos-PMC-2025': {
    docId: 5,
    titulo: 'Lineamientos para la Planeación de la Mejora Continua 2025-2026 — DBEPA Puebla',
    articulosValidos: ['Lineamiento1', 'Lineamiento2', 'Lineamiento3', 'Lineamiento4'],
  },
  'Lineamientos-PAEC-2026': {
    docId: 6,
    titulo: 'Lineamientos PAEC-PEC 2026-2027 — DBEPA Puebla',
    articulosValidos: ['Lineamiento1', 'Lineamiento2', 'Lineamiento3'],
  },
  'Ley-Educacion-Puebla': {
    docId: 8,
    titulo: 'Ley de Educación del Estado de Puebla',
    articulosValidos: ['Art.3', 'Art.6', 'Art.7', 'Art.9', 'Art.10', 'Art.13', 'Art.14'],
  },
  'Plan-Sectorial-2025-2030': {
    docId: 9,
    titulo: 'Plan Sectorial de Educación 2020-2024 / 2025-2030 — SEP',
    articulosValidos: ['Obj.1', 'Obj.3'],
  },
  'Ley-Fomento-Lectura': {
    docId: 41,
    titulo: 'Ley de Fomento para la Lectura y el Libro',
    articulosValidos: ['Art.10', 'Art.12', 'Art.22', 'Art.25'],
  },
  'Mejora-Continua': {
    docId: 44,
    titulo:
      'Ley Reglamentaria del Artículo 3o. de la Constitución Política de los Estados Unidos Mexicanos, en Materia de Mejora Continua de la Educación',
    articulosValidos: [
      'Art.1',
      'Art.3',
      'Art.4',
      'Art.6',
      'Art.12',
      'Art.14',
      'Art.16',
      'Art.18',
      'Art.21',
      'Art.24',
      'Art.28',
      'Art.31',
    ],
  },
  'Ley-Ciencia-Tecnologia': {
    docId: 61,
    titulo: 'Ley General en Materia de Humanidades, Ciencias, Tecnologías e Innovación',
    articulosValidos: ['Art.1', 'Art.2', 'Art.3', 'Art.5', 'Art.7', 'Art.9', 'Art.10', 'Art.11'],
  },
  'Formacion-Dual': {
    docId: 68,
    titulo:
      'ACUERDO número 06/06/15 por el que se establece la formación dual como una opción educativa del tipo medio superior',
    articulosValidos: ['Art.5', 'Art.6', 'Art.13', 'Art.16'],
  },
  'Derechos-NNA-Puebla': {
    docId: 88,
    titulo: 'Ley de los Derechos de las Niñas, Niños y Adolescentes del Estado de Puebla',
    articulosValidos: ['Art.47', 'Art.48'],
  },
  'Educacion-Media-Puebla': {
    docId: 90,
    titulo: 'Ley de Educación Media y Superior del Estado Libre y Soberano de Puebla',
    articulosValidos: ['Art.3', 'Art.12', 'Art.13'],
  },
  'Seguridad-Escolar-Puebla': {
    docId: 93,
    titulo: 'Ley de Seguridad Integral Escolar para el Estado Libre y Soberano de Puebla',
    articulosValidos: ['Art.1', 'Art.2', 'Art.11', 'Art.12', 'Art.13'],
  },
};

/**
 * Resuelve y valida formalmente una cita jurídica contra los 28 documentos vigentes
 * y artículos catalogados en la Normateca oficial de SIGPDA-EMS.
 */
export function resolveNormativaCitation(citation: string): NormativaCitationResolution {
  const sortedPrefixes = Object.keys(CANONICAL_NORMATIVA_REFS).sort((a, b) => b.length - a.length);
  const matchedPrefix = sortedPrefixes.find((p) => citation.startsWith(`${p}-`));

  if (!matchedPrefix) {
    return {
      ok: false,
      error: `Documento normativo no reconocido o no vigente en la Normateca: "${citation}"`,
    };
  }

  const doc = CANONICAL_NORMATIVA_REFS[matchedPrefix];
  const artSuffix = citation.substring(matchedPrefix.length + 1);

  if (!doc.articulosValidos.includes(artSuffix)) {
    return {
      ok: false,
      documentoId: doc.docId,
      documentoTitulo: doc.titulo,
      error: `Artículo/sección "${artSuffix}" no existe en ${doc.titulo}. Válidos: ${doc.articulosValidos.join(', ')}`,
    };
  }

  return {
    ok: true,
    documentoId: doc.docId,
    documentoTitulo: doc.titulo,
    articulo: artSuffix,
  };
}

/**
 * Compara de forma exacta una referencia normativa canónica (p. ej. "Art.1", "Obj.1", "Lineamiento1")
 * contra el número o descripción del artículo registrado en la base de datos (p. ej. "Artículo 1°", "Objetivo 1"),
 * previniendo falsos positivos por coincidencia de subcadenas (p. ej. que "Art.1" valide erróneamente con "Artículo 10").
 */
export function matchArticuloExacto(artValido: string, dbNumero: string): boolean {
  const normDb = dbNumero.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const normVal = artValido.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Caso 1: Artículos numéricos (p. ej. "Art.1", "Art.14", "Art.3")
  const artMatch = normVal.match(/^art\.(\d+)$/);
  if (artMatch) {
    const num = artMatch[1];
    const regex = new RegExp(`(?:articulo|art\\.?)\\s*0*${num}(?:[°ºª]|\\b)(?!\\d)`, 'i');
    return regex.test(normDb);
  }

  // Caso 2: Objetivos (p. ej. "Obj.1", "Obj.3")
  const objMatch = normVal.match(/^obj\.(\d+)$/);
  if (objMatch) {
    const num = objMatch[1];
    const regex = new RegExp(`(?:objetivo|obj\\.?)\\s*0*${num}\\b(?!\\d)`, 'i');
    return regex.test(normDb);
  }

  // Caso 3: Lineamientos numerados (p. ej. "Lineamiento1", "Lineamiento4")
  const linMatch = normVal.match(/^lineamiento(\d+)$/);
  if (linMatch) {
    const num = linMatch[1];
    const regex = new RegExp(`lineamiento\\s*0*${num}\\b(?!\\d)`, 'i');
    return regex.test(normDb);
  }

  // Caso 4: Secciones textuales (p. ej. "LineamientoGeneral", "ComponenteCurricular")
  const cleanDb = normDb.replace(/[\s\-_]/g, '');
  const cleanVal = normVal.replace(/[\s\-_]/g, '');
  return cleanDb === cleanVal || cleanDb.includes(cleanVal);
}

/**
 * Obtiene todas las metas vigentes del catálogo canónico
 */
export function getCatalogoMetasPmc(): MetaCatalogEntry[] {
  return CATALOGO_METAS_CANONICO.filter((m) => m.vigencia);
}

/**
 * Obtiene metas por categoría
 */
export function getMetasByCategoria(categoria: string): MetaCatalogEntry[] {
  return CATALOGO_METAS_CANONICO.filter(
    (m) => m.vigencia && m.categoria.toLowerCase() === categoria.toLowerCase()
  );
}

/**
 * Obtiene metas por subcategoría oficial
 */
export function getMetasBySubcategoria(subcategoria: string): MetaCatalogEntry[] {
  return CATALOGO_METAS_CANONICO.filter(
    (m) => m.vigencia && m.subcategoria.toLowerCase() === subcategoria.toLowerCase()
  );
}

/**
 * Construye el bloque contextual de metas sugeridas y fundamentación jurídica
 * para ser inyectado limpiamente en prompts de IA sin modificar contratos existentes.
 */
export function formatMetasContextForPrompt(categoriaFiltro?: string): string {
  const metas = categoriaFiltro ? getMetasByCategoria(categoriaFiltro) : getCatalogoMetasPmc();
  if (metas.length === 0) return '';

  const lineas = metas.map((m) => {
    return `- [${m.categoria} · ${m.subcategoria}]: "${m.nombre}"
    * Fundamento Normativo: ${m.articulos.join(', ')}
    * Aplicabilidad en el PMC (${m.aplicabilidad_pmc.nivel}): ${m.aplicabilidad_pmc.justificacion}
    * Entregable Sugerido: ${m.evidencia || 'N/D'}`;
  });

  return `CATÁLOGO CANÓNICO DE METAS OFICIALES Y APLICABILIDAD NORMATIVA (MCCEMS PUEBLA):\n${lineas.join('\n')}`;
}
