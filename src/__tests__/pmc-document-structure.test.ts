// src/__tests__/pmc-document-structure.test.ts
import { describe, it, expect, vi } from 'vitest';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import {
  PMC_TITULOS_SECCIONES,
  PMC_SUBSECCIONES_DIAGNOSTICO,
  PMC_SECCIONES_CANONICAS,
  clasificarNormativaJerarquica,
  getObjetivoPmcText,
} from '@/lib/pmc-document-structure';
import { generatePmcDocx } from '@/lib/pmc-docx-generator';
import { generatePmcPDF } from '@/lib/pmc-pdf-generator';
import type { PmcProject } from '@/types/pmc';

// Mock de logos para jsPDF
vi.mock('@/lib/pdf-logos', () => ({
  loadAllLogos: vi.fn().mockResolvedValue({
    pueblaLogo: null,
    sepLogo: null,
  }),
}));

function makeMockPmcProject(): PmcProject {
  return {
    id: 'pmc-ssot-test-001',
    school_name: 'Bachillerato General Oficial Moisés Sáenz Garza',
    school_cct: '21EBH0465E',
    municipality: 'Francisco Z. Mena',
    locality: 'El Tecomate',
    school_zone: '004',
    director_name: 'Prof. Juan Rogelio García Escudero',
    supervisor_name: 'Mtra. María Elena Morales',
    ciclo_escolar: '2026-2027',
    subsystem: 'BGE',
    total_staff: 6,
    diagnostico_generado: {
      presentacion: 'Presentación oficial de planeación estratégica para el ciclo escolar 2026-2027.',
      contexto: 'Contexto socioeducativo y territorial en la comunidad de El Tecomate con retos situados de transporte.',
      analisis_indicadores: 'Análisis diagnóstico de abandono escolar al 3% y retención continua.',
      sintesis_foda: 'Síntesis FODA que destaca fortalezas en procesos colegiados y mitigación de debilidades.',
      priorizacion: 'Priorización en tres categorías de la política CREAA: Apropiación Curricular, Permanencia y Gestión Comunitaria.',
    },
    indicadores_academicos: {
      matricula: 75,
      matricula_meta: 80,
      aprobacion_ant: 95.0,
      aprobacion_meta: 98.0,
      reprobacion_ant: 5.0,
      reprobacion_meta: 2.0,
      abandono_ant: 4.5,
      abandono_meta: 2.5,
      et_ant: 92.0,
      et_meta: 96.0,
    },
    foda: {
      fortalezas: 'Procesos de inscripción ordenados y plantilla docente completa.',
      oportunidades: 'Promoción activa en Telesecundarias de comunidades vecinas.',
      debilidades: 'Bajo nivel de aprovechamiento en matemáticas al ingreso.',
      amenazas: 'Dispersión geográfica y ausencia de transporte público.',
    },
    categorias_priorizadas: [
      { id: '1', nombre: 'Categoría 1: Desarrollo académico y aprendizaje', temas: ['Recursos sociocognitivos'] },
      { id: '2', nombre: 'Categoría 2: Gestión y administración escolar', temas: ['Infraestructura y equipamiento'] },
    ],
    plan_accion: {
      metas_institucionales: [
        {
          categoria: '1',
          nombre_categoria: 'Desarrollo Académico',
          tema: 'Pensamiento Matemático',
          meta: 'Alcanzar el 98% de aprobación en Pensamiento Matemático I y II.',
          estrategia: 'Implementación de talleres remediales situados semanales.',
          linea_base: '95% de aprobación en el ciclo 2025-2026.',
          personal_designado: 'Academia de Matemáticas',
          entregable: 'Registro de calificaciones y portafolios de evidencias.',
          periodo_inicio: 'Agosto 2026',
          periodo_fin: 'Julio 2027',
          diagnostico_meta: 'Atención focalizada a rezago detectado en examen diagnóstico.',
        },
      ],
      metas_personales: [
        {
          nombre: 'Prof. Juan Rogelio García Escudero',
          cargo: 'Director(a)',
          meta_individual: 'Supervisar el 100% de las reuniones de Consejo Técnico Escolar.',
          estrategia: 'Calendario de seguimiento directivo.',
          entregable: 'Actas de CTE firmadas.',
          periodo: 'Ciclo Escolar 2026-2027',
        },
        {
          nombre: 'Prof. Pedro López Juárez',
          cargo: 'Docente de Matemáticas',
          categoria: 'Desarrollo Académico',
          tema: 'Recursos sociocognitivos',
          meta_individual: 'Implementar 3 proyectos formativos situados en aula.',
          estrategia: 'Planeación didáctica transversal.',
          entregable: 'Rúbricas de evaluación formativa.',
          periodo: 'agosto 2026 - junio 2027',
        },
      ],
    },
    staff_data: [
      { nombre: 'Prof. Juan Rogelio García Escudero', cargo: 'Director(a)' },
      { nombre: 'Prof. Pedro López Juárez', cargo: 'Docente de Matemáticas', horas_base: 30 },
    ],
    normativa: {
      titulo: 'Marco Normativo Institucional',
      descripcion: 'Sustento jurídico de la Educación Media Superior en el Estado de Puebla.',
      documentos: [
        {
          orden: 1,
          titulo: 'Constitución Política de los Estados Unidos Mexicanos (Art. 3°)',
          articulos: ['Garantiza el derecho a la educación de excelencia e integral.'],
        },
        {
          orden: 2,
          titulo: 'Acuerdo Secretarial 09/08/23 (MCCEMS)',
          articulos: ['Establece el Marco Curricular Común de la EMS.'],
        },
      ],
    },
  };
}

describe('H-100 / H-101: SSoT Estructura Documental y Paridad PDF vs DOCX', () => {
  it('1. El SSoT define exactamente 8 secciones canónicas numeradas y en orden consecutivo', () => {
    expect(PMC_SECCIONES_CANONICAS).toHaveLength(8);
    const titulosEsperados = [
      '1. PRESENTACIÓN',
      '2. OBJETIVO DEL PMC',
      '3. NORMATIVIDAD APLICABLE',
      '4. DIAGNÓSTICO',
      '5. PRIORIZACIÓN DE CATEGORÍAS',
      '6. PLAN DE ACCIÓN',
      '7. METAS INDIVIDUALES DEL PERSONAL',
      '8. PARTICIPANTES, CONTROL DE REVISIONES Y APROBACIÓN',
    ];

    PMC_SECCIONES_CANONICAS.forEach((sec, idx) => {
      expect(sec.numero).toBe(idx + 1);
      expect(sec.titulo).toBe(titulosEsperados[idx]);
    });
  });

  it('1b. SSoT: subsecciones de Diagnóstico en PMC_SECCIONES_CANONICAS coinciden 100% con PMC_SUBSECCIONES_DIAGNOSTICO (H-109)', () => {
    const diag = PMC_SECCIONES_CANONICAS.find((s) => s.id === 'diagnostico')!;
    expect(diag).toBeDefined();
    expect(diag.subsecciones).toBeDefined();
    expect(diag.subsecciones!.map((x) => `${x.numero} ${x.titulo}`)).toEqual([
      PMC_SUBSECCIONES_DIAGNOSTICO.CONTEXTO,
      PMC_SUBSECCIONES_DIAGNOSTICO.INDICADORES,
      PMC_SUBSECCIONES_DIAGNOSTICO.INFRAESTRUCTURA,
      PMC_SUBSECCIONES_DIAGNOSTICO.BENEFICIOS,
      PMC_SUBSECCIONES_DIAGNOSTICO.FODA,
    ]);
  });

  it('2. clasificarNormativaJerarquica agrupa correctamente en Leyes y Reglamentos/Acuerdos', () => {
    const mockDocs = [
      { orden: 1, titulo: 'Ley General de Educación', articulos: ['Art. 107'] },
      { orden: 2, titulo: 'Acuerdo 09/08/23 MCCEMS', articulos: ['Art. 1'] },
      { orden: 3, titulo: 'Lineamientos Oficiales DBEPA', articulos: ['Disposición 4'] },
    ];

    const grupos = clasificarNormativaJerarquica(mockDocs);
    expect(grupos).toHaveLength(3);
    expect(grupos[0].clave).toBe('A');
    expect(grupos[0].categoria).toContain('LEYES');
    expect(grupos[0].documentos[0].orden).toBe(1);
    expect(grupos[0].documentos[0].justificacion).toBeDefined();
    expect(grupos[0].documentos[0].justificacion!.length).toBeGreaterThan(20);

    expect(grupos[1].clave).toBe('B');
    expect(grupos[1].categoria).toContain('REGLAMENTOS');
    expect(grupos[1].documentos[0].orden).toBe(1); // Renumerado a 1 sin hueco (H-121c)
    expect(grupos[1].documentos[0].justificacion).toContain('MCCEMS');

    expect(grupos[2].clave).toBe('C');
    expect(grupos[2].categoria).toContain('LINEAMIENTOS');
    expect(grupos[2].documentos[0].orden).toBe(1); // Renumerado a 1 sin hueco (H-121c)
    expect(grupos[2].documentos[0].justificacion).toBeDefined();

    const objText = getObjetivoPmcText('Plantel Test', '2026-2027');
    expect(objText).toContain('2026-2027');
    expect(objText).toContain('Plantel Test');
  });

  it('3. Ambos generadores (DOCX y PDF) emiten las 8 secciones canónicas en orden y con títulos 100% idénticos', async () => {
    const project = makeMockPmcProject();

    // Generar DOCX
    const docxBuffer = await generatePmcDocx(project as unknown as Parameters<typeof generatePmcDocx>[0]);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    // Generar PDF
    const pdfBuffer = await generatePmcPDF(project as unknown as Parameters<typeof generatePmcPDF>[0]);
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsedPdf = await parser.getText();
    await parser.destroy();
    const pdfText = parsedPdf.text;

    // Verificar Índice General en ambos
    expect(docxText).toContain('ÍNDICE GENERAL');
    expect(pdfText).toContain('ÍNDICE GENERAL');
    expect(pdfText).toContain('Pág.');

    // Lista de las 8 secciones canónicas desde el SSoT
    const secciones = [
      PMC_TITULOS_SECCIONES.PRESENTACION,
      PMC_TITULOS_SECCIONES.OBJETIVO,
      PMC_TITULOS_SECCIONES.NORMATIVIDAD,
      PMC_TITULOS_SECCIONES.DIAGNOSTICO,
      PMC_TITULOS_SECCIONES.PRIORIZACION,
      PMC_TITULOS_SECCIONES.PLAN_ACCION,
      PMC_TITULOS_SECCIONES.METAS_INDIVIDUALES,
      PMC_TITULOS_SECCIONES.PARTICIPANTES_CONTROL,
    ];

    let lastDocxPos = -1;
    let lastPdfPos = -1;

    for (const titulo of secciones) {
      // (a) Verificar que DOCX contiene el título canónico
      const docxPos = docxText.indexOf(titulo);
      expect(docxPos, `DOCX debe contener el título canónico "${titulo}"`).toBeGreaterThan(-1);
      expect(docxPos, `En DOCX, "${titulo}" debe estar después de la sección anterior`).toBeGreaterThan(lastDocxPos);
      lastDocxPos = docxPos;

      // (b) Verificar que PDF contiene el título canónico
      const pdfPos = pdfText.indexOf(titulo);
      expect(pdfPos, `PDF debe contener el título canónico "${titulo}"`).toBeGreaterThan(-1);
      expect(pdfPos, `En PDF, "${titulo}" debe estar después de la sección anterior`).toBeGreaterThan(lastPdfPos);
      lastPdfPos = pdfPos;
    }

    // (c) H-103: Verificar que DOCX y PDF contienen las 5 subsecciones canónicas de Diagnóstico en orden y sin ":"
    const subseccionesDiagnostico = [
      PMC_SUBSECCIONES_DIAGNOSTICO.CONTEXTO,
      PMC_SUBSECCIONES_DIAGNOSTICO.INDICADORES,
      PMC_SUBSECCIONES_DIAGNOSTICO.INFRAESTRUCTURA,
      PMC_SUBSECCIONES_DIAGNOSTICO.BENEFICIOS,
      PMC_SUBSECCIONES_DIAGNOSTICO.FODA,
    ];

    let lastDocxSubPos = docxText.indexOf(PMC_TITULOS_SECCIONES.DIAGNOSTICO);
    let lastPdfSubPos = pdfText.indexOf(PMC_TITULOS_SECCIONES.DIAGNOSTICO);

    for (const subTitulo of subseccionesDiagnostico) {
      const docxSubPos = docxText.indexOf(subTitulo);
      expect(docxSubPos, `DOCX debe contener la subsección canónica "${subTitulo}"`).toBeGreaterThan(-1);
      expect(docxSubPos, `En DOCX, "${subTitulo}" debe ubicarse después de la anterior`).toBeGreaterThan(lastDocxSubPos);
      lastDocxSubPos = docxSubPos;

      const pdfSubPos = pdfText.indexOf(subTitulo);
      expect(pdfSubPos, `PDF debe contener la subsección canónica "${subTitulo}"`).toBeGreaterThan(-1);
      expect(pdfSubPos, `En PDF, "${subTitulo}" debe ubicarse después de la anterior`).toBeGreaterThan(lastPdfSubPos);
      lastPdfSubPos = pdfSubPos;
    }

    // Verificación anti-divergencia H-103 (FODA sin título alternativo y sin dos puntos en PDF)
    expect(pdfText).not.toContain('4.5 Matriz de Análisis Estratégico FODA');
    expect(pdfText).toContain('4.5 Matriz FODA Situacional');
  });

  it('4. Con 2 documentos mock, ambos generadores renderizan la jerarquía jurídica A y B', async () => {
    const project = makeMockPmcProject();

    const docxBuffer = await generatePmcDocx(project as unknown as Parameters<typeof generatePmcDocx>[0]);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    const pdfBuffer = await generatePmcPDF(project as unknown as Parameters<typeof generatePmcPDF>[0]);
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsedPdf = await parser.getText();
    await parser.destroy();
    const pdfText = parsedPdf.text;

    // A. LEYES Y DISPOSICIONES CONSTITUCIONALES
    expect(docxText).toContain('A. LEYES Y DISPOSICIONES CONSTITUCIONALES');
    expect(pdfText).toContain('A. LEYES Y DISPOSICIONES CONSTITUCIONALES');

    // B. REGLAMENTOS, ACUERDOS SECRETARIALES Y MARCO CURRICULAR
    expect(docxText).toContain('B. REGLAMENTOS, ACUERDOS SECRETARIALES Y MARCO CURRICULAR');
    expect(pdfText).toContain('B. REGLAMENTOS, ACUERDOS SECRETARIALES Y MARCO CURRICULAR');
  });

  it('5. clasificarNormativaJerarquica sanea snapshots antiguos: 14/08/22 -> 09/08/23 y filtra placeholders (H-125)', () => {
    const dirtyDocs = [
      {
        orden: 1,
        titulo: 'Acuerdo Secretarial 14/08/22 — MCCEMS',
        articulos: ['Artículo Relevante — Supervisión EMS', '15 21 42'],
      },
      {
        orden: 2,
        titulo: 'Ley General de Educación',
        articulos: ['Art. 107', 'Artículo Relevante', 'Art. 108'],
      },
    ];

    const grupos = clasificarNormativaJerarquica(dirtyDocs);
    expect(grupos).toHaveLength(2);

    // Grupo B: Acuerdos - MCCEMS saneado a 09/08/23 sin placeholders
    const grupoB = grupos.find((g) => g.clave === 'B')!;
    expect(grupoB).toBeDefined();
    expect(grupoB.documentos[0].titulo).toContain('09/08/23');
    expect(grupoB.documentos[0].titulo).not.toContain('14/08/22');
    expect(grupoB.documentos[0].articulos).not.toContain('Artículo Relevante — Supervisión EMS');
    expect(grupoB.documentos[0].articulos).toEqual(['Lineamiento General', 'Componente Curricular']);

    // Grupo A: Leyes - Artículos limpios de placeholders
    const grupoA = grupos.find((g) => g.clave === 'A')!;
    expect(grupoA).toBeDefined();
    expect(grupoA.documentos[0].articulos).toEqual(['Art. 107', 'Art. 108']);
    expect(grupoA.documentos[0].articulos).not.toContain('Artículo Relevante');
  });

  it('6. Matriz de metas en DOCX y PDF cuenta con encabezados idénticos ("Período") y separador em-dash (" — ") (H-132, H-133)', async () => {
    const project = makeMockPmcProject();

    const docxBuffer = await generatePmcDocx(project as unknown as Parameters<typeof generatePmcDocx>[0]);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    const pdfBuffer = await generatePmcPDF(project as unknown as Parameters<typeof generatePmcPDF>[0]);
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsedPdf = await parser.getText();
    await parser.destroy();
    const pdfText = parsedPdf.text;

    // Ambos deben contener "Período" con tilde
    expect(docxText).toContain('Período');
    expect(pdfText).toContain('Período');

    // Ambos deben usar em-dash (" — ") en el período de la meta y no " - "
    expect(docxText).toContain('Agosto 2026 — Julio 2027');
    expect(pdfText).toContain('Agosto 2026 — Julio 2027');
    expect(pdfText).not.toContain('Agosto 2026 - Julio 2027');
  });

  it('7. Sección 8 en DOCX y PDF incorpora columna "Horas Base" y refleja los datos de plantilla', async () => {
    const project = makeMockPmcProject();

    const docxBuffer = await generatePmcDocx(project as unknown as Parameters<typeof generatePmcDocx>[0]);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    const pdfBuffer = await generatePmcPDF(project as unknown as Parameters<typeof generatePmcPDF>[0]);
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsedPdf = await parser.getText();
    await parser.destroy();
    const pdfText = parsedPdf.text;

    // Ambos deben contener la columna "Horas Base"
    expect(docxText).toContain('Horas Base');
    expect(pdfText).toContain('Horas Base');

    // H-136: Encabezados homologados al 100% en Sección 8
    expect(docxText).toContain('Nombre Completo del Personal');
    expect(pdfText).toContain('Nombre Completo del Personal');
    expect(docxText).toContain('Cargo / Función en el CTE');
    expect(pdfText).toContain('Cargo / Función en el CTE');
    expect(docxText).toContain('Firma de Conformidad');
    expect(pdfText).toContain('Firma de Conformidad');

    // Ambos deben reflejar las horas base de la plantilla cuando existen
    expect(docxText).toContain('30 hrs');
    expect(pdfText).toContain('30 hrs');

    // Anti-fabricación B-001 (H-134): Cuando horas_base es ausente/null, NO inventar "40 hrs"
    expect(docxText).not.toContain('40 hrs');
    expect(pdfText).not.toContain('40 hrs');
  });

  it('8. Sección 7 en DOCX y PDF cuenta con paridad espejo 100%: 7 columnas idénticas, estrategia y período normalizado con em-dash (H-135)', async () => {
    const project = makeMockPmcProject();

    const docxBuffer = await generatePmcDocx(project as unknown as Parameters<typeof generatePmcDocx>[0]);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    const pdfBuffer = await generatePmcPDF(project as unknown as Parameters<typeof generatePmcPDF>[0]);
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsedPdf = await parser.getText();
    await parser.destroy();
    const pdfText = parsedPdf.text;

    // Encabezados de Sección 7 presentes en ambos
    expect(docxText).toContain('Nombre del Integrante');
    expect(docxText).toContain('Cargo / Función');
    expect(docxText).toContain('Meta y Compromiso Individual');
    expect(docxText).toContain('Estrategia Individual');
    expect(docxText).toContain('Entregable Comprobable');
    expect(docxText).toContain('Período');

    expect(pdfText).toMatch(/Nombre del Integrante/);
    expect(pdfText).toMatch(/Cargo\s*\/\s*Función/);
    expect(pdfText).toMatch(/Meta y Compromiso Individual/);
    expect(pdfText).toMatch(/Estrategia Individual/);
    expect(pdfText).toMatch(/Entregable\s+Comprobable/);
    expect(pdfText).toMatch(/Período/);

    // Estrategia individual presente en ambos
    expect(docxText).toContain('Calendario de seguimiento directivo.');
    expect(pdfText).toMatch(/Calendario de seguimiento\s+directivo\./);

    // Prefijo de categoría [ámbito — tema] presente e idéntico con em-dash en ambos
    expect(docxText).toContain('[Desarrollo Académico — Recursos sociocognitivos]');
    expect(pdfText).toMatch(/\[Desarrollo Académico\s+—\s+Recursos\s+sociocognitivos\]/);

    // Período normalizado a mayúscula inicial y em-dash (" — ") en ambos
    expect(docxText).toContain('Agosto 2026 — Junio 2027');
    expect(pdfText).toMatch(/Agosto 2026\s+—\s+Junio 2027/);
    expect(docxText).not.toContain('agosto 2026 - junio 2027');
    expect(pdfText).not.toContain('agosto 2026 - junio 2027');
  });

  it('9. Sección 8 en DOCX y PDF cuenta con paridad espejo 100%: Constancia de Aprobación y Validación oficial con firmas ELABORÓ, REVISÓ y VALIDÓ (H-138)', async () => {
    const project = makeMockPmcProject();

    const docxBuffer = await generatePmcDocx(project as unknown as Parameters<typeof generatePmcDocx>[0]);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    const pdfBuffer = await generatePmcPDF(project as unknown as Parameters<typeof generatePmcPDF>[0]);
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsedPdf = await parser.getText();
    await parser.destroy();
    const pdfText = parsedPdf.text;

    // Constancia de Aprobación y Validación presente en ambos
    expect(docxText).toContain('CONSTANCIA DE APROBACIÓN Y VALIDACIÓN DEL PLAN DE MEJORA CONTINUA');
    expect(pdfText).toContain('CONSTANCIA DE APROBACIÓN Y VALIDACIÓN DEL PLAN DE MEJORA CONTINUA');

    // Tres roles oficiales de firma presentes en ambos
    expect(docxText).toContain('ELABORÓ');
    expect(pdfText).toContain('ELABORÓ');
    expect(docxText).toContain('REVISÓ');
    expect(pdfText).toContain('REVISÓ');
    expect(docxText).toContain('VALIDÓ');
    expect(pdfText).toContain('VALIDÓ');

    // Nombres y autoridades presentes en ambos en MAYÚSCULAS oficiales (H-139 / N-01)
    expect(docxText).toContain('PROF. JUAN ROGELIO GARCÍA ESCUDERO');
    expect(pdfText).toContain('PROF. JUAN ROGELIO GARCÍA ESCUDERO');
    expect(docxText).toContain('MTRA. MARÍA ELENA MORALES');
    expect(pdfText).toContain('MTRA. MARÍA ELENA MORALES');
    expect(docxText).toContain('DIRECTOR(A) DEL PLANTEL');
    expect(pdfText).toContain('DIRECTOR(A) DEL PLANTEL');
    expect(docxText).toContain('REPRESENTANTE DEL CTE');
    expect(pdfText).toContain('REPRESENTANTE DEL CTE');
    expect(docxText).toContain('SUPERVISOR(A) DE ZONA ESCOLAR');
    expect(pdfText).toContain('SUPERVISOR(A) DE ZONA ESCOLAR');

    // Ausencia de tabla divergente o desactualizada
    expect(docxText).not.toContain('Control de Revisiones Institucionales');
    expect(pdfText).not.toContain('Control de Revisiones Institucionales');
    expect(docxText).not.toContain('Presidente del CEPS');
    expect(pdfText).not.toContain('Presidente del CEPS');
  });
});

