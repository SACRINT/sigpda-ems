import { auth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { NextResponse } from 'next/server';
import { resolverHorario, SolverParams } from '@/lib/horarios/solver';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = sql();
    const teacherRows = await db`SELECT role FROM teachers WHERE email = ${session.user.email} LIMIT 1`;
    const role = teacherRows[0]?.role || 'docente';
    const isUserAdmin = await isAdmin(session.user.email);

    // Verificar rol de director o admin
    if (!['administrador', 'director', 'supervisor', 'atp'].includes(role) && !isUserAdmin) {
      return NextResponse.json({ error: 'Acceso exclusivo para directores y supervisores.' }, { status: 403 });
    }

    const params: SolverParams = await req.json();

    if (!params.grupos || !params.docentes || !params.cargas) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (grupos, docentes, cargas)' }, { status: 400 });
    }

    const resultado = resolverHorario(params);

    if (!resultado.exito) {
      const errorDetalle = resultado.conflictos && resultado.conflictos.length > 0
        ? resultado.conflictos.join(". ")
        : "No fue posible generar un horario válido con las restricciones y bloqueos actuales.";
      
      return NextResponse.json({
        success: false,
        error: errorDetalle,
        conflictos: resultado.conflictos || []
      }, { status: 422 });
    }

    return NextResponse.json({ success: true, resultado });
  } catch (e: any) {
    console.error('API /api/horarios/generate error:', e);
    return NextResponse.json({ error: e.message || 'Error al ejecutar solver de horarios' }, { status: 500 });
  }
}
