const fs = require('fs');
const zlib = require('zlib');

function getDocxTables(filePath) {
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

  const trMatches = xml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  return trMatches.map(tr => {
    const tcMatches = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
    return tcMatches.map(tc => tc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  });
}

const rows = getDocxTables('C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/Catalogo_Oficial_Asignaturas_Bachilleratos_Generales_2025-2026(Corregido).docx');
console.log('Total filas en Catalogo Oficial:', rows.length);
rows.slice(0, 25).forEach((r, idx) => console.log(`Fila ${idx}:`, r));
