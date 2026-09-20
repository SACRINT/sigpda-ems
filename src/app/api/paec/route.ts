import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectsByTeacher, createPaecProject } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import type { CreatePaecInput } from '@/types/paec';
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

    const isUserAdmin = await isAdmin(session.user.email, teacher.role);
    const isDirector = isUserAdmin || teacher.role === 'director';
    if (!isDirector) {
      return NextResponse.json({ error: 'Solo los directores pueden gestionar proyectos PAEC' }, { status: 403 });
    }

    const projects = await getPaecProjectsByTeacher(teacher.id);
    return NextResponse.json({ projects });
  } catch (error) {
    logger.error('Error fetching PAEC projects:', error);
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

    const isUserAdmin = await isAdmin(session.user.email, teacher.role);
    const isDirector = isUserAdmin || teacher.role === 'director';
    if (!isDirector) {
      return NextResponse.json({ error: 'Solo los directores pueden gestionar proyectos PAEC' }, { status: 403 });
    }

    const body = (await request.json()) as CreatePaecInput;
    if (!body.projectName || !body.problemStatement || !body.cycleType) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos (projectName, problemStatement, cycleType)' },
        { status: 400 }
      );
    }

    const project = await createPaecProject({
      teacherId: teacher.id,
      projectName: body.projectName,
      problemStatement: body.problemStatement,
      cycleType: body.cycleType,
      communityContext: body.communityContext || {},
      schoolContext: body.schoolContext || {},
    });

    return NextResponse.json({ success: true, project });
  } catch (error) {
    logger.error('Error creating PAEC project:', error);
    return NextResponse.json({ error: 'Error al crear el proyecto' }, { status: 500 });
  }
}
