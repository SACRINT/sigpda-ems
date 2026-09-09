import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { parsePdfBuffer } from '@/lib/pdf-parser';

export const runtime = 'nodejs';
export const maxDuration = 60; // Claude PDF extraction can take up to 40-50s for large files

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    // Get file from form data
    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó un archivo' }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const isSupported =
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.txt');

    if (!isSupported) {
      return NextResponse.json(
        { error: 'El archivo debe ser un PDF, Word (.docx) o texto (.txt)' },
        { status: 400 }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo no puede superar 25 MB' }, { status: 400 });
    }

    // Convert to buffer and parse using DocumentIngestionEngine + Gemini Flash Lite
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parseResult = await parsePdfBuffer(buffer, file.name);

    return NextResponse.json({
      success: parseResult.success,
      confidence: parseResult.confidence,
      data: parseResult.data,
      errors: parseResult.errors,
    });
  } catch (error) {
    console.error('PDF parse error:', error);
    return NextResponse.json(
      { error: 'Error al procesar el PDF. Por favor intenta de nuevo.' },
      { status: 500 }
    );
  }
}
