import { describe, it, expect } from 'vitest';
import { removeHyphens } from '@/lib/text-utils';

describe('text-utils — removeHyphens (MCCEMS Curricular Deshiphenization)', () => {
  it('1. Maneja valores vacíos, nulos o falsy sin lanzar excepciones', () => {
    expect(removeHyphens('')).toBe('');
    // @ts-expect-error test defensivo en runtime
    expect(removeHyphens(null)).toBe('');
    // @ts-expect-error test defensivo en runtime
    expect(removeHyphens(undefined)).toBe('');
  });

  it('2. Elimina soft-hyphens invisibles (\\u00ad)', () => {
    const input = 'me\u00adtodolo\u00adgía y epis\u00adtemología';
    expect(removeHyphens(input)).toBe('metodología y epistemología');
  });

  it('3. Reune palabras partidas por salto de línea (LF y CRLF) con acentos y mayúsculas', () => {
    expect(removeHyphens('metodoló-\ngico')).toBe('metodológico');
    expect(removeHyphens('metodoló-\r\n  gico')).toBe('metodológico');
    expect(removeHyphens('com-\nunicación')).toBe('comunicación');
    expect(removeHyphens('Pensa-\n  miento')).toBe('Pensamiento');
    expect(removeHyphens('MATEMÁ-\n  TICAS')).toBe('MATEMÁTICAS');
  });

  it('4. Reune palabras partidas con guión y espacio en la misma línea', () => {
    expect(removeHyphens('ló- gica matemática')).toBe('lógica matemática');
    expect(removeHyphens('proce-   dimiento estructurado')).toBe('procedimiento estructurado');
    expect(removeHyphens('alfabetiza- ción')).toBe('alfabetización');
  });

  it('5. Preserva palabras compuestas legítimas sin espacio posterior al guión', () => {
    expect(removeHyphens('enfoque teórico-práctico')).toBe('enfoque teórico-práctico');
    expect(removeHyphens('habilidades socio-emocionales')).toBe('habilidades socio-emocionales');
    expect(removeHyphens('laboratorio físico-químico')).toBe('laboratorio físico-químico');
    expect(removeHyphens('colectivo docente-estudiantil')).toBe('colectivo docente-estudiantil');
  });

  it('6. Preserva viñetas de listas y rangos numéricos', () => {
    expect(removeHyphens('- Primer punto de la lista')).toBe('- Primer punto de la lista');
    expect(removeHyphens('páginas 10-15 del manual')).toBe('páginas 10-15 del manual');
    expect(removeHyphens('ciclo escolar 2026-2027')).toBe('ciclo escolar 2026-2027');
  });

  it('7. Limpia párrafos complejos reales extraídos de programas oficiales MCCEMS', () => {
    const rawOfficial = 'Comprenda las matemá- ticas como expre- sión del pensa-\nmiento humano para aplicar en el ciclo 2026-2027 un enfoque teórico-práctico.';
    const expected = 'Comprenda las matemáticas como expresión del pensamiento humano para aplicar en el ciclo 2026-2027 un enfoque teórico-práctico.';
    expect(removeHyphens(rawOfficial)).toBe(expected);
  });
});
