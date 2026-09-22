import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-unified';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      return NextResponse.json({ success: true, audit: null }, { status: 200 });
    }

    const db = sql();

    // Buscar por ID de auditoría o por ID de planeación
    const rows = await db`
      SELECT 
        a.id,
        a.planning_id,
        a.teacher_id,
        a.uac_name,
        a.semester,
        a.component,
        a.subsystem,
        a.overall_score,
        a.compliance_level,
        a.dimension_scores,
        a.findings,
        a.recommendations,
        a.official_program_ref,
        a.audited_by,
        a.created_at,
        a.updated_at,
        t.id as owner_teacher_id,
        t.name as teacher_name,
        t.email as teacher_email,
        p.curriculum_name,
        p.paec_context
      FROM audit_results a
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN plannings p ON a.planning_id = p.id
      WHERE a.id = ${id}::uuid OR a.planning_id = ${id}::uuid
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, audit: null }, { status: 200 });
    }

    const audit = rows[0];
    const userEmail = session.user.email;
    const isUserAdmin = await isAdmin(userEmail);

    if (!isUserAdmin) {
      const currentTeacherRows = await db`SELECT id, role FROM teachers WHERE email = ${userEmail} LIMIT 1`;
      const currentTeacher = currentTeacherRows[0];
      const isSupervisor = currentTeacher?.role === 'supervisor' || currentTeacher?.role === 'administrador';
      const isOwner = currentTeacher && (currentTeacher.id === audit.teacher_id || currentTeacher.id === audit.owner_teacher_id || userEmail === audit.teacher_email);

      if (!isSupervisor && !isOwner) {
        return NextResponse.json({ error: 'Acceso denegado a esta auditoría.' }, { status: 403 });
      }
    }

    return NextResponse.json({
      success: true,
      audit
    });
  } catch (error: unknown) {
    logger.error('[API /api/audit/[id] GET Error]:', error);
    const message = error instanceof Error ? error.message : 'Error al obtener el reporte de auditoría.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      return NextResponse.json({ error: 'ID de auditoría inválido' }, { status: 400 });
    }

    const db = sql();

    const rows = await db`
      SELECT a.id, a.teacher_id, t.email as teacher_email
      FROM audit_results a
      LEFT JOIN teachers t ON a.teacher_id = t.id
      WHERE a.id = ${id}::uuid OR a.planning_id = ${id}::uuid
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Auditoría no encontrada.' }, { status: 404 });
    }

    const audit = rows[0];
    const userEmail = session.user.email;
    const isUserAdmin = await isAdmin(userEmail);

    if (!isUserAdmin) {
      const currentTeacherRows = await db`SELECT id FROM teachers WHERE email = ${userEmail} LIMIT 1`;
      const currentTeacher = currentTeacherRows[0];
      const isOwner = currentTeacher && (currentTeacher.id === audit.teacher_id || userEmail === audit.teacher_email);
      if (!isOwner) {
        return NextResponse.json({ error: 'No tienes permiso para eliminar esta auditoría.' }, { status: 403 });
      }
    }

    await db`DELETE FROM audit_results WHERE id = ${id}::uuid OR planning_id = ${id}::uuid`;

    return NextResponse.json({
      success: true,
      message: 'Auditoría eliminada exitosamente.'
    });
  } catch (error: unknown) {
    logger.error('[API /api/audit/[id] DELETE Error]:', error);
    const message = error instanceof Error ? error.message : 'Error al eliminar la auditoría.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
