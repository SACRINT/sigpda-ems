import fs from 'fs';
import path from 'path';

// Polyfill global DOMMatrix for Node ESM execution
if (typeof global !== 'undefined' && !global.DOMMatrix) {
  global.DOMMatrix = class DOMMatrix {};
}

async function run() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const files = [
    'S1 y S2  Planeación Didáctica BG CF y CA 26 27.pdf',
    'Guía de Retroalimentación Secuencia Didáctica FormaciónLoboral 2026-2027.pdf',
    'Revisión Secuencia Didáctica Formación Loboral 2026-2027.pdf',
    'S123 Planeación Didáctica.pdf',
    'S1 Guía Retro S2_Secuencia Didáctica 26 27.pdf'
  ];

  const outputDir = 'C:/Users/samue/.gemini/antigravity/brain/ed37a3e5-9696-4fbc-8cdc-fecebfd91fe5/scratch';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const file of files) {
    const pdfPath = `c:/Secuencias_Didacticas/${file}`;
    if (!fs.existsSync(pdfPath)) {
      console.warn(`File does not exist: ${pdfPath}`);
      continue;
    }
    
    console.log(`Parsing ${file}...`);
    const buffer = fs.readFileSync(pdfPath);
    try {
      const doc = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        password: '',
        useSystemFonts: false,
        disableFontFace: true,
        verbosity: 0,
      }).promise;

      let text = '';
      const maxPages = Math.min(doc.numPages, 40); // Parse up to 40 pages of each file
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
        text += `=== PAGE ${pageNum} ===\n` + pageText + '\n\n';
      }

      const txtFile = path.join(outputDir, file.replace(/\s+/g, '_').replace(/\.pdf$/, '.txt'));
      fs.writeFileSync(txtFile, text, 'utf-8');
      console.log(`  ✓ Saved text to ${txtFile} (length: ${text.length} chars)`);
    } catch (err) {
      console.error(`  ❌ Failed to parse ${file}:`, err.message);
    }
  }
}

run().catch(console.error);
