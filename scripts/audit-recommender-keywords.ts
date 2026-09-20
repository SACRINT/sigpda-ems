/**
 * Script de Auditoría Estática de Palabras Clave Cortas en REGLAS
 * SIGPDA-EMS · Prevención de Colisiones de Subcadenas y Falsos Positivos
 *
 * Comando de ejecución:
 * npx tsx scripts/audit-recommender-keywords.ts
 *
 * Regla de Calidad:
 * Ningún keyword con longitud < 4 caracteres puede operar sin delimitadores de espacio
 * (' keyword '), para evitar colisiones involuntarias con sufijos o raíces del español
 * (ejemplo crítico: 'ia' en 'Biología', 'Ecología', 'Hidalguía').
 */

import { REGLAS, recomendarMetodologia } from '../src/lib/recomendador-metodologia';

interface Violation {
  metodologiaId: string;
  keyword: string;
  trimmedLength: number;
  reason: string;
}

console.log('────────────────────────────────────────────────────────────────────────');
console.log('AUDITORÍA ESTÁTICA: PALABRAS CLAVE CORTAS EN REGLAS DE RECOMENDACIÓN');
console.log('────────────────────────────────────────────────────────────────────────');

let totalKeywords = 0;
let shortKeywordsCount = 0;
const shortKeywordsFound: { metodologiaId: string; keyword: string; length: number }[] = [];
const violations: Violation[] = [];

for (const regla of REGLAS) {
  if (!regla.keywordsUac) continue;

  for (const kw of regla.keywordsUac) {
    totalKeywords++;
    const trimmed = kw.trim();
    const len = trimmed.length;

    if (len < 4) {
      shortKeywordsCount++;
      shortKeywordsFound.push({
        metodologiaId: regla.metodologiaId,
        keyword: kw,
        length: len,
      });

      const isDelimited = kw.startsWith(' ') && kw.endsWith(' ');
      if (!isDelimited) {
        violations.push({
          metodologiaId: regla.metodologiaId,
          keyword: kw,
          trimmedLength: len,
          reason: `Keyword corto (${len} chars) sin delimitadores completos de palabra (' ${trimmed} ')`,
        });
      }
    }
  }
}

console.log(`\n• Total de reglas en REGLAS: ${REGLAS.length}`);
console.log(`• Total de palabras clave analizadas: ${totalKeywords}`);
console.log(`• Palabras clave cortas (< 4 caracteres) detectadas: ${shortKeywordsCount}`);

console.log('\nDetalle de palabras clave cortas verificadas:');
for (const item of shortKeywordsFound) {
  const status = item.keyword.startsWith(' ') && item.keyword.endsWith(' ') ? '✅ DELIMITADO' : '❌ SIN DELIMITAR';
  console.log(`  - [${item.metodologiaId}] "${item.keyword}" (longitud útil: ${item.length}) → ${status}`);
}

// ── Verificación de Comportamiento Funcional Canónico ─────────────────────────
console.log('\nVerificación funcional de casos canónicos:');
const testCases = [
  { uac: 'Biología General', component: 'fundamental', expected: 'indagacion' },
  { uac: 'La Materia y sus Interacciones', component: 'fundamental', expected: 'indagacion' },
  { uac: 'Inteligencia Artificial', component: 'fundamental', expected: 'abr' },
  { uac: 'Desarrollo Web', component: 'fundamental', expected: 'abr' },
  { uac: 'Programación de App Móvil', component: 'fundamental', expected: 'abr' },
  { uac: 'Pensamiento Matemático I', component: 'fundamental', expected: 'abproblemas' },
  { uac: 'Módulo Profesional Laboral', component: 'laboral', expected: 'practica_laboratorio' },
];

let functionalErrors = 0;
for (const tc of testCases) {
  const result = recomendarMetodologia(tc.uac, tc.component);
  const ok = result === tc.expected;
  if (!ok) functionalErrors++;
  console.log(`  ${ok ? '✅' : '❌'} "${tc.uac}" (${tc.component}) → ${result} [esperado: ${tc.expected}]`);
}

console.log('\n────────────────────────────────────────────────────────────────────────');

if (violations.length > 0 || functionalErrors > 0) {
  console.error(`\n❌ AUDITORÍA FALLIDA: ${violations.length} violaciones de palabras clave y ${functionalErrors} fallos funcionales.`);
  for (const v of violations) {
    console.error(`   - [${v.metodologiaId}] "${v.keyword}": ${v.reason}`);
  }
  process.exit(1);
} else {
  console.log('\n✅ AUDITORÍA EXITOSA: Todos los keywords < 4 caracteres operan con delimitadores seguros.');
  console.log('0 colisiones de subcadenas detectadas en REGLAS.');
  process.exit(0);
}
