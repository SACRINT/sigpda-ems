import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getTeacherByEmail, updatePlanningContent } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import { logger } from '@/lib/logger';
import { DUA_CATEGORIAS, generateDUAWithAI } from '@/lib/planning/dua-generator';
import type { DUACategoria, GeneratedPlanningContent } from '@/types/planning';

export const runtime = 'nodejs';
export const maxDuration = 120;

function parseContent(raw: unknown): GeneratedPlanningContent | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as GeneratedPlanningContent;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as GeneratedPlanningContent;
  return null;
}

function parseCategorias(raw: unknown): DUACategoria[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid = new Set<DUACategoria>(DUA_CATEGORIAS);
  const result = raw.filter((item): item is DUACategoria => valid.has(item as DUACategoria));
  return result.length > 0 ? result : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const planningId = typeof body.planningId === 'string' ? body.planningId : '';
    if (!planningId) {
      return NextResponse.json({ error: 'planningId requerido' }, { status: 400 });
    }

    const planning = await getPlanningById(planningId, teacher.id);
    if (!planning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const content = parseContent(planning.content_json);
    if (!content) {
      return NextResponse.json(
        { error: 'La planeación aún no tiene contenido generado.' },
        { status: 400 }
      );
    }

    const subscription = await getSubscriptionStatus(teacher.id, session.user.email);
    if (!subscription.isAdmin && !subscription.hasActiveSubscription) {
      return NextResponse.json(
        { error: 'La generación de adecuaciones DUA con IA requiere una suscripción activa.' },
        { status: 403 }
      );
    }

    const categorias = parseCategorias(body.categorias);
    const { ajustesDUA, warning } = await generateDUAWithAI({
      content,
      teacherId: teacher.id,
      isPremium: subscription.isAdmin || subscription.hasActiveSubscription,
      categorias,
    });

    const updatedContent: GeneratedPlanningContent = { ...content, ajustesDUA };
    await updatePlanningContent(planningId, teacher.id, updatedContent);

    return NextResponse.json({
      success: true,
      ajustesDUA,
      contentJson: updatedContent,
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    logger.error('[API planeaciones/dua] Error generando adecuaciones DUA:', { error });
    const message = error instanceof Error ? error.message : 'Error al generar adecuaciones DUA';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
