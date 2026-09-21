// src/__tests__/paec-docx-generator.test.ts
/**
 * Tests unitarios para paec-docx-generator.ts
 * Fase 15B & 15E · SIGPDA-EMS DBEPA Puebla MCCEMS
 *
 * Validación exhaustiva de:
 * 1. Normalización defensiva de parseFodaData (Fase 15B).
 * 2. Generación editorial oficial de 4 Macro-Fases PAEC en DOCX con mammoth (Fase 15E).
 */

import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import {
  parseFodaData,
  generatePaecDocx,
  type ParsedFoda,
} from '@/lib/paec-docx-generator';
import type { PaecProject } from '@/types/paec';

// ── Fixture Factory para PAEC ────────────────────────────────────────────────
function makePaecFixture(overrides: Partial<PaecProject> = {}): PaecProject {
  return {
    id: 'paec-test-project-001',
    projectName: 'Rescate de Saberes Agroecológicos y Reforestación Comunitaria',
    problemStatement: 'Pérdida de cubierta vegetal y degradación de suelos de cultivo en las faldas del volcán.',
    cycleType: 'annual',
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
    schoolContext: {
      schoolName: 'Bachillerato General Oficial Lic. Benito Juárez',
      cct: '21EBH0012A',
      schoolZone: 'Zona Escolar 012',
      municipality: 'San Pedro Cholula',
      locality: 'San Cristóbal Tepontla',
      enrollment: '280',
      teacherCount: '16',
      schoolType: 'general',
    },
    communityContext: {
      location: 'San Cristóbal Tepontla, Cholula, Puebla',
      demographics: 'Población mayoritariamente originaria dedicada a la alfarería y agricultura de temporal.',
      economy: 'Comercio local, producción de ladrillos artesanales y cultivo de maíz y legumbres.',
      traditions: 'Mayordomías patronales, faenas comunitarias sabatinas y medicina tradicional.',
      environment: 'Zona de recarga de acuíferos con afectación por tala clandestina y erosión de suelo.',
    },
    teacherId: 'teacher-test-001',
    currentStep: 9,
    fase1Diagnostico: {
      tabla1: [
        { col1: 'Territorio y Geografía', col2: 'Ubicación al pie del cerro Zapotecas con vegetación templada.' },
        { col1: 'Organización Comunitaria', col2: 'Estructura de usos y costumbres con comité de aguas potables.' },
      ],
      tabla2: [
        { col1: 'Aprovechamiento Escolar', col2: '86% de aprobación global en humanidades y ciencias sociales.' },
        { col1: 'Infraestructura', col2: 'Terreno escolar de 2,500 m2 con área disponible para huerto didáctico.' },
      ],
      tabla3: [
        { aspect: 'Fortalezas', analysis: 'Docentes capacitados en proyectos socioformativos NEM.' },
        { aspect: 'Oportunidades', analysis: 'Comité ejidal dispuesto a donar plántulas nativas de encino.' },
        { aspect: 'Debilidades', analysis: 'Falta de sistema de captación de agua pluvial en el vivero.' },
        { aspect: 'Amenazas', analysis: 'Sequías prolongadas en la estación primaveral.' },
      ],
      tabla4: [
        { col1: 'Paso 1: Asambleas', col2: 'Consulta participativa con estudiantes, ejidatarios y familias.' },
        { col1: 'Paso 2: Delimitación', col2: 'Focalización de la problemática en el predio ejidal anexo.' },
      ],
    },
    fase2Justificacion: {
      projectName: 'Rescate de Saberes Agroecológicos y Reforestación Comunitaria',
      introduction: 'El proyecto articula la conservación biológica y la identidad cultural comunitaria.',
      pilares: [
        'Fomento de la identidad con México',
        'Responsabilidad ciudadana',
        'Honestidad y transformación social',
      ],
      proposito: {
        educativo: 'Desarrollar competencias interdisciplinarias en biología, ecología y ética comunitaria.',
        social: 'Recuperar áreas forestales degradadas mediante faenas colectivas intergeneracionales.',
        funcional: 'Instalar un vivero escolar autosustentable con sistema de recolección pluvial.',
      },
      alcance: {
        metas: ['Reforestar 2 hectáreas', 'Capacitar a 280 alumnos en compostaje'],
        participantes: ['280 estudiantes', '16 docentes', '40 comuneros'],
        recursos: ['Herramientas de labranza', 'Plántulas de encino y pino', 'Sustrato orgánico'],
      },
    },
    fase2DetalleCurricular: null,
    fase2PlanOperativo: null,
    fase2Anexos: null,
    fase3PlanOperativoA: null,
    fase3PlanOperativoB: null,
    fase3Implementacion: null,
    fase4Gobernanza: null,
    fase4InformeSupervision: null,
    qualityAudit: null,
    fase2Mapeo: [
      {
        semester: 1,
        uacName: 'La Conservación de la Energía y sus Interacciones',
        topic: 'Flujo de energía en ecosistemas locales',
        linking: 'Cálculo de biomasa y balance hídrico del vivero forestal.',
      },
      {
        semester: 3,
        uacName: 'Lengua y Comunicación III',
        topic: 'Crónica y reportaje comunitario',
        linking: 'Elaboración de una gaceta ecológica comunitaria multilingüe.',
      },
    ],
    fase2Cronograma: [
      {
        phase: 'Fase 1: Preparación de sustrato y bancales',
        objective: 'Instalación de camas de siembra y composta orgánica',
        macroActivities: 'Taller de compostaje y delimitación de camas de siembra',
        responsibleSubjects: 'Colegiado STEM y brigada estudiantil',
        semesterInvolved: 'Primer Semestre',
      },
      {
        phase: 'Fase 2: Germinación y reforestación de campo',
        objective: 'Reforestación con especies nativas en predio ejidal',
        macroActivities: 'Faena comunitaria de plantación en el cerro Zapotecas',
        responsibleSubjects: 'Comunidad escolar completa y ejidatarios',
        semesterInvolved: 'Tercer Semestre',
      },
    ],
    ...overrides,
  };
}

describe('paec-docx-generator — Normalización de Matriz FODA y Estrategias Cruzadas', () => {
  // ── TEST 1: Array de objetos con etiquetas semánticas en español ───────────
  it('Test 1: Normaliza array con etiquetas semánticas en español y estrategias cruzadas', () => {
    const rawFoda = [
      { aspect: 'Fortalezas Institucionales', analysis: 'Docentes certificados en competencias pedagógicas MCCEMS' },
      { aspect: 'Oportunidades del Entorno', analysis: 'Convenio activo con el comité ejidal para reforestación' },
      { aspect: 'Debilidades Internas', analysis: 'Laboratorio de cómputo con conectividad intermitente' },
      { aspect: 'Amenazas Contextuales', analysis: 'Temporada de lluvias que anega el camino de acceso' },
      { aspect: 'Estrategia FO', analysis: 'Desarrollar vivero escolar con apoyo de los comuneros' },
      { aspect: 'Estrategia DO', analysis: 'Solicitar antenas satelitales comunitarias' },
      { aspect: 'Estrategia FA', analysis: 'Establecer aula virtual de contingencia climática' },
      { aspect: 'Estrategia DA', analysis: 'Guardia comunitaria para salvaguardar equipos' },
    ];

    const result: ParsedFoda = parseFodaData(rawFoda);

    expect(result.fortalezas).toContain('Docentes certificados en competencias pedagógicas MCCEMS');
    expect(result.oportunidades).toContain('Convenio activo con el comité ejidal para reforestación');
    expect(result.debilidades).toContain('Laboratorio de cómputo con conectividad intermitente');
    expect(result.amenazas).toContain('Temporada de lluvias que anega el camino de acceso');
    expect(result.estFO).toBe('Desarrollar vivero escolar con apoyo de los comuneros');
    expect(result.estDO).toBe('Solicitar antenas satelitales comunitarias');
    expect(result.estFA).toBe('Establecer aula virtual de contingencia climática');
    expect(result.estDA).toBe('Guardia comunitaria para salvaguardar equipos');
  });

  // ── TEST 2: Array con etiquetas en inglés y abreviadas (SWOT / F, O, D, A) ──
  it('Test 2: Normaliza array con nomenclatura en inglés (SWOT) y abreviaturas simples', () => {
    const rawSwot = [
      { category: 'Strengths', description: 'Strong community engagement' },
      { category: 'Opportunities', description: 'Federal environmental grants' },
      { category: 'Weaknesses', description: 'Outdated physics laboratory gear' },
      { category: 'Threats', description: 'Youth out-migration trends' },
      { category: 'maxi-maxi', description: 'Leverage community leadership for grant acquisition' },
      { category: 'mini-maxi', description: 'Acquire refurbished equipment with grants' },
      { category: 'maxi-mini', description: 'Mentorship programs against youth out-migration' },
      { category: 'mini-mini', description: 'Collaborative protocols to minimize budget deficits' },
    ];

    const result = parseFodaData(rawSwot);

    expect(result.fortalezas).toContain('Strong community engagement');
    expect(result.oportunidades).toContain('Federal environmental grants');
    expect(result.debilidades).toContain('Outdated physics laboratory gear');
    expect(result.amenazas).toContain('Youth out-migration trends');
    expect(result.estFO).toBe('Leverage community leadership for grant acquisition');
    expect(result.estDO).toBe('Acquire refurbished equipment with grants');
    expect(result.estFA).toBe('Mentorship programs against youth out-migration');
    expect(result.estDA).toBe('Collaborative protocols to minimize budget deficits');
  });

  // ── TEST 3: Objeto plano con arrays por cuadrante y estrategias cruzadas ───
  it('Test 3: Normaliza objeto plano estructurado con cuadrantes y fodaCruzado', () => {
    const rawObject = {
      fortalezas: ['Alta participación de padres de familia', 'Uso de metodologías activas'],
      oportunidades: ['Alianzas con centros de salud locales'],
      debilidades: ['Falta de biblioteca física en el plantel'],
      amenazas: ['Inseguridad en el transporte público'],
      fodaCruzado: {
        estrategiaFO: 'Campañas de salud lideradas por estudiantes y familias',
        estrategiaDO: 'Crear repositorio digital de libre acceso con el centro de salud',
        estrategiaFA: 'Red de traslados seguros coordinada con tutores',
        estrategiaDA: 'Biblioteca comunitaria digital en red local offline',
      },
    };

    const result = parseFodaData(rawObject);

    expect(result.fortalezas.length).toBe(2);
    expect(result.fortalezas[0]).toBe('Alta participación de padres de familia');
    expect(result.oportunidades).toContain('Alianzas con centros de salud locales');
    expect(result.debilidades).toContain('Falta de biblioteca física en el plantel');
    expect(result.amenazas).toContain('Inseguridad en el transporte público');
    expect(result.estFO).toBe('Campañas de salud lideradas por estudiantes y familias');
    expect(result.estDO).toBe('Crear repositorio digital de libre acceso con el centro de salud');
    expect(result.estFA).toBe('Red de traslados seguros coordinada con tutores');
    expect(result.estDA).toBe('Biblioteca comunitaria digital en red local offline');
  });

  // ── TEST 4: Fallback posicional cuando no hay etiquetas semánticas reconocibles
  it('Test 4: Realiza fallback posicional cuando el array carece de etiquetas semánticas', () => {
    const rawPositional = [
      'Primera posición: Fortalezas de infraestructura',
      'Segunda posición: Oportunidades agropecuarias',
      'Tercera posición: Debilidades en conectividad',
      'Cuarta posición: Amenazas por heladas agrícolas',
      'Quinta posición: Estrategia FO territorial',
      'Sexta posición: Estrategia DO tecnológica',
      'Séptima posición: Estrategia FA preventiva',
      'Octava posición: Estrategia DA de mitigación',
    ];

    const result = parseFodaData(rawPositional);

    expect(result.fortalezas).toContain('Primera posición: Fortalezas de infraestructura');
    expect(result.oportunidades).toContain('Segunda posición: Oportunidades agropecuarias');
    expect(result.debilidades).toContain('Tercera posición: Debilidades en conectividad');
    expect(result.amenazas).toContain('Cuarta posición: Amenazas por heladas agrícolas');
    expect(result.estFO).toBe('Quinta posición: Estrategia FO territorial');
    expect(result.estDO).toBe('Sexta posición: Estrategia DO tecnológica');
    expect(result.estFA).toBe('Séptima posición: Estrategia FA preventiva');
    expect(result.estDA).toBe('Octava posición: Estrategia DA de mitigación');
  });

  // ── TEST 5: Fallbacks normativos oficiales DBEPA cuando el input es nulo o vacío
  it('Test 5: Retorna fallbacks oficiales normativos DBEPA ante input nulo, vacío o corrupto', () => {
    // Caso 1: Input null
    const resultNull = parseFodaData(null);
    expect(resultNull.fortalezas.length).toBeGreaterThan(0);
    expect(resultNull.oportunidades.length).toBeGreaterThan(0);
    expect(resultNull.debilidades.length).toBeGreaterThan(0);
    expect(resultNull.amenazas.length).toBeGreaterThan(0);
    expect(resultNull.estFO).toContain('Aprovechar el liderazgo del colegiado docente');
    expect(resultNull.estDO).toContain('Subsanar las carencias materiales');
    expect(resultNull.estFA).toContain('Utilizar la cohesión pedagógica');
    expect(resultNull.estDA).toContain('Minimizar debilidades operativas');

    // Caso 2: Array vacío
    const resultEmpty = parseFodaData([]);
    expect(resultEmpty.fortalezas.length).toBeGreaterThan(0);
    expect(resultEmpty.fortalezas[0]).toContain('Colegiado docente comprometido');

    // Caso 3: String o tipo no soportado
    const resultString = parseFodaData('texto_invalido_sin_foda');
    expect(resultString.fortalezas.length).toBeGreaterThan(0);
    expect(resultString.estFO).toBeDefined();
  });
});

describe('paec-docx-generator — Generación Editorial Oficial PAEC (DOCX)', () => {
  // ── TEST 6: Happy-path con fixture completo y 4 Macro-Fases estructuradas ─
  it('Test 6: Genera documento oficial PAEC completo con las 4 Macro-Fases y cabecera ZIP', async () => {
    const fixture = makePaecFixture();
    const buffer = await generatePaecDocx(fixture);

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(10000);

    // Firma ZIP / OpenXML (PK\x03\x04)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);

    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('PROYECTO ESCOLAR COMUNITARIO (PEC)');
    expect(text).toContain('PROGRAMA AULA, ESCUELA Y COMUNIDAD (PAEC)');
    expect(text).toContain('CÉDULA OFICIAL DE IDENTIFICACIÓN INSTITUCIONAL DEL PROYECTO');
    expect(text).toContain('Bachillerato General Oficial Lic. Benito Juárez');
    expect(text).toContain('21EBH0012A');
    expect(text).toContain('MACRO-FASE I: DIAGNÓSTICO COLECTIVO');
    expect(text).toContain('MACRO-FASE II: JUSTIFICACIÓN PEDAGÓGICA');
    expect(text).toContain('MACRO-FASE III (A): PLAN OPERATIVO TERRITORIAL');
    expect(text).toContain('MACRO-FASE IV: GOBERNANZA ESCOLAR');
  });

  // ── TEST 7: Inyección de nombre de docente coordinador personalizado ──────
  it('Test 7: Inyecta y refleja fielmente el nombre del docente coordinador en cédula y firmas', async () => {
    const fixture = makePaecFixture();
    const customTeacher = 'Mtro. Alejandro Valdés Pérez';
    const buffer = await generatePaecDocx(fixture, customTeacher);

    const { value: text } = await mammoth.extractRawText({ buffer });
    expect(text).toContain(customTeacher);
  });

  // ── TEST 8: Estructura Híbrida y empaquetado multi-sección ─────────────────
  it('Test 8: Compila exitosamente el documento multi-sección híbrido (Portrait y Landscape)', async () => {
    const fixture = makePaecFixture();
    const buffer = await generatePaecDocx(fixture);

    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(15000);

    // Validación de que contiene tablas de plan operativo y cédula técnica
    const { value: text } = await mammoth.extractRawText({ buffer });
    expect(text).toContain('2.5 Mapeo Curricular Integral');
    expect(text).toContain('2.6 Cronograma Bimestral Macro');
  });

  // ── TEST 9: Resiliencia ante PaecProject mínimo o nulo ─────────────────────
  it('Test 9: Genera documento sin crashear cuando el proyecto contiene campos vacíos o nulos', async () => {
    const minimalProject = {
      id: 'minimal-paec-test',
    } as unknown as PaecProject;

    const buffer = await generatePaecDocx(minimalProject);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(2000);

    const { value: text } = await mammoth.extractRawText({ buffer });
    expect(text).toContain('PROYECTO ESCOLAR COMUNITARIO (PEC)');
    expect(text).toContain('MACRO-FASE I: DIAGNÓSTICO COLECTIVO');
  });

  // ── TEST 10: Inclusión de los 8 Principios de la NEM y Criterio MIFO ────────
  it('Test 10: Integra los principios de la Nueva Escuela Mexicana y la pertinencia territorial MIFO', async () => {
    const fixture = makePaecFixture();
    const buffer = await generatePaecDocx(fixture);
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('2.2 Pilares de la Nueva Escuela Mexicana Incorporados');
    expect(text).toContain('2.3 Propósitos Integrales del Proyecto (MIFO / DBEPA)');
    expect(text).toContain('Fomento de la identidad con México');
  }, 15000);

  // ── TEST 11: Formalización Institucional (Minuta, Carta y Oficios) ──────────
  it('Test 11: Renderiza la carta convocatoria y minuta de instalación de la asamblea comunitaria', async () => {
    const fixture = makePaecFixture();
    const buffer = await generatePaecDocx(fixture);
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('3.1 Carta de Convocatoria a la Asamblea Escolar y Comunitaria');
    expect(text).toContain('3.2 Minuta de Instalación del Comité de Seguimiento Comunitario');
    expect(text).toContain('Comité de Seguimiento del Proyecto Escolar Comunitario');
  }, 15000);
});
