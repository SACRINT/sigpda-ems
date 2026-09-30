// src/__tests__/pmc-meta-deduplicator.test.ts
/**
 * Pruebas unitarias e integración para la deduplicación silenciosa de metas institucionales (H-150 / H-153 / H-154).
 * Valida:
 * 1. Duplicado exacto.
 * 2. Duplicado semántico y resolución de conflicto duro con indicadores (ej. abandono 0% vs 3%).
 * 3. Miscategorías (metas con categoría incoherente pero mismo ámbito temático).
 * 4. Fusión de campos complementarios y conservación de continuidad_de.
 * 5. Protección de metas independientes (egresados 80% no se modifica con et_meta=100; reprobación conserva línea base y rango).
 * 6. Test de integración con las 23 metas reales del proyecto c31d3298 (se mantienen >= 22 metas, sin destrucciones masivas).
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeMetaText,
  computeMetaSimilarity,
  detectMetaTopic,
  applyIndicatorPrecedence,
  deduplicateMetasInstitucionales,
  isAbandonoGoal,
} from '@/lib/pmc-meta-deduplicator';
import type { PmcMetaInstitucional, PmcIndicadoresAcademicos } from '@/types/pmc';

describe('H-150 / H-153: Deduplicación silenciosa de metas institucionales', () => {
  const mockIndicadores: PmcIndicadoresAcademicos = {
    abandono_ant: 5.0,
    abandono_meta: 3.0,
    aprobacion_ant: 75.0,
    aprobacion_meta: 85.0,
    reprobacion_ant: 3.0,
    reprobacion_meta: 1.0,
    et_ant: 70.0,
    et_meta: 100.0,
    matricula: 75,
  };

  describe('1. Normalización y Similitud Léxica', () => {
    it('normaliza texto removiendo mayúsculas, acentos, prefijos de continuidad y puntuación', () => {
      const raw = '[Continuidad 2026-2027] ¡Reducir el abandono escolar al 3% en primer año!';
      const norm = normalizeMetaText(raw);
      expect(norm).toBe('reducir el abandono escolar al 3 en primer ano');
    });

    it('calcula alta similitud para redacciones equivalentes', () => {
      const a = 'Reducir el abandono escolar en la matrícula estudiantil durante 2026-2027';
      const b = 'Disminuir el abandono escolar en la comunidad estudiantil para el ciclo 2026-2027';
      const sim = computeMetaSimilarity(a, b);
      expect(sim).toBeGreaterThanOrEqual(0.4);
    });
  });

  describe('2. Detección de Topic y Precedencia de Indicadores', () => {
    it('detecta correctamente los topics clave de la política CREAA', () => {
      expect(detectMetaTopic({ meta: 'Reducir la deserción de los alumnos' })).toBe('abandono');
      expect(detectMetaTopic({ meta: 'Aumentar la aprobación en matemáticas' })).toBe('aprobacion');
      expect(detectMetaTopic({ meta: 'Disminuir la reprobación escolar' })).toBe('reprobacion');
      expect(detectMetaTopic({ meta: 'Monitorear la titulación de egresados' })).toBe('seguimiento_egresados');
      expect(detectMetaTopic({ meta: 'Elevar la eficiencia terminal del plantel' })).toBe('eficiencia_terminal');
      expect(detectMetaTopic({ meta: 'Capacitación docente en metodologías activas' })).toBe('formacion_docente');
      expect(detectMetaTopic({ meta: 'Círculos de apoyo socioemocional' })).toBe('socioemocional');
      expect(detectMetaTopic({ meta: 'Talleres contra la violencia escolar y cultura de paz' })).toBe('convivencia_violencia');
    });

    it('prevalencia de indicadores_academicos.*_meta sobre contradicciones alucinadas (abandono 0% vs 3%)', () => {
      const alucinadoIA: PmcMetaInstitucional = {
        categoria: 'Permanencia escolar',
        tema: 'Prevención de deserción',
        meta: 'Reducir el abandono escolar al 0% durante el ciclo escolar 2026-2027',
      };

      const corregido = applyIndicatorPrecedence(alucinadoIA, mockIndicadores);
      expect(corregido.meta).toContain('al 3%');
      expect(corregido.meta).not.toContain('0%');
      expect(corregido.linea_base).toContain('meta proyectada: 3%');
    });

    it('H-153: NUNCA altera metas de seguimiento a egresados con et_meta=100 (80% debe quedar intacto)', () => {
      const egresadosMeta: PmcMetaInstitucional = {
        categoria: 'Gestión escolar',
        tema: 'Seguimiento de egresados',
        meta: 'Capturar y actualizar la base de datos de trayectoria de al menos el 80% de la generación egresada',
      };

      const procesado = applyIndicatorPrecedence(egresadosMeta, mockIndicadores);
      expect(procesado.meta).toContain('80%');
      expect(procesado.meta).not.toContain('100%');
    });

    it('H-153: Preserva línea base en reprobación "del 3% al 1%" sin corromper a "del 1% al 1%"', () => {
      const reprobacionMeta: PmcMetaInstitucional = {
        categoria: 'Desarrollo académico',
        tema: 'Planeación didáctica',
        meta: '[Continuidad 2026-2027] Disminuir el índice de reprobación del 3% al 1%.',
      };

      const procesado = applyIndicatorPrecedence(reprobacionMeta, mockIndicadores);
      expect(procesado.meta).toContain('del 3% al 1%');
      expect(procesado.meta).not.toContain('del 1% al 1%');
    });
  });

  describe('3. Deduplicación de Metas Institucionales', () => {
    it('elimina duplicados exactos conservando una sola instancia', () => {
      const metas: PmcMetaInstitucional[] = [
        {
          categoria: 'Permanencia escolar',
          meta: 'Reducir el abandono escolar al 3% en el plantel',
          estrategia: 'Tutorías personalizadas',
        },
        {
          categoria: 'Permanencia escolar',
          meta: 'reducir el abandono escolar al 3% en el plantel.',
          estrategia: 'Tutorías personalizadas y alertas tempranas',
        },
      ];

      const deduplicadas = deduplicateMetasInstitucionales(metas, mockIndicadores);
      expect(deduplicadas.length).toBe(1);
      expect(deduplicadas[0].estrategia).toBe('Tutorías personalizadas y alertas tempranas');
    });

    it('resuelve conflicto semántico duro (IA #3 "abandono al 0%" vs continuidad #14 "5%->3%")', () => {
      const metas: PmcMetaInstitucional[] = [
        {
          categoria: 'Permanencia y egreso',
          tema: 'Abandono escolar',
          meta: 'Reducir el abandono escolar al 0% mediante alertas tempranas',
          estrategia: 'Alertas en semana 6 y 12',
          personal_designado: 'Orientador educativo',
        },
        {
          categoria: 'Permanencia',
          tema: 'Deserción escolar',
          meta: '[Continuidad 2026-2027] Lograr la disminución de la tasa de abandono del 5% al 3%',
          continuidad_de: 'Lograr la disminución de la tasa de abandono del 5% al 3%',
          estrategia: 'Acompañamiento a estudiantes en riesgo',
          linea_base: 'Tasa 5%',
          entregable: 'Reporte trimestral de retención',
        },
      ];

      const deduplicadas = deduplicateMetasInstitucionales(metas, mockIndicadores);
      // Se debe consolidar en una única meta de abandono
      expect(deduplicadas.length).toBe(1);
      const metaFinal = deduplicadas[0];
      // Debe contener la meta oficial 3% y no tener 0%
      expect(metaFinal.meta).not.toContain('0%');
      expect(metaFinal.meta).toContain('3%');
      // Debe haber fusionado campos complementarios
      expect(metaFinal.entregable).toBe('Reporte trimestral de retención');
      expect(metaFinal.personal_designado).toBe('Orientador educativo');
    });

    it('resuelve miscategorías unificando metas del mismo ámbito (ej. Abandono etiquetada bajo "Trabajo colegiado")', () => {
      const metas: PmcMetaInstitucional[] = [
        {
          categoria: 'Trabajo colegiado',
          tema: 'Reuniones docentes',
          meta: 'Abordar en academia la reducción del abandono escolar al 3%',
          estrategia: 'Análisis bimestral de deserción',
        },
        {
          categoria: 'Permanencia escolar',
          tema: 'Abandono escolar',
          meta: 'Disminuir el abandono escolar al 3% mediante tutoría académica',
          estrategia: 'Tutorías en aula',
        },
      ];

      const deduplicadas = deduplicateMetasInstitucionales(metas, mockIndicadores);
      expect(deduplicadas.length).toBe(1);
      expect(deduplicadas[0].categoria).toBe('Permanencia escolar');
    });

    it('deduplica metas clonadas de egresados (#8 vs #20 vs #21) cuando tienen estrategia idéntica y tema coincidente', () => {
      const metas: PmcMetaInstitucional[] = [
        {
          categoria: 'Eficiencia Terminal',
          tema: 'Seguimiento de Egresados',
          meta: 'Lograr que el 80% de los egresados continúen estudios superiores o ingresen al mercado laboral',
          estrategia: 'Vinculación con universidades y bolsas de trabajo',
          linea_base: 'Eficiencia actual: 70%',
        },
        {
          categoria: 'Eficiencia Terminal',
          tema: 'Seguimiento de Egresados',
          meta: '[Continuidad 2026-2027] Seguimiento del 80% de egresados para vinculación territorial',
          estrategia: 'Vinculación con universidades y bolsas de trabajo',
          linea_base: 'Eficiencia actual: 70%',
        },
      ];

      const deduplicadas = deduplicateMetasInstitucionales(metas, mockIndicadores);
      expect(deduplicadas.length).toBe(1);
      expect(deduplicadas[0].meta).toContain('80%');
    });
  });

  describe('4. Integración E2E: Proyecto Vivo c31d3298 (23 metas reales)', () => {
    // Fixture de las 23 metas reales del proyecto c31d3298
    const real23Metas: PmcMetaInstitucional[] = [
      {
        meta: "Realizar el 100% de las sesiones ordinarias de academia colegiada programadas durante el ciclo escolar 2026-2027, implementando círculos de revisión curricular y diseño transversal de planeaciones en El Tecomate, Puebla.",
        tema: "Trabajo colegiado",
        categoria: "1",
        nombre_categoria: "Desarrollo académico y aprendizaje",
      },
      {
        meta: "Diseñar e implementar el 100% de las fases del Proyecto Escolar Comunitario (PAEC) en la matrícula de 75 estudiantes durante el ciclo escolar 2026-2027, articulando prototipos socioproductivos en El Tecomate, Puebla.",
        tema: "Proyecto Escolar Comunitario (PEC)",
        categoria: "1",
        nombre_categoria: "Desarrollo académico y aprendizaje",
      },
      {
        meta: "Reducir al 0% la tasa de abandono escolar en la matrícula de 75 estudiantes durante el ciclo escolar 2026-2027, implementando alertas tempranas y tutorías académicas en El Tecomate, Puebla.",
        tema: "Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)",
        categoria: "1",
        nombre_categoria: "Desarrollo académico y aprendizaje",
      },
      {
        meta: "Validar el 100% de las planeaciones didácticas con enfoque en progresiones de aprendizaje para la matrícula de 75 alumnos durante el ciclo escolar 2026-2027, mediante revisión colegiada en El Tecomate, Puebla.",
        tema: "Planeación didáctica",
        categoria: "1",
        nombre_categoria: "Desarrollo académico y aprendizaje",
      },
      {
        meta: "Lograr que el 100% de la plantilla docente participe en al menos dos procesos formativos o cursos de actualización pedagógica durante el ciclo escolar 2026-2027 en El Tecomate, Puebla.",
        tema: "Formación y actualización docente",
        categoria: "1",
        nombre_categoria: "Desarrollo académico y aprendizaje",
      },
      {
        meta: "Brindar atención tutorial personalizada al 100% de los estudiantes en riesgo de rezago académico de la matrícula de 75 alumnos durante el ciclo escolar 2026-2027 en El Tecomate, Puebla.",
        tema: "Orientación y Tutoría",
        categoria: "1",
        nombre_categoria: "Desarrollo académico y aprendizaje",
      },
      {
        meta: "Realizar al menos dos visitas formativas de acompañamiento en aula al 100% de la plantilla docente durante el ciclo escolar 2026-2027 en El Tecomate, Puebla.",
        tema: "Seguimiento al desempeño docente en el aula",
        categoria: "2",
        nombre_categoria: "Gestión y administración escolar",
      },
      {
        meta: "Capturar y actualizar la base de datos de trayectoria de al menos el 80% de la generación egresada al término del ciclo escolar 2026-2027 en El Tecomate, Puebla.",
        tema: "Seguimiento de egresados",
        categoria: "2",
        nombre_categoria: "Gestión y administración escolar",
      },
      {
        meta: "Establecer al menos 3 convenios o jornadas de articulación con instituciones de educación media superior y superior durante el ciclo escolar 2026-2027 en El Tecomate, Puebla.",
        tema: "Vinculación con instituciones educativas",
        categoria: "2",
        nombre_categoria: "Gestión y administración escolar",
      },
      {
        meta: "Ejecutar el 100% del programa anual de mantenimiento preventivo y gestión de recursos del plantel durante el ciclo escolar 2026-2027 en El Tecomate, Puebla.",
        tema: "Gestión y administración de recursos, equipamiento y servicios",
        categoria: "2",
        nombre_categoria: "Gestión y administración escolar",
      },
      {
        meta: "Garantizar la participación del 100% de la matrícula de 75 estudiantes en al menos dos ámbitos de formación socioemocional durante el ciclo escolar 2026-2027 en El Tecomate, Puebla.",
        tema: "Ámbitos de formación socioemocional (Currículum Ampliado)",
        categoria: "3",
        nombre_categoria: "Desarrollo socioemocional y prevención de la violencia en la escuela",
      },
      {
        meta: "Implementar el programa de cultura de paz y mediación escolar con una cobertura del 100% de la comunidad estudiantil durante el ciclo escolar 2026-2027 en El Tecomate, Puebla.",
        tema: "Estrategias, programas y/o proyectos sobre violencia",
        categoria: "3",
        nombre_categoria: "Desarrollo socioemocional y prevención de la violencia en la escuela",
      },
      {
        meta: "Impartir talleres de proyecto de vida y orientación psicopedagógica al 100% de los grupos escolares durante el ciclo escolar 2026-2027 en El Tecomate, Puebla.",
        tema: "Orientación educativa",
        categoria: "3",
        nombre_categoria: "Desarrollo socioemocional y prevención de la violencia en la escuela",
      },
      {
        meta: "[Continuidad 2026-2027] Disminuir el abandono escolar del 5% al 3%.",
        tema: "Trabajo colegiado",
        categoria: "Desarrollo académico y aprendizaje",
        continuidad_de: "Disminuir el abandono escolar del 5% al 3%.",
      },
      {
        meta: "[Continuidad 2026-2027] Continuar con el Ballet Escolar y realizar limpia y pintura de árboles de la comunidad.",
        tema: "Proyecto Escolar Comunitario (PEC)",
        categoria: "Desarrollo académico y aprendizaje",
        continuidad_de: "Continuar con el Ballet Escolar y realizar limpia y pintura de árboles de la comunidad.",
      },
      {
        meta: "[Continuidad 2026-2027] Mejorar el rendimiento académico, principalmente en alumnos de primer semestre del 65% al 78%.",
        tema: "Planeación didáctica",
        categoria: "Desarrollo académico y aprendizaje",
        continuidad_de: "Mejorar el rendimiento académico, principalmente en alumnos de primer semestre del 65% al 78%.",
      },
      {
        meta: "[Continuidad 2026-2027] Disminuir el índice de reprobación del 3% al 1%.",
        tema: "Planeación didáctica",
        categoria: "Desarrollo académico y aprendizaje",
        continuidad_de: "Disminuir el índice de reprobación del 3% al 1%.",
      },
      {
        meta: "[Continuidad 2026-2027] Capacitación constante de los cursos académicos que oferta el nivel medio superior (COSFAC), donde participe todo el personal docente y directivo.",
        tema: "Seguimiento al desempeño docente en el aula",
        categoria: "Gestión y administración escolar",
        continuidad_de: "Capacitación constante de los cursos académicos que oferta el nivel medio superior (COSFAC), donde participe todo el personal docente y directivo.",
      },
      {
        meta: "[Continuidad 2026-2027] Favorecer los hábitos de vida saludable de la comunidad escolar a través de pláticas para evitar el consumo de alcohol y sustancias prohibidas.",
        tema: "Seguimiento al desempeño docente en el aula",
        categoria: "Gestión y administración escolar",
        continuidad_de: "Favorecer los hábitos de vida saludable de la comunidad escolar a través de pláticas para evitar el consumo de alcohol y sustancias prohibidas.",
      },
      {
        meta: "[Continuidad 2026-2027] Recabar información sobre los egresados del ciclo escolar 2024-2025.",
        tema: "Seguimiento de egresados",
        categoria: "Gestión y administración escolar",
        continuidad_de: "Recabar información sobre los egresados del ciclo escolar 2024-2025.",
      },
      {
        meta: "[Continuidad 2026-2027] Dar seguimiento a los aprendientes que egresaron en la generación 2025-2026.",
        tema: "Seguimiento de egresados",
        categoria: "Gestión y administración escolar",
        continuidad_de: "Dar seguimiento a los aprendientes que egresaron en la generación 2025-2026.",
      },
      {
        meta: "[Continuidad 2026-2027] Mejorar la salud socioemocional, disminuyendo de un 7% a un 5%.",
        tema: "Ámbitos de formación socioemocional (Currículum Ampliado)",
        categoria: "Desarrollo socioemocional y prevención de la violencia en la escuela",
        continuidad_de: "Mejorar la salud socioemocional, disminuyendo de un 7% a un 5%.",
      },
      {
        meta: "[Continuidad 2026-2027] Disminuir la violencia escolar de un 5% a un 2%.",
        tema: "Estrategias, programas y/o proyectos sobre violencia",
        categoria: "Desarrollo socioemocional y prevención de la violencia en la escuela",
        continuidad_de: "Disminuir la violencia escolar de un 5% a un 2%.",
      },
    ];

    const indicadoresReales: PmcIndicadoresAcademicos = {
      abandono_ant: 5,
      abandono_meta: 3,
      aprobacion_ant: 100,
      aprobacion_meta: 100,
      reprobacion_ant: 3,
      reprobacion_meta: 1,
      et_ant: 100,
      et_meta: 100,
      matricula: 75,
      matricula_meta: 85,
    };

    it('procesa las 23 metas reales sin destruir metas distintas (esperado exactamente 22 metas)', () => {
      const output = deduplicateMetasInstitucionales(real23Metas, indicadoresReales);
      
      // Debe mantener exactamente 22 metas (solo fusionando el par duplicado #3 y #14 de abandono)
      expect(output).toHaveLength(22);

      // Meta de rendimiento académico del 65% al 78% NUNCA debe ser alterada a 100% por aprobacion_meta
      const rendimiento = output.find(m => normalizeMetaText(m.meta).includes('rendimiento academico'));
      expect(rendimiento).toBeDefined();
      expect(rendimiento?.meta).toContain('del 65% al 78%');
      expect(rendimiento?.meta).not.toContain('100%');

      // Meta de egresados al 80% NUNCA debe ser alterada a 100%
      const egresados = output.find(m => normalizeMetaText(m.meta).includes('egresada') && normalizeMetaText(m.meta).includes('80'));
      expect(egresados).toBeDefined();
      expect(egresados?.meta).toContain('80%');

      // Reprobación 3% al 1% debe conservar ambos números sin corromperse
      const reprobacion = output.find(m => normalizeMetaText(m.meta).includes('reprobacion'));
      expect(reprobacion).toBeDefined();
      expect(reprobacion?.meta).toContain('3% al 1%');

      // Abandono debe ser exactamente 1 meta y alineada a la meta oficial 3%
      const abandono = output.filter(m => isAbandonoGoal(m));
      expect(abandono.length).toBe(1);
      expect(abandono[0].meta).toContain('3%');
      expect(abandono[0].meta).not.toContain('0%');

      // Meta de violencia 5% a 2% debe existir y no estar tragada
      const violencia = output.find(m => normalizeMetaText(m.meta).includes('violencia escolar'));
      expect(violencia).toBeDefined();
      expect(violencia?.meta).toContain('5% a un 2%');

      // Meta de proyecto de vida debe existir intacta
      const proyectoVida = output.find(m => normalizeMetaText(m.meta).includes('proyecto de vida'));
      expect(proyectoVida).toBeDefined();

      // Meta de hábitos de vida saludable debe existir intacta
      const vidaSaludable = output.find(m => normalizeMetaText(m.meta).includes('habitos de vida saludable'));
      expect(vidaSaludable).toBeDefined();
    });

    it('H-283: NUNCA fusiona metas de asignaturas o reprobacion como abandono bajo el tema oficial compuesto', () => {
      const temaOficial = 'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)';
      
      const meta1Reprobacion: PmcMetaInstitucional = {
        categoria: 'Desarrollo académico y aprendizaje',
        tema: temaOficial,
        meta: 'Disminuir la reprobación de los alumnos del semestre que se encuentren cursando y al mismo observar su desempeño académico.',
        estrategia: 'Realizar un concentrado de calificaciones grupal en el salón de 2 A en cada semestre',
      };

      const meta2Salud: PmcMetaInstitucional = {
        categoria: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
        tema: 'Salud integral y bienestar',
        meta: 'Promover durante el ciclo escolar 2026-2027 la participación y asistencia de alumnas, alumnos, madres, padres y/o tutores a las conferencias de salud emocional y física.',
      };

      const meta3Docente: PmcMetaInstitucional = {
        categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Formación y actualización docente',
        meta: 'Acreditar satisfactoriamente dichos cursos en actualizaciones y formación docente en un 100%, durante la calendarización establecida y obtener la constancia.',
      };

      const meta4Ingles: PmcMetaInstitucional = {
        categoria: 'Desarrollo académico y aprendizaje',
        tema: temaOficial,
        meta: 'Lograr que mínimo el 70% de los estudiantes de primer y tercer semestre aprueben con un buen promedio las asignaturas de inglés 1 e inglés III, para mejorar la eficiencia terminal.',
        estrategia: 'Ofrecer asesorías de inglés y participar en cursos COSFAC',
      };

      const meta5Aritmetica: PmcMetaInstitucional = {
        categoria: 'Desarrollo académico y aprendizaje',
        tema: temaOficial,
        meta: 'Lograr que mínimo el 70% de los estudiantes de primer semestre aprueben con un buen promedio en pensamiento aritmético, para mejorar la eficiencia terminal.',
        estrategia: 'Ofrecer asesorías, realizar cursos COSFAC, adquirir bombo y participar en feria de ciencias',
      };

      // Verificar que ninguna sea falsamente clasificada como meta de abandono
      expect(isAbandonoGoal(meta1Reprobacion)).toBe(false);
      expect(isAbandonoGoal(meta4Ingles)).toBe(false);
      expect(isAbandonoGoal(meta5Aritmetica)).toBe(false);

      // Verificar deduplicación con las 5 metas juntas
      const deduplicated = deduplicateMetasInstitucionales([
        meta1Reprobacion,
        meta2Salud,
        meta3Docente,
        meta4Ingles,
        meta5Aritmetica,
      ]);

      // Todas las 5 metas deben sobrevivir independientemente sin ser devoradas
      expect(deduplicated.length).toBe(5);
      expect(deduplicated.some(m => m.meta.includes('inglés'))).toBe(true);
      expect(deduplicated.some(m => m.meta.includes('pensamiento aritmético'))).toBe(true);
      expect(deduplicated.some(m => m.meta.includes('reprobación'))).toBe(true);
    });
  });
});
