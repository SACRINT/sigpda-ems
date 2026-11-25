import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getTeacherByEmail,
  getPaecProjectById,
  updatePaecProjectStep,
  updatePaecQualityAudit,
} from '@/lib/db';
import {
  validatePaecStepResult,
  calculateGlobalPaecScore,
} from '@/lib/paec-quality-gate';
import { PAEC_SYSTEM_PROMPT } from '@/lib/prompts/paec-prompts';
import { getPaecRegulatoryContext } from '@/lib/paec-regulatory-context';
import { validatePaecStepInputs } from '@/lib/paec-input-guard';
import { logActivity, generateWithRotation } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { getUserLibraryContext } from '@/lib/context-extractor';
import { getInstitutionalContext } from '@/lib/institutional-context';
import { parseAIResponse } from '@/lib/ai-response-parser';
import {
  PaecPaso1Schema,
  PaecPaso2Schema,
  PaecPaso3Schema,
  PaecPaso4Schema,
  PaecPaso5Schema,
  PaecPaso8ImplementacionSchema,
  PaecPaso9GobernanzaSchema,
} from '@/lib/ai-schemas';
import { z } from 'zod';
import type { DetalleCurricularRow } from '@/types/paec';
import { extractIdempotencyKey, checkIdempotencyKey, createIdempotencyKey } from '@/lib/idempotency';
import {
  distillPaecProgression,
  isLikelyLaboralUac,
} from '@/lib/paec/plan-operativo-postprocessor';
import { SCHOOL_YEAR } from '@/lib/config';
import { handlePaecSteps1To5 } from '@/lib/paec/step-handlers/steps-1-5';
import { handlePaecSteps6To7 } from '@/lib/paec/step-handlers/steps-6-7';
import { handlePaecSteps8To9 } from '@/lib/paec/step-handlers/steps-8-9';

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
    const { step, allowPartialGeneration } = body as {
      step: number;
      allowPartialGeneration?: boolean;
    };

    if (!step || step < 1 || step > 9) {
      return NextResponse.json(
        { error: 'Número de paso no válido (debe ser de 1 a 9)' },
        { status: 400 }
      );
    }

    // H-314: Validación de Insumos Mínimos Reales (needsInput Guard)
    const inputGuard = validatePaecStepInputs(step, project as unknown as Record<string, unknown>, {
      allowPartialGeneration,
    });
    if (inputGuard.needsInput) {
      return NextResponse.json({
        success: true,
        needsInput: true,
        step,
        missingFields: inputGuard.missingFields,
        message: inputGuard.message,
      });
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

    // Inyectar contexto regulatorio oficial (H-311) evaluado una sola vez por llamada POST
    const regulatoryContext = getPaecRegulatoryContext(step);
    const knowledgeContext = await getInstitutionalContext('paec', { contextId: `paec:${id}` });
    const stepSystemPrompt = [PAEC_SYSTEM_PROMPT, regulatoryContext, knowledgeContext.block]
      .filter(Boolean)
      .join('\n\n');

    let userPrompt = '';
    let fieldName = '';
    let stepResultData: object | null = null;


    const handlerCtx = {
      id,
      step,
      project,
      teacherId: teacher.id,
      stepSystemPrompt,
      libraryContext,
    };

    const dispatchResult =
      step <= 5
        ? await handlePaecSteps1To5(handlerCtx)
        : step <= 7
        ? await handlePaecSteps6To7(handlerCtx)
        : await handlePaecSteps8To9(handlerCtx);

    if (dispatchResult.errorResponse) {
      return NextResponse.json(
        { error: dispatchResult.errorResponse.error },
        { status: dispatchResult.errorResponse.status }
      );
    }

    userPrompt = dispatchResult.userPrompt;
    fieldName = dispatchResult.fieldName;
    stepResultData = dispatchResult.stepResultData;

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
      const text = await generateWithRotation(stepSystemPrompt, fullUserPrompt, teacher.id);

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

    // Fase C: Destilar progressionsOrPurposes en Paso 5 (Detalle Curricular)
    if (step === 5 && Array.isArray(parsedJson)) {
      parsedJson = (parsedJson as DetalleCurricularRow[]).map((row) => ({
        ...row,
        progressionsOrPurposes: distillPaecProgression(row.progressionsOrPurposes, {
          semester: Number(row.semester),
          component: isLikelyLaboralUac(row.uacName) ? 'competencias_laborales' : 'fundamental',
          cicloEscolar: SCHOOL_YEAR,
          maxChars: 340,
        }),
      }));
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

