/**
 * route.ts — Download Proxy para el Motor Editorial
 * SIGPDA-EMS · Motor Editorial de Alta Gama
 *
 * Ruta: GET /api/pdf/libro-editorial/[id]/download
 *
 * Motivo: en desarrollo local (sin BLOB_READ_WRITE_TOKEN) el PDF se persiste en
 * un directorio temporal y `pdf_storage_path` queda como `local://<archivo>`.
 * Ese esquema lo entiende la app pero NO el navegador (abre una pestaña en
 * blanco). Esta ruta resuelve el `local://` leyendo el archivo y devolviéndolo
 * como descarga; para rutas remotas (Vercel Blob) solo redirige.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById } from '@/lib/db';
import { featureFlags } from '@/lib/platform/feature-flags';
import {
  getDownloadableEditorialBookForPlanning,
  getEditorialBookByPlanningAndHash,
  getEditorialBookById,
} from '@/lib/editorial/editorial-db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

type RouteCtx = { params: Promise<{ id: string }> };

const LOCAL_BLOB_DIR = path.join(os.tmpdir(), 'sigpda_editorial_blobs');

export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    if (!featureFlags.isEnabled('EDITORIAL_PUBLISHER_ENGINE')) {
      return NextResponse.json(
        { error: 'El Motor Editorial se encuentra inactivo.', code: 'FEATURE_DISABLED' },
        { status: 403 },
      );
    }

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado', code: 'NOT_FOUND' }, { status: 404 });
    }

    const { id: planningId } = await params;
    const url = new URL(request.url);
    const contentHash = url.searchParams.get('contentHash');
    const bookId = url.searchParams.get('bookId');

    let book = null;
    if (bookId) {
      book = await getEditorialBookById(bookId);
    } else if (contentHash) {
      book = await getEditorialBookByPlanningAndHash(planningId, contentHash);
    } else {
      // Sin filtro explícito: copia descargable del contenido vigente (prioriza Vercel Blob
      // sobre `local://` huérfanos ilegibles desde esta instancia).
      book = await getDownloadableEditorialBookForPlanning(planningId);
    }

    if (!book || book.status !== 'completed' || !book.pdf_storage_path) {
      return NextResponse.json(
        { error: 'No se encontró un libro editorial descargable para esta planeación', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    // Verificar que el libro pertenezca a una planeación del docente autenticado.
    const planning = await getPlanningById(book.planning_id);
    const isOwner = planning?.teacher_id === teacher.id;
    if (!planning || !isOwner) {
      return NextResponse.json({ error: 'No autorizado para descargar este libro', code: 'FORBIDDEN' }, { status: 403 });
    }

    // El nombre visible en la descarga deriva del path persistido (UAC + bloque).
    const filename = path.basename(book.pdf_storage_path);

    // 1. Fallback local (desarrollo/CI): servir el archivo desde el disco.
    if (book.pdf_storage_path.startsWith('local://')) {
      const localFile = path.join(LOCAL_BLOB_DIR, filename);
      try {
        const buffer = await fs.promises.readFile(localFile);
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Content-Length': String(buffer.length),
            'Cache-Control': 'no-store',
          },
        });
      } catch (readErr) {
        logger.warn('[api/pdf/libro-editorial/download] Archivo local no encontrado:', {
          planningId,
          localFile,
          error: readErr instanceof Error ? readErr.message : String(readErr),
        });
        return NextResponse.json(
          { error: 'El PDF local ya no está disponible. Vuelve a exportar el libro.', code: 'LOCAL_FILE_MISSING' },
          { status: 404 },
        );
      }
    }

    // 2. Almacenamiento remoto (Vercel Blob): redirigir a la URL pública.
    return NextResponse.redirect(book.pdf_storage_path, 302);
  } catch (error) {
    logger.error('[api/pdf/libro-editorial/download] Error:', { error });
    const message = error instanceof Error ? error.message : 'Error descargando el libro editorial';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
