'use client';

/**
 * MermaidDiagram — Fase 11
 * Renderiza un bloque de código Mermaid como diagrama SVG interactivo.
 */

import React, { useEffect, useRef, useState } from 'react';

interface MermaidDiagramProps {
  code: string;
  className?: string;
}

let mermaidLoaded = false;

export default function MermaidDiagram({ code, className = '' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!mermaidLoaded) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
              primaryColor: '#1d4ed8',
              primaryTextColor: '#1e293b',
              primaryBorderColor: '#3b82f6',
              lineColor: '#475569',
              secondaryColor: '#eff6ff',
              tertiaryColor: '#f0fdf4',
              fontSize: '13px',
            },
            flowchart: { curve: 'basis', padding: 16 },
          });
          mermaidLoaded = true;
        }

        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, code.trim());

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRendered(true);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Error al renderizar el diagrama.');
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div style={{ background: '#fff7ed', border: '1px solid #f97316', borderRadius: '8px', padding: '12px 16px', fontSize: '12.5px', color: '#9a3412' }}>
        <strong>⚠ No se pudo renderizar el diagrama:</strong>
        <pre style={{ marginTop: '6px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{error}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflowX: 'auto', textAlign: 'center', padding: '12px 0', minHeight: rendered ? undefined : '80px', background: rendered ? 'transparent' : '#f8fafc', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {!rendered && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Cargando diagrama…</span>}
    </div>
  );
}
