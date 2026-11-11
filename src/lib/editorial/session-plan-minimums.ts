/**
 * session-plan-minimums.ts — Mínimos editoriales de un SessionPlan
 * SIGPDA-EMS · Motor Editorial de Alta Gama
 *
 * StudentSessionSchema exige, por sesión: ≥1 recurso de ampliación con URL http(s)
 * válida, ≥2 puntos de autoevaluación y pistas de práctica con ≥5 caracteres.
 * Estas son las reglas "blandas" que la IA puede incumplir; el reparador IA corre
 * antes del compose y NO existe relleno textual de contingencia.
 *
 * Este módulo provee:
 *  - detectPlanRepairNeeds(): qué campos faltan (lo consume el reparador IA).
 *  - enforceEditorialSoftMinimums(): repara SOLO recursos con entradas reales del
 *    catálogo. Autoevaluación y pistas no se inventan: si faltan, el plan se rechaza.
 *  - catalogFallbackResource(): recurso real del catálogo oficial del proyecto
 *    (GeoGebra / Desmos) elegido por tema — jamás inventa URLs.
 */

import { getMaterial } from '@/lib/materials/materials-catalog';
import type { RecursoItem, SessionPlan } from '@/types/work-textbook';

/** Normaliza un recurso: valida URL http(s) real y tipo del enum permitido. */
function normalizeRecurso(r: Partial<RecursoItem> | null | undefined): RecursoItem | null {
  if (!r || typeof r !== 'object') return null;
  const url = typeof r.url === 'string' ? r.url.trim() : '';
  const titulo = typeof r.titulo === 'string' ? r.titulo.trim() : '';
  if (!/^https?:\/\/\S+$/i.test(url) || titulo.length < 4) return null;
  const tipo = r.tipo === 'video' || r.tipo === 'lectura' ? r.tipo : 'web';
  return { titulo, url, tipo };
}

/** Recursos del plan que cumplen el mínimo editorial (URL válida + título + tipo). */
export function validRecursos(plan: SessionPlan): RecursoItem[] {
  const raw = Array.isArray(plan.recursos) ? plan.recursos : [];
  return raw.map(normalizeRecurso).filter((r): r is RecursoItem => r !== null);
}

export interface PlanRepairNeeds {
  /** true si el plan NO tiene ningún recurso válido (schema lo rechazaría). */
  needsRecursos: boolean;
  /** true si el plan tiene menos de 2 puntos de autoevaluación. */
  needsAutoeval: boolean;
}

/** Detecta los campos blandos que impiden que el plan valide como StudentSession. */
export function detectPlanRepairNeeds(plan: SessionPlan): PlanRepairNeeds {
  const autoeval = (Array.isArray(plan.autoevaluacion) ? plan.autoevaluacion : []).filter(
    (s): s is string => typeof s === 'string',
  );
  return {
    needsRecursos: validRecursos(plan).length === 0,
    needsAutoeval: autoeval.length < 2,
  };
}

/**
 * Recurso de respaldo TOMADO DEL CATÁLOGO OFICIAL (equivalenteVirtual de herramientas
 * de matemáticas verificadas en materials-catalog). Elige por tema de la sesión:
 * geometría → GeoGebra · álgebra/funciones → Desmos · general → Polypad Mathigon.
 * Devuelve null solo si el catálogo perdiera esas entradas (no se inventa URL jamás).
 */
export function catalogFallbackResource(plan: SessionPlan): RecursoItem | null {
  const topic = `${plan.objetivo || ''} ${plan.contenido || ''}`.toLowerCase();
  const geo = /geo|triáng|triang|políg|polig|ángul|angul|área|\barea\b|simetr|perímet|perimet|circun|hexágon|hexagon|trazado/.test(topic);
  const alg = /func|ecuac|sistem|paráb|parab|gráfic|graf|despej|polinom|íntegr|integr|línea|linea|variable|álge|alge|producto|factor/.test(topic);

  // Nunca inyectar herramientas matemáticas en UACs de otras disciplinas.
  // Si el tema no es claramente geométrico o algebraico, no se inventa recurso:
  // el reparador IA debe generar uno específico o la sesión se rechaza.
  if (!geo && !alg) return null;

  const ev = geo
    ? getMaterial('compas')?.equivalenteVirtual
    : getMaterial('regla-calculo')?.equivalenteVirtual;

  if (!ev || typeof ev.url !== 'string' || !/^https?:\/\//i.test(ev.url)) return null;
  return {
    titulo: `Amplía tu aprendizaje: ${ev.nombre}`,
    url: ev.url,
    tipo: 'web',
  };
}

/**
 * Repara en copia SOLO el recurso de ampliación faltante, usando el catálogo real.
 * NUNCA modifica contenido teórico, ejemplos, autoevaluación, pistas ni enunciados
 * de práctica. Devuelve la MISMA referencia si no hubo cambios (permite detectar
 * "reparado" para métricas de catálogo).
 */
export function enforceEditorialSoftMinimums(plan: SessionPlan): SessionPlan {
  const valid = validRecursos(plan);
  const needsRecursos = valid.length === 0;

  // Solo se repara el recurso de ampliación con una entrada REAL del catálogo.
  // Autoevaluación y pistas NO se rellenan con texto genérico: si la IA no las
  // entregó, el plan debe rechazarse o repararse con IA antes de exportar.
  const changed =
    needsRecursos ||
    valid.length !== (Array.isArray(plan.recursos) ? plan.recursos.length : 0);

  if (!changed) return plan;

  let recursosOut = valid;
  if (needsRecursos) {
    const fb = catalogFallbackResource(plan);
    recursosOut = fb ? [fb] : [];
  }

  return {
    ...plan,
    recursos: recursosOut,
  };
}
