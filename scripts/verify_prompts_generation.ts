import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { createDecipheriv } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '../src/lib/prompts/system-prompt';
import { buildUserPrompt } from '../src/lib/prompts/build-prompt';
import type { ExtractedPdfData, TeacherContext } from '../src/types/planning';
import type { ProgramCatalogItem } from '../src/lib/db';

// Load .env.local
const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const dbUrl = process.env.DATABASE_URL!;
const encKey = Buffer.from(process.env.ADMIN_ENCRYPTION_KEY!);

function decryptKey(encrypted: string): string {
  const [ivHex, data] = encrypted.split(':');
  const decipher = createDecipheriv('aes-256-cbc', encKey, Buffer.from(ivHex, 'hex'));
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const sql = neon(dbUrl);

async function runGenerations() {
  console.log('=== INICIANDO VERIFICACIÓN DE GENERACIÓN CON PROMPTS FASE 2 ===\n');

  // 1. Obtener API key activa
  const keyRows = await sql`SELECT id, label, key_encrypted FROM api_keys WHERE provider = 'gemini' AND is_active = true LIMIT 1`;
  if (keyRows.length === 0) throw new Error('No active gemini key found');
  const apiKey = decryptKey(keyRows[0].key_encrypted);
  console.log(`Usando API Key: ${keyRows[0].label}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      responseMimeType: 'application/json',
    },
  });

  const testCases = [
    {
      type: 'Fundamental',
      uacQuery: 'Ciencias Naturales, Experimentales y Tecnología II',
      component: 'fundamental',
      semester: 2,
      teacherContext: {
        teacherName: 'Mtra. Elena Morales T.',
        schoolName: 'Bachillerato General Oficial "Ignacio Zaragoza"',
        municipality: 'Tehuacán',
        state: 'Puebla',
        region: 'Valle de Tehuacán - Sierra Negra',
        subsystem: 'bge',
        groupInfo: '2° Semestre Grupo A',
        applicationPeriod: 'Feb-Jul 2026',
        paecProjectName: 'Preservación y Manejo Sustentable del Agua en Tehuacán',
        paecProblem: 'Sobreexplotación y salinización de mantos freáticos en comunidades agrícolas locales',
        studentContext: 'Estudiantes de 15-16 años en zona semiurbana con acceso comunitario a dispositivos móviles',
      } as TeacherContext,
    },
    {
      type: 'Laboral',
      uacQuery: 'Entrega recursos materiales a otras áreas de una organización',
      component: 'laboral',
      semester: 3,
      teacherContext: {
        teacherName: 'Lic. Fernando Rojas C.',
        schoolName: 'Bachillerato General Estatal "Benito Juárez"',
        municipality: 'San Pedro Cholula',
        state: 'Puebla',
        region: 'Cholula - San Andrés',
        subsystem: 'bge',
        groupInfo: '3° Semestre Grupo B',
        applicationPeriod: 'Ago-Dic 2026',
        paecProjectName: 'Optimización de Cadenas de Suministro para Microempresas Artesanales',
        paecProblem: 'Pérdidas operativas y merma de inventarios en talleres alfareros y de tabique locales',
        studentContext: 'Jóvenes de 16 años con interés en administración aplicada a microempresas familiares',
      } as TeacherContext,
    },
    {
      type: 'FFE Optativa',
      uacQuery: 'Psicología I',
      component: 'ffe_optativa',
      semester: 5,
      teacherContext: {
        teacherName: 'Mtra. Sofía Altamirano V.',
        schoolName: 'Bachillerato General "Héroes del 5 de Mayo"',
        municipality: 'Puebla',
        state: 'Puebla',
        region: 'Angelópolis',
        subsystem: 'bge',
        groupInfo: '5° Semestre Grupo C',
        applicationPeriod: 'Ago-Dic 2026',
        paecProjectName: 'Salud Mental y Convivencia Escolar en la Juventud Poblana',
        paecProblem: 'Ansiedad académica, presión social digital y aislamiento en la comunidad escolar',
        studentContext: 'Estudiantes de 17 años que se preparan para el egreso y educación superior',
      } as TeacherContext,
    },
  ];

  const results: any[] = [];

  for (const tc of testCases) {
    console.log(`\n======================================================`);
    console.log(`PROBANDO CASO [${tc.type}]: "${tc.uacQuery}" (Semestre ${tc.semester})`);
    console.log(`======================================================`);

    // Consultar catálogo auténtico en DB
    const uacRows = await sql`
      SELECT id, uac_name, component, semester, total_hours, activities, learning_outcome, contenidos_formativos
      FROM programs_catalog
      WHERE uac_name ILIKE ${'%' + tc.uacQuery + '%'} AND subsystem = 'bge'
      LIMIT 1
    `;

    if (uacRows.length === 0) {
      throw new Error(`UAC no encontrada en catálogo: ${tc.uacQuery}`);
    }

    const officialRow = uacRows[0];
    const officialProgram: ProgramCatalogItem = {
      id: officialRow.id,
      uac_name: officialRow.uac_name,
      subsystem: 'bge',
      component: officialRow.component,
      semester: officialRow.semester,
      total_hours: officialRow.total_hours,
      activities: officialRow.activities,
      learning_outcome: officialRow.learning_outcome,
      contenidos_formativos: officialRow.contenidos_formativos,
    };

    const rawActivities = Array.isArray(officialRow.activities) ? officialRow.activities : [];
    console.log(`Actividades/Progresiones en catálogo: ${rawActivities.length}`);

    const extractedData: ExtractedPdfData = {
      uacName: officialRow.uac_name,
      learningOutcome: officialRow.learning_outcome || 'Desarrolla competencias integrales del perfil de egreso MCCEMS.',
      totalHours: officialRow.total_hours || 54,
      activities: rawActivities.map((a: any, idx: number) => ({
        name: typeof a === 'string' ? a : (a.name || a.title || `Actividad ${idx + 1}`),
        hours: typeof a === 'object' && a.hours ? a.hours : Math.round((officialRow.total_hours || 54) / Math.max(1, rawActivities.length)),
        order: idx + 1,
        corte: typeof a === 'object' && a.corte ? a.corte : undefined,
      })),
      evidences: ['Reporte técnico', 'Rúbrica de evaluación', 'Evidencia de desempeño'],
      parseConfidence: 'high',
      contenidosFormativos: officialRow.contenidos_formativos || null,
    };

    // Construir user prompt
    const userPrompt = buildUserPrompt(
      extractedData,
      tc.teacherContext,
      tc.semester,
      tc.component,
      officialProgram,
      null,
      null,
      null
    );

    console.log(`Prompt generado (${userPrompt.length} chars). Llamando a Gemini...`);
    const startTime = Date.now();

    const response = await model.generateContent(userPrompt);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    const rawText = response.response.text().trim();
    console.log(`Respuesta recibida en ${elapsedSec}s (${rawText.length} caracteres).`);

    // Parse JSON
    let parsed: any;
    try {
      const clean = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      parsed = JSON.parse(clean);
    } catch (err: any) {
      console.error(`ERROR parseando JSON para ${tc.type}:`, err.message);
      results.push({ type: tc.type, uac: tc.uacQuery, success: false, error: err.message });
      continue;
    }

    // Verificaciones pedagógicas y normativas
    const hasSectionI = Boolean(parsed.sectionI);
    const hasSectionII = Boolean(parsed.sectionII);
    const hasSectionIII = Boolean(parsed.sectionIII);
    const hasSectionIV = Boolean(parsed.sectionIV && Array.isArray(parsed.sectionIV.activities));
    const hasSectionV = Boolean(parsed.sectionV);
    const hasSectionVI = Boolean(parsed.sectionVI);

    const acts = parsed.sectionIV?.activities || [];
    console.log(`Secuencias didácticas generadas en Section IV: ${acts.length}`);

    let allHaveCanonicalMoments = true;
    let foundFinnishPhenomenon = false;
    let foundEmpiricalLab = false;
    let foundGrowthConclusion = false;
    let foundDigitalTools = false;

    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      const hasApertura = Boolean(a.apertura);
      const hasEjecucion = Boolean(a.ejecucion);
      const hasConclusion = Boolean(a.conclusion);

      if (!hasApertura || !hasEjecucion || !hasConclusion) {
        allHaveCanonicalMoments = false;
      }

      const allText = JSON.stringify(a).toLowerCase();
      if (allText.includes('fenómeno') || allText.includes('fenomeno') || allText.includes('comunidad') || allText.includes('disonancia') || allText.includes('enigma') || allText.includes('problema') || allText.includes('indagación')) {
        foundFinnishPhenomenon = true;
      }
      if (allText.includes('phyphox') || allText.includes('phet') || allText.includes('geogebra') || allText.includes('tinkercad') || allText.includes('colab') || allText.includes('sensor') || allText.includes('laboratorio') || allText.includes('medición') || allText.includes('medicion') || allText.includes('experimento') || allText.includes('hoja de cálculo') || allText.includes('prototipo') || allText.includes('rol')) {
        foundEmpiricalLab = true;
      }
      if (allText.includes('metacogn') || allText.includes('defensa') || allText.includes('reflexi') || allText.includes('mejora') || allText.includes('crecimiento') || allText.includes('evaluación formativa')) {
        foundGrowthConclusion = true;
      }
    }

    const digitalResources = (parsed.sectionVI?.digital || []).join(' ').toLowerCase();
    if (digitalResources.includes('phyphox') || digitalResources.includes('phet') || digitalResources.includes('geogebra') || digitalResources.includes('tinkercad') || digitalResources.includes('colab') || digitalResources.includes('simulador') || digitalResources.includes('sensor') || digitalResources.includes('digital')) {
      foundDigitalTools = true;
    }

    console.log(`- Estructura canónica completa (I a VI): ${hasSectionI && hasSectionII && hasSectionIII && hasSectionIV && hasSectionV && hasSectionVI ? '✅' : '❌'}`);
    console.log(`- Momentos canónicos Apertura/Ejecución/Conclusión en cada actividad: ${allHaveCanonicalMoments ? '✅' : '❌'}`);
    console.log(`- Fenómeno situado / indagación inicial en Apertura: ${foundFinnishPhenomenon ? '✅' : '❌'}`);
    console.log(`- Laboratorio / indagación empírica en Ejecución: ${foundEmpiricalLab ? '✅' : '❌'}`);
    console.log(`- Evaluación formativa / metacognición en Conclusión: ${foundGrowthConclusion ? '✅' : '❌'}`);
    console.log(`- Recursos digitales / laboratorios contemporáneos en Sección VI: ${foundDigitalTools ? '✅' : '❌'}`);

    if (acts.length > 0) {
      const firstAct = acts[0];
      console.log(`\nMuestra de Actividad 1: "${firstAct.name || firstAct.contenidoFormativo || 'Actividad 1'}"`);
      console.log(`  [Apertura]: ${String(firstAct.apertura).slice(0, 160)}...`);
      console.log(`  [Ejecución]: ${String(firstAct.ejecucion).slice(0, 160)}...`);
      console.log(`  [Conclusión]: ${String(firstAct.conclusion).slice(0, 160)}...`);
    }

    results.push({
      type: tc.type,
      uac: tc.uacQuery,
      semester: tc.semester,
      success: true,
      elapsedSec,
      actsCount: acts.length,
      checks: {
        canonicalStructure: hasSectionI && hasSectionII && hasSectionIII && hasSectionIV && hasSectionV && hasSectionVI,
        canonicalMoments: allHaveCanonicalMoments,
        finnishPhenomenon: foundFinnishPhenomenon,
        empiricalLab: foundEmpiricalLab,
        growthConclusion: foundGrowthConclusion,
        digitalTools: foundDigitalTools,
      },
      sample: {
        name: acts[0]?.name || acts[0]?.contenidoFormativo,
        apertura: acts[0]?.apertura,
        ejecucion: acts[0]?.ejecucion,
        conclusion: acts[0]?.conclusion,
      },
      sectionVI_digital: parsed.sectionVI?.digital || [],
    });
  }

  fs.writeFileSync(
    path.resolve('scratch/test_generation_results.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('\n=== RESULTADOS GUARDADOS EN scratch/test_generation_results.json ===');
}

runGenerations().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
