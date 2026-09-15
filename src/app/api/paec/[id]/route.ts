import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectById, deletePaecProject, updatePaecProjectStep } from '@/lib/db';

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
    const project = await getPaecProjectById(id, teacher.id);
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    logger.error('Error fetching PAEC project details:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
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
    const body = await request.json();
    const { fieldName, stepData, step } = body;

    if (!fieldName || !stepData || step === undefined) {
      return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
    }

    const updated = await updatePaecProjectStep(id, teacher.id, step, fieldName, stepData);
    return NextResponse.json({ success: true, project: updated });
  } catch (error) {
    logger.error('Error updating PAEC project step:', error);
    return NextResponse.json({ error: 'Error al actualizar el proyecto' }, { status: 500 });
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
    await deletePaecProject(id, teacher.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting PAEC project:', error);
    return NextResponse.json({ error: 'Error al eliminar el proyecto' }, { status: 500 });
  }
}
