import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getTeacherByEmail,
  getPaecProjectById,
  updatePaecProjectStep,
  getProgramsCatalogForPaec,
} from '@/lib/db';
import {
  PAEC_SYSTEM_PROMPT,
  buildPrompt1Diagnostico,
  buildPrompt2Justificacion,
  buildPrompt3Mapeo,
  buildPrompt4Cronograma,
  buildPrompt5DetalleCurricular,
  buildPrompt6PlanOperativoPorBloque,
  buildPrompt7Anexos,
} from '@/lib/prompts/paec-prompts';
import { logActivity } from '@/lib/ai-provider';
import { callGeminiPool } from '@/lib/gemini';
import { getUserLibraryContext } from '@/lib/context-extractor';
import { parseAIResponse } from '@/lib/ai-response-parser';
import {
  PaecPaso1Schema,
  PaecPaso2Schema,
  PaecPaso3Schema,
  PaecPaso4Schema,
  PaecPaso5Schema,
  PaecPaso6BlockSchema,
  PaecPaso7Schema,
} from '@/lib/ai-schemas';
import { MapeoRow, PlanOperativoRow, PlanOperativoData } from '@/types/paec';

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
    const project = await getPaecProjectById(id, teacher.id);
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { step } = body as { step: number };

    if (!step || step < 1 || step > 7) {
      return NextResponse.json({ error: 'Número de paso no válido (debe ser de 1 a 7)' }, { status: 400 });
    }

    // Inyectar contexto de la biblioteca documental si existe
    const libraryContext = await getUserLibraryContext(session.user.email);

    let userPrompt = '';
    let fieldName = '';
    let planOperativoData: PlanOperativoData | null = null;

    switch (step) {
      case 1: {
        fieldName = 'fase1_diagnostico';
        const comm = JSON.stringify(project.community_context);
        const school = JSON.stringify(project.school_context);
        userPrompt = buildPrompt1Diagnostico(comm, school, project.problem_statement);
        break;
      }
      case 2: {
        fieldName = 'fase2_justificacion';
        if (!project.fase1_diagnostico) {
          return NextResponse.json({ error: 'Debes completar el Paso 1 primero' }, { status: 400 });
        }
        const diagStr = JSON.stringify(project.fase1_diagnostico);
        userPrompt = buildPrompt2Justificacion(diagStr, project.project_name, project.problem_statement);
        break;
      }
      case 3: {
        fieldName = 'fase2_mapeo';
        if (!project.fase2_justificacion) {
          return NextResponse.json({ error: 'Debes completar el Paso 2 primero' }, { status: 400 });
        }
        const justStr = JSON.stringify(project.fase2_justificacion);

        let semesters: number[] = [];
        if (project.cycle_type === 'A') {
          semesters = [1, 3, 5];
        } else if (project.cycle_type === 'B') {
          semesters = [2, 4, 6];
        } else {
          semesters = [1, 2, 3, 4, 5, 6];
        }

        const allUacs = await getProgramsCatalogForPaec(semesters) as { uac_name: string; semester: number; component: string }[];

        // Filter laboral/ffe UACs based on school selection
        const schoolCtx = (project.school_context || {}) as { activeLaboralUacs?: string[]; activeFfeUacs?: string[] };
        const activeLaboral = schoolCtx.activeLaboralUacs || [];
        const activeFfe = schoolCtx.activeFfeUacs || [];

        const uacs = allUacs.filter(u => {
          if (u.component === 'fundamental' || u.component === 'ampliado') {
            return true;
          }
          if (u.component === 'laboral') {
            return activeLaboral.includes(u.uac_name);
          }
          if (u.component === 'ext_obligatorio' || u.component === 'ext_optativo') {
            return activeFfe.includes(u.uac_name);
          }
          return false;
        });

        userPrompt = buildPrompt3Mapeo(justStr, uacs);
        break;
      }
      case 4: {
        fieldName = 'fase2_cronograma';
        if (!project.fase2_mapeo) {
          return NextResponse.json({ error: 'Debes completar el Paso 3 primero' }, { status: 400 });
        }
        const mapeoStr = JSON.stringify(project.fase2_mapeo);
        userPrompt = buildPrompt4Cronograma(mapeoStr, project.cycle_type);
        break;
      }
      case 5: {
        fieldName = 'fase2_detalle_curricular';
        if (!project.fase2_mapeo || !project.fase2_cronograma) {
          return NextResponse.json(
            { error: 'Debes completar el Paso 3 (Mapeo) y el Paso 4 (Cronograma) primero' },
            { status: 400 }
          );
        }
        const mapeoStr = JSON.stringify(project.fase2_mapeo);
        const cronStr = JSON.stringify(project.fase2_cronograma);
        userPrompt = buildPrompt5DetalleCurricular(mapeoStr, cronStr, project.cycle_type);
        break;
      }
      case 6: {
        fieldName = 'fase2_plan_operativo';
        if (!project.fase2_cronograma || !project.fase2_detalle_curricular) {
          return NextResponse.json(
            { error: 'Debes completar el Paso 4 (Cronograma) y el Paso 5 (Detalle Curricular) primero' },
            { status: 400 }
          );
        }

        const mapeo = (project.fase2_mapeo || []) as MapeoRow[];
        if (mapeo.length === 0) {
          return NextResponse.json(
            { error: 'No hay asignaturas en el Mapeo Curricular para generar el Plan Operativo' },
            { status: 400 }
          );
        }

        const cronStr = JSON.stringify(project.fase2_cronograma);
        const detStr = JSON.stringify(project.fase2_detalle_curricular);

        // Chunk UACs in blocks of 5 to 8 (default: 6)
        const uacList = mapeo.map((m) => ({
          uacName: m.uacName,
          semester: Number(m.semester),
        }));

        const CHUNK_SIZE = 6;
        const chunks: { uacName: string; semester: number }[][] = [];
        for (let i = 0; i < uacList.length; i += CHUNK_SIZE) {
          chunks.push(uacList.slice(i, i + CHUNK_SIZE));
        }

        const allPlanRows: PlanOperativoRow[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const blockPrompt = buildPrompt6PlanOperativoPorBloque(
            cronStr,
            detStr,
            chunks[i],
            project.cycle_type,
            i + 1,
            chunks.length
          );

          let chunkPrompt = blockPrompt;
          if (libraryContext) {
            chunkPrompt = `${chunkPrompt}\n\n${libraryContext}`;
          }

          console.log(`Generating PAEC Step 6 block ${i + 1}/${chunks.length} using callGeminiPool...`);
          const blockText = await callGeminiPool(PAEC_SYSTEM_PROMPT, chunkPrompt, teacher.id);
          if (!blockText) {
            throw new Error(`Respuesta vacía del proveedor de IA en bloque ${i + 1}`);
          }

          const parseResult = parseAIResponse(blockText, PaecPaso6BlockSchema, {
            contextName: `paec_step_6_block_${i + 1}`,
          });

          if (!parseResult.success) {
            console.error(`Error parsing JSON in block ${i + 1}:`, parseResult.error);
            throw new Error(`La IA retornó un formato no válido en el bloque ${i + 1} del Plan Operativo: ${parseResult.error}`);
          }

          allPlanRows.push(...(parseResult.data as PlanOperativoRow[]));
        }

        // Split into semestreA (1, 3, 5) and semestreB (2, 4, 6)
        const getSemesterForUac = (uacName: string): number => {
          const clean = (uacName || '').trim().toLowerCase();
          for (const m of mapeo) {
            const mClean = (m.uacName || '').trim().toLowerCase();
            if (mClean === clean || clean.includes(mClean) || mClean.includes(clean)) {
              return Number(m.semester);
            }
          }
          return project.cycle_type === 'B' ? 2 : 1;
        };

        const semestreA: PlanOperativoRow[] = [];
        const semestreB: PlanOperativoRow[] = [];

        for (const row of allPlanRows) {
          const sem = getSemesterForUac(row.uac);
          if (sem % 2 === 1) {
            semestreA.push(row);
          } else {
            semestreB.push(row);
          }
        }

        planOperativoData = { semestreA, semestreB };
        break;
      }
      case 7: {
        fieldName = 'fase2_anexos';
        if (!project.fase2_plan_operativo) {
          return NextResponse.json({ error: 'Debes completar el Paso 6 (Plan Operativo) primero' }, { status: 400 });
        }
        const projectSummary = JSON.stringify({
          projectName: project.project_name,
          problemStatement: project.problem_statement,
          cycleType: project.cycle_type,
          cronograma: project.fase2_cronograma,
          planOperativo: project.fase2_plan_operativo,
        });
        userPrompt = buildPrompt7Anexos(projectSummary);
        break;
      }
    }

    let parsedJson: object;

    if (step === 6) {
      if (!planOperativoData) {
        throw new Error('Error al consolidar los bloques del Plan Operativo');
      }
      parsedJson = planOperativoData;
    } else {
      let fullUserPrompt = userPrompt;
      if (libraryContext) {
        fullUserPrompt = `${fullUserPrompt}\n\n${libraryContext}`;
      }

      // Call AI via pool engine (reads active model from platform_config)
      console.log(`Generating PAEC Step ${step} using callGeminiPool...`);
      const text = await callGeminiPool(PAEC_SYSTEM_PROMPT, fullUserPrompt, teacher.id);

      if (!text) {
        throw new Error('Respuesta vacía del proveedor de IA');
      }

      let stepSchema: any;
      switch (step) {
        case 1: stepSchema = PaecPaso1Schema; break;
        case 2: stepSchema = PaecPaso2Schema; break;
        case 3: stepSchema = PaecPaso3Schema; break;
        case 4: stepSchema = PaecPaso4Schema; break;
        case 5: stepSchema = PaecPaso5Schema; break;
        case 7: stepSchema = PaecPaso7Schema; break;
        default: throw new Error(`Paso ${step} no soportado`);
      }

      const parseResult = parseAIResponse(text, stepSchema, { contextName: `paec_step_${step}` });
      if (!parseResult.success) {
        console.error(`Failed to parse AI response for Step ${step}:`, parseResult.error);
        return NextResponse.json(
          { error: `Error al estructurar el Paso ${step}: ${parseResult.error}` },
          { status: 500 }
        );
      }

      parsedJson = parseResult.data as object;
    }

    // Save to Neon DB
    const updatedProject = await updatePaecProjectStep(
      id,
      teacher.id,
      step,
      fieldName,
      parsedJson
    );

    // Log activity
    await logActivity({
      teacherEmail: session.user.email,
      action: `generate_paec_step_${step}`,
      entityType: 'paec',
      entityId: id,
      success: true,
    });

    return NextResponse.json({ success: true, step, data: parsedJson, project: updatedProject });
  } catch (error) {
    console.error('PAEC Generation step error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message || 'Error al generar el paso' }, { status: 500 });
  }
}
