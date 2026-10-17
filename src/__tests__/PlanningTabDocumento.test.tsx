import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import PlanningTabDocumento from '@/components/planning/PlanningTabDocumento';
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

  it('AUD-T1 Invariante Arquitectónico: PlanningTabDocumento no debe importar feature-flags en código cliente', () => {
    const tabSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/planeacion/tabs/PlanningTabDocumento.tsx'),
      'utf8',
    );
    expect(tabSource).not.toContain('@/lib/platform/feature-flags');
    expect(tabSource).not.toContain('featureFlags.isEnabled');
  });

  it('con editorialEngineEnabled=false, el botón "Exportar Libro Editorial" NO debe renderizarse', () => {
    const html = renderToString(
      <PlanningTabDocumento planning={dummyPlanning} editorialEngineEnabled={false} />,
    );

    expect(html).not.toContain('btn-exportar-editorial');
    expect(html).not.toContain('Exportar Libro Editorial');
    expect(html).not.toContain('editorial-action-bar');
  });

  it('con editorialEngineEnabled=true pero sin id en planeación, el botón renderiza pero está disabled', () => {
    const emptyIdPlanning: Planning = {
      ...dummyPlanning,
      id: '',
    };

    const html = renderToString(
      <PlanningTabDocumento planning={emptyIdPlanning} editorialEngineEnabled={true} />,
    );

    expect(html).toContain('btn-exportar-editorial');
    expect(html).toContain('Exportar Libro Editorial');
    expect(html).toContain('disabled=""');
  });

  it('con editorialEngineEnabled=true y planeación con id, el botón renderiza y está habilitado', () => {
    const html = renderToString(
      <PlanningTabDocumento
        planning={dummyPlanning}
        editorialEngineEnabled={true}
        isEditorialGenerating={false}
      />,
    );

    expect(html).toContain('btn-exportar-editorial');
    expect(html).toContain('Exportar Libro Editorial');
    // No debe contener el atributo disabled en el botón de exportación
    expect(html).toMatch(/<button[^>]*id="btn-exportar-editorial"[^>]*>/);
    const buttonMatch = html.match(/<button[^>]*id="btn-exportar-editorial"[^>]*>/)?.[0] || '';
    expect(buttonMatch).not.toContain('disabled');
    // AUD-T2: Badge debe reflejar Typst 0.13 en coherencia con el Dockerfile
    expect(html).toContain('MCCEMS · Typst 0.13');
  });

  it('con editorialEngineEnabled=true y isEditorialGenerating=true, el botón renderiza en estado disabled con spinner', () => {
    const html = renderToString(
      <PlanningTabDocumento
        planning={dummyPlanning}
        editorialEngineEnabled={true}
        isEditorialGenerating={true}
      />,
    );

    expect(html).toContain('btn-exportar-editorial');
    expect(html).toContain('Generando Libro…');
    const buttonMatch = html.match(/<button[^>]*id="btn-exportar-editorial"[^>]*>/)?.[0] || '';
    expect(buttonMatch).toContain('disabled');
  });
});
