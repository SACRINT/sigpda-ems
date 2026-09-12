import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const FFE_OPT_DIR = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2023 - 2026/Formación Fundamental Extendido (UAC optativas)/Sexto Semestre';
const FFE_OBL_DIR = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2023 - 2026/Formación Fundamental Extendido Obligatorio';

async function scanFfePdfs(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
  console.log(`\nScanning ${files.length} PDFs in ${path.basename(dir)}...`);
  
  for (const f of files.slice(0, 5)) {
    const data = new Uint8Array(fs.readFileSync(path.join(dir, f)));
    const doc = await pdfjsLib.getDocument({
      data,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0
    }).promise;

    let text = '';
    for (let i = 1; i <= Math.min(doc.numPages, 16); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }

    // Look for Progresiones or Propósitos
    const progMatches = text.match(/(?:Progresión|Propósito)\s*(\d+)[\s\S]{10,200}/g) || [];
    console.log(`- ${f} (${doc.numPages} pgs): ${progMatches.length} progresiones/propósitos encontrados.`);
  }
}

async function run() {
  await scanFfePdfs(FFE_OPT_DIR);
  await scanFfePdfs(FFE_OBL_DIR);
}

run().catch(console.error);
