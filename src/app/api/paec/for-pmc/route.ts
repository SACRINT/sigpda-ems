import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { sql } from '@/lib/db/client';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

interface PaecProjectDbRow {
  id: string;
  project_name: string;
  problem_statement?: string;
  cycle_type?: string;
  community_context?: Record<string, unknown>;
  school_context?: Record<string, unknown>;
  fase1_diagnostico?: Record<string, unknown>;
  created_at?: string;
}

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
    const cct = searchParams.get('cct')?.trim();

    const db = sql();
    let rows: PaecProjectDbRow[] = [];

    try {
      if (cct) {
        rows = (await db`
          SELECT id, project_name, problem_statement, cycle_type,
                 community_context, school_context, fase1_diagnostico, created_at
          FROM paec_projects
          WHERE teacher_id = ${teacher.id}::uuid OR school_context->>'cct' ILIKE ${cct}
          ORDER BY created_at DESC
          LIMIT 10
        `) as unknown as PaecProjectDbRow[];
      } else {
        rows = (await db`
          SELECT id, project_name, problem_statement, cycle_type,
                 community_context, school_context, fase1_diagnostico, created_at
          FROM paec_projects
          WHERE teacher_id = ${teacher.id}::uuid
          ORDER BY created_at DESC
          LIMIT 10
        `) as unknown as PaecProjectDbRow[];
      }
    } catch (queryErr: unknown) {
      logger.error('[api/paec/for-pmc] Error querying paec_projects:', queryErr);
      return NextResponse.json({ success: true, projects: [] });
    }

    const projects = rows.map((r: PaecProjectDbRow) => ({
      id: r.id,
      projectName: r.project_name,
      problemStatement: r.problem_statement,
      cycleType: r.cycle_type,
      communityContext: r.community_context || {},
      schoolContext: r.school_context || {},
      fase1Diagnostico: r.fase1_diagnostico || null,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ success: true, projects });
  } catch (err: unknown) {
    logger.error('[api/paec/for-pmc] Unhandled error:', err);
    const errMsg = err instanceof Error ? err.message : 'Error al obtener proyectos PAEC para PMC';
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
