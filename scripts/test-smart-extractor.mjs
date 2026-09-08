import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

// Read env
const envContent = readFileSync(join(__dir, '../.env.local'), 'utf-8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
});

const { callGeminiPool } = await import('../src/lib/gemini.ts');
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

const folder = 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[05] Proyectos_PAEC_y_PMC\\PAEC-PEC Zona004';
const testFiles = [
  'PAEC-PEC_2025-2026_21EBH0214Z_MECAPALAPA.pdf',
  'PAEC-PEC_2025-2026_21EBH0789L_DAVID ALFARO SIQUEIROS_JALTOCAN.pdf',
  'PAEC-PEC_2025-2026_21EBH0608L_EMILIANO ZAPATA.pdf',
];

// Smart page extraction function: scores pages based on PAEC diagnostic & problem indicators
async function extractSmartPaecText(pdfPath) {
  const buffer = readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    password: '',
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const totalPages = doc.numPages;
  const pagesData = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const pageText = tc.items.map(item => 'str' in item ? item.str : '').join(' ');
    
    // Score page relevance
    let score = 0;
    const lower = pageText.toLowerCase();
    
    // Always keep early pages (cover, index, early context)
    if (i <= 4) score += (5 - i) * 3;
    
    // High-priority problem & diagnosis markers
    if (/problem[aá]tica|problem[aá]ticas\s+o\s+necesidades/i.test(lower)) score += 20;
    if (/selecci[oó]n\s+del\s+problema|problema\s+central|problema\s+a\s+resolver/i.test(lower)) score += 20;
    if (/etapa\s+(uno|dos|tres)/i.test(lower)) score += 15;
    if (/diagn[oó]stico\s+(colectivo|comunitario)/i.test(lower)) score += 10;
    if (/foda|árbol\s+de\s+problemas/i.test(lower)) score += 8;
    if (/prop[oó]sito|objetivo\s+general|justificaci[oó]n/i.test(lower)) score += 8;
    if (/caracterizaci[oó]n\s+de\s+los\s+estudiantes|contexto\s+comunitario/i.test(lower)) score += 8;

    pagesData.push({ pageNum: i, text: pageText, score });
  }

  // Always include pages with high relevance or first 8 pages
  // Sort by pageNum to keep reading order
  const selectedPages = pagesData.filter(p => p.pageNum <= 8 || p.score >= 10);
  
  // Assemble text with page labels
  let assembled = '';
  for (const p of selectedPages) {
    assembled += `\n=== PÁGINA ${p.pageNum} ===\n${p.text}`;
  }

  // Cap at 45,000 characters (comfortable for Gemini while preserving all key pages)
  return assembled.slice(0, 45000);
}

for (const tf of testFiles) {
  const p = join(folder, tf);
  console.log(`\n======================================================`);
  console.log(`TESTING: ${tf}`);
  console.log(`======================================================`);
  
  const text = await extractSmartPaecText(p);
  console.log(`Extracted smart context length: ${text.length} chars`);

  const systemInstruction = `Eres un experto pedagógico en el Programa Aula, Escuela y Comunidad (PAEC) y el Proyecto Escolar Comunitario (PEC) de la Nueva Escuela Mexicana (NEM). Responde exclusivamente con un objeto JSON válido, sin markdown ni explicaciones adicionales.`;

  const prompt = `Analiza el siguiente texto extraído de un documento oficial de PAEC/PEC y extrae en formato JSON:

{
  "projectName": "Nombre o título oficial del Proyecto Escolar Comunitario (PEC)",
  "objective": "Objetivo general o propósito del proyecto",
  "problem": "Problemática comunitaria detectada que se abordará en el PEC",
  "studentContext": "Caracterización o contexto sociocultural y escolar de los estudiantes y el plantel",
  "isSuggestedProblem": false
}

DIRECTRICES:
1. "problem": Debe ser una descripción concreta y completa de la problemática o necesidad comunitaria a atender (por ejemplo: adicciones, hábitos alimenticios deficientes, falta de espacios deportivos, contaminación ambiental/basura, bajo aprovechamiento académico, falta de infraestructura techada, etc.).
2. NUNCA dejes "problem" vacío. Si el documento describe un reto comunitario o escolar en el diagnóstico o justificación, sintetízalo con fidelidad.
3. Solo si el documento NO contiene absolutamente ningún diagnóstico ni problema, redacta una problemática sugerida coherente con el nombre del proyecto y pon "isSuggestedProblem": true.

TEXTO DEL DOCUMENTO:
${text}`;

  try {
    const res = await callGeminiPool(systemInstruction, prompt);
    const clean = res.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(clean);
    console.log(`  Project Name: ${parsed.projectName}`);
    console.log(`  Problem: ${parsed.problem?.substring(0, 120)}...`);
    console.log(`  Objective: ${parsed.objective?.substring(0, 100)}...`);
    console.log(`  Is Suggested: ${parsed.isSuggestedProblem}`);
  } catch (err) {
    console.error(`  Error:`, err.message);
  }
}
