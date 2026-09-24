import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseCartografiaMatriz } from '@/lib/cartografia-parser';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import {
  cartografiaContextProvider,
  CartografiaContextProviderError,
} from '@/lib/cartografia/context-provider';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const zonaNumero = (formData.get('zonaNumero') as string) || '004';
    const cicloEscolar = (formData.get('cicloEscolar') as string) || '2026-2027';

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo de Excel' }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const isSupported = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv');

    if (!isSupported) {
      return NextResponse.json(
        { error: 'Formato no compatible. Por favor sube un archivo Excel (.xlsx, .xls) o CSV.' },
        { status: 400 }
      );
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo no puede exceder 20 MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── Strangler Fig: si CARTOGRAFIA_ORCHESTRATOR_V2 está activo, delega al context provider ─
    if (isFeatureEnabled('CARTOGRAFIA_ORCHESTRATOR_V2')) {
      try {
        const result = await cartografiaContextProvider.ingestZoneMatrix(buffer, {
          filename: file.name,
          zonaNumero,
          cicloEscolar,
          linkDbPaec: true,
        });
        return NextResponse.json(result);
      } catch (err: unknown) {
        if (err instanceof CartografiaContextProviderError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
    }

    // ── Flujo Legacy (cuando CARTOGRAFIA_ORCHESTRATOR_V2 = false) ────────────────────
    const result = await parseCartografiaMatriz(buffer, {
      zonaNumero,
      cicloEscolar,
      linkDbPaec: true,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'No se pudieron extraer datos válidos del formato 911/F11.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      momento1: result.momento1,
      momento2: result.momento2,
    });
  } catch (error: unknown) {
    logger.error('[API-Cartografia-ParseExcel] Error procesando archivo Excel:', error);
    const message = error instanceof Error ? error.message : 'Error interno al procesar el archivo Excel';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
