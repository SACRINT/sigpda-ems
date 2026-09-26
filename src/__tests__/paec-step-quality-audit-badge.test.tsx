/**
 * paec-step-quality-audit-badge.test.tsx
 *
 * Tests unitarios para el componente PaecStepQualityAuditBadge (Item B3).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PaecStepQualityAuditBadge } from '@/components/paec/PaecStepQualityAuditBadge';
import type { PaecQualityAudit, PaecAuditCriterion } from '@/types/paec';

describe('B3: PaecStepQualityAuditBadge Component & 23 Criterios Quality Gate', () => {
  const mockCriterionPass: PaecAuditCriterion = {
    id: 1,
    name: 'Tabla 1 (Comunidad): Datos duros situados',
    dimension: 'Dimensión 1: Diagnóstico',
    expectedLevel: 'Excelente (4)',
    score: 4,
    status: 'pass',
    feedback: 'Diagnóstico excelente con datos duros.',
    evidenceFound: '5 aspectos analizados con cifras INEGI.',
  };

  const mockCriterionWarn: PaecAuditCriterion = {
    id: 2,
    name: 'Tabla 2 (Plantel): Indicadores 911/F11 situados',
    dimension: 'Dimensión 1: Diagnóstico',
    expectedLevel: 'Excelente (4)',
    score: 2,
    status: 'warning',
    feedback: 'Faltan indicadores de abandono escolar.',
    evidenceFound: 'Solo se registraron 2 indicadores generales.',
  };

  const mockCriterionFail: PaecAuditCriterion = {
    id: 3,
    name: 'FODA Situado en el Territorio',
    dimension: 'Dimensión 1: Diagnóstico',
    expectedLevel: 'Excelente (4)',
    score: 1,
    status: 'fail',
    feedback: 'FODA genérico sin anclaje territorial.',
    evidenceFound: 'Sin datos situados.',
  };

  it('1. Score >= 85: Renderiza badge verde con etiqueta Excelente', () => {
    const audit: PaecQualityAudit = {
      score: 92,
      estatus: 'aprobado_excelente',
      criterios: [mockCriterionPass],
    };

    const html = renderToString(<PaecStepQualityAuditBadge step={1} stepAudit={audit} />);

    expect(html).toContain('Auditoría Calidad Paso 1');
    expect(html).toContain('Excelente');
    expect(html).toContain('92');
    expect(html).toContain('/ 100 pts');
    expect(html).toContain('#10b981'); // Color verde
  });

  it('2. Score 70-84: Renderiza badge ámbar con etiqueta Satisfactorio', () => {
    const audit: PaecQualityAudit = {
      score: 75,
      estatus: 'aprobado',
      criterios: [mockCriterionPass, mockCriterionWarn],
    };

    const html = renderToString(<PaecStepQualityAuditBadge step={1} stepAudit={audit} />);

    expect(html).toContain('Auditoría Calidad Paso 1');
    expect(html).toContain('Satisfactorio');
    expect(html).toContain('75');
    expect(html).toContain('#f59e0b'); // Color ámbar
  });

  it('3. Score < 70: Renderiza badge rojo con etiqueta Requiere Ajustes', () => {
    const audit: PaecQualityAudit = {
      score: 50,
      estatus: 'requiere_ajustes',
      criterios: [mockCriterionFail],
    };

    const html = renderToString(<PaecStepQualityAuditBadge step={1} stepAudit={audit} />);

    expect(html).toContain('Auditoría Calidad Paso 1');
    expect(html).toContain('Requiere Ajustes');
    expect(html).toContain('50');
    expect(html).toContain('#ef4444'); // Color rojo
  });

  it('4. Si stepAudit es null pero globalAudit está disponible, deriva los criterios del paso correspondientes', () => {
    const globalAudit: PaecQualityAudit = {
      score: 88,
      estatus: 'aprobado_excelente',
      criterios: [
        mockCriterionPass, // id: 1 (corresponde a Paso 1)
        mockCriterionWarn, // id: 2 (corresponde a Paso 1)
        {
          id: 5,
          name: 'Justificación NEM y Pertinencia',
          dimension: 'Dimensión 2: Justificación',
          expectedLevel: 'Excelente (4)',
          score: 4,
          status: 'pass',
          feedback: 'Excelente anclaje.',
          evidenceFound: 'Pertinencia validada.',
        }, // id: 5 (corresponde a Paso 2)
      ],
    };

    // Render para Paso 1 sin stepAudit explícito: debe filtrar criterios 1 y 2
    const htmlStep1 = renderToString(<PaecStepQualityAuditBadge step={1} globalAudit={globalAudit} />);
    expect(htmlStep1).toContain('Auditoría Calidad Paso 1');
    // Criterio 1 (4 pts) + Criterio 2 (2 pts) = 6 / 8 = 75% -> Satisfactorio
    expect(htmlStep1).toContain('75');
    expect(htmlStep1).toContain('Satisfactorio');

    // Render para Paso 2 sin stepAudit explícito: debe filtrar criterio 5
    const htmlStep2 = renderToString(<PaecStepQualityAuditBadge step={2} globalAudit={globalAudit} />);
    expect(htmlStep2).toContain('Auditoría Calidad Paso 2');
    // Criterio 5 (4 pts) = 4 / 4 = 100% -> Excelente
    expect(htmlStep2).toContain('100');
    expect(htmlStep2).toContain('Excelente');
  });

  it('5. En Paso 9, si globalAudit está disponible, renderiza la pestaña de auditoría global de 23 criterios', () => {
    const globalAudit: PaecQualityAudit = {
      score: 86,
      estatus: 'aprobado_excelente',
      criterios: [mockCriterionPass],
    };

    const stepAudit: PaecQualityAudit = {
      score: 90,
      estatus: 'aprobado_excelente',
      criterios: [
        {
          id: 21,
          name: 'Comité de Gobernanza Escolar',
          dimension: 'Dimensión 8: Gobernanza',
          expectedLevel: 'Excelente (4)',
          score: 4,
          status: 'pass',
          feedback: 'Gobernanza completa.',
          evidenceFound: '4 niveles definidos.',
        },
      ],
    };

    const html = renderToString(<PaecStepQualityAuditBadge step={9} stepAudit={stepAudit} globalAudit={globalAudit} />);
    expect(html).toContain('Paso 9 (90 pts)');
    expect(html).toContain('Global 23 Criterios (86 pts)');
  });
});
