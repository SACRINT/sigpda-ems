import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { getZoneSupervisorDashboard } from '@/lib/zone-sync-service';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const isUserAdmin = await isAdmin(session.user.email, teacher.role);
    const isSupervisor = isUserAdmin || teacher.role === 'supervisor';

    if (!isSupervisor) {
      return NextResponse.json(
        { error: 'Acceso reservado a Supervisores Escolares y Administradores' },
        { status: 403 }
      );
    }

    const dashboard = await getZoneSupervisorDashboard(teacher.id);

    return NextResponse.json(dashboard, { status: 200 });
  } catch (error) {
    logger.error('[API-Supervisor-Dashboard] Error generando dashboard de zona:', error);
    const message = error instanceof Error ? error.message : 'Error interno al generar dashboard de zona';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
