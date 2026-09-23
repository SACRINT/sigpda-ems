import { sql } from '@/lib/db/client';
import { auth } from '@/lib/auth';
import { generateWithRotation } from '@/lib/ai-provider';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
// Extender el timeout de Vercel a 60s para llamadas de IA
export const maxDuration = 60;

/**
 * Limpia cualquier residuo de formato Markdown para asegurar texto plano
 * perfectamente legible por voz (TTS) y visualmente limpio.
 */
function cleanMarkdownForTTS(text: string): string {
  if (!text) return '';
  return text
    // Eliminar encabezados Markdown (#, ##, ###, etc.)
    .replace(/^#{1,6}\s+/gm, '')
    // Eliminar negritas y cursivas con asteriscos (***, **, *)
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Eliminar negritas y cursivas con guiones bajos (___, __, _)
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Eliminar código en línea o bloques (``` o `)
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    // Convertir enlaces markdown [texto](url) a solo texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Reemplazar viñetas de asterisco/guion al inicio de línea por viñeta redonda limpia
    .replace(/^[\*\-]\s+/gm, '• ')
    // Eliminar asteriscos o hashtags huérfanos
    .replace(/[*#]/g, '')
    // Normalizar saltos de línea excesivos
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { messages, uacContext, paecContext } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Se requiere un historial de mensajes válido' }, { status: 400 });
    }

    const systemPrompt = `Eres SIGPDA Bot, el Asistente Pedagógico Virtual oficial de la plataforma SIGPDA-EMS (Sistema Integral de Gestión de Planeación Didáctica Automatizada).
Especializado en Educación Media Superior, Marco Curricular Común (MCCEMS) y lineamientos de Educación Media Superior (SEMS Puebla).

Tu función es orientar y asesorar a docentes y directores en:
1. Diseño y ajuste de Secuencias y Planeaciones Didácticas (Momentos metodológicos de Apertura, Desarrollo y Cierre).
2. Definición de Propósitos Formativos, Progresiones y Metas de Aprendizaje.
3. Articulación de la transversalidad con el Proyecto Aula, Escuela y Comunidad (PAEC).
4. Estrategias de evaluación formativa, autoevaluación, coevaluación y metacognición.
5. Elaboración y seguimiento del Plan de Intervención Pedagógica de Supervisión (PIPS) y PMC.

REGLAS OBLIGATORIAS DE RESPUESTA:
1. Responde de forma amable, clara, profesional, pedagógica e institucional estrictamente en texto normal (texto plano). NO uses formato Markdown (sin asteriscos, sin negritas, sin encabezados con #, sin viñetas de asterisco ni caracteres especiales de formato). Esto es indispensable para una pronunciación perfecta en Text-To-Speech (lectura por voz) y visualización limpia.
2. Da sugerencias metodológicas concretas y aplicables al aula de bachillerato de Puebla.
3. Estructura tus ideas con párrafos legibles y redacción fluida.
4. Si se especifica el contexto de la planeación:
   UAC / Asignatura: ${uacContext || 'General / No especificado'}
   PAEC / Entorno: ${paecContext || 'No especificado'}
5. Al final de tu asesoría pedagógica, incluye siempre una breve recomendación práctica aplicable a la sesión de clase.`;

    // Truncar historial a los últimos 10 mensajes para optimizar contexto y consumo de tokens
    const recentMessages = messages.slice(-10);
    const lastUserMessage = recentMessages[recentMessages.length - 1].content;
    const historyText = recentMessages
      .slice(0, -1)
      .map((m: any) => `${m.role === 'user' ? 'Docente' : 'Asistente'}: ${m.content}`)
      .join('\n\n');

    const fullUserPrompt = historyText
      ? `HISTORIAL DE LA CONVERSACIÓN:\n${historyText}\n\nNUEVA PREGUNTA DEL DOCENTE:\nDocente: ${lastUserMessage}`
      : `PREGUNTA DEL DOCENTE:\n${lastUserMessage}`;

    // Obtener teacherId si existe para rotación prioritaria
    let teacherId: string | undefined;
    try {
      if (process.env.DATABASE_URL) {
        const db = sql();
        const teachers = await db`SELECT id FROM teachers WHERE email = ${session.user.email} LIMIT 1`;
        if (teachers[0]?.id) {
          teacherId = teachers[0].id;
        }
      }
    } catch {
      // Continuar con pool general si no se pudo resolver el ID
    }

    const rawReply = await generateWithRotation(systemPrompt, fullUserPrompt, teacherId);
    const reply = cleanMarkdownForTTS(rawReply);

    return NextResponse.json({ success: true, reply });
  } catch (e: any) {
    logger.error('API /api/pedagogical-chat error:', e);
    return NextResponse.json({ error: e.message || 'Error en el asistente pedagógico' }, { status: 500 });
  }
}
