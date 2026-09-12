import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const FUNDAMENTAL_DIR = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental';
const AMPLIADO_DIR = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Curriculum Ampliado';
const FFEO_DIR = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Formación Fundamental Extendido Obligatorio';

async function extractFullPdfText(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0
  }).promise;

  let pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    pages.push({ pageNum: i, text });
  }
  return { numPages: doc.numPages, pages };
}

async function run() {
  const files = [
    ...fs.readdirSync(FUNDAMENTAL_DIR).filter(f => f.endsWith('.pdf') && !f.includes('INFOGRAFIA')).map(f => path.join(FUNDAMENTAL_DIR, f)),
    ...fs.readdirSync(AMPLIADO_DIR).filter(f => f.endsWith('.pdf') && !f.includes('INFOGRAFIA')).map(f => path.join(AMPLIADO_DIR, f)),
    ...fs.readdirSync(FFEO_DIR).filter(f => f.endsWith('.pdf')).map(f => path.join(FFEO_DIR, f))
  ];

  console.log(`Found ${files.length} official 2025-2028 PDFs.`);
  for (const f of files) {
    const fn = path.basename(f);
    console.log(`\n======================================================`);
    console.log(`PDF: ${fn}`);
    const { numPages, pages } = await extractFullPdfText(f);
    console.log(`Total Pages: ${numPages}`);

    // Look for table pages (contain 'Propósitos formativos' and 'Contenidos formativos' or 'Tabla')
    const tablePages = pages.filter(p => 
      (p.text.includes('Propósitos formativos') && p.text.includes('Contenidos formativos')) ||
      (p.text.includes('Meta educativa') && p.text.includes('Propósitos')) ||
      (p.text.includes('Tabla') && p.text.includes('Propósitos'))
    );
    console.log(`Pages with curriculum tables: ${tablePages.map(p => p.pageNum).join(', ')}`);
    tablePages.forEach(tp => {
      console.log(`\n--- PÁGINA ${tp.pageNum} MUESTRA ---`);
      console.log(tp.text.substring(0, 400));
    });
  }
}

run().catch(console.error);
