/**
 * planeaciones-evaluator.ts
 * Motor de evaluación y co-piloto de Planeaciones Didácticas con IA (SIGPDA-EMS)
 *
 * Soporta tres rutas de evaluación oficial:
 *  - Semestres 1-4 : MCCEMS (Propósitos Formativos y Contenidos) → Anexo 12 USICAMM 1-4
 *  - Semestres 5-6 : MCCEMS (Progresiones y Proyectos)            → Anexo 12 USICAMM 5-6
 *  - Formación Laboral (Actividades Clave y Competencias)       → Guía de Retroalimentación Laboral
 */

import { getAIProvider } from '@/lib/ai-provider';

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

const CRITERIOS_ANEXO_12_1_4 = `
RUBRO I — PLANEACIÓN DIDÁCTICA (total: 90 pts)
1. Datos generales: institución, docente, grupo, semestre, periodo de evaluación (5 pts)
2. Contextualización: ubicación de la UAC en el Mapa Curricular, correlación de Propósitos Formativos con UACs del semestre (10 pts)
3. Dosificación: horas-clase-semestre en calendario real en los 3 momentos de evaluación semestral (10 pts)
4. Armonización: interrelación entre Categoría-Conceptos centrales-Subcategorías-Transversales-Metas-Aprendizaje de trayectoria-PAEC (20 pts)
5. Secuencia didáctica completa: actividades de enseñanza/aprendizaje, acuerdo de evaluación, estrategias activas, evaluación formativa, fuentes (45 pts)

RUBRO II — PRÁCTICA E INTERVENCIÓN EDUCATIVA (total: 70 pts)
1. Clima de aprendizaje socioafectivo y diálogo (10 pts)
2. Diversidad e inclusión en actividades (10 pts)
3. Organización de actividades individuales y colaborativas (10 pts)
4. Dominio del contenido y vinculación transversal (30 pts)
5. Uso de herramientas tecnológicas acordes al contexto (10 pts)

RUBRO III — EVALUACIÓN Y MEJORA (total: 140 pts)
1. Coherencia en evaluación formativa y sumativa (20 pts)
2. Adaptaciones y retroalimentación oportuna (20 pts)
3. Transparencia en comunicación de resultados (5 pts)
4. Estrategias para estudiantes en riesgo (10 pts)
5. Evidencias de contribución al PAEC (20 pts)
6. Autoevaluación y metacognición docente (20 pts)
7. Análisis comparativo inicio vs. cierre (30 pts)
`;

const CRITERIOS_ANEXO_12_5_6 = `
RUBRO I — PLANEACIÓN DIDÁCTICA (total: 90 pts)
1. Datos generales completos (5 pts)
2. Ubicación y correlación de Progresiones MCCEMS con UACs del semestre (10 pts)
3. Dosificación de Progresiones en calendario real atendiendo los 3 cortes (10 pts)
4. Armonización: Categorías, Subcategorías, Progresiones, Metas y PAEC (20 pts)
5. Secuencia didáctica por Progresión: Apertura, Desarrollo, Cierre, Evaluación formativa, fuentes (45 pts)

RUBRO II — PRÁCTICA E INTERVENCIÓN (total: 70 pts)
1. Clima socioafectivo e inclusión (20 pts)
2. Trabajo colaborativo y dinamización (10 pts)
3. Transversalidad disciplinar y proyectos (30 pts)
4. Uso de TIC / TAC / TEP (10 pts)

RUBRO III — EVALUACIÓN FORMATIVA (total: 140 pts)
1. Rúbricas y listas de cotejo por Progresión (40 pts)
2. Estrategias de apoyo y nivelación (20 pts)
3. Contribución explícita al PAEC (30 pts)
4. Análisis del logro de Progresiones (50 pts)
`;

const CRITERIOS_LABORAL = `
RUBRO I — DISEÑO CURRICULAR Y ACTIVIDADES CLAVE (total: 100 pts)
1. Alineación de Actividades Clave del módulo técnico con competencias profesionales (25 pts)
2. Desglose de Saberes: Saber (teórico), Saber Hacer (práctico), Saber Ser (actitudinal) (25 pts)
3. Especificación de insumos, herramientas y normas de seguridad industrial/higiene (25 pts)
4. Productos y evidencias técnico-prácticas medibles (25 pts)

RUBRO II — SECUENCIA PEDAGÓGICA Y EVALUACIÓN (total: 100 pts)
1. Apertura: Saberes previos y encuadre del taller/laboratorio (20 pts)
2. Desarrollo: Prácticas guiadas y demostración en escenario real o simulado (40 pts)
3. Cierre: Evaluación del producto final mediante lista de cotejo/rúbrica técnica (40 pts)
`;

export async function evaluarPlaneacion(input: InputEvaluacion): Promise<ResultadoEvaluacion> {
  const { tipoEvaluacion, asignatura, semestre, docenteNombre, textoPlanificacion, textoPaecPec } = input;

  let rubricaTexto = CRITERIOS_ANEXO_12_1_4;
  let rubricaNombre = 'Anexo 12 USICAMM (1° a 4° Semestre — Propósitos Formativos)';

  if (tipoEvaluacion === 'FUNDAMENTAL_5_6') {
    rubricaTexto = CRITERIOS_ANEXO_12_5_6;
    rubricaNombre = 'Anexo 12 USICAMM (5° y 6° Semestre — Progresiones)';
  } else if (tipoEvaluacion === 'LABORAL') {
    rubricaTexto = CRITERIOS_LABORAL;
    rubricaNombre = 'Guía de Evaluación de Formación Laboral (Actividades Clave)';
  }

  const systemPrompt = `Eres el Evaluador Técnico-Pedagógico Senior y Revisor Oficial de la Dirección Bachilleratos Estatales y Preparatoria Abierta (DBEPA Puebla).
Tu tarea es auditar y evaluar la Planeación Didáctica entregada, emitiendo un análisis riguroso, objetivo y constructivo.

DEBES RESPONDER ÚNICAMENTE EN FORMATO JSON VÁLIDO con la siguiente estructura:
{
  "rubricaUsada": "${rubricaNombre}",
  "puntajeTotal": <number>,
  "puntajeMaximo": <number (300 para Anexo 12, 200 para Laboral)>,
  "nivelCumplimiento": "COMPLETO" | "PARCIAL" | "REQUIERE_CORRECCION",
  "criterios": [
    {
      "id": "c1",
      "criterio": "Nombre del criterio",
      "categoria": "Rubro I | Rubro II | Rubro III",
      "puntajeMax": <number>,
      "puntajeObtenido": <number>,
      "cumple": "SI" | "PARCIAL" | "NO",
      "evidencia": "Cita exacta o sección donde se observa",
      "observacion": "Hallazgo puntual",
      "recomendacion": "Sugerencia directa de redacción o ajuste"
    }
  ],
  "puntosFuertes": ["Punto fuerte 1", "Punto fuerte 2"],
  "mejorasUrgentes": ["Mejora urgente 1", "Mejora urgente 2"],
  "observacionesExtendidas": "Análisis general sintético de la calidad pedagógica y didáctica",
  "alineacionPaecPec": "Evaluación de la vinculación con el PAEC/PEC y el entorno comunitario",
  "retroalimentacionDocente": "Carta o dictamen formal de retroalimentación en tono empático pero institucional para el docente"
}`;

  const userPrompt = `AUDITORÍA Y EVALUACIÓN OFICIAL DE PLANEACIÓN DIDÁCTICA

INFORMACIÓN DE CONTEXTO:
- Asignatura / UAC: ${asignatura}
- Semestre: ${semestre}° Semestre
- Docente: ${docenteNombre || 'Docente de Bachillerato'}
- Tipo de Rúbrica: ${rubricaNombre}

TEXTO COMPLETO E ÍNTEGRO DE LA PLANEACIÓN EVALUADA:
"""
${textoPlanificacion}
"""

CONTEXTO DEL PROYECTO PAEC-PEC REGISTRADO:
"""
${textoPaecPec || 'Contextualización y vinculación con la comunidad escolar (PAEC) presente en la planeación.'}
"""

INSTRUCCIONES DE EVALUACIÓN OFICIAL (DBEPA / USICAMM):
1. Evalúa cada uno de los criterios oficiales especificados en:
${rubricaTexto}
2. Verifica la presencia explícita de la taxonomía de los Tres Saberes: Saber (teórico / normativo NOM), Saber Hacer (práctico / procedimental en taller) y Saber Ser (actitudinal / seguridad industrial). Si se encuentran formalmente desglosados en los bloques de la Sección IV, asigna el puntaje máximo en ese criterio (25/25 pts).
3. Evalúa la totalidad del documento sin omitir ningún bloque ni sección.
4. Asigna puntajes justificados empíricamente con base en el texto provisto.
5. Devuelve únicamente el JSON estructurado de forma impecable sin markdown adicional.`;

  const ai = await getAIProvider();
  const responseText = await ai.generate(systemPrompt, userPrompt);

  try {
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as ResultadoEvaluacion;
  } catch (err) {
    console.error('Error al parsear JSON de evaluador IA:', responseText);
    throw new Error('La IA devolvió una respuesta con formato inválido para la evaluación.');
  }
}
