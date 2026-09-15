import { auth } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    await sql`UPDATE teachers SET last_seen_at = NOW() WHERE email = ${session.user.email}`;

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (e: any) {
    logger.error('Heartbeat error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
