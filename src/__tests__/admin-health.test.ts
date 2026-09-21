import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('@/lib/db/client', () => ({
  sql: () => mockSql,
}));

const mockRequireAdmin = vi.fn();
const mockAdminUnauthorized = vi.fn(() => ({
  status: 401,
  json: async () => ({ error: 'No autorizado' }),
}));
const mockAdminForbidden = vi.fn(() => ({
  status: 403,
  json: async () => ({ error: 'Acceso denegado. Solo administradores.' }),
}));

vi.mock('@/lib/admin-unified', () => ({
  requireAdmin: () => mockRequireAdmin(),
  adminUnauthorized: () => mockAdminUnauthorized(),
  adminForbidden: () => mockAdminForbidden(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from '@/app/api/admin/health/route';

describe('GET /api/admin/health', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('retorna 401 cuando el usuario no está autenticado', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('UNAUTHORIZED'));

    const response = await GET();
    expect(response.status).toBe(401);
    expect(mockAdminUnauthorized).toHaveBeenCalled();
  });

  it('retorna 403 cuando el usuario autenticado no es administrador', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('FORBIDDEN'));

    const response = await GET();
    expect(response.status).toBe(403);
    expect(mockAdminForbidden).toHaveBeenCalled();
  });

  it('retorna 200 con status healthy cuando la base de datos responde rápidamente y hay llaves de IA', async () => {
    mockRequireAdmin.mockResolvedValueOnce('admin@sigpda.edu.mx');
    mockSql.mockResolvedValueOnce([{ ping: 1 }]);
    process.env.GEMINI_API_KEY = 'AIzaSyFakeValidGeminiKey1234567890';
    process.env.GROQ_API_KEY = 'gsk_fakeValidGroqKey1234567890';

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.db).toBe(true);
    expect(typeof data.latencyMs).toBe('number');
    expect(data.latencyMs).toBeGreaterThanOrEqual(0);
    expect(data.aiProviders.gemini).toBe(true);
    expect(data.aiProviders.groq).toBe(true);
    expect(data.environment).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  it('retorna 503 con status unhealthy cuando la base de datos falla', async () => {
    mockRequireAdmin.mockResolvedValueOnce('admin@sigpda.edu.mx');
    mockSql.mockRejectedValueOnce(new Error('Neon Connection Timeout'));

    const response = await GET();
    expect(response.status).toBe(503);

    const data = await response.json();
    expect(data.status).toBe('unhealthy');
    expect(data.db).toBe(false);
    expect(data.dbError).toContain('Neon Connection Timeout');
  });

  it('retorna status degraded si no hay llaves de IA configuradas', async () => {
    mockRequireAdmin.mockResolvedValueOnce('admin@sigpda.edu.mx');
    mockSql.mockResolvedValueOnce([{ ping: 1 }]);
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.FLUX_API_KEY;

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('degraded');
    expect(data.db).toBe(true);
    expect(data.aiProviders.gemini).toBe(false);
    expect(data.aiProviders.groq).toBe(false);
  });
});
