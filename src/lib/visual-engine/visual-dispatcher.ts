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

const STEM_KEYWORDS = [
  'pensamiento matemático',
  'análisis de fenómenos físicos',
  'dibujo técnico',
  'física',
  'química',
  'matemáticas',
  'cálculo',
  'álgebra',
  'geometría',
  'trigonometría',
  'estadística',
];

/**
 * Determina si una UAC pertenece al área STEM / Ciencias Exactas.
 */
export function isStemSubject(uacName: string): boolean {
  const norm = uacName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return STEM_KEYWORDS.some((kw) => {
    const normKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
  if (!isStemSubject(uacName)) {
    return null;
  }

  // Combinar título + contexto para máxima cobertura de keywords
  const searchText = `${topic} ${contextText || ''}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
