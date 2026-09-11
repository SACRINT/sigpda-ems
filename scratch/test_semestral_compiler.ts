import fs from 'fs';
import path from 'path';
import { compileSemestralWorkbook } from '../src/lib/master-workbook-compiler';
import { getPlanningById } from '../src/lib/db';
import type { Planning } from '../src/types/planning';

async function testCompendiums() {
  const targets = [
    { id: '413c9b7a-31a3-404a-991b-f6f51bb565e3', name: 'BT_Programacion' },
    { id: '215643ee-47ad-436a-85df-ea0c8ca39ca4', name: 'BGE_Matematicas' },
  ];

  for (const target of targets) {
    console.log(`\n======================================================`);
    console.log(`📚 Compilando Compendio Semestral: ${target.name}`);
    console.log(`======================================================`);

    const rawPlanning = await getPlanningById(target.id);
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

    const startTime = Date.now();
    const { docx, pdf } = await compileSemestralWorkbook(target.id, planning, { format: 'both' });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (docx) {
      const docxPath = path.resolve(`./scratch/Compendio_Semestral_${target.name}.docx`);
      fs.writeFileSync(docxPath, docx);
      console.log(`✅ DOCX guardado: ${docxPath} (${(docx.length / 1024).toFixed(1)} KB)`);
    }

    if (pdf) {
      const pdfPath = path.resolve(`./scratch/Compendio_Semestral_${target.name}.pdf`);
      fs.writeFileSync(pdfPath, pdf);
      console.log(`✅ PDF guardado: ${pdfPath} (${(pdf.length / 1024).toFixed(1)} KB)`);
    }

    console.log(`⏱️ Compilado en ${elapsed}s`);
  }
}

testCompendiums().catch(console.error);
