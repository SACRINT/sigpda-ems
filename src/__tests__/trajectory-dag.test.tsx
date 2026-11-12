import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import TrajectoryDag from '@/components/curriculum/TrajectoryDag';
import { INSTALACIONES_RESIDENCIALES_TRAJECTORY } from '@/lib/curriculum/trajectories/instalaciones-residenciales';

const FIRST_PROGRAM = {
  id: 'program-ir-3-1',
  uac_name: 'Interpreta croquis de diferentes instalaciones basicas de una vivienda',
  semester: 3,
  component: 'laboral',
  total_hours: 54,
};

describe('P1.4 TrajectoryDag', () => {
  it('renders the validated DAG with all eight UAC nodes and fifteen prerequisite edges', () => {
    const html = renderToString(
      <TrajectoryDag trajectory={INSTALACIONES_RESIDENCIALES_TRAJECTORY} />
    );

    expect(html).toContain('Trayectoria formativa');
    expect(html).toContain('DAG validado');
    expect(html).toContain('Instalaciones Residenciales');
    expect(html).toContain('8');
    expect(html).toContain('24');
    expect(html).toContain('432');

    for (const node of INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes) {
      expect(html).toContain(node.id);
    }

    expect(html.match(/marker-end=/g)).toHaveLength(15);
  });

  it('shows the selected UAC detail, activity contents and project milestone', () => {
    const html = renderToString(
      <TrajectoryDag trajectory={INSTALACIONES_RESIDENCIALES_TRAJECTORY} />
    );

    expect(html).toContain('IR-3.1');
    expect(html).toContain('Sin prerrequisitos');
    expect(html).toContain('Diagnóstico y croquis del espacio comunitario');
    expect(html).toContain('Identifica instalaciones básicas de una vivienda');
    expect(html).toContain('Instalaciones básicas de una vivienda: eléctrica, hidráulica, sanitaria y de gas');
  });

  it('links a catalog program when the UAC name matches after normalization', () => {
    const html = renderToString(
      <TrajectoryDag
        trajectory={INSTALACIONES_RESIDENCIALES_TRAJECTORY}
        programs={[FIRST_PROGRAM]}
        onOpenProgram={() => undefined}
      />
    );

    expect(html).toContain('Ver programa oficial');
  });

  it('does not render the catalog action without a matching program or callback', () => {
    const html = renderToString(
      <TrajectoryDag trajectory={INSTALACIONES_RESIDENCIALES_TRAJECTORY} />
    );

    expect(html).not.toContain('Ver programa oficial');
  });
});
