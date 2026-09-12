import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const dir = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental';

const pdfs = fs.readdirSync(dir).filter(f => f.startsWith('2025_') && f.endsWith('.pdf'));

async function inspectPdf(filename) {
  const filePath = path.join(dir, filename);
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0
  }).promise;

  console.log(`\n======================================================`);
  console.log(`PDF: ${filename} (Total páginas: ${doc.numPages})`);

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    
    // Buscar menciones de Tabla, Propósitos formativos, o Nombre de la asignatura
    if (/Tabla\s*\d+/i.test(text) && /Propósitos formativos|Nombre de la asignatura|Meta educativa/i.test(text)) {
      const matchTabla = text.match(/Tabla\s*\d+[^.\n]{0,80}/i);
      const matchAsignatura = text.match(/Nombre de la asignatura[^\n.]{0,80}/i);
      const matchSemestre = text.match(/(?:Primer|Segundo|Tercer|Cuarto|Quinto|Sexto)\s+semestre/i);
      console.log(`  Página ${i}: [${matchTabla ? matchTabla[0] : 'Sin tabla'}] [${matchAsignatura ? matchAsignatura[0] : 'Sin nombre'}] [${matchSemestre ? matchSemestre[0] : ''}]`);
    }
  }
}

async function run() {
  for (const pdf of pdfs) {
    await inspectPdf(pdf);
  }
}

run().catch(console.error);
