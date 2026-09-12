import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { createDecipheriv } from 'crypto';

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

for (const model of ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash']) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Hola' }] }]
    })
  });
  console.log(`${model} status:`, res.status);
  if (!res.ok) {
    console.log(await res.text());
  } else {
    const data = await res.json();
    console.log(`${model} response:`, data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
  }
}
