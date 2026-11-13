import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningsByTeacher, createPlanning, getProgramByUacAndSemester } from '@/lib/db';
import { canCreatePlanningForSubject, lockSubjectInSubscription } from '@/lib/subscription-gate';
import { resolverIdentidadEscolar } from '@/lib/school-identity';
import { repairExtractedDataWithCatalog } from '@/lib/planning/progresiones-enforcer';
import { resolveSemesterWeeks, resolveWeeklyHours } from '@/lib/guide-engine/content-budget';
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
    const { uacName, semester, component, curriculumName, paecContext, extractedData, metodologiaActiva, paecOperationalActivity, teacherName, subsystem } = body;
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

    // Consultar catálogo oficial para garantizar horas oficiales y metadatos en todos los semestres/subsistemas
    let finalExtractedData = extractedData;
    let officialProgram = null;
    try {
      officialProgram = await getProgramByUacAndSemester(uacName, Number(semester), component, subsystem);
      if (officialProgram && Number(semester) >= 5 && component !== 'laboral' && extractedData) {
        finalExtractedData = repairExtractedDataWithCatalog(
          extractedData,
          officialProgram,
          Number(semester),
          component
        );
      }
    } catch (catErr) {
      logger.warn('[plannings POST] Optional catalog lookup skipped:', catErr);
    }

    const resolvedSubsystem =
      (typeof subsystem === 'string' && subsystem.trim()) ||
      officialProgram?.subsystem ||
      extractedData?.subsystem ||
      undefined;
    const resolvedTotalHours =
      Number(officialProgram?.total_hours || finalExtractedData?.totalHours || 0) || undefined;
    const resolvedWeeklyHours = resolveWeeklyHours({
      uacName,
      subsystem: resolvedSubsystem,
      totalHours: resolvedTotalHours,
      extractedData: finalExtractedData,
    });
    const effectiveTotalHours =
      resolvedTotalHours || resolvedWeeklyHours * resolveSemesterWeeks(resolvedSubsystem);

    if (finalExtractedData && typeof finalExtractedData === 'object') {
      finalExtractedData = {
        ...finalExtractedData,
        totalHours: finalExtractedData.totalHours || effectiveTotalHours,
        totalHoursWeekly: finalExtractedData.totalHoursWeekly || resolvedWeeklyHours,
        ...(resolvedSubsystem && !finalExtractedData.subsystem ? { subsystem: resolvedSubsystem } : {}),
      };
    }

    // Crear la planeación
    const identidad = resolverIdentidadEscolar({
      schoolName: body.schoolName,
      cct: body.cct,
      municipality: body.municipality,
      schoolZone: body.schoolZone,
    });
    const planning = await createPlanning({
      teacherId: teacher.id as string,
      uacName,
      semester: Number(semester),
      component,
      curriculumName,
      paecContext,
      extractedData: finalExtractedData,
      metodologiaActiva: metodologiaActiva || undefined,
      paecOperationalActivity: paecOperationalActivity || undefined,
      teacherName: teacherName || undefined,
      schoolName: identidad.schoolName,
      cct: identidad.cct,
      municipality: identidad.municipality,
      schoolZone: identidad.schoolZone,
      subsystem: resolvedSubsystem || null,
      totalHours: effectiveTotalHours,
      totalHoursWeekly: resolvedWeeklyHours,
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
