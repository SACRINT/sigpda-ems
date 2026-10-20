import { NextRequest } from 'next/server';
import JSZip from 'jszip';
import { auth } from '@/lib/auth';
import {
  getTeacherByEmail,
  getPlanningById,
  getPlanningExtrasByBlock,
} from '@/lib/db';
import { buildExtraDocx } from '@/lib/docx-helpers';
import { sanitizeDocFilename, sanitizeDocFilenameWithBlock, type BrandingContext } from '@/lib/document-branding';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const COMBINED_TYPES: Record<string, string> = {
  rubric: 'Rubricas',
  checklist: 'Lista_de_Cotejo',
  material: 'Materiales_Docente',
  teacher_guide: 'Solucionarios',
};

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

    if (!planningId || !type || !COMBINED_TYPES[type]) {
      return new Response(
        `Parámetros insuficientes. Requiere planningId y type válido (${Object.keys(COMBINED_TYPES).join(', ')})`,
        { status: 400 }
      );
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

    // Recolectar extras de los 3 bloques
    const allExtras: Array<{ id: string; planning_id: string; type: string; title: string; key_index: number | null; content_text: string }> = [];
    for (let blockIndex = 0; blockIndex < 3; blockIndex++) {
      const blockExtras = await getPlanningExtrasByBlock(planningId, blockIndex, teacher.id, type);
      allExtras.push(...blockExtras);
    }

    if (allExtras.length === 0) {
      return new Response('No se encontraron documentos de este tipo para combinar', { status: 404 });
    }

    // Generar DOCX y organizar en carpetas por bloque dentro del ZIP
    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (const extra of allExtras) {
      const blockNum = (extra.key_index ?? 0) + 1;
      const folder = zip.folder(`Bloque_${blockNum}`) || zip;
      let baseName = sanitizeDocFilenameWithBlock(extra.title, 70);
      if (!baseName) baseName = `extra_${extra.id.substring(0, 8)}`;

      let fileName = `${baseName}.docx`;
      let counter = 1;
      while (usedNames.has(fileName.toLowerCase())) {
        fileName = `${baseName}_${counter}.docx`;
        counter++;
      }
      usedNames.add(fileName.toLowerCase());

      try {
        const docxBuffer = await buildExtraDocx(extra, brandingCtx);
        folder.file(fileName, docxBuffer);
      } catch (err) {
        logger.warn(`Error generando DOCX para extra ${extra.id}:`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (Object.keys(zip.files).length === 0) {
      return new Response('No se pudo generar ningún documento', { status: 500 });
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const cleanSubject = sanitizeDocFilename(planning.uac_name || 'UAC', 30);
    const typeLabel = COMBINED_TYPES[type];
    const fileName = `${typeLabel}_3_Bloques_${cleanSubject}_DOCX.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Combined DOCX export error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
