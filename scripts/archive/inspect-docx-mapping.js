const fs = require('fs');
const zlib = require('zlib');

function getDocxParagraphsAndTables(filePath) {
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

const items = getDocxParagraphsAndTables('C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio/ASIGNATURAS Y PROPOSITOS FORMATIVOS 1ER-2DO SEMESTRE.docx');

let sem = '1';
let lastHeaders = [];
items.forEach((it, i) => {
  if (it.type === 'p') {
    if (it.text.includes('SEMESTRE')) {
      sem = it.text;
      console.log('\n================== ' + sem + ' ==================');
    } else {
      lastHeaders.push(it.text);
      if (lastHeaders.length > 5) lastHeaders.shift();
    }
  } else if (it.type === 'tbl') {
    console.log(`\n[TABLA] Headers previos:`, lastHeaders.slice(-3).join(' | '));
    console.log(`Filas: ${it.rows.length}`);
    if (it.rows[1]) console.log(`Meta/Fila 1:`, it.rows[1]);
    lastHeaders = [];
  }
});
