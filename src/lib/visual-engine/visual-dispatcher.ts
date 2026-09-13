/**
 * visual-dispatcher.ts — Enrutador y Despachador de Recursos Visuales
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Analiza la UAC y el tema/título de la misión para suministrar el gráfico
 * determinístico adecuado.
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
 * Despacha el recurso gráfico vectorial adecuado según la asignatura y el tema.
 *
 * @param uacName Nombre de la Unidad de Aprendizaje Curricular (ej: "Pensamiento Matemático III")
 * @param topic Tema o título de la misión (ej: "Misión 2: Modelación de Parábolas y Ecuaciones Cuadráticas")
 * @returns Cadena SVG en formato string, o null si la disciplina aún no tiene generador activo.
 */
export function dispatchVisual(uacName: string, topic: string): string | null {
  // 1. Si no es STEM, delegar a null (Fase 2+ integrará humanidades, sociales y laboral)
  if (!isStemSubject(uacName)) {
    return null;
  }

  const normTopic = topic.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 2. Parábolas y Ecuaciones Cuadráticas
  if (
    normTopic.includes('parabola') ||
    normTopic.includes('cuadrat') ||
    normTopic.includes('segundo grado') ||
    normTopic.includes('trayectoria') ||
    normTopic.includes('vertice')
  ) {
    return generateQuadraticGraph(1, 0, -4, {
      title: 'Modelación Gráfica: Función Cuadrática f(x) = x² - 4',
    });
  }

  // 3. Ecuaciones y Funciones Lineales
  if (
    normTopic.includes('lineal') ||
    normTopic.includes('recta') ||
    normTopic.includes('primer grado') ||
    normTopic.includes('pendiente')
  ) {
    return generateLinearGraph(1.5, 1, {
      title: 'Modelación Gráfica: Función Lineal f(x) = 1.5x + 1',
    });
  }

  // 4. Sistemas de Ecuaciones Lineales (Intersección de Rectas)
  if (
    normTopic.includes('sistema') ||
    normTopic.includes('interseccion') ||
    normTopic.includes('simultane') ||
    normTopic.includes('2x2')
  ) {
    return generateLinearSystemGraph(1, -1, -0.5, 3.5, {
      title: 'Sistema de Ecuaciones: Intersección L₁ y L₂',
    });
  }

  // 5. Triángulos, Teorema de Pitágoras y Trigonometría
  if (
    normTopic.includes('triangulo') ||
    normTopic.includes('pitagoras') ||
    normTopic.includes('trigonometr') ||
    normTopic.includes('cateto') ||
    normTopic.includes('hipotenusa')
  ) {
    return generateTriangle(4, 3, 5, {
      title: 'Geometría Plana: Triángulo Rectángulo y Teorema de Pitágoras',
    });
  }

  // 6. Rectángulos, Polígonos, Áreas y Perímetros
  if (
    normTopic.includes('rectangulo') ||
    normTopic.includes('area') ||
    normTopic.includes('perimetro') ||
    normTopic.includes('poligono') ||
    normTopic.includes('cuadrilatero')
  ) {
    return generateRectangle(8, 5, {
      title: 'Geometría Aplicada: Cálculo de Perímetro y Área',
    });
  }

  // 7. Por defecto en STEM: Plano Cartesiano graduado para práctica y tabulación
  return generateCartesianPlane({
    title: 'Plano Cartesiano para Tabulación y Bosquejo de Datos',
  });
}
