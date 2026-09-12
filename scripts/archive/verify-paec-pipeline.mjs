import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

// Load env
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

const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { callGeminiPool } = await import('../src/lib/gemini.ts');

const testPdfs = [
  {
    name: 'HÉROES DE LA PATRIA (El archivo del usuario)',
    path: 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[05] Proyectos_PAEC_y_PMC\\PAEC-PEC_2025-2026_21EBH0200X_HÉROES DE LA PATRIA(1er y 2do SEM).pdf',
  },
  {
    name: 'MECAPALAPA (38 páginas)',
    path: 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[05] Proyectos_PAEC_y_PMC\\PAEC-PEC Zona004\\PAEC-PEC_2025-2026_21EBH0214Z_MECAPALAPA.pdf',
  },
  {
    name: 'DAVID ALFARO SIQUEIROS - JALTOCAN (14 páginas)',
    path: 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[05] Proyectos_PAEC_y_PMC\\PAEC-PEC Zona004\\PAEC-PEC_2025-2026_21EBH0789L_DAVID ALFARO SIQUEIROS_JALTOCAN.pdf',
  },
  {
    name: 'EMILIANO ZAPATA (25 páginas)',
    path: 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[05] Proyectos_PAEC_y_PMC\\PAEC-PEC Zona004\\PAEC-PEC_2025-2026_21EBH0608L_EMILIANO ZAPATA.pdf',
  },
];

// Extractor function matching route.ts exactly
async function extractSmartPaecText(buffer) {
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    password: '',
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const totalPages = Math.min(doc.numPages, 45);
  const pagesData = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    
    let score = 0;
    const lower = pageText.toLowerCase();

    // 1. "problemática" / "necesidades de la comunidad" → +10
    if (/problem[aá]tica|necesidades\s+de\s+la\s+comunidad/i.test(lower)) score += 10;

    // 2. "selección del problema" / "problema central" → +10
    if (/selecci[oó]n\s+del\s+problema|problema\s+central/i.test(lower)) score += 10;

    // 3. "etapa" + ("recuperación" | "análisis" | "selección") → +8
    if (/etapa\s*[:\-\s\w]*(?:recuperaci[oó]n|an[aá]lisis|selecci[oó]n)/i.test(lower)) score += 8;

    // 4. "diagnóstico" / "árbol de problemas" / "FODA" → +6
    if (/diagn[oó]stico|[aá]rbol\s+de\s+problemas|foda/i.test(lower)) score += 6;

    // 5. "justificación" / "propósito" / "objetivo general" → +4
    if (/justificaci[oó]n|prop[oó]sito|objetivo\s+general/i.test(lower)) score += 4;

    // 6. "caracterización" / "contexto" / "estudiantes" → +2
    if (/caracterizaci[oó]n|contexto|estudiantes/i.test(lower)) score += 2;

    pagesData.push({ pageNum: i, text: pageText, score });
  }

  const selectedPages = pagesData.filter(p => p.pageNum <= 3 || p.score >= 6);
  const candidatePages = selectedPages.length > 3 ? selectedPages : pagesData.slice(0, Math.min(pagesData.length, 8));
  candidatePages.sort((a, b) => a.pageNum - b.pageNum);

  let assembled = '';
  const MAX_CHARS = 40000;

  for (const p of candidatePages) {
    const pageBlock = `\n=== PÁGINA ${p.pageNum} ===\n${p.text}\n`;
    if ((assembled.length + pageBlock.length) > MAX_CHARS) {
      const remaining = MAX_CHARS - assembled.length;
      if (remaining > 500) {
        assembled += pageBlock.slice(0, remaining);
      }
      break;
    }
    assembled += pageBlock;
  }

  return { text: assembled.trim(), pagesSelected: candidatePages.map(p => p.pageNum) };
}

async function structurePaecWithGemini(smartText) {
  const systemInstruction = `Eres un experto pedagógico en el Programa Aula, Escuela y Comunidad (PAEC) y el Proyecto Escolar Comunitario (PEC) de la Nueva Escuela Mexicana (NEM) en la Educación Media Superior (Puebla, México). Tu tarea es analizar con máxima fidelidad los diagnósticos, problemas y contextos del proyecto. Responde exclusivamente con un objeto JSON válido, sin markdown ni explicaciones adicionales.`;

  const prompt = `Analiza el siguiente texto de un documento oficial PAEC/PEC de un bachillerato y extrae en formato JSON:

{
  "projectName": "Nombre o título oficial del Proyecto Escolar Comunitario (PEC)",
  "objective": "Objetivo general, propósito formativo o meta del proyecto",
  "problem": "Problemática comunitaria detectada que se abordará en el PEC",
  "studentContext": "Caracterización o contexto sociocultural y escolar de los estudiantes y el plantel"
}

INSTRUCCIONES CRÍTICAS PARA LA EXTRACCIÓN:
1. "problem": Busca EXPLÍCITAMENTE la sección titulada "Problemáticas o necesidades de la comunidad", "Selección del problema para el PEC", "Problema central", "Problemática detectada" o tablas de diagnóstico por etapas (Etapa uno: Recuperación de información, Etapa dos: Sistematización y análisis FODA, Etapa tres: Selección del problema). Extrae la Etapa 3 (o la síntesis consolidada de las etapas) detallando la problemática comunitaria concreta (por ejemplo: adicciones, alcoholismo, hábitos alimenticios deficientes, falta de espacios deportivos, contaminación/basura, bajo aprovechamiento académico, falta de infraestructura techada, etc.). Debe ser un texto descriptivo, claro y suficiente (2-4 oraciones) para guiar la planeación didáctica.
2. "projectName": Título del PEC (ej: "Comunidad Resiliente: Vida Saludable...", "EcoBachiller Recicla...", etc.).
3. "objective": Propósito o meta formativa del proyecto comunitario.
4. "studentContext": Ubicación del plantel, características de la localidad, entorno socioeconómico y características de los alumnos.
5. Si no encuentras algún campo con certeza absoluta, asigna null.

TEXTO DEL DOCUMENTO:
${smartText}`;

  const rawJsonText = await callGeminiPool(systemInstruction, prompt);
  const cleanJson = rawJsonText
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  return JSON.parse(cleanJson);
}

console.log('=== INICIANDO PRUEBAS DE VERIFICACIÓN MULTI-DOCUMENTO ===\n');

for (const item of testPdfs) {
  console.log(`------------------------------------------------------------`);
  console.log(`PROBANDO: ${item.name}`);
  console.log(`------------------------------------------------------------`);
  
  const buffer = readFileSync(item.path);
  const { text, pagesSelected } = await extractSmartPaecText(buffer);
  
  console.log(`  Páginas seleccionadas: [${pagesSelected.join(', ')}]`);
  console.log(`  Longitud del texto inteligente: ${text.length} caracteres (límite: 40,000)`);
  
  const start = Date.now();
  const res = await structurePaecWithGemini(text);
  const duration = ((Date.now() - start) / 1000).toFixed(1);
  
  console.log(`  Tiempo de extracción: ${duration}s`);
  console.log(`  NOMBRE PROYECTO: "${res.projectName}"`);
  console.log(`  OBJETIVO: "${res.objective?.substring(0, 90)}..."`);
  console.log(`  PROBLEMÁTICA DETECTADA:`);
  console.log(`    "${res.problem}"`);
  console.log(`  CONTEXTO ESTUDIANTIL: "${res.studentContext?.substring(0, 90)}..."`);
  console.log(`  ¿PROBLEMÁTICA VÁLIDA?: ${Boolean(res.problem && res.problem.length > 30) ? '✅ SÍ (EXITOSA)' : '❌ NO'}`);
  console.log();
}
