import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getScheduleById, updateSchedule, deleteSchedule, ScheduleItem } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { logger } from '@/lib/logger';

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
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;
    const isUserAdmin = await isAdmin(session.user.email, teacher.role);
    const schedule = await getScheduleById(id, isUserAdmin ? undefined : teacher.id);

    if (!schedule) {
      return NextResponse.json({ error: 'Horario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, schedule });
  } catch (error: any) {
    logger.error('GET /api/schedules/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}

export async function PUT(
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
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;
    const body: Partial<ScheduleItem> = await request.json();

    const updated = await updateSchedule(id, teacher.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Horario no encontrado o no tiene permisos para modificarlo' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, schedule: updated });
  } catch (error: any) {
    logger.error('PUT /api/schedules/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar el horario' }, { status: 500 });
  }
}

export async function DELETE(
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
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;
    const deleted = await deleteSchedule(id, teacher.id);

    if (!deleted) {
      return NextResponse.json({ error: 'Horario no encontrado o no tiene permisos para eliminarlo' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (error: any) {
    logger.error('DELETE /api/schedules/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar el horario' }, { status: 500 });
  }
}
