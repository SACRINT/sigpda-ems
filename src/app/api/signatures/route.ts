import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById } from '@/lib/db';
import { signDocument, getVerificationUrl } from '@/lib/digital-signature';
import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const body = await request.json();
    const { planningId, signerRole } = body;

    if (!planningId) {
      return NextResponse.json({ error: 'planningId requerido' }, { status: 400 });
    }

    const planning = await getPlanningById(planningId, teacher.id);
    if (!planning) return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });

    if (!planning.contentJson) {
      return NextResponse.json({ error: 'La planeación no tiene contenido' }, { status: 400 });
    }

    // Create content string for hashing
    const contentStr = JSON.stringify(planning.contentJson);

    // Sign the document
    const signature = await signDocument(
      contentStr,
      teacher.name || session.user.email,
      signerRole || 'Docente',
      (planning.contentJson as any)?.sectionI?.cct || 'Sin CCT',
      'Planeación Didáctica',
      planningId
    );

    // Store signature in DB
    await sql()`
      INSERT INTO document_signatures (hash, signer_name, signer_role, cct, document_type, document_id)
      VALUES (${signature.hash}, ${signature.signerName}, ${signature.signerRole}, ${signature.cct}, ${signature.documentType}, ${signature.documentId})
      ON CONFLICT (hash) DO NOTHING
    `;

    const verificationUrl = getVerificationUrl(signature.hash);

    // Send In-App Notification (Phase 8A.1)
    try {
      const { sendNotification } = await import('@/lib/notifications');
      await sendNotification({
        userId: teacher.id,
        type: 'document_signed',
        title: 'Documento Firmado Digitalmente',
        message: `Se ha firmado electrónicamente la planeación de ${planning.uacName}. Código de verificación generado.`,
        link: verificationUrl,
        severity: 'success',
        channels: ['in_app'],
        metadata: { planningId, hash: signature.hash, uacName: planning.uacName },
      });
    } catch (notifErr) {
      logger.warn('Could not dispatch document_signed notification:', notifErr);
    }

    return NextResponse.json({
      signature,
      verificationUrl,
      qrData: verificationUrl,
    });

  } catch (error) {
    logger.error('Signing error:', error);
    return NextResponse.json({ error: 'Error al firmar documento' }, { status: 500 });
  }
}
