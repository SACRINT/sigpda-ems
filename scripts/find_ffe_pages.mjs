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
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

// Check page 3 of psicologia1 and filosofia2
for (const prefix of ["psicologia1", "filosofia2"]) {
  const imgPath = path.resolve(`scripts/extracted_pages/${prefix}_p3.png`);
  if (!fs.existsSync(imgPath)) continue;
  const imgData = fs.readFileSync(imgPath);
  const res = await model.generateContent([
    "Transcribe el contenido de esta página (Índice o Contenido) indicando exactamente en qué páginas o secciones se encuentran las Progresiones de Aprendizaje o la Tabla de Progresiones.",
    { inlineData: { data: imgData.toString("base64"), mimeType: "image/png" } }
  ]);
  console.log(`\n=== ÍNDICE ${prefix} ===\n`, res.response.text());
}
