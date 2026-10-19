/**
 * editorial-plan-completeness.test.ts — Reparador de integridad editorial con IA
 *
 * Bug 54/72: 18 planes blandos (12 sin recursos + 6 con 1 autoeval) descartados
 * en silencio. Este módulo garantiza la capa 1 (IA) y capa 2 (red determinista)
 * de la solución en capas. Se inyectan generateFn/saveFn para tests deterministas
 * SIN llamadas reales de IA ni escrituras reales en BD.
 */
import { describe, it, expect, vi } from 'vitest';
import { ensureEditorialPlanCompleteness } from '@/lib/editorial/plan-completeness';
import type { WorkbooksJsonShape } from '@/lib/editorial/plan-completeness';
import type { SessionPlan } from '@/types/work-textbook';

function makePlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    sessionNumber: 1,
    objetivo: 'Vas a aprender a calcular la variación porcentual con datos reales de tu comunidad.',
    motivacion: 'Imagina que en tu tienda los precios cambian cada semana: medir ese cambio es la tarea de hoy.',
    saberesPrevios: 'Ya dominas operaciones básicas, porcentajes y tabulación de datos en clase.',
    contenido:
      'Parrafo: La variación porcentual describe qué tan grande es la diferencia entre dos cantidades.\n\nDefinicion: Relación de cambio proporcional expresada en porcentaje.',
    ejemploResuelto: 'Un vendedor vendió 5 artículos en 2 días.\nPaso 1: 5 / 2 = 2.5 artículos por día.',
    practica: [
      {
        enunciado: 'Calcula la variación cuando el precio pasa de 20 a 25 pesos concretos.',
        pista: 'Aplica la fórmula de variación porcentual paso a paso con los dos valores dados.',
      },
    ],
    aplicacion: 'Aplica la variación porcentual al presupuesto del salón de clases y justifica tu estrategia.',
    autoevaluacion: [
      '¿Puedes explicar la variación porcentual con tus palabras?',
      '¿Resolviste el ejemplo sin ayuda y sin equivocarte?',
    ],
    recursos: [
      {
        titulo: 'Video de variación porcentual',
        url: 'https://www.youtube.com/watch?v=vid001',
        tipo: 'video',
      },
    ],
    productoIntegrador: 'Agregas una tabla de variación a tu proyecto comunitario.',
    ...overrides,
  };
}

/** Plan con las DOS violaciones blandas históricas del bug 54/72. */
function makeBrokenPlan(sessionNumber: number): SessionPlan {
  return makePlan({
    sessionNumber,
    recursos: [],
    autoevaluacion: ['¿Puedes explicar qué aprendiste hoy con un ejemplo?'],
  });
}

function workbooksWith(plans: SessionPlan[]): WorkbooksJsonShape {
  return {
    block_0: {
      current: {
        missions: [{ title: 'Misión 1', sessionPlans: plans }],
      },
    },
  };
}

const VALID_AI_ITEM = {
  blockIndex: 0,
  sessionNumber: 1,
  recursos: [
    { titulo: 'Video de apoyo: variación porcentual', url: 'https://www.youtube.com/watch?v=ai001', tipo: 'video' },
  ],
  autoevaluacion: [
    '¿Puedes explicar la variación porcentual con un ejemplo propio?',
    '¿Resolviste la práctica sin copiar los pasos?',
  ],
};

describe('ensureEditorialPlanCompleteness — capas 1 (IA) y 2 (red determinista)', () => {
  it('camino rápido: sin issues blandos → 0 llamadas de IA, 0 guardados y misma referencia', async () => {
    const source = workbooksWith([makePlan({ sessionNumber: 1 }), makePlan({ sessionNumber: 2 })]);
    const generateFn = vi.fn();
    const saveFn = vi.fn();

    const res = await ensureEditorialPlanCompleteness(
      { workbooksJson: source, planningId: 'p1', teacherId: 't1' },
      { generateFn, saveFn },
    );

    expect(res.mode).toBe('noop');
    expect(res.issuesFound).toBe(0);
    expect(res.aiCalls).toBe(0);
    expect(res.workbooksJson).toBe(source);
    expect(generateFn).not.toHaveBeenCalled();
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('workbooks_json vacío/nulo → noop sin llamadas', async () => {
    const generateFn = vi.fn();
    for (const input of [null, undefined, {}] as const) {
      const res = await ensureEditorialPlanCompleteness(
        { workbooksJson: input as never, planningId: 'p1' },
        { generateFn },
      );
      expect(res.mode).toBe('noop');
      expect(generateFn).not.toHaveBeenCalled();
    }
  });

  it('la IA repara en lote los campos faltantes, persiste en BD y NO muta el original', async () => {
    const source = workbooksWith([makeBrokenPlan(1)]);
    const generateFn = vi.fn().mockResolvedValue(JSON.stringify([VALID_AI_ITEM]));
    const saveFn = vi.fn().mockResolvedValue({ version: 3, success: true });

    const res = await ensureEditorialPlanCompleteness(
      {
        workbooksJson: source,
        planningId: 'planning-1',
        teacherId: 'teacher-1',
        uacName: 'Pensamiento Matemático III',
      },
      { generateFn, saveFn },
    );

    expect(res.mode).toBe('ai');
    expect(res.issuesFound).toBe(1);
    expect(res.aiCalls).toBe(1);
    expect(res.aiRepaired).toBe(1);
    expect(res.fallbackPads).toBe(0);
    expect(res.unresolved).toBe(0);
    expect(res.persisted).toBe(true);

    // Prompt de IA: jsonMode + premium + solo las sesiones faltantes
    const [, userPrompt, , isPremium, options] = generateFn.mock.calls[0];
    expect(userPrompt).toContain('"sessionNumber":1');
    expect(userPrompt).toContain('"falta"');
    expect(isPremium).toBe(true);
    expect(options).toMatchObject({ jsonMode: true });

    // Persistencia con el bloque tocado
    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn.mock.calls[0][0]).toBe('planning-1');
    expect(saveFn.mock.calls[0][1]).toBe(0);

    // El clon quedó reparado…
    const repaired = res.workbooksJson.block_0!.current!.missions![0].sessionPlans![0];
    expect(repaired.recursos).toHaveLength(1);
    expect(repaired.recursos[0].url).toBe('https://www.youtube.com/watch?v=ai001');
    expect(repaired.autoevaluacion).toHaveLength(2);

    // …y el ORIGINAL quedó intacto (la BD solo cambia vía saveBlockWorkbook)
    const original = source.block_0!.current!.missions![0].sessionPlans![0];
    expect(original.recursos).toHaveLength(0);
    expect(original.autoevaluacion).toHaveLength(1);
    expect(res.workbooksJson).not.toBe(source);
  });

  it('JSON malformado de la IA → reintento con solo los pendientes', async () => {
    const source = workbooksWith([makeBrokenPlan(1)]);
    const generateFn = vi
      .fn()
      .mockResolvedValueOnce('esto no es json {')
      .mockResolvedValueOnce(JSON.stringify([VALID_AI_ITEM]));
    const saveFn = vi.fn().mockResolvedValue({ version: 3, success: true });

    const res = await ensureEditorialPlanCompleteness(
      { workbooksJson: source, planningId: 'p1' },
      { generateFn, saveFn },
    );

    expect(res.aiCalls).toBe(2);
    expect(res.mode).toBe('ai');
    expect(res.aiRepaired).toBe(1);
    expect(res.fallbackPads).toBe(0);
    expect(res.unresolved).toBe(0);
  });

  it('items de la IA con URL inválida → se rechazan y reintenta; si sigue fallando usa la red determinista', async () => {
    const source = workbooksWith([makeBrokenPlan(1)]);
    const badItem = {
      blockIndex: 0,
      sessionNumber: 1,
      recursos: [{ titulo: 'Enlace roto', url: 'no-es-una-url', tipo: 'video' }],
      autoevaluacion: ['¿Sí?', 'No'], // <10 caracteres → también inválidos
    };
    const generateFn = vi.fn().mockResolvedValue(JSON.stringify([badItem]));
    const saveFn = vi.fn().mockResolvedValue({ version: 3, success: true });

    const res = await ensureEditorialPlanCompleteness(
      { workbooksJson: source, planningId: 'p1' },
      { generateFn, saveFn },
    );

    expect(res.aiCalls).toBe(3); // 3 intentos, todos con items inválidos
    expect(res.aiRepaired).toBe(0);
    expect(res.fallbackPads).toBe(1);
    expect(res.mode).toBe('fallback');
    expect(res.unresolved).toBe(0);
    expect(res.persisted).toBe(true);

    const repaired = res.workbooksJson.block_0!.current!.missions![0].sessionPlans![0];
    expect(repaired.recursos[0].url).toMatch(/^https:\/\//); // catálogo oficial
    expect(repaired.autoevaluacion).toHaveLength(2);
  });

  it('la IA lanza excepción (caída de proveedor) → sin reintentos ciegos, red determinista completa todo', async () => {
    const source = workbooksWith([makeBrokenPlan(1), makeBrokenPlan(2)]);
    const generateFn = vi.fn().mockRejectedValue(new Error('503 upstream'));
    const saveFn = vi.fn().mockResolvedValue({ version: 3, success: true });

    const res = await ensureEditorialPlanCompleteness(
      { workbooksJson: source, planningId: 'p1' },
      { generateFn, saveFn },
    );

    expect(res.aiCalls).toBe(1); // corta en el primer error
    expect(res.fallbackPads).toBe(2);
    expect(res.unresolved).toBe(0);
    expect(res.mode).toBe('fallback');
    expect(saveFn).toHaveBeenCalledTimes(1); // un solo bloque tocado
  });

  it('deadline consumido (0 ms) → la IA no se invoca y la red determinista cubre igual', async () => {
    const source = workbooksWith([makeBrokenPlan(1)]);
    const generateFn = vi.fn();
    const saveFn = vi.fn().mockResolvedValue({ version: 3, success: true });

    const res = await ensureEditorialPlanCompleteness(
      { workbooksJson: source, planningId: 'p1', deadlineMs: 0 },
      { generateFn, saveFn },
    );

    expect(generateFn).not.toHaveBeenCalled();
    expect(res.aiCalls).toBe(0);
    expect(res.fallbackPads).toBe(1);
    expect(res.unresolved).toBe(0);
    expect(res.persisted).toBe(true);
  });

  it('respuesta de la IA sin items para nuestras sesiones → red determinista deja 0 pendientes', async () => {
    const source = workbooksWith([makeBrokenPlan(7)]);
    const generateFn = vi.fn().mockResolvedValue('[]');
    const saveFn = vi.fn().mockResolvedValue({ version: 3, success: true });

    const res = await ensureEditorialPlanCompleteness(
      { workbooksJson: source, planningId: 'p1', maxAttempts: 2 },
      { generateFn, saveFn },
    );

    expect(res.aiCalls).toBe(2);
    expect(res.aiRepaired).toBe(0);
    expect(res.fallbackPads).toBe(1);
    expect(res.unresolved).toBe(0);

    const repaired = res.workbooksJson.block_0!.current!.missions![0].sessionPlans![0];
    expect(repaired.autoevaluacion.length).toBeGreaterThanOrEqual(2);
    expect(repaired.recursos.length).toBeGreaterThanOrEqual(1);
  });

  it('fallo al persistir (saveBlockWorkbook lanza) → no revienta la exportación, resultado en memoria', async () => {
    const source = workbooksWith([makeBrokenPlan(1)]);
    const generateFn = vi.fn().mockResolvedValue(JSON.stringify([VALID_AI_ITEM]));
    const saveFn = vi.fn().mockRejectedValue(new Error('db down'));

    const res = await ensureEditorialPlanCompleteness(
      { workbooksJson: source, planningId: 'p1' },
      { generateFn, saveFn },
    );

    expect(res.persisted).toBe(false);
    expect(res.mode).toBe('ai');
    expect(res.unresolved).toBe(0);
    // Sigue entregando el clon reparado para que esta exportación salga completa
    const repaired = res.workbooksJson.block_0!.current!.missions![0].sessionPlans![0];
    expect(repaired.autoevaluacion).toHaveLength(2);
  });
});
