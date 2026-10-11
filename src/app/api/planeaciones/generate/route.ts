import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import { planeacionesOrchestrator, PlaneacionOrchestratorError } from '@/lib/planeaciones/orchestrator';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * @openapi
 * /api/planeaciones/generate:
 *   post:
 *     summary: Generación estructurada de planeación didáctica (NEM / Tres Saberes)
 *     description: Genera una planeación didáctica sintética y determinista bajo el contrato IPlaneacionOrchestrator N1. Controlado por Strangler Fig bajo la bandera PLANEACION_ORCHESTRATOR_V2.
 *     tags:
 *       - Planeaciones
 *     responses:
 *       200:
 *         description: Planeación generada exitosamente
 *       400:
 *         description: Datos de entrada inválidos o incompletos
 *       401:
 *         description: No autorizado
 *       501:
 *         description: Generación con orquestador no habilitada en modo legacy (flag OFF)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Strangler Fig: Si la feature flag está inactiva (legacy default = false), retornar 501
    if (!isFeatureEnabled('PLANEACION_ORCHESTRATOR_V2')) {
      return NextResponse.json(
        { error: 'Generación directa de planeación no habilitada en modo legacy (controlado por PLANEACION_ORCHESTRATOR_V2).' },
        { status: 501 }
      );
    }

    const body = await request.json();
    const result = await planeacionesOrchestrator.generate(body);

    return NextResponse.json({
      success: true,
      planning: result,
    }, { status: 200 });
  } catch (err) {
    if (err instanceof PlaneacionOrchestratorError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error('[API planeaciones/generate] Error inesperado en orquestador:', { error: err });
    return NextResponse.json(
      { error: 'Error interno generando planeación' },
      { status: 500 }
    );
  }
}
