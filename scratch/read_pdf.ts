import fs from 'fs';

async function analyze() {
  const pdfjsLib = await import('file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const pdfPath = 'scratch/test_workbook_b1_fixed.pdf';
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  console.log('====================================================');
  console.log('ANÁLISIS DEL NUEVO LIBRO GENERADO: TOTAL DE PÁGINAS =', doc.numPages);
  console.log('====================================================\n');

  for (let pageNum = Math.max(1, doc.numPages - 5); pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(' ');
    console.log(`--- [PÁGINA ${pageNum}] ---`);
    console.log(text.slice(0, 500).replace(/\s+/g, ' '));
    console.log(`\n`);
  }
}

analyze().catch(console.error);
