/**
 * audit-cross-contamination.ts
 * Auditoria READ-ONLY de contaminacion cruzada sobre los datos persistidos.
 *
 * Uso:
 *   npx tsx scripts/audit-cross-contamination.ts
 *   npx tsx scripts/audit-cross-contamination.ts --planning <uuid>
 *
 * Revisa workbooks_json, sequence_json, content_json y planning_extras.content_text
 * con el mismo guard bidireccional del motor. No escribe ni modifica la base.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (value && !process.env[key]) process.env[key] = value;
  }
}

loadEnv();

import { sql } from '../src/lib/db/client';
import {
  validateBlockCrossContamination,
  validateSessionPlanContamination,
  type ContaminationIssue,
} from '../src/lib/guide-engine/cross-contamination-guard';
import type { MissionSection, SessionPlan } from '../src/types/work-textbook';

interface PlanningRow {
  id: string;
  uac_name: string;
  component: string | null;
  curriculum_name: string | null;
  workbooks_json: unknown;
  sequence_json: unknown;
  content_json: unknown;
}

interface ExtraRow {
  id: string;
  planning_id: string;
  type: string | null;
  title: string | null;
  content_text: string | null;
}

interface PlanningAudit {
  planningId: string;
  uacName: string;
  component: string;
  curriculumName: string;
  blocks: number;
  plans: number;
  issues: ContaminationIssue[];
  integrityIssues: string[];
  scannedContainers: string[];
}

interface SeedRow {
  id: string;
  uac_id: string;
  subsystem: string | null;
  topic: string;
  content: unknown;
  source: string | null;
  quality_score: number | null;
}

interface SeedAudit {
  id: string;
  uacId: string;
  topic: string;
  qualityScore: number | null;
  issues: ContaminationIssue[];
}

const SKIP_KEYS = new Set([
  'id',
  'created_at',
  'updated_at',
  'generatedAt',
  'createdAt',
  'updatedAt',
  'version',
  'planningId',
  'teacherId',
  'blockIndex',
  'sessionNumber',
]);

function collectStrings(value: unknown, path: string, out: { path: string; text: string }[], depth = 0): void {
  if (depth > 10 || value == null) return;
  if (typeof value === 'string') {
    if (value.trim()) out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SKIP_KEYS.has(key)) continue;
      collectStrings(child, path ? `${path}.${key}` : key, out, depth + 1);
    }
  }
}

function scanRawContainer(
  container: unknown,
  label: string,
  planning: PlanningRow
): ContaminationIssue[] {
  const strings: { path: string; text: string }[] = [];
  collectStrings(container, label, strings);
  const issues: ContaminationIssue[] = [];

  for (const item of strings) {
    const fakePlan: SessionPlan = {
      sessionNumber: 0,
      objetivo: '',
      motivacion: '',
      saberesPrevios: '',
      contenido: item.text,
      ejemploResuelto: '',
      practica: [],
      aplicacion: '',
      autoevaluacion: [],
      recursos: [],
      productoIntegrador: '',
      isFallback: false,
    };
    const found = validateSessionPlanContamination(
      fakePlan,
      planning.uac_name,
      planning.component || '',
      planning.curriculum_name || ''
    );
    for (const issue of found) {
      issues.push({ ...issue, field: `${item.path}.${issue.field}` });
    }
  }

  return issues;
}

function extractWorkbookMissions(workbooks: unknown): MissionSection[] {
  if (!workbooks || typeof workbooks !== 'object') return [];
  const missions: MissionSection[] = [];
  const record = workbooks as Record<string, unknown>;

  for (const [key, blockValue] of Object.entries(record)) {
    if (!/^block_\d+$/.test(key) || !blockValue || typeof blockValue !== 'object') continue;
    const block = blockValue as Record<string, unknown>;
    const current = (block.current || block) as Record<string, unknown>;
    const blockMissions = current.missions;
    if (!Array.isArray(blockMissions)) continue;
    for (const mission of blockMissions) {
      if (mission && typeof mission === 'object') missions.push(mission as MissionSection);
    }
  }

  return missions;
}

function extractWorkbookPlans(missions: MissionSection[]): SessionPlan[] {
  return missions.flatMap((mission) =>
    Array.isArray(mission.sessionPlans) ? mission.sessionPlans : []
  );
}

function dedupeIssues(issues: ContaminationIssue[]): ContaminationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.sessionNumber}|${issue.field}|${issue.forbiddenTerm}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractWorkbookIntegrity(workbooks: unknown): string[] {
  if (!workbooks || typeof workbooks !== 'object') return [];
  const issues: string[] = [];
  for (const [key, blockValue] of Object.entries(workbooks as Record<string, unknown>)) {
    if (!/^block_\d+$/.test(key) || !blockValue || typeof blockValue !== 'object') continue;
    const block = blockValue as Record<string, unknown>;
    const current = (block.current || block) as Record<string, unknown>;
    const coverage = (current.coverageReport || {}) as Record<string, unknown>;
    const expected = Number(coverage.sessionsExpected ?? current.sessionsPerBlock ?? 0);
    const covered = Number(coverage.sessionsCovered ?? 0);
    const fallbackWords = Number(coverage.fallbackWords ?? current.fallbackWords ?? 0);
    const qualityWarning = current.qualityWarning === true;

    if (expected > 0 && covered < expected) {
      issues.push(`${key}: sesiones ${covered}/${expected}`);
    }
    if (fallbackWords > 0) {
      issues.push(`${key}: fallbackWords=${fallbackWords}`);
    }
    if (qualityWarning) {
      issues.push(`${key}: qualityWarning=true`);
    }
  }
  return issues;
}

function scanSeed(seed: SeedRow): ContaminationIssue[] {
  if (!seed.content) return [];
  const strings: { path: string; text: string }[] = [];
  collectStrings(seed.content, 'content', strings);
  const issues: ContaminationIssue[] = [];
  for (const item of strings) {
    const fakePlan: SessionPlan = {
      sessionNumber: 0,
      objetivo: '',
      motivacion: '',
      saberesPrevios: '',
      contenido: item.text,
      ejemploResuelto: '',
      practica: [],
      aplicacion: '',
      autoevaluacion: [],
      recursos: [],
      productoIntegrador: '',
      isFallback: false,
    };
    const found = validateSessionPlanContamination(fakePlan, seed.uac_id);
    for (const issue of found) {
      issues.push({ ...issue, field: `${item.path}.${issue.field}` });
    }
  }
  return dedupeIssues(issues);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no disponible. Configura .env.local.');
  }

  const planningArgIndex = process.argv.indexOf('--planning');
  const targetPlanningId = planningArgIndex >= 0 ? process.argv[planningArgIndex + 1] : null;

  const rows = (targetPlanningId
    ? await sql`
        SELECT id, uac_name, component, curriculum_name, workbooks_json, sequence_json, content_json
        FROM plannings
        WHERE id = ${targetPlanningId}
        ORDER BY uac_name`
    : await sql`
        SELECT id, uac_name, component, curriculum_name, workbooks_json, sequence_json, content_json
        FROM plannings
        ORDER BY uac_name, created_at`) as unknown as PlanningRow[];

  const extras = (targetPlanningId
    ? await sql`
        SELECT id, planning_id, type, title, content_text
        FROM planning_extras
        WHERE planning_id = ${targetPlanningId}
        ORDER BY planning_id, key_index`
    : await sql`
        SELECT id, planning_id, type, title, content_text
        FROM planning_extras
        ORDER BY planning_id, key_index`) as unknown as ExtraRow[];

  const extrasByPlanning = new Map<string, ExtraRow[]>();
  for (const extra of extras) {
    const list = extrasByPlanning.get(extra.planning_id) || [];
    list.push(extra);
    extrasByPlanning.set(extra.planning_id, list);
  }

  const seeds = (await sql`
    SELECT id, uac_id, subsystem, topic, content, source, quality_score
    FROM educational_canonical_seeds
    ORDER BY uac_id, topic`) as unknown as SeedRow[];

  const seedAudits: SeedAudit[] = seeds.map((seed) => ({
    id: seed.id,
    uacId: seed.uac_id,
    topic: seed.topic,
    qualityScore: seed.quality_score,
    issues: scanSeed(seed),
  }));

  const audits: PlanningAudit[] = [];

  for (const planning of rows) {
    const missions = extractWorkbookMissions(planning.workbooks_json);
    const plans = extractWorkbookPlans(missions);
    const issues: ContaminationIssue[] = [];
    const scannedContainers: string[] = [];

    if (missions.length > 0) {
      const report = validateBlockCrossContamination(
        missions,
        planning.uac_name,
        planning.component || '',
        planning.curriculum_name || ''
      );
      issues.push(...report.issues);
      scannedContainers.push(`workbooks_json (${missions.length} misiones, ${plans.length} planes)`);
    }

    if (planning.sequence_json) {
      issues.push(...scanRawContainer(planning.sequence_json, 'sequence_json', planning));
      scannedContainers.push('sequence_json');
    }

    if (planning.content_json) {
      issues.push(...scanRawContainer(planning.content_json, 'content_json', planning));
      scannedContainers.push('content_json');
    }

    const planningExtras = extrasByPlanning.get(planning.id) || [];
    for (const extra of planningExtras) {
      if (!extra.content_text) continue;
      const fakePlan: SessionPlan = {
        sessionNumber: 0,
        objetivo: '',
        motivacion: '',
        saberesPrevios: '',
        contenido: extra.content_text,
        ejemploResuelto: '',
        practica: [],
        aplicacion: '',
        autoevaluacion: [],
        recursos: [],
        productoIntegrador: '',
        isFallback: false,
      };
      const found = validateSessionPlanContamination(
        fakePlan,
        planning.uac_name,
        planning.component || '',
        planning.curriculum_name || ''
      );
      for (const issue of found) {
        issues.push({
          ...issue,
          field: `planning_extras[${extra.type || 'extra'}:${extra.title || extra.id}].${issue.field}`,
        });
      }
    }
    if (planningExtras.length > 0) {
      scannedContainers.push(`planning_extras (${planningExtras.length})`);
    }

    const uniqueIssues = dedupeIssues(issues);
    const integrityIssues = extractWorkbookIntegrity(planning.workbooks_json);
    audits.push({
      planningId: planning.id,
      uacName: planning.uac_name,
      component: planning.component || '',
      curriculumName: planning.curriculum_name || '',
      blocks: Object.keys((planning.workbooks_json as Record<string, unknown>) || {}).filter((key) =>
        /^block_\d+$/.test(key)
      ).length,
      plans: plans.length,
      issues: uniqueIssues,
      integrityIssues,
      scannedContainers,
    });
  }

  console.log('='.repeat(78));
  console.log('AUDITORIA READ-ONLY DE CONTAMINACION CRUZADA');
  console.log('='.repeat(78));

  let totalIssues = 0;
  for (const audit of audits) {
    totalIssues += audit.issues.length + audit.integrityIssues.length;
    const status = audit.issues.length === 0 && audit.integrityIssues.length === 0 ? 'OK' : 'ALERTA';
    console.log(`\n[${status}] ${audit.uacName}`);
    console.log(`  planning: ${audit.planningId}`);
    console.log(`  componente: ${audit.component || '(vacio)'} | curriculum: ${audit.curriculumName || '(vacio)'}`);
    console.log(`  bloques: ${audit.blocks} | planes: ${audit.plans}`);
    console.log(`  revisado: ${audit.scannedContainers.join(' | ') || '(sin contenido)'}`);

    for (const issue of audit.issues.slice(0, 12)) {
      console.log(
        `  - sesion ${issue.sessionNumber} | ${issue.field} | ${issue.forbiddenTerm} | ` +
          `esperado: ${issue.expectedDiscipline || '?'} | detectado: ${issue.actualDiscipline || '?'}`
      );
      console.log(`    "${issue.snippet}"`);
    }
    if (audit.issues.length > 12) {
      console.log(`  ... ${audit.issues.length - 12} incidencias adicionales`);
    }
    for (const issue of audit.integrityIssues) {
      console.log(`  - integridad: ${issue}`);
    }
  }

  console.log('\n' + '='.repeat(78));
  console.log('SEMILLAS CANONICAS');
  console.log('='.repeat(78));
  let totalSeedIssues = 0;
  for (const seed of seedAudits) {
    if (seed.issues.length === 0) continue;
    totalSeedIssues += seed.issues.length;
    console.log(`\n[ALERTA] ${seed.uacId} | ${seed.topic} | score=${seed.qualityScore ?? '?'}`);
    console.log(`  seed: ${seed.id}`);
    for (const issue of seed.issues.slice(0, 6)) {
      console.log(`  - ${issue.field} | ${issue.forbiddenTerm} | "${issue.snippet}"`);
    }
    if (seed.issues.length > 6) {
      console.log(`  ... ${seed.issues.length - 6} incidencias adicionales`);
    }
  }
  if (totalSeedIssues === 0) {
    console.log('\n[OK] Sin contaminación detectada en semillas canónicas.');
  }

  console.log('\n' + '='.repeat(78));
  console.log(
    `TOTAL: ${audits.length} planeaciones, ${totalIssues} incidencias; ` +
      `${seedAudits.length} semillas, ${totalSeedIssues} incidencias.`
  );
  console.log('='.repeat(78));

  process.exitCode = totalIssues + totalSeedIssues > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('Error en la auditoria:', error);
  process.exitCode = 2;
});
