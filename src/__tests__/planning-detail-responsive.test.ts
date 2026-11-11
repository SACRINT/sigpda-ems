import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('Detalle de planeación — responsive e impresión', () => {
  it('oculta la navegación y aplana el modal al imprimir', () => {
    const printBlock = css.slice(css.indexOf('@media print'));

    expect(printBlock).toContain('.detail-hero');
    expect(printBlock).toContain('.detail-tabs');
    expect(printBlock).toContain('.detail-subtabs');
    expect(printBlock).toContain('.modal-sheet-header');
    expect(printBlock).toContain('display: none !important;');
    expect(printBlock).toContain('.modal-backdrop');
    expect(printBlock).toContain('position: static !important;');
  });

  it('colapsa el hero y el grid de recursos en móvil', () => {
    const mobileBlock = css.slice(css.indexOf('@media (max-width: 640px)'));

    expect(mobileBlock).toContain('.detail-hero');
    expect(mobileBlock).toContain('.detail-hero-actions');
    expect(mobileBlock).toContain('.resource-grid');
    expect(mobileBlock).toContain('grid-template-columns: 1fr;');
  });

  it('permite desplazamiento horizontal de los tabs principales', () => {
    const tabsBlock = css.slice(css.indexOf('.detail-tabs'), css.indexOf('.detail-tab {'));

    expect(tabsBlock).toContain('overflow-x: auto;');
  });
});
