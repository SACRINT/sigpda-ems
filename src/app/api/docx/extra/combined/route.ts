import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getTeacherByEmail,
  getPlanningById,
  getPlanningExtrasByType,
} from '@/lib/db';
import { buildCombinedExtraDocx } from '@/lib/docx-helpers';
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
  return handleCombinedDocx(request);
}

export async function POST(request: NextRequest) {
  return handleCombinedDocx(request);
}

async function handleCombinedDocx(request: NextRequest) {
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

    // UN SOLO .docx con todos los documentos separados por salto de página
    let docxBuffer: Buffer;
    try {
      docxBuffer = await buildCombinedExtraDocx(allExtras, brandingCtx);
    } catch (err) {
      logger.error('Error construyendo DOCX combinado:', {
        error: err instanceof Error ? err.message : String(err),
      });
      return new Response('No se pudo generar el documento combinado', { status: 500 });
    }

    const cleanSubject = sanitizeDocFilename(planning.uac_name || 'UAC', 30);
    const fileName = `${typeLabel(cleanType)}_Todos_Bloques_${cleanSubject}.docx`;

    return new Response(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Combined DOCX export error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
