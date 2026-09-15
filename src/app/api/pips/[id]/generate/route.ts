import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generateWithRotation, logActivity } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import {
  PIPS_SYSTEM_PROMPT,
  getChunk1Prompt,
  getChunk2Prompt,
  getChunk3Prompt,
} from '@/lib/prompts/pips-chunks';
import { getUserLibraryContext } from '@/lib/context-extractor';
import { getNormativaForGenerator } from '@/lib/normativa-context';
import { extractIdempotencyKey, checkIdempotencyKey, createIdempotencyKey } from '@/lib/idempotency';

export const runtime = 'nodejs';
export const maxDuration = 180; // 3 minutos máximo en Next.js/Vercel

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;

    // Mejora #24: Verificación de Idempotencia y Deduplicación
    const idempotencyKey = extractIdempotencyKey(req);
    const cachedResult = await checkIdempotencyKey(
      idempotencyKey,
      teacher.id,
      `/api/pips/${id}/generate`
    );
    if (cachedResult) {
      return NextResponse.json(cachedResult, {
        headers: { 'X-Idempotency-Hit': 'true' },
      });
    }

    const db = sql();

    // Obtener los datos actuales del proyecto PIPS
    const [row] = await db`
      SELECT * FROM pips_projects
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
    `;

    if (!row) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // ── Cruce y Extracción de Datos ──────────────────────────────────────────
    const plantelesRaw = Array.isArray(row.planteles_json) ? row.planteles_json : [];
    const totalAlumnos = plantelesRaw.reduce(
      (acc: number, p: any) => acc + (Number(p.total) || 0),
      0
    );

    // Mapear planteles con análisis básico
    const plantelesData = plantelesRaw.map((p: any) => ({
      nombre: p.nombre || 'Sin nombre',
      cct: p.cct || 'Sin CCT',
      municipio: p.municipio || 'Sin municipio',
      total_alumnos: Number(p.total) || 0,
      docentes_count: Number(p.docentes) || 0,
      admin_count: Number(p.admin) || 0,
      apoyo_count: Number(p.apoyo) || 0,
      horas_totales: Number(p.horas) || 0,
      cumplimiento_pmc: p.cumplimiento_pmc || 'Pendiente',
      evaluacion_paec: p.evaluacion_paec || 'Pendiente',
    }));

    // Cuentas agregadas de personal en la zona
    const totalPersonal = plantelesRaw.reduce(
      (acc: any, p: any) => {
        acc.docentes += Number(p.docentes) || 0;
        acc.responsables += Number(p.responsables || (p.docentes > 0 ? 1 : 0)) || 0;
        acc.apoyo += (Number(p.admin) || 0) + (Number(p.apoyo) || 0);
        acc.horas += Number(p.horas) || 0;
        return acc;
      },
      { docentes: 0, responsables: 0, apoyo: 0, horas: 0 }
    );
    totalPersonal.total = totalPersonal.docentes + totalPersonal.responsables + totalPersonal.apoyo;

async function generateChunkWithRetry(
  systemPrompt: string,
  userPrompt: string,
  teacherId: string,
  chunkName: string,
  maxRetries = 2
): Promise<string> {
  let attempt = 0;
  let delay = 1500;
  while (attempt <= maxRetries) {
    try {
      logger.info(`[PIPS-Gen] Generando ${chunkName} (intento ${attempt + 1}/${maxRetries + 1})...`);
      const result = await generateWithRotation(systemPrompt, userPrompt, teacherId);
      if (result && result.trim().length > 0) {
        return result;
      }
      throw new Error(`Respuesta vacía al generar ${chunkName}`);
    } catch (err: any) {
      attempt++;
      logger.warn(`[PIPS-Gen] Falla en ${chunkName} (intento ${attempt}/${maxRetries + 1}): ${err?.message || err}`);
      if (attempt > maxRetries) {
        throw err;
      }
      logger.info(`[PIPS-Gen] Esperando ${delay}ms antes de reintentar ${chunkName}...`);
      await sleep(delay);
      delay *= 2;
    }
  }
  throw new Error(`No se pudo generar ${chunkName} tras ${maxRetries + 1} intentos.`);
}

    // ── Ejecución de la IA por Chunks (Secuencial con Rotación & Checkpoints) ───
    logger.info(`[PIPS-Gen] Iniciando generación de PIPS para Zona 004 en 3 partes con checkpoints...`);

    const libraryContext = await getUserLibraryContext(teacher.email);

    // PARTE 1: Presentación + Fundamentación Normativa + Diagnóstico
    const normativaContext = await getNormativaForGenerator('pips');
    const prompt1 = getChunk1Prompt(row, plantelesData, totalAlumnos, totalPersonal);

    let prompt1WithCtx = prompt1;
    if (normativaContext) prompt1WithCtx = `${normativaContext}\n\n${prompt1WithCtx}`;
    if (libraryContext) prompt1WithCtx = `${libraryContext}\n\n${prompt1WithCtx}`;

    const chunk1Result = await generateChunkWithRetry(
      PIPS_SYSTEM_PROMPT,
      prompt1WithCtx,
      teacher.id,
      'Parte 1 (Presentación + Normativa + Diagnóstico)'
    );

    // Checkpoint 1: Persistir resultado parcial
    await db`
      UPDATE pips_projects
      SET generated_content = ${chunk1Result},
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
    logger.info(`[PIPS-Gen] Checkpoint 1/3 guardado exitosamente en BD. Esperando cooldown...`);
    await sleep(1000);

    // PARTE 2: Problemáticas Prioritarias y Metas Zonales
    const prompt2 = getChunk2Prompt(row, chunk1Result);
    const prompt2WithCtx = libraryContext ? `${libraryContext}\n\n${prompt2}` : prompt2;
    const chunk2Result = await generateChunkWithRetry(
      PIPS_SYSTEM_PROMPT,
      prompt2WithCtx,
      teacher.id,
      'Parte 2 (Problemáticas y Metas Zonales)'
    );

    // Checkpoint 2: Persistir resultado parcial acumulado
    const partialContent1_2 = [chunk1Result, chunk2Result].join('\n\n');
    await db`
      UPDATE pips_projects
      SET generated_content = ${partialContent1_2},
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
    logger.info(`[PIPS-Gen] Checkpoint 2/3 guardado exitosamente en BD. Esperando cooldown...`);
    await sleep(1000);

    // PARTE 3: Cronograma y Evaluación
    const prompt3 = getChunk3Prompt(row, partialContent1_2);
    const prompt3WithCtx = libraryContext ? `${libraryContext}\n\n${prompt3}` : prompt3;
    const chunk3Result = await generateChunkWithRetry(
      PIPS_SYSTEM_PROMPT,
      prompt3WithCtx,
      teacher.id,
      'Parte 3 (Cronograma y Mecanismos de Evaluación)'
    );
    logger.info(`[PIPS-Gen] Parte 3 generada exitosamente. Consolidando documento final...`);

    // Unir las tres partes en un único documento Markdown estructurado
    const fullContent = [
      chunk1Result,
      chunk2Result,
      chunk3Result,
    ].join('\n\n');

    // Guardar el contenido final y marcar el proyecto como completado
    await db`
      UPDATE pips_projects
      SET generated_content = ${fullContent},
          status = 'completed',
          current_step = 6,
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
    logger.info(`[PIPS-Gen] Checkpoint 3/3 finalizado y guardado con status 'completed'.`);

    // Registrar actividad en la plataforma
    await logActivity({
      teacherEmail: session.user.email,
      action: 'generate_pips',
      entityType: 'pips',
      entityId: id,
      success: true,
      tokensApprox: Math.round(fullContent.length / 4),
    });

    const responsePayload = { success: true, content: fullContent };
    if (idempotencyKey) {
      await createIdempotencyKey(
        idempotencyKey,
        teacher.id,
        `/api/pips/${id}/generate`,
        responsePayload
      );
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    logger.error('POST /api/pips/[id]/generate error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Error interno del servidor al generar PIPS',
      hasPartialCheckpoint: true
    }, { status: 500 });
  }
}
