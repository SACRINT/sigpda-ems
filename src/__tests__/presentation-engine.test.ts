import { describe, it, expect } from 'vitest';
import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import { buildSlideDeck, clip, LIMITS } from '@/lib/presentation-engine/slide-model';
import { generatePptxBuffer, bodyFontSize } from '@/lib/presentation-engine/pptx-generator';
import { resolveDisciplineArea } from '@/lib/presentation-engine/slide-templates';

function mission(i: number): MissionSection {
  return {
    missionIndex: i,
    title: `Función lineal en el mercado local ${i}`,
    coveredSessions: [i * 3 - 2, i * 3 - 1, i * 3],
    sessionTopic: 'Función lineal',
    sessionFocus: 'Modelar costos',
    phenomenonHook: { story: 'Una tianguista calcula sus ganancias.', detonatingQuestion: '¿Cómo predecir sus ventas?' },
    conceptZero: {
      physicalAnalogy: 'Una escalera de pendiente constante.',
      coreExplanation: 'Relación y = mx + b entre dos variables.',
      contrastTable: [{ correctConcept: 'La pendiente es razón de cambio', commonMisconception: 'La pendiente es el cruce con Y', reasoning: 'x' }],
    },
    iDoSection: { stepByStepDemo: 'Calculo m con dos puntos.' },
    weDoSection: { guidedPractice: 'Calculamos m con datos del grupo.', workbookElements: [] },
    youDoSection: { autonomousChallenge: 'Modela tu propio caso.', workbookElements: [] },
    troubleshooting: [],
    formativeCheckpoint: { question: '¿Qué representa m?', reflectionPrompts: ['¿Qué dudas tengo?'], criteriaChecklist: ['Identifico m', 'Identifico b'] },
    wordCount: 100,
  };
}

function workbook(n = 2): ActiveWorkTextbook {
  return {
    id: 'w1', planningId: 'p1', blockIndex: 0, blockName: 'Bloque 1: Funciones', version: 1,
    subsystem: 'bge', targetPages: 40, totalPages: 40, totalWords: 1000, generatedAt: '2026-01-01',
    qualityScore: 90, qualityWarning: false,
    coverData: { title: 'Pensamiento Matemático I', subtitle: 's', subjectName: 'Pensamiento Matemático I', semester: 1, blockNumber: 1, teacherName: 'Docente Prueba', schoolName: 'BGE Prueba' },
    tableOfContents: Array.from({ length: n }, (_, k) => ({ missionIndex: k + 1, title: `M${k + 1}`, sessionsRange: '1-3', pageEstimate: 5 })),
    missions: Array.from({ length: n }, (_, k) => mission(k + 1)),
    projectSection: { artifactName: 'Modelo de costos', communityUtility: 'Fijar precios justos', phases: [{ phaseNum: 1, title: 'Datos', allocatedHours: 2, deliverables: [], instructions: '' }], technicalSpecs: [], acceptanceCriteria: [] },
    evaluationSection: { source: 'generated_fresh', rubric: [], checklist: [], criticalThinkingQuiz: [], metacognitiveReflection: { prompts: ['¿Qué aprendí?'] } },
  };
}

describe('H-317 — Motor de presentaciones', () => {
  it('clip respeta el límite y agrega elipsis solo si recorta', () => {
    expect(clip('hola mundo', 50)).toBe('hola mundo');
    const long = 'palabra '.repeat(60);
    const out = clip(long, LIMITS.bullet);
    expect(out.length).toBeLessThanOrEqual(LIMITS.bullet);
    expect(out.endsWith('…')).toBe(true);
  });

  it('resuelve el área disciplinar y usa laboral por componente', () => {
    expect(resolveDisciplineArea('Pensamiento Matemático I')).toBe('stem');
    expect(resolveDisciplineArea('Historia de México')).toBe('humanidades');
    expect(resolveDisciplineArea('Cualquier cosa', 'Formación laboral')).toBe('laboral');
  });

  it('construye portada + agenda + 4 slides por misión + proyecto + cierre', () => {
    const deck = buildSlideDeck(workbook(2));
    expect(deck.slides[0].kind).toBe('cover');
    expect(deck.slides[1].kind).toBe('agenda');
    expect(deck.slides.filter((s) => s.kind === 'hook')).toHaveLength(2);
    expect(deck.slides.filter((s) => s.kind === 'checkpoint')).toHaveLength(2);
    expect(deck.slides.at(-1)!.kind).toBe('closing');
    expect(deck.slides.length).toBe(2 + 2 * 4 + 1 + 1);
    expect(deck.slides.every((s) => s.notes.length > 0)).toBe(true);
    expect(deck.palette.area).toBe('stem');
  });

  it('no inventa contenido: sin proyecto ni TOC omite esos slides', () => {
    const wb = workbook(1);
    wb.tableOfContents = [];
    wb.projectSection = { ...wb.projectSection, artifactName: '' };
    const deck = buildSlideDeck(wb);
    expect(deck.slides.some((s) => s.kind === 'agenda')).toBe(false);
    expect(deck.slides.some((s) => s.kind === 'project')).toBe(false);
  });

  it('bodyFontSize escala hacia abajo con más texto', () => {
    expect(bodyFontSize(['a'])).toBeGreaterThan(bodyFontSize(['x'.repeat(200), 'y'.repeat(200), 'z'.repeat(200)]));
  });

  it('genera un .pptx válido (ZIP con ppt/slides)', async () => {
    const deck = buildSlideDeck(workbook(2));
    const buf = await generatePptxBuffer(deck);
    expect(buf.length).toBeGreaterThan(5000);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    const text = buf.toString('latin1');
    expect(text).toContain('ppt/slides/slide1.xml');
    expect(text).toContain(`ppt/slides/slide${deck.slides.length}.xml`);
  });
});
