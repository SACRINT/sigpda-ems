// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlanningDownloadsHub from '@/components/planeacion/PlanningDownloadsHub';
import type { Planning } from '@/types/planning';

describe('PlanningDownloadsHub tooltips de paquete consolidado', () => {
  it('muestra "9 entregables consolidados" en lugar de "10 entregables"', () => {
    const planning: Planning = {
      id: 'p-hub',
      teacherId: 't-1',
      uacName: 'Pensamiento Matemático III',
      semester: 3,
      component: 'fundamental',
      curriculumName: 'MCCEMS',
      paecContext: '',
      extractedData: null,
      contentJson: null,
      status: 'generated',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { container } = render(
      React.createElement(PlanningDownloadsHub, {
        planning,
        totalSessions: 72,
        generatedWorkbookCount: 3,
        totalWorkbookBlocks: 3,
        semestralReady: true,
        blockReviews: {},
      })
    );

    const html = container.innerHTML;
    expect(html).toContain('9 entregables consolidados');
    expect(html).not.toContain('10 entregables');
    expect(screen.getByTitle(/Descargar los 9 entregables consolidados.*Word/i)).toBeTruthy();
    expect(screen.getByTitle(/Descargar los 9 entregables consolidados.*PDF/i)).toBeTruthy();
  });
});

