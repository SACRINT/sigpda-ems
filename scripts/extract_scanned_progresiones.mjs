import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { createDecipheriv } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8');
const dbUrl = envContent.match(/DATABASE_URL=([^\r\n]+)/)[1].trim();
const encKey = Buffer.from(envContent.match(/ADMIN_ENCRYPTION_KEY=([^\r\n]+)/)[1].trim());

function decryptKey(encrypted) {
  const [ivHex, data] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', encKey, iv);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const sql = neon(dbUrl);
const rows = await sql`SELECT id, label, provider, key_encrypted FROM api_keys WHERE provider = 'gemini' AND is_active = true`;
const apiKey = decryptKey(rows[0].key_encrypted);
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ 
  model: "gemini-3.6-flash",
  generationConfig: { responseMimeType: "application/json" }
});

const extractedOutput = {};

// 1. Extraer Psicología I
console.log("=== Extrayendo Psicología I ===");
const psiPages = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
const psiImages = [];
for (const p of psiPages) {
  const pPath = path.resolve(`scripts/extracted_pages/psicologia1_p${p}.png`);
  if (fs.existsSync(pPath)) {
    psiImages.push({
      inlineData: {
        data: fs.readFileSync(pPath).toString("base64"),
        mimeType: "image/png"
      }
    });
  }
}

const psiPrompt = `Eres un experto transcriptor curricular de la SEP / DGB México.
Analiza las imágenes proporcionadas correspondientes a las páginas de Progresiones de Aprendizaje de la UAC "Psicología I" (Quinto Semestre).
Extrae TODAS las Progresiones de Aprendizaje oficiales que aparezcan en estas páginas.
Responde estrictamente con un objeto JSON con este formato:
{
  "uac_name": "Psicología I",
  "semester": 5,
  "progresiones": [
    {
      "order": 1,
      "name": "Texto completo y exacto de la progresión 1..."
    },
    ...
  ]
}
No inventes texto. Extrae exactamente lo que dicen los encabezados 'Progresión 1', 'Progresión 2', etc.`;

const psiRes = await model.generateContent([psiPrompt, ...psiImages]);
const psiData = JSON.parse(psiRes.response.text());
console.log(`Psicología I: ${psiData.progresiones.length} progresiones extraídas:`);
psiData.progresiones.forEach(p => console.log(`  Prog ${p.order}: ${p.name.substring(0, 70)}...`));
extractedOutput["Psicología I"] = psiData;

// 2. Extraer Pensamiento Filosófico II
console.log("\n=== Extrayendo Pensamiento Filosófico II ===");
const filoPages = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35];
const filoImages = [];
for (const p of filoPages) {
  const pPath = path.resolve(`scripts/extracted_pages/filosofia2_p${p}.png`);
  if (fs.existsSync(pPath)) {
    filoImages.push({
      inlineData: {
        data: fs.readFileSync(pPath).toString("base64"),
        mimeType: "image/png"
      }
    });
  }
}

const filoPrompt = `Eres un experto transcriptor curricular de la SEP / DGB México.
Analiza las imágenes proporcionadas correspondientes a las páginas de Progresiones de Aprendizaje de la UAC "Pensamiento Filosófico II" (Sexto Semestre).
Extrae TODAS las Progresiones de Aprendizaje oficiales que aparezcan en estas páginas.
Responde estrictamente con un objeto JSON con este formato:
{
  "uac_name": "Pensamiento Filosófico II",
  "semester": 6,
  "progresiones": [
    {
      "order": 1,
      "name": "Texto completo y exacto de la progresión 1..."
    },
    ...
  ]
}
No inventes texto. Extrae exactamente lo que dicen los encabezados 'Progresión 1', 'Progresión 2', etc.`;

const filoRes = await model.generateContent([filoPrompt, ...filoImages]);
const filoData = JSON.parse(filoRes.response.text());
console.log(`Pensamiento Filosófico II: ${filoData.progresiones.length} progresiones extraídas:`);
filoData.progresiones.forEach(p => console.log(`  Prog ${p.order}: ${p.name.substring(0, 70)}...`));
extractedOutput["Pensamiento Filosófico II"] = filoData;

// Guardar en scripts/data/scanned_ffe_extracted.json
const outPath = path.resolve("scripts/data/scanned_ffe_extracted.json");
fs.writeFileSync(outPath, JSON.stringify(extractedOutput, null, 2), "utf8");
console.log(`\nGuardado exitoso en ${outPath}`);
