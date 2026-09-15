import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { 
  getTeacherByEmail, 
  getNotifications, 
  getUnreadNotificationsCount, 
  createNotification, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification,
  NotificationItem
} from '@/lib/db';

import { logger } from '@/lib/logger';
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
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const notifications = await getNotifications(teacher.id, unreadOnly);
    const unreadCount = await getUnreadNotificationsCount(teacher.id);

    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    logger.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener notificaciones' }, { status: 500 });
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

    const body: Partial<NotificationItem> = await request.json();

    if (!body.title || !body.message || !body.type) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: title, message, type' },
        { status: 400 }
      );
    }

    const created = await createNotification({
      user_id: body.user_id || teacher.id,
      type: body.type,
      title: body.title,
      message: body.message,
      link: body.link,
      severity: body.severity || 'info',
      read: false,
    });

    return NextResponse.json({ ok: true, notification: created });
  } catch (error: any) {
    logger.error('POST /api/notifications error:', error);
    return NextResponse.json({ error: error.message || 'Error al crear notificación' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
    const { id, markAll = false } = body;

    if (markAll) {
      await markAllNotificationsAsRead(teacher.id);
      return NextResponse.json({ ok: true, message: 'Todas las notificaciones marcadas como leídas' });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID de notificación requerido' }, { status: 400 });
    }

    const updated = await markNotificationAsRead(id, teacher.id);
    return NextResponse.json({ ok: true, notification: updated });
  } catch (error: any) {
    logger.error('PATCH /api/notifications error:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar notificación' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de notificación requerido' }, { status: 400 });
    }

    const deleted = await deleteNotification(id, teacher.id);
    return NextResponse.json({ ok: true, deleted });
  } catch (error: any) {
    logger.error('DELETE /api/notifications error:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar notificación' }, { status: 500 });
  }
}
