'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Slide, SlideDeck } from '@/lib/presentation-engine/slide-model';

interface SlidesViewerModalProps {
  deck: SlideDeck;
  onClose: () => void;
}

type ViewerTheme = 'palette' | 'light' | 'night';

function themeColors(deck: SlideDeck, theme: ViewerTheme) {
  const p = deck.palette;
  if (theme === 'night') {
    return { bg: '#0F172A', fg: '#E2E8F0', accent: `#${p.accent}`, panel: '#1E293B', muted: '#94A3B8' };
  }
  if (theme === 'light') {
    return { bg: '#FFFFFF', fg: '#111827', accent: `#${p.primary}`, panel: '#F3F4F6', muted: '#4B5563' };
  }
  return { bg: `#${p.surface}`, fg: `#${p.text}`, accent: `#${p.accent}`, panel: `#${p.highlight}`, muted: `#${p.primary}` };
}

function SlideView({ slide, deck, theme }: { slide: Slide; deck: SlideDeck; theme: ViewerTheme }) {
  const c = themeColors(deck, theme);
  const dark = slide.kind === 'cover' || slide.kind === 'closing';
  const bg = dark ? `#${deck.palette.primary}` : c.bg;
  const fg = dark ? '#FFFFFF' : c.fg;

  return (
    <div
      style={{
        width: '100%', height: '100%', background: bg, color: fg,
        display: 'flex', flexDirection: 'column', justifyContent: dark ? 'center' : 'flex-start',
        padding: dark ? '6% 8%' : '4% 6%', boxSizing: 'border-box',
        borderLeft: dark ? `14px solid #${deck.palette.accent}` : undefined,
        fontFamily: 'Calibri, "Segoe UI", system-ui, sans-serif', overflow: 'hidden',
      }}
    >
      <h2 style={{ fontSize: dark ? 'clamp(28px,4.2vw,56px)' : 'clamp(22px,2.8vw,38px)', fontWeight: 800, margin: 0, color: dark ? '#fff' : c.muted, lineHeight: 1.15 }}>
        {slide.title}
      </h2>
      {slide.subtitle && (
        <p style={{ fontSize: 'clamp(14px,1.6vw,22px)', fontWeight: 700, margin: '10px 0 0', color: c.accent }}>
          {slide.subtitle}
        </p>
      )}
      {!dark && <div style={{ height: 4, width: 90, background: c.accent, borderRadius: 2, margin: '14px 0 18px' }} />}
      {slide.bullets && slide.bullets.length > 0 && (
        <ul style={{ margin: dark ? '24px 0 0' : 0, paddingLeft: dark ? 0 : '1.2em', listStyle: dark ? 'none' : 'disc', fontSize: dark ? 'clamp(13px,1.4vw,20px)' : 'clamp(16px,2vw,28px)', lineHeight: 1.45 }}>
          {slide.bullets.map((b, i) => (
            <li key={i} style={{ marginBottom: '0.5em' }}>{b}</li>
          ))}
        </ul>
      )}
      {slide.callout && (
        <div style={{ marginTop: 'auto', background: c.panel, border: `2px solid ${c.accent}`, borderRadius: 12, padding: '14px 20px', color: c.fg }}>
          <div style={{ fontWeight: 800, fontSize: 'clamp(12px,1.3vw,18px)', color: c.muted, marginBottom: 4 }}>{slide.callout.label}</div>
          <div style={{ fontSize: 'clamp(14px,1.7vw,24px)' }}>{slide.callout.text}</div>
        </div>
      )}
    </div>
  );
}

export default function SlidesViewerModal({ deck, onClose }: SlidesViewerModalProps) {
  const [index, setIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [theme, setTheme] = useState<ViewerTheme>('palette');
  const rootRef = useRef<HTMLDivElement>(null);
  const total = deck.slides.length;

  const go = useCallback((delta: number) => {
    setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)));
  }, [total]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(total - 1);
      else if (e.key === 'n' || e.key === 'N') setShowNotes((v) => !v);
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      else if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, toggleFullscreen, total]);

  const btn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  };

  const slide = deck.slides[index];

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Visor de presentación"
      id="slides-viewer-modal"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0B1220', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', flexWrap: 'wrap' }}>
        <strong style={{ color: '#fff', fontSize: 14, marginRight: 'auto' }}>
          {deck.meta.subjectName} · Bloque {deck.meta.blockNumber} — {index + 1}/{total}
        </strong>
        <button id="slides-prev" style={btn} onClick={() => go(-1)} disabled={index === 0}>◀</button>
        <button id="slides-next" style={btn} onClick={() => go(1)} disabled={index === total - 1}>▶</button>
        <button id="slides-notes-toggle" style={btn} onClick={() => setShowNotes((v) => !v)}>📝 Notas (N)</button>
        <select
          id="slides-theme"
          aria-label="Tema visual"
          value={theme}
          onChange={(e) => setTheme(e.target.value as ViewerTheme)}
          style={{ ...btn, padding: '6px 8px' }}
        >
          <option value="palette">Tema de área</option>
          <option value="light">Alto contraste claro</option>
          <option value="night">Modo noche</option>
        </select>
        <button id="slides-fullscreen" style={btn} onClick={toggleFullscreen}>⛶ Pantalla completa (F)</button>
        <button id="slides-close" style={{ ...btn, background: '#B91C1C' }} onClick={onClose}>✕ Cerrar</button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px 10px', minHeight: 0, gap: 12 }}>
        <div style={{ aspectRatio: '16 / 9', maxWidth: '100%', maxHeight: '100%', width: 'min(100%, calc((100vh - 120px) * 16 / 9))', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', borderRadius: 8, overflow: 'hidden' }}>
          <SlideView slide={slide} deck={deck} theme={theme} />
        </div>
      </div>

      {showNotes && (
        <div id="slides-notes-panel" style={{ background: '#111827', color: '#E5E7EB', padding: '10px 18px', fontSize: 14, borderTop: '1px solid #374151' }}>
          <strong style={{ color: '#FBBF24' }}>Notas del docente: </strong>{slide.notes}
        </div>
      )}
    </div>
  );
}
