/**
 * editorial-phase421-polish.test.ts — Pruebas de Integración PR 4.2.1
 *
 * Verifica los hallazgos exactos de la auditoría de Paquete_CD1_PDF_3:
 * 1. 06 Libro Semestral (Cultura Digital I):
 *    - Cero títulos truncados a mitad de palabra (.slice())
 *    - Cero duplicación "Misión N: ... (Misión N)"
 *    - Cero "·" colgante al final del encabezado "Esquema Técnico · ..."
 *    - Cero caption duplicado (caption !== título interno del SVG)
 *    - Diagramas temáticamente distintos por misión (sin repetir el fallback genérico)
 * 2. 08 Presentaciones PPTX combinado (3 bloques × 4 misiones = 12 misiones, modo `lesson-guide`):
 *    - Las 12 portadas reciben `editorialScenes.hero` en modo `lesson-guide`
 *    - Rotación real por misión (los 3 arquetipos 16:9 dentro de cada bloque; NUNCA 4/4/4 por bloque)
 *    - El archivo `.pptx` real descomprimido con JSZip embebe las 3 imágenes panorámicas distintas y
 *      asigna las relaciones de portada por misión sin repetir consecutivamente.
 * 3. 09 Infografías PDF combinado (3 bloques × 4 misiones × 4 sesiones = 48 páginas):
 *    - Las 48 láminas rotan exactamente 16 / 16 / 16 entre las 3 variantes verticales 4:5 (Parte D),
 *      sin repetir jamás dos páginas consecutivas, y el PDF vectorial real contiene los XObjects de imagen.
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import sharp from 'sharp';
import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import { enrichEditorialSessionsV2 } from '@/lib/editorial/editorial-v2-enricher';
import {
  parseEjemploResuelto,
  type StudentMissionFraming,
  type StudentSession,
} from '@/lib/editorial/student-content-model';
import {
  buildSacrintDecksForWorkbook,
  buildSacrintInfographic,
  selectInfographicTargets,
} from '@/lib/visual-engine/sacrint/spec';
import { generateCombinedSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { renderCombinedSacrintInfographicsPdf } from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
import { createNodeSceneLoader } from '@/lib/visual-engine/scene-allocator-node';

function makeCdSessionPlan(sessionNumber: number, topic: string): SessionPlan {
  return {
    sessionNumber,
    objetivo: `Analizar ${topic} y aplicar buenas prácticas digitales en proyectos escolares.`,
    motivacion: `En el bachillerato necesitas resolver retos reales de ${topic} con criterio ético.`,
    saberesPrevios: `Utilizas dispositivos digitales cotidianos vinculados con ${topic}.`,
    contenido: `Definición: ${topic} articula herramientas digitales y criterios técnicos en entornos educativos.\n\nPrivacidad y Seguridad: protege datos personales, contraseñas y licencias abiertas en cada actividad.`,
    ejemploResuelto: `Caso aplicado de ${topic}.\nPaso 1: Identificar requerimientos y datos de entrada del proyecto.\nPaso 2: Configurar la herramienta o algoritmo correspondiente.\nPaso 3: Validar la salida y verificar seguridad e integridad.`,
    practica: [
      {
        enunciado: `Elabora una guía práctica verificable sobre ${topic} para tu grupo.`,
        pista: 'Comienza listando entradas, reglas y criterio de verificación.',
      },
    ],
    aplicacion: `Integra los criterios de ${topic} al producto comunitario PAEC del plantel.`,
    autoevaluacion: [
      `Explico con claridad los principios clave de ${topic}.`,
      `Verifico la calidad y seguridad de mi entrega sobre ${topic}.`,
    ],
    recursos: [
      {
        titulo: `Guía abierta sobre ${topic}`,
        url: 'https://developer.mozilla.org/es/',
        tipo: 'web',
      },
    ],
    productoIntegrador: `Avance documentado de ${topic}.`,
    sintesisVisual: {
      conceptoBreve: `${topic} integra criterio técnico y ciudadanía digital responsable.`,
      formulaOReglaClave: `Regla operativa: validar entrada, proceso y privacidad en ${topic}.`,
      ejemploBreve: {
        planteamiento: `Caso aplicado de ${topic} con criterios verificables.`,
        pasos: ['Definir entradas.', 'Validar salida y privacidad.'],
        conclusion: `Aplicación técnica y ética de ${topic} comprobada.`,
      },
      mapaConceptual: {
        definicionClave: `${topic} permite gestionar información digital con rigor y seguridad.`,
        criterioDesarrollo: `Comprobar cada paso y validar licencias y privacidad en ${topic}.`,
        errorComun: `Publicar resultados de ${topic} sin verificar fuentes ni permisos.`,
        correccionBreve: `Revisar siempre autoría, privacidad y exactitud técnica.`,
      },
    },
  };
}

function makeCdBlockWorkbook(blockNumber: number): ActiveWorkTextbook {
  const missionTopicsByBlock: Record<number, string[]> = {
    1: [
      'Ciudadanía digital, identidad y privacidad en redes sociales',
      'Hardware, software y arquitectura básica del equipo escolar',
      'Licencias Creative Commons, derechos de autor y fuentes confiables',
      'Seguridad informática, contraseñas robustas y prevención de riesgos',
    ],
    2: [
      'Hojas de cálculo, fórmulas condicionales y análisis de datos',
      'Algoritmos, pseudocódigo y diagramas de flujo estructurados',
      'Redes de cómputo locales, protocolos e internet comunitario',
      'Bases de datos relacionales y organización de registros escolares',
    ],
    3: [
      'Automatización de tareas y pensamiento computacional aplicado',
      'Diseño de interfaces accesibles y comunicación multimedia',
      'Ética en inteligencia artificial y verificación de información',
      'Publicación digital colaborativa y portafolio comunitario PAEC',
    ],
  };

  const topics = missionTopicsByBlock[blockNumber] ?? missionTopicsByBlock[1];
  const missions: MissionSection[] = topics.map((topic, mIdx) => {
    const baseSession = mIdx * 4 + 1;
    const sessionPlans = [0, 1, 2, 3].map((sOff) =>
      makeCdSessionPlan(baseSession + sOff, `${topic} (fase ${sOff + 1})`),
    );
    return {
      missionIndex: mIdx + 1,
      title: `Misión ${mIdx + 1}: ${topic}`,
      sessionTopic: topic,
      sessionFocus: `Comprender y aplicar ${topic} en contextos escolares reales.`,
      stageLabel: ['Exploración', 'Modelado', 'Aplicación', 'Integración'][mIdx] || 'Desarrollo',
      phenomenonHook: {
        story: `El plantel requiere fortalecer ${topic} para mejorar el trabajo colaborativo.`,
        detonatingQuestion: `¿Cómo aplicar ${topic} de forma segura y efectiva en tu comunidad?`,
      },
      conceptZero: {
        physicalAnalogy: `Así como un plano organiza una obra, ${topic} ordena tu flujo digital.`,
        coreExplanation: `${topic} establece criterios verificables para producir soluciones digitales confiables.`,
        solvedExample: {
          problemStatement: `Resolver un caso práctico de ${topic} con 3 criterios de calidad.`,
          solutionSteps: [
            `Paso 1: Definir alcance y requerimientos de ${topic}.`,
            `Paso 2: Ejecutar el procedimiento técnico y documentar evidencias.`,
            `Paso 3: Revisar resultados frente a la rúbrica de calidad.`,
          ],
          interpretation: `La solución sobre ${topic} cumple criterios técnicos y éticos.`,
        },
      },
      iDoSection: {
        stepByStepDemo: `1. Analizar el reto de ${topic}. 2. Diseñar la estructura. 3. Validar la salida.`,
      },
      weDoSection: {
        guidedPractice: `En binas, contrasten ejemplos reales de ${topic} y registren mejoras.`,
        workbookElements: [],
      },
      youDoSection: {
        autonomousChallenge: `Produce una entrega verificada aplicando ${topic} a tu proyecto PAEC.`,
      },
      formativeCheckpoint: {
        question: `¿Qué evidencia demuestra tu dominio de ${topic}?`,
        criteriaChecklist: [
          `Aplica principios verificables de ${topic}.`,
          'Respeta criterios de privacidad y atribución.',
        ],
        reflectionPrompts: [`¿Qué ajuste mejoró tu solución de ${topic}?`],
      },
      sessionPlans,
    } as unknown as MissionSection;
  });

  return {
    coverData: {
      subjectName: 'Cultura Digital I',
      semester: 1,
      blockNumber,
      blockTitle: `Bloque ${blockNumber}`,
      schoolName: 'Bachillerato General Oficial Prueba',
      cct: '21EBH0001A',
      teacherName: 'Docente Prueba',
    },
    missions,
    projectSection: {
      artifactName: `Guía Digital Comunitaria B${blockNumber}`,
      communityUtility: 'Fortalece la alfabetización y seguridad digital en el plantel.',
      requiredMaterials: ['Computadora', 'Cuaderno'],
      phases: [
        { phaseNum: 1, title: 'Diagnóstico', allocatedHours: 4, deliverables: ['Bitácora'], instructions: 'Relevar necesidades.' },
      ],
      technicalSpecs: ['Formato digital accesible'],
      acceptanceCriteria: ['Sin errores ni datos sensibles expuestos'],
    },
    evaluationSection: {
      rubric: [
        {
          criterion: 'Rigor técnico y ciudadanía digital',
          weightPercent: 100,
          levels: [{ levelName: 'Destacado', points: 100, descriptor: 'Cumple todos los criterios.' }],
        },
      ],
      checklist: [{ item: 'Verifica fuentes y licencias', category: 'Ética' }],
      metacognitiveReflection: { prompts: ['¿Qué aprendiste en este bloque?'] },
    },
  } as unknown as ActiveWorkTextbook;
}

describe('PR 4.2.1 — Pulido 06 + Integración real 08 (12 misiones PPTX) y 09 (48 páginas PDF)', () => {
  it('06 Cultura Digital I: cero títulos cortados con .slice(), cero "Misión N" duplicado, cero "·" colgante, cero caption duplicado y diagramas específicos por misión', async () => {
    const missions: StudentMissionFraming[] = [
      {
        blockNumber: 1,
        missionIndex: 1,
        title: 'Misión 1: Activación de ciudadanía digital y privacidad en redes sociales',
        stageLabel: 'Exploración',
        startSession: 1,
        endSession: 4,
      },
      {
        blockNumber: 1,
        missionIndex: 2,
        title: 'Misión 2: Hardware, software y arquitectura del equipo de cómputo escolar',
        stageLabel: 'Modelado',
        startSession: 5,
        endSession: 8,
      },
      {
        blockNumber: 1,
        missionIndex: 3,
        title: 'Misión 3: Algoritmos, operadores lógicos y automatización de problemas',
        stageLabel: 'Aplicación',
        startSession: 9,
        endSession: 12,
      },
    ];

    const sessions: StudentSession[] = [
      {
        numero: 1,
        titulo: 'Sesión 1: Identidad digital y huella en redes',
        objetivo: 'Evaluar riesgos de privacidad, huella digital y configuración segura de cuentas.',
        motivacion: 'Cada publicación en redes sociales construye tu identidad digital permanente.',
        saberesPrevios: 'Usas plataformas sociales y mensajería diariamente.',
        contenido: [
          {
            tipo: 'definicion',
            titulo: 'Huella Digital',
            texto: 'Rastro verificable de datos y publicaciones que dejas al navegar en internet.',
          },
          {
            tipo: 'definicion',
            titulo: 'Privacidad Activa',
            texto: 'Control consciente de permisos, contraseñas y visibilidad en redes sociales.',
          },
        ],
        ejemploResuelto: {
          enunciado: 'Auditar permisos de privacidad en un perfil estudiantil.',
          pasos: [
            'Revisar visibilidad de publicaciones públicas.',
            'Activar verificación en dos pasos en la cuenta.',
          ],
        },
        practica: [{ enunciado: 'Configura una lista de verificación de privacidad.', pista: 'Revisa permisos de apps.' }],
        aplicacion: 'Protege tus cuentas escolares y orienta a tu familia.',
        autoevaluacion: ['Identifico mi huella digital.', 'Configuro privacidad con criterio.'],
        recursos: [{ titulo: 'Guía de Ciudadanía Digital', url: 'https://www.gob.mx/', tipo: 'web' }],
        sidenote: 'La huella digital es acumulativa y requiere gestión ética.',
      },
      {
        numero: 5,
        titulo: 'Sesión 5: Arquitectura física y lógica del equipo',
        objetivo: 'Distinguir dispositivos de entrada, CPU, memoria RAM, almacenamiento y periféricos de salida.',
        motivacion: 'Diagnosticar un equipo lento exige reconocer sus componentes internos.',
        saberesPrevios: 'Interactúas con teclado, monitor y sistema operativo.',
        contenido: [
          {
            tipo: 'parrafo',
            texto: 'Entrada: teclado y sensores capturan datos. Proceso: CPU y memoria RAM ejecutan instrucciones. Control: sistema operativo administra recursos. Salida: monitor e impresora presentan resultados.',
          },
        ],
        ejemploResuelto: {
          enunciado: 'Clasificar los componentes de una computadora de laboratorio.',
          pasos: [
            'Identificar periféricos de entrada y salida.',
            'Verificar capacidad de RAM y disco SSD.',
          ],
        },
        practica: [{ enunciado: 'Elabora el inventario técnico de tu equipo.', pista: 'Agrupa por función.' }],
        aplicacion: 'Optimiza el mantenimiento preventivo del aula de cómputo.',
        autoevaluacion: ['Distingo hardware y software.', 'Explico el ciclo entrada-proceso-salida.'],
        recursos: [{ titulo: 'Arquitectura de Computadoras', url: 'https://developer.mozilla.org/es/', tipo: 'web' }],
      },
      {
        numero: 9,
        titulo: 'Sesión 9: Algoritmos y lógica condicional',
        objetivo: 'Diseñar algoritmos estructurados con variables, operadores y decisiones verificables.',
        motivacion: 'Automatizar el cálculo de promedios ahorra tiempo y elimina errores humanos.',
        saberesPrevios: 'Has seguido recetas e instrucciones ordenadas.',
        contenido: [
          {
            tipo: 'parrafo',
            texto: 'Un algoritmo define una secuencia finita y ordenada de pasos sin ambigüedad.',
          },
        ],
        ejemploResuelto: {
          enunciado: 'Algoritmo para clasificar asistencia escolar.',
          pasos: [
            'Paso 1: Leer total de sesiones y faltas registradas.',
            'Paso 2: Calcular porcentaje de asistencia efectiva.',
            'Paso 3: Evaluar si cumple el mínimo del 80 por ciento.',
            'Paso 4: Emitir estatus y alerta preventiva.',
          ],
        },
        practica: [{ enunciado: 'Traza el diagrama de flujo de control de asistencias.', pista: 'Incluye condición 80%.' }],
        aplicacion: 'Automatiza registros académicos del grupo.',
        autoevaluacion: ['Construyo pasos ordenados.', 'Valido condiciones lógicas.'],
        recursos: [{ titulo: 'Scratch MIT', url: 'https://scratch.mit.edu/', tipo: 'web' }],
      },
    ];

    const enriched = await enrichEditorialSessionsV2({
      uacName: 'Cultura Digital I',
      sessions,
      missions,
    });

    expect(enriched).toHaveLength(3);
    const svgs: string[] = [];
    for (const s of enriched) {
      expect(s.embeddedDiagram).toBeDefined();
      const { title, caption, svg } = s.embeddedDiagram!;

      // Cero "·" colgante al final
      expect(title).not.toMatch(/·\s*$/);
      // Cero prefijo duplicado "Misión N: ... (Misión N)"
      expect(title).not.toMatch(/Misi[oó]n\s+\d+.*Misi[oó]n\s+\d+/i);
      expect(svg).not.toMatch(/Misi[oó]n\s+\d+.*Misi[oó]n\s+\d+/i);
      // Cero palabras cortadas clásicas de .slice()
      expect(svg).not.toMatch(/\b(?:Activac|Aplicaci|Privacida|Proble|Operado)\b/);
      // Cero Plano Cartesiano
      expect(svg).not.toMatch(/plano\s+cartesiano/i);

      // Caption NUNCA duplica textualmente el título interno del SVG
      const firstTextMatch = svg.match(/<text[^>]*>([^<]+)<\/text>/);
      const svgTitle = firstTextMatch?.[1]?.trim() ?? '';
      expect(svgTitle.length).toBeGreaterThan(8);
      expect(caption).toBeTruthy();
      expect(caption!.toLowerCase()).not.toBe(svgTitle.toLowerCase());
      svgs.push(svg);
    }

    // Los 3 diagramas tienen contenido realmente distinto (no el fallback genérico repetido)
    expect(new Set(svgs).size).toBe(3);
    expect(svgs[0]).toContain('Huella Digital');
    expect(svgs[2]).toContain('Calcular porcentaje');
  });

  it('08 PPTX combinado (3 bloques × 4 misiones = 12 misiones en lesson-guide): rotación real por misión (NO 4/4/4 por bloque) y 3 imágenes panorámicas embebidas en ppt/media/', async () => {
    const sceneLoader = createNodeSceneLoader();
    const workbooks = [1, 2, 3].map((b) => makeCdBlockWorkbook(b));
    const misconceptionTracker = new Map<string, number>();

    const allDecks = workbooks.flatMap((wb) =>
      buildSacrintDecksForWorkbook(wb, {
        mode: 'lesson-guide',
        misconceptionTracker,
        ...sceneLoader,
      }),
    );

    expect(allDecks).toHaveLength(12);

    // Todas las 12 presentaciones en modo lesson-guide deben traer heroDataUri cargado
    const heroPaths = allDecks.map((d) => d.editorialScenes?.hero?.relativePath);
    expect(heroPaths.every((p) => typeof p === 'string' && p.endsWith('.webp'))).toBe(true);
    expect(allDecks.every((d) => d.editorialScenes?.hero?.dataUri?.startsWith('data:image/webp;base64,'))).toBe(true);

    // Verificar que ningún bloque repite 4/4/4 la misma portada (cada bloque usa las 3 escenas 16:9)
    for (let b = 0; b < 3; b++) {
      const blockHeroes = heroPaths.slice(b * 4, b * 4 + 4);
      expect(new Set(blockHeroes).size).toBe(3);
    }

    // Verificar que ninguna misión consecutiva en el semestre repite portada
    for (let i = 1; i < heroPaths.length; i++) {
      expect(heroPaths[i]).not.toBe(heroPaths[i - 1]);
    }

    // Generar el PPTX combinado real e inspeccionar las portadas dentro del ZIP
    const pptxBuf = await generateCombinedSacrintPptx(allDecks, {
      title: 'Presentación SACRINT completa — Cultura Digital I',
      subjectName: 'Cultura Digital I',
    });
    const zip = await JSZip.loadAsync(pptxBuf);
    const mediaFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith('ppt/media/') && !zip.files[f].dir,
    );
    expect(mediaFiles.length).toBeGreaterThanOrEqual(3);

    // Cada portada (slide 1, 10, 19... = inicio de cada deck de 9 slides) debe apuntar a una imagen en ppt/media/
    // y el bloque 1 NO puede tener las 4 portadas apuntando al mismo hash de imagen
    const mediaHashes = new Map<string, number>();
    for (const mf of mediaFiles) {
      const entry = zip.file(mf);
      expect(entry).not.toBeNull();
      const bytes = await entry!.async('nodebuffer');
      mediaHashes.set(mf.split('/').pop()!, bytes.length);
    }

    let slideIdx = 1;
    const coverSizesPerMission: number[] = [];
    for (const deck of allDecks) {
      const relsPath = `ppt/slides/_rels/slide${slideIdx}.xml.rels`;
      const relsXml = await zip.file(relsPath)?.async('string');
      expect(relsXml).toBeTruthy();
      const targetMatch = relsXml!.match(/Target="\.\.\/media\/([^"]+)"/);
      expect(targetMatch).not.toBeNull();
      coverSizesPerMission.push(mediaHashes.get(targetMatch![1]) ?? 0);
      slideIdx += deck.slides.length;
    }

    expect(coverSizesPerMission).toHaveLength(12);
    // Los 3 bloques tienen exactamente 3 tamaños de imagen distintos en sus 4 portadas (rotación real, NO 4/4/4)
    expect(new Set(coverSizesPerMission.slice(0, 4)).size).toBe(3);
    expect(new Set(coverSizesPerMission.slice(4, 8)).size).toBe(3);
    expect(new Set(coverSizesPerMission.slice(8, 12)).size).toBe(3);
    for (let i = 1; i < coverSizesPerMission.length; i++) {
      expect(coverSizesPerMission[i]).not.toBe(coverSizesPerMission[i - 1]);
    }
  }, 30000);

  it('09 Infografías PDF combinado (3 bloques × 4 misiones × 4 sesiones = 48 páginas): rotación real 16/16/16 entre las 3 variantes Parte D', async () => {
    const sceneLoader = createNodeSceneLoader();
    const workbooks = [1, 2, 3].map((b) => makeCdBlockWorkbook(b));

    const specs = workbooks.flatMap((wb) =>
      selectInfographicTargets(wb).map((target) =>
        buildSacrintInfographic(wb, 'wide', {
          missionIndex: target.missionIndex,
          sessionIndex: target.sessionIndex,
          ...sceneLoader,
        }),
      ),
    );

    expect(specs).toHaveLength(48);

    const paths = specs.map((s) => s.editorialScene?.relativePath ?? '');
    const counts = new Map<string, number>();
    for (const p of paths) {
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }

    expect(counts.get('/images/escenas/cultura_digital_programacion_ti/tic-03-practica.webp')).toBe(16);
    expect(counts.get('/images/escenas/cultura_digital_programacion_ti/tic-05-infografia-b.webp')).toBe(16);
    expect(counts.get('/images/escenas/cultura_digital_programacion_ti/tic-06-infografia-c.webp')).toBe(16);

    // Ninguna página consecutiva repite imagen dentro del bloque
    for (let b = 0; b < 3; b++) {
      const blockSlice = paths.slice(b * 16, b * 16 + 16);
      for (let i = 1; i < blockSlice.length; i++) {
        expect(blockSlice[i]).not.toBe(blockSlice[i - 1]);
      }
    }

    // Compilar el PDF vectorial combinado real de las 48 páginas y verificar páginas + imágenes embebidas
    const pdfBuf = await renderCombinedSacrintInfographicsPdf(specs, 'wide');
    expect(pdfBuf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const latin1 = pdfBuf.toString('latin1');
    const imageXObjects = latin1.match(/\/Subtype\s*\/Image/g) ?? [];
    expect(imageXObjects.length).toBeGreaterThanOrEqual(3);
    // Verificar que efectivamente contiene 48 páginas (/Type /Page sin /Pages)
    const pageDefs = latin1.match(/\/Type\s*\/Page\b(?!s)/g) ?? [];
    expect(pageDefs.length).toBe(48);
  }, 45000);

  it('PR 4.2.2 — 06: caption completa (cero "Introducción al"), paréntesis balanceados (cero "(Cultura (Misión 2)"), cero "• : Conclusión:" y variedad equilibrada sin texto genérico de taller', async () => {
    // 1. Verificar limpieza de viñeta "• : Conclusión:" en parseEjemploResuelto
    const parsedExample = parseEjemploResuelto(
      'Análisis de consumo de memoria RAM en navegador.\nPaso 1: Medir uso inicial.\nPaso 2: : Conclusión: El sistema operativo gestiona 8 pestañas sin degradar rendimiento.',
    );
    expect(parsedExample.pasos[1]).toBe(
      'Conclusión: El sistema operativo gestiona 8 pestañas sin degradar rendimiento.',
    );
    expect(parsedExample.pasos.every((p) => !/^[:;•\-–—]/.test(p))).toBe(true);

    // 2. Reproducir exactamente p8, p15/p57/p99, p28/p41 de Paquete_CD1_PDF_4
    const missions: StudentMissionFraming[] = [
      {
        blockNumber: 1,
        missionIndex: 1,
        title: 'Sesión 1: Exploración Diagnóstica y Problematización Situada — Introducción al hardware y software',
        stageLabel: 'Exploración',
        startSession: 1,
        endSession: 4,
      },
      {
        blockNumber: 1,
        missionIndex: 2,
        title: 'Práctica y Aplicación (Cultura Digital, Pensamiento Algorítmico, Programación)',
        stageLabel: 'Práctica',
        startSession: 5,
        endSession: 8,
      },
      {
        blockNumber: 1,
        missionIndex: 3,
        title: 'Proyecto Integrador — Sesión 10: Aplicación Práctica en Situaciones Contextuales',
        stageLabel: 'Proyecto',
        startSession: 9,
        endSession: 12,
      },
      {
        blockNumber: 1,
        missionIndex: 4,
        title: 'Evaluación y Cierre — Sesión 16: Aplicación Práctica en Situaciones Contextuales',
        stageLabel: 'Cierre',
        startSession: 13,
        endSession: 16,
      },
    ];

    const sessions: StudentSession[] = [
      {
        numero: 1,
        titulo: 'Sesión 1: Introducción al hardware y software en el aula',
        objetivo: 'Distinguir los componentes de hardware, periféricos y sistema operativo de un equipo escolar.',
        motivacion: 'Las fuentes que utilizas en tu entorno requieren comprender entradas y salidas de datos.',
        saberesPrevios: 'Usas computadora y celular diariamente.',
        contenido: [{ tipo: 'parrafo', texto: 'El hardware y el software trabajan de forma coordinada en todo sistema operativo.' }],
        ejemploResuelto: { enunciado: 'Identificar periféricos.', pasos: ['Listar entradas.', 'Clasificar salidas.'] },
        practica: [{ enunciado: 'Clasifica los componentes de tu equipo.', pista: 'Distingue físico y lógico.' }],
        aplicacion: 'Diagnostica equipos en el plantel.',
        autoevaluacion: ['Distingo hardware.', 'Distingo software.'],
        recursos: [{ titulo: 'MDN', url: 'https://developer.mozilla.org/es/', tipo: 'web' }],
      },
      {
        numero: 5,
        titulo: 'Sesión 5: Licencias Creative Commons y software libre',
        objetivo: 'Aplicar licencias Creative Commons y principios de software libre en recursos educativos.',
        motivacion: 'Compartir materiales digitales requiere reconocer la autoría legalmente.',
        saberesPrevios: 'Has descargado imágenes y documentos de internet.',
        contenido: [{ tipo: 'parrafo', texto: 'Las licencias Creative Commons y el software libre GNU/Linux promueven soberanía tecnológica.' }],
        ejemploResuelto: { enunciado: 'Seleccionar licencia.', pasos: ['Verificar autor.', 'Elegir BY-SA.'] },
        practica: [{ enunciado: 'Asigna una licencia a tu guía.', pista: 'Revisa condiciones BY y NC.' }],
        aplicacion: 'Publica tu guía comunitaria con atribución clara.',
        autoevaluacion: ['Cito fuentes.', 'Elijo licencias correctas.'],
        recursos: [{ titulo: 'Creative Commons', url: 'https://creativecommons.org/', tipo: 'web' }],
      },
      {
        numero: 9,
        titulo: 'Sesión 9: Algoritmos y diagramas de flujo condicionales',
        objetivo: 'Diseñar algoritmos y diagramas de flujo con operadores lógicos para resolver retos escolares.',
        motivacion: 'Un diagrama de flujo evita ambigüedades en la toma de decisiones automatizadas.',
        saberesPrevios: 'Conoces secuencias paso a paso.',
        contenido: [{ tipo: 'parrafo', texto: 'Los diagramas de flujo modelan decisiones lógicas y variables.' }],
        ejemploResuelto: { enunciado: 'Flujo de alertas.', pasos: ['Paso 1: Capturar datos.', 'Paso 2: Evaluar umbral.', 'Paso 3: Emitir reporte.'] },
        practica: [{ enunciado: 'Traza tu diagrama.', pista: 'Usa rombos para decisiones.' }],
        aplicacion: 'Automatiza reportes escolares.',
        autoevaluacion: ['Modelo decisiones.', 'Valido rutas.'],
        recursos: [{ titulo: 'Scratch', url: 'https://scratch.mit.edu/', tipo: 'web' }],
      },
      {
        numero: 13,
        titulo: 'Sesión 13: Protección de datos y privacidad en redes sociales',
        objetivo: 'Evaluar riesgos de privacidad, colonialismo de datos y ciudadanía digital responsable.',
        motivacion: 'Las aplicaciones gratuitas recopilan metadatos que comprometen tu identidad digital.',
        saberesPrevios: 'Tienes cuentas en redes sociales.',
        contenido: [{ tipo: 'parrafo', texto: 'La protección de datos y la privacidad digital resguardan tu identidad en línea.' }],
        ejemploResuelto: { enunciado: 'Auditar permisos.', pasos: ['Revisar permisos.', 'Activar 2FA.'] },
        practica: [{ enunciado: 'Audita tus apps.', pista: 'Revoca ubicación innecesaria.' }],
        aplicacion: 'Comparte checklist de seguridad en casa.',
        autoevaluacion: ['Protejo mis cuentas.', 'Evalúo riesgos.'],
        recursos: [{ titulo: 'INAI', url: 'https://home.inai.org.mx/', tipo: 'web' }],
      },
    ];

    const enriched = await enrichEditorialSessionsV2({
      uacName: 'Cultura Digital I',
      sessions,
      missions,
    });

    const captions = new Set<string>();
    const diagramTitles = enriched.map((s) => s.embeddedDiagram?.title ?? '');
    const svgs = enriched.map((s) => s.embeddedDiagram?.svg ?? '');

    // p8: NO debe quedar cortado en "Introducción al"
    expect(diagramTitles[0]).not.toMatch(/\b(?:al|de|del|en|y|para)\s*$/i);
    expect(enriched[0]?.embeddedDiagram?.caption).not.toMatch(/\b(?:al|de|del|en|y|para)\.?$/i);
    expect(enriched[0]?.embeddedDiagram?.caption?.toLowerCase()).toContain('hardware');

    // p15: paréntesis siempre balanceados, cero "(Cultura (Misión 2)"
    for (const s of enriched) {
      const diag = s.embeddedDiagram!;
      expect(diag).toBeDefined();
      captions.add(diag.caption ?? '');
      const checkBalanced = (txt: string) =>
        (txt.match(/\(/g) || []).length === (txt.match(/\)/g) || []).length;
      expect(checkBalanced(diag.title)).toBe(true);
      expect(checkBalanced(diag.caption ?? '')).toBe(true);
      const firstSvgTitle = diag.svg.match(/<text[^>]*>([^<]+)<\/text>/)?.[1] ?? '';
      expect(checkBalanced(firstSvgTitle)).toBe(true);
      expect(firstSvgTitle).not.toContain('(Cultura (');
      // Cero descripción genérica de taller industrial ni fragmentos rotos "s que utilizas"
      expect(diag.svg).not.toContain('La interacción modular garantiza modularidad');
      expect(diag.svg).not.toContain('Pantallas, motores e interfaces');
      expect(diag.svg).not.toMatch(/>\s*s\s+que\s+utilizas/i);
    }

    // Todas las leyendas deben ser distintas entre sí (sin leyendas repetidas genéricas)
    expect(captions.size).toBe(4);
    // Variedad real: los 4 temas deben producir al menos los 3 tipos distintos (Arquitectura + Mapa + Flujo)
    expect(svgs.some((s) => s.includes('Arquitectura Digital:'))).toBe(true);
    expect(svgs.some((s) => s.includes('Mapa Conceptual:'))).toBe(true);
    expect(svgs.some((s) => s.includes('Flujo Algorítmico:'))).toBe(true);
  });

  it('PR 4.2.2 — 08 PPTX: verifica que TODA imagen embebida (portadas y concepto) coincida 1:1 con el aspect ratio del marco OOXML (< 2% tolerancia, cero estiramiento)', async () => {
    const sceneLoader = createNodeSceneLoader();
    const wb = makeCdBlockWorkbook(1);
    const decks = buildSacrintDecksForWorkbook(wb, {
      mode: 'lesson-guide',
      ...sceneLoader,
    });
    const pptxBuf = await generateCombinedSacrintPptx(decks.slice(0, 2), {
      title: 'Test Aspect Ratio PPTX',
      subjectName: 'Cultura Digital I',
    });
    const zip = await JSZip.loadAsync(pptxBuf);

    // Mapear cada archivo de ppt/media/ a sus dimensiones reales en píxeles vía sharp
    const mediaDims = new Map<string, { width: number; height: number }>();
    for (const name of Object.keys(zip.files)) {
      if (name.startsWith('ppt/media/') && !zip.files[name].dir) {
        const buf = await zip.file(name)!.async('nodebuffer');
        const meta = await sharp(buf).metadata();
        mediaDims.set(name.split('/').pop()!, {
          width: meta.width ?? 0,
          height: meta.height ?? 0,
        });
      }
    }

    let checkedPics = 0;
    const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    for (const sf of slideFiles) {
      const slideXml = await zip.file(sf)!.async('string');
      const picBlocks = slideXml.match(/<p:pic>[\s\S]*?<\/p:pic>/g) ?? [];
      if (picBlocks.length === 0) continue;

      const relsFile = sf.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
      const relsXml = (await zip.file(relsFile)?.async('string')) ?? '';
      const relMap = new Map<string, string>();
      for (const m of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="\.\.\/media\/([^"]+)"/g)) {
        relMap.set(m[1], m[2]);
      }

      for (const pic of picBlocks) {
        const embedMatch = pic.match(/r:embed="(rId\d+)"/);
        const extMatch = pic.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/);
        if (!embedMatch || !extMatch) continue;
        const mediaName = relMap.get(embedMatch[1]);
        const dims = mediaName ? mediaDims.get(mediaName) : undefined;
        expect(dims).toBeDefined();
        const imgRatio = dims!.width / dims!.height;
        const boxRatio = Number(extMatch[1]) / Number(extMatch[2]);
        const relDiff = Math.abs(imgRatio - boxRatio) / boxRatio;
        expect(relDiff).toBeLessThan(0.02);
        checkedPics++;
      }
    }

    expect(checkedPics).toBeGreaterThanOrEqual(2);
  }, 30000);

  it('PR 4.2.2 — 09 Infografías: garantiza alineación semántica título ↔ cuerpo en los 7 casos reales de Paquete_CD1_PDF_4', () => {
    const cases = [
      {
        label: 'p6 Socialización de hallazgos vs Historia y estado de tecnología',
        missionTopic: 'Historia y el estado de la tecnología digital',
        objective: 'Socializarás resultados de investigación técnica para consensuar soluciones colectivas.',
        claim: 'La socialización de hallazgos es el proceso de comunicar resultados de investigación técnica para generar consensos.',
        formula: 'Evidencia + Argumento + Propuesta = Solución Colectiva',
        expectedRegex: /socializaci[oó]n\s+de\s+hallazgos/i,
        forbiddenRegex: /^historia\s+y\s+el\s+estado/i,
      },
      {
        label: 'p8 Creative Commons vs Aplicación Práctica',
        missionTopic: 'Aplicación Práctica en Situaciones Contextuales — Historia crítica del desarrollo',
        objective: 'Evaluarás la aplicación práctica en situaciones contextuales del bloque.',
        claim: 'Las licencias Creative Commons son herramientas legales que posibilitan a los autores compartir sus obras bajo condiciones específicas.',
        formula: 'Licencia CC = Reconocimiento (BY) + Condiciones (NC, ND, SA)',
        expectedRegex: /creative\s+commons/i,
        forbiddenRegex: /aplicaci[oó]n\s+pr[aá]ctica/i,
      },
      {
        label: 'p11 Licencia GPL vs nombre de artefacto PAEC',
        missionTopic: 'Kit de Ciudadanía Digital: Guía de Software Libre y Seguridad Comunitaria',
        objective: 'Evaluarás e integrarás los productos del proyecto comunitario final.',
        claim: 'La licencia GPL garantiza las libertades de usar, estudiar, modificar y distribuir software en la comunidad educativa.',
        formula: 'Libertad = (Uso + Estudio + Modificación + Redistribución)',
        expectedRegex: /licencia\s+gpl/i,
        forbiddenRegex: /kit\s+de\s+ciudadan[ií]a/i,
      },
      {
        label: 'p17 Socialización de hallazgos sobre desigualdad digital',
        missionTopic: 'Desigualdad digital',
        objective: 'Socializarás tus hallazgos y defenderás propuestas éticas sobre brecha tecnológica.',
        claim: 'La socialización de hallazgos y la defensa de soluciones éticas permiten transformar el análisis crítico en acciones concretas.',
        formula: 'Evidencia (Datos) + Argumento (Ética) → Propuesta de Acción (Solución)',
        expectedRegex: /socializaci[oó]n\s+de\s+hallazgos/i,
        forbiddenRegex: /^desigualdad\s+digital$/i,
      },
      {
        label: 'p18 Cuatro libertades del software libre vs Fundamentos genéricos',
        missionTopic: 'Fundamentos de la ciudadanía digital',
        objective: 'Comprenderás los fundamentos de la ciudadanía digital.',
        claim: 'Las cuatro libertades del software libre garantizan que tú mantengas el control total sobre tus herramientas digitales.',
        formula: 'Libertad (0, 1, 2, 3) = Control Total sobre el Código Fuente',
        expectedRegex: /cuatro\s+libertades\s+del\s+software\s+libre/i,
        forbiddenRegex: /^fundamentos\s+de\s+la\s+ciudadan[ií]a\s+digital$/i,
      },
      {
        label: 'p28 Socialización de riesgos y protección de datos',
        missionTopic: 'Protección de datos',
        objective: 'Socializarás soluciones de seguridad digital y autenticación en dos pasos.',
        claim: 'La socialización de hallazgos es el proceso de comunicar riesgos y soluciones de seguridad digital de manera persuasiva.',
        formula: 'Problema (Riesgo) + Evidencia (Datos) + Solución (Acción) = Impacto Social',
        expectedRegex: /socializaci[oó]n\s+de\s+hallazgos/i,
        forbiddenRegex: /^protecci[oó]n\s+de\s+datos$/i,
      },
      {
        label: 'p43 Operadores lógicos y matemáticos vs Variables del proyecto',
        missionTopic: 'Variables del proyecto',
        objective: 'Analizarás variables del proyecto comunitario.',
        claim: 'Los operadores lógicos y matemáticos son herramientas fundamentales para procesar datos y establecer reglas de decisión.',
        formula: 'SI (Condición A) Y (Condición B) → Acción',
        expectedRegex: /operadores\s+l[oó]gicos\s+y\s+matem[aá]ticos/i,
        forbiddenRegex: /^variables\s+del\s+proyecto$/i,
      },
      {
        label: 'p46 Representación gráfica y tabular vs artefacto PAEC App-Comunidad Segura',
        missionTopic: 'App-Comunidad Segura: Algoritmo de Bienestar Juvenil',
        objective: 'Evaluarás la presentación final del proyecto comunitario.',
        claim: 'La representación gráfica y tabular transforma datos crudos en información visual clara para identificar patrones y tendencias.',
        formula: 'Datos → Tabla de Frecuencias → Gráfico (Tendencia/Comparación)',
        expectedRegex: /representaci[oó]n\s+gr[aá]fica\s+y\s+tabular/i,
        forbiddenRegex: /app-comunidad\s+segura/i,
      },
    ];

    for (const c of cases) {
      const wb = makeCdBlockWorkbook(1);
      wb.projectSection.artifactName = c.missionTopic.includes(':')
        ? c.missionTopic
        : 'Kit de Ciudadanía Digital: Guía de Software Libre y Seguridad Comunitaria';
      wb.missions[0]!.title = `Misión 1: ${c.missionTopic}`;
      wb.missions[0]!.sessionTopic = c.missionTopic;
      wb.missions[0]!.sessionPlans![0]!.objetivo = c.objective;
      wb.missions[0]!.sessionPlans![0]!.sintesisVisual = {
        conceptoBreve: c.claim,
        formulaOReglaClave: c.formula,
        ejemploBreve: {
          planteamiento: `Caso práctico sobre ${c.label}.`,
          pasos: ['Revisar criterios.', 'Validar entrega.'],
          conclusion: 'Resultado verificado.',
        },
        mapaConceptual: {
          definicionClave: c.claim,
          criterioDesarrollo: 'Aplicar rigor técnico y ético.',
          errorComun: 'Omitir verificación de fuentes y criterios.',
          correccionBreve: 'Contrastar cada afirmación con evidencia.',
        },
      };

      const spec = buildSacrintInfographic(wb, 'wide', { missionIndex: 0, sessionIndex: 0 });
      expect(spec.title, `Caso ${c.label}`).toMatch(c.expectedRegex);
      expect(spec.title, `Caso ${c.label}`).not.toMatch(c.forbiddenRegex);
    }
  });
});
