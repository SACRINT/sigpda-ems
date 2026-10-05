import { describe, it, expect } from 'vitest';
import { generatePaecDocx } from '@/lib/paec-docx-generator';
import { generatePaecPDF } from '@/lib/paec-pdf-generator';
import type { PaecProject, PaecGobernanza, PaecInformeSupervision } from '@/types/paec';

interface PDFParseInstance {
  getText(): Promise<{ text: string }>;
}
type PDFParseConstructor = new (opts: { data: Buffer }) => PDFParseInstance;

describe('F-R7-02 & F-R7-03 / F-R8-01: Paridad NEM y Discriminación Estricta de 0% en Metas', () => {
  // Fixture sin preguntasGuiaNem explícitas (simula datos vacíos / legacy sin preguntasGuiaNem):
  // Debe usar fallbacks canónicos de 3 preguntas y NO la rama legada de 5 preguntas
  const baseGobernanzaDefault: PaecGobernanza = {
    calendario: [
      { tipo: 'Reunión Mensual', frecuencia: 'Mensual', participantes: 'Docentes', objetivo: 'Seguimiento', evidencia: 'Minuta' }
    ],
    metodologiaEvaluacion: {
      ambitos: ['Aula', 'Escuela', 'Comunidad'],
      preguntasGuiaNem: {
        dondeEstamos: '',
        haciaDondeVamos: '',
        comoSuperamos: '',
      }
    }
  };

  // Fixture donde alcanzado es '—' (sin subcadena '0%'), obligando a que '0%' provenga de la columna de porcentaje
  const baseInformeCeroPorciento: PaecInformeSupervision = {
    resumenEjecutivo: 'Resumen ejecutivo de prueba para metas',
    metasVsLogros: [
      {
        meta: 'Meta con avance cero por causas ajenas',
        indicador: 'Avance registrado al corte',
        programado: 'Sin retraso',
        alcanzado: '—', // CRÍTICO: '—' no contiene '0%'
        porcentaje: 0,  // CRÍTICO: 0% real, en c20f42c evaluaba erróneamente a 100%
        estatus: 'En Proceso'
      }
    ],
    analisisPrePost: {
      participacionTotal: 'Familias activas del plantel',
      alcanceComunitario: 'Zona del cauce comunal',
      cambioConocimientos: 'Monitoreo de turbidez inicial',
      desarrolloCompetencias: 'Pensamiento reflexivo y colaborativo'
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
      demographics: 'Población escolar comunitaria',
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
    fase4Gobernanza: baseGobernanzaDefault,
    fase4InformeSupervision: baseInformeCeroPorciento,
    qualityAudit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('debe generar el documento DOCX discriminando 0% real y asegurando las 3 preguntas NEM canónicas', async () => {
    const docxBuffer = await generatePaecDocx(baseProject, 'Profesor Test');
    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.byteLength).toBeGreaterThan(1000);

    const mammoth = await import('mammoth');
    const { value: text } = await mammoth.extractRawText({ buffer: docxBuffer });

    // F-R8-01: Regex de celda % para la meta — debe ser 0% y NO 100%
    expect(text).toMatch(/Meta con avance cero por causas ajenas[\s\S]*?0%[\s\S]*?En Proceso/i);
    expect(text).not.toMatch(/Meta con avance cero por causas ajenas[\s\S]*?100%[\s\S]*?En Proceso/i);

    // Preguntas canónicas de NEM
    expect(text).toContain('¿Dónde estamos?');
    expect(text).toContain('¿Hacia dónde vamos?');
    expect(text).toContain('¿Cómo superamos dificultades?');

    // No debe contener preguntas de la rama legada de 5 preguntas
    expect(text).not.toContain('¿Qué transformamos en la comunidad?');
    expect(text).not.toContain('¿Cómo aprendieron los estudiantes?');
  });

  it('debe generar el documento PDF con paridad idéntica: 0% real y sin rama legada de 5 preguntas', async () => {
    const pdfBuffer = await generatePaecPDF(baseProject, 'Profesor Test');
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.byteLength).toBeGreaterThan(1000);

    const { PDFParse } = await import('pdf-parse');
    const PDFParser = PDFParse as unknown as PDFParseConstructor;
    const parser = new PDFParser({ data: pdfBuffer });
    const { text } = await parser.getText();

    // F-R8-01: Regex de celda % para M-1 — debe ser 0% y NO 100%
    expect(text).toMatch(/M-1[\s\S]*?0%[\s\S]*?EN PROCESO/i);
    expect(text).not.toMatch(/M-1[\s\S]*?100%[\s\S]*?EN PROCESO/i);

    // Preguntas canónicas de NEM
    expect(text).toContain('¿Dónde estamos?');
    expect(text).toContain('¿Hacia dónde vamos?');
    expect(text).toContain('¿Cómo superamos dificultades?');

    // En c20f42c, sin dondeEstamos el PDF emitía la rama legada de 5 preguntas:
    expect(text).not.toContain('¿Qué transformamos en la comunidad?');
    expect(text).not.toContain('¿Cómo aprendieron los estudiantes?');
    expect(text).not.toContain('¿Qué compromisos de continuidad asumimos?');
  });
});
