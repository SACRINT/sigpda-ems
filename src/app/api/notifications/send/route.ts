import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { sendNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    let currentUserId = (session?.user as any)?.id;

    if (!currentUserId && session?.user?.email) {
      const teacher = await getTeacherByEmail(session.user.email);
      if (teacher) currentUserId = teacher.id;
    }

    const body = await req.json();
    const targetUserId = currentUserId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'No autorizado o usuario no identificado' }, { status: 401 });
    }

    if (!body.title || !body.message) {
      return NextResponse.json({ error: 'title y message son requeridos' }, { status: 400 });
    }

    const result = await sendNotification({
      userId: targetUserId,
      type: body.type || 'info',
      title: body.title,
      message: body.message,
      link: body.link,
      severity: body.severity || 'info',
      channels: body.channels || ['in_app'],
      metadata: body.metadata || {},
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, notification: result.notification }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/notifications/send:', error);
    return NextResponse.json({ error: error.message || 'Error al enviar notificación' }, { status: 500 });
  }
}
