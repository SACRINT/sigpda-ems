import { describe, it, expect } from 'vitest';
import {
  getPaecRegulatoryContext,
  CRITERIO_8_VERBATIM,
  CRITERIO_23_VERBATIM,
} from '@/lib/paec-regulatory-context';

describe('H-311: PAEC Regulatory Context Pack', () => {
  it('retorna cadena no vacía para cada paso del 1 al 9', () => {
    for (let step = 1; step <= 9; step++) {
      const ctx = getPaecRegulatoryContext(step);
      expect(ctx).toBeTruthy();
      expect(ctx.length).toBeGreaterThan(100);
    }
  });

  it('respeta el límite estricto de <= 6000 caracteres para todos los pasos', () => {
    for (let step = 1; step <= 9; step++) {
      const ctx = getPaecRegulatoryContext(step);
      expect(ctx.length).toBeLessThanOrEqual(6000);
    }
  });

  it('retorna cadena vacía para pasos inválidos (0, 10, -1)', () => {
    expect(getPaecRegulatoryContext(0)).toBe('');
    expect(getPaecRegulatoryContext(10)).toBe('');
    expect(getPaecRegulatoryContext(-1)).toBe('');
  });

  it('Paso 1 incluye textos verbatim de los Criterios 2, 3, 4, 5 y 6', () => {
    const ctx = getPaecRegulatoryContext(1);
    expect(ctx).toContain('2. En el Diagnóstico colectivo se identifican los 4 ejes temáticos:');
    expect(ctx).toContain('3. El diagnóstico describe las características de la comunidad:');
    expect(ctx).toContain('- Seguridad');
    expect(ctx).toContain('- Participación comunitaria');
    expect(ctx).toContain('- Recursos y servicios');
    expect(ctx).toContain('- Medio ambiente');
    expect(ctx).toContain('4. El diagnóstico describe las características de la educación:');
    expect(ctx).toContain('- Indicadores educativos');
    expect(ctx).toContain('- Programas o proyectos');
    expect(ctx).toContain('5. El análisis de información se realiza mediante alguna metodología: FODA, Árbol de Problemas, Diagrama de Ishikawa u otros');
    expect(ctx).toContain('6. La problemática o necesidad seleccionada se deriva de la información contenida en el diagnóstico colectivo.');
  });

  it('Paso 2 incluye textos verbatim de los Criterios 1, 7, 9 y 10', () => {
    const ctx = getPaecRegulatoryContext(2);
    expect(ctx).toContain('1. Comité del plantel:');
    expect(ctx).toContain('Figuras mínimas obligatorias:');
    expect(ctx).toContain('- Responsable de plantel (1)');
    expect(ctx).toContain('- Docentes (2)');
    expect(ctx).toContain('- Estudiantes (2)');
    expect(ctx).toContain('- Padres de familia (1)');
    expect(ctx).toContain('7. La problemática o necesidad seleccionada se justifica para ser atendida desde la acción de colectivo estudiantil y la comunidad, considerando a las siguientes razones:');
    expect(ctx).toContain('- Magnitud');
    expect(ctx).toContain('- Interés.');
    expect(ctx).toContain('- Factibilidad.');
    expect(ctx).toContain('- Oportunidad.');
    expect(ctx).toContain('9. El propósito del PEC describe el qué y para qué, vinculado a la problemática que necesidad seleccionada.');
    expect(ctx).toContain('10. Periodo de realización del PEC (semestral o anual).');
  });

  it('Pasos 3 y 5 incluyen texto verbatim del Criterio 14', () => {
    for (const step of [3, 5]) {
      const ctx = getPaecRegulatoryContext(step);
      expect(ctx).toContain('14. En el Abordaje de las UAC para el desarrollo del PEC se identifica la articulación de:');
      expect(ctx).toContain('- Currículo fundamental.');
      expect(ctx).toContain('- Progresiones de aprendizaje por semestre.');
      expect(ctx).toContain('- Fases del proyecto.');
    }
  });

  it('Paso 4 incluye textos verbatim de los Criterios 10, 11, 12 y 13', () => {
    const ctx = getPaecRegulatoryContext(4);
    expect(ctx).toContain('10. Periodo de realización del PEC (semestral o anual).');
    expect(ctx).toContain('11. Las fases (etapas) del PEC se describen de manera coherente y articulada para lograr el propósito.');
    expect(ctx).toContain('12. Las actividades propician la vinculación de la escuela con la Comunidad.');
    expect(ctx).toContain('13. Las actividades descritas están relacionadas y aportan al desarrollo de su fase correspondiente.');
  });

  it('Pasos 6 y 7 incluyen textos verbatim de los Criterios 15, 16 y 17', () => {
    for (const step of [6, 7]) {
      const ctx = getPaecRegulatoryContext(step);
      expect(ctx).toContain('15. Integración del plan operativo.');
      expect(ctx).toContain('- Fase del proyecto.');
      expect(ctx).toContain('- Actividad.');
      expect(ctx).toContain('- UAC');
      expect(ctx).toContain('- Progresión de aprendizaje.');
      expect(ctx).toContain('- Estrategia didáctica.');
      expect(ctx).toContain('- Semana.');
      expect(ctx).toContain('- Participante.');
      expect(ctx).toContain('16. El plan operativo integra las estrategias didácticas que vincula al estudiantado con la Comunidad.');
      expect(ctx).toContain('17. Identifica el tipo de evaluación formativa que se utilizará vinculada a la estrategia didáctica.');
    }
  });

  it('Paso 8 incluye textos verbatim de los Criterios 1, 18 y 19', () => {
    const ctx = getPaecRegulatoryContext(8);
    expect(ctx).toContain('1. Comité del plantel:');
    expect(ctx).toContain('18. El responsable del plantel cuenta con evidencias acerca de la participación del colegiado docente en el proceso de discusión, identificación e integración de las progresiones de las UAC al PEC.');
    expect(ctx).toContain('19. En el diseño del PEC se identifica la participación de las figuras involucradas.');
    expect(ctx).toContain('- Comunidad (autoridades locales y asociaciones civiles)');
  });

  it('Paso 9 incluye textos verbatim de los Criterios 20, 21 y 22', () => {
    const ctx = getPaecRegulatoryContext(9);
    expect(ctx).toContain('20. Se identifica la realización de un informe como mecanismo de socialización del PEC a la Supervisión Escolar con toda la documentación:');
    expect(ctx).toContain('-Diseño.');
    expect(ctx).toContain('-Plan operativo.');
    expect(ctx).toContain('-Minutas.');
    expect(ctx).toContain('-Planeación didáctica articulada al proyecto.');
    expect(ctx).toContain('-Productos o resultados');
    expect(ctx).toContain('21. Seguimiento y retroalimentación del PEC (mensual, por momento de evaluación, semestral)');
    expect(ctx).toContain('22. Componentes del PAEC:');
    expect(ctx).toContain('- Clima organizacional.');
    expect(ctx).toContain('- Productos.');
  });

  it('todos los pasos integran los criterios transversales 8 y 23', () => {
    for (let step = 1; step <= 9; step++) {
      const ctx = getPaecRegulatoryContext(step);
      expect(ctx).toContain(CRITERIO_8_VERBATIM);
      expect(ctx).toContain(CRITERIO_23_VERBATIM);
    }
  });
});
