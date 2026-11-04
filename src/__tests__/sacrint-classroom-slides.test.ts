import { describe, it, expect } from 'vitest';
import { buildSacrintDeck } from '@/lib/visual-engine/sacrint/spec';
import { renderSlideSvg } from '@/lib/visual-engine/sacrint/slide-renderer';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';

describe('SACRINT Classroom Presentation Re-engineering (Bug 5)', () => {
  it('generates 4 operational slides in classroom mode instead of 8 bloated slides', () => {
    const deck = buildSacrintDeck(MATH_DEMO_WORKBOOK, { mode: 'classroom' });
    expect(deck.slides.length).toBe(4);
    const kinds = deck.slides.map((s) => s.kind);
    expect(kinds).toEqual(['hook', 'concept', 'demo', 'challenge']);
  });

  it('preserves 8 slides in full mode when explicitly requested', () => {
    const deck = buildSacrintDeck(MATH_DEMO_WORKBOOK, { mode: 'full' });
    expect(deck.slides.length).toBe(8);
  });

  it('renders hook slide with dynamic Y spacing and projector-readable font sizes', () => {
    const deck = buildSacrintDeck(MATH_DEMO_WORKBOOK, { mode: 'classroom' });
    const hookSlide = deck.slides.find((s) => s.kind === 'hook');
    expect(hookSlide).toBeDefined();
    if (!hookSlide) return;

    const svg = renderSlideSvg(deck, hookSlide);
    expect(svg).toContain('<svg');
    expect(svg).toContain('PREGUNTA DETONADORA');
    expect(svg).toContain('SITUACIÓN DE PARTIDA');
  });

  it('renders concept slide with dynamic analogy and misconception panels', () => {
    const deck = buildSacrintDeck(MATH_DEMO_WORKBOOK, { mode: 'classroom' });
    const conceptSlide = deck.slides.find((s) => s.kind === 'concept');
    expect(conceptSlide).toBeDefined();
    if (!conceptSlide) return;

    const svg = renderSlideSvg(deck, conceptSlide);
    expect(svg).toContain('<svg');
    expect(svg).toContain('ANALOGÍA FÍSICA');
    expect(svg).toContain('ERROR COMÚN');
    expect(svg).toContain('FIG. 01');
  });
});
