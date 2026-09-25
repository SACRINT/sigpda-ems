/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { ingestDocument } from '@/lib/document-ingestion';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { PaecExtractedDocSchema } from '@/lib/ai-schemas';
import type { PaecOperationalActivity, PaecParseResult } from '@/types/planning';
import { normalizeUnicode } from '@/lib/utils/normalize';
import { removeHyphens } from '@/lib/text-utils';

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
    const file = (formData.get('pdf') as File) || (formData.get('file') as File);

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Ingesta documental nativa (PDF Digital, Escaneado con OCR Flash Lite, o Word .docx)
    let ingested;
    try {
      ingested = await ingestDocument(buffer, {
        filename: file.name,
        mimeType: file.type,
        enableOcr: true,
        teacherId: teacher.id,
      });
    } catch (err: any) {
      logger.error('[paec-parser] Document ingestion failed:', err);
      return NextResponse.json({ error: `No se pudo leer el archivo: ${err.message || 'Formato no válido'}` }, { status: 400 });
    }

    const documentText = ingested.markdown || ingested.fullText;

    if (!documentText || documentText.trim().length < 50) {
      return NextResponse.json({ error: 'El archivo no contiene texto legible.' }, { status: 400 });
    }

    // 2. Extracción estructurada multi-nivel (IA NEM -> Heurísticas multi-ancla -> Síntesis como último recurso)
    const parsedData: PaecParseResult = {
      projectName: null,
      objective: null,
      problem: null,
      studentContext: null,
      schoolName: null,
      municipality: null,
      cct: null,
      isSuggestedProblem: false,
      planOperativo: [],
    };

    // Nivel 1: Modelo de IA con prompt pedagógico NEM
    try {
      const geminiResult = await structurePaecWithAI(documentText, teacher.id);
      parsedData.projectName = geminiResult.projectName || null;
      parsedData.objective = geminiResult.objective || null;
      parsedData.problem = geminiResult.problem || null;
      parsedData.studentContext = geminiResult.studentContext || null;
      parsedData.schoolName = geminiResult.schoolName || null;
      parsedData.municipality = geminiResult.municipality || null;
      parsedData.cct = geminiResult.cct || null;
      parsedData.isSuggestedProblem = false;
      if (Array.isArray(geminiResult.planOperativo) && geminiResult.planOperativo.length > 0) {
        parsedData.planOperativo = geminiResult.planOperativo
          .filter((item: any) => item && (item.asignatura || item.uac) && item.actividad)
          .map((item: any) => ({
            asignatura: String(item.asignatura || item.uac || '').trim(),
            actividad: String(item.actividad || '').trim(),
            propositoFormativo: item.propositoFormativo ? String(item.propositoFormativo).trim() : undefined,
            estrategiaDidactica: item.estrategiaDidactica ? String(item.estrategiaDidactica).trim() : undefined,
            semana: item.semana ? String(item.semana).trim() : undefined,
            fase: item.fase ? String(item.fase).trim() : undefined,
            progresion: item.progresion ? String(item.progresion).trim() : undefined,
            isPrescheduled: true,
          }));
      }
    } catch (err: any) {
      logger.warn('[paec-parser] Gemini call failed, falling back to heuristics:', err.message || err);
    }

    // Nivel 2: Heurísticas multi-ancla sobre el texto extraído
    const heuristicResult = parsePaecHeuristics(ingested.fullText || documentText);
    if (!parsedData.projectName && heuristicResult.projectName) parsedData.projectName = heuristicResult.projectName;
    if (!parsedData.objective && heuristicResult.objective) parsedData.objective = heuristicResult.objective;
    if (!parsedData.studentContext && heuristicResult.studentContext) parsedData.studentContext = heuristicResult.studentContext;
    if (!parsedData.schoolName && heuristicResult.schoolName) parsedData.schoolName = heuristicResult.schoolName;
    if (!parsedData.municipality && heuristicResult.municipality) parsedData.municipality = heuristicResult.municipality;
    if (!parsedData.cct && heuristicResult.cct) parsedData.cct = heuristicResult.cct;
    if ((!parsedData.planOperativo || parsedData.planOperativo.length === 0) && heuristicResult.planOperativo?.length) {
      parsedData.planOperativo = heuristicResult.planOperativo;
    }

    if (!parsedData.problem || parsedData.problem.trim().length === 0) {
      if (heuristicResult.problem) {
        parsedData.problem = heuristicResult.problem;
        parsedData.isSuggestedProblem = false;
      }
    }

    // Nivel 3: Síntesis como ÚLTIMO RECURSO
    // Solo si tanto Gemini como las heurísticas no encontraron problemática
    if (!parsedData.problem || parsedData.problem.trim().length === 0) {
      parsedData.problem = synthesizeProblemFallback(
        parsedData.projectName || '',
        parsedData.objective || '',
        parsedData.studentContext || ''
      );
      parsedData.isSuggestedProblem = true;
    }

    // Deshiphenization y normalización general de campos
    const sanitizeText = (val: string | null | undefined): string | null => {
      if (!val) return null;
      const cleaned = removeHyphens(val).replace(/\s+/g, ' ').trim();
      return cleaned.length > 0 ? cleaned : null;
    };

    parsedData.projectName = sanitizeText(parsedData.projectName);
    parsedData.objective = sanitizeText(parsedData.objective);
    parsedData.problem = sanitizeText(parsedData.problem);
    parsedData.studentContext = sanitizeText(parsedData.studentContext);
    parsedData.schoolName = sanitizeText(parsedData.schoolName);
    parsedData.municipality = sanitizeText(parsedData.municipality);
    parsedData.cct = sanitizeText(parsedData.cct);

    if (Array.isArray(parsedData.planOperativo)) {
      parsedData.planOperativo = parsedData.planOperativo.map((act) => ({
        ...act,
        asignatura: sanitizeText(act.asignatura) || act.asignatura,
        actividad: sanitizeText(act.actividad) || act.actividad,
        propositoFormativo: sanitizeText(act.propositoFormativo) || undefined,
        estrategiaDidactica: sanitizeText(act.estrategiaDidactica) || undefined,
      }));
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error) {
    logger.error('POST /api/pdf/parse-paec error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ─── Estructuración con IA (Prompt Especializado NEM) ─────────────────────────
async function structurePaecWithAI(smartText: string, teacherId?: string) {
  const systemInstruction = `Eres un experto pedagógico en el Programa Aula, Escuela y Comunidad (PAEC) y el Proyecto Escolar Comunitario (PEC) de la Nueva Escuela Mexicana (NEM) en la Educación Media Superior (Puebla, México). Tu tarea es analizar con máxima fidelidad los diagnósticos, problemas y contextos del proyecto. Responde exclusivamente con un objeto JSON válido, sin markdown ni explicaciones adicionales.`;

  const prompt = `Analiza el siguiente texto de un documento oficial PAEC/PEC de un bachillerato y extrae en formato JSON:

{
  "projectName": "Nombre o título oficial del Proyecto Escolar Comunitario (PEC)",
  "objective": "Objetivo general, propósito formativo o meta del proyecto",
  "problem": "Problemática comunitaria detectada que se abordará en el PEC",
  "studentContext": "Caracterización o contexto sociocultural y escolar de los estudiantes y el plantel",
  "schoolName": "Nombre oficial del plantel educativo o bachillerato (ej: Bachillerato General Estatal Héroes de la Patria)",
  "municipality": "Municipio o localidad donde se encuentra el plantel (ej: Venustiano Carranza)",
  "cct": "Clave de Centro de Trabajo CCT de 10 caracteres (ej: 21EBH0200X)",
  "planOperativo": [
    {
      "asignatura": "Nombre de la Asignatura / UAC (ej: Pensamiento Matemático I)",
      "actividad": "Nombre o descripción de la actividad acordada en el PAEC",
      "propositoFormativo": "Propósito formativo o aprendizaje esperado",
      "estrategiaDidactica": "Estrategia didáctica o metodología",
      "semana": "Semana o semanas de aplicación (ej: Semana 3)",
      "fase": "Fase del proyecto (ej: Fase 2: Acción y Aprendizaje)",
      "progresion": "Progresión o meta curricular si se indica"
    }
  ]
}

INSTRUCCIONES CRÍTICAS PARA LA EXTRACCIÓN:
1. "problem": Busca EXPLÍCITAMENTE la sección titulada "Problemáticas o necesidades de la comunidad", "Selección del problema para el PEC", "Problema central", "Problemática detectada" o tablas de diagnóstico por etapas (Etapa uno: Recuperación de información, Etapa dos: Sistematización y análisis FODA, Etapa tres: Selección del problema). Extrae la Etapa 3 (o la síntesis consolidada de las etapas) detallando la problemática comunitaria concreta (por ejemplo: adicciones, alcoholismo, hábitos alimenticios deficientes, falta de espacios deportivos, contaminación/basura, bajo aprovechamiento académico, falta de infraestructura techada, etc.). Debe ser un texto descriptivo, claro y suficiente (2-4 oraciones) para guiar la planeación didáctica.
2. "projectName": Título COMPLETO e ÍNTEGRO del PEC o proyecto comunitario, incluyendo subtítulos entre paréntesis o tras dos puntos si los tiene (ej: "Comunidad Resiliente: Vida Saludable (Bienestar Integral y Prevención de Riesgos)"). NUNCA lo trunques ni lo dejes a medias.
3. "objective": Propósito o meta formativa del proyecto comunitario.
4. "studentContext": Elabora una CARACTERIZACIÓN INTEGRAL de los estudiantes y el plantel estructurada y enfocada a la planeación didáctica, sintetizando de forma coherente y clara:
   - Entorno comunitario y socioeconómico (localidad, actividades económicas principales, nivel socioeconómico de las familias).
   - Características y fortalezas de los estudiantes (habilidades de trabajo colaborativo, deportes, cultura, intereses).
   - Factores de riesgo o necesidades prioritarias (hábitos alimenticios, conductas de riesgo, estrés, vulnerabilidades).
   - Características del plantel y recursos (matrícula, infraestructura disponible, áreas deportivas o comunitarias de apoyo).
   - Indicadores educativos clave (aprovechamiento, deserción, reprobación si se mencionan).
   Debe ser un resumen articulado, fluido y profesional (2 a 4 párrafos concisos) que sirva como diagnóstico directo para diseñar actividades didácticas contextualizadas.
5. "schoolName": Nombre oficial del bachillerato o plantel (si aparece en portada o encabezados).
6. "municipality": Municipio o localidad donde está ubicado el plantel.
7. "cct": Clave CCT de 10 caracteres alfanuméricos (ej: 21EBH0200X).
8. "planOperativo": Busca de manera exhaustiva tablas o secciones tituladas "Plan Operativo", "Cronograma Operativo del PEC", "Plan de Trabajo por Asignaturas", "Cronograma de Actividades", "Mapeo de UACs" o "Matriz de Vinculación Curricular". Extrae un elemento para CADA asignatura o UAC que tenga una actividad asignada (incluyendo Pensamiento Matemático, Lengua y Comunicación, La Materia y sus Interacciones, Ciencias Sociales, Humanidades, Cultura Digital, Inglés, etc. en cualquier semestre del proyecto). Si no se contemplan actividades por asignatura, retorna un arreglo vacío [].
9. Si no encuentras algún campo con certeza absoluta, asigna null (o [] en planOperativo).

TEXTO DEL DOCUMENTO:
${smartText}`;

  const isPremium = await resolveUserIsPremium(teacherId);
  const rawJsonText = await generateWithRotation(
    systemInstruction,
    prompt,
    teacherId,
    isPremium,
    { jsonMode: true }
  );
  const parseResult = parseAIResponse(rawJsonText, PaecExtractedDocSchema, {
    contextName: 'paec_pdf_parse',
    repairNullStrings: true,
  });
  if (!parseResult.success) {
    throw new Error(`Error estructurando PAEC con IA: ${parseResult.error}`);
  }

  return parseResult.data;
}

// ─── Heurísticas Multi-Ancla sobre Todo el Texto ──────────────────────────────
function parsePaecHeuristics(text: string): {
  projectName: string | null;
  objective: string | null;
  problem: string | null;
  studentContext: string | null;
  schoolName: string | null;
  municipality: string | null;
  cct: string | null;
  planOperativo: PaecOperationalActivity[];
} {
  let projectName: string | null = null;
  let objective: string | null = null;
  let problem: string | null = null;
  let studentContext: string | null = null;
  let schoolName: string | null = null;
  let municipality: string | null = null;
  let cct: string | null = null;

  const planOperativo = parsePlanOperativoHeuristics(text);

  // 1. Nombre del proyecto (Multi-ancla con soporte para subtítulos en paréntesis)
  // Patrón A: Entrecomillado oficial (ej: titulado: "Comunidad Resiliente: Vida Saludable (Bienestar Integral y Prevención de Riesgos)")
  const nameMatchQuotes = text.match(/(?:titulado|denominado|nombre del proyecto|proyecto[:\s])\s*[:\-\s]*["'«“]([\s\S]*?)["'»”]/i);
  if (nameMatchQuotes && nameMatchQuotes[1]?.trim().length > 5) {
    projectName = nameMatchQuotes[1].trim();
  }

  if (!projectName) {
    // Patrón B: Portada estructurada (PROYECTO ESCOLAR COMUNITARIO \n Nombre \n (Subtítulo))
    const nameMatchCover = text.match(/(?:PROYECTO\s+ESCOLAR\s+COMUNITARIO(?:\s*\(PEC\))?|PEC)\s*[\r\n]+#*\s*([A-ZÁÉÍÓÚ0-9][^\r\n]{4,100})(?:\s*[\r\n]+#*\s*(\([^\r\n\)]+\)))?/i);
    if (nameMatchCover) {
      projectName = nameMatchCover[1].trim() + (nameMatchCover[2] ? ' ' + nameMatchCover[2].trim() : '');
    }
  }

  if (!projectName) {
    // Patrón C: PEC titulado / denominado
    const nameMatch1 = text.match(/(?:PEC titulado|PEC denominado|proyecto denominado|proyecto titulado)\s*[:\-\s]*["'«“](.*?)["'»”]/i) 
      || text.match(/PEC titulado\s*["'«“]?([^\r\n"»”]+(?:\s*\([^\)]+\))?)(?:\.|\r?\n|$)/i);
    if (nameMatch1) {
      projectName = nameMatch1[1].trim();
    } else {
      const nameMatch2 = text.match(/(?:PROYECTO ESCOLAR COMUNITARIO|PEC)\s*[:\-\s]+([^\n\r]{10,120})/i);
      if (nameMatch2) {
        projectName = nameMatch2[1].trim();
      }
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

  // 4. Caracterización / Contexto de estudiantes y plantel (Multi-ancla integral)
  const contextParts: string[] = [];

  const ubMatch = text.match(/(?:Ubicación\s+geográfica|Localidad)[:\s]*([^\n\r]+(?:,\s*[^\n\r]+){1,3})/i);
  if (ubMatch) {
    contextParts.push(`Ubicación y Entorno: ${ubMatch[1].trim()}`);
  }

  const ecoMatch = text.match(/(?:Situación\s+socioeconómica|Economía\s+local|Actividades\s+principales)[:\s]*([^\n\r]+(?:\r?\n[^\n\r]+){0,3})/i);
  if (ecoMatch) {
    contextParts.push(`Contexto Socioeconómico: ${ecoMatch[1].trim()}`);
  }

  const estMatch = text.match(/(?:Características\s+del\s+estudiantado|Perfil\s+del\s+estudiante|Contexto\s+estudiantil)[:\s]*([\s\S]*?)(?=\b(?:Características\s+del\s+plantel|Contexto\s+familiar|Indicadores|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
  if (estMatch && estMatch[1]?.trim().length > 20) {
    contextParts.push(`Perfil del Estudiantado: ${estMatch[1].trim()}`);
  }

  const famMatch = text.match(/(?:Contexto\s+familiar|Entorno\s+familiar)[:\s]*([\s\S]*?)(?=\b(?:Características\s+del\s+estudiantado|Características\s+del\s+plantel|Indicadores|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
  if (famMatch && famMatch[1]?.trim().length > 20) {
    contextParts.push(`Contexto Familiar: ${famMatch[1].trim()}`);
  }

  const plantMatch = text.match(/(?:Características\s+del\s+plantel|Infraestructura\s+escolar|Instalaciones\s+y\s+equipamiento)[:\s]*([\s\S]*?)(?=\b(?:Indicadores\s+educativos|Programas|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
  if (plantMatch && plantMatch[1]?.trim().length > 20) {
    contextParts.push(`Infraestructura del Plantel: ${plantMatch[1].trim()}`);
  }

  const indMatch = text.match(/(?:Indicadores\s+educativos\s+del\s+plantel|Indicadores\s+académicos)[:\s]*([\s\S]*?)(?=\b(?:Programas|Instalaciones|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
  if (indMatch && indMatch[1]?.trim().length > 20) {
    contextParts.push(`Indicadores Educativos: ${indMatch[1].trim()}`);
  }

  const analMatch = text.match(/(?:Análisis\s+general|Diagnóstico\s+general|Síntesis\s+del\s+diagnóstico)[:\s]*([A-ZÁÉÍÓÚ][^\n\r]*(?:\r?\n[^\n\r]*){0,10})/i);
  if (analMatch && analMatch[1]?.trim().length > 30) {
    contextParts.push(`Diagnóstico Síntesis: ${analMatch[1].trim()}`);
  }

  if (contextParts.length > 0) {
    studentContext = contextParts.join('\n\n');
  } else {
    // Fallback general amplio
    const fallbackMatch = text.match(/(?:Características\s+del\s+estudiantado|Caracterización\s+de\s+los\s+estudiantes|Contexto\s+estudiantil|Características\s+de\s+la\s+comunidad|Diagnóstico\s+colectivo)\s*[:\-\s]*([A-ZÁÉÍÓÚ][\s\S]*?)(?=\b(?:Fase\s+2|Fase\s+II|1\.\s+Introducción|Propósito|FODA|=== PÁGINA|$))/i);
    if (fallbackMatch && fallbackMatch[1]?.trim().length > 30) {
      studentContext = fallbackMatch[1].trim();
    }
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

  // Normalización de espacios, remoción de etiquetas de página y deshiphenization
  const clean = (s: string) => removeHyphens(s.replace(/=== PÁGINA \d+ ===/g, '').replace(/#+/g, '').replace(/\s+/g, ' ').trim());

  return {
    projectName: projectName ? clean(projectName) : null,
    objective: objective ? clean(objective) : null,
    problem: problem ? clean(problem) : null,
    studentContext: studentContext ? clean(studentContext) : null,
    schoolName: schoolName ? clean(schoolName) : null,
    municipality: municipality ? clean(municipality) : null,
    cct: cct ? clean(cct) : null,
    planOperativo,
  };
}

// ─── Extractor Heurístico de Tablas del Plan Operativo ─────────────────────────
function parsePlanOperativoHeuristics(text: string): PaecOperationalActivity[] {
  const activities: PaecOperationalActivity[] = [];
  const lines = text.split(/\r?\n/);

  let inTable = false;
  let colMap = {
    fase: -1,
    actividad: -1,
    asignatura: -1,
    proposito: -1,
    estrategia: -1,
    semana: -1,
    progresion: -1,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) {
      inTable = false;
      continue;
    }

    const cells = line.split('|').map(c => c.trim()).slice(1, -1);
    if (cells.length < 2) continue;

    // Normalizar celdas para detección de cabeceras
    const lowerCells = cells.map(c => normalizeUnicode(c));
    const hasAsignatura = lowerCells.some(c => c.includes('asignatura') || c.includes('uac') || c.includes('materia') || c.includes('disciplina'));
    const hasActividad = lowerCells.some(c => c.includes('actividad') || c.includes('accion') || c.includes('tarea'));

    if (hasAsignatura && hasActividad) {
      inTable = true;
      colMap = {
        fase: lowerCells.findIndex(c => c.includes('fase') || c.includes('etapa')),
        actividad: lowerCells.findIndex(c => c.includes('actividad') || c.includes('accion') || c.includes('tarea')),
        asignatura: lowerCells.findIndex(c => c.includes('asignatura') || c.includes('uac') || c.includes('materia') || c.includes('disciplina')),
        proposito: lowerCells.findIndex(c => c.includes('proposito') || c.includes('aprendizaje') || c.includes('objetivo')),
        estrategia: lowerCells.findIndex(c => c.includes('estrategia') || c.includes('metodolog')),
        semana: lowerCells.findIndex(c => c.includes('semana') || c.includes('periodo') || c.includes('fecha') || c.includes('tiempo')),
        progresion: lowerCells.findIndex(c => c.includes('progresion') || c.includes('meta')),
      };
      continue;
    }

    // Saltar línea separadora |---|---|
    if (inTable && cells.every(c => /^[-:\s]+$/.test(c))) {
      continue;
    }

    // Extraer fila de datos de la tabla
    if (inTable && colMap.asignatura !== -1 && colMap.actividad !== -1) {
      const asigText = cells[colMap.asignatura] || '';
      const actText = cells[colMap.actividad] || '';

      if (asigText && actText && !asigText.toLowerCase().includes('asignatura') && asigText.length > 2) {
        activities.push({
          asignatura: asigText.replace(/\*\*/g, '').trim(),
          actividad: actText.replace(/\*\*/g, '').trim(),
          fase: colMap.fase !== -1 && cells[colMap.fase] ? cells[colMap.fase].replace(/\*\*/g, '').trim() : undefined,
          propositoFormativo: colMap.proposito !== -1 && cells[colMap.proposito] ? cells[colMap.proposito].replace(/\*\*/g, '').trim() : undefined,
          estrategiaDidactica: colMap.estrategia !== -1 && cells[colMap.estrategia] ? cells[colMap.estrategia].replace(/\*\*/g, '').trim() : undefined,
          semana: colMap.semana !== -1 && cells[colMap.semana] ? cells[colMap.semana].replace(/\*\*/g, '').trim() : undefined,
          progresion: colMap.progresion !== -1 && cells[colMap.progresion] ? cells[colMap.progresion].replace(/\*\*/g, '').trim() : undefined,
          isPrescheduled: true,
        });
      }
    }
  }

  return activities;
}

// ─── Síntesis Contextual de Respaldo (Último Recurso) ──────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
