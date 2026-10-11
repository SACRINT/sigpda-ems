/**
 * session-task-fallback.ts — Texto de tarea de respaldo por sesión (Lote C · H-8)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Cuando el cuaderno tiene menos tareas únicas que sesiones intermedias, la sesión sin tareas
 * asignadas recibía un texto genérico idéntico. Este helper compone un enunciado específico con el
 * tema y el enfoque de la misión (y el título de la sesión si es significativo), compartido por los
 * renderers PDF y DOCX para mantener paridad.
 */

export interface SessionTaskFallbackInput {
  sessionTopic?: string | null;
  sessionFocus?: string | null;
}

function cleanSentence(text: string | null | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim().replace(/[.:;,\s]+$/, '');
}

/** Un título es genérico si es el fallback "… (SESIÓN N)" que inyectan los renderers. */
function isGenericSessionTitle(title: string): boolean {
  return /\(\s*sesi[oó]n\s+\d+\s*\)/i.test(title) || /^pr[aá]ctica colaborativa/i.test(title);
}

export function buildSessionFallbackTaskText(
  mission: SessionTaskFallbackInput,
  sessionNumber: number,
  sessionTitle?: string | null
): string {
  const title = cleanSentence(sessionTitle);
  const topic = cleanSentence(mission.sessionTopic);
  const focus = cleanSentence(mission.sessionFocus);

  const parts: string[] = [];
  const seen = new Set<string>();
  const push = (value: string): void => {
    const key = value.toLowerCase();
    if (value.length > 0 && !seen.has(key)) {
      seen.add(key);
      parts.push(value);
    }
  };

  if (title && !isGenericSessionTitle(title)) push(title);
  push(topic);
  push(focus);

  const context = parts.length > 0 ? parts.join('. ') : `Resolucion guiada de la sesion ${sessionNumber}`;
  return `${context}. Registre el procedimiento y evidencias en su cuaderno:`;
}
