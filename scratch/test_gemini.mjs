import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/GEMINI_API_KEY=['"]?([^'"\r\n]+)['"]?/);
if (!match) {
  console.error('No GEMINI_API_KEY in .env.local');
  process.exit(1);
}
const apiKey = match[1];

async function test() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Responde únicamente con la palabra: OK' }] }]
    })
  });
  
  if (!resp.ok) {
    const errText = await resp.text();
    console.error('Gemini error:', resp.status, errText);
    // Intentar con gemini-1.5-flash o gemini-2.0-flash si 2.5 no está disponible
    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const fbResp = await fetch(fallbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Responde únicamente con la palabra: OK' }] }]
      })
    });
    console.log('Fallback response status:', fbResp.status);
    const fbData = await fbResp.json();
    console.log('Fallback output:', fbData.candidates?.[0]?.content?.parts?.[0]?.text);
  } else {
    const data = await resp.json();
    console.log('Gemini 2.5 flash output:', data.candidates?.[0]?.content?.parts?.[0]?.text);
  }
}
test();
