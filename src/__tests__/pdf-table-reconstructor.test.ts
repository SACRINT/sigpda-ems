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

  it('7. H-188: lineas de tabla multicolumna con fuentes grandes jamas se convierten en encabezados ###', () => {
    // Fixture Emiliano Zapata P31-33: filas de tabla donde la fuente del docente es 13pt con promedio bajo
    const items: TextItemWithLayout[] = [
      // Encabezados
      { str: 'Meta', tx: 50, ty: 700, scaleY: 10, hasEOL: false },
      { str: 'Responsable', tx: 250, ty: 700, scaleY: 10, hasEOL: false },
      { str: 'Evidencia', tx: 450, ty: 700, scaleY: 10, hasEOL: true },

      // Fila 1: Multicolumna con fuente destacada (13pt) en nombres de docentes
      { str: 'Aprobar matemáticas', tx: 50, ty: 670, scaleY: 13, hasEOL: false },
      { str: 'Profa. Olga Lucía', tx: 250, ty: 670, scaleY: 13, hasEOL: false },
      { str: 'Listas de calificaciones', tx: 450, ty: 670, scaleY: 13, hasEOL: true },

      // Fila 2: Multicolumna
      { str: 'Taller de regularización', tx: 50, ty: 640, scaleY: 13, hasEOL: false },
      { str: 'Profr. Manuel Pérez', tx: 250, ty: 640, scaleY: 13, hasEOL: false },
      { str: 'Bitácoras de asesoría', tx: 450, ty: 640, scaleY: 13, hasEOL: true },
    ];

    const { pageMarkdown } = reconstructPageLayout(items, 9, 1);

    // Debe ser una tabla Markdown intacta
    expect(pageMarkdown).toContain('| Meta | Responsable | Evidencia |');
    expect(pageMarkdown).toContain('Profa. Olga Lucía');
    expect(pageMarkdown).toContain('Profr. Manuel Pérez');

    // NUNCA debe emitir las filas como encabezados ###
    expect(pageMarkdown).not.toContain('### Profa. Olga');
    expect(pageMarkdown).not.toContain('### Profr. Manuel');
    expect(pageMarkdown).not.toContain('### Aprobar matemáticas');
  });

  it('8. H-189: prosa narrativa con fragmento aislado o folio en margen no se absorbe en tablas (Vicente P3 / Diego Rivera P7)', () => {
    // Fixture Vicente P3 / Diego Rivera P7: texto narrativo amplio con un folio aislado a la derecha
    const items: TextItemWithLayout[] = [
      // Párrafo 1 normal
      { str: 'El diagnóstico situacional de la escuela muestra retos significativos en la permanencia escolar de los estudiantes.', tx: 50, ty: 700, scaleY: 10, hasEOL: true },
      // Línea con texto normal y un número de folio o encabezado aislado al margen derecho (tx 500)
      { str: 'Las condiciones socioeconómicas de la comunidad influyen de manera directa en el aprendizaje.', tx: 50, ty: 680, scaleY: 10, hasEOL: false },
      { str: '05', tx: 500, ty: 680, scaleY: 10, hasEOL: true },
      // Párrafos subsiguientes que NO deben entrar a ninguna tabla
      { str: 'Se requiere fortalecer la vinculación con los comités de padres de familia para dar seguimiento continuo.', tx: 50, ty: 660, scaleY: 10, hasEOL: true },
      { str: 'Los docentes han manifestado la necesidad de contar con materiales didácticos actualizados.', tx: 50, ty: 640, scaleY: 10, hasEOL: true },
      { str: 'Finalmente se acuerda realizar reuniones colegiadas de evaluación bimestral.', tx: 50, ty: 620, scaleY: 10, hasEOL: true },
    ];

    const { pageMarkdown } = reconstructPageLayout(items, 10, 1);

    // No debe generarse tabla Markdown
    expect(pageMarkdown).not.toContain('| --- |');
    expect(pageMarkdown).toContain('El diagnóstico situacional de la escuela muestra retos significativos');
    expect(pageMarkdown).toContain('Se requiere fortalecer la vinculación con los comités');
    expect(pageMarkdown).toContain('Finalmente se acuerda realizar reuniones colegiadas');
  });

  it('9. H-190: corridas mono-columna largas (>= 12 lineas) se mantienen unificadas en la celda sin corte en 8 (Heroes P14 / Moisés P15)', () => {
    // Fixture Héroes P14 / Moisés P15: tabla con una celda que envuelve a lo largo de 12 renglones consecutivos
    const items: TextItemWithLayout[] = [
      // Encabezados
      { str: 'Meta Institucional', tx: 50, ty: 700, scaleY: 10, hasEOL: false },
      { str: 'Acciones de Seguimiento', tx: 250, ty: 700, scaleY: 10, hasEOL: true },

      // Fila 1 - Inicio
      { str: 'Elevar la eficiencia terminal al 85%', tx: 50, ty: 670, scaleY: 9, hasEOL: false },
      { str: 'Acción 1: Asesorías académicas continuas', tx: 250, ty: 670, scaleY: 9, hasEOL: true },
    ];

    // Agregar 12 renglones consecutivos mono-columna en columna 1 (tx: 250)
    for (let r = 2; r <= 13; r++) {
      items.push({
        str: `Acción ${r}: Seguimiento puntual a estudiantes en riesgo grupo ${r}`,
        tx: 250,
        ty: 670 - (r - 1) * 15,
        scaleY: 9,
        hasEOL: true,
      });
    }

    // Fila 2
    items.push({ str: '2. Capacitación docente', tx: 50, ty: 450, scaleY: 9, hasEOL: false });
    items.push({ str: 'Cursos formativos', tx: 250, ty: 450, scaleY: 9, hasEOL: true });

    const { pageMarkdown } = reconstructPageLayout(items, 9.5, 1);

    // Debe contener las 13 acciones unificadas dentro de la tabla
    expect(pageMarkdown).toContain('Acción 1: Asesorías académicas continuas');
    expect(pageMarkdown).toContain('Acción 8: Seguimiento puntual');
    expect(pageMarkdown).toContain('Acción 9: Seguimiento puntual');
    expect(pageMarkdown).toContain('Acción 12: Seguimiento puntual');
    expect(pageMarkdown).toContain('Acción 13: Seguimiento puntual');

    // La segunda meta debe estar en su propia fila de tabla
    expect(pageMarkdown).toContain('2. Capacitación docente');
  });
});
