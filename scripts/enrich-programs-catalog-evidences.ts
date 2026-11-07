import { sql } from '../src/lib/db/client';
import {
  asegurarCoberturaEvidencias,
  construirProgresionesResumidas,
  type ActividadFuente,
  type ContenidoFormativoFuente,
} from '../src/lib/curriculum-evidence-engine';

async function enrichProgramsCatalogEvidences() {
  console.log('────────────────────────────────────────────────────────────────────────');
  console.log('ENRIQUECIMIENTO GLOBAL DE EVIDENCIAS EN PROGRAMS_CATALOG (498 PROGRAMAS)');
  console.log('────────────────────────────────────────────────────────────────────────');

  const rows = await sql`
    SELECT id, uac_name, semester, component, subsystem,
           contenidos_formativos, activities, evidences
    FROM programs_catalog
    ORDER BY semester ASC, component ASC, uac_name ASC
  `;

  console.log(`• Programas encontrados en programs_catalog: ${rows.length}`);

  let updatedFromZero = 0;
  let supplementedPartial = 0;
  let alreadyComplete = 0;
  let totalEvidencesAfter = 0;
  let zeroEvidencesAfter = 0;

  const pendingUpdates: Array<{ id: string; evidencesJson: string }> = [];

  for (const row of rows) {
    const currentEvidences: string[] = Array.isArray(row.evidences)
      ? row.evidences.map((e: unknown) => String(e || '').trim()).filter(Boolean)
      : [];

    const cfs = Array.isArray(row.contenidos_formativos)
      ? (row.contenidos_formativos as ContenidoFormativoFuente[])
      : null;
    const acts = Array.isArray(row.activities)
      ? (row.activities as ActividadFuente[])
      : null;

    const progs = construirProgresionesResumidas(cfs, acts);
    const enrichedEvidences = asegurarCoberturaEvidencias(
      currentEvidences,
      progs,
      row.uac_name,
      row.component
    );

    if (enrichedEvidences.length === 0) {
      zeroEvidencesAfter++;
    }
    totalEvidencesAfter += enrichedEvidences.length;

    const changed =
      currentEvidences.length !== enrichedEvidences.length ||
      currentEvidences.some((ev, idx) => ev !== enrichedEvidences[idx]);

    if (changed) {
      pendingUpdates.push({
        id: row.id as string,
        evidencesJson: JSON.stringify(enrichedEvidences),
      });

      if (currentEvidences.length === 0) {
        updatedFromZero++;
      } else {
        supplementedPartial++;
      }
    } else {
      alreadyComplete++;
    }

    if (row.uac_name.toLowerCase().includes('pensamiento matemático iii')) {
      console.log('\n[Verificación Focal: Pensamiento Matemático III]');
      console.log(`  Propósitos formativos: ${progs.length}`);
      console.log(`  Evidencias antes (${currentEvidences.length}):`);
      currentEvidences.forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
      console.log(`  Evidencias después (${enrichedEvidences.length}):`);
      enrichedEvidences.forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
    }
  }

  const BATCH_SIZE = 25;
  for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
    const batch = pendingUpdates.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((u) =>
        sql`
          UPDATE programs_catalog
          SET evidences = ${u.evidencesJson}::jsonb
          WHERE id = ${u.id}
        `
      )
    );
  }

  console.log('\n────────────────────────────────────────────────────────────────────────');
  console.log('RESUMEN DE EJECUCIÓN:');
  console.log(`  • Total de programas procesados:         ${rows.length}`);
  console.log(`  • Poblados desde 0 evidencias:           ${updatedFromZero}`);
  console.log(`  • Complementados por cobertura parcial:  ${supplementedPartial}`);
  console.log(`  • Ya contaban con cobertura 100%:        ${alreadyComplete}`);
  console.log(`  • Total de evidencias en catálogo:       ${totalEvidencesAfter}`);
  console.log(`  • Programas con 0 evidencias restantes:  ${zeroEvidencesAfter}`);
  console.log('────────────────────────────────────────────────────────────────────────');

  if (zeroEvidencesAfter > 0) {
    throw new Error(`Fallo de invariante: ${zeroEvidencesAfter} programas quedaron sin evidencias.`);
  }
}

enrichProgramsCatalogEvidences()
  .catch((err) => {
    console.error('Error durante el enriquecimiento del catálogo:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
