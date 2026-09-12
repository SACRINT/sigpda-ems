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
const rows = await sql`SELECT id, label, provider, key_encrypted FROM api_keys WHERE provider = 'openrouter' AND is_active = true`;

if (rows.length > 0) {
  const plainKey = decryptKey(rows[0].key_encrypted);
  console.log(`OpenRouter key decrypted (${plainKey.substring(0, 10)}...)`);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${plainKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: "Hola, responde 'OK'" }]
      })
    });
    const data = await res.json();
    console.log("OPENROUTER RESPONSE:", data.choices ? data.choices[0].message.content : data);
  } catch (e) {
    console.log("OPENROUTER ERR:", e.message);
  }
} else {
  console.log("No OpenRouter keys in DB");
}
