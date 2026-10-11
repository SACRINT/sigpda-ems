import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import { planeacionesOrchestrator, PlaneacionOrchestratorError } from '@/lib/planeaciones/orchestrator';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * @openapi
 * /api/planeaciones/{id}/pdf:
 *   get:
 *     summary: Exportación oficial a PDF de planeación didáctica
 *     description: Genera y descarga el documento oficial en PDF con membrete institucional, tipografía Lato/Montserrat y formato Carta. Controlado por Strangler Fig bajo la bandera PLANEACION_ORCHESTRATOR_V2.
 *     tags:
 *       - Planeaciones
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: UUID de la planeación
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Archivo binario PDF generado exitosamente
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Planeación no encontrada
 *       501:
 *         description: Exportación PDF en servidor no implementada en modo legacy (flag OFF)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Strangler Fig: Si la feature flag está inactiva (legacy default = false), retornar 501
    if (!isFeatureEnabled('PLANEACION_ORCHESTRATOR_V2')) {
      return NextResponse.json(
        { error: 'Exportación a PDF en servidor no habilitada en modo legacy (controlado por PLANEACION_ORCHESTRATOR_V2).' },
        { status: 501 }
      );
    }

    const pdfBuffer = await planeacionesOrchestrator.renderPDF(id);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="planeacion-${id}.pdf"`,
      },
    });
  } catch (err) {
    if (err instanceof PlaneacionOrchestratorError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error('[API planeaciones/pdf] Error inesperado en renderizado PDF:', { error: err });
    return NextResponse.json(
      { error: 'Error interno generando PDF de planeación' },
      { status: 500 }
    );
  }
}
