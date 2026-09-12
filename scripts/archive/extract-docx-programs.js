const fs = require('fs');
const zlib = require('zlib');

function extractDocxTablesAndParagraphs(filePath) {
  const buffer = fs.readFileSync(filePath);
  let pos = 0;
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
        const xml = compMethod === 8 ? zlib.inflateRawSync(compData).toString('utf8') : compData.toString('utf8');
        return xml;
      }
      pos = dataStart + compSize;
    } else {
      pos++;
    }
  }
  return '';
}

const xml = extractDocxTablesAndParagraphs('C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/ASIGNATURAS Y PROPOSITOS FORMATIVOS 1ER-2DO SEMESTRE.docx');

// Simple XML parser to get table rows
const rows = [];
const trMatches = xml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
console.log('Total table rows found in docx:', trMatches.length);

trMatches.forEach((tr, i) => {
  const tcMatches = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
  const cells = tcMatches.map(tc => tc.replace(/<w:p[^>]*>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  if (cells.length >= 2) {
    rows.push(cells);
  }
});

console.log('Sample parsed rows (first 10):');
rows.slice(0, 10).forEach((r, idx) => console.log(`Row ${idx}:`, r));
