/**
 * Mermaid Diagram Renderer with Structured Table Fallback
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Renderiza diagramas de flujo y arquitectura Mermaid para libros de trabajo:
 * 1. Intento primario: Renderizado a PNG mediante Kroki API (timeout 5s).
 * 2. Fallback resiliente: Conversión sintáctica a tabla de flujo estructurada
 *    directamente insertable en tablas nativas de DOCX y jspdf-autotable en PDF.
 */

import zlib from 'zlib';

export interface RenderedDiagram {
  type: 'image' | 'structured-table';
  imageData?: Buffer; // PNG binario
  tableData?: {
    headers?: string[];
    cells: string[][];
    arrows: string[];
  };
  width: number;
  height: number;
}

/**
 * Renderiza un diagrama Mermaid a imagen PNG (vía Kroki) o tabla estructurada de contingencia.
 */
export async function renderMermaidDiagram(
  mermaidCode: string,
  options: { timeoutMs?: number; title?: string } = {}
): Promise<RenderedDiagram> {
  const timeoutMs = options.timeoutMs || 5000;
  const cleanCode = mermaidCode.trim();

  // 1. Intentar renderizar vía Kroki API (POST a https://kroki.io/mermaid/png o GET base64)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Intento A: POST directo con text/plain
    let response = await fetch('https://kroki.io/mermaid/png', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'image/png',
      },
      body: cleanCode,
      signal: controller.signal,
    }).catch(() => null);

    // Intento B: Si POST no responde ok, cancelar body e intentar GET con base64 deflated (estándar Kroki GET)
    if (!response || !response.ok) {
      if (response) {
        await response.body?.cancel().catch(() => {});
        response = null;
      }
      try {
        const deflated = zlib.deflateSync(Buffer.from(cleanCode, 'utf8'));
        const base64Url = deflated.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
        response = await fetch(`https://kroki.io/mermaid/png/${base64Url}`, {
          method: 'GET',
          headers: { Accept: 'image/png' },
          signal: controller.signal,
        }).catch(() => null);
      } catch {
        // Fallback
      }
    }

    clearTimeout(timer);

    if (response && !response.ok) {
      await response.body?.cancel().catch(() => {});
      response = null;
    }

    if (response && response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('image/png')) {
        console.warn('[Mermaid] Kroki returned non-PNG content:', contentType);
        await response.body?.cancel().catch(() => {});
        const parsedTable = parseMermaidToFlowTable(cleanCode, options.title);
        return {
          type: 'structured-table',
          tableData: parsedTable,
          width: 800,
          height: 400,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        type: 'image',
        imageData: buffer,
        width: 800,
        height: 500,
      };
    }
  } catch (err) {
    console.warn('[renderMermaidDiagram] Kroki API no disponible o timeout; usando fallback a tabla estructurada:', err);
  }

  // 2. Fallback: Parseo determinista a tabla de flujo estructurada
  const parsedTable = parseMermaidToFlowTable(cleanCode, options.title);
  return {
    type: 'structured-table',
    tableData: parsedTable,
    width: 800,
    height: 400,
  };
}

/**
 * Convierte código sintáctico de Mermaid (flowchart/graph/sequence)
 * en una tabla de flujo legible para DOCX y PDF.
 */
function parseMermaidToFlowTable(
  mermaidSource: string,
  customTitle?: string
): { headers: string[]; cells: string[][]; arrows: string[] } {
  const lines = mermaidSource.split('\n').map((l) => l.trim()).filter(Boolean);
  const headers = ['Paso / Nodo', 'Descripción del Proceso', 'Transición / Conexión'];
  const cells: string[][] = [];
  const arrows: string[] = [];

  const nodeMap = new Map<string, { label: string; targets: string[] }>();

  // Regex para nodos y conexiones clásicas de Mermaid: A[Inicio] -->|Condición| B[Proceso]
  const arrowRegex = /([a-zA-Z0-9_-]+)(?:\[(.*?)\]|\((.*?)\)|\{(.*?)\})?\s*(-->|==>|-.->)\s*(?:\|(.*?)\|)?\s*([a-zA-Z0-9_-]+)(?:\[(.*?)\]|\((.*?)\)|\{(.*?)\})?/;

  for (const line of lines) {
    if (line.startsWith('graph') || line.startsWith('flowchart') || line.startsWith('sequenceDiagram') || line.startsWith('%%')) {
      continue;
    }

    const match = line.match(arrowRegex);
    if (match) {
      const sourceId = match[1];
      const sourceLabel = match[2] || match[3] || match[4] || sourceId;
      const arrowType = match[5];
      const condition = match[6] ? ` (Si: ${match[6]})` : '';
      const targetId = match[7];
      const targetLabel = match[8] || match[9] || match[10] || targetId;

      if (!nodeMap.has(sourceId)) {
        nodeMap.set(sourceId, { label: sourceLabel, targets: [] });
      }
      const node = nodeMap.get(sourceId)!;
      node.targets.push(`${targetLabel}${condition}`);

      if (!nodeMap.has(targetId)) {
        nodeMap.set(targetId, { label: targetLabel, targets: [] });
      }

      arrows.push(`${sourceLabel} ${arrowType}${condition} ${targetLabel}`);
    } else {
      // Intentar extraer nodos simples: A[Texto]
      const singleNodeMatch = line.match(/([a-zA-Z0-9_-]+)(?:\[(.*?)\]|\((.*?)\)|\{(.*?)\})/);
      if (singleNodeMatch) {
        const id = singleNodeMatch[1];
        const label = singleNodeMatch[2] || singleNodeMatch[3] || singleNodeMatch[4] || id;
        if (!nodeMap.has(id)) {
          nodeMap.set(id, { label, targets: [] });
        }
      }
    }
  }

  if (nodeMap.size > 0) {
    let index = 1;
    for (const [, info] of nodeMap.entries()) {
      const nextStep = info.targets.length > 0 ? info.targets.join('; ') : 'Fin del proceso / Siguiente fase';
      cells.push([
        `Etapa ${index++}`,
        info.label,
        nextStep,
      ]);
    }
  } else {
    // Si no hubo coincidencias de regex, tabular las líneas directamente
    lines.forEach((line, i) => {
      cells.push([
        `Paso ${i + 1}`,
        line.replace(/[\[\]\(\)\{\}]/g, ''),
        'Secuencia continua',
      ]);
    });
  }

  return {
    headers,
    cells,
    arrows,
  };
}
