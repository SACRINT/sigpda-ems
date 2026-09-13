/**
 * visual-dispatcher.ts — Enrutador y Despachador de Recursos Visuales
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Analiza la UAC, el tema/título y el contexto de la misión para suministrar
 * el gráfico determinístico adecuado.
 * - Fase 1: Área STEM activa (Pensamiento Matemático, Física, Química, etc.).
 * - Fases posteriores: Retorna null de forma segura para Humanidades, Sociales y Laboral.
 */

import {
  generateCartesianPlane,
  generateLinearGraph,
  generateQuadraticGraph,
  generateLinearSystemGraph,
  generateTriangle,
  generateRectangle,
} from './generators/stem-generator';
import type { VisualResult } from './generators/stem-generator';
import {
  generateTimeline,
  generateConceptMap,
  generateHistoricalFlow,
  generateSocialStatsChart,
} from './generators/humanities-generator';
import {
  generateTechnicalFlow,
  generateBlockDiagram,
  generateGanttChart,
  generateSafetyChecklistVisual,
} from './generators/laboral-generator';
import { normalizeUnicode } from '@/lib/utils/normalize';

const STEM_KEYWORDS = [
  'pensamiento matemático',
  'análisis de fenómenos físicos',
  'dibujo técnico',
  'física',
  'fisica',
  'química',
  'quimica',
  'ciencias naturales',
  'ciencias experimentales',
  'la materia y sus interacciones',
  'conservación de la energía',
  'reacciones químicas',
  'matemáticas',
  'cálculo',
  'álgebra',
  'geometría',
  'trigonometría',
  'estadística',
];

const HUMANITIES_KEYWORDS = [
  'historia',
  'filosofía',
  'filosofia',
  'literatura',
  'ética',
  'etica',
  'sociología',
  'sociologia',
  'geografía',
  'geografia',
  'humanidades',
  'ciencias sociales',
  'conciencia histórica',
  'conciencia historica',
  'estructura socioeconómica',
  'estructura socioeconomica',
  'lengua y comunicación',
  'lengua y comunicacion',
];

const LABORAL_KEYWORDS = [
  'formacion para el trabajo',
  'formación para el trabajo',
  'capacitacion para el trabajo',
  'capacitación para el trabajo',
  'soporte y mantenimiento',
  'mantenimiento',
  'equipo de computo',
  'equipo de cómputo',
  'tecnologias de la informacion',
  'tecnologías de la información',
  'diseno grafico',
  'diseño gráfico',
  'contabilidad',
  'administracion',
  'administración',
  'electronica',
  'electrónica',
  'electricidad',
  'mecanica',
  'mecánica',
  'agropecuario',
  'salud comunitaria',
  'enfermeria',
  'enfermería',
  'seguridad e higiene',
  'taller tecnico',
  'taller técnico',
];

/**
 * Determina si una UAC pertenece al área STEM / Ciencias Exactas.
 */
export function isStemSubject(uacName: string): boolean {
  const norm = normalizeUnicode(uacName);
  return STEM_KEYWORDS.some((kw) => {
    const normKw = normalizeUnicode(kw);
    return norm.includes(normKw);
  });
}

/**
 * Determina si una UAC pertenece al área de Humanidades o Ciencias Sociales.
 */
export function isHumanitiesSubject(uacName: string): boolean {
  const norm = normalizeUnicode(uacName);
  return HUMANITIES_KEYWORDS.some((kw) => {
    const normKw = normalizeUnicode(kw);
    return norm.includes(normKw);
  });
}

/**
 * Determina si una UAC pertenece al área de Formación para el Trabajo / Capacitación Laboral.
 */
export function isLaboralSubject(uacName: string): boolean {
  const norm = normalizeUnicode(uacName);
  return LABORAL_KEYWORDS.some((kw) => {
    const normKw = normalizeUnicode(kw);
    return norm.includes(normKw);
  });
}

/**
 * Despacha el recurso gráfico vectorial adecuado según la asignatura, el tema
 * y el contexto completo de la misión (coreExplanation + physicalAnalogy).
 *
 * @param uacName Nombre de la UAC (ej: "Pensamiento Matemático III")
 * @param topic Título de la misión
 * @param contextText Texto combinado de coreExplanation + physicalAnalogy para mejor detección
 * @returns VisualResult con SVG + anotaciones, o null si la disciplina no tiene generador.
 */
export function dispatchVisual(uacName: string, topic: string, contextText?: string): VisualResult | null {
  const isStem = isStemSubject(uacName);
  const isHumanities = isHumanitiesSubject(uacName);
  const isLaboral = isLaboralSubject(uacName);

  if (!isStem && !isHumanities && !isLaboral) {
    return null;
  }

  // Combinar título + contexto para máxima cobertura de keywords
  const searchText = normalizeUnicode(`${topic} ${contextText || ''}`);

  // ── A. DISPATCHER ÁREA STEM / CIENCIAS EXACTAS ────────────────────────────
  if (isStem) {
    // 1. Parábolas y Ecuaciones Cuadráticas
    if (
      searchText.includes('parabola') ||
      searchText.includes('cuadrat') ||
      searchText.includes('segundo grado') ||
      searchText.includes('trayectoria') ||
      searchText.includes('vertice')
    ) {
      return generateQuadraticGraph(1, 0, -4, {
        title: 'Modelación Gráfica: Función Cuadrática f(x) = x² - 4',
      });
    }

    // 2. Ecuaciones y Funciones Lineales
    if (
      searchText.includes('lineal') ||
      searchText.includes('recta') ||
      searchText.includes('primer grado') ||
      searchText.includes('pendiente') ||
      searchText.includes('funcion lineal')
    ) {
      return generateLinearGraph(1.5, 1, {
        title: 'Modelación Gráfica: Función Lineal f(x) = 1.5x + 1',
      });
    }

    // 3. Sistemas de Ecuaciones Lineales
    if (
      searchText.includes('sistema') ||
      searchText.includes('interseccion') ||
      searchText.includes('simultane') ||
      searchText.includes('2x2')
    ) {
      return generateLinearSystemGraph(1, -1, -0.5, 3.5, {
        title: 'Sistema de Ecuaciones: Intersección L₁ y L₂',
      });
    }

    // 4. Triángulos, Teorema de Pitágoras y Trigonometría
    if (
      searchText.includes('triangulo') ||
      searchText.includes('pitagoras') ||
      searchText.includes('trigonometr') ||
      searchText.includes('cateto') ||
      searchText.includes('hipotenusa') ||
      searchText.includes('razon trigonometrica') ||
      searchText.includes('seno') ||
      searchText.includes('coseno') ||
      searchText.includes('tangente')
    ) {
      return generateTriangle(4, 3, 5, {
        title: 'Geometría Plana: Triángulo Rectángulo y Teorema de Pitágoras',
      });
    }

    // 5. Rectángulos, Polígonos, Áreas y Perímetros
    if (
      searchText.includes('rectangulo') ||
      searchText.includes('area') ||
      searchText.includes('perimetro') ||
      searchText.includes('poligono') ||
      searchText.includes('cuadrilatero')
    ) {
      return generateRectangle(8, 5, {
        title: 'Geometría Aplicada: Cálculo de Perímetro y Área',
      });
    }

    // 6. Por defecto en STEM: Plano Cartesiano graduado
    return generateCartesianPlane({
      title: 'Plano Cartesiano para Tabulación y Bosquejo de Datos',
    });
  }

  // ── B. DISPATCHER ÁREA HUMANIDADES Y CIENCIAS SOCIALES ─────────────────────
  if (isHumanities) {
    // 1. Diagramas de Flujo Histórico Causal (procesos históricos, revoluciones, movimientos sociales)
    if (
      searchText.includes('proceso historico') ||
      searchText.includes('revolucion') ||
      searchText.includes('movimiento social')
    ) {
      return generateHistoricalFlow([], {
        title: `Flujo Causal: ${topic.slice(0, 42)}`,
      });
    }

    // 2. Gráficas Estadísticas Sociales / Demografía (demografía, población, estadística social)
    if (
      searchText.includes('demograf') ||
      searchText.includes('poblacion') ||
      searchText.includes('estadistica social')
    ) {
      return generateSocialStatsChart([], {
        title: `Indicadores Sociales: ${topic.slice(0, 42)}`,
      });
    }

    // 3. Líneas de Tiempo (cronologías, siglos, etapas, periodos históricos)
    if (
      searchText.includes('linea de tiempo') ||
      searchText.includes('cronolog') ||
      searchText.includes('siglo') ||
      searchText.includes('periodo') ||
      searchText.includes('etapa') ||
      searchText.includes('epoca')
    ) {
      return generateTimeline([], {
        title: `Línea de Tiempo: ${topic.slice(0, 42)}`,
      });
    }

    // 4. Mapas Conceptuales (Filosofía, Ética, Literatura, Sociología, Geografía, conceptos)
    if (
      searchText.includes('filosof') ||
      searchText.includes('etica') ||
      searchText.includes('literatur') ||
      searchText.includes('sociolog') ||
      searchText.includes('geograf') ||
      searchText.includes('concepto') ||
      searchText.includes('pensamiento') ||
      searchText.includes('moral')
    ) {
      return generateConceptMap([], [], {
        title: `Mapa Conceptual: ${topic.slice(0, 42)}`,
      });
    }

    // 5. Por defecto en Humanidades según UAC (Historia/Conciencia -> Línea de Tiempo, otras -> Mapa Conceptual)
    const normUac = normalizeUnicode(uacName);
    if (normUac.includes('historia') || normUac.includes('conciencia historica')) {
      return generateTimeline([], {
        title: `Línea de Tiempo Histórica: ${topic.slice(0, 42)}`,
      });
    }

    return generateConceptMap([], [], {
      title: `Estructura Conceptual Formativa: ${topic.slice(0, 42)}`,
    });
  }

  // ── C. DISPATCHER ÁREA FORMACIÓN PARA EL TRABAJO / LABORAL ────────────────
  if (isLaboral) {
    // 1. Matriz de Seguridad Industrial, EPP y Normatividad NOM-STPS
    if (
      searchText.includes('seguridad') ||
      searchText.includes('epp') ||
      searchText.includes('esd') ||
      searchText.includes('nom') ||
      searchText.includes('norma') ||
      searchText.includes('proteccion') ||
      searchText.includes('riesgo') ||
      searchText.includes('higiene') ||
      searchText.includes('accidente') ||
      searchText.includes('emergencia')
    ) {
      return generateSafetyChecklistVisual([], {
        title: `Seguridad y EPP: ${topic.slice(0, 42)}`,
      });
    }

    // 2. Cronograma de Operaciones y Diagrama de Gantt
    if (
      searchText.includes('cronograma') ||
      searchText.includes('gantt') ||
      searchText.includes('planeacion') ||
      searchText.includes('semanas') ||
      searchText.includes('etapas') ||
      searchText.includes('orden de trabajo') ||
      searchText.includes('avance') ||
      searchText.includes('calendario')
    ) {
      return generateGanttChart([], {
        title: `Cronograma Técnico: ${topic.slice(0, 42)}`,
      });
    }

    // 3. Diagrama de Bloques y Arquitectura de Sistemas
    if (
      searchText.includes('sistema') ||
      searchText.includes('bloques') ||
      searchText.includes('arquitectura') ||
      searchText.includes('modulo') ||
      searchText.includes('circuito') ||
      searchText.includes('red') ||
      searchText.includes('hardware') ||
      searchText.includes('fuente') ||
      searchText.includes('alimentacion') ||
      searchText.includes('sensores') ||
      searchText.includes('actuadores')
    ) {
      return generateBlockDiagram([], {
        title: `Arquitectura Modular: ${topic.slice(0, 42)}`,
      });
    }

    // 4. Diagrama de Procedimiento Técnico / Flujo de Taller (Default para laboral)
    return generateTechnicalFlow([], {
      title: `Procedimiento Técnico: ${topic.slice(0, 42)}`,
    });
  }

  return null;
}
