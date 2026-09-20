/**
 * admin-unified.test.ts
 * Unit tests for Sistema Unificado de Autorización Administrativa (SIGPDA-EMS)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.fn();
vi.mock('@/lib/db/client', () => ({
  sql: () => mockDb,
}));
vi.mock('@/lib/db', () => ({
  sql: () => mockDb,
}));

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  isEnvAdmin,
  isAdmin,
  getUserRole,
  requireAdmin,
  adminUnauthorized,
  adminForbidden,
} from '@/lib/admin-unified';

describe('admin-unified.ts — Unified Admin Authorization', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe('isEnvAdmin', () => {
    it('returns false when no email or env vars provided', () => {
      delete process.env.ADMIN_EMAILS;
      delete process.env.ADMIN_EMAIL;
      expect(isEnvAdmin('')).toBe(false);
      expect(isEnvAdmin(null)).toBe(false);
      expect(isEnvAdmin(undefined)).toBe(false);
      expect(isEnvAdmin('user@example.com')).toBe(false);
    });

    it('identifies admin from ADMIN_EMAIL (case insensitive, trimmed)', () => {
      process.env.ADMIN_EMAIL = 'admin@sigpda.edu.mx';
      expect(isEnvAdmin('admin@sigpda.edu.mx')).toBe(true);
      expect(isEnvAdmin('  ADMIN@SIGPDA.EDU.MX  ')).toBe(true);
      expect(isEnvAdmin('other@sigpda.edu.mx')).toBe(false);
    });

    it('identifies admin from comma-separated ADMIN_EMAILS', () => {
      process.env.ADMIN_EMAILS = 'lead@sep.gob.mx, auditor@sigpda.mx, staff@puebla.gob.mx';
      expect(isEnvAdmin('lead@sep.gob.mx')).toBe(true);
      expect(isEnvAdmin('AUDITOR@SIGPDA.MX')).toBe(true);
      expect(isEnvAdmin('staff@puebla.gob.mx')).toBe(true);
      expect(isEnvAdmin('stranger@sigpda.mx')).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('returns true immediately for env admin without DB query', async () => {
      process.env.ADMIN_EMAIL = 'super@sigpda.mx';
      const result = await isAdmin('super@sigpda.mx');
      expect(result).toBe(true);
      expect(mockDb).not.toHaveBeenCalled();
    });

    it('returns true immediately if knownRole is administrador or admin', async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_EMAILS;
      const result1 = await isAdmin('docente@puebla.mx', 'administrador');
      const result2 = await isAdmin('docente@puebla.mx', 'admin');
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockDb).not.toHaveBeenCalled();
    });

    it('queries admins table and returns true if found', async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_EMAILS;
      mockDb.mockResolvedValueOnce([{ email: 'admin_in_table@puebla.mx' }]);

      const result = await isAdmin('admin_in_table@puebla.mx');
      expect(result).toBe(true);
      expect(mockDb).toHaveBeenCalledTimes(1);
    });

    it('queries teachers table if not in admins table and returns true if role is administrador', async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_EMAILS;
      // First query (admins) returns empty
      mockDb.mockResolvedValueOnce([]);
      // Second query (teachers) returns administrador role
      mockDb.mockResolvedValueOnce([{ role: 'administrador' }]);

      const result = await isAdmin('teacher_admin@puebla.mx');
      expect(result).toBe(true);
      expect(mockDb).toHaveBeenCalledTimes(2);
    });

    it('returns false for regular teacher with role docente', async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_EMAILS;
      mockDb.mockResolvedValueOnce([]); // admins
      mockDb.mockResolvedValueOnce([{ role: 'docente' }]); // teachers

      const result = await isAdmin('regular_teacher@puebla.mx');
      expect(result).toBe(false);
    });
  });

  describe('getUserRole', () => {
    it('returns administrador role when isAdmin is true', async () => {
      process.env.ADMIN_EMAIL = 'admin@sigpda.mx';
      const roleInfo = await getUserRole('admin@sigpda.mx');
      expect(roleInfo).toEqual({ isAdmin: true, role: 'administrador' });
    });

    it('returns specific teacher role when not admin', async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_EMAILS;
      mockDb.mockResolvedValueOnce([]); // admins table check in isAdmin
      mockDb.mockResolvedValueOnce([{ role: 'director' }]); // teachers table in isAdmin
      // wait, in getUserRole:
      // If teachers in isAdmin returns director, isAdmin is false.
      // Then getUserRole queries teachers table for role:
      mockDb.mockResolvedValueOnce([{ role: 'director' }]);

      const roleInfo = await getUserRole('director@plantel.mx');
      expect(roleInfo).toEqual({ isAdmin: false, role: 'director' });
    });
  });

  describe('requireAdmin', () => {
    it('throws UNAUTHORIZED when session has no email', async () => {
      mockAuth.mockResolvedValueOnce(null);
      await expect(requireAdmin()).rejects.toThrow('UNAUTHORIZED');
    });

    it('throws FORBIDDEN when user is not admin', async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_EMAILS;
      mockAuth.mockResolvedValueOnce({ user: { email: 'docente@puebla.mx' } });
      mockDb.mockResolvedValueOnce([]); // admins
      mockDb.mockResolvedValueOnce([{ role: 'docente' }]); // teachers

      await expect(requireAdmin()).rejects.toThrow('FORBIDDEN');
    });

    it('returns email when user is authorized admin', async () => {
      process.env.ADMIN_EMAIL = 'admin@puebla.mx';
      mockAuth.mockResolvedValueOnce({ user: { email: 'admin@puebla.mx' } });

      const email = await requireAdmin();
      expect(email).toBe('admin@puebla.mx');
    });
  });

  describe('admin response helpers', () => {
    it('adminUnauthorized returns 401 response', () => {
      const resp = adminUnauthorized();
      expect(resp.status).toBe(401);
    });

    it('adminForbidden returns 403 response', () => {
      const resp = adminForbidden();
      expect(resp.status).toBe(403);
    });
  });
});
