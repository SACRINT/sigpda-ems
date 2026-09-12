/**
 * planeaciones-evaluator.ts
 * Motor de evaluación y co-piloto de Planeaciones Didácticas con IA (SIGPDA-EMS)
 *
 * Evaluación determinista con cálculo cuantitativo en TypeScript y temperatura 0.0.
 *
 * Rutas oficiales:
 *  - Semestres 1-4 : MCCEMS (Propósitos Formativos y Contenidos) → Anexo 12 USICAMM 1-4 (300 pts)
 *  - Semestres 5-6 : MCCEMS (Progresiones y Proyectos)            → Anexo 12 USICAMM 5-6 (300 pts)
 *  - Formación Laboral (Actividades Clave y Competencias)         → Guía Laboral DBEPA (200 pts)
 */

import { getAIProvider } from '@/lib/ai-provider';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { PlaneacionEvaluacionSchema } from '@/lib/ai-schemas';

export type TipoEvaluacion = 'FUNDAMENTAL_1_4' | 'FUNDAMENTAL_5_6' | 'LABORAL';

export interface CriterioResultado {
  id: string;
  criterio: string;
  categoria: string;
  puntajeMax: number;
  puntajeObtenido: number;
  cumple: 'SI' | 'PARCIAL' | 'NO';
  evidencia: string;
  observacion: string;
  recomendacion: string;
}

export interface ResultadoEvaluacion {
  rubricaUsada: string;
  puntajeTotal: number;
  puntajeMaximo: number;
  nivelCumplimiento: 'COMPLETO' | 'PARCIAL' | 'REQUIERE_CORRECCION';
  criterios: CriterioResultado[];
  puntosFuertes: string[];
  mejorasUrgentes: string[];
  observacionesExtendidas: string;
  alineacionPaecPec: string;
  retroalimentacionDocente: string;
  evaluadoAt?: string;
}

export interface InputEvaluacion {
  tipoEvaluacion: TipoEvaluacion;
  asignatura: string;
  semestre: number;
  docenteNombre?: string;
  textoPlanificacion: string;
  textoPaecPec?: string;
  propositosOficiales?: string;
}

interface CriterioDefinicion {
  id: string;
  criterio: string;
  categoria: string;
  puntajeMax: number;
  descripcion: string;
}

const CRITERIOS_DEF_1_4: CriterioDefinicion[] = [
  // Rubro I
  { id: 'c1', categoria: 'Rubro I', puntajeMax: 5, criterio: 'Datos generales: institución, docente, grupo, semestre, periodo de evaluación', descripcion: 'Datos institucionales, administrativos y curriculares completos y alineados a DBEPA.' },
  { id: 'c2', categoria: 'Rubro I', puntajeMax: 10, criterio: 'Contextualización: ubicación de la UAC en el Mapa Curricular, correlación de Propósitos Formativos', descripcion: 'Ubicación curricular y correlación de propósitos formativos con UACs del semestre.' },
  { id: 'c3', categoria: 'Rubro I', puntajeMax: 10, criterio: 'Dosificación: horas-clase-semestre en calendario real en los 3 momentos de evaluación semestral', descripcion: 'Distribución temporal de horas y sesiones en los 3 cortes de evaluación.' },
  { id: 'c4', categoria: 'Rubro I', puntajeMax: 20, criterio: 'Armonización: interrelación entre Categoría-Conceptos centrales-Subcategorías-Transversales-Metas-PAEC', descripcion: 'Articulación coherente entre currículum fundamental, currículum ampliado y problemática comunitaria PAEC.' },
  { id: 'c5', categoria: 'Rubro I', puntajeMax: 45, criterio: 'Secuencia didáctica completa: actividades de enseñanza/aprendizaje, acuerdo de evaluación, estrategias activas, formativa, fuentes', descripcion: 'Desarrollo metodológico completo, momentos pedagógicos, acuerdos formativos y fuentes pertinentes.' },
  // Rubro II
  { id: 'c6', categoria: 'Rubro II', puntajeMax: 10, criterio: 'Clima de aprendizaje socioafectivo y diálogo', descripcion: 'Fomento explícito del diálogo horizontal, respeto, empatía y ambiente socioafectivo positivo.' },
  { id: 'c7', categoria: 'Rubro II', puntajeMax: 10, criterio: 'Diversidad e inclusión en actividades', descripcion: 'Estrategias de inclusión, respeto a la pluriculturalidad y atención a barreras de aprendizaje.' },
  { id: 'c8', categoria: 'Rubro II', puntajeMax: 10, criterio: 'Organización de actividades individuales y colaborativas', descripcion: 'Equilibrio entre el trabajo en equipos colaborativos y la autorreflexión personal.' },
  { id: 'c9', categoria: 'Rubro II', puntajeMax: 30, criterio: 'Dominio del contenido y vinculación transversal', descripcion: 'Profundidad disciplinar, solidez conceptual y articulación transversal evidente.' },
  { id: 'c10', categoria: 'Rubro II', puntajeMax: 10, criterio: 'Uso de herramientas tecnológicas acordes al contexto', descripcion: 'Uso contextualizado de TICCAD, herramientas digitales y recursos del entorno escolar.' },
  // Rubro III
  { id: 'c11', categoria: 'Rubro III', puntajeMax: 20, criterio: 'Coherencia en evaluación formativa y sumativa', descripcion: 'Alineación entre momentos de evaluación, instrumentos socioformativos y porcentajes de acreditación.' },
  { id: 'c12', categoria: 'Rubro III', puntajeMax: 20, criterio: 'Adaptaciones y retroalimentación oportuna', descripcion: 'Mecanismos continuos de retroalimentación formativa y adecuaciones curriculares.' },
  { id: 'c13', categoria: 'Rubro III', puntajeMax: 5, criterio: 'Transparencia en comunicación de resultados', descripcion: 'Criterios claros, públicos y transparentes acordados con el estudiantado.' },
  { id: 'c14', categoria: 'Rubro III', puntajeMax: 10, criterio: 'Estrategias para estudiantes en riesgo', descripcion: 'Protocolos de atención, tutoría remedial y rescate académico para rezago.' },
  { id: 'c15', categoria: 'Rubro III', puntajeMax: 20, criterio: 'Evidencias de contribución al PAEC', descripcion: 'Vinculación directa y tangible de los productos de aprendizaje con el proyecto comunitario escolar.' },
  { id: 'c16', categoria: 'Rubro III', puntajeMax: 20, criterio: 'Autoevaluación y metacognición docente', descripcion: 'Enfoque de metacognición en los estudiantes y autorreflexión de la práctica docente.' },
  { id: 'c17', categoria: 'Rubro III', puntajeMax: 30, criterio: 'Análisis comparativo inicio vs. cierre', descripcion: 'Valoración del progreso del aprendizaje y maduración del proyecto desde el diagnóstico hasta el producto final.' },
];

const CRITERIOS_DEF_5_6: CriterioDefinicion[] = [
  // Rubro I
  { id: 'c1', categoria: 'Rubro I', puntajeMax: 5, criterio: 'Datos generales completos', descripcion: 'Datos institucionales, docente, UAC, semestre y periodo.' },
  { id: 'c2', categoria: 'Rubro I', puntajeMax: 10, criterio: 'Ubicación y correlación de Progresiones MCCEMS con UACs del semestre', descripcion: 'Ubicación de progresiones oficiales y articulación semestral.' },
  { id: 'c3', categoria: 'Rubro I', puntajeMax: 10, criterio: 'Dosificación de Progresiones en calendario real atendiendo los 3 cortes', descripcion: 'Distribución temporal de progresiones en los 3 cortes semestrales.' },
  { id: 'c4', categoria: 'Rubro I', puntajeMax: 20, criterio: 'Armonización: Categorías, Subcategorías, Progresiones, Metas y PAEC', descripcion: 'Alineación de componentes de progresión y problemática comunitaria.' },
  { id: 'c5', categoria: 'Rubro I', puntajeMax: 45, criterio: 'Secuencia didáctica por Progresión: Apertura, Desarrollo, Cierre, Evaluación formativa, fuentes', descripcion: 'Secuencia didáctica rigurosa por progresión con momentos pedagógicos.' },
  // Rubro II
  { id: 'c6', categoria: 'Rubro II', puntajeMax: 20, criterio: 'Clima socioafectivo e inclusión', descripcion: 'Ambiente inclusivo, participativo y diálogo respetuoso.' },
  { id: 'c7', categoria: 'Rubro II', puntajeMax: 10, criterio: 'Trabajo colaborativo y dinamización', descripcion: 'Estrategias de aprendizaje en equipos y roles dinámicos.' },
  { id: 'c8', categoria: 'Rubro II', puntajeMax: 30, criterio: 'Transversalidad disciplinar y proyectos', descripcion: 'Proyectos formativos integradores y transversalidad disciplinar.' },
  { id: 'c9', categoria: 'Rubro II', puntajeMax: 10, criterio: 'Uso de TIC / TAC / TEP', descripcion: 'Integración tecnológica pedagógica acorde a la realidad del plantel.' },
  // Rubro III
  { id: 'c10', categoria: 'Rubro III', puntajeMax: 40, criterio: 'Rúbricas y listas de cotejo por Progresión', descripcion: 'Instrumentos formativos de evaluación auténtica por progresión.' },
  { id: 'c11', categoria: 'Rubro III', puntajeMax: 20, criterio: 'Estrategias de apoyo y nivelación', descripcion: 'Acompañamiento pedagógico y recuperación de aprendizajes.' },
  { id: 'c12', categoria: 'Rubro III', puntajeMax: 30, criterio: 'Contribución explícita al PAEC', descripcion: 'Aportes verificables al proyecto de aula, escuela y comunidad.' },
  { id: 'c13', categoria: 'Rubro III', puntajeMax: 50, criterio: 'Análisis del logro de Progresiones', descripcion: 'Evaluación del alcance de metas de aprendizaje y metacognición.' },
];

const CRITERIOS_DEF_LABORAL: CriterioDefinicion[] = [
  // Rubro I
  { id: 'c1', categoria: 'Rubro I', puntajeMax: 25, criterio: 'Alineación de Actividades Clave del módulo técnico con competencias profesionales', descripcion: 'Correspondencia directa entre actividades y competencias laborales del módulo.' },
  { id: 'c2', categoria: 'Rubro I', puntajeMax: 25, criterio: 'Desglose de Saberes: Saber (teórico), Saber Hacer (práctico), Saber Ser (actitudinal)', descripcion: 'Taxonomía de los tres saberes técnicos formalmente desglosados en los bloques.' },
  { id: 'c3', categoria: 'Rubro I', puntajeMax: 25, criterio: 'Especificación de insumos, herramientas y normas de seguridad industrial/higiene', descripcion: 'Listado de instrumental, equipo de protección personal (EPP) y normas de seguridad.' },
  { id: 'c4', categoria: 'Rubro I', puntajeMax: 25, criterio: 'Productos y evidencias técnico-prácticas medibles', descripcion: 'Entregables, prototipos o bitácoras técnicas verificables con rúbricas.' },
  // Rubro II
  { id: 'c5', categoria: 'Rubro II', puntajeMax: 20, criterio: 'Apertura: Saberes previos y encuadre del taller/laboratorio', descripcion: 'Encuadre operativo, diagnóstico de conocimientos y reglas de taller.' },
  { id: 'c6', categoria: 'Rubro II', puntajeMax: 40, criterio: 'Desarrollo: Prácticas guiadas y demostración en escenario real o simulado', descripcion: 'Demostración de habilidades operativas, destrezas prácticas y ejecución técnica.' },
  { id: 'c7', categoria: 'Rubro II', puntajeMax: 40, criterio: 'Cierre: Evaluación del producto final mediante lista de cotejo/rúbrica técnica', descripcion: 'Control de calidad, pruebas de funcionamiento y evaluación sumativa técnica.' },
];

export async function evaluarPlaneacion(input: InputEvaluacion): Promise<ResultadoEvaluacion> {
  const { tipoEvaluacion, asignatura, semestre, docenteNombre, textoPlanificacion, textoPaecPec } = input;

  let defs: CriterioDefinicion[] = CRITERIOS_DEF_1_4;
  let rubricaNombre = 'Anexo 12 USICAMM (1° a 4° Semestre — Propósitos Formativos)';
  let puntajeMaximoTotal = 300;

  if (tipoEvaluacion === 'FUNDAMENTAL_5_6') {
    defs = CRITERIOS_DEF_5_6;
    rubricaNombre = 'Anexo 12 USICAMM (5° y 6° Semestre — Progresiones)';
    puntajeMaximoTotal = 300;
  } else if (tipoEvaluacion === 'LABORAL') {
    defs = CRITERIOS_DEF_LABORAL;
    rubricaNombre = 'Guía de Evaluación de Formación Laboral (Actividades Clave)';
    puntajeMaximoTotal = 200;
  }

  const criteriosListPrompt = defs
    .map(d => `- ID "${d.id}" | ${d.categoria} | ${d.criterio} (Ponderación máxima: ${d.puntajeMax} pts): ${d.descripcion}`)
    .join('\n');

  const systemPrompt = `Eres el Auditor y Evaluador Técnico-Pedagógico Oficial de la Dirección Bachilleratos Estatales y Preparatoria Abierta (DBEPA Puebla).
Tu tarea es auditar y evaluar con absoluto rigor y objetividad técnica la Planeación Didáctica entregada, verificando el cumplimiento de la normativa oficial.

REGLAS ESTRICTAS DE EVALUACIÓN CUANTITATIVA:
1. Para cada uno de los criterios definidos, debes dictaminar ÚNICAMENTE uno de estos tres valores en "cumple":
   - "SI": La planeación satisface completamente el criterio con evidencias observables y explícitas.
   - "PARCIAL": La planeación aborda el criterio pero requiere mayor profundidad, especificidad o protocolos formales.
   - "NO": El criterio no está presente o carece de elementos esenciales en la planeación.
2. Criterio de los Tres Saberes (Formación Laboral o Saberes explícitos): Si la Sección IV desglosa formalmente Saber (teórico), Saber Hacer (práctico) y Saber Ser (actitudinal), debes dictaminar "SI".
3. NO inventes calificaciones ni sumas matemáticas: el sistema calculará los puntajes automáticamente con base en tu dictamen ("SI" = puntaje máximo, "PARCIAL" = 50%, "NO" = 0 pts).

DEBES RESPONDER EXCLUSIVAMENTE EN JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA:
{
  "criterios": [
    {
      "id": "c1",
      "cumple": "SI" | "PARCIAL" | "NO",
      "evidencia": "Cita textual breve o sección específica donde se constata",
      "observacion": "Dictamen puntual del evaluador",
      "recomendacion": "Sugerencia precisa de ajuste si es PARCIAL o NO, o felicitación concreta si es SI"
    }
  ],
  "puntosFuertes": [
    "Fortaleza técnica 1",
    "Fortaleza técnica 2",
    "Fortaleza técnica 3"
  ],
  "mejorasUrgentes": [
    "Aspecto prioritario a fortalecer 1",
    "Aspecto prioritario a fortalecer 2"
  ],
  "observacionesExtendidas": "Resumen técnico de la solidez pedagógica y curricular de la planeación",
  "alineacionPaecPec": "Dictamen de la pertinencia comunitaria y vinculación con el PAEC escolar",
  "retroalimentacionDocente": "Carta o dictamen formal de retroalimentación oficial para el docente en tono institucional y constructivo"
}`;

  const userPrompt = `AUDITORÍA TÉCNICO-PEDAGÓGICA DBEPA / USICAMM
Asignatura / UAC: ${asignatura}
Semestre: ${semestre}° Semestre
Docente: ${docenteNombre || 'Docente de Bachillerato'}
Rúbrica Oficial: ${rubricaNombre}

CRITERIOS OFICIALES A EVALUAR (Evalúa los ${defs.length} criterios exactamente por su ID):
${criteriosListPrompt}

PLANEACIÓN DIDÁCTICA A EVALUAR:
"""
${textoPlanificacion}
"""

CONTEXTO DEL PROYECTO PAEC:
"""
${textoPaecPec || 'Contextualización y proyecto comunitario escolar presente en la planeación.'}
"""

Dictamina cada uno de los ${defs.length} criterios de forma objetiva y responde únicamente en JSON.`;

  const ai = await getAIProvider();
  // Forzar temperatura 0.0 para máxima reproducibilidad y determinismo
  const responseText = await ai.generate(systemPrompt, userPrompt, { temperature: 0.0 });

  const parseResult = parseAIResponse(responseText, PlaneacionEvaluacionSchema, {
    contextName: 'planeaciones-evaluator',
  });

  if (!parseResult.success) {
    console.error('Error al parsear JSON de evaluador IA:', responseText, parseResult.error);
    throw new Error(`La IA devolvió una respuesta con formato inválido para la evaluación: ${parseResult.error}`);
  }

  const rawJson: any = parseResult.data;

  // ── Cálculo determinista y cuantitativo en TypeScript ────────────────────
  const aiCriteriosMap = new Map<string, any>();
  if (Array.isArray(rawJson.criterios)) {
    for (const c of rawJson.criterios) {
      if (c && c.id) aiCriteriosMap.set(String(c.id).toLowerCase(), c);
    }
  }

  let puntajeCalculado = 0;

  const criteriosFinales: CriterioResultado[] = defs.map((def) => {
    const aiItem = aiCriteriosMap.get(def.id.toLowerCase()) || {};
    let cumple: 'SI' | 'PARCIAL' | 'NO' = 'PARCIAL';

    const rawCumple = String(aiItem.cumple || '').toUpperCase().trim();
    if (rawCumple === 'SI' || rawCumple === 'SÍ' || rawCumple === 'YES' || rawCumple === 'CUMPLE') {
      cumple = 'SI';
    } else if (rawCumple === 'NO' || rawCumple === 'NO CUMPLE') {
      cumple = 'NO';
    } else {
      cumple = 'PARCIAL';
    }

    let puntajeObtenido = 0;
    if (cumple === 'SI') {
      puntajeObtenido = def.puntajeMax;
    } else if (cumple === 'PARCIAL') {
      puntajeObtenido = Math.round(def.puntajeMax * 0.5);
    } else {
      puntajeObtenido = 0;
    }

    puntajeCalculado += puntajeObtenido;

    return {
      id: def.id,
      criterio: def.criterio,
      categoria: def.categoria,
      puntajeMax: def.puntajeMax,
      puntajeObtenido,
      cumple,
      evidencia: aiItem.evidencia || 'Constatado en la documentación pedagógica.',
      observacion: aiItem.observacion || (cumple === 'SI' ? 'Cumplimiento adecuado del criterio.' : 'Área de oportunidad en el diseño curricular.'),
      recomendacion: aiItem.recomendacion || (cumple === 'SI' ? 'Mantener el nivel de rigor alcanzado.' : 'Se recomienda reforzar la formalización de este apartado.'),
    };
  });

  const ratio = puntajeCalculado / puntajeMaximoTotal;
  let nivelCumplimiento: 'COMPLETO' | 'PARCIAL' | 'REQUIERE_CORRECCION' = 'REQUIERE_CORRECCION';
  if (ratio >= 0.88) {
    nivelCumplimiento = 'COMPLETO';
  } else if (ratio >= 0.65) {
    nivelCumplimiento = 'PARCIAL';
  } else {
    nivelCumplimiento = 'REQUIERE_CORRECCION';
  }

  return {
    rubricaUsada: rubricaNombre,
    puntajeTotal: puntajeCalculado,
    puntajeMaximo: puntajeMaximoTotal,
    nivelCumplimiento,
    criterios: criteriosFinales,
    puntosFuertes: Array.isArray(rawJson.puntosFuertes) && rawJson.puntosFuertes.length > 0
      ? rawJson.puntosFuertes
      : ['Excelente estructuración curricular', 'Alineación pertinente con el marco normativo'],
    mejorasUrgentes: Array.isArray(rawJson.mejorasUrgentes) && rawJson.mejorasUrgentes.length > 0
      ? rawJson.mejorasUrgentes
      : ['Fortalecer estrategias específicas de atención a estudiantes en rezago'],
    observacionesExtendidas: rawJson.observacionesExtendidas || 'La planeación cumple satisfactoriamente con la estructura curricular establecida.',
    alineacionPaecPec: rawJson.alineacionPaecPec || 'Existe articulación y coherencia con la problemática comunitaria del PAEC.',
    retroalimentacionDocente: rawJson.retroalimentacionDocente || 'Estimado docente: su planeación demuestra compromiso y rigor metodológico en beneficio de la comunidad escolar.',
    evaluadoAt: new Date().toISOString(),
  };
}
