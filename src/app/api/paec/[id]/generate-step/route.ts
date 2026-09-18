import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getTeacherByEmail,
  getPaecProjectById,
  updatePaecProjectStep,
  updatePaecQualityAudit,
  getProgramsCatalogForPaec,
} from '@/lib/db';
import {
  validatePaecStepResult,
  calculateGlobalPaecScore,
} from '@/lib/paec-quality-gate';
import {
  PAEC_SYSTEM_PROMPT,
  buildPrompt1Diagnostico,
  buildPrompt2Justificacion,
  buildPrompt3Mapeo,
  buildPrompt4Cronograma,
  buildPrompt5DetalleCurricular,
  buildPrompt6PlanOperativoSemestreA,
  buildPrompt7PlanOperativoSemestreB,
  buildPrompt8ImplementacionYAnexos,
  buildPrompt9GobernanzaEInformeSupervision,
} from '@/lib/prompts/paec-prompts';
import { logActivity, generateWithRotation } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { getUserLibraryContext } from '@/lib/context-extractor';
import { parseAIResponse } from '@/lib/ai-response-parser';
import {
  PaecPaso1Schema,
  PaecPaso2Schema,
  PaecPaso3Schema,
  PaecPaso4Schema,
  PaecPaso5Schema,
  PaecPaso6BlockSchema,
  PaecPaso8ImplementacionSchema,
  PaecPaso9GobernanzaSchema,
} from '@/lib/ai-schemas';
import { MapeoRow, PlanOperativoRow, PaecProject, DetalleCurricularRow, UniqueUacItem, SchoolType, GroupTrackConfig } from '@/types/paec';
import { consolidarUacsUnicasPlantel } from '@/lib/escuela-grupos';
import { extractIdempotencyKey, checkIdempotencyKey, createIdempotencyKey } from '@/lib/idempotency';

export const runtime = 'nodejs';
export const maxDuration = 120;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

    if (!step || step < 1 || step > 9) {
      return NextResponse.json(
        { error: 'Número de paso no válido (debe ser de 1 a 9)' },
        { status: 400 }
      );
    }

    // Mejora #24: Verificación de Idempotencia y Deduplicación
    const idempotencyKey = extractIdempotencyKey(request);
    const cachedResult = await checkIdempotencyKey(
      idempotencyKey,
      teacher.id,
      `/api/paec/${id}/generate-step?step=${step}`
    );
    if (cachedResult) {
      return NextResponse.json(cachedResult, {
        headers: { 'X-Idempotency-Hit': 'true' },
      });
    }

    // Inyectar contexto de la biblioteca documental si existe
    const libraryContext = await getUserLibraryContext(session.user.email);

    let userPrompt = '';
    let fieldName = '';
    let stepResultData: any = null;

    switch (step) {
      // ----------------------------------------------------------------------
      // PASO 1: Diagnóstico Comunitario y Escolar
      // ----------------------------------------------------------------------
      case 1: {
        fieldName = 'fase1_diagnostico';
        const comm = JSON.stringify(project.community_context);
        const school = JSON.stringify(project.school_context);
        userPrompt = buildPrompt1Diagnostico(comm, school, project.problem_statement);
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 2: Justificación y Diseño General
      // ----------------------------------------------------------------------
      case 2: {
        fieldName = 'fase2_justificacion';
        if (!project.fase1_diagnostico) {
          return NextResponse.json(
            { error: 'Debes completar el Paso 1 (Diagnóstico) primero' },
            { status: 400 }
          );
        }
        const diagStr = JSON.stringify(project.fase1_diagnostico);
        userPrompt = buildPrompt2Justificacion(diagStr, project.project_name, project.problem_statement);
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 3: Mapeo Curricular de UACs (100% Cobertura)
      // ----------------------------------------------------------------------
      case 3: {
        fieldName = 'fase2_mapeo';
        if (!project.fase2_justificacion) {
          return NextResponse.json(
            { error: 'Debes completar el Paso 2 (Justificación) primero' },
            { status: 400 }
          );
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

        const allUacs = (await getProgramsCatalogForPaec(semesters)) as {
          uac_name: string;
          semester: number;
          component: string;
        }[];

        // Regla de Oro Curricular: Cero Duplicados a nivel Plantel
        const schoolCtx = (project.school_context || {}) as {
          schoolType?: SchoolType;
          activeLaboralUacs?: string[];
          activeFfeUacs?: string[];
          activeBtCarreras?: string[];
          groupStructure?: {
            semestersConfig: Record<number, number>;
            groupAssignments: GroupTrackConfig[];
          };
          uniqueUacsList?: UniqueUacItem[];
        };

        const uacsItems: UniqueUacItem[] = (schoolCtx.uniqueUacsList && schoolCtx.uniqueUacsList.length > 0)
          ? schoolCtx.uniqueUacsList
          : consolidarUacsUnicasPlantel({
              semesters,
              schoolType: schoolCtx.schoolType,
              groupAssignments: schoolCtx.groupStructure?.groupAssignments,
              activeLaboralUacs: schoolCtx.activeLaboralUacs,
              activeFfeUacs: schoolCtx.activeFfeUacs,
              activeBtCarreras: schoolCtx.activeBtCarreras,
              dbFundamentalUacs: allUacs,
            });

        const uacs = uacsItems.map((u) => ({
          uac_name: u.uacName,
          semester: u.semester,
        }));

        // Chunking anti-timeout si supera 16 UACs (ej. 27 UACs en escuelas multi-grupo)
        if (uacs.length > 16) {
          const CHUNK_SIZE = 12;
          const chunks: { uac_name: string; semester: number }[][] = [];
          for (let i = 0; i < uacs.length; i += CHUNK_SIZE) {
            chunks.push(uacs.slice(i, i + CHUNK_SIZE));
          }

          const allMapeoRows: MapeoRow[] = [];
          for (let i = 0; i < chunks.length; i++) {
            const blockNum = i + 1;
            const blockPrompt = buildPrompt3Mapeo(justStr, chunks[i]);
            let chunkPrompt = blockPrompt;
            if (libraryContext) {
              chunkPrompt = `${chunkPrompt}\n\n${libraryContext}`;
            }

            logger.info(`[PAEC-Step3] Generando bloque de Mapeo ${blockNum}/${chunks.length} (${chunks[i].length} UACs)...`);
            const blockText = await generateWithRotation(PAEC_SYSTEM_PROMPT, chunkPrompt, teacher.id);
            if (!blockText) {
              throw new Error(`Respuesta vacía del proveedor en bloque de Mapeo ${blockNum}`);
            }

            const parseResult = parseAIResponse(blockText, PaecPaso3Schema, {
              contextName: `paec_step_3_block_${blockNum}`,
            });

            if (!parseResult.success) {
              throw new Error(`Error de formato en bloque de Mapeo ${blockNum}: ${parseResult.error}`);
            }

            allMapeoRows.push(...(parseResult.data as MapeoRow[]));
          }

          stepResultData = allMapeoRows;
        } else {
          userPrompt = buildPrompt3Mapeo(justStr, uacs);
        }
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 4: Cronograma General de Implementación (6 Fases / 5 Columnas)
      // ----------------------------------------------------------------------
      case 4: {
        fieldName = 'fase2_cronograma';
        if (!project.fase2_mapeo) {
          return NextResponse.json(
            { error: 'Debes completar el Paso 3 (Mapeo Curricular) primero' },
            { status: 400 }
          );
        }
        const mapeoStr = JSON.stringify(project.fase2_mapeo);
        userPrompt = buildPrompt4Cronograma(mapeoStr, project.cycle_type);
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 5: Matriz de Detalle Curricular por Semestre
      // ----------------------------------------------------------------------
      case 5: {
        fieldName = 'fase2_detalle_curricular';
        if (!project.fase2_mapeo || !project.fase2_cronograma) {
          return NextResponse.json(
            { error: 'Debes completar el Paso 3 (Mapeo) y el Paso 4 (Cronograma) primero' },
            { status: 400 }
          );
        }
        const mapeo = project.fase2_mapeo as MapeoRow[];
        const mapeoStr = JSON.stringify(mapeo);
        const cronStr = JSON.stringify(project.fase2_cronograma);

        // Chunking anti-timeout si el mapeo supera 14 UACs
        if (mapeo.length > 14) {
          const CHUNK_SIZE = 10;
          const chunks: MapeoRow[][] = [];
          for (let i = 0; i < mapeo.length; i += CHUNK_SIZE) {
            chunks.push(mapeo.slice(i, i + CHUNK_SIZE));
          }

          const allDetalleRows: DetalleCurricularRow[] = [];
          for (let i = 0; i < chunks.length; i++) {
            const blockNum = i + 1;
            const blockPrompt = buildPrompt5DetalleCurricular(
              JSON.stringify(chunks[i]),
              cronStr,
              project.cycle_type
            );
            let chunkPrompt = blockPrompt;
            if (libraryContext) {
              chunkPrompt = `${chunkPrompt}\n\n${libraryContext}`;
            }

            logger.info(`[PAEC-Step5] Generando bloque de Detalle Curricular ${blockNum}/${chunks.length} (${chunks[i].length} UACs)...`);
            const blockText = await generateWithRotation(PAEC_SYSTEM_PROMPT, chunkPrompt, teacher.id);
            if (!blockText) {
              throw new Error(`Respuesta vacía del proveedor en bloque de Detalle ${blockNum}`);
            }

            const parseResult = parseAIResponse(blockText, PaecPaso5Schema, {
              contextName: `paec_step_5_block_${blockNum}`,
            });

            if (!parseResult.success) {
              throw new Error(`Error de formato en bloque de Detalle ${blockNum}: ${parseResult.error}`);
            }

            allDetalleRows.push(...(parseResult.data as DetalleCurricularRow[]));
          }

          stepResultData = allDetalleRows;
        } else {
          userPrompt = buildPrompt5DetalleCurricular(mapeoStr, cronStr, project.cycle_type);
        }
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 6: Plan Operativo Semestre A (Fases 1, 2 y 3: Semanas 1 a 16)
      // ----------------------------------------------------------------------
      case 6: {
        fieldName = 'fase3_plan_operativo_a';
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

        // Asignaturas de semestres impares (1°, 3°, 5°)
        let uacListA = mapeo
          .filter((m) => Number(m.semester) % 2 === 1)
          .map((m) => ({ uacName: m.uacName, semester: Number(m.semester) }));

        // Si el proyecto es estrictamente Ciclo B pero ejecutan paso 6, usar todas
        if (uacListA.length === 0) {
          uacListA = mapeo.map((m) => ({ uacName: m.uacName, semester: Number(m.semester) }));
        }

        const cronStr = JSON.stringify(project.fase2_cronograma);
        const detStr = JSON.stringify(project.fase2_detalle_curricular);

        // Chunking anti-timeout: Bloques de máximo 6 UACs si supera 8 UACs
        const CHUNK_SIZE = uacListA.length > 8 ? 6 : uacListA.length;
        const chunks: { uacName: string; semester: number }[][] = [];
        for (let i = 0; i < uacListA.length; i += CHUNK_SIZE) {
          chunks.push(uacListA.slice(i, i + CHUNK_SIZE));
        }

        const allRowsSemA: PlanOperativoRow[] = [];
        const failedChunks: { block: number; error: string }[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const blockNum = i + 1;
          const blockPrompt = buildPrompt6PlanOperativoSemestreA(
            cronStr,
            detStr,
            chunks[i],
            blockNum,
            chunks.length
          );

          let chunkPrompt = blockPrompt;
          if (libraryContext) {
            chunkPrompt = `${chunkPrompt}\n\n${libraryContext}`;
          }

          let chunkSuccess = false;
          let attempt = 0;
          const maxRetries = 2;
          let delay = 1500;

          while (attempt <= maxRetries && !chunkSuccess) {
            try {
              logger.info(`[PAEC-Step6] Generando bloque ${blockNum}/${chunks.length} Semestre A (intento ${attempt + 1}/${maxRetries + 1})...`);
              const blockText = await generateWithRotation(PAEC_SYSTEM_PROMPT, chunkPrompt, teacher.id);
              if (!blockText) {
                throw new Error(`Respuesta vacía del proveedor en bloque ${blockNum}`);
              }

              const parseResult = parseAIResponse(blockText, PaecPaso6BlockSchema, {
                contextName: `paec_step_6_block_${blockNum}`,
              });

              if (!parseResult.success) {
                throw new Error(`Error de formato en bloque ${blockNum}: ${parseResult.error}`);
              }

              const blockRows = parseResult.data as PlanOperativoRow[];
              allRowsSemA.push(...blockRows);
              chunkSuccess = true;

              // Checkpoint parcial en BD
              await updatePaecProjectStep(id, teacher.id, 6, 'fase3_plan_operativo_a', allRowsSemA);
              logger.info(`[PAEC-Step6] Checkpoint guardado tras bloque ${blockNum}/${chunks.length} (${allRowsSemA.length} filas acumuladas).`);
            } catch (err: any) {
              attempt++;
              logger.warn(`[PAEC-Step6] Falla en bloque ${blockNum} (intento ${attempt}/${maxRetries + 1}): ${err?.message || err}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                failedChunks.push({
                  block: blockNum,
                  error: err?.message || 'Error desconocido',
                });
              }
            }
          }
        }

        if (allRowsSemA.length === 0 && failedChunks.length > 0) {
          throw new Error(`Fallo al generar el Plan Semestre A: ${failedChunks.map((f) => `Bloque ${f.block} (${f.error})`).join(', ')}`);
        }

        // Sincronizar también con la estructura legacy fase2_plan_operativo
        const existingSemB = project.fase3_plan_operativo_b || (project.fase2_plan_operativo as any)?.semestreB || [];
        await updatePaecProjectStep(id, teacher.id, 6, 'fase2_plan_operativo', {
          semestreA: allRowsSemA,
          semestreB: existingSemB,
        });

        stepResultData = allRowsSemA;
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 7: Plan Operativo Semestre B (Fases 4, 5 y 6: Semanas 1 a 16)
      // ----------------------------------------------------------------------
      case 7: {
        fieldName = 'fase3_plan_operativo_b';
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

        // Asignaturas de semestres pares (2°, 4°, 6°)
        let uacListB = mapeo
          .filter((m) => Number(m.semester) % 2 === 0)
          .map((m) => ({ uacName: m.uacName, semester: Number(m.semester) }));

        // Si el proyecto es estrictamente Ciclo A pero ejecutan paso 7, usar todas
        if (uacListB.length === 0) {
          uacListB = mapeo.map((m) => ({ uacName: m.uacName, semester: Number(m.semester) }));
        }

        const cronStr = JSON.stringify(project.fase2_cronograma);
        const detStr = JSON.stringify(project.fase2_detalle_curricular);

        // Chunking anti-timeout: Bloques de máximo 6 UACs si supera 8 UACs
        const CHUNK_SIZE = uacListB.length > 8 ? 6 : uacListB.length;
        const chunks: { uacName: string; semester: number }[][] = [];
        for (let i = 0; i < uacListB.length; i += CHUNK_SIZE) {
          chunks.push(uacListB.slice(i, i + CHUNK_SIZE));
        }

        const allRowsSemB: PlanOperativoRow[] = [];
        const failedChunks: { block: number; error: string }[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const blockNum = i + 1;
          const blockPrompt = buildPrompt7PlanOperativoSemestreB(
            cronStr,
            detStr,
            chunks[i],
            blockNum,
            chunks.length
          );

          let chunkPrompt = blockPrompt;
          if (libraryContext) {
            chunkPrompt = `${chunkPrompt}\n\n${libraryContext}`;
          }

          let chunkSuccess = false;
          let attempt = 0;
          const maxRetries = 2;
          let delay = 1500;

          while (attempt <= maxRetries && !chunkSuccess) {
            try {
              logger.info(`[PAEC-Step7] Generando bloque ${blockNum}/${chunks.length} Semestre B (intento ${attempt + 1}/${maxRetries + 1})...`);
              const blockText = await generateWithRotation(PAEC_SYSTEM_PROMPT, chunkPrompt, teacher.id);
              if (!blockText) {
                throw new Error(`Respuesta vacía del proveedor en bloque ${blockNum}`);
              }

              const parseResult = parseAIResponse(blockText, PaecPaso6BlockSchema, {
                contextName: `paec_step_7_block_${blockNum}`,
              });

              if (!parseResult.success) {
                throw new Error(`Error de formato en bloque ${blockNum}: ${parseResult.error}`);
              }

              const blockRows = parseResult.data as PlanOperativoRow[];
              allRowsSemB.push(...blockRows);
              chunkSuccess = true;

              // Checkpoint parcial en BD
              await updatePaecProjectStep(id, teacher.id, 7, 'fase3_plan_operativo_b', allRowsSemB);
              logger.info(`[PAEC-Step7] Checkpoint guardado tras bloque ${blockNum}/${chunks.length} (${allRowsSemB.length} filas acumuladas).`);
            } catch (err: any) {
              attempt++;
              logger.warn(`[PAEC-Step7] Falla en bloque ${blockNum} (intento ${attempt}/${maxRetries + 1}): ${err?.message || err}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                failedChunks.push({
                  block: blockNum,
                  error: err?.message || 'Error desconocido',
                });
              }
            }
          }
        }

        if (allRowsSemB.length === 0 && failedChunks.length > 0) {
          throw new Error(`Fallo al generar el Plan Semestre B: ${failedChunks.map((f) => `Bloque ${f.block} (${f.error})`).join(', ')}`);
        }

        // Sincronizar también con la estructura legacy fase2_plan_operativo
        const existingSemA = project.fase3_plan_operativo_a || (project.fase2_plan_operativo as any)?.semestreA || [];
        await updatePaecProjectStep(id, teacher.id, 7, 'fase2_plan_operativo', {
          semestreA: existingSemA,
          semestreB: allRowsSemB,
        });

        stepResultData = allRowsSemB;
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 8: Implementación Territorial, Minutas, Oficios y 6 Anexos
      // ----------------------------------------------------------------------
      case 8: {
        fieldName = 'fase3_implementacion';
        const hasPlan = project.fase3_plan_operativo_a || project.fase3_plan_operativo_b || project.fase2_plan_operativo;
        if (!hasPlan) {
          return NextResponse.json(
            { error: 'Debes completar al menos un Plan Operativo (Paso 6 o 7) primero' },
            { status: 400 }
          );
        }

        const projectSummary = JSON.stringify({
          projectName: project.project_name,
          problemStatement: project.problem_statement,
          cycleType: project.cycle_type,
          cronograma: project.fase2_cronograma,
          justificacion: project.fase2_justificacion,
        });
        const planASummary = JSON.stringify(project.fase3_plan_operativo_a || (project.fase2_plan_operativo as any)?.semestreA || []);
        const planBSummary = JSON.stringify(project.fase3_plan_operativo_b || (project.fase2_plan_operativo as any)?.semestreB || []);

        userPrompt = buildPrompt8ImplementacionYAnexos(projectSummary, planASummary, planBSummary);
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 9: Gobernanza Escolar e Informe de Rendición de Cuentas
      // ----------------------------------------------------------------------
      case 9: {
        fieldName = 'fase4_gobernanza_e_informe';
        const hasImpl = project.fase3_implementacion || project.fase2_anexos;
        if (!hasImpl) {
          return NextResponse.json(
            { error: 'Debes completar el Paso 8 (Implementación y Anexos) primero' },
            { status: 400 }
          );
        }

        const projectSummary = JSON.stringify({
          projectName: project.project_name,
          problemStatement: project.problem_statement,
          cycleType: project.cycle_type,
          cronograma: project.fase2_cronograma,
          justificacion: project.fase2_justificacion,
        });
        const planASummary = JSON.stringify(project.fase3_plan_operativo_a || (project.fase2_plan_operativo as any)?.semestreA || []);
        const planBSummary = JSON.stringify(project.fase3_plan_operativo_b || (project.fase2_plan_operativo as any)?.semestreB || []);
        const implSummary = JSON.stringify(project.fase3_implementacion || project.fase2_anexos || {});

        userPrompt = buildPrompt9GobernanzaEInformeSupervision(
          projectSummary,
          planASummary,
          planBSummary,
          implSummary
        );
        break;
      }
    }

    let parsedJson: object;

    // Si el paso fue procesado mediante chunking (Paso 6, 7, o 3 y 5 con múltiples UACs)
    if (stepResultData) {
      parsedJson = stepResultData;
    } else {
      let fullUserPrompt = userPrompt;
      if (libraryContext) {
        fullUserPrompt = `${fullUserPrompt}\n\n${libraryContext}`;
      }

      logger.info(`[PAEC] Generando Paso ${step} mediante generateWithRotation...`);
      const text = await generateWithRotation(PAEC_SYSTEM_PROMPT, fullUserPrompt, teacher.id);

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
        case 8: stepSchema = PaecPaso8ImplementacionSchema; break;
        case 9: stepSchema = PaecPaso9GobernanzaSchema; break;
        default: throw new Error(`Paso ${step} no soportado`);
      }

      const parseResult = parseAIResponse(text, stepSchema, { contextName: `paec_step_${step}` });
      if (!parseResult.success) {
        logger.error(`Failed to parse AI response for Step ${step}:`, parseResult.error);
        return NextResponse.json(
          { error: `Error al estructurar el Paso ${step}: ${parseResult.error}` },
          { status: 500 }
        );
      }

      parsedJson = parseResult.data as object;
    }

    // Persistir el resultado definitivo en la BD Neon
    const updatedProject = await updatePaecProjectStep(
      id,
      teacher.id,
      step,
      fieldName,
      parsedJson
    );

    // FASE C: Quality Gate Oficial — Evaluación normativa por paso
    const stepAudit = validatePaecStepResult(step, parsedJson);
    logger.info(`[PAEC Quality Gate] Paso ${step} evaluado: Score ${stepAudit.score}/100 (${stepAudit.estatus})`);

    // Si score < 60 en algún criterio (score <= 2 de 4): registrar warning pero NO bloquear
    for (const crit of stepAudit.criterios) {
      if (crit.score <= 2) {
        logger.warn(
          `[PAEC Quality Gate Warning] Paso ${step} - Criterio ${crit.id} (${crit.name}): Puntaje ${crit.score}/4 (<60%). Observación: ${crit.feedback}`
        );
      }
    }

    // Al completar el paso 9: calcular auditoría global de los 23 criterios y persistir en BD Neon
    let globalAudit = null;
    if (step === 9) {
      globalAudit = calculateGlobalPaecScore(updatedProject);
      await updatePaecQualityAudit(id, teacher.id, globalAudit);
      updatedProject.qualityAudit = globalAudit;
      logger.info(
        `[PAEC Quality Gate] Auditoría Global completada para Proyecto ${id}: Score ${globalAudit.score}/100 (${globalAudit.estatus})`
      );
    }

    // Registrar actividad en bitácora
    await logActivity({
      teacherEmail: session.user.email,
      action: `generate_paec_step_${step}`,
      entityType: 'paec',
      entityId: id,
      success: true,
    });

    const responsePayload = {
      success: true,
      step,
      data: parsedJson,
      project: updatedProject,
      stepAudit,
      globalAudit,
    };

    if (idempotencyKey) {
      await createIdempotencyKey(
        idempotencyKey,
        teacher.id,
        `/api/paec/${id}/generate-step?step=${step}`,
        responsePayload
      );
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    logger.error('PAEC Generation step error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message || 'Error al generar el paso' }, { status: 500 });
  }
}
