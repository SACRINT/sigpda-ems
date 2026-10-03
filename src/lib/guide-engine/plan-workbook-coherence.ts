/**
 * plan-workbook-coherence.ts — Auditoría de coherencia cruzada Plan de Clase ↔ Libro de Trabajo.
 * SIGPDA-EMS · Motor de Guías (H-324)
 *
 * Invariantes deterministas (0 tokens):
 *  ERRORES (estructurales; el material no es entregable si fallan):
 *   E1. Hay exactamente `expectedSessions` planes con numeración consecutiva 1..N sin repetidos.
 *   E2. En cada plan, apertura + desarrollo + cierre = duración de la sesión.
 *   E3. Toda sesión declarada por una misión (coveredSessions ≤ N) tiene su plan.
 *   E4. Ninguna misión tiene sesiones clonadas (mismos momentos docentes en dos sesiones).
 *  ADVERTENCIAS (de contenido; pueden deberse a una secuencia didáctica guardada que reescribe el plan):
 *   W1. El reto autónomo (Tú Haces) de la misión aparece en alguna sesión de la misión.
 *   W2. La práctica guiada (Hacemos) de la misión aparece en alguna sesión de la misión.
 */

import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import type { PlanDeClaseDerivado } from './material-extractor';

export interface CoherenceReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function norm(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/** Primeras palabras significativas de un texto, para buscar su huella en los planes. */
function fingerprint(text: string | undefined, words = 6): string {
  const w = norm(text ?? '').replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean);
  return w.slice(0, words).join(' ');
}

function planText(p: PlanDeClaseDerivado): string {
  return norm(
    [
      p.apertura.actividadDocente, p.apertura.actividadEstudiante,
      p.desarrollo.actividadDocente, p.desarrollo.actividadEstudiante,
      p.cierre.actividadDocente, p.cierre.actividadEstudiante,
    ].join(' ').replace(/[^\p{L}\p{N} ]/gu, '')
  );
}

function momentsKey(p: PlanDeClaseDerivado): string {
  return norm(`${p.apertura.actividadDocente}|${p.desarrollo.actividadDocente}|${p.cierre.actividadDocente}`);
}

function sessionsOf(m: MissionSection): number[] {
  return Array.isArray(m.coveredSessions) ? m.coveredSessions : [];
}

export function auditPlanWorkbookCoherence(
  workbook: ActiveWorkTextbook,
  planes: PlanDeClaseDerivado[],
  opts: { expectedSessions?: number } = {}
): CoherenceReport {
  const expected = opts.expectedSessions ?? 24;
  const errors: string[] = [];
  const warnings: string[] = [];

  // E1 — numeración consecutiva sin repetidos
  const nums = planes.map((p) => p.numeroSesion);
  const unique = new Set(nums);
  if (planes.length !== expected) errors.push(`E1: se esperaban ${expected} planes de clase y hay ${planes.length}.`);
  if (unique.size !== nums.length) errors.push('E1: hay números de sesión repetidos.');
  for (let i = 1; i <= expected; i++) {
    if (!unique.has(i)) errors.push(`E1: falta el plan de la sesión ${i}.`);
  }

  // E2 — suma de tiempos
  for (const p of planes) {
    const total = p.apertura.tiempoMinutos + p.desarrollo.tiempoMinutos + p.cierre.tiempoMinutos;
    if (total !== p.duracionMinutos) {
      errors.push(`E2: la sesión ${p.numeroSesion} suma ${total} min y su duración es ${p.duracionMinutos} min.`);
    }
  }

  const byNum = new Map(planes.map((p) => [p.numeroSesion, p]));

  for (const m of workbook.missions ?? []) {
    const label = `Misión ${m.missionIndex}`;
    const covered = sessionsOf(m).filter((n) => n <= expected);

    // E3 — cobertura de las sesiones declaradas
    for (const n of sessionsOf(m)) {
      if (n <= expected && !byNum.has(n)) errors.push(`E3: ${label} declara la sesión ${n} pero no tiene plan de clase.`);
    }

    // E4 — sin sesiones clonadas dentro de la misión
    const seen = new Map<string, number>();
    for (const n of covered) {
      const p = byNum.get(n);
      if (!p) continue;
      const key = momentsKey(p);
      const prev = seen.get(key);
      if (prev !== undefined) errors.push(`E4: ${label} tiene las sesiones ${prev} y ${n} clonadas (mismos momentos docentes).`);
      else seen.set(key, n);
    }

    // W1 / W2 — presencia de las actividades del libro en las sesiones de la misión
    const texts = covered.map((n) => byNum.get(n)).filter((p): p is PlanDeClaseDerivado => Boolean(p)).map(planText);
    if (texts.length > 0) {
      const ch = fingerprint(m.youDoSection?.autonomousChallenge);
      if (ch && !texts.some((t) => t.includes(ch))) {
        warnings.push(`W1: el reto autónomo de ${label} no aparece en sus sesiones.`);
      }
      const gp = fingerprint(m.weDoSection?.guidedPractice);
      if (gp && !texts.some((t) => t.includes(gp))) {
        warnings.push(`W2: la práctica guiada de ${label} no aparece en sus sesiones.`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
