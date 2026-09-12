import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const envText = fs.readFileSync(envLocalPath, 'utf-8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

const DB_URL = process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!DB_URL) {
  console.error('❌ DATABASE_URL is not defined in env.local');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not defined in env.local');
  process.exit(1);
}

const sql = neon(DB_URL);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const BASE_DIRS = [
  { path: 'c:/Secuencias_Didacticas/Curriculum Fundamental', component: 'fundamental' },
  { path: 'c:/Secuencias_Didacticas/Curriculum Ampliado', component: 'ampliado' }
];

async function extractPagesText(pdfPath, startPage, endPage) {
  try {
    const buffer = fs.readFileSync(pdfPath);
    const uint8Array = new Uint8Array(buffer);
    const doc = await pdfjsLib.getDocument({
      data: uint8Array,
      password: '',
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0,
    }).promise;

    let text = '';
    const actualEndPage = Math.min(doc.numPages, endPage);
    const actualStartPage = Math.max(1, Math.min(startPage, actualEndPage));
    
    for (let i = actualStartPage; i <= actualEndPage; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => ('str' in item ? item.str : '')).join(' ');
      text += `=== PAGINA ${i} ===\n${pageText}\n\n`;
    }
    return { text, numPages: doc.numPages };
  } catch (err) {
    console.error(`Error reading pages ${startPage}-${endPage} from ${pdfPath}:`, err.message);
    return null;
  }
}

async function generateWithRetry(model, prompt, maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await model.generateContent(prompt);
      return response.response.text();
    } catch (err) {
      attempt++;
      const isRateLimit = err.message.includes('429') || err.message.includes('Quota exceeded') || err.message.includes('503') || err.message.includes('high demand');
      if (isRateLimit && attempt < maxRetries) {
        console.warn(`  ⚠️ Rate limit detectado (Intento ${attempt}/${maxRetries}). Durmiendo 45 segundos para resetear cuota...`);
        await new Promise(r => setTimeout(r, 45000));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Número máximo de reintentos alcanzado.');
}

async function main() {
  console.log('🚀 Iniciando extracción masiva por PDF (una sola llamada por plan de estudios)...');

  // 1. Obtener la lista de PDFs disponibles
  const pdfs = [];
  for (const dir of BASE_DIRS) {
    if (!fs.existsSync(dir.path)) continue;
    const files = fs.readdirSync(dir.path);
    for (const f of files) {
      if (f.toLowerCase().endsWith('.pdf') && !f.toUpperCase().includes('INFOGRAFIA')) {
        pdfs.push({
          fullPath: path.join(dir.path, f),
          filename: f,
          component: dir.component
        });
      }
    }
  }
  console.log(`Encontrados ${pdfs.length} PDFs de planes de estudio en disco.`);

  for (const pdf of pdfs) {
    console.log(`\n────────────────────────────────────────────────────────────────`);
    console.log(`📄 Procesando PDF: "${pdf.filename}" (${pdf.component})`);

    // Leer páginas de la 10 a la 40 para capturar todas las tablas de UACs de todos los semestres de este plan
    const extract = await extractPagesText(pdf.fullPath, 10, 42);
    if (!extract) {
      console.error(`❌ Error al extraer texto de ${pdf.filename}`);
      continue;
    }

    const prompt = `Analiza el siguiente texto de un plan y programa de estudios. Este documento contiene los contenidos y propósitos formativos oficiales de múltiples semestres o asignaturas (UACs) del mismo campo de conocimiento.

Extrae para CADA Unidad de Aprendizaje Curricular (UAC) que se mencione en el documento (ej: "Pensamiento Matemático I", "Pensamiento Matemático II", "Cultura Digital I", "Cultura Digital II", "Ciencias Sociales I", etc.):
1. El nombre completo de la UAC.
2. La lista de sus Propósitos Formativos verbatim.
3. Para cada Propósito Formativo, la lista verbatim de todos sus Contenidos Formativos (temas o conceptos clave asociados).

Responde ÚNICAMENTE con un objeto JSON con el siguiente formato exacto, sin markdown ni explicaciones adicionales:
{
  "Nombre exacto de la UAC 1 (ej: Pensamiento Matemático I)": [
    {
      "proposito": "Nombre literal verbatim del Propósito Formativo 1",
      "hours": 11,
      "order": 1,
      "contenidos": [
        "Tema o contenido formativo A",
        "Tema o contenido formativo B"
      ]
    }
  ],
  "Nombre de la UAC 2 (ej: Pensamiento Matemático II)": [
    ...
  ]
}

REGLAS DE ORO:
- IDENTIFICACIÓN DE PROPÓSITOS: Los propósitos formativos verdaderos siempre empiezan con un número indicativo (ej: "1 Aplica conceptos...", "2 Comprende el...", etc.) en las tablas. Ignora títulos generales de tablas.
- COPIA VERBATIM: Tanto el "proposito" como los "contenidos" individuales deben ser copiados EXACTAMENTE palabra por palabra, sin resumir ni parafrasear.
- Si no hay contenidos formativos explícitos para un propósito, deja el arreglo de "contenidos" vacío para ese elemento.

TEXTO DEL PROGRAMA:
${extract.text.slice(0, 24000)}`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    try {
      console.log('  🧠 Analizando con Gemini...');
      const responseText = await generateWithRetry(model, prompt);
      const cleanJson = responseText
        .replace(/^```(?:json)?\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim();

      const parsedData = JSON.parse(cleanJson);
      const keys = Object.keys(parsedData);
      console.log(`  ✓ Extraídas ${keys.length} UACs del plan: [${keys.join(', ')}]`);

      for (const uacKey of keys) {
        const uacData = parsedData[uacKey];
        if (!Array.isArray(uacData)) continue;

        // Filtrar elementos vacíos o inválidos
        const validData = uacData.filter(item => 
          item.proposito && 
          !item.proposito.toLowerCase().includes('tabla') &&
          item.proposito.trim().length > 12
        );

        if (validData.length === 0) continue;

        // Mapear a actividades
        const activities = validData.map((item, idx) => ({
          name: item.proposito,
          hours: item.hours || Math.round(72 / validData.length),
          order: item.order || (idx + 1)
        }));

        // Buscar correspondencia en la BD (coincidencia aproximada o exacta de nombre)
        const matchDb = await sql`
          SELECT id, uac_name 
          FROM programs_catalog
          WHERE uac_name ILIKE ${uacKey} OR uac_name ILIKE ${uacKey.replace(/( I| II| III| IV| V| VI)$/i, '') + '%'}
          LIMIT 1
        `;

        if (matchDb.length > 0) {
          const dbUac = matchDb[0];
          await sql`
            UPDATE programs_catalog
            SET
              activities = ${JSON.stringify(activities)},
              contenidos_formativos = ${JSON.stringify(validData)}
            WHERE id = ${dbUac.id}::uuid
          `;
          console.log(`  💾 BD actualizada con éxito para UAC: "${dbUac.uac_name}" (desde clave "${uacKey}")`);
        } else {
          console.log(`  ⚠️ No se encontró UAC correspondiente en la BD para la clave: "${uacKey}"`);
        }
      }

    } catch (err) {
      console.error(`  ❌ Error al procesar PDF "${pdf.filename}":`, err.message);
    }

    // Esperar 12 segundos entre PDFs para evitar saturación de RPM
    await new Promise(r => setTimeout(r, 12000));
  }

  console.log('\n🎉 ¡Proceso de migración y siembra masiva por PDF completado!');
}

main().catch(err => {
  console.error('Global script crash:', err);
});
