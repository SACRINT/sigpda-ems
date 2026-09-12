/**
 * Admin middleware helper — verifies that the current session user is an admin.
 * Returns the user email if authorized, throws otherwise.
 */

import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-unified';
import { NextResponse } from 'next/server';

export async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error('UNAUTHORIZED');
  }

  const email = session.user.email;
  const authorized = await isAdmin(email);

  if (!authorized) {
    throw new Error('FORBIDDEN');
  }

  return email;
}

export function adminUnauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}

export function adminForbidden() {
  return NextResponse.json({ error: 'Acceso denegado. Solo administradores.' }, { status: 403 });
}
