// src/__tests__/paec-inegi-demographics.test.ts
/**
 * Test suite para H-315: Ingestión de Estadística Demográfica Oficial INEGI (Formato HTML)
 * Valida el parseo determinista de archivos exportados de "México en Cifras (Localidades)"
 * y el catálogo tipado con búsqueda por municipio y localidad sin datos fabricados.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseInegiHtml } from '@/lib/inegi-demographic-parser';
import { getInegiDemographics, INEGI_LOCALIDADES_PUEBLA } from '@/lib/data/inegi-localidades-puebla';

const SAMPLE_INEGI_FILE = path.resolve(
  process.cwd(),
  '../documentos_referencia/[05] Proyectos_PAEC_y_PMC/DATOS PAEC-PEC/Datos de Poblacion INEGI Coronel Tito Hernandez.xls'
);

describe('H-315: Ingestión Demográfica Oficial INEGI (Censo 2020)', () => {
  it('1. Parsea el archivo real de INEGI para Coronel Tito Hernández extrayendo cifras exactas', () => {
    if (!fs.existsSync(SAMPLE_INEGI_FILE)) {
      console.warn('Archivo de referencia INEGI no encontrado en disco, saltando test de archivo físico.');
      return;
    }

    const htmlContent = fs.readFileSync(SAMPLE_INEGI_FILE, 'utf-8');
    const result = parseInegiHtml(htmlContent);

    expect(result).not.toBeNull();
    if (!result) return;

    // Metadatos geográficos oficiales
    expect(result.entidad).toBe('Puebla');
    expect(result.cveEntidad).toBe('21');
    expect(result.municipio).toBe('Venustiano Carranza');
    expect(result.cveMunicipio).toBe('21194');
    expect(result.localidad).toContain('Coronel Tito Hernández');
    expect(result.cveLocalidad).toBe('211940012');

    // Población oficial
    expect(result.poblacion.total).toBe(2183);
    expect(result.poblacion.femenina).toBe(1177);
    expect(result.poblacion.masculina).toBe(1006);
    expect(result.poblacion.rango0a14).toBe(593);
    expect(result.poblacion.rango15a29).toBe(442);
    expect(result.poblacion.rango30a59).toBe(787);
    expect(result.poblacion.rango60mas).toBe(361);
    expect(result.poblacion.conDiscapacidad).toBe(147);
    expect(result.poblacion.gradoPromedioEscolaridad).toBe(7.69);

    // Viviendas y servicios
    expect(result.viviendas.total).toBe(798);
    expect(result.viviendas.particularesHabitadas).toBe(657);
    expect(result.viviendas.disponenDrenaje).toBe(651);
    expect(result.viviendas.disponenEnergiaElectrica).toBe(638);

    // Entorno Urbano
    expect(result.entornoUrbano.alumbradoPublico?.enTodas).toBe(7);
    expect(result.entornoUrbano.arbolesPalmeras?.enTodas).toBe(36);
  });

  it('2. Retorna null ante HTML vacío, inválido o no correspondiente a INEGI', () => {
    expect(parseInegiHtml('')).toBeNull();
    expect(parseInegiHtml('<html><body><div>No es INEGI</div></body></html>')).toBeNull();
  });

  it('3. getInegiDemographics recupera datos oficiales para Coronel Tito Hernández', () => {
    const data = getInegiDemographics('Venustiano Carranza', 'Coronel Tito Hernández');

    expect(data).not.toBeNull();
    expect(data?.poblacion.total).toBe(2183);
    expect(data?.municipio).toBe('Venustiano Carranza');
    expect(data?.anioCenso).toBe(2020);
  });

  it('4. getInegiDemographics soporta búsqueda por nombre alternativo / alias', () => {
    const data = getInegiDemographics('Venustiano Carranza', 'María Andrea');

    expect(data).not.toBeNull();
    expect(data?.poblacion.total).toBe(2183);
  });

  it('5. getInegiDemographics retorna null si la localidad no existe en el catálogo (Cero Invención)', () => {
    const data = getInegiDemographics('Puebla', 'Localidad Desconocida Sin Censo');
    expect(data).toBeNull();
  });

  it('6. El catálogo INEGI_LOCALIDADES_PUEBLA contiene datos tipados y verificados', () => {
    const keys = Object.keys(INEGI_LOCALIDADES_PUEBLA);
    expect(keys.length).toBeGreaterThanOrEqual(1);

    const first = INEGI_LOCALIDADES_PUEBLA[keys[0]];
    expect(first.poblacion.total).toBeGreaterThan(0);
    expect(first.viviendas.total).toBeGreaterThan(0);
  });
});
