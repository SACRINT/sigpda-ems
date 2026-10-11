import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

export async function renderMockDocx(
  missionOverrides: Record<string, unknown> = {}
): Promise<string> {
  const mockWorkbook = {
    coverData: {
      title: 'Cuaderno de Trabajo Integral',
      subtitle: 'Bachillerato General',
      subjectName: 'Pensamiento Matemático III',
      schoolName: 'Plantel CCT-01',
      semester: 3,
      blockNumber: 1,
      teacherName: 'Profesor Titular',
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Misión 1: Leyes de Modelado',
        coveredSessions: [1, 2],
        sessionTopic: 'Variables y modelos',
        sessionFocus: 'Ecuaciones y métodos',
        phenomenonHook: {
          story: 'Un contexto real en Puebla.',
          detonatingQuestion: '¿Cómo modelar el fenómeno?',
        },
        conceptZero: {
          physicalAnalogy: 'Como engranajes coordinados en un molino artesanal.',
          coreExplanation: 'Sistemas de relaciones matemáticas lineales.',
        },
        iDoSection: { stepByStepDemo: 'Demostración paso a paso del docente.' },
        weDoSection: { guidedPractice: '1. Tarea de práctica colaborativa en equipo.', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto autónomo para el alumno.', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué aprendiste hoy?',
          reflectionPrompts: ['Explica tus pasos.'],
          criteriaChecklist: ['Criterio 1.'],
        },
        wordCount: 400,
        ...missionOverrides,
      },
    ],
    projectSection: undefined,
    evaluationSection: undefined,
  } as unknown as ActiveWorkTextbook;

  const mockPlanning = {
    id: 'plan-test-lote-c',
    title: 'Pensamiento Matemático III',
    subject: 'Pensamiento Matemático III',
    subsystem: 'bge',
    semester: 'Tercero',
    targetGrade: 2,
    school: 'Plantel CCT-01',
    schoolId: 'cct-01',
    teacherId: 'prof-01',
    unitOrBlock: 'Bloque I',
  } as unknown as Planning;

  const docxBuffer = await renderWorkbookToDocx(mockWorkbook, mockPlanning, { coverBuffer: undefined });
  const zip = await JSZip.loadAsync(docxBuffer);
  return (await zip.file('word/document.xml')?.async('text')) || '';
}

describe('Lote C — Calidad visual DOCX', () => {
  it('H-2: los párrafos de cuerpo usan 8pt de separación (w:after=160) con interlineado 1.5 (w:line=360)', async () => {
    const xml = await renderMockDocx();
    expect(xml).toMatch(/w:after="160"[^>]*w:line="360"|w:line="360"[^>]*w:after="160"/);
    // Aire de 10pt antes de encabezados/tareas (w:before=200)
    expect(xml).toContain('w:before="200"');
  });

  it('H-3: los encabezados de sección usan fondo temático sólido, texto blanco y badge contrastante', async () => {
    const xml = await renderMockDocx();
    // Fondos temáticos de los ribbons (SECTION_HEX: concepto, yoHago, tuHaces, checkpoint)
    expect(xml).toContain('w:fill="1F3864"');
    expect(xml).toContain('w:fill="2563EB"');
    // Texto blanco sobre el ribbon y badge con fondo blanco
    expect(xml).toContain('w:color w:val="FFFFFF"');
    expect(xml).toContain('w:fill="FFFFFF"');
    // Título en mayúsculas dentro del ribbon
    expect(xml).toContain('2. CONCEPTO CERO');
  });

  it('H-4: los widgets del sidebar tienen fondo de color visible y cinta lateral de 6pt en color accent', async () => {
    const xml = await renderMockDocx();
    // Fondos del PDF: amarillo / azul claro / gris azulado (shading clear + fill, color auto)
    expect(xml).toMatch(/w:val="clear"[^>]*w:fill="FEF3C7"|w:fill="FEF3C7"[^>]*w:val="clear"/);
    expect(xml).toContain('w:fill="E0F2FE"');
    expect(xml).toContain('w:fill="F1F5F9"');
    // Cinta lateral gruesa (48 octavos de punto = 6pt) con color accent
    expect(xml).toMatch(/<w:left [^>]*w:sz="48"[^>]*w:color="B45309"|<w:left [^>]*w:color="B45309"[^>]*w:sz="48"/);
    expect(xml).toMatch(/<w:left [^>]*w:sz="48"[^>]*w:color="0369A1"|<w:left [^>]*w:color="0369A1"[^>]*w:sz="48"/);
  });

  it('H-5: las tarjetas de conceptos tienen badge de color, icono emoji, fondo suave y borde accent', async () => {
    const xml = await renderMockDocx({
      formativeCheckpoint: {
        question: '¿Qué aprendiste hoy?',
        reflectionPrompts: ['Explica tus pasos.'],
        criteriaChecklist: ['Aplica el modelo lineal a una situación comunitaria real.'],
      },
    });
    // Badges de color (fondo + texto)
    expect(xml).toContain('w:fill="FED7AA"'); // ANALOGÍA
    expect(xml).toContain('w:color w:val="9A3412"');
    expect(xml).toContain('w:fill="BFDBFE"'); // CONCEPTO
    expect(xml).toContain('w:color w:val="1E40AF"');
    expect(xml).toContain('w:fill="BBF7D0"'); // APLICACIÓN
    expect(xml).toContain('w:color w:val="166534"');
    // Iconos emoji en el badge
    expect(xml).toContain('🔍');
    expect(xml).toContain('📐');
    expect(xml).toContain('✅');
    // Fondo suave de la tarjeta
    expect(xml).toContain('w:fill="F8FAFC"');
  });

  it('H-6: con más de 400 palabras el bloque usa ancho completo (sin tabla 70/30) y con texto corto conserva 2 columnas', async () => {
    const longText = Array.from({ length: 520 }, (_, i) => `palabra${i}`).join(' ');
    const wideXml = await renderMockDocx({
      phenomenonHook: { story: longText, detonatingQuestion: '¿Cómo modelar el fenómeno?' },
      iDoSection: { stepByStepDemo: longText },
      youDoSection: { autonomousChallenge: longText, workbookElements: [] },
    });
    expect(wideXml).not.toContain('w:w="7100"');
    expect(wideXml).not.toContain('w:w="3140"');
    // Los widgets del sidebar siguen presentes, ahora como cajas inline
    expect(wideXml).toContain('IDEA FUERZA');
    expect(wideXml).toContain('ESTUDIO ACTIVO');

    const narrowXml = await renderMockDocx();
    expect(narrowXml).toContain('w:w="7100"');
    expect(narrowXml).toContain('w:w="3140"');
  });
});
