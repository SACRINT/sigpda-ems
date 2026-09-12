import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const pdfPath = 'c:/Secuencias_Didacticas/Curriculum Fundamental/2025_ MCC_CULTURA DIGITAL_BN.pdf';
  console.log(`Reading ${pdfPath}...`);
  const buffer = fs.readFileSync(pdfPath);
  const uint8Array = new Uint8Array(buffer);
  
  const doc = await pdfjsLib.getDocument({
    data: uint8Array,
    password: '',
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  console.log(`Pages: ${doc.numPages}`);
  let text = '';
  // Let's read first 15 pages
  const maxPages = Math.min(doc.numPages, 15);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str || '').join(' ');
    text += `=== PAGE ${i} ===\n${pageText}\n\n`;
  }
  
  const outPath = 'C:/Users/samue/.gemini/antigravity/brain/ed37a3e5-9696-4fbc-8cdc-fecebfd91fe5/scratch/cultura-digital-text.txt';
  fs.writeFileSync(outPath, text, 'utf-8');
  console.log(`Done! Extracted text written to ${outPath}`);
}

run().catch(console.error);
