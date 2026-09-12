import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function main() {
  const pdfPath = 'c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/FFE 2025-2026.pdf';
  if (!fs.existsSync(pdfPath)) {
    console.error('File not found:', pdfPath);
    return;
  }
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  console.log('Total pages in FFE 2025-2026.pdf:', doc.numPages);
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(it => it.str).join(' ');
    console.log(`\n=== PÁGINA ${i} ===\n`, text);
  }
}

main().catch(console.error);
