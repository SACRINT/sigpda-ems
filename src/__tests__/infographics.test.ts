/**
 * H-320 / H-321 — Infografías pedagógicas: generador SVG, exportación PNG/PDF y endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import { buildInfographic, wrapText, escapeXml, INFOGRAPHIC_WIDTH, INFOGRAPHIC_HEIGHT } from '@/lib/visual-engine/infographic-generator';
import { infographicToPng, infographicToPdf, LETTER_300DPI_WIDTH } from '@/lib/visual-engine/infographic-exporter';

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));
const mockIsAdmin = vi.fn();
vi.mock('@/lib/admin-unified', () => ({ isAdmin: (e: string) => mockIsAdmin(e) }));
let mockPlanRows: Array<{ id: string; teacher_id: string; uac_name: string; component: string | null }> = [];
const mockSql = vi.fn(() => Promise.resolve(mockPlanRows));
const mockGetTeacherByEmail = vi.fn();
const mockGetBlockWorkbook = vi.fn();
vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
  getTeacherByEmail: (e: string) => mockGetTeacherByEmail(e),
  getBlockWorkbook: (id: string, idx: number) => mockGetBlockWorkbook(id, idx),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { GET } from '@/app/api/planeaciones/[id]/infografia/route';

function mission(i: number, over: Partial<MissionSection> = {}): MissionSection {
  return {
    missionIndex: i, title: `Misión <&> ${i}`, coveredSessions: [1], sessionTopic: 'Tema central', sessionFocus: 'Foco',
    phenomenonHook: { story: 's', detonatingQuestion: '¿Por qué ocurre esto en mi comunidad?' },
    conceptZero: {
      physicalAnalogy: 'Una analogía cotidiana.', coreExplanation: 'Explicación del concepto.',
      solvedExample: { problemStatement: 'p', solutionSteps: ['Paso uno', 'Paso dos', 'Paso tres'], interpretation: 'i' },
      contrastTable: [{ correctConcept: 'Correcto', commonMisconception: 'Error', reasoning: 'r' }],
    },
    iDoSection: { stepByStepDemo: 'Demo.' }, weDoSection: { guidedPractice: 'g', workbookElements: [] },
    youDoSection: { autonomousChallenge: 'c', workbookElements: [] }, troubleshooting: [],
    formativeCheckpoint: { question: '¿Qué aprendí?', reflectionPrompts: [], criteriaChecklist: ['Criterio A'] },
    wordCount: 1, ...over,
  };
}

function workbook(subject: string): ActiveWorkTextbook {
  return {
    id: 'w', planningId: 'p', blockIndex: 0, blockName: 'B1', version: 1, subsystem: 'bge', targetPages: 1, totalPages: 1,
    totalWords: 1, generatedAt: '', qualityScore: 90, qualityWarning: false,
    coverData: { title: 't', subtitle: '', subjectName: subject, semester: 1, blockNumber: 1, teacherName: 'D', schoolName: 'Escuela', paecProjectName: 'Proyecto X' },
    tableOfContents: [], missions: [mission(1), mission(2)],
    projectSection: { artifactName: '', communityUtility: '', phases: [], technicalSpecs: [], acceptanceCriteria: [] },
    evaluationSection: { source: 'generated_fresh', rubric: [], checklist: [], criticalThinkingQuiz: [], metacognitiveReflection: { prompts: [] } },
  };
}

describe('H-320 — generador de infografías', () => {
  it('wrapText respeta maxLines y agrega elipsis', () => {
    const out = wrapText('palabra '.repeat(80), 300, 24, 3);
    expect(out).toHaveLength(3);
    expect(out[2].endsWith('…')).toBe(true);
    expect(wrapText('', 300, 24, 3)).toEqual([]);
  });

  it('escapeXml neutraliza caracteres peligrosos', () => {
    expect(escapeXml('<a href="x">&\'</a>')).not.toMatch(/[<>"']/);
  });

  it('STEM usa tipología proceso con los pasos reales y es SVG bien formado', () => {
    const info = buildInfographic(workbook('Pensamiento Matemático I'), 0)!;
    expect(info.type).toBe('proceso');
    expect(info.width).toBe(INFOGRAPHIC_WIDTH);
    expect(info.height).toBe(INFOGRAPHIC_HEIGHT);
    expect(info.svg.startsWith('<svg')).toBe(true);
    expect(info.svg).toContain('Paso uno');
    expect(info.svg).toContain('Paso tres');
    expect(info.svg).toContain('Misión &lt;&amp;&gt; 1');
    expect(info.svg).not.toContain('<&>');
    expect(info.svg).toContain('PAEC: Proyecto X');
  });

  it('Humanidades usa tipología conceptual con ramas', () => {
    const info = buildInfographic(workbook('Historia de México'), 0)!;
    expect(info.type).toBe('conceptual');
    expect(info.svg).toContain('Analogía');
    expect(info.svg).toContain('Error común');
  });

  it('no inventa: sin pasos ni explicación no genera pasos', () => {
    const wb = workbook('Pensamiento Matemático I');
    wb.missions[0] = mission(1, { conceptZero: { physicalAnalogy: '', coreExplanation: '' }, iDoSection: { stepByStepDemo: '' } });
    const info = buildInfographic(wb, 0)!;
    expect(info.svg).not.toContain('Paso uno');
    expect(info.svg).not.toContain('<circle cx="90"');
  });

  it('devuelve null para una misión inexistente', () => {
    expect(buildInfographic(workbook('Física'), 9)).toBeNull();
  });
});

describe('Sesión 3 — infografía sin texto cortado', () => {
  const unescape = (s: string) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const EM: Record<string, number> = { normal: 0.58, '500': 0.6, '600': 0.62, '700': 0.64, bold: 0.64 };
  const emOf = (fw: string) => EM[fw] ?? (Number(fw) >= 600 ? 0.64 : Number(fw) >= 500 ? 0.6 : 0.58);

  interface ParsedText { x: number; y: number; fontSize: number; weight: string; anchor: string; content: string }
  function parseTexts(svg: string): ParsedText[] {
    const out: ParsedText[] = [];
    const re = /<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*font-weight="([^"]+)"[^>]*text-anchor="([^"]+)">([^<]*)<\/text>/g;
    for (const m of svg.matchAll(re)) {
      out.push({
        x: Number(m[1]), y: Number(m[2]), fontSize: Number(m[3]),
        weight: m[4], anchor: m[5], content: unescape(m[6]),
      });
    }
    return out;
  }

  it('wrapText calibra por peso: bold admite menos caracteres que normal', () => {
    const texto = 'palabra '.repeat(50).trim();
    const normal = wrapText(texto, 1080, 46, 5, 'normal');
    const bold = wrapText(texto, 1080, 46, 5, 'bold');
    const maxLen = (ls: string[]) => Math.max(...ls.map((l) => l.length));
    const capN = Math.floor(1080 / (46 * 0.58));
    const capB = Math.floor(1080 / (46 * 0.64));
    expect(maxLen(normal)).toBeLessThanOrEqual(capN);
    expect(maxLen(bold)).toBeLessThanOrEqual(capB);
    expect(maxLen(normal)).toBeGreaterThanOrEqual(capN - 7);
    expect(maxLen(bold)).toBeGreaterThanOrEqual(capB - 7);
    expect(maxLen(bold)).toBeLessThan(maxLen(normal));
  });

  it('parte palabras largas conservando todo el texto dentro de maxChars', () => {
    const largo = 'x'.repeat(65);
    const out = wrapText(largo, 300, 24, 5);
    expect(out.join('')).toBe(largo);
    expect(Math.max(...out.map((l) => l.length))).toBeLessThanOrEqual(Math.floor(300 / (24 * 0.58)));
  });

  it('la elipsis corta en frontera de palabra (nunca a mitad de palabra)', () => {
    const original = 'palabra '.repeat(80).trim();
    const out = wrapText(original, 300, 24, 3);
    const vocabulario = new Set(original.split(' '));
    const visible = out[2].replace(/…$/, '');
    expect(out[2].endsWith('…')).toBe(true);
    expect(vocabulario.has(visible.split(' ').pop() ?? '')).toBe(true);
  });

  it('ningún <text> desborda horizontalmente el viewBox (corte duro del borde)', () => {
    const wbs = ['Pensamiento Matemático I', 'Historia de México'];
    for (const subject of wbs) {
      const info = buildInfographic(workbook(subject), 0)!;
      const texts = parseTexts(info.svg);
      expect(texts.length).toBeGreaterThan(5);
      for (const t of texts) {
        const est = t.content.length * t.fontSize * emOf(t.weight);
        if (t.anchor === 'middle') {
          expect(t.x - est / 2).toBeGreaterThanOrEqual(0);
          expect(t.x + est / 2).toBeLessThanOrEqual(INFOGRAPHIC_WIDTH - 5);
        } else {
          expect(t.x + est).toBeLessThanOrEqual(INFOGRAPHIC_WIDTH - 5);
        }
      }
    }
  });

  it('el footer sube a y=1320 y ningún texto baja del margen inferior', () => {
    const info = buildInfographic(workbook('Pensamiento Matemático I'), 0)!;
    expect(info.svg).toContain('<rect x="0" y="1320"');
    for (const t of parseTexts(info.svg)) {
      expect(t.y).toBeLessThanOrEqual(INFOGRAPHIC_HEIGHT - 20);
    }
  });

  it('la pregunta detonadora larga cabe en 2 líneas sin elipsis', () => {
    const wb = workbook('Pensamiento Matemático I');
    const pregunta =
      '¿Qué es una función cuadrática y cómo se identifican sus coeficientes en una ecuación de segundo grado?';
    wb.missions[0].formativeCheckpoint = {
      question: pregunta, reflectionPrompts: [],
      criteriaChecklist: ['Identifica los coeficientes', 'Grafica la parábola'],
    };
    const info = buildInfographic(wb, 0)!;
    const footerTexts = parseTexts(info.svg).filter((t) => t.fontSize === 23 && t.y >= 1398);
    const preguntaLines = footerTexts.filter((t) => t.x === 60);
    expect(preguntaLines).toHaveLength(2);
    expect(preguntaLines.some((t) => t.content.includes('…'))).toBe(false);
    expect(preguntaLines.map((t) => t.content).join(' ')).toContain('coeficientes');
  });

  it('los ítems del footer no invaden la línea de meta (plantel · PAEC)', () => {
    const info = buildInfographic(workbook('Pensamiento Matemático I'), 0)!;
    const texts = parseTexts(info.svg);
    const items = texts.filter((t) => t.fontSize === 23);
    const meta = texts.find((t) => t.fontSize === 18 && t.y > 1500)!;
    expect(meta).toBeDefined();
    expect(meta.y).toBe(INFOGRAPHIC_HEIGHT - 20);
    const lastItemBottom = Math.max(...items.map((t) => t.y + t.fontSize * 0.3));
    expect(lastItemBottom).toBeLessThan(meta.y - meta.fontSize * 0.75);
  });
});

describe('H-321 — exportación', () => {
  it('PNG Carta a 300 DPI', async () => {
    const info = buildInfographic(workbook('Física'), 0)!;
    const png = await infographicToPng(info);
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(LETTER_300DPI_WIDTH);
  }, 30000);

  it('PDF de una sola página', async () => {
    const info = buildInfographic(workbook('Historia de México'), 0)!;
    const pdf = await infographicToPdf(info);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBe(1);
  }, 30000);
});

describe('H-321 — endpoint /infografia', () => {
  const planningId = '11111111-1111-1111-1111-111111111111';
  const call = (qs: string) =>
    GET(new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/infografia${qs}`), {
      params: Promise.resolve({ id: planningId }),
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 't@x.mx' } });
    mockIsAdmin.mockResolvedValue(false);
    mockPlanRows = [{ id: planningId, teacher_id: 't1', uac_name: 'x', component: null }];
    mockGetTeacherByEmail.mockResolvedValue({ id: 't1', role: 'docente' });
    mockGetBlockWorkbook.mockResolvedValue(workbook('Física'));
  });

  it('401 / 400 / 404 / 403', async () => {
    mockAuth.mockResolvedValueOnce(null);
    expect((await call('')).status).toBe(401);
    expect((await call('?format=gif')).status).toBe(400);
    expect((await call('?missionIndex=-2')).status).toBe(400);
    mockPlanRows = [];
    expect((await call('')).status).toBe(404);
    mockPlanRows = [{ id: planningId, teacher_id: 'otro', uac_name: 'x', component: null }];
    expect((await call('')).status).toBe(403);
  });

  it('json lista las misiones; svg/png/pdf devuelven el tipo correcto', async () => {
    const list = await (await call('?format=json')).json();
    expect(list.missions).toHaveLength(2);

    const svg = await call('?missionIndex=1&format=svg');
    expect(svg.headers.get('Content-Type')).toContain('image/svg+xml');

    const png = await call('?missionIndex=0&format=png');
    expect(png.headers.get('Content-Type')).toBe('image/png');
    expect(png.headers.get('Content-Disposition')).toContain('.png');

    const pdf = await call('?missionIndex=0&format=pdf');
    expect(pdf.headers.get('Content-Type')).toBe('application/pdf');
  }, 30000);

  it('404 si la misión no existe o no hay libro', async () => {
    expect((await call('?missionIndex=7&format=svg')).status).toBe(404);
    mockGetBlockWorkbook.mockResolvedValue(null);
    expect((await call('?format=json')).status).toBe(404);
  });

  it('sanitiza etiquetas de cuaderno en infografías de proceso y conceptual (F-04)', () => {
    const wb = workbook('Pensamiento Matemático I');
    wb.missions[0].conceptZero.solvedExample = { problemStatement: 'p', solutionSteps: [], interpretation: 'i' };
    wb.missions[0].iDoSection = { stepByStepDemo: 'Paso modelado docente. <!--workbook:lines:rows=4-->' };
    wb.missions[0].conceptZero.coreExplanation = 'Explicación del núcleo. <!--workbook:table:cols=2-->';
    const infoProceso = buildInfographic(wb, 0)!;
    expect(infoProceso.svg).not.toContain('<!--workbook:');
    expect(infoProceso.svg).not.toContain('<!--');

    const wbHum = workbook('Historia de México');
    wbHum.missions[0].conceptZero.coreExplanation = 'Concepto histórico central. <!--workbook:code_box-->';
    const infoConcept = buildInfographic(wbHum, 0)!;
    expect(infoConcept.svg).not.toContain('<!--workbook:');
    expect(infoConcept.svg).not.toContain('<!--');
  });
});
