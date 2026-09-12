const fs = require('fs');
const zlib = require('zlib');

function extractDocxStructure(filePath) {
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

  // Parse paragraphs and tables in order
  const elements = xml.match(/<w:p[\s\S]*?<\/w:p>|<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  console.log('Total elements (p/tbl):', elements.length);

  let currentSemester = '';
  let currentSubject = '';
  const subjects = [];

  elements.forEach((el, idx) => {
    if (el.startsWith('<w:p')) {
      const text = el.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.toUpperCase().includes('PRIMER SEMESTRE')) currentSemester = '1';
      else if (text.toUpperCase().includes('SEGUNDO SEMESTRE')) currentSemester = '2';
      else if (text.toUpperCase().includes('TERCER SEMESTRE')) currentSemester = '3';
      else if (text.toUpperCase().includes('CUARTO SEMESTRE')) currentSemester = '4';
      else if (text.toUpperCase().includes('QUINTO SEMESTRE')) currentSemester = '5';
      else if (text.toUpperCase().includes('SEXTO SEMESTRE')) currentSemester = '6';

      // Check if it looks like a subject header
      if (text.length > 3 && text.length < 80 && !text.includes('Propósitos') && !text.includes('Meta educativa') && !text.includes('Contenidos')) {
        // Potential subject
        if (text.includes('Lengua') || text.includes('Pensamiento') || text.includes('Ciencias') || text.includes('Materia') || 
            text.includes('Conservación') || text.includes('Digital') || text.includes('Humanidades') || text.includes('Inglés') || 
            text.includes('Conciencia') || text.includes('Historia') || text.includes('Filosof') || text.includes('Socioemocional') ||
            text.includes('Taller') || text.includes('Laboratorio') || text.includes('Artes') || text.includes('Educación')) {
          currentSubject = text;
        }
      }
    } else if (el.startsWith('<w:tbl')) {
      const trMatches = el.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
      const rows = trMatches.map(tr => {
        const tcMatches = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
        return tcMatches.map(tc => tc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      });
      subjects.push({
        semester: currentSemester,
        subjectGuess: currentSubject,
        rowsCount: rows.length,
        firstRow: rows[0],
        sampleRow: rows[1] || rows[0],
        allRows: rows
      });
    }
  });

  return subjects;
}

const subjects = extractDocxStructure('C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/ASIGNATURAS Y PROPOSITOS FORMATIVOS 1ER-2DO SEMESTRE.docx');
console.log('Total tables extracted:', subjects.length);
subjects.forEach((s, idx) => {
  console.log(`\n--- Tabla ${idx + 1} | Semestre: ${s.semester} | Materia: ${s.subjectGuess} (${s.rowsCount} filas) ---`);
  s.allRows.slice(0, 3).forEach(r => console.log('  ->', r.slice(0, 2)));
});
