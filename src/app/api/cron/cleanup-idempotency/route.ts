import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredKeys } from '@/lib/idempotency';
import { pruneExpiredUsageQuotaDataDb } from '@/lib/db/usage-quotas';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [deleted, quotaPruned] = await Promise.all([
      cleanupExpiredKeys(),
      pruneExpiredUsageQuotaDataDb().catch((err) => {
        logger.warn('Non-blocking error pruning usage quota tables:', {
          error: err instanceof Error ? err.message : String(err),
        });
        return { deletedIdempotencyKeys: 0, deletedRenderLocks: 0, deletedTelemetryRows: 0 };
      }),
    ]);

    return NextResponse.json({
      success: true,
      deletedExpiredKeys: deleted,
      quotaRetention: quotaPruned,
    });
  } catch (error) {
    logger.error('Error executing cleanup-idempotency cron:', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
