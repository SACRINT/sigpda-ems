'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SacrintMissionMeta, SacrintSlideKind } from '@/lib/visual-engine/sacrint/spec';
import type { SacrintPack } from '@/lib/visual-engine/sacrint/discipline-packs';

interface MissionOption {
  position: number;
  missionIndex: number;
  title: string;
}

interface SacrintSlidesPayload {
  missions: MissionOption[];
  width: number;
  height: number;
  deck: {
    meta: SacrintMissionMeta;
    pack: SacrintPack;
    slides: Array<{ kind: SacrintSlideKind; filename: string }>;
  };
}

interface SacrintSlidesViewerModalProps {
  planningId: string;
  blockIndex: number;
  onClose: () => void;
}

const KIND_LABEL: Record<SacrintSlideKind, string> = {
  cover: 'Portada',
  hook: 'Gancho',
  concept: 'Núcleo técnico',
  demo: 'Yo hago',
  practice: 'Hacemos',
  challenge: 'Tú haces',
  evidence: 'Evidencia',
  closing: 'Cierre',
};

export default function SacrintSlidesViewerModal({
  planningId,
  blockIndex,
  onClose,
}: SacrintSlidesViewerModalProps) {
  const [data, setData] = useState<SacrintSlidesPayload | null>(null);
  const [missions, setMissions] = useState<MissionOption[]>([]);
  const [missionPos, setMissionPos] = useState(0);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const base = `/api/planeaciones/${planningId}/presentacion/sacrint?blockIndex=${blockIndex}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}&missionIndex=${missionPos}&format=json`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'No se pudo cargar la presentación SACRINT');
        if (!cancelled) {
          setData(payload as SacrintSlidesPayload);
          setMissions((payload as SacrintSlidesPayload).missions);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [base, missionPos]);

  const total = data?.deck.slides.length ?? 8;

  const go = useCallback((delta: number) => {
    setImageLoading(true);
    setIndex((current) => Math.min(total - 1, Math.max(0, current + delta)));
  }, [total]);

  const toggleFullscreen = useCallback(() => {
    const element = rootRef.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') {
        event.preventDefault();
        go(1);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        go(-1);
      } else if (event.key === 'Home') {
        setImageLoading(true);
        setIndex(0);
      } else if (event.key === 'End') {
        setImageLoading(true);
        setIndex(total - 1);
      } else if (event.key === 'f' || event.key === 'F') {
        toggleFullscreen();
      } else if (event.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, toggleFullscreen, total]);

  const previewSrc = data
    ? `${base}&missionIndex=${missionPos}&slide=${index}&format=png`
    : '';
  const downloadSrc = data
    ? `${base}&missionIndex=${missionPos}&slide=${index}&format=png&download=1`
    : '#';
  const pptxSrc = data
    ? `${base}&missionIndex=${missionPos}&format=pptx`
    : '#';

  const buttonStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 600,
  };

  return (
    <div
      ref={rootRef}
      id="sacrint-slides-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Visor de presentación SACRINT"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#02040A', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', flexWrap: 'wrap' }}>
        <strong style={{ color: '#E6EEF8', fontSize: 14, marginRight: 'auto' }}>
          SACRINT · {data?.deck.meta.subjectName ?? 'Presentación'} · Misión {data?.deck.meta.missionNumber ?? missionPos + 1} — {index + 1}/{total}
        </strong>
        {missions.length > 1 && (
          <select
            aria-label="Misión"
            value={missionPos}
            onChange={(event) => {
              setMissionPos(Number(event.target.value));
              setIndex(0);
              setLoading(true);
              setImageLoading(true);
              setError(null);
            }}
            style={{ ...buttonStyle, padding: '6px 8px', color: '#fff' }}
          >
            {missions.map((mission) => (
              <option key={mission.position} value={mission.position} style={{ color: '#000' }}>
                Misión {mission.missionIndex}: {mission.title}
              </option>
            ))}
          </select>
        )}
        <button style={buttonStyle} onClick={() => go(-1)} disabled={index === 0}>◀</button>
        <button style={buttonStyle} onClick={() => go(1)} disabled={index === total - 1}>▶</button>
        <a style={{ ...buttonStyle, textDecoration: 'none' }} href={downloadSrc}>⬇ PNG</a>
        <a style={{ ...buttonStyle, textDecoration: 'none' }} href={pptxSrc} title="Descargar las 8 diapositivas editables">⬇ PPTX</a>
        <button style={buttonStyle} onClick={toggleFullscreen}>⛶ Pantalla completa (F)</button>
        <button style={{ ...buttonStyle, background: '#B91C1C' }} onClick={onClose}>✕ Cerrar</button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px 14px', minHeight: 0 }}>
        <div
          style={{
            position: 'relative',
            aspectRatio: '16 / 9',
            width: 'min(100%, calc((100vh - 120px) * 16 / 9))',
            maxHeight: '100%',
            background: '#05070B',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.55)',
          }}
        >
          {data && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${missionPos}-${index}`}
              src={previewSrc}
              alt={`Diapositiva ${index + 1}: ${KIND_LABEL[data.deck.slides[index]?.kind ?? 'cover']}`}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setError('No se pudo renderizar la diapositiva.');
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          )}
          {(loading || imageLoading) && !error && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#AFC1D6', fontSize: 14, background: 'rgba(2,4,10,0.72)' }}>
              Renderizando diapositiva…
            </div>
          )}
          {error && (
            <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#FCA5A5', fontSize: 14, padding: 24, textAlign: 'center', background: 'rgba(2,4,10,0.85)' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
