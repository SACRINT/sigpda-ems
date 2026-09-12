import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPdf(pdfPath) {
  console.log(`Testing PDF: ${pdfPath}`);
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0
  }).promise;
  console.log(`Pages: ${doc.numPages}`);
  let text = '';
  for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  console.log(`First 10 pages text length: ${text.length}`);
  console.log(`Sample: ${text.substring(0, 400)}`);
}

const p = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_MCC_PENSAMIENTO MATEMATICO_BN.pdf';
testPdf(p).catch(console.error);
