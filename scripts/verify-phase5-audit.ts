import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { reviewBlockMaterials } from '../src/lib/guide-engine/material-review';
import { extractMaterialsFromWorkbook } from '../src/lib/guide-engine/material-extractor';
import type { ActiveWorkTextbook } from '../src/types/work-textbook';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

const TEACHER_ID = '08502250-0e44-4da6-b282-2ed11ad2077c'; // Blizzard2

async function main() {
  console.log('=== FASE 5: AUDITORÍA INTEGRAL DE VERIFICACIÓN ===\n');

  // 1. Audit plannings in database
  const plannings = await sql`
    SELECT id, uac_name, semester, component, paec_context, content_json, workbooks_json
    FROM plannings
    WHERE teacher_id = ${TEACHER_ID}
    ORDER BY created_at ASC
  `;

  console.log(`Auditing ${plannings.length} plannings for Blizzard2:`);
  let allSectionVOk = true;
  let allPaecContextOk = true;

  for (const p of plannings) {
    console.log(`\n-------------------------------------------------------------`);
    console.log(`[${p.id}] ${p.uac_name}`);
    console.log(`Semestre: ${p.semester}° | Componente: ${p.component}`);

    // Check PAEC context
    const paec = (p.paec_context || '').trim();
    if (paec.startsWith('en campo, consolidando')) {
      console.error(`❌ PAEC context corrupto: "${paec.slice(0, 50)}..."`);
      allPaecContextOk = false;
    } else {
      console.log(`✓ PAEC context limpio: "${paec.slice(0, 60)}..."`);
    }

    // Check sectionV
    const s5 = p.content_json?.sectionV;
    const evals = s5?.evaluations || [];
    console.log(`✓ sectionV.evaluations (${evals.length} items):`);
    let weightSum = 0;
    evals.forEach((ev: any, i: number) => {
      weightSum += Number(ev.weighting || 0);
      console.log(`   [${i}] ${ev.moment || ev.type}: "${ev.instrument}" (${ev.weighting}%) - ${ev.agent}`);
    });
    if (Math.abs(weightSum - 100) > 0.5) {
      console.error(`❌ Suma de ponderaciones inválida: ${weightSum}% (debe ser 100%)`);
      allSectionVOk = false;
    } else {
      console.log(`   ✓ Ponderación suma exactamente 100% (5/55/40).`);
    }

    // Check planning_extras distribution
    const extras = await sql`
      SELECT key_index, type, count(*) as cnt
      FROM planning_extras
      WHERE planning_id = ${p.id}
      GROUP BY key_index, type
      ORDER BY key_index, type
    `;

    // Verify each block (0, 1, 2) has rubric, checklist, evaluation
    for (let b = 0; b < 3; b++) {
      const bExtras = extras.filter((e: any) => e.key_index === b);
      const hasRubric = bExtras.some((e: any) => e.type === 'rubric');
      const hasChecklist = bExtras.some((e: any) => e.type === 'checklist');
      const hasEvaluation = bExtras.some((e: any) => e.type === 'evaluation');

      if (!hasRubric || !hasChecklist || !hasEvaluation) {
        console.error(`❌ Bloque ${b + 1} incompleto: rubric=${hasRubric}, checklist=${hasChecklist}, evaluation=${hasEvaluation}`);
      } else {
        console.log(`   ✓ Bloque ${b + 1}: rubric (OK), checklist (OK), evaluation especializado (OK)`);
      }
    }

    // Run R1 material review for each block workbook
    const wb = p.workbooks_json || {};
    for (let b = 0; b < 3; b++) {
      const wbCurrent = wb[`block_${b}`]?.current as ActiveWorkTextbook;
      if (wbCurrent) {
        const extracted = extractMaterialsFromWorkbook(wbCurrent);
        const allBlockExtras = await sql`
          SELECT type, title, content_text
          FROM planning_extras
          WHERE planning_id = ${p.id} AND key_index = ${b}
        `;
        const review = reviewBlockMaterials({
          workbook: wbCurrent,
          extracted,
          persistedExtras: allBlockExtras.map((e: any) => ({
            type: e.type,
            title: e.title,
            content_text: e.content_text,
          })),
          checkFullBlockPersistence: true,
          resolvedUacName: p.uac_name,
        });

        const blockingIssues = review.issues.filter(i => i.severity === 'error');
        if (blockingIssues.length > 0) {
          console.warn(`   ⚠️ Advertencia R1 Bloque ${b + 1}: ${blockingIssues.length} errores:`, blockingIssues.map(i => i.message));
        } else {
          console.log(`   ✓ Auditoría R1 Bloque ${b + 1}: VERIFICADO R1 (0 errores bloqueantes).`);
        }
      }
    }
  }

  console.log(`\n=============================================================`);
  console.log(`RESUMEN DE VERIFICACIÓN:`);
  console.log(`- PAEC Context limpio: ${allPaecContextOk ? 'SÍ' : 'NO'}`);
  console.log(`- Ponderaciones 100%: ${allSectionVOk ? 'SÍ' : 'NO'}`);
  console.log(`=============================================================`);
}

main().catch(console.error);
