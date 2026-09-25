/**
 * pmc-f11-911-api.test.ts
 * Tests unitarios de endpoints API para F11 y Estadística 911 (N-002)
 * SIGPDA-EMS · PMC Redesign 2026-2027
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
}));

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
  resolveUserIsPremium: vi.fn(),
}));

vi.mock('@/lib/document-ingestion', () => ({
  ingestDocument: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import { ingestDocument } from '@/lib/document-ingestion';
import { POST as handleF11Post } from '@/app/api/pmc/f11/route';
import { POST as handle911Post } from '@/app/api/pmc/estadistica-911/route';

const mockTeacher = {
  id: 'teacher-uuid-123',
  email: 'docente@bachillerato.edu.mx',
  name: 'Prof. Juan Pérez',
};

describe('API Route: /api/pmc/f11', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 401 si no hay sesión autenticada', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const req = new NextRequest('http://localhost:3000/api/pmc/f11', { method: 'POST' });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('No autorizado');
  });

  it('retorna 404 si el docente no existe en base de datos', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(null as never);

    const formData = new FormData();
    const req = new NextRequest('http://localhost:3000/api/pmc/f11', {
      method: 'POST',
      body: formData,
    });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Docente no encontrado');
  });

  it('retorna 400 si no se adjunta archivo en el formData', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);

    const formData = new FormData();
    const req = new NextRequest('http://localhost:3000/api/pmc/f11', {
      method: 'POST',
      body: formData,
    });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('No se ha subido ningún archivo');
  });

  it('retorna 400 si el archivo supera el límite de 10 MB', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);

    const mockFile = {
      name: 'gigante.pdf',
      type: 'application/pdf',
      size: 11 * 1024 * 1024,
      arrayBuffer: vi.fn(),
    } as unknown as File;

    const mockFormData = {
      get: (key: string) => (key === 'file' ? mockFile : null),
    };

    const req = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as unknown as NextRequest;

    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('excede el tamaño máximo permitido');
  });

  it('retorna 400 si ingestDocument falla (archivo corrupto / no soportado)', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(ingestDocument).mockRejectedValueOnce(new Error('Corrupted PDF header'));

    const file = new File(['corrupt data content'], 'corrupto.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/f11', {
      method: 'POST',
      body: formData,
    });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Corrupted PDF header');
  });

  it('retorna 400 si el documento extraído no tiene texto suficiente (<40 caracteres)', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'vacio',
      markdown: 'vacio',
      pageCount: 1,
    } as never);

    const file = new File(['vacio'], 'scan_vacio.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/f11', {
      method: 'POST',
      body: formData,
    });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('no contiene texto legible');
  });

  it('retorna 422 si la respuesta de IA no puede estructurarse contra el schema', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValueOnce(false);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'Reporte F11 con suficiente texto para superar el mínimo de cuarenta caracteres requeridos por la validación.',
      markdown: 'Reporte F11 con suficiente texto para superar el mínimo de cuarenta caracteres requeridos por la validación.',
      pageCount: 2,
    } as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce('Respuesta no válida de IA');

    const file = new File(['f11 sample valid binary'], 'f11_sample.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/f11', {
      method: 'POST',
      body: formData,
    });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toContain('No se pudieron estructurar los datos del F11');
  });

  it('retorna 200 con datos estructurados de F11 exitosamente', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValueOnce(true);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'FORMATO F11 BACHILLERATO GENERAL HÉROES DE LA PATRIA CCT 21EBH0282Y ALUMNOS 120 PROMEDIO 8.4',
      markdown: 'FORMATO F11 BACHILLERATO GENERAL HÉROES DE LA PATRIA CCT 21EBH0282Y ALUMNOS 120 PROMEDIO 8.4',
      pageCount: 2,
    } as never);

    const validAiResponse = JSON.stringify({
      schoolName: 'BACHILLERATO HEROES DE LA PATRIA',
      schoolCct: '21EBH0282Y',
      cicloEscolar: '2025-2026',
      semestre: 'B',
      totalAlumnos: 120,
      aprobadosPorcentaje: 88.5,
      reprobadosPorcentaje: 11.5,
      promedioGeneral: 8.4,
      promediosPorAsignatura: {
        'Pensamiento Matemático II': 6.8,
        'Lengua y Comunicación II': 8.9,
      },
      materiasMayorReprobacion: ['Pensamiento Matemático II'],
    });

    vi.mocked(generateWithRotation).mockResolvedValueOnce(validAiResponse);

    const file = new File(['f11 valid content bytes'], 'f11_oficial.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/f11', {
      method: 'POST',
      body: formData,
    });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.filename).toBe('f11_oficial.pdf');
    expect(json.data.schoolCct).toBe('21EBH0282Y');
    expect(json.data.promedioGeneral).toBe(8.4);
    expect(json.data.promediosPorAsignatura['Pensamiento Matemático II']).toBe(6.8);
  });
});

describe('API Route: /api/pmc/estadistica-911', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 401 si no hay sesión autenticada', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const req = new NextRequest('http://localhost:3000/api/pmc/estadistica-911', { method: 'POST' });
    const res = await handle911Post(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('No autorizado');
  });

  it('retorna 404 si el docente no existe en base de datos', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(null as never);

    const formData = new FormData();
    const req = new NextRequest('http://localhost:3000/api/pmc/estadistica-911', {
      method: 'POST',
      body: formData,
    });
    const res = await handle911Post(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Docente no encontrado');
  });

  it('retorna 400 si no se sube archivo', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);

    const formData = new FormData();
    const req = new NextRequest('http://localhost:3000/api/pmc/estadistica-911', {
      method: 'POST',
      body: formData,
    });
    const res = await handle911Post(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('No se ha subido ningún archivo');
  });

  it('retorna 422 si la respuesta de IA es malformada', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValueOnce(false);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'ESTADISTICA 911 FORMULARIO OFICIAL SEP CON TEXTO SUFICIENTE PARA PROCESAR Y VALIDAR.',
      markdown: 'ESTADISTICA 911 FORMULARIO OFICIAL SEP CON TEXTO SUFICIENTE PARA PROCESAR Y VALIDAR.',
      pageCount: 3,
    } as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce('Respuesta de la IA que no es JSON ni cumple el esquema');

    const file = new File(['valid 911 pdf bytes'], '911_data.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/estadistica-911', {
      method: 'POST',
      body: formData,
    });
    const res = await handle911Post(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toContain('No se pudieron estructurar los datos de Estadística 911');
  });

  it('retorna 200 con momento fin_anterior e indicadores terminales', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValueOnce(true);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'ESTADISTICA FIN DE CICLO ANTERIOR 911.9A ALUMNOS 280 ABANDONO 6.2 EFICIENCIA TERMINAL 87.5',
      markdown: 'ESTADISTICA FIN DE CICLO ANTERIOR 911.9A ALUMNOS 280 ABANDONO 6.2 EFICIENCIA TERMINAL 87.5',
      pageCount: 4,
    } as never);

    const validAiResponse = JSON.stringify({
      schoolName: 'BACHILLERATO HEROES DE LA PATRIA',
      schoolCct: '21EBH0282Y',
      cicloEscolar: '2025-2026',
      momento: 'fin_anterior',
      matricula: 280,
      abandonoPorcentaje: 6.2,
      eficienciaTerminal: 87.5,
      reprobacionPorcentaje: 8.1,
      aprobacionPorcentaje: 91.9,
      totalDocentes: 14,
    });

    vi.mocked(generateWithRotation).mockResolvedValueOnce(validAiResponse);

    const file = new File(['911 fin bytes'], '911_fin_anterior.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('momento', 'fin_anterior');

    const req = new NextRequest('http://localhost:3000/api/pmc/estadistica-911', {
      method: 'POST',
      body: formData,
    });
    const res = await handle911Post(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.momento).toBe('fin_anterior');
    expect(json.data.abandonoPorcentaje).toBe(6.2);
    expect(json.data.eficienciaTerminal).toBe(87.5);
    expect(json.data.totalDocentes).toBe(14);
  });

  it('retorna 200 con momento inicio_anterior e inicio_actual preservando el parámetro', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValue(true);
    vi.mocked(ingestDocument).mockResolvedValue({
      fullText: 'ESTADISTICA INICIO DE CICLO 911 MATRICULA 310 TOTAL DOCENTES 15 TURNO MATUTINO',
      markdown: 'ESTADISTICA INICIO DE CICLO 911 MATRICULA 310 TOTAL DOCENTES 15 TURNO MATUTINO',
      pageCount: 3,
    } as never);

    const validAiResponse = JSON.stringify({
      schoolName: 'BACHILLERATO HEROES DE LA PATRIA',
      schoolCct: '21EBH0282Y',
      cicloEscolar: '2026-2027',
      momento: 'inicio_actual',
      matricula: 310,
      totalDocentes: 15,
    });

    vi.mocked(generateWithRotation).mockResolvedValue(validAiResponse);

    // Test momento inicio_actual
    const formDataAct = new FormData();
    formDataAct.append('file', new File(['911 ini act'], '911_act.pdf', { type: 'application/pdf' }));
    formDataAct.append('momento', 'inicio_actual');

    const reqAct = new NextRequest('http://localhost:3000/api/pmc/estadistica-911', {
      method: 'POST',
      body: formDataAct,
    });
    const resAct = await handle911Post(reqAct);
    const jsonAct = await resAct.json();

    expect(resAct.status).toBe(200);
    expect(jsonAct.success).toBe(true);
    expect(jsonAct.filename).toBe('911_act.pdf');
    expect(jsonAct.data.momento).toBe('inicio_actual');
    expect(jsonAct.data.matricula).toBe(310);
    expect(jsonAct.data.totalDocentes).toBe(15);
    expect(jsonAct.data.schoolName).toBe('BACHILLERATO HEROES DE LA PATRIA');
    expect(jsonAct.data.schoolCct).toBe('21EBH0282Y');

    // Test momento inicio_anterior
    const formDataAnt = new FormData();
    formDataAnt.append('file', new File(['911 ini ant'], '911_ant.pdf', { type: 'application/pdf' }));
    formDataAnt.append('momento', 'inicio_anterior');

    const reqAnt = new NextRequest('http://localhost:3000/api/pmc/estadistica-911', {
      method: 'POST',
      body: formDataAnt,
    });
    const resAnt = await handle911Post(reqAnt);
    const jsonAnt = await resAnt.json();

    expect(resAnt.status).toBe(200);
    expect(jsonAnt.success).toBe(true);
    expect(jsonAnt.filename).toBe('911_ant.pdf');
    expect(jsonAnt.data.momento).toBe('inicio_anterior');
    expect(jsonAnt.data.matricula).toBe(310);
    expect(jsonAnt.data.totalDocentes).toBe(15);
    expect(jsonAnt.data.schoolName).toBe('BACHILLERATO HEROES DE LA PATRIA');
    expect(jsonAnt.data.schoolCct).toBe('21EBH0282Y');
  });

  it('preserva la eficiencia terminal generacional oficial del 911 sin subvaluar con matrícula multigrado (H-039)', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValueOnce(true);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'ESTADISTICA 911 MATRICULA TOTAL 300 EGRESADOS 85 % EFICIENCIA TERMINAL GENERACION 2023-2026: 94.4%',
      markdown: 'ESTADISTICA 911 MATRICULA TOTAL 300 EGRESADOS 85 % EFICIENCIA TERMINAL GENERACION 2023-2026: 94.4%',
      pageCount: 3,
    } as never);

    const validAiResponse = JSON.stringify({
      schoolName: 'BACHILLERATO EJEMPLO',
      matricula: 300,
      egresados: 85,
      eficienciaTerminal: 94.4,
      bajasDefinitivas: 6,
    });

    vi.mocked(generateWithRotation).mockResolvedValueOnce(validAiResponse);

    const formData = new FormData();
    formData.append('file', new File(['dummy 911'], '911_fin.pdf', { type: 'application/pdf' }));
    formData.append('momento', 'fin_anterior');

    const req = new NextRequest('http://localhost:3000/api/pmc/estadistica-911', {
      method: 'POST',
      body: formData,
    });
    const res = await handle911Post(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.eficienciaTerminal).toBe(94.4);
    expect(json.data.abandonoPorcentaje).toBe(2);
  });
});
