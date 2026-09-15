import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningsByTeacher, createPlanning } from '@/lib/db';
import { canCreatePlanningForSubject, lockSubjectInSubscription } from '@/lib/subscription-gate';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }
    const plannings = await getPlanningsByTeacher(teacher.id);
    return NextResponse.json({ plannings });
  } catch (error) {
    logger.error('GET /api/plannings error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }
    const body = await request.json();
    const { uacName, semester, component, curriculumName, paecContext, extractedData, metodologiaActiva, paecOperationalActivity } = body;

    if (!uacName || !semester || !component) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: uacName, semester, component' },
        { status: 400 }
      );
    }

    // ── SUBSCRIPTION GATE ─────────────────────────────────────────────────────
    const access = await canCreatePlanningForSubject(
      teacher.id as string,
      session.user.email,
      uacName,
      Number(semester),
      component
    );

    if (!access.allowed) {
      return NextResponse.json(
        {
          error: access.message || 'No tienes acceso para crear planeaciones en esta materia.',
          reason: access.reason,
          upgradeUrl: '/suscripcion',
        },
        { status: 403 }
      );
    }

    // Crear la planeación
    const planning = await createPlanning({
      teacherId: teacher.id as string,
      uacName,
      semester: Number(semester),
      component,
      curriculumName,
      paecContext,
      extractedData,
      metodologiaActiva: metodologiaActiva || undefined,
      paecOperationalActivity: paecOperationalActivity || undefined,
    });

    // Registrar la materia en la suscripción si aún no está (consume un slot)
    if (access.reason !== 'admin') {
      try {
        await lockSubjectInSubscription(
          teacher.id as string,
          uacName,
          Number(semester),
          component
        );
      } catch (lockErr) {
        logger.warn('[plannings POST] Could not lock subject:', { error: lockErr });
        // No fallamos la creación si esto falla
      }
    }

    return NextResponse.json({ planning }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/plannings error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
