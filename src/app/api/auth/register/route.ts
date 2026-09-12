import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getTeacherByEmail, createTeacherWithPassword } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, confirmPassword, schoolName, cct, municipality, subsystem } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'El nombre, correo y contraseña son obligatorios.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Las contraseñas no coinciden.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Verificar si ya existe usuario
    const existing = await getTeacherByEmail(cleanEmail);
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta registrada con este correo electrónico.' },
        { status: 409 }
      );
    }

    // Hashear contraseña con 10 rondas de salt
    const passwordHash = await bcrypt.hash(password, 10);

    const newTeacher = await createTeacherWithPassword({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      schoolName: schoolName?.trim(),
      cct: cct?.toUpperCase().trim(),
      municipality: municipality?.trim(),
      subsystem: subsystem?.toLowerCase().trim() || 'bge',
      role: 'docente',
    });

    return NextResponse.json({
      success: true,
      message: 'Cuenta creada exitosamente. Ya puedes iniciar sesión.',
      user: {
        id: newTeacher.id,
        name: newTeacher.name,
        email: newTeacher.email,
        role: newTeacher.role,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error en /api/auth/register:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor al registrar usuario.' },
      { status: 500 }
    );
  }
}
