import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import path from 'path';
import { callGeminiPool } from '@/lib/gemini';

// Polyfills for browser-only globals required by pdfjs-dist v6 under Node/Vercel environments
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {} as any;
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {} as any;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Extracción inteligente de texto con scoring semántico PAEC (máx 40,000 caracteres)
    let smartText = '';
    try {
      smartText = await extractSmartPaecText(buffer);
    } catch (err) {
      console.error('[paec-parser] pdfjs extraction failed:', err);
      return NextResponse.json({ error: 'No se pudo leer el archivo PDF. Asegúrate de que no esté dañado.' }, { status: 400 });
    }

    if (!smartText || smartText.trim().length < 80) {
      return NextResponse.json({ error: 'El PDF no contiene texto legible.' }, { status: 400 });
    }

    // 2. Extracción estructurada multi-nivel (IA NEM -> Heurísticas multi-ancla -> Síntesis como último recurso)
    const parsedData: {
      projectName: string | null;
      objective: string | null;
      problem: string | null;
      studentContext: string | null;
      schoolName: string | null;
      municipality: string | null;
      cct: string | null;
      isSuggestedProblem: boolean;
    } = {
      projectName: null,
      objective: null,
      problem: null,
      studentContext: null,
      schoolName: null,
      municipality: null,
      cct: null,
      isSuggestedProblem: false,
    };

    // Nivel 1: Modelo de IA con prompt pedagógico NEM
    try {
      const geminiResult = await structurePaecWithGemini(smartText);
      parsedData.projectName = geminiResult.projectName || null;
      parsedData.objective = geminiResult.objective || null;
      parsedData.problem = geminiResult.problem || null;
      parsedData.studentContext = geminiResult.studentContext || null;
      parsedData.schoolName = geminiResult.schoolName || null;
      parsedData.municipality = geminiResult.municipality || null;
      parsedData.cct = geminiResult.cct || null;
      parsedData.isSuggestedProblem = false;
    } catch (err: any) {
      console.warn('[paec-parser] Gemini call failed, falling back to heuristics:', err.message || err);
    }

    // Nivel 2: Heurísticas multi-ancla sobre todo el texto estructurado
    const heuristicResult = parsePaecHeuristics(smartText);
    if (!parsedData.projectName && heuristicResult.projectName) parsedData.projectName = heuristicResult.projectName;
    if (!parsedData.objective && heuristicResult.objective) parsedData.objective = heuristicResult.objective;
    if (!parsedData.studentContext && heuristicResult.studentContext) parsedData.studentContext = heuristicResult.studentContext;
    if (!parsedData.schoolName && heuristicResult.schoolName) parsedData.schoolName = heuristicResult.schoolName;
    if (!parsedData.municipality && heuristicResult.municipality) parsedData.municipality = heuristicResult.municipality;
    if (!parsedData.cct && heuristicResult.cct) parsedData.cct = heuristicResult.cct;

    if (!parsedData.problem || parsedData.problem.trim().length === 0) {
      if (heuristicResult.problem) {
        parsedData.problem = heuristicResult.problem;
        parsedData.isSuggestedProblem = false;
      }
    }

    // Nivel 3: Síntesis como ÚLTIMO RECURSO
    // Solo si tanto Gemini como las heurísticas no encontraron problemática en el PDF
    if (!parsedData.problem || parsedData.problem.trim().length === 0) {
      parsedData.problem = synthesizeProblemFallback(
        parsedData.projectName || '',
        parsedData.objective || '',
        parsedData.studentContext || ''
      );
      parsedData.isSuggestedProblem = true;
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error) {
    console.error('POST /api/pdf/parse-paec error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ─── Extracción Inteligente por Scoring Semántico ──────────────────────────────
async function extractSmartPaecText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  
  // Configure worker using a file:// URL scheme to satisfy Node.js ESM loader requirements
  const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  const normalizedPath = workerPath.replace(/\\/g, '/');
  const workerUrl = 'file://' + (normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    password: '',
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).promise;

  const totalPages = Math.min(doc.numPages, 45);
  const pagesData: { pageNum: number; text: string; score: number }[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');
    
    let score = 0;
    const lower = pageText.toLowerCase();

    // 1. "problemática" / "necesidades de la comunidad" → +10
    if (/problem[aá]tica|necesidades\s+de\s+la\s+comunidad/i.test(lower)) score += 10;

    // 2. "selección del problema" / "problema central" → +10
    if (/selecci[oó]n\s+del\s+problema|problema\s+central/i.test(lower)) score += 10;

    // 3. "etapa" + ("recuperación" | "análisis" | "selección") → +8
    if (/etapa\s*[:\-\s\w]*(?:recuperaci[oó]n|an[aá]lisis|selecci[oó]n)/i.test(lower)) score += 8;

    // 4. "diagnóstico" / "árbol de problemas" / "FODA" → +6
    if (/diagn[oó]stico|[aá]rbol\s+de\s+problemas|foda/i.test(lower)) score += 6;

    // 5. "justificación" / "propósito" / "objetivo general" → +4
    if (/justificaci[oó]n|prop[oó]sito|objetivo\s+general/i.test(lower)) score += 4;

    // 6. "caracterización" / "contexto" / "estudiantes" → +2
    if (/caracterizaci[oó]n|contexto|estudiantes/i.test(lower)) score += 2;

    pagesData.push({ pageNum: i, text: pageText, score });
  }

  // Siempre incluir páginas 1-3 (intro institucional, portada e índice)
  // Además incluir páginas relevantes con score >= 6
  const selectedPages = pagesData.filter(p => p.pageNum <= 3 || p.score >= 6);
  
  // Si no hubo páginas puntuadas después de la 3, conservar las primeras 8
  const candidatePages = selectedPages.length > 3 ? selectedPages : pagesData.slice(0, Math.min(pagesData.length, 8));

  // Ordenar cronológicamente por número de página
  candidatePages.sort((a, b) => a.pageNum - b.pageNum);

  // Ensamblar con delimitadores respetando el límite estricto de 40,000 caracteres
  let assembled = '';
  const MAX_CHARS = 40000;

  for (const p of candidatePages) {
    const pageBlock = `\n=== PÁGINA ${p.pageNum} ===\n${p.text}\n`;
    if ((assembled.length + pageBlock.length) > MAX_CHARS) {
      const remaining = MAX_CHARS - assembled.length;
      if (remaining > 500) {
        assembled += pageBlock.slice(0, remaining);
      }
      break;
    }
    assembled += pageBlock;
  }

  return assembled.trim();
}

// ─── Estructuración con IA (Prompt Especializado NEM) ─────────────────────────
async function structurePaecWithGemini(smartText: string) {
  const systemInstruction = `Eres un experto pedagógico en el Programa Aula, Escuela y Comunidad (PAEC) y el Proyecto Escolar Comunitario (PEC) de la Nueva Escuela Mexicana (NEM) en la Educación Media Superior (Puebla, México). Tu tarea es analizar con máxima fidelidad los diagnósticos, problemas y contextos del proyecto. Responde exclusivamente con un objeto JSON válido, sin markdown ni explicaciones adicionales.`;

  const prompt = `Analiza el siguiente texto de un documento oficial PAEC/PEC de un bachillerato y extrae en formato JSON:

{
  "projectName": "Nombre o título oficial del Proyecto Escolar Comunitario (PEC)",
  "objective": "Objetivo general, propósito formativo o meta del proyecto",
  "problem": "Problemática comunitaria detectada que se abordará en el PEC",
  "studentContext": "Caracterización o contexto sociocultural y escolar de los estudiantes y el plantel",
  "schoolName": "Nombre oficial del plantel educativo o bachillerato (ej: Bachillerato General Estatal Héroes de la Patria)",
  "municipality": "Municipio o localidad donde se encuentra el plantel (ej: Venustiano Carranza)",
  "cct": "Clave de Centro de Trabajo CCT de 10 caracteres (ej: 21EBH0200X)"
}

INSTRUCCIONES CRÍTICAS PARA LA EXTRACCIÓN:
1. "problem": Busca EXPLÍCITAMENTE la sección titulada "Problemáticas o necesidades de la comunidad", "Selección del problema para el PEC", "Problema central", "Problemática detectada" o tablas de diagnóstico por etapas (Etapa uno: Recuperación de información, Etapa dos: Sistematización y análisis FODA, Etapa tres: Selección del problema). Extrae la Etapa 3 (o la síntesis consolidada de las etapas) detallando la problemática comunitaria concreta (por ejemplo: adicciones, alcoholismo, hábitos alimenticios deficientes, falta de espacios deportivos, contaminación/basura, bajo aprovechamiento académico, falta de infraestructura techada, etc.). Debe ser un texto descriptivo, claro y suficiente (2-4 oraciones) para guiar la planeación didáctica.
2. "projectName": Título del PEC (ej: "Comunidad Resiliente: Vida Saludable...", "EcoBachiller Recicla...", etc.).
3. "objective": Propósito o meta formativa del proyecto comunitario.
4. "studentContext": Ubicación del plantel, características de la localidad, entorno socioeconómico y características de los alumnos.
5. "schoolName": Nombre oficial del bachillerato o plantel (si aparece en portada o encabezados).
6. "municipality": Municipio o localidad donde está ubicado el plantel.
7. "cct": Clave CCT de 10 caracteres alfanuméricos (ej: 21EBH0200X).
8. Si no encuentras algún campo con certeza absoluta, asigna null.

TEXTO DEL DOCUMENTO:
${smartText}`;

  const rawJsonText = await callGeminiPool(systemInstruction, prompt);
  const cleanJson = rawJsonText
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  return JSON.parse(cleanJson);
}

// ─── Heurísticas Multi-Ancla sobre Todo el Texto ──────────────────────────────
function parsePaecHeuristics(text: string) {
  let projectName: string | null = null;
  let objective: string | null = null;
  let problem: string | null = null;
  let studentContext: string | null = null;
  let schoolName: string | null = null;
  let municipality: string | null = null;
  let cct: string | null = null;

  // 1. Nombre del proyecto
  const nameMatch1 = text.match(/(?:PEC titulado|PEC denominado|proyecto denominado|proyecto titulado)\s*[:\-\s]*["'«“](.*?)["'»”]/i) 
    || text.match(/PEC titulado\s*["'«“]?(.*?)(?:\.|\r?\n|$)/i);
  if (nameMatch1) {
    projectName = nameMatch1[1].trim();
  } else {
    const nameMatch2 = text.match(/(?:PROYECTO ESCOLAR COMUNITARIO|PEC)\s*[:\-\s]+([^\n\r]{10,120})/i);
    if (nameMatch2) {
      projectName = nameMatch2[1].trim();
    }
  }

  // 2. Problemática comunitaria (Multi-ancla)
  // Patrón A: "Problemáticas o necesidades de la comunidad" -> tabla de Etapas o descripción
  const matchPNC = text.match(/Problemáticas\s+o\s+necesidades\s+de\s+la\s+comunidad[\s\S]*?(?:Etapa\s+tres[:\s]*|eje\s+central\s+del\s+proyecto[:\s]*|selección\s+del\s+problema[:\s]*)([\s\S]*?)(?=\b(?:Fase\s+2|Fase\s+II|FASE\s+II|1\.\s+Introducción|Propósito|Alcance|=== PÁGINA|$))/i);
  if (matchPNC && matchPNC[1]?.trim().length > 30) {
    problem = matchPNC[1].trim();
  } else {
    // Patrón B: "Etapa.*Selección del problema"
    const matchEtapa3 = text.match(/(?:Etapa\s+tres[:\s]*[^\n\r]*selecci[oó]n\s+del\s+problema[^\n\r]*)[\s\S]*?([A-ZÁÉÍÓÚ][\s\S]{30,600}?)(?=\b(?:Fase|FASE|1\.\s+Introducción|Propósito|=== PÁGINA|$))/i);
    if (matchEtapa3 && matchEtapa3[1]?.trim().length > 30) {
      problem = matchEtapa3[1].trim();
    } else {
      // Patrón C: "problema.*detectado" / "problemática.*detectada" / "problema central"
      const matchProbDet = text.match(/(?:problem[aá]tica\s+detectada|problema\s+detectado|problema\s+central|problema\s+a\s+resolver)\s*[:\-\s]*([^\n\r]+(?:\r?\n[^\n\r]+){1,5})/i);
      if (matchProbDet && matchProbDet[1]?.trim().length > 25) {
        problem = matchProbDet[1].trim();
      }
    }
  }

  // 3. Objetivo general / propósito
  const objMatch = text.match(/(?:Propósito\s+general|Objetivo\s+general\s+del\s+proyecto|Objetivo\s+del\s+proyecto|Propósito|Objetivo)\s*[:\-\s]*([A-ZÁÉÍÓÚ][^\n\r]+(?:\r?\n[^\n\r]+){1,4})/i);
  if (objMatch && objMatch[1]?.trim().length > 20) {
    objective = objMatch[1].trim();
  }

  // 4. Caracterización / Contexto de estudiantes y plantel
  const contextMatch = text.match(/(?:Características\s+del\s+estudiantado|Caracterización\s+de\s+los\s+estudiantes|Contexto\s+estudiantil|Caracter[ií]sticas\s+de\s+la\s+comunidad)\s*[:\-\s]*([A-ZÁÉÍÓÚ][\s\S]*?)(?=\b(?:Características\s+del\s+plantel|Diagnóstico|FODA|=== PÁGINA|$))/i);
  if (contextMatch && contextMatch[1]?.trim().length > 30) {
    studentContext = contextMatch[1].trim();
  }

  // 5. Clave CCT (10 caracteres, ej: 21EBH0200X, 21ECT0017T)
  const cctMatch = text.match(/\b([0-9]{2}[A-Z]{3}[0-9]{4}[A-Z])\b/);
  if (cctMatch) {
    cct = cctMatch[1].trim();
  }

  // 6. Nombre del plantel
  const schoolMatch = text.match(/(?:Bachillerato\s+(?:General\s+Estatal|Tecnol[oó]gico|Digital)?|Plantel|Escuela|CBTIS|CBTA|CECyTE|CONALEP)[^\n\r,.;]{3,80}/i);
  if (schoolMatch) {
    schoolName = schoolMatch[0].trim();
  }

  // 7. Municipio / Localidad
  const munMatch = text.match(/(?:Municipio|Localidad|Ubicaci[oó]n|en\s+el\s+municipio\s+de)[:\s]*([A-ZÁÉÍÓÚ][a-záéíóúñA-ZÁÉÍÓÚ\s]{3,40})(?:,|\.|\r?\n|$)/i);
  if (munMatch) {
    municipality = munMatch[1].trim();
  }

  // Normalización de espacios y remoción de etiquetas de página
  const clean = (s: string) => s.replace(/=== PÁGINA \d+ ===/g, '').replace(/\s+/g, ' ').trim();

  return {
    projectName: projectName ? clean(projectName) : null,
    objective: objective ? clean(objective) : null,
    problem: problem ? clean(problem) : null,
    studentContext: studentContext ? clean(studentContext) : null,
    schoolName: schoolName ? clean(schoolName) : null,
    municipality: municipality ? clean(municipality) : null,
    cct: cct ? clean(cct) : null,
  };
}

// ─── Síntesis Contextual de Respaldo (Último Recurso) ──────────────────────────
function synthesizeProblemFallback(projectName: string, objective: string, studentContext: string): string {
  const title = (projectName + ' ' + objective).toLowerCase();
  
  if (title.includes('salud') || title.includes('vida saludable') || title.includes('adiccion') || title.includes('riesgo') || title.includes('resilien')) {
    return 'Necesidad de cultivar una cultura de autocuidado, alimentación balanceada y prevención de conductas de riesgo (alcoholismo, sustancias nocivas y sedentarismo) en los estudiantes y su comunidad.';
  }
  if (title.includes('recicla') || title.includes('ecolog') || title.includes('ambiente') || title.includes('tierra') || title.includes('basura') || title.includes('verde')) {
    return 'Acumulación de residuos sólidos plásticos y necesidad de implementar acciones comunitarias de reciclaje, conservación ambiental y sustentabilidad escolar.';
  }
  if (title.includes('palapa') || title.includes('infraestructura') || title.includes('espacio') || title.includes('obra')) {
    return 'Carencia de espacios adecuados y áreas techadas para el descanso, trabajo colaborativo y convivencia saludable del estudiantado.';
  }
  if (title.includes('academ') || title.includes('lectura') || title.includes('aprendizaje') || title.includes('habilidad')) {
    return 'Bajo aprovechamiento escolar y necesidad de fortalecer las habilidades cognitivas, lectoras y socioemocionales de los alumnos vinculadas a su entorno.';
  }

  // Síntesis predeterminada coherente con el nombre del proyecto
  const projectLabel = projectName ? `del proyecto "${projectName}"` : 'escolar y comunitario';
  return `Atención a las necesidades formativas y comunitarias identificadas en el marco ${projectLabel}, orientadas a favorecer el bienestar integral de los estudiantes y su vinculación con la localidad.`;
}
