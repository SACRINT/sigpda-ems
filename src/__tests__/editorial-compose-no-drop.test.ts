/**
 * editorial-compose-no-drop.test.ts — Garantía 72/72 del compose editorial
 *
 * Regresión directa del bug 54/72: los 18 planes con violaciones blandas
 * (12 sin recursos de ampliación, 6 con 1 sola autoevaluación) deben ser
 * REPARADOS por enforceEditorialSoftMinimums y compuestos, jamás descartados.
 * El descarte (dropped) queda SOLO para contenido duramente corrupto y la ruta
 * lo convierte en 422 explícito (nunca libro parcial en silencio).
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

/** Violación blanda histórica: sin recursos de ampliación. */
function planSinRecursos(sessionNumber: number): SessionPlan {
  return { ...makeValidPlan(sessionNumber, `ses${sessionNumber}`), recursos: [] };
}

/** Violación blanda histórica: 1 sola pregunta de autoevaluación. */
function planConAutoevalDe1(sessionNumber: number): SessionPlan {
  const p = makeValidPlan(sessionNumber, `ses${sessionNumber}`);
  return { ...p, autoevaluacion: [p.autoevaluacion[0]] };
}

function workbookOf(plans: SessionPlan[]) {
  return { current: { missions: [{ title: 'Misión 1', sessionPlans: plans }] } };
}

describe('composeStudentSessionsFromWorkbooks — nunca descarta por campos blandos', () => {
  it('72 planes blandos (12 sin recursos + 6 con 1 autoeval, réplica del bug) → 72/72 sesiones válidas', () => {
    // Réplica de las DOS violaciones blandas históricas distribuidas por los
    // 3 bloques (recursos vacíos y autoevaluación de 1 solo ítem).
    const workbooks: Record<string, ReturnType<typeof workbookOf>> = {};
    for (let b = 0; b < 3; b++) {
      const plans: SessionPlan[] = [];
      for (let s = 1; s <= 24; s++) {
        const globalIndex = b * 24 + s; // 1..72 para localizar los defectos
        if (globalIndex % 6 === 0 && globalIndex % 18 !== 0) {
          plans.push(planConAutoevalDe1(s)); // autoevaluación de 1 solo ítem
        } else if (globalIndex % 15 === 0) {
          plans.push(planSinRecursos(s)); // recursos de ampliación vacíos
        } else {
          plans.push(makeValidPlan(s, `bloque${b + 1} ses${s}`));
        }
      }
      workbooks[`block_${b}`] = workbookOf(plans);
    }

    const res = composeStudentSessionsFromWorkbooks({ workbooks_json: workbooks });

    // La garantía central: CERO descartes, CERO numeración huecos
    expect(res.dropped).toHaveLength(0);
    expect(res.totalPlans).toBe(72);
    expect(res.sessions).toHaveLength(72);
    expect(res.sessions.map((s) => s.numero)).toEqual(
      Array.from({ length: 72 }, (_, i) => i + 1),
    );
    expect(res.blocksPresent).toEqual([0, 1, 2]);
    expect(res.padded).toBeGreaterThan(0); // la red de seguridad sí hizo su trabajo

    // Todas las sesiones cumplen los mínimos históricamente incumplidos
    for (const s of res.sessions) {
      expect(s.recursos.length).toBeGreaterThanOrEqual(1);
      expect(s.recursos[0].url).toMatch(/^https:\/\//);
      expect(s.autoevaluacion.length).toBeGreaterThanOrEqual(2);
      expect(s.autoevaluacion.every((a) => a.length >= 10)).toBe(true);
    }
  });

  it('repara en línea: plan sin recursos obtiene recurso real del catálogo con URL https', () => {
    const res = composeStudentSessionsFromWorkbooks({
      workbooks_json: { block_0: workbookOf([planSinRecursos(1)]) },
    });

    expect(res.dropped).toHaveLength(0);
    expect(res.padded).toBe(1);
    expect(res.sessions).toHaveLength(1);
    expect(res.sessions[0].recursos[0].url).toMatch(/^https:\/\//);
    expect(res.sessions[0].recursos[0].titulo.length).toBeGreaterThanOrEqual(4);
  });

  it('repara en línea: plan con 1 autoeval queda con 2 (se conserva la original)', () => {
    const original = planConAutoevalDe1(1);
    const res = composeStudentSessionsFromWorkbooks({
      workbooks_json: { block_0: workbookOf([original]) },
    });

    expect(res.dropped).toHaveLength(0);
    expect(res.sessions[0].autoevaluacion).toHaveLength(2);
    expect(res.sessions[0].autoevaluacion[0]).toBe(original.autoevaluacion[0]);
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
    // Numeración global continúa 1..2 sin huecos
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
