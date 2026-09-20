import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getSchedules, createSchedule, ScheduleItem } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { logger } from '@/lib/logger';
import { SCHOOL_YEAR } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const isUserAdmin = await isAdmin(session.user.email, teacher.role);
    // Admins can see all schedules or filter by teacher, regular teachers see only theirs
    const teacherId = isUserAdmin ? undefined : teacher.id;

    const schedules = await getSchedules(teacherId, status);
    return NextResponse.json({ ok: true, schedules });
  } catch (error: any) {
    logger.error('GET /api/schedules error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
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

    const body: Partial<ScheduleItem> = await request.json();

    if (!body.title || !body.celdas || !Array.isArray(body.celdas)) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: title y celdas' },
        { status: 400 }
      );
    }

    const newSchedule: ScheduleItem = {
      teacher_id: teacher.id,
      title: body.title,
      school_name: body.school_name || teacher.school_name || 'Plantel Oficial',
      cct: body.cct || teacher.cct || 'SIN CCT',
      cycle_year: body.cycle_year || SCHOOL_YEAR,
      period: body.period || 'A',
      status: body.status || 'published',
      config: body.config || {},
      grupos: body.grupos || [],
      docentes: body.docentes || [],
      aulas: body.aulas || [],
      cargas: body.cargas || [],
      celdas: body.celdas || [],
      metricas: body.metricas || {},
      ai_optimization_log: body.ai_optimization_log || [],
    };

    const created = await createSchedule(newSchedule);
    return NextResponse.json({ ok: true, schedule: created });
  } catch (error: any) {
    logger.error('POST /api/schedules error:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar el horario' }, { status: 500 });
  }
}
