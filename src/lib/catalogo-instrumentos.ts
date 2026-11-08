/**
 * src/lib/catalogo-instrumentos.ts
 * Catálogo Oficial de Instrumentos de Evaluación Formativa y Sumativa — SIGPDA-EMS
 *
 * Basado en los Lineamientos de Evaluación del Aprendizaje del Marco Curricular Común
 * de la Educación Media Superior (MCCEMS 2025-2027 / Nueva Escuela Mexicana / SEMS Puebla / COSFAC).
 *
 * Propósito:
 * 1. Erradicar el monocultivo de instrumentos ("Rúbrica" y "Lista de cotejo" únicamente).
 * 2. Sugerir de manera determinista e inteligente el instrumento idóneo de acuerdo con:
 *    - El tipo de actividad didáctica y momento formativo (Apertura, Desarrollo, Cierre, Sumativa).
 *    - El contenido disciplinar (Matemáticas, Ciencias Experimentales, Humanidades, Lengua,
 *      Ciencias Sociales, Cultura Digital, Formación Laboral / Carrera Técnica, Socioemocional).
 *    - El tipo de proyecto, evidencia o artefacto a evaluar (Problemario, Prototipo, Laboratorio,
 *      Trazo Geométrico, Ensayo/Disertación, Estudio de Caso, Debate, Bitácora, Portafolio, etc.).
 * 3. Proveer plantillas estructurales normativas para la generación de instrumentos en PDF, DOCX y Markdown.
 */

import type { FamiliaDisciplinar, TipoEvidencia } from '@/lib/curriculum-evidence-engine';

export type CategoriaInstrumento =
  | 'producto_integrador'
  | 'desempeno_cognitivo'
  | 'produccion_escrita_oral'
  | 'desempeno_comunicativo'
  | 'verificacion_tecnica'
  | 'desempeno_procedimental'
  | 'actitudinal_socioemocional'
  | 'seguimiento_proceso'
  | 'compendio_longitudinal'
  | 'diagnostica_exploratoria'
  | 'analisis_situado'
  | 'validacion_ingenieria'
  | 'metacognicion_autorregulacion'
  | 'regulacion_microsesion';

export type MomentoEvaluativo = 'diagnostica' | 'apertura' | 'desarrollo' | 'cierre' | 'sumativa';

export type AgenteEvaluadorOficial = 'Heteroevaluación' | 'Coevaluación' | 'Autoevaluación';

export interface InstrumentoEvaluacionOficial {
  /** Identificador canónico snake_case */
  id: string;
  /** Nombre normativo completo para mostrar en Planeación (Sección IV y V), PDF y DOCX */
  nombre: string;
  /** Nombre corto para etiquetas compactas */
  nombreCorto: string;
  /** Categoría funcional del instrumento */
  categoria: CategoriaInstrumento;
  /** Momentos didácticos donde su aplicación es óptima */
  momentosOptimos: MomentoEvaluativo[];
  /** Agentes evaluadores compatibles en orden de prioridad */
  agentesSugeridos: AgenteEvaluadorOficial[];
  /** Familias disciplinares con alta afinidad (usar 'todas' si es transversal) */
  familiasAfines: (FamiliaDisciplinar | 'todas')[];
  /** Tipos de evidencia del motor curricular con los que hace match directo */
  tiposEvidenciaCompatibles: TipoEvidencia[];
  /** Palabras clave de artefactos, actividades o contenidos que disparan su selección */
  palabrasClaveArtefacto: string[];
  /** Metodologías activas con las que tiene mayor sinergia */
  metodologiasAfines: string[];
  /** Definición pedagógica normativa MCCEMS */
  definicionPedagogica: string;
  /** Escala o niveles de valoración que estructuran el instrumento */
  escalaValoracion: string[];
  /** Columnas de la tabla Markdown/DOCX/PDF para su renderizado */
  columnasTabla: string[];
  /** Dimensiones o criterios base que debe desglosar el generador */
  dimensionesBase: string[];
  /** Instrucción específica de estructura para el generador de IA / plantillas */
  instruccionEstructuraMarkdown: string;
}

export const CATALOGO_INSTRUMENTOS_EVALUACION: InstrumentoEvaluacionOficial[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. RÚBRICA ANALÍTICA DE PROYECTO INTEGRADOR / ARTEFACTO PAEC
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'rubrica_analitica_proyecto',
    nombre: 'Rúbrica analítica de proyecto integrador y artefacto PAEC',
    nombreCorto: 'Rúbrica analítica de proyecto',
    categoria: 'producto_integrador',
    momentosOptimos: ['sumativa', 'cierre'],
    agentesSugeridos: ['Heteroevaluación', 'Coevaluación'],
    familiasAfines: ['todas'],
    tiposEvidenciaCompatibles: ['producto', 'prototipo', 'modelo', 'manual'],
    palabrasClaveArtefacto: [
      'proyecto integrador', 'paec', 'artefacto', 'propuesta comunitaria',
      'intervencion', 'campana', 'feria', 'sistema', 'solucion aplicada',
      'dossier tecnico', 'informe final', 'producto integrador',
    ],
    metodologiasAfines: ['abp', 'aprendizaje_servicio', 'steam', 'abr', 'design_thinking'],
    definicionPedagogica:
      'Matriz de valoración analítica de 4 niveles de dominio que evalúa de forma desglosada la calidad técnica, fundamentación disciplinar, pertinencia comunitaria (PAEC) y socialización de un proyecto o artefacto integrador.',
    escalaValoracion: [
      'Sobresaliente (10 - 9)',
      'Notable (8 - 7)',
      'Suficiente (6 - 5)',
      'Requiere Apoyo (4 - 1)',
    ],
    columnasTabla: [
      'Criterio / Dimensión (Ponderación)',
      'Sobresaliente (10-9)',
      'Notable (8-7)',
      'Suficiente (6-5)',
      'Requiere Apoyo (4-1)',
    ],
    dimensionesBase: [
      'Fundamentación conceptual y rigor disciplinar (30%)',
      'Diseño, construcción y funcionalidad del artefacto/producto (30%)',
      'Pertinencia e impacto en la problemática comunitaria PAEC (25%)',
      'Trabajo colaborativo, defensa técnica y metacognición (15%)',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown con columnas: "Criterio / Dimensión (%)", "Sobresaliente (10-9)", "Notable (8-7)", "Suficiente (6-5)" y "Requiere Apoyo (4-1)". Cada celda debe describir indicadores observables y cuantificables del proyecto/artefacto.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. RÚBRICA ANALÍTICA DE MODELACIÓN MATEMÁTICA Y RESOLUCIÓN DE PROBLEMAS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'rubrica_analitica_resolucion_problemas',
    nombre: 'Rúbrica analítica de modelación matemática y resolución de problemas',
    nombreCorto: 'Rúbrica de modelación y problemas',
    categoria: 'desempeno_cognitivo',
    momentosOptimos: ['desarrollo', 'cierre', 'sumativa'],
    agentesSugeridos: ['Heteroevaluación'],
    familiasAfines: ['pensamiento_variacional', 'fisica_quimica', 'economico_administrativo'],
    tiposEvidenciaCompatibles: ['reporte', 'modelo', 'producto'],
    palabrasClaveArtefacto: [
      'problemario', 'ecuacion', 'ecuaciones', 'algebra', 'funcion', 'funciones',
      'modelo matematico', 'modelacion', 'sistema de ecuaciones', 'cuadratica',
      'optimizacion', 'calculo', 'derivada', 'integral', 'estadistica',
      'probabilidad', 'finanzas', 'interes simple', 'interes compuesto', 'demografia',
    ],
    metodologiasAfines: ['abproblemas', 'steam', 'indagacion', 'abr'],
    definicionPedagogica:
      'Instrumento matricial especializado en evaluar el razonamiento cuantitativo: traducción del fenómeno real a lenguaje simbólico/algebraico, ejecución de métodos analíticos, representación gráfica y validación de resultados en contexto.',
    escalaValoracion: [
      'Excelente / Dominio Pleno (4)',
      'Satisfactorio / Consolidado (3)',
      'Suficiente / En Desarrollo (2)',
      'Insuficiente / Requiere Andamiaje (1)',
    ],
    columnasTabla: [
      'Dimensión de Razonamiento Matemático (%)',
      'Excelente (4)',
      'Satisfactorio (3)',
      'Suficiente (2)',
      'Insuficiente (1)',
    ],
    dimensionesBase: [
      'Planteamiento y traducción del problema situado al modelo simbólico/algebraico (25%)',
      'Desarrollo procedimental, despeje y aplicación de métodos analíticos sin errores (30%)',
      'Representación gráfica, tabular o geométrica con escalas y ejes precisos (25%)',
      'Interpretación crítica de la solución y verificación en el contexto real (20%)',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown con 4 niveles ("Excelente (4)", "Satisfactorio (3)", "Suficiente (2)", "Insuficiente (1)") enfocada en planteamiento algebraico, rigor procedimental, representación gráfica e interpretación contextual.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. RÚBRICA ANALÍTICA DE DISERTACIÓN, ENSAYO CRÍTICO Y PRODUCCIÓN ESCRITA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'rubrica_analitica_argumentacion_ensayo',
    nombre: 'Rúbrica analítica de ensayo crítico, disertación y producción textual',
    nombreCorto: 'Rúbrica de argumentación escrita',
    categoria: 'produccion_escrita_oral',
    momentosOptimos: ['cierre', 'sumativa', 'desarrollo'],
    agentesSugeridos: ['Heteroevaluación', 'Coevaluación'],
    familiasAfines: ['humanidades_filosofia', 'lengua_comunicacion', 'economico_administrativo'],
    tiposEvidenciaCompatibles: ['disertacion', 'disertación', 'antologia', 'antología', 'reporte'],
    palabrasClaveArtefacto: [
      'ensayo', 'disertacion', 'resena', 'antologia', 'cronica', 'monografia',
      'texto argumentativo', 'articulo', 'analisis literario', 'comentario critico',
      'cartel cientifico', 'infografia argumentada', 'posicionamiento etico',
    ],
    metodologiasAfines: ['estudio_casos', 'abproblemas', 'aprendizaje_servicio', 'aula_invertida'],
    definicionPedagogica:
      'Instrumento analítico que valora la construcción del pensamiento crítico escrito: formulación de tesis o postura ética, encadenamiento de argumentos y contraargumentos, sustento en fuentes confiables y corrección estilística.',
    escalaValoracion: [
      'Sobresaliente (10-9)',
      'Notable (8-7)',
      'Suficiente (6-5)',
      'Insuficiente (4-1)',
    ],
    columnasTabla: [
      'Criterio Discursivo y Argumentativo (%)',
      'Sobresaliente (10-9)',
      'Notable (8-7)',
      'Suficiente (6-5)',
      'Insuficiente (4-1)',
    ],
    dimensionesBase: [
      'Tesis central, problematización filosófica/social y postura propia (30%)',
      'Solidez argumentativa, evidencias y sustento en fuentes documentales (30%)',
      'Coherencia, cohesión textual y estructura retórica (introducción, desarrollo, conclusión) (20%)',
      'Normativa ortotipográfica, precisión léxica y aparato crítico APA (20%)',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown con 4 niveles de desempeño evaluando tesis, estructura argumentativa, uso de fuentes primarias/secundarias y rigor ortotipográfico.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. RÚBRICA HOLÍSTICA DE EXPOSICIÓN, DEBATE SOCRÁTICO Y DEFENSA PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'rubrica_holistica_defensa_oral',
    nombre: 'Rúbrica holística de defensa pública, debate socrático y expresión oral',
    nombreCorto: 'Rúbrica holística de defensa oral',
    categoria: 'desempeno_comunicativo',
    momentosOptimos: ['cierre', 'desarrollo'],
    agentesSugeridos: ['Heteroevaluación', 'Coevaluación'],
    familiasAfines: ['humanidades_filosofia', 'lengua_comunicacion', 'socioemocional', 'todas'],
    tiposEvidenciaCompatibles: ['disertacion', 'disertación', 'producto'],
    palabrasClaveArtefacto: [
      'debate', 'defensa publica', 'exposicion oral', 'plenaria', 'mesa redonda',
      'foro', 'colokio', 'coloquio', 'dialogo socratico', 'presentacion oral',
      'pitch', 'dramatizacion', 'role play', 'podcast', 'ponencia',
    ],
    metodologiasAfines: ['estudio_casos', 'abp', 'aprendizaje_servicio', 'gamificacion'],
    definicionPedagogica:
      'Valoración integral del desempeño comunicativo y deliberativo en vivo: evalúa la fluidez argumentativa, la capacidad de réplica respetuosa con evidencia, el dominio escénico y la socialización del aprendizaje ante la comunidad.',
    escalaValoracion: [
      'Nivel 4 — Dominio Argumentativo y Comunicativo Sobresaliente (10)',
      'Nivel 3 — Desempeño Sólido y Articulado (8)',
      'Nivel 2 — Desempeño Básico con Apoyo de Guion (6)',
      'Nivel 1 — Desempeño Fragmentario o Lectura Literal (5)',
    ],
    columnasTabla: [
      'Nivel de Desempeño Global',
      'Ponderación / Equivalencia',
      'Descriptor Integral de Desempeño Comunicativo y Deliberativo',
      'Observaciones de Retroalimentación al Equipo/Ponente',
    ],
    dimensionesBase: [
      'Claridad de la tesis y estructura del discurso oral',
      'Capacidad de réplica, escucha activa y refutación con evidencias verificables',
      'Uso pertinente de apoyos visuales, maquetas o demostraciones en vivo',
      'Ética dialógica, manejo del tiempo y lenguaje corporal asertivo',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown de Rúbrica Holística con columnas: "Nivel de Dominio", "Puntaje", "Descriptor Global Integrado (Argumentación, Réplica, Recursos y Expresión Oral)" y "Observaciones del Docente".',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. LISTA DE COTEJO DE VERIFICACIÓN DE PRODUCTO, CROQUIS O NORMATIVIDAD TÉCNICA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'lista_cotejo_producto_tecnico',
    nombre: 'Lista de cotejo de verificación técnica, gráfica y procedimental',
    nombreCorto: 'Lista de cotejo técnica',
    categoria: 'verificacion_tecnica',
    momentosOptimos: ['desarrollo', 'cierre'],
    agentesSugeridos: ['Heteroevaluación', 'Coevaluación'],
    familiasAfines: ['dibujo_tecnico', 'pensamiento_variacional', 'formacion_laboral', 'cultura_digital', 'economico_administrativo'],
    tiposEvidenciaCompatibles: ['croquis', 'fichaTecnica', 'ficha_tecnica', 'manual', 'reporte', 'producto'],
    palabrasClaveArtefacto: [
      'croquis', 'lamina', 'plano', 'trazo', 'geometria', 'triangulo', 'pitagoras',
      'napoleon', 'congruencia', 'semejanza', 'angulo', 'angulos', 'ficha tecnica',
      'manual', 'diagrama', 'cedula', 'presupuesto', 'tabla', 'grafica', 'recta',
      'plano cartesiano', 'metodo grafico', 'sustitucion', 'igualacion', 'reduccion',
      'determinantes', 'norma', 'nom-', 'iso', 'cuadro comparativo', 'mapa conceptual',
    ],
    metodologiasAfines: ['abproblemas', 'practica_laboratorio', 'steam', 'abp'],
    definicionPedagogica:
      'Instrumento de verificación dicotómica (Cumple / No cumple) con ponderación por indicador, diseñado para auditar con precisión milimétrica requisitos técnicos, trazos geométricos, pasos procedimentales, acotaciones y cumplimiento normativo.',
    escalaValoracion: ['Cumple (Sí)', 'No cumple (No)', 'En proceso / Con observaciones'],
    columnasTabla: [
      'No.',
      'Dimensión / Indicador de Desempeño o Especificación Técnica',
      'Valor (%)',
      'Cumple (Sí)',
      'No Cumple (No)',
      'Observaciones Técnicas de Mejora',
    ],
    dimensionesBase: [
      'Exactitud de trazos, cálculos, escalas o procedimientos técnicos (40%)',
      'Cumplimiento de especificaciones formales, simbología o normatividad aplicable (30%)',
      'Orden metodológico, limpieza y memoria de cálculo/construcción (20%)',
      'Entrega oportuna y validación cruzada entre pares (10%)',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown de Lista de Cotejo con 8 a 10 indicadores técnicos verificables y columnas: "No.", "Indicador de Verificación Técnica", "Valor (%)", "Cumple (Sí)", "No cumple (No)" y "Observaciones".',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. GUÍA DE OBSERVACIÓN DE PRÁCTICA EXPERIMENTAL, LABORATORIO O TALLER
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'guia_observacion_laboratorio_taller',
    nombre: 'Guía de observación estructurada de práctica en aula, laboratorio o taller',
    nombreCorto: 'Guía de observación práctica',
    categoria: 'desempeno_procedimental',
    momentosOptimos: ['desarrollo', 'cierre'],
    agentesSugeridos: ['Heteroevaluación'],
    familiasAfines: ['fisica_quimica', 'formacion_laboral', 'dibujo_tecnico', 'pensamiento_variacional'],
    tiposEvidenciaCompatibles: ['prototipo', 'reporte', 'bitacora', 'bitácora', 'croquis'],
    palabrasClaveArtefacto: [
      'practica', 'laboratorio', 'taller', 'experimento', 'experimental',
      'medicion', 'instrumentos', 'compas', 'transportador', 'juego geometrico',
      'construccion de triangulos', 'demostracion practica', 'campo', 'ensamblaje',
      'instalacion', 'mantenimiento', 'calibracion', 'operacion', 'simulacion',
    ],
    metodologiasAfines: ['practica_laboratorio', 'indagacion', 'steam', 'abproblemas'],
    definicionPedagogica:
      'Instrumento de registro directo en tiempo real donde el docente observa y valora la destreza procedimental, el manejo de instrumentos de medición/trazo, la aplicación de normas de seguridad e higiene y la ejecución metodológica durante la sesión.',
    escalaValoracion: [
      'Siempre / Con autonomía (3 pts)',
      'Frecuentemente / Con apoyo mínimo (2 pts)',
      'Ocasionalmente / Con errores de ejecución (1 pt)',
      'No observado / Omitido (0 pts)',
    ],
    columnasTabla: [
      'Conducta / Destreza Procedimental Observada en Vivo',
      'Siempre (3)',
      'Frecuentemente (2)',
      'Ocasionalmente (1)',
      'No Observado (0)',
      'Registro de Evidencia / Incidencia en Aula o Taller',
    ],
    dimensionesBase: [
      'Preparación del área de trabajo, instrumentos de medición/trazo y medidas de seguridad',
      'Destreza y precisión técnica en la manipulación de herramientas, materiales o equipo',
      'Seguimiento riguroso del método experimental o geométrico y toma de lecturas reales',
      'Colaboración operativa en el equipo y cuidado del instrumental escolar',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown de Guía de Observación con 8 indicadores conductuales observables en vivo y columnas: "Indicador Procedimental Observado", "Siempre (3)", "Frecuentemente (2)", "Ocasionalmente (1)", "No Observado (0)" y "Evidencia / Incidencia Registrada".',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ESCALA ESTIMATIVA DE DESEMPEÑO COLABORATIVO, ACTITUDINAL Y SOCIOEMOCIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'escala_estimativa_colaboracion',
    nombre: 'Escala estimativa de trabajo colaborativo, corresponsabilidad y saber ser',
    nombreCorto: 'Escala estimativa colaborativa',
    categoria: 'actitudinal_socioemocional',
    momentosOptimos: ['desarrollo', 'cierre'],
    agentesSugeridos: ['Coevaluación', 'Heteroevaluación'],
    familiasAfines: ['socioemocional', 'humanidades_filosofia', 'todas'],
    tiposEvidenciaCompatibles: ['portafolio', 'producto', 'bitacora', 'bitácora'],
    palabrasClaveArtefacto: [
      'colaborativo', 'equipo', 'coevaluacion', 'convivencia', 'cultura de paz',
      'socioemocional', 'comunidad', 'inclusion', 'solidaridad', 'participacion',
      'jigsaw', 'rompecabezas', 'brigada', 'asamblea', 'acuerdos',
    ],
    metodologiasAfines: ['aprendizaje_servicio', 'abp', 'abproblemas', 'gamificacion'],
    definicionPedagogica:
      'Instrumento graduado que mide el grado e intensidad con que cada integrante del equipo manifiesta actitudes de corresponsabilidad, diálogo empático, apoyo a compañeros con rezago y compromiso ético hacia la comunidad.',
    escalaValoracion: [
      '4 — Destacado (Liderazgo solidario y constante)',
      '3 — Satisfactorio (Cumple activamente los acuerdos)',
      '2 — En Proceso (Participación intermitente)',
      '1 — Inicial (Requiere acompañamiento para integrarse)',
    ],
    columnasTabla: [
      'Atributo Actitudinal y de Trabajo Cooperativo (Saber Ser)',
      'Destacado (4)',
      'Satisfactorio (3)',
      'En Proceso (2)',
      'Inicial (1)',
      'Compromiso de Mejora Acordado en el Equipo',
    ],
    dimensionesBase: [
      'Cumplimiento puntual de su rol y tareas asignadas dentro del equipo',
      'Escucha activa, respeto a opiniones divergentes y diálogo constructivo',
      'Solidaridad e inclusión activa de compañeros que enfrentan barreras (BAP)',
      'Rigor ético, honestidad académica y cuidado de los bienes comunes',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown de Escala Estimativa con rangos "Destacado (4)", "Satisfactorio (3)", "En Proceso (2)" e "Inicial (1)", incluyendo descriptores de actitud, corresponsabilidad y una columna de "Compromiso de Mejora".',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. MATRIZ DE VALORACIÓN DE BITÁCORA DE CAMPO, LABORATORIO O PROCESO
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'bitacora_registro_experimental',
    nombre: 'Matriz de valoración de bitácora de indagación, campo o proceso técnico',
    nombreCorto: 'Matriz de bitácora formativa',
    categoria: 'seguimiento_proceso',
    momentosOptimos: ['desarrollo', 'cierre'],
    agentesSugeridos: ['Heteroevaluación', 'Autoevaluación'],
    familiasAfines: ['fisica_quimica', 'formacion_laboral', 'humanidades_filosofia', 'pensamiento_variacional'],
    tiposEvidenciaCompatibles: ['bitacora', 'bitácora', 'reporte'],
    palabrasClaveArtefacto: [
      'bitacora', 'diario de campo', 'registro de observaciones', 'cuaderno de trabajo',
      'seguimiento', 'iteracion', 'hipotesis', 'observacion', 'encuesta', 'censo',
      'muestreo', 'recoleccion de datos', 'mantenimiento preventivo',
    ],
    metodologiasAfines: ['indagacion', 'practica_laboratorio', 'aprendizaje_servicio', 'abp'],
    definicionPedagogica:
      'Instrumento que evalúa la sistematicidad del registro continuo del estudiante a lo largo de las sesiones: trazabilidad de datos empíricos, bocetos, reformulación de hipótesis, análisis de errores y hallazgos de campo.',
    escalaValoracion: [
      'Registro Completo y Analítico (10-9)',
      'Registro Consistente (8-7)',
      'Registro Parcial o Descriptivo (6-5)',
      'Registro Incompleto (4-1)',
    ],
    columnasTabla: [
      'Componente de la Bitácora / Diario de Campo (%)',
      'Completo y Analítico (10-9)',
      'Consistente (8-7)',
      'Parcial (6-5)',
      'Incompleto (4-1)',
    ],
    dimensionesBase: [
      'Orden cronológico, fechado por sesión y planteamiento de preguntas/hipótesis (20%)',
      'Calidad y veracidad de datos, mediciones, tabulaciones o bocetos de campo (35%)',
      'Análisis de anomalías, errores experimentales y ajustes realizados (25%)',
      'Conclusiones parciales vinculadas con los conceptos de la UAC (20%)',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown para evaluar una Bitácora de Campo/Laboratorio con criterios de trazabilidad cronológica, registro de datos crudos/bocetos, análisis de errores y síntesis conceptual.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. MATRIZ DE VALORACIÓN DE PORTAFOLIO DE EVIDENCIAS DEL CORTE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'portafolio_evidencias_corte',
    nombre: 'Matriz de valoración de portafolio de evidencias y evolución del aprendizaje',
    nombreCorto: 'Matriz de portafolio de evidencias',
    categoria: 'compendio_longitudinal',
    momentosOptimos: ['sumativa', 'cierre'],
    agentesSugeridos: ['Heteroevaluación', 'Autoevaluación'],
    familiasAfines: ['todas'],
    tiposEvidenciaCompatibles: ['portafolio', 'antologia', 'antología', 'producto'],
    palabrasClaveArtefacto: [
      'portafolio', 'carpeta de evidencias', 'compendio', 'expediente',
      'coleccion de trabajos', 'dossier de evidencias', 'memoria del bloque',
    ],
    metodologiasAfines: ['abp', 'abproblemas', 'estudio_casos', 'indagacion'],
    definicionPedagogica:
      'Evalúa la colección intencionada y progresiva de las evidencias generadas durante el corte semestral, valorando especialmente la incorporación de mejoras tras la retroalimentación formativa del docente.',
    escalaValoracion: [
      'Portafolio Destacado con Mejora Continua (10-9)',
      'Portafolio Completo y Organizado (8-7)',
      'Portafolio Básico (6-5)',
      'Portafolio Incompleto (4-1)',
    ],
    columnasTabla: [
      'Criterio de Evaluación del Portafolio (%)',
      'Destacado (10-9)',
      'Completo (8-7)',
      'Básico (6-5)',
      'Incompleto (4-1)',
    ],
    dimensionesBase: [
      'Integridad y completitud de las evidencias formativas del corte (35%)',
      'Atención a la retroalimentación formativa y corrección de versiones previas (30%)',
      'Estructura, clasificación por propósito/progresión y limpieza (15%)',
      'Reflexión metacognitiva sobre el progreso personal alcanzado en el bloque (20%)',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown de Matriz de Valoración de Portafolio evaluando completitud de evidencias, mejora iterativa tras retroalimentación, organización curricular y reflexión de cierre.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. INSTRUMENTO DE EVALUACIÓN DIAGNÓSTICA Y EXPLORACIÓN DE SABERES PREVIOS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'cuestionario_diagnostico_saberes',
    nombre: 'Guía de evaluación diagnóstica y mapeo de saberes previos situados',
    nombreCorto: 'Diagnóstico de saberes previos',
    categoria: 'diagnostica_exploratoria',
    momentosOptimos: ['diagnostica', 'apertura'],
    agentesSugeridos: ['Heteroevaluación', 'Autoevaluación'],
    familiasAfines: ['todas'],
    tiposEvidenciaCompatibles: ['reporte', 'bitacora', 'bitácora', 'producto'],
    palabrasClaveArtefacto: [
      'diagnostico', 'diagnostica', 'saberes previos', 'lluvia de ideas',
      'exploracion', 'encuadre', 'mapa mental inicial', 'cuestionario inicial',
      'sqp', 'preconceptos', 'detonador',
    ],
    metodologiasAfines: ['*'],
    definicionPedagogica:
      'Instrumento cualitativo sin fines punitivos aplicado en la fase de Apertura para identificar el nivel de partida del grupo, preconcepciones intuitivas, referentes culturales locales y necesidades de nivelación académica.',
    escalaValoracion: [
      'Saberes Previos Consolidados',
      'Saberes Intuitivos / Parciales',
      'Requiere Nivelación / Andamiaje Inicial',
    ],
    columnasTabla: [
      'Eje / Prerrequisito o Saber Previo Explorado',
      'Consolidado (Conecta y explica)',
      'Intuitivo / Parcial (Noción cotidiana)',
      'Requiere Andamiaje (Preconcepción o vacío)',
      'Estrategia Docente de Nivelación en Aula',
    ],
    dimensionesBase: [
      'Dominio de conceptos antecedentes indispensables para la unidad',
      'Habilidades procedimentales básicas (lectura comprensiva, operaciones o manejo de herramientas)',
      'Reconocimiento del fenómeno o problemática en su entorno comunitario',
      'Disposición e interés epistémico hacia el reto del bloque',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown de Evaluación Diagnóstica con columnas: "Saber Previo / Prerrequisito Explorado", "Consolidado", "Intuitivo / Parcial", "Requiere Andamiaje" y "Acción Pedagógica de Nivelación".',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. MATRIZ DE EVALUACIÓN DE ESTUDIO DE CASO, DILEMA O DIAGNÓSTICO SITUACIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'guia_analisis_estudio_caso',
    nombre: 'Matriz de valoración de estudio de caso, dilema situado y toma de decisiones',
    nombreCorto: 'Matriz de estudio de caso',
    categoria: 'analisis_situado',
    momentosOptimos: ['desarrollo', 'cierre'],
    agentesSugeridos: ['Heteroevaluación', 'Coevaluación'],
    familiasAfines: ['economico_administrativo', 'humanidades_filosofia', 'pensamiento_variacional', 'fisica_quimica', 'formacion_laboral'],
    tiposEvidenciaCompatibles: ['reporte', 'disertacion', 'disertación', 'fichaTecnica', 'ficha_tecnica'],
    palabrasClaveArtefacto: [
      'estudio de caso', 'caso', 'dilema', 'diagnostico situacional',
      'estudio de mercado', 'analisis de tendencias', 'arbol de problemas',
      'dictamen', 'viabilidad', 'toma de decisiones', 'escenario',
    ],
    metodologiasAfines: ['estudio_casos', 'abproblemas', 'aprendizaje_servicio', 'abr'],
    definicionPedagogica:
      'Evalúa la capacidad analítica y deliberativa de los estudiantes al examinar un caso real del contexto regional: identificación de variables críticas, diagnóstico con datos, contraste de alternativas y fundamentación de la decisión.',
    escalaValoracion: [
      'Análisis Sistémico y Fundamentado (4)',
      'Análisis Pertinente (3)',
      'Análisis Superficial (2)',
      'Análisis Incompleto (1)',
    ],
    columnasTabla: [
      'Fase de Análisis del Caso Situado (%)',
      'Sistémico (4)',
      'Pertinente (3)',
      'Superficial (2)',
      'Incompleto (1)',
    ],
    dimensionesBase: [
      'Delimitación del caso, variables involucradas y actores comunitarios (25%)',
      'Análisis de causas raíz con datos cuantitativos o normativos de la UAC (30%)',
      'Evaluación comparativa de alternativas de solución y riesgos (25%)',
      'Viabilidad técnica, ética y sustentable del dictamen o propuesta (20%)',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown de Matriz de Estudio de Caso evaluando delimitación del problema, análisis cuantitativo/documental de causas, contraste de alternativas y viabilidad de la propuesta.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. PROTOCOLO Y MATRIZ DE PRUEBAS FUNCIONALES DE PROTOTIPO / CÓDIGO / SIMULACIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'matriz_validacion_prototipo_steam',
    nombre: 'Protocolo y matriz de validación funcional de prototipo, modelo o código',
    nombreCorto: 'Matriz de validación de prototipo',
    categoria: 'validacion_ingenieria',
    momentosOptimos: ['cierre', 'desarrollo'],
    agentesSugeridos: ['Heteroevaluación', 'Coevaluación'],
    familiasAfines: ['cultura_digital', 'formacion_laboral', 'fisica_quimica', 'dibujo_tecnico', 'pensamiento_variacional'],
    tiposEvidenciaCompatibles: ['prototipo', 'modelo', 'manual', 'fichaTecnica', 'ficha_tecnica'],
    palabrasClaveArtefacto: [
      'prototipo', 'maqueta', 'circuito', 'codigo', 'algoritmo', 'programa',
      'software', 'simulacion', 'geogebra', 'phet', 'sensor', 'automatizacion',
      'prueba funcional', ' prueba de esfuerzo', 'modelo a escala', 'artefacto digital',
    ],
    metodologiasAfines: ['steam', 'practica_laboratorio', 'abp', 'design_thinking'],
    definicionPedagogica:
      'Instrumento de ingeniería didáctica que somete un prototipo físico, modelo geométrico/a escala o solución digital a casos de prueba verificables para evaluar funcionalidad, tolerancia a fallos, precisión y optimización.',
    escalaValoracion: [
      'Óptimo / Supera Pruebas de Esfuerzo (10-9)',
      'Funcional / Cumple Especificaciones (8-7)',
      'Parcialmente Funcional / Requiere Calibración (6-5)',
      'No Funcional (4-1)',
    ],
    columnasTabla: [
      'Parámetro / Caso de Prueba Funcional (%)',
      'Óptimo (10-9)',
      'Funcional (8-7)',
      'Requiere Calibración (6-5)',
      'No Funcional (4-1)',
    ],
    dimensionesBase: [
      'Cumplimiento de especificaciones de diseño, dimensiones o arquitectura lógica (25%)',
      'Desempeño en pruebas funcionales con datos/condiciones reales de operación (35%)',
      'Detección de fallos, calibración y registro de iteraciones de mejora (20%)',
      'Documentación técnica, manual de usuario y normas de seguridad/sustentabilidad (20%)',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown de Protocolo de Validación de Prototipo/Modelo con casos de prueba funcionales, precisión técnica, calibración/iteración y documentación operativa.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. FORMATO DE AUTOEVALUACIÓN Y ESCALERA DE METACOGNICIÓN NEM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'diario_metacognitivo_autoevaluacion',
    nombre: 'Formato de autoevaluación reflexiva y escalera de metacognición NEM',
    nombreCorto: 'Autoevaluación y metacognición',
    categoria: 'metacognicion_autorregulacion',
    momentosOptimos: ['cierre'],
    agentesSugeridos: ['Autoevaluación'],
    familiasAfines: ['todas'],
    tiposEvidenciaCompatibles: ['bitacora', 'bitácora', 'portafolio', 'reporte'],
    palabrasClaveArtefacto: [
      'autoevaluacion', 'metacognicion', 'reflexion', 'autorregulacion',
      'escalera de metacognicion', 'diario de aprendizaje', 'balance personal',
    ],
    metodologiasAfines: ['*'],
    definicionPedagogica:
      'Instrumento de autorregulación formativa donde el estudiante valora honestamente su dominio de los Tres Saberes (Saber, Saber Hacer, Saber Ser) y reflexiona sobre sus estrategias cognitivas, dificultades superadas y transferencia comunitaria.',
    escalaValoracion: [
      'Lo domino y puedo explicarlo a mis compañeros (4)',
      'Lo aplico de forma autónoma con seguridad (3)',
      'Lo comprendo pero aún requiero consultar ejemplos (2)',
      'Necesito apoyo adicional del docente (1)',
    ],
    columnasTabla: [
      'Dimensión de Aprendizaje / Escalón Metacognitivo',
      'Lo explico a otros (4)',
      'Lo aplico solo (3)',
      'Con apoyo (2)',
      'Requiere refuerzo (1)',
      'Reflexión Personal y Evidencia de Mi Proceso',
    ],
    dimensionesBase: [
      'Dominio conceptual (Saber): ¿Qué conceptos clave aprendí y cómo se conectan?',
      'Dominio procedimental (Saber Hacer): ¿Qué procedimientos o estrategias apliqué con éxito?',
      'Dominio actitudinal (Saber Ser): ¿Cómo contribuí al aprendizaje de mi equipo y comunidad?',
      'Transferencia situada: ¿En qué situación real de mi localidad puedo aplicar lo aprendido?',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown de Autoevaluación y Escalera de Metacognición con los 3 Saberes (Saber, Saber Hacer, Saber Ser), niveles de autonomía (4 a 1) y preguntas abiertas de autorregulación.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. TICKET DE SALIDA Y VERIFICACIÓN RÁPIDA DE CIERRE DE SESIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'ticket_salida_verificacion',
    nombre: 'Ticket de salida y matriz rápida de verificación de cierre de sesión',
    nombreCorto: 'Ticket de salida formativo',
    categoria: 'regulacion_microsesion',
    momentosOptimos: ['cierre', 'desarrollo'],
    agentesSugeridos: ['Heteroevaluación', 'Autoevaluación'],
    familiasAfines: ['todas'],
    tiposEvidenciaCompatibles: ['reporte', 'producto', 'fichaTecnica', 'ficha_tecnica'],
    palabrasClaveArtefacto: [
      'ticket de salida', 'sintesis de sesion', 'comprobacion rapida',
      'cierre de sesion', 'ejercicio de cierre', 'plenaria final',
    ],
    metodologiasAfines: ['*'],
    definicionPedagogica:
      'Instrumento ágil de regulación formativa para los últimos 10 minutos de la sesión o actividad, que permite al docente detectar en caliente quiénes alcanzaron la meta del día y qué dudas deben atenderse al iniciar la siguiente clase.',
    escalaValoracion: [
      'Logro Consolidado (Verde)',
      'Logro en Tránsito (Ámbar — Duda puntual)',
      'Requiere Reenseñanza Focalizada (Rojo)',
    ],
    columnasTabla: [
      'Reactivo / Evidencia Breve del Ticket de Salida',
      'Logro Consolidado (Verde)',
      'En Tránsito (Ámbar)',
      'Requiere Refuerzo (Rojo)',
      'Acción Docente para la Siguiente Sesión',
    ],
    dimensionesBase: [
      'Síntesis con palabras propias del concepto o principio central trabajado',
      'Resolución rápida de un ejercicio o caso breve de transferencia inmediata',
      'Identificación explícita de la duda principal o paso que causó mayor reto',
    ],
    instruccionEstructuraMarkdown:
      'Presenta una tabla Markdown de Ticket de Salida con semáforo formativo (Consolidado, En Tránsito, Requiere Refuerzo) y 3 reactivos breves de verificación cognitiva y metacognitiva.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de Normalización y Búsqueda Inteligente Contextual
// ─────────────────────────────────────────────────────────────────────────────

function normalizarTexto(texto: string | undefined | null): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ContextoSeleccionInstrumento {
  /** Texto de la evidencia o producto a evaluar */
  evidencia?: string;
  /** Nombre de la actividad, propósito formativo o progresión */
  actividadNombre?: string;
  /** Contenido formativo o temas específicos */
  contenidoFormativo?: string;
  /** Nombre de la UAC / Asignatura */
  uacName?: string;
  /** Componente curricular ('fundamental', 'laboral', 'ampliado', etc.) */
  component?: string;
  /** Alias en español de component */
  componente?: string;
  /** Metodología activa seleccionada */
  metodologia?: string;
  /** Familia disciplinar si ya se conoce */
  familiaDisciplinar?: FamiliaDisciplinar;
  /** Tipo de evidencia estructurada si ya se conoce */
  tipoEvidencia?: TipoEvidencia;
  /** Momento didáctico o tipo de evaluación ('Diagnóstica', 'Formativa', 'Sumativa', 'apertura', 'desarrollo', 'cierre') */
  momento?: string;
  /** Agente evaluador ('Heteroevaluación', 'Coevaluación', 'Autoevaluación') */
  agente?: string;
  /** Índice de rotación (0, 1, 2...) para garantizar variedad entre actividades de una misma planeación */
  indiceRotacion?: number;
  /** IDs de instrumentos ya utilizados previamente para evitar repetición monótona */
  instrumentosYaUsados?: Set<string> | string[];
}

/**
 * Infiere la familia disciplinar a partir del nombre de la UAC y su contenido.
 */
export function inferirFamiliaDisciplinarParaInstrumento(
  uacName?: string,
  component?: string,
  contenido?: string
): FamiliaDisciplinar {
  const texto = normalizarTexto(`${uacName || ''} ${component || ''} ${contenido || ''}`);
  if (component === 'laboral' || /\b(submodulo|modulo|taller|mantenimiento|instalacion|soldadura|enfermeria|gastronomia|agropecuari|mecatronica)\b/.test(texto)) {
    return 'formacion_laboral';
  }
  if (/\b(dibujo|plano|croquis|axonometr|isometr|acotacion)\b/.test(texto)) {
    return 'dibujo_tecnico';
  }
  if (/\b(matematic|algebra|geometr|calculo|variacional|estadistic|probabilidad|trigonometr|ecuacion|pitagoras|napoleon)\b/.test(texto)) {
    return 'pensamiento_variacional';
  }
  if (/\b(fisica|quimica|biologia|ecologia|energia|materia|ecosistema|celula|reaccion|termodinamica|cinematica)\b/.test(texto)) {
    return 'fisica_quimica';
  }
  if (/\b(humanidades|filosofia|etica|logica|estetica|historia|conciencia historica)\b/.test(texto)) {
    return 'humanidades_filosofia';
  }
  if (/\b(lengua|comunicacion|ingles|literatura|lectura|redaccion|expresion)\b/.test(texto)) {
    return 'lengua_comunicacion';
  }
  if (/\b(ciencias sociales|economia|administracion|finanzas|derecho|sociologia|contabilidad)\b/.test(texto)) {
    return 'economico_administrativo';
  }
  if (/\b(cultura digital|informatica|programacion|algoritm|software|redes|ciberseguridad|datos)\b/.test(texto)) {
    return 'cultura_digital';
  }
  if (/\b(socioemocional|tutoria|educacion fisica|artes|salud integral|orientacion)\b/.test(texto)) {
    return 'socioemocional';
  }
  return 'otra';
}

/**
 * Selecciona de forma determinista el instrumento de evaluación oficial más pertinente
 * según la actividad, contenido, proyecto o artefacto a evaluar, evitando repetir
 * monótonamente el mismo instrumento cuando se evalúan múltiples actividades.
 */
export function sugerirInstrumentoParaEvidencia(
  ctx: ContextoSeleccionInstrumento
): InstrumentoEvaluacionOficial {
  const corpus = normalizarTexto(
    `${ctx.evidencia || ''} ${ctx.actividadNombre || ''} ${ctx.contenidoFormativo || ''}`
  );
  const momentoNorm = normalizarTexto(ctx.momento);
  const agenteNorm = normalizarTexto(ctx.agente);
  const metNorm = normalizarTexto(ctx.metodologia);
  const familia =
    ctx.familiaDisciplinar ||
    inferirFamiliaDisciplinarParaInstrumento(ctx.uacName, ctx.component || ctx.componente, corpus);

  const usadosSet = new Set<string>(
    Array.isArray(ctx.instrumentosYaUsados)
      ? ctx.instrumentosYaUsados
      : ctx.instrumentosYaUsados
        ? Array.from(ctx.instrumentosYaUsados)
        : []
  );

  // Reglas directas de alta especificidad por momento / agente
  if (momentoNorm.includes('diagnostic') || momentoNorm === 'apertura') {
    if (!usadosSet.has('cuestionario_diagnostico_saberes')) {
      return obtenerInstrumentoPorId('cuestionario_diagnostico_saberes')!;
    }
  }

  if (agenteNorm.includes('autoevaluacion')) {
    if (!usadosSet.has('diario_metacognitivo_autoevaluacion')) {
      return obtenerInstrumentoPorId('diario_metacognitivo_autoevaluacion')!;
    }
  }

  if (agenteNorm.includes('coevaluacion') && !usadosSet.has('escala_estimativa_colaboracion')) {
    if (/\b(equipo|colabora|pares|coevaluacion|proyecto|comunidad|debate)\b/.test(corpus) || (ctx.indiceRotacion ?? 0) % 2 === 1) {
      return obtenerInstrumentoPorId('escala_estimativa_colaboracion')!;
    }
  }

  // Calcular puntaje multicriterio para cada uno de los 14 instrumentos
  const candidatos = CATALOGO_INSTRUMENTOS_EVALUACION.map((inst) => {
    let score = 0;

    // 1. Coincidencia léxica directa con palabras clave de artefacto/contenido (+12 pts por match)
    for (const kw of inst.palabrasClaveArtefacto) {
      const kwNorm = normalizarTexto(kw);
      if (kwNorm && corpus.includes(kwNorm)) {
        score += kwNorm.includes(' ') ? 18 : 12;
      }
    }

    // 2. Afinidad con la familia disciplinar (+10 pts)
    if (inst.familiasAfines.includes(familia)) {
      score += 10;
    } else if (inst.familiasAfines.includes('todas')) {
      score += 4;
    }

    // 3. Afinidad con el tipo de evidencia estructurada (+8 pts)
    if (ctx.tipoEvidencia && inst.tiposEvidenciaCompatibles.includes(ctx.tipoEvidencia)) {
      score += 8;
    }

    // 4. Afinidad con el momento didáctico / tipo de evaluación (+10 pts)
    if (momentoNorm.includes('sumativa') && inst.momentosOptimos.includes('sumativa')) {
      score += 12;
    } else if (momentoNorm.includes('cierre') && inst.momentosOptimos.includes('cierre')) {
      score += 8;
    } else if (momentoNorm.includes('desarrollo') && inst.momentosOptimos.includes('desarrollo')) {
      score += 8;
    } else if (momentoNorm.includes('formativa') && (inst.momentosOptimos.includes('desarrollo') || inst.momentosOptimos.includes('cierre'))) {
      score += 6;
    }

    // 5. Afinidad con el agente evaluador (+8 pts)
    if (agenteNorm.includes('coevaluacion') && inst.agentesSugeridos.includes('Coevaluación')) {
      score += 9;
    } else if (agenteNorm.includes('autoevaluacion') && inst.agentesSugeridos.includes('Autoevaluación')) {
      score += 12;
    } else if (agenteNorm.includes('heteroevaluacion') && inst.agentesSugeridos[0] === 'Heteroevaluación') {
      score += 5;
    }

    // 6. Afinidad con metodología activa (+5 pts)
    if (metNorm && inst.metodologiasAfines.some((m) => m === '*' || metNorm.includes(m))) {
      score += 5;
    }

    // 7. Reglas especiales de desempate disciplinar:
    // Geometría / Trazos / Pitágoras / Napoleón -> Guía de observación práctica o Lista de cotejo técnica
    if (
      /\b(geometr|triangulo|pitagoras|napoleon|angulo|congruencia|semejanza|compas|trazo)\b/.test(corpus) &&
      (inst.id === 'guia_observacion_laboratorio_taller' || inst.id === 'lista_cotejo_producto_tecnico')
    ) {
      score += 22;
    }

    // Finanzas / Demografía / Crecimiento poblacional / Interés compuesto -> Matriz de estudio de caso
    if (
      /\b(finanzas|interes simple|interes compuesto|demografi|crecimiento poblacional|epidemia|presupuesto)\b/.test(corpus) &&
      inst.id === 'guia_analisis_estudio_caso'
    ) {
      score += 24;
    }

    // Sistemas de ecuaciones por múltiples métodos -> Lista de cotejo técnica y procedimental
    if (
      /\b(sistemas de ecuaciones|igualacion|sustitucion|reduccion|determinantes|metodo grafico)\b/.test(corpus) &&
      inst.id === 'lista_cotejo_producto_tecnico'
    ) {
      score += 20;
    }

    // Penalización fuerte si el instrumento ya fue usado en otra fila de la misma planeación
    if (usadosSet.has(inst.id)) {
      score -= 35;
    }

    return { inst, score };
  });

  candidatos.sort((a, b) => b.score - a.score);
  return candidatos[0].inst;
}

/**
 * Busca un instrumento en el catálogo por su ID exacto o por coincidencia semántica en su nombre.
 */
export function obtenerInstrumentoPorId(idONombre?: string | null): InstrumentoEvaluacionOficial | undefined {
  if (!idONombre) return undefined;
  const norm = normalizarTexto(idONombre);

  const exact = CATALOGO_INSTRUMENTOS_EVALUACION.find(
    (i) => i.id === idONombre || normalizarTexto(i.nombre) === norm || normalizarTexto(i.nombreCorto) === norm
  );
  if (exact) return exact;

  // Coincidencia semántica parcial
  if (norm.includes('guia de observacion') || norm.includes('observacion')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'guia_observacion_laboratorio_taller');
  }
  if (norm.includes('escala estimativa') || norm.includes('escala de valoracion') || norm.includes('escala valorativa')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'escala_estimativa_colaboracion');
  }
  if (norm.includes('estudio de caso') || norm.includes('dilema')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'guia_analisis_estudio_caso');
  }
  if (norm.includes('bitacora') || norm.includes('diario de campo') || norm.includes('registro anecdotico')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'bitacora_registro_experimental');
  }
  if (norm.includes('portafolio')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'portafolio_evidencias_corte');
  }
  if (norm.includes('autoevaluacion') || norm.includes('metacognicion') || norm.includes('escalera')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'diario_metacognitivo_autoevaluacion');
  }
  if (norm.includes('ticket de salida')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'ticket_salida_verificacion');
  }
  if (norm.includes('diagnostic') || norm.includes('saberes previos')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'cuestionario_diagnostico_saberes');
  }
  if (norm.includes('prototipo') || norm.includes('prueba funcional')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'matriz_validacion_prototipo_steam');
  }
  if (norm.includes('holistica') || norm.includes('defensa') || norm.includes('debate') || norm.includes('exposicion')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'rubrica_holistica_defensa_oral');
  }
  if (norm.includes('ensayo') || norm.includes('disertacion') || norm.includes('argumenta')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'rubrica_analitica_argumentacion_ensayo');
  }
  if (norm.includes('modelacion') || norm.includes('problemario') || norm.includes('resolucion de problemas')) {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'rubrica_analitica_resolucion_problemas');
  }
  if (norm.includes('lista de cotejo') || norm.includes('lista de verificacion') || norm === 'checklist') {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'lista_cotejo_producto_tecnico');
  }
  if (norm.includes('rubrica') || norm === 'rubric') {
    return CATALOGO_INSTRUMENTOS_EVALUACION.find((i) => i.id === 'rubrica_analitica_proyecto');
  }

  return undefined;
}

/**
 * Diversifica y enriquece un arreglo de filas de evaluación (Sección V de la Planeación)
 * para garantizar variedad real de instrumentos acordes a cada evidencia, actividad y momento,
 * erradicando la repetición genérica de "Rúbrica" y "Lista de cotejo".
 */
export function diversificarInstrumentosEvaluacion<
  T extends {
    type?: string;
    agent?: string;
    moment?: string;
    evidence?: string;
    instrument?: string;
    percentage?: number;
  }
>(
  evaluations: readonly T[] | null | undefined,
  opts?: {
    uacName?: string;
    component?: string;
    componente?: string;
    metodologia?: string;
    activities?: ReadonlyArray<{ name?: string; contenidoFormativo?: string }>;
  }
): T[] {
  if (!Array.isArray(evaluations) || evaluations.length === 0) return [];

  const usados = new Set<string>();
  const activities = opts?.activities || [];

  return evaluations.map((ev, idx) => {
    const rawInst = (ev.instrument || '').trim();
    const normInst = normalizarTexto(rawInst);

    // Detectar si el instrumento actual es genérico ("Rúbrica", "Rúbrica analítica", "Lista de cotejo")
    // o si ya se repitió en una fila previa
    const isGenericRubricOrChecklist =
      !rawInst ||
      normInst === 'rubrica' ||
      normInst === 'rubrica analitica' ||
      normInst === 'lista de cotejo' ||
      normInst === 'cuestionario';

    const matchedExisting = obtenerInstrumentoPorId(rawInst);
    const alreadyUsed = matchedExisting ? usados.has(matchedExisting.id) : false;

    const actMatch = activities[idx] || activities[idx % Math.max(1, activities.length)];

    if (!isGenericRubricOrChecklist && matchedExisting && !alreadyUsed) {
      usados.add(matchedExisting.id);
      return ev;
    }

    const sugerido = sugerirInstrumentoParaEvidencia({
      evidencia: ev.evidence,
      actividadNombre: actMatch?.name || ev.moment,
      contenidoFormativo: actMatch?.contenidoFormativo,
      uacName: opts?.uacName,
      component: opts?.component || opts?.componente,
      metodologia: opts?.metodologia,
      momento: ev.type || ev.moment,
      agente: ev.agent,
      indiceRotacion: idx,
      instrumentosYaUsados: usados,
    });

    usados.add(sugerido.id);

    return {
      ...ev,
      instrument: sugerido.nombre,
    };
  });
}

/**
 * Formatea el repertorio de instrumentos recomendados para inyectar en el prompt
 * de generación de planeaciones didácticas (Sección IV y Sección V).
 */
export function formatearCatalogoInstrumentosParaPrompt(
  uacName?: string,
  component?: string,
  metodologiaActiva?: string
): string {
  const familia = inferirFamiliaDisciplinarParaInstrumento(uacName, component);
  const relevantes = CATALOGO_INSTRUMENTOS_EVALUACION.filter(
    (i) => i.familiasAfines.includes(familia) || i.familiasAfines.includes('todas')
  );

  const lineas = relevantes.map(
    (inst, idx) =>
      `  ${idx + 1}. "${inst.nombre}" [${inst.agentesSugeridos.join('/')}] — Ideal para: ${inst.palabrasClaveArtefacto.slice(0, 6).join(', ')}.`
  );

  return `═══════════ CATÁLOGO OFICIAL DE INSTRUMENTOS DE EVALUACIÓN MCCEMS (SELECCIÓN CONTEXTUAL OBLIGATORIA) ═══════════
PROHIBICIÓN DE MONOCULTIVO EVALUATIVO: Queda ESTRICTAMENTE PROHIBIDO usar únicamente "Rúbrica" y "Lista de cotejo" en todas las filas de evaluación.
Debes seleccionar el instrumento idóneo según el tipo de actividad, contenido disciplinar, práctica, proyecto o artefacto evaluado en cada momento:
${lineas.join('\n')}
${metodologiaActiva ? `• Alinea los instrumentos con la metodología activa (${metodologiaActiva}) y combina al menos 4 instrumentos distintos entre evaluación diagnóstica, formativa (hetero/co/autoevaluación) y sumativa.` : '• Combina al menos 4 instrumentos distintos del catálogo entre evaluación diagnóstica, formativa y sumativa.'}
`;
}
