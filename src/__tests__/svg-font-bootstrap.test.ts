import { describe, it, expect } from 'vitest';
import { buildFontsConf, ensureSvgFontsRegistered } from '@/lib/visual-engine/svg-font-bootstrap';

describe('svg-font-bootstrap (H-1: tofu en portada rasterizada con librsvg)', () => {
  it('buildFontsConf apunta fontconfig al directorio de fuentes y a un cachedir', () => {
    const conf = buildFontsConf('/tmp/x/fonts', '/tmp/x/cache');
    expect(conf).toContain('<dir>/tmp/x/fonts</dir>');
    expect(conf).toContain('<cachedir>/tmp/x/cache</cachedir>');
    expect(conf).toContain('<family>Lato</family>');
    expect(conf).toContain('<family>Montserrat</family>');
  });

  it('ensureSvgFontsRegistered nunca lanza y es idempotente', () => {
    const first = ensureSvgFontsRegistered();
    const second = ensureSvgFontsRegistered();
    expect(typeof first).toBe('boolean');
    expect(second).toBe(first);
    if (process.platform === 'linux') {
      expect(process.env.FONTCONFIG_FILE).toBeTruthy();
    }
  });
});
