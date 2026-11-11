import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('@/lib/db/client', () => ({
  sql: () => mockQuery,
}));

describe('platform-name — fuente única en platform_config', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockQuery.mockReset();
    const { invalidatePlatformNameCache } = await import('@/lib/platform/platform-name');
    invalidatePlatformNameCache();
  });

  it('devuelve el valor de la BD y lo publica para generadores síncronos', async () => {
    mockQuery.mockResolvedValueOnce([{ value: '  Plataforma Demo  ' }]);

    const { getPlatformName } = await import('@/lib/platform/platform-name');
    const { getRuntimePlatformName } = await import('@/lib/platform/platform-name-shared');

    await expect(getPlatformName()).resolves.toBe('Plataforma Demo');
    expect(getRuntimePlatformName()).toBe('Plataforma Demo');
  });

  it('usa el fallback canónico cuando la fila no existe', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const { getPlatformName } = await import('@/lib/platform/platform-name');

    await expect(getPlatformName()).resolves.toBe('SIGPDA-EMS');
  });

  it('conserva el fallback si la base de datos falla', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const { getPlatformName } = await import('@/lib/platform/platform-name');

    await expect(getPlatformName()).resolves.toBe('SIGPDA-EMS');
  });

  it('invalidatePlatformNameCache fuerza una nueva lectura', async () => {
    mockQuery
      .mockResolvedValueOnce([{ value: 'Nombre A' }])
      .mockResolvedValueOnce([{ value: 'Nombre B' }]);

    const { getPlatformName, invalidatePlatformNameCache } = await import(
      '@/lib/platform/platform-name'
    );

    await expect(getPlatformName()).resolves.toBe('Nombre A');
    invalidatePlatformNameCache();
    await expect(getPlatformName()).resolves.toBe('Nombre B');
  });
});
