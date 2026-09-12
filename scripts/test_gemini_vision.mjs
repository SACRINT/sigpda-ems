import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
if (!match) {
  console.error("No GEMINI_API_KEY in .env.local");
  process.exit(1);
}
const apiKey = match[1].trim();

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function run() {
  const p3Path = path.resolve("scripts/extracted_pages/psicologia1_p3.png");
  const imgData = fs.readFileSync(p3Path);
  const part = {
    inlineData: {
      data: imgData.toString("base64"),
      mimeType: "image/png"
    }
  };
  const result = await model.generateContent([
    "¿Qué dice este índice o tabla de contenido? ¿En qué página están las progresiones o aprendizajes esperados?",
    part
  ]);
  console.log("Response:", result.response.text());
}

run().catch(err => console.error("Error:", err));
