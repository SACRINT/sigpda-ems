import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const LABORAL_PATH = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2023 - 2026/Formación Laboral 2024/Administracion_2024.pdf';

async function scanLaboral() {
  const data = new Uint8Array(fs.readFileSync(LABORAL_PATH));
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0
  }).promise;

  console.log(`Scanning Administracion_2024.pdf (${doc.numPages} pages)...`);
  for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    if (text.includes('Unidad de Aprendizaje Curricular') || text.includes('UAC') || text.includes('Aprendizaje') || text.includes('Competencia') || text.includes('Módulo') || text.includes('Propósito')) {
      console.log(`\n--- Page ${i} ---`);
      console.log(text.substring(0, 300));
    }
  }
}

scanLaboral().catch(console.error);
