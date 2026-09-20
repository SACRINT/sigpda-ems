import { NextRequest } from 'next/server';
import JSZip from 'jszip';
import { auth } from '@/lib/auth';
import {
  getTeacherByEmail,
  getPlanningById,
  getPlanningExtrasByBlock,
  getPlanningExtrasByIds,
} from '@/lib/db';
import { buildExtraDocx } from '@/lib/docx-helpers';
import { sanitizeDocFilename, type BrandingContext } from '@/lib/document-branding';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return handleBulkDocx(request);
}

export async function POST(request: NextRequest) {
  return handleBulkDocx(request);
}

async function handleBulkDocx(request: NextRequest) {
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
    let blockIndex: number | null = null;
    let type: string | undefined = undefined;
    let extraIds: string[] | undefined = undefined;

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        planningId = body.planningId || null;
        blockIndex = typeof body.blockIndex === 'number' ? body.blockIndex : null;
        type = body.type;
        extraIds = Array.isArray(body.extraIds) ? body.extraIds : undefined;
      } catch {
        // Ignorar error si no hay JSON válido
      }
    }

    if (!planningId && !extraIds) {
      const searchParams = request.nextUrl.searchParams;
      planningId = searchParams.get('planningId');
      const bIdx = searchParams.get('blockIndex');
      if (bIdx !== null && bIdx !== '') {
        blockIndex = parseInt(bIdx, 10);
      }
      type = searchParams.get('type') || undefined;
      const idsParam = searchParams.get('extraIds');
      if (idsParam) {
        extraIds = idsParam.split(',').filter(Boolean);
      }
    }

    let extras: Array<{ id: string; planning_id: string; type: string; title: string; key_index: number | null; content_text: string }> = [];
    let brandingCtx: BrandingContext | undefined = undefined;
    let zipName = 'Materiales_Educativos_DOCX.zip';

    if (extraIds && extraIds.length > 0) {
      extras = await getPlanningExtrasByIds(extraIds, teacher.id);
    } else if (planningId && blockIndex !== null && !isNaN(blockIndex)) {
      const planning = await getPlanningById(planningId, teacher.id);
      if (!planning) {
        return new Response('Planeación no encontrada o no autorizada', { status: 404 });
      }

      brandingCtx = {
        schoolName: planning.extracted_data?.schoolName,
        cct: planning.extracted_data?.cct,
        semester: planning.semester,
      };

      extras = await getPlanningExtrasByBlock(planningId, blockIndex, teacher.id, type);
      const blockNum = blockIndex + 1;
      const typeLabel = type === 'lesson_plan' ? 'Planes_de_Clase' : 'Materiales';
      const cleanSubject = sanitizeDocFilename(planning.uac_name || 'UAC', 30);
      zipName = `${typeLabel}_Bloque_${blockNum}_${cleanSubject}_DOCX.zip`;
    } else {
      return new Response('Parámetros insuficientes (requiere planningId y blockIndex o extraIds)', { status: 400 });
    }

    if (extras.length === 0) {
      return new Response('No se encontraron materiales para empaquetar', { status: 404 });
    }

    const zip = new JSZip();
    const usedNames = new Set<string>();

    // 1. Asignación determinista de nombres de archivo con deduplicación
    const fileEntries = extras.map((item, i) => {
      let baseName = sanitizeDocFilename(item.title, 55);
      if (!baseName) baseName = `extra_${i + 1}`;

      let fileName = `${baseName}.docx`;
      let counter = 1;
      while (usedNames.has(fileName.toLowerCase())) {
        fileName = `${baseName}_${counter}.docx`;
        counter++;
      }
      usedNames.add(fileName.toLowerCase());
      return { item, fileName };
    });

    // 2. Generación paralela en lotes de 8 para alto rendimiento sin saturación de memoria
    const BATCH_SIZE = 8;
    for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
      const batch = fileEntries.slice(i, i + BATCH_SIZE);
      const generated = await Promise.all(
        batch.map(async ({ item, fileName }) => {
          try {
            const docxBuffer = await buildExtraDocx(item, brandingCtx);
            return { fileName, docxBuffer };
          } catch (err) {
            logger.warn(`Error generating DOCX for extra ${item.id} (${fileName}):`, {
              error: err instanceof Error ? err.message : String(err),
            });
            return null;
          }
        })
      );
      for (const res of generated) {
        if (res) {
          zip.file(res.fileName, res.docxBuffer);
        }
      }
    }

    if (Object.keys(zip.files).length === 0) {
      return new Response('No se pudo generar ningún documento en el paquete', { status: 500 });
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Bulk DOCX export error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
