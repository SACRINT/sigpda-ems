import { describe, it, expect } from 'vitest';
import {
  autoTokenizeMaterials,
  detectCatalogMaterials,
} from '@/lib/materials/auto-tokenize';
import { parseMaterialTokensWithFallback } from '@/lib/materials/material-tokens';

describe('auto-tokenize — Recuperación determinista de tokens de materiales', () => {
  it('1. Tokeniza frase simple como "Se requiere un multímetro digital"', () => {
    const input = 'Se requiere un multímetro digital';
    const output = autoTokenizeMaterials(input);
    expect(output).toContain('[[material:multimetro');
    expect(output).toBe('Se requiere un [[material:multimetro|multímetro digital]]');
  });

  it('2. Respeta acentos y mayúsculas en "PROBETA graduada de vidrio"', () => {
    const input = 'Se necesita una PROBETA graduada de vidrio para la medición';
    const output = autoTokenizeMaterials(input);
    // Gana la variante más larga probeta / probeta-graduada
    expect(output).toMatch(/\[\[material:(?:probeta|probeta-graduada)\|PROBETA graduada de vidrio\]\]/);
  });

  it('3. Idempotencia estricta: aplicar dos veces produce el mismo resultado', () => {
    const text = 'Utilizar un osciloscopio y un taladro con multímetro digital.';
    const once = autoTokenizeMaterials(text);
    const twice = autoTokenizeMaterials(once);
    expect(twice).toBe(once);
  });

  it('4. Texto ya tokenizado no se altera ni doble-tokeniza', () => {
    const text = 'usa [[material:tangram]] y [[material:multimetro|Multímetro digital]]';
    const output = autoTokenizeMaterials(text);
    expect(output).toBe(text);
  });

  it('5. Texto sin materiales permanece idéntico byte a byte', () => {
    const plain = 'Redactar un ensayo sobre la historia del arte mexicano del siglo XX.';
    expect(autoTokenizeMaterials(plain)).toBe(plain);
  });

  it('6. Slug inexistente permanece intacto (D9)', () => {
    const text = 'Herramienta especial material-que-no-existe-xyz en el aula.';
    expect(autoTokenizeMaterials(text)).toBe(text);
  });

  it('7. No tokeniza texto que forme parte de una URL', () => {
    const urlText = 'Consultar el esquema en https://ejemplo.com/materiales/multimetro.png o www.sitio.com/multimetro';
    const output = autoTokenizeMaterials(urlText);
    expect(output).not.toContain('[[material:multimetro');
    expect(output).toBe(urlText);
  });

  it('8. Nombres cortos (< 6 caracteres) no se tokenizan para evitar falsos positivos', () => {
    const text = 'usa una lupa y dados para el experimento con aros';
    const output = autoTokenizeMaterials(text);
    expect(output).toBe(text);
  });

  it('9. detectCatalogMaterials devuelve slugs únicos y ordenados por aparición', () => {
    const text = 'Práctica con multímetro digital, taladro y otro multímetro en el banco.';
    const detected = detectCatalogMaterials(text);
    expect(detected.length).toBe(2);
    expect(detected[0].slug).toBe('multimetro');
    expect(detected[1].slug).toBe('taladro');
  });

  it('10. Texto extenso (10k caracteres) preserva espacios y formato', () => {
    const baseUnit = 'Texto explicativo sobre fenómenos físicos sin alterar espacios ni sangrías. ';
    const bigText = baseUnit.repeat(150); // ~11,000 chars
    const output = autoTokenizeMaterials(bigText);
    expect(output).toBe(bigText);
  });

  it('parseMaterialTokensWithFallback resuelve tokens a partir de texto libre', () => {
    const freeText = 'Requerimientos: 1 multímetro digital y 1 probeta de laboratorio.';
    const resolved = parseMaterialTokensWithFallback(freeText);
    expect(resolved.length).toBeGreaterThanOrEqual(2);
    expect(resolved.map((r) => r.slug)).toContain('multimetro');
    expect(resolved.map((r) => r.slug)).toContain('probeta');
  });
});
