// src/__tests__/api-materiales-bloque.test.ts
/**
 * Test de Integración E2E para la Ruta de Materiales de Bloque (Fase 28)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Valida la API /api/planeaciones/[id]/materiales-bloque (GET y POST):
 * 1. Control de acceso por rol y propiedad de la planeación (401, 403, 404).
 * 2. Validación de parámetros (blockIndex numérico válido).
 * 3. Ejecución de la cascada determinística de persistencia (cascadeBlockMaterials).
 * 4. Retorno íntegro de materiales de aula incluyendo solucionarioDocente (teacher_guide).
 * 5. Soporte tanto para docentes titulares como para supervisores y administradores.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

// ── 1. Mocks de Autenticación y Base de Datos ─────────────────────────────────

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

const mockIsAdmin = vi.fn();
vi.mock('@/lib/admin-unified', () => ({
  isAdmin: (email: string) => mockIsAdmin(email),
}));

let mockPlanRows: Array<{ id: string; teacher_id: string; uac_name: string }> = [];
const mockSql = vi.fn(() => Promise.resolve(mockPlanRows));

const mockGetTeacherByEmail = vi.fn();
const mockGetBlockWorkbook = vi.fn();

vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
  getTeacherByEmail: (email: string) => mockGetTeacherByEmail(email),
  getBlockWorkbook: (id: string, idx: number) => mockGetBlockWorkbook(id, idx),
}));

const mockCascadeBlockMaterials = vi.fn();
vi.mock('@/lib/guide-engine/cascade-block-materials', () => ({
  cascadeBlockMaterials: (...args: unknown[]) => mockCascadeBlockMaterials(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Importar los handlers bajo prueba
import { GET, POST } from '@/app/api/planeaciones/[id]/materiales-bloque/route';

// ── Fixture Builder ──────────────────────────────────────────────────────────

function buildMockWorkbook(): ActiveWorkTextbook {
  return {
    uacName: 'PENSAMIENTO MATEMÁTICO II',
    blockName: 'Bloque I: Modelación y Optimización Lineal',
    blockNumber: 1,
    coverData: {
      schoolName: 'BACHILLERATO GENERAL ESTATAL EMILIANO ZAPATA',
      subjectName: 'PENSAMIENTO MATEMÁTICO II',
      semester: 2,
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Optimización de Mezclas en San Jerónimo',
        coveredSessions: [1, 2],
        sessionTopic: 'Sistemas 2x2',
        sessionFocus: 'Balance analítico de proporciones',
        phenomenonHook: {
          story: 'El maestro artesano necesita combinar barros negro y rojo para lograr una resistencia térmica óptima.',
          detonatingQuestion: '¿Cómo modelar las proporciones exactas minimizando el costo?',
        },
        conceptZero: {
          physicalAnalogy: 'Una balanza con dos pesas en equilibrio exacto.',
          coreExplanation: 'El sistema lineal determina la intersección única de las ecuaciones.',
          narrativeExplanation: 'El balance matricial garantiza estabilidad estructural en el horneado.',
          solvedExample: {
            problemStatement: 'Hallar x (arcilla roja) y y (arcilla negra) para x + y = 100 y 4x + 6y = 480.',
            solutionSteps: [
              'Paso 1: Despejar x = 100 - y',
              'Paso 2: Sustituir 4(100 - y) + 6y = 480 -> y = 40 kg',
              'Paso 3: Calcular x = 60 kg',
            ],
            interpretation: 'Se requieren 60 kg de arcilla roja y 40 kg de arcilla negra.',
          },
          contrastTable: [
            {
              correctConcept: 'El punto de corte satisface simultáneamente ambas condiciones.',
              commonMisconception: 'Cualquier combinación que sume 100 kg es admisible.',
              reasoning: 'Debe verificarse también la restricción presupuestal.',
            },
          ],
        },
        iDoSection: {
          stepByStepDemo: 'Demostración analítica en pizarrón de la eliminación por sustitución.',
        },
        weDoSection: {
          guidedPractice: 'En parejas, calculen la dosificación para un lote de 300 piezas.',
        },
        youDoSection: {
          autonomousChallenge: 'Reto: Calcule la mezcla óptima con un incremento del 15% en el costo del barro negro.',
        },
      },
    ],
  } as unknown as ActiveWorkTextbook;
}

describe('Fase 28 — Integración E2E: /api/planeaciones/[id]/materiales-bloque', () => {
  const planningId = 'd3b07384-d113-4944-9345-d8f993d07738';
  const teacherId = 'teacher-owner-001';
  const teacherEmail = 'docente@bachillerato.pue.gob.mx';

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockResolvedValue(false);
    mockAuth.mockResolvedValue({ user: { email: teacherEmail } });
    mockGetTeacherByEmail.mockResolvedValue({ id: teacherId, email: teacherEmail, role: 'docente' });
    mockPlanRows = [{ id: planningId, teacher_id: teacherId, uac_name: 'PENSAMIENTO MATEMÁTICO II' }];
    mockGetBlockWorkbook.mockResolvedValue(buildMockWorkbook());
    mockCascadeBlockMaterials.mockResolvedValue({
      success: true,
      blockIndex: 0,
      planesCount: 2,
      extrasInserted: 5,
      executionTimeMs: 14,
    });
  });

  it('retorna 401 Unauthorized si la sesión de usuario no existe', async () => {
    mockAuth.mockResolvedValue(null);

    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/materiales-bloque?blockIndex=0`);
    const res = await GET(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('No autorizado');
  });

  it('retorna 400 Bad Request si blockIndex es negativo o no numérico', async () => {
    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/materiales-bloque?blockIndex=-1`);
    const res = await GET(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('blockIndex inválido');
  });

  it('retorna 404 Not Found si la planeación no existe en la base de datos', async () => {
    mockPlanRows = [];

    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/materiales-bloque?blockIndex=0`);
    const res = await GET(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Planeación no encontrada');
  });

  it('retorna 403 Forbidden si el docente no es dueño ni supervisor ni administrador', async () => {
    mockPlanRows = [{ id: planningId, teacher_id: 'other-teacher-999', uac_name: 'PENSAMIENTO MATEMÁTICO II' }];
    mockGetTeacherByEmail.mockResolvedValue({ id: teacherId, email: teacherEmail, role: 'docente' });
    mockIsAdmin.mockResolvedValue(false);

    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/materiales-bloque?blockIndex=0`);
    const res = await GET(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Acceso denegado a esta planeación');
  });

  it('retorna 404 si el Libro de Bloque aún no ha sido generado', async () => {
    mockGetBlockWorkbook.mockResolvedValue(null);

    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/materiales-bloque?blockIndex=0`);
    const res = await GET(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('aún no ha sido generado');
  });

  it('GET 200 OK: ejecuta cascada y retorna materiales derivados incluyendo solucionarioDocente', async () => {
    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/materiales-bloque?blockIndex=0`);
    const res = await GET(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.blockIndex).toBe(0);
    expect(data.planningTitle).toBe('PENSAMIENTO MATEMÁTICO II');

    // Cascada invocada con parámetros correctos
    expect(mockCascadeBlockMaterials).toHaveBeenCalledWith(
      planningId,
      0,
      expect.any(Object),
      teacherId
    );

    // Materiales extraídos
    expect(data.materials).toBeDefined();
    expect(data.materials.planesDeClase).toBeInstanceOf(Array);
    expect(data.materials.guiaDelBloque).toBeDefined();
    expect(data.materials.solucionarioDocente).toBeDefined();

    // Verificación pedagógica del solucionario docente retornado por la API
    expect(data.materials.solucionarioDocente).toContain('SOLUCIONARIO Y GUÍA DE MEDIACIÓN PEDAGÓGICA (USO EXCLUSIVO DOCENTE)');
    expect(data.materials.solucionarioDocente).toContain('Paso 1: Despejar x = 100 - y');
    expect(data.materials.solucionarioDocente).toContain('Tabla de Contraste y Corrección de Errores Comunes');
  });

  it('permite el acceso con rol supervisor o admin aunque no sea el creador original', async () => {
    mockPlanRows = [{ id: planningId, teacher_id: 'other-teacher-999', uac_name: 'PENSAMIENTO MATEMÁTICO II' }];
    mockGetTeacherByEmail.mockResolvedValue({ id: 'sup-001', email: 'supervisor@pue.gob.mx', role: 'supervisor' });

    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/materiales-bloque?blockIndex=0`);
    const res = await GET(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('POST 200 OK: soporta regeneración idempotente idéntica a GET', async () => {
    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/materiales-bloque?blockIndex=0`, {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.materials.solucionarioDocente).toBeDefined();
    expect(mockCascadeBlockMaterials).toHaveBeenCalledTimes(1);
  });
});
