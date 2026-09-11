import fs from 'fs';
import path from 'path';
import { generateBlockWorkTextbook } from '../src/lib/guide-engine/block-guide-orchestrator';
import { renderWorkbookToDocx } from '../src/lib/docx-workbook-renderer';
import { renderWorkbookToPdf } from '../src/lib/pdf-workbook-renderer';
import { getPlanningById } from '../src/lib/db';
import type { Planning } from '../src/types/planning';

async function main() {
  const planningId = '413c9b7a-31a3-404a-991b-f6f51bb565e3'; // Programación BT
  const blockIndex = 0;

  console.log('================================================================');
  console.log('🚀 INICIANDO PILOTO BT: Bloque I de Programación (18 horas)');
  console.log('================================================================');

  const startTime = Date.now();
  const workbook = await generateBlockWorkTextbook(planningId, blockIndex);
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✅ Libro generado con éxito en ${elapsedSec}s!`);
  console.log(`📊 Word Count Total: ${workbook.totalWords}`);
  console.log(`📄 Páginas Estimadas: ${workbook.totalPages}`);
  console.log(`⭐ Quality Score: ${workbook.qualityScore}/100`);
  console.log(`⚠️ Quality Warning: ${workbook.qualityWarning ? 'SÍ' : 'NO'}`);
  console.log(`🎯 Misiones Generadas: ${workbook.missions.length}`);

  // Fetch planning object for renderers
  const rawPlanning = await getPlanningById(planningId);
  const planning: Planning = {
    id: rawPlanning.id,
    teacherId: rawPlanning.teacher_id,
    uacName: rawPlanning.uac_name,
    semester: rawPlanning.semester,
    component: rawPlanning.component,
    curriculumName: rawPlanning.curriculum_name || '',
    paecContext: rawPlanning.paec_context || '',
    extractedData: rawPlanning.extracted_data,
    contentJson: rawPlanning.content_json,
    status: rawPlanning.status,
    createdAt: rawPlanning.created_at,
    updatedAt: rawPlanning.updated_at,
  };

  console.log('\n📄 Renderizando DOCX...');
  const docxBuffer = await renderWorkbookToDocx(workbook, planning);
  const docxPath = path.resolve('./scratch/Piloto_BT_Bloque_I_Programacion.docx');
  fs.writeFileSync(docxPath, docxBuffer);
  console.log(`✅ DOCX guardado en: ${docxPath} (${(docxBuffer.length / 1024).toFixed(1)} KB)`);

  console.log('\n📑 Renderizando PDF...');
  const pdfBuffer = await renderWorkbookToPdf(workbook, planning);
  const pdfPath = path.resolve('./scratch/Piloto_BT_Bloque_I_Programacion.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`✅ PDF guardado en: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  // Guardar JSON del libro para auditoría
  const jsonPath = path.resolve('./scratch/Piloto_BT_Bloque_I_Programacion.json');
  fs.writeFileSync(jsonPath, JSON.stringify(workbook, null, 2), 'utf-8');

  console.log('\n🔍 Auditoría de Misiones BT:');
  for (let i = 0; i < workbook.missions.length; i++) {
    const m = workbook.missions[i];
    console.log(`\nMisión ${i + 1}:`);
    console.log(`  Título: ${m.title}`);
    console.log(`  Palabras: ${m.wordCount}`);
    console.log(`  Reto autónomo (You Do): ${m.youDoSection?.autonomousChallenge ? m.youDoSection.autonomousChallenge.substring(0, 80) + '...' : '(sin reto explícito)'}`);
  }
}

main().catch((err) => {
  console.error('❌ Error fatal en ejecución Piloto BT:', err);
  process.exit(1);
});
