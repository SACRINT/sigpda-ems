import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function extractPdfText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
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
  return pages;
}

// Function to parse UAC tables from text
export function parseUACTablesFromPages(pages, subjectNamePattern) {
  const fullText = pages.map(p => p.text).join('\n');
  
  // Look for sections like "Tabla 1. Propósitos y contenidos formativos de Pensamiento Matemático I"
  // or "2.1. Pensamiento Matemático I"
  // Metas educativas, Propósitos formativos (1, 2, 3...), Contenidos formativos
}

async function testExtraction() {
  const pdfPath = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_ MCC_LENGUA Y COMUNICACION_BN.pdf';
  const pages = await extractPdfText(pdfPath);
  console.log(`Pages in Lengua y Comunicación: ${pages.length}`);
  
  // Find table pages
  pages.forEach(p => {
    if (p.text.includes('Propósitos formativos') && p.text.includes('Contenidos formativos')) {
      console.log(`\n=== PÁGINA ${p.pageNum} ===`);
      console.log(p.text);
    }
  });
}

testExtraction().catch(console.error);
