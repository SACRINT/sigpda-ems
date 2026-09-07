'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Fase 11 — Mermaid support para guías de práctica
const MarkdownWithMermaid = dynamic(
  () => import('@/components/common/MarkdownWithMermaid'),
  { ssr: false }
);

interface ExtraPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  contentText: string;
  type: string;
}

export function ExtraPreviewModal({
  isOpen,
  onClose,
  title,
  contentText,
  type,
}: ExtraPreviewModalProps) {
  if (!isOpen) return null;

  // Simple Markdown to HTML parser
  function renderMarkdown(markdown: string) {
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
            <div key={`table-${key++}`} className="overflow-x-auto my-4 border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#1A1A2E] text-white">
                  <tr>
                    {tableHeaders.map((h, idx) => (
                      <th
                        key={idx}
                        className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {tableRows.map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2.5 text-sm text-gray-700 max-w-xs">
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
              className="text-2xl font-bold text-[#1A1A2E] mt-6 mb-3 border-b-2 border-[#E65100] pb-1"
            >
              {renderTextFormatting(line.replace('# ', ''))}
            </h1>
          );
        } else if (line.startsWith('## ')) {
          elements.push(
            <h2 key={key++} className="text-xl font-semibold text-[#0F3460] mt-5 mb-2.5">
              {renderTextFormatting(line.replace('## ', ''))}
            </h2>
          );
        } else if (line.startsWith('### ')) {
          elements.push(
            <h3 key={key++} className="text-lg font-semibold text-[#0F3460] mt-4 mb-2">
              {renderTextFormatting(line.replace('### ', ''))}
            </h3>
          );
        } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
          const cleanLine = line.substring(2);
          elements.push(
            <li key={key++} className="ml-6 list-disc my-1 text-gray-700 text-sm leading-relaxed">
              {renderTextFormatting(cleanLine)}
            </li>
          );
        } else {
          // Paragraph
          elements.push(
            <p key={key++} className="my-2.5 text-gray-700 text-sm leading-relaxed">
              {renderTextFormatting(line)}
            </p>
          );
        }
      }
    }

    if (inTable) {
      elements.push(
        <div key={`table-${key++}`} className="overflow-x-auto my-4 border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#1A1A2E] text-white">
              <tr>
                {tableHeaders.map((h, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 text-sm text-gray-700 max-w-xs">
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
          <strong key={bIdx} className="font-semibold text-slate-900">
            {cleanText}
          </strong>
        );
      }
      return <span key={bIdx}>{cleanText}</span>;
    });
  }

  const typeLabel =
    type === 'rubric'
      ? 'Rúbrica analítica'
      : type === 'checklist'
      ? 'Lista de cotejo'
      : type === 'material'
      ? 'Material didáctico'
      : 'Plan de clase';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1A1A2E] text-white">
          <div>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#E65100] text-white uppercase tracking-wider mr-2">
              {typeLabel}
            </span>
            <h2 className="inline-block text-lg font-bold truncate max-w-lg align-middle">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors duration-150"
            aria-label="Cerrar modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
          <div className="max-w-3xl mx-auto px-4 py-6 bg-white border border-slate-200 shadow-sm rounded-xl">
            {type === 'practice_guide' ? (
              // Guías de práctica: renderizado con soporte Mermaid (Fase 11)
              <MarkdownWithMermaid markdown={contentText} />
            ) : (
              // Rúbricas, listas de cotejo, planes de clase: parser existente con tablas
              renderMarkdown(contentText)
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors duration-150"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
