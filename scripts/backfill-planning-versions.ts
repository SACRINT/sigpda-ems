import { loadEnvLocal } from './lib/load-env';
loadEnvLocal();

import { sql } from '../src/lib/db/client';
import { recordPlanningVersion } from '../src/lib/planning/planning-versions';

async function main() {
  console.log('[backfill-planning-versions] Iniciando backfill de snapshots para planeaciones existentes...');
  const db = sql();

  const plannings = await db`
    SELECT id, teacher_id, content_json
    FROM plannings
    ORDER BY created_at ASC
  `;

  console.log(`[backfill-planning-versions] ${plannings.length} planeaciones encontradas en base de datos.`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const p of plannings) {
    const existing = await db`
      SELECT id FROM planning_versions
      WHERE planning_id = ${p.id}
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`[backfill-planning-versions] Planeación ${p.id} ya cuenta con versiones registradas. Omitiendo.`);
      skippedCount++;
      continue;
    }

    const content = p.content_json as Record<string, unknown> || {};
    const anexo12Score = (content.anexo12Audit as Record<string, unknown>)?.score as number | undefined;
    const dbepaScore = (content.dbepaAudit as Record<string, unknown>)?.score as number | undefined;

    await recordPlanningVersion({
      planningId: p.id,
      teacherId: p.teacher_id,
      contentJson: content,
      anexo12Score: anexo12Score ?? null,
      dbepaScore: dbepaScore ?? null,
      changeSummary: 'Línea base histórica auditada (Fase D.2 SGC ISO 21001:2018)',
    });

    createdCount++;
    console.log(`[backfill-planning-versions] Snapshot inicial v1 creado para planeación ${p.id}.`);
  }

  console.log(`[backfill-planning-versions] Resumen: ${createdCount} snapshots v1 creados, ${skippedCount} omitidos.`);
}

main().catch((err) => {
  console.error('[backfill-planning-versions] Error en backfill:', err);
  process.exit(1);
});
