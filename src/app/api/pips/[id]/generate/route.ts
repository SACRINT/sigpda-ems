import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generateWithRotation, logActivity } from '@/lib/ai-provider';
import {
  PIPS_SYSTEM_PROMPT,
  getChunk1Prompt,
  getChunk2Prompt,
  getChunk3Prompt,
} from '@/lib/prompts/pips-chunks';
import { getUserLibraryContext } from '@/lib/context-extractor';
import { getNormativaForGenerator } from '@/lib/normativa-context';

export const runtime = 'nodejs';
export const maxDuration = 180; // 3 minutos máximo en Next.js/Vercel

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(
  _req: NextRequest,
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

    // ── Ejecución de la IA por Chunks (Secuencial con Rotación) ─────────────
    console.log(`[PIPS-Gen] Iniciando generación de PIPS para Zona 004 en 3 partes...`);

    const libraryContext = await getUserLibraryContext(teacher.email);

    // PARTE 1: Presentación + Fundamentación Normativa + Diagnóstico
    // Inyectamos la normativa oficial en el Chunk 1, que incluye la sección
    // "FUNDAMENTACIÓN NORMATIVA" del PIPS. El contexto de biblioteca complementa.
    const normativaContext = await getNormativaForGenerator('pips');
    const prompt1 = getChunk1Prompt(row, plantelesData, totalAlumnos, totalPersonal);

    let prompt1WithCtx = prompt1;
    if (normativaContext) prompt1WithCtx = `${normativaContext}\n\n${prompt1WithCtx}`;
    if (libraryContext) prompt1WithCtx = `${libraryContext}\n\n${prompt1WithCtx}`;

    const chunk1Result = await generateWithRotation(PIPS_SYSTEM_PROMPT, prompt1WithCtx, teacher.id);
    console.log(`[PIPS-Gen] Parte 1 generada exitosamente. Esperando cooldown...`);
    await sleep(1000); // 1s de cooldown para evitar RPM limits en la API Key

    // PARTE 2
    const prompt2 = getChunk2Prompt(row, chunk1Result);
    const prompt2WithCtx = libraryContext ? `${libraryContext}\n\n${prompt2}` : prompt2;
    const chunk2Result = await generateWithRotation(PIPS_SYSTEM_PROMPT, prompt2WithCtx, teacher.id);
    console.log(`[PIPS-Gen] Parte 2 generada exitosamente. Esperando cooldown...`);
    await sleep(1000);

    // PARTE 3
    const prompt3 = getChunk3Prompt(row, chunk1Result + '\n\n' + chunk2Result);
    const prompt3WithCtx = libraryContext ? `${libraryContext}\n\n${prompt3}` : prompt3;
    const chunk3Result = await generateWithRotation(PIPS_SYSTEM_PROMPT, prompt3WithCtx, teacher.id);
    console.log(`[PIPS-Gen] Parte 3 generada exitosamente. Armando resultado...`);

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

    // Registrar actividad en la plataforma
    await logActivity({
      teacherEmail: session.user.email,
      action: 'generate_pips',
      entityType: 'pips',
      entityId: id,
      success: true,
      tokensApprox: Math.round(fullContent.length / 4),
    });

    return NextResponse.json({ success: true, content: fullContent });
  } catch (error: any) {
    console.error('Error generating PIPS por chunks:', error);
    return NextResponse.json(
      { error: 'Error al generar el PIPS con IA: ' + (error?.message || 'Error desconocido') },
      { status: 500 }
    );
  }
}
