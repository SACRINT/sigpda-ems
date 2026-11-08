import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getBlockWorkbook, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import { cascadeBlockMaterials } from '@/lib/guide-engine/cascade-block-materials';
import { reviewBlockMaterials } from '@/lib/guide-engine/material-review';
import { logger } from '@/lib/logger';

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
      SELECT id, teacher_id, uac_name, component, curriculum_name
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

    const uacName = planRows[0].uac_name || workbook.coverData?.subjectName || '';
    const component = planRows[0].component || '';
    const curriculumName = planRows[0].curriculum_name || '';

    // 3. Extracción determinística para respuesta y reporte R1
    const materials = extractMaterialsFromWorkbook(workbook);

    if (request.method === 'GET') {
      const review = reviewBlockMaterials({
        workbook,
        extracted: materials,
        uacName,
        component,
        curriculumName,
      });

      return NextResponse.json({
        success: true,
        blockIndex,
        planningTitle: planRows[0].uac_name,
        review,
        omitted: [],
        materials,
      });
    }

    // 4. POST: Cascada determinística hacia planning_extras con gate previo no destructivo
    const cascadeResult = await cascadeBlockMaterials(
      planningId,
      blockIndex,
      workbook,
      currentTeacher?.id,
      {
        uacName,
        component,
        curriculumName,
        failOnAnyError: true,
      }
    );

    const review =
      cascadeResult?.review ??
      reviewBlockMaterials({
        workbook,
        extracted: materials,
        uacName,
        component,
        curriculumName,
      });
    const omitted = cascadeResult?.omitted ?? [];

    if (cascadeResult?.review && (!cascadeResult.review.ok || omitted.length > 0)) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          blockIndex,
          planningTitle: planRows[0].uac_name,
          error: 'Material bloqueado por inconsistencia estructural',
          issues: cascadeResult.review.errors,
          review: cascadeResult.review,
          omitted,
          cascade: cascadeResult,
          materials,
        },
        { status: 422 }
      );
    }

    if (!cascadeResult?.success) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          blockIndex,
          planningTitle: planRows[0].uac_name,
          error: cascadeResult?.error || 'No se pudieron persistir los materiales del bloque',
          cascade: cascadeResult,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      blockIndex,
      planningTitle: planRows[0].uac_name,
      cascade: cascadeResult,
      review,
      omitted,
      materials,
    });
  } catch (error: unknown) {
    logger.error('[API /materiales-bloque] Error:', error);
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

