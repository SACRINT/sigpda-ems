import { describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  fitPedagogicalText,
  GENERIC_FILLER_RE,
  isPublishablePedagogicalText,
  isTruncatedAgainstSource,
} from '@/lib/editorial/pedagogical-text-fitter';
import { extractDisciplinaryConceptPhrase } from '@/lib/editorial/topic-title-resolver';
import { completeDetail } from '@/lib/visual-engine/sacrint/diagrams';
import {
  ensureActivityClosure,
  validateSacrintContentIntegrity,
  type SacrintDeckSpec,
  type SacrintInfographicSpec,
} from '@/lib/visual-engine/sacrint/spec';
import {
  drawFittedVectorText,
  renderSacrintInfographicsVectorPdf,
} from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
import { renderInfographicSvg } from '@/lib/visual-engine/sacrint/infographic-renderer';

describe('SACRINT content integrity guardrails (08 & 09)', () => {
  it('ensureActivityClosure jamás inyecta cierres genéricos de relleno', () => {
    const inputs = [
      'Tienes una fuente de poder ATX con un conector de 24 pines y una tarjeta madre de laboratorio.',
      'El tanque de agua contiene 120 litros a una temperatura inicial de 18 °C.',
      'Observas un circuito en serie con dos resistencias de 10 ohmios.',
    ];
    for (const input of inputs) {
      const out = ensureActivityClosure(input);
      expect(out).not.toMatch(GENERIC_FILLER_RE);
      expect(out).not.toMatch(/Aplica el procedimiento estudiado/i);
      expect(out).not.toMatch(/Registra tu procedimiento y comprueba/i);
      expect(out).not.toMatch(/desarrolla el an[aá]lisis y justifica/i);
    }
  });

  it('preserva unidades y sintagmas nominales sin amputar en AECAEF S10, CNET1 S52/S97 y TPV1 S23', () => {
    const aecaefS10 =
      'Revisa la conexión del conector de 24 pines en la tarjeta madre y verifica la continuidad eléctrica de los rieles de voltaje.';
    const fittedAecaef = fitPedagogicalText(aecaefS10, { maxChars: 90, maxWords: 14, role: 'activity' });
    expect(fittedAecaef).not.toMatch(/conector de 24\./i);
    expect(fittedAecaef).toContain('24 pines');

    const cnetS97 =
      'En una mezcla gaseosa ideal donde el componente mayoritario debe ser aire limpio, determina la proporción porcentual de oxígeno.';
    const fittedCnet97 = fitPedagogicalText(cnetS97, { maxChars: 80, maxWords: 12, role: 'activity' });
    expect(fittedCnet97).not.toMatch(/debe ser\./i);
    expect(fittedCnet97).toContain('debe ser aire');

    const cnetS52 =
      'Explica con el modelo cinético-molecular la diferencia entre un sólido y un líquido al variar la energía térmica.';
    const fittedCnet52 = fitPedagogicalText(cnetS52, { maxChars: 75, maxWords: 11, role: 'activity' });
    expect(fittedCnet52).not.toMatch(/entre un\./i);
    expect(fittedCnet52).toContain('diferencia entre un sólido y un líquido');

    const tpvS23 =
      'Calcula la razón de cambio instantánea que describe el nivel de tensión académica en función de las horas de estudio.';
    const fittedTpv23 = fitPedagogicalText(tpvS23, { maxChars: 78, maxWords: 12, role: 'activity' });
    expect(fittedTpv23).not.toMatch(/nivel de\./i);
    expect(fittedTpv23).toContain('nivel de tensión');
  });

  it('extractDisciplinaryConceptPhrase elimina verbos de objetivo en 2ª persona', () => {
    const cases: Array<[string, RegExp]> = [
      ['Comprendes la ciencia experimental', /^Ciencia experimental/i],
      ['Analizas los sistemas de ecuaciones lineales con dos incógnitas', /^Sistemas de ecuaciones/i],
      ['Diseñas un biofiltro comunitario de agua gris', /^Biofiltro comunitario/i],
      ['Evalúas el rendimiento de almacenamiento SSD', /^Rendimiento de almacenamiento/i],
      ['Elaboras un croquis arquitectónico acotado', /^Croquis arquitectónico/i],
    ];
    for (const [input, expected] of cases) {
      const phrase = extractDisciplinaryConceptPhrase(input);
      expect(phrase).toMatch(expected);
      expect(phrase).not.toMatch(/^(?:Comprendes|Analizas|Diseñas|Evalúas|Elaboras)\b/i);
    }
  });

  it('completeDetail rechaza con SACRINT_NODE_TRUNCATED cualquier nodo cortado', () => {
    expect(() => completeDetail('La estiba es segura al estar', 110)).toThrow(/SACRINT_NODE_TRUNCATED/);
    expect(() => completeDetail('Se compara con datos reales vs', 110)).toThrow(/SACRINT_NODE_TRUNCATED/);
    expect(() => completeDetail('Tubería con', 110)).toThrow(/SACRINT_NODE_TRUNCATED/);
    expect(() => completeDetail('El tramo adecuado ya', 110)).toThrow(/SACRINT_NODE_TRUNCATED/);

    // Texto completo válido se conserva íntegro sin truncar
    const intact = completeDetail(
      'La estiba mantiene estabilidad sobre una base nivelada.',
      110
    );
    expect(intact).toBe('La estiba mantiene estabilidad sobre una base nivelada.');

    // Entrada vacía recurre al fallback explícito
    expect(completeDetail('', 110, 'Base nivelada con soporte seguro.')).toBe(
      'Base nivelada con soporte seguro.'
    );
  });

  it('isTruncatedAgainstSource y isPublishablePedagogicalText bloquean cortes intra-oración, finales colgantes y rellenos', () => {
    const source = 'Revisa la conexión del conector de 24 pines en la tarjeta madre.';
    expect(isTruncatedAgainstSource('Revisa la conexión del conector de 24.', source)).toBe(true);
    expect(isPublishablePedagogicalText('Revisa la conexión del conector de 24.', 'activity', source)).toBe(false);
    expect(
      isPublishablePedagogicalText(
        'Aplica el procedimiento estudiado y fundamenta tu respuesta.',
        'activity'
      )
    ).toBe(false);

    // Finales colgantes en nodos de infografía 09 (preposiciones, artículos, conjunciones, comas, "de forma.")
    const danglingSamples = [
      'Inspeccionar, documentar y proteger el equipo antes de realizar cualquier',
      'Dispositivos que guardan información de forma.',
      'Documento que detalla insumos, costos y rendimientos para la',
      'Protocolo operativo para mover materiales de forma segura y eficiente,',
      'La tangencia es la propiedad donde una línea y una curva comparten un',
      'Verificación de materiales según normas técnicas para asegurar la calidad y',
      'Fundamentar cada observación en la norma técnica correspondiente y ser.',
    ];
    for (const sample of danglingSamples) {
      expect(isPublishablePedagogicalText(sample, 'infographic')).toBe(false);
    }

    const multiSentence =
      'Calcula la densidad de una muestra de 200 g en 100 mL. Registra tus pasos en el cuaderno.';
    expect(
      isTruncatedAgainstSource('Calcula la densidad de una muestra de 200 g en 100 mL.', multiSentence)
    ).toBe(false);
  });

  it('validateSacrintContentIntegrity detecta violaciones y aprueba specs limpios', () => {
    const badDeck = {
      slides: [
        {
          kind: 'concept',
          explanation: 'El sistema opera con presión controlada.',
          diagram: {
            kind: 'system-map',
            available: true,
            center: { label: 'SISTEMA', detail: 'Comprendes la hidráulica básica' },
            components: [{ label: 'ENTRADA', detail: 'La estiba es segura al estar' }],
            environment: { label: 'ENTORNO', detail: '' },
          },
        },
        {
          kind: 'practice',
          activities: [
            {
              label: 'Actividad 1',
              statement: 'Aplica el procedimiento estudiado y fundamenta tu respuesta.',
            },
          ],
        },
      ],
    } as unknown as SacrintDeckSpec;

    const badIssues = validateSacrintContentIntegrity(badDeck);
    expect(badIssues.length).toBeGreaterThanOrEqual(3);
    expect(badIssues.some((i) => /objetivo en 2ª persona/i.test(i))).toBe(true);
    expect(badIssues.some((i) => /nodo truncado/i.test(i))).toBe(true);
    expect(badIssues.some((i) => /relleno genérico/i.test(i))).toBe(true);

    const cleanInfo = {
      claim: 'La densidad relaciona la masa con el volumen ocupado por una sustancia.',
      applicationSummary: 'Permite identificar materiales puros en el monitoreo escolar.',
      quickExample: {
        problemStatement: 'Una muestra tiene 200 g de masa y ocupa 100 mL de volumen.',
        steps: ['Sustituye m = 200 g y V = 100 mL en ρ = m / V.', 'Obtén ρ = 2.0 g/mL.'],
        interpretation: 'La muestra presenta una densidad de 2.0 g/mL.',
      },
      steps: [{ number: 1, title: 'PASO 1', body: 'Mide la masa con la balanza calibrada.' }],
      conceptManual: {
        centralConcept: 'Densidad de la materia',
        conceptMap: [{ concept: 'Propiedad intensiva', relation: 'Define', detail: 'No depende del tamaño de la muestra.' }],
      },
      diagram: {
        kind: 'concept',
        available: true,
        center: { label: 'CONCEPTO CENTRAL', detail: 'Densidad de la materia' },
        nodes: [{ label: 'FÓRMULA', detail: 'Relación masa entre volumen.' }],
      },
    } as unknown as SacrintInfographicSpec;

    expect(validateSacrintContentIntegrity(cleanInfo)).toEqual([]);
  });

  it('renderSacrintInfographicsVectorPdf no amputa nodos extensos de 09 al renderizar a PDF vectorial', () => {
    const infoSpec = {
      format: 'wide',
      theme: 'light',
      meta: {
        subjectName: 'Dibujo Técnico I',
        blockNumber: 1,
        blockName: 'Bloque 1: Fundamentos geométricos',
        missionNumber: 1,
        missionTitle: 'Trazos geométricos normalizados',
        schoolName: 'Plantel EMS',
        teacherName: 'Docente',
      },
      pack: {
        id: 'tecnologia',
        short: 'TECNOLOGÍA',
        label: 'Tecnología',
        accent: '#2563EB',
        accent2: '#0EA5E9',
      },
      style: {
        id: 'clean',
        accent: '#2563EB',
        accent2: '#0EA5E9',
      },
      title: 'Tangencia y normalización en dibujo técnico',
      topicTitle: 'Tangencia y normalización en dibujo técnico',
      subtitle: 'Dibujo Técnico I · BLOQUE 1 · MISIÓN 01',
      claim: 'La tangencia garantiza continuidad geométrica entre arcos y rectas en planos normalizados.',
      formula: '',
      formulasList: [],
      keyConcepts: ['Verificación de materiales según normas técnicas para asegurar la calidad y seguridad en instalaciones.'],
      conceptManual: {
        centralConcept: 'Tangencia geométrica',
        conceptMap: [],
        definitions: [
          {
            term: 'CONCEPTO CENTRAL',
            definition: 'Documento que detalla insumos, costos y rendimientos para la ejecución de elementos constructivos básicos.',
          },
        ],
        usageGuidance: [],
        masteryChecklist: ['Verificar continuidad tangencial en el trazo técnico.'],
      },
      quickExample: {
        problemStatement: 'Traza un enlace tangente entre una recta y un arco.',
        steps: ['Ubica el centro del arco.', 'Traza la perpendicular desde el punto de tangencia.'],
        interpretation: 'El enlace resulta continuo sin quiebres visibles.',
      },
      variables: [],
      diagram: {
        kind: 'concept',
        available: true,
        center: { label: 'CONCEPTO CENTRAL', detail: 'Tangencia geométrica en dibujo técnico' },
        nodes: [
          {
            label: 'CONCEPTO',
            detail: 'La tangencia es la propiedad geométrica donde una línea y una curva comparten un único punto común sin cruzarse.',
          },
          {
            label: 'PRÁCTICA',
            detail: 'Inspeccionar, documentar y proteger el equipo antes de realizar cualquier intervención técnica.',
          },
        ],
      },
      steps: [
        {
          number: 1,
          title: 'PREPARACIÓN',
          body: 'Fundamentar cada observación en la norma técnica correspondiente y ser objetivo.',
        },
      ],
      misconception: 'Trazar arcos sin localizar el punto de tangencia.',
      misconceptionFix: {
        error: 'Trazar arcos sin localizar el punto de tangencia.',
        correction: 'Determinar primero el centro y la perpendicular al punto exacto de contacto.',
      },
      applicationSummary: 'Aplicable al diseño de mobiliario urbano y planos constructivos.',
      criteria: ['Verificar continuidad tangencial en el trazo técnico.'],
      rubric: [],
      project: {
        artifactName: 'Plano normalizado de mobiliario',
        communityUtility: 'Mejora la calidad técnica de espacios comunitarios.',
      },
      facts: [],
    } as unknown as SacrintInfographicSpec;

    // 1. Verificar que drawFittedVectorText nunca guillotina nodos largos en tarjetas estrechas (ej. 38mm x 16mm)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [279.4, 157.16] });
    const emittedLines: string[] = [];
    const textSpy = vi.spyOn(doc, 'text').mockImplementation((text: string | string[]) => {
      if (Array.isArray(text)) emittedLines.push(...text.map(String));
      else emittedLines.push(String(text));
      return doc;
    });
    const longNodes = [
      'La tangencia es la propiedad geométrica donde una línea y una curva comparten un único punto común sin cruzarse.',
      'Inspeccionar, documentar y proteger el equipo antes de realizar cualquier intervención técnica.',
      'Fundamentar cada observación en la norma técnica correspondiente y ser objetivo.',
      'Verificación de materiales según normas técnicas para asegurar la calidad y seguridad en instalaciones.',
      'Documento que detalla insumos, costos y rendimientos para la ejecución de elementos constructivos básicos.',
    ];
    for (const nodeText of longNodes) {
      drawFittedVectorText(doc, nodeText, 10, 10, 38, 16, { fontSize: 6.9, minFontSize: 5.2 });
    }
    textSpy.mockRestore();
    const joinedPdfLines = emittedLines.join(' ');
    expect(joinedPdfLines).toContain('cruzarse.');
    expect(joinedPdfLines).toContain('intervención técnica.');
    expect(joinedPdfLines).toContain('objetivo.');
    expect(joinedPdfLines).toContain('instalaciones.');
    expect(joinedPdfLines).toContain('constructivos básicos.');

    // 2. Verificar que renderInfographicSvg no elide ni trunca nodos con "…"
    const svg = renderInfographicSvg(infoSpec);
    expect(svg).not.toContain('…');
    expect(svg).toContain('cruzarse.');
    expect(svg).toContain('instalaciones.');

    // 3. Verificar generación binaria completa del PDF vectorial
    const pdfBuf = renderSacrintInfographicsVectorPdf([infoSpec]);
    expect(pdfBuf.length).toBeGreaterThan(2000);
  });
});
