import { NextRequest, NextResponse } from 'next/server';
import { publishPlanningToGoogleClassroom, checkClassroomConfig } from '@/lib/classroom';

import { logger } from '@/lib/logger';
export async function GET() {
  const config = checkClassroomConfig();
  return NextResponse.json({
    configured: config.configured,
    missingKeys: config.missingKeys || [],
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planningId } = body;

    if (!planningId) {
      return NextResponse.json(
        { error: 'Se requiere el ID de la planeación didáctica (planningId).' },
        { status: 400 }
      );
    }

    const result = await publishPlanningToGoogleClassroom(planningId);

    if (!result.configured) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          message: result.message,
        },
        { status: 200 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          message: result.message,
          error: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    logger.error('[API classroom/publish POST error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Error interno al procesar la publicación a Google Classroom',
      },
      { status: 500 }
    );
  }
}
