/**
 * db-extended-coverage.test.ts
 * Cobertura de pruebas unitarias para módulos de base de datos (Fase 22):
 * - src/lib/db/schedules.ts
 * - src/lib/db/notifications.ts
 * - src/lib/db/workbooks.ts (canonical seeds, progress, DDL)
 * - src/lib/db/planning-extras.ts
 */

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

const mockQueryFn = vi.fn().mockResolvedValue([]);

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockQueryFn),
}));

import {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type ScheduleItem,
} from '@/lib/db/schedules';

import {
  getNotifications,
  getUnreadNotificationsCount,
  createNotification,
  getAutomationRules,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  type NotificationItem,
} from '@/lib/db/notifications';

import {
  initWorkTextbookTables,
  findCanonicalSeed,
  saveCanonicalSeed,
  incrementSeedUsage,
  updateWorkbookProgress,
  getWorkbookProgress,
} from '@/lib/db/workbooks';

import {
  getPlanningExtras,
  getPlanningExtraById,
  createPlanningExtra,
  deletePlanningExtra,
} from '@/lib/db/planning-extras';
import type { CanonicalSeed, GenerationProgressState } from '@/types/work-textbook';

describe('db-extended-coverage (Fase 22) — Schedules, Notifications, Workbooks & Extras', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
  });

  beforeEach(() => {
    mockQueryFn.mockReset();
    mockQueryFn.mockResolvedValue([]);
  });

  // ── 1. Schedules Tests ───────────────────────────────────────────────────────
  describe('schedules.ts', () => {
    it('getSchedules — recupera lista de horarios filtrando por docente y estado', async () => {
      const mockSchedule = {
        id: 'sch-001',
        teacher_id: 'teach-001',
        title: 'Horario BGE 2026-A',
        status: 'published',
        config: {},
        grupos: [],
        docentes: [],
        aulas: [],
        cargas: [],
        celdas: [],
      };
      mockQueryFn.mockResolvedValueOnce([mockSchedule]);

      const result = await getSchedules('teach-001', 'published');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Horario BGE 2026-A');
    });

    it('getScheduleById — retorna el horario cuando existe o null si no existe', async () => {
      mockQueryFn.mockResolvedValueOnce([{ id: 'sch-002', title: 'Horario Vespertino' }]);
      const found = await getScheduleById('sch-002', 'teach-001');
      expect(found).not.toBeNull();
      expect(found?.title).toBe('Horario Vespertino');

      mockQueryFn.mockResolvedValueOnce([]);
      const notFound = await getScheduleById('sch-999', 'teach-001');
      expect(notFound).toBeNull();
    });

    it('createSchedule — inserta y retorna el horario creado', async () => {
      const newItem: ScheduleItem = {
        teacher_id: 'teach-001',
        title: 'Nuevo Horario',
        config: { turn: 'matutino' },
        grupos: [{ id: '1A' }],
        docentes: [{ id: 'd1' }],
        aulas: [{ id: 'a1' }],
        cargas: [],
        celdas: [],
      };
      mockQueryFn.mockResolvedValueOnce([{ id: 'sch-created', ...newItem }]);

      const created = await createSchedule(newItem);
      expect(created).toBeDefined();
      expect(created.id).toBe('sch-created');
      expect(created.title).toBe('Nuevo Horario');
    });

    it('updateSchedule — actualiza campos y retorna el horario modificado', async () => {
      mockQueryFn.mockResolvedValueOnce([{ id: 'sch-001', title: 'Título Actualizado', status: 'draft' }]);
      const updated = await updateSchedule('sch-001', 'teach-001', {
        title: 'Título Actualizado',
        status: 'draft',
      });
      expect(updated).not.toBeNull();
      expect(updated?.title).toBe('Título Actualizado');
    });

    it('deleteSchedule — elimina el horario por ID y teacherId', async () => {
      mockQueryFn.mockResolvedValueOnce([{ id: 'sch-001' }]);
      const deleted = await deleteSchedule('sch-001', 'teach-001');
      expect(deleted).toEqual({ id: 'sch-001' });
    });
  });

  // ── 2. Notifications Tests ──────────────────────────────────────────────────
  describe('notifications.ts', () => {
    it('getNotifications — recupera notificaciones filtrando por unreadOnly', async () => {
      mockQueryFn.mockResolvedValueOnce([
        { id: 'notif-1', title: 'Planeación lista', read: false },
      ]);
      const notifs = await getNotifications('user-001', true);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].title).toBe('Planeación lista');
    });

    it('getUnreadNotificationsCount — cuenta correctamente las no leídas', async () => {
      mockQueryFn.mockResolvedValueOnce([{ total: 5 }]);
      const count = await getUnreadNotificationsCount('user-001');
      expect(count).toBe(5);

      mockQueryFn.mockResolvedValueOnce([]);
      const zeroCount = await getUnreadNotificationsCount('user-002');
      expect(zeroCount).toBe(0);
    });

    it('createNotification — inserta notificación serializando canales y metadata', async () => {
      const data: NotificationItem = {
        user_id: 'user-001',
        type: 'planeacion_ready',
        title: 'Tu planeación ha sido auditada',
        message: 'Calificación: 98/100',
        severity: 'success',
        channels: ['in_app', 'email'],
        metadata: { score: 98 },
      };
      mockQueryFn.mockResolvedValueOnce([{ id: 'notif-new', ...data }]);

      const created = await createNotification(data);
      expect(created.id).toBe('notif-new');
      expect(created.type).toBe('planeacion_ready');
    });

    it('getAutomationRules — obtiene reglas activas', async () => {
      mockQueryFn.mockResolvedValueOnce([{ id: 'rule-1', event_name: 'on_planning_created', active: true }]);
      const rules = await getAutomationRules(true);
      expect(rules).toHaveLength(1);
      expect(rules[0].event_name).toBe('on_planning_created');
    });

    it('markNotificationAsRead & markAllNotificationsAsRead — actualiza estado de lectura', async () => {
      mockQueryFn.mockResolvedValueOnce([{ id: 'notif-1', read: true }]);
      const marked = await markNotificationAsRead('notif-1', 'user-001');
      expect(marked?.read).toBe(true);

      mockQueryFn.mockResolvedValueOnce([]);
      const allMarked = await markAllNotificationsAsRead('user-001');
      expect(allMarked).toBe(true);
    });

    it('deleteNotification — elimina la notificación correspondiente', async () => {
      mockQueryFn.mockResolvedValueOnce([{ id: 'notif-1' }]);
      const deleted = await deleteNotification('notif-1', 'user-001');
      expect(deleted).toEqual({ id: 'notif-1' });
    });
  });

  // ── 3. Workbooks Extended Tests (Seeds, Progress & DDL) ─────────────────────
  describe('workbooks.ts', () => {
    it('initWorkTextbookTables — ejecuta DDL para tablas e índices sin errores', async () => {
      mockQueryFn.mockResolvedValue([]);
      await expect(initWorkTextbookTables()).resolves.toBeUndefined();
      expect(mockQueryFn).toHaveBeenCalled();
    });

    it('findCanonicalSeed — retorna semilla de alta calidad o null si no se encuentra', async () => {
      const mockSeedRow = {
        id: 'seed-001',
        uac_id: 'uac-mat-2',
        subsystem: 'bge',
        topic: 'sistemas lineales',
        practice_type: 'guided_problem',
        content: { steps: ['paso 1', 'paso 2'] },
        source: 'ai_generated',
        quality_score: 95,
        times_used: 3,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockQueryFn.mockResolvedValueOnce([mockSeedRow]);

      const seed = await findCanonicalSeed('uac-mat-2', 'Sistemas Lineales', 'bge');
      expect(seed).not.toBeNull();
      expect(seed?.qualityScore).toBe(95);
      expect(seed?.uacId).toBe('uac-mat-2');

      mockQueryFn.mockResolvedValueOnce([]);
      const notFound = await findCanonicalSeed('uac-mat-2', 'tema inexistente');
      expect(notFound).toBeNull();
    });

    it('saveCanonicalSeed — quality gate rechaza semillas con score < 80 y guarda >= 80', async () => {
      const lowQualitySeed: CanonicalSeed = {
        uacId: 'uac-mat-2',
        subsystem: 'bge',
        topic: 'álgebra básica',
        practiceType: 'theoretical',
        content: {
          title: 'Álgebra básica',
          procedures: ['Despeje'],
          commonErrors: [],
          materials: ['Cuaderno'],
        },
        qualityScore: 65,
      };
      const rejected = await saveCanonicalSeed(lowQualitySeed);
      expect(rejected).toBeNull();

      const highQualitySeed: CanonicalSeed = {
        uacId: 'uac-mat-2',
        subsystem: 'bge',
        topic: 'álgebra intermedia',
        practiceType: 'theoretical',
        content: {
          title: 'Matrices',
          procedures: ['Determinantes'],
          commonErrors: [],
          materials: ['Calculadora'],
        },
        qualityScore: 90,
      };
      mockQueryFn.mockResolvedValueOnce([{
        id: 'seed-new',
        uac_id: highQualitySeed.uacId,
        subsystem: highQualitySeed.subsystem,
        topic: highQualitySeed.topic,
        practice_type: highQualitySeed.practiceType,
        content: highQualitySeed.content,
        quality_score: highQualitySeed.qualityScore,
        times_used: 0,
      }]);

      const saved = await saveCanonicalSeed(highQualitySeed);
      expect(saved).not.toBeNull();
      expect(saved?.qualityScore).toBe(90);
    });

    it('incrementSeedUsage — incrementa times_used de la semilla', async () => {
      mockQueryFn.mockResolvedValueOnce([]);
      await expect(incrementSeedUsage('seed-001')).resolves.toBeUndefined();
    });

    it('updateWorkbookProgress & getWorkbookProgress — guarda y lee estado de progreso', async () => {
      mockQueryFn.mockResolvedValueOnce([]);
      const progress: GenerationProgressState = {
        planningId: 'plan-001',
        blockIndex: 0,
        phase: 'writing',
        currentStep: 'Generando Misión 3',
        percent: 50,
        currentMission: 2,
        totalMissions: 6,
        updatedAt: new Date().toISOString(),
      };
      await updateWorkbookProgress('plan-001', 0, progress);

      mockQueryFn.mockResolvedValueOnce([{
        workbook_progress: {
          block_0: progress,
        },
      }]);
      const retrieved = await getWorkbookProgress('plan-001', 0);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.phase).toBe('writing');
      expect(retrieved?.percent).toBe(50);
    });
  });

  // ── 4. Planning Extras Tests ─────────────────────────────────────────────────
  describe('planning-extras.ts', () => {
    it('getPlanningExtras — recupera y mapea extras de la planeación', async () => {
      const rawExtra = {
        id: 'extra-001',
        planning_id: 'plan-001',
        type: 'rubric',
        title: 'Rúbrica de Bloque 1',
        key_index: 0,
        content_text: '# Rúbrica...',
        created_at: new Date('2026-03-01'),
      };
      mockQueryFn.mockResolvedValueOnce([rawExtra]);

      const extras = await getPlanningExtras('plan-001', 'teach-001');
      expect(extras).toHaveLength(1);
      expect(extras[0].title).toBe('Rúbrica de Bloque 1');
      expect(extras[0].type).toBe('rubric');
    });

    it('getPlanningExtraById — obtiene extra individual por ID o null', async () => {
      mockQueryFn.mockResolvedValueOnce([{
        id: 'extra-002',
        planning_id: 'plan-001',
        type: 'lesson_plan',
        title: 'Plan de Clase Sesión 1',
        key_index: 0,
        content_text: '# Plan...',
        created_at: new Date(),
      }]);
      const extra = await getPlanningExtraById('extra-002', 'teach-001');
      expect(extra).not.toBeNull();
      expect(extra?.type).toBe('lesson_plan');

      mockQueryFn.mockResolvedValueOnce([]);
      const missing = await getPlanningExtraById('extra-999', 'teach-001');
      expect(missing).toBeNull();
    });

    it('createPlanningExtra & deletePlanningExtra — ciclo de creación y eliminación con verificación de propiedad', async () => {
      // 1. Verificación de propiedad (SELECT id FROM plannings)
      mockQueryFn.mockResolvedValueOnce([{ id: 'plan-001' }]);
      // 2. Inserción (INSERT INTO planning_extras ... RETURNING)
      mockQueryFn.mockResolvedValueOnce([{
        id: 'extra-new',
        planning_id: 'plan-001',
        type: 'teacher_guide',
        title: 'Solucionario Docente',
        key_index: 0,
        content_text: '# Solucionario...',
        created_at: new Date(),
      }]);

      const created = await createPlanningExtra({
        planningId: 'plan-001',
        type: 'teacher_guide',
        title: 'Solucionario Docente',
        keyIndex: 0,
        contentText: '# Solucionario...',
      }, 'teach-001');
      expect(created.id).toBe('extra-new');
      expect(created.type).toBe('teacher_guide');
      expect(created.title).toBe('Solucionario Docente');

      // Eliminación
      mockQueryFn.mockResolvedValueOnce([]);
      await expect(deletePlanningExtra('extra-new', 'teach-001')).resolves.toBeUndefined();

      // Error en caso de planeación no encontrada o no autorizada
      mockQueryFn.mockResolvedValueOnce([]); // no ownership
      await expect(createPlanningExtra({
        planningId: 'plan-unauthorized',
        type: 'rubric',
        title: 'Rúbrica',
        keyIndex: 0,
        contentText: '',
      }, 'teach-001')).rejects.toThrow('Planeación no encontrada o no autorizada');
    });
  });
});
