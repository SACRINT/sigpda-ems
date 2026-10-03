/**
 * H-323 — Desacoplamiento pedagógico de las 24 sesiones (sin clones, roles, tiempos, técnicas)
 * H-324 — Auditoría de coherencia cruzada Plan de Clase ↔ Libro de Trabajo
 */
import { describe, it, expect } from 'vitest';
import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import {
  resolveSessionRole, buildSessionMoments, pickTechnique, clipText,
  TECNICAS_APERTURA, TECNICAS_CIERRE,
} from '@/lib/guide-engine/pedagogical-moments';
import { auditPlanWorkbookCoherence } from '@/lib/guide-engine/plan-workbook-coherence';

function mission(i: number, over: Partial<MissionSection> = {}): MissionSection {
  return {
    missionIndex: i,
    title: `Misión ${i} del bloque`,
    coveredSessions: [i * 3 - 2, i * 3 - 1, i * 3],
    sessionTopic: `Tema ${i}`,
    sessionFocus: `Foco de la misión ${i}`,
    phenomenonHook: { story: `Historia situada número ${i} en la comunidad.`, detonatingQuestion: `¿Pregunta detonadora ${i}?` },
    conceptZero: {
      physicalAnalogy: `Analogía ${i}`,
      coreExplanation: `Explicación central ${i}`,
      solvedExample: { problemStatement: `Problema ejemplo ${i}`, solutionSteps: ['a'], interpretation: 'i' },
      contrastTable: [{ correctConcept: `Correcto ${i}`, commonMisconception: `Error ${i}`, reasoning: 'r' }],
    },
    iDoSection: { stepByStepDemo: `Demostración del procedimiento ${i}` },
    weDoSection: { guidedPractice: `Practica guiada alfa ${i} con el equipo`, workbookElements: [] },
    youDoSection: { autonomousChallenge: `Reto autonomo omega ${i} individual`, workbookElements: [] },
    troubleshooting: [],
    formativeCheckpoint: { question: `¿Checkpoint ${i}?`, reflectionPrompts: [`Reflexión ${i}`], criteriaChecklist: [`Criterio ${i}`] },
    wordCount: 100,
    ...over,
  };
}

function workbook(n = 8): ActiveWorkTextbook {
  return {
    id: 'w', planningId: 'p', blockIndex: 0, blockName: 'Bloque 1', version: 1, subsystem: 'bge', targetPages: 1,
    totalPages: 1, totalWords: 1, generatedAt: '', qualityScore: 90, qualityWarning: false,
    coverData: { title: 't', subtitle: '', subjectName: 'Física I', semester: 1, blockNumber: 1, teacherName: 'D', schoolName: 'E' },
    tableOfContents: [], missions: Array.from({ length: n }, (_, k) => mission(k + 1)),
    projectSection: { artifactName: '', communityUtility: '', phases: [], technicalSpecs: [], acceptanceCriteria: [] },
    evaluationSection: { source: 'generated_fresh', rubric: [], checklist: [], criticalThinkingQuiz: [], metacognitiveReflection: { prompts: [] } },
  };
}

describe('H-323 — roles de sesión', () => {
  const m = mission(1);
  it('primera = introducción, intermedia = práctica, última = consolidación', () => {
    expect(resolveSessionRole(m, 1)).toBe('introduccion');
    expect(resolveSessionRole(m, 2)).toBe('practica');
    expect(resolveSessionRole(m, 3)).toBe('consolidacion');
  });
  it('misión de una sola sesión = completa; relleno cicla 1-2-3', () => {
    expect(resolveSessionRole(mission(1, { coveredSessions: [5] }), 5)).toBe('completa');
    expect(resolveSessionRole(m, 4)).toBe('introduccion');
    expect(resolveSessionRole(m, 5)).toBe('practica');
    expect(resolveSessionRole(m, 6)).toBe('consolidacion');
  });
});

describe('H-323 — momentos didácticos', () => {
  const m = mission(2);
  it('cada rol trabaja la parte correspondiente de la misión', () => {
    const intro = buildSessionMoments(m, 4);
    const prac = buildSessionMoments(m, 5);
    const cons = buildSessionMoments(m, 6);
    expect(intro.apertura.docente).toContain('Historia situada número 2');
    expect(intro.desarrollo.docente).toContain('Explicación central 2');
    expect(prac.desarrollo.docente).toContain('Practica guiada alfa 2');
    expect(prac.apertura.docente).toContain('Problema ejemplo 2');
    expect(cons.desarrollo.docente).toContain('Reto autonomo omega 2');
    expect(cons.apertura.docente).toContain('Error 2');
    expect(cons.cierre.docente).toContain('¿Checkpoint 2?');
  });

  it('los tiempos de cada rol suman 50 minutos y difieren entre roles', () => {
    const t = [4, 5, 6].map((n) => buildSessionMoments(m, n).tiempos);
    t.forEach((x) => expect(x.apertura + x.desarrollo + x.cierre).toBe(50));
    expect(new Set(t.map((x) => JSON.stringify(x))).size).toBe(3);
  });

  it('no inventa datos: sin contenido usa fallbacks genéricos sin citar nada', () => {
    const empty = mission(1, {
      phenomenonHook: { story: '', detonatingQuestion: '' },
      conceptZero: { physicalAnalogy: '', coreExplanation: '' },
      iDoSection: { stepByStepDemo: '' }, weDoSection: { guidedPractice: '', workbookElements: [] },
      youDoSection: { autonomousChallenge: '', workbookElements: [] },
      formativeCheckpoint: { question: '', reflectionPrompts: [], criteriaChecklist: [] },
    });
    for (const n of [1, 2, 3]) {
      const mo = buildSessionMoments(empty, n);
      expect(mo.apertura.docente.length).toBeGreaterThan(10);
      expect(JSON.stringify(mo)).not.toContain('undefined');
      expect(JSON.stringify(mo)).not.toContain('""');
    }
  });

  it('clipText solo agrega elipsis cuando recorta (corrige el "..." incondicional)', () => {
    expect(clipText('texto corto', 50)).toBe('texto corto');
    expect(clipText('palabra '.repeat(40), 40).endsWith('…')).toBe(true);
  });

  it('las técnicas varían entre sesiones consecutivas y entre ciclos', () => {
    const a = [1, 2, 3, 4, 5, 6].map((n) => pickTechnique(TECNICAS_APERTURA, 1, n, resolveSessionRole(mission(1), n)));
    expect(new Set(a).size).toBeGreaterThan(1);
    const c = [1, 2, 3].map((n) => pickTechnique(TECNICAS_CIERRE, 1, n, resolveSessionRole(mission(1), n), 1));
    expect(new Set(c).size).toBeGreaterThan(1);
  });
});

describe('H-323 — las 24 sesiones del bloque no son clones', () => {
  const ex = extractMaterialsFromWorkbook(workbook(8));

  it('hay 24 planes y ninguna misión tiene sesiones clonadas', () => {
    expect(ex.planesDeClase).toHaveLength(24);
    for (let i = 0; i < 8; i++) {
      const trio = ex.planesDeClase.slice(i * 3, i * 3 + 3);
      const keys = trio.map((p) => `${p.apertura.actividadDocente}|${p.desarrollo.actividadDocente}|${p.cierre.actividadDocente}`);
      expect(new Set(keys).size).toBe(3);
    }
  });

  it('el propósito difiere por rol y los tiempos suman 50', () => {
    const [p1, p2, p3] = ex.planesDeClase;
    expect(p1.propósitoOMeta).toMatch(/^Introducir:/);
    expect(p2.propósitoOMeta).toMatch(/^Practicar:/);
    expect(p3.propósitoOMeta).toMatch(/^Consolidar:/);
    for (const p of ex.planesDeClase) {
      expect(p.apertura.tiempoMinutos + p.desarrollo.tiempoMinutos + p.cierre.tiempoMinutos).toBe(p.duracionMinutos);
    }
  });
});

describe('H-324 — auditoría de coherencia', () => {
  it('un libro coherente produce ok sin errores ni advertencias', () => {
    const ex = extractMaterialsFromWorkbook(workbook(8));
    expect(ex.coherencia).toBeDefined();
    expect(ex.coherencia!.errors).toEqual([]);
    expect(ex.coherencia!.warnings).toEqual([]);
    expect(ex.coherencia!.ok).toBe(true);
  });

  it('detecta E1: faltan planes / numeración rota', () => {
    const wb = workbook(8);
    const ex = extractMaterialsFromWorkbook(wb);
    const broken = ex.planesDeClase.slice(0, 20);
    const r = auditPlanWorkbookCoherence(wb, broken);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith('E1'))).toBe(true);
  });

  it('detecta E2: tiempos que no suman la duración', () => {
    const wb = workbook(8);
    const planes = extractMaterialsFromWorkbook(wb).planesDeClase.map((p) => ({ ...p }));
    planes[3] = { ...planes[3], cierre: { ...planes[3].cierre, tiempoMinutos: 99 } };
    const r = auditPlanWorkbookCoherence(wb, planes);
    expect(r.errors.some((e) => e.startsWith('E2') && e.includes('sesión 4'))).toBe(true);
  });

  it('detecta E4: sesiones clonadas dentro de una misión', () => {
    const wb = workbook(8);
    const planes = extractMaterialsFromWorkbook(wb).planesDeClase.map((p) => ({ ...p }));
    planes[1] = { ...planes[1], apertura: planes[0].apertura, desarrollo: planes[0].desarrollo, cierre: planes[0].cierre };
    const r = auditPlanWorkbookCoherence(wb, planes);
    expect(r.errors.some((e) => e.startsWith('E4') && e.includes('Misión 1'))).toBe(true);
  });

  it('advierte W1/W2 si el reto o la práctica del libro no aparecen en el plan', () => {
    const wb = workbook(8);
    const planes = extractMaterialsFromWorkbook(wb).planesDeClase;
    wb.missions[0] = mission(1, {
      youDoSection: { autonomousChallenge: 'Construir una maqueta de puente colgante', workbookElements: [] },
      weDoSection: { guidedPractice: 'Medir sombras al mediodía con cinta', workbookElements: [] },
    });
    const r = auditPlanWorkbookCoherence(wb, planes);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.startsWith('W1'))).toBe(true);
    expect(r.warnings.some((w) => w.startsWith('W2'))).toBe(true);
  });
});
