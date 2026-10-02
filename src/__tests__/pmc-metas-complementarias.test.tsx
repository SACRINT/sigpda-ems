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
  });
});
