import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById, getPlanningExtrasByType } from '@/lib/db';
import { generateExtraPdfDocument } from '@/lib/pdf-extra-renderer';
import { isStructuredVisualPayload } from '@/lib/materials/material-tokens';
import { sanitizeDocFilename, type BrandingContext } from '@/lib/document-branding';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/** Etiquetas conocidas de tipo → nombre de archivo. Cualquier otro tipo se acepta con fallback. */
const TYPE_LABELS: Record<string, string> = {
  rubric: 'Rubricas',
  checklist: 'Lista_de_Cotejo',
  material: 'Materiales_Docente',
  teacher_guide: 'Solucionarios',
  lesson_plan: 'Planes_de_Clase',
  practice_guide: 'Guias_de_Trabajo',
  visual: 'Recursos_Visuales',
};

function typeLabel(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  return sanitizeDocFilename(type.replace(/_/g, '-'), 40) || 'Documento';
}

export async function GET(request: NextRequest) {
  return handleCombinedPdf(request);
}

export async function POST(request: NextRequest) {
  return handleCombinedPdf(request);
}

async function handleCombinedPdf(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('No autorizado', { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return new Response('Docente no encontrado', { status: 404 });
    }

    let planningId: string | null = null;
    let type: string | undefined = undefined;

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        planningId = body.planningId || null;
        type = body.type;
      } catch {
        // Ignorar
      }
    }

    if (!planningId) {
      planningId = request.nextUrl.searchParams.get('planningId');
      type = type || request.nextUrl.searchParams.get('type') || undefined;
    }

    const cleanType = (type || '').trim();
    if (!planningId || !cleanType) {
      return new Response('Parámetros insuficientes. Requiere planningId y type (cualquier tipo de extra).', {
        status: 400,
      });
    }

    const planning = await getPlanningById(planningId, teacher.id);
    if (!planning) {
      return new Response('Planeación no encontrada o no autorizada', { status: 404 });
    }

    const brandingCtx: BrandingContext = {
      schoolName: planning.extracted_data?.schoolName,
      cct: planning.extracted_data?.cct,
      semester: planning.semester,
    };

    // Todos los bloques del tipo solicitado, excluyendo payloads visuales JSON (no renderizables)
    const fetched = await getPlanningExtrasByType(planningId, teacher.id, cleanType);
    const allExtras = fetched.filter((ex) => !isStructuredVisualPayload(ex.content_text));

    if (allExtras.length === 0) {
      return new Response('No se encontraron documentos de este tipo para combinar', { status: 404 });
    }

    // Generar PDF individual por extra y fusionar con pdf-lib
    const mergedPdf = await PDFDocument.create();
    let generatedCount = 0;

    for (const extra of allExtras) {
      try {
        const pdfDoc = generateExtraPdfDocument({ ...extra, keyIndex: extra.key_index }, brandingCtx);
        const bytes = Buffer.from(pdfDoc.output('arraybuffer'));
        const individualPdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(individualPdf, individualPdf.getPageIndices());
        for (const page of pages) {
          mergedPdf.addPage(page);
        }
        generatedCount++;
      } catch (err) {
        logger.warn(`Error generando PDF para extra ${extra.id}:`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (generatedCount === 0) {
      return new Response('No se pudo generar ningún documento', { status: 500 });
    }

    const mergedBytes = await mergedPdf.save();
    const cleanSubject = sanitizeDocFilename(planning.uac_name || 'UAC', 30);
    const fileName = `${typeLabel(cleanType)}_Todos_Bloques_${cleanSubject}.pdf`;

    return new Response(new Uint8Array(mergedBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Combined PDF export error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
