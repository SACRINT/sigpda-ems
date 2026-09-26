/**
 * paec-step8-step9-chunking.test.ts
 *
 * Tests unitarios para el chunking, reintentos y checkpoints en Pasos 8 y 9 de PAEC (Item B2).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
  getPaecProjectById: vi.fn(),
  updatePaecProjectStep: vi.fn(),
  updatePaecQualityAudit: vi.fn(),
  getProgramsCatalogForPaec: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock('@/lib/idempotency', () => ({
  extractIdempotencyKey: vi.fn(() => null),
  checkIdempotencyKey: vi.fn(async () => null),
  createIdempotencyKey: vi.fn(),
}));

vi.mock('@/lib/context-extractor', () => ({
  getUserLibraryContext: vi.fn(async () => ''),
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectById, updatePaecProjectStep } from '@/lib/db';
import { generateWithRotation } from '@/lib/ai-provider';
import { POST } from '@/app/api/paec/[id]/generate-step/route';

describe('B2: Chunking, Reintentos y Checkpoints en Pasos 8 y 9 de PAEC', () => {
  const mockTeacher = {
    id: 'teacher-paec-uuid-1',
    email: 'docente@puebla.gob.mx',
    name: 'Prof. Carlos Mendoza',
  };

  const baseProject = {
    id: 'paec-project-uuid-1',
    teacher_id: mockTeacher.id,
    project_name: 'Transformación Ecológica Atoyac',
    problem_statement: 'Contaminación severa por residuos plásticos',
    cycle_type: 'annual',
    fase2_cronograma: { semanas: [] },
    fase2_justificacion: { justificacion: 'Alta pertinencia comunitaria' },
    fase3_plan_operativo_a: [{ uacName: 'Pensamiento Matemático', semestre: '1' }],
    fase3_plan_operativo_b: [{ uacName: 'Lengua y Comunicación', semestre: '2' }],
    fase3_implementacion: null,
    fase4_gobernanza_e_informe: null,
    school_context: { cct: '21EBH0004Z' },
  };

  const block1Response = JSON.stringify({
    cartaInvitacion: {
      asunto: 'Convocatoria comunitaria',
      cuerpo: 'Se convoca formalmente a la comunidad vecinal al proyecto de transformación.',
      firmante: 'Director del Plantel',
    },
    minutaArranque: {
      cct: '21EBH0004Z',
      acuerdos: [{ no: 1, acuerdo: 'Instalación de brigadas', responsable: 'Comité PAEC', fechaLimite: 'Semana 2', estatus: 'Cumplido' }],
      firmas: [{ cargo: 'Director', nombre: 'Roberto Mendoza' }],
    },
    oficiosAliados: [
      {
        destinatario: 'Presidente Auxiliar',
        asunto: 'Solicitud de apoyo en recolección',
        propuestaColaboracion: 'Apoyo con camiones recolectores durante las jornadas de limpieza comunitaria.',
      },
    ],
    sesionLanzamiento: {
      fecha: 'Septiembre 2026',
      dinamica: 'Asamblea general',
      participantes: 'Toda la comunidad',
      acuerdosEstudiantiles: ['Participación activa'],
    },
  });

  const block2Response = JSON.stringify({
    anexo1Minuta: {
      cct: '21EBH0004Z',
      tipoReunion: 'Asamblea Anexo 1',
      acuerdos: [{ no: 1, acuerdo: 'Acuerdo Anexo', responsable: 'Comité PAEC', fechaLimite: 'Semana 4', estatus: 'Cumplido' }],
      firmas: [{ cargo: 'Director', nombre: 'Roberto Mendoza' }],
    },
    anexo2Seguimiento: [
      {
        semana: 'Semana 1',
        fase: 'Fase 1',
        uac: 'Pensamiento Matemático',
        metaOperativa: 'Levantamiento diagnóstico',
        evidencia: 'Cuestionarios resueltos',
        avancePorcentaje: 100,
        semaforo: 'verde',
      },
    ],
    anexo3ReporteMensual: {
      periodo: 'Septiembre 2026',
      resumenEjecutivo: 'Reporte del primer mes de operación comunitaria con 95% de avance.',
      logros: ['Conformación de 4 brigadas'],
      dificultades: ['Lluvia en jornada 2'],
      accionesAjuste: ['Ajuste de fechas'],
    },
  });

  const block3Response = JSON.stringify({
    anexo4ImpactoComunidad: {
      titulo: 'Cuestionario de Impacto',
      tipoAplicacion: 'PRE/POST',
      reactivos: [{ reactivo: 'La problemática fue mitigada', dimension: 'Impacto' }],
    },
    anexo5AutoevaluacionEstudiantes: {
      titulo: 'Rúbrica de Autoevaluación',
      tipoAplicacion: 'FINAL',
      reactivos: [{ reactivo: 'Colaboré en mi brigada', dimension: 'Colaboración' }],
    },
    anexo6EvaluacionColegiado: {
      titulo: 'Evaluación de Colegiado',
      tipoAplicacion: 'FINAL',
      reactivos: [{ reactivo: 'La transversalidad fue efectiva', dimension: 'Transversalidad' }],
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
  });

  it('1. Si el Bloque 3 falla tras 2 reintentos, Bloques 1 y 2 quedan persistidos en BD (Checkpointing)', async () => {
    vi.mocked(getPaecProjectById).mockResolvedValue({ ...baseProject } as never);

    // Bloque 1 OK, Bloque 2 OK, Bloque 3 falla siempre
    vi.mocked(generateWithRotation)
      .mockResolvedValueOnce(block1Response) // Bloque 1
      .mockResolvedValueOnce(block2Response) // Bloque 2
      .mockRejectedValueOnce(new Error('AI Rate Limit en Bloque 3 (intento 1)'))
      .mockRejectedValueOnce(new Error('AI Rate Limit en Bloque 3 (intento 2)'))
      .mockRejectedValueOnce(new Error('AI Rate Limit en Bloque 3 (intento 3)'));

    const req = new NextRequest('http://localhost:3000/api/paec/paec-project-uuid-1/generate-step', {
      method: 'POST',
      body: JSON.stringify({ step: 8 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'paec-project-uuid-1' }) });
    expect(res.status).toBe(500);

    // Verificación de checkpoints en BD: Bloque 1 y Bloque 2 fueron guardados
    expect(updatePaecProjectStep).toHaveBeenCalledWith(
      'paec-project-uuid-1',
      mockTeacher.id,
      8,
      'fase3_implementacion',
      expect.objectContaining({
        cartaInvitacion: expect.any(Object),
        oficiosAliados: expect.any(Array),
      })
    );

    expect(updatePaecProjectStep).toHaveBeenCalledWith(
      'paec-project-uuid-1',
      mockTeacher.id,
      8,
      'fase3_implementacion',
      expect.objectContaining({
        anexos: expect.objectContaining({
          anexo2Seguimiento: expect.any(Array),
          anexo3ReporteMensual: expect.any(Object),
        }),
      })
    );
  });

  it('2. En el reintento subsiguiente, Bloques 1 y 2 no se regeneran y se completa Bloque 3', async () => {
    // El proyecto ya cuenta con el checkpoint de Bloques 1 y 2 guardado en BD
    const projectWithPartialCheckpoints = {
      ...baseProject,
      fase3_implementacion: {
        cartaInvitacion: JSON.parse(block1Response).cartaInvitacion,
        oficiosAliados: JSON.parse(block1Response).oficiosAliados,
        minutaArranque: JSON.parse(block1Response).minutaArranque,
        anexos: {
          anexo2Seguimiento: JSON.parse(block2Response).anexo2Seguimiento,
          anexo3ReporteMensual: JSON.parse(block2Response).anexo3ReporteMensual,
        },
      },
    };

    vi.mocked(getPaecProjectById).mockResolvedValue(projectWithPartialCheckpoints as never);

    // Ahora solo se debe llamar a generateWithRotation UNA VEZ (para el Bloque 3)
    vi.mocked(generateWithRotation).mockResolvedValueOnce(block3Response);

    const req = new NextRequest('http://localhost:3000/api/paec/paec-project-uuid-1/generate-step', {
      method: 'POST',
      body: JSON.stringify({ step: 8 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'paec-project-uuid-1' }) });
    expect(res.status).toBe(200);

    // Solo se invocó la IA para el Bloque 3 faltante
    expect(generateWithRotation).toHaveBeenCalledTimes(1);

    const data = await res.json();
    expect(data.data.cartaInvitacion).toBeDefined();
    expect(data.data.anexos.anexo2Seguimiento).toBeDefined();
    expect(data.data.anexos.anexo4ImpactoComunidad).toBeDefined();
  });
});
