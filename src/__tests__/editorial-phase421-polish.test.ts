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
import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import { enrichEditorialSessionsV2 } from '@/lib/editorial/editorial-v2-enricher';
import type { StudentMissionFraming, StudentSession } from '@/lib/editorial/student-content-model';
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
});
