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
import { dispatchVisual } from '@/lib/visual-engine/visual-dispatcher';
import { resolveDigitalToolsForMission } from '@/lib/visual-engine/digital-tools-registry';
import type {
  ActiveSpaceItem,
  DigitalToolQr,
  EmbeddedDiagram,
  StudentMissionFraming,
  StudentSession,
} from './student-content-model';

const qrSvgCache = new Map<string, string>();

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
        mission ? mission.missionIndex - 1 : 0,
      );
      if (visual?.svg && visual.svg.includes('<svg')) {
        const captionText =
          visual.annotations?.find((a) => typeof a.text === 'string' && a.text.trim().length > 3)?.text ||
          mission?.title ||
          session.titulo;
        embeddedDiagram = {
          title: `Esquema Técnico · ${mission?.title || session.titulo}`.slice(0, 120),
          caption: captionText,
          svg: visual.svg,
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
