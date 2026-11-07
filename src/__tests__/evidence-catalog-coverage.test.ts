import { describe, it, expect } from 'vitest';
import {
  asegurarCoberturaEvidencias,
  asegurarCoberturaEvidenciasEstructuradas,
  construirProgresionesResumidas,
  type ContenidoFormativoFuente,
} from '@/lib/curriculum-evidence-engine';

const contenidosPensamientoMatematicoIII: ContenidoFormativoFuente[] = [
  {
    numero: 1,
    proposito:
      'Aplica la aritmética y el manejo del álgebra para encontrar el valor de una incógnita en ecuaciones lineales que refieran a situaciones de interés.',
    contenidos: [
      'Concepto de ecuación y sus partes',
      'Ecuaciones lineales de primer grado',
      'Procedimiento para encontrar el valor de una incógnita',
      'Forma estándar de las ecuaciones lineales',
    ],
  },
  {
    numero: 2,
    proposito:
      'Aplica la aritmética y el manejo del álgebra para resolver ecuaciones lineales con dos incógnitas que refieran a situaciones de interés.',
    contenidos: [
      'Ecuaciones lineales con dos incógnitas',
      'Procedimiento para solucionar ecuaciones lineales con dos incógnitas',
      'Ecuación de la recta',
      'Concepto de plano cartesiano: ejes perpendiculares: horizontal (X) y vertical (Y)',
      'Representación gráfica de la ecuación de la recta',
    ],
  },
  {
    numero: 3,
    proposito:
      'Aplica la aritmética, el manejo del álgebra y el método gráfico para resolver sistemas de ecuaciones lineales que refieran a situaciones de interés',
    contenidos: [
      'Método de igualación',
      'Método de sustitución',
      'Método de reducción',
      'Método gráfico',
      'Método por determinantes',
    ],
  },
  {
    numero: 4,
    proposito:
      'Aplica la aritmética y el manejo del álgebra para resolver ecuaciones cuadráticas que refieran a situaciones de interés.',
    contenidos: [
      'Ecuaciones cuadráticas',
      'Forma general de la ecuación cuadrática',
      'Resolución por método de completar cuadrados',
      'Aplicación de fórmula general para ecuaciones cuadráticas (Bhaskara)',
      'Representación gráfica',
    ],
  },
  {
    numero: 5,
    proposito:
      'Expresa y resuelve diversas situaciones de interés a través de distintos tipos de ecuaciones para comprender su relevancia en otras áreas del conocimiento, fenómenos naturales o en distintas esferas de la vida humana.',
    contenidos: [
      'Cálculo de intereses simples y compuestos en finanzas personales',
      'Descripción del crecimiento poblacional o propagación de fenómenos (ej. epidemia)',
      'Determinar medidas o cantidades de material en proyectos de arquitectura',
    ],
  },
  {
    numero: 6,
    proposito:
      'Revisa el teorema del triángulo de Napoleón, considerándolo como un problema-meta para aplicar resultados de la geometría euclidiana.',
    contenidos: [
      'Introducción a la geometría plana',
      'Ángulos, definición, tipos y componentes',
      'Teorema de Pitágoras',
      'Construcción de triángulos rectángulos',
      'Criterios de congruencia y semejanza de triángulos',
    ],
  },
];

describe('Guardián de Cobertura Curricular de Evidencias (asegurarCoberturaEvidencias)', () => {
  const uacMatIII = 'Pensamiento Matemático III. Pensamientos algebraico e introducción a geometría plana';

  it('Caso 1 (Pensamiento Matemático III): conserva las 3 evidencias de álgebra y complementa las faltantes incluyendo Geometría Plana (Napoleón / Pitágoras)', () => {
    const evidenciasIncompletas = [
      'Problemario de ecuaciones lineales y cuadráticas con aplicación contextualizada',
      'Reporte de resolución de sistemas de ecuaciones por múltiples métodos (igualación, sustitución, gráfico)',
      'Proyecto de modelación algebraica y representación gráfica de funciones lineales',
    ];

    const progs = construirProgresionesResumidas(contenidosPensamientoMatematicoIII, []);
    const resultado = asegurarCoberturaEvidencias(evidenciasIncompletas, progs, uacMatIII, 'fundamental');

    expect(resultado.length).toBe(6);
    // Conserva las 3 evidencias curadas existentes
    expect(resultado[0]).toBe(evidenciasIncompletas[0]);
    expect(resultado[1]).toBe(evidenciasIncompletas[1]);
    expect(resultado[2]).toBe(evidenciasIncompletas[2]);

    // Incluye evidencia explícita de geometría (Napoleón / Pitágoras / geometría plana)
    const textoTotal = resultado.join(' ').toLowerCase();
    expect(textoTotal).toMatch(/napole[oó]n|pit[aá]goras|geometr[ií]a/);
    expect(textoTotal).toMatch(/intereses|crecimiento|finanzas/);
  });

  it('Es estrictamente idempotente: volver a ejecutar sobre las 6 evidencias completas no duplica ni altera la lista', () => {
    const evidenciasIncompletas = [
      'Problemario de ecuaciones lineales y cuadráticas con aplicación contextualizada',
      'Reporte de resolución de sistemas de ecuaciones por múltiples métodos (igualación, sustitución, gráfico)',
      'Proyecto de modelación algebraica y representación gráfica de funciones lineales',
    ];

    const progs = construirProgresionesResumidas(contenidosPensamientoMatematicoIII, []);
    const primeraPasada = asegurarCoberturaEvidencias(evidenciasIncompletas, progs, uacMatIII, 'fundamental');
    const segundaPasada = asegurarCoberturaEvidencias(primeraPasada, progs, uacMatIII, 'fundamental');

    expect(segundaPasada).toEqual(primeraPasada);
  });

  it('Caso 2 (Formación Laboral / Submódulos): deriva 1 evidencia técnica por actividad clave cuando el catálogo viene vacío', () => {
    const actividadesLaborales = [
      { order: 1, name: 'Recluta al talento humano para la organización' },
      { order: 2, name: 'Selecciona al personal idóneo mediante instrumentos técnicos' },
      { order: 3, name: 'Asiste en la contratación e inducción del talento humano' },
    ];

    const progs = construirProgresionesResumidas([], actividadesLaborales);
    const evidencias = asegurarCoberturaEvidencias(
      [],
      progs,
      'Submódulo 1: Gestiona el proceso de reclutamiento, selección y admisión del talento humano',
      'laboral'
    );

    expect(evidencias).toHaveLength(3);
    expect(evidencias[0].toLowerCase()).toContain('recluta al talento humano');
    expect(evidencias[1].toLowerCase()).toContain('selecciona al personal');
    expect(evidencias[2].toLowerCase()).toContain('contratación');
    expect(evidencias.join(' ').toLowerCase()).not.toContain('ensayo crítico');
  });

  it('Caso 3 (Overrides del docente): respeta evidencias eliminadas y editadas por el docente', () => {
    const progs = construirProgresionesResumidas(contenidosPensamientoMatematicoIII, []);
    const iniciales = asegurarCoberturaEvidenciasEstructuradas([], progs, uacMatIII, 'fundamental');
    expect(iniciales).toHaveLength(6);

    const idEliminar = iniciales[0].id;
    const idEditar = iniciales[1].id;

    const conOverrides = asegurarCoberturaEvidenciasEstructuradas([], progs, uacMatIII, 'fundamental', {
      eliminados: [idEliminar],
      editadas: {
        [idEditar]: { producto: 'Evidencia personalizada por el docente para el Bloque 1' },
      },
    });

    expect(conOverrides).toHaveLength(5);
    expect(conOverrides.some((e) => e.id === idEliminar)).toBe(false);
    expect(conOverrides.find((e) => e.id === idEditar)?.producto).toBe(
      'Evidencia personalizada por el docente para el Bloque 1'
    );
  });
});

