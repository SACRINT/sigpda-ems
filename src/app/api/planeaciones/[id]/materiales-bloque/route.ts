import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getBlockWorkbook, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import { cascadeBlockMaterials } from '@/lib/guide-engine/cascade-block-materials';

async function handleMaterialesBloque(
  request: NextRequest,
  paramsPromise: Promise<{ id: string }>
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: planningId } = await paramsPromise;
    const { searchParams } = new URL(request.url);
    const blockIndex = parseInt(searchParams.get('blockIndex') || '0', 10);

    if (isNaN(blockIndex) || blockIndex < 0) {
      return NextResponse.json({ error: 'blockIndex inválido' }, { status: 400 });
    }

    // 1. Verificar existencia y pertenencia de la planeación
    const db = sql();
    const planRows = await db`
      SELECT id, teacher_id, uac_name
      FROM plannings
      WHERE id = ${planningId}::uuid
      LIMIT 1
    `;

    if (!planRows || planRows.length === 0) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const currentTeacher = await getTeacherByEmail(session.user.email);
    const isUserAdmin = await isAdmin(session.user.email);

    if (
      !isUserAdmin &&
      currentTeacher?.role !== 'supervisor' &&
      currentTeacher?.role !== 'director' &&
      planRows[0].teacher_id !== currentTeacher?.id
    ) {
      return NextResponse.json({ error: 'Acceso denegado a esta planeación' }, { status: 403 });
    }

    // 2. Obtener el Libro de Bloque
    const workbook = await getBlockWorkbook(planningId, blockIndex);
    if (!workbook) {
      return NextResponse.json({
        success: false,
        error: `El Libro de Bloque ${blockIndex + 1} aún no ha sido generado. Primero genera el Libro de Bloque para derivar automáticamente sus materiales.`,
      }, { status: 404 });
    }

    // 3. Cascada automática determinística hacia planning_extras (<15ms, 0 tokens)
    const cascadeResult = await cascadeBlockMaterials(
      planningId,
      blockIndex,
      workbook,
      currentTeacher?.id
    );

    // 4. Extracción para respuesta
    const materials = extractMaterialsFromWorkbook(workbook);

    return NextResponse.json({
      success: true,
      blockIndex,
      planningTitle: planRows[0].uac_name,
      cascade: cascadeResult,
      materials,
    });
  } catch (error: any) {
    console.error('[API /materiales-bloque] Error:', error);
    return NextResponse.json({ error: 'Error interno al derivar materiales de bloque' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleMaterialesBloque(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleMaterialesBloque(request, params);
}

