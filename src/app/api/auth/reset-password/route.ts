import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyAndResetPassword } from '@/lib/db';

import { logger } from '@/lib/logger';
export async function POST(req: NextRequest) {
  try {
    const { token, newPassword, confirmPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token y nueva contraseña requeridos.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Las contraseñas no coinciden.' },
        { status: 400 }
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const teacher = await verifyAndResetPassword(token, newPasswordHash);

    if (!teacher) {
      return NextResponse.json(
        { error: 'El enlace de recuperación es inválido o ha expirado. Por favor solicita uno nuevo.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.',
    });
  } catch (error: any) {
    logger.error('Error en /api/auth/reset-password:', error);
    return NextResponse.json(
      { error: 'Error al restablecer la contraseña.' },
      { status: 500 }
    );
  }
}
