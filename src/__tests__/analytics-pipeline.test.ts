/**
 * analytics-pipeline.test.ts
 * Tests unitarios para el Pipeline de Analítica y Agregaciones (Fase 5 - GAP-001, GAP-002, GAP-004)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 */

import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

const mockSqlExecute = vi.fn();
const mockSql = Object.assign(
  vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => mockSqlExecute(strings, ...values)),
  {
    transaction: vi.fn(async (cb: (sql: unknown) => unknown) => cb(mockSql)),
  }
);

vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
  getTeacherByEmail: vi.fn(),
  getPlanningById: vi.fn(),
}));

vi.mock('@/lib/zone-sync-service', () => ({
  getZoneSupervisorDashboard: vi.fn(async () => ({
    zona: {
      id: 'z-004',
      nombre: 'Zona Escolar 004 — Puebla',
      supervisorName: 'Supervisor Test',
    },
    resumen: {
      totalPlanteles: 1,
      totalDocentes: 3,
      totalPlaneaciones: 5,
      pmcCompletados: 1,
      paecCompletados: 1,
      promedioCalidad: 86.4,
    },
    planteles: [
      {
        id: 'school-1',
        cct: '21EBH0001A',
        nombre: 'Plantel Puebla Oriente',
        municipio: 'Puebla',
        subsistema: 'BGE',
        directorNombre: 'Director 1',
        directorEmail: 'dir1@escuela.mx',
        docentes: 3,
        planeaciones: 5,
        pmc: { status: 'completed' },
        paec: { status: 'completed' },
        alertas: [],
      },
    ],
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  ensurePlanningQualityColumns,
  ingestPlanningQuality,
} from '@/lib/analytics/pipeline';
import {
  getZoneAnalytics,
  getZoneTrendData,
} from '@/lib/analytics/aggregations';
import { emitDomainEvent, getRecentDomainEvents } from '@/lib/analytics/events';

describe('Fase 5 — Analytics Pipeline & Event Bus', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
  });

  beforeEach(() => {
    mockSqlExecute.mockReset();
    mockSqlExecute.mockResolvedValue([]);
    vi.clearAllMocks();
  });

  describe('1. ensurePlanningQualityColumns & DDL Idempotente (GAP-004)', () => {
    it('ejecuta DDL de creación de tabla domain_events e índices B-Tree sin errores', async () => {
      mockSqlExecute.mockResolvedValue([]);
      await expect(ensurePlanningQualityColumns()).resolves.not.toThrow();
      expect(mockSqlExecute).toHaveBeenCalled();
    });
  });

  describe('2. Event Bus y domain_events (GAP-004)', () => {
    it('persiste un evento de dominio transaccionalmente en la base de datos', async () => {
      mockSqlExecute.mockImplementation((strings: TemplateStringsArray) => {
        const q = Array.isArray(strings) ? strings.join('') : String(strings);
        if (q.includes('INSERT INTO domain_events')) {
          return Promise.resolve([
            {
              id: 'ev-123',
              event_type: 'planeacion_evaluated',
              aggregate_id: 'plan-abc-001',
              aggregate_type: 'planning',
              payload: { score: 92, status: 'excelente' },
              created_at: new Date().toISOString(),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await emitDomainEvent({
        eventType: 'planeacion_evaluated',
        aggregateType: 'planning',
        aggregateId: 'plan-abc-001',
        payload: { score: 92, status: 'excelente' },
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('ev-123');
      expect(result?.eventType).toBe('planeacion_evaluated');
    });

    it('recupera eventos de dominio históricos filtrados por aggregateType y aggregateId', async () => {
      mockSqlExecute.mockImplementation((strings: TemplateStringsArray) => {
        const q = Array.isArray(strings) ? strings.join('') : String(strings);
        if (q.includes('SELECT id, event_type')) {
          return Promise.resolve([
            {
              id: 'ev-1',
              event_type: 'planeacion_evaluated',
              aggregate_id: 'plan-abc',
              aggregate_type: 'planning',
              payload: { score: 88 },
              created_at: new Date().toISOString(),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const events = await getRecentDomainEvents({
        aggregateType: 'planning',
        aggregateId: 'plan-abc',
        limit: 10,
      });

      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('planeacion_evaluated');
      expect(events[0].payload).toEqual({ score: 88 });
    });
  });

  describe('3. Ingesta y Calificación Determinista en Pipeline (GAP-002)', () => {
    it('evalúa una planeación con MCCEMS y actualiza quality_score en la base de datos', async () => {
      const mockPlanningRow = {
        id: 'plan-test-1',
        teacher_id: 'teacher-uuid-1',
        uac_name: 'Pensamiento Matemático II',
        semester: 2,
        component: 'fundamental',
        curriculum_name: 'MCCEMS 2026',
        metodologia_activa: 'abproblemas',
        content_json: {
          contexto: 'Tepeaca, Puebla',
          retoSituado: {
            titulo: 'Reto Pluvial',
            verboInfinitivo: 'Diseñar',
            contextoLocal: 'en Tepeaca, Puebla',
            problematicaReal: 'para mitigar el desabasto y contaminación del agua potable',
            propositoCurricular: 'aplicando los modelos matemáticos de cálculo de volúmenes de Pensamiento Matemático II',
            retoCompleto: 'Diseñar un sistema de captación pluvial en Tepeaca, Puebla para mitigar el desabasto de agua aplicando Pensamiento Matemático II.',
          },
          activities: [
            {
              name: 'Actividad 1',
              hours: 18,
              methodology: 'abproblemas',
              apertura: { activities: 'Encuadre saber', processes: 'Análisis', materials: 'Guía' },
              desarrollo: { activities: 'Taller saber hacer', processes: 'Cálculo', materials: 'Software' },
              cierre: { activities: 'Socialización saber ser', processes: 'Evaluación', materials: 'Rúbrica' },
            },
          ],
        },
        sequence_json: {},
      };

      mockSqlExecute.mockImplementation((strings: TemplateStringsArray) => {
        const q = Array.isArray(strings) ? strings.join('') : String(strings);
        if (q.includes('SELECT * FROM plannings WHERE id =')) {
          return Promise.resolve([mockPlanningRow]);
        }
        return Promise.resolve([]);
      });

      const result = await ingestPlanningQuality('plan-test-1');

      expect(result).not.toBeNull();
      expect(result?.score).toBeGreaterThanOrEqual(0);
      expect(result?.score).toBeLessThanOrEqual(100);
      expect(result?.status).toBeDefined();
    });

    it('retorna null si la planeación no existe en la base de datos', async () => {
      mockSqlExecute.mockResolvedValue([]);
      const result = await ingestPlanningQuality('plan-inexistente');
      expect(result).toBeNull();
    });
  });

  describe('4. Agregaciones Multinivel Zonales y Plantel (GAP-002)', () => {
    it('calcula métricas agregadas zonales a partir de registros consolidados', async () => {
      mockSqlExecute.mockImplementation((strings: TemplateStringsArray) => {
        const q = Array.isArray(strings) ? strings.join('') : String(strings);
        if (q.includes('FROM plannings p')) {
          return Promise.resolve([
            {
              id: 'plan-1',
              teacher_id: 't-1',
              quality_score: 86,
              quality_status: 'excelente',
              quality_checks: {
                retoSituado: { score: 4 },
                tresSaberes: { coverageScore: 3 },
                horasPorCorte: { isValid: true },
              },
              cct: '21EBH0001A',
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const zoneMetrics = await getZoneAnalytics('sup-001');

      expect(zoneMetrics.zoneId).toBe('sup-001');
      expect(zoneMetrics.totalSchools).toBe(1);
      expect(zoneMetrics.totalPlannings).toBe(1);
      expect(zoneMetrics.avgQualityScore).toBe(86);
      expect(zoneMetrics.schools.length).toBe(1);
      expect(zoneMetrics.schools[0].cct).toBe('21EBH0001A');
    });

    it('genera tendencias cronológicas para visualización en Recharts', async () => {
      const trends = await getZoneTrendData('sup-001', 30);

      expect(Array.isArray(trends)).toBe(true);
      expect(trends.length).toBeGreaterThan(0);
      const sample = trends[0];
      expect(sample).toHaveProperty('date');
      expect(sample).toHaveProperty('qualityScore');
      expect(sample).toHaveProperty('coberturaPct');
    });
  });
});
