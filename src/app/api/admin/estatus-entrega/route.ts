import { NextRequest, NextResponse } from 'next/server';
import { assertRole, AuthzError } from '@/lib/rbac';
import { getTeacherSchoolZone } from '@/lib/db/teachers';
import { sql } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authz = await assertRole(['director', 'supervisor', 'administrador', 'admin']);
    const { teacher, role, isAdmin } = authz;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    let targetCct: string | null = null;
    let targetSchoolName: string | null = null;
    let targetZona: string | null = null;

    if (role === 'director') {
      targetCct = teacher.cct || null;
      targetSchoolName = teacher.school_name || null;
      if (!targetCct && !targetSchoolName) {
        return NextResponse.json(
          { error: 'El director no tiene CCT ni nombre de escuela asignado en su perfil.' },
          { status: 403 }
        );
      }
    } else if (role === 'supervisor') {
      targetZona = await getTeacherSchoolZone(teacher.id);
      if (!targetZona) {
        return NextResponse.json(
          { error: 'El supervisor no tiene una zona escolar configurada en su perfil.' },
          { status: 403 }
        );
      }
    } else if (isAdmin) {
      targetCct = searchParams.get('cct') || null;
      targetSchoolName = searchParams.get('school_name') || null;
      targetZona = searchParams.get('zona') || null;
    }

    const client = sql();

    // 1. Estadísticas agregadas institucionales
    const statsRows = (await client`
      SELECT 
        COUNT(p.id)::int as total_planeaciones,
        COUNT(CASE WHEN p.status = 'generated' THEN 1 END)::int as generadas,
        COUNT(CASE WHEN p.status = 'draft' THEN 1 END)::int as borradores,
        COUNT(CASE WHEN (p.content_json->'dbepaAudit'->>'semaforo') = 'verde' THEN 1 END)::int as dbepa_verde,
        COUNT(CASE WHEN (p.content_json->'anexo12Audit'->>'ok')::boolean = true THEN 1 END)::int as anexo12_conforme
      FROM plannings p
      JOIN teachers t ON p.teacher_id = t.id
      LEFT JOIN horario_config h ON h.teacher_id = t.id
      WHERE (
        (${targetCct}::text IS NULL AND ${targetSchoolName}::text IS NULL) OR
        (${targetCct}::text IS NOT NULL AND t.cct = ${targetCct}) OR
        (${targetSchoolName}::text IS NOT NULL AND t.school_name = ${targetSchoolName})
      )
      AND (
        ${targetZona}::text IS NULL OR 
        COALESCE(h.zona_escolar, t.custom_preferences->>'zonaEscolar', t.custom_preferences->>'zona') = ${targetZona}
      )
    `) as Array<{
      total_planeaciones: number;
      generadas: number;
      borradores: number;
      dbepa_verde: number;
      anexo12_conforme: number;
    }>;

    const stats = statsRows[0] || {
      total_planeaciones: 0,
      generadas: 0,
      borradores: 0,
      dbepa_verde: 0,
      anexo12_conforme: 0,
    };

    // 2. Detalle paginado de entregas (CERO exposición de contenido didáctico sensible)
    const items = await client`
      SELECT 
        p.id,
        t.name as docente_nombre,
        t.cct as docente_cct,
        t.school_name as escuela,
        p.uac_name,
        p.semester,
        p.component,
        p.status,
        (p.content_json->'dbepaAudit'->>'semaforo') as dbepa_semaforo,
        (p.content_json->'anexo12Audit'->>'ok')::boolean as anexo12_ok,
        p.created_at,
        p.updated_at
      FROM plannings p
      JOIN teachers t ON p.teacher_id = t.id
      LEFT JOIN horario_config h ON h.teacher_id = t.id
      WHERE (
        (${targetCct}::text IS NULL AND ${targetSchoolName}::text IS NULL) OR
        (${targetCct}::text IS NOT NULL AND t.cct = ${targetCct}) OR
        (${targetSchoolName}::text IS NOT NULL AND t.school_name = ${targetSchoolName})
      )
      AND (
        ${targetZona}::text IS NULL OR 
        COALESCE(h.zona_escolar, t.custom_preferences->>'zonaEscolar', t.custom_preferences->>'zona') = ${targetZona}
      )
      ORDER BY p.updated_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return NextResponse.json({
      success: true,
      stats,
      pagination: {
        page,
        limit,
        total: stats.total_planeaciones,
        totalPages: Math.ceil(stats.total_planeaciones / limit),
      },
      items,
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[admin/estatus-entrega] Error en consulta:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
