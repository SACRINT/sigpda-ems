/**
 * Catálogo Oficial de 14 Estrategias Didácticas — SIGPDA-EMS
 *
 * Basado en el Marco Curricular Común de la Educación Media Superior (MCCEMS 2025 / NEM)
 * y las especificaciones pedagógicas de SEMS Puebla para planteles con conectividad
 * limitada (Garantía Dual Offline).
 *
 * Distribución oficial: 4 Apertura · 6 Desarrollo · 4 Cierre
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type MomentoDidactico = 'apertura' | 'desarrollo' | 'cierre';
export type NivelComplejidad = 'basica' | 'intermedia' | 'avanzada';

export interface EstrategiaDidactica {
  /** Identificador único slug (snake_case) */
  id: string;
  /** Nombre completo de la estrategia */
  nombre: string;
  /** Momento didáctico principal de aplicación */
  momentoPrincipal: MomentoDidactico;
  /**
   * Momentos en los que puede aplicarse la estrategia.
   * Algunas estrategias son epistémicamente unívocas (length === 1).
   */
  momentosAplicables: MomentoDidactico[];
  /** Definición pedagógica concisa */
  definicion: string;
  /** Propósito pedagógico específico en el aula de EMS */
  propositoPedagogico: string;
  /** Nivel de complejidad cognitiva */
  complejidad: NivelComplejidad;
  /**
   * IDs de metodologías activas compatibles.
   * Usar ['*'] para estrategias universales.
   */
  metodologiasCompatibles: string[];
  /**
   * Alternativa analógica viable para aulas sin internet ni dispositivos.
   * Obligatorio. Mínimo 20 caracteres.
   */
  garantiaDualOffline: string;
  /** Instrumento de evaluación sugerido. Obligatorio para Cierre. */
  instrumentoSugerido?: string;
}

// ─── Catálogo de 14 Estrategias Oficiales ─────────────────────────────────────

export const CATALOGO_ESTRATEGIAS: EstrategiaDidactica[] = [

  // ══════════════════════════ APERTURA (4) ══════════════════════════════════════

  {
    id: 'cuestionamiento_socratico',
    nombre: 'Cuestionamiento Socrático',
    momentoPrincipal: 'apertura',
    momentosAplicables: ['apertura', 'desarrollo'],
    definicion: 'Secuencia de preguntas progresivas e intencionadas que llevan al estudiante a cuestionar sus certezas, identificar contradicciones en sus saberes previos y construir una necesidad de conocimiento genuina.',
    propositoPedagogico: 'Activar el pensamiento crítico y generar desequilibrio cognitivo que motive la indagación.',
    complejidad: 'basica',
    metodologiasCompatibles: ['*'],
    garantiaDualOffline: 'El docente prepara una guía de preguntas impresas y conduce el diálogo oral en plenaria sin requerir dispositivos.',
    instrumentoSugerido: undefined,
  },
  {
    id: 'lluvia_ideas_estructurada',
    nombre: 'Lluvia de Ideas Estructurada',
    momentoPrincipal: 'apertura',
    momentosAplicables: ['apertura', 'desarrollo'],
    definicion: 'Técnica colaborativa donde los estudiantes generan libremente ideas sobre un tema, luego las organizan, clasifican y priorizan en equipos usando criterios pedagógicos definidos.',
    propositoPedagogico: 'Mapear saberes previos del grupo e identificar preconcepciones como punto de partida.',
    complejidad: 'basica',
    metodologiasCompatibles: ['*'],
    garantiaDualOffline: 'Los equipos escriben ideas en tarjetas de papel o en pizarrón y las organizan en categorías dibujadas con marcadores.',
    instrumentoSugerido: undefined,
  },
  {
    id: 'planteamiento_hipotesis',
    nombre: 'Planteamiento de Hipótesis',
    momentoPrincipal: 'apertura',
    momentosAplicables: ['apertura'],
    definicion: 'Los estudiantes formulan afirmaciones provisionales y verificables sobre un fenómeno o problema a partir de observaciones iniciales, estableciendo el marco predictivo para la indagación posterior.',
    propositoPedagogico: 'Desarrollar el pensamiento científico-deductivo y comprometer al estudiante con la verificación empírica de sus predicciones.',
    complejidad: 'intermedia',
    metodologiasCompatibles: ['indagacion', 'steam', 'abproblemas', 'abr'],
    garantiaDualOffline: 'Los estudiantes redactan hipótesis en fichas de papel siguiendo la estructura "Si…, entonces…, porque…" que el docente entrega impresa.',
    instrumentoSugerido: undefined,
  },
  {
    id: 'activacion_saberes_fenomeno',
    nombre: 'Activación de Saberes con Fenómeno / Asombro',
    momentoPrincipal: 'apertura',
    momentosAplicables: ['apertura'],
    definicion: 'El docente presenta un fenómeno, paradoja, situación sorprendente o dilema comunitario real para detonar la curiosidad epistémica y conectar la UAC con la vida cotidiana del estudiante antes de cualquier instrucción formal.',
    propositoPedagogico: 'Generar asombro y crear el vínculo emocional y contextual con el contenido formativo (pilar de la NEM).',
    complejidad: 'basica',
    metodologiasCompatibles: ['*'],
    garantiaDualOffline: 'El docente lleva un objeto, muestra una imagen impresa, narra una anécdota comunitaria o realiza una demostración práctica en el aula sin proyector ni internet.',
  },

  // ══════════════════════════ DESARROLLO (6) ════════════════════════════════════

  {
    id: 'modelacion_matematica',
    nombre: 'Modelación Matemática',
    momentoPrincipal: 'desarrollo',
    momentosAplicables: ['desarrollo'],
    definicion: 'Los estudiantes traducen una situación real al lenguaje matemático (variables, ecuaciones, funciones, gráficas o modelos estadísticos) para analizar patrones, predecir comportamientos y validar soluciones cuantitativamente.',
    propositoPedagogico: 'Desarrollar el pensamiento abstracto-cuantitativo y usar las matemáticas como herramienta de análisis de la realidad.',
    complejidad: 'avanzada',
    metodologiasCompatibles: ['abproblemas', 'steam', 'abr', 'indagacion'],
    garantiaDualOffline: 'Los estudiantes trabajan el modelo en papel cuadriculado o en tablas y gráficas trazadas a mano con regla y lápiz, sin software.',
    instrumentoSugerido: 'Rúbrica analítica de modelación matemática',
  },
  {
    id: 'simulacion_experimental',
    nombre: 'Simulación / Experimentación Empírica',
    momentoPrincipal: 'desarrollo',
    momentosAplicables: ['desarrollo'],
    definicion: 'Los estudiantes realizan experimentos guiados o simulaciones controladas para observar, medir y registrar el comportamiento de fenómenos físicos, químicos, biológicos o sociales con protocolo científico.',
    propositoPedagogico: 'Construir conocimiento procedimental y actitudinal a través de la observación directa y el rigor metodológico.',
    complejidad: 'intermedia',
    metodologiasCompatibles: ['indagacion', 'steam', 'practica_laboratorio'],
    garantiaDualOffline: 'El docente rediseña el experimento con materiales caseros disponibles: vinagre, bicarbonato, lupas, balanzas de cocina u objetos del entorno escolar.',
    instrumentoSugerido: 'Guía de observación / Bitácora de laboratorio con lista de cotejo',
  },
  {
    id: 'jigsaw_cooperativo',
    nombre: 'Jigsaw Cooperativo (Rompecabezas)',
    momentoPrincipal: 'desarrollo',
    momentosAplicables: ['desarrollo'],
    definicion: 'La clase se divide en grupos de expertos que profundizan en un subtema y luego se redistribuyen en grupos mixtos para enseñarse mutuamente, construyendo el conocimiento por interdependencia positiva.',
    propositoPedagogico: 'Desarrollar responsabilidad individual, habilidades de comunicación y comprensión profunda al enseñar a otros.',
    complejidad: 'intermedia',
    metodologiasCompatibles: ['abp', 'abproblemas', 'aprendizaje_servicio', 'estudio_casos', 'gamificacion'],
    garantiaDualOffline: 'El docente distribuye fichas de lectura impresas a cada grupo de expertos; los materiales son cuadernillos o páginas fotocopiadas del programa.',
    instrumentoSugerido: undefined,
  },
  {
    id: 'resolucion_problemas_situados',
    nombre: 'Resolución de Problemas Situados',
    momentoPrincipal: 'desarrollo',
    momentosAplicables: ['desarrollo', 'cierre'],
    definicion: 'Los estudiantes analizan y resuelven problemas auténticos del contexto comunitario local aplicando conceptos de la UAC de forma integrada, con múltiples rutas de solución posibles y sin respuesta única predefinida.',
    propositoPedagogico: 'Transferir el aprendizaje a contextos reales y desarrollar la toma de decisiones en situaciones inciertas.',
    complejidad: 'avanzada',
    metodologiasCompatibles: ['abproblemas', 'abp', 'abr', 'estudio_casos', 'aprendizaje_servicio'],
    garantiaDualOffline: 'El docente diseña el problema con datos reales de la comunidad (precios de mercado local, estadísticas del municipio, casos de la parcela comunitaria) sin internet.',
    instrumentoSugerido: 'Rúbrica holística de resolución de problemas',
  },
  {
    id: 'investigacion_documental_campo',
    nombre: 'Investigación Documental y de Campo',
    momentoPrincipal: 'desarrollo',
    momentosAplicables: ['desarrollo'],
    definicion: 'Los estudiantes realizan búsqueda, lectura crítica, contraste y síntesis de información de fuentes confiables (bibliográficas, hemerográficas, digitales o primarias de campo) para construir argumentos sobre un tema.',
    propositoPedagogico: 'Desarrollar literacidad informacional, pensamiento crítico frente a fuentes y hábitos de investigación sistemática.',
    complejidad: 'intermedia',
    metodologiasCompatibles: ['abp', 'abproblemas', 'indagacion', 'aprendizaje_servicio', 'estudio_casos'],
    garantiaDualOffline: 'El docente provee copias impresas de textos clave y guías de lectura; el trabajo de campo se realiza en la comunidad escolar sin dispositivos.',
    instrumentoSugerido: undefined,
  },
  {
    id: 'practica_taller_procedimental',
    nombre: 'Práctica de Taller / Procedimental',
    momentoPrincipal: 'desarrollo',
    momentosAplicables: ['desarrollo'],
    definicion: 'Ejecución rigurosa de procedimientos técnicos hands-on con protocolo de seguridad, verificación de insumos, troubleshooting y registro formal de resultados.',
    propositoPedagogico: 'Desarrollar competencias técnico-procedimentales, disciplina operativa y seguridad industrial en formación laboral.',
    complejidad: 'intermedia',
    metodologiasCompatibles: ['practica_laboratorio', 'steam', 'indagacion'],
    garantiaDualOffline: 'La práctica se realiza con materiales físicos del taller escolar; si no hay insumos, el docente usa maqueta o demostración con herramientas básicas del plantel.',
    instrumentoSugerido: 'Lista de cotejo de práctica técnica con escala de desempeño',
  },

  // ══════════════════════════ CIERRE (4) ════════════════════════════════════════

  {
    id: 'estudio_casos_deliberativo',
    nombre: 'Estudio de Casos Deliberativo',
    momentoPrincipal: 'cierre',
    momentosAplicables: ['desarrollo', 'cierre'],
    definicion: 'Los equipos analizan un caso real, complejo y contextualizado (técnico, ético, económico o comunitario) deliberando sobre causas, consecuencias y decisiones posibles, llegando a una postura grupal argumentada.',
    propositoPedagogico: 'Desarrollar el juicio ético, la argumentación fundamentada y la toma de decisiones responsable en situaciones de incertidumbre.',
    complejidad: 'avanzada',
    metodologiasCompatibles: ['estudio_casos', 'abproblemas', 'aprendizaje_servicio', 'abp'],
    garantiaDualOffline: 'El caso se distribuye en formato de texto impreso; el debate se realiza oralmente en plenaria con moderación del docente sin dispositivos.',
    instrumentoSugerido: 'Rúbrica analítica de argumentación y participación',
  },
  {
    id: 'defensa_publica_producto',
    nombre: 'Defensa Pública del Producto / Proyecto',
    momentoPrincipal: 'cierre',
    momentosAplicables: ['cierre'],
    definicion: 'Los estudiantes presentan ante un público real el producto, proyecto o solución construida durante el bloque, defendiendo argumentativamente las decisiones tomadas ante preguntas del jurado.',
    propositoPedagogico: 'Desarrollar la expresión oral fundamentada y la capacidad de socializar conocimientos con una audiencia auténtica.',
    complejidad: 'avanzada',
    metodologiasCompatibles: ['abp', 'abproblemas', 'aprendizaje_servicio', 'steam', 'abr', 'gamificacion'],
    garantiaDualOffline: 'La defensa se realiza con maqueta física, carteles impresos o demostración práctica en el aula sin proyector ni presentación digital.',
    instrumentoSugerido: 'Rúbrica de defensa oral / Guía de evaluación de proyecto integrador',
  },
  {
    id: 'reflexion_metacognitiva',
    nombre: 'Reflexión Metacognitiva',
    momentoPrincipal: 'cierre',
    momentosAplicables: ['cierre'],
    definicion: 'Los estudiantes analizan conscientemente su propio proceso de aprendizaje: qué aprendieron, cómo lo aprendieron, qué dificultades enfrentaron y cómo las superaron, usando bitácora, escalera de reflexión o carta de aprendizaje.',
    propositoPedagogico: 'Desarrollar la autorregulación del aprendizaje y la conciencia epistémica sobre el proceso de construcción del conocimiento propio.',
    complejidad: 'intermedia',
    metodologiasCompatibles: ['*'],
    garantiaDualOffline: 'El estudiante completa una ficha impresa o responde preguntas escritas en su cuaderno; el docente facilita el cierre con una dinámica oral de plenaria.',
    instrumentoSugerido: 'Diario de aprendizaje / Guía de reflexión con escala de valoración',
  },
  {
    id: 'evaluacion_formativa_instrumento',
    nombre: 'Evaluación Formativa con Instrumento',
    momentoPrincipal: 'cierre',
    momentosAplicables: ['cierre'],
    definicion: 'Aplicación de un instrumento de evaluación estructurado (rúbrica analítica, lista de cotejo, escala de estimación o portafolio) que permite valorar de forma participativa el nivel de logro de los aprendizajes del bloque.',
    propositoPedagogico: 'Consolidar el aprendizaje mediante la autoevaluación y coevaluación sistemática, cerrando el ciclo didáctico con evidencia medible del desempeño.',
    complejidad: 'basica',
    metodologiasCompatibles: ['*'],
    garantiaDualOffline: 'El instrumento se aplica en formato físico impreso o dictado oralmente; la retroalimentación se da de forma oral o escrita en el cuaderno del estudiante.',
    instrumentoSugerido: 'Rúbrica analítica / Lista de cotejo / Escala de estimación (Sección V)',
  },
];

// ─── Mapa de acceso rápido ─────────────────────────────────────────────────────

export const ESTRATEGIAS_MAP: Record<string, EstrategiaDidactica> = CATALOGO_ESTRATEGIAS.reduce(
  (acc, e) => {
    acc[e.id] = e;
    return acc;
  },
  {} as Record<string, EstrategiaDidactica>
);

// ─── Funciones Helper Puras ────────────────────────────────────────────────────

/** Devuelve una estrategia por su ID slug. Normaliza a minúsculas y elimina espacios. */
export function obtenerEstrategiaPorId(id: string): EstrategiaDidactica | undefined {
  return ESTRATEGIAS_MAP[id.toLowerCase().trim()];
}

/** Devuelve todas las estrategias aplicables en un momento didáctico dado. */
export function obtenerEstrategiasPorMomento(momento: MomentoDidactico): EstrategiaDidactica[] {
  return CATALOGO_ESTRATEGIAS.filter(e => e.momentosAplicables.includes(momento));
}

/**
 * Devuelve las estrategias compatibles con una metodología activa.
 * Las estrategias con metodologiasCompatibles === ['*'] son universales.
 */
export function obtenerEstrategiasCompatibles(metodologiaId: string): EstrategiaDidactica[] {
  const metIdNorm = metodologiaId.toLowerCase().trim();
  return CATALOGO_ESTRATEGIAS.filter(e =>
    e.metodologiasCompatibles.includes('*') ||
    e.metodologiasCompatibles.includes(metIdNorm)
  );
}

/**
 * Genera un bloque de texto formateado con las estrategias recomendadas
 * para un momento específico y una metodología activa, listo para inyectar en prompts LLM.
 *
 * @param momento - 'apertura' | 'desarrollo' | 'cierre'
 * @param metodologiaId - ID slug de la metodología activa seleccionada por el docente
 */
export function formatearEstrategiasParaPrompt(
  momento: MomentoDidactico,
  metodologiaId: string
): string {
  const compatibles = obtenerEstrategiasCompatibles(metodologiaId)
    .filter(e => e.momentosAplicables.includes(momento));

  const estrategias = compatibles.length > 0
    ? compatibles
    : CATALOGO_ESTRATEGIAS.filter(
        e => e.metodologiasCompatibles.includes('*') && e.momentosAplicables.includes(momento)
      );

  return estrategias.map(e =>
    `  • ${e.nombre} [${e.complejidad}]: ${e.definicion}` +
    `\n    Garantía Offline: ${e.garantiaDualOffline}` +
    (e.instrumentoSugerido ? `\n    Instrumento: ${e.instrumentoSugerido}` : '')
  ).join('\n');
}
