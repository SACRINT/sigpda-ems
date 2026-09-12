import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const pdfPath = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_MCC_PENSAMIENTO MATEMATICO_BN.pdf';

async function inspect() {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log('PDF loaded, total pages:', doc.numPages);

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    
    if (
      pageText.includes('Pensamiento Matemático III') ||
      pageText.includes('Tabla 3') ||
      pageText.includes('sistema de ecuaciones') ||
      pageText.includes('Bhaskara') ||
      pageText.includes('Napoleón') ||
      pageText.includes('Ecuaciones lineales con dos incógnitas')
    ) {
      console.log(`\n================ PAGE ${pageNum} ================`);
      console.log(pageText.slice(0, 1500));
    }
  }
}

inspect().catch(console.error);
