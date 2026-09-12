import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const GEN2023_DIR = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2023 - 2026';

function walk(dir) {
  let res = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) res = res.concat(walk(full));
    else if (file.endsWith('.pdf')) res.push(full);
  });
  return res;
}

async function run() {
  const pdfs = walk(GEN2023_DIR);
  console.log(`Found ${pdfs.length} PDFs in Generación 2023 - 2026.`);
  for (const f of pdfs.slice(0, 8)) {
    const fn = path.basename(f);
    const data = new Uint8Array(fs.readFileSync(f));
    const doc = await pdfjsLib.getDocument({
      data,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0
    }).promise;
    console.log(`\nPDF: ${fn} (Pages: ${doc.numPages})`);
    for (let i = 1; i <= Math.min(doc.numPages, 12); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      if (text.includes('Progresión') || text.includes('Propósito') || text.includes('Aprendizaje') || text.includes('Contenido') || text.includes('Meta')) {
        console.log(`  Página ${i}: ${text.substring(0, 180)}...`);
      }
    }
  }
}

run().catch(console.error);
