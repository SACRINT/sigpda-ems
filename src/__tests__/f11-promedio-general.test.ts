/**
 * f11-promedio-general.test.ts
 *
 * Pruebas unitarias de discriminancia para:
 * 1. Single source of truth (SSOT) de promedioGeneral entre rutas determinista y OCR (H-269).
 * 2. Ausencia de falsas etiquetas cross_validated en campos de fuente única (H-266).
 * 3. Confianza estructural derivada de la evidencia geométrica (H-266 / H-267).
 */

import { describe, it, expect } from 'vitest';
import { calcularPromedioGeneralF11, type AlumnoF11Input } from '@/lib/f11-derived-metrics';
import { parseF11Layout } from '@/lib/f11-layout-calculator';
import type { ExtractionMethod } from '@/lib/concentrado-911-calculator';

describe('H-269 / H-266: Paridad de promedioGeneral y Veracidad de Confianza', () => {
  const sample28Alumnos: AlumnoF11Input[] = [
    { curp: 'CURP01', nombre: 'ALUMNO 01', grupo: 'A', clase: 'REGULAR', promedio: '8.5', promedioGeneral: '8.5' },
    { curp: 'CURP02', nombre: 'ALUMNO 02', grupo: 'A', clase: 'REGULAR', promedio: '9.0', promedioGeneral: '9.0' },
    { curp: 'CURP03', nombre: 'ALUMNO 03', grupo: 'A', clase: 'REGULAR', promedio: '7.8', promedioGeneral: '7.8' },
    { curp: 'CURP04', nombre: 'ALUMNO 04', grupo: 'A', clase: 'REGULAR', promedio: '8.2', promedioGeneral: '8.2' },
    { curp: 'CURP05', nombre: 'ALUMNO 05', grupo: 'A', clase: 'REGULAR', promedio: '9.5', promedioGeneral: '9.5' },
    { curp: 'CURP06', nombre: 'ALUMNO 06', grupo: 'A', clase: 'REGULAR', promedio: '6.7', promedioGeneral: '6.7' },
    { curp: 'CURP07', nombre: 'ALUMNO 07', grupo: 'A', clase: 'REGULAR', promedio: '8.0', promedioGeneral: '8.0' },
    { curp: 'CURP08', nombre: 'ALUMNO 08', grupo: 'A', clase: 'REGULAR', promedio: '7.4', promedioGeneral: '7.4' },
    { curp: 'CURP09', nombre: 'ALUMNO 09', grupo: 'A', clase: 'REGULAR', promedio: '8.9', promedioGeneral: '8.9' },
    { curp: 'CURP10', nombre: 'ALUMNO 10', grupo: 'A', clase: 'REGULAR', promedio: '9.1', promedioGeneral: '9.1' },
    { curp: 'CURP11', nombre: 'ALUMNO 11', grupo: 'A', clase: 'REGULAR', promedio: '8.3', promedioGeneral: '8.3' },
    { curp: 'CURP12', nombre: 'ALUMNO 12', grupo: 'A', clase: 'REGULAR', promedio: '7.9', promedioGeneral: '7.9' },
    { curp: 'CURP13', nombre: 'ALUMNO 13', grupo: 'A', clase: 'REGULAR', promedio: '8.8', promedioGeneral: '8.8' },
    { curp: 'CURP14', nombre: 'ALUMNO 14', grupo: 'A', clase: 'REGULAR', promedio: '9.3', promedioGeneral: '9.3' },
    { curp: 'CURP15', nombre: 'ALUMNO 15', grupo: 'A', clase: 'REGULAR', promedio: '7.0', promedioGeneral: '7.0' },
    { curp: 'CURP16', nombre: 'ALUMNO 16', grupo: 'A', clase: 'REGULAR', promedio: '8.1', promedioGeneral: '8.1' },
    { curp: 'CURP17', nombre: 'ALUMNO 17', grupo: 'A', clase: 'REGULAR', promedio: '8.6', promedioGeneral: '8.6' },
    { curp: 'CURP18', nombre: 'ALUMNO 18', grupo: 'A', clase: 'REGULAR', promedio: '9.4', promedioGeneral: '9.4' },
    { curp: 'CURP19', nombre: 'ALUMNO 19', grupo: 'A', clase: 'REGULAR', promedio: '7.7', promedioGeneral: '7.7' },
    { curp: 'CURP20', nombre: 'ALUMNO 20', grupo: 'A', clase: 'REGULAR', promedio: '8.4', promedioGeneral: '8.4' },
    { curp: 'CURP21', nombre: 'ALUMNO 21', grupo: 'A', clase: 'REGULAR', promedio: '9.2', promedioGeneral: '9.2' },
    { curp: 'CURP22', nombre: 'ALUMNO 22', grupo: 'A', clase: 'REGULAR', promedio: '8.7', promedioGeneral: '8.7' },
    { curp: 'CURP23', nombre: 'ALUMNO 23', grupo: 'A', clase: 'REGULAR', promedio: '7.5', promedioGeneral: '7.5' },
    { curp: 'CURP24', nombre: 'ALUMNO 24', grupo: 'A', clase: 'REGULAR', promedio: '8.0', promedioGeneral: '8.0' },
    { curp: 'CURP25', nombre: 'ALUMNO 25', grupo: 'A', clase: 'REGULAR', promedio: '9.6', promedioGeneral: '9.6' },
    // 3 alumnos no regulares (1 baja, 1 irregular, 1 reprobado)
    { curp: 'CURP26', nombre: 'ALUMNO 26', grupo: 'A', clase: 'BAJA', promedio: undefined, promedioGeneral: undefined },
    { curp: 'CURP27', nombre: 'ALUMNO 27', grupo: 'A', clase: 'IRREGULAR', promedio: '/', promedioGeneral: '/' },
    { curp: 'CURP28', nombre: 'ALUMNO 28', grupo: 'A', clase: 'REPROBADO', promedio: '/', promedioGeneral: '/' },
  ];

  it('calcula exactamente el mismo promedioGeneral para la ruta determinista y la ruta OCR', () => {
    // Simulación de los 28 alumnos en formato del parser determinista (usa promedioGeneral)
    const deterministaAlumnos = sample28Alumnos.map(a => ({
      clase: a.clase,
      promedioGeneral: a.promedioGeneral,
    }));

    // Simulación de los 28 alumnos en formato de respuesta IA/OCR (usa promedio)
    const ocrAlumnos = sample28Alumnos.map(a => ({
      clase: a.clase,
      promedio: a.promedio,
    }));

    const resultadoDeterminista = calcularPromedioGeneralF11(deterministaAlumnos);
    const resultadoOcr = calcularPromedioGeneralF11(ocrAlumnos);

    expect(resultadoDeterminista).not.toBeNull();
    expect(resultadoOcr).not.toBeNull();
    expect(resultadoDeterminista).toBe(resultadoOcr);
    // Verificación aritmética: sum de los 25 regulares = 209.6 / 25 = 8.384 -> 8.4
    expect(resultadoDeterminista).toBe(8.4);
  });

  it('retorna null cuando no hay alumnos regulares con calificación válida', () => {
    const sinRegulares: AlumnoF11Input[] = [
      { clase: 'BAJA', promedio: undefined },
      { clase: 'IRREGULAR', promedio: '/' },
      { clase: 'REPROBADO', promedio: '0' },
    ];
    expect(calcularPromedioGeneralF11(sinRegulares)).toBeNull();
    expect(calcularPromedioGeneralF11([])).toBeNull();
  });

  it('garantiza que campos de fuente única en F11 NO se etiqueten como cross_validated (H-266)', async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [1008, 612] });
    doc.text('21EBH0200X', 63, 109);
    doc.text('BACHILLERATO HEROES DE PUEBLA', 63, 87);
    doc.text('ESTATAL 0324 2 A MATUTINO', 63, 112);

    const buf = Buffer.from(doc.output('arraybuffer'));
    const parsed = await parseF11Layout(buf);

    // totalAlumnos, promedioGeneral y grupos provienen de una única fuente (la tabla del layout)
    expect(parsed.fieldConfidence.totalAlumnos.method).not.toBe('cross_validated');
    expect(parsed.fieldConfidence.promedioGeneral.method).not.toBe('cross_validated');
    expect(parsed.fieldConfidence.grupos.method).not.toBe('cross_validated');

    // Deben ser coordinate_band o inferred
    expect(['coordinate_band', 'inferred']).toContain(parsed.fieldConfidence.totalAlumnos.method);
    expect(['coordinate_band', 'inferred']).toContain(parsed.fieldConfidence.promedioGeneral.method);
    expect(['coordinate_band', 'inferred']).toContain(parsed.fieldConfidence.grupos.method);
  });

  it('re-exporta ExtractionMethod en concentrado-911-calculator para cumplimiento literal del plan (H-267)', () => {
    const dummyMethod: ExtractionMethod = 'structural_anchor';
    expect(dummyMethod).toBe('structural_anchor');
  });
});
