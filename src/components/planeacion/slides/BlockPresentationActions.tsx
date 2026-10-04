'use client';

import React, { useState } from 'react';
import type { SlideDeck } from '@/lib/presentation-engine/slide-model';
import SlidesViewerModal from './SlidesViewerModal';
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

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.06)', borderRadius: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--c-text-muted)', marginRight: 'auto' }}>
        🎞️ Presentación electrónica del bloque (generada del Libro, 0 tokens)
      </span>
      <button
        id={`btn-proyectar-${blockIndex}`}
        type="button"
        className="btn btn-navy"
        style={btnStyle}
        onClick={openViewer}
        disabled={loading || downloading}
      >
        {loading ? '⏳ Cargando…' : '▶ Proyectar'}
      </button>
      <button
        id={`btn-descargar-pptx-${blockIndex}`}
        type="button"
        className="btn"
        onClick={downloadPptx}
        disabled={loading || downloading}
        style={{ ...btnStyle, border: '1px solid var(--c-border)', color: 'var(--c-text)', background: 'transparent' }}
      >
        {downloading ? '⏳ Generando…' : '⬇ Descargar .pptx'}
      </button>
      <button
        id={`btn-infografia-${blockIndex}`}
        type="button"
        className="btn"
        style={{ ...btnStyle, border: '1px solid var(--c-border)', color: 'var(--c-text)', background: 'transparent' }}
        onClick={() => setShowInfographics(true)}
      >
        🖼️ Infografías
      </button>
      {error && <span role="alert" style={{ color: '#EF4444', fontSize: 12, width: '100%' }}>{error}</span>}
      {deck && <SlidesViewerModal deck={deck} onClose={() => setDeck(null)} />}
      {showInfographics && (
        <InfographicModal planningId={planningId} blockIndex={blockIndex} onClose={() => setShowInfographics(false)} />
      )}
    </div>
  );
}
