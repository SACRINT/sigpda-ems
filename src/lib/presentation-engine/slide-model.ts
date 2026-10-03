/**
 * slide-model.ts — Modelo de diapositivas determinístico derivado del Libro de Bloque.
 * SIGPDA-EMS · Motor de Presentaciones (H-317 / H-318)
 *
 * Función pura: 0 llamadas de red, 0 tokens de IA. El mismo modelo alimenta
 * el generador PPTX y el visor web, garantizando paridad entre ambos.
 * Invariante B-001: solo se usa contenido presente en el libro; nunca se inventan datos.
 */

import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import { stripWorkbookTags } from '@/lib/guide-engine/workbook-tags';
import { getPalette, type SlidePalette } from './slide-templates';

export type SlideKind =
  | 'cover'
  | 'agenda'
  | 'hook'
  | 'concept'
  | 'practice'
  | 'checkpoint'
  | 'project'
  | 'closing';

export interface Slide {
  kind: SlideKind;
  title: string;
  subtitle?: string;
  bullets?: string[];
  callout?: { label: string; text: string };
  /** Notas del docente: sugerencias didácticas y tiempo sugerido. */
  notes: string;
  missionIndex?: number;
}

export interface SlideDeck {
  meta: {
    title: string;
    subjectName: string;
    schoolName: string;
    teacherName: string;
    semester: number;
    blockNumber: number;
    blockName: string;
    paecProjectName?: string;
  };
  palette: SlidePalette;
  slides: Slide[];
}

/** Límites de texto por elemento para evitar desbordamientos en 16:9. */
export const LIMITS = {
  title: 80,
  bullet: 150,
  bullets: 5,
  callout: 260,
  subtitle: 120,
} as const;

/** Recorta texto en límite de palabra, añadiendo elipsis solo si fue necesario. */
export function clip(text: string | undefined | null, max: number): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function clipList(items: Array<string | undefined | null>, maxItems: number = LIMITS.bullets): string[] {
  return items
    .map((i) => clip(i, LIMITS.bullet))
    .filter((i) => i.length > 0)
    .slice(0, maxItems);
}

function missionSlides(m: MissionSection, n: number): Slide[] {
  const slides: Slide[] = [];
  const label = `Misión ${n}`;

  // 1. Gancho fenomenológico
  slides.push({
    kind: 'hook',
    title: clip(`${label}: ${m.title}`, LIMITS.title),
    subtitle: 'Situación de partida',
    bullets: clipList([m.phenomenonHook?.story], 1),
    callout: m.phenomenonHook?.detonatingQuestion
      ? { label: 'Pregunta detonadora', text: clip(m.phenomenonHook.detonatingQuestion, LIMITS.callout) }
      : undefined,
    notes: 'Apertura (5-10 min). Proyecte la situación, deje 2 min de reflexión individual y recoja 3 respuestas orales antes de avanzar.',
    missionIndex: n,
  });

  // 2. Núcleo conceptual
  const contrast = m.conceptZero?.contrastTable?.[0];
  slides.push({
    kind: 'concept',
    title: clip(`${label}: Concepto clave`, LIMITS.title),
    subtitle: clip(m.sessionTopic, LIMITS.subtitle),
    bullets: clipList([
      m.conceptZero?.physicalAnalogy ? `Analogía: ${m.conceptZero.physicalAnalogy}` : undefined,
      m.conceptZero?.coreExplanation ? stripWorkbookTags(m.conceptZero.coreExplanation) : undefined,
    ], 3),
    callout: contrast
      ? { label: 'Error común', text: clip(`${contrast.commonMisconception} → ${contrast.correctConcept}`, LIMITS.callout) }
      : undefined,
    notes: 'Desarrollo (10-15 min). Explique la analogía primero y el concepto después; verifique comprensión con una pregunta rápida al grupo.',
    missionIndex: n,
  });

  // 3. Práctica gradual (Yo hago / Hacemos / Tú haces)
  const solved = m.conceptZero?.solvedExample;
  slides.push({
    kind: 'practice',
    title: clip(`${label}: Yo hago · Hacemos · Tú haces`, LIMITS.title),
    subtitle: clip(m.sessionFocus, LIMITS.subtitle),
    bullets: clipList([
      m.iDoSection?.stepByStepDemo ? `Yo hago: ${stripWorkbookTags(m.iDoSection.stepByStepDemo)}` : undefined,
      solved?.problemStatement ? `Ejemplo: ${solved.problemStatement}` : undefined,
      m.weDoSection?.guidedPractice ? `Hacemos: ${stripWorkbookTags(m.weDoSection.guidedPractice)}` : undefined,
      m.youDoSection?.autonomousChallenge ? `Tú haces: ${stripWorkbookTags(m.youDoSection.autonomousChallenge)}` : undefined,
    ], 4),
    notes: 'Desarrollo (20-25 min). Modele, practiquen en equipos y cierre con el reto autónomo en el libro de trabajo.',
    missionIndex: n,
  });

  // 4. Evaluación formativa y metacognición
  const cp = m.formativeCheckpoint;
  const tl = m.metacognitiveTrafficLight;
  slides.push({
    kind: 'checkpoint',
    title: clip(`${label}: Verifico lo aprendido`, LIMITS.title),
    subtitle: 'Evaluación formativa',
    bullets: clipList([
      cp?.question,
      ...(cp?.criteriaChecklist ?? []).map((c) => `☐ ${c}`),
    ], 4),
    callout: tl
      ? { label: 'Semáforo de autoevaluación', text: clip(`🟢 ${tl.green}  ·  🟡 ${tl.yellow}  ·  🔴 ${tl.red}`, LIMITS.callout) }
      : (cp?.reflectionPrompts?.[0]
          ? { label: 'Reflexión', text: clip(cp.reflectionPrompts[0], LIMITS.callout) }
          : undefined),
    notes: 'Cierre (5-10 min). Aplique el ticket de salida; use el semáforo para decidir qué reforzar en la siguiente sesión.',
    missionIndex: n,
  });

  return slides;
}

/**
 * Construye el mazo de diapositivas completo de un Libro de Bloque.
 */
export function buildSlideDeck(
  workbook: ActiveWorkTextbook,
  opts: { component?: string } = {}
): SlideDeck {
  const cover = workbook.coverData;
  const palette = getPalette(cover?.subjectName ?? '', opts.component);
  const missions = workbook.missions ?? [];
  const slides: Slide[] = [];

  slides.push({
    kind: 'cover',
    title: clip(cover?.title || workbook.blockName, LIMITS.title),
    subtitle: clip(
      [cover?.subjectName, cover?.semester ? `Semestre ${cover.semester}` : '', `Bloque ${cover?.blockNumber ?? workbook.blockIndex + 1}`]
        .filter(Boolean)
        .join(' · '),
      LIMITS.subtitle
    ),
    bullets: clipList([cover?.schoolName, cover?.teacherName, cover?.paecProjectName ? `PAEC: ${cover.paecProjectName}` : undefined], 3),
    notes: 'Presente el bloque, su propósito y la ruta de misiones que recorrerán.',
  });

  if (workbook.tableOfContents?.length) {
    slides.push({
      kind: 'agenda',
      title: 'Ruta de aprendizaje',
      subtitle: clip(workbook.blockName, LIMITS.subtitle),
      bullets: clipList(
        workbook.tableOfContents.map((t) => `Misión ${t.missionIndex}: ${t.title} (sesiones ${t.sessionsRange})`),
        8
      ),
      notes: 'Muestre el recorrido completo para que el grupo anticipe qué y cuándo aprenderá.',
    });
  }

  missions.forEach((m, idx) => slides.push(...missionSlides(m, m.missionIndex || idx + 1)));

  const proj = workbook.projectSection;
  if (proj?.artifactName) {
    slides.push({
      kind: 'project',
      title: clip(`Proyecto integrador: ${proj.artifactName}`, LIMITS.title),
      subtitle: 'Utilidad comunitaria',
      bullets: clipList([
        proj.communityUtility,
        ...(proj.phases ?? []).map((p) => `Fase ${p.phaseNum}: ${p.title} (${p.allocatedHours} h)`),
      ], 5),
      notes: 'Presente el producto final, sus fases y los criterios de aceptación antes de iniciar el trabajo en equipo.',
    });
  }

  slides.push({
    kind: 'closing',
    title: 'Cierre y reflexión del bloque',
    bullets: clipList(workbook.evaluationSection?.metacognitiveReflection?.prompts ?? [], 4),
    notes: 'Cierre del bloque. Recupere aprendizajes, comparta logros y anticipe el siguiente bloque.',
  });

  return {
    meta: {
      title: cover?.title || workbook.blockName,
      subjectName: cover?.subjectName ?? '',
      schoolName: cover?.schoolName ?? '',
      teacherName: cover?.teacherName ?? '',
      semester: cover?.semester ?? 0,
      blockNumber: cover?.blockNumber ?? workbook.blockIndex + 1,
      blockName: workbook.blockName,
      paecProjectName: cover?.paecProjectName,
    },
    palette,
    slides,
  };
}
