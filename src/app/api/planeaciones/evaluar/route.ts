import { auth } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { evaluarPlaneacion, TipoEvaluacion } from '@/lib/planeaciones-evaluator';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { planningId, tipoEvaluacion, textoPlanificacion, textoPaecPec } = body;

    const db = neon(process.env.DATABASE_URL!);

    let planData: any = null;
    let docenteNombre = session.user.name || 'Docente';
    let asignatura = 'UAC / Asignatura';
    let semestre = 1;
    let textoEvaluado = textoPlanificacion || '';

    // Si se pasa planningId, cargar datos desde la base de datos
    if (planningId) {
      const rows = await db`
        SELECT p.id, p.uac_name, p.semester, p.component, p.content_json, p.paec_context, t.name as teacher_name
        FROM plannings p
        JOIN teachers t ON t.id = p.teacher_id
        WHERE p.id = ${planningId}::uuid
        LIMIT 1
      `;

      if (rows.length > 0) {
        planData = rows[0];
        asignatura = planData.uac_name;
        semestre = planData.semester;
        docenteNombre = planData.teacher_name || docenteNombre;

        if (!textoEvaluado && planData.content_json) {
          const { getSafeEvaluationContext } = await import('@/lib/planning-integrity-system');
          const safeContext = getSafeEvaluationContext(planData);
          textoEvaluado = safeContext.formattedText;

          // Si el contenido fue enriquecido con taxonomía explícita de saberes, persistirlo en la BD
          if (safeContext.enrichedContent?.sectionIV?.activities?.[0]?.saberes && (!planData.content_json?.sectionIV?.activities?.[0]?.saberes)) {
            try {
              await db`
                UPDATE plannings
                SET content_json = ${JSON.stringify(safeContext.enrichedContent)}::jsonb,
                    updated_at = NOW()
                WHERE id = ${planningId}::uuid
              `;
            } catch (updateErr) {
              console.warn('Could not auto-persist enriched saberes:', updateErr);
            }
          }
        }
      }
    }

    if (!textoEvaluado || textoEvaluado.length < 50) {
      return NextResponse.json(
        { error: 'El contenido de la planeación es demasiado corto o inválido para evaluar.' },
        { status: 400 }
      );
    }

    // Determinar tipo de evaluación automáticamente si no viene especificado
    let tipo: TipoEvaluacion = tipoEvaluacion;
    if (!tipo) {
      if (planData?.component === 'laboral') {
        tipo = 'LABORAL';
      } else if (semestre >= 5) {
        tipo = 'FUNDAMENTAL_5_6';
      } else {
        tipo = 'FUNDAMENTAL_1_4';
      }
    }

    const resultado = await evaluarPlaneacion({
      tipoEvaluacion: tipo,
      asignatura,
      semestre,
      docenteNombre,
      textoPlanificacion: textoEvaluado,
      textoPaecPec: textoPaecPec || planData?.paec_context || '',
    });

    return NextResponse.json({ success: true, resultado });
  } catch (e: any) {
    console.error('API /api/planeaciones/evaluar error:', e);
    return NextResponse.json({ error: e.message || 'Error al evaluar planeación' }, { status: 500 });
  }
}
