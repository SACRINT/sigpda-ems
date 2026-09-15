import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredKeys } from '@/lib/idempotency';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const deleted = await cleanupExpiredKeys();
    return NextResponse.json({ success: true, deletedExpiredKeys: deleted });
  } catch (error) {
    logger.error('Error executing cleanup-idempotency cron:', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
