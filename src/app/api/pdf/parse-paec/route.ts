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
import { uacMatches } from '@/lib/paec-context';
import {
  parsePaecHeuristics,
  parsePlanOperativoHeuristics,
  synthesizeProblemFallback,
} from '@/lib/paec-heuristics';

export {
  parsePaecHeuristics,
  parsePlanOperativoHeuristics,
  synthesizeProblemFallback,
};

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Formato no válido';
      logger.error('[paec-parser] Document ingestion failed:', err);
      return NextResponse.json({ error: `No se pudo leer el archivo: ${msg}` }, { status: 400 });
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
          .filter((item) => item && (item.asignatura || item.uac) && item.actividad)
          .map((item) => ({
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[paec-parser] Gemini call failed, falling back to heuristics:', msg);
    }

    // Nivel 2: Heurísticas multi-ancla sobre el texto extraído (markdown estructurado con tablas)
    const heuristicResult = parsePaecHeuristics(documentText);
    if (!parsedData.projectName && heuristicResult.projectName) parsedData.projectName = heuristicResult.projectName;
    if (!parsedData.objective && heuristicResult.objective) parsedData.objective = heuristicResult.objective;
    if (!parsedData.studentContext && heuristicResult.studentContext) parsedData.studentContext = heuristicResult.studentContext;
    if (!parsedData.schoolName && heuristicResult.schoolName) parsedData.schoolName = heuristicResult.schoolName;
    if (!parsedData.municipality && heuristicResult.municipality) parsedData.municipality = heuristicResult.municipality;
    if (!parsedData.cct && heuristicResult.cct) parsedData.cct = heuristicResult.cct;
    
    // Fusión de plan operativo con prioridad oficial a filas heurísticas extraídas de la tabla
    const combinedPlan: PaecOperationalActivity[] = [];
    const seenUac = new Set<string>();

    if (heuristicResult.planOperativo?.length) {
      for (const hItem of heuristicResult.planOperativo) {
        combinedPlan.push(hItem);
        seenUac.add(normalizeUnicode(hItem.asignatura).toLowerCase().trim());
      }
    }

    if (Array.isArray(parsedData.planOperativo)) {
      for (const aiItem of parsedData.planOperativo) {
        const normAiAsig = normalizeUnicode(aiItem.asignatura).toLowerCase().trim();
        const alreadyCovered = Array.from(seenUac).some(existingAsig =>
          existingAsig === normAiAsig || uacMatches(existingAsig, normAiAsig)
        );
        if (!alreadyCovered) {
          combinedPlan.push(aiItem);
          seenUac.add(normAiAsig);
        }
      }
    }
    parsedData.planOperativo = combinedPlan;

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
        parsedData.objective || ''
      );
      parsedData.isSuggestedProblem = true;
    }

    // Deshiphenization, remoción de anclas de extracción y normalización general de campos
    const sanitizeText = (val: string | null | undefined): string | null => {
      if (!val) return null;
      const cleaned = removeHyphens(val)
        .replace(/⟦[^⟧]*⟧/g, '')
        .replace(/\s+/g, ' ')
        .trim();
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
