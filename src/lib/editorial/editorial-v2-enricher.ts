/**
 * editorial-v2-enricher.ts — Enriquecedor V2 para el Motor Editorial Unificado (`PUBLISHING_ENGINE_V2`)
 * SIGPDA-EMS · Fase 3 + PR 4.2.1 (Pulido Editorial de Esquemas Técnicos en 06)
 *
 * Responsabilidades deterministas (0 tokens de IA, 0 llamadas HTTP externas):
 * 1. Inyecta diagramas SVG disciplinares (`dispatchVisual`) en la sesión inicial de cada misión
 *    alimentados con el contexto real completo de la misión (contenido, ejemplo resuelto y sesiones).
 * 2. Genera códigos QR deterministas en SVG (`QRCode.toString(..., { type: 'svg' })`) para herramientas
 *    digitales homologadas del MCCEMS (`resolveDigitalToolsForMission`).
 * 3. Adjunta espacios de Cuaderno Activo (`writing_lines` / `data_table` / `code_box`) adaptados al
 *    perfil epistemológico de los 17 dominios (`getDisciplinaryAdapter`).
 */

import QRCode from 'qrcode';
import { getDisciplinaryAdapter } from '@/lib/prompts/disciplinary-adapters';
import {
  cleanTopicForDiagram,
  dispatchVisual,
  isDigitalCultureSubject,
} from '@/lib/visual-engine/visual-dispatcher';
import { resolveDigitalToolsForMission } from '@/lib/visual-engine/digital-tools-registry';
import { extractDisciplinaryConceptPhrase } from '@/lib/editorial/topic-title-resolver';
import type { VisualAnnotation } from '@/lib/visual-engine/generators/stem-generator';
import { normalizeUnicode } from '@/lib/utils/normalize';
import type {
  ActiveSpaceItem,
  DigitalToolQr,
  EmbeddedDiagram,
  StudentMissionFraming,
  StudentSession,
} from './student-content-model';

const qrSvgCache = new Map<string, string>();

const CARTESIAN_ALLOWED_SUBJECT_RE =
  /\b(?:pensamiento\s+matematico|matematic\w*|calculo|algebra|geometria|trigonometria|estadistica|probabilidad|pensamiento\s+variacional|fisica|fenomenos\s+fisicos|quimica|reacciones\s+quimicas|materia\s+y\s+sus\s+interacciones|conservacion\s+de\s+la\s+energia)\b/i;

function isCartesianAllowedSubject(uacName: string): boolean {
  if (isDigitalCultureSubject(uacName)) return false;
  const norm = normalizeUnicode(uacName);
  if (/\b(?:deport\w*|educacion\s+fisica|actividades\s+fisicas|cuidado\s+fisico)\b/i.test(norm)) {
    return false;
  }
  return CARTESIAN_ALLOWED_SUBJECT_RE.test(norm);
}

function escapeXmlText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const GENERIC_MISSION_SCAFFOLDING_RE =
  /^(?:pr[aá]ctica\s+y\s+aplicaci[oó]n|aplicaci[oó]n\s+pr[aá]ctica(?:\s+en\s+situaciones\s+contextuales)?|proyecto\s+integrador|evaluaci[oó]n\s+y\s+cierre|cierre\s+y\s+evaluaci[oó]n|exploraci[oó]n\s+diagn[oó]stica(?:\s+y\s+problematizaci[oó]n\s+situada)?|apertura\s+y\s+diagn[oó]stico|fundamentaci[oó]n\s+y\s+activaci[oó]n|modelado\s+metodol[oó]gico|contraste\s+de\s+m[eé]todos|s[ií]ntesis\s+y\s+transferencia|demostraci[oó]n\s+guiada|tema\s+de\s+la\s+misi[oó]n)$/i;

/**
 * Limpia prefijos/sufijos redundantes ("Misión 1:", "Sesión 3:", "(Misión 1)", listas de
 * asignaturas entre paréntesis, andamiajes genéricos, paréntesis desbalanceados y preposiciones
 * colgantes como "al", "de", "y") y trunca estrictamente en frontera de palabra.
 */
export function cleanEditorialDiagramTopic(raw: string, maxChars = 96): string {
  const cleaned = cleanTopicForDiagram(raw, maxChars);
  return cleaned === 'Tema de la Misión' ? '' : cleaned;
}

/**
 * Resuelve el tema disciplinar real del diagrama priorizando el concepto real de la sesión
 * cuando el título de la misión es solo andamiaje genérico ("Práctica y Aplicación (Cultura...)",
 * "Proyecto Integrador — Sesión 10", "Evaluación y Cierre — Sesión 16").
 */
function resolveSpecificDiagramTopic(
  session: StudentSession,
  mission?: StudentMissionFraming,
): string {
  const missionCandidate = cleanEditorialDiagramTopic(mission?.title || '', 96);
  const sessionTitleCandidate = cleanEditorialDiagramTopic(session.titulo || '', 96);
  const objectiveConcept = cleanEditorialDiagramTopic(
    extractDisciplinaryConceptPhrase(session.objetivo || '') || session.objetivo || '',
    96,
  );
  const sidenoteConcept = cleanEditorialDiagramTopic(
    (session.sidenote || '').split(/[.?!]/)[0] || '',
    80,
  );

  if (missionCandidate && missionCandidate.length >= 10 && !GENERIC_MISSION_SCAFFOLDING_RE.test(missionCandidate)) {
    return missionCandidate;
  }
  if (sessionTitleCandidate && sessionTitleCandidate.length >= 10 && !GENERIC_MISSION_SCAFFOLDING_RE.test(sessionTitleCandidate)) {
    return sessionTitleCandidate;
  }
  if (objectiveConcept && objectiveConcept.length >= 5 && !GENERIC_MISSION_SCAFFOLDING_RE.test(objectiveConcept)) {
    return objectiveConcept;
  }
  if (sidenoteConcept && sidenoteConcept.length >= 5 && !GENERIC_MISSION_SCAFFOLDING_RE.test(sidenoteConcept)) {
    return sidenoteConcept;
  }
  return objectiveConcept || sidenoteConcept || missionCandidate || sessionTitleCandidate || 'Desarrollo temático';
}

/**
 * Construye el encabezado del bloque de diagrama sin punto medio colgante ("·") ni paréntesis rotos.
 */
function buildDiagramBlockHeader(cleanTopic: string): string {
  return ['Esquema Técnico', cleanEditorialDiagramTopic(cleanTopic, 96)].filter(Boolean).join(' · ');
}

/**
 * Construye una leyenda pedagógica distinta al título interno del SVG (evita duplicación literal).
 */
function buildDistinctDiagramCaption(params: {
  diagramType?: string;
  cleanTopic: string;
  missionNumber?: number;
  svgTitle?: string;
  objective?: string;
}): string {
  const topicLower = params.cleanTopic
    ? params.cleanTopic.charAt(0).toLowerCase() + params.cleanTopic.slice(1)
    : 'los conceptos clave de la misión';
  const prefix = params.missionNumber ? `Misión ${params.missionNumber} · ` : '';

  let candidate: string;
  switch (params.diagramType) {
    case 'digital_concept_map':
      candidate = `${prefix}Red conceptual de relaciones clave para analizar ${topicLower}.`;
      break;
    case 'digital_block_diagram':
      candidate = `${prefix}Arquitectura funcional por capas (entrada, proceso, control y salida) aplicada a ${topicLower}.`;
      break;
    case 'digital_technical_flow':
      candidate = `${prefix}Secuencia operativa paso a paso con puntos de verificación de calidad sobre ${topicLower}.`;
      break;
    default: {
      const objClean = cleanEditorialDiagramTopic(params.objective || '', 110);
      candidate =
        objClean && objClean.length >= 20
          ? `${prefix}Apoyo visual del tema: ${objClean}.`
          : `${prefix}Representación gráfica de apoyo didáctico sobre ${topicLower}.`;
      break;
    }
  }

  // Garantizar que el pie de figura jamás repita textualmente el título interno del SVG
  if (
    params.svgTitle &&
    normalizeUnicode(candidate) === normalizeUnicode(params.svgTitle)
  ) {
    return `${prefix}Síntesis visual de referencia para trabajar ${topicLower}.`;
  }
  return candidate;
}

/**
 * Construye contexto textual enriquecido de toda la misión (sesión actual + sesiones hermanas,
 * definiciones, pasos del ejemplo resuelto y sidenote) para evitar diagramas genéricos de fallback.
 */
function buildMissionVisualContext(
  session: StudentSession,
  mission: StudentMissionFraming | undefined,
  allSessions: StudentSession[],
): string {
  const lines: string[] = [];
  if (mission?.title) lines.push(mission.title);
  if (mission?.realLifeContext) lines.push(mission.realLifeContext);
  if (session.objetivo) lines.push(session.objetivo);
  if (session.motivacion) lines.push(session.motivacion);
  if (session.sidenote) lines.push(`Concepto clave: ${session.sidenote}`);

  for (const bloque of session.contenido ?? []) {
    if (bloque.tipo === 'definicion' && bloque.titulo && bloque.texto) {
      lines.push(`${bloque.titulo}: ${bloque.texto}`);
    } else if (bloque.texto) {
      lines.push(bloque.texto);
    }
  }

  if (session.ejemploResuelto?.enunciado) {
    lines.push(session.ejemploResuelto.enunciado);
  }
  if (Array.isArray(session.ejemploResuelto?.pasos)) {
    session.ejemploResuelto.pasos.forEach((paso, idx) => {
      if (paso?.trim()) lines.push(`Paso ${idx + 1}: ${paso.trim()}`);
    });
  }
  if (session.aplicacion) lines.push(session.aplicacion);

  if (mission) {
    const siblingSessions = allSessions.filter(
      (s) =>
        s.numero !== session.numero &&
        s.numero >= mission.startSession &&
        s.numero <= mission.endSession,
    );
    for (const sib of siblingSessions.slice(0, 4)) {
      const cleanSibTitle = cleanEditorialDiagramTopic(sib.titulo, 72);
      if (cleanSibTitle && sib.objetivo) {
        lines.push(`${cleanSibTitle}: ${sib.objetivo}`);
      } else if (sib.objetivo) {
        lines.push(sib.objetivo);
      }
    }
  }

  return lines.filter(Boolean).join('\n');
}

/**
 * Estima conservadoramente el ancho de una cadena en unidades SVG para Inter / Liberation Sans.
 * Incluye un margen de seguridad del 6 % para garantizar que ningún carácter se recorte ni toque bordes
 * tanto en Typst 0.15.1 como en `@resvg/resvg-js`.
 */
export function estimateSvgTextWidth(
  text: string,
  fontSize: number,
  bold = false,
): number {
  let units = 0;
  for (const ch of text) {
    if (ch === ' ') units += 0.28;
    else if ('ilIjtfr1.,:;\'|!¡'.includes(ch)) units += 0.32;
    else if ('WM@%'.includes(ch)) units += 0.92;
    else if ('mw'.includes(ch)) units += 0.82;
    else if (/[A-ZÁÉÍÓÚÜÑ]/.test(ch)) units += bold ? 0.74 : 0.7;
    else if (/[0-9]/.test(ch)) units += 0.6;
    else if (/[a-záéíóúüñ]/.test(ch)) units += bold ? 0.58 : 0.55;
    else units += 0.58;
  }
  return units * fontSize * 1.06;
}

function wrapWordsToMaxWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  bold: boolean,
  maxLines: number,
): { lines: string[]; fits: boolean } {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [''], fits: true };
  if (estimateSvgTextWidth(text, fontSize, bold) <= maxWidth) {
    return { lines: [text], fits: true };
  }
  if (maxLines <= 1 || words.length === 1) {
    return { lines: [text], fits: false };
  }

  // Para 2 líneas, buscar la partición por palabra más equilibrada visualmente
  if (maxLines === 2) {
    let bestPair: [string, string] | null = null;
    let bestMaxW = Number.POSITIVE_INFINITY;
    for (let split = 1; split < words.length; split++) {
      const left = words.slice(0, split).join(' ');
      const right = words.slice(split).join(' ');
      const wL = estimateSvgTextWidth(left, fontSize, bold);
      const wR = estimateSvgTextWidth(right, fontSize, bold);
      const worst = Math.max(wL, wR);
      if (worst < bestMaxW) {
        bestMaxW = worst;
        bestPair = [left, right];
      }
    }
    if (bestPair && bestMaxW <= maxWidth) {
      return { lines: bestPair, fits: true };
    }
  }

  // Envoltura voraz multilínea respetando fronteras de palabra
  const lines: string[] = [];
  let current = words[0];
  let allFit = estimateSvgTextWidth(current, fontSize, bold) <= maxWidth;

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (estimateSvgTextWidth(candidate, fontSize, bold) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (estimateSvgTextWidth(current, fontSize, bold) > maxWidth) {
        allFit = false;
      }
    }
  }
  lines.push(current);

  return { lines, fits: allFit && lines.length <= maxLines };
}

/**
 * Calcula las líneas y el `fontSize` final para una `VisualAnnotation`, garantizando que
 * cada línea quepa dentro de `maxWidth` en `<= maxLines` líneas sin desbordar ni recortar caracteres.
 */
export function layoutAnnotationText(
  text: string,
  baseSize: number,
  bold: boolean,
  maxWidth?: number,
  maxLines = 1,
): { lines: string[]; fontSize: number } {
  if (!maxWidth || maxWidth <= 0) {
    return { lines: [text], fontSize: baseSize };
  }

  const safeMaxLines = Math.max(1, maxLines);
  const minSize = Math.max(4.4, baseSize * 0.62);

  if (safeMaxLines === 1) {
    const est = estimateSvgTextWidth(text, baseSize, bold);
    if (est <= maxWidth) return { lines: [text], fontSize: baseSize };
    const fitted = Math.max(minSize, baseSize * (maxWidth / est));
    return { lines: [text], fontSize: Number(fitted.toFixed(2)) };
  }

  let size = baseSize;
  for (let step = 0; step < 12; step++) {
    const attempt = wrapWordsToMaxWidth(text, maxWidth, size, bold, safeMaxLines);
    if (attempt.fits) {
      return { lines: attempt.lines, fontSize: Number(size.toFixed(2)) };
    }
    const nextSize = size * 0.92;
    if (nextSize < minSize) {
      size = minSize;
      break;
    }
    size = nextSize;
  }

  // Último ajuste proporcional a la línea más ancha tras envolver en <= safeMaxLines
  const finalAttempt = wrapWordsToMaxWidth(text, maxWidth, size, bold, safeMaxLines);
  let lines = finalAttempt.lines;
  if (lines.length > safeMaxLines) {
    // Reagrupar todas las palabras en exactamente safeMaxLines líneas equilibradas y escalar fontSize
    const words = text.split(/\s+/).filter(Boolean);
    const chunkSize = Math.ceil(words.length / safeMaxLines);
    lines = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      lines.push(words.slice(i, i + chunkSize).join(' '));
    }
  }
  const maxLineW = Math.max(...lines.map((l) => estimateSvgTextWidth(l, size, bold)), 1);
  if (maxLineW > maxWidth) {
    size = Math.max(4.0, size * (maxWidth / maxLineW));
  }
  return { lines, fontSize: Number(size.toFixed(2)) };
}

/**
 * Inyecta `VisualAnnotation[]` como `<text>` (y `<tspan>` multilínea cuando se define `maxWidth`/`maxLines`)
 * dentro del `<svg>` tanto para Typst 0.15.1 como para `@resvg/resvg-js` (DOCX V2).
 * Garantiza ajuste geométrico estricto sin recortes laterales ni superposiciones.
 */
export function embedAnnotationsIntoSvg(
  svg: string,
  annotations?: VisualAnnotation[],
): string {
  if (!annotations || annotations.length === 0 || !svg.includes('</svg>')) {
    return svg;
  }
  const textNodes = annotations
    .filter((a) => typeof a.text === 'string' && a.text.trim().length > 0)
    .map((a, idx) => {
      const text = a.text.trim();
      const anchor =
        a.align === 'center' ? 'middle' : a.align === 'end' ? 'end' : 'start';
      const weight = a.bold ? '700' : '400';
      const fill = a.color || '#1e293b';
      const baseSize = Number.isFinite(a.fontSize) ? Math.max(4.5, Math.min(20, a.fontSize)) : 9;
      // Título superior siempre protegido contra desborde del viewBox 500px
      const effectiveMaxWidth =
        a.maxWidth ?? (idx === 0 && a.svgY <= 28 ? 468 : undefined);
      const effectiveMaxLines = a.maxLines ?? 1;
      const { lines, fontSize } = layoutAnnotationText(
        text,
        baseSize,
        Boolean(a.bold),
        effectiveMaxWidth,
        effectiveMaxLines,
      );

      const x = Number(a.svgX.toFixed(2));
      if (lines.length <= 1) {
        const y = Number(a.svgY.toFixed(2));
        return `<text x="${x}" y="${y}" font-family="Inter, Liberation Sans, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXmlText(lines[0] ?? text)}</text>`;
      }

      const stepY = fontSize * (a.lineHeight ?? 1.24);
      const startY =
        a.valign === 'middle'
          ? a.svgY - ((lines.length - 1) * stepY) / 2
          : a.svgY;
      const firstY = Number(startY.toFixed(2));
      const tspans = lines
        .map((line, lIdx) => {
          const ly = Number((startY + lIdx * stepY).toFixed(2));
          return `<tspan x="${x}" y="${ly}">${escapeXmlText(line)}</tspan>`;
        })
        .join('');
      return `<text x="${x}" y="${firstY}" font-family="Inter, Liberation Sans, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${tspans}</text>`;
    })
    .join('\n');

  if (!textNodes) return svg;
  const idx = svg.lastIndexOf('</svg>');
  return `${svg.slice(0, idx)}\n${textNodes}\n</svg>`;
}

/**
 * Genera un QR vectorial SVG determinista en memoria (sin red ni archivos temporales).
 */
export async function generateDeterministicQrSvg(url: string): Promise<string> {
  const normalized = url.trim();
  const cached = qrSvgCache.get(normalized);
  if (cached) return cached;

  const svg = await QRCode.toString(normalized, {
    type: 'svg',
    margin: 1,
    width: 96,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f294a',
      light: '#ffffff',
    },
  });
  qrSvgCache.set(normalized, svg);
  return svg;
}

/**
 * Deriva espacios de Cuaderno Activo coherentes con la disciplina para una sesión:
 * - Cultura Digital / TI → `code_box` + `writing_lines`
 * - Familias cuantitativas/experimentales/laborales → `data_table` (usando `defaultTableColumns` del adapter)
 * - Humanidades / Literatura / Idiomas / Socioemocional → `writing_lines` guiado
 */
export function buildActiveSpacesForSession(
  uacName: string,
  session: StudentSession,
): ActiveSpaceItem[] {
  const adapter = getDisciplinaryAdapter(uacName);
  const spaces: ActiveSpaceItem[] = [];

  if (adapter.family === 'computacional_algoritmica') {
    spaces.push({
      kind: 'code_box',
      title: `Espacio de Algoritmo / Código — Sesión ${session.numero}`,
      language: 'pseudocodigo',
      starterCode: '// Define entradas, proceso y salida esperada para el ejercicio',
    });
  } else if (
    adapter.requiresQuantitativeData ||
    adapter.family === 'cuantitativa_experimental' ||
    adapter.family === 'tecnica_laboral'
  ) {
    const headers =
      Array.isArray(adapter.defaultTableColumns) && adapter.defaultTableColumns.length >= 2
        ? adapter.defaultTableColumns.slice(0, 4)
        : ['Variable / Dato', 'Procedimiento', 'Resultado'];
    spaces.push({
      kind: 'data_table',
      title: `Tabla de Registro y Análisis — Sesión ${session.numero}`,
      headers,
      rows: 3,
    });
  }

  spaces.push({
    kind: 'writing_lines',
    title: `Tu Desarrollo y Conclusión — Sesión ${session.numero}`,
    lines: spaces.length > 0 ? 3 : 4,
  });

  return spaces;
}

/**
 * Enriquece determinísticamente un arreglo de sesiones V2 con diagramas SVG disciplinares,
 * códigos QR vectoriales de herramientas digitales MCCEMS y espacios de Cuaderno Activo.
 */
export async function enrichEditorialSessionsV2(params: {
  uacName: string;
  sessions: StudentSession[];
  missions?: StudentMissionFraming[];
}): Promise<StudentSession[]> {
  const { uacName, sessions, missions = [] } = params;
  const missionStartMap = new Map<number, StudentMissionFraming>();
  for (const m of missions) {
    missionStartMap.set(m.startSession, m);
  }

  const enriched: StudentSession[] = [];
  for (const session of sessions) {
    const mission = missionStartMap.get(session.numero);
    const shouldAttachVisual = Boolean(mission) || session.numero === 1;

    let embeddedDiagram: EmbeddedDiagram | undefined = session.embeddedDiagram;
    if (!embeddedDiagram && shouldAttachVisual) {
      const cleanTopic = resolveSpecificDiagramTopic(session, mission);
      const richContext = buildMissionVisualContext(session, mission, sessions);

      const visual = dispatchVisual(
        uacName,
        cleanTopic,
        richContext,
        mission ? mission.missionIndex : 1,
      );
      const isCartesianDiagram =
        visual?.metadata?.type === 'stem-cartesian-plane' ||
        Boolean(
          visual?.annotations?.some(
            (a) => typeof a.text === 'string' && /plano\s+cartesiano/i.test(a.text),
          ),
        );
      if (isCartesianDiagram && !isCartesianAllowedSubject(uacName)) {
        // Guard defensivo P0: jamás inyectar Plano Cartesiano en asignaturas no matemático-físico-químicas
      } else if (visual?.svg && visual.svg.includes('<svg')) {
        const svgTitle = visual.annotations?.[0]?.text?.trim();
        embeddedDiagram = {
          title: buildDiagramBlockHeader(cleanTopic),
          caption: buildDistinctDiagramCaption({
            diagramType: visual.metadata?.type,
            cleanTopic,
            missionNumber: mission ? mission.missionIndex : 1,
            svgTitle,
            objective: session.objetivo,
          }),
          svg: embedAnnotationsIntoSvg(visual.svg, visual.annotations),
        };
      }
    }

    let digitalToolQr: DigitalToolQr | undefined = session.digitalToolQr;
    if (!digitalToolQr && shouldAttachVisual) {
      const tool = resolveDigitalToolsForMission(
        uacName,
        mission?.title || session.titulo,
        `${session.objetivo} ${session.aplicacion}`,
      );
      if (tool) {
        try {
          const qrSvg = await generateDeterministicQrSvg(tool.url);
          digitalToolQr = {
            name: tool.name,
            url: tool.url,
            description: tool.description,
            svg: qrSvg,
          };
        } catch {
          // Omitir QR si falla generación sin bloquear la exportación
        }
      }
    }

    const activeSpaces =
      session.activeSpaces && session.activeSpaces.length > 0
        ? session.activeSpaces
        : buildActiveSpacesForSession(uacName, session);

    enriched.push({
      ...session,
      ...(embeddedDiagram ? { embeddedDiagram } : {}),
      ...(digitalToolQr ? { digitalToolQr } : {}),
      activeSpaces,
    });
  }

  return enriched;
}
