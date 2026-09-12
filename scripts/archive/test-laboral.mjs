import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const p = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2023 - 2026/Curriculum Laboral BGE 2023/Administracion_2024.pdf';

async function testLaboral() {
  const data = new Uint8Array(fs.readFileSync(p));
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0
  }).promise;

  console.log(`Pages: ${doc.numPages}`);
  for (let i = 1; i <= Math.min(doc.numPages, 20); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    if (text.includes('Unidad de Aprendizaje Curricular') || text.includes('UAC') || text.includes('Aprendizaje') || text.includes('Contenido') || text.includes('Módulo')) {
      console.log(`Page ${i}: ${text.substring(0, 250)}...`);
    }
  }
}

testLaboral().catch(console.error);
