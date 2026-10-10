import { describe, it, expect } from 'vitest';
import { highlightCodeBlock } from '@/lib/visual-engine/code-highlighter';
import { CODE_IDE } from '@/lib/visual-engine/design-tokens';

describe('code-highlighter — Multiline Carry-Over Lexer', () => {
  it('retorna array vacío para código nulo o vacío', () => {
    expect(highlightCodeBlock('')).toEqual([]);
  });

  it('preserva el estado multilínea en docstrings triples (carry-over de 4 líneas)', () => {
    const pythonDocstring = `
"""
Línea 2 de docstring explicativo.
Línea 3 con más detalles técnicos.
"""
x = 10
    `.trim();

    const lines = highlightCodeBlock(pythonDocstring, 'python');
    expect(lines).toHaveLength(5);

    // Línea 1 abre docstring: debe tener color string
    expect(lines[0].tokens[0].color).toEqual(CODE_IDE.string);

    // Línea 2 y 3 no tienen comillas en su texto pero heredan el estado carry-over:
    expect(lines[1].tokens[0].color).toEqual(CODE_IDE.string);
    expect(lines[1].tokens[0].text).toContain('Línea 2');

    expect(lines[2].tokens[0].color).toEqual(CODE_IDE.string);
    expect(lines[2].tokens[0].text).toContain('Línea 3');

    // Línea 4 cierra docstring
    expect(lines[3].tokens[0].color).toEqual(CODE_IDE.string);

    // Línea 5 es código normal fuera del docstring: x = 10
    const line5Tokens = lines[4].tokens;
    const xToken = line5Tokens.find((t) => t.text === 'x');
    const numToken = line5Tokens.find((t) => t.text === '10');

    expect(xToken?.color).toEqual(CODE_IDE.baseText);
    expect(numToken?.color).toEqual(CODE_IDE.number);
  });

  it('resalta palabras clave, builtins, strings y comentarios de Python', () => {
    const code = `
import pandas as pd # Cargar biblioteca
def limpiar_datos(df):
    print("Iniciando proceso...")
    return df.dropna()
    `.trim();

    const lines = highlightCodeBlock(code, 'python');
    expect(lines).toHaveLength(4);

    // Línea 1: import pandas as pd # Cargar biblioteca
    const line1 = lines[0].tokens;
    const importToken = line1.find((t) => t.text === 'import');
    const asToken = line1.find((t) => t.text === 'as');
    const commentToken = line1.find((t) => t.text.includes('# Cargar biblioteca'));

    expect(importToken?.color).toEqual(CODE_IDE.keyword);
    expect(asToken?.color).toEqual(CODE_IDE.keyword);
    expect(commentToken?.color).toEqual(CODE_IDE.comment);

    // Línea 2: def
    const defToken = lines[1].tokens.find((t) => t.text === 'def');
    expect(defToken?.color).toEqual(CODE_IDE.keyword);

    // Línea 3: print builtin y string
    const printToken = lines[2].tokens.find((t) => t.text === 'print');
    const strToken = lines[2].tokens.find((t) => t.text.includes('Iniciando proceso...'));

    expect(printToken?.color).toEqual([220, 220, 170]); // Python builtin color
    expect(strToken?.color).toEqual(CODE_IDE.string);

    // Línea 4: return
    const returnToken = lines[3].tokens.find((t) => t.text === 'return');
    expect(returnToken?.color).toEqual(CODE_IDE.keyword);
  });

  it('resalta comandos y flags de Bash', () => {
    const bashCode = `$ pip install pandas --upgrade # Instalar dependencias`;
    const lines = highlightCodeBlock(bashCode, 'bash');
    expect(lines).toHaveLength(1);

    const tokens = lines[0].tokens;
    const promptToken = tokens.find((t) => t.text === '$');
    const pipToken = tokens.find((t) => t.text === 'pip');
    const flagToken = tokens.find((t) => t.text === '--upgrade');
    const commentToken = tokens.find((t) => t.text.includes('# Instalar'));

    expect(promptToken?.color).toEqual(CODE_IDE.keyword);
    expect(pipToken?.color).toEqual(CODE_IDE.keyword);
    expect(flagToken?.color).toEqual([156, 220, 254]);
    expect(commentToken?.color).toEqual(CODE_IDE.comment);
  });
});
