import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function scanTables(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0
  }).promise;

  console.log(`\n=================== ${pdfPath.split('/').pop()} (${doc.numPages} pgs) ===================`);
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    if (text.includes('Tabla') && (text.includes('Propósitos') || text.includes('formativos'))) {
      console.log(`Page ${i}: ${text.substring(0, 350)}`);
    }
  }
}

async function run() {
  await scanTables('C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_MCC_CIENCIAS NATURALES_BN.pdf');
  await scanTables('C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_ MCC_CONCIENCIA HISTORICA_BN.pdf');
  await scanTables('C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_MCC_PENSAMIENTO FILOSOFICO_BN.pdf');
  await scanTables('C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_ MCC_MCC_INGLES_BN.pdf');
}

run().catch(console.error);
