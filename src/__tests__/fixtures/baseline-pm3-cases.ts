/**
 * baseline-pm3-cases.ts
 * Frozen regression cases reproduced verbatim from the Pensamiento Matemático III
 * deliverable set (01–09) before Phase 1–5 architectural fixes.
 */

export const BASELINE_ARITHMETIC_ASTERISK_CASES = [
  {
    id: 'perimeter-rect',
    input: 'Para calcular el perímetro de un rectángulo (2*largo + 2*ancho = perímetro), la primera ecuación es 2x + 2y = P.',
    mustPreserveMultBetween: ['2', 'largo'],
    mustPreserveSecondBetween: ['2', 'ancho'],
    forbiddenBroken: ['2largo', '2ancho'],
  },
  {
    id: 'simple-interest',
    input: 'La fórmula de interés simple es I = C*i*t durante el periodo.',
    mustPreserveTokens: ['C', 'i', 't'],
    forbiddenBroken: ['C  i  t', 'Cit'],
  },
  {
    id: 'triangle-area-parens',
    input: 'Calcula el área mediante (12*9)/2 = 54 cm².',
    mustPreserveTokens: ['12', '9'],
    forbiddenBroken: ['(129)/2', '(12 9)/2', '(12  9)/2'],
  },
  {
    id: 'base-height',
    input: 'Área = base*altura entre 2 para cada triángulo.',
    mustPreserveTokens: ['base', 'altura'],
    forbiddenBroken: ['basealtura', 'base  altura'],
  },
  {
    id: 'mixed-markdown-and-arithmetic',
    input: '*Foco instruccional:* si el perímetro es **2*largo + 2*ancho** y área = base*altura, resuelve `(12*9)/2` con *precisión*.',
    expectedStrippedEmphasis: ['Foco instruccional:', 'precisión'],
    forbiddenBroken: ['2largo', '2ancho', 'basealtura', '12 9'],
  },
] as const;

export const BASELINE_TAB_TIMES_AND_PUNCTUATION_CASES = {
  tabTimesRaw: 'El área rectángular dada (por ejemplo, Área = largo \times ancho); sustituye en \times 2.',
  doubleDotsRaw: 'Jóvenes del polígono de atención.. Impacto escolar.. Modelo aplicado.',
  spaceBeforePunctuationRaw: 'Revisa los coeficientes , despeja la incógnita ; valida el resultado .',
  preserveDecimalsAndUrls: 'Usa π ≈ 3.1416, versión v1.2.3, continúa con etc... y consulta https://example.org/a..b/v1.0.',
} as const;

export const BASELINE_DANGLING_FRAGMENTS = [
  'Identificar situaciones de tu entorno y activarás tus',
  'ANALIZAR SITUACIONES DE TU ENTORNO Y ACTIVARÁS TUS (SESIONES 1 A 3)',
  'Analizar situaciones de tu entorno y activarás tus — Sesión 1: Ecuaciones lineales',
  'Resolución de problemática de',
  'Diagnóstico de espacios comunitarios en',
] as const;

export const BASELINE_SESSION_HEADING_CASES = [
  {
    number: 1,
    objective: 'Sesión 1: Identificar el concepto de ecuación como una herramienta de modelación',
    expected: 'Sesión 1: Identificar el concepto de ecuación como una herramienta de modelación',
  },
  {
    number: 1,
    objective: 'Sesión 1 — Resolver sistemas de ecuaciones 2x2',
    expected: 'Sesión 1: Resolver sistemas de ecuaciones 2x2',
  },
  {
    number: 3,
    objective: 'SESIÓN 3. Modelar costos lineales mediante gráficas',
    expected: 'Sesión 3: Modelar costos lineales mediante gráficas',
  },
  {
    number: 12,
    objective: '12. Comparar área y perímetro de terrenos irregulares',
    expected: 'Sesión 12: Comparar área y perímetro de terrenos irregulares',
  },
  {
    number: 5,
    objective: 'Analizar la pendiente como razón de cambio.',
    expected: 'Sesión 5: Analizar la pendiente como razón de cambio',
  },
] as const;

export const BASELINE_GLUED_EXAMPLE_CASES = [
  'Planteamiento: En el huerto comunitario.\n1) x + y = 10 2) x - y = 4 Paso 2: Suma ambas ecuaciones para eliminar y.',
  'La ecuación resultante de la situación es: 3x + 150 = 750 Paso 2: Aplicación de la operación inversa para aislar el término.',
] as const;

export const BASELINE_SLIDE_90_QUADRATIC = {
  objetivo: 'Construir y analizar la representación gráfica y tabular de la función cuadrática asociada a la forma general.',
  contenido: 'Dada la función cuadrática y = -x² + 6x - 8, analiza su concavidad y vértice.',
  ejemploResuelto: [
    'Planteamiento: Dada la función cuadrática y = -x² + 6x - 8.',
    'Paso 1: Identifica los coeficientes de la forma completa y = ax² + bx + c (a = -1, b = 6, c = -8).',
    'Paso 2: La coordenada x_v = -6/(2(-1)) = -6/-2 = 3.',
    'Paso 3: Evalúa en x = 3: y_v = -(3)² + 6(3) - 8 = 1. El corte con el eje y es (0, -8).',
    'Conclusión: Construye una bitácora de tabulación tomando valores simétricos alrededor del vértice x = 3.',
  ].join('\n'),
} as const;

export const BASELINE_SLIDE_7_AND_141_ACTIVITIES = {
  slide7App:
    'Observa la sala de tu casa o el patio escolar como un plano cartesiano y elige dos variables medibles. Dibuja en una hoja de papel milimétrico un plano cartesiano y ubica tres puntos representativos.',
  slide141Practice:
    'El terreno comunitario tiene un largo de 12 metros y ancho de 9 metros. Si lo divides en dos triángulos mediante una diagonal de 10 metros, y las alturas de los triángulos respecto a esa diagonal son de 4 metros y 6 metros, ¿cuál es el área total del terreno?',
  slide141App:
    'Observa el salón de clases o tu habitación como un polígono rectangular. Mide sus dimensiones, calcula el área y propón una distribución de mobiliario.',
} as const;
