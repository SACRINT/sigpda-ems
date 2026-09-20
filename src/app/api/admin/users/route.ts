import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';
import { logger } from '@/lib/logger';

function getDb() { return sql(); }

// GET /api/admin/users — list all teachers with stats
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sql = getDb();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';

    // is_blocked / is_premium may not exist in older DBs — safe migration guards
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE`
      .catch((err) => { logger.warn('[AdminUsers] Migration guard is_blocked warning', { error: err }); });
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE`
      .catch((err) => { logger.warn('[AdminUsers] Migration guard is_premium warning', { error: err }); });
    // Note: last_seen_at & custom_preferences are in schema.sql DDL since 2026-08-05

    const teachers = search
      ? await sql`
          SELECT
            t.id, t.name, t.email, t.school_name, t.municipality, t.subsystem,
            COALESCE(t.is_blocked, false) AS is_blocked,
            COALESCE(t.role, 'docente') AS role,
            COALESCE(t.is_premium, false) AS is_premium,
            t.created_at,
            t.last_seen_at,
            (SELECT COUNT(*)::int FROM plannings p WHERE p.teacher_id = t.id) AS planning_count,
            (SELECT COUNT(*)::int FROM paec_projects pa WHERE pa.teacher_id = t.id) AS paec_count,
            (SELECT COUNT(*)::int FROM pmc_projects pm WHERE pm.teacher_id = t.id) AS pmc_count,
            (SELECT COUNT(*)::int FROM user_documents ud WHERE ud.teacher_email = t.email) AS doc_count,
            (SELECT MAX(created_at) FROM activity_log al WHERE al.teacher_email = t.email) AS last_active
          FROM teachers t
          WHERE t.name ILIKE ${'%' + search + '%'} OR t.email ILIKE ${'%' + search + '%'}
          ORDER BY t.created_at DESC
        `
      : await sql`
          SELECT
            t.id, t.name, t.email, t.school_name, t.municipality, t.subsystem,
            COALESCE(t.is_blocked, false) AS is_blocked,
            COALESCE(t.role, 'docente') AS role,
            COALESCE(t.is_premium, false) AS is_premium,
            t.created_at,
            t.last_seen_at,
            (SELECT COUNT(*)::int FROM plannings p WHERE p.teacher_id = t.id) AS planning_count,
            (SELECT COUNT(*)::int FROM paec_projects pa WHERE pa.teacher_id = t.id) AS paec_count,
            (SELECT COUNT(*)::int FROM pmc_projects pm WHERE pm.teacher_id = t.id) AS pmc_count,
            (SELECT COUNT(*)::int FROM user_documents ud WHERE ud.teacher_email = t.email) AS doc_count,
            (SELECT MAX(created_at) FROM activity_log al WHERE al.teacher_email = t.email) AS last_active
          FROM teachers t
          ORDER BY t.created_at DESC
        `;

    return NextResponse.json({ teachers });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    logger.error('GET /api/admin/users error:', { error: e });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/admin/users — block/unblock or change role of a user
export async function PUT(req: NextRequest) {
  try {
    const adminEmail = await requireAdmin();
    const { teacherId, isBlocked, role, isPremium } = await req.json();
    const sql = getDb();

    // Prevent admin from blocking their own account
    if (isBlocked === true && teacherId) {
      const selfRows = await sql`SELECT id FROM teachers WHERE email = ${adminEmail} AND id = ${teacherId}::uuid LIMIT 1`;
      if (selfRows.length > 0) {
        return NextResponse.json(
          { error: 'No puedes bloquear tu propia cuenta de administrador.' },
          { status: 400 }
        );
      }
    }

    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE`
      .catch((err) => { logger.warn('[AdminUsers] Migration guard is_blocked warning', { error: err }); });
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'docente'`
      .catch((err) => { logger.warn('[AdminUsers] Migration guard role warning', { error: err }); });
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE`
      .catch((err) => { logger.warn('[AdminUsers] Migration guard is_premium warning', { error: err }); });

    if (isBlocked !== undefined) {
      await sql`UPDATE teachers SET is_blocked = ${isBlocked} WHERE id = ${teacherId}`;
    }
    if (role !== undefined) {
      await sql`UPDATE teachers SET role = ${role} WHERE id = ${teacherId}`;
    }
    if (isPremium !== undefined) {
      await sql`UPDATE teachers SET is_premium = ${isPremium} WHERE id = ${teacherId}`;
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
