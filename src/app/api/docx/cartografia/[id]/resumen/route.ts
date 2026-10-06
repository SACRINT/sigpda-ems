import { NextRequest } from 'next/server';
import { generateResumenEjecutivoDocx } from '@/lib/cartografia-zona-docx-generator';
import { handleCartografiaDocxRequest } from '@/lib/cartografia-docx-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  return handleCartografiaDocxRequest(id, generateResumenEjecutivoDocx, 'Resumen_Ejecutivo');
}
