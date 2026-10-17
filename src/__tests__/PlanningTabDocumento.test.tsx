import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import PlanningTabDocumento from '@/components/planning/PlanningTabDocumento';
import { featureFlags } from '@/lib/platform/feature-flags';
import type { Planning, GeneratedPlanningContent } from '@/types/planning';

describe('PlanningTabDocumento — Tarea 1: Botón de exportación editorial', () => {
  const dummyPlanning: Planning = {
    id: 'plan-xyz-123',
    teacherId: 'teacher-1',
    uacName: 'Lengua y Comunicación I',
    semester: 1,
    component: 'fundamental',
    curriculumName: 'MCCEMS 2026',
    paecContext: 'Comunidad escolar',
    extractedData: null,
    status: 'generated',
    contentJson: {
      sectionI: {
        teacherName: 'Prof. Demo',
        uacName: 'Lengua y Comunicación I',
        semester: 1,
        groups: '101, 102',
        schoolYear: '2026-2027',
        applicationPeriod: '2026-A',
        estimatedSessions: '64',
        component: 'fundamental',
        totalHours: 64,
        subsystem: 'DGB',
      },
      sectionII: {
        purpose: 'Propósito formativo',
        learningOutcomes: ['Resultado 1'],
        paecConnection: 'Vinculación comunitaria',
        activities: [],
      },
      sectionIII: {
        fundamentalCurriculum: [],
        expandedCurriculum: [],
      },
      sectionIV: {
        note: 'Nota',
        activities: [],
      },
    } as unknown as GeneratedPlanningContent,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('con feature flag false, el botón "Exportar Libro Editorial" NO debe renderizarse', () => {
    vi.spyOn(featureFlags, 'isEnabled').mockImplementation((flag) => {
      if (flag === 'EDITORIAL_PUBLISHER_ENGINE') return false;
      return false;
    });

    const html = renderToString(
      <PlanningTabDocumento planning={dummyPlanning} />,
    );

    expect(html).not.toContain('btn-exportar-editorial');
    expect(html).not.toContain('Exportar Libro Editorial');
    expect(html).not.toContain('editorial-action-bar');
  });

  it('con feature flag true pero sin id en planeación, el botón renderiza pero está disabled', () => {
    vi.spyOn(featureFlags, 'isEnabled').mockImplementation((flag) => {
      if (flag === 'EDITORIAL_PUBLISHER_ENGINE') return true;
      return false;
    });

    const emptyIdPlanning: Planning = {
      ...dummyPlanning,
      id: '',
    };

    const html = renderToString(
      <PlanningTabDocumento planning={emptyIdPlanning} />,
    );

    expect(html).toContain('btn-exportar-editorial');
    expect(html).toContain('Exportar Libro Editorial');
    expect(html).toContain('disabled=""');
  });

  it('con feature flag true y planeación con id, el botón renderiza y está habilitado', () => {
    vi.spyOn(featureFlags, 'isEnabled').mockImplementation((flag) => {
      if (flag === 'EDITORIAL_PUBLISHER_ENGINE') return true;
      return false;
    });

    const html = renderToString(
      <PlanningTabDocumento planning={dummyPlanning} isEditorialGenerating={false} />,
    );

    expect(html).toContain('btn-exportar-editorial');
    expect(html).toContain('Exportar Libro Editorial');
    // No debe contener el atributo disabled en el botón de exportación
    expect(html).toMatch(/<button[^>]*id="btn-exportar-editorial"[^>]*>/);
    const buttonMatch = html.match(/<button[^>]*id="btn-exportar-editorial"[^>]*>/)?.[0] || '';
    expect(buttonMatch).not.toContain('disabled');
  });

  it('con feature flag true y isEditorialGenerating=true, el botón renderiza en estado disabled con spinner', () => {
    vi.spyOn(featureFlags, 'isEnabled').mockImplementation((flag) => {
      if (flag === 'EDITORIAL_PUBLISHER_ENGINE') return true;
      return false;
    });

    const html = renderToString(
      <PlanningTabDocumento planning={dummyPlanning} isEditorialGenerating={true} />,
    );

    expect(html).toContain('btn-exportar-editorial');
    expect(html).toContain('Generando Libro…');
    const buttonMatch = html.match(/<button[^>]*id="btn-exportar-editorial"[^>]*>/)?.[0] || '';
    expect(buttonMatch).toContain('disabled');
  });
});
