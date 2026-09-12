import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function extractPdfTextByPage(pdfPath) {
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

export function parseSubjectTablesFromPages(pages, defaultUacPrefix) {
  const results = [];
  
  // We look through pairs of pages in the table range (typically 12 to 26)
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const text = p.text;
    
    // Check if this page introduces a Table with "Tabla X. Propósitos y contenidos" or "Nombre de la asignatura"
    if (text.includes('Tabla') && (text.includes('Propósitos') || text.includes('contenidos formativos')) || text.includes('Nombre de la asignatura') || text.includes('Meta educativa')) {
      // Look ahead up to 2 pages to capture the full table
      let combined = text;
      if (i + 1 < pages.length) combined += '\n' + pages[i+1].text;
      if (i + 2 < pages.length && (pages[i+1].text.includes('Propósitos') || pages[i+2].text.includes('Fuente:'))) {
        combined += '\n' + pages[i+2].text;
      }

      // Extract subject name
      let uacName = '';
      const nameMatch = combined.match(/Nombre de la asignatura\s+([^M\n\r]+?)(?:Meta educativa|Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|\d+\s*horas)/i);
      if (nameMatch) {
        uacName = nameMatch[1].trim();
      }

      // Extract Meta educativa
      let meta = '';
      const metaMatch = combined.match(/Meta educativa\s+([\s\S]+?)(?:Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|Horas\/semana|Propósitos formativos|\d+\s*horas)/i);
      if (metaMatch) {
        meta = metaMatch[1].trim();
      }

      // Extract Semester
      let semester = 1;
      if (combined.match(/Primer semestre/i) || uacName.match(/\bI\b/) || uacName.includes(' I ')) semester = 1;
      if (combined.match(/Segundo semestre/i) || uacName.match(/\bII\b/) || uacName.includes(' II ')) semester = 2;
      if (combined.match(/Tercer semestre/i) || uacName.match(/\bIII\b/) || uacName.includes(' III ')) semester = 3;
      if (combined.match(/Cuarto semestre/i) || uacName.match(/\bIV\b/) || uacName.includes(' IV ')) semester = 4;
      if (combined.match(/Quinto semestre/i) || uacName.match(/\bV\b/) || uacName.includes(' V ')) semester = 5;
      if (combined.match(/Sexto semestre/i) || uacName.match(/\bVI\b/) || uacName.includes(' VI ')) semester = 6;

      // Extract Weekly Hours
      let weeklyHours = 4;
      const hoursMatch = combined.match(/Horas\/semana:\s*(\d+)/i) || combined.match(/(\d+)\s*horas\b/i);
      if (hoursMatch) weeklyHours = parseInt(hoursMatch[1]);

      // Extract Propositos and Contenidos
      // Format in PDF: "1   Reconoce la ciencia... Concepto de ciencia... 2   Comprende que..."
      const propRegex = /(\d+)\s+([A-ZÁÉÍÓÚ][^1-9\n]{15,400})/g;
      let pMatch;
      const activities = [];
      const contenidosFormatifs = [];

      // Find the substring where table starts
      const tableStartIdx = combined.indexOf('Propósitos formativos');
      const tableText = tableStartIdx !== -1 ? combined.slice(tableStartIdx) : combined;

      // Clean up text
      const cleanText = tableText
        .replace(/Fuente:\s*Elaborado por la COSFAC\./gi, '')
        .replace(/Propósitos formativos\s+Contenidos formativos/gi, '');

      // Match numbered purposes
      const parts = cleanText.split(/(?=\b\d{1,2}\s+[A-ZÁÉÍÓÚ])/g);
      parts.forEach(part => {
        const itemMatch = part.match(/^\s*(\d{1,2})\s+([A-ZÁÉÍÓÚ][\s\S]+)$/);
        if (itemMatch) {
          const order = parseInt(itemMatch[1]);
          const fullContent = itemMatch[2].trim();
          
          // Separate proposito from contenidos if possible, or store rich text
          // Usually proposito ends around the first dot or comma phrase before topic keywords
          const propName = fullContent.split('\n')[0].trim();
          const conts = fullContent.split('\n').slice(1).map(c => c.trim()).filter(c => c.length > 2);

          if (order > 0 && order < 20 && fullContent.length > 10) {
            activities.push({
              order: order,
              name: fullContent.slice(0, 300).trim(),
              hours: Math.round((weeklyHours * 18) / Math.max(1, parts.length))
            });

            contenidosFormatifs.push({
              order: order,
              proposito: fullContent.slice(0, 300).trim(),
              hours: Math.round((weeklyHours * 18) / Math.max(1, parts.length)),
              contenidos: conts.length > 0 ? conts : [fullContent.slice(0, 300).trim()]
            });
          }
        }
      });

      if (uacName || activities.length > 0) {
        results.push({
          page: p.pageNum,
          uacName: uacName || `${defaultUacPrefix} ${['I','II','III','IV','V','VI'][semester - 1]}`,
          semester,
          meta,
          weeklyHours,
          totalHours: weeklyHours * 18,
          activitiesCount: activities.length,
          activities,
          contenidosFormatifs
        });
      }
    }
  }

  return results;
}

async function run() {
  const dir = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf') && !f.includes('INFOGRAFIA'));

  for (const f of files) {
    const pages = await extractPdfTextByPage(path.join(dir, f));
    const parsed = parseSubjectTablesFromPages(pages, f.replace('2025_', '').replace('.pdf', '').trim());
    console.log(`\n=================== ${f} ===================`);
    console.log(`Extracted tables count: ${parsed.length}`);
    parsed.forEach(p => {
      console.log(`  -> Page ${p.page} | ${p.uacName} (Sem ${p.semester}, ${p.weeklyHours} hrs/sem = ${p.totalHours} hrs) | Meta: ${p.meta.substring(0, 50)}... | Propósitos: ${p.activitiesCount}`);
    });
  }
}

run().catch(console.error);
