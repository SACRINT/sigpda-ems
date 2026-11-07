/**
 * src/lib/curriculum-evidence-engine.ts
 * Motor determinista de Evidencias Formativas Disciplinares y Producto Integrador Situado.
 *
 * Principios:
 * 1. Las evidencias del Paso 2 se DERIVAN funcionalmente de las metas, verbos operativos
 *    y categorías de las progresiones oficiales de la UAC (cero lookups de texto estático).
 * 2. El Producto Integrador del Paso 3/4 se COMPONE de forma situada mediante:
 *    compose(evidenciasDisciplinares, problemaPAEC, metodologiaActiva).
 * 3. Módulo puro: sin fs, path, crypto, Buffer ni APIs de Node.js.
 *    100% compatible con 'use client' en el navegador y con Route Handlers en el servidor.
 */

// ---------------------------------------------------------------------------
// 0. Tipos y Dominios Taxonómicos (Bloom + MCCEMS)
// ---------------------------------------------------------------------------

export type NivelCognitivo =
  | 'recordar'
  | 'entender'
  | 'aplicar'
  | 'analizar'
  | 'evaluar'
  | 'crear';

export type TipoEvidencia =
  | 'producto'
  | 'portafolio'
  | 'reporte'
  | 'prototipo'
  | 'bitacora'
  | 'bitácora'
  | 'modelo'
  | 'croquis'
  | 'disertacion'
  | 'disertación'
  | 'antologia'
  | 'antología'
  | 'manual'
  | 'fichaTecnica'
  | 'ficha_tecnica';

export type FamiliaDisciplinar =
  | 'dibujo_tecnico'
  | 'pensamiento_variacional'
  | 'fisica_quimica'
  | 'humanidades_filosofia'
  | 'lengua_comunicacion'
  | 'economico_administrativo'
  | 'formacion_laboral'
  | 'socioemocional'
  | 'cultura_digital'
  | 'otra';

export interface VerboDisciplinar {
  verbo: string;
  stem: string;
  familia: FamiliaDisciplinar;
  nivelCognitivo: NivelCognitivo;
  tipoEvidenciaSugerido: TipoEvidencia;
  prefijoArtefacto: string;
}

export interface EvidenciaDisciplinar {
  id: string;
  orden: number;
  tipo: TipoEvidencia;
  nivelCognitivo: NivelCognitivo;
  verboDisciplinar: string;
  producto: string;
  descripcion: string;
  criterios: string[];
  fuente: 'derivada' | 'docente';
  progresionOrigen: number;
}

export interface DocenteOverride {
  eliminados?: string[];
  editadas?: Record<string, Partial<EvidenciaDisciplinar>>;
  nuevas?: EvidenciaDisciplinar[];
}

export interface MetodologiaActiva {
  id: string;
  nombre: string;
}
export type MetodologíaActiva = MetodologiaActiva;

export interface ProblemaPAEC {
  texto: string;
  comunidad?: string;
  alcance?: 'plantel' | 'localidad' | 'municipio';
}

export interface FaseDidactica {
  momento: 'apertura' | 'desarrollo' | 'cierre';
  actividad: string;
  responsable: 'docente' | 'estudiante' | 'ambos';
  tiempoMinutos?: number;
  proposito?: string;
}

export interface ProductoIntegrador {
  id: string;
  artefacto: string;
  descripcion: string;
  fases: FaseDidactica[];
  aplicacionComunitaria: string;
  criteriosIntegracion: string[];
  metodologia: MetodologiaActiva;
  problemaPAEC: ProblemaPAEC;
  evidenciasReferenciadas: string[];
}

export interface ProgresionResumida {
  orden: number;
  nombre?: string;
  descripcion: string;
  contenidos?: string[];
  metas?: string[];
  categorias?: string[];
  subcategorias?: string[];
}
export type ProgresiónResumida = ProgresionResumida;

export interface ContenidoFormativoFuente {
  order?: number;
  numero?: number;
  proposito?: string;
  progresion?: string;
  actividad?: string;
  contenidos?: string[] | string;
  metas?: string[];
  saberes?: string[];
  categorias?: string[];
  subcategorias?: string[];
}

export interface ActividadFuente {
  order?: number;
  name?: string;
}

// ---------------------------------------------------------------------------
// 1. Taxonomía de Verbos Operativos por Familia Disciplinar
// ---------------------------------------------------------------------------

export const TAXONOMIA_VERBOS: VerboDisciplinar[] = [
  // ── Dibujo Técnico ──
  { verbo: 'trazar', stem: 'traz', familia: 'dibujo_tecnico', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'croquis', prefijoArtefacto: 'Lámina de trazo técnico y rotulación normalizada de' },
  { verbo: 'dibujar', stem: 'dibuj', familia: 'dibujo_tecnico', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'croquis', prefijoArtefacto: 'Croquis acotado y dibujo a escala de' },
  { verbo: 'proyectar', stem: 'proyect', familia: 'dibujo_tecnico', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'modelo', prefijoArtefacto: 'Lámina de proyecciones ortogonales y vistas diédricas de' },
  { verbo: 'representar', stem: 'represen', familia: 'dibujo_tecnico', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'modelo', prefijoArtefacto: 'Plano técnico y modelado axonométrico (isométrico) de' },
  { verbo: 'normalizar', stem: 'normaliz', familia: 'dibujo_tecnico', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Plano acotado con especificaciones y simbología normalizada de' },
  { verbo: 'elaborar', stem: 'elabor', familia: 'dibujo_tecnico', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'croquis', prefijoArtefacto: 'Croquis acotado y dibujo a escala de' },

  // ── Pensamiento Variacional y Matemáticas ──
  { verbo: 'modelar', stem: 'model', familia: 'pensamiento_variacional', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'modelo', prefijoArtefacto: 'Modelo matemático de funciones y análisis gráfico de' },
  { verbo: 'calcular', stem: 'calcul', familia: 'pensamiento_variacional', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Reporte analítico de cálculo de razones de cambio y derivadas de' },
  { verbo: 'optimizar', stem: 'optimi', familia: 'pensamiento_variacional', nivelCognitivo: 'evaluar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Estudio de optimización matemática de variables y costos de' },
  { verbo: 'graficar', stem: 'grafic', familia: 'pensamiento_variacional', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Gráficas de comportamiento dinámico y análisis de puntos críticos de' },
  { verbo: 'analizar', stem: 'analiz', familia: 'pensamiento_variacional', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Reporte analítico y resolución formal de problemas de' },

  // ── Física y Química (Ciencias Naturales) ──
  { verbo: 'experimentar', stem: 'experimen', familia: 'fisica_quimica', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Reporte de práctica experimental y toma sistemática de datos de' },
  { verbo: 'medir', stem: 'med', familia: 'fisica_quimica', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Registro experimental de mediciones, magnitudes y análisis de error de' },
  { verbo: 'observar', stem: 'observ', familia: 'fisica_quimica', nivelCognitivo: 'entender', tipoEvidenciaSugerido: 'bitacora', prefijoArtefacto: 'Bitácora de observación experimental y registro fenomenológico de' },
  { verbo: 'analizar', stem: 'analiz', familia: 'fisica_quimica', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Reporte analítico con balance cuantitativo y fundamentación teórica de' },

  // ── Humanidades y Filosofía ──
  { verbo: 'argumentar', stem: 'argumen', familia: 'humanidades_filosofia', nivelCognitivo: 'evaluar', tipoEvidenciaSugerido: 'disertacion', prefijoArtefacto: 'Disertación filosófica y argumentación crítica sobre' },
  { verbo: 'reflexionar', stem: 'reflex', familia: 'humanidades_filosofia', nivelCognitivo: 'evaluar', tipoEvidenciaSugerido: 'disertacion', prefijoArtefacto: 'Ensayo reflexivo y diálogo socrático en torno a' },
  { verbo: 'analizar', stem: 'analiz', familia: 'humanidades_filosofia', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'antologia', prefijoArtefacto: 'Fichero analítico de dilemas éticos y lecturas contextualizadas de' },
  { verbo: 'construir', stem: 'constru', familia: 'humanidades_filosofia', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Construcción y sustentación argumentada de' },
  { verbo: 'cuestionar', stem: 'cuestion', familia: 'humanidades_filosofia', nivelCognitivo: 'evaluar', tipoEvidenciaSugerido: 'disertacion', prefijoArtefacto: 'Cuestionario crítico y argumentación sobre' },
  { verbo: 'explicar', stem: 'explic', familia: 'humanidades_filosofia', nivelCognitivo: 'entender', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Explicación razonada y reporte de' },
  { verbo: 'comprender', stem: 'comprend', familia: 'humanidades_filosofia', nivelCognitivo: 'entender', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Reporte de comprensión y síntesis de' },
  { verbo: 'interpretar', stem: 'interpret', familia: 'humanidades_filosofia', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Reporte interpretativo y análisis de' },
  { verbo: 'investigar', stem: 'investig', familia: 'humanidades_filosofia', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Reporte de investigación sobre' },
  { verbo: 'comparar', stem: 'compar', familia: 'humanidades_filosofia', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Cuadro comparativo y análisis de' },

  // ── Lengua y Comunicación ──
  { verbo: 'redactar', stem: 'redac', familia: 'lengua_comunicacion', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'disertacion', prefijoArtefacto: 'Composición de texto argumentativo / ensayo estructurado sobre' },
  { verbo: 'comunicar', stem: 'comunic', familia: 'lengua_comunicacion', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Guion y exposición oral formal con evidencia multimedia sobre' },
  { verbo: 'analizar', stem: 'analiz', familia: 'lengua_comunicacion', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'antologia', prefijoArtefacto: 'Antología crítica y análisis de textos literarios e informativos de' },

  // ── Económico Administrativo ──
  { verbo: 'diagnosticar', stem: 'diagnost', familia: 'economico_administrativo', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Diagnóstico situacional y estudio de mercado de' },
  { verbo: 'gestionar', stem: 'gestion', familia: 'economico_administrativo', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Plan operativo de gestión y administración de' },
  { verbo: 'administrar', stem: 'administr', familia: 'economico_administrativo', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Plan de gestión operativa y reporte de desempeño de' },
  { verbo: 'presupuestar', stem: 'presupues', familia: 'economico_administrativo', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'fichaTecnica', prefijoArtefacto: 'Cédula presupuestal y proyección de flujo financiero de' },

  // ── Formación Laboral y Técnica ──
  { verbo: 'diagnosticar', stem: 'diagnost', familia: 'formacion_laboral', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'fichaTecnica', prefijoArtefacto: 'Ficha técnica de diagnóstico operativo y detección de fallas en' },
  { verbo: 'mantener', stem: 'manten', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'bitacora', prefijoArtefacto: 'Bitácora técnica de mantenimiento preventivo y correctivo en' },
  { verbo: 'reparar', stem: 'repar', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'prototipo', prefijoArtefacto: 'Demostración práctica de protocolo técnico estandarizado para' },
  { verbo: 'elaborar', stem: 'elabor', familia: 'formacion_laboral', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'manual', prefijoArtefacto: 'Manual de procedimientos operativos y control de calidad en' },
  { verbo: 'administrar', stem: 'administr', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Plan de gestión operativa y reporte de desempeño de' },
  { verbo: 'configurar', stem: 'configur', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Configuración técnica documentada y prueba funcional de' },
  { verbo: 'operar', stem: 'oper', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Reporte técnico de operación y control de' },
  { verbo: 'instalar', stem: 'instal', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'prototipo', prefijoArtefacto: 'Protocolo de instalación y puesta en marcha de' },
  { verbo: 'ensamblar', stem: 'ensambl', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'prototipo', prefijoArtefacto: 'Ensamblaje y prueba funcional de' },
  { verbo: 'calibrar', stem: 'calibr', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Reporte de calibración y control metrológico de' },
  { verbo: 'supervisar', stem: 'supervis', familia: 'formacion_laboral', nivelCognitivo: 'evaluar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Reporte de supervisión y control de calidad de' },
  { verbo: 'verificar', stem: 'verific', familia: 'formacion_laboral', nivelCognitivo: 'evaluar', tipoEvidenciaSugerido: 'fichaTecnica', prefijoArtefacto: 'Lista de verificación y ficha técnica de' },
  { verbo: 'registrar', stem: 'registr', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Registro técnico y reporte de control de' },
  { verbo: 'preparar', stem: 'prepar', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Protocolo y producto preparado de' },
  { verbo: 'producir', stem: 'produc', familia: 'formacion_laboral', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Producto terminado y ficha de producción de' },
  { verbo: 'seleccionar', stem: 'seleccion', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'fichaTecnica', prefijoArtefacto: 'Ficha de selección técnica de' },

  // ── Socioemocional ──
  { verbo: 'reflexionar', stem: 'reflex', familia: 'socioemocional', nivelCognitivo: 'evaluar', tipoEvidenciaSugerido: 'bitacora', prefijoArtefacto: 'Bitácora socioemocional y plan de autorregulación sobre' },
  { verbo: 'colaborar', stem: 'colabor', familia: 'socioemocional', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'portafolio', prefijoArtefacto: 'Portafolio de dinámicas de integración comunitaria y cultura de paz en' },

  // ── Cultura Digital ──
  { verbo: 'diseñar', stem: 'disen', familia: 'cultura_digital', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'prototipo', prefijoArtefacto: 'Prototipo digital interactivo o solución algorítmica para' },
  { verbo: 'programar', stem: 'program', familia: 'cultura_digital', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'modelo', prefijoArtefacto: 'Código fuente ejecutable y documentación técnica de' },

  // ── Otra / General ──
  { verbo: 'aplicar', stem: 'aplic', familia: 'otra', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Producto integrador de aplicación práctica de' },
  { verbo: 'desarrollar', stem: 'desarroll', familia: 'otra', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Proyecto de desarrollo formativo sobre' },
];

// ---------------------------------------------------------------------------
// 2. Función de Stemming Real en Español
// ---------------------------------------------------------------------------

/**
 * Reduce una palabra o conjugación verbal en español a su raíz léxica (stem).
 * Ejemplos:
 *  - "traza", "trazó", "trazando", "trazar" -> "traz"
 *  - "calcula", "calcular", "calculando" -> "calcul"
 *  - "modela", "modelar", "modelando" -> "model"
 *  - "argumenta", "argumentar", "argumentando" -> "argumen"
 *  - "representa", "representaciones" -> "represen"
 */
export function stemEspanol(palabra: string): string {
  if (!palabra) return '';
  let s = palabra
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remueve acentos y diacríticos

  // Mapeos léxicos directos prioritarios para verbos educativos fundamentales
  if (s.startsWith('argumen')) return 'argumen';
  if (s.startsWith('traz')) return 'traz';
  if (s.startsWith('calcul')) return 'calcul';
  if (s.startsWith('model')) return 'model';
  if (s.startsWith('represen')) return 'represen';
  if (s.startsWith('proyect')) return 'proyect';
  if (s.startsWith('optimi')) return 'optimi';
  if (s.startsWith('grafic')) return 'grafic';
  if (s.startsWith('diagnost')) return 'diagnost';
  if (s.startsWith('manten')) return 'manten';
  if (s.startsWith('repar')) return 'repar';
  if (s.startsWith('elabor')) return 'elabor';
  if (s.startsWith('disen') || s.startsWith('diseñ')) return 'disen';
  if (s.startsWith('experimen')) return 'experimen';
  if (s.startsWith('reflex')) return 'reflex';
  if (s.startsWith('redac')) return 'redac';
  if (s.startsWith('normaliz')) return 'normaliz';
  if (s.startsWith('dibuj')) return 'dibuj';
  if (s.startsWith('colabor')) return 'colabor';
  if (s.startsWith('program')) return 'program';
  if (s.startsWith('observ')) return 'observ';
  if (s.startsWith('aplic')) return 'aplic';
  if (s.startsWith('desarroll')) return 'desarroll';

  // Descascarado determinista de sufijos verbales en español (Snowball)
  const suffixes = [
    'aciones', 'iciones', 'amiento', 'imiento', 'acion', 'icion',
    'andose', 'iendose', 'endose',
    'aremos', 'eremos', 'iremos',
    'ando', 'iendo', 'aron', 'ieron',
    'ados', 'adas', 'idos', 'idas',
    'amos', 'emos', 'imos',
    'ado', 'ada', 'ido', 'ida',
    'aba', 'ian', 'ias', 'ria',
    'ais', 'eis', 'an', 'en', 'as', 'es',
    'ar', 'er', 'ir',
    'ia', 'io',
    'a', 'e', 'o'
  ];

  for (const suf of suffixes) {
    if (s.length - suf.length >= 3 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length);
      break;
    }
  }

  return s;
}

// ---------------------------------------------------------------------------
// 3. Helpers Puros
// ---------------------------------------------------------------------------

export function slugify(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

export function detectarFamilia(uacName: string, component?: string): FamiliaDisciplinar {
  const n = (uacName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const c = (component || '').toLowerCase();

  if (c === 'laboral') return 'formacion_laboral';
  if (c === 'socioemocional') return 'socioemocional';
  if (/dibujo|plano|trazado|proyecci/.test(n)) return 'dibujo_tecnico';
  if (/variacional|calculo|matematic|algebra|funciones|derivada/.test(n)) return 'pensamiento_variacional';
  if (/fisica|quimica|ciencias naturales|materia|energia/.test(n)) return 'fisica_quimica';
  if (/filosofia|humanidades|etica|logica|estetica/.test(n)) return 'humanidades_filosofia';
  if (/lengua|comunicacion|literatura|redaccion|ingles/.test(n)) return 'lengua_comunicacion';
  if (/economia|administracion|contabil|finanz|derecho|ciencias sociales/.test(n)) return 'economico_administrativo';
  if (/cultura digital|informatica|programacion|tics/.test(n)) return 'cultura_digital';
  return 'otra';
}

function normalizarEvidenciaParaComparar(texto: string): string {
  return (texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const PATRONES_EVIDENCIA_GENERICA: RegExp[] = [
  /^ensayo critico\b/,
  /^portafolio de evidencias de aprendizaje(?: y evaluacion formativa)?$/,
  /^portafolio de evidencias$/,
  /^portafolio de evidencias integrador$/,
  /^portafolio de evidencias de capacitacion$/,
  /^evidencia de aprendizaje\s*\/\s*producto$/,
  /^reporte de practica$/,
  /^reporte de practica\s*\/\s*demostracion tecnica\b/,
  /^portafolio de desempeno en\b/,
  /^portafolio de evidencias de practicas tecnicas y de laboratorio$/,
  /^reporte tecnico de ejecucion de competencias laborales$/,
  /^guia de observacion\s*\/\s*rubrica de desempeno tecnico profesional$/,
  /^proyecto integrador$/,
  /^producto integrador$/,
  /^evaluacion formativa$/,
];

/**
 * Detecta evidencias de relleno o plantillas repetidas que no describen un
 * producto disciplinar específico. Se usa tanto en el cliente (Paso 2) como
 * en el servidor (prompt) para forzar la derivación desde las progresiones.
 */
export function esEvidenciaGenerica(evidencia: string): boolean {
  const normalizada = normalizarEvidenciaParaComparar(evidencia);
  if (!normalizada) return true;
  return PATRONES_EVIDENCIA_GENERICA.some((patron) => patron.test(normalizada));
}

/**
 * True cuando el conjunto de evidencias debe sustituirse por evidencias
 * derivadas de las progresiones/actividades oficiales.
 */
export function requiereDerivacionEvidencias(evidencias?: string[] | null): boolean {
  const validas = (evidencias ?? []).map((e) => (e || '').trim()).filter(Boolean);
  return validas.length === 0 || validas.some(esEvidenciaGenerica);
}

function textoDeContenido(cf: ContenidoFormativoFuente): string {
  const directo = (cf.progresion || cf.proposito || cf.actividad || '').trim();
  if (directo) return directo;

  if (Array.isArray(cf.contenidos)) {
    return cf.contenidos.map((c) => (c || '').trim()).filter(Boolean).join('. ');
  }
  return (cf.contenidos || '').trim();
}

/**
 * Construye progresiones resumidas a partir de los contenidos formativos o,
 * en su defecto, de las actividades clave. Soporta los formatos BGE
 * (proposito/progresion) y Bachillerato Técnico (actividad/saberes).
 */
export function construirProgresionesResumidas(
  contenidosFormativos?: ContenidoFormativoFuente[] | null,
  actividades?: ActividadFuente[] | null
): ProgresionResumida[] {
  const desdeContenidos: ProgresionResumida[] = (contenidosFormativos ?? []).map((cf, idx) => {
    const orden = cf.order || cf.numero || (idx + 1);
    const descripcion = textoDeContenido(cf);
    const listaContenidos = Array.isArray(cf.contenidos)
      ? cf.contenidos.map((c) => (c || '').trim()).filter(Boolean)
      : typeof cf.contenidos === 'string' && cf.contenidos.trim()
        ? [cf.contenidos.trim()]
        : (cf.saberes ?? []).map((s) => (s || '').trim()).filter(Boolean);

    return {
      orden,
      nombre: descripcion || `Progresión ${orden}`,
      descripcion,
      ...(listaContenidos.length > 0 ? { contenidos: listaContenidos } : {}),
      metas: (cf.metas ?? []).filter((m) => (m || '').trim().length > 3),
      categorias: cf.categorias ?? [],
      subcategorias: cf.subcategorias ?? [],
    };
  });

  if (desdeContenidos.some((p) => (p.descripcion || '').trim().length > 0)) {
    return desdeContenidos;
  }

  return (actividades ?? []).map((a, idx) => ({
    orden: a.order || (idx + 1),
    nombre: (a.name || '').trim() || `Progresión ${idx + 1}`,
    descripcion: (a.name || '').trim(),
    metas: [],
    categorias: [],
    subcategorias: [],
  }));
}

function prefijoFallbackPorFamilia(familia: FamiliaDisciplinar): string {
  switch (familia) {
    case 'dibujo_tecnico':
      return 'Lámina técnica normalizada de';
    case 'pensamiento_variacional':
      return 'Reporte de aplicación matemática de';
    case 'fisica_quimica':
      return 'Reporte experimental de';
    case 'humanidades_filosofia':
      return 'Producto argumentativo sobre';
    case 'lengua_comunicacion':
      return 'Producto comunicativo sobre';
    case 'economico_administrativo':
      return 'Reporte de gestión de';
    case 'formacion_laboral':
      return 'Reporte técnico de ejecución de';
    case 'socioemocional':
      return 'Bitácora socioemocional de';
    case 'cultura_digital':
      return 'Producto digital de';
    default:
      return 'Producto integrador de aplicación práctica de';
  }
}

function limpiarTextoNucleo(texto: string): string {
  return (texto || '')
    .replace(/^(?:progresi[oó]n|prop[oó]sito|etapa|c\d+m\d+|\d+)\s*[:.\-–—]?\s*/i, '')
    .replace(/^(?:el\s+estudiante|las\s+y\s+los\s+estudiantes|las\s+y\s+los\s+aprendientes|comprende\s+que|analiza\s+que)\s*/i, '')
    .replace(
      /^(?:aplica\s+la\s+aritm[eé]tica(?:,\s*el\s+manejo\s+del\s+[aá]lgebra\s+y\s+el\s+m[eé]todo\s+gr[aá]fico|\s+y\s+el\s+manejo\s+del\s+[aá]lgebra)\s+para\s+)/i,
      ''
    )
    .replace(
      /^(?:expresa\s+y\s+resuelve\s+diversas\s+situaciones\s+de\s+inter[eé]s\s+a\s+trav[eé]s\s+de\s+)/i,
      ''
    )
    .replace(/^revisa\s+el\s+/i, '')
    .replace(/\s*,?\s*que\s+refieran\s+a\s+situaciones\s+de\s+inter[eé]s\.?$/i, '')
    .replace(/\s*,?\s*para\s+comprender\s+su\s+relevancia\s+en\s+otras\s+[aá]reas.*$/i, '')
    .replace(
      /\s*,?\s*consider[aá]ndolo\s+como\s+un\s+problema-meta\s+para\s+aplicar\s+resultados\s+de\s+la\s+(geometr[ií]a\s+euclidiana)\.?$/i,
      ' y $1'
    )
    .replace(/\.$/, '')
    .trim();
}

function truncarEnPalabra(texto: string, maxLen = 160): string {
  if (texto.length <= maxLen) return texto;
  const corte = texto.slice(0, maxLen - 3);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return `${ultimoEspacio > 40 ? corte.slice(0, ultimoEspacio) : corte}...`;
}

function enriquecerNucleoConContenidos(nucleo: string, contenidos?: string[]): string {
  if (!contenidos || contenidos.length === 0) return truncarEnPalabra(nucleo, 160);
  const nucleoNorm = normalizarEvidenciaParaComparar(nucleo);
  const faltantes = contenidos
    .map((c) => (c || '').replace(/\.$/, '').trim())
    .filter((c) => c.length > 2 && !nucleoNorm.includes(normalizarEvidenciaParaComparar(c)));

  if (faltantes.length === 0) return truncarEnPalabra(nucleo, 160);
  const resumenTemas = faltantes.slice(0, 3).join(', ');
  const combinado = `${nucleo} (${resumenTemas})`;
  return truncarEnPalabra(combinado, 160);
}

/**
 * Busca un verbo disciplinar en un fragmento de texto contrastando los stems de sus palabras.
 */
function clasificarVerboEnTexto(texto: string, familia: FamiliaDisciplinar): VerboDisciplinar | null {
  const tokens = texto
    .split(/[\s,.;:()•\-–—]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3);

  for (const token of tokens) {
    const st = stemEspanol(token);
    // 1. Intentar coincidencia en la familia de la UAC
    const matchFamilia = TAXONOMIA_VERBOS.find(v => v.familia === familia && (v.stem === st || st.startsWith(v.stem)));
    if (matchFamilia) return matchFamilia;

    // 2. Para familias no identificadas, buscar en la taxonomía general.
    //    En familias conocidas se evita el cruce semántico (ej. "medir" en dibujo
    //    no debe convertirse en una práctica experimental de Física).
    if (familia === 'otra') {
      const matchGeneral = TAXONOMIA_VERBOS.find(v => v.stem === st || st.startsWith(v.stem));
      if (matchGeneral) return matchGeneral;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 4. Motor de Derivación de Evidencias Disciplinares (Paso 2)
// ---------------------------------------------------------------------------

/**
 * Deriva deterministamente Evidencias Disciplinares a partir de las progresiones reales.
 * Cero fallbacks estáticos como "Ensayo crítico en [UAC]".
 */
export function derivarEvidenciasDisciplinares(
  progresiones: ProgresionResumida[],
  uacName: string,
  component?: string,
  docenteOverrides?: DocenteOverride
): EvidenciaDisciplinar[] {
  const familia = detectarFamilia(uacName, component);
  const eliminados = new Set(docenteOverrides?.eliminados ?? []);
  const editadas = docenteOverrides?.editadas ?? {};
  const nuevas = docenteOverrides?.nuevas ?? [];

  const derivadas: EvidenciaDisciplinar[] = [];
  const verbosRegistrados = new Set<string>();
  const productosRegistrados = new Set<string>();

  for (const prog of progresiones) {
    const orden = prog.orden || 1;
    // Si la progresión tiene metas definidas, extraer de cada una
    const metasValidas = (prog.metas || []).filter(m => (m || '').trim().length > 3);
    const fuentesAnalisis = metasValidas.length > 0 ? metasValidas : [prog.descripcion || prog.nombre || ''];

    for (const fuente of fuentesAnalisis) {
      const clasificado = clasificarVerboEnTexto(fuente, familia) || {
        verbo: 'aplicar',
        stem: 'aplic',
        familia,
        nivelCognitivo: 'aplicar' as NivelCognitivo,
        tipoEvidenciaSugerido: (familia === 'dibujo_tecnico' ? 'croquis' : familia === 'pensamiento_variacional' ? 'reporte' : 'producto') as TipoEvidencia,
        prefijoArtefacto: prefijoFallbackPorFamilia(familia),
      };

      // Evitar duplicar el mismo verbo dentro de la misma progresión
      const claveUnica = `${orden}-${clasificado.verbo}`;
      if (verbosRegistrados.has(claveUnica)) continue;
      verbosRegistrados.add(claveUnica);

      const id = slugify(`${uacName}-${orden}-${clasificado.verbo}`);
      if (eliminados.has(id)) continue;

      const nucleoBase = limpiarTextoNucleo(fuente || prog.descripcion || '');
      const nucleoCorto = metasValidas.length > 0
        ? truncarEnPalabra(nucleoBase, 160)
        : enriquecerNucleoConContenidos(nucleoBase, prog.contenidos);
      const producto = nucleoCorto
        ? `${clasificado.prefijoArtefacto} ${nucleoCorto.toLowerCase()}`
        : `${clasificado.prefijoArtefacto} saberes disciplinares`;

      const descripcion = `Estudiante ejecuta la acción formativa "${clasificado.verbo}" aplicando saberes de ${familia.replace(/_/g, ' ')} sobre: ${nucleoBase}. Evidencia formativa técnica de proceso y desempeño.`;

      const criterios = [
        `Rigor técnico y procedimental en la acción de ${clasificado.verbo}.`,
        `Aplicación consistente de normatividad, fórmulas o lenguajes propios de ${familia.replace(/_/g, ' ')}.`,
        `Claridad en la presentación del producto conforme a estándares del MCCEMS.`,
      ];

      const base: EvidenciaDisciplinar = {
        id,
        orden,
        tipo: clasificado.tipoEvidenciaSugerido,
        nivelCognitivo: clasificado.nivelCognitivo,
        verboDisciplinar: clasificado.verbo,
        producto,
        descripcion,
        criterios,
        fuente: 'derivada',
        progresionOrigen: orden,
      };

      const override = editadas[id];
      const final = override
        ? { ...base, ...override, fuente: override.fuente ?? 'derivada' }
        : base;
      const claveProductoFinal = normalizarEvidenciaParaComparar(final.producto);
      if (productosRegistrados.has(claveProductoFinal)) continue;
      productosRegistrados.add(claveProductoFinal);
      derivadas.push(final);
    }
  }

  // Si no se pudo derivar ninguna por falta de textos, fallback disciplinar seguro (nunca ensayo genérico)
  if (derivadas.length === 0) {
    const fallbackVerbo = TAXONOMIA_VERBOS.find(v => v.familia === familia) || TAXONOMIA_VERBOS[0];
    const id = slugify(`${uacName}-1-${fallbackVerbo.verbo}`);
    if (!eliminados.has(id)) {
      derivadas.push({
        id,
        orden: 1,
        tipo: fallbackVerbo.tipoEvidenciaSugerido,
        nivelCognitivo: fallbackVerbo.nivelCognitivo,
        verboDisciplinar: fallbackVerbo.verbo,
        producto: `${fallbackVerbo.prefijoArtefacto} contenidos esenciales de ${uacName}`,
        descripcion: `Evidencia disciplinar formativa desarrollada para la UAC ${uacName}.`,
        criterios: ['Dominio disciplinar', 'Calidad metodológica', 'Presentación en tiempo y forma'],
        fuente: 'derivada',
        progresionOrigen: 1,
      });
    }
  }

  // Incorporar evidencias agregadas por el docente (fuente: docente)
  if (Array.isArray(nuevas)) {
    for (const nueva of nuevas) {
      derivadas.push({
        ...nueva,
        fuente: 'docente',
      });
    }
  }

  return derivadas;
}

const STOPWORDS_COBERTURA_CURRICULAR = new Set([
  'para', 'como', 'con', 'por', 'los', 'las', 'una', 'uno', 'unos', 'unas',
  'del', 'al', 'que', 'sus', 'sobre', 'entre', 'mediante', 'traves', 'hacia',
  'aplica', 'aplicar', 'aplicacion', 'contextualizada', 'resuelve', 'resolver',
  'resolucion', 'situaciones', 'interes', 'distintos', 'distintas', 'tipos',
  'diversas', 'diversos', 'problemas', 'problema', 'meta', 'resultados',
  'concepto', 'conceptos', 'procedimiento', 'procedimientos', 'forma', 'formas',
  'general', 'estandar', 'manejo', 'estudio', 'analisis', 'analiza', 'analizar',
  'comprende', 'comprender', 'revisa', 'revisar', 'expresa', 'expresar',
  'identifica', 'identificar', 'describe', 'describir', 'descripcion',
  'determinar', 'determina', 'encontrar', 'encuentra', 'valor', 'valores',
  'parte', 'partes', 'metodo', 'metodos', 'multiples', 'basicos', 'basicas',
  'introduccion', 'definicion', 'componentes', 'elementos', 'relevancia',
  'otras', 'areas', 'conocimiento', 'fenomenos', 'naturales', 'esferas',
  'vida', 'humana', 'cotidiana', 'cotidianas', 'contexto', 'contextos',
  'reporte', 'problemario', 'proyecto', 'portafolio', 'bitacora', 'ensayo',
  'practica', 'tecnica', 'tecnico', 'manual', 'ficha', 'lamina', 'croquis',
]);

function extraerTokensDominio(texto: string): string[] {
  const norm = normalizarEvidenciaParaComparar(texto);
  return norm
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS_COBERTURA_CURRICULAR.has(t));
}

function tokensCoinciden(t1: string, t2: string): boolean {
  if (t1 === t2) return true;
  const minLen = Math.min(t1.length, t2.length);
  if (minLen >= 5 && (t1.startsWith(t2.slice(0, 5)) || t2.startsWith(t1.slice(0, 5)))) {
    return true;
  }
  return false;
}

/**
 * Guardián de Cobertura Curricular de Evidencias.
 * Si no hay evidencias o contienen genéricos, deriva el conjunto completo.
 * Si existen evidencias válidas en el catálogo (ej. 3 de álgebra), las preserva
 * y verifica que cada propósito/progresión esté cubierto. Para cualquier propósito
 * huérfano (ej. Geometría / Napoleón / Pitágoras), deriva e inyecta su evidencia
 * disciplinar correspondiente de forma idempotente.
 */
export function asegurarCoberturaEvidenciasEstructuradas(
  evidenciasActuales: string[] | null | undefined,
  progresiones: ProgresionResumida[],
  uacName: string,
  component?: string,
  docenteOverrides?: DocenteOverride
): EvidenciaDisciplinar[] {
  const limpias = (evidenciasActuales ?? []).map((e) => (e || '').trim()).filter(Boolean);

  if (requiereDerivacionEvidencias(limpias)) {
    return derivarEvidenciasDisciplinares(progresiones, uacName, component, docenteOverrides);
  }

  if (!progresiones || progresiones.length === 0) {
    return limpias.map((producto, idx) => ({
      id: slugify(`${uacName}-cat-${idx + 1}`),
      orden: idx + 1,
      tipo: 'producto' as TipoEvidencia,
      nivelCognitivo: 'aplicar' as NivelCognitivo,
      verboDisciplinar: 'aplicar',
      producto,
      descripcion: `Evidencia curricular oficial para ${uacName}: ${producto}`,
      criterios: ['Rigor disciplinar', 'Calidad procedimental', 'Presentación conforme al MCCEMS'],
      fuente: 'derivada' as const,
      progresionOrigen: idx + 1,
    }));
  }

  const eliminados = new Set(docenteOverrides?.eliminados ?? []);
  const editadas = docenteOverrides?.editadas ?? {};

  // Emparejar cada progresión con a lo sumo una evidencia existente aún disponible
  const evidenciasTokens = limpias.map((ev) => extraerTokensDominio(ev));
  const evidenciaReclamada = new Set<number>();
  const progresionesCubiertas = new Set<number>();

  for (let pIdx = 0; pIdx < progresiones.length; pIdx++) {
    const prog = progresiones[pIdx];
    const textoProg = [
      prog.descripcion || '',
      ...(prog.contenidos ?? []),
      ...(prog.metas ?? []),
    ].join(' ');
    const tokensProg = extraerTokensDominio(textoProg);
    const tokensContenidos = extraerTokensDominio((prog.contenidos ?? []).join(' '));

    let mejorEvIdx = -1;
    let mejorScore = 0;

    for (let eIdx = 0; eIdx < limpias.length; eIdx++) {
      if (evidenciaReclamada.has(eIdx)) continue;
      const tEv = evidenciasTokens[eIdx];
      let coincidencias = 0;
      for (const tp of tokensProg) {
        if (tEv.some((te) => tokensCoinciden(tp, te))) {
          coincidencias++;
        }
      }
      const coincideContenido =
        tokensContenidos.length === 0 ||
        tokensContenidos.some((tc) => tEv.some((te) => tokensCoinciden(tc, te)));

      if (coincideContenido && coincidencias > mejorScore) {
        mejorScore = coincidencias;
        mejorEvIdx = eIdx;
      }
    }

    if (mejorEvIdx !== -1 && mejorScore >= 1) {
      evidenciaReclamada.add(mejorEvIdx);
      progresionesCubiertas.add(pIdx);
    }
  }

  const resultado: EvidenciaDisciplinar[] = [];
  const productosRegistrados = new Set<string>();

  // 1. Conservar todas las evidencias válidas existentes
  for (let i = 0; i < limpias.length; i++) {
    const id = slugify(`${uacName}-cat-${i + 1}`);
    if (eliminados.has(id)) continue;
    const baseProd = editadas[id]?.producto || limpias[i];
    const norm = normalizarEvidenciaParaComparar(baseProd);
    if (productosRegistrados.has(norm)) continue;
    productosRegistrados.add(norm);

    resultado.push({
      id,
      orden: resultado.length + 1,
      tipo: 'producto',
      nivelCognitivo: 'aplicar',
      verboDisciplinar: 'aplicar',
      producto: baseProd,
      descripcion: `Evidencia curricular oficial para ${uacName}: ${baseProd}`,
      criterios: ['Rigor disciplinar', 'Calidad procedimental', 'Presentación conforme al MCCEMS'],
      fuente: 'derivada',
      progresionOrigen: Math.min(i + 1, progresiones.length),
      ...(editadas[id] ? editadas[id] : {}),
    });
  }

  // 2. Derivar evidencias únicamente para las progresiones/propósitos huérfanos
  const progresionesFaltantes = progresiones.filter((_, idx) => !progresionesCubiertas.has(idx));
  if (progresionesFaltantes.length > 0) {
    const derivadasFaltantes = derivarEvidenciasDisciplinares(
      progresionesFaltantes,
      uacName,
      component,
      docenteOverrides
    );
    for (const der of derivadasFaltantes) {
      if (der.fuente === 'docente') continue; // Se agregan al final
      const norm = normalizarEvidenciaParaComparar(der.producto);
      if (productosRegistrados.has(norm)) continue;
      productosRegistrados.add(norm);
      resultado.push({
        ...der,
        orden: resultado.length + 1,
      });
    }
  }

  // 3. Incorporar nuevas del docente si existen
  if (Array.isArray(docenteOverrides?.nuevas)) {
    for (const nueva of docenteOverrides.nuevas) {
      resultado.push({
        ...nueva,
        orden: resultado.length + 1,
        fuente: 'docente',
      });
    }
  }

  return resultado;
}

export function asegurarCoberturaEvidencias(
  evidenciasActuales: string[] | null | undefined,
  progresiones: ProgresionResumida[],
  uacName: string,
  component?: string,
  docenteOverrides?: DocenteOverride
): string[] {
  return asegurarCoberturaEvidenciasEstructuradas(
    evidenciasActuales,
    progresiones,
    uacName,
    component,
    docenteOverrides
  ).map((e) => e.producto);
}

// ---------------------------------------------------------------------------
// 5. Motor de Composición Funcional del Producto Integrador (Paso 3/4)
// ---------------------------------------------------------------------------

/**
 * Compone funcionalmente el Producto Integrador Situado cruzando:
 * EvidenciasDisciplinares + ProblemaPAEC + MetodologíaActiva.
 * El ID resultante es estrictamente determinista (sin Date.now ni colisiones aleatorias).
 */
export function componerProductoIntegrador(
  evidencias: EvidenciaDisciplinar[],
  problemaPAEC: ProblemaPAEC,
  metodologia: MetodologiaActiva
): ProductoIntegrador {
  const evidenciasConProducto = evidencias.filter(e => e.producto && e.producto.trim().length > 0);
  const productoPrincipal = evidenciasConProducto[0]?.producto || 'Solución técnica integral';
  const problemaLimpio = (problemaPAEC.texto || 'necesidad detectada en el entorno escolar').trim();
  const comunidad = problemaPAEC.comunidad || 'comunidad escolar';

  // ID estrictamente determinista: metodología + slug(problema) + slug(productoPrincipal)
  const id = slugify(`${metodologia.id}-${slugify(problemaLimpio)}-${slugify(productoPrincipal)}`);

  let artefacto = '';
  let fases: FaseDidactica[] = [];

  switch (metodologia.id) {
    case 'abp':
      artefacto = `Carpeta técnica y proyecto de aplicación: ${productoPrincipal} para la atención de ${problemaLimpio}`;
      fases = [
        { momento: 'apertura', actividad: 'Diagnóstico contextual y delimitación comunitaria del proyecto con el estudiantado.', responsable: 'ambos', proposito: 'Sensibilización situada y recuperación de saberes previos' },
        { momento: 'desarrollo', actividad: 'Construcción modular de las evidencias técnicas disciplinares aplicadas al entorno.', responsable: 'estudiante', proposito: 'Desarrollo de competencias y modelado del producto' },
        { momento: 'cierre', actividad: 'Socialización del proyecto ante la comunidad escolar y evaluación colegiada.', responsable: 'ambos', proposito: 'Evaluación formativa, retroalimentación y rendición de cuentas' },
      ];
      break;

    case 'steam':
      artefacto = `Prototipo / Modelo experimental STEAM: ${productoPrincipal} aplicado a ${problemaLimpio}`;
      fases = [
        { momento: 'apertura', actividad: 'Indagación del fenómeno comunitario y formulación de preguntas de investigación.', responsable: 'ambos', proposito: 'Planteamiento científico del reto' },
        { momento: 'desarrollo', actividad: 'Modelado, experimentación técnica y validación de variables de diseño.', responsable: 'estudiante', proposito: 'Integración interdisciplinar y prototipado' },
        { momento: 'cierre', actividad: 'Demostración de funcionamiento del prototipo y validación de impacto.', responsable: 'ambos', proposito: 'Evaluación de desempeño y metacognición' },
      ];
      break;

    case 'aprendizaje_servicio':
      artefacto = `Intervención comunitaria y manual de servicio: ${productoPrincipal} en beneficio de ${problemaLimpio}`;
      fases = [
        { momento: 'apertura', actividad: 'Mapeo participativo con la comunidad y establecimiento de compromisos.', responsable: 'docente', proposito: 'Vinculación comunitaria y propósito ético' },
        { momento: 'desarrollo', actividad: 'Ejecución del servicio técnico y entrega de avances procesuales.', responsable: 'estudiante', proposito: 'Acción socialmente responsable con rigor disciplinar' },
        { momento: 'cierre', actividad: 'Entrega formal del servicio a la comunidad y balance de impacto formativo.', responsable: 'ambos', proposito: 'Reflexión ética y evaluación sumativa-formativa' },
      ];
      break;

    default: // ABR / Casos / Otra
      artefacto = `Dossier de resolución técnica: ${productoPrincipal} frente a la problemática de ${problemaLimpio}`;
      fases = [
        { momento: 'apertura', actividad: 'Análisis del caso situacional y delimitación de requerimientos técnicos.', responsable: 'ambos', proposito: 'Comprensión del escenario de aplicación' },
        { momento: 'desarrollo', actividad: 'Análisis analítico, formulación de alternativas y desarrollo del producto técnico.', responsable: 'estudiante', proposito: 'Resolución de problemas complejos' },
        { momento: 'cierre', actividad: 'Defensa de la solución adoptada y sustentación con base en evidencias.', responsable: 'ambos', proposito: 'Evaluación formativa y coevaluación' },
      ];
      break;
  }

  const criteriosIntegracion = evidenciasConProducto.map(
    e => `Dominio técnico en "${e.producto}" aplicado a resolver la problemática comunitaria.`
  );

  return {
    id,
    artefacto,
    descripcion: `Síntesis de ${evidenciasConProducto.length} evidencias disciplinares bajo la metodología ${metodologia.nombre} para dar respuesta a: "${problemaLimpio}".`,
    fases,
    aplicacionComunitaria: `Impacto esperado en "${comunidad}" con alcance "${problemaPAEC.alcance || 'plantel'}": articulación directa con ${problemaLimpio}.`,
    criteriosIntegracion,
    metodologia,
    problemaPAEC,
    evidenciasReferenciadas: evidenciasConProducto.map(e => e.id),
  };
}

// ---------------------------------------------------------------------------
// 6. Normalización Final para Consumo en Paso 2
// ---------------------------------------------------------------------------

export interface EvidenciasPaso2Result {
  evidencias: EvidenciaDisciplinar[];
  resumen: {
    total: number;
    derivadas: number;
    docente: number;
    familias: FamiliaDisciplinar[];
  };
}

/**
 * Normaliza el conjunto final de evidencias para el Paso 2 (UI),
 * aplicando overrides del docente y entregando resumen estadístico.
 */
export function normalizarEvidenciasPaso2(
  progresiones: ProgresionResumida[],
  uacName: string,
  component?: string,
  docenteOverrides?: DocenteOverride
): EvidenciasPaso2Result {
  const evidencias = derivarEvidenciasDisciplinares(progresiones, uacName, component, docenteOverrides);
  const derivadas = evidencias.filter(e => e.fuente === 'derivada').length;
  const docente = evidencias.filter(e => e.fuente === 'docente').length;
  const familias = [...new Set(evidencias.map(() => detectarFamilia(uacName, component)))];

  return {
    evidencias,
    resumen: {
      total: evidencias.length,
      derivadas,
      docente,
      familias,
    },
  };
}
