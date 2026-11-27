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
  /^(?:pr[aá]ctica\s+y\s+aplicaci[oó]n|aplicaci[oó]n\s+pr[aá]ctica(?:\s+en\s+situaciones\s+contextuales)?|proyecto\s+integrador|evaluaci[oó]n\s+y\s+cierre|exploraci[oó]n\s+diagn[oó]stica(?:\s+y\s+problematizaci[oó]n\s+situada)?|fundamentaci[oó]n\s+y\s+activaci[oó]n|tema\s+de\s+la\s+misi[oó]n)$/i;

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
  if (objectiveConcept && objectiveConcept.length >= 10 && !GENERIC_MISSION_SCAFFOLDING_RE.test(objectiveConcept)) {
    return objectiveConcept;
  }
  return sidenoteConcept || missionCandidate || sessionTitleCandidate || 'Desarrollo temático';
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
 * Inyecta `VisualAnnotation[]` como `<text>` vectoriales dentro del `<svg>` para Typst 0.15.1
 * (Typst cuenta con fuentes nativas Inter / Liberation Sans, a diferencia de librsvg en jsPDF).
 * Ajusta el tamaño del título cuando supera 48 caracteres para evitar recortes laterales en 500px.
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
      let size = Number.isFinite(a.fontSize) ? Math.max(6, Math.min(20, a.fontSize)) : 9;
      // Escala defensiva del título superior (idx === 0) para mantenerlo 100% dentro del viewBox
      if (idx === 0 && a.svgY <= 28) {
        if (text.length > 64) size = Math.min(size, 8.2);
        else if (text.length > 50) size = Math.min(size, 9.2);
      }
      return `<text x="${a.svgX}" y="${a.svgY}" font-family="Inter, Liberation Sans, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXmlText(text)}</text>`;
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
