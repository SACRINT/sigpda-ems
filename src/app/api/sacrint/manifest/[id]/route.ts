import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getAllBlockWorkbooks, getTeacherByEmail } from '@/lib/db';
import { exportSacrintCourseManifest } from '@/lib/sacrint-manifest-exporter';
import type { Planning } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 401 });
    }

    const { id } = await params;
    const rawPlanning = await getPlanningById(id);
    if (!rawPlanning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }
    if (rawPlanning.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'No tienes permiso para acceder a esta planeación' }, { status: 403 });
    }

    const planning: Planning = {
      id: rawPlanning.id,
      teacherId: rawPlanning.teacher_id,
      uacName: rawPlanning.uac_name,
      semester: rawPlanning.semester,
      component: rawPlanning.component,
      curriculumName: rawPlanning.curriculum_name || '',
      paecContext: rawPlanning.paec_context || '',
      extractedData: rawPlanning.extracted_data,
      contentJson: rawPlanning.content_json,
      status: rawPlanning.status,
      createdAt: rawPlanning.created_at,
      updatedAt: rawPlanning.updated_at,
    };

    const workbooksMap = await getAllBlockWorkbooks(id);
    const blockKeys = Object.keys(workbooksMap).sort((a, b) => {
      const numA = parseInt(a.replace('block_', ''), 10);
      const numB = parseInt(b.replace('block_', ''), 10);
      return numA - numB;
    });

    const workbooks: ActiveWorkTextbook[] = [];
    for (const key of blockKeys) {
      if (workbooksMap[key]?.current) {
        workbooks.push(workbooksMap[key].current);
      }
    }

    if (workbooks.length === 0) {
      return NextResponse.json(
        { error: 'No existen libros de trabajo generados para exportar el manifiesto' },
        { status: 404 }
      );
    }

    const manifest = exportSacrintCourseManifest(planning, workbooks);
    const cleanUac = (planning.uacName || 'UAC').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_ -]/g, '').trim();
    const filename = `sacrint_course_manifest_${cleanUac}.json`;

    return new NextResponse(JSON.stringify(manifest, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    logger.error('[GET /api/sacrint/manifest/[id]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al exportar el manifiesto de curso' },
      { status: 500 }
    );
  }
}
