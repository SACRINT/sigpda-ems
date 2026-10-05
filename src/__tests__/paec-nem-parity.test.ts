import { describe, it, expect } from 'vitest';
import { generatePaecDocx } from '@/lib/paec-docx-generator';
import { generatePaecPDF } from '@/lib/paec-pdf-generator';
import type { PaecProject, PaecGobernanza, PaecInformeSupervision } from '@/types/paec';

interface PDFParseInstance {
  getText(): Promise<{ text: string }>;
}
type PDFParseConstructor = new (opts: { data: Buffer }) => PDFParseInstance;

describe('F-R7-02 & F-R7-03: Paridad NEM y Preservación de 0% en Metas', () => {
  const baseGobernanza: PaecGobernanza = {
    calendario: [
      { tipo: 'Reunión Mensual', frecuencia: 'Mensual', participantes: 'Docentes', objetivo: 'Seguimiento', evidencia: 'Minuta' }
    ],
    metodologiaEvaluacion: {
      ambitos: ['Aula', 'Escuela', 'Comunidad'],
      preguntasGuiaNem: {
        dondeEstamos: 'Diagnóstico situado real de la comunidad',
        haciaDondeVamos: 'Hacia la sustentabilidad comunitaria',
        comoSuperamos: 'Mediante faenas y biofiltros'
      }
    }
  };

  const baseInforme: PaecInformeSupervision = {
    resumenEjecutivo: 'Resumen ejecutivo de prueba',
    metasVsLogros: [
      {
        meta: 'Meta que comenzó en 0% por causas ajenas',
        indicador: 'Avance registrado',
        programado: '100%',
        alcanzado: '0%',
        porcentaje: 0, // CRÍTICO: 0% real, no debe volverse 100%
        estatus: 'En Proceso'
      }
    ],
    analisisPrePost: {
      participacionTotal: '180 familias activas',
      alcanceComunitario: '2 km del cauce',
      cambioConocimientos: '42% reducción turbidez',
      desarrolloCompetencias: 'STEAM y pensamiento crítico'
    },
    evidencias: [],
    obstaculos: [],
    sostenibilidad: []
  };

  const baseProject: PaecProject = {
    id: 'test-project-nem-parity',
    teacherId: 'teacher-test-01',
    projectName: 'Proyecto Prueba Paridad NEM',
    problemStatement: 'Problemática de prueba para validación de paridad',
    cycleType: 'annual',
    currentStep: 9,
    status: 'completed',
    schoolContext: {
      schoolName: 'Bachillerato Moisés Sáenz Garza',
      cct: '21EBH0465E',
      schoolZone: '004',
      municipality: 'Francisco Z. Mena',
      locality: 'El Tecomate',
      enrollment: '74',
      teacherCount: '5',
    },
    communityContext: {
      demographics: '180 familias',
    },
    fase1Diagnostico: null,
    fase2Justificacion: null,
    fase2Mapeo: [],
    fase2Cronograma: [],
    fase2DetalleCurricular: [],
    fase2PlanOperativo: null,
    fase2Anexos: null,
    fase3PlanOperativoA: [],
    fase3PlanOperativoB: [],
    fase3Implementacion: null,
    fase4Gobernanza: baseGobernanza,
    fase4InformeSupervision: baseInforme,
    qualityAudit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('debe generar el documento DOCX preservando el porcentaje 0% y preguntas NEM', async () => {
    const docxBuffer = await generatePaecDocx(baseProject, 'Profesor Test');
    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.byteLength).toBeGreaterThan(1000);

    const mammoth = await import('mammoth');
    const { value: text } = await mammoth.extractRawText({ buffer: docxBuffer });
    expect(text).toContain('0%');
    expect(text).toContain('¿Dónde estamos?');
    expect(text).toContain('¿Hacia dónde vamos?');
    expect(text).toContain('¿Cómo superamos dificultades?');
  });

  it('debe generar el documento PDF con paridad en preguntas NEM y porcentaje 0%', async () => {
    const pdfBuffer = await generatePaecPDF(baseProject, 'Profesor Test');
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.byteLength).toBeGreaterThan(1000);

    const { PDFParse } = await import('pdf-parse');
    const PDFParser = PDFParse as unknown as PDFParseConstructor;
    const parser = new PDFParser({ data: pdfBuffer });
    const { text } = await parser.getText();
    expect(text).toContain('0%');
    expect(text).toContain('¿Dónde estamos?');
    expect(text).toContain('¿Hacia dónde vamos?');
    expect(text).toContain('¿Cómo superamos dificultades?');
  });
});
