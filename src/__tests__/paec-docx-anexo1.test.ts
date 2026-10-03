// src/__tests__/paec-docx-anexo1.test.ts
/**
 * Test suite para H-312: Cédula Diagnóstica en Anexo 1 DOCX y PDF (Cero Hardcode)
 * Verifica que ni el DOCX ni el PDF generen datos fabricados ("150 hogares", "1er y 3er semestre")
 * y que Anexo 1 se pueble dinámicamente desde fase1_diagnostico y el contexto institucional.
 */

import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import { generatePaecDocx } from '@/lib/paec-docx-generator';
import { generatePaecPDF } from '@/lib/paec-pdf-generator';
import type { PaecProject, AnexosData } from '@/types/paec';

function makeBaseFixture(overrides: Partial<PaecProject> = {}): PaecProject {
  return {
    id: 'paec-anexo1-test-001',
    projectName: 'Conservación de Humedales y Manejo de Residuos en el Territorio',
    problemStatement: 'Acumulación de residuos sólidos urbanos en los canales de desagüe pluvial.',
    cycleType: 'annual',
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
    schoolContext: {
      schoolName: 'Bachillerato General Héroes de la Patria',
      cct: '21EBH0244Z',
      schoolZone: '004',
      municipality: 'Venustiano Carranza',
      locality: 'Coronel Tito Hernández',
      enrollment: '320',
      teacherCount: '18',
      schoolType: 'general',
    },
    communityContext: {
      location: 'Coronel Tito Hernández, Venustiano Carranza, Puebla',
      demographics: 'Comunidad semi-urbana dedicada al comercio y servicios.',
      economy: 'Comercio local y pequeña ganadería.',
      traditions: 'Fiesta patronal y faenas de limpieza.',
      environment: 'Clima cálido subhúmedo con arroyos estacionales.',
    },
    teacherId: 'teacher-test-anexo1',
    currentStep: 9,
    fase1Diagnostico: {
      tabla1: [
        { col1: 'Geografía y Clima', col2: 'Ubicación en ladera con pendientes pronunciadas y riesgo de deslaves.' },
        { col1: 'Servicios Básicos', col2: 'Red de agua entubada con tandeo terciado y recolección municipal semanal.' },
      ],
      tabla2: [
        { col1: 'Indicadores Escolares', col2: 'Eficiencia terminal del 88% y abandono del 7.2%.' },
      ],
      tabla3: [
        { aspect: 'Fortalezas', analysis: 'Docentes proactivos con formación en NEM.' },
        { aspect: 'Oportunidades', analysis: 'Alianza con el comité de salud comunitaria.' },
        { aspect: 'Debilidades', analysis: 'Falta de contenedores diferenciados en el plantel.' },
        { aspect: 'Amenazas', analysis: 'Lluvias torrenciales atípicas.' },
      ],
      tabla4: [
        { col1: 'Fase de Consulta', col2: 'Reunión con delegados comunales.' },
      ],
    },
    fase2Justificacion: {
      projectName: 'Conservación de Humedales y Manejo de Residuos en el Territorio',
      introduction: 'Justificación pedagógica y social del proyecto comunitario.',
      pilares: ['Cuidado del medio ambiente', 'Responsabilidad ciudadana'],
      proposito: {
        educativo: 'Promover la educación ambiental práctica.',
        social: 'Reducir los tiraderos clandestinos en el arroyo.',
        funcional: 'Instalar puntos limpios de reciclaje.',
      },
      alcance: {
        metas: ['Limpiar 500 metros lineales de arroyo'],
        participantes: ['320 alumnos', '18 docentes', 'Vecinos del sector norte'],
        recursos: ['Herramientas manuales', 'Costales', 'Camión recolector'],
      },
    },
    fase2Mapeo: [],
    fase2Cronograma: [],
    fase2DetalleCurricular: null,
    fase2PlanOperativo: null,
    fase2Anexos: null,
    fase3PlanOperativoA: null,
    fase3PlanOperativoB: null,
    fase3Implementacion: null,
    fase4Gobernanza: null,
    fase4InformeSupervision: null,
    qualityAudit: null,
    ...overrides,
  };
}

describe('H-312: Cédula Diagnóstica Anexo 1 DOCX y PDF (Cero Fabricación de Datos)', () => {
  it('1. Genera DOCX sin datos ficticios ("150 hogares" y "1er y 3er semestre" ausentes al 100%)', async () => {
    const fixture = makeBaseFixture();
    const buffer = await generatePaecDocx(fixture);

    const { value: text } = await mammoth.extractRawText({ buffer });

    // Verificaciones normativas de ausencia de datos inventados
    expect(text).not.toContain('150 hogares');
    expect(text).not.toContain('1er y 3er semestre');

    // Verificaciones de contenido auténtico institucional
    expect(text).toContain('ANEXO 1: FORMATO DE RECOLECCIÓN DE DATOS Y DIAGNÓSTICO EN CAMPO');
    expect(text).toContain('Universo de Muestreo:');
    expect(text).toContain('Población escolar del plantel (320 estudiantes)');
    expect(text).toContain('Geografía y Clima: Ubicación en ladera con pendientes pronunciadas');
  });

  it('2. Refleja dinámicamente dimensiones desde fase1_diagnostico.tabla1 en DOCX', async () => {
    const customFixture = makeBaseFixture({
      fase1Diagnostico: {
        tabla1: [
          { col1: 'Flora Nativa', col2: 'Vegetación de selva mediana subcaducifolia.' },
          { col1: 'Seguridad Social', col2: 'Centro de salud rural con atención de primer nivel.' },
        ],
        tabla2: [],
        tabla3: [],
        tabla4: [],
      },
    });

    const buffer = await generatePaecDocx(customFixture, 'Profra. María Elena Garza');
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).not.toContain('150 hogares');
    expect(text).not.toContain('1er y 3er semestre');
    expect(text).toContain('Flora Nativa: Vegetación de selva mediana subcaducifolia.');
    expect(text).toContain('Seguridad Social: Centro de salud rural con atención de primer nivel.');
    expect(text).toContain('Profra. María Elena Garza y colectivo docente responsable');
  });

  it('3. Si fase2Anexos incluye anexo1 con datos capturados por el usuario, los respeta fielmente', async () => {
    const customAnexoFixture = makeBaseFixture({
      fase2Anexos: {
        anexo1: {
          objetivo: 'Levantamiento específico de focos rojos de basura en Calle Morelos.',
          metodologia: 'Censo puerta por puerta con cuestionario digital en KoboToolbox.',
          universo: '85 predios habitacionales colindantes con el canal principal.',
          dimensiones: [
            'Frecuencia de desazolve del canal.',
            'Volumen semanal de plásticos arrojados.',
          ],
          responsables: 'Comité Estudiantil de Ecología del Grupo 3-B.',
          validacion: 'Firma de conformidad del Juez de Paz y directiva escolar.',
        },
      } as unknown as AnexosData,
    });

    const buffer = await generatePaecDocx(customAnexoFixture);
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).not.toContain('150 hogares');
    expect(text).not.toContain('1er y 3er semestre');
    expect(text).toContain('Levantamiento específico de focos rojos de basura en Calle Morelos.');
    expect(text).toContain('85 predios habitacionales colindantes con el canal principal.');
    expect(text).toContain('Comité Estudiantil de Ecología del Grupo 3-B.');
  });

  it('4. Genera PDF sin datos ficticios ("150 hogares" y "1er y 3er semestre" ausentes al 100%)', async () => {
    const fixture = makeBaseFixture();
    const pdfBuffer = await generatePaecPDF(fixture, 'Docente Coordinador');

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(5000);

    const pdfString = pdfBuffer.toString('latin1');
    expect(pdfString).not.toContain('150 hogares');
    expect(pdfString).not.toContain('1er y 3er semestre');
    expect(pdfString).toContain('ANEXO 1');
  });
});
