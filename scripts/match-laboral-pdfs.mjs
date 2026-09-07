import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function extractPdfPages(pdfPath) {
  if (!fs.existsSync(pdfPath)) return [];
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

const progs = await sql`
  SELECT id, uac_name, semester, curriculum_name, component
  FROM programs_catalog 
  WHERE component = 'laboral' 
  ORDER BY semester, uac_name
`;

console.log(`Loaded ${progs.length} laboral UACs from DB.`);

const pdfDir = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2023 - 2026/Curriculum Laboral BGE 2023';
const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));

const pdfMap = {};

for (const f of pdfFiles) {
  const capName = f.replace('_2024.pdf', '').replace(/_/g, ' ');
  const pages = await extractPdfPages(path.join(pdfDir, f));
  const text = pages.map(p => p.text).join(' ').toLowerCase();
  pdfMap[capName] = { file: f, text };
  console.log(`Extracted PDF: ${capName}`);
}

// Function to normalize strings for comparison
function norm(str) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const results = [];
const unassigned = [];

for (const p of progs) {
  const uacNorm = norm(p.uac_name);
  // Try subsegments of 20-30 chars
  const sub = uacNorm.slice(0, 30);
  let matchedCap = null;
  
  for (const [capName, info] of Object.entries(pdfMap)) {
    const pdfNorm = norm(info.text);
    if (pdfNorm.includes(sub)) {
      matchedCap = capName;
      break;
    }
  }
  
  if (matchedCap) {
    results.push({ id: p.id, semester: p.semester, uac_name: p.uac_name, capacitacion: matchedCap });
  } else {
    unassigned.push(p);
  }
}

console.log(`\nMatched: ${results.length}, Unassigned: ${unassigned.length}`);

// Group by capacitacion and semester
const grouped = {};
for (const r of results) {
  if (!grouped[r.capacitacion]) grouped[r.capacitacion] = {};
  if (!grouped[r.capacitacion][`sem${r.semester}`]) grouped[r.capacitacion][`sem${r.semester}`] = [];
  grouped[r.capacitacion][`sem${r.semester}`].push(r.uac_name);
}

fs.writeFileSync('scripts/matched-laboral.json', JSON.stringify(grouped, null, 2), 'utf-8');
console.log('Saved to scripts/matched-laboral.json');

if (unassigned.length > 0) {
  console.log('\nUnassigned:');
  unassigned.forEach(u => console.log(`SEM ${u.semester}: ${u.uac_name}`));
}
