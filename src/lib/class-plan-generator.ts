/**
 * class-plan-generator.ts
 * Generador de Planes de Clase individuales por sesión (Dimensión Micro-Operativa)
 * Alineado con la Lista de Cotejo de Plan de Clase de la DBEPA Puebla
 */

import { getAIProvider } from '@/lib/ai-provider';

export interface SesionClase {
  numeroSesion: number;
  duracionMinutos: number;
  tituloSesion: string;
  propósitoOMeta: string;
  transversalidad: string;
  apertura: {
    actividadDocente: string;
    actividadEstudiante: string;
    saberesPrevios: string;
    tiempoMinutos: number;
  };
  desarrollo: {
    actividadDocente: string;
    actividadEstudiante: string;
    metodologiaActiva: string;
    recursosDidacticos: string;
    tiempoMinutos: number;
  };
  cierre: {
    actividadDocente: string;
    actividadEstudiante: string;
    evaluacionFormativa: string;
    metacognicion: string;
    productoEsperado: string;
    tiempoMinutos: number;
  };
  instrumentoEvaluacion: string;
}

export interface PlanDeClaseCompleto {
  uacNombre: string;
  semestre: number;
  bloqueCorte: string;
  sesiones: SesionClase[];
}

export async function generarPlanesDeClase(params: {
  uacNombre: string;
  semestre: number;
  totalSesiones?: number;
  planeacionTexto: string;
}): Promise<PlanDeClaseCompleto> {
  const { uacNombre, semestre, totalSesiones = 3, planeacionTexto } = params;

  const systemPrompt = `Eres un Diseñador Instruccional Senior y Asesor Técnico Pedagógico especialista en Educación Media Superior (MCCEMS DBEPA Puebla).
Tu función es transformar la Planeación Didáctica general en una secuencia de ${totalSesiones} Planes de Clase desglosados minuciosamente por sesión (Momentos: Inicio/Apertura, Desarrollo y Cierre).

DEBES RESPONDER ÚNICAMENTE EN FORMATO JSON VÁLIDO con la siguiente estructura:
{
  "uacNombre": "${uacNombre}",
  "semestre": ${semestre},
  "bloqueCorte": "Corte I",
  "sesiones": [
    {
      "numeroSesion": 1,
      "duracionMinutos": 50,
      "tituloSesion": "Título sugerente y claro de la sesión",
      "propósitoOMeta": "Meta educativa específica de la sesión",
      "transversalidad": "Relación con la comunidad o UACs del semestre",
      "apertura": {
        "actividadDocente": "Explicación del encuadre y pregunta detonadora",
        "actividadEstudiante": "Participación activa y lluvia de ideas",
        "saberesPrevios": "Estrategia para rescatar conocimientos previos",
        "tiempoMinutos": 10
      },
      "desarrollo": {
        "actividadDocente": "Guía práctica y facilitación del trabajo en equipo",
        "actividadEstudiante": "Construcción colaborativa y resolución de problemas",
        "metodologiaActiva": "Aprendizaje Basado en Proyectos / Problemas / Indagación",
        "recursosDidacticos": "Lista de materiales físicos o digitales",
        "tiempoMinutos": 30
      },
      "cierre": {
        "actividadDocente": "Coordinación de la socialización y retroalimentación",
        "actividadEstudiante": "Presentación de evidencia y autorreflexión",
        "evaluacionFormativa": "Momento y técnica de evaluación formativa",
        "metacognicion": "Pregunta o dinámica metacognitiva final",
        "productoEsperado": "Entregable o evidencia de la sesión",
        "tiempoMinutos": 10
      },
      "instrumentoEvaluacion": "Lista de cotejo / Rúbrica sintética"
    }
  ]
}`;

  const userPrompt = `GENERACIÓN DE PLANES DE CLASE POR SESIÓN

Asignatura / UAC: ${uacNombre}
Semestre: ${semestre}° Semestre
Número de sesiones a generar: ${totalSesiones}

CONTENIDO DE LA PLANEACIÓN BASE:
"""
${planeacionTexto}
"""

Genera las ${totalSesiones} sesiones asegurando que la suma de tiempos de cada sesión sea de exactamente 50 o 100 minutos según la intensidad.`;

  const ai = await getAIProvider();
  const responseText = await ai.generate(systemPrompt, userPrompt);

  try {
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as PlanDeClaseCompleto;
  } catch (err) {
    console.error('Error al parsear JSON de Plan de Clase:', responseText);
    throw new Error('La IA devolvió un formato inválido para los Planes de Clase.');
  }
}
