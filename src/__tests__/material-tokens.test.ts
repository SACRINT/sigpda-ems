// src/__tests__/material-tokens.test.ts
import { describe, it, expect } from 'vitest';
import {
  MATERIAL_TOKEN_RE,
  parseMaterialTokens,
  resolveMaterialTokensForMarkdown,
  stripMaterialTokens,
} from '@/lib/materials/material-tokens';

describe('T-IMG-02: Material Tokens Parser & Resolver', () => {
  it('exporta la expresión regular normativa MATERIAL_TOKEN_RE', () => {
    expect(MATERIAL_TOKEN_RE).toBeInstanceOf(RegExp);
    expect('[[material:multimetro]]').toMatch(MATERIAL_TOKEN_RE);
  });

  it('detecta token simple sin etiqueta visible', () => {
    const text = 'Para esta práctica se requiere un [[material:multimetro]] en la mesa.';
    const tokens = parseMaterialTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0].slug).toBe('multimetro');
    expect(tokens[0].label).toBe('Multímetro Digital Autorango');
    expect(tokens[0].exists).toBe(true);
    expect(tokens[0].item?.category).toBe('medicion');
  });

  it('detecta token con etiqueta visible personalizada', () => {
    const text = 'Conectar el [[material:multimetro|multímetro digital de 3 dígitos]] al circuito.';
    const tokens = parseMaterialTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0].slug).toBe('multimetro');
    expect(tokens[0].label).toBe('multímetro digital de 3 dígitos');
    expect(tokens[0].exists).toBe(true);
  });

  it('detecta tokens mediante alias registrados en el catálogo', () => {
    const text = 'Utilizar un [[material:polimetro]] para verificar la tensión.';
    const tokens = parseMaterialTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0].slug).toBe('polimetro');
    expect(tokens[0].exists).toBe(true);
    expect(tokens[0].item?.slug).toBe('multimetro');
    expect(tokens[0].label).toBe('Multímetro Digital Autorango');
  });

  it('preserva el token intacto cuando el slug es desconocido (D9)', () => {
    const text = 'Se requiere un [[material:aparato-inexistente-xyz]] para la prueba.';
    const tokens = parseMaterialTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0].slug).toBe('aparato-inexistente-xyz');
    expect(tokens[0].exists).toBe(false);
    expect(tokens[0].item).toBeUndefined();

    const resolved = resolveMaterialTokensForMarkdown(text);
    expect(resolved).toBe(text);
  });

  it('deja intacto el texto mixto sin tokens', () => {
    const plainText = 'Esta es una sesión teórica donde se explicarán conceptos de álgebra y física.';
    const tokens = parseMaterialTokens(plainText);
    expect(tokens).toHaveLength(0);

    const resolved = resolveMaterialTokensForMarkdown(plainText);
    expect(resolved).toBe(plainText);
  });

  it('respeta límites de longitud en etiqueta (>80 caracteres no hace match)', () => {
    const excessiveLabel = 'a'.repeat(81);
    const text = `Equipo [[material:osciloscopio|${excessiveLabel}]] en el laboratorio.`;
    const tokens = parseMaterialTokens(text);

    expect(tokens).toHaveLength(0);
    const resolved = resolveMaterialTokensForMarkdown(text);
    expect(resolved).toBe(text);
  });

  it('no es "comido" por caracteres de puntuación o adyacentes', () => {
    const text = 'Paso 1: Medir con [[material:osciloscopio]], luego guardar en [[material:cuaderno-campo]].';
    const tokens = parseMaterialTokens(text);

    expect(tokens).toHaveLength(2);
    expect(tokens[0].slug).toBe('osciloscopio');
    expect(tokens[1].slug).toBe('cuaderno-campo');

    const resolved = resolveMaterialTokensForMarkdown(text);
    expect(resolved).toBe(
      'Paso 1: Medir con Osciloscopio Digital de 2 Canales, luego guardar en Cuaderno y Bitácora de Registro de Campo.'
    );
  });

  it('maneja textos vacíos o nulos de forma segura', () => {
    expect(parseMaterialTokens('')).toEqual([]);
    expect(resolveMaterialTokensForMarkdown('')).toBe('');
    expect(stripMaterialTokens('')).toBe('');
    // @ts-expect-error validación en runtime
    expect(parseMaterialTokens(null)).toEqual([]);
    // @ts-expect-error validación en runtime
    expect(resolveMaterialTokensForMarkdown(null)).toBe('');
    // @ts-expect-error validación en runtime
    expect(stripMaterialTokens(null)).toBe('');
  });

  it('F-01: stripMaterialTokens elimina completamente la sintaxis [[material:...]] dejando texto plano limpio', () => {
    const raw = 'Práctica con [[material:multimetro|multímetro digital]] y [[material:probeta]] o [[material:desconocido|etiqueta libre]] o [[material:solo-slug]].';
    const clean = stripMaterialTokens(raw);

    expect(clean).not.toContain('[[');
    expect(clean).not.toContain(']]');
    expect(clean).not.toContain('material:');
    expect(clean).toBe('Práctica con multímetro digital y Probeta Graduada de Vidrio (100 ml) o etiqueta libre o solo-slug.');
  });
});
