import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractFullText(pdfPath) {
  try {
    const buffer = fs.readFileSync(pdfPath);
    const uint8Array = new Uint8Array(buffer);
    const doc = await pdfjsLib.getDocument({
      data: uint8Array,
      password: '',
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0,
    }).promise;

    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str || '').join(' ');
      text += `=== PAGE ${i} ===\n${pageText}\n\n`;
    }
    return text;
  } catch (err) {
    console.error(`Error reading ${pdfPath}:`, err.message);
    return null;
  }
}

// Improved filter
function extractPurposes(text) {
  // Regex: matches number (1-8) followed by uppercase letter and text
  const regex = /\b([1-8])\s+([A-ZÁÉÍÓÚÑ][\s\S]+?)(?=\s*(?:\b[1-8]\s+[A-ZÁÉÍÓÚÑ]|\bMeta\b|\bOrientaciones\b|=== PAGE|$))/g;
  const matches = [...text.matchAll(regex)];
  
  const purposes = [];
  const seen = new Set();
  
  for (const m of matches) {
    const num = parseInt(m[1], 10);
    const rawContent = m[2].trim().replace(/\s+/g, ' ');
    
    // General filters to exclude headers and other layout text
    const isFalsePositive = [
      'MARCO CURRICULAR', 'MODELO EDUCATIVO', 'SECRETARIO', 'COORDINADORA', 
      'DIRECCIÓN DE', 'SISTEMA NACIONAL', 'PRIMERA EDICIÓN', 'ÍNDICE', 
      'HORAS/SEMANA', 'HORAS SEMANA', 'CRITERIOS PARA', 'GLOSARIO', 'BIBLIOGRAFÍA',
      'DIRECTORIO', 'PROGRAMAS DE ESTUDIO', 'CURRÍCULUM', 'SUBSECRETARIA',
      'Bachillerato', 'Secretaría de', 'Cultura Digital', 'Conciencia Histórica',
      'Pensamiento Matemático', 'Lengua y Comunicación', 'Ciencias Sociales',
      'Ciencias Naturales', 'Inglés', 'Humanidades', 'Filosófico'
    ].some(word => rawContent.toUpperCase().includes(word.toUpperCase()));
    
    if (!isFalsePositive && rawContent.length > 25 && !seen.has(rawContent)) {
      seen.add(rawContent);
      purposes.push({ num, content: rawContent });
    }
  }
  
  purposes.sort((a, b) => a.num - b.num);
  return purposes;
}

async function run() {
  const dirPath = 'c:/Secuencias_Didacticas/Curriculum Fundamental';
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.pdf') && !f.toUpperCase().includes('INFOGRAFIA'));
  
  for (const file of files) {
    const pdfPath = path.join(dirPath, file);
    console.log(`\n📄 File: ${file}`);
    const text = await extractFullText(pdfPath);
    if (!text) continue;
    
    // Find UAC headers
    const uacHeaderRegex = /2\.(\d+)\.\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+(?:I|II|III|IV|V|VI))\b/g;
    const matches = [];
    let match;
    while ((match = uacHeaderRegex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        num: parseInt(match[1], 10),
        name: match[2].trim()
      });
    }
    
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const nextIndex = matches[i + 1] ? matches[i + 1].index : text.length;
      const uacBlock = text.substring(current.index, nextIndex);
      
      const purposes = extractPurposes(uacBlock);
      console.log(`  ✓ UAC: ${current.name} -> Found ${purposes.length} Propósitos:`);
      purposes.forEach(p => {
        console.log(`    ${p.num}. ${p.content.substring(0, 100)}...`);
      });
    }
  }
}

run().catch(console.error);
