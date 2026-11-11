/**
 * editorial-compose-no-drop.test.ts — Compose editorial sin relleno genérico
 *
 * Contrato nuevo:
 *  - Los recursos faltantes SOLO se reparan con entradas reales del catálogo.
 *  - Autoevaluación/pistas faltantes NO se rellenan con texto genérico.
 *  - Un plan con relleno sintético o campos duros inválidos se marca como dropped
 *    para que la ruta aborte con 422 y se regenere, nunca se publique parcial.
 */
import { describe, it, expect } from 'vitest';
import { composeStudentSessionsFromWorkbooks } from '@/lib/editorial/compose-student-sessions';
import type { SessionPlan } from '@/types/work-textbook';

function makeValidPlan(sessionNumber: number, tag: string): SessionPlan {
  return {
    sessionNumber,
    objetivo: `Vas a aprender a calcular la variación porcentual con datos reales de ${tag}.`,
    motivacion: `Imagina que en tu comunidad los precios cambian cada semana: medir esa variación es la tarea de hoy en ${tag}.`,
    saberesPrevios: 'Ya dominas operaciones básicas, porcentajes y tabulación de datos en clase.',
    contenido:
      'Parrafo: La variación porcentual describe qué tan grande es la diferencia entre dos cantidades.\n\nDefinicion: Relación de cambio proporcional expresada en porcentaje.',
    ejemploResuelto: 'Un vendedor vendió 5 artículos en 2 días.\nPaso 1: 5 / 2 = 2.5 artículos por día.',
    practica: [
      {
        enunciado: `Calcula la variación cuando el precio pasa de 20 a 25 pesos en ${tag}.`,
        pista: 'Aplica la fórmula de variación porcentual paso a paso con los dos valores dados.',
      },
    ],
    aplicacion: 'Aplica la variación porcentual al presupuesto del salón de clases y justifica tu estrategia.',
    autoevaluacion: [
      `¿Puedes explicar la variación porcentual de ${tag} con tus palabras?`,
      '¿Resolviste el ejemplo sin ayuda y sin equivocarte?',
    ],
    recursos: [
      {
        titulo: `Video de variación ${tag}`,
        url: `https://www.youtube.com/watch?v=vid${sessionNumber}`,
        tipo: 'video',
      },
    ],
    productoIntegrador: 'Agregas una tabla de variación a tu proyecto comunitario.',
  };
}

function planSinRecursos(sessionNumber: number): SessionPlan {
  return { ...makeValidPlan(sessionNumber, `ses${sessionNumber}`), recursos: [] };
}

function planConAutoevalDe1(sessionNumber: number): SessionPlan {
  const p = makeValidPlan(sessionNumber, `ses${sessionNumber}`);
  return { ...p, autoevaluacion: [p.autoevaluacion[0]] };
}

function workbookOf(plans: SessionPlan[]) {
  return { current: { missions: [{ title: 'Misión 1', sessionPlans: plans }] } };
}

describe('composeStudentSessionsFromWorkbooks — sin relleno genérico', () => {
  it('72 planes completos y específicos → 72/72 sesiones sin descartes', () => {
    const workbooks: Record<string, ReturnType<typeof workbookOf>> = {};
    for (let b = 0; b < 3; b++) {
      const plans: SessionPlan[] = [];
      for (let s = 1; s <= 24; s++) {
        plans.push(makeValidPlan(s, `bloque${b + 1} ses${s}`));
      }
      workbooks[`block_${b}`] = workbookOf(plans);
    }

    const res = composeStudentSessionsFromWorkbooks({ workbooks_json: workbooks });

    expect(res.dropped).toHaveLength(0);
    expect(res.totalPlans).toBe(72);
    expect(res.sessions).toHaveLength(72);
    expect(res.sessions.map((s) => s.numero)).toEqual(
      Array.from({ length: 72 }, (_, i) => i + 1),
    );
    expect(res.blocksPresent).toEqual([0, 1, 2]);
    expect(res.padded).toBe(0);
  });

  it('plan sin recursos → dropped; no se inventa ni se publica sin recurso', () => {
    const res = composeStudentSessionsFromWorkbooks({
      workbooks_json: { block_0: workbookOf([planSinRecursos(1)]) },
    });

    expect(res.sessions).toHaveLength(0);
    expect(res.dropped).toHaveLength(1);
    expect(res.dropped[0].issues.join(' ')).toContain('recursos');
  });

  it('plan con 1 autoevaluación → dropped; no se completa con pregunta genérica', () => {
    const res = composeStudentSessionsFromWorkbooks({
      workbooks_json: { block_0: workbookOf([planConAutoevalDe1(1)]) },
    });

    expect(res.sessions).toHaveLength(0);
    expect(res.dropped).toHaveLength(1);
    expect(res.dropped[0].issues.join(' ')).toContain('autoevaluacion');
  });

  it('plan de geometría sin recursos → recurso REAL del catálogo con URL https', () => {
    const geo = {
      ...planSinRecursos(1),
      objetivo: 'Vas a calcular el área de un triángulo con medidas reales del plantel.',
      contenido: 'Parrafo: El área del triángulo se obtiene con base por altura entre dos.',
    };
    const res = composeStudentSessionsFromWorkbooks({
      workbooks_json: { block_0: workbookOf([geo]) },
    });

    expect(res.dropped).toHaveLength(0);
    expect(res.padded).toBe(1);
    expect(res.sessions).toHaveLength(1);
    expect(res.sessions[0].recursos[0].url).toMatch(/^https:\/\//);
    expect(res.sessions[0].recursos[0].titulo.length).toBeGreaterThanOrEqual(4);
  });

  it('plan con pista genérica de fallback → dropped por contenido genérico', () => {
    const generic = makeValidPlan(1, 'genérica');
    generic.practica = [
      {
        enunciado: 'Resuelve los ejercicios prácticos de la sesión 1 aplicando el modelo.',
        pista: 'Observa el ejemplo resuelto paso a paso y aplica el mismo procedimiento con los datos del ejercicio.',
      },
    ];
    const res = composeStudentSessionsFromWorkbooks({
      workbooks_json: { block_0: workbookOf([generic]) },
    });

    expect(res.sessions).toHaveLength(0);
    expect(res.dropped).toHaveLength(1);
    expect(res.dropped[0].issues.join(' ')).toContain('Pista genérica');
  });

  it('contenido duramente corrupto (práctica vacía) → dropped con detalle; el resto se compone', () => {
    const broken = { ...makeValidPlan(2, 'rota'), practica: [] as SessionPlan['practica'] };
    const res = composeStudentSessionsFromWorkbooks({
      workbooks_json: {
        block_0: workbookOf([makeValidPlan(1, 'ok'), broken, makeValidPlan(3, 'ok3')]),
      },
    });

    expect(res.sessions).toHaveLength(2);
    expect(res.dropped).toHaveLength(1);
    expect(res.dropped[0].blockKey).toBe('block_0');
    expect(res.dropped[0].sessionNumber).toBe(2);
    expect(res.dropped[0].issues.join(' ')).toContain('practica');
    expect(res.sessions.map((s) => s.numero)).toEqual([1, 2]);
  });

  it('sin workbooks_json → estructura vacía coherente', () => {
    expect(composeStudentSessionsFromWorkbooks({})).toEqual({
      sessions: [],
      blocksPresent: [],
      dropped: [],
      totalPlans: 0,
      padded: 0,
    });
    expect(composeStudentSessionsFromWorkbooks({ workbooks_json: null }).sessions).toHaveLength(0);
  });
});
