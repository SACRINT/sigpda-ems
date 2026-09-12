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

for (const modelName of ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-3.6-flash"]) {
  console.log(`\nTesting model: ${modelName}`);
  const r = rows[0];
  const plainKey = decryptKey(r.key_encrypted);
  try {
    const genAI = new GoogleGenerativeAI(plainKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const res = await model.generateContent("Hola, responde 'OK'");
    console.log(`SUCCESS with ${modelName}:`, res.response.text().trim());
    break;
  } catch (e) {
    console.log(`Failed with ${modelName}:`, e.message);
  }
}
