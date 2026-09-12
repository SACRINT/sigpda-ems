import { readFileSync } from 'fs';
import path from 'path';

// Cargar variables de entorno
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

async function test() {
  const { callGeminiPool } = await import('../src/lib/gemini.ts');
  console.log('Probando callGeminiPool con el pool institucional...');
  const res = await callGeminiPool(
    'Eres un asistente conciso.',
    'Responde únicamente con la palabra: CONECTADO'
  );
  console.log('Resultado de callGeminiPool:', res);
}

test().catch(err => {
  console.error('Error en test:', err);
});
