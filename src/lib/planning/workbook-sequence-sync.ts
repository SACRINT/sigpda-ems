/**
 * workbook-sequence-sync.ts
 * SIGPDA-EMS · Sincronizador Canónico Libro de Texto Activo (ActiveWorkTextbook) ➔ Secuencia Didáctica Micro
 *
 * Establece una única fuente de verdad entre los `sessionPlans` de los libros por bloque
 * (`workbooks_json`) y la secuencia didáctica micro (`sequence_json`), garantizando paridad 1:1
 * entre Libros, Planes de Clase, Planeación Didáctica (Sección IV) y Secuencia Didáctica.
 */

import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import type { KeyActivityPlan, SecuenciaBloque, SecuenciaCompleta, SecuenciaSesion } from '@/types/planning';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import { stripMaterialTokens } from '@/lib/materials/material-tokens';

function cleanText(raw: string | undefined | null): string {
  if (!raw) return '';
  return stripMaterialTokens(raw)
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(raw: string | undefined | null, maxLen = 220): string {
  const cleaned = cleanText(raw);
  if (!cleaned) return '';
  const match = cleaned.match(/^.+?[.!?](?=\s|$)/);
  const sentence = match ? match[0].trim() : cleaned;
  if (sentence.length <= maxLen) return sentence;
  const cut = sentence.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim()}.`;
}

function formatObjectiveAsTitle(objetivo: string | undefined, fallbackTitle: string, sessionNum: number): string {
  const cleaned = cleanText(objetivo)
    .replace(/^vas\s+a\s+/i, '')
    .replace(/^el\s+estudiante\s+/i, '')
    .replace(/\.$/, '')
    .trim();
  if (!cleaned) {
    return fallbackTitle.startsWith(`Sesión ${sessionNum}`)
      ? fallbackTitle
      : `Sesión ${sessionNum}: ${fallbackTitle}`;
  }
  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  const concise = capitalized.length > 125
    ? `${capitalized.slice(0, 125).replace(/\s+\S*$/, '')}`
    : capitalized;
  return `Sesión ${sessionNum}: ${concise}`;
}

function resolveSessionPhase(
  sessionNum: number,
  totalSessions: number,
  missionIndex?: number
): 'Apertura' | 'Desarrollo' | 'Cierre' {
  if (missionIndex === 1) return 'Apertura';
  if (missionIndex === 4) return 'Cierre';
  if (missionIndex === 2 || missionIndex === 3) return 'Desarrollo';
  const apLimit = totalSessions >= 16 ? 3 : totalSessions >= 10 ? 2 : 1;
  const cieStart = totalSessions - (totalSessions >= 16 ? 3 : totalSessions >= 10 ? 2 : 1) + 1;
  if (sessionNum <= apLimit) return 'Apertura';
  if (sessionNum >= cieStart) return 'Cierre';
  return 'Desarrollo';
}

/**
 * Construye un `SecuenciaBloque` canónico a partir de un `ActiveWorkTextbook` de bloque.
 */
export function buildBlockSequenceFromWorkbook(
  workbook: ActiveWorkTextbook,
  blockIndex: number,
  fallbackBlockName?: string
): SecuenciaBloque | null {
  const missions: MissionSection[] = Array.isArray(workbook?.missions) ? workbook.missions : [];
  if (missions.length === 0) return null;

  const extracted = extractMaterialsFromWorkbook(workbook);
  const planesBySession = new Map(
    extracted.planesDeClase.map((p) => [p.numeroSesion, p])
  );

  // Recolectar todos los sessionPlans ordenados por número de sesión
  const sessionEntries: Array<{ mission: MissionSection; sp: SessionPlan }> = [];
  for (const mission of missions) {
    for (const sp of mission.sessionPlans ?? []) {
      if (sp && typeof sp.sessionNumber === 'number') {
        sessionEntries.push({ mission, sp });
      }
    }
  }
  sessionEntries.sort((a, b) => a.sp.sessionNumber - b.sp.sessionNumber);

  if (sessionEntries.length === 0 && extracted.planesDeClase.length === 0) {
    return null;
  }

  const totalSessions = sessionEntries.length > 0
    ? sessionEntries.length
    : extracted.planesDeClase.length;

  const sessions: SecuenciaSesion[] = [];

  if (sessionEntries.length > 0) {
    for (const { mission, sp } of sessionEntries) {
      const sNum = sp.sessionNumber;
      const plan = planesBySession.get(sNum);
      const phase = resolveSessionPhase(sNum, totalSessions, mission.missionIndex);
      const title = formatObjectiveAsTitle(
        sp.objetivo,
        plan?.tituloSesion || mission.sessionTopic || mission.title || `Sesión ${sNum}`,
        sNum
      );

      const contentSummary = firstSentence(sp.contenido, 200);
      const exampleSummary = firstSentence(sp.ejemploResuelto?.replace(/\n+/g, ' '), 180);
      const practicePrompt = firstSentence(sp.practica?.[0]?.enunciado, 190);
      const applicationTask = firstSentence(sp.aplicacion, 180);
      const motivationHook = firstSentence(sp.motivacion, 170);

      let teachingActivity = '';
      if (phase === 'Apertura') {
        teachingActivity = [
          motivationHook ? `Contextualización situada: ${motivationHook}` : cleanText(plan?.apertura.actividadDocente),
          contentSummary ? `Mediación conceptual: ${contentSummary}` : '',
          exampleSummary ? `Modelado docente: ${exampleSummary}` : '',
        ]
          .filter(Boolean)
          .join(' ');
      } else if (phase === 'Cierre') {
        teachingActivity = [
          cleanText(plan?.cierre.actividadDocente),
          contentSummary ? `Síntesis y retroalimentación: ${contentSummary}` : '',
        ]
          .filter(Boolean)
          .join(' ');
      } else {
        teachingActivity = [
          contentSummary ? `Explicación y andamiaje disciplinar: ${contentSummary}` : cleanText(plan?.desarrollo.actividadDocente),
          exampleSummary ? `Demostración guiada paso a paso: ${exampleSummary}` : '',
        ]
          .filter(Boolean)
          .join(' ');
      }

      const learningActivity = [
        practicePrompt ? `Práctica activa del libro: ${practicePrompt}` : '',
        applicationTask ? `Aplicación situada: ${applicationTask}` : '',
        !practicePrompt && !applicationTask ? cleanText(plan?.desarrollo.actividadEstudiante || sp.objetivo) : '',
      ]
        .filter(Boolean)
        .join(' ');

      const evidence = cleanText(sp.productoIntegrador || plan?.cierre.productoEsperado || 'Evidencia formativa en cuaderno de trabajo');
      const evaluation = cleanText(plan?.instrumentoEvaluacion || 'Rúbrica formativa y lista de cotejo del bloque');

      sessions.push({
        sessionNum: sNum,
        totalSessions,
        phase,
        title,
        teachingActivity: teachingActivity || cleanText(plan?.desarrollo.actividadDocente) || 'Mediación docente situada.',
        learningActivity: learningActivity || cleanText(plan?.desarrollo.actividadEstudiante) || 'Resolución de actividades del bloque.',
        evidence,
        evaluation,
      });
    }
  } else {
    for (const plan of extracted.planesDeClase) {
      const sNum = plan.numeroSesion;
      const phase = resolveSessionPhase(sNum, totalSessions);
      const phaseData = phase === 'Apertura' ? plan.apertura : phase === 'Cierre' ? plan.cierre : plan.desarrollo;
      sessions.push({
        sessionNum: sNum,
        totalSessions,
        phase,
        title: formatObjectiveAsTitle(plan.propósitoOMeta, plan.tituloSesion, sNum),
        teachingActivity: cleanText(phaseData.actividadDocente),
        learningActivity: cleanText(phaseData.actividadEstudiante),
        evidence: cleanText(plan.cierre.productoEsperado),
        evaluation: cleanText(plan.instrumentoEvaluacion),
      });
    }
  }

  return {
    blockIndex,
    blockName: cleanText(workbook.blockName || fallbackBlockName || `Bloque ${blockIndex + 1}`),
    hours: sessions.length,
    sessions,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sincroniza todos los bloques disponibles en `workbooks_json` hacia un mapa `SecuenciaCompleta`.
 * Preserva bloques existentes solo cuando un bloque no tiene libro activo en `workbooks_json`.
 */
export function buildFullSequenceFromWorkbooks(
  workbooksJson: Record<string, { current?: ActiveWorkTextbook } | ActiveWorkTextbook | undefined> | null | undefined,
  activities?: KeyActivityPlan[],
  existingSequence?: Record<number, SecuenciaBloque> | null
): SecuenciaCompleta {
  const result: SecuenciaCompleta = { ...(existingSequence || {}) };
  if (!workbooksJson || typeof workbooksJson !== 'object') {
    return result;
  }

  for (const [key, entry] of Object.entries(workbooksJson)) {
    const match = /^block_(\d+)$/.exec(key);
    if (!match || !entry) continue;
    const blockIndex = Number(match[1]);
    const workbook = ('current' in entry && entry.current ? entry.current : entry) as ActiveWorkTextbook;
    if (!workbook || !Array.isArray(workbook.missions)) continue;

    const fallbackName = activities?.[blockIndex]?.name;
    const syncedBlock = buildBlockSequenceFromWorkbook(workbook, blockIndex, fallbackName);
    if (syncedBlock && syncedBlock.sessions.length > 0) {
      result[blockIndex] = syncedBlock;
    }
  }

  return result;
}
