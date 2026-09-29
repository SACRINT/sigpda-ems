import { NextRequest, NextResponse } from 'next/server';
import { pruneExpiredIngestCache } from '@/lib/document-ingestion';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const deleted = await pruneExpiredIngestCache();
    return NextResponse.json({ success: true, deletedExpiredEntries: deleted });
  } catch (error) {
    logger.error('Error executing prune-ingest-cache cron:', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
