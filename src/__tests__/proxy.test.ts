import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── 1. Mocks de dependencias externas y base de datos ──────────────────────────

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

let mockDbRows: Record<string, unknown>[] = [];
const mockDb = vi.fn(() => {
  return Promise.resolve(mockDbRows);
});
vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockDb,
}));

vi.mock('next-intl/middleware', () => ({
  default: () => vi.fn(() => new Response('intl-pass', {
    status: 200,
    headers: { 'x-middleware-pass': 'true' },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Importar proxy dinámicamente o después de declarar los mocks
import { proxy } from '@/proxy';

describe('Proxy Auth & Security Gate (Next.js 16)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.DATABASE_URL = 'postgresql://fake:fake@ep-fake.neon.tech/neondb';
    mockDbRows = [];
  });

  it('1. Usuario no autenticado en ruta protegida → redirección a /[locale]/login', async () => {
    mockAuth.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/es/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:3000/es/login');
  });

  it('2. Admin por variable de entorno (ADMIN_EMAILS) → acceso total sin restricciones', async () => {
    process.env.ADMIN_EMAILS = 'superadmin@sigpda.mx, director@sep.gob.mx';
    mockAuth.mockResolvedValue({ user: { email: 'superadmin@sigpda.mx' } });

    const request = new NextRequest('http://localhost:3000/es/dashboard');
    const response = await proxy(request);

    // Debe pasar a intlMiddleware sin consultar la base de datos
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-pass')).toBe('true');
    expect(mockDb).not.toHaveBeenCalled();
  });

  it('3. Admin por rol en base de datos (role = "administrador") → acceso total sin restricciones', async () => {
    mockAuth.mockResolvedValue({ user: { email: 'admin_db@puebla.gob.mx' } });
    mockDbRows = [{
      id: 'teacher-admin-1',
      profile_completed: false, // Incluso sin perfil completo pasa por ser admin
      role: 'administrador',
      sub_status: null,
    }];

    const request = new NextRequest('http://localhost:3000/es/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-pass')).toBe('true');
  });

  it('4. Docente con perfil incompleto → redirección a /[locale]/configurar-perfil', async () => {
    mockAuth.mockResolvedValue({ user: { email: 'docente_nuevo@bge.edu.mx' } });
    mockDbRows = [{
      id: 'teacher-2',
      profile_completed: false,
      role: 'docente',
      sub_status: 'active',
    }];

    const request = new NextRequest('http://localhost:3000/es/planeacion');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:3000/es/configurar-perfil');
  });

  it('5. Docente sin suscripción activa → redirección a /[locale]/suscripcion', async () => {
    mockAuth.mockResolvedValue({ user: { email: 'docente_sin_pago@bge.edu.mx' } });
    mockDbRows = [{
      id: 'teacher-3',
      profile_completed: true,
      role: 'docente',
      sub_status: null, // Sin suscripción active/trialing
    }];

    const request = new NextRequest('http://localhost:3000/es/planeacion');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:3000/es/suscripcion');
  });

  it('6. Docente regular con perfil completo y suscripción activa → acceso concedido', async () => {
    mockAuth.mockResolvedValue({ user: { email: 'docente_activo@bge.edu.mx' } });
    mockDbRows = [{
      id: 'teacher-4',
      profile_completed: true,
      role: 'docente',
      sub_status: 'active',
    }];

    const request = new NextRequest('http://localhost:3000/es/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-pass')).toBe('true');
  });

  it('7. Usuario no autenticado en /admin → redirección a /[locale]/login', async () => {
    mockAuth.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/es/admin/users');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:3000/es/login');
  });

  it('8. Docente no-admin intenta acceder a /admin → redirección a /[locale]/dashboard', async () => {
    mockAuth.mockResolvedValue({ user: { email: 'docente_normal@bge.edu.mx' } });
    mockDbRows = [{
      id: 'teacher-5',
      profile_completed: true,
      role: 'docente',
      sub_status: 'active',
    }];

    const request = new NextRequest('http://localhost:3000/es/admin/analytics');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:3000/es/dashboard');
  });

  it('9. Admin autenticado en /admin → acceso permitido', async () => {
    process.env.ADMIN_EMAILS = 'superadmin@sigpda.mx';
    mockAuth.mockResolvedValue({ user: { email: 'superadmin@sigpda.mx' } });

    const request = new NextRequest('http://localhost:3000/es/admin/dashboard');
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-pass')).toBe('true');
  });

  it('10. Usuario no autenticado en /biblioteca-personal → redirección a /[locale]/login', async () => {
    mockAuth.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/es/biblioteca-personal');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:3000/es/login');
  });
});
