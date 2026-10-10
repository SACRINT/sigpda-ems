import { describe, it, expect } from 'vitest';
import { parseLabStepsFromProse } from '@/lib/guide-engine/lab-step-parser';

describe('parseLabStepsFromProse — Deterministic Lab Step Parser', () => {
  it('degrada a array vacío si el texto es nulo, indefinido o vacío', () => {
    expect(parseLabStepsFromProse(null)).toEqual([]);
    expect(parseLabStepsFromProse(undefined)).toEqual([]);
    expect(parseLabStepsFromProse('')).toEqual([]);
    expect(parseLabStepsFromProse('   \n\t  ')).toEqual([]);
  });

  it('degrada a array vacío (D9) si hay menos de 3 pasos numerados', () => {
    const text2Steps = `
1. Preparar el entorno de trabajo: Instalar dependencias necesarias.
2. Crear archivo de script: Abrir VS Code y crear main.py.
    `;
    expect(parseLabStepsFromProse(text2Steps)).toEqual([]);
  });

  it('parsea correctamente una secuencia de 5 pasos técnicos con código y salidas', () => {
    const realProse = `
1. Preparación del Entorno: Configurar la carpeta de trabajo e instalar bibliotecas.
$ pip install pandas numpy
<!--workbook:lines:rows=3-->

2. Importación y Verificación: Abrir el editor y cargar las herramientas.
\`\`\`python
import pandas as pd
import numpy as np
\`\`\`
Salida esperada: Bibliotecas cargadas correctamente en memoria sin errores.

3. Carga del Conjunto de Datos: Leer el archivo CSV proporcionado.
df = pd.read_csv('datos_estudiantes.csv')
Nota: Asegúrate de que el archivo se encuentre en la misma ruta.

4. Detección de Valores Nulos: Identificar columnas con datos faltantes.
print(df.isnull().sum())
Resultado esperado: Conteo de valores nulos por columna.

5. Exportación del Dataset Limpio: Guardar el resultado para entrenamiento.
df.to_csv('limpio.csv', index=False)
Salida: Archivo limpio.csv generado exitosamente.
    `;

    const result = parseLabStepsFromProse(realProse);
    expect(result).toHaveLength(5);

    expect(result[0].stepNumber).toBe(1);
    expect(result[0].title).toBe('Preparación del Entorno');
    expect(result[0].codeSnippet).toBe('$ pip install pandas numpy');

    expect(result[1].stepNumber).toBe(2);
    expect(result[1].title).toBe('Importación y Verificación');
    expect(result[1].codeSnippet).toContain('import pandas as pd');
    expect(result[1].expectedOutput).toBe('Bibliotecas cargadas correctamente en memoria sin errores.');

    expect(result[2].stepNumber).toBe(3);
    expect(result[2].title).toBe('Carga del Conjunto de Datos');
    expect(result[2].tipOrNote).toBe('Asegúrate de que el archivo se encuentre en la misma ruta.');

    expect(result[3].stepNumber).toBe(4);
    expect(result[3].title).toBe('Detección de Valores Nulos');
    expect(result[3].expectedOutput).toBe('Conteo de valores nulos por columna.');

    expect(result[4].stepNumber).toBe(5);
    expect(result[4].title).toBe('Exportación del Dataset Limpio');
    expect(result[4].expectedOutput).toBe('Archivo limpio.csv generado exitosamente.');
  });

  it('ignora tags de workbook como <!--workbook:lines:rows=3-->', () => {
    const textWithTags = `
1. Paso Uno: Instrucción inicial.
<!--workbook:lines:rows=4-->
2. Paso Dos: Segunda instrucción.
<!--workbook:table:cols=A,B,C-->
3. Paso Tres: Tercera instrucción.
    `;
    const result = parseLabStepsFromProse(textWithTags);
    expect(result).toHaveLength(3);
    expect(result[0].actionDescription).not.toContain('<!--workbook:');
  });

  it('maneja variantes de formato de numeración (Paso 1., 1), 1.)', () => {
    const variantText = `
Paso 1. Configurar variables
Paso 2. Compilar algoritmo
Paso 3. Validar métricas
    `;
    const result = parseLabStepsFromProse(variantText);
    expect(result).toHaveLength(3);
    expect(result[0].stepNumber).toBe(1);
    expect(result[1].stepNumber).toBe(2);
    expect(result[2].stepNumber).toBe(3);
  });

  it('F-16: no produce paso fantasma ante números decimales como 3.14 es el valor de pi', () => {
    const textWithDecimal = `
1. Preparar datos
2. Entrenar modelo
3. Validar resultados
3.14 es el valor de pi
    `;
    const result = parseLabStepsFromProse(textWithDecimal);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.stepNumber)).toEqual([1, 2, 3]);
    expect(result.find((r) => r.title.includes('14 es el valor'))).toBeUndefined();
  });

  it('F-16: degrada a vacío ante discontinuidad en la numeración correlativa (< 3 pasos válidos)', () => {
    const textDiscontinuous = `
1. Paso uno: Inicializar
2. Paso dos: Cargar dependencias
5. Paso cinco: Proceso avanzado
    `;
    const result = parseLabStepsFromProse(textDiscontinuous);
    expect(result).toEqual([]);
  });
});
