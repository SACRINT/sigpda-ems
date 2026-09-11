import fs from 'fs';
import path from 'path';

async function printPlanOperativoPages() {
  const pdfPath = 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[05] Proyectos_PAEC_y_PMC\\PAEC-PEC_2025-2026_21EBH0200X_HÉROES DE LA PATRIA(1er y 2do SEM).pdf';
  const buffer = fs.readFileSync(pdfPath);
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'file:///' + workerPath.replace(/\\/g, '/');

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  for (let p of [14, 15, 16, 17, 18]) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map(it => 'str' in it ? it.str : '').join(' ');
    console.log(`\n================== PAGE ${p} ==================`);
    console.log(text);
  }
}

printPlanOperativoPages().catch(console.error);
