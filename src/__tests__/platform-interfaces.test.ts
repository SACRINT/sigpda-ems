/**
 * platform-interfaces.test.ts
 *
 * Valida los contratos formales transversales de Nivel 2 (IProgramSystem, IProgramRepository).
 */

import { describe, it, expect } from 'vitest';
import type { IProgramSystem, IProgramRepository, HealthCheckResult, ProgramId } from '@/lib/platform/interfaces';

describe('Platform Interfaces — Arquitectura de Dos Niveles', () => {
  it('debe permitir implementar IProgramSystem con los 5 programIds oficiales', async () => {
    const validPrograms: ProgramId[] = ['planeaciones', 'paec', 'pmc', 'cartografia', 'horarios'];

    for (const pid of validPrograms) {
      const mockSystem: IProgramSystem = {
        programId: pid,
        version: '1.0.0',
        async healthCheck(): Promise<HealthCheckResult> {
          return {
            status: 'healthy',
            checks: { db: true, memory: true },
            latencyMs: 15,
            timestamp: new Date().toISOString(),
          };
        },
        async getMetrics(tenantId: string): Promise<Record<string, unknown>> {
          return { tenantId, activeUsers: 42 };
        },
      };

      expect(mockSystem.programId).toBe(pid);
      const health = await mockSystem.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.checks.db).toBe(true);

      const metrics = await mockSystem.getMetrics('escuela-test-123');
      expect(metrics.tenantId).toBe('escuela-test-123');
    }
  });

  it('debe permitir implementar IProgramRepository genérico con operaciones CRUD canónicas', async () => {
    interface TestEntity {
      id: string;
      title: string;
    }

    const memoryStore = new Map<string, TestEntity>();

    const mockRepo: IProgramRepository<TestEntity, string> = {
      async findById(id: string) {
        return memoryStore.get(id) || null;
      },
      async findAll() {
        return Array.from(memoryStore.values());
      },
      async create(entity: TestEntity) {
        memoryStore.set(entity.id, entity);
        return entity;
      },
      async update(id: string, patch: Partial<TestEntity>) {
        const existing = memoryStore.get(id);
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...patch };
        memoryStore.set(id, updated);
        return updated;
      },
      async delete(id: string) {
        memoryStore.delete(id);
      },
    };

    const item = await mockRepo.create({ id: '1', title: 'Planeación Demo' });
    expect(item.id).toBe('1');

    const found = await mockRepo.findById('1');
    expect(found?.title).toBe('Planeación Demo');

    const updated = await mockRepo.update('1', { title: 'Planeación Actualizada' });
    expect(updated.title).toBe('Planeación Actualizada');

    const all = await mockRepo.findAll();
    expect(all).toHaveLength(1);

    await mockRepo.delete('1');
    expect(await mockRepo.findById('1')).toBeNull();
  });
});
