import { describe, expect, it } from 'vitest';
import { INSTALACIONES_RESIDENCIALES_TRAJECTORY } from '@/lib/curriculum/trajectories/instalaciones-residenciales';
import { buildTeacherGuideMarkdown } from '@/lib/curriculum/teacher-guide';

const guide = buildTeacherGuideMarkdown(INSTALACIONES_RESIDENCIALES_TRAJECTORY, {
  generatedAt: '2026-11-11',
});

function count(pattern: RegExp): number {
  return (guide.match(pattern) ?? []).length;
}

describe('guía didáctica docente de Instalaciones Residenciales', () => {
  it('integra los 7 módulos y la nota de trazabilidad', () => {
    const sections = [
      '## 1. Ficha de identificación institucional',
      '## 2. Seguridad en taller y protocolos normativos',
      '## 3. Desglose secuenciado de las 24 actividades clave',
      '## 4. Kit de materiales de bajo costo y simuladores virtuales',
      '## 5. Evaluación formativa y rúbricas DBEPA',
      '## 6. Proyecto integrador de aula-comunidad (PAEC)',
      '## 7. Bibliografía y recursos curados',
      '## 8. Nota de revisión humana y trazabilidad',
    ];

    expect(count(/^## /gm)).toBe(8);
    for (const section of sections) {
      expect(guide).toContain(section);
    }
  });

  it('desglosa las 8 UAC y las 24 actividades con tres momentos', () => {
    INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes.forEach((node, index) => {
      expect(guide).toContain(`### 3.${index + 1} ${node.id} — ${node.uacName}`);
    });

    expect(count(/^#### Actividad \d+ —/gm)).toBe(24);
    expect(count(/\*\*Demostración técnica \(docente\):\*\*/g)).toBe(24);
    expect(count(/\*\*Práctica guiada \(parejas\):\*\*/g)).toBe(24);
    expect(count(/\*\*Reto autónomo \(equipo\):\*\*/g)).toBe(24);
    expect(count(/\*\*Errores comunes y prevención:\*\*/g)).toBe(24);
    expect(count(/\*\*Evidencia y criterio de logro:\*\*/g)).toBe(24);
    expect(count(/\*\*Seguridad específica:\*\*/g)).toBe(24);
  });

  it('declara la carga oficial, los contenidos y el proyecto integrador', () => {
    expect(guide).toContain('432 h');
    expect(guide).toContain('8 UAC');
    expect(guide).toContain('24 actividades');
    expect(guide).toContain('40 temas');
    expect(guide).toContain('Taller Comunitario de Instalaciones Residenciales Sustentables');
    expect(guide).toContain('2026-11-11');
  });

  it('incluye seguridad, normativa y protocolo de emergencia', () => {
    expect(guide).toContain('NOM-001-SEDE-2012');
    expect(guide).toContain('Equipo de Protección Personal (EPP)');
    expect(guide).toContain('Uso seguro del multímetro');
    expect(guide).toContain('911');
    expect(guide).toContain('Nunca use agua en un incendio eléctrico');
    expect(guide).toContain('12 V');
    expect(guide).toContain('127 V o 220 V');
  });

  it('incluye kit de bajo costo y simuladores gratuitos verificados', () => {
    expect(guide).toContain('https://phet.colorado.edu/es/simulations/circuit-construction-kit-dc');
    expect(guide).toContain('https://www.tinkercad.com/circuits');
    expect(guide).toContain('https://www.falstad.com/circuit/');
    expect(guide).toContain('https://www.sweethome3d.com/');
    expect(guide).toContain('https://www.geogebra.org/');
  });

  it('incluye evaluación DBEPA, rúbrica Saber/Hacer/Ser y prevención de 422', () => {
    expect(guide).toContain('Lista de cotejo de desempeño técnico');
    expect(guide).toContain('Rúbrica analítica por bloque');
    expect(guide).toContain('| Saber |');
    expect(guide).toContain('| Hacer |');
    expect(guide).toContain('| Ser |');
    expect(guide).toContain('30 %');
    expect(guide).toContain('50 %');
    expect(guide).toContain('20 %');
    expect(guide).toContain('evitar errores 422');
  });

  it('articula el PAEC con los cuatro hitos semestrales', () => {
    expect(guide).toContain('Diagnóstico y croquis del espacio comunitario');
    expect(guide).toContain('Preparación segura y habilitación del espacio');
    expect(guide).toContain('Acondicionamiento y colocación de elementos constructivos');
    expect(guide).toContain('Instalación sustentable y recuperación de sobrantes');
    expect(guide).toContain('#### Semestre 3.º');
    expect(guide).toContain('#### Semestre 6.º');
  });

  it('no contiene placeholders ni mojibake', () => {
    expect(guide).not.toMatch(/\b(TODO|TBD|placeholder|Lorem ipsum)\b/i);
    expect(guide).not.toMatch(/Ã|Â|â€/);
  });
});
