/**
 * session-plan-minimums.ts — Mínimos editoriales de un SessionPlan
 * SIGPDA-EMS · Motor Editorial de Alta Gama
 *
 * StudentSessionSchema exige, por sesión: ≥1 recurso de ampliación con URL http(s)
 * válida, ≥2 puntos de autoevaluación y pistas de práctica con ≥5 caracteres.
 * Estas son las ÚNICAS reglas "blandas" que la IA puede incumplir y que
 * históricamente hicieron que el compose descartara sesiones (libro 54/72).
 *
 * Este módulo provee:
 *  - detectPlanRepairNeeds(): qué campos blandos faltan (lo consume el reparador IA).
 *  - enforceEditorialSoftMinimums(): red de seguridad determinista que repara los
 *    campos blandos SIN tocar el contenido teórico/práctico real (último recurso
 *    para que el libro NUNCA salga incompleto; el reparador IA corre antes).
 *  - catalogFallbackResource(): recurso real del catálogo oficial del proyecto
 *    (GeoGebra / Desmos / Polypad) elegido por tema — jamás inventa URLs.
 */

import { getMaterial } from '@/lib/materials/materials-catalog';
import {
  DEFAULT_AUTOEVALUACION,
  FALLBACK_PISTA,
} from '@/lib/guide-engine/writers/writer-contract';
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

  const ev = geo
    ? getMaterial('compas')?.equivalenteVirtual
    : alg
      ? getMaterial('regla-calculo')?.equivalenteVirtual
      : getMaterial('geoplano')?.equivalenteVirtual;

  if (!ev || typeof ev.url !== 'string' || !/^https?:\/\//i.test(ev.url)) return null;
  return {
    titulo: `Amplía tu aprendizaje: ${ev.nombre}`,
    url: ev.url,
    tipo: 'web',
  };
}

/**
 * Repara en copia los campos blandos mínimos para que el plan pase el
 * StudentSessionSchema. NUNCA modifica contenido teórico, ejemplos ni enunciados
 * de práctica: filtra recursos con URL inválida, completa recursos/autoevaluación
 * faltantes y acorta pistas <5 caracteres al respaldo estándar.
 * Devuelve la MISMA referencia si no hubo cambios (permite detectar "reparado").
 */
export function enforceEditorialSoftMinimums(plan: SessionPlan): SessionPlan {
  const valid = validRecursos(plan);
  const needsRecursos = valid.length === 0;

  const existingAuto = (Array.isArray(plan.autoevaluacion) ? plan.autoevaluacion : []).filter(
    (s): s is string => typeof s === 'string',
  );
  const needsAutoeval = existingAuto.length < 2;

  const rawPractica = Array.isArray(plan.practica) ? plan.practica : [];
  const practica = rawPractica.map((p) => ({
    ...p,
    pista: (p?.pista || '').length >= 5 ? p.pista : FALLBACK_PISTA,
  }));

  const changed =
    needsRecursos ||
    needsAutoeval ||
    valid.length !== (Array.isArray(plan.recursos) ? plan.recursos.length : 0) ||
    existingAuto.length !== (Array.isArray(plan.autoevaluacion) ? plan.autoevaluacion.length : 0) ||
    practica.some((p, i) => p.pista !== rawPractica[i]?.pista);

  if (!changed) return plan;

  let recursosOut = valid;
  if (needsRecursos) {
    const fb = catalogFallbackResource(plan);
    recursosOut = fb ? [fb] : [];
  }

  const autoevaluacionOut = needsAutoeval
    ? [...existingAuto, ...DEFAULT_AUTOEVALUACION].slice(0, 2)
    : existingAuto;

  return {
    ...plan,
    recursos: recursosOut,
    autoevaluacion: autoevaluacionOut,
    practica,
  };
}
