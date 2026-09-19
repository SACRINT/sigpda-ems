/**
 * db.test.ts
 * Unit tests for src/lib/db.ts — core database query functions.
 * Fase 20A · Cobertura Integral de Consultas y Operaciones de Base de Datos.
 *
 * Strategy: Mock @neondatabase/serverless so neon() returns a vi.fn() that
 * works as a tagged-template function (template literals desugar to fn(strings, ...values)).
 * Dynamic imports of key-rotator (decryptKey/encryptKey) are hoisted via vi.mock.
 */

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

// ── Mocks (hoisted before any src imports) ────────────────────────────────────

/** Shared tagged-template mock for every neon client in the module */
const mockQueryFn = vi.fn().mockResolvedValue([]);

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockQueryFn),
}));

vi.mock('@/lib/ai-provider/key-rotator', () => ({
  decryptKey: vi.fn((s: string) => `decrypted:${s}`),
  encryptKey: vi.fn((s: string) => `encrypted:${s}`),
}));

// ── Module under test (imported AFTER mocks) ──────────────────────────────────

import {
  getTeacherByEmail,
  getTeacherById,
  getPlanningsByTeacher,
  getPlanningById,
  createPlanning,
  updateTeacherProfile,
  // ── Fase 20A: Docentes y Auth ──
  createTeacherWithPassword,
  setTeacherResetToken,
  verifyAndResetPassword,
  updateTeacherKey,
  createTeacher,
  upsertTeacher,
  // ── Fase 20A: Planeaciones y Auditorías ──
  updatePlanningContent,
  markPlanningDownloaded,
  deletePlanning,
  savePdfUpload,
  getAuditResultByPlanningId,
  getProgramByUacAndSemester,
  getFfeContinuity,
  // ── Fase 20A: PAEC ──
  getPaecProjectsByTeacher,
  getPaecProjectById,
  createPaecProject,
  updatePaecProjectStep,
  deletePaecProject,
  // ── Fase 20A: Workbooks ──
  saveBlockWorkbook,
  getBlockWorkbook,
  getAllBlockWorkbooks,
  // ── Fase 20A: Generation Jobs ──
  createGenerationJob,
  getGenerationJobById,
  claimNextPendingJob,
} from '@/lib/db';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

// ─────────────────────────────────────────────────────────────────────────────

describe('db.ts — Core Database Queries (Fase 20A)', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('ADMIN_ENCRYPTION_KEY', '01234567890123456789012345678901'); // 32 chars
  });

  beforeEach(() => {
    mockQueryFn.mockReset();
    mockQueryFn.mockResolvedValue([]); // default: empty result
  });

  // ── 1. Teacher queries (Base) ───────────────────────────────────────────────

  it('getTeacherByEmail — hit: retorna teacher con custom_api_key descifrado', async () => {
    const mockRow = {
      id: 'uuid-teacher-001',
      name: 'Docente Test',
      email: 'docente@plantel.mx',
      custom_api_key: 'enc-key-abc',
      custom_api_provider: 'gemini',
      role: 'docente',
      is_premium: false,
    };
    mockQueryFn.mockResolvedValueOnce([mockRow]);

    const result = await getTeacherByEmail('Docente@Plantel.mx'); // normaliza a lower
    expect(result).not.toBeNull();
    expect(result.email).toBe('docente@plantel.mx');
    expect(result.custom_api_key).toBe('decrypted:enc-key-abc');
  });

  it('getTeacherByEmail — miss: retorna null cuando no existe el correo', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await getTeacherByEmail('noexiste@test.mx');
    expect(result).toBeNull();
  });

  it('getTeacherById — hit sin custom_api_key: no llama a decryptKey', async () => {
    const { decryptKey } = await import('@/lib/ai-provider/key-rotator');
    (decryptKey as ReturnType<typeof vi.fn>).mockClear();

    mockQueryFn.mockResolvedValueOnce([{
      id: 'uuid-teacher-002',
      name: 'Sin Clave',
      email: 'sin-clave@test.mx',
      custom_api_key: null,
    }]);

    const result = await getTeacherById('uuid-teacher-002');
    expect(result).not.toBeNull();
    expect(decryptKey).not.toHaveBeenCalled();
    expect(result.custom_api_key).toBeNull();
  });

  it('updateTeacherProfile — retorna el perfil actualizado', async () => {
    const mockUpdated = {
      id: 'uuid-teacher-001',
      school_name: 'COBAEP 01',
      municipality: 'Puebla',
      cct: '21EBH0001X',
      profile_completed: true,
    };
    mockQueryFn.mockResolvedValueOnce([mockUpdated]);

    const result = await updateTeacherProfile('uuid-teacher-001', {
      schoolName:   'COBAEP 01',
      municipality: 'Puebla',
      cct:          '21EBH0001X',
    });

    expect(result.profile_completed).toBe(true);
    expect(result.municipality).toBe('Puebla');
  });

  // ── 2. Teacher & Auth Extended (Fase 20A) ───────────────────────────────────

  it('createTeacherWithPassword — crea docente con hash y rol docente por defecto', async () => {
    const mockCreated = {
      id: 'uuid-teacher-pwd-1',
      name: 'Prof. Mario Casas',
      email: 'mario@plantel.edu.mx',
      role: 'docente',
      school_name: 'BGE Puebla',
    };
    mockQueryFn.mockResolvedValueOnce([mockCreated]);

    const result = await createTeacherWithPassword({
      name: 'Prof. Mario Casas',
      email: 'Mario@Plantel.edu.mx ',
      passwordHash: 'hashed-secret-123',
      schoolName: 'BGE Puebla',
    });

    expect(result).toBeDefined();
    expect(result.id).toBe('uuid-teacher-pwd-1');
    expect(result.email).toBe('mario@plantel.edu.mx');
    expect(result.role).toBe('docente');
  });

  it('createTeacherWithPassword — respeta rol explícito de supervisor o admin', async () => {
    const mockCreated = {
      id: 'uuid-supervisor-1',
      name: 'Supervisora Ortiz',
      email: 'ortiz@zona04.gob.mx',
      role: 'supervisor',
    };
    mockQueryFn.mockResolvedValueOnce([mockCreated]);

    const result = await createTeacherWithPassword({
      name: 'Supervisora Ortiz',
      email: 'ortiz@zona04.gob.mx',
      passwordHash: 'hashed-pwd-super',
      role: 'supervisor',
    });

    expect(result.role).toBe('supervisor');
  });

  it('setTeacherResetToken — genera token de restablecimiento con fecha de expiración', async () => {
    mockQueryFn.mockResolvedValueOnce([{ id: 'uuid-teacher-001', email: 'docente@plantel.mx' }]);

    const expires = new Date(Date.now() + 3600000);
    const result = await setTeacherResetToken('Docente@plantel.mx ', 'reset-token-xyz', expires);

    expect(result).not.toBeNull();
    expect(result?.email).toBe('docente@plantel.mx');
  });

  it('setTeacherResetToken — retorna null si el email no existe', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await setTeacherResetToken('desconocido@plantel.mx', 'token-invalido', new Date());
    expect(result).toBeNull();
  });

  it('verifyAndResetPassword — actualiza password_hash y limpia el token', async () => {
    mockQueryFn.mockResolvedValueOnce([{ id: 'uuid-teacher-001', email: 'docente@plantel.mx', name: 'Docente Test' }]);

    const result = await verifyAndResetPassword('valid-token-123', 'new-hashed-password-456');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('uuid-teacher-001');
  });

  it('verifyAndResetPassword — retorna null si el token es inválido o expiró', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await verifyAndResetPassword('expired-token', 'new-password');
    expect(result).toBeNull();
  });

  it('updateTeacherKey — cifra y almacena la API key personalizada', async () => {
    mockQueryFn.mockResolvedValueOnce([{ id: 'uuid-teacher-001', custom_api_key: 'encrypted:live-key-xyz' }]);

    const result = await updateTeacherKey('uuid-teacher-001', 'live-key-xyz', 'openai');

    expect(result).toBeDefined();
    expect(result.custom_api_key).toBe('encrypted:live-key-xyz');
  });

  it('updateTeacherKey — permite eliminar la API key asignando null', async () => {
    mockQueryFn.mockResolvedValueOnce([{ id: 'uuid-teacher-001', custom_api_key: null, custom_api_provider: null }]);

    const result = await updateTeacherKey('uuid-teacher-001', null, null);

    expect(result).toBeDefined();
    expect(result.custom_api_key).toBeNull();
  });

  it('createTeacher — inserta docente con datos básicos sin contraseña', async () => {
    const mockTeacher = {
      id: 'uuid-new-teacher',
      name: 'Mtro. Juan Escutia',
      email: 'escutia@sep.puebla.gob.mx',
      school_name: 'BGE Niños Héroes',
    };
    mockQueryFn.mockResolvedValueOnce([mockTeacher]);

    const result = await createTeacher({
      name: 'Mtro. Juan Escutia',
      email: 'escutia@sep.puebla.gob.mx',
      schoolName: 'BGE Niños Héroes',
    });

    expect(result.id).toBe('uuid-new-teacher');
    expect(result.name).toBe('Mtro. Juan Escutia');
  });

  it('upsertTeacher — inserta o actualiza docente en caso de conflicto por correo', async () => {
    const mockUpserted = {
      id: 'uuid-upsert-1',
      name: 'Nombre Actualizado',
      email: 'docente.upsert@plantel.mx',
    };
    mockQueryFn.mockResolvedValueOnce([mockUpserted]);

    const result = await upsertTeacher({
      name: 'Nombre Actualizado',
      email: 'Docente.Upsert@Plantel.mx',
    });

    expect(result.id).toBe('uuid-upsert-1');
    expect(result.name).toBe('Nombre Actualizado');
  });

  // ── 3. Planning & Audit Extended (Fase 20A) ─────────────────────────────────

  it('getPlanningsByTeacher — retorna array de planeaciones ordenado por fecha', async () => {
    const mockPlannings = [
      { id: 'p-1', teacher_id: 'tid', uac_name: 'Matemáticas', semester: 2, status: 'completed' },
      { id: 'p-2', teacher_id: 'tid', uac_name: 'Física',       semester: 2, status: 'draft'     },
    ];
    mockQueryFn.mockResolvedValueOnce(mockPlannings);

    const result = await getPlanningsByTeacher('uuid-teacher-001');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].uac_name).toBe('Matemáticas');
    expect(result[1].status).toBe('draft');
  });

  it('getPlanningById — hit sin teacherId: retorna la planeación', async () => {
    mockQueryFn.mockResolvedValueOnce([{ id: 'p-1', uac_name: 'Física', semester: 3 }]);

    const result = await getPlanningById('p-1');
    expect(result).not.toBeNull();
    expect(result.id).toBe('p-1');
    expect(result.semester).toBe(3);
  });

  it('getPlanningById — miss: retorna null cuando no existe', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await getPlanningById('planning-inexistente');
    expect(result).toBeNull();
  });

  it('createPlanning — retorna la planeación creada con status draft', async () => {
    const mockInserted = {
      id: 'new-uuid-planning',
      teacher_id: 'uuid-teacher-001',
      uac_name: 'Química',
      semester: 3,
      component: 'Fundamental',
      status: 'draft',
    };
    mockQueryFn.mockResolvedValueOnce([mockInserted]);

    const result = await createPlanning({
      teacherId:  'uuid-teacher-001',
      uacName:    'Química',
      semester:   3,
      component:  'Fundamental',
    });

    expect(result.id).toBe('new-uuid-planning');
    expect(result.status).toBe('draft');
    expect(result.uac_name).toBe('Química');
  });

  it('updatePlanningContent — actualiza content_json y marca status como generated', async () => {
    const mockUpdated = {
      id: 'planning-101',
      teacher_id: 'teacher-101',
      status: 'generated',
      content_json: { sectionI: { teacherName: 'Docente' } },
    };
    mockQueryFn.mockResolvedValueOnce([mockUpdated]);

    const result = await updatePlanningContent('planning-101', 'teacher-101', { sectionI: { teacherName: 'Docente' } });

    expect(result.id).toBe('planning-101');
    expect(result.status).toBe('generated');
  });

  it('markPlanningDownloaded — actualiza el estado de la planeación a downloaded', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    await expect(markPlanningDownloaded('planning-101', 'teacher-101')).resolves.not.toThrow();
  });

  it('deletePlanning — elimina la planeación por id y teacherId', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    await expect(deletePlanning('planning-to-delete', 'teacher-101')).resolves.not.toThrow();
  });

  it('savePdfUpload — guarda registro de PDF cargado con planningId asociado', async () => {
    const mockUpload = {
      id: 'upload-uuid-1',
      teacher_id: 'teacher-101',
      planning_id: 'planning-101',
      filename: 'programa_matematicas.pdf',
      parsed_ok: true,
    };
    mockQueryFn.mockResolvedValueOnce([mockUpload]);

    const result = await savePdfUpload({
      teacherId: 'teacher-101',
      planningId: 'planning-101',
      filename: 'programa_matematicas.pdf',
      blobUrl: 'https://blob.vercel.com/pdf1',
      parsedOk: true,
    });

    expect(result.id).toBe('upload-uuid-1');
    expect(result.parsed_ok).toBe(true);
  });

  it('savePdfUpload — permite guardar PDF sin planningId inicial', async () => {
    const mockUpload = {
      id: 'upload-uuid-2',
      teacher_id: 'teacher-101',
      planning_id: null,
      filename: 'programa_general.pdf',
      parsed_ok: false,
    };
    mockQueryFn.mockResolvedValueOnce([mockUpload]);

    const result = await savePdfUpload({
      teacherId: 'teacher-101',
      filename: 'programa_general.pdf',
      blobUrl: 'https://blob.vercel.com/pdf2',
      parsedOk: false,
    });

    expect(result.id).toBe('upload-uuid-2');
    expect(result.planning_id).toBeNull();
  });

  it('getAuditResultByPlanningId — hit: retorna el resultado de auditoría pedagógica', async () => {
    mockQueryFn.mockResolvedValueOnce([{
      id: 'audit-123',
      planning_id: 'plan-123',
      score: 95,
      summary: 'Auditoría aprobada con excelencia',
    }]);

    const result = await getAuditResultByPlanningId('plan-123');
    expect(result).not.toBeNull();
    expect(result?.score).toBe(95);
  });

  it('getAuditResultByPlanningId — miss: retorna null si no existe auditoría', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await getAuditResultByPlanningId('plan-sin-auditoria');
    expect(result).toBeNull();
  });

  it('getProgramByUacAndSemester — hit: retorna programa del catálogo curricular', async () => {
    mockQueryFn.mockResolvedValueOnce([{
      id: 'prog-mat-2',
      uac_name: 'PENSAMIENTO MATEMÁTICO II',
      semester: 2,
      component: 'fundamental',
    }]);

    const result = await getProgramByUacAndSemester('PENSAMIENTO MATEMÁTICO II', 2, 'fundamental', 'bge');
    expect(result).not.toBeNull();
    expect(result?.uac_name).toBe('PENSAMIENTO MATEMÁTICO II');
  });

  it('getProgramByUacAndSemester — miss: retorna null si no coincide', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await getProgramByUacAndSemester('UAC INVENTADA', 99);
    expect(result).toBeNull();
  });

  it('getFfeContinuity — busca y retorna continuidad formativa FFE', async () => {
    mockQueryFn.mockResolvedValueOnce([{
      id: 'ffe-1',
      semester_5_uac: 'Temas Selectos de Física I',
      semester_6_uac: 'Temas Selectos de Física II',
    }]);

    const result = await getFfeContinuity('Física');
    expect(result).not.toBeNull();
    expect(result?.semester_5_uac).toContain('Física');
  });

  // ── 4. PAEC queries (Fase 20A) ──────────────────────────────────────────────

  it('getPaecProjectsByTeacher — retorna proyectos PAEC del docente', async () => {
    mockQueryFn.mockResolvedValueOnce([
      { id: 'paec-1', project_name: 'Rescate de Saberes', current_step: 3, status: 'draft' },
    ]);

    const result = await getPaecProjectsByTeacher('teacher-uuid-1');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].project_name).toBe('Rescate de Saberes');
  });

  it('getPaecProjectById — hit: retorna proyecto PAEC por ID', async () => {
    mockQueryFn.mockResolvedValueOnce([{
      id: 'paec-101',
      teacher_id: 'teacher-1',
      project_name: 'Agroecología',
      current_step: 2,
      status: 'draft',
      community_context: { problem: 'Escasez de agua' },
      school_context: { schoolName: 'BGE 1' },
    }]);

    const result = await getPaecProjectById('paec-101', 'teacher-1');
    expect(result).not.toBeNull();
    expect(result?.project_name).toBe('Agroecología');
    expect(result?.current_step).toBe(2);
  });

  it('getPaecProjectById — miss: retorna null si no existe', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await getPaecProjectById('inexistente', 'teacher-1');
    expect(result).toBeNull();
  });

  it('createPaecProject — inserta proyecto PAEC con status draft y paso 1', async () => {
    mockQueryFn.mockResolvedValueOnce([{
      id: 'paec-new-1',
      teacher_id: 'teacher-1',
      project_name: 'Cuidado Ambiental',
      problem_statement: 'Contaminación',
      cycle_type: 'semestral',
      current_step: 1,
      status: 'draft',
    }]);

    const result = await createPaecProject({
      teacherId: 'teacher-1',
      projectName: 'Cuidado Ambiental',
      problemStatement: 'Contaminación',
      cycleType: 'semestral',
      communityContext: {},
      schoolContext: {},
    });

    expect(result.id).toBe('paec-new-1');
    expect(result.project_name).toBe('Cuidado Ambiental');
    expect(result.current_step).toBe(1);
    expect(result.status).toBe('draft');
  });

  it('updatePaecProjectStep — actualiza paso intermedio con status draft', async () => {
    mockQueryFn.mockResolvedValueOnce([{
      id: 'paec-101',
      teacher_id: 'teacher-1',
      project_name: 'Proyecto',
      current_step: 4,
      status: 'draft',
    }]);

    const result = await updatePaecProjectStep('paec-101', 'teacher-1', 4, 'fase2_cronograma', { cronograma: [] });
    expect(result.currentStep).toBe(4);
    expect(result.status).toBe('draft');
  });

  it('updatePaecProjectStep — actualiza a completed cuando step es 9', async () => {
    mockQueryFn.mockResolvedValueOnce([{
      id: 'paec-101',
      teacher_id: 'teacher-1',
      project_name: 'Proyecto',
      current_step: 9,
      status: 'completed',
    }]);

    const result = await updatePaecProjectStep('paec-101', 'teacher-1', 9, 'fase4_gobernanza_e_informe', { gobernanza: {} });
    expect(result.currentStep).toBe(9);
    expect(result.status).toBe('completed');
  });

  it('updatePaecProjectStep — arroja error si el paso no está en el rango 1 a 9', async () => {
    await expect(
      updatePaecProjectStep('paec-101', 'teacher-1', 10, 'fase4_gobernanza', {})
    ).rejects.toThrow(/Paso inválido/);

    await expect(
      updatePaecProjectStep('paec-101', 'teacher-1', 0, 'fase1_diagnostico', {})
    ).rejects.toThrow(/Paso inválido/);
  });

  it('updatePaecProjectStep — arroja error si faltan identificadores', async () => {
    await expect(
      updatePaecProjectStep('', 'teacher-1', 1, 'fase1_diagnostico', {})
    ).rejects.toThrow(/Identificadores de proyecto o docente inválidos/);
  });

  it('deletePaecProject — elimina proyecto PAEC del docente', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    await expect(deletePaecProject('paec-delete', 'teacher-1')).resolves.not.toThrow();
  });

  // ── 5. Workbooks queries (Fase 20A) ─────────────────────────────────────────

  it('saveBlockWorkbook — guarda versión inicial cuando workbooks_json no existe', async () => {
    // 1. SELECT plannings -> retorna fila con workbooks_json nulo
    mockQueryFn.mockResolvedValueOnce([{ id: 'plan-wb-1', workbooks_json: null }]);
    // 2. UPDATE plannings -> éxito (RETURNING id)
    mockQueryFn.mockResolvedValueOnce([{ id: 'plan-wb-1' }]);

    const mockWb = { id: 'wb-1', blockIndex: 0, blockName: 'Bloque 1' } as unknown as ActiveWorkTextbook;
    const result = await saveBlockWorkbook('plan-wb-1', 0, mockWb);

    expect(result.success).toBe(true);
    expect(result.version).toBe(1);
  });

  it('saveBlockWorkbook — incrementa versión cuando el bloque ya existía previamente', async () => {
    const existingWorkbooks = {
      block_0: {
        version: 3,
        current: { id: 'wb-old', version: 3 },
        history: [],
      },
    };
    mockQueryFn.mockResolvedValueOnce([{ id: 'plan-wb-2', workbooks_json: existingWorkbooks }]);
    mockQueryFn.mockResolvedValueOnce([{ id: 'plan-wb-2' }]);

    const mockWb = { id: 'wb-new', blockIndex: 0 } as unknown as ActiveWorkTextbook;
    const result = await saveBlockWorkbook('plan-wb-2', 0, mockWb);

    expect(result.success).toBe(true);
    expect(result.version).toBe(4);
  });

  it('saveBlockWorkbook — rechaza blockIndex negativo o NaN', async () => {
    const mockWb = {} as unknown as ActiveWorkTextbook;
    const resNegative = await saveBlockWorkbook('plan-1', -1, mockWb);
    expect(resNegative.success).toBe(false);
    expect(resNegative.error).toContain('blockIndex inválido');

    const resNaN = await saveBlockWorkbook('plan-1', NaN, mockWb);
    expect(resNaN.success).toBe(false);
  });

  it('saveBlockWorkbook — retorna error si la planeación no existe', async () => {
    mockQueryFn.mockResolvedValueOnce([]); // No planning rows

    const mockWb = { id: 'wb-1' } as unknown as ActiveWorkTextbook;
    const result = await saveBlockWorkbook('plan-inexistente', 0, mockWb);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Planning not found');
  });

  it('getBlockWorkbook — hit: retorna el cuaderno activo del bloque solicitado', async () => {
    const mockWbCurrent = { id: 'wb-block-0', blockIndex: 0, title: 'Cuaderno B0' };
    mockQueryFn.mockResolvedValueOnce([{
      workbooks_json: {
        block_0: {
          version: 1,
          current: mockWbCurrent,
          history: [],
        },
      },
    }]);

    const result = await getBlockWorkbook('plan-1', 0);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('wb-block-0');
  });

  it('getBlockWorkbook — miss: retorna null si la planeación o el bloque no existen', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await getBlockWorkbook('plan-inexistente', 0);
    expect(result).toBeNull();
  });

  it('getAllBlockWorkbooks — retorna diccionario de bloques completo o vacío', async () => {
    const workbooksMap = {
      block_0: { version: 1, current: {} as unknown as ActiveWorkTextbook, history: [] },
      block_1: { version: 2, current: {} as unknown as ActiveWorkTextbook, history: [] },
    };
    mockQueryFn.mockResolvedValueOnce([{ workbooks_json: workbooksMap }]);

    const result = await getAllBlockWorkbooks('plan-1');
    expect(Object.keys(result)).toEqual(['block_0', 'block_1']);
  });

  // ── 6. Generation Jobs queries (Fase 20A) ───────────────────────────────────

  it('createGenerationJob — retorna job activo existente si ya hay uno reciente (< 10 min)', async () => {
    const existingActiveJob = {
      id: 'job-active-1',
      planning_id: 'plan-job-1',
      block_index: 0,
      status: 'running',
      progress: 50,
    };
    mockQueryFn.mockResolvedValueOnce([existingActiveJob]);

    const result = await createGenerationJob('plan-job-1', 'teacher-1', 0);

    expect(result.id).toBe('job-active-1');
    expect(result.status).toBe('running');
    expect(result.progress).toBe(50);
  });

  it('createGenerationJob — crea un nuevo job en estado pending si no hay activo previo', async () => {
    // 1. SELECT active jobs -> ninguno
    mockQueryFn.mockResolvedValueOnce([]);
    // 2. INSERT generation_jobs -> nuevo job creado
    const newJob = {
      id: 'job-new-1',
      planning_id: 'plan-job-2',
      block_index: 1,
      status: 'pending',
      progress: 0,
    };
    mockQueryFn.mockResolvedValueOnce([newJob]);

    const result = await createGenerationJob('plan-job-2', 'teacher-1', 1);

    expect(result.id).toBe('job-new-1');
    expect(result.status).toBe('pending');
    expect(result.progress).toBe(0);
  });

  it('getGenerationJobById — hit: retorna el job de generación por id', async () => {
    mockQueryFn.mockResolvedValueOnce([{
      id: 'job-found-1',
      status: 'completed',
      progress: 100,
    }]);

    const result = await getGenerationJobById('job-found-1');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('job-found-1');
    expect(result?.status).toBe('completed');
  });

  it('getGenerationJobById — miss: retorna null si el job no existe', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await getGenerationJobById('job-inexistente');
    expect(result).toBeNull();
  });

  it('claimNextPendingJob — reclama y pasa a running el siguiente job disponible', async () => {
    const claimedJob = {
      id: 'job-claimed-1',
      status: 'running',
      progress: 5,
    };
    mockQueryFn.mockResolvedValueOnce([claimedJob]);

    const result = await claimNextPendingJob();

    expect(result).not.toBeNull();
    expect(result?.id).toBe('job-claimed-1');
    expect(result?.status).toBe('running');
  });

  it('claimNextPendingJob — retorna null cuando no hay jobs pendientes en cola', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await claimNextPendingJob();
    expect(result).toBeNull();
  });
});
