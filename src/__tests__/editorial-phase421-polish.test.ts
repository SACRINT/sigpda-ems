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

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
  dedupeInfographicSpecs,
  selectInfographicTargets,
  type SacrintDeckSpec,
} from '@/lib/visual-engine/sacrint/spec';
import { cleanStepLine } from '@/lib/visual-engine/sacrint/distiller/formula-and-steps';
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

    const allDecks: SacrintDeckSpec[] = [];
    let prevHero:
      | NonNullable<NonNullable<SacrintDeckSpec['editorialScenes']>['hero']>['archetype']
      | undefined;
    let prevHeroId: string | undefined;
    for (const wb of workbooks) {
      const blockDecks = buildSacrintDecksForWorkbook(wb, {
        mode: 'lesson-guide',
        misconceptionTracker,
        previousHeroArchetype: prevHero,
        previousHeroSceneId: prevHeroId,
        ...sceneLoader,
      });
      const lastHero = blockDecks[blockDecks.length - 1]?.editorialScenes?.hero;
      prevHero = lastHero?.archetype ?? prevHero;
      prevHeroId = lastHero?.id ?? prevHeroId;
      allDecks.push(...blockDecks);
    }

    expect(allDecks).toHaveLength(12);

    // Todas las 12 presentaciones en modo lesson-guide deben traer heroDataUri cargado
    const heroPaths = allDecks.map((d) => d.editorialScenes?.hero?.relativePath);
    expect(heroPaths.every((p) => typeof p === 'string' && p.endsWith('.webp'))).toBe(true);
    expect(allDecks.every((d) => d.editorialScenes?.hero?.dataUri?.startsWith('data:image/webp;base64,'))).toBe(true);

    // Verificar que ningún bloque repite 4/4/4 la misma portada (>= 2 escenas por bloque y >= 3 en el semestre)
    expect(new Set(heroPaths).size).toBeGreaterThanOrEqual(3);
    for (let b = 0; b < 3; b++) {
      const blockHeroes = heroPaths.slice(b * 4, b * 4 + 4);
      expect(new Set(blockHeroes).size).toBeGreaterThanOrEqual(2);
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
    // y ningún bloque puede tener las 4 portadas apuntando al mismo hash de imagen
    const mediaHashes = new Map<string, string>();
    for (const mf of mediaFiles) {
      const entry = zip.file(mf);
      expect(entry).not.toBeNull();
      const bytes = await entry!.async('nodebuffer');
      mediaHashes.set(mf.split('/').pop()!, crypto.createHash('sha1').update(bytes).digest('hex'));
    }

    let slideIdx = 1;
    const coverHashesPerMission: string[] = [];
    for (const deck of allDecks) {
      const relsPath = `ppt/slides/_rels/slide${slideIdx}.xml.rels`;
      const relsXml = await zip.file(relsPath)?.async('string');
      expect(relsXml).toBeTruthy();
      const targetMatch = relsXml!.match(/Target="\.\.\/media\/([^"]+)"/);
      expect(targetMatch).not.toBeNull();
      coverHashesPerMission.push(mediaHashes.get(targetMatch![1]) ?? '');
      slideIdx += deck.slides.length;
    }

    expect(coverHashesPerMission).toHaveLength(12);
    // Al menos 3 escenas distintas en el semestre, ningún bloque repite 4/4/4 y 0 consecutivas repetidas
    expect(new Set(coverHashesPerMission).size).toBeGreaterThanOrEqual(3);
    expect(new Set(coverHashesPerMission.slice(0, 4)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(coverHashesPerMission.slice(4, 8)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(coverHashesPerMission.slice(8, 12)).size).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < coverHashesPerMission.length; i++) {
      expect(coverHashesPerMission[i]).not.toBe(coverHashesPerMission[i - 1]);
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
        label: 'p18 Fundamentos de ciudadanía digital: cuatro libertades (contextualizado sin duplicar p22)',
        missionTopic: 'Fundamentos de la ciudadanía digital',
        objective: 'Comprenderás los fundamentos de la ciudadanía digital.',
        claim: 'Las cuatro libertades del software libre garantizan que tú mantengas el control total sobre tus herramientas digitales.',
        formula: 'Libertad (0, 1, 2, 3) = Control Total sobre el Código Fuente',
        expectedRegex: /fundamentos\s+de\s+ciudadan[ií]a\s+digital:\s+cuatro\s+libertades/i,
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

  it('PR 4.2.3 — 09 Infografías: dedupe por bloque/misión preserva 48 págs (sin borrar GNU/Linux ni 4 libertades B2M2), 0 cajas R vacías (CD1 real p26/p29) y p41 Variables del proyecto alineada', () => {
    // 1. Verificar que p41 ("Variables del proyecto") se alinea incluso cuando definicionClave menciona "variables"
    const wbP41 = makeCdBlockWorkbook(3);
    wbP41.missions[2]!.title = 'Misión 3: Variables del proyecto';
    wbP41.missions[2]!.sessionTopic = 'Variables del proyecto';
    wbP41.missions[2]!.sessionPlans![0]!.objetivo = 'Analizarás variables del proyecto comunitario.';
    wbP41.missions[2]!.sessionPlans![0]!.sintesisVisual = {
      conceptoBreve:
        'Los operadores lógicos y matemáticos son herramientas fundamentales para procesar datos y establecer reglas de decisión.',
      formulaOReglaClave: 'SI (Condición A)',
      ejemploBreve: {
        planteamiento: 'Identificas riesgo en 870 jóvenes usando edad < 18 y eventos > 3.',
        pasos: ['Defines variables y operadores comparativos.', 'Verificas con pruebas de escritorio.'],
        conclusion: 'La regla identifica correctamente a los jóvenes en riesgo.',
      },
      mapaConceptual: {
        definicionClave: 'Es el conjunto de reglas lógicas que procesan variables para generar una salida.',
        criterioDesarrollo: 'Efectúa pruebas de escritorio con valores reales para validar la lógica de tus reglas.',
        errorComun: 'Usar operadores incorrectos que no reflejan la realidad del problema analizado.',
        correccionBreve: 'Efectúa pruebas de escritorio con valores reales para validar la lógica de tus reglas.',
      },
    };
    const specP41 = buildSacrintInfographic(wbP41, 'wide', { missionIndex: 2, sessionIndex: 0 });
    expect(specP41.title).toMatch(/operadores\s+l[oó]gicos\s+y\s+matem[aá]ticos/i);
    expect(specP41.title).not.toMatch(/variables\s+del\s+proyecto/i);

    // 2. Verificar que dedupeInfographicSpecs NO elimina sesiones de otro bloque/misión (restaura 48 págs)
    const wbB1 = makeCdBlockWorkbook(1);
    wbB1.missions[1]!.sessionTopic = 'Historia y el estado de la tecnología digital';
    wbB1.missions[1]!.sessionPlans![0]!.objetivo = 'Socializarás resultados técnicos con el grupo.';
    wbB1.missions[1]!.sessionPlans![0]!.sintesisVisual!.conceptoBreve =
      'La socialización de hallazgos es el proceso de comunicar resultados de investigación técnica para consensuar soluciones.';

    const wbB2 = makeCdBlockWorkbook(2);
    wbB2.missions[0]!.sessionTopic = 'Fundamentos de la ciudadanía digital';
    wbB2.missions[0]!.sessionPlans![0]!.objetivo = 'Comprenderás los fundamentos de la ciudadanía digital.';
    wbB2.missions[0]!.sessionPlans![0]!.sintesisVisual!.conceptoBreve =
      'Las cuatro libertades del software libre garantizan que mantengas el control total sobre tus herramientas digitales.';
    wbB2.missions[1]!.sessionTopic = 'Cuatro libertades del software libre';
    wbB2.missions[1]!.sessionPlans![0]!.objetivo = 'Aplicarás las cuatro libertades del software libre.';
    wbB2.missions[1]!.sessionPlans![0]!.sintesisVisual!.conceptoBreve =
      'Las cuatro libertades del software libre garantizan control total y soberanía tecnológica.';
    wbB2.missions[1]!.sessionPlans![1]!.objetivo =
      'Socializarás tu investigación sobre herramientas digitales y GNU/Linux.';
    wbB2.missions[1]!.sessionPlans![1]!.sintesisVisual!.conceptoBreve =
      'La socialización de hallazgos es el proceso de comunicar propuestas tecnológicas fundamentadas sobre GNU/Linux.';

    const specB1M2 = buildSacrintInfographic(wbB1, 'wide', { missionIndex: 1, sessionIndex: 0 });
    const specB2M1 = buildSacrintInfographic(wbB2, 'wide', { missionIndex: 0, sessionIndex: 0 });
    const specB2M2a = buildSacrintInfographic(wbB2, 'wide', { missionIndex: 1, sessionIndex: 0 });
    const specB2M2b = buildSacrintInfographic(wbB2, 'wide', { missionIndex: 1, sessionIndex: 1 });
    const deduped = dedupeInfographicSpecs([specB1M2, specB2M1, specB2M2a, specB2M2b]);
    expect(deduped).toHaveLength(4);
    expect(specB1M2.title).toMatch(/socializaci[oó]n\s+de\s+hallazgos/i);
    expect(specB2M2b.title).toMatch(/socializaci[oó]n\s+de\s+hallazgos/i);

    // 3. Verificar en el fixture real CD1 (p26 y p29) que NINGUNA caja de variable (incl. R) queda vacía
    const realWorkbooksPath = path.join(
      process.cwd(),
      'tests',
      'fixtures',
      'sacrint-golden',
      'real-workbooks.json',
    );
    const realWorkbooks = JSON.parse(fs.readFileSync(realWorkbooksPath, 'utf8')) as Record<
      string,
      ActiveWorkTextbook
    >;
    const cd1Real = realWorkbooks['CD1']!;
    const cd1Specs = dedupeInfographicSpecs(
      selectInfographicTargets(cd1Real).map((t) =>
        buildSacrintInfographic(cd1Real, 'wide', {
          missionIndex: t.missionIndex,
          sessionIndex: t.sessionIndex,
        }),
      ),
    );
    expect(cd1Specs.length).toBeGreaterThanOrEqual(6);
    for (const s of cd1Specs) {
      expect(s.variables.length).toBeGreaterThanOrEqual(3);
      for (const v of s.variables) {
        expect(v.meaning.trim().length, `Variable vacía ${v.symbol} en "${s.title}"`).toBeGreaterThanOrEqual(12);
      }
      if (s.diagram.kind === 'block-diagram') {
        expect(
          s.diagram.feedback.detail.trim().length,
          `Caja R (feedback) vacía en "${s.title}"`,
        ).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('PR 4.2.3 — 08 Presentaciones: elimina typo "15.(0)", evita protoboard en Slide 49 "Hoja de cálculo" y asegura coherencia temática de portadas', () => {
    // 1. Typo "15.(0)" en decimales al final de oración
    const cleaned = cleanStepLine(
      'Conclusión: El promedio de horas recreativas es 4.8 y el de estudio es 15.0. La condición lógica señala que el promedio de estudio no supera las 15 horas.',
    );
    expect(cleaned).toContain('15.0. La condición lógica');
    expect(cleaned).not.toContain('15.(0)');

    // 2. Coherencia temática en Bloque 2 de Cultura Digital I (incl. Slide 49 "Hoja de cálculo")
    const sceneLoader = createNodeSceneLoader();
    const wbB2 = makeCdBlockWorkbook(2);
    wbB2.missions[0]!.title = 'Misión 1: Las 4 libertades';
    wbB2.missions[0]!.sessionTopic = 'Las 4 libertades';
    wbB2.missions[0]!.sessionPlans![0]!.objetivo = 'Comprender las cuatro libertades del software libre.';
    wbB2.missions[1]!.title = 'Misión 2: Práctica y Aplicación — Hojas de cálculo';
    wbB2.missions[1]!.sessionTopic = 'Hojas de cálculo';
    wbB2.missions[1]!.sessionPlans![0]!.objetivo = 'Aplicar fórmulas condicionales en hoja de cálculo.';
    wbB2.missions[2]!.title = 'Misión 3: Proyecto Integrador — Privacidad';
    wbB2.missions[2]!.sessionTopic = 'Privacidad';
    wbB2.missions[2]!.sessionPlans![0]!.objetivo = 'Proteger tu privacidad y credenciales digitales.';
    wbB2.missions[3]!.title = 'Misión 4: Evaluación y Cierre — Ciudadanía digital';
    wbB2.missions[3]!.sessionTopic = 'Ciudadanía digital';
    wbB2.missions[3]!.sessionPlans![0]!.objetivo = 'Ejercer una ciudadanía digital ética en tu comunidad.';

    const decks = buildSacrintDecksForWorkbook(wbB2, {
      mode: 'lesson-guide',
      ...sceneLoader,
    });

    // Hojas de cálculo (Misión 2, donde vive Slide 49): ni portada ni concepto pueden usar protoboard (tic-01 ni tic-02)
    const spreadsheetDeck = decks[1]!;
    expect(spreadsheetDeck.editorialScenes?.hero?.relativePath).toContain('tic-07-software-datos.webp');
    expect(spreadsheetDeck.editorialScenes?.concept?.relativePath).toContain('tic-07-software-datos.webp');
    expect(spreadsheetDeck.editorialScenes?.hero?.relativePath).not.toMatch(/tic-0[12]-/);
    expect(spreadsheetDeck.editorialScenes?.concept?.relativePath).not.toMatch(/tic-0[12]-/);

    // Privacidad y Ciudadanía digital jamás deben recibir protoboard (ni tic-01 ni tic-02)
    expect(decks[2]!.editorialScenes?.hero?.relativePath).not.toMatch(/tic-0[12]-/);
    expect(decks[3]!.editorialScenes?.hero?.relativePath).not.toMatch(/tic-0[12]-/);

    // Cero portadas consecutivas repetidas dentro del bloque
    for (let i = 1; i < decks.length; i++) {
      expect(decks[i]!.editorialScenes?.hero?.relativePath).not.toBe(
        decks[i - 1]!.editorialScenes?.hero?.relativePath,
      );
    }
  });

  it('PR 4.2.4 — E2E binario 08 PPTX: verifica en XML/media reales las 12 misiones CD1 (0 protoboards en no-hardware, Slide 49 conserva 2.ª oración y 15.0.)', async () => {
    const sceneLoader = createNodeSceneLoader();
    const realMissionTopicsByBlock: Record<number, string[]> = {
      1: [
        'Introducción al hardware y software',
        'Práctica y Aplicación — Historia crítica del desarrollo de tecnología digital',
        'Proyecto Integrador — Sistemas operativos',
        'Evaluación y Cierre — Corporaciones de innovación',
      ],
      2: [
        'Las 4 libertades',
        'Práctica y Aplicación — Hojas de cálculo',
        'Proyecto Integrador — Privacidad',
        'Evaluación y Cierre — Ciudadanía digital',
      ],
      3: [
        'Pasos para solucionar un problema',
        'Práctica y Aplicación — Diagramas de flujo',
        'Proyecto Integrador — Datos',
        'Evaluación y Cierre — Operadores',
      ],
    };

    // Construir los 3 bloques con los 12 títulos reales de CD1 y el ejemplo real de Slide 49 (B2M2)
    const workbooks = [1, 2, 3].map((b) => {
      const wb = makeCdBlockWorkbook(b);
      const topics = realMissionTopicsByBlock[b]!;
      wb.missions.forEach((m, idx) => {
        m.title = `Misión ${idx + 1}: ${topics[idx]!}`;
        m.sessionTopic = topics[idx]!;
      });
      if (b === 2) {
        // Reproducir exactamente el texto BD de Slide 49 ("Hoja de cálculo") con 15.0. + 2.ª oración
        const s49 = wb.missions[1]!.sessionPlans![0]!;
        s49.objetivo = 'Aplicar fórmulas condicionales en hoja de cálculo.';
        s49.ejemploResuelto =
          'Analizas el registro de horas dedicadas a actividades recreativas y horas de estudio semanal de 5 compañeros.\nPaso 1: Aplica la función PROMEDIO en la celda B7 para las horas recreativas y en la celda C7 para las de estudio.\nPaso 2: Utiliza la función condicional =SI en la celda D7 para valorar automáticamente si el promedio de estudio cumple con la meta establecida.\nResultado: El promedio de horas recreativas es 4.8 y el de estudio es 15.0. La condición lógica indica que el promedio de estudio no supera las 15 horas, lo cual sugiere la necesidad de fomentar más espacios de apoyo académico.';
        s49.sintesisVisual = {
          conceptoBreve:
            'La hoja de cálculo es una herramienta digital que permite organizar, procesar y analizar datos por medio de fórmulas y funciones.',
          formulaOReglaClave: '=SI(condición, valor_si_verdadero, valor_si_falso)',
          ejemploBreve: {
            planteamiento:
              'Analizas el registro de horas dedicadas a actividades recreativas y horas de estudio semanal de 5 compañeros.',
            pasos: [
              'Aplica la función PROMEDIO en la celda B7 para las horas recreativas y en la celda C7 para las de estudio.',
              'Utiliza la función condicional =SI en la celda D7 para valorar automáticamente si el promedio de estudio cumple con la meta establecida.',
            ],
            conclusion: '',
          },
          mapaConceptual: {
            definicionClave:
              'La hoja de cálculo organiza datos en filas y columnas para ejecutar cálculos condicionales automáticos.',
            criterioDesarrollo: 'Verifica las referencias de celda antes de copiar fórmulas.',
            errorComun: 'Referencias circulares o errores de sintaxis en las fórmulas aplicadas.',
            correccionBreve: 'Comprueba paréntesis y rangos de celda en cada fórmula.',
          },
        };
      }
      return wb;
    });

    const allDecks: SacrintDeckSpec[] = [];
    let prevHeroArch:
      | NonNullable<NonNullable<SacrintDeckSpec['editorialScenes']>['hero']>['archetype']
      | undefined;
    let prevHeroId: string | undefined;
    const misconceptionTracker = new Map<string, number>();
    for (const wb of workbooks) {
      const blockDecks = buildSacrintDecksForWorkbook(wb, {
        mode: 'lesson-guide',
        misconceptionTracker,
        previousHeroArchetype: prevHeroArch,
        previousHeroSceneId: prevHeroId,
        ...sceneLoader,
      });
      const lastHero = blockDecks[blockDecks.length - 1]?.editorialScenes?.hero;
      prevHeroArch = lastHero?.archetype ?? prevHeroArch;
      prevHeroId = lastHero?.id ?? prevHeroId;
      allDecks.push(...blockDecks);
    }

    const pptxBuf = await generateCombinedSacrintPptx(allDecks, {
      title: 'Presentación SACRINT CD1 Real',
      subjectName: 'Cultura Digital I',
    });
    const zip = await JSZip.loadAsync(pptxBuf);

    // Precalcular hashes SHA-1 exactos de las 2 escenas protoboard (700x760 y 872x148)
    const ticDir = path.join(
      process.cwd(),
      'public',
      'images',
      'escenas',
      'cultura_digital_programacion_ti',
    );
    const hashCropped = async (file: string, w: number, h: number) => {
      const buf = await sharp(path.join(ticDir, file))
        .resize(w, h, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
      return crypto.createHash('sha1').update(buf).digest('hex');
    };
    const protoboardHashes = new Set([
      await hashCropped('tic-01-portada.webp', 700, 760),
      await hashCropped('tic-02-concepto.webp', 700, 760),
      await hashCropped('tic-01-portada.webp', 872, 148),
      await hashCropped('tic-02-concepto.webp', 872, 148),
    ]);
    const softwareDataHeroHash = await hashCropped('tic-07-software-datos.webp', 700, 760);

    // Auditar CADA portada real en el PPTX descomprimido
    let slideIdx = 1;
    const coverHashes: string[] = [];
    const nonHardwareMissionIndices = new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    let foundSlide49FullConclusion = false;

    for (let mIdx = 0; mIdx < allDecks.length; mIdx++) {
      const deck = allDecks[mIdx]!;
      const relsXml = (await zip.file(`ppt/slides/_rels/slide${slideIdx}.xml.rels`)?.async('string')) ?? '';
      const mediaName = relsXml.match(/Target="\.\.\/media\/([^"]+)"/)?.[1];
      expect(mediaName).toBeTruthy();
      const imgBuf = await zip.file(`ppt/media/${mediaName}`)!.async('nodebuffer');
      const imgHash = crypto.createHash('sha1').update(imgBuf).digest('hex');
      coverHashes.push(imgHash);

      // Las 10 misiones no-hardware (incl. Hojas de cálculo, Privacidad, Ciudadanía digital, Diagramas de flujo, Datos, Operadores)
      // NUNCA pueden llevar protoboard (ni tic-01 ni tic-02) en el PPTX final
      if (nonHardwareMissionIndices.has(mIdx)) {
        expect(protoboardHashes.has(imgHash), `Misión ${mIdx} llevó protoboard en PPTX`).toBe(false);
      }
      // Misión 5 = B2M2 Hojas de cálculo debe usar específicamente tic-07-software-datos.webp
      if (mIdx === 5) {
        expect(imgHash).toBe(softwareDataHeroHash);
        // Verificar la diapositiva de concepto siguiente (equiv. Slide 49) en XML real
        const s49Xml = (await zip.file(`ppt/slides/slide${slideIdx + 1}.xml`)?.async('string')) ?? '';
        const s49Text = [...s49Xml.matchAll(/<a:t>([^<]+)<\/a:t>/g)].map((m) => m[1]).join(' ');
        expect(s49Text).toContain('15.0.');
        expect(s49Text).not.toContain('15.(0)');
        expect(s49Text).toMatch(/La condici[oó]n l[oó]gica/i);
        foundSlide49FullConclusion = true;
      }

      slideIdx += deck.slides.length;
    }

    expect(foundSlide49FullConclusion).toBe(true);
    // Cero portadas consecutivas repetidas en las 12 misiones del PPTX real
    for (let i = 1; i < coverHashes.length; i++) {
      expect(coverHashes[i]).not.toBe(coverHashes[i - 1]);
    }
  }, 45000);

  it('PR 4.2.4 — E2E binario 09 PDF: valida p18 contextualizada (sin duplicar p22), p39, p40 (Representación gráfica y tabular), p50 (Estructuras condicionales) y 0 títulos duplicados en el PDF real', async () => {
    const sceneLoader = createNodeSceneLoader();
    const wbB2 = makeCdBlockWorkbook(2);
    // p18 B2M1: Fundamentos de la ciudadanía digital + cuerpo de cuatro libertades
    wbB2.missions[0]!.sessionTopic = 'Fundamentos de la ciudadanía digital';
    wbB2.missions[0]!.sessionPlans![0]!.objetivo = 'Comprenderás los fundamentos de la ciudadanía digital.';
    wbB2.missions[0]!.sessionPlans![0]!.sintesisVisual!.conceptoBreve =
      'Las cuatro libertades del software libre garantizan que tú mantengas el control total sobre tus herramientas digitales.';
    // p22 B2M2: Cuatro libertades del software libre
    wbB2.missions[1]!.sessionTopic = 'Cuatro libertades del software libre';
    wbB2.missions[1]!.sessionPlans![0]!.objetivo = 'Aplicarás las cuatro libertades del software libre.';
    wbB2.missions[1]!.sessionPlans![0]!.sintesisVisual!.conceptoBreve =
      'Las cuatro libertades del software libre garantizan que el usuario tenga control total sobre su tecnología.';
    // p23 B2M2: Socialización sobre herramientas digitales y GNU/Linux
    wbB2.missions[1]!.sessionPlans![1]!.objetivo =
      'Socializarás tu investigación sobre herramientas digitales y GNU/Linux.';
    wbB2.missions[1]!.sessionPlans![1]!.sintesisVisual!.conceptoBreve =
      'La socialización de hallazgos es el proceso de comunicar propuestas tecnológicas fundamentadas sobre GNU/Linux.';

    const wbB3 = makeCdBlockWorkbook(3);
    // p39 B3M2 S05: Pasos fundamentales → Resolución de problemas
    wbB3.missions[1]!.sessionTopic = 'Pasos fundamentales';
    wbB3.missions[1]!.sessionPlans![0]!.objetivo =
      'Emplearás los pasos esenciales para la resolución de problemas.';
    wbB3.missions[1]!.sessionPlans![0]!.sintesisVisual!.conceptoBreve =
      'La resolución de problemas es un proceso sistemático que implica identificar variables y diseñar una estrategia lógica.';
    // p40 B3M2 S06: reproduce el caso real donde "basada en evidencia" hace que resolveInfographicConceptTitle
    // herede "Diagramas de flujo" de la misión, mientras el objetivo y el cuerpo tratan de "Representación gráfica y tabular"
    const wbB3M2Diag = makeCdBlockWorkbook(3);
    wbB3M2Diag.missions[1]!.sessionTopic = 'Diagramas de flujo';
    wbB3M2Diag.missions[1]!.sessionPlans![1]!.contenido =
      'Definición: Diagramas de flujo y representación de datos en tablas y gráficos.';
    wbB3M2Diag.missions[1]!.sessionPlans![1]!.objetivo =
      'Representarás información por medio de herramientas gráficas y tabulares para tomar decisiones basadas en evidencia.';
    wbB3M2Diag.missions[1]!.sessionPlans![1]!.sintesisVisual!.conceptoBreve =
      'La representación gráfica y tabular es el proceso de organizar datos en tablas y visualizarlos por medio de gráficos para facilitar la interpretación.';
    wbB3M2Diag.missions[1]!.sessionPlans![1]!.sintesisVisual!.formulaOReglaClave =
      'Datos Crudos → Tabla Comparativa → Gráfico (Barras/Líneas) → Interpretación';
    // p50 B3M4: Contraste de Métodos y Verificación de Resultados — Operadores → Estructuras condicionales
    wbB3.missions[3]!.sessionTopic = 'Contraste de Métodos y Verificación de Resultados — Operadores';
    wbB3.missions[3]!.sessionPlans![0]!.objetivo =
      'Evaluarás el contraste de métodos y verificación de resultados.';
    wbB3.missions[3]!.sessionPlans![0]!.sintesisVisual!.conceptoBreve =
      'Las estructuras condicionales posibilitan tomar decisiones lógicas basadas en datos verificables.';

    const rawSpecs = [
      buildSacrintInfographic(wbB2, 'wide', { missionIndex: 0, sessionIndex: 0, ...sceneLoader }),
      buildSacrintInfographic(wbB2, 'wide', { missionIndex: 1, sessionIndex: 0, ...sceneLoader }),
      buildSacrintInfographic(wbB2, 'wide', { missionIndex: 1, sessionIndex: 1, ...sceneLoader }),
      buildSacrintInfographic(wbB3, 'wide', { missionIndex: 1, sessionIndex: 0, ...sceneLoader }),
      buildSacrintInfographic(wbB3M2Diag, 'wide', { missionIndex: 1, sessionIndex: 1, ...sceneLoader }),
      buildSacrintInfographic(wbB3, 'wide', { missionIndex: 3, sessionIndex: 0, ...sceneLoader }),
    ];
    const deduped = dedupeInfographicSpecs(rawSpecs);
    expect(deduped).toHaveLength(6);

    const titles = deduped.map((s) => s.title);
    // 0 títulos duplicados en todo el lote
    expect(new Set(titles.map((t) => t.toLowerCase())).size).toBe(6);
    expect(titles[0]).toMatch(/fundamentos\s+de\s+ciudadan[ií]a\s+digital:\s+cuatro\s+libertades/i);
    expect(titles[1]).toMatch(/^cuatro\s+libertades\s+del\s+software\s+libre$/i);
    expect(titles[2]).toMatch(/socializaci[oó]n\s+de\s+hallazgos:.*gnu\/linux/i);
    expect(titles[3]).toMatch(/resoluci[oó]n\s+de\s+problemas/i);
    expect(titles[4]).toMatch(/representaci[oó]n\s+gr[aá]fica\s+y\s+tabular/i);
    expect(titles[4]).not.toMatch(/diagramas?\s+de\s+flujo/i);
    expect(titles[5]).toMatch(/estructuras\s+condicionales/i);

    // Compilar el PDF vectorial combinado real y verificar sus 6 páginas
    const pdfBuf = await renderCombinedSacrintInfographicsPdf(deduped, 'wide');
    expect(pdfBuf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const pageDefs = pdfBuf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) ?? [];
    expect(pageDefs.length).toBe(6);
  }, 30000);
});
