/**
 * scripts/remediate-paec-pmc-historical.ts — Remediación Histórica Idempotente y Transaccional (Fase C.5)
 *
 * Uso:
 *   npx tsx scripts/remediate-paec-pmc-historical.ts --dry-run   (por defecto: solo lectura, muestra diff)
 *   npx tsx scripts/remediate-paec-pmc-historical.ts --apply     (respalda JSON + aplica en transacción)
 *   npx tsx scripts/remediate-paec-pmc-historical.ts --rollback <ruta-backup.json>
 *
 * Alcance verificado contra Neon DB:
 * - PAEC: 0 violaciones de paridad reales (Conciencia Histórica II pertenece a 5° semestre = Sem A impar).
 *         No se modifica ninguna fila de paec_projects.
 * - PMC:  Remedia inversiones matemáticas de metas (F11 exacto), normaliza categorías no canónicas
 *         ('1'/'2'/'3'/'practica_docente'/'convivencia_paec' -> 3 categorías oficiales SEMS), corrige
 *         textos corruptos por el bug histórico de pmc-meta-deduplicator, asegura foda.cruzado (FO/DO/FA/DA)
 *         y persiste el snapshot actualizado de quality_audit.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sql } from '../src/lib/db/client';
import {
  PMC_NOMBRES_CATEGORIAS,
  normalizePmcCategoria,
} from '../src/lib/constants/pmc-categorias';
import {
  auditPmcProject,
  computeRecommendedReprobacionMeta,
  resolveBajasPercentage,
  type PmcProjectLike,
} from '../src/lib/qa/paec-pmc-semantic-qa';
import { ensureCrossFoda } from '../src/lib/pmc/pmc-foda-synthesizer';
import { calculateGlobalPmcScore } from '../src/lib/pmc-quality-gate';
import type { PmcFodaData, PmcProject } from '../src/types/pmc';

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

const CANONICAL_CAT_SET = new Set<string>(PMC_NOMBRES_CATEGORIAS);

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

interface BackupRecord {
  id: string;
  school_name: string | null;
  indicadores_academicos: unknown;
  foda: unknown;
  plan_accion: unknown;
  quality_audit: unknown;
}

interface RemediationChange {
  id: string;
  schoolName: string;
  changes: string[];
  before: BackupRecord;
  after: {
    indicadores_academicos: Record<string, unknown>;
    foda: PmcFodaData;
    plan_accion: Record<string, unknown>;
    quality_audit: unknown;
  };
}

function planPmcRemediation(row: Record<string, unknown>): RemediationChange | null {
  const id = String(row.id);
  const schoolName = String(row.school_name ?? id);
  const planAccionRaw = row.plan_accion as Record<string, unknown> | null;
  if (!planAccionRaw || Object.keys(planAccionRaw).length === 0) return null;

  const ind = deepClone((row.indicadores_academicos ?? {}) as Record<string, unknown>);
  const foda = deepClone((row.foda ?? {}) as PmcFodaData);
  const planAccion = deepClone(planAccionRaw);
  const changes: string[] = [];

  // 1. Indicadores académicos: corregir inversiones matemáticas con fórmula exacta F11
  const calc = (ind._calc && typeof ind._calc === 'object' ? ind._calc : null) as Record<
    string,
    Record<string, unknown>
  > | null;

  const aprobAnt = numOrNull(ind.aprobacion_ant);
  const aprobMeta = numOrNull(ind.aprobacion_meta);
  if (aprobAnt !== null && aprobMeta !== null && aprobMeta < aprobAnt) {
    const nextAprobMeta = Math.min(100, Math.round((aprobAnt + 5) * 10) / 10);
    changes.push(`indicadores.aprobacion_meta: ${aprobMeta} -> ${nextAprobMeta}`);
    ind.aprobacion_meta = nextAprobMeta;
    if (calc?.aprobacion_meta) {
      calc.aprobacion_meta.valor = nextAprobMeta;
      calc.aprobacion_meta.formula = `min(100, ${aprobAnt} + 5)`;
    }
  }

  const reprobAnt = numOrNull(ind.reprobacion_ant);
  const reprobMeta = numOrNull(ind.reprobacion_meta);
  const effectiveAprobMeta = numOrNull(ind.aprobacion_meta) ?? aprobAnt ?? 85;
  if (reprobAnt !== null && reprobMeta !== null && reprobMeta > reprobAnt) {
    const bajasPct = resolveBajasPercentage(ind);
    const nextReprobMeta = computeRecommendedReprobacionMeta({
      aprobacionMeta: effectiveAprobMeta,
      reprobacionAnt: reprobAnt,
      bajasPct,
    });
    changes.push(
      `indicadores.reprobacion_meta: ${reprobMeta} -> ${nextReprobMeta} (reprob_ant=${reprobAnt}, aprob_meta=${effectiveAprobMeta}, bajas=${bajasPct}%)`
    );
    ind.reprobacion_meta = nextReprobMeta;
    if (calc?.reprobacion_meta) {
      calc.reprobacion_meta.valor = nextReprobMeta;
      calc.reprobacion_meta.formula = `min(${reprobAnt}, max(0, 100 - ${effectiveAprobMeta} - ${bajasPct}))`;
    }
  }

  const etAnt = numOrNull(ind.et_ant);
  const etMeta = numOrNull(ind.et_meta);
  if (etAnt !== null && etMeta !== null && etMeta < etAnt) {
    const nextEtMeta = Math.min(100, Math.round((etAnt + 5) * 10) / 10);
    changes.push(`indicadores.et_meta: ${etMeta} -> ${nextEtMeta} (et_ant=${etAnt})`);
    ind.et_meta = nextEtMeta;
    if (calc?.et_meta) {
      calc.et_meta.valor = nextEtMeta;
      calc.et_meta.formula = `min(100, ${etAnt} + 5)`;
    }
  }

  const abAnt = numOrNull(ind.abandono_ant);
  const abMeta = numOrNull(ind.abandono_meta);
  if (abAnt !== null && abMeta !== null && abMeta > abAnt) {
    const nextAbMeta = Math.max(0, Math.round((abAnt - 1.5) * 10) / 10);
    changes.push(`indicadores.abandono_meta: ${abMeta} -> ${nextAbMeta} (abandono_ant=${abAnt})`);
    ind.abandono_meta = nextAbMeta;
    if (calc?.abandono_meta) {
      calc.abandono_meta.valor = nextAbMeta;
      calc.abandono_meta.formula = `max(0, ${abAnt} - 1.5)`;
    }
  }

  // 2. Normalizar categorías no canónicas y textos corruptos en metas_institucionales
  const finalAprobMeta = numOrNull(ind.aprobacion_meta);
  const finalReprobMeta = numOrNull(ind.reprobacion_meta);

  if (Array.isArray(planAccion.metas_institucionales)) {
    let catFixCount = 0;
    for (const [idx, rawMeta] of (planAccion.metas_institucionales as Array<Record<string, unknown>>).entries()) {
      const prevCat = typeof rawMeta.categoria === 'string' ? rawMeta.categoria.trim() : '';
      if (!CANONICAL_CAT_SET.has(prevCat)) {
        const canonical = normalizePmcCategoria(prevCat, typeof rawMeta.tema === 'string' ? rawMeta.tema : '');
        rawMeta.categoria = canonical;
        catFixCount++;
      }

      if (typeof rawMeta.meta === 'string') {
        const origText = rawMeta.meta;
        let nextText = origText;

        // Bug histórico pmc-meta-deduplicator: "elevar al 4.4% la aprobación" (abandono_meta sobreescribió aprobación)
        if (finalAprobMeta !== null && finalAprobMeta >= 50) {
          nextText = nextText.replace(
            /(elevar\s+al\s+)(\d+(?:\.\d+)?)(\s*%\s+la\s+aprobaci[oó]n)/gi,
            (match, prefix: string, numStr: string, suffix: string) => {
              const val = Number(numStr);
              if (Number.isFinite(val) && val < 50) {
                return `${prefix}${finalAprobMeta}${suffix}`;
              }
              return match;
            }
          );
        }

        // Bug histórico de reprobación invertida en texto: "Disminuir el índice de reprobación del 3% al 7.5%"
        if (finalReprobMeta !== null) {
          nextText = nextText.replace(
            /(disminuir\s+[^.]{0,40}reprobaci[oó]n\s+del\s+)(\d+(?:\.\d+)?)(\s*%\s+al\s+)(\d+(?:\.\d+)?)(\s*%)/gi,
            (match, p1: string, fromStr: string, p2: string, toStr: string, p3: string) => {
              const fromVal = Number(fromStr);
              const toVal = Number(toStr);
              if (Number.isFinite(fromVal) && Number.isFinite(toVal) && toVal > fromVal && finalReprobMeta <= fromVal) {
                return `${p1}${fromStr}${p2}${finalReprobMeta}${p3}`;
              }
              return match;
            }
          );
        }

        if (nextText !== origText) {
          rawMeta.meta = nextText;
          changes.push(`plan_accion.metas_institucionales[${idx}].meta corregido`);
        }
      }
    }
    if (catFixCount > 0) {
      changes.push(`plan_accion.metas_institucionales: ${catFixCount} categoría(s) normalizada(s) a catálogo oficial`);
    }
  }

  // 3. Normalizar categorías no canónicas en metas_personales (si existen)
  if (Array.isArray(planAccion.metas_personales)) {
    let mpFixCount = 0;
    for (const rawMp of planAccion.metas_personales as Array<Record<string, unknown>>) {
      const prevCat = typeof rawMp.categoria === 'string' ? rawMp.categoria.trim() : '';
      if (prevCat && !CANONICAL_CAT_SET.has(prevCat)) {
        rawMp.categoria = normalizePmcCategoria(prevCat, typeof rawMp.tema === 'string' ? rawMp.tema : '');
        mpFixCount++;
      }
    }
    if (mpFixCount > 0) {
      changes.push(`plan_accion.metas_personales: ${mpFixCount} categoría(s) normalizada(s)`);
    }
  }

  // 4. Garantizar FODA cruzado (FO / DO / FA / DA) en foda.cruzado
  const hasAllCross = Boolean(
    foda.cruzado?.fo &&
      foda.cruzado.fo.trim().length >= 20 &&
      foda.cruzado?.do &&
      foda.cruzado.do.trim().length >= 20 &&
      foda.cruzado?.fa &&
      foda.cruzado.fa.trim().length >= 20 &&
      foda.cruzado?.da &&
      foda.cruzado.da.trim().length >= 20
  );
  const nextFoda = hasAllCross
    ? foda
    : ensureCrossFoda(foda, {
        schoolName,
        locality: typeof row.locality === 'string' ? row.locality : null,
        municipality: typeof row.municipality === 'string' ? row.municipality : null,
      });
  if (!hasAllCross) {
    changes.push('foda.cruzado: generados los 4 cruces estratégicos FO/DO/FA/DA');
  }

  // 5. Calcular y persistir quality_audit actualizado
  const candidateProject = {
    ...row,
    indicadores_academicos: ind,
    foda: nextFoda,
    plan_accion: planAccion,
  } as unknown as PmcProject;

  const computedAudit = calculateGlobalPmcScore(candidateProject);
  const hadAudit = row.quality_audit !== null && row.quality_audit !== undefined;
  const needAuditUpdate = !hadAudit || changes.length > 0;
  const nextQualityAudit = needAuditUpdate ? computedAudit : row.quality_audit;
  if (!hadAudit) {
    changes.push(`quality_audit: persistido (score=${computedAudit.percentage}/100, status=${computedAudit.overallStatus})`);
  } else if (changes.length > 0) {
    changes.push(`quality_audit: recalculado (score=${computedAudit.percentage}/100, status=${computedAudit.overallStatus})`);
  }

  if (changes.length === 0) return null;

  // Validar que el resultado remediado pase 100% el QA semántico sin errores duros
  const semanticCheck = auditPmcProject(candidateProject as unknown as PmcProjectLike, { strict: false });
  if (!semanticCheck.passed) {
    throw new Error(
      `[ABORT] El proyecto "${schoolName}" (${id}) aún presenta errores duros tras remediar: ${semanticCheck.fails.join(' | ')}`
    );
  }

  return {
    id,
    schoolName,
    changes,
    before: {
      id,
      school_name: typeof row.school_name === 'string' ? row.school_name : null,
      indicadores_academicos: row.indicadores_academicos,
      foda: row.foda,
      plan_accion: row.plan_accion,
      quality_audit: row.quality_audit,
    },
    after: {
      indicadores_academicos: ind,
      foda: nextFoda,
      plan_accion: planAccion,
      quality_audit: nextQualityAudit,
    },
  };
}

async function runRollback(backupPath: string): Promise<void> {
  const abs = path.resolve(backupPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Archivo de respaldo no encontrado: ${abs}`);
  }
  const records = JSON.parse(fs.readFileSync(abs, 'utf8')) as BackupRecord[];
  const db = sql();
  const queries = records.map(
    (rec) => db`
      UPDATE pmc_projects
      SET indicadores_academicos = ${JSON.stringify(rec.indicadores_academicos)}::jsonb,
          foda = ${JSON.stringify(rec.foda)}::jsonb,
          plan_accion = ${JSON.stringify(rec.plan_accion)}::jsonb,
          quality_audit = ${rec.quality_audit === null ? null : JSON.stringify(rec.quality_audit)}::jsonb,
          updated_at = NOW()
      WHERE id = ${rec.id}
    `
  );
  await db.transaction(queries);
  console.log(`[ROLLBACK OK] Restaurados ${records.length} proyecto(s) PMC desde ${abs}`);
}

async function main(): Promise<void> {
  loadEnvLocalIfNeeded();

  const args = process.argv.slice(2);
  const rollbackIdx = args.indexOf('--rollback');
  if (rollbackIdx >= 0) {
    const backupFile = args[rollbackIdx + 1];
    if (!backupFile) {
      throw new Error('Uso: --rollback <ruta-archivo-backup.json>');
    }
    await runRollback(backupFile);
    return;
  }

  const apply = args.includes('--apply');
  const backupDirArg = args.find((a) => a.startsWith('--backup-dir='));
  const backupDir = backupDirArg ? backupDirArg.slice('--backup-dir='.length) : path.join(os.tmpdir(), 'sigpda-backups');

  console.log(`=== Remediación Histórica PAEC/PMC — Modo: ${apply ? 'APPLY (TRANSACCIONAL)' : 'DRY-RUN (SOLO LECTURA)'} ===\n`);

  const db = sql();
  const rows = (await db`
    SELECT *
    FROM pmc_projects
    ORDER BY created_at ASC
  `) as Array<Record<string, unknown>>;

  const planned: RemediationChange[] = [];
  for (const row of rows) {
    const plan = planPmcRemediation(row);
    if (plan) planned.push(plan);
  }

  if (planned.length === 0) {
    console.log('0 proyectos requieren cambios (base de datos ya remediada e idempotente).');
    return;
  }

  for (const item of planned) {
    console.log(`[PMC] ${item.schoolName} (${item.id})`);
    for (const c of item.changes) {
      console.log(`  - ${c}`);
    }
  }

  if (!apply) {
    console.log(`\n[DRY-RUN] ${planned.length} proyecto(s) listos para remediar. Ejecute con --apply para aplicar.`);
    return;
  }

  // Guardar respaldo completo antes de la transacción
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `pmc-remediation-backup-${stamp}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      planned.map((p) => p.before),
      null,
      2
    ),
    'utf8'
  );
  console.log(`\n[BACKUP] Respaldo pre-remediación guardado en: ${backupFile}`);

  // Aplicar atómicamente en una sola transacción
  const queries = planned.map(
    (item) => db`
      UPDATE pmc_projects
      SET indicadores_academicos = ${JSON.stringify(item.after.indicadores_academicos)}::jsonb,
          foda = ${JSON.stringify(item.after.foda)}::jsonb,
          plan_accion = ${JSON.stringify(item.after.plan_accion)}::jsonb,
          quality_audit = ${JSON.stringify(item.after.quality_audit)}::jsonb,
          updated_at = NOW()
      WHERE id = ${item.id}
    `
  );
  await db.transaction(queries);
  console.log(`[APPLY OK] ${planned.length} proyecto(s) PMC remediados atómicamente en transacción.`);
}

main().catch((err) => {
  console.error('[remediate-paec-pmc-historical] Error fatal:', err);
  process.exit(1);
});
