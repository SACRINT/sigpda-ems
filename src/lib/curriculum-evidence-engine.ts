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
  metas?: string[];
  categorias?: string[];
  subcategorias?: string[];
}
export type ProgresiónResumida = ProgresionResumida;

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

  // ── Lengua y Comunicación ──
  { verbo: 'redactar', stem: 'redac', familia: 'lengua_comunicacion', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'disertacion', prefijoArtefacto: 'Composición de texto argumentativo / ensayo estructurado sobre' },
  { verbo: 'comunicar', stem: 'comunic', familia: 'lengua_comunicacion', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Guion y exposición oral formal con evidencia multimedia sobre' },
  { verbo: 'analizar', stem: 'analiz', familia: 'lengua_comunicacion', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'antologia', prefijoArtefacto: 'Antología crítica y análisis de textos literarios e informativos de' },

  // ── Económico Administrativo ──
  { verbo: 'diagnosticar', stem: 'diagnost', familia: 'economico_administrativo', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'reporte', prefijoArtefacto: 'Diagnóstico situacional y estudio de mercado de' },
  { verbo: 'gestionar', stem: 'gestion', familia: 'economico_administrativo', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'producto', prefijoArtefacto: 'Plan operativo de gestión y administración de' },
  { verbo: 'presupuestar', stem: 'presupues', familia: 'economico_administrativo', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'fichaTecnica', prefijoArtefacto: 'Cédula presupuestal y proyección de flujo financiero de' },

  // ── Formación Laboral y Técnica ──
  { verbo: 'diagnosticar', stem: 'diagnost', familia: 'formacion_laboral', nivelCognitivo: 'analizar', tipoEvidenciaSugerido: 'fichaTecnica', prefijoArtefacto: 'Ficha técnica de diagnóstico operativo y detección de fallas en' },
  { verbo: 'mantener', stem: 'manten', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'bitacora', prefijoArtefacto: 'Bitácora técnica de mantenimiento preventivo y correctivo en' },
  { verbo: 'reparar', stem: 'repar', familia: 'formacion_laboral', nivelCognitivo: 'aplicar', tipoEvidenciaSugerido: 'prototipo', prefijoArtefacto: 'Demostración práctica de protocolo técnico estandarizado para' },
  { verbo: 'elaborar', stem: 'elabor', familia: 'formacion_laboral', nivelCognitivo: 'crear', tipoEvidenciaSugerido: 'manual', prefijoArtefacto: 'Manual de procedimientos operativos y control de calidad en' },

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

function limpiarTextoNucleo(texto: string): string {
  return (texto || '')
    .replace(/^(?:progresi[oó]n|prop[oó]sito|etapa|c\d+m\d+|\d+)\s*[:.\-–—]?\s*/i, '')
    .replace(/^(?:el\s+estudiante|las\s+y\s+los\s+estudiantes|las\s+y\s+los\s+aprendientes|comprende\s+que|analiza\s+que)\s*/i, '')
    .trim();
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
    const matchFamilia = TAXONOMIA_VERBOS.find(v => v.familia === familia && (v.stem === st || st.startsWith(v.stem) || v.stem.startsWith(st)));
    if (matchFamilia) return matchFamilia;

    // 2. Coincidencia en cualquier familia
    const matchGeneral = TAXONOMIA_VERBOS.find(v => v.stem === st || st.startsWith(v.stem) || v.stem.startsWith(st));
    if (matchGeneral) return matchGeneral;
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
        prefijoArtefacto: familia === 'dibujo_tecnico' ? 'Lámina técnica normalizada de' : 'Reporte de aplicación de',
      };

      // Evitar duplicar el mismo verbo dentro de la misma progresión
      const claveUnica = `${orden}-${clasificado.verbo}`;
      if (verbosRegistrados.has(claveUnica)) continue;
      verbosRegistrados.add(claveUnica);

      const id = slugify(`${uacName}-${orden}-${clasificado.verbo}`);
      if (eliminados.has(id)) continue;

      const nucleo = limpiarTextoNucleo(fuente || prog.descripcion || '');
      const nucleoCorto = nucleo.length > 70 ? `${nucleo.slice(0, 67)}...` : nucleo;
      const producto = nucleoCorto
        ? `${clasificado.prefijoArtefacto} ${nucleoCorto.toLowerCase()}`
        : `${clasificado.prefijoArtefacto} saberes disciplinares`;

      const descripcion = `Estudiante ejecuta la acción formativa "${clasificado.verbo}" aplicando saberes de ${familia.replace(/_/g, ' ')} sobre: ${nucleo}. Evidencia formativa técnica de proceso y desempeño.`;

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
      if (override) {
        derivadas.push({
          ...base,
          ...override,
          fuente: override.fuente ?? 'derivada',
        });
      } else {
        derivadas.push(base);
      }
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
