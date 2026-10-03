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

/**
 * Modal de infografías por misión: vista previa (SVG vía <img>, sin inyección de HTML)
 * y descarga en PNG 300 DPI o PDF de una página.
 */
export default function InfographicModal({ planningId, blockIndex, onClose }: InfographicModalProps) {
  const [missions, setMissions] = useState<MissionOption[]>([]);
  const [pos, setPos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const base = `/api/planeaciones/${planningId}/infografia?blockIndex=${blockIndex}`;

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
            <a id="infographic-download-png" style={btn} href={`${base}&missionIndex=${pos}&format=png`}>⬇ PNG 300 DPI</a>
            <a id="infographic-download-pdf" style={btn} href={`${base}&missionIndex=${pos}&format=pdf`}>⬇ PDF Carta</a>
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
            alt={`Infografía de la misión ${missions[pos]?.missionIndex ?? ''}`}
            src={`${base}&missionIndex=${pos}&format=svg`}
            style={{ maxHeight: '100%', width: 'auto', maxWidth: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', borderRadius: 6, background: '#fff' }}
          />
        )}
      </div>
    </div>
  );
}
