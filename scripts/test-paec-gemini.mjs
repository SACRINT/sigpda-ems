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
const pdfPath = 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[05] Proyectos_PAEC_y_PMC\\PAEC-PEC_2025-2026_21EBH0200X_HÉROES DE LA PATRIA(1er y 2do SEM).pdf';

const buffer = readFileSync(pdfPath);
const doc = await pdfjsLib.getDocument({
  data: new Uint8Array(buffer),
  password: '',
  useSystemFonts: false,
  disableFontFace: true,
  verbosity: 0,
}).promise;

console.log(`PDF Loaded. Total pages: ${doc.numPages}`);

let fullText = '';
const maxPages = Math.min(doc.numPages, 15);
for (let i = 1; i <= maxPages; i++) {
  const page = await doc.getPage(i);
  const tc = await page.getTextContent();
  const pageText = tc.items.map(item => 'str' in item ? item.str : '').join(' ');
  fullText += `\n=== PÁGINA ${i} ===\n` + pageText;
}

console.log(`Extracted text from ${maxPages} pages. Length: ${fullText.length} chars.`);

// Check if page 6 is in fullText
console.log('Contains Problemáticas o necesidades:', fullText.includes('Problemáticas o necesidades'));

const systemInstruction = `Eres un experto pedagógico en el Programa Aula, Escuela y Comunidad (PAEC) y el Proyecto Escolar Comunitario (PEC) de la Nueva Escuela Mexicana (NEM) en Bachilleratos de México. Responde exclusivamente con un objeto JSON válido, sin markdown ni explicaciones adicionales.`;

const prompt = `Analiza el siguiente texto extraído de un documento oficial de PAEC/PEC de un bachillerato y extrae con precisión la información para la planeación didáctica:

{
  "projectName": "Nombre o título oficial del Proyecto Escolar Comunitario (PEC)",
  "objective": "Objetivo general, propósito o meta del proyecto PAEC/PEC",
  "problem": "Problemática comunitaria detectada que se atenderá. Extrae la descripción concreta del problema identificado en el diagnóstico (salud, medio ambiente, adicciones, hábitos alimenticios, violencia, falta de espacios, rendimiento, etc.). Debe ser una descripción rica, clara y suficiente para guiar la planeación didáctica.",
  "studentContext": "Caracterización o contexto sociocultural y escolar de los estudiantes y el plantel (ubicación, entorno rural/urbano, condiciones socioeconómicas, recursos disponibles)."
}

DIRECTRICES PARA LA EXTRACCIÓN:
1. "problem": Busca en las secciones tituladas "Problemáticas o necesidades de la comunidad", "Selección del problema", "Problemática detectada", "Problema central", "Diagnóstico comunitario" o "Etapa uno/dos/tres". Si hay una tabla de etapas de problemas, sintetiza las preocupaciones clave detectadas (por ejemplo: falta de espacios, hábitos alimenticios deficientes, conductas de riesgo como alcohol o adicciones) en un párrafo sólido y descriptivo.
2. NUNCA dejes "problem" vacío si en el texto se describe alguna necesidad, carencia o reto de la comunidad o los estudiantes.
3. Si y solo si el documento NO contiene absolutamente ninguna mención a problemáticas ni necesidades, redacta una problemática pertinente coherente con el nombre del proyecto y los estudiantes.

TEXTO DEL DOCUMENTO:
${fullText.slice(0, 30000)}`;

console.log('Calling Gemini...');
try {
  const res = await callGeminiPool(systemInstruction, prompt);
  console.log('\n--- GEMINI RESPONSE ---');
  console.log(res);
} catch (e) {
  console.error('Gemini call error:', e);
}
