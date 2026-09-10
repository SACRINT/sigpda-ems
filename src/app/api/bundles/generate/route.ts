import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById } from '@/lib/db';
import { generateBundle, generateFullBundle } from '@/lib/bundle-generator';
import type { GeneratedPlanningContent } from '@/types/planning';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const body = await request.json();
    const { planningId, type } = body;

    if (!planningId) {
      return NextResponse.json({ error: 'planningId requerido' }, { status: 400 });
    }

    const planning = await getPlanningById(planningId, teacher.id);
    if (!planning) return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });

    if (!planning.contentJson) {
      return NextResponse.json({ error: 'La planeación no tiene contenido generado' }, { status: 400 });
    }

    const content = planning.contentJson as GeneratedPlanningContent;

    let responseData: any = {};
    if (type === 'full') {
      const bundle = await generateFullBundle(content);
      responseData = { bundle };
    } else {
      const result = await generateBundle(content, type as 'guia' | 'instrumento' | 'diapositivas' | 'quiz');
      responseData = { result, type };
    }

    // Send In-App Notification (Phase 8A.1)
    try {
      const { sendNotification } = await import('@/lib/notifications');
      await sendNotification({
        userId: teacher.id,
        type: 'bundle_generated',
        title: 'Bundle Didáctico Generado',
        message: `Se ha generado el paquete de materiales (${type === 'full' ? 'Suite Completa' : type}) para ${planning.uacName}.`,
        link: `/planeacion/${planningId}`,
        severity: 'success',
        channels: ['in_app'],
        metadata: { planningId, bundleType: type, uacName: planning.uacName },
      });
    } catch (notifErr) {
      console.warn('Could not dispatch bundle_generated notification:', notifErr);
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Bundle generation error:', error);
    return NextResponse.json({ error: 'Error al generar bundle' }, { status: 500 });
  }

}
