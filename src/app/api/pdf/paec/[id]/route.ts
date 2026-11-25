import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectById, mapRawPaecProject } from '@/lib/db';
import { generatePaecPDF } from '@/lib/paec-pdf-generator';
import { auditPaecPlan } from '@/lib/qa/paec-pmc-semantic-qa';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;
    const rawProject = await getPaecProjectById(id, teacher.id);
    if (!rawProject) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const project = mapRawPaecProject(rawProject);
    if (!project) {
      return NextResponse.json({ error: 'Error al procesar el proyecto' }, { status: 500 });
    }

    // Gate de exportación Q3: HTTP 422 solo en FAIL duro; WARN se registra y permite descarga con aviso
    const mapeoCatalog = (project.fase2Mapeo ?? []).map((m) => ({
      uacName: m.uacName,
      semester: Number(m.semester),
      component: '',
    }));
    const hardFails: string[] = [];
    const warns: string[] = [];
    const rowsA = project.fase3PlanOperativoA ?? project.fase2PlanOperativo?.semestreA ?? [];
    const rowsB = project.fase3PlanOperativoB ?? project.fase2PlanOperativo?.semestreB ?? [];
    if (rowsA.length > 0) {
      const qaA = auditPaecPlan(rowsA, mapeoCatalog, { parity: 1, cicloEscolar: SCHOOL_YEAR, strict: false });
      hardFails.push(...qaA.fails.map((f) => `[Sem A] ${f}`));
      warns.push(...qaA.warns.map((w) => `[Sem A] ${w}`));
    }
    if (rowsB.length > 0) {
      const qaB = auditPaecPlan(rowsB, mapeoCatalog, { parity: 0, cicloEscolar: SCHOOL_YEAR, strict: false });
      hardFails.push(...qaB.fails.map((f) => `[Sem B] ${f}`));
      warns.push(...qaB.warns.map((w) => `[Sem B] ${w}`));
    }
    if (hardFails.length > 0) {
      logger.warn(`[PAEC PDF Export] Bloqueado por FAIL duro en QA semántico (${id}):`, { fails: hardFails });
      return NextResponse.json(
        {
          error: 'El proyecto PAEC presenta defectos críticos en el Plan Operativo que bloquean la exportación.',
          code: 'PAEC_SEMANTIC_QA_FAILED',
          fails: hardFails,
          warns,
        },
        { status: 422 }
      );
    }
    if (warns.length > 0) {
      logger.warn(`[PAEC PDF Export] Descarga permitida con ${warns.length} advertencia(s) (${id}).`);
    }

    const pdfBuffer = await generatePaecPDF(project, teacher.name);

    const safeProjName = project.projectName
      .substring(0, 30)
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚ\s]/g, '')
      .replace(/\s+/g, '_');
    const filename = `Proyecto_PEC_${safeProjName}_${SCHOOL_YEAR}.pdf`;

    const uint8 = new Uint8Array(pdfBuffer);
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(uint8.byteLength),
        'X-Quality-Warnings-Count': String(warns.length),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('PAEC PDF generation error:', { error: message });
    return NextResponse.json(
      { error: `Error al generar el documento PDF del PAEC: ${message}` },
      { status: 500 }
    );
  }
}
