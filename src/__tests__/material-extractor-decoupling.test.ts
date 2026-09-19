import { describe, it, expect } from 'vitest';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { SecuenciaBloque } from '@/types/planning';

describe('Fase 3: Desacoplamiento Pedagógico de Cascada y Corrección H-050', () => {
  const mockWorkbook = {
    blockIndex: 0, // Índice base 0
    blockName: 'Bloque 1: Fuerzas y Movimiento',
    coverData: {
      title: 'Cuaderno de Trabajo Activo',
      subtitle: 'Bachillerato General Estatal',
      subjectName: 'Física I',
      schoolName: 'Bachillerato General Emiliano Zapata',
      semester: 3,
      blockNumber: 1,
      teacherName: 'Prof. Roberto González',
      paecProjectName: 'Conservación de Energía en la Comunidad',
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Leyes de Newton en el Entorno',
        coveredSessions: [1, 2, 3],
        sessionTopic: 'Dinámica Clásica',
        sessionFocus: 'Comprender y aplicar la 2da Ley de Newton',
        phenomenonHook: {
          story: 'Un camión de carga necesita el triple de fuerza de frenado...',
          detonatingQuestion: '¿Por qué la masa afecta la aceleración?',
        },
        conceptZero: {
          physicalAnalogy: 'Empujar un carrito de compras vacío vs lleno.',
          coreExplanation: 'F = m * a describe la relación fundamental.',
        },
        iDoSection: {
          stepByStepDemo: 'Demostración de cálculo de fuerza neta.',
        },
        weDoSection: {
          guidedPractice: 'Resolución colaborativa de problemas de plano inclinado.',
          workbookElements: [],
        },
        youDoSection: {
          autonomousChallenge: 'Cálculo individual de aceleración de un vehículo.',
          workbookElements: [],
        },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué ocurre con la aceleración si duplicamos la masa?',
          reflectionPrompts: ['¿Cómo aplicas esto al manejar una bicicleta?'],
          criteriaChecklist: ['Cálculo correcto', 'Unidades en SI'],
        },
        wordCount: 600,
      },
    ],
  };

  const mockSequence: SecuenciaBloque = {
    blockIndex: 0,
    blockName: 'Bloque 1: Fuerzas y Movimiento',
    hours: 24,
    sessions: [
      {
        sessionNum: 1,
        totalSessions: 24,
        phase: 'Apertura',
        title: 'Exploración Intuitiva de la Fuerza',
        teachingActivity: 'El docente presenta simulación digital y modera lluvia de ideas.',
        learningActivity: 'El estudiante registra hipótesis en su bitácora física.',
        evidence: 'Hipótesis documentada sobre masa y movimiento',
        evaluation: 'Cotejo diagnóstico',
        procesoPensamiento: 'problematizacion',
        utilidadReal: 'Seguridad vial y distancia de frenado',
        garantiaDualOffline: 'Papel bond y esquemas con gis en patio escolar',
      },
      {
        sessionNum: 2,
        totalSessions: 24,
        phase: 'Desarrollo',
        title: 'Modelado Matemático de la Segunda Ley',
        teachingActivity: 'El docente modela el despeje algebraico de aceleración.',
        learningActivity: 'El estudiante resuelve problemas de aplicación con calculadora.',
        evidence: 'Problemario resuelto de 5 ejercicios de dinámica',
        evaluation: 'Rúbrica analítica de procedimiento algebraico',
        procesoPensamiento: 'razonamiento',
        utilidadReal: 'Diseño de rampas de emergencia en carreteras',
        garantiaDualOffline: 'Cuaderno cuadrilátero con tablas de valores manuales',
      },
      {
        sessionNum: 3,
        totalSessions: 24,
        phase: 'Cierre',
        title: 'Evaluación y Síntesis de Dinámica',
        teachingActivity: 'El docente modera la coevaluación y retroalimenta errores comunes.',
        learningActivity: 'El estudiante presenta su producto integrador y responde metacognición.',
        evidence: 'Reporte de práctica experimental y autoevaluación',
        evaluation: 'Lista de cotejo de reporte técnico',
        procesoPensamiento: 'reflexion',
        utilidadReal: 'Cálculo de eficiencia mecánica en maquinaria comunitaria',
        garantiaDualOffline: 'Exposición oral con rotafolio grupal',
      },
    ],
  };

  it('1. Corrige H-050: blockIndex 0 se normaliza a Bloque 1 en metadatos, guía y materiales', () => {
    const extracted = extractMaterialsFromWorkbook(mockWorkbook as unknown as ActiveWorkTextbook);

    // Metadatos
    expect(extracted.metadata.blockIndex).toBe(1);
    expect(extracted.metadata.blockName).toContain('Bloque 1');

    // Guía del Estudiante
    expect(extracted.guiaDelBloque).toContain('# GUÍA DE TRABAJO DEL ESTUDIANTE · BLOQUE 1');
    expect(extracted.guiaDelBloque).not.toContain('BLOQUE 0');

    // Material Didáctico
    expect(extracted.materialDidactico).toContain('**Bloque 1**');
    expect(extracted.materialDidactico).not.toContain('**Bloque 0**');
  });

  it('2. Desacopla pedagógicamente las sesiones 1, 2 y 3 usando la secuencia didáctica', () => {
    const extracted = extractMaterialsFromWorkbook(mockWorkbook as unknown as ActiveWorkTextbook, mockSequence);
    const p1 = extracted.planesDeClase[0];
    const p2 = extracted.planesDeClase[1];
    const p3 = extracted.planesDeClase[2];

    // Títulos desacoplados
    expect(p1.tituloSesion).toContain('Exploración Intuitiva de la Fuerza');
    expect(p2.tituloSesion).toContain('Modelado Matemático de la Segunda Ley');
    expect(p3.tituloSesion).toContain('Evaluación y Síntesis de Dinámica');
    expect(p1.tituloSesion).not.toBe(p2.tituloSesion);
    expect(p2.tituloSesion).not.toBe(p3.tituloSesion);

    // Roles docentes y de estudiantes desacoplados
    expect(p1.apertura.actividadDocente).toContain('presenta simulación digital');
    expect(p2.desarrollo.actividadDocente).toContain('despeje algebraico');
    expect(p3.cierre.actividadDocente).toContain('coevaluación');

    // Evidencias esperadas específicas
    expect(p1.cierre.productoEsperado).toContain('Hipótesis documentada');
    expect(p2.cierre.productoEsperado).toContain('Problemario resuelto');
    expect(p3.cierre.productoEsperado).toContain('Reporte de práctica experimental');

    // Transversalidad y garantía dual offline
    expect(p1.transversalidad).toContain('Seguridad vial');
    expect(p2.desarrollo.recursosDidacticos).toContain('Cuaderno cuadrilátero');
  });

  it('3. Mantiene retrocompatibilidad determinística limpia cuando blockSequence es undefined o null', () => {
    const extracted = extractMaterialsFromWorkbook(mockWorkbook as unknown as ActiveWorkTextbook, null);
    expect(extracted.planesDeClase.length).toBe(24);
    expect(extracted.planesDeClase[0].numeroSesion).toBe(1);
    expect(extracted.planesDeClase[1].numeroSesion).toBe(2);
    expect(extracted.planesDeClase[0].tituloSesion).toContain('Leyes de Newton en el Entorno');
  });
});
