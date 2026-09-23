// src/__tests__/pdf-extra-generator.test.ts
/**
 * Tests unitarios para pdf-extra-generator.ts
 * Fase 15A · SIGPDA-EMS SEMS Puebla MCCEMS
 *
 * Transformación pura ExtraInput -> jsPDF (sin mocking de BD o IA).
 */

import { describe, it, expect } from 'vitest';
import { generateExtraPDF, type ExtraInput } from '@/lib/pdf-extra-generator';

// ── Fixture Factory ──────────────────────────────────────────────────────────
function makeFixture(overrides: Partial<ExtraInput> = {}): ExtraInput {
  return {
    id: 'extra-test-101',
    title: 'Rúbrica Analítica de Desempeño',
    type: 'rubric',
    content_text: `
# RÚBRICA ANALÍTICA DE EVALUACIÓN
Criterios de valoración del producto integrador en Pensamiento Matemático.

| Criterio | Nivel 1 (Inicial) | Nivel 2 (En Desarrollo) | Nivel 3 (Sobresaliente) |
| :--- | :--- | :--- | :--- |
| Modelación Matemática | No formula ecuaciones | Formula ecuaciones con apoyo | Modela y resuelve de forma autónoma |
| Argumentación | Sin justificación formal | Explica parcialmente | Demuestra solidez argumentativa formal |
| Cierre y Reflexión | Omite metacognición | Reflexión elemental | Reflexión crítica metacognitiva profunda |
`.trim(),
    ...overrides,
  };
}

describe('pdf-extra-generator — Generador de Recursos Didácticos Auxiliares', () => {
  // ── TEST 1: Rúbrica en orientación Horizontal (Landscape) ─────────────────
  it('Test 1: Genera rúbrica en orientación horizontal (landscape) con tabla formateada', () => {
    const rubricInput = makeFixture({ type: 'rubric' });
    const doc = generateExtraPDF(rubricInput);

    expect(doc).toBeDefined();
    // En orientación landscape formato carta: ancho > alto (279.4mm x 215.9mm)
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    expect(width).toBeGreaterThan(height);
    expect(Math.round(width)).toBe(279);
    expect(Math.round(height)).toBe(216);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const buffer = doc.output('arraybuffer');
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  // ── TEST 2: Lista de Cotejo en orientación Vertical (Portrait) ────────────
  it('Test 2: Genera lista de cotejo (checklist) en portrait con casillas de verificación', () => {
    const checklistInput = makeFixture({
      type: 'checklist',
      title: 'Lista de Cotejo — Trabajo Colaborativo en Laboratorio',
      content_text: `
# LISTA DE COTEJO: DESEMPEÑO PROCEDIMENTAL
Instrucciones: Marque con una "X" el cumplimiento de cada indicador.

[ ] 1. Porta el equipo de protección individual (bata, gafas de seguridad).
[x] 2. Calibra adecuadamente la balanza antes de registrar las lecturas.
[ ] 3. Mantiene limpia el área de trabajo al finalizar la práctica.
( ) 4. Registra los datos en la bitácora siguiendo el protocolo de error experimental.
      `.trim(),
    });

    const doc = generateExtraPDF(checklistInput);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    expect(height).toBeGreaterThan(width); // Portrait
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  // ── TEST 3: Plan de Clase con fases didácticas e insignias de tiempo ───────
  it('Test 3: Genera plan de clase con fases Inicio, Desarrollo, Cierre e insignias de tiempo', () => {
    const lessonPlanInput = makeFixture({
      type: 'lesson_plan',
      title: 'Plan de Clase — Modelo Atómico de Bohr (50 min)',
      content_text: `
# PLAN DE CLASE: ESTRUCTURA ATÓMICA
Tiempo total sugerido: 50 minutos.

## Inicio: Activación Cognitiva y Pregunta Detonadora [10 min]
El docente presenta una breve demostración con sales metálicas a la llama.

## Desarrollo: Indagación Guiada y Modelado [30 min]
Los estudiantes en parejas analizan los espectros de emisión y vinculan las transiciones electrónicas.

## Cierre: Evaluación Formativa y Ticket de Salida [10 min]
Cada alumno responde en su cuaderno la pregunta de síntesis sobre niveles de energía.
      `.trim(),
    });

    const doc = generateExtraPDF(lessonPlanInput);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  // ── TEST 4: Guía de Práctica con llamadas de seguridad y pasos numerados ───
  it('Test 4: Genera guía de práctica con advertencias de seguridad (callout > ) y pasos', () => {
    const guideInput = makeFixture({
      type: 'practice_guide',
      title: 'Guía de Práctica — Titulación Ácido-Base',
      content_text: `
# GUÍA EXPERIMENTAL: CINÉTICA Y VALORACIÓN
Objetivo: Determinar la concentración de ácido acético en muestra comercial.

> IMPORTANTE: El hidróxido de sodio es corrosivo. Utilizar guantes de nitrilo y gafas en todo momento.

1. Medir 10 mL de la disolución problema con pipeta volumétrica.
2. Añadir 2 gotas de fenolftaleína al 1%.
3. Valorar con NaOH 0.1 M gota a gota hasta viraje a rosa tenue persistente por 30 segundos.
      `.trim(),
    });

    const doc = generateExtraPDF(guideInput);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  // ── TEST 4b: Solucionario Docente con claves pedagógicas (H-045) ───────────
  it('Test 4b: Genera solucionario docente con tipo dedicado teacher_guide y paleta institucional', () => {
    const teacherGuideInput = makeFixture({
      type: 'teacher_guide',
      title: 'Solucionario y Guía Pedagógica del Docente — Bloque 1',
      content_text: `
# SOLUCIONARIO Y GUÍA DE MEDIACIÓN PEDAGÓGICA (USO EXCLUSIVO DOCENTE)
CONFIDENCIAL: Material de apoyo técnico exclusivo para la mediación en aula.

> NOTA DIDÁCTICA: Anticipar errores comunes en el despeje de variables.

### Clave de Resolución del Reto STEM
1. Identificación de variables y planteamiento.
2. Procedimiento paso a paso comprobado.
3. Rúbrica de retroalimentación inmediata.
      `.trim(),
    });

    const doc = generateExtraPDF(teacherGuideInput);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const buffer = doc.output('arraybuffer');
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  // ── TEST 5: Material Didáctico conceptual con párrafos y viñetas ───────────
  it('Test 5: Genera material didáctico informativo con bloques conceptuales y viñetas', () => {
    const materialInput = makeFixture({
      type: 'material',
      title: 'Infografía Textual — Leyes de Termodinámica',
      content_text: `
# CONCEPTOS CLAVE DE TERMODINÁMICA
Material de consulta y apoyo para el bloque de Ciencias Naturales.

### Principios Fundamentales
- Primera Ley: La energía no se crea ni se destruye, solo se transforma.
- Segunda Ley: La entropía del universo tiende a incrementarse de manera irreversible.
- Tercera Ley: En el cero absoluto la entropía de un cristal perfecto es nula.

---
Lectura recomendada para el estudio autónomo previo al examen formativo.
      `.trim(),
    });

    const doc = generateExtraPDF(materialInput);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  // ── TEST 6: Resiliencia con texto vacío (content_text: '') ─────────────────
  it('Test 6: Maneja contenido vacío sin lanzar excepciones ni corromper el documento', () => {
    const emptyInput = makeFixture({
      type: 'material',
      title: 'Documento en Blanco',
      content_text: '',
    });

    expect(() => {
      const doc = generateExtraPDF(emptyInput);
      expect(doc.getNumberOfPages()).toBe(1);
      const buffer = doc.output('arraybuffer');
      expect(buffer.byteLength).toBeGreaterThan(0);
    }).not.toThrow();
  });

  // ── TEST 7: Fallback para tipo no reconocido ───────────────────────────────
  it('Test 7: Emplea etiqueta y estilos por defecto para tipo de recurso no reconocido', () => {
    const unknownTypeInput = makeFixture({
      type: 'unknown_custom_widget',
      title: 'Recurso Experimental No Catalogado',
      content_text: '# Contenido Genérico\nTexto explicativo estándar.',
    });

    const doc = generateExtraPDF(unknownTypeInput);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  // ── TEST 8: Paginación automática y encabezados en documentos extensos ─────
  it('Test 8: Pagina automáticamente documentos extensos y preserva consistencia visual', () => {
    // Generamos un contenido que garantice sobrepasar una página completa
    const repeatedParagraphs = Array.from({ length: 45 }, (_, i) =>
      `Párrafo detallado número ${i + 1}: Este texto describe exhaustivamente el marco teórico y procedimental necesario para completar la secuencia formativa SEMS MCCEMS 2026-2027 sin ambigüedades técnicas.`
    ).join('\n\n');

    const multiPageInput = makeFixture({
      type: 'lesson_plan',
      title: 'Secuencia Didáctica de Bloque Extenso',
      content_text: `# SECUENCIA DIDÁCTICA EXTENSA\n\n${repeatedParagraphs}`,
    });

    const doc = generateExtraPDF(multiPageInput);
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);

    // Validar que el archivo PDF resultante sea válido y no nulo
    const buffer = doc.output('arraybuffer');
    expect(buffer.byteLength).toBeGreaterThan(5000);
  });
});
