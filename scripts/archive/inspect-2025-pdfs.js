const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function extractPdfText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let fullText = '';
  for (let i = 1; i <= Math.min(doc.numPages, 35); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += `\n--- PÁGINA ${i} ---\n` + strings.join(' ');
  }
  return fullText;
}

async function main() {
  const testFiles = [
    'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_MCC_PENSAMIENTO MATEMATICO_BN.pdf',
    'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_ MCC_CIENCIAS SOCIALES_BN.pdf',
    'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_ MCC_CONCIENCIA HISTORICA_BN.pdf'
  ];

  for (const f of testFiles) {
    console.log(`\n================== INSPECCIONANDO: ${f.split('/').pop()} ==================`);
    const txt = await extractPdfText(f);
    console.log('Longitud texto:', txt.length);
    // Find occurrences of Semestre or Propósitos
    const lines = txt.split('\n');
    const interesting = lines.filter(l => l.includes('Semestre') || l.includes('Propósito') || l.includes('Contenido') || l.includes('UAC'));
    console.log('Líneas relevantes (muestra):', interesting.slice(0, 15));
  }
}

main().catch(console.error);
