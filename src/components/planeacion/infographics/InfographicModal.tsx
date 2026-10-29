'use client';

import React, { useEffect, useState } from 'react';

interface MissionOption {
  position: number;
  missionIndex: number;
  title: string;
}

interface InfographicModalProps {
  planningId: string;
  blockIndex: number;
  onClose: () => void;
}

type InfographicEngine = 'sacrint' | 'classic';
type InfographicLayout = 'letter' | 'wide';

/**
 * Modal de infografías por misión. Permite alternar entre el motor SACRINT
 * (Carta/16:9, PNG inline) y el motor clásico (SVG/PNG 300 DPI/PDF Carta).
 */
export default function InfographicModal({ planningId, blockIndex, onClose }: InfographicModalProps) {
  const [engine, setEngine] = useState<InfographicEngine>('sacrint');
  const [layout, setLayout] = useState<InfographicLayout>('letter');
  const [missions, setMissions] = useState<MissionOption[]>([]);
  const [pos, setPos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const base =
    engine === 'sacrint'
      ? `/api/planeaciones/${planningId}/infografia/sacrint?blockIndex=${blockIndex}`
      : `/api/planeaciones/${planningId}/infografia?blockIndex=${blockIndex}`;
  const layoutSuffix = engine === 'sacrint' ? `&layout=${layout}` : '';
  const downloadSuffix = engine === 'sacrint' ? '&download=1' : '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}&format=json`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudieron cargar las misiones');
        if (!cancelled) setMissions(data.missions as MissionOption[]);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [base]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const btn: React.CSSProperties = {
    padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: '#fff', textDecoration: 'none',
  };

  const previewSrc =
    missions.length > 0
      ? `${base}&missionIndex=${pos}${layoutSuffix}&format=${engine === 'sacrint' ? 'png' : 'svg'}`
      : '';

  return (
    <div
      id="infographic-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Infografías del bloque"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(8,12,24,0.94)', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px', flexWrap: 'wrap' }}>
        <strong style={{ color: '#fff', marginRight: 'auto' }}>🖼️ Infografías · Bloque {blockIndex + 1}</strong>
        <select
          id="infographic-engine-select"
          aria-label="Estilo de infografía"
          value={engine}
          onChange={(e) => {
            setEngine(e.target.value as InfographicEngine);
            setPos(0);
            setMissions([]);
            setLoading(true);
            setError(null);
          }}
          style={{ ...btn, maxWidth: 220 }}
        >
          <option value="sacrint" style={{ color: '#000' }}>SACRINT · Realismo tecnológico</option>
          <option value="classic" style={{ color: '#000' }}>Clásico · Editor V7</option>
        </select>
        {engine === 'sacrint' && (
          <select
            id="infographic-layout-select"
            aria-label="Formato de infografía"
            value={layout}
            onChange={(e) => setLayout(e.target.value as InfographicLayout)}
            style={{ ...btn, maxWidth: 170 }}
          >
            <option value="letter" style={{ color: '#000' }}>Carta vertical</option>
            <option value="wide" style={{ color: '#000' }}>16:9 horizontal</option>
          </select>
        )}
        {missions.length > 0 && (
          <>
            <select
              id="infographic-mission-select"
              aria-label="Misión"
              value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              style={{ ...btn, maxWidth: 340 }}
            >
              {missions.map((m) => (
                <option key={m.position} value={m.position} style={{ color: '#000' }}>
                  Misión {m.missionIndex}: {m.title}
                </option>
              ))}
            </select>
            <a
              id="infographic-download-png"
              style={btn}
              href={`${base}&missionIndex=${pos}${layoutSuffix}${downloadSuffix}&format=png`}
            >
              ⬇ PNG {engine === 'sacrint' ? (layout === 'letter' ? 'Carta' : '16:9') : '300 DPI'}
            </a>
            <a
              id="infographic-download-pdf"
              style={btn}
              href={`${base}&missionIndex=${pos}${layoutSuffix}${downloadSuffix}&format=pdf`}
            >
              ⬇ PDF {engine === 'sacrint' ? (layout === 'letter' ? 'Carta' : '16:9') : 'Carta'}
            </a>
          </>
        )}
        <button id="infographic-close" style={{ ...btn, background: '#B91C1C' }} onClick={onClose}>✕ Cerrar</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '0 16px 16px' }}>
        {loading && <p style={{ color: '#CBD5E1' }}>Cargando…</p>}
        {error && <p role="alert" style={{ color: '#FCA5A5' }}>{error}</p>}
        {!loading && !error && missions.length === 0 && (
          <p style={{ color: '#CBD5E1' }}>Este libro no tiene misiones para derivar infografías.</p>
        )}
        {missions.length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            id="infographic-preview"
            key={`${engine}-${layout}-${pos}`}
            alt={`Infografía de la misión ${missions[pos]?.missionIndex ?? ''}`}
            src={previewSrc}
            style={{
              maxHeight: '100%',
              width: 'auto',
              maxWidth: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              borderRadius: 6,
              background: engine === 'sacrint' ? '#05070B' : '#fff',
            }}
          />
        )}
      </div>
    </div>
  );
}
