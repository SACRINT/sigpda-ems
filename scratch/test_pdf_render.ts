import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      const key = m[1];
      let val = m[2] || '';
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { getBlockWorkbook, getPlanningById } from '../src/lib/db';
import { renderWorkbookToPdf } from '../src/lib/pdf-workbook-renderer';

async function main() {
  const planningId = '6764fc5e-d1ce-4ff1-96fe-5d88885260ee';
  const rawPlanning = await getPlanningById(planningId);
  if (!rawPlanning) throw new Error('Planning not found');
  const workbook = await getBlockWorkbook(planningId, 0);
  if (!workbook) throw new Error('Workbook not found');

  const pdfBuf = await renderWorkbookToPdf(workbook, rawPlanning as any);
  const outPath = path.resolve(__dirname, 'test_workbook_b1_fixed.pdf');
  fs.writeFileSync(outPath, pdfBuf);
  console.log('PDF generated successfully!');
  console.log('File size:', pdfBuf.length, 'bytes');

  // Let's count pages using pdf-parse or regex
  const str = pdfBuf.toString('binary');
  const matches = str.match(/\/Type\s*\/Page\b/g);
  console.log('Estimated pages count:', matches ? matches.length : 'unknown');
}
main().catch(console.error);
