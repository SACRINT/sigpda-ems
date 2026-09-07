'use client';

/**
 * MarkdownWithMermaid — Fase 11
 * Parsea texto Markdown simple e intercala bloques mermaid como diagramas SVG.
 * El resto del Markdown se renderiza como HTML básico (sin dependencia externa).
 */

import React from 'react';
import dynamic from 'next/dynamic';

// Lazy load del componente de diagrama para no bloquear el render inicial
const MermaidDiagram = dynamic(() => import('./MermaidDiagram'), { ssr: false });

interface Props {
  markdown: string;
}

interface Segment {
  type: 'text' | 'mermaid';
  content: string;
}

/** Divide el markdown en segmentos de texto y bloques mermaid */
function parseMarkdownSegments(md: string): Segment[] {
  const segments: Segment[] = [];
  const mermaidRegex = /```mermaid\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mermaidRegex.exec(md)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: md.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'mermaid', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < md.length) {
    segments.push({ type: 'text', content: md.slice(lastIndex) });
  }

  return segments;
}

/** Convierte Markdown sencillo a HTML (sin librería pesada) */
function simpleMarkdownToHtml(md: string): string {
  return md
    // Headers
    .replace(/^#### (.+)$/gm, '<h4 style="font-size:14px;font-weight:700;margin:14px 0 4px;">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:16px 0 6px;color:#0f172a;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:800;margin:18px 0 8px;color:#1d4ed8;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:900;margin:20px 0 10px;color:#1d4ed8;">$1</h1>')
    // Bold / Italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[\s]*[-*] (.+)$/gm, '<li style="margin-bottom:4px;">$1</li>')
    // Ordered lists
    .replace(/^[\s]*\d+\. (.+)$/gm, '<li style="margin-bottom:4px;">$1</li>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;"/>')
    // Code inline
    .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:2px 5px;border-radius:4px;font-size:12px;font-family:monospace;">$1</code>')
    // Line breaks (double newline = paragraph)
    .replace(/\n\n/g, '</p><p style="margin:0 0 10px;line-height:1.65;font-size:13.5px;">')
    .replace(/\n/g, '<br/>');
}

export default function MarkdownWithMermaid({ markdown }: Props) {
  const segments = parseMarkdownSegments(markdown);

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b', lineHeight: 1.65 }}>
      {segments.map((seg, i) => {
        if (seg.type === 'mermaid') {
          return (
            <div key={i} style={{ margin: '16px 0', padding: '12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px' }}>
              <p style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📊 Diagrama de procedimiento
              </p>
              <MermaidDiagram code={seg.content} />
            </div>
          );
        }

        const html = simpleMarkdownToHtml(seg.content);
        return (
          <div
            key={i}
            dangerouslySetInnerHTML={{
              __html: `<p style="margin:0 0 10px;line-height:1.65;font-size:13.5px;">${html}</p>`,
            }}
          />
        );
      })}
    </div>
  );
}
