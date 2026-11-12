/**
 * backfill-planning-audits.ts — Script de Backfill P0 / Fase A.2
 *
 * Evalúa deterministamente todas las planeaciones existentes en Neon PostgreSQL con
 * el Anexo 12 USICAMM y el Quality Gate DBEPA, persistiendo estructuradamente:
 *   - `content_json.anexo12Audit`
 *   - `content_json.dbepaAudit`
 *
 * En modo permisivo (no bloquea planeaciones históricas; registra advertencias).
 *
 * Uso:
 *   npx tsx scripts/backfill-planning-audits.ts           # Dry-run (solo reporte)
 *   npx tsx scripts/backfill-planning-audits.ts --apply   # Persiste las auditorías en Neon DB
 */

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { validateAnexo12, type Anexo12Report } from '../src/lib/planning/anexo12-validator';
import { evaluateDBEPA, type DBEPAAudit } from '../src/lib/planning/dbepa-quality-gate';
import type { GeneratedPlanningContent } from '../src/types/planning';

function getDbClient() {
  const env = readFileSync('.env.local', 'utf8');
  const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
  if (!match) {
    throw new Error('DATABASE_URL no encontrada en .env.local');
  }
  return neon(match[1]);
}

interface BackfillResult {
  id: string;
  uacName: string;
  semester: number;
  anexo12Score: number;
  anexo12Ok: boolean;
  anexo12Criticals: number;
  dbepaSemaforo: string;
  dbepaScore: number;
  dbepaPassed: number;
}

async function run() {
  const isApply = process.argv.includes('--apply');
  const sql = getDbClient();

  console.log('=================================================================');
  console.log('   BACKFILL PEDAGÓGICO DUAL — ANEXO 12 USICAMM + DBEPA PUEBLA');
  console.log(`   Modo: ${isApply ? 'APPLY (Persistencia en Neon DB)' : 'DRY-RUN (Evaluación de solo lectura)'}`);
  console.log('=================================================================\n');

  const rows = await sql`
    SELECT id, teacher_id, uac_name, semester, component, content_json
    FROM plannings
    WHERE content_json IS NOT NULL
    ORDER BY semester, uac_name ASC
  `;

  console.log(`Planeaciones encontradas con content_json: ${rows.length}\n`);

  const results: BackfillResult[] = [];
  let anexo12ConformesCount = 0;
  let anexo12AdvertenciasCount = 0;
  const dbepaSemaforos = { verde: 0, amarillo: 0, rojo: 0 };

  for (const row of rows) {
    const content = row.content_json as Record<string, unknown>;
    const uacName = (row.uac_name || '') as string;
    const semester = Number(row.semester) || 1;
    const component = (row.component || '') as string;

    const anexo12Report = validateAnexo12(content, {
      uacName,
      semester,
      component,
    });

    const dbepaReport = evaluateDBEPA(content as unknown as GeneratedPlanningContent, {
      uacName,
      semester,
    });

    if (anexo12Report.ok) {
      anexo12ConformesCount++;
    } else {
      anexo12AdvertenciasCount++;
    }

    if (dbepaReport.semaforo === 'verde') dbepaSemaforos.verde++;
    else if (dbepaReport.semaforo === 'amarillo') dbepaSemaforos.amarillo++;
    else dbepaSemaforos.rojo++;

    results.push({
      id: row.id as string,
      uacName,
      semester,
      anexo12Score: anexo12Report.score,
      anexo12Ok: anexo12Report.ok,
      anexo12Criticals: anexo12Report.criticalFailures,
      dbepaSemaforo: dbepaReport.semaforo,
      dbepaScore: dbepaReport.score,
      dbepaPassed: dbepaReport.passed,
    });

    if (isApply) {
      content.anexo12Audit = anexo12Report;
      content.dbepaAudit = dbepaReport;

      await sql`
        UPDATE plannings
        SET content_json = ${JSON.stringify(content)}::jsonb,
            updated_at = NOW()
        WHERE id = ${row.id}::uuid
      `;
    }
  }

  // Despliegue tabular en consola
  console.log('---------------------------------------------------------------------------------------------------------');
  console.log('ID       | Sem | Asignatura                               | Anexo12 | Estado   | DBEPA Semáforo | Score ');
  console.log('---------------------------------------------------------------------------------------------------------');

  for (const r of results) {
    const shortId = r.id.slice(0, 8);
    const shortUac = r.uacName.slice(0, 40).padEnd(40, ' ');
    const a12ScoreStr = `${r.anexo12Score}/100`.padEnd(7, ' ');
    const a12Status = r.anexo12Ok ? '🟢 Conforme' : `🟡 Warn (${r.anexo12Criticals})`;
    const semaforoEmoji = r.dbepaSemaforo === 'verde' ? '🟢 Verde' : r.dbepaSemaforo === 'amarillo' ? '🟡 Amarillo' : '🔴 Rojo';

    console.log(`${shortId} | ${r.semester}°  | ${shortUac} | ${a12ScoreStr} | ${a12Status.padEnd(14, ' ')} | ${semaforoEmoji.padEnd(14, ' ')} | ${r.dbepaScore}/100 (${r.dbepaPassed}/12)`);
  }

  console.log('---------------------------------------------------------------------------------------------------------\n');
  console.log('Resumen de Conformidad Pedagógica:');
  console.log(`- Total de planeaciones evaluadas: ${results.length}`);
  console.log(`- Anexo 12 USICAMM: ${anexo12ConformesCount} conformes, ${anexo12AdvertenciasCount} con observaciones.`);
  console.log(`- DBEPA Puebla: 🟢 ${dbepaSemaforos.verde} verdes, 🟡 ${dbepaSemaforos.amarillo} amarillos, 🔴 ${dbepaSemaforos.rojo} rojos.`);

  if (isApply) {
    console.log(`\n✓ Se persistieron exitosamente los reportes estructurados anexo12Audit y dbepaAudit en las ${results.length} planeaciones en Neon DB.\n`);
  } else {
    console.log('\nDRY-RUN completado. Para persistir los reportes en Neon DB, ejecuta:');
    console.log('npx tsx scripts/backfill-planning-audits.ts --apply\n');
  }
}

run().catch((err) => {
  console.error('Error fatal durante el backfill:', err);
  process.exit(1);
});
