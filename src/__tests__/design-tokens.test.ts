import { describe, it, expect } from 'vitest';
import {
  LEVEL4_HEX,
  SESSION_BOX_HEX,
  SESSION_BOX_RGB,
  SESSION_BOX_TEXT_HEX,
  SESSION_BOX_TEXT_RGB,
  isSessionBox,
  resolveLevel4FillHex,
  resolveLevel4FillRgb,
  resolveLevel4TextHex,
  resolveLevel4TextRgb,
} from '@/lib/visual-engine/design-tokens';

describe('cajas H4 de sesión', () => {
  it('detecta títulos de sesión con o sin acento', () => {
    expect(isSessionBox('Sesión 1: Apertura')).toBe(true);
    expect(isSessionBox('  SESION 2. Desarrollo')).toBe(true);
    expect(isSessionBox('A. Inicio')).toBe(false);
  });

  it('usa dorado con texto oscuro para sesiones', () => {
    expect(resolveLevel4FillHex('Sesión 3: Cierre', LEVEL4_HEX.C)).toBe(SESSION_BOX_HEX);
    expect(resolveLevel4FillRgb('Sesión 3: Cierre', [0, 0, 0])).toEqual(SESSION_BOX_RGB);
    expect(resolveLevel4TextHex('Sesión 3: Cierre')).toBe(SESSION_BOX_TEXT_HEX);
    expect(resolveLevel4TextRgb('Sesión 3: Cierre')).toEqual(SESSION_BOX_TEXT_RGB);
  });

  it('conserva la paleta y el texto blanco en cajas que no son sesión', () => {
    expect(resolveLevel4FillHex('A. Inicio', LEVEL4_HEX.C)).toBe(LEVEL4_HEX.A);
    expect(resolveLevel4TextHex('A. Inicio')).toBe('FFFFFF');
  });
});
