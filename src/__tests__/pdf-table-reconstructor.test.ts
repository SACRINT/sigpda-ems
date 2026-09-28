/**
 * src/__tests__/pdf-table-reconstructor.test.ts
 *
 * Pruebas unitarias para la reconstrucción de tablas y rejillas espaciales en PDF digital (H-183).
 * Valida la concatenación de celdas multi-fila y la preservación de texto en páginas sin tabla.
 */

import { describe, it, expect } from 'vitest';
import {
  reconstructPageLayout,
  type TextItemWithLayout,
} from '@/lib/document-ingestion/parsers/pdf-table-reconstructor';

describe('pdf-table-reconstructor (H-183)', () => {
  it('1. Reconstruye una tabla de 2 columnas y concatena celdas multi-fila en una sola fila Markdown', () => {
    // Fixture sintético de tabla con 2 columnas (tx ~50 y tx ~200) y celda multi-fila
    const items: TextItemWithLayout[] = [
      // Fila de encabezado (ty: 700)
      { str: 'No.', tx: 50, ty: 700, scaleY: 12, hasEOL: false },
      { str: 'Meta Institucional', tx: 200, ty: 700, scaleY: 12, hasEOL: true },

      // Fila 1 - Renglón 1 (ty: 670)
      { str: '1', tx: 50, ty: 670, scaleY: 10, hasEOL: false },
      { str: 'Lograr que mínimo el', tx: 200, ty: 670, scaleY: 10, hasEOL: true },

      // Fila 1 - Renglón 2 (ty: 655) -> continuación de la celda de la columna 2
      { str: '70% de los alumnos de primer semestre aprueben', tx: 200, ty: 655, scaleY: 10, hasEOL: true },

      // Fila 2 - Renglón 1 (ty: 620)
      { str: '2', tx: 50, ty: 620, scaleY: 10, hasEOL: false },
      { str: 'Capacitar al 100% de la plantilla docente', tx: 200, ty: 620, scaleY: 10, hasEOL: true },
    ];

    const { pageMarkdown, pageRawText } = reconstructPageLayout(items, 11, 1);

    // Debe contener estructura de tabla Markdown con tuberías
    expect(pageMarkdown).toContain('| No. | Meta Institucional |');
    expect(pageMarkdown).toContain('| --- | --- |');

    // La meta multi-fila debe estar unificada en una sola celda, NO fragmentada
    expect(pageMarkdown).toContain('Lograr que mínimo el 70% de los alumnos de primer semestre aprueben');
    expect(pageRawText).toContain('Lograr que mínimo el 70% de los alumnos de primer semestre aprueben');

    // La segunda meta también debe existir íntegra
    expect(pageMarkdown).toContain('Capacitar al 100% de la plantilla docente');
  });

  it('2. Preserva páginas de párrafos normales sin forzar tablas espurias (Tecomate / Vicente Suárez)', () => {
    // Fixture de texto continuo (margen izquierdo uniforme tx ~50)
    const items: TextItemWithLayout[] = [
      { str: 'DIAGNÓSTICO INSTITUCIONAL', tx: 50, ty: 700, scaleY: 16, hasEOL: true },
      { str: 'El plantel cuenta con una matrícula activa de 150 estudiantes.', tx: 50, ty: 670, scaleY: 11, hasEOL: true },
      { str: 'Durante el último ciclo escolar se observó una mejora en aprobación.', tx: 50, ty: 650, scaleY: 11, hasEOL: true },
    ];

    const { pageMarkdown } = reconstructPageLayout(items, 11, 1);

    // No debe contener formato de tabla Markdown
    expect(pageMarkdown).not.toContain('| --- |');
    expect(pageMarkdown).toContain('DIAGNÓSTICO INSTITUCIONAL');
    expect(pageMarkdown).toContain('El plantel cuenta con una matrícula activa de 150 estudiantes.');
  });

  it('3. Maneja página vacía defensivamente', () => {
    const { pageMarkdown, pageRawText } = reconstructPageLayout([], 12, 1);
    expect(pageMarkdown).toContain('[Página 1]');
    expect(pageRawText).toBe('');
  });

  it('4. H-184 (Fixture Héroes): unifica celdas cuando col0 y col1 envuelven simultáneamente y tienen colas mono-columna', () => {
    const items: TextItemWithLayout[] = [
      // Encabezados
      { str: 'Diagnóstico', tx: 50, ty: 700, scaleY: 10, hasEOL: false },
      { str: 'Meta(s)', tx: 250, ty: 700, scaleY: 10, hasEOL: false },
      { str: 'Responsable', tx: 450, ty: 700, scaleY: 10, hasEOL: true },

      // Fila 1 - Renglón 1: Col 0, Col 1 y Col 2
      { str: 'Reprobación escolar en primer y', tx: 50, ty: 670, scaleY: 9, hasEOL: false },
      { str: 'Lograr que mínimo el', tx: 250, ty: 670, scaleY: 9, hasEOL: false },
      { str: 'Director y colectivo', tx: 450, ty: 670, scaleY: 9, hasEOL: true },

      // Fila 1 - Renglón 2: Col 0 (continúa con minúscula) y Col 1 (continúa con porcentaje)
      { str: 'tercer semestre del ciclo escolar', tx: 50, ty: 655, scaleY: 9, hasEOL: false },
      { str: '70% de los alumnos de', tx: 250, ty: 655, scaleY: 9, hasEOL: true },

      // Fila 1 - Renglón 3: Solo Col 1 continuando la meta
      { str: 'primer y tercer semestre aprueben todas las asignaturas.', tx: 250, ty: 640, scaleY: 9, hasEOL: true },

      // Fila 2: Nueva meta con numeración en Col 0
      { str: '2. Abandono escolar', tx: 50, ty: 610, scaleY: 9, hasEOL: false },
      { str: 'Reducir el abandono al 2% en el ciclo', tx: 250, ty: 610, scaleY: 9, hasEOL: false },
      { str: 'Tutor de grupo', tx: 450, ty: 610, scaleY: 9, hasEOL: true },
    ];

    const { pageMarkdown, pageRawText } = reconstructPageLayout(items, 9.5, 1);

    // Meta de Héroes debe estar íntegra en una sola celda
    const fullMetaExpected = 'Lograr que mínimo el 70% de los alumnos de primer y tercer semestre aprueben todas las asignaturas.';
    expect(pageMarkdown).toContain(fullMetaExpected);
    expect(pageRawText).toContain(fullMetaExpected);

    // Diagnóstico envolvente unificado en su celda
    expect(pageMarkdown).toContain('Reprobación escolar en primer y tercer semestre del ciclo escolar');

    // No debe haber filas rotas intercaladas
    expect(pageMarkdown).not.toContain('| tercer semestre del ciclo escolar | 70% de los alumnos de |');
  });

  it('5. H-184 (Fixture Moisés Sáenz): mantiene carreras de 1 columna (estrategias 1..4) dentro de la celda de la tabla', () => {
    const items: TextItemWithLayout[] = [
      // Encabezados
      { str: 'Meta Institucional', tx: 50, ty: 700, scaleY: 10, hasEOL: false },
      { str: 'Estrategias y/o Acciones', tx: 250, ty: 700, scaleY: 10, hasEOL: true },

      // Fila 1 - Inicio
      { str: 'Aprobar al 85% de la matrícula', tx: 50, ty: 670, scaleY: 9, hasEOL: false },
      { str: 'De manera colegiada se acordaron las siguientes:', tx: 250, ty: 670, scaleY: 9, hasEOL: true },

      // Carrera de 4 líneas consecutivas de una sola columna (tx: 250)
      { str: '1. Impartir asesorías sabatinas de nivelación', tx: 250, ty: 655, scaleY: 9, hasEOL: true },
      { str: '2. Implementar círculos de lectura semanales', tx: 250, ty: 640, scaleY: 9, hasEOL: true },
      { str: '3. Realizar reuniones bimestrales con padres', tx: 250, ty: 625, scaleY: 9, hasEOL: true },
      { str: '4. Seguimiento académico por tutor', tx: 250, ty: 610, scaleY: 9, hasEOL: true },

      // Fila 2
      { str: 'Disminuir reprobación al 10%', tx: 50, ty: 580, scaleY: 9, hasEOL: false },
      { str: 'Evaluaciones formativas continuas', tx: 250, ty: 580, scaleY: 9, hasEOL: true },
    ];

    const { pageMarkdown } = reconstructPageLayout(items, 9.5, 1);

    // Las 4 estrategias deben estar integradas dentro de la tabla
    expect(pageMarkdown).toContain('1. Impartir asesorías sabatinas de nivelación');
    expect(pageMarkdown).toContain('2. Implementar círculos de lectura semanales');
    expect(pageMarkdown).toContain('3. Realizar reuniones bimestrales con padres');
    expect(pageMarkdown).toContain('4. Seguimiento académico por tutor');
    // Deben estar dentro de la fila de la primera meta
    expect(pageMarkdown).toContain('Aprobar al 85% de la matrícula | De manera colegiada se acordaron las siguientes: 1. Impartir asesorías sabatinas de nivelación');
  });

  it('6. H-186: incluye encabezados de tabla en rawText y no convierte encabezados grandes en celdas de tabla', () => {
    const items: TextItemWithLayout[] = [
      // Encabezado grande de sección (scaleY: 16 con avg 10)
      { str: 'PRESENTACIÓN INSTITUCIONAL', tx: 50, ty: 750, scaleY: 16, hasEOL: true },

      // Tabla posterior
      { str: 'Ámbito', tx: 50, ty: 700, scaleY: 10, hasEOL: false },
      { str: 'Objetivo', tx: 250, ty: 700, scaleY: 10, hasEOL: true },

      { str: 'Académico', tx: 50, ty: 670, scaleY: 9, hasEOL: false },
      { str: 'Mejorar el rendimiento', tx: 250, ty: 670, scaleY: 9, hasEOL: true },

      { str: 'Administrativo', tx: 50, ty: 640, scaleY: 9, hasEOL: false },
      { str: 'Equipar el aula de cómputo', tx: 250, ty: 640, scaleY: 9, hasEOL: true },
    ];

    const { pageMarkdown, pageRawText } = reconstructPageLayout(items, 10, 1);

    // PRESENTACIÓN no debe ser celda de tabla (| — | PRESENTACIÓN | — |) sino ###
    expect(pageMarkdown).toContain('### PRESENTACIÓN INSTITUCIONAL');
    expect(pageMarkdown).not.toContain('| — | PRESENTACIÓN INSTITUCIONAL |');

    // rawText DEBE incluir la cabecera de la tabla (H-186)
    expect(pageRawText).toContain('Ámbito | Objetivo');
  });
});
