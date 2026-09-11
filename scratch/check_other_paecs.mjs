import fs from 'fs';
import path from 'path';

async function checkOtherPaecs() {
  const dir = 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[05] Proyectos_PAEC_y_PMC\\PAEC-PEC Zona004';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf') && !f.startsWith('4 '));
  
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'file:///' + workerPath.replace(/\\/g, '/');

  console.log(`Checking ${files.length} other PAEC PDFs...`);

  for (const f of files.slice(0, 8)) {
    try {
      const fullPath = path.join(dir, f);
      const buffer = fs.readFileSync(fullPath);
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
      let foundPlanOp = false;
      let matchedTerms = [];

      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const text = (await page.getTextContent()).items.map(it => 'str' in it ? it.str : '').join(' ');
        if (/plan\s+operativo/i.test(text)) {
          foundPlanOp = true;
          matchedTerms.push(`p.${p}: "Plan Operativo"`);
        } else if (/cronograma/i.test(text) && /asignatura/i.test(text)) {
          matchedTerms.push(`p.${p}: "Cronograma + Asignatura"`);
        }
      }
      console.log(`File: ${f} -> Plan Operativo: ${foundPlanOp ? 'YES' : 'NO'} (${matchedTerms.join(', ') || 'none'})`);
    } catch (e) {
      console.log(`File: ${f} -> Error reading: ${e.message}`);
    }
  }
}

checkOtherPaecs().catch(console.error);
