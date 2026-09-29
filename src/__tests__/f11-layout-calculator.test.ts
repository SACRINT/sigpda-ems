import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseF11Layout,
  calcularMetaSugeridaBandas,
  detectarBandaEncabezadoGrupo,
  BANDA_ENCABEZADO_GRUPO_DEFAULT,
} from '../lib/f11-layout-calculator';

describe('CP-2 / H-241: banda Y dinámica del encabezado de grupo', () => {
  const rowAt = (y: number) => [
    { str: 'BACHILLERATO GRAL. ESTATAL 0324', transform: [1, 0, 0, 1, 63, y] },
    { str: '2', transform: [1, 0, 0, 1, 400, y] },
    { str: 'A', transform: [1, 0, 0, 1, 415, y] },
    { str: 'MATUTINO', transform: [1, 0, 0, 1, 430, y] },
  ];

  it('lee la fila de grupo en la posición clásica y ≈ 503', () => {
    expect(detectarBandaEncabezadoGrupo(rowAt(503))).toBe(503);
    expect(BANDA_ENCABEZADO_GRUPO_DEFAULT).toBe(503);
  });

  it('detecta la fila cuando el export la desplaza fuera de la banda 493..513', () => {
    expect(detectarBandaEncabezadoGrupo(rowAt(480))).toBe(480);
    expect(detectarBandaEncabezadoGrupo(rowAt(470))).toBe(470);
    expect(detectarBandaEncabezadoGrupo(rowAt(520))).toBe(520);
    expect(detectarBandaEncabezadoGrupo(rowAt(545))).toBe(545);
  });

  it('prefiere la fila que valida el patrón de grupo aunque haya otra clave del plantel en la página', () => {
    const items = [
      { str: 'BACHILLERATO GRAL. ESTATAL 0324', transform: [1, 0, 0, 1, 63, 60] },
      { str: 'PIE DE PAGINA', transform: [1, 0, 0, 1, 63, 60] },
      ...rowAt(498),
    ];

    expect(detectarBandaEncabezadoGrupo(items)).toBe(498);
  });

  it('retorna null cuando no hay clave del plantel ni fila de grupo', () => {
    const items = [{ str: 'ALUMNO SIN GRUPO', transform: [1, 0, 0, 1, 200, 393] }];

    expect(detectarBandaEncabezadoGrupo(items)).toBeNull();
  });

  it('límite conocido: una fila de plantel sin horario MATUTINO no valida como encabezado de grupo', () => {
    const items = [
      { str: 'BACHILLERATO GRAL. ESTATAL 0324', transform: [1, 0, 0, 1, 63, 503] },
      { str: '2', transform: [1, 0, 0, 1, 400, 503] },
      { str: 'A', transform: [1, 0, 0, 1, 415, 503] },
      { str: 'VESPERTINO', transform: [1, 0, 0, 1, 430, 503] },
    ];

    expect(detectarBandaEncabezadoGrupo(items)).toBeNull();
  });
});

describe('f11-layout-calculator (H-219)', () => {
  const fixturePath = path.resolve(
    '..',
    'documentos_referencia',
    '[05] Proyectos_PAEC_y_PMC',
    '911 y F11',
    'Heroes',
    'F11 TODOS LOS GRUPOS SEMESTRE B 2025-2026.pdf'
  );

  it('calcula metas sugeridas por regla de bandas correctamente', () => {
    // <= 5 -> 0.0
    expect(calcularMetaSugeridaBandas(0.0)).toBe(0.0);
    expect(calcularMetaSugeridaBandas(4.5)).toBe(0.0);
    expect(calcularMetaSugeridaBandas(5.0)).toBe(0.0);

    // 5 < x <= 20 -> actual - 5
    expect(calcularMetaSugeridaBandas(8.9)).toBe(3.9);
    expect(calcularMetaSugeridaBandas(12.5)).toBe(7.5);
    expect(calcularMetaSugeridaBandas(16.1)).toBe(11.1);
    expect(calcularMetaSugeridaBandas(20.0)).toBe(15.0);

    // > 20 -> actual - 10
    expect(calcularMetaSugeridaBandas(25.0)).toBe(15.0);
    expect(calcularMetaSugeridaBandas(41.2)).toBe(31.2);
  });

  const fixtureDisponible = fs.existsSync(fixturePath);

  it.skipIf(!fixtureDisponible)('procesa el archivo real de Heroes de la Patria con precision exacta (n=189)', async () => {
    const buffer = fs.readFileSync(fixturePath);
    const result = await parseF11Layout(buffer);

    // Verificaciones institucionales
    expect(result.schoolCct).toBe('21EBH0200X');
    expect(result.schoolName).toContain('HEROES DE LA PATRIA');
    expect(result.directorName).toBe('ADRIAN HERNANDEZ CRUZ');

    // Verificación de totales y clasificación oficial (D2)
    expect(result.totalAlumnos).toBe(189);
    expect(result.totalConCalificacion).toBe(179);
    expect(result.bajas).toBe(10);
    expect(result.regulares).toBe(134);
    expect(result.irregulares).toBe(23);
    expect(result.reprobados).toBe(22);
    expect(result.aprobados).toBe(157); // 134 + 23

    // Verificación de porcentajes oficiales (base 189)
    expect(result.porcentajes.aprobados).toBe(83.1);
    expect(result.porcentajes.regulares).toBe(70.9);
    expect(result.porcentajes.irregulares).toBe(12.2);
    expect(result.porcentajes.reprobados).toBe(11.6);
    expect(result.porcentajes.bajas).toBe(5.3);

    // Verificación de tamaños de grupo
    expect(result.grupos['2A']).toBe(16);
    expect(result.grupos['2B']).toBe(15);
    expect(result.grupos['2C']).toBe(17);
    expect(result.grupos['2D']).toBe(8);
    expect(result.grupos['4A']).toBe(23);
    expect(result.grupos['4B']).toBe(21);
    expect(result.grupos['4C']).toBe(19);
    expect(result.grupos['6A']).toBe(21);
    expect(result.grupos['6B']).toBe(21);
    expect(result.grupos['6C']).toBe(18);

    // Test obligatorio de 2° grado (n = 16+15+17+8 = 56)
    const mat2 = result.materias.filter(m =>
      ['2A', '2B', '2C', '2D'].some(g => (m.detallePorGrupo[g]?.n || 0) > 0)
    );

    const findMat = (pattern: RegExp) => mat2.find(m => pattern.test(m.materia));

    const conservacion = findMat(/CONSERVACI[OÓ]N DE LA ENERG[IÍ]A/i);
    expect(conservacion).toBeDefined();
    expect(conservacion?.n).toBe(56);
    expect(conservacion?.reprobados).toBe(5);
    expect(conservacion?.reprobacion_actual).toBe(8.9);
    expect(conservacion?.reprobacion_meta_sugerida).toBe(3.9);

    const cienciasSoc = findMat(/CIENCIAS SOCIALES II/i);
    expect(cienciasSoc).toBeDefined();
    expect(cienciasSoc?.n).toBe(56);
    expect(cienciasSoc?.reprobados).toBe(0);
    expect(cienciasSoc?.reprobacion_actual).toBe(0.0);
    expect(cienciasSoc?.reprobacion_meta_sugerida).toBe(0.0);

    const culturaDig = findMat(/CULTURA DIGITAL II/i);
    expect(culturaDig).toBeDefined();
    expect(culturaDig?.n).toBe(56);
    expect(culturaDig?.reprobados).toBe(7);
    expect(culturaDig?.reprobacion_actual).toBe(12.5);
    expect(culturaDig?.reprobacion_meta_sugerida).toBe(7.5);

    const humanidades = findMat(/HUMANIDADES II/i);
    expect(humanidades).toBeDefined();
    expect(humanidades?.n).toBe(56);
    expect(humanidades?.reprobados).toBe(7);
    expect(humanidades?.reprobacion_actual).toBe(12.5);
    expect(humanidades?.reprobacion_meta_sugerida).toBe(7.5);

    const ingles = findMat(/INGL[EÉ]S II/i);
    expect(ingles).toBeDefined();
    expect(ingles?.n).toBe(56);
    expect(ingles?.reprobados).toBe(9);
    expect(ingles?.reprobacion_actual).toBe(16.1);
    expect(ingles?.reprobacion_meta_sugerida).toBe(11.1);

    const lengua = findMat(/LENGUA Y COMUNICACI[OÓ]N II/i);
    expect(lengua).toBeDefined();
    expect(lengua?.n).toBe(56);
    expect(lengua?.reprobados).toBe(5);
    expect(lengua?.reprobacion_actual).toBe(8.9);
    expect(lengua?.reprobacion_meta_sugerida).toBe(3.9);

    const pensamiento = findMat(/PENSAMIENTO MATEM[AÁ]TICO II/i);
    expect(pensamiento).toBeDefined();
    expect(pensamiento?.n).toBe(56);
    expect(pensamiento?.reprobados).toBe(7);
    expect(pensamiento?.reprobacion_actual).toBe(12.5);
    expect(pensamiento?.reprobacion_meta_sugerida).toBe(7.5);

    const taller = findMat(/TALLER DE CIENCIAS I/i);
    expect(taller).toBeDefined();
    expect(taller?.n).toBe(56);
    expect(taller?.reprobados).toBe(9);
    expect(taller?.reprobacion_actual).toBe(16.1);
    expect(taller?.reprobacion_meta_sugerida).toBe(11.1);

    // Suma de materias en 5 en 2° grado = 49 (5+0+7+7+9+5+7+9 = 49)
    const sumaReprobados2 =
      (conservacion?.reprobados || 0) +
      (cienciasSoc?.reprobados || 0) +
      (culturaDig?.reprobados || 0) +
      (humanidades?.reprobados || 0) +
      (ingles?.reprobados || 0) +
      (lengua?.reprobados || 0) +
      (pensamiento?.reprobados || 0) +
      (taller?.reprobados || 0);
    expect(sumaReprobados2).toBe(49);

    // Reprobaciones de 2° por grupo: 2A=1, 2B=0, 2C=40, 2D=8 -> suma = 49
    const rep2A = mat2.reduce((acc, m) => acc + (m.detallePorGrupo['2A']?.reprobados || 0), 0);
    const rep2B = mat2.reduce((acc, m) => acc + (m.detallePorGrupo['2B']?.reprobados || 0), 0);
    const rep2C = mat2.reduce((acc, m) => acc + (m.detallePorGrupo['2C']?.reprobados || 0), 0);
    const rep2D = mat2.reduce((acc, m) => acc + (m.detallePorGrupo['2D']?.reprobados || 0), 0);
    expect(rep2A).toBe(1);
    expect(rep2B).toBe(0);
    expect(rep2C).toBe(40);
    expect(rep2D).toBe(8);

    // CP-1 / M2: Verificación de trazabilidad y confidence score por campo en F11
    expect(result.fieldConfidence).toBeDefined();
    expect(result.fieldConfidence.schoolCct.method).toBe('regex_fulltext');
    expect(result.fieldConfidence.schoolCct.fuente).toBe('regex_texto');
    expect(result.fieldConfidence.schoolCct.confidence).toBe(0.95);
    expect(result.fieldConfidence.directorName.method).toBe('structural_anchor');
    expect(result.fieldConfidence.directorName.fuente).toBe('ancla_estructural');
    expect(result.fieldConfidence.directorName.confidence).toBe(0.92);
    expect(result.fieldConfidence.directorName.requiresManualValidation).toBe(false);
    expect(result.fieldConfidence.totalAlumnos.method).toBe('cross_validated');
    expect(result.fieldConfidence.totalAlumnos.fuente).toBe('validacion_cruzada');
    expect(result.fieldConfidence.totalAlumnos.confidence).toBe(0.99);
    expect(result.fieldConfidence.promedioGeneral.method).toBe('cross_validated');
    expect(result.fieldConfidence.bandaEncabezadoGrupo.method).toBe('structural_anchor');
    expect(result.fieldConfidence.bandaEncabezadoGrupo.confidence).toBe(0.98);
  });
});
