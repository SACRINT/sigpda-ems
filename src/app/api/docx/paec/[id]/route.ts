import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectById, mapRawPaecProject } from '@/lib/db';
import { generatePaecDocx } from '@/lib/paec-docx-generator';
import { auditPaecPlan } from '@/lib/qa/paec-pmc-semantic-qa';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

    const { id } = await params;
    const rawProject = await getPaecProjectById(id, teacher.id);
    if (!rawProject) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    // Cast raw database project row to PaecProject
    const project = mapRawPaecProject(rawProject);
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    if (!project.fase2Anexos) {
      return NextResponse.json(
        { error: 'El proyecto no está completo. Genera todos los pasos antes de descargar.' },
        { status: 400 }
      );
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
      logger.warn(`[PAEC DOCX Export] Bloqueado por FAIL duro en QA semántico (${id}):`, { fails: hardFails });
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
      logger.warn(`[PAEC DOCX Export] Descarga permitida con ${warns.length} advertencia(s) (${id}).`);
    }

    const docxBuffer = await generatePaecDocx(project, teacher.name);

    const safeProjName = project.projectName
      .substring(0, 30)
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚ\s]/g, '')
      .replace(/\s+/g, '_');
    const filename = `Proyecto_PEC_${safeProjName}_${SCHOOL_YEAR}.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.byteLength.toString(),
        'X-Quality-Warnings-Count': String(warns.length),
      },
    });
  } catch (error) {
    logger.error('PAEC DOCX download error:', { error });
    return NextResponse.json({ error: 'Error al generar el archivo Word' }, { status: 500 });
  }
}
