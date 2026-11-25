/**
 * scripts/qa-paec-pmc.ts — Auditoría Semántica Solo-Lectura para PAEC y PMC (Neon DB)
 * Uso: `npm run qa:paec-pmc` (o `npx tsx scripts/qa-paec-pmc.ts [--strict]`)
 *
 * - Solo lecturas (SELECT). Nunca modifica la base de datos.
 * - Sale con código 1 si existe cualquier FAIL duro en PAEC o PMC.
 */

import fs from 'node:fs';
import path from 'node:path';
import { sql } from '../src/lib/db/client';
import {
  auditPaecPlan,
  auditPmcProject,
  type PaecPlanRowLike,
  type PaecUacCatalogMeta,
  type PmcProjectLike,
} from '../src/lib/qa/paec-pmc-semantic-qa';

function loadEnvLocalIfNeeded(): void {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

interface RawPaecRow {
  id: string;
  project_name: string;
  status: string;
  school_context: Record<string, unknown> | null;
  fase2_mapeo: Array<Record<string, unknown>> | null;
  fase3_plan_operativo_a: PaecPlanRowLike[] | null;
  fase3_plan_operativo_b: PaecPlanRowLike[] | null;
}

interface RawPmcRow extends PmcProjectLike {
  id: string;
  status: string;
  ciclo_escolar: string | null;
}

async function main(): Promise<void> {
  loadEnvLocalIfNeeded();
  const strict = process.argv.includes('--strict');
  let anyFail = false;

  console.log(`=== QA Semántico PAEC / PMC (${strict ? 'STRICT' : 'BASELINE'} · solo lectura) ===\n`);

  // 1. Auditar proyectos PAEC
  const projects = (await sql()`
    SELECT id, project_name, status, school_context, fase2_mapeo, fase3_plan_operativo_a, fase3_plan_operativo_b
    FROM paec_projects
    ORDER BY created_at
  `) as RawPaecRow[];

  for (const p of projects) {
    const catalog: PaecUacCatalogMeta[] = (p.fase2_mapeo ?? [])
      .map((m) => ({
        uacName: String(m.uacName ?? m.uac ?? m.asignatura ?? '').trim(),
        semester: Number(m.semester ?? m.semestre ?? 0),
        component: String(m.component ?? m.componente ?? '').trim(),
      }))
      .filter((u) => u.uacName.length > 0);

    const ciclo = String(
      p.school_context?.ciclo_escolar ??
        p.school_context?.cicloEscolar ??
        p.school_context?.schoolCycle ??
        '2026-2027'
    );

    const semesters: ReadonlyArray<readonly ['A' | 'B', 'fase3_plan_operativo_a' | 'fase3_plan_operativo_b', 1 | 0]> = [
      ['A', 'fase3_plan_operativo_a', 1],
      ['B', 'fase3_plan_operativo_b', 0],
    ];

    for (const [sem, key, parity] of semesters) {
      const rows = (p[key] ?? []) as PaecPlanRowLike[];
      const label = `${String(p.project_name).slice(0, 34)} (${sem})`;
      if (!rows.length) {
        console.log(`[PAEC ${label}] SIN DATOS (status=${p.status})`);
        continue;
      }
      const res = auditPaecPlan(rows, catalog, { parity, cicloEscolar: ciclo, label, strict });
      if (!res.passed) anyFail = true;
      console.log(
        `[PAEC ${label}] rows=${res.metrics.rows} weeks=${res.metrics.weeks} avg=${res.metrics.avgWords}w PASS=${res.passed} fails=${res.fails.length} warns=${res.warns.length}`
      );
      res.fails.slice(0, 15).forEach((f) => console.log(`  FAIL ${f}`));
      if (res.fails.length > 15) console.log(`  ... (+${res.fails.length - 15} FAIL más)`);
      res.warns.slice(0, 10).forEach((w) => console.log(`  WARN ${w}`));
      if (res.warns.length > 10) console.log(`  ... (+${res.warns.length - 10} WARN más)`);
    }
  }

  console.log('');

  // 2. Auditar proyectos PMC (con plan_accion poblado)
  const pmcs = (await sql()`
    SELECT id, school_name, school_cct, status, ciclo_escolar, indicadores_academicos, foda, diagnostico_generado, plan_accion
    FROM pmc_projects
    ORDER BY created_at
  `) as RawPmcRow[];

  for (const p of pmcs) {
    if (!p.plan_accion || Object.keys(p.plan_accion).length === 0) {
      console.log(`[PMC ${String(p.school_name ?? p.id)}] OMITIDO (sin plan_accion, status=${p.status})`);
      continue;
    }
    const res = auditPmcProject(p, { strict });
    if (!res.passed) anyFail = true;
    console.log(
      `[PMC ${String(p.school_name ?? p.id)}] ind=${res.metrics.indicatorsPresent}/5 mi=${res.metrics.metasInstitucionales} mp=${res.metrics.metasPersonales} creaa=${res.metrics.creaaPct}% PASS=${res.passed} fails=${res.fails.length} warns=${res.warns.length}`
    );
    res.fails.slice(0, 15).forEach((f) => console.log(`  FAIL ${f}`));
    if (res.fails.length > 15) console.log(`  ... (+${res.fails.length - 15} FAIL más)`);
    res.warns.slice(0, 10).forEach((w) => console.log(`  WARN ${w}`));
    if (res.warns.length > 10) console.log(`  ... (+${res.warns.length - 10} WARN más)`);
  }

  console.log(`\n=== RESUMEN GLOBAL: ${anyFail ? 'FAIL (errores duros detectados)' : 'PASS (0 errores duros)'} ===`);
  process.exit(anyFail ? 1 : 0);
}

main().catch((err) => {
  console.error('[qa-paec-pmc] Error fatal:', err);
  process.exit(1);
});
