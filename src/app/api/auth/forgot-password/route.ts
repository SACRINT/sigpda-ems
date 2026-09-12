import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getTeacherByEmail, setTeacherResetToken } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Ingresa tu correo electrónico.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const teacher = await getTeacherByEmail(cleanEmail);

    if (!teacher) {
      // Por seguridad, no revelar si el correo existe o no
      return NextResponse.json({
        success: true,
        message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
      });
    }

    // Generar token seguro de 32 bytes (64 caracteres hex)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600 * 1000); // 1 hora de validez

    await setTeacherResetToken(cleanEmail, token, expires);

    return NextResponse.json({
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    });
  } catch (error: any) {
    console.error('Error en /api/auth/forgot-password:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud de recuperación.' },
      { status: 500 }
    );
  }
}
