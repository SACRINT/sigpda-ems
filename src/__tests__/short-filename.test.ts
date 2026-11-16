import { describe, expect, it } from 'vitest';
import {
  buildShortFilename,
  buildShortZipName,
  sanitizeFilenamePart,
  shortSubjectCode,
} from '@/lib/short-filename';

describe('short-filename', () => {
  it('abrevia Pensamiento Matemático III sin arrastrar el subtítulo', () => {
    expect(
      shortSubjectCode(
        'Pensamiento Matemático III. Pensamientos algebraico e introducción a geometría plana'
      )
    ).toBe('PM3');
  });

  it('abrevia asignaturas con numeral romano y palabras funcionales', () => {
    expect(shortSubjectCode('Taller de Pensamiento Variacional I')).toBe('TPV1');
    expect(shortSubjectCode('Tutoría y Orientación Educativa')).toBe('TOE');
  });

  it('genera nombres cortos y seguros para archivos y ZIP', () => {
    const subject =
      'Pensamiento Matemático III. Pensamientos algebraico e introducción a geometría plana';
    expect(buildShortFilename('01_Planeacion', subject, 'pdf')).toBe('01_Planeacion_PM3.pdf');
    expect(buildShortZipName('Paquete', subject)).toBe('Paquete_PM3.zip');
    expect(sanitizeFilenamePart('  nombre: con / caracteres * raros  ', 20)).toBe(
      'nombre_con_caractere'
    );
  });

  it('mantiene los nombres por debajo de un límite seguro para Windows', () => {
    const subject = 'Pensamiento Matemático III. Pensamientos algebraico e introducción a geometría plana';
    const name = buildShortFilename('09_Infografias_Sinteticas_SACRINT', subject, 'pdf');
    expect(name.length).toBeLessThanOrEqual(60);
  });
});
