'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';

// Fase 11 — Mermaid support para guías de práctica
const MarkdownWithMermaid = dynamic(
  () => import('@/components/common/MarkdownWithMermaid'),
  { ssr: false }
);

interface ExtraPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | null;
  contentText?: string | null;
  type?: string | null;
}

export function ExtraPreviewModal({
  isOpen,
  onClose,
  title,
  contentText,
  type,
}: ExtraPreviewModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Simple Markdown to HTML parser
  function renderMarkdown(markdown?: string | null) {
    if (!markdown) return null;
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];

    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('|')) {
        // Skip divider row |---|---|
        if (line.match(/^\|[\s:-|]*$/)) {
          continue;
        }

        const cells = line
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());

        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
          tableRows = [];
        } else {
          tableRows.push(cells);
        }
      } else {
        if (inTable) {
          elements.push(
            <div
              key={`table-${key++}`}
              style={{
                overflowX: 'auto',
                margin: '16px 0',
                border: '1px solid var(--c-border, rgba(255,255,255,0.12))',
                borderRadius: '8px',
              }}
            >
              <table
                style={{
                  minWidth: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                }}
              >
                <thead
                  style={{
                    background: 'var(--c-header-bg, #1e293b)',
                    color: 'var(--c-text, #f8fafc)',
                    borderBottom: '1px solid var(--c-border, rgba(255,255,255,0.12))',
                  }}
                >
                  <tr>
                    {tableHeaders.map((h, idx) => (
                      <th
                        key={idx}
                        style={{
                          padding: '10px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                          borderRight: idx < tableHeaders.length - 1 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ background: 'var(--c-bg-surface, #0f172a)' }}>
                  {tableRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        background: rIdx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        borderBottom: rIdx < tableRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                      }}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            padding: '10px 14px',
                            fontSize: '13px',
                            color: cIdx === 0 && tableHeaders.length === 5 ? 'var(--c-text, #f8fafc)' : 'var(--c-text-2, #cbd5e1)',
                            fontWeight: cIdx === 0 && tableHeaders.length === 5 ? 600 : 'normal',
                            minWidth: cIdx === 0 && tableHeaders.length === 5 ? '190px' : '160px',
                            verticalAlign: 'top',
                            borderRight: cIdx < row.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                          }}
                        >
                          {renderTextFormatting(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          inTable = false;
        }

        if (line === '') continue;

        // Headers
        if (line.startsWith('# ')) {
          elements.push(
            <h1
              key={key++}
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: 'var(--c-text, #f8fafc)',
                marginTop: '24px',
                marginBottom: '12px',
                borderBottom: '2px solid #E65100',
                paddingBottom: '6px',
              }}
            >
              {renderTextFormatting(line.replace('# ', ''))}
            </h1>
          );
        } else if (line.startsWith('## ')) {
          elements.push(
            <h2
              key={key++}
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--c-accent-bright, #38bdf8)',
                marginTop: '20px',
                marginBottom: '10px',
              }}
            >
              {renderTextFormatting(line.replace('## ', ''))}
            </h2>
          );
        } else if (line.startsWith('### ')) {
          elements.push(
            <h3
              key={key++}
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--c-accent-bright, #38bdf8)',
                marginTop: '16px',
                marginBottom: '8px',
              }}
            >
              {renderTextFormatting(line.replace('### ', ''))}
            </h3>
          );
        } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
          const cleanLine = line.substring(2);
          elements.push(
            <li
              key={key++}
              style={{
                marginLeft: '24px',
                listStyleType: 'disc',
                margin: '4px 0 4px 24px',
                color: 'var(--c-text-2, #cbd5e1)',
                fontSize: '13.5px',
                lineHeight: 1.6,
              }}
            >
              {renderTextFormatting(cleanLine)}
            </li>
          );
        } else if (line.startsWith('<svg') || line.includes('<svg')) {
          elements.push(
            <div
              key={key++}
              style={{
                maxWidth: '750px',
                margin: '16px auto',
                background: '#ffffff',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                overflow: 'hidden',
              }}
              dangerouslySetInnerHTML={{ __html: line }}
            />
          );
        } else {
          // Paragraph
          elements.push(
            <p
              key={key++}
              style={{
                margin: '10px 0',
                color: 'var(--c-text-2, #cbd5e1)',
                fontSize: '13.5px',
                lineHeight: 1.6,
              }}
            >
              {renderTextFormatting(line)}
            </p>
          );
        }
      }
    }

    if (inTable) {
      elements.push(
        <div
          key={`table-${key++}`}
          style={{
            overflowX: 'auto',
            margin: '16px 0',
            border: '1px solid var(--c-border, rgba(255,255,255,0.12))',
            borderRadius: '8px',
          }}
        >
          <table
            style={{
              minWidth: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
            }}
          >
            <thead
              style={{
                background: 'var(--c-header-bg, #1e293b)',
                color: 'var(--c-text, #f8fafc)',
                borderBottom: '1px solid var(--c-border, rgba(255,255,255,0.12))',
              }}
            >
              <tr>
                {tableHeaders.map((h, idx) => (
                  <th
                    key={idx}
                    style={{
                      padding: '10px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                      borderRight: idx < tableHeaders.length - 1 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ background: 'var(--c-bg-surface, #0f172a)' }}>
              {tableRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    background: rIdx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    borderBottom: rIdx < tableRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                  }}
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: 'var(--c-text-2, #cbd5e1)',
                        verticalAlign: 'top',
                        borderRight: cIdx < row.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                      }}
                    >
                      {renderTextFormatting(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return elements;
  }

  // Parse **bold** and *italic* runs
  function renderTextFormatting(text: string) {
    const boldParts = text.split(/\*\*([\s\S]*?)\*\*/g);
    return boldParts.map((part, bIdx) => {
      const isBold = bIdx % 2 === 1;

      // Handle simple newlines in text
      const cleanText = part.split('\\n').map((t, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <br />}
          {t}
        </React.Fragment>
      ));

      if (isBold) {
        return (
          <strong key={bIdx} style={{ fontWeight: 700, color: '#f8fafc' }}>
            {cleanText}
          </strong>
        );
      }
      return <span key={bIdx}>{cleanText}</span>;
    });
  }

  function renderVisualResource(content: string) {
    let svg = '';
    let annotations: Array<{
      text: string;
      svgX: number;
      svgY: number;
      fontSize: number;
      bold?: boolean;
      color?: string;
      align?: 'left' | 'center' | 'end';
    }> = [];
    let missionNumber: number | undefined;
    let missionTitle: string | undefined;
    let subjectName: string | undefined;

    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        svg = parsed.svg || '';
        annotations = parsed.annotations || [];
        missionNumber = parsed.missionNumber;
        missionTitle = parsed.missionTitle;
        subjectName = parsed.subjectName;
      } catch {
        svg = trimmed;
      }
    } else {
      svg = trimmed;
    }

    if (!svg.startsWith('<svg')) {
      return (
        <div style={{ padding: '24px', textAlign: 'center', color: '#f87171' }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>⚠️ Formato gráfico no reconocido</p>
        </div>
      );
    }

    // Inyectar anotaciones tipográficas como elementos <text> en el SVG para visualización web nítida
    let enrichedSvg = svg;
    if (annotations.length > 0 && !svg.includes('<text')) {
      const textElements = annotations
        .map((a) => {
          const anchor = a.align === 'center' ? 'middle' : a.align === 'end' ? 'end' : 'start';
          const weight = a.bold ? '700' : '500';
          const color = a.color || '#1e293b';
          const escapedText = a.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
          return `<text x="${a.svgX}" y="${a.svgY}" text-anchor="${anchor}" font-size="${a.fontSize}" font-weight="${weight}" fill="${color}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">${escapedText}</text>`;
        })
        .join('\n');
      enrichedSvg = svg.replace('</svg>', `${textElements}\n</svg>`);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', width: '100%' }}>
        {missionTitle && (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {subjectName ? `${subjectName} · ` : ''}Misión {missionNumber || 1}
            </span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
              {missionTitle}
            </h3>
          </div>
        )}

        {/* Lienzo SVG de Alta Resolución */}
        <div
          style={{
            width: '100%',
            maxWidth: '750px',
            background: '#ffffff',
            borderRadius: '12px',
            padding: '24px 16px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 0 15px rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: enrichedSvg }}
        />

        {/* Pie de figura institucional */}
        <div style={{ textAlign: 'center', maxWidth: '650px' }}>
          <p style={{ margin: 0, fontSize: '12.5px', fontStyle: 'italic', color: '#94a3b8' }}>
            Figura M{missionNumber || 1}.1 — Recurso gráfico vectorial determinístico ($0.00 USD, 0 tokens)
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
            Renderizado vectorial en alta resolución. Este diagrama se incrusta nativamente en el Libro-Cuaderno de Aprendizaje Activo (PDF y DOCX).
          </p>
        </div>

        {/* Desglose de etiquetas y elementos si existen */}
        {annotations.length > 0 && (
          <div
            style={{
              width: '100%',
              maxWidth: '750px',
              marginTop: '4px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
              📌 Elementos y Etiquetas Clave del Diagrama ({annotations.length}):
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {annotations.map((ann, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: ann.bold ? 700 : 500,
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    color: ann.color || '#38bdf8',
                  }}
                >
                  {ann.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const typeLabel =
    type === 'rubric'
      ? 'Rúbrica analítica'
      : type === 'checklist'
      ? 'Lista de cotejo'
      : type === 'material'
      ? 'Material didáctico'
      : type === 'practice_guide'
      ? 'Guía de práctica'
      : type === 'visual'
      ? 'Recurso Gráfico Vectorial'
      : 'Plan de clase';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 10, 20, 0.82)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '88vh',
          background: 'var(--c-card-bg, #0f172a)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '6px',
                background: '#E65100',
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}
            >
              {typeLabel}
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            aria-label="Cerrar modal"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)';
              (e.currentTarget as HTMLElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLElement).style.color = '#94a3b8';
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div
          style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            background: 'var(--c-bg-base, #070d19)',
          }}
        >
          <div
            style={{
              maxWidth: '820px',
              margin: '0 auto',
              padding: '24px',
              background: 'var(--c-bg-surface, #0f172a)',
              border: '1px solid var(--c-border, rgba(255, 255, 255, 0.08))',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              color: 'var(--c-text, #f1f5f9)',
            }}
          >
            {!(contentText || '').trim() ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#cbd5e1' }}>
                  📄 Sin contenido disponible
                </p>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
                  Este recurso aún no contiene texto generado o está pendiente de sincronización.
                </p>
              </div>
            ) : type === 'visual' || (contentText || '').trim().startsWith('{"svg"') || (contentText || '').trim().startsWith('<svg') ? (
              // Recursos gráficos vectoriales (Visual Engine)
              renderVisualResource(contentText || '')
            ) : type === 'practice_guide' ? (
              // Guías de práctica: renderizado con soporte Mermaid (Fase 11)
              <MarkdownWithMermaid markdown={contentText || ''} />
            ) : (
              // Rúbricas, listas de cotejo, planes de clase: parser existente con tablas
              renderMarkdown(contentText || '')
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '12px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'var(--c-bg-surface, #0f172a)',
          }}
        >
          <button
            onClick={onClose}
            className="btn"
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#f8fafc',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
