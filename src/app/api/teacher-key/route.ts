import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, updateTeacherKey } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET /api/teacher-key — check current config status (returns masked value if present)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const hasKey = !!teacher.custom_api_key;
    const provider = teacher.custom_api_provider || null;

    return NextResponse.json({
      hasKey,
      provider,
      preview: hasKey ? `...${teacher.custom_api_key.slice(-4)}` : null,
    });
  } catch (err: any) {
    logger.error('Error fetching teacher key state:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

// PUT /api/teacher-key — save or delete custom API key
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { customApiKey, customApiProvider } = await req.json();

    // If customApiKey is empty or null, we delete the key
    const finalKey = customApiKey && customApiKey.trim() !== '' ? customApiKey.trim() : null;
    const finalProvider = finalKey ? (customApiProvider || 'gemini') : null;

    await updateTeacherKey(teacher.id, finalKey, finalProvider);

    return NextResponse.json({
      success: true,
      hasKey: !!finalKey,
      provider: finalProvider,
    });
  } catch (err: any) {
    logger.error('Error saving teacher key:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
