/**
 * Google Classroom API Integration Service (SIGPDA-EMS)
 * Proporciona publicación automatizada de UACs, temas y tareas formativas
 * directamente desde las planeaciones didácticas a Google Classroom.
 */

import { getPlanningById } from '@/lib/db';
import type { GeneratedPlanningContent } from '@/types/planning';
import { logger } from '@/lib/logger';

export interface ClassroomConfigStatus {
  configured: boolean;
  missingKeys?: string[];
}

export interface PublishResult {
  success: boolean;
  configured: boolean;
  message: string;
  courseId?: string;
  courseUrl?: string;
  topicsCreated?: number;
  assignmentsCreated?: number;
  error?: string;
}

/**
 * Verifica si las credenciales de Google OAuth están configuradas en el entorno.
 */
export function checkClassroomConfig(): ClassroomConfigStatus {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const directToken = process.env.GOOGLE_CLASSROOM_ACCESS_TOKEN;

  if (directToken) {
    return { configured: true };
  }

  const missing: string[] = [];
  if (!clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!refreshToken) missing.push('GOOGLE_REFRESH_TOKEN');

  if (missing.length > 0) {
    return { configured: false, missingKeys: missing };
  }

  return { configured: true };
}

/**
 * Obtiene un Access Token válido usando el Refresh Token de Google OAuth2.
 */
async function getAccessToken(): Promise<string> {
  const directToken = process.env.GOOGLE_CLASSROOM_ACCESS_TOKEN;
  if (directToken) return directToken;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Credenciales de Google Classroom incompletas.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error al renovar Google Access Token: ${errorText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Publica la planeación didáctica como un Curso estructurado con Temas y Tareas en Google Classroom.
 */
export async function publishPlanningToGoogleClassroom(planningId: string, teacherId?: string): Promise<PublishResult> {
  const config = checkClassroomConfig();
  if (!config.configured) {
    return {
      success: false,
      configured: false,
      message: 'Configura Google Classroom en Configuración (faltan credenciales de Google OAuth).',
    };
  }

  const planning = await getPlanningById(planningId, teacherId);

  if (!planning) {
    return {
      success: false,
      configured: true,
      message: 'No se encontró la planeación didáctica especificada.',
    };
  }

  const content = planning.contentJson as GeneratedPlanningContent | null;
  if (!content) {
    return {
      success: false,
      configured: true,
      message: 'La planeación no cuenta con contenido estructurado para publicar.',
    };
  }

  try {
    const token = await getAccessToken();

    // 1. Crear Curso en Google Classroom
    const coursePayload = {
      name: `${planning.uacName} - ${planning.semester}° Semestre`,
      section: `Grupo / Ciclo Escolar ${planning.schoolYear || '2025-2026'}`,
      descriptionHeading: `UAC: ${planning.uacName} (${planning.component === 'laboral' ? 'Formación Laboral' : 'Tronco Común'})`,
      description: `Planeación Didáctica generada con SIGPDA-EMS.\nHoras totales: ${planning.hoursTotal || 64}h.\nPlantel / CCT: ${planning.schoolName || 'Plantel EMS'}.`,
      room: `Semestre ${planning.semester}`,
      ownerId: 'me',
      courseState: 'ACTIVE',
    };

    const courseRes = await fetch('https://classroom.googleapis.com/v1/courses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(coursePayload),
    });

    if (!courseRes.ok) {
      const errBody = await courseRes.text();
      throw new Error(`Error creando curso en Classroom (${courseRes.status}): ${errBody}`);
    }

    const courseData = await courseRes.json();
    const courseId = courseData.id;
    const courseUrl = courseData.alternateLink || `https://classroom.google.com/c/${courseId}`;

    let topicsCreated = 0;
    let assignmentsCreated = 0;

    // 2. Crear Temas y Tareas para Actividades Formativas (Sección IV)
    const activities = content.sectionIV?.activities || [];

    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      const topicName = `Bloque/Actividad ${i + 1}: ${act.name?.slice(0, 50) || `Momento ${i + 1}`}`;

      let topicId: string | undefined;

      try {
        // Crear Tema
        const topicRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/topics`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: topicName }),
        });

        if (topicRes.ok) {
          const topicData = await topicRes.json();
          topicId = topicData.topicId;
          topicsCreated++;
        }
      } catch (topicErr) {
        logger.warn(`[Classroom] No se pudo crear tema ${topicName}:`, topicErr);
      }

      // Crear Tarea / CourseWork
      try {
        const descriptionLines = [
          act.contenidoFormativo ? `📖 **Contenido Formativo:** ${act.contenidoFormativo}` : '',
          `⏱️ **Duración:** ${act.hours || 4} horas`,
          act.methodology ? `🎯 **Metodología:** ${act.methodology}` : '',
          act.apertura?.activities ? `🟢 **Apertura:** ${act.apertura.activities}` : '',
          act.ejecucion?.activities ? `🟡 **Desarrollo / Ejecución:** ${act.ejecucion.activities}` : '',
          act.conclusion?.activities ? `🔴 **Cierre:** ${act.conclusion.activities}` : '',
          act.ejecucion?.materials ? `📦 **Materiales:** ${act.ejecucion.materials}` : '',
          '\nRecuerda entregar tu evidencia en tiempo y forma según las indicaciones de clase.',
        ].filter(Boolean).join('\n');


        const workPayload = {
          title: `Evidencia ${i + 1}: ${act.name || `Actividad Formativa ${i + 1}`}`,
          description: descriptionLines,
          workType: 'ASSIGNMENT',
          state: 'PUBLISHED',
          maxPoints: 100,
          topicId: topicId || undefined,
        };


        const workRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(workPayload),
        });

        if (workRes.ok) {
          assignmentsCreated++;
        }
      } catch (workErr) {
        logger.warn(`[Classroom] No se pudo crear tarea para actividad ${i + 1}:`, workErr);
      }
    }

    return {
      success: true,
      configured: true,
      courseId,
      courseUrl,
      topicsCreated,
      assignmentsCreated,
      message: `¡Curso publicado con éxito en Google Classroom! Se crearon ${topicsCreated} temas y ${assignmentsCreated} tareas formativas.`,
    };
  } catch (error: any) {
    logger.error('[publishPlanningToGoogleClassroom error]:', error);
    return {
      success: false,
      configured: true,
      message: error?.message || 'Error al comunicarse con el servicio de Google Classroom.',
      error: String(error),
    };
  }
}
