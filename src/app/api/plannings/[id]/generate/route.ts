import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { 
  getTeacherByEmail, 
  getPlanningById, 
  updatePlanningContent,
  getProgramByUacAndSemester,
  getFfeContinuity,
  getAuditResultByPlanningId,
} from '@/lib/db';
import { generatePlanningStream } from '@/lib/gemini';
import { logActivity } from '@/lib/ai-provider';
import { buildUserPrompt } from '@/lib/prompts/build-prompt';
import { getUserLibraryContext } from '@/lib/context-extractor';
import { searchCurriculum } from '@/lib/rag-curricular';
import type { ExtractedPdfData, TeacherContext } from '@/types/planning';
import type { RagContext } from '@/lib/rag-curricular';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
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
    const planning = await getPlanningById(id, teacher.id);
    if (!planning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { extractedData, context } = body as {
      extractedData: ExtractedPdfData;
      context: TeacherContext;
    };

    if (!extractedData || !context) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos: extractedData y context' },
        { status: 400 }
      );
    }

    // 1. Consultar programa auténtico oficial de programs_catalog
    const officialProgram = await getProgramByUacAndSemester(
      planning.uac_name || extractedData.uacName,
      planning.semester,
      planning.component,
      context.subsystem
    );

    // 2. Si es FFE optativa o semestre 5/6, consultar continuidad
    let continuityInfo = null;
    if (planning.component === 'ext_optativo' || planning.semester === 5 || planning.semester === 6) {
      continuityInfo = await getFfeContinuity(planning.uac_name || extractedData.uacName);
    }

    // 3. Consultar si hay retroalimentación de auditoría pedagógica previa
    const previousAudit = await getAuditResultByPlanningId(id);
    const auditFeedback = previousAudit ? {
      overall_score: previousAudit.overall_score,
      compliance_level: previousAudit.compliance_level,
      findings: previousAudit.findings,
      recommendations: previousAudit.recommendations,
    } : null;

    // 4. RAG Curricular: recuperar chunks semánticos relevantes (fail-safe, 3s timeout)
    let ragContext: RagContext | null = null;
    try {
      const uacQuery = planning.uac_name || extractedData.uacName || '';
      const ragPromise = searchCurriculum(uacQuery, {
        semester: planning.semester as number,
        component: planning.component as string,
        subsystem: context.subsystem,
        matchCount: 4,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RAG timeout')), 3000)
      );
      ragContext = await Promise.race([ragPromise, timeoutPromise]);
      const chunkCount = ragContext?.chunks?.length ?? 0;
      console.log(`[RAG] Found ${chunkCount} curriculum chunks for "${uacQuery}"`);
    } catch (ragErr) {
      console.warn('[RAG] Skipped (fail-safe):', (ragErr as Error).message);
      ragContext = null;
    }

    // 5. Construir prompt con catálogo auténtico, RAG y feedback de auditoría
    const userPrompt = buildUserPrompt(
      extractedData,
      context,
      planning.semester as number,
      planning.component as string,
      officialProgram,
      auditFeedback,
      continuityInfo,
      ragContext
    );

    const libraryContext = await getUserLibraryContext(session.user.email!);

    // NOTA: La normativa oficial NO se inyecta en planeaciones didácticas de aula.
    // Decisión de diseño DBEPA: solo PMC y PIPS llevan fundamentación jurídica.

    let fullUserPrompt = userPrompt;
    if (libraryContext) {
      fullUserPrompt += `\n\n${libraryContext}`;
    }

    const teacherEmail = session.user.email!;
    const encoder = new TextEncoder();

    // ReadableStream: feed AI chunks to the frontend
    const stream = new ReadableStream({
      async start(controller) {
        let accumulatedText = '';
        try {
          const textGenerator = await generatePlanningStream(fullUserPrompt, teacher.id);
          
          for await (const chunk of textGenerator) {
            accumulatedText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          // Once generation is finished, parse and save to database
          try {
            const cleanJson = accumulatedText
              .replace(/^```(?:json)?\n?/m, '')
              .replace(/\n?```$/m, '')
              .trim();
            const parsedContent = JSON.parse(cleanJson);
            
            await updatePlanningContent(id, teacher.id, parsedContent);

            // Send Realtime / In-App Notification (Phase 8A.1)
            try {
              const { sendNotification } = await import('@/lib/notifications');
              await sendNotification({
                userId: teacher.id,
                type: 'planeacion_ready',
                title: 'Planeación Generada con Éxito',
                message: `Tu planeación para ${planning.uac_name || 'tu asignatura'} (${planning.semester}° Semestre) está lista para revisión.`,
                link: `/dashboard/planning/${id}`,
                severity: 'success',
                channels: ['in_app'],
                metadata: {
                  planningId: id,
                  uacName: planning.uac_name,
                  semester: planning.semester,
                  component: planning.component,
                  email: teacherEmail,
                },
              });
            } catch (notifErr) {
              console.warn('Could not dispatch planeacion_ready notification:', notifErr);
            }

            // Log successful generation
            await logActivity({
              teacherEmail,
              action: 'generate_planning',
              entityType: 'planning',
              entityId: id,
              success: true,
            });
          } catch (dbErr) {
            console.error('Failed to parse or save accumulated JSON stream to database:', dbErr);
          }


          controller.close();
        } catch (streamErr) {
          const errMsg = streamErr instanceof Error ? streamErr.message : 'Error desconocido al generar';
          console.error('Stream generation error:', errMsg);
          // Send the error as a readable marker through the stream so the frontend can show it
          controller.enqueue(encoder.encode(`__ERROR__:${errMsg}`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Generate planning error:', message);
    return NextResponse.json(
      { error: message || 'Error al generar la planeación' },
      { status: 500 }
    );
  }
}
