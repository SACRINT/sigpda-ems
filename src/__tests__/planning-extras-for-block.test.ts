import { describe, it, expect } from 'vitest';
import {
  selectExtrasForBlock,
  selectAllExtrasCombined,
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

describe('selectAllExtrasCombined', () => {
  it('combina 72 sesiones de 3 bloques en orden estrictamente canónico (Bloque 0: 1..24, Bloque 1: 1..24, Bloque 2: 1..24)', () => {
    // Generar 72 planes (24 por bloque) completamente desordenados
    const all72: BlockExtraLike[] = [];
    for (let b = 0; b < 3; b++) {
      for (let s = 1; s <= 24; s++) {
        all72.push(lp(`b${b}_s${s}`, b, s, s));
      }
    }
    // Desordenar deliberadamente
    const shuffled = [...all72].reverse().sort(() => (Math.sin(all72.length) > 0 ? -1 : 1));

    const combined = selectAllExtrasCombined(shuffled, content, 'lesson_plan');
    expect(combined).toHaveLength(72);

    // Primeras 24 deben ser Bloque 0 en orden 1..24
    for (let i = 0; i < 24; i++) {
      expect(combined[i].key_index).toBe(0);
      expect(extractSessionNumber(combined[i])).toBe(i + 1);
    }

    // Segundas 24 deben ser Bloque 1 en orden 1..24
    for (let i = 0; i < 24; i++) {
      expect(combined[24 + i].key_index).toBe(1);
      expect(extractSessionNumber(combined[24 + i])).toBe(i + 1);
    }

    // Terceras 24 deben ser Bloque 2 en orden 1..24
    for (let i = 0; i < 24; i++) {
      expect(combined[48 + i].key_index).toBe(2);
      expect(extractSessionNumber(combined[48 + i])).toBe(i + 1);
    }
  });

  it('deduplica sesiones idénticas dentro del mismo bloque conservando la más reciente', () => {
    const items: BlockExtraLike[] = [
      lp('b0_s1_old', 0, 1, 1),
      lp('b0_s1_new', 0, 1, 10),
      lp('b0_s2', 0, 2, 2),
      lp('b1_s1', 1, 1, 1),
    ];
    const combined = selectAllExtrasCombined(items, content, 'lesson_plan');
    expect(combined.map((c) => c.id)).toEqual(['b0_s1_new', 'b0_s2', 'b1_s1']);
  });

  it('combina recursos no-planes (solucionario / teacher_guide) ordenando Bloque 0 -> Bloque 1 -> Bloque 2', () => {
    const guides: BlockExtraLike[] = [
      { id: 'guide_b2', type: 'teacher_guide', title: 'Solucionario Bloque 3', key_index: 2, content_text: '' },
      { id: 'guide_b0', type: 'teacher_guide', title: 'Solucionario Bloque 1', key_index: 0, content_text: '' },
      { id: 'guide_b1', type: 'teacher_guide', title: 'Solucionario Bloque 2', key_index: 1, content_text: '' },
    ];
    const combined = selectAllExtrasCombined(guides, content, 'teacher_guide');
    expect(combined.map((c) => c.id)).toEqual(['guide_b0', 'guide_b1', 'guide_b2']);
  });

  it('soporta esquema heredado de key_index por actividad para todos los bloques', () => {
    // Actividades [0,1]->Bloque 0, [2,3]->Bloque 1, [4,5]->Bloque 2
    const items: BlockExtraLike[] = [
      lp('x5', 5, 2), // Bloque 2, Sesión 2
      lp('x0', 0, 1), // Bloque 0, Sesión 1
      lp('x3', 3, 1), // Bloque 1, Sesión 1
      lp('x1', 1, 2), // Bloque 0, Sesión 2
      lp('x4', 4, 1), // Bloque 2, Sesión 1
      lp('x2', 2, 2), // Bloque 1, Sesión 2
    ];
    const combined = selectAllExtrasCombined(items, content, 'lesson_plan');
    expect(combined.map((c) => c.id)).toEqual(['x0', 'x1', 'x3', 'x2', 'x4', 'x5']);
  });

  it('devuelve array vacío si no hay extras del tipo solicitado', () => {
    const items: BlockExtraLike[] = [lp('lp1', 0, 1)];
    expect(selectAllExtrasCombined(items, content, 'rubric')).toEqual([]);
  });
});


