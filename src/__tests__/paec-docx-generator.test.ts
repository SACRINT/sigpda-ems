// src/__tests__/paec-docx-generator.test.ts
/**
 * Tests unitarios para paec-docx-generator.ts
 * Fase 15B · SIGPDA-EMS DBEPA Puebla MCCEMS
 *
 * Validación exhaustiva de la normalización defensiva de parseFodaData.
 */

import { describe, it, expect } from 'vitest';
import { parseFodaData, type ParsedFoda } from '@/lib/paec-docx-generator';

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
