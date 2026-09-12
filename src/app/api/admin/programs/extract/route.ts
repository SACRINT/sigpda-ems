import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';
import { parsePdfBuffer } from '@/lib/pdf-parser';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max for PDF parsing + Gemini call

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const subsystem = (formData.get('subsystem') as string) || 'bge';
    const semester = formData.get('semester') ? parseInt(formData.get('semester') as string, 10) : undefined;
    const component = (formData.get('component') as string) || 'fundamental';

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo PDF' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'El archivo debe ser un documento PDF' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Call parser with multi-UAC book support
    const parseResult = await parsePdfBuffer(buffer, file.name, semester);

    if (!parseResult.success && parseResult.errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: parseResult.errors.join('; '),
        rawTextLength: parseResult.rawText?.length || 0,
      }, { status: 422 });
    }

    const data = parseResult.data as any;
    const totalHours = data?.totalHours || 54;
    const effectiveSemester = semester || data?.semester || (totalHours > 70 ? 3 : 1);

    // Return the extracted data formatted for programs_catalog
    return NextResponse.json({
      success: true,
      extracted: {
        uac_name: data?.uacName || 'Nueva UAC',
        semester: effectiveSemester,
        component: component,
        subsystem: subsystem,
        total_hours: totalHours,
        learning_outcome: data?.learningOutcome || '',
        activities: data?.activities || [],
        evidences: data?.evidences || [],
        contenidos_formativos: data?.contenidosFormativos || [],
        model_type: effectiveSemester >= 5 ? 'progresiones' : 'propositos_contenidos',
        curriculum_name: data?.curriculumName || null,
        year: 2026,
      },
      rawTextSummary: parseResult.rawText ? parseResult.rawText.substring(0, 300) + '...' : '',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (error.message === 'FORBIDDEN') return adminForbidden();
    console.error('POST /api/admin/programs/extract error:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el PDF' }, { status: 500 });
  }
}
