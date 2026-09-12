import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    }
  });
}

const sql = neon(process.env.DATABASE_URL);

// 1. Helper to extract DOCX tables
function extractDocxTables(filePath) {
  const buffer = fs.readFileSync(filePath);
  let pos = 0;
  let xml = '';
  while (pos < buffer.length - 30) {
    if (buffer[pos] === 0x50 && buffer[pos+1] === 0x4B && buffer[pos+2] === 0x03 && buffer[pos+3] === 0x04) {
      const fnLen = buffer.readUInt16LE(pos + 26);
      const extraLen = buffer.readUInt16LE(pos + 28);
      const compSize = buffer.readUInt32LE(pos + 18);
      const compMethod = buffer.readUInt16LE(pos + 8);
      const fn = buffer.toString('utf8', pos + 30, pos + 30 + fnLen);
      const dataStart = pos + 30 + fnLen + extraLen;
      if (fn === 'word/document.xml') {
        const compData = buffer.subarray(dataStart, dataStart + compSize);
        xml = compMethod === 8 ? zlib.inflateRawSync(compData).toString('utf8') : compData.toString('utf8');
        break;
      }
      pos = dataStart + compSize;
    } else {
      pos++;
    }
  }

  const items = [];
  const regex = /<w:p[\s\S]*?<\/w:p>|<w:tbl[\s\S]*?<\/w:tbl>/g;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const raw = m[0];
    if (raw.startsWith('<w:p')) {
      const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) items.push({ type: 'p', text });
    } else {
      const trs = raw.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
      const rows = trs.map(tr => {
        const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
        return tcs.map(tc => tc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      });
      items.push({ type: 'tbl', rows });
    }
  }
  return items;
}

// 2. Helper to extract PDF text by pages
async function extractPdfPages(pdfPath) {
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

async function main() {
  console.log('🚀 Iniciando análisis exhaustivo de programas oficiales y catálogo...');

  // Map to store authentic UAC data keyed by normalized subject name + semester
  const authenticUACs = new Map();

  // A. Extract from ASIGNATURAS Y PROPOSITOS FORMATIVOS 1ER-2DO SEMESTRE.docx
  const docx1Path = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/ASIGNATURAS Y PROPOSITOS FORMATIVOS 1ER-2DO SEMESTRE.docx';
  if (fs.existsSync(docx1Path)) {
    console.log('📖 Procesando ASIGNATURAS Y PROPOSITOS FORMATIVOS 1ER-2DO SEMESTRE.docx...');
    const items = extractDocxTables(docx1Path);
    let currentSem = 1;
    let lastHeaders = [];

    items.forEach(it => {
      if (it.type === 'p') {
        if (it.text.toUpperCase().includes('PRIMER SEMESTRE')) currentSem = 1;
        else if (it.text.toUpperCase().includes('SEGUNDO SEMESTRE')) currentSem = 2;
        else {
          lastHeaders.push(it.text);
          if (lastHeaders.length > 5) lastHeaders.shift();
        }
      } else if (it.type === 'tbl') {
        const headerText = lastHeaders.join(' ');
        let uacName = '';
        if (headerText.includes('La Materia y sus Interacciones') || headerText.includes('Ciencias Naturales, Experimentales y Tecnología (')) uacName = 'La Materia y sus Interacciones';
        else if (headerText.includes('Pensamiento Matemático I')) uacName = 'Pensamiento Matemático I';
        else if (headerText.includes('Humanidades I') || headerText.includes('Pensamiento Filosófico y Humanidades')) uacName = 'Humanidades I';
        else if (headerText.includes('Lenguaje y Comunicación I') || headerText.includes('Lengua y Comunicación I')) uacName = 'Lengua y Comunicación I';
        else if (headerText.includes('Inglés I')) uacName = 'Inglés I';
        else if (headerText.includes('Cultura Digital I')) uacName = 'Cultura Digital I';
        else if (headerText.includes('Laboratorio de Investigación')) uacName = 'Laboratorio de Investigación';
        else if (headerText.includes('Ciencias Sociales I')) uacName = 'Ciencias Sociales I';
        else if (headerText.includes('Actividades Artísticas y Culturales I') && currentSem === 1) uacName = 'Actividades Artísticas y Culturales I';
        else if (headerText.includes('Actividades Físicas y Deportivas I') && currentSem === 1) uacName = 'Actividades Físicas y Deportivas I';
        else if (headerText.includes('Conservación de la Energía') || headerText.includes('Ciencias Naturales, Experimentales y Tecnología II')) uacName = 'Conservación de la Energía y sus Interacciones con la Materia';
        else if (headerText.includes('Pensamiento Matemático II')) uacName = 'Pensamiento Matemático II';
        else if (headerText.includes('Humanidades II') || headerText.includes('Pensamiento Filosófico y Humanidades I (El ejercicio')) uacName = 'Humanidades II';
        else if (headerText.includes('Lenguaje y Comunicación II') || headerText.includes('Lengua y Comunicación II')) uacName = 'Lengua y Comunicación II';
        else if (headerText.includes('Inglés II')) uacName = 'Inglés II';
        else if (headerText.includes('Cultura Digital II')) uacName = 'Cultura Digital II';
        else if (headerText.includes('Ciencias Sociales II')) uacName = 'Ciencias Sociales II';
        else if (headerText.includes('Taller de Ciencias I') || headerText.includes('La transferencia de energía es capaz')) uacName = 'Taller de Ciencias I';
        else if (headerText.includes('Actividades Artísticas y Culturales') && currentSem === 2) uacName = 'Actividades Artísticas y Culturales II';
        else if (headerText.includes('Actividades Físicas y Deportivas') && currentSem === 2) uacName = 'Actividades Físicas y Deportivas II';

        if (uacName) {
          let meta = '';
          const activities = [];
          const contenidosFormatifs = [];

          it.rows.forEach((row, rIdx) => {
            if (row.length >= 2) {
              const col0 = row[0].trim();
              const col1 = row[1].trim();

              if (col0.toLowerCase().includes('meta educativa')) {
                meta = col1;
              } else if (col0.match(/^\d+/)) {
                const match = col0.match(/^(\d+)\s*(.*)$/);
                const order = match ? parseInt(match[1]) : activities.length + 1;
                const propText = match ? match[2].trim() : col0;

                // Split contents by common delimiters or keep as bullet list
                let conts = col1.split(/(?=[A-ZÁÉÍÓÚ][a-záéíóú]|•|-|\n)/).map(c => c.trim()).filter(c => c.length > 2);
                if (conts.length === 0 && col1) conts = [col1];

                activities.push({
                  name: propText,
                  order: order,
                  hours: Math.round(72 / Math.max(1, it.rows.length - 2)) // initial estimation, will normalize with total_hours
                });

                contenidosFormatifs.push({
                  order: order,
                  proposito: propText,
                  hours: Math.round(72 / Math.max(1, it.rows.length - 2)),
                  contenidos: conts
                });
              }
            }
          });

          if (activities.length > 0) {
            const key = `${uacName.toLowerCase()}_sem${currentSem}`;
            authenticUACs.set(key, {
              uac_name: uacName,
              semester: currentSem,
              learning_outcome: meta || `Meta educativa oficial para ${uacName}`,
              activities,
              contenidos_formativos: contenidosFormatifs,
              source: 'ASIGNATURAS Y PROPOSITOS FORMATIVOS DOCX'
            });
            console.log(`  ✓ Extraída del DOCX: ${uacName} (Sem ${currentSem}) -> ${activities.length} propósitos, meta: ${meta.substring(0, 60)}...`);
          }
        }
        lastHeaders = [];
      }
    });
  }

  console.log(`\nTotal UACs extraídas de DOCX: ${authenticUACs.size}`);
}

main().catch(console.error);
