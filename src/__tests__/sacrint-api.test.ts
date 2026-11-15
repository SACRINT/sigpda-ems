import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PDFParse } from 'pdf-parse';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockIsAdmin = vi.fn();
vi.mock('@/lib/admin-unified', () => ({ isAdmin: (email: string) => mockIsAdmin(email) }));

let mockPlanRows: Array<{ id: string; teacher_id: string; uac_name: string; component: string | null }> = [];
const mockSql = vi.fn(() => Promise.resolve(mockPlanRows));
const mockGetTeacherByEmail = vi.fn();
const mockGetBlockWorkbook = vi.fn();
vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
  getTeacherByEmail: (email: string) => mockGetTeacherByEmail(email),
  getBlockWorkbook: (id: string, index: number) => mockGetBlockWorkbook(id, index),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET as GET_SLIDES } from '@/app/api/planeaciones/[id]/presentacion/sacrint/route';
import { GET as GET_INFOGRAPHIC } from '@/app/api/planeaciones/[id]/infografia/sacrint/route';

const planningId = '11111111-1111-1111-1111-111111111111';
const teacherId = 'teacher-1';

const slideCall = (query: string) =>
  GET_SLIDES(new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/presentacion/sacrint${query}`), {
    params: Promise.resolve({ id: planningId }),
  });

const infographicCall = (query: string) =>
  GET_INFOGRAPHIC(new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/infografia/sacrint${query}`), {
    params: Promise.resolve({ id: planningId }),
  });

describe('SACRINT API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 't@x.mx' } });
    mockIsAdmin.mockResolvedValue(false);
    mockPlanRows = [{ id: planningId, teacher_id: teacherId, uac_name: 'PM I', component: null }];
    mockGetTeacherByEmail.mockResolvedValue({ id: teacherId, role: 'docente' });
    mockGetBlockWorkbook.mockResolvedValue(MATH_DEMO_WORKBOOK);
  });

  it('protege la presentación sin sesión', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await slideCall('?blockIndex=0&format=json')).status).toBe(401);
  });

  it('valida parámetros de presentación', async () => {
    expect((await slideCall('?blockIndex=-1')).status).toBe(400);
    expect((await slideCall('?blockIndex=0&format=webp')).status).toBe(400);
    expect((await slideCall('?blockIndex=0&format=svg&slide=9')).status).toBe(400);
  });

  it('devuelve el mazo SACRINT y sus misiones', async () => {
    const res = await slideCall('?blockIndex=0&missionIndex=0&format=json');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deck.slides).toHaveLength(8);
    expect(data.deck.slides[0].kind).toBe('cover');
    expect(data.deck.slides[7].kind).toBe('closing');
    expect(data.missions).toHaveLength(1);
    expect(data.deck.pack.id).toBe('matematicas');
  });

  it('sirve una diapositiva SVG y una PNG', async () => {
    const svgRes = await slideCall('?blockIndex=0&format=svg&slide=2');
    expect(svgRes.status).toBe(200);
    expect(svgRes.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(await svgRes.text()).toContain('MODELO LINEAL');

    const pngRes = await slideCall('?blockIndex=0&format=png&slide=0');
    expect(pngRes.status).toBe(200);
    expect(pngRes.headers.get('Content-Type')).toBe('image/png');
    const png = Buffer.from(await pngRes.arrayBuffer());
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });

  it('exporta la misión completa a PPTX editable', async () => {
    const res = await slideCall('?blockIndex=0&missionIndex=0&format=pptx');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain('.pptx');
    const pptx = Buffer.from(await res.arrayBuffer());
    expect(pptx.subarray(0, 2).toString()).toBe('PK');
    expect(pptx.length).toBeGreaterThan(20_000);
  });

  it('valida la misión inexistente', async () => {
    expect((await slideCall('?blockIndex=0&missionIndex=4&format=json')).status).toBe(404);
    expect((await infographicCall('?blockIndex=0&missionIndex=4&format=json')).status).toBe(404);
  });

  it('devuelve metadatos de infografía Carta y wide', async () => {
    const letterRes = await infographicCall('?blockIndex=0&layout=letter&format=json');
    expect(letterRes.status).toBe(200);
    const letter = await letterRes.json();
    expect(letter.width).toBe(1275);
    expect(letter.height).toBe(1650);

    const wideRes = await infographicCall('?blockIndex=0&layout=wide&format=json');
    const wide = await wideRes.json();
    expect(wide.width).toBe(2752);
    expect(wide.height).toBe(1536);
  });

  it('sirve infografía SVG, PNG y PDF', async () => {
    const svgRes = await infographicCall('?blockIndex=0&layout=letter&format=svg');
    expect(svgRes.status).toBe(200);
    expect(await svgRes.text()).toContain('SACRINT · MANUAL CARTA');

    const pngRes = await infographicCall('?blockIndex=0&layout=letter&format=png');
    expect(pngRes.status).toBe(200);
    const png = Buffer.from(await pngRes.arrayBuffer());
    expect(png.subarray(1, 4).toString()).toBe('PNG');

    const pdfRes = await infographicCall('?blockIndex=0&layout=letter&format=pdf');
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get('Content-Type')).toBe('application/pdf');
    const pdf = Buffer.from(await pdfRes.arrayBuffer());
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  }, 120000);

  it('exporta PDF vectorial con texto seleccionable y conserva el aspecto letter/wide', async () => {
    const mediaBox = (pdf: Buffer) => {
      const match = pdf.toString('latin1').match(/\/MediaBox\s*\[([^\]]+)\]/);
      return match ? match[1].trim().split(/\s+/).map(Number) : [];
    };
    const extractText = async (pdf: Buffer) => {
      const parser = new PDFParse({ data: pdf });
      try {
        return (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    };

    const letterRes = await infographicCall('?blockIndex=0&layout=letter&format=pdf');
    const letterPdf = Buffer.from(await letterRes.arrayBuffer());
    const letterRaw = letterPdf.toString('latin1');
    const letterText = await extractText(letterPdf);
    expect(letterRaw).not.toContain('/Width 2550');
    expect(letterText).toContain('MANUAL DE CONCEPTOS');
    expect(letterText.length).toBeGreaterThan(250);
    expect(mediaBox(letterPdf)).toEqual([0, 0, 612, 792]);

    const wideRes = await infographicCall('?blockIndex=0&layout=wide&format=pdf');
    const widePdf = Buffer.from(await wideRes.arrayBuffer());
    const wideRaw = widePdf.toString('latin1');
    const wideText = await extractText(widePdf);
    expect(wideRaw).not.toContain('/Width 5504');
    expect(wideText).toContain('MANUAL DE CONCEPTOS');
    expect(wideText.length).toBeGreaterThan(250);
    const wideBox = mediaBox(widePdf);
    expect(wideBox?.[0]).toBe(0);
    expect(wideBox?.[1]).toBe(0);
    expect(wideBox?.[2]).toBeCloseTo(792, 0);
    expect(wideBox?.[3]).toBeCloseTo(445.5, 1);
  }, 120000);

  it('rechaza layout inválido', async () => {
    expect((await infographicCall('?blockIndex=0&layout=poster&format=json')).status).toBe(400);
  });
});
