/**
 * editorial-v2-enricher.ts — Enriquecedor V2 para el Motor Editorial Unificado (`PUBLISHING_ENGINE_V2`)
 * SIGPDA-EMS · Fase 3 (Paridad Funcional Total ActiveWorkTextbook → Typst)
 *
 * Responsabilidades deterministas (0 tokens de IA, 0 llamadas HTTP externas):
 * 1. Inyecta diagramas SVG STEM puros (`dispatchVisual`) en la sesión inicial de cada misión cuando aplica.
 * 2. Genera códigos QR deterministas en SVG (`QRCode.toString(..., { type: 'svg' })`) para herramientas
 *    digitales homologadas del MCCEMS (`resolveDigitalToolsForMission`).
 * 3. Adjunta espacios de Cuaderno Activo (`writing_lines` / `data_table` / `code_box`) adaptados al
 *    perfil epistemológico de los 17 dominios (`getDisciplinaryAdapter`).
 */

import QRCode from 'qrcode';
import { getDisciplinaryAdapter } from '@/lib/prompts/disciplinary-adapters';
import { dispatchVisual, isDigitalCultureSubject } from '@/lib/visual-engine/visual-dispatcher';
import { resolveDigitalToolsForMission } from '@/lib/visual-engine/digital-tools-registry';
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

/**
 * Inyecta `VisualAnnotation[]` como `<text>` vectoriales dentro del `<svg>` para Typst 0.15.1
 * (Typst cuenta con fuentes nativas Inter / Liberation Sans, a diferencia de librsvg en jsPDF).
 * No modifica los generadores base ni afecta a jsPDF.
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
    .map((a) => {
      const anchor =
        a.align === 'center' ? 'middle' : a.align === 'end' ? 'end' : 'start';
      const weight = a.bold ? '700' : '400';
      const fill = a.color || '#1e293b';
      const size = Number.isFinite(a.fontSize) ? Math.max(6, Math.min(20, a.fontSize)) : 9;
      return `<text x="${a.svgX}" y="${a.svgY}" font-family="Inter, Liberation Sans, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXmlText(a.text.trim())}</text>`;
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
 * Enriquece determinísticamente un arreglo de sesiones V2 con diagramas SVG STEM,
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
      const visual = dispatchVisual(
        uacName,
        mission?.title || session.titulo,
        `${session.objetivo} ${session.motivacion}`,
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
        const captionText =
          visual.annotations?.find((a) => typeof a.text === 'string' && a.text.trim().length > 3)?.text ||
          mission?.title ||
          session.titulo;
        embeddedDiagram = {
          title: `Esquema Técnico · ${mission?.title || session.titulo}`.slice(0, 120),
          caption: captionText,
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
