// src/__tests__/pips-docx-generator.test.ts
/**
 * Tests unitarios para pips-docx-generator.ts
 * Fase 15C · SIGPDA-EMS DBEPA Puebla MCCEMS
 *
 * Validación de generación de Cartografía de Supervisión PIPS (DOCX).
 * Valida integridad binaria y contenido textual mediante mammoth.
 */

import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import { generatePipsDocx } from '@/lib/pips-docx-generator';
import type { PipsPlantele, PipsObjetivo, PipsCronogramaActividad } from '@/types/pips';

// ── Fixture Factory ──────────────────────────────────────────────────────────
function makePipsFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const planteles: PipsPlantele[] = [
    {
      no: 1,
      cct: '21EBH0012A',
      nombre: 'Bachillerato General Oficial Lic. Benito Juárez',
      municipio: 'San Pedro Cholula',
      localidad: 'Centro',
      hombres: 120,
      mujeres: 140,
      total: 260,
    },
    {
      no: 2,
      cct: '21EBH0045B',
      nombre: 'Bachillerato Digital Núm. 14',
      municipio: 'Cuautlancingo',
      localidad: 'Sanctorum',
      hombres: 65,
      mujeres: 75,
      total: 140,
    },
  ];

  const problematicas = [
    {
      eje: 'Logro Académico',
      titulo: 'Rezago en Pensamiento Matemático y Habilidades de Lectura',
      descripcion: 'Bajo rendimiento en evaluaciones diagnósticas en álgebra elemental.',
      prioridad: 'Alta',
    },
    {
      eje: 'Convivencia Escolar',
      titulo: 'Ausentismo recurrente en temporadas agrícolas',
      descripcion: 'Diserción temporal de estudiantes durante ciclos de cosecha local.',
      prioridad: 'Media',
    },
  ];

  const objetivos: PipsObjetivo[] = [
    {
      id: 'obj-1',
      numero: 1,
      descripcion: 'Implementar comunidades de aprendizaje docente entre planteles de la zona.',
      metas: [
        {
          meta: '80% de docentes participando en talleres colegiados.',
          indicador: 'Porcentaje de asistencia en sesiones de zona.',
          responsable: 'Supervisor y ATP',
          fecha: 'Enero 2027',
        },
      ],
    },
  ];

  const cronograma: PipsCronogramaActividad[] = [
    {
      mes: 'Septiembre',
      actividad: 'Visita de acompañamiento técnico-pedagógico al Bachillerato Lic. Benito Juárez',
      objetivo: 'Diagnóstico en aula',
      responsable: 'Supervisor de Zona y ATP',
      recursos: 'Guía de observación',
      indicador: '1 visita realizada',
    },
  ];

  const evaluacion = [
    {
      indicador: 'Tasa de Aprobación Global de Zona',
      meta: 'Incrementar la aprobación a un mínimo de 88%',
      instrumento: 'Rúbricas institucionales y reportes estadísticos trimestrales',
    },
  ];

  return {
    id: 'pips-test-001',
    zona_clave: '21FZP0012X',
    zona_nombre: 'Zona Escolar 012 Cholula',
    supervisor_name: 'Mtro. Roberto Morales Sánchez',
    municipio_sede: 'San Pedro Cholula, Pue.',
    municipios_atiende: 'San Pedro Cholula, Cuautlancingo, Coronango',
    num_planteles: 2,
    subsistema: 'Bachilleratos Estatales',
    modalidad: 'General y Digital',
    ciclo_escolar: '2026-2027',
    atps: 'Dra. María Elena Ramos (Lenguaje), Mtro. Carlos Vega (STEM)',
    presentacion: 'La presente Cartografía de Zona establece las líneas estratégicas de supervisión y acompañamiento pedagógico.',
    contexto_sociocultural: 'Zona metropolitana con contraste entre áreas semiurbanas industriales y comunidades agrícolas tradicionales.',
    retos_zona: 'Consolidar la implementación del MCCEMS y abatir el abandono escolar mediante tutorías focalizadas.',
    planteles_json: planteles,
    problematicas_json: problematicas,
    objetivos_especificos_json: objetivos,
    cronograma_json: cronograma,
    evaluacion_json: evaluacion,
    ...overrides,
  };
}

describe('pips-docx-generator — Generador de Cartografía PIPS de Zona Escolar', () => {
  // ── TEST 1: Happy-path con fixture completo y validación de texto extraído ─
  it('Test 1: Genera documento DOCX válido con fixture completo y datos institucionales', async () => {
    const fixture = makePipsFixture();
    const buffer = await generatePipsDocx(fixture);

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(5000);

    // Verificación de firma mágica de archivo ZIP / DOCX (PK\x03\x04)
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);

    // Extracción de texto real mediante mammoth
    const { value: docText } = await mammoth.extractRawText({ buffer });

    expect(docText).toContain('SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA');
    expect(docText).toContain('CARTOGRAFÍA DE ZONA ESCOLAR');
    expect(docText).toContain('Zona Escolar 012 Cholula');
    expect(docText).toContain('Mtro. Roberto Morales Sánchez');
    expect(docText).toContain('Bachillerato General Oficial Lic. Benito Juárez');
    expect(docText).toContain('Rezago en Pensamiento Matemático');
  });

  // ── TEST 2: Cálculo y sumatoria agregada de matrícula escolar ──────────────
  it('Test 2: Calcula y reporta con exactitud los totales agregados de matrícula de la zona', async () => {
    const fixture = makePipsFixture({
      num_planteles: 2,
      planteles_json: [
        { total: 300, hombres: 140, mujeres: 160 },
        { total: 200, hombres: 95, mujeres: 105 },
      ],
    });

    const buffer = await generatePipsDocx(fixture);
    const { value: docText } = await mammoth.extractRawText({ buffer });

    // Total = 500, Hombres = 235, Mujeres = 265
    expect(docText).toContain('500 alumnos (235H / 265M)');
  });

  // ── TEST 3: Resiliencia ante datos mínimos y ausencia de campos opcionales ──
  it('Test 3: Genera documento sin crashear cuando faltan campos opcionales o son nulos', async () => {
    const minimalFixture = {
      zona_clave: '21FZP9999Z',
      zona_nombre: 'Zona Emergente 999',
      ciclo_escolar: '2026-2027',
      num_planteles: 0,
      subsistema: 'Bachillerato General',
      modalidad: 'Escolarizada',
    };

    const buffer = await generatePipsDocx(minimalFixture);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    const { value: docText } = await mammoth.extractRawText({ buffer });
    expect(docText).toContain('Zona Emergente 999');
    expect(docText).toContain('1. DATOS GENERALES DE LA SUPERVISIÓN');
  });

  // ── TEST 4: Manejo de colecciones JSON vacías ──────────────────────────────
  it('Test 4: Procesa arrays JSON vacíos sin generar errores de iteración', async () => {
    const emptyCollectionsFixture = makePipsFixture({
      planteles_json: [],
      problematicas_json: [],
      objetivos_especificos_json: [],
      cronograma_json: [],
      evaluacion_json: [],
    });

    const buffer = await generatePipsDocx(emptyCollectionsFixture);
    expect(buffer).toBeDefined();

    const { value: docText } = await mammoth.extractRawText({ buffer });
    expect(docText).toContain('4. DIAGNÓSTICO DE LA ZONA ESCOLAR');
    expect(docText).toContain('5. OBJETIVOS Y METAS DEL PIPS');
    expect(docText).toContain('6. CRONOGRAMA DE IMPLEMENTACIÓN');
  });

  // ── TEST 5: Presencia y orden de las 9 secciones oficiales DBEPA ───────────
  it('Test 5: Preserva la estructura normativa de las 9 secciones oficiales DBEPA', async () => {
    const fixture = makePipsFixture();
    const buffer = await generatePipsDocx(fixture);
    const { value: docText } = await mammoth.extractRawText({ buffer });

    const expectedSections = [
      '1. DATOS GENERALES DE LA SUPERVISIÓN',
      '2. PRESENTACIÓN DEL SUPERVISOR ESCOLAR',
      '3. REFLEXIÓN DEL PIPS ANTERIOR',
      '4. DIAGNÓSTICO DE LA ZONA ESCOLAR',
      '5. OBJETIVOS Y METAS DEL PIPS',
      '6. CRONOGRAMA DE IMPLEMENTACIÓN',
      '7. MÉTODOS DE SEGUIMIENTO Y OBSERVACIÓN DEL CAMBIO',
      '8. EVALUACIÓN DEL PLAN',
      '9. REFERENCIAS',
      '10. VALIDACIÓN Y FIRMAS',
    ];

    for (const section of expectedSections) {
      expect(docText).toContain(section);
    }
  });

  // ── TEST 6: Robustez ante campos JSON no array o valores atípicos ─────────
  it('Test 6: Tolera valores no-array en campos _json (null, boolean, string) defensivamente', async () => {
    const corruptedFixture = makePipsFixture({
      planteles_json: 'invalido_no_es_array',
      problematicas_json: null,
      objetivos_especificos_json: 12345,
      cronograma_json: false,
      evaluacion_json: undefined,
    });

    await expect(generatePipsDocx(corruptedFixture)).resolves.toBeDefined();
    const buffer = await generatePipsDocx(corruptedFixture);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});
