/**
 * ai-schedule-assistant.ts — Asistente Neuro-Simbólico de Horarios Escolares
 * SIGPDA-EMS (Plataforma Inteligente de Horarios Escolares MCCEMS)
 *
 * Arquitectura Neuro-Simbólica:
 * 1. La IA traduce el lenguaje natural del director a especificaciones formales de restricciones.
 * 2. Un validador matemático previo detecta inconsistencias antes de invocar al solver.
 * 3. El solver matemático determinista (CSP) calcula la solución con 0 empalmes garantizados.
 * 4. La IA genera explicaciones pedagógicas de los cambios y métricas de calidad.
 */

import { getAIProvider } from "@/lib/ai-provider";
import { callGeminiPool } from "@/lib/gemini";
import { parseAIResponse } from "@/lib/ai-response-parser";
import { ScheduleAssistantResponseSchema } from "@/lib/ai-schemas";

export interface BloqueoDocenteIA {
  docenteId: string;
  diasIndisponibles?: number[];
  periodosIndisponibles?: { dia: number; periodo: number }[];
}

export interface BloqueoGrupoIA {
  grupoId: string;
  diasIndisponibles?: number[];
  periodosIndisponibles?: { dia: number; periodo: number }[];
}

export type TipoAccionHorario =
  | "REGENERAR_CON_RESTRICCIONES"
  | "MACRO_RESTRICCION"
  | "MOVER_CELDA"
  | "INTERCAMBIAR"
  | "AGRUPAR_BLOQUE_DOBLE"
  | "AGRUPAR"
  | "FIJAR_CELDA"
  | "BLOQUEAR_LIBRE";

export interface AccionHorario {
  tipo: TipoAccionHorario;
  bloqueosDocentes?: BloqueoDocenteIA[];
  bloqueosGrupos?: BloqueoGrupoIA[];
  restriccionDistribucion?: "MAX_1_HR_DIA" | "BLOQUES_DOBLES_CONTINUOS";
  asignatura?: string;
  grupoId?: string;
  docenteId?: string;
  diaOrigen?: number;
  periodoOrigen?: number;
  diaDestino?: number;
  periodoDestino?: number;
  origen?: { dia: number; periodo: number; grupoId?: string; docenteId?: string };
  destino?: { dia: number; periodo: number; grupoId?: string; docenteId?: string };
  dias?: number[];
  periodos?: { dia: number; periodo: number }[];
  intermedias?: boolean;
}

export interface RespuestaIAHorario {
  explicacion: string;
  acciones: AccionHorario[];
  factible: boolean;
  advertencia?: string;
  diagnosticoMatematico?: {
    horasRequeridas: number;
    capacidadDisponible: number;
    esValido: boolean;
  };
}

export interface ContextoHorarioEscolar {
  nombreEscuela: string;
  horasPorDia: number;
  diasLectivos: number;
  grupos: { id: string; nombre: string; semestre?: number }[];
  docentes: { id: string; nombreCompleto: string; horasAsignadas: number }[];
  materias: { id: string; nombre: string }[];
  celdasActuales: any[];
  slotsLibresBloqueados?: string[];
  historialConversacion?: { role: string; content: string }[];
}

/**
 * Validador Matemático Previo:
 * Comprueba de forma determinista si una solicitud de día libre o bloqueo
 * excede la capacidad de la jornada escolar antes de consultar a la IA.
 */
export function validarFactibilidadMatematicaPrevia(
  mensajeUsuario: string,
  contexto: ContextoHorarioEscolar
): { factible: boolean; motivo?: string } | null {
  const msgLower = mensajeUsuario.toLowerCase();
  
  // Detección de petición de día libre completo para un docente
  const diasMap: { [k: string]: number } = {
    lunes: 1,
    martes: 2,
    miercoles: 3,
    miércoles: 3,
    jueves: 4,
    viernes: 5
  };

  for (const doc of contexto.docentes) {
    const docNombre = doc.nombreCompleto.toLowerCase();
    const docTokens = docNombre.split(" ");
    const matchesDoc = docTokens.some(t => t.length > 3 && msgLower.includes(t));

    if (matchesDoc) {
      for (const [diaNombre, _] of Object.entries(diasMap)) {
        if (msgLower.includes(diaNombre) && (msgLower.includes("libre") || msgLower.includes("descanso") || msgLower.includes("no asista") || msgLower.includes("no venga"))) {
          const diasDisponibles = Math.max(1, contexto.diasLectivos - 1);
          const maxHorasPosibles = diasDisponibles * contexto.horasPorDia;
          if (doc.horasAsignadas > maxHorasPosibles) {
            return {
              factible: false,
              motivo: `El docente ${doc.nombreCompleto} tiene asignadas ${doc.horasAsignadas} horas semanales. Al darle el día ${diaNombre} libre, solo quedan ${diasDisponibles} días disponibles con un cupo máximo de ${maxHorasPosibles} horas (${diasDisponibles} días × ${contexto.horasPorDia} hrs/día). Es matemáticamente imposible programar sus horas sin exceder la jornada escolar.`
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Procesa comandos en lenguaje natural del Director con rotación automática de llaves
 * y resolución simbólica estructurada.
 */
export async function procesarComandoIA(
  mensajeUsuario: string,
  contextoHorario: ContextoHorarioEscolar,
  escuelaId?: string
): Promise<RespuestaIAHorario> {
  // 1. Validación Matemática Previa Rápida
  const preCheck = validarFactibilidadMatematicaPrevia(mensajeUsuario, contextoHorario);
  if (preCheck && !preCheck.factible) {
    return {
      explicacion: preCheck.motivo || "La solicitud no es factible matemáticamente.",
      acciones: [],
      factible: false,
      advertencia: "Inconsistencia de carga horaria detectada."
    };
  }

  const systemInstruction = `Eres el Asistente Neuro-Simbólico de Horarios Escolares para SIGPDA-EMS.
Tu función es interpretar las solicitudes del Director de la escuela, traducir su lenguaje natural a restricciones formales JSON estructuradas y validar la factibilidad pedagógica.

REGLA FUNDAMENTAL DE ARQUITECTURA:
- TÚ NUNCA GENERAS LA MATRIZ DE HORARIOS DIRECTAMENTE NI REINVENTAS LAS CELDAS.
- TÚ SOLO TRADUCES LA INTENCIÓN A ACCIONES FORMALES DE MUTACIÓN O RESTRICCIONES.
- EL SOLVER DETERMINISTA CSP ES QUIEN CALCULA LA MATRIZ CON 0 EMPALMES.

ROUTER DE ACCIONES FORMALES:
1. 'MOVER_CELDA': Mover una clase específica de día/periodo origen a día/periodo destino.
2. 'INTERCAMBIAR': Intercambiar dos periodos o materias de un mismo grupo o docente.
3. 'BLOQUEAR_LIBRE': Asignar día completo libre o bloquear periodos específicos a un docente o grupo.
4. 'AGRUPAR_BLOQUE_DOBLE': Juntar 2 horas consecutivas de una materia para prácticas de laboratorio o taller.
5. 'FIJAR_CELDA': Poner candado (🔒) a una celda para que sea inamovible.
6. 'REGENERAR_CON_RESTRICCIONES': Regeneración global cuando el cambio altera la distribución completa del plantel.

FORMATO DE RESPUESTA JSON ESTRICTO (SIN MARKDOWN):
{
  "explicacion": "Explicación detallada y formal para el director sobre cómo se estructuraron las restricciones.",
  "factible": true,
  "advertencia": null,
  "acciones": [
    {
      "tipo": "BLOQUEAR_LIBRE",
      "docenteId": "DOCENTE_ID",
      "dias": [3],
      "bloqueosDocentes": [
        {
          "docenteId": "DOCENTE_ID",
          "diasIndisponibles": [3]
        }
      ]
    }
  ]
}`;

  const historialPrompt = contextoHorario.historialConversacion && contextoHorario.historialConversacion.length > 0 
    ? `\nHISTORIAL DE LA CONVERSACIÓN:\n${contextoHorario.historialConversacion.map(m => `${m.role === 'user' ? 'DIRECTOR' : 'ASISTENTE'}: ${m.content}`).join('\n')}`
    : "";

  const prompt = `
CONTEXTO INSTITUCIONAL DE LA ESCUELA:
Plantel: ${contextoHorario.nombreEscuela}
Jornada: ${contextoHorario.horasPorDia} horas/día × ${contextoHorario.diasLectivos} días = ${contextoHorario.horasPorDia * contextoHorario.diasLectivos} hrs semanales máximas.
Grupos Escolares: ${JSON.stringify(contextoHorario.grupos)}
Plantilla Docente y Carga Semanal: ${JSON.stringify(contextoHorario.docentes)}
Slots Libres Bloqueados Previamente: ${JSON.stringify(contextoHorario.slotsLibresBloqueados || [])}${historialPrompt}

SOLICITUD DEL DIRECTOR:
"${mensajeUsuario}"

Responde exclusivamente con el JSON estructurado.`;

  try {
    let rawResponse = "";

    // Intentar primero con ai-provider institucional
    try {
      const ai = await getAIProvider(true);
      rawResponse = await ai.generate(systemInstruction, prompt);
    } catch (providerErr) {
      console.warn("[ai-schedule-assistant] Fallback a callGeminiPool:", providerErr);
      rawResponse = await callGeminiPool(systemInstruction, prompt, escuelaId);
    }

    const parseResult = parseAIResponse<RespuestaIAHorario>(
      rawResponse,
      ScheduleAssistantResponseSchema as any,
      { contextName: 'ai-schedule-assistant' }
    );

    if (parseResult.success) {
      return parseResult.data;
    }

    throw new Error(parseResult.error);
  } catch (error) {
    console.error("[ai-schedule-assistant] Error procesando comando de horario:", error);
    return {
      explicacion: "No pude interpretar la instrucción en este momento. Por favor verifica los nombres de docentes o materias e intenta nuevamente.",
      acciones: [],
      factible: false,
      advertencia: "Error de comunicación con el servicio de IA."
    };
  }
}
