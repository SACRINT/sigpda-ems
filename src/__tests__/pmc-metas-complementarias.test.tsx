/**
 * pmc-metas-complementarias.test.tsx
 *
 * Pruebas unitarias para el componente y flujo de Metas Complementarias / Adicionales del PMC
 * Permite agregar, editar y eliminar metas individuales e institucionales sin regenerar el PMC.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PmcMetasComplementarias } from '@/app/[locale]/pmc/nuevo/PmcMetasComplementarias';

describe('PmcMetasComplementarias — Gestión Directa de Metas Adicionales', () => {
  const mockStaff = [
    { nombre: 'Prof. Armando Morales', cargo: 'Docente', meta_individual: 'Meta preexistente' },
    { nombre: 'Mtra. Elena Rivera', cargo: 'Docente de Lenguaje' }, // Sin meta
  ];

  const mockPlan = {
    metas_institucionales: [
      {
        categoria: 'aprovechamiento',
        nombre_categoria: '1. Aprovechamiento académico y asistencia educativa',
        tema: 'Aprobación escolar',
        meta: 'Elevar la tasa de aprobación al 92%',
        estrategia: 'Tutorías personalizadas',
        linea_base: '85.5% en ciclo anterior',
        personal_designado: 'Director y Colegiado',
        entregable: 'Informe bimestral',
        periodo_inicio: 'Septiembre',
        periodo_fin: 'Julio',
        diagnostico_meta: 'Alta reprobación en matemáticas',
      },
    ],
    metas_personales: [
      {
        nombre: 'Prof. Armando Morales',
        cargo: 'Docente',
        meta_individual: 'Diseñar 4 secuencias didácticas integradoras',
        estrategia: 'ABP y trabajo colaborativo',
        entregable: 'Rúbricas y productos finales',
        periodo: 'Ciclo Escolar 2025-2026',
      },
    ],
  };

  it('renderiza correctamente el componente y detecta al docente sin meta', () => {
    const html = renderToString(
      <PmcMetasComplementarias
        projectId="pmc-test-123"
        planAccion={mockPlan}
        setPlanAccion={vi.fn()}
        staffData={mockStaff}
        cicloEscolar="2025-2026"
      />
    );

    // Debe incluir el título institucional
    expect(html).toContain('Adición Quirúrgica de Metas (Sin Afectar a Otros Docentes)');
    // Debe listar la meta individual existente en el resumen
    expect(html).toContain('Prof. Armando Morales');
    expect(html).toContain('Diseñar 4 secuencias didácticas integradoras');
    // Debe mostrar la opción para el docente sin meta en el selector
    expect(html).toContain('Mtra. Elena Rivera');
    expect(html).toContain('Sin meta');
  });

  it('renderiza las pestañas de asistencia quirúrgica y manuales', () => {
    const html = renderToString(
      <PmcMetasComplementarias
        projectId="pmc-test-123"
        planAccion={mockPlan}
        setPlanAccion={vi.fn()}
        staffData={mockStaff}
        cicloEscolar="2025-2026"
      />
    );

    // Comprueba que los botones de las tres pestañas existen
    expect(html).toContain('Ingestión Quirúrgica Asistida por IA');
    expect(html).toContain('Metas Individuales (Captura Manual)');
    expect(html).toContain('Metas Institucionales Formato 5.1 (Captura Manual)');
    expect(html).toContain('Normalización Inteligente de Metas en Bruto');
    // Comprueba que los botones directos de edición rápida están presentes
    expect(html).toContain('✏️ Editar');
  });

  it('consolidateMetasPersonalesByTeacher fusiona múltiples metas del mismo docente en una sola fila con viñetas', async () => {
    const { consolidateMetasPersonalesByTeacher } = await import('@/lib/pmc-document-structure');

    const multiMetas = [
      {
        nombre: 'Mtra. Docente 1',
        cargo: 'Docente',
        meta_individual: 'Realizar 2 cursos en tiempo y forma según COSFAC',
        estrategia: 'Inscripción en plataforma COSFAC',
        entregable: 'Constancia de acreditación',
        periodo: 'Ciclo Escolar 2025-2026',
      },
      {
        nombre: 'Docente 1',
        cargo: 'Docente de Matemáticas',
        meta_individual: 'Acreditar satisfactoriamente dichos cursos en un 100%',
        estrategia: 'Participación activa y entrega puntual',
        entregable: 'Diploma y portafolio de evidencias',
        periodo: 'Ciclo Escolar 2025-2026',
      },
      {
        nombre: 'Docente 2',
        cargo: 'Docente de Comunicación',
        meta_individual: 'Fomentar clubes de lectura semanales',
        estrategia: 'Círculos de lectura dirigidos',
        entregable: 'Bitácora de lecturas',
        periodo: 'Ciclo Escolar 2025-2026',
      },
    ];

    const consolidated = consolidateMetasPersonalesByTeacher(multiMetas);

    // Debe reducir de 3 a 2 filas (Docente 1 fusionado, Docente 2 intacto)
    expect(consolidated).toHaveLength(2);

    const docente1 = consolidated.find((d) => d.nombre.includes('Docente 1'));
    expect(docente1).toBeDefined();
    // Debe seleccionar el cargo más específico
    expect(docente1?.cargo).toBe('Docente de Matemáticas');
    // Las metas deben estar unidas con viñetas
    expect(docente1?.meta_individual).toContain('•');
    expect(docente1?.meta_individual).toContain('Realizar 2 cursos');
    expect(docente1?.meta_individual).toContain('Acreditar satisfactoriamente');
    // Las estrategias deben estar unidas con viñetas
    expect(docente1?.estrategia).toContain('•');
    expect(docente1?.estrategia).toContain('Inscripción en plataforma COSFAC');
    expect(docente1?.estrategia).toContain('Participación activa');
    // Los entregables deben estar unidos con viñetas
    expect(docente1?.entregable).toContain('•');
    expect(docente1?.entregable).toContain('Constancia de acreditación');
    expect(docente1?.entregable).toContain('Diploma y portafolio de evidencias');

    const docente2 = consolidated.find((d) => d.nombre.includes('Docente 2'));
    expect(docente2).toBeDefined();
    expect(docente2?.meta_individual).toBe('Fomentar clubes de lectura semanales');
  });

  it('getPmcCategoryTheme asigna con precisión los colores oficiales del Cuadro 2 (Verde, Dorado, Vino Tinto)', async () => {
    const { getPmcCategoryTheme, PMC_CUADRO_2_CATEGORIAS } = await import('@/lib/pmc-document-structure');

    // Categoría 1: Verde Bosque Institucional
    const cat1Academic = getPmcCategoryTheme('categoria_1', 'Indicadores académicos y reprobación');
    expect(cat1Academic.colorHeaderHex).toBe('1E5638');
    expect(cat1Academic.rgbHeader).toEqual([30, 86, 56]);
    expect(cat1Academic.categoriaNum).toBe(1);

    // Categoría 2: Dorado Ocre Clásico
    const cat2Gestion = getPmcCategoryTheme('categoria_2', 'Seguimiento al desempeño docente en el aula');
    expect(cat2Gestion.colorHeaderHex).toBe('996515');
    expect(cat2Gestion.rgbHeader).toEqual([153, 101, 21]);
    expect(cat2Gestion.categoriaNum).toBe(2);

    const cat2Vinculacion = getPmcCategoryTheme('vinculacion', 'Convenios con empresas y centros educativos');
    expect(cat2Vinculacion.colorHeaderHex).toBe('996515');

    // Categoría 3: Vino Tinto Institucional
    const cat3Socioemocional = getPmcCategoryTheme('categoria_3', 'Estrategias contra la violencia y convivencia de paz');
    expect(cat3Socioemocional.colorHeaderHex).toBe('821A36');
    expect(cat3Socioemocional.rgbHeader).toEqual([130, 26, 54]);
    expect(cat3Socioemocional.categoriaNum).toBe(3);

    const cat3Saludable = getPmcCategoryTheme('socioemocional', 'Vive Saludable y estilos de vida');
    expect(cat3Saludable.colorHeaderHex).toBe('821A36');
  });
});
