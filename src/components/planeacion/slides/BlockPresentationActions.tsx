'use client';

import React, { useState } from 'react';
import type { SlideDeck } from '@/lib/presentation-engine/slide-model';
import SlidesViewerModal from './SlidesViewerModal';
import SacrintSlidesViewerModal from './SacrintSlidesViewerModal';
import InfographicModal from '@/components/planeacion/infographics/InfographicModal';

interface BlockPresentationActionsProps {
  planningId: string;
  blockIndex: number;
}

/**
 * Acciones de presentación por bloque: proyectar en el navegador o descargar .pptx.
 */
export default function BlockPresentationActions({ planningId, blockIndex }: BlockPresentationActionsProps) {
  const [deck, setDeck] = useState<SlideDeck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfographics, setShowInfographics] = useState(false);
  const [showSacrint, setShowSacrint] = useState(false);

  const [downloading, setDownloading] = useState(false);

  const base = `/api/planeaciones/${planningId}/presentacion?blockIndex=${blockIndex}`;

  const openViewer = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}&format=json`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la presentación');
      setDeck(data.deck as SlideDeck);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const downloadPptx = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`${base}&format=pptx`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Error ${res.status} al descargar presentación`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Presentacion_Bloque_${blockIndex + 1}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido al descargar presentación');
    } finally {
      setDownloading(false);
    }
  };

  const btnBaseStyle: React.CSSProperties = {
    padding: '7px 14px',
    fontSize: '12px',
    borderRadius: '7px',
    cursor: 'pointer',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        padding: '12px 18px',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.35) 0%, rgba(15, 23, 42, 0.6) 100%)',
        borderRadius: '9px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#e0e7ff', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🎞️ Diapositivas e Infografías del Bloque
        </span>
        <span
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '9999px',
            background: 'rgba(139, 92, 246, 0.18)',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            color: '#c4b5fd',
            fontWeight: 600,
          }}
        >
          0 Tokens IA
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          id={`btn-proyectar-${blockIndex}`}
          type="button"
          style={{
            ...btnBaseStyle,
            background: 'rgba(99, 102, 241, 0.25)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            color: '#a5b4fc',
          }}
          onClick={openViewer}
          disabled={loading || downloading}
        >
          {loading ? '⏳ Cargando…' : '▶ Proyectar'}
        </button>

        <button
          id={`btn-proyectar-sacrint-${blockIndex}`}
          type="button"
          style={{
            ...btnBaseStyle,
            border: '1px solid rgba(234, 179, 8, 0.55)',
            color: '#facc15',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
          onClick={() => setShowSacrint(true)}
          disabled={loading || downloading}
        >
          ⭐ SACRINT
        </button>

        <button
          id={`btn-descargar-pptx-${blockIndex}`}
          type="button"
          onClick={downloadPptx}
          disabled={loading || downloading}
          style={{
            ...btnBaseStyle,
            border: '1px solid rgba(249, 115, 22, 0.45)',
            color: '#fdba74',
            background: 'rgba(249, 115, 22, 0.12)',
          }}
        >
          {downloading ? '⏳ Generando…' : '⬇ Descargar PPTX'}
        </button>

        <button
          id={`btn-infografia-${blockIndex}`}
          type="button"
          style={{
            ...btnBaseStyle,
            border: '1px solid rgba(236, 72, 153, 0.45)',
            color: '#f472b6',
            background: 'rgba(236, 72, 153, 0.12)',
          }}
          onClick={() => setShowInfographics(true)}
        >
          🖼️ Infografías
        </button>
      </div>

      {error && <span role="alert" style={{ color: '#fb7185', fontSize: '12px', width: '100%', marginTop: '4px' }}>{error}</span>}
      {deck && <SlidesViewerModal deck={deck} onClose={() => setDeck(null)} />}
      {showSacrint && (
        <SacrintSlidesViewerModal planningId={planningId} blockIndex={blockIndex} onClose={() => setShowSacrint(false)} />
      )}
      {showInfographics && (
        <InfographicModal planningId={planningId} blockIndex={blockIndex} onClose={() => setShowInfographics(false)} />
      )}
    </div>
  );
}
