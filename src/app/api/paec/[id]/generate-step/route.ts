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
  buildPrompt8Bloque1,
  buildPrompt8Bloque2,
  buildPrompt8Bloque3,
  buildPrompt9Bloque1,
  buildPrompt9Bloque2,
  type PaecAcademicBaseline,
} from '@/lib/prompts/paec-prompts';
import { getZoneContextForSchool } from '@/lib/zone-sync-service';
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
  PaecPaso8Block1Schema,
  PaecPaso8Block2Schema,
  PaecPaso8Block3Schema,
  PaecPaso9GobernanzaSchema,
  PaecPaso9Block1Schema,
  PaecPaso9Block2Schema,
} from '@/lib/ai-schemas';
import { z } from 'zod';
import { MapeoRow, PlanOperativoRow, DetalleCurricularRow, UniqueUacItem, SchoolType, GroupTrackConfig } from '@/types/paec';
import { consolidarUacsUnicasPlantel } from '@/lib/escuela-grupos';
import { extractIdempotencyKey, checkIdempotencyKey, createIdempotencyKey } from '@/lib/idempotency';

type LegacyPlanOperativo = { semestreA?: PlanOperativoRow[]; semestreB?: PlanOperativoRow[] };

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
    let stepResultData: object | null = null;

    switch (step) {
      // ----------------------------------------------------------------------
      // PASO 1: Diagnóstico Comunitario y Escolar
      // ----------------------------------------------------------------------
      case 1: {
        fieldName = 'fase1_diagnostico';
        const comm = JSON.stringify(project.community_context);
        const school = JSON.stringify(project.school_context);

        // Línea base estadística oficial (911/F11 y Cartografía de Zona)
        const schoolCtx = project.school_context as Record<string, unknown> | undefined;
        let baseline: PaecAcademicBaseline | null = (schoolCtx?.academicBaseline as PaecAcademicBaseline | undefined) ?? null;

        if (!baseline) {
          const cct = (schoolCtx?.cct as string | undefined) || (schoolCtx?.schoolCct as string | undefined);
          if (cct) {
            try {
              const zoneRes = await getZoneContextForSchool(cct);
              if (zoneRes.found) {
                baseline = {
                  abandono: zoneRes.plantel?.abandono,
                  eficienciaTerminal: zoneRes.plantel?.eficienciaTerminal,
                  reprobacion: zoneRes.plantel?.reprobacion,
                  promAbandonoZona: zoneRes.zona?.averages?.promAbandono,
                  promEficienciaZona: zoneRes.zona?.averages?.promEficiencia,
                  problematicasComunesZona: zoneRes.zona?.problematicasComunes,
                };
              }
            } catch (err) {
              logger.warn(`[PAEC Paso 1] Error obteniendo contexto estadístico de zona para ${cct}:`, err);
            }
          }
        }

        userPrompt = buildPrompt1Diagnostico(comm, school, project.problem_statement, baseline);
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
          activeFundamentalUacs?: string[];
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
              activeFundamentalUacs: schoolCtx.activeFundamentalUacs,
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
            } catch (err: unknown) {
              attempt++;
              const errMsg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step6] Falla en bloque ${blockNum} (intento ${attempt}/${maxRetries + 1}): ${errMsg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                failedChunks.push({
                  block: blockNum,
                  error: errMsg,
                });
              }
            }
          }
        }

        if (allRowsSemA.length === 0 && failedChunks.length > 0) {
          throw new Error(`Fallo al generar el Plan Semestre A: ${failedChunks.map((f) => `Bloque ${f.block} (${f.error})`).join(', ')}`);
        }

        // Sincronizar también con la estructura legacy fase2_plan_operativo
        const existingSemB = project.fase3_plan_operativo_b || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreB || [];
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
            } catch (err: unknown) {
              attempt++;
              const errMsg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step7] Falla en bloque ${blockNum} (intento ${attempt}/${maxRetries + 1}): ${errMsg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                failedChunks.push({
                  block: blockNum,
                  error: errMsg,
                });
              }
            }
          }
        }

        if (allRowsSemB.length === 0 && failedChunks.length > 0) {
          throw new Error(`Fallo al generar el Plan Semestre B: ${failedChunks.map((f) => `Bloque ${f.block} (${f.error})`).join(', ')}`);
        }

        // Sincronizar también con la estructura legacy fase2_plan_operativo
        const existingSemA = project.fase3_plan_operativo_a || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreA || [];
        await updatePaecProjectStep(id, teacher.id, 7, 'fase2_plan_operativo', {
          semestreA: existingSemA,
          semestreB: allRowsSemB,
        });

        stepResultData = allRowsSemB;
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 8: Implementación Territorial, Minutas, Oficios y 6 Anexos (Chunking 3 Bloques)
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
        const planASummary = JSON.stringify(project.fase3_plan_operativo_a || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreA || []);
        const planBSummary = JSON.stringify(project.fase3_plan_operativo_b || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreB || []);

        const existingImpl = (project.fase3_implementacion as Record<string, unknown> | undefined) || {};
        const accumulatedPaso8: Record<string, unknown> = {
          ...existingImpl,
          anexos: {
            ...((existingImpl.anexos as Record<string, unknown>) || {}),
          },
        };

        const maxRetries = 2;

        // Bloque 1: Minutas, oficios, carta de invitación y sesión de lanzamiento
        const hasBlock1 = Boolean(accumulatedPaso8.cartaInvitacion && (accumulatedPaso8.oficiosAliados as unknown[])?.length);
        if (!hasBlock1) {
          const b1Prompt = buildPrompt8Bloque1(projectSummary, planASummary, planBSummary);
          const fullB1Prompt = libraryContext ? `${b1Prompt}\n\n${libraryContext}` : b1Prompt;
          let attempt = 0;
          let delay = 1500;
          let b1Success = false;

          while (attempt <= maxRetries && !b1Success) {
            try {
              logger.info(`[PAEC-Step8] Generando Bloque 1/3 (Minutas, Oficios, Lanzamiento) - intento ${attempt + 1}/${maxRetries + 1}...`);
              const text1 = await generateWithRotation(PAEC_SYSTEM_PROMPT, fullB1Prompt, teacher.id);
              if (!text1) throw new Error('Respuesta vacía del proveedor en Bloque 1');
              const parsed = parseAIResponse(text1, PaecPaso8Block1Schema, { contextName: 'paec_step_8_block_1' });
              if (!parsed.success) throw new Error(`Error de validación en Bloque 1: ${parsed.error}`);

              Object.assign(accumulatedPaso8, parsed.data);
              b1Success = true;
              await updatePaecProjectStep(id, teacher.id, 8, 'fase3_implementacion', accumulatedPaso8);
              logger.info('[PAEC-Step8] Checkpoint Bloque 1/3 guardado exitosamente.');
            } catch (err: unknown) {
              attempt++;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step8] Falla en Bloque 1 (intento ${attempt}/${maxRetries + 1}): ${msg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                throw new Error(`Fallo definitivo en Bloque 1 (Paso 8): ${msg}`);
              }
            }
          }
        } else {
          logger.info('[PAEC-Step8] Bloque 1/3 ya existente en BD, omitiendo regeneración.');
        }

        // Bloque 2: Anexos 1 a 3 (Minuta, Seguimiento 16 semanas, Reporte Mensual)
        const anexosObj = accumulatedPaso8.anexos as Record<string, unknown>;
        const hasBlock2 = Boolean((anexosObj.anexo2Seguimiento as unknown[])?.length && (anexosObj.anexo3ReporteMensual as Record<string, unknown>)?.resumenEjecutivo);
        if (!hasBlock2) {
          const b2Prompt = buildPrompt8Bloque2(projectSummary, planASummary, planBSummary);
          const fullB2Prompt = libraryContext ? `${b2Prompt}\n\n${libraryContext}` : b2Prompt;
          let attempt = 0;
          let delay = 1500;
          let b2Success = false;

          while (attempt <= maxRetries && !b2Success) {
            try {
              logger.info(`[PAEC-Step8] Generando Bloque 2/3 (Anexos 1-3) - intento ${attempt + 1}/${maxRetries + 1}...`);
              const text2 = await generateWithRotation(PAEC_SYSTEM_PROMPT, fullB2Prompt, teacher.id);
              if (!text2) throw new Error('Respuesta vacía del proveedor en Bloque 2');
              const parsed = parseAIResponse(text2, PaecPaso8Block2Schema, { contextName: 'paec_step_8_block_2' });
              if (!parsed.success) throw new Error(`Error de validación en Bloque 2: ${parsed.error}`);

              const b2Data = parsed.data as Record<string, unknown>;
              accumulatedPaso8.anexos = {
                ...(accumulatedPaso8.anexos as Record<string, unknown>),
                ...b2Data,
              };
              b2Success = true;
              await updatePaecProjectStep(id, teacher.id, 8, 'fase3_implementacion', accumulatedPaso8);
              logger.info('[PAEC-Step8] Checkpoint Bloque 2/3 guardado exitosamente.');
            } catch (err: unknown) {
              attempt++;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step8] Falla en Bloque 2 (intento ${attempt}/${maxRetries + 1}): ${msg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                throw new Error(`Fallo definitivo en Bloque 2 (Paso 8): ${msg}`);
              }
            }
          }
        } else {
          logger.info('[PAEC-Step8] Bloque 2/3 ya existente en BD, omitiendo regeneración.');
        }

        // Bloque 3: Anexos 4 a 6 (Impacto, Autoevaluación, Colegiado)
        const anexosObjAfterB2 = accumulatedPaso8.anexos as Record<string, unknown>;
        const hasBlock3 = Boolean((anexosObjAfterB2.anexo4ImpactoComunidad as Record<string, unknown>)?.reactivos && (anexosObjAfterB2.anexo5AutoevaluacionEstudiantes as Record<string, unknown>)?.reactivos);
        if (!hasBlock3) {
          const b3Prompt = buildPrompt8Bloque3(projectSummary, planASummary, planBSummary);
          const fullB3Prompt = libraryContext ? `${b3Prompt}\n\n${libraryContext}` : b3Prompt;
          let attempt = 0;
          let delay = 1500;
          let b3Success = false;

          while (attempt <= maxRetries && !b3Success) {
            try {
              logger.info(`[PAEC-Step8] Generando Bloque 3/3 (Anexos 4-6) - intento ${attempt + 1}/${maxRetries + 1}...`);
              const text3 = await generateWithRotation(PAEC_SYSTEM_PROMPT, fullB3Prompt, teacher.id);
              if (!text3) throw new Error('Respuesta vacía del proveedor en Bloque 3');
              const parsed = parseAIResponse(text3, PaecPaso8Block3Schema, { contextName: 'paec_step_8_block_3' });
              if (!parsed.success) throw new Error(`Error de validación en Bloque 3: ${parsed.error}`);

              const b3Data = parsed.data as Record<string, unknown>;
              accumulatedPaso8.anexos = {
                ...(accumulatedPaso8.anexos as Record<string, unknown>),
                ...b3Data,
              };
              b3Success = true;
              await updatePaecProjectStep(id, teacher.id, 8, 'fase3_implementacion', accumulatedPaso8);
              logger.info('[PAEC-Step8] Checkpoint Bloque 3/3 guardado exitosamente.');
            } catch (err: unknown) {
              attempt++;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step8] Falla en Bloque 3 (intento ${attempt}/${maxRetries + 1}): ${msg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                throw new Error(`Fallo definitivo en Bloque 3 (Paso 8): ${msg}`);
              }
            }
          }
        } else {
          logger.info('[PAEC-Step8] Bloque 3/3 ya existente en BD, omitiendo regeneración.');
        }

        stepResultData = accumulatedPaso8;
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 9: Gobernanza Escolar e Informe de Rendición de Cuentas (Chunking 2 Bloques)
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
        const planASummary = JSON.stringify(project.fase3_plan_operativo_a || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreA || []);
        const planBSummary = JSON.stringify(project.fase3_plan_operativo_b || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreB || []);
        const implSummary = JSON.stringify(project.fase3_implementacion || project.fase2_anexos || {});

        const existingGob = (project.fase4_gobernanza_e_informe as Record<string, unknown> | undefined) || {};
        const accumulatedPaso9: Record<string, unknown> = {
          ...existingGob,
        };

        const maxRetries = 2;

        // Bloque 1: Gobernanza Colegiada (calendario en 4 niveles y metodología)
        const gobObj = (accumulatedPaso9.gobernanza as Record<string, unknown> | undefined) || {};
        const hasBlock1 = Boolean((gobObj.calendario as unknown[])?.length >= 2 && gobObj.metodologiaEvaluacion);
        if (!hasBlock1) {
          const b1Prompt = buildPrompt9Bloque1(projectSummary, planASummary, planBSummary, implSummary);
          const fullB1Prompt = libraryContext ? `${b1Prompt}\n\n${libraryContext}` : b1Prompt;
          let attempt = 0;
          let delay = 1500;
          let b1Success = false;

          while (attempt <= maxRetries && !b1Success) {
            try {
              logger.info(`[PAEC-Step9] Generando Bloque 1/2 (Gobernanza Colegiada) - intento ${attempt + 1}/${maxRetries + 1}...`);
              const text1 = await generateWithRotation(PAEC_SYSTEM_PROMPT, fullB1Prompt, teacher.id);
              if (!text1) throw new Error('Respuesta vacía del proveedor en Bloque 1');
              const parsed = parseAIResponse(text1, PaecPaso9Block1Schema, { contextName: 'paec_step_9_block_1' });
              if (!parsed.success) throw new Error(`Error de validación en Bloque 1: ${parsed.error}`);

              Object.assign(accumulatedPaso9, parsed.data);
              b1Success = true;
              await updatePaecProjectStep(id, teacher.id, 9, 'fase4_gobernanza_e_informe', accumulatedPaso9);
              logger.info('[PAEC-Step9] Checkpoint Bloque 1/2 guardado exitosamente.');
            } catch (err: unknown) {
              attempt++;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step9] Falla en Bloque 1 (intento ${attempt}/${maxRetries + 1}): ${msg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                throw new Error(`Fallo definitivo en Bloque 1 (Paso 9): ${msg}`);
              }
            }
          }
        } else {
          logger.info('[PAEC-Step9] Bloque 1/2 ya existente en BD, omitiendo regeneración.');
        }

        // Bloque 2: Informe de Rendición de Cuentas para Supervisión 004
        const infObj = (accumulatedPaso9.informeSupervision as Record<string, unknown> | undefined) || {};
        const hasBlock2 = Boolean(infObj.resumenEjecutivo && (infObj.metasVsLogros as unknown[])?.length);
        if (!hasBlock2) {
          const b2Prompt = buildPrompt9Bloque2(projectSummary, planASummary, planBSummary, implSummary);
          const fullB2Prompt = libraryContext ? `${b2Prompt}\n\n${libraryContext}` : b2Prompt;
          let attempt = 0;
          let delay = 1500;
          let b2Success = false;

          while (attempt <= maxRetries && !b2Success) {
            try {
              logger.info(`[PAEC-Step9] Generando Bloque 2/2 (Informe de Supervisión) - intento ${attempt + 1}/${maxRetries + 1}...`);
              const text2 = await generateWithRotation(PAEC_SYSTEM_PROMPT, fullB2Prompt, teacher.id);
              if (!text2) throw new Error('Respuesta vacía del proveedor en Bloque 2');
              const parsed = parseAIResponse(text2, PaecPaso9Block2Schema, { contextName: 'paec_step_9_block_2' });
              if (!parsed.success) throw new Error(`Error de validación en Bloque 2: ${parsed.error}`);

              Object.assign(accumulatedPaso9, parsed.data);
              b2Success = true;
              await updatePaecProjectStep(id, teacher.id, 9, 'fase4_gobernanza_e_informe', accumulatedPaso9);
              logger.info('[PAEC-Step9] Checkpoint Bloque 2/2 guardado exitosamente.');
            } catch (err: unknown) {
              attempt++;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step9] Falla en Bloque 2 (intento ${attempt}/${maxRetries + 1}): ${msg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                throw new Error(`Fallo definitivo en Bloque 2 (Paso 9): ${msg}`);
              }
            }
          }
        } else {
          logger.info('[PAEC-Step9] Bloque 2/2 ya existente en BD, omitiendo regeneración.');
        }

        stepResultData = accumulatedPaso9;
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

      let stepSchema: z.ZodTypeAny;
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
