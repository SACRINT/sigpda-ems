import { sql } from '@/lib/db/client';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = sql();
    await db`UPDATE teachers SET last_seen_at = NOW() WHERE email = ${session.user.email}`;

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (e: any) {
    logger.error('Heartbeat error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
