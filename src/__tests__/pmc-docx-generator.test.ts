// src/__tests__/pmc-docx-generator.test.ts
/**
 * Tests unitarios para pmc-docx-generator.ts
 * Fase 15D · SIGPDA-EMS SEMS Puebla MCCEMS
 *
 * Validación de generación de Plan de Mejora Continua (PMC) e Informes (DOCX).
 * Valida integridad binaria y contenido textual mediante mammoth.
 */

import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import {
  generatePmcDocx,
  generatePmcInformeDocx,
  type PmcProject,
} from '@/lib/pmc-docx-generator';

// ── Fixture Factory ──────────────────────────────────────────────────────────
function makePmcFixture(overrides: Partial<PmcProject> = {}): PmcProject {
  return {
    id: 'pmc-test-project-001',
    school_name: 'Bachillerato General Oficial Lic. Benito Juárez',
    school_cct: '21EBH0012A',
    municipality: 'San Pedro Cholula',
    locality: 'Centro',
    school_zone: 'Zona Escolar 012',
    director_name: 'Mtra. Patricia Mendoza Santos',
    supervisor_name: 'Mtro. Roberto Morales Sánchez',
    ciclo_escolar: '2026-2027',
    subsystem: 'Bachilleratos Estatales',
    total_staff: 16,
    staff_data: [
      { nombre: 'Lic. Fernando Ruiz', cargo: 'Docente', funcion: 'Pensamiento Matemático' },
      { nombre: 'Mtra. Diana Morales', cargo: 'Docente', funcion: 'Lengua y Comunicación' },
      { nombre: 'Psic. Laura Trejo', cargo: 'Orientadora', funcion: 'Orientación Educativa' },
    ],
    normativa: {
      titulo: 'Marco Jurídico de la Educación Media Superior',
      documentos: [
        {
          orden: 1,
          titulo: 'Constitución Política de los Estados Unidos Mexicanos (Artículo 3.°)',
          articulos: ['Educación inclusiva, obligatoria y de excelencia.', 'Fomento al pensamiento crítico y comunitario.'],
        },
        {
          orden: 2,
          titulo: 'Acuerdo Secretarial 09/08/23 (MCCEMS)',
          articulos: ['Articulación de los recursos sociocognitivos y áreas de conocimiento.'],
        },
      ],
    },
    diagnostico_generado: {
      presentacion: 'El presente Plan de Mejora Continua articula los esfuerzos del colegiado docente para consolidar la calidad educativa.',
      contexto: 'Comunidad semiurbana con alta vocación artesanal y comercio local activo.',
      analisis_indicadores: 'Se observa una tasa de aprobación del 86% con reto focalizado en reprobación de primer semestre.',
      sintesis_foda: 'El personal muestra alto compromiso ético y formativo para acompañar trayectorias continuas.',
      priorizacion: 'Fortalecer habilidades matemáticas e incorporar metodologías socioformativas activas.',
    },
    indicadores_academicos: {
      aprobacion_ant: 84,
      reprobacion_ant: 16,
      abandono_ant: 4,
      et_ant: 80,
      aprobacion_meta: 90,
      abandono_meta: 2,
      et_meta: 86,
      matricula: 280,
    },
    foda: {
      fortalezas: 'Planta docente completa, estabilidad laboral y participación activa en CAPEMS.',
      oportunidades: 'Vinculación con el Instituto Tecnológico regional para uso de laboratorios.',
      debilidades: 'Aulas de cómputo con equipos de generaciones pasadas que requieren modernización.',
      amenazas: 'Condiciones de tránsito y transporte público irregular para alumnos de comunidades vecinas.',
    },
    categorias_priorizadas: [
      { id: 'cat-1', nombre: 'Logro Académico y Competencias Fundamentales' },
      { id: 'cat-2', nombre: 'Permanencia Escolar y Convivencia Democrática' },
    ],
    plan_accion: {
      metas_institucionales: [
        {
          categoria: 'cat-1',
          nombre_categoria: 'Logro Académico',
          tema: 'Pensamiento Matemático',
          meta: 'Elevar al 90% la aprobación en asignaturas STEM mediante tutoría entre pares.',
          estrategia: 'Implementar laboratorios de resolución colaborativa de problemas situados.',
          linea_base: '84% de aprobación al cierre del ciclo 2025-2026',
          personal_designado: 'Colegiado de Matemáticas',
          entregable: 'Bitácora trimestral de tutorías y portafolios de evidencias',
          periodo_inicio: 'Septiembre 2026',
          periodo_fin: 'Junio 2027',
          diagnostico_meta: 'Brechas conceptuales identificadas en la evaluación diagnóstica inicial.',
        },
        {
          categoria: 'cat-2',
          nombre_categoria: 'Permanencia Escolar',
          tema: 'Acompañamiento Socioemocional',
          meta: 'Reducir el abandono escolar a menos del 2% anual.',
          estrategia: 'Sistema de alerta temprana para ausentismo continuo de 3 o más días.',
          linea_base: '4% de abandono anterior',
          personal_designado: 'Orientación Educativa y Tutores de Grupo',
          entregable: 'Reportes mensuales de seguimiento de casos de riesgo',
          periodo_inicio: 'Agosto 2026',
          periodo_fin: 'Julio 2027',
          diagnostico_meta: 'Factores socioeconómicos y familiares detectados en encuestas diagnósticas.',
        },
      ],
      metas_personales: [
        {
          nombre: 'Lic. Fernando Ruiz',
          cargo: 'Docente de Matemáticas',
          meta_individual: 'Capacitarse en recursos pedagógicos digitales de GeoGebra aplicados al MCCEMS.',
          estrategia: 'Concluir curso virtual estatal de 40 horas académicas.',
          entregable: 'Constancia oficial de acreditación y secuencia didáctica modelo.',
          periodo: 'Primer Semestre (Noviembre 2026)',
        },
        {
          nombre: 'Mtra. Diana Morales',
          cargo: 'Docente de Lenguaje',
          meta_individual: 'Crear el club de lectura y debate literario estudiantil.',
          estrategia: 'Sesiones quincenales de análisis de textos narrativos iberoamericanos.',
          entregable: 'Antología de ensayos breves elaborados por los educandos.',
          periodo: 'Ciclo completo 2026-2027',
        },
      ],
    },
    ...overrides,
  };
}

describe('pmc-docx-generator — Generador de Plan de Mejora Continua e Informes', () => {
  // ── TEST 1: Happy-path generatePmcDocx con fixture institucional completo ──
  it('Test 1: Genera documento PMC oficial completo con secciones y metadatos verificados', async () => {
    const fixture = makePmcFixture();
    const buffer = await generatePmcDocx(fixture);

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(5000);

    // Firma ZIP / OpenXML (PK\x03\x04)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);

    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('PLAN DE MEJORA CONTINUA');
    expect(text).toContain('Bachillerato General Oficial Lic. Benito Juárez');
    expect(text).toContain('21EBH0012A');
    expect(text).toContain('1. PRESENTACIÓN');
    expect(text).toContain('2. OBJETIVO DEL PMC');
    expect(text).toContain('3. NORMATIVIDAD APLICABLE');
    expect(text).toContain('4. DIAGNÓSTICO');
    expect(text).toContain('5. PRIORIZACIÓN DE CATEGORÍAS');
    expect(text).toContain('6. PLAN DE ACCIÓN');
    expect(text).toContain('7. METAS INDIVIDUALES DEL PERSONAL');
    expect(text).toContain('8. PARTICIPANTES, CONTROL DE REVISIONES Y APROBACIÓN');
  });

  // ── TEST 2: Resiliencia ante PmcProject vacío o mínimo ──────────────────────
  it('Test 2: Genera documento sin crashear cuando el proyecto está vacío o tiene campos nulos', async () => {
    const emptyProject: PmcProject = {
      id: 'pmc-empty-test',
    };

    const buffer = await generatePmcDocx(emptyProject);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    const { value: text } = await mammoth.extractRawText({ buffer });
    expect(text).toContain('PLAN DE MEJORA CONTINUA');
    expect(text).toContain('3. NORMATIVIDAD APLICABLE');
    // H-099: Con normativa null o no provista, nunca emite sección en blanco (fallback de disposiciones activo)
    expect(text).toContain('Constitución Política de los Estados Unidos Mexicanos (Art. 3°)');
    expect(text).toContain('Ley General de Educación');
    expect(text).toContain('Marco Curricular Común de la Educación Media Superior');
  });

  // ── TEST 3: Informe Parcial de Avance (generatePmcInformeDocx 'parcial') ────
  it('Test 3: Genera informe parcial de avance con tablas oficiales y periodo semestral', async () => {
    const fixture = makePmcFixture();
    const buffer = await generatePmcInformeDocx(fixture, 'parcial');

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(4000);

    const { value: text } = await mammoth.extractRawText({ buffer });
    expect(text).toContain('INFORME PARCIAL DE AVANCE PMC');
    expect(text).toContain('Agosto 2026 – Enero 2027 (1er Semestre)');
    expect(text).toContain('ACUSE DE RECEPCIÓN — SUPERVISIÓN ESCOLAR');
    expect(text).toContain('Bachillerato General Oficial Lic. Benito Juárez');
  });

  // ── TEST 4: Informe Final de Ciclo (generatePmcInformeDocx 'final') ──────────
  it('Test 4: Genera informe final de ciclo con evaluación global de cumplimiento', async () => {
    const fixture = makePmcFixture();
    const buffer = await generatePmcInformeDocx(fixture, 'final');

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(4000);

    const { value: text } = await mammoth.extractRawText({ buffer });
    expect(text).toContain('INFORME FINAL DEL PLAN DE MEJORA CONTINUA');
    expect(text).toContain('Agosto 2026 – Julio 2027 (Ciclo Completo)');
    expect(text).toContain('FIRMAS DE VALIDACIÓN Y RESPONSABILIDAD INSTITUCIONAL');
    expect(text).toContain('Mtro. Roberto Morales Sánchez');
  });

  // ── TEST 5: Manejo de campos JSON serializados como string vs objeto ───────
  it('Test 5: Parsea transparentemente campos configurados como strings JSON serializados', async () => {
    const fixture = makePmcFixture({
      indicadores_academicos: JSON.stringify({
        aprobacion_ant: 92,
        reprobacion_ant: 8,
        matricula: 310,
      }),
      foda: JSON.stringify({
        fortalezas: 'Fortaleza serializada en string JSON',
        amenazas: 'Amenaza serializada en string JSON',
      }),
      plan_accion: JSON.stringify({
        metas_institucionales: [
          {
            meta: 'Meta institucional desde string JSON',
            estrategia: 'Estrategia desde string JSON',
          },
        ],
      }),
    });

    const buffer = await generatePmcDocx(fixture);
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('Fortaleza serializada en string JSON');
    expect(text).toContain('Meta institucional desde string JSON');
  });

  // ── TEST 6: Inclusión de Metas Institucionales y Personales en Plan de Acción 
  it('Test 6: Estructura detalladamente las metas institucionales y personales en tablas', async () => {
    const fixture = makePmcFixture();
    const buffer = await generatePmcDocx(fixture);
    const { value: text } = await mammoth.extractRawText({ buffer });

    // Verificación de metas institucionales
    expect(text).toContain('Elevar al 90% la aprobación en asignaturas STEM');
    expect(text).toContain('Reducir el abandono escolar a menos del 2% anual');

    // Verificación de metas personales
    expect(text).toContain('Lic. Fernando Ruiz');
    expect(text).toContain('Docente de Matemáticas');
    expect(text).toContain('Capacitarse en recursos pedagógicos digitales de GeoGebra');
    expect(text).toContain('Mtra. Diana Morales');
    expect(text).toContain('Crear el club de lectura y debate literario estudiantil');
  });

  // ── TEST 7: Diagnóstico FODA y priorización de problemáticas ───────────────
  it('Test 7: Plasma el diagnóstico analítico, FODA y categorías priorizadas en el reporte', async () => {
    const fixture = makePmcFixture();
    const buffer = await generatePmcDocx(fixture);
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('Planta docente completa, estabilidad laboral');
    expect(text).toContain('Vinculación con el Instituto Tecnológico regional');
    expect(text).toContain('Logro Académico y Competencias Fundamentales');
    expect(text).toContain('Permanencia Escolar y Convivencia Democrática');
  });

  // ── TEST 8: Control de Revisiones y firmas reglamentarias ──────────────────
  it('Test 8: Incluye tabla de control de revisiones, autorizaciones y firmas oficiales', async () => {
    const fixture = makePmcFixture();
    const buffer = await generatePmcDocx(fixture);
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('8. PARTICIPANTES, CONTROL DE REVISIONES Y APROBACIÓN');
    expect(text).toContain('Director(a)');
    expect(text).toContain('Mtra. Patricia Mendoza Santos');
    expect(text).toContain('Supervisor(a)');
  });

  // ── TEST 9: Sección IV sin cifras inventadas ante campos nulos o ausentes (H-001)
  it('Test 9: Genera informe parcial sin cifras inventadas (N/D) cuando los indicadores están vacíos o nulos', async () => {
    const emptyIndicatorsFixture = makePmcFixture({
      indicadores_academicos: {},
    });
    const buffer = await generatePmcInformeDocx(emptyIndicatorsFixture, 'parcial');
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('SECCIÓN IV — INDICADORES Y RESULTADOS ACADÉMICOS COMPARATIVOS');
    expect(text).toContain('N/D');

    // Verificar que no se inyectan los números inventados (?? 80, ?? 20, ?? 75, ?? 10, ?? 88, ?? 82, ?? 5, ?? 280)
    expect(text).not.toContain('280 alumnos');
    expect(text).not.toContain('80%');
    expect(text).not.toContain('88%');
    expect(text).not.toContain('75%');
    expect(text).not.toContain('82%');
  });

  // ── TEST 10: Sección IV preserva el 0 legítimo (H-001) ──────────────────────
  it('Test 10: Preserva valores 0 legítimos en informe sin degradarlos a N/D ni a defaults', async () => {
    const zeroIndicatorsFixture = makePmcFixture({
      indicadores_academicos: {
        aprobacion_ant: 0,
        reprobacion_ant: 100,
        abandono_ant: 0,
        et_ant: 0,
        aprobacion_meta: 50,
        abandono_meta: 0,
        et_meta: 40,
        matricula: 150,
      },
    });
    const buffer = await generatePmcInformeDocx(zeroIndicatorsFixture, 'parcial');
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('0.0%');
    expect(text).toContain('100.0%');
    expect(text).toContain('150 estudiantes');
    expect(text).not.toContain('280');
  });

  // ── TEST 11: Sección IV con datos completos en informe ──────────────────────
  it('Test 11: Refleja datos numéricos completos en la tabla comparativa de informe', async () => {
    const fullFixture = makePmcFixture({
      indicadores_academicos: {
        aprobacion_ant: 85.5,
        reprobacion_ant: 14.5,
        abandono_ant: 3.2,
        et_ant: 81.0,
        aprobacion_meta: 92.0,
        abandono_meta: 1.5,
        et_meta: 87.0,
        matricula: 340,
      },
    });
    const buffer = await generatePmcInformeDocx(fullFixture, 'final');
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('85.5%');
    expect(text).toContain('92.0%');
    expect(text).toContain('340 estudiantes');
  });

  // ── TEST 12: Encabezados de ciclos dinámicos en informe (H-010) ────────────
  it('Test 12: Genera encabezados de ciclo y periodos dinámicos en informe DOCX para 2026-2027', async () => {
    const nextCycleFixture = makePmcFixture({
      ciclo_escolar: '2026-2027',
    });
    const buffer = await generatePmcInformeDocx(nextCycleFixture, 'final');
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('INFORME FINAL DEL PLAN DE MEJORA CONTINUA (PMC) 2026-2027');
    expect(text).toContain('Agosto 2026 – Julio 2027 (Ciclo Completo)');
    expect(text).toContain('CICLO 2025-2026 (Referencia)');
    expect(text).toContain('CICLO 2026-2027 (Resultados Finales)');
    expect(text).toContain('Ciclo Escolar 2027-2028');

    // Validación de modo parcial dinámico (H-025)
    const partialBuffer = await generatePmcInformeDocx(nextCycleFixture, 'parcial');
    const { value: partialText } = await mammoth.extractRawText({ buffer: partialBuffer });

    expect(partialText).toContain('INFORME PARCIAL DE AVANCE PMC 2026-2027');
    expect(partialText).toContain('Agosto 2026 – Enero 2027 (1er Semestre)');
    expect(partialText).toContain('Término del Ciclo 2026-2027 (Semestre B)');
  });
});
