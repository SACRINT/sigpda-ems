import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById, deletePlanning, updatePlanningContent } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';

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
    if (!teacher) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const { id } = await params;
    const planning = await getPlanningById(id, teacher.id);
    if (!planning) return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });

    return NextResponse.json({ planning });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
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
    if (!teacher) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const { id } = await params;
    await deletePlanning(id, teacher.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
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
    if (!teacher) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    // Guardián Premium / Admin: Edición directa reservada
    const subStatus = await getSubscriptionStatus(teacher.id, session.user.email);
    if (!subStatus.isAdmin && !subStatus.hasActiveSubscription) {
      return NextResponse.json(
        { error: 'La edición directa de documentos es una función exclusiva del Plan Premium' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { content_json } = body;

    if (!content_json) {
      return NextResponse.json({ error: 'content_json requerido' }, { status: 400 });
    }

    const updated = await updatePlanningContent(id, teacher.id, content_json);
    return NextResponse.json({ success: true, planning: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}
