import { describe, it, expect } from 'vitest';
import {
  PMC_CATEGORIAS_OFICIALES,
  PMC_NOMBRES_CATEGORIAS,
  normalizePmcCategoria,
  normalizePmcTema,
} from '@/lib/constants/pmc-categorias';

describe('PMC Categorías y Temas Oficiales (MCCEMS Cuadro 2)', () => {
  it('debe contener exactamente las 3 categorías canónicas oficiales', () => {
    expect(PMC_CATEGORIAS_OFICIALES).toHaveLength(3);
    expect(PMC_CATEGORIAS_OFICIALES[0].nombre).toBe('Desarrollo académico y aprendizaje');
    expect(PMC_CATEGORIAS_OFICIALES[1].nombre).toBe('Gestión y administración escolar');
    expect(PMC_CATEGORIAS_OFICIALES[2].nombre).toBe('Desarrollo socioemocional y prevención de la violencia en la escuela');
  });

  it('debe contener los 10 temas oficiales para la Categoría 1', () => {
    const cat1 = PMC_CATEGORIAS_OFICIALES[0];
    expect(cat1.temas).toHaveLength(10);
    expect(cat1.temas).toContain('Formación y actualización docente');
    expect(cat1.temas).toContain('Propuestas pedagógicas');
    expect(cat1.temas).toContain('Trabajo colegiado');
    expect(cat1.temas).toContain('Proyecto Escolar Comunitario (PEC)');
    expect(cat1.temas).toContain('Movimiento Nacional por la Alfabetización y la Educación (MONAE)');
    expect(cat1.temas).toContain('Clubes de lectura');
    expect(cat1.temas).toContain('Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)');
    expect(cat1.temas).toContain('Orientación y Tutoría');
    expect(cat1.temas).toContain('Planeación didáctica');
    expect(cat1.temas).toContain('Otras actividades académicas (proyectos escolares, p. ej.)');
  });

  it('debe contener los 5 temas oficiales para la Categoría 2', () => {
    const cat2 = PMC_CATEGORIAS_OFICIALES[1];
    expect(cat2.temas).toHaveLength(5);
    expect(cat2.temas).toContain('Vinculación con instituciones educativas');
    expect(cat2.temas).toContain('Vinculación con empresas, fundaciones e instituciones públicas');
    expect(cat2.temas).toContain('Gestión y administración de recursos, equipamiento y servicios');
    expect(cat2.temas).toContain('Seguimiento al desempeño docente en el aula');
    expect(cat2.temas).toContain('Seguimiento de egresados');
  });

  it('debe contener los 3 temas oficiales para la Categoría 3', () => {
    const cat3 = PMC_CATEGORIAS_OFICIALES[2];
    expect(cat3.temas).toHaveLength(3);
    expect(cat3.temas).toContain('Ámbitos de formación socioemocional (Currículum Ampliado)');
    expect(cat3.temas).toContain('Estrategias, programas y/o proyectos sobre violencia');
    expect(cat3.temas).toContain('Orientación educativa');
  });

  describe('normalizePmcCategoria', () => {
    it('debe corregir "Categoría: Procesos para el desarrollo académico y el aprendizaje" al oficial', () => {
      const input = 'Categoría: Procesos para el desarrollo académico y el aprendizaje';
      expect(normalizePmcCategoria(input)).toBe('Desarrollo académico y aprendizaje');
    });

    it('debe normalizar prefijos y variaciones numéricas de categoría', () => {
      expect(normalizePmcCategoria('Categoría 1: Desarrollo académico')).toBe('Desarrollo académico y aprendizaje');
      expect(normalizePmcCategoria('categoria 2')).toBe('Gestión y administración escolar');
      expect(normalizePmcCategoria('Cat 3: Prevención de la violencia')).toBe('Desarrollo socioemocional y prevención de la violencia en la escuela');
      expect(normalizePmcCategoria('gestión de recursos')).toBe('Gestión y administración escolar');
      expect(normalizePmcCategoria('Cultura de paz y convivencia')).toBe('Desarrollo socioemocional y prevención de la violencia en la escuela');
    });

    it('debe manejar cadenas vacías, nulas o indefinidas con fallback canónico a Categoría 1', () => {
      expect(normalizePmcCategoria(undefined)).toBe('Desarrollo académico y aprendizaje');
      expect(normalizePmcCategoria(null)).toBe('Desarrollo académico y aprendizaje');
      expect(normalizePmcCategoria('')).toBe('Desarrollo académico y aprendizaje');
    });
  });

  describe('normalizePmcTema', () => {
    it('debe normalizar términos docentes y COSFAC al tema canónico', () => {
      const cat = 'Desarrollo académico y aprendizaje';
      expect(normalizePmcTema('Actualización docente en COSFAC', cat)).toBe('Formación y actualización docente');
      expect(normalizePmcTema('Cursos de actualización docente', cat)).toBe('Formación y actualización docente');
    });

    it('debe normalizar desfiles y actividades escolares al tema oficial', () => {
      const cat = 'Desarrollo académico y aprendizaje';
      expect(normalizePmcTema('Desfile de banderolas', cat)).toBe('Otras actividades académicas (proyectos escolares, p. ej.)');
      expect(normalizePmcTema('Otras actividades', cat)).toBe('Otras actividades académicas (proyectos escolares, p. ej.)');
    });

    it('debe normalizar temas socioemocionales al tema canónico correspondiente', () => {
      const cat = 'Desarrollo socioemocional y prevención de la violencia en la escuela';
      expect(normalizePmcTema('Cultura de Paz', cat)).toBe('Estrategias, programas y/o proyectos sobre violencia');
      expect(normalizePmcTema('Currículum ampliado', cat)).toBe('Ámbitos de formación socioemocional (Currículum Ampliado)');
    });

    it('debe preservar temas exactos sin alteración', () => {
      const cat = 'Gestión y administración escolar';
      expect(normalizePmcTema('Seguimiento de egresados', cat)).toBe('Seguimiento de egresados');
    });
  });
});
