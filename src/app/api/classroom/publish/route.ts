import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-unified';
import { sql } from '@/lib/db/client';
import { publishPlanningToGoogleClassroom, checkClassroomConfig } from '@/lib/classroom';
import { logger } from '@/lib/logger';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const config = checkClassroomConfig();
  return NextResponse.json({
    configured: config.configured,
    missingKeys: config.missingKeys || [],
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { planningId } = body;

    if (!planningId) {
      return NextResponse.json(
        { error: 'Se requiere el ID de la planeación didáctica (planningId).' },
        { status: 400 }
      );
    }

    const db = sql();
    const userEmail = session.user.email;
    const isUserAdmin = await isAdmin(userEmail);

    const rows = await db`
      SELECT p.id, p.teacher_id, t.email as teacher_email
      FROM plannings p
      LEFT JOIN teachers t ON p.teacher_id = t.id
      WHERE p.id = ${planningId}::uuid
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const plan = rows[0];
    if (!isUserAdmin && plan.teacher_email !== userEmail) {
      return NextResponse.json({ error: 'Acceso denegado a esta planeación' }, { status: 403 });
    }

    const result = await publishPlanningToGoogleClassroom(planningId);

    if (!result.configured) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          message: result.message,
        },
        { status: 200 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          message: result.message,
          error: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    logger.error('[API classroom/publish POST error]:', error);
    const message = error instanceof Error ? error.message : 'Error interno al procesar la publicación a Google Classroom';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
