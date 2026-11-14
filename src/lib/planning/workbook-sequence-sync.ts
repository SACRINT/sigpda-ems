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
import {
  extractMaterialsFromWorkbook,
  resolveBlockSessionRange,
} from '@/lib/guide-engine/material-extractor';
import { stripMaterialTokens } from '@/lib/materials/material-tokens';

function cleanText(raw: string | undefined | null): string {
  if (!raw) return '';
  return stripMaterialTokens(raw)
    .replace(/\s+/g, ' ')
    .trim();
}

const DANGLING_TRAILING_WORDS = new Set([
  'de', 'del', 'a', 'al', 'en', 'con', 'sin', 'por', 'para', 'hacia', 'hasta',
  'desde', 'sobre', 'entre', 'ante', 'bajo', 'tras', 'mediante', 'segun', 'según',
  'durante', 'contra', 'y', 'e', 'o', 'u', 'ni', 'que', 'como', 'donde', 'cuando',
  'mientras', 'el', 'la', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas',
  'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
  'utilizando', 'usando', 'empleando', 'aplicando', 'considerando', 'tomando', 'realizando',
]);

/**
 * Recorta un texto largo en un límite natural (oración completa, cláusula o frontera de palabra)
 * evitando terminar en comas colgantes, preposiciones, artículos, conjunciones o gerundios truncos.
 */
export function trimAtCleanBoundary(text: string, maxLen: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const stripDanglingTail = (input: string): string => {
    const words = input.replace(/[,;:\-–—]+$/g, '').trim().split(/\s+/).filter(Boolean);
    while (words.length > 3) {
      const lastRaw = words[words.length - 1];
      const lastClean = lastRaw.replace(/[,;:\-–—.!?]+$/g, '').toLowerCase();
      if (!lastClean || DANGLING_TRAILING_WORDS.has(lastClean)) {
        words.pop();
        continue;
      }
      if (lastRaw !== lastClean && /[,;:\-–—]$/.test(lastRaw)) {
        words[words.length - 1] = lastRaw.replace(/[,;:\-–—]+$/g, '');
      }
      break;
    }
    return words.join(' ').replace(/[,;:\-–—]+$/g, '').trim();
  };

  if (cleaned.length <= maxLen) {
    return cleaned.replace(/[,;:\-–—]+$/g, '').trim();
  }

  const windowSlice = cleaned.slice(0, maxLen);

  // 1. Preferir cierre natural de oración dentro de la ventana
  const minSentenceIdx = Math.min(45, Math.floor(maxLen * 0.35));
  let bestSentenceEnd = -1;
  for (const m of windowSlice.matchAll(/[.!?](?=\s|$)/g)) {
    if (typeof m.index === 'number' && m.index >= minSentenceIdx) {
      bestSentenceEnd = m.index + 1;
    }
  }
  if (bestSentenceEnd > 0) {
    return windowSlice.slice(0, bestSentenceEnd).trim();
  }

  // 2. O bien un corte limpio de cláusula (coma o punto y coma suficientemente avanzado)
  const minClauseIdx = Math.floor(maxLen * 0.55);
  let bestClauseEnd = -1;
  for (const m of windowSlice.matchAll(/[,;](?=\s)/g)) {
    if (typeof m.index === 'number' && m.index >= minClauseIdx) {
      bestClauseEnd = m.index;
    }
  }
  if (bestClauseEnd > 0) {
    return stripDanglingTail(windowSlice.slice(0, bestClauseEnd));
  }

  // 3. Corte en espacio completo y limpieza de preposiciones/conectores colgantes
  const lastSpace = windowSlice.lastIndexOf(' ');
  const wordCut = (lastSpace > 40 ? windowSlice.slice(0, lastSpace) : windowSlice).trim();
  return stripDanglingTail(wordCut) || wordCut;
}

function firstSentence(raw: string | undefined | null, maxLen = 220): string {
  const cleaned = cleanText(raw);
  if (!cleaned) return '';
  const match = cleaned.match(/^.+?[.!?](?=\s|$)/);
  const sentence = match ? match[0].trim() : cleaned;
  if (sentence.length <= maxLen) return sentence;
  const trimmed = trimAtCleanBoundary(sentence, maxLen);
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
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
  const concise = trimAtCleanBoundary(capitalized, 145).replace(/\.$/, '').trim();
  return `Sesión ${sessionNum}: ${concise}`;
}

function resolveSessionPhase(
  sessionNum: number,
  totalSessions: number,
  missionIndex?: number,
  startSession = 1
): 'Apertura' | 'Desarrollo' | 'Cierre' {
  if (missionIndex === 1) return 'Apertura';
  if (missionIndex === 4) return 'Cierre';
  if (missionIndex === 2 || missionIndex === 3) return 'Desarrollo';
  const relSession = Math.max(1, sessionNum - startSession + 1);
  const apLimit = totalSessions >= 16 ? 3 : totalSessions >= 10 ? 2 : 1;
  const cieStart = totalSessions - (totalSessions >= 16 ? 3 : totalSessions >= 10 ? 2 : 1) + 1;
  if (relSession <= apLimit) return 'Apertura';
  if (relSession >= cieStart) return 'Cierre';
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
  const { startSession } = resolveBlockSessionRange(workbook);

  const sessions: SecuenciaSesion[] = [];

  if (sessionEntries.length > 0) {
    for (const { mission, sp } of sessionEntries) {
      const sNum = sp.sessionNumber;
      const plan = planesBySession.get(sNum);
      const phase = resolveSessionPhase(sNum, totalSessions, mission.missionIndex, startSession);
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
      const phase = resolveSessionPhase(sNum, totalSessions, undefined, startSession);
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
