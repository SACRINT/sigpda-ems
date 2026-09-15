import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';
import { 
  createProgramCatalogItem, 
  updateProgramCatalogItem, 
  deleteProgramCatalogItem,
  ProgramCatalogItem
} from '@/lib/db';
import { getFilteredCachedPrograms, invalidateCatalogCache } from '@/lib/catalog-cache';

import { logger } from '@/lib/logger';
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const semesterParam = searchParams.get('semester');
    const component = searchParams.get('component') || undefined;
    const subsystem = searchParams.get('subsystem') || undefined;

    const semester = semesterParam && semesterParam !== 'all' ? parseInt(semesterParam, 10) : undefined;

    const programs = await getFilteredCachedPrograms(
      semester !== undefined && !isNaN(semester) ? semester : undefined,
      component,
      subsystem
    );

    return NextResponse.json({ programs });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (error.message === 'FORBIDDEN') return adminForbidden();
    logger.error('GET /api/admin/programs error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body: ProgramCatalogItem = await request.json();

    if (!body.uac_name || !body.semester || !body.component || !body.total_hours) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: uac_name, semester, component, total_hours' },
        { status: 400 }
      );
    }

    const created = await createProgramCatalogItem(body);
    invalidateCatalogCache();
    return NextResponse.json({ ok: true, program: created });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (error.message === 'FORBIDDEN') return adminForbidden();
    logger.error('POST /api/admin/programs error:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar programa' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body: Partial<ProgramCatalogItem> & { id: string } = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'ID del programa requerido' }, { status: 400 });
    }

    const updated = await updateProgramCatalogItem(body.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
    }

    invalidateCatalogCache();
    return NextResponse.json({ ok: true, program: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (error.message === 'FORBIDDEN') return adminForbidden();
    logger.error('PUT /api/admin/programs error:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar programa' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID del programa requerido' }, { status: 400 });
    }

    const deleted = await deleteProgramCatalogItem(id);
    invalidateCatalogCache();
    return NextResponse.json({ ok: true, deleted });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (error.message === 'FORBIDDEN') return adminForbidden();
    logger.error('DELETE /api/admin/programs error:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar programa' }, { status: 500 });
  }
}
