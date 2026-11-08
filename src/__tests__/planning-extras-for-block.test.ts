import { describe, it, expect } from 'vitest';
import {
  selectExtrasForBlock,
  extractSessionNumber,
  type BlockExtraLike,
} from '@/lib/planning-extras-for-block';
import type { GeneratedPlanningContent } from '@/types/planning';

// 6 actividades → bloques: [0,1], [2,3], [4,5]
const content = {
  sectionI: { totalHours: 72 },
  sectionIV: {
    activities: [0, 1, 2, 3, 4, 5].map((i) => ({ name: `Act ${i + 1}`, hours: 12 })),
  },
} as unknown as GeneratedPlanningContent;

const lp = (id: string, keyIndex: number | null, session: number | null, day = 1): BlockExtraLike => ({
  id,
  type: 'lesson_plan',
  title: session === null ? 'Plan sin número' : `Plan de Clase — Sesión ${session}: Tema`,
  key_index: keyIndex,
  content_text: '',
  created_at: new Date(2026, 10, day),
});

describe('extractSessionNumber', () => {
  it('lee el número desde título o cuerpo', () => {
    expect(extractSessionNumber({ title: 'Sesión 12 — x', content_text: '' })).toBe(12);
    expect(extractSessionNumber({ title: 'x', content_text: 'Plan\nSesion 7 de 24' })).toBe(7);
    expect(extractSessionNumber({ title: 'x', content_text: 'nada' })).toBeNull();
  });
});

describe('selectExtrasForBlock', () => {
  it('ordena 1→24 numéricamente (no "1,10,11,2,...")', () => {
    const shuffled = Array.from({ length: 24 }, (_, i) => lp(`id${i + 1}`, 0, i + 1)).reverse();
    const out = selectExtrasForBlock(shuffled, content, 0, 'lesson_plan');
    expect(out.map((e) => extractSessionNumber(e))).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it('filtra por bloque: no mezcla las sesiones 1..24 de bloques distintos', () => {
    const all = [lp('a1', 0, 1), lp('a2', 0, 2), lp('b1', 1, 1), lp('c1', 2, 1)];
    expect(selectExtrasForBlock(all, content, 0, 'lesson_plan').map((e) => e.id)).toEqual(['a1', 'a2']);
    expect(selectExtrasForBlock(all, content, 1, 'lesson_plan').map((e) => e.id)).toEqual(['b1']);
    expect(selectExtrasForBlock(all, content, 2, 'lesson_plan').map((e) => e.id)).toEqual(['c1']);
  });

  it('deduplica por id y conserva la versión más reciente de cada sesión', () => {
    const all = [lp('old', 0, 3, 1), lp('new', 0, 3, 5), lp('new', 0, 3, 5), lp('s1', 0, 1)];
    const out = selectExtrasForBlock(all, content, 0, 'lesson_plan');
    expect(out.map((e) => e.id)).toEqual(['s1', 'new']);
  });

  it('esquema heredado (key_index = actividad) asigna por activityIndices', () => {
    const all = [lp('x0', 0, 1), lp('x3', 3, 1), lp('x5', 5, 1)];
    expect(selectExtrasForBlock(all, content, 0, 'lesson_plan').map((e) => e.id)).toEqual(['x0']);
    expect(selectExtrasForBlock(all, content, 1, 'lesson_plan').map((e) => e.id)).toEqual(['x3']);
    expect(selectExtrasForBlock(all, content, 2, 'lesson_plan').map((e) => e.id)).toEqual(['x5']);
  });

  it('bloque sin planes devuelve lista vacía', () => {
    expect(selectExtrasForBlock([lp('a1', 0, 1)], content, 2, 'lesson_plan')).toEqual([]);
  });

  it('ignora otros tipos de extra', () => {
    const rubric: BlockExtraLike = { ...lp('r', 0, 1), type: 'rubric' };
    expect(selectExtrasForBlock([rubric, lp('a1', 0, 1)], content, 0, 'lesson_plan').map((e) => e.id)).toEqual(['a1']);
  });
});

