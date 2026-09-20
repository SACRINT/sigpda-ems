import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
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
      return NextResponse.json({ error: 'Auditoría no encontrada.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      audit: rows[0]
    });
  } catch (error: any) {
    logger.error('[API /api/audit/[id] GET Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener el reporte de auditoría.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const db = sql();

    await db`DELETE FROM audit_results WHERE id = ${id}::uuid OR planning_id = ${id}::uuid`;

    return NextResponse.json({
      success: true,
      message: 'Auditoría eliminada exitosamente.'
    });
  } catch (error: any) {
    logger.error('[API /api/audit/[id] DELETE Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar la auditoría.' },
      { status: 500 }
    );
  }
}
