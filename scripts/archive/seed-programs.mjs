import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env.local manually
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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DB_URL) {
  console.error('❌ DATABASE_URL is not defined in env.local');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY is not defined in env.local');
  process.exit(1);
}

const sql = neon(DB_URL);

// Base directories
const BASE_DIRS = [
  { path: 'c:/Secuencias_Didacticas/Curriculum Laboral BGE 2023', component: 'laboral' },
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
      const pageText = content.items.map(item => item.str || '').join(' ');
      text += `=== PAGE ${i} ===\n${pageText}\n\n`;
    }
    return { text, numPages: doc.numPages };
  } catch (err) {
    console.error(`Error reading pages ${startPage}-${endPage} from ${pdfPath}:`, err.message);
    return null;
  }
}

async function callClaude(prompt, maxTokens = 1500) {
  try {
    // Dynamic import to support ESM
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');
    return content.text;
  } catch (err) {
    console.error('Claude API call failed:', err.message);
    throw err;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function seed() {
  console.log('🚀 Starting Program Catalog Seeding...');
  
  // Find all PDF files
  const pdfFiles = [];
  for (const dirInfo of BASE_DIRS) {
    if (!fs.existsSync(dirInfo.path)) {
      console.warn(`⚠️ Directory does not exist: ${dirInfo.path}`);
      continue;
    }
    const files = fs.readdirSync(dirInfo.path);
    for (const file of files) {
      if (file.toLowerCase().endsWith('.pdf') && !file.toUpperCase().includes('INFOGRAFIA')) {
        // Skip PAEC guidelines in ampliado
        if (dirInfo.component === 'ampliado' && file.toUpperCase().includes('PAEC')) {
          continue;
        }
        pdfFiles.push({
          fullPath: path.join(dirInfo.path, file),
          filename: file,
          component: dirInfo.component
        });
      }
    }
  }

  console.log(`Found ${pdfFiles.length} program PDFs to parse.`);

  for (const pdf of pdfFiles) {
    console.log(`\n────────────────────────────────────────────────────────────────`);
    console.log(`📄 Processing PDF: ${pdf.filename} (${pdf.component})`);
    
    // Step 1: Extract first 12 pages to find UAC list
    const indexResult = await extractPagesText(pdf.fullPath, 1, 12);
    if (!indexResult) {
      console.error(`❌ Could not load pages 1-12 of ${pdf.filename}`);
      continue;
    }

    const indexPrompt = `Analiza el texto de las primeras páginas de este programa de estudios y extrae una lista en formato JSON de todas las Unidades de Aprendizaje Curricular (UAC) que contiene este plan.
    
    Responde ÚNICAMENTE con un arreglo JSON como el siguiente, sin texto adicional y sin markdown:
    [
      {
        "uacNumber": 1,
        "semester": 3,
        "startPage": 21,
        "suggestedTitle": "Nombre o tema de la UAC"
      }
    ]

    Reglas:
    - En el componente laboral usualmente hay 2 UACs por semestre de 3er a 6to semestre (e.g. UAC 1 Tercer Semestre, UAC 2 Tercer Semestre, etc.).
    - En el componente fundamental/ampliado hay 1 UAC por semestre (e.g. Pensamiento Matemático I para 1er semestre, Pensamiento Matemático II para 2do semestre, etc.).
    - Identifica la página de inicio (startPage) según el índice o el contenido del PDF.
    - Si no encuentras la página exacta de inicio, estima su posición.
    
    TEXTO DEL PDF (PÁGINAS 1 A 12):
    ${indexResult.text}`;

    console.log(`  🔍 Querying Claude for UAC list in ${pdf.filename}...`);
    let uacListJson;
    try {
      const responseText = await callClaude(indexPrompt);
      const cleanJson = responseText
        .replace(/^```(?:json)?\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim();
      uacListJson = JSON.parse(cleanJson);
    } catch (err) {
      console.error(`  ❌ Failed to parse UAC list for ${pdf.filename}:`, err.message);
      continue;
    }

    console.log(`  ✅ Found ${uacListJson.length} UACs in index.`);
    console.log(JSON.stringify(uacListJson, null, 2));

    // Step 2: For each UAC, extract its text chunk and get detailed structure
    for (let i = 0; i < uacListJson.length; i++) {
      const uac = uacListJson[i];
      const startPage = uac.startPage;
      const nextUacStart = uacListJson[i + 1] ? uacListJson[i + 1].startPage : indexResult.numPages;
      const endPage = Math.min(nextUacStart - 1, startPage + 15); // limit to 15 pages max per UAC

      console.log(`  📖 Extracting pages ${startPage}-${endPage} for UAC ${uac.uacNumber} (Semestre ${uac.semester})...`);
      const uacTextResult = await extractPagesText(pdf.fullPath, startPage, endPage);
      if (!uacTextResult) {
        console.error(`  ❌ Could not extract pages for UAC ${uac.suggestedTitle}`);
        continue;
      }

      // Specialty name or curriculum category
      const curriculumName = pdf.filename
        .replace(/_2024\.pdf$/i, '')
        .replace(/_BN\.pdf$/i, '')
        .replace(/vf_MCC_/i, '')
        .replace(/2025_MCC_/i, '')
        .replace(/2025_ /i, '')
        .replace(/_/g, ' ')
        .trim();

      const detailPrompt = `Analiza el siguiente texto de un programa de estudios para la UAC del semestre ${uac.semester} y extrae sus detalles didácticos en JSON.
      
      Responde ÚNICAMENTE con el objeto JSON, sin texto adicional y sin markdown:
      {
        "uacName": "Nombre exacto y completo de la UAC (Unidad de Aprendizaje Curricular)",
        "learningOutcome": "Resultado de aprendizaje de la UAC (qué logrará el estudiante al finalizarla)",
        "totalHours": número de horas totales (usualmente 54 o 72, o la suma de las actividades clave)",
        "activities": [
          { "name": "Nombre exacto de la Actividad Clave 1", "hours": horas, "order": 1 },
          { "name": "Nombre exacto de la Actividad Clave 2", "hours": horas, "order": 2 }
        ],
        "evidences": ["Evidencia sugerida 1", "Evidencia sugerida 2"]
      }

      Reglas:
      - Extrae los nombres de las Actividades Clave EXACTAMENTE como aparecen en el texto. Las actividades clave son los bloques principales en los que se divide el semestre.
      - Si las horas de cada actividad no están explícitas, reparte el total (e.g. si el total es 54 y son 3 actividades, asigna 18 a cada una).
      - Las evidencias o productos esperados suelen estar descritos en la sección de evaluación o al final de las actividades. Infiere de 2 a 5 evidencias claras.

      TEXTO DE LA UAC:
      ${uacTextResult.text}`;

      console.log(`    🧠 Structuring UAC detail with Claude...`);
      try {
        const detailText = await callClaude(detailPrompt);
        const cleanDetailJson = detailText
          .replace(/^```(?:json)?\n?/m, '')
          .replace(/\n?```$/m, '')
          .trim();
        const details = JSON.parse(cleanDetailJson);

        if (!details.uacName) {
          details.uacName = uac.suggestedTitle || `UAC ${uac.uacNumber} - Semestre ${uac.semester}`;
        }
        if (!details.learningOutcome) {
          details.learningOutcome = `Desarrollar competencias correspondientes a ${details.uacName}`;
        }

        // Save to Database
        console.log(`    💾 Saving to Neon DB: "${details.uacName}"...`);
        await sql`
          INSERT INTO programs_catalog (
            uac_name, semester, component, curriculum_name,
            total_hours, learning_outcome, activities, evidences
          )
          VALUES (
            ${details.uacName},
            ${uac.semester},
            ${pdf.component},
            ${curriculumName},
            ${details.totalHours || 54},
            ${details.learningOutcome},
            ${JSON.stringify(details.activities || [])},
            ${JSON.stringify(details.evidences || [])}
          )
          ON CONFLICT (uac_name) DO UPDATE SET
            semester = EXCLUDED.semester,
            component = EXCLUDED.component,
            curriculum_name = EXCLUDED.curriculum_name,
            total_hours = EXCLUDED.total_hours,
            learning_outcome = EXCLUDED.learning_outcome,
            activities = EXCLUDED.activities,
            evidences = EXCLUDED.evidences
        `;
        console.log(`    ✓ Saved successfully.`);
      } catch (err) {
        console.error(`    ❌ Failed to process UAC details:`, err.message);
      }

      // Avoid hitting Anthropic rate limits
      await sleep(1500);
    }
  }

  console.log('\n🎉 Seeding completed successfully!');
  
  // Count entries
  const countRes = await sql`SELECT count(*) FROM programs_catalog`;
  console.log(`📊 Total programs in catalog: ${countRes[0].count}`);
}

seed().catch(err => {
  console.error('❌ Global seed script failure:', err);
  process.exit(1);
});
